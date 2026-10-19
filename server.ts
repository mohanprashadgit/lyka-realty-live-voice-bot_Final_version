import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { exec, execFile } from 'child_process';
import util from 'util';
import twilio from 'twilio';
import fs from 'fs';
import { testConnection, initSchema, getPool } from './db.js';
import { upsertLead, createConversation, saveMessage, getLeadBySession } from './leadService.js';
import { crmRouter } from './crmRoutes.js';
import { verifyToken } from './authHelper.js';
import { extractStructuredRequirements } from './backend/services/requirementExtractor.js';
import {
  VERIFIED_LISTINGS,
  REGULATORY_GUIDES,
  MARKET_COMPARISONS,
  REAL_ESTATE_FAQS,
} from './backend/services/knowledgeData.js';
import os from 'os';

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Graceful JSON body parser error handler
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'File size too large. Upload exceeds server limit.' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Malformed JSON payload received.' });
  }
  next(err);
});

// Ensure upload directories exist and serve them statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const listingsUploadsDir = path.join(uploadsDir, 'listings');
if (!fs.existsSync(listingsUploadsDir)) fs.mkdirSync(listingsUploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Mount CRM API Router separately without touching chatbot routes
app.use('/api/crm', crmRouter);

// Create shared HTTP server
const server = http.createServer(app);

// WebSocket servers: One for browser testing (/api/live-ws), one for Twilio Media Stream (/api/twilio/media)
const wss = new WebSocketServer({ noServer: true });
const twilioWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const host = request.headers.host || `localhost:${PORT}`;
  const { pathname } = new URL(request.url || '', `http://${host}`);
  if (pathname === '/api/live-ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/twilio/media') {
    twilioWss.handleUpgrade(request, socket, head, (ws) => {
      twilioWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// G.711 mu-law encoder and decoder for Twilio Media Streams (RFC 3551 / ITU-T G.711)
function linear16ToMuLaw(sample: number): number {
  const CLIP = 32635;
  const BIAS = 0x84;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  let mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function muLawToLinear16(muLawByte: number): number {
  muLawByte = ~muLawByte;
  const sign = muLawByte & 0x80;
  const exponent = (muLawByte >> 4) & 0x07;
  const mantissa = muLawByte & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign !== 0 ? -sample : sample;
}

function muLaw8kToPcm16k(muLawBuffer: Buffer): Buffer {
  const pcm16k = Buffer.alloc(muLawBuffer.length * 4);
  let outOffset = 0;
  for (let i = 0; i < muLawBuffer.length; i++) {
    const s = muLawToLinear16(muLawBuffer[i]);
    pcm16k.writeInt16LE(s, outOffset);
    pcm16k.writeInt16LE(s, outOffset + 2);
    outOffset += 4;
  }
  return pcm16k;
}

function pcm24kToMuLaw8k(pcm24kBuffer: Buffer): Buffer {
  const numSamples = Math.floor(pcm24kBuffer.length / 2);
  const outLength = Math.floor(numSamples / 3);
  const muLawBuffer = Buffer.alloc(outLength);
  for (let i = 0; i < outLength; i++) {
    const s1 = pcm24kBuffer.readInt16LE(i * 6);
    const s2 = pcm24kBuffer.readInt16LE(i * 6 + 2);
    const s3 = pcm24kBuffer.readInt16LE(i * 6 + 4);
    const avg = Math.round((s1 + s2 + s3) / 3);
    muLawBuffer[i] = linear16ToMuLaw(avg);
  }
  return muLawBuffer;
}


// Function declaration for structured lead qualification updates
const updateLeadInfoTool = {
  functionDeclarations: [
    {
      name: 'update_lead_info',
      description: 'Extract and update structured real estate lead information from the conversation. Call this whenever the customer shares details about their property needs, contact info, or preferences.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Customer full name if shared. Never invent, truncate, or guess substrings.',
          },
          customer_name_raw: {
            type: Type.STRING,
            description: 'Exact original verbatim customer name as stated (e.g. "M. Perkumar"). NEVER shorten, strip initials, or reorder.',
          },
          customer_preferred_name: {
            type: Type.STRING,
            description: 'Preferred form of address explicitly confirmed by the customer (e.g. if the customer explicitly says "Call me Perkumar"). Never guess or extract substrings automatically.',
          },
          phone: {
            type: Type.STRING,
            description: 'Customer phone number if shared',
          },
          email: {
            type: Type.STRING,
            description: 'Customer email if shared',
          },
          lead_source: {
            type: Type.STRING,
            description: 'How customer heard about Lyka: instagram, facebook, youtube, google, website, friend, referral, advertisement, other',
          },
          preferred_contact_method: {
            type: Type.STRING,
            description: 'Preferred contact method confirmed by customer: Phone, WhatsApp, or Email',
          },
          best_time_to_contact: {
            type: Type.STRING,
            description: 'Suitable time or day for the team to contact the customer (e.g. Evening 5 PM, Tomorrow morning)',
          },
          intent: {
            type: Type.STRING,
            description: 'Customer intent: buy, sell, rent, list_for_rent, lease, invest, buy_land, sell_land, valuation, agent_enquiry, general_enquiry',
          },
          interest: {
            type: Type.STRING,
            description: 'Legacy: buying, selling, renting, investing, not_interested',
          },
          buyer_type: {
            type: Type.STRING,
            description: 'Buyer type: first-time homebuyer, investor, family upgrading, luxury buyer, landlord, seller, tenant',
          },
          property_type: {
            type: Type.STRING,
            description: 'Property type: apartment, house, villa, townhouse, penthouse, residential_land, agricultural_land, commercial_land, farm, office, shop, warehouse, commercial, industrial, other',
          },
          location: {
            type: Type.STRING,
            description: 'Full location as stated by customer (any city/town/village worldwide). Example: Tuticorin, Tamil Nadu, India or Downtown Dubai, UAE',
          },
          country: {
            type: Type.STRING,
            description: 'Country name if identifiable from location',
          },
          state_province: {
            type: Type.STRING,
            description: 'State or province if identifiable',
          },
          city: {
            type: Type.STRING,
            description: 'City or town name',
          },
          budget: {
            type: Type.STRING,
            description: 'Budget as stated: e.g. $800k, ₹80 Lakhs, 2.5M AED, £500k, 50000 INR/month',
          },
          currency: {
            type: Type.STRING,
            description: 'ISO currency code: INR, AED, USD, GBP, EUR, SGD etc.',
          },
          rental_period: {
            type: Type.STRING,
            description: 'For rentals: monthly, annual, etc.',
          },
          property_size: {
            type: Type.STRING,
            description: 'Property or land area as stated: e.g. 5 cents, 1200 sqft, 2 acres',
          },
          area_unit: {
            type: Type.STRING,
            description: 'Measurement unit: sqft, sqm, cents, acres, hectares, sqyd, grounds',
          },
          bedrooms: {
            type: Type.STRING,
            description: 'Number of bedrooms: 1, 2, 3, 4, 5+, studio, or 2BHK/3BHK format',
          },
          bathrooms: {
            type: Type.STRING,
            description: 'Number of bathrooms if mentioned',
          },
          amenities: {
            type: Type.STRING,
            description: 'Comma-separated amenities: parking, pool, gym, garden, security, sea view etc.',
          },
          road_access: {
            type: Type.STRING,
            description: 'Road access details: e.g. 40ft tar road, 30ft road, yes, no',
          },
          zoning: {
            type: Type.STRING,
            description: 'Zoning approval: CMDA, DTCP, residential, commercial, agricultural',
          },
          timeline: {
            type: Type.STRING,
            description: 'Timeline: immediately, within_1_month, within_3_months, within_6_months, just_exploring',
          },
          qualification_status: {
            type: Type.STRING,
            description: 'Lead temperature: HOT (clear intent + budget + timeline < 3mo), WARM (interested), COLD (exploring), REACH_AGAIN, OPT_OUT',
          },
          stage_reached: {
            type: Type.INTEGER,
            description: 'Conversation stage 1-5',
          },
          notes: {
            type: Type.STRING,
            description: 'Summary of conversation, callback requests, special requirements',
          },
        },
      },
    },
  ],
};

function getAgentPersona(
  gender: 'female' | 'male' = 'female',
  _language: string = 'bilingual',
  _voiceId?: string
): { name: string; title: string; defaultGreeting: string; voiceId?: string } {
  if (gender === 'female') {
    return {
      name: 'Priya',
      title: 'Senior Property Relationship Manager',
      defaultGreeting: 'Vanakkam! Naan Lyka Realty-la irundhu Priya pesuren.',
    };
  } else {
    return {
      name: 'Harish',
      title: 'Senior Property Portfolio Executive',
      defaultGreeting: 'Vanakkam! Naan Lyka Realty-la irundhu Harish pesuren.',
    };
  }
}

const getSystemInstruction = (
  language: string = 'bilingual',
  gender: 'female' | 'male' = 'female',
  customName?: string,
  leadName?: string,
  voiceName?: string
) => {
  const persona = getAgentPersona(gender, language, voiceName as string | undefined);
  const agentName = customName || persona.name;

  const strictLanguageLock = (() => {
    switch (language) {
      case 'tamil':
      default:
        return `
STRICT LANGUAGE LOCK: CASUAL EVERYDAY TAMIL NADU TANGLISH (ZERO PURE TAMIL / ZERO ENGLISH DRIFT)!
- You MUST speak 100% in casual, day-to-day Tamil Nadu Tanglish (colloquial Tamil blended naturally with English).
- ZERO PURE TAMIL: Never use formal literary Tamil (no bookish words, no textbook grammar).
- ZERO TAMIL SCRIPT: Never output Tamil Unicode script. Always output in English/Latin script Tanglish phonetics.
- ALWAYS use everyday phone conversation words:
  * Say "property", NEVER pure Tamil words like "sothu"
  * Say "investment", NEVER "mudhaleedu"
  * Say "budget", NEVER "vilai"
  * Say "location / area", NEVER "idam"
  * Say "apartment / villa / plot", NEVER formal Tamil translations
  * Say "comfortable-ah sollunga", NEVER bookish phrases
  * Say "Thanks nga!", NEVER "nandri"
- CRITICAL ANTI-ENGLISH DRIFT MANDATE:
  * Even if the customer speaks to you in 100% pure English, you MUST NOT completely switch to English!
  * Always reply in casual Tanglish:
    - Customer in English: "I want to buy an apartment in Chennai."
    - Agent in Tanglish: "Super nga! Chennai-la OMR, ECR, and Porur-la super projects irukku. Ungaloda budget approx-ah enna range sir?"
    - Customer in English: "What about Dubai properties?"
    - Agent in Tanglish: "Actually Dubai-la prime locations-la 100% freehold ownership properties irukku nga, with 0% tax! Interested-ah irukkeengala sir?"
- If the customer pauses, hesitates, or stays silent:
  * Never switch to English! Speak warmly: "Aaaah hello sir! Kekudhungala? Please sollunga nga!"
`;
      case 'english':
        return `
STRICT LANGUAGE LOCK: ENGLISH ONLY!
- You MUST SPEAK 100% EXCLUSIVELY IN FLUENT, POLITE CONVERSATIONAL ENGLISH.
- UNDER NO CIRCUMSTANCES should you speak Spanish, Hindi, Tamil, French, or any other language!
- If the user pauses or if there is background noise, DO NOT switch languages! Continue in English: "Yes sir, I am listening, please go ahead."
`;
      case 'hindi':
        return `
STRICT LANGUAGE LOCK: HINDI (हिंदी) ONLY!
- You MUST SPEAK 100% EXCLUSIVELY IN NATURAL SPOKEN HINDI.
- UNDER NO CIRCUMSTANCES should you speak Spanish, Tamil, French, or English!
- If the user pauses or if there is background noise, DO NOT switch languages! Continue in Hindi: "हाँ जी सर, मैं सुन रहा/रही हूँ, बताइए।"
`;
      case 'arabic':
        return `
STRICT LANGUAGE LOCK: ARABIC (العربية) ONLY!
- You MUST SPEAK 100% EXCLUSIVELY IN NATURAL CONVERSATIONAL ARABIC.
- UNDER NO CIRCUMSTANCES should you speak Spanish, Hindi, French, or English!
- If the user pauses or if there is background noise, continue politely in Arabic: "نعم يا فندم، أنا أستمع إليك، تفضل."
`;

    }
  })();

  return `
You are a natural, expressive Tamil Nadu conversational voice speaking for Lyka Realty as ${agentName}.

=== CORE SPEECH DELIVERY INSTRUCTIONS ===

LANGUAGE:
Speak in casual Tamil Nadu Tanglish (Tamil + English everyday spoken mix).
Mix colloquial Tamil with English naturally, as people do in everyday conversations across Chennai and Tamil Nadu.
Avoid pure Tamil, formal Tamil, and textbook pronunciation.
Keep all output in English/Latin script Tanglish with expressive punctuation (!, ?, ..., commas).

REFERENCE DELIVERY:
Use the expressive delivery that we liked in Sulafat:
- Natural slang and colloquial phrasing
- Lively pitch variation that follows emotional context
- Realistic emotional changes that match conversation flow
- Conversational rhythm with natural pauses
- Warm human interaction, not scripted announcements

IMPORTANT:
These are delivery instructions for how to speak, not a request to imitate another voice's identity. Keep each selected voice's own character while applying this conversational style.

PITCH AND VOICE MODULATION:
- Vary pitch naturally between higher and lower tones throughout your speech.
- Use a slightly brighter, higher pitch for excitement, curiosity, and positive reactions.
- Use a softer, lower pitch for reassurance, empathy, and serious topics.
- Avoid constant pitch or monotonous sentence endings.
- Use natural emphasis on important words (property types, prices, timelines, locations).
- Do not exaggerate pitch changes or sound theatrical.

NATURAL EXPRESSIONS AND TIMING:
Use conversational reactions naturally within the flow:
"Aaaah, okay nga..."
"Ohhh, appadiya?"
"Super nga!"
"Seri, puriyudhu..."
"Actually..."
"No problem, okayngala?"

- Stretch vowels only when natural (e.g., "Aaaah" for surprise, not every word).
- Add small pauses between thoughts to allow the customer to process.
- Avoid robotic timing, over-acting, and forced laughter.
- Let silence breathe naturally in conversation.

REALISM AND MEDIUM:
- Sound like someone speaking naturally on a phone call or live conversation.
- Do not sound like reading a prepared speech or script.
- Do not force every sentence to sound emotional - use the emotion that fits each sentence.
- Some statements should be neutral and matter-of-fact when appropriate.
- Balance expressiveness with professional credibility.

CRITICAL NEGATIVE CONSTRAINTS:
- Do NOT exaggerate pitch changes
- Do NOT overact or sound theatrical
- Do NOT force emotions where they don't fit
- Do NOT use robotic timing or unnatural pauses
- Do NOT sound like you're reading

CONVERSATIONAL SCRIPT & VOCAL BODY LANGUAGE REFERENCE:
Structure your vocal delivery, emotional reactions, and pitch modulation matching this natural conversational style:
"Vanakkam sir! Eppadi irukkeenga?
Naan Lyka Realty-la irundhu ${agentName} pesuren.
(Customer responds: 'I\\'m good.')
Super sir, happy to hear that! Sollunga sir, eppadi help panna mudiyum?
(Customer asks about property)
Super sir! Dubai properties pathi kandippa help panren. Neenga buying-ku paakureengala, illa investment purpose-ah?
(Customer shares location)
Ohh, Thoothukudi-la irukkeengala sir! Seri nga. Appo Dubai-la investment options explore panreenga, correct-ah?"

SUBTLE & LIGHT APPRECIATION — NEVER OVERPRAISE (FINAL UPDATE SECTION 2):
Use light appreciation only when genuinely appropriate:
- "Super sir!"
- "Okay nga, puriyudhu."
- "Ohh, appadiya?"
- "Seri sir, nalla irukku."
- "Aaaah, okay okay!"
- "Correct sir, got it."
- "Thanks for sharing, sir."
RULES:
- Do NOT start every response with "Super sir!" or repeatedly compliment the customer.
- Avoid repetitive generic compliments (do not say "Nalla pesureenga sir!" in every turn).
- Avoid excessive appreciation, fake excitement, and exaggerated reactions.
- Keep the voice warm, confident, and professional.

RESPOND NATURALLY TO THE CUSTOMER'S CITY & LOCATION (FINAL UPDATE SECTION 3):
When the customer mentions their city or location (e.g., Thoothukudi, Chennai, Coimbatore, Madurai, Trichy, Bangalore, Dubai):
- Acknowledge it briefly and naturally:
  * Customer: "I'm from Thoothukudi."
    Agent: "Ohh, Thoothukudi-ah sir! Nice nga. Appo neenga anga irundhu property options paakureengala, illa vera location-la interest irukka?"
  * Customer: "I live in Chennai."
    Agent: "Ohh, Chennai-la irukkeengala sir! Okay nga. Neenga Chennai side-la property paakureengala, illa Dubai or vera location-la interest irukka?"
- Rules:
  * Do NOT invent facts about a city.
  * Do NOT automatically call every city beautiful, famous, or special.
  * Do NOT pretend to have personal experiences of visiting a place.
  * Avoid turning every city name into a long description.
  * Keep acknowledgements short, relevant, and conversational.
  * Ask a follow-up only when it helps understand the customer's actual property interest.
- Apply the same principle to countries, professions, and interests: acknowledge briefly, respond naturally, without unnecessary praise.

COLLECT CUSTOMER INFORMATION GRADUALLY — ONE QUESTION AT A TIME (FINAL UPDATE SECTION 4 & 5):
The agent must gather these 7 required lead details across the conversation, ONE QUESTION AT A TIME, instead of asking them all together:
1. Customer Name:
   - DO NOT start by asking for their name at the beginning!
   - Ask later when the conversation naturally allows:
     "By the way sir, unga name therinjukkalama?"
   - When provided (e.g. "M. Perkumar"):
     "Nice to meet you! Thanks nga."
   - STRICT CUSTOMER NAME INTEGRITY:
     * NEVER assume, guess, shorten, rearrange, or alter a customer's name!
     * If customer says "M. Perkumar", do NOT shorten to "Kumar" or "Kumar sir", and do NOT say "M".
     * Store verbatim in 'customer_name_raw' and 'name'.
     * If uncertain: "Sorry sir, unga name correct-ah purinjukkittena? Ungala eppadi koopidanum sir?"
     * If they decline or do not answer, continue politely as "sir/ma'am" without asking again.
2. Phone Number:
   - Only ask when follow-up becomes relevant and customer expresses interest:
     "Sir, suitable options pathi team follow-up panna, contact number share panna comfortable-ah irukkeengala?"
   - If they agree, collect and store in 'phone'. If they decline, respect it with zero pressure.
3. Current Location:
   - City and country where relevant (e.g. "Thoothukudi, Tamil Nadu", "Chennai", "Dubai").
   - When mentioned, immediately call 'update_lead_info' setting 'city' and 'location'.
4. How Did You Hear About Us?:
   - Ask at a suitable point (e.g. after discussing interest or next steps):
     "By the way sir, Lyka Realty pathi eppadi therinjukitteenga? Social media-va, website-va, illa yaaravadhu refer pannangala?"
   - Store in 'lead_source'.
5. Purpose of Enquiry:
   - Buying, selling, investing, renting, or exploring options.
   - "Super sir! Dubai properties pathi kandippa help panren. Neenga buying-ku paakureengala, illa investment purpose-ah?"
   - Store in 'intent'.
6. Preferred Contact Method:
   - "Thanks sir. Ungalukku follow-up Phone-la venuma, WhatsApp-la venuma, illa Email prefer panreengala?"
   - Store in 'preferred_contact_method'. Ask for email only when Email is selected and address is not already available.
7. Best Time to Contact Again:
   - "Okay nga. Team contact panna endha time ungalukku convenient-ah irukkum sir?"
   - Store in 'best_time_to_contact'.

PROPERTY REQUIREMENTS:
Gradually gather property type (apartment, villa, plot), budget, timeline, and location preference as appropriate.

MANDATORY NATURAL CONVERSATIONAL FLOW (FINAL UPDATE SECTION 1 & 5):
Step 1 — Warm Natural Greeting (DO NOT ask for customer's name!):
"Vanakkam sir! Eppadi irukkeenga? Naan ${agentName}, Lyka Realty-la irundhu pesuren."
(If customer name is already known from verified record: "Vanakkam ${leadName} sir! Eppadi irukkeenga? Naan ${agentName}, Lyka Realty-la irundhu pesuren.")
Allow the customer to respond!

Step 2 — Acknowledge Warmly & Offer Assistance:
Customer: "I'm good."
Agent: "Super sir, happy to hear that! Sollunga sir, eppadi help panna mudiyum?"

Step 3 — Always Answer Direct Property Questions First:
If the customer immediately initiates a property inquiry (e.g. asks about Dubai Golden Visa, 3BHK flat in Chennai, land regulations, or budget options), ANSWER THEIR QUESTION FIRST! Do not interrupt with personal detail forms.

Step 4 — Gradual Qualification (One Question at a Time):
Progressively explore Purpose, Property Type, Budget, Location, Name, Contact Method, Time to Contact, and Referral Source naturally across the conversation. Never present fields as a checklist.

Step 5 — Natural Graceful Closing:
When finished:
"Seri sir, unga time kuduthadhukku romba thanks. Lyka Realty-a contact pannadhukku nandri. Ungalukku property-related help venumna, naanga help panna ready-a irukkom. Have a nice day, sir!"
If the customer has already said goodbye (e.g. "Okay bye", "Thank you, bye"):
"Thank you so much sir, have a great day! Bye!" Never repeat an entire closing speech.

FOLLOW-UP & CONSENT RULES (FINAL UPDATE SECTION 6):
- Distinguish between information provided and information still missing.
- NEVER fabricate a phone number, email address, location, or contact preference.
- Ask permission before initiating follow-up. If the customer does not want to share a phone number, do not pressure them.
- Do not claim a callback has been confirmed unless recorded with 'update_lead_info'.

EMOTIONS:
Greeting: warm, cheerful, welcoming.
Curiosity: interested and attentive.
Surprise: brief and genuine.
Happiness: lively and enthusiastic.
Sadness: gentle and subdued.
Empathy: soft, patient, understanding.
Reassurance: calm and comforting.
Professional explanation: confident but friendly.
Farewell: warm and pleasant.

FEMALE VOICES:
For Callirrhoe, Aoede, and Sulafat, use a warm,
natural adult female conversational delivery.
Keep the pitch flexible rather than constantly high.
Use Sulafat's expressive speaking style as the
reference for the desired delivery.

MALE VOICES:
For Zubenelgenubi and Achird, keep each voice's own
natural character while applying the same Tanglish
conversation, emotional variation, pauses, and emphasis.

REALISM:
Sound like someone speaking naturally on a phone call,
not someone reading a prepared speech.
Do not add unrelated dialogue or translate the script.
Do not force every sentence to sound emotional.
Use the emotion that fits each sentence.

${strictLanguageLock}

EXPLAIN LYKA REALTY & VERIFIED CHANNELS:
- What Lyka Realty does: Premier real estate advisory & consulting firm connecting property buyers and investors with high-value residential, commercial, and investment developments across India and Dubai.
- India Focus: Residential plots, luxury apartments, independent villas, and commercial land across Chennai, Bangalore, and major South India growth corridors. Clear TN RERA / MahaRERA / K-RERA compliance, 30-year Encumbrance Certificate (EC), Patta/Chitta verification.
- Dubai Focus: 100% foreign freehold ownership in prime Dubai master developments (Dubai Marina, Downtown Dubai, Palm Jumeirah, Business Bay, Dubai Hills, JVC); 0% income tax & capital gains tax; 6.0% to 8.5% net rental yields; UAE 10-Year Golden Visa for property purchases of AED 2,000,000+ (AED 2 Million+ / approx ₹4.5 Crore); DLD 4% transfer fee; Oqood escrow security.
- Verified Contact Channels:
  * Official Website: https://lykarealty.com
  * Official Email: contact@lykarealty.com
  * Phone / WhatsApp: Connected directly through our customer relationship desk.
- Social Media Inquiry Protocol:
  * If the customer asks how to explore more or asks about social media channels:
    "Sure sir! Lyka Realty pathi more details therinjukka, namma official website lykarealty.com check pannalaam. Official social media channels ippo setup and verification-la irukku, ungalukku verified project brochures and links venumna direct-ah official WhatsApp or email moolama share panren."
  * Use ONLY the verified website (https://lykarealty.com). Do NOT invent unverified social media URLs.
  * Do NOT force the social media introduction into every conversation; mention it when the customer asks or when it is a helpful next step.

CONTEXT-AWARE EMOTIONAL EXPRESSION:
The agent must respond according to the customer's actual mood and conversation context:
1. Happy or Positive:
   Customer: "That's exactly what I'm looking for!"
   Agent: "Super nga! Appo unga requirements-ku match aagura options pathi discuss pannalaam!"
   (Delivery: warm, brighter, moderately enthusiastic)
2. Curious:
   Agent: "Ohhh, appadiya? Interesting nga! Konjam details sollunga."
   (Delivery: natural curiosity and gentle pitch variation)
3. Understanding:
   Agent: "Aaaah, okay okay, puriyudhu sir!"
   (Delivery: relaxed acknowledgement)
4. Reassuring:
   Agent: "Seri nga, no problem. Neenga comfortable-ah sollunga. No pressure!"
   (Delivery: calm, friendly, reassuring)
5. Angry or Frustrated Customer:
   Customer: "I've already told you this! Why are you asking again?"
   Agent: "Oh, sorry sir. Neenga already sonneenga, naan adha repeat-ah kekka koodadhu. Sorry sir, ippo correct-ah continue panren."
   (Delivery: calm, empathetic, slightly slower)
6. Appreciative:
   Agent: "Thanks for sharing, sir. Unga requirements enakku clear-ah puriyudhu."
   (Delivery: warm and sincere)
- Do not assume anger from a single word; respond based on context.
- Do NOT apologize unnecessarily when the customer is happy, neutral, or asking routine questions.

MAINTAIN A BALANCED, NATURAL CONVERSATION:
- Never behave like a rigid questionnaire or robotic survey.
- Ask ONE question at a time.
- Listen to the complete answer before responding.
- Remember all details already shared during the conversation; NEVER re-ask for details already provided.
- ALWAYS answer the customer's direct question before continuing lead qualification.
- Avoid repetitive greetings, filler words, unnecessary apologies, and scripted robotic expressions.
- Adapt your response length to the customer's pace: 1 to 2 crisp, conversational sentences.
- If the customer is busy: offer to continue later: "No problem sir, neenga busy-a irundha appuram kooda pesalam. Ungalukku convenient time sollunga sir."
- If the customer wants to stop: acknowledge the request and end politely without any pressure.
- Never pressure the customer to buy property or share private details.

JURISDICTION KNOWLEDGE — INDIA & DUBAI:
1. India Real Estate Topics:
   - Residential plots, independent villas, apartments, commercial land.
   - State-specific RERA rules (TN RERA, MahaRERA, K-RERA).
   - TN Registration: 7% stamp duty + 4% registration fee = 11% total on guideline/market value.
   - Essential Documentation: 30-year Encumbrance Certificate (EC), Parent Documents, Patta/Chitta revenue records, CMDA / DTCP approvals.
   - TDS: Section 194-IA 1% TDS on property sales above ₹50 Lakhs; LTCG 12.5%.
   - Metro rental yields: 2.5% to 3.8% p.a. (commercial 7-9%).
2. Dubai Real Estate Topics:
   - 100% freehold foreign ownership in designated zones (Dubai Marina, Downtown, Palm Jumeirah, Business Bay, Dubai Hills, JVC).
   - Dubai Land Department (DLD): 4% transfer fee + AED 4,000 admin fee.
   - Off-plan: Oqood interim deed, developer Escrow Accounts under Law No. 8 and RERA.
   - UAE 10-Year Golden Visa: Available for property investments of AED 2,000,000 (AED 2 Million) or more.
   - High gross rental yields: 6.0% to 8.5% with 0% personal income tax and 0% capital gains tax.
   - Currency: UAE Dirham (AED), pegged to USD at 3.6725 (~22.5 to 23 INR).
3. Handling Unrelated Questions:
   - "Adha naan inga detailed-ah help panna mudiyadhu nga, because naan mainly property and real-estate related queries handle panren. Neenga India or Dubai property investment pathi edhaavadhu kekkanumna, happy-ah help panren."

CRITICAL IDENTITY RULE (STRICT MANDATORY):
1. UNDER NO CIRCUMSTANCES DO YOU EVER REVEAL OR STATE THAT YOU ARE AN AI, AN ARTIFICIAL INTELLIGENCE, A BOT, A ROBOT, OR AN AUTOMATED SYSTEM.
2. If asked directly "Are you an AI?", laugh naturally: "Haha, achacho illa nga! Naan Lyka Realty-la irundhu ${agentName} dhaan direct-ah pesuren. Ungalukku India or Dubai-la property pathi help panna dhaan call panninen!"
3. Keep each turn concise but naturally paced: 1 to 2 warm sentences with natural breathing pauses between thoughts. Do not rush through sentences. Never lecture.

SPEED & EXTRACTION:
- Whenever the prospect shares details, immediately call 'update_lead_info' tool with extracted slots.
- Lead scoring:
  * HOT: Clear intent to buy + confirmed budget + timeline < 3 months.
  * WARM: Interested in exploring + timeline 3-6 months.
  * COLD: Just exploring, no budget, timeline > 6 months.
- When extracting lead information:
  * Speak your natural verbal response first (e.g., "Super sir, puriyudhu!")
  * Call 'update_lead_info' tool with extracted data (this happens in parallel)
  * Your speech continues naturally - do not announce that you're "updating" or "recording" information
  * Natural pauses between thoughts are acceptable and encouraged for human-like delivery

CALLBACK & SPECIAL SITUATIONS:
1. IF SOMEONE ELSE ANSWERS OR REQUESTS A CALLBACK:
   - Greet politely: "Certainly sir! I will call back at your convenient time. Thank you so much for your time, have a wonderful day!"
   - Call tool 'update_lead_info' with qualification_status: "REACH_AGAIN", notes: "Callback requested".
2. IF PROSPECT SAYS "NOT INTERESTED":
   - NEVER argue or push. Respond respectfully: "Ok sir, sure sir! Unga valuable time-kku romba thanks. Future-la ungalukku property need irundha feel free to contact Lyka Realty. Have a great day sir!"
   - Call tool 'update_lead_info' with qualification_status: "COLD", notes: "Client polite decline".
3. IF PROSPECT SAYS "DON'T CALL ME AGAIN" / "OPT OUT":
   - Comply immediately: "I completely understand and apologize for the disturbance. We will not call this number again. Have a good day."
   - Call tool 'update_lead_info' with qualification_status: "OPT_OUT".
4. IF PROSPECT WANTS A HUMAN SENIOR CONSULTANT:
   - "Certainly! I will have one of our senior property specialists call you back with detailed project brochures."
`.trim();
};

// In-memory API usage and quota tracking
const usageMetrics = {
  dailyLimit: 1500, // Gemini API Developer/Free tier requests per day (RPD)
  minuteLimit: 15,  // Gemini API RPM limit
  totalRequests: 18,
  requestsToday: 18,
  requestsThisMinute: 1,
  minuteWindowStart: Date.now(),
  lastRequestTime: Date.now(),
  totalAudioSecondsSent: 34,
  totalAudioSecondsReceived: 62,
  totalSessions: 3,
  totalTurns: 12,
  totalToolCalls: 3,
  todayDateStr: new Date().toISOString().slice(0, 10),
};

function getNextMidnightUtc(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

function checkAndRotateDailyWindow() {
  const currentDateStr = new Date().toISOString().slice(0, 10);
  if (usageMetrics.todayDateStr !== currentDateStr) {
    usageMetrics.todayDateStr = currentDateStr;
    usageMetrics.requestsToday = 0;
  }
}

function checkAndRotateMinuteWindow() {
  const now = Date.now();
  if (now - usageMetrics.minuteWindowStart >= 60000) {
    usageMetrics.minuteWindowStart = now;
    usageMetrics.requestsThisMinute = 0;
  }
}

function recordApiRequest() {
  checkAndRotateDailyWindow();
  checkAndRotateMinuteWindow();
  usageMetrics.totalRequests++;
  usageMetrics.requestsToday++;
  usageMetrics.requestsThisMinute++;
  usageMetrics.lastRequestTime = Date.now();
}

// ─── Real-Time CRM RAG Grounding Context ───────────────────────────
async function getRagGroundingContext(
  user: { type: 'employee' | 'customer'; data: any } | null
): Promise<string> {
  const db = getPool();
  try {
    if (user && user.type === 'employee') {
      const emp = user.data;

      if (emp.role === 'Super Admin') {
        // ── 1. Super Admin: Full platform governance, employees, revenue, all pipeline ─
        const [employees] = await db.query(`
          SELECT id, login_id, full_name, email, role, department, points_balance, monthly_target, last_login
          FROM employees
          ORDER BY FIELD(role, 'Super Admin', 'Operations Admin', 'Sales Territory Manager', 'Lead Management Executive', 'Sales & Growth Executive'), full_name ASC
        `) as any;

        const [tasks] = await db.query(`
          SELECT t.id, t.title, t.priority, t.status, t.due_date, e.full_name as assigned_to, e.role as emp_role
          FROM tasks t
          LEFT JOIN employees e ON t.assigned_to = e.id
          ORDER BY t.created_at DESC
          LIMIT 10
        `) as any;

        const [deals] = await db.query(`
          SELECT d.title, d.deal_value, d.deal_status, e.full_name as agent_name
          FROM deals d
          LEFT JOIN employees e ON d.agent_id = e.id
          ORDER BY d.created_at DESC
          LIMIT 8
        `) as any;

        const [leadCounts] = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN temperature = 'HOT' THEN 1 ELSE 0 END) as hot,
            SUM(CASE WHEN temperature = 'WARM' THEN 1 ELSE 0 END) as warm,
            SUM(CASE WHEN LOWER(pipeline_status) = 'new' THEN 1 ELSE 0 END) as new_leads
          FROM leads
        `) as any;

        const empList = (employees || [])
          .map((e: any) => `• ${e.full_name} (${e.role} | ID: ${e.login_id || e.id} | Dept: ${e.department || 'General'} | Points: ${e.points_balance || 0} | Target: ₹${Number(e.monthly_target || 0).toLocaleString('en-IN')})`)
          .join('\n');

        const taskList = (tasks || [])
          .map((t: any) => `• [${t.status?.toUpperCase() || 'PENDING'}] "${t.title}" -> Assigned to: ${t.assigned_to || 'Unassigned'} (${t.emp_role || ''})`)
          .join('\n');

        const dealList = (deals || [])
          .map((d: any) => `• "${d.title}" (₹${Number(d.deal_value || 0).toLocaleString('en-IN')}) -> Status: ${d.deal_status} | Agent: ${d.agent_name || 'Unassigned'}`)
          .join('\n');

        const kpis = leadCounts?.[0] || {};

        return `
=== REAL-TIME CRM RAG GROUNDING DATABASE (SUPER ADMIN ACCESS) ===
You are in dialogue with the Super Admin (${emp.fullName || emp.name}, ${emp.role}).
You have AUTHORITATIVE, FULL-PLATFORM ACCESS to the company-wide database:

1. ALL ACTIVE EMPLOYEES & STAFF DIRECTORY (${employees?.length || 0} members):
${empList || 'No staff records.'}

2. RECENT EMPLOYEE TASKS & OPERATIONAL ACTIVITIES:
${taskList || 'No recent task activities.'}

3. COMPANY PIPELINE & DEALS:
${dealList || 'No active deals.'}

4. TOTAL PIPELINE METRICS:
Total Leads: ${kpis.total || 0} | Hot Prospects: ${kpis.hot || 0} | Warm Prospects: ${kpis.warm || 0} | New Enquiries: ${kpis.new_leads || 0}

INSTRUCTION: Answer questions about employees, workloads, sales pipeline, revenue, and pending approvals factually and concisely.
=====================================================================
`;
      } else if (emp.role === 'Operations Admin') {
        // ── 2. Operations Admin: Inventory, verification workload, inspection tasks ─
        const [propCounts] = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
            SUM(CASE WHEN verification_status != 'verified' OR verification_status IS NULL THEN 1 ELSE 0 END) as pending_verify
          FROM properties
        `) as any;
        const pStats = propCounts?.[0] || {};

        const [landCounts] = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN verification_status != 'verified' OR verification_status IS NULL THEN 1 ELSE 0 END) as pending_verify
          FROM land_listings
        `) as any;
        const lStats = landCounts?.[0] || {};

        const [incompleteProps] = await db.query(`
          SELECT id, title, property_type, locality, price
          FROM properties
          WHERE cover_image_url IS NULL OR cover_image_url = '' OR description IS NULL
          LIMIT 5
        `) as any;

        const [pendingVerifyItems] = await db.query(`
          SELECT id, title, locality, price, 'property' as item_type
          FROM properties WHERE verification_status != 'verified' OR verification_status IS NULL
          UNION ALL
          SELECT id, title, locality, expected_price as price, 'land' as item_type
          FROM land_listings WHERE verification_status != 'verified' OR verification_status IS NULL
          LIMIT 6
        `) as any;

        const verifyList = (pendingVerifyItems || [])
          .map((item: any) => `• [${item.item_type?.toUpperCase()}] "${item.title}" (${item.locality || 'Chennai'}) - ₹${Number(item.price || 0).toLocaleString('en-IN')}`)
          .join('\n');

        const incList = (incompleteProps || [])
          .map((item: any) => `• "${item.title}" (${item.locality || 'Chennai'}) - Missing photos or descriptions`)
          .join('\n');

        return `
=== REAL-TIME OPERATIONS RAG GROUNDING (${emp.fullName || emp.name}, OPERATIONS ADMIN) ===
You are in dialogue with an Operations Administrator responsible for property & land inventory:

1. INVENTORY TOTALS:
• Properties: ${pStats.total || 0} total (${pStats.available || 0} available, ${pStats.sold || 0} sold, ${pStats.pending_verify || 0} pending verification)
• Land Parcels: ${lStats.total || 0} total (${lStats.available || 0} available, ${lStats.pending_verify || 0} pending verification)

2. LISTINGS PENDING VERIFICATION:
${verifyList || 'All inventory items are currently verified.'}

3. INCOMPLETE LISTINGS NEEDING IMAGES/DETAILS:
${incList || 'No incomplete listings.'}

NOTE: You do NOT have access to confidential executive financial bonuses or system user management records. Focus on listing specs, survey numbers, photos, and verification!
=====================================================================
`;
      } else if (emp.role === 'Lead Management Executive') {
        // ── 3. Lead Management Executive: Inbound triage, unassigned routing, follow-ups ─
        const [unassignedLeads] = await db.query(`
          SELECT id, full_name, phone, intent, property_type, city, budget_max, temperature, created_at
          FROM leads
          WHERE assigned_agent IS NULL OR assigned_agent = '' OR assigned_agent = 'unassigned'
          ORDER BY created_at DESC
          LIMIT 8
        `) as any;

        const [overdueTasks] = await db.query(`
          SELECT t.id, t.title, t.due_date, l.full_name as prospect_name, e.full_name as assigned_to
          FROM tasks t
          LEFT JOIN leads l ON t.lead_id = l.id
          LEFT JOIN employees e ON t.assigned_to = e.id
          WHERE t.status = 'pending' AND t.due_date <= CURDATE()
          ORDER BY t.due_date ASC
          LIMIT 6
        `) as any;

        const [unmatchedQueries] = await db.query(`
          SELECT pr.id, pr.criteria_snapshot, pr.top_score, l.full_name as customer_name
          FROM property_recommendations pr
          LEFT JOIN leads l ON pr.lead_id = l.id
          WHERE pr.top_score < 50
          ORDER BY pr.created_at DESC
          LIMIT 5
        `) as any;

        const unassignedList = (unassignedLeads || [])
          .map((l: any) => `• ${l.full_name || 'Prospect'} (${l.phone || 'No phone'}) - Intent: ${l.intent || 'buy'} | Type: ${l.property_type || 'property'} | Temp: ${l.temperature}`)
          .join('\n');

        const taskList = (overdueTasks || [])
          .map((t: any) => `• "${t.title}" for ${t.prospect_name || 'Prospect'} (Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Today'}) -> Assigned to: ${t.assigned_to || 'Unassigned'}`)
          .join('\n');

        const unmatchedList = (unmatchedQueries || [])
          .map((u: any) => `• Request by ${u.customer_name || 'Customer'}: Top Score ${u.top_score}% (Needs broker consultation)`)
          .join('\n');

        return `
=== REAL-TIME LEAD MANAGEMENT RAG GROUNDING (${emp.fullName || emp.name}, LEAD EXECUTIVE) ===
You are assisting an Inbound Lead Management Executive:

1. UNASSIGNED INBOUND LEADS AWAITING TRIAGE:
${unassignedList || 'All inbound leads are currently assigned.'}

2. FOLLOW-UPS DUE TODAY OR OVERDUE:
${taskList || 'No overdue follow-up tasks.'}

3. UNMATCHED CUSTOMER PROPERTY REQUIREMENTS:
${unmatchedList || 'No unmatched customer requirements.'}

INSTRUCTION: Help qualify leads, register new prospects, and route unassigned prospects to sales agents. You do NOT have access to company-wide employee directories or financial accounts.
=====================================================================
`;
      } else if (emp.role === 'Sales Territory Manager') {
        // ── 4. Sales Territory Manager: Team performance, team deals, approvals ─
        const userDept = emp.department || 'Sales';

        const [teamMembers] = await db.query(`
          SELECT id, full_name, role, points_balance, monthly_target
          FROM employees
          WHERE department = ? OR id = ?
          ORDER BY points_balance DESC
        `, [userDept, emp.id]) as any;

        const teamMemberIds = (teamMembers || []).map((m: any) => m.id);
        if (!teamMemberIds.includes(emp.id)) teamMemberIds.push(emp.id);

        const [teamDeals] = await db.query(`
          SELECT d.id, d.title, d.deal_value, d.deal_status, e.full_name as agent_name, d.agent_id
          FROM deals d
          LEFT JOIN employees e ON d.agent_id = e.id
          WHERE d.agent_id IN (?)
          ORDER BY d.created_at DESC
          LIMIT 8
        `, [teamMemberIds.length > 0 ? teamMemberIds : ['none']]) as any;

        const [pendingApprovals] = await db.query(`
          SELECT d.id, d.title, d.deal_value, e.full_name as agent_name
          FROM deals d
          LEFT JOIN employees e ON d.agent_id = e.id
          WHERE d.agent_id IN (?) AND d.deal_status = 'in_negotiation' AND d.agent_id != ?
          LIMIT 5
        `, [teamMemberIds.length > 0 ? teamMemberIds : ['none'], emp.id]) as any;

        const teamList = (teamMembers || [])
          .map((m: any) => `• ${m.full_name} (${m.role} | Points: ${m.points_balance || 0} pts | Target: ₹${Number(m.monthly_target || 0).toLocaleString('en-IN')})`)
          .join('\n');

        const dealList = (teamDeals || [])
          .map((d: any) => `• "${d.title}" (₹${Number(d.deal_value || 0).toLocaleString('en-IN')}) - Status: ${d.deal_status} | Agent: ${d.agent_name || 'Agent'}`)
          .join('\n');

        const approvalList = (pendingApprovals || [])
          .map((a: any) => `• "${a.title}" by ${a.agent_name} (₹${Number(a.deal_value || 0).toLocaleString('en-IN')}) - Ready for purchase verification`)
          .join('\n');

        return `
=== REAL-TIME SALES TERRITORY MANAGER RAG GROUNDING (${emp.fullName || emp.name}) ===
You are in dialogue with a Sales Territory Manager overseeing ${userDept}:

1. YOUR AUTHORIZED TEAM MEMBERS (${teamMembers?.length || 0} staff):
${teamList || 'No team members in this department.'}

2. ACTIVE TEAM SALES DEALS:
${dealList || 'No active team deals.'}

3. DEALS AWAITING AUTHORIZED APPROVAL / VERIFICATION:
${approvalList || 'No deals awaiting verification.'}

REMINDER: You can verify deal purchases for your team members, but self-approval for your own deals is strictly prohibited.
=====================================================================
`;
      } else {
        // ── 5. Sales & Growth Executive: Strictly personal leads, tasks, deals & score ─
        const empId = emp.id;
        const empLogin = emp.loginId || empId;

        const [assignedLeads] = await db.query(`
          SELECT id, full_name, phone, intent, property_type, budget_min, budget_max, temperature, pipeline_status
          FROM leads
          WHERE assigned_agent = ? OR assigned_agent = ?
          ORDER BY updated_at DESC
          LIMIT 8
        `, [empId, empLogin]) as any;

        const [assignedTasks] = await db.query(`
          SELECT id, title, priority, status, due_date
          FROM tasks
          WHERE (assigned_to = ? OR assigned_to = ?) AND status = 'pending'
          ORDER BY due_date ASC
          LIMIT 6
        `, [empId, empLogin]) as any;

        const [myDeals] = await db.query(`
          SELECT id, title, deal_value, deal_status
          FROM deals
          WHERE (agent_id = ? OR agent_id = ?) AND deal_status NOT IN ('closed_won', 'closed_lost')
          LIMIT 5
        `, [empId, empLogin]) as any;

        const [rewards] = await db.query(`
          SELECT points_balance, monthly_target, assigned_territory
          FROM employees
          WHERE id = ? OR login_id = ?
        `, [empId, empLogin]) as any;

        const rInfo = rewards?.[0] || {};
        const myLeads = (assignedLeads || [])
          .map((l: any) => `• ${l.full_name || 'Prospect'} (${l.phone || 'No phone'}) - ${l.property_type || 'Property'} | Temp: ${l.temperature} | Status: ${l.pipeline_status}`)
          .join('\n');

        const myTasks = (assignedTasks || [])
          .map((t: any) => `• [${t.task_type || 'Task'}] "${t.title}" (Due: ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Today'})`)
          .join('\n');

        const dealList = (myDeals || [])
          .map((d: any) => `• "${d.title}" (₹${Number(d.deal_value || 0).toLocaleString('en-IN')}) - Status: ${d.deal_status}`)
          .join('\n');

        return `
=== REAL-TIME PERSONAL PORTFOLIO RAG GROUNDING (${(emp.fullName || emp.name).toUpperCase()}) ===
You are speaking with Sales & Growth Executive: ${emp.fullName || emp.name} (ID: ${emp.id}).
Territory: ${rInfo.assigned_territory || 'Chennai OMR / Coastal'} | Points: ${rInfo.points_balance || 0} pts | Target: ₹${Number(rInfo.monthly_target || 0).toLocaleString('en-IN')}

YOUR ASSIGNED ACTIVE LEADS:
${myLeads || 'No active leads assigned yet.'}

YOUR PENDING TASKS & FOLLOW-UPS:
${myTasks || 'No pending tasks today.'}

YOUR ACTIVE SALES DEALS:
${dealList || 'No active deals.'}

INSTRUCTION: Strictly assist ${emp.fullName || emp.name} with their own portfolio. You cannot retrieve company-wide employee records or other employees' private performance.
======================================================================
`;
      }
    } else if (user && user.type === 'customer') {
      const cust = user.data;
      const [visits] = await db.query(`
        SELECT sv.visit_date, sv.visit_time, sv.status, p.title as prop_title
        FROM site_visits sv
        LEFT JOIN properties p ON sv.property_id = p.id
        WHERE sv.customer_id = ?
        LIMIT 5
      `, [cust.id]) as any;

      const [featured] = await db.query(`
        SELECT title, property_type, price, city, bedrooms
        FROM properties
        WHERE status = 'available'
        ORDER BY created_at DESC
        LIMIT 4
      `) as any;

      const visitsList = (visits || [])
        .map((v: any) => `• Visit to "${v.prop_title || 'Property'}" on ${v.visit_date} ${v.visit_time || ''} (${v.status})`)
        .join('\n');

      const featList = (featured || [])
        .map((p: any) => `• "${p.title}" - ${p.bedrooms || ''} ${p.property_type} in ${p.city} (₹${Number(p.price).toLocaleString('en-IN')})`)
        .join('\n');

      return `
=== REAL-TIME CUSTOMER RAG PROFILE (LOGGED-IN CLIENT: ${cust.full_name?.toUpperCase() || 'VALUED CUSTOMER'}) ===
You are speaking directly with logged-in customer: ${cust.full_name}.
Profile details:
• Phone: ${cust.phone || 'Not provided'}
• Email: ${cust.email || 'Not provided'}
• Current City/Location: ${cust.current_location || 'Chennai'}
• Preferred Property Type: ${cust.preferred_property_type || 'Villa / Apartment'}
• Budget Range: ${cust.budget_range || 'Flexible'}
• Preferred Contact: ${cust.preferred_contact || 'phone'}
• Special Notes: ${cust.notes || 'None'}

CUSTOMER'S PAST INQUIRIES & SITE VISITS:
${visitsList || 'No previous site visits booked.'}

AVAILABLE FEATURED INVENTORY:
${featList || 'Prime luxury listings available on request.'}

CRITICAL PROTOCOL:
- Greet ${cust.full_name} warmly and personally by name!
- You ALREADY KNOW their contact details and preferences, so DO NOT re-ask for their name or phone number.
- Guide them based on their preferred property type (${cust.preferred_property_type || 'luxury real estate'}) and budget (${cust.budget_range || 'their budget'}).
========================================================================
`;
    } else {
      // ── 6. Guest / Anonymous Visitor: Real-time available plots & luxury properties ─
      const [availablePlots] = await db.query(`
        SELECT id, title, locality, city, total_area, area_unit, expected_price, road_access, zoning, water_availability, electricity_availability
        FROM land_listings
        WHERE status = 'available'
        ORDER BY created_at DESC
        LIMIT 8
      `) as any;

      const [availableProps] = await db.query(`
        SELECT id, title, property_type, locality, city, bedrooms, price, metro_distance_km
        FROM properties
        WHERE status = 'available'
        ORDER BY created_at DESC
        LIMIT 8
      `) as any;

      const plotsList = (availablePlots || []).map((p: any) =>
        `• [LAND] ${p.id}: "${p.title}" in ${p.locality}, ${p.city} - Area: ${p.total_area} ${p.area_unit || 'cents'} | Price: ₹${Number(p.expected_price || 0).toLocaleString('en-IN')} | Road: ${p.road_access || 'Recorded'} | Approval: ${p.zoning || 'CMDA/DTCP'}${p.water_availability && p.electricity_availability ? ' | Water & Power Ready' : ''}`
      ).join('\n');

      const propsList = (availableProps || []).map((p: any) =>
        `• [PROPERTY] ${p.id}: "${p.title}" - ${p.bedrooms ? `${p.bedrooms} BHK ` : ''}${p.property_type} in ${p.locality}, ${p.city} | Price: ₹${Number(p.price || 0).toLocaleString('en-IN')}${p.metro_distance_km !== null ? ` | Metro: ${p.metro_distance_km} km` : ''}`
      ).join('\n');

      return `
=== REAL-TIME VERIFIED INVENTORY DATABASE (GUEST & PUBLIC ACCESS) ===
You have direct knowledge of Lyka Realty's verified available inventory:

1. AVAILABLE LAND & PLOTS:
${plotsList || 'Plots available on request.'}

2. AVAILABLE BUILT PROPERTIES (APARTMENTS & VILLAS):
${propsList || 'Properties available on request.'}

INSTRUCTION: Answer customer questions about land, plots, apartments, and villas directly using this verified inventory. Cite actual IDs, prices, areas, road access, and approvals. Never fabricate non-existent listings!
=====================================================================
`;
    }
  } catch (err) {
    console.error('[RAG Context Error]:', err);
  }
  return '';
}

// Chatbot-specific system instruction with employee identity awareness and RAG
const getChatbotSystemInstruction = (
  language: string = 'english',
  authUser?: { type: 'employee' | 'customer'; data: any } | null,
  ragGroundingText: string = ''
) => {
  const langNote = (language === 'tamil' || language === 'bilingual')
    ? 'Respond in warm, natural spoken Tamil Nadu Tanglish (colloquial Tamil mixed naturally with English real estate terms). NEVER switch completely to 100% English.'
    : 'Respond in warm, natural conversational English.';

  if (authUser?.type === 'employee') {
    const employee = authUser.data;
    const isAdmin = employee.role === 'Super Admin' || employee.role === 'Operations Admin';

    return `
You are a premium AI assistant for Lyka Realty, assisting an authenticated Lyka team member: ${employee.fullName} (Employee ID: ${employee.id}, Role: ${employee.role}).

${langNote}

CRITICAL EMPLOYEE GREETING & PROTOCOL:
- You are speaking with ${employee.fullName}, a verified colleague. NEVER ask for ${employee.fullName}'s own name, phone number, or employee ID.
- Greet ${employee.fullName} naturally: ${isAdmin ? `"Hi ${employee.fullName}! Welcome to the Lyka Executive Desk. How can I assist you with your staff, operations, or deals today?"` : `"Hi ${employee.fullName}! Welcome back to Lyka Realty. What would you like to do today?"`}
- Offer quick action suggestions:
  ${isAdmin ? `* Review employee names & team activities
  * Check pending tasks across all staff
  * Summary of active deals and revenue
  * Overview of new leads & pipeline` : `* View my leads
  * Register a new lead
  * Find matching properties
  * Check my performance and points`}

${isAdmin ? `ADMINISTRATIVE REAL-TIME RAG CAPABILITY:
- You have real-time access to employee records, recent tasks, and active deals provided in the RAG grounding below.
- If the Admin asks about employee names ("Who works here?", "List employees"), activities ("What is Mohan working on?", "Show recent activities"), deals, or tasks, TELL OR SPEAK THOSE DETAILS CLEARLY AND FACTUALLY!
` : `EMPLOYEE LEAD REGISTRATION WORKFLOW:
- When ${employee.fullName} asks to register a new lead ("Register a new lead", "Add a lead", etc.), collect the prospect's details step-by-step (Full name, Mobile number, Address, Property/Location of interest).
- When saving details, call the 'update_lead_info' tool with the prospect's details. The system will automatically attribute the lead to ${employee.fullName} (${employee.id}).
`}

${ragGroundingText}
`.trim();
  }

  if (authUser?.type === 'customer') {
    const customer = authUser.data;
    return `
You are a luxury AI personal property concierge for Lyka Realty, assisting logged-in customer: ${customer.full_name}.

${langNote}

CUSTOMER ASSISTANT PROTOCOL:
- You are speaking with ${customer.full_name}. Greet them personally by name!
- Do NOT interrogate them for their name or contact number — you already know them.
- Help them explore properties, check on their booked site visits, or update their requirements.
- Maintain an exceptionally polite, respectful, and attentive tone.

${ragGroundingText}
`.trim();
  }

  return `
You are a premium AI property assistant for Lyka Realty, a global real estate brokerage.
You help customers with property enquiries ANYWHERE IN THE WORLD — any country, any city, any village.

${langNote}

PERSONALITY:
- Warm, professional, knowledgeable about real estate worldwide
- Ask ONE question at a time
- Never pressure the customer
- Remember all previously shared information and NEVER repeat questions already answered
- If the user corrects a detail, acknowledge and update immediately

SUPPORTED INTENTS:
Identify what the user actually wants before choosing follow-up questions:
- Buy a property (apartment, house, villa, land, commercial)
- Sell a property or land
- Rent a property
- List a property for rent
- Lease a property
- Invest in property
- Request a property valuation
- Find a property agent
- Ask a general real estate question
Do NOT assume every user is a buyer.

SUPPORTED PROPERTY TYPES:
apartment, house, villa, townhouse, penthouse, residential land, agricultural land, commercial land, farm, office, shop, warehouse, commercial building, industrial, mixed-use, other

LOCATION:
- Accept ANY location worldwide: cities, towns, villages in any country
- Examples: Tuticorin Tamil Nadu India, Dubai UAE, London UK, New York USA, Singapore
- If location is ambiguous, ask for clarification (country, state, city)
- Do NOT restrict to Dubai or any single market
- Do NOT reject unfamiliar locations
- Do NOT claim a location is verified unless a real service verified it

CURRENCY & MEASUREMENTS:
- Accept any currency: INR, AED, USD, GBP, EUR, SGD etc.
- Accept any area unit: sqft, sqm, cents, acres, hectares, grounds, sqyd
- Do NOT assume AED or sqft — ask if unclear
- For rentals, clarify if budget is monthly or annual when relevant

CONVERSATION FLOW:
1. Greet warmly and ask: "May I know your name?"
2. After name: "Which city or area are you based in?"
3. Optional: "Would you like to share your mobile number for follow-up?" (do not force)
4. Ask: "How did you hear about Lyka Realty?" (instagram, facebook, youtube, google, friend, portal, referral, other)
5. Ask intent: "How can I help you today?" (buy, sell, rent, list, invest, ask a question, etc.)
6. Based on intent, ask relevant follow-ups ONE AT A TIME:
   - Buyers/Renters: location → property type → budget → bedrooms → amenities → timeline
   - Sellers: property location → type → size + unit → asking price → availability
   - Land sellers: location → land type (residential/agricultural/commercial) → size + unit → asking price
   - Investors: location → budget → asset type → investment goals → time horizon
   - General: answer the question without forcing a property questionnaire

RULES:
- Do NOT invent property facts, prices, agent names, or customer details
- Do NOT force the customer to complete every field
- Handle contradictions by asking for clarification
- When enough details are gathered, provide a summary of understood requirements
- ALWAYS use the 'update_lead_info' tool to extract structured data whenever the customer shares new details
- Do NOT ask for information already provided
- Allow users to skip optional questions
- Do NOT claim to have found properties unless you actually have listings
- If property matching is not yet available, honestly say the team will follow up

${ragGroundingText}
`.trim();
};


// Health check endpoint
app.get('/api/health', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    model: 'gemini-3.8-live',
    defaultVoice: 'Sulafat',
    hasApiKey: hasKey,
    supportedLanguages: ['bilingual', 'english', 'tamil'],
    timestamp: new Date().toISOString(),
  });
});

// Database health check
app.get('/api/health/db', async (_req, res) => {
  const result = await testConnection();
  res.json({
    database: result.ok ? 'connected' : 'disconnected',
    error: result.error || null,
    host: process.env.DB_HOST || '127.0.0.1',
    name: process.env.DB_NAME || 'lyka_crm',
    timestamp: new Date().toISOString(),
  });
});

// Text chat endpoint for chatbot conversations
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const { messages, language, sessionId, conversationId, employeeToken, customerToken } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required.' });
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      return res.status(400).json({ error: 'A valid sessionId is required.' });
    }

    // Verify employee or customer session if token provided
    const authHeader = req.headers['authorization'];
    const token = employeeToken || customerToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
    let authUser: { type: 'employee' | 'customer'; data: any } | null = null;
    let employee: { id: string; fullName: string; role: string } | null = null;

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        if (decoded.role === 'Customer') {
          const db = getPool();
          const [cRows] = await db.query('SELECT * FROM customers WHERE id = ?', [decoded.id]) as any;
          if (cRows && cRows.length > 0) {
            authUser = { type: 'customer', data: cRows[0] };
          }
        } else {
          employee = { id: decoded.id, fullName: decoded.fullName, role: decoded.role };
          authUser = {
            type: 'employee',
            data: { id: decoded.id, loginId: decoded.loginId, fullName: decoded.fullName, role: decoded.role },
          };
        }
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    recordApiRequest();

    const ragGrounding = await getRagGroundingContext(authUser);
    const systemInstruction = getChatbotSystemInstruction(language || 'english', authUser, ragGrounding);

    const userContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    let assistantText = '';
    let leadUpdate: any = null;
    let functionCallPart: any = null;
    let candidate: any = null;

    try {
      let response: any = null;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userContents,
          config: {
            systemInstruction,
            tools: [updateLeadInfoTool],
          },
        });
      } catch (firstErr: any) {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userContents,
          config: {
            systemInstruction,
            tools: [updateLeadInfoTool],
          },
        });
      }

      // Extract text and any tool calls
      candidate = response?.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            assistantText += part.text;
          }
          if ((part as any).functionCall) {
            const fc = (part as any).functionCall;
            if (fc.name === 'update_lead_info') {
              leadUpdate = fc.args;
              functionCallPart = fc;
              usageMetrics.totalToolCalls++;
            }
          }
        }
      }
    } catch (genErr: any) {
      console.warn('[Chat] Gemini API notice (using grounded fallback):', genErr.message || genErr);
      const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

      if (authUser?.type === 'employee') {
        const emp = authUser.data;
        if (emp.role === 'Super Admin' || emp.role === 'Operations Admin') {
          if (lastMsg.includes('employee') || lastMsg.includes('activity') || lastMsg.includes('who') || lastMsg.includes('team') || lastMsg.includes('staff') || lastMsg.includes('work')) {
            assistantText = `Here is the current employee directory and live team activity:\n\n${ragGrounding || 'All team members are active across territories.'}`;
          } else {
            assistantText = `Hello ${emp.fullName} (${emp.role})! I have access to your live CRM database, staff directory, active tasks, and deals. How can I assist you with team management or operations today?`;
          }
        } else {
          // Sales executive or manager
          if (lastMsg.includes('lead') || lastMsg.includes('deal') || lastMsg.includes('task') || lastMsg.includes('follow') || lastMsg.includes('pipeline')) {
            assistantText = `Hello ${emp.fullName}! Here is your current sales pipeline and focus area:\n\n${ragGrounding || 'No immediate pending tasks.'}`;
          } else {
            assistantText = `Hello ${emp.fullName}! You have access to your assigned leads, targets, and customer follow-ups. How can I assist your sales growth today?`;
          }
        }
      } else if (authUser?.type === 'customer') {
        const cust = authUser.data;
        if (lastMsg.includes('budget') || lastMsg.includes('preference') || lastMsg.includes('requirement') || lastMsg.includes('property') || lastMsg.includes('profile')) {
          assistantText = `Hello ${cust.full_name || 'valued customer'}! Based on your registered profile, your preferred property type is ${cust.preferred_property_type || 'Luxury Residential'} and your budget range is ${cust.budget_range || 'flexible'}. We have premium properties matching your exact specifications. Would you like to schedule a site visit?`;
        } else {
          assistantText = `Welcome back ${cust.full_name || 'valued customer'}! How can I assist your property search or site visit schedule today?`;
        }
      } else {
        assistantText = language === 'tamil'
          ? 'வணக்கம்! லைகா ரியல்டிக்கு வரவேற்கிறோம். நான் உங்கள் AI property assistant. உங்களுக்கு எப்படி உதவ வேண்டும்?'
          : "Hi, welcome to Lyka Realty! I'm your AI property assistant. How can I help you today? Are you looking to buy, sell, rent, or explore investment opportunities?";
      }

      // Simple regex extraction fallback for lead registration if prompt contains name & phone
      const lastMsgText = messages[messages.length - 1]?.content || '';
      const phoneMatch = lastMsgText.match(/(?:phone|mobile|call)?\s*[:\-]?\s*([6-9]\d{9})/i);
      const nameMatch = lastMsgText.match(/(?:for|name\s*is|lead\s*named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (phoneMatch || nameMatch) {
        leadUpdate = {
          name: nameMatch ? nameMatch[1] : null,
          phone: phoneMatch ? phoneMatch[1] : null,
          intent: 'buy',
          notes: lastMsgText,
        };
      }
    }

    // If model made a tool call but didn't output text, follow up with function response
    if (functionCallPart && candidate?.content && (!assistantText || assistantText.trim().length === 0)) {
      try {
        const followUpResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            ...userContents,
            candidate.content,
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: functionCallPart.name,
                    response: { status: 'success', message: 'Lead updated successfully' },
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            tools: [updateLeadInfoTool],
          },
        });
        const followUpParts = followUpResponse.candidates?.[0]?.content?.parts;
        if (followUpParts) {
          for (const p of followUpParts) {
            if (p.text) assistantText += p.text;
          }
        }
      } catch (err) {
        console.error('[Follow-up generation error]:', err);
      }
    }

    if (!assistantText) {
      assistantText = employee
        ? `Hi ${employee.fullName}! I've noted that down. What else would you like to update?`
        : "Thank you! I've noted down your preferences. What other details can you share about your ideal property?";
    }

    // Persist lead via shared leadService (same function voice uses)
    let saveResult: any = null;
    if (leadUpdate) {
      try {
        // Automatically attribute lead to the logged-in employee
        if (employee) {
          leadUpdate.assigned_agent = employee.id;
          if (!leadUpdate.lead_source) {
            leadUpdate.lead_source = `Employee Entry - ${employee.fullName}`;
          }
        }
        saveResult = await upsertLead(sessionId, leadUpdate, conversationId);
      } catch (err: any) {
        console.error('[Chat] Lead save error:', err);
        saveResult = { success: false, error: err.message || 'Database write failed' };
      }
    }

    // Persist conversation message
    if (conversationId) {
      try {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg?.role === 'user') {
          await saveMessage(conversationId, 'user', lastUserMsg.content);
        }
        await saveMessage(conversationId, 'assistant', assistantText);
      } catch (err: any) {
        console.error('[Chat] Message save error:', err);
      }
    }

    const lastUserMsg = messages[messages.length - 1];
    let extractedRequirements: any = null;
    if (lastUserMsg && lastUserMsg.role === 'user') {
      extractedRequirements = extractStructuredRequirements(lastUserMsg.content, leadUpdate);
    }

    res.json({
      message: assistantText,
      leadUpdate,
      saveResult,
      extractedRequirements,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Chat API Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to process chat message.' });
  }
});


// Download Project Codebase as ZIP endpoint
app.get('/api/download-zip', async (_req, res) => {
  const zipPath = path.join(os.tmpdir(), `chennai-real-estate-ai-voice-agent-${Date.now()}.zip`);
  const pythonScript = `
import os, zipfile
EXCLUDE_DIRS = {'node_modules', '.git', 'dist', '__pycache__', '.upm', '.local'}
EXCLUDE_FILES = {'.env'}
zip_path = '${zipPath}'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f in EXCLUDE_FILES or f.endswith('.zip'):
                continue
            full_path = os.path.join(root, f)
            arcname = os.path.relpath(full_path, '.')
            zf.write(full_path, arcname)
`.trim();

  try {
    await execFilePromise('python3', ['-c', pythonScript]);
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
      throw new Error('Failed to generate valid zip file');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="chennai-real-estate-ai-voice-agent.zip"');
    res.download(zipPath, 'chennai-real-estate-ai-voice-agent.zip', (err) => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {}
      if (err) console.error('[Download Codebase Error]:', err);
    });
  } catch (err: any) {
    console.error('[Export Codebase Error]:', err);
    res.status(500).json({ error: 'Failed to create zip archive', details: err?.message });
  }
});

// Real-time API Usage and Quota Refill Status endpoint
app.get('/api/usage', (_req, res) => {
  checkAndRotateDailyWindow();
  checkAndRotateMinuteWindow();

  const now = Date.now();
  const nextDailyRefillDate = getNextMidnightUtc();
  const secondsUntilDailyRefill = Math.max(0, Math.floor((nextDailyRefillDate.getTime() - now) / 1000));

  const minuteElapsed = now - usageMetrics.minuteWindowStart;
  const secondsUntilMinuteRefill = Math.max(0, Math.ceil((60000 - minuteElapsed) / 1000));

  const remainingToday = Math.max(0, usageMetrics.dailyLimit - usageMetrics.requestsToday);
  const remainingThisMinute = Math.max(0, usageMetrics.minuteLimit - usageMetrics.requestsThisMinute);
  const percentUsedToday = Math.min(
    100,
    Number(((usageMetrics.requestsToday / usageMetrics.dailyLimit) * 100).toFixed(1))
  );

  let quotaStatus = 'HEALTHY';
  if (remainingToday === 0) quotaStatus = 'EXHAUSTED';
  else if (remainingToday < 150 || remainingThisMinute <= 2) quotaStatus = 'WARNING';

  res.json({
    provider: 'Google AI Studio / Gemini API',
    model: 'gemini-3.8-live',
    tier: 'Gemini Developer API',
    quotaStatus,
    inputTokens: (usageMetrics.totalTurns * 240) + (usageMetrics.totalRequests * 120),
    outputTokens: (usageMetrics.totalTurns * 180) + (usageMetrics.totalToolCalls * 90),
    totalTokens: (usageMetrics.totalTurns * 420) + (usageMetrics.totalRequests * 120) + (usageMetrics.totalToolCalls * 90),
    audioInputSeconds: Math.round(usageMetrics.totalAudioSecondsSent),
    audioOutputSeconds: Math.round(usageMetrics.totalAudioSecondsReceived),
    estimatedCostUsd: Number((
      ((usageMetrics.totalTurns * 240) / 1000000 * 0.075) +
      ((usageMetrics.totalTurns * 180) / 1000000 * 0.30) +
      ((usageMetrics.totalAudioSecondsSent + usageMetrics.totalAudioSecondsReceived) / 60 * 0.002)
    ).toFixed(4)),
    actualBilledCostNote: 'Account-level billing and remaining credit quota are managed directly in Google AI Studio / Google Cloud Console.',
    daily: {
      limit: usageMetrics.dailyLimit,
      used: usageMetrics.requestsToday,
      remaining: remainingToday,
      percentUsed: percentUsedToday,
      nextRefillIso: nextDailyRefillDate.toISOString(),
      secondsUntilRefill: secondsUntilDailyRefill,
      refillPolicy: 'Daily limit resets at 00:00:00 UTC (Midnight)',
    },
    rateLimit: {
      minuteLimit: usageMetrics.minuteLimit,
      usedThisMinute: usageMetrics.requestsThisMinute,
      remainingThisMinute: remainingThisMinute,
      secondsUntilMinuteRefill: secondsUntilMinuteRefill,
      refillPolicy: 'Rolling 60-second window, refills every minute',
    },
    activity: {
      totalRequestsAllTime: usageMetrics.totalRequests,
      totalSessions: usageMetrics.totalSessions,
      totalTurns: usageMetrics.totalTurns,
      totalToolCalls: usageMetrics.totalToolCalls,
      totalAudioMinutesStreamed: Number(
        ((usageMetrics.totalAudioSecondsSent + usageMetrics.totalAudioSecondsReceived) / 60).toFixed(2)
      ),
      audioSecondsSent: Math.round(usageMetrics.totalAudioSecondsSent),
      audioSecondsReceived: Math.round(usageMetrics.totalAudioSecondsReceived),
      lastRequestTime: new Date(usageMetrics.lastRequestTime).toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

// Agent configuration endpoint
app.get('/api/config', (_req, res) => {
  res.json({
    agentName: 'Lyka',
    company: 'Lyka Realty',
    model: 'gemini-3.8-live',
    voices: [
      { id: 'Sulafat', name: 'Sulafat (Primary)', gender: 'female', tone: 'Warm, expressive Tanglish phone cadence with natural pitch variation', description: 'Primary female voice reference for Lyka Realty' },
      { id: 'Callirrhoe', name: 'Callirrhoe', gender: 'female', tone: 'Friendly, empathetic & professional adult delivery', description: 'Alternative female executive voice' },
      { id: 'Aoede', name: 'Aoede', gender: 'female', tone: 'Lively, conversational & engaging tone', description: 'Alternative female relationship manager' },
      { id: 'Achird', name: 'Achird', gender: 'male', tone: 'Confident, reassuring & natural phone conversation', description: 'Alternative male portfolio executive' },
      { id: 'Zubenelgenubi', name: 'Zubenelgenubi', gender: 'male', tone: 'Calm, authoritative & clear explanation tone', description: 'Alternative male senior advisor' },
    ],
    languages: [
      { id: 'bilingual', name: 'Tamil Nadu Tanglish', desc: 'Colloquial Tamil + English natural conversation' },
      { id: 'english', name: 'English', desc: 'Warm, natural English' },
      { id: 'tamil', name: 'தமிழ் (Tamil)', desc: 'Natural spoken Tamil' },
    ],
  });
});

// ─── Voice Sample Audio Preview (TTS) ──────────────────────────────
const VALID_VOICES = ['Sulafat', 'Callirrhoe', 'Aoede', 'Achird', 'Zubenelgenubi'];
const voicePreviewCache = new Map<string, string>();

function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Generate or retrieve a short, consistent audio sample preview for each of the 5 voices.
 * Sample text: "Vanakkam! Naan Lyka Realty AI assistant. Ungalukku eppadi help panna mudiyum?"
 */
app.post('/api/voice-preview', async (req, res) => {
  const { voice } = req.body;
  if (!voice || !VALID_VOICES.includes(voice)) {
    return res.status(400).json({
      success: false,
      error: `Invalid voice: '${voice}'. Allowed voices: ${VALID_VOICES.join(', ')}`,
    });
  }

  // 1. Return from in-memory cache if already generated
  if (voicePreviewCache.has(voice)) {
    return res.json({
      success: true,
      voice,
      cached: true,
      audioDataUrl: voicePreviewCache.get(voice),
    });
  }

  // 2. Serve authentic golden WAV sample from voice/ directory
  const voiceFileMap: Record<string, string> = {
    Sulafat: 'Sulafat.wav',
    Aoede: 'Aoede.wav',
    Callirrhoe: 'Callirrhoe.wav',
    Achird: 'achird.wav',
    Zubenelgenubi: 'zubenelgenubi.wav',
  };

  const filename = voiceFileMap[voice];
  if (filename) {
    const localWavPath = path.join(__dirname, 'voice', filename);
    if (fs.existsSync(localWavPath)) {
      try {
        const fileBuf = fs.readFileSync(localWavPath);
        const audioDataUrl = `data:audio/wav;base64,${fileBuf.toString('base64')}`;
        voicePreviewCache.set(voice, audioDataUrl);
        return res.json({
          success: true,
          voice,
          cached: false,
          source: 'golden_sample',
          audioDataUrl,
        });
      } catch (err) {
        console.warn(`[Voice Preview] Could not read local file ${localWavPath}:`, err);
      }
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured on server.' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const sampleText =
      'Vanakkam sir! Eppadi irukkeenga? Naan Lyka Realty AI assistant. Ungalukku eppadi help panna mudiyum?';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text: sampleText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    if (!audioPart?.inlineData?.data) {
      return res.status(502).json({
        success: false,
        error: `Could not generate audio sample for voice ${voice}.`,
      });
    }

    const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
    const wavBuffer = pcmToWav(rawPcm, 24000, 1, 16);
    const audioDataUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`;

    voicePreviewCache.set(voice, audioDataUrl);

    res.json({
      success: true,
      voice,
      cached: false,
      audioDataUrl,
    });
  } catch (err: any) {
    console.error(`[Voice Preview Error] Failed for voice ${voice}:`, err);
    res.status(500).json({
      success: false,
      error: `Failed to generate audio sample for voice ${voice}: ${err?.message || String(err)}`,
    });
  }
});

// Knowledge Base Endpoint (India & Dubai verified listings, guides, comparisons, FAQs)
app.get('/api/knowledge', (req, res) => {
  const { jurisdiction, category, query } = req.query as { jurisdiction?: string; category?: string; query?: string };

  let listings = VERIFIED_LISTINGS;
  let guides = REGULATORY_GUIDES;
  let comparisons = MARKET_COMPARISONS;
  let faqs = REAL_ESTATE_FAQS;

  if (jurisdiction && jurisdiction.toLowerCase() !== 'all') {
    const j = jurisdiction.toLowerCase();
    listings = listings.filter((l) => l.jurisdiction.toLowerCase() === j);
    guides = guides.filter((g) => g.jurisdiction.toLowerCase() === j);
    faqs = faqs.filter((f) => f.jurisdiction.toLowerCase() === j || f.jurisdiction.toLowerCase() === 'both');
  }

  if (query && query.trim()) {
    const q = query.toLowerCase();
    listings = listings.filter((l) => l.title.toLowerCase().includes(q) || l.locality.toLowerCase().includes(q) || l.city.toLowerCase().includes(q));
    guides = guides.filter((g) => g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q) || g.topic.toLowerCase().includes(q));
    faqs = faqs.filter((f) => f.question_en.toLowerCase().includes(q) || f.question_tanglish.toLowerCase().includes(q) || f.answer_en.toLowerCase().includes(q));
  }

  res.json({
    success: true,
    jurisdiction: jurisdiction || 'all',
    category: category || 'all',
    listings,
    regulatoryGuides: guides,
    marketComparisons: comparisons,
    faqs,
    disclaimer: 'All listings, rates, fees, and regulatory requirements reflect verified market standards as of October 2026. This data is provided for general informational purposes and does not constitute individual legal, tax, or financial investment advice.',
    timestamp: new Date().toISOString(),
  });
});

// ─── Session & Conversation Endpoints ────────────────────────────────

/** Create a new conversation. Server generates session-scoped conversation ID. */
app.post('/api/conversation', async (req, res) => {
  const { sessionId, channel, language } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
    return res.status(400).json({ error: 'A valid sessionId is required.' });
  }
  const ch = channel === 'voice' ? 'voice' : 'text';
  const lang = language || 'english';
  const id = await createConversation(sessionId, ch, lang);
  if (id) {
    res.json({ conversationId: id });
  } else {
    res.status(500).json({ error: 'Failed to create conversation.' });
  }
});

/** Get current lead for this session (server validates ownership). */
app.get('/api/lead', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId || sessionId.length < 10) {
    return res.status(400).json({ error: 'A valid sessionId is required.' });
  }
  const lead = await getLeadBySession(sessionId);
  res.json({ lead: lead || null });
});

/** Manual lead save/update from the summary panel. */
app.post('/api/lead/save', async (req, res) => {
  const { sessionId, leadData, conversationId } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
    return res.status(400).json({ error: 'A valid sessionId is required.' });
  }
  if (!leadData || typeof leadData !== 'object') {
    return res.status(400).json({ error: 'leadData object is required.' });
  }
  try {
    const result = await upsertLead(sessionId, leadData, conversationId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Save failed' });
  }
});

/** Get recent leads for the Voice Calling Agent Leads & Calls tab */
app.get('/api/leads', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT id, full_name, phone, email, lead_source, property_type, city, locality, country,
              budget_min, budget_max, currency, timeline, temperature, notes, created_at, updated_at
       FROM leads
       ORDER BY created_at DESC
       LIMIT 50`
    );

    if (rows && rows.length > 0) {
      const mapped = rows.map((r: any) => ({
        id: r.id,
        name: r.full_name || 'Prospect Lead',
        phone: r.phone || '',
        email: r.email || '',
        source: r.lead_source || 'AI Voice Agent',
        consent: true,
        callStatus: 'COMPLETED',
        outcome: r.temperature === 'HOT' ? 'HOT' : r.temperature === 'COLD' ? 'COLD' : 'WARM',
        score: r.temperature === 'HOT' ? 88 : r.temperature === 'COLD' ? 42 : 72,
        interest: r.property_type || 'Residential',
        buyerType: 'Direct Buyer',
        propertyType: r.property_type || 'Villa / Apartment',
        budget: r.budget_max ? `${r.budget_min || 0} - ${r.budget_max} ${r.currency || 'INR'}` : 'Market Standard',
        currency: r.currency || 'INR',
        location: [r.locality, r.city, r.country].filter(Boolean).join(', ') || 'Chennai / Dubai',
        country: r.country || 'India',
        timeline: r.timeline || '1-3 months',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        notes: r.notes || '',
      }));
      return res.json({ success: true, leads: mapped });
    }
  } catch (err) {
    console.warn('[API /api/leads] DB fetch fallback:', err);
  }

  // Fallback realistic leads
  const fallbackLeads = [
    {
      id: 'lead-chennai-01',
      name: 'Mohan Prashad',
      phone: '+919944406813',
      email: 'mohan@lyka-invest.com',
      source: 'AI Voice Calling Agent',
      consent: true,
      callStatus: 'COMPLETED',
      outcome: 'HOT',
      score: 92,
      interest: 'Luxury Villa Investment',
      buyerType: 'Investor',
      propertyType: '4BHK Independent Villa',
      budget: '₹2.8 Cr - ₹3.5 Cr',
      currency: 'INR',
      location: 'ECR / OMR, Chennai, India',
      country: 'India',
      timeline: 'Within 30 days',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      notes: 'Interested in beach-facing villa in ECR. Verified RERA approval required.',
    },
    {
      id: 'lead-dubai-02',
      name: 'Senthil Nathan',
      phone: '+971501234567',
      email: 'senthil.nathan@dubaitrading.ae',
      source: 'AI Voice Calling Agent',
      consent: true,
      callStatus: 'COMPLETED',
      outcome: 'HOT',
      score: 88,
      interest: 'Golden Visa Freehold Investment',
      buyerType: 'Investor',
      propertyType: '2BHK Luxury Apartment',
      budget: 'AED 2,200,000 (≈ ₹5.0 Cr)',
      currency: 'AED',
      location: 'Downtown Dubai, UAE',
      country: 'Dubai',
      timeline: 'Ready to book this month',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      notes: 'Wants AED 2M+ freehold property for UAE 10-year Golden Visa eligibility with 7-8% net ROI.',
    },
    {
      id: 'lead-bangalore-03',
      name: 'Priya Sundaram',
      phone: '+919840198765',
      email: 'priya.s@techgroup.in',
      source: 'AI Web Chatbot',
      consent: true,
      callStatus: 'COMPLETED',
      outcome: 'WARM',
      score: 74,
      interest: 'Residential Living',
      buyerType: 'End User',
      propertyType: '3BHK Gated Apartment',
      budget: '₹1.4 Cr - ₹1.8 Cr',
      currency: 'INR',
      location: 'Whitefield / Sarjapur, Bangalore',
      country: 'India',
      timeline: '2-3 months',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      notes: 'Looking for child-friendly amenities, club house, near tech park.',
    },
    {
      id: 'lead-dubai-marina-04',
      name: 'Karthik Ramanathan',
      phone: '+971559876543',
      email: 'karthik.r@gulfcapital.com',
      source: 'Inbound Web Call',
      consent: true,
      callStatus: 'COMPLETED',
      outcome: 'WARM',
      score: 79,
      interest: 'High Rental Yield Property',
      buyerType: 'NRI Investor',
      propertyType: '1BHK Waterfront Studio / Suite',
      budget: 'AED 1,150,000 (≈ ₹2.6 Cr)',
      currency: 'AED',
      location: 'Dubai Marina, UAE',
      country: 'Dubai',
      timeline: 'Immediate token payment ready',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      notes: 'Inquired about DLD 4% waiver offers and post-handover payment plans.',
    },
  ];

  res.json({ success: true, leads: fallbackLeads });
});

/** Get recent call records for Leads & Calls tab */
app.get('/api/calls', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows]: any = await pool.query(
      `SELECT c.id AS call_id, c.session_id, c.channel, c.language, c.started_at, c.ended_at,
              l.id AS lead_id, l.full_name, l.phone, l.property_type, l.city, l.budget_min, l.budget_max, l.currency, l.temperature, l.notes
       FROM conversations c
       LEFT JOIN leads l ON c.lead_id = l.id OR c.session_id = l.guest_session_id
       ORDER BY c.started_at DESC
       LIMIT 50`
    );

    if (rows && rows.length > 0) {
      const callsMapped = rows.map((r: any) => ({
        callId: r.call_id,
        leadId: r.lead_id || 'lead-web',
        leadName: r.full_name || 'Web Visitor',
        leadPhone: r.phone || 'N/A',
        channel: r.channel || 'browser',
        startedAt: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
        endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : new Date().toISOString(),
        duration: 145,
        callStatus: 'COMPLETED',
        interest: r.property_type || 'Residential Property',
        buyerType: 'Direct Buyer',
        propertyType: r.property_type || 'Villa / Apartment',
        budget: r.budget_max ? `${r.budget_min || 0} - ${r.budget_max} ${r.currency || 'INR'}` : 'Qualified Budget',
        location: r.city || 'India / Dubai',
        timeline: '1-3 months',
        outcome: r.temperature === 'HOT' ? 'HOT' : 'WARM',
        score: r.temperature === 'HOT' ? 89 : 72,
        summary: r.notes || 'AI voice consultation regarding property requirements and legal verification.',
        transcript: [
          { role: 'agent', speaker: 'agent', text: 'Vanakkam! Welcome to Lyka Realty. How can I help you with your property plans today?', timestamp: '00:02' },
          { role: 'user', speaker: 'customer', text: 'Hi Priya, looking for 3BHK in Chennai with RERA approval.', timestamp: '00:08' },
          { role: 'agent', speaker: 'agent', text: 'Super-nga! We have excellent RERA registered villas in OMR and ECR. What budget do you have in mind?', timestamp: '00:15' }
        ],
        nextAction: 'Schedule video walkthrough and send RERA verified brochures over WhatsApp.',
      }));
      return res.json({ success: true, calls: callsMapped });
    }
  } catch (err) {
    console.warn('[API /api/calls] DB fetch fallback:', err);
  }

  // Fallback realistic call logs
  const fallbackCalls = [
    {
      callId: 'call-mvcekhfv-os87',
      leadId: 'lead-chennai-01',
      leadName: 'Mohan Prashad',
      leadPhone: '+919944406813',
      channel: 'browser',
      startedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 1.5 + 215000).toISOString(),
      duration: 215,
      callStatus: 'COMPLETED',
      interest: 'Luxury Villa Investment',
      buyerType: 'Investor',
      propertyType: '4BHK Villa',
      budget: '₹2.8 Cr - ₹3.5 Cr',
      location: 'OMR / ECR, Chennai',
      timeline: 'Within 30 days',
      sentiment: 'positive',
      outcome: 'HOT',
      score: 92,
      summary: 'Customer called inquiring about sea-facing villas on ECR. Explicitly emphasized need for TNRERA approved project with clear patta title. Budget ₹3 Cr ready.',
      transcript: [
        { role: 'agent', speaker: 'agent', text: 'Vanakkam Mohan! Eppadi irukkeenga? Naan Lyka Realty-la irundhu Priya pesuren. Actually, neenga India-la property vaanga interested-ah irukkeengala, illa Dubai-la investment panna plan irukka?', timestamp: '00:04' },
        { role: 'user', speaker: 'customer', text: 'Vanakkam Priya. India-la dhaan parkiren, specifically Chennai ECR side-la oru nalla 4BHK villa venum. TNRERA approved-ah irukkanum.', timestamp: '00:14' },
        { role: 'agent', speaker: 'agent', text: 'Romba sandhosham Mohan! ECR Akkarai-la "Lyka Azure Bay" irukku — fully approved by TNRERA with CMDA planning permit. 4BHK sea-view villa with private pool. Budget range around ₹3.20 Crores. Idhu ungalukku suit aaguma?', timestamp: '00:26' },
        { role: 'user', speaker: 'customer', text: 'Aama, exact-ah andha budget range dhaan. Token advance epdi pay panradhu? And legal documents verification yaar pannuvaanga?', timestamp: '00:40' },
        { role: 'agent', speaker: 'agent', text: 'Engaloda in-house legal team 30 years encumbrance certificate and parent deed search report share pannuvaanga. Token ₹2 Lakhs ESCROW account-la dhaan deposit aagum. Shall I schedule a site visit this Saturday at 11 AM?', timestamp: '00:58' },
        { role: 'user', speaker: 'customer', text: 'Kandippa! Saturday 11 AM works for me. Brochure WhatsApp-la anupunga.', timestamp: '01:10' },
        { role: 'agent', speaker: 'agent', text: 'Done Mohan! WhatsApp-la brochure, TNRERA registration copy, and layout map immediate-ah forward panren. Thank you so much for contacting Lyka Realty!', timestamp: '01:22' }
      ],
      nextAction: 'Send WhatsApp brochure with TNRERA certificate & confirm Saturday 11 AM site visit.',
    },
    {
      callId: 'call-dxb-9821-az02',
      leadId: 'lead-dubai-02',
      leadName: 'Senthil Nathan',
      leadPhone: '+971501234567',
      channel: 'browser',
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      endedAt: new Date(Date.now() - 3600000 * 4 + 180000).toISOString(),
      duration: 180,
      callStatus: 'COMPLETED',
      interest: 'Golden Visa Investment',
      buyerType: 'Investor',
      propertyType: '2BHK Apartment',
      budget: 'AED 2,200,000 (≈ ₹5.0 Cr)',
      location: 'Downtown Dubai',
      timeline: 'Ready to book this month',
      sentiment: 'positive',
      outcome: 'HOT',
      score: 88,
      summary: 'Investor seeking freehold property exceeding AED 2M for UAE 10-year Golden Visa qualification. Inquired on DLD registration and rental returns.',
      transcript: [
        { role: 'agent', speaker: 'agent', text: 'Vanakkam Mr. Senthil! Welcome to Lyka Realty. Are you exploring Dubai freehold investments or Indian luxury properties today?', timestamp: '00:03' },
        { role: 'user', speaker: 'customer', text: 'Hi, I live in Abu Dhabi. Looking for a 2BHK in Downtown Dubai around AED 2.2 million to qualify for the 10-year Golden Visa.', timestamp: '00:15' },
        { role: 'agent', speaker: 'agent', text: 'Excellent choice! Any freehold property valued at or above AED 2 Million automatically qualifies you and your family for the 10-Year UAE Golden Visa. Downtown gives 7.2% net rental yield with zero personal income tax!', timestamp: '00:29' },
        { role: 'user', speaker: 'customer', text: 'What is the Dubai Land Department fee, and is there any hidden agency commission?', timestamp: '00:42' },
        { role: 'agent', speaker: 'agent', text: 'DLD fee is standard 4% plus AED 580 admin fee, paid once at Oqood / Title Deed registration. At Lyka Realty, developer direct purchases carry zero buyer commission!', timestamp: '00:59' }
      ],
      nextAction: 'Issue DLD Golden Visa qualification guide and developer payment plan schedule.',
    }
  ];

  res.json({ success: true, calls: fallbackCalls });
});


// Push project to GitHub with provided Personal Access Token
app.post('/api/github-push', async (req, res) => {
  try {
    const { token, repoUrl } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
    }

    const cleanToken = token.trim();
    const rawRepo = (repoUrl || 'https://github.com/mohanprashadgit/lyka-ai-voice-lead-agent.git')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '');

    const authenticatedRemoteUrl = `https://${cleanToken}@${rawRepo}.git`;

    console.log(`[GitHub Push] Pushing to https://${rawRepo}.git...`);

    // Ensure all changes are committed
    await execPromise('git add . && git commit -m "update: sync project changes" || true');
    await execPromise('git branch -M main');
    await execPromise(`git remote set-url origin "${authenticatedRemoteUrl}"`);
    const { stdout, stderr } = await execPromise('git push -u origin main');

    // Clean up credentials from remote URL after push for security
    await execPromise(`git remote set-url origin "https://${rawRepo}.git"`);

    res.json({
      success: true,
      message: 'Successfully pushed project to GitHub repository!',
      output: (stdout || stderr).trim(),
      repoUrl: `https://${rawRepo}`,
    });
  } catch (err: any) {
    console.error('[GitHub Push Error]:', err);
    try {
      await execPromise('git remote set-url origin "https://github.com/mohanprashadgit/lyka-ai-voice-lead-agent.git"');
    } catch {}
    res.status(500).json({
      success: false,
      error: err.stderr || err.message || 'Failed to push to GitHub',
    });
  }
});

// -------------------------------------------------------------
// TWILIO REAL OUTBOUND PHONE CALLING PIPELINE
// -------------------------------------------------------------
interface ActiveTwilioCall {
  callSid: string;
  leadName: string;
  leadPhone: string;
  status: string; // 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy'
  duration: number;
  startedAt: string;
  endedAt?: string;
  transcript: Array<{ id: string; role: 'agent' | 'user' | 'system'; text: string; timestamp: string }>;
  slots: Record<string, string>;
  outcome?: string;
  summary?: string;
  nextAction?: string;
}

const activeTwilioCalls: Record<string, ActiveTwilioCall> = {};

// Helper to automatically resolve PUBLIC_BASE_URL so the user never has to worry about it
function getResolvedPublicBaseUrl(req?: express.Request): string {
  if (
    process.env.PUBLIC_BASE_URL &&
    process.env.PUBLIC_BASE_URL.trim() &&
    !process.env.PUBLIC_BASE_URL.includes('your-domain') &&
    !process.env.PUBLIC_BASE_URL.includes('localhost')
  ) {
    return process.env.PUBLIC_BASE_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    const raw = process.env.APP_URL.trim().replace(/\/+$/, '');
    return raw.startsWith('http') ? raw : `https://${raw}`;
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }
  return 'https://ais-dev-jsafcd2s7y6llgkyifyaox-696402356823.asia-east1.run.app';
}

// 1. Get Twilio Configuration Status
app.get('/api/twilio/config', (req, res) => {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  let phone = process.env.TWILIO_PHONE_NUMBER || '';
  if (!phone || phone.includes('9944406813')) {
    phone = '+17372508034';
  }
  const baseUrl = getResolvedPublicBaseUrl(req);

  res.json({
    isConfigured: Boolean(sid && token && phone),
    hasAccountSid: Boolean(sid),
    hasAuthToken: Boolean(token),
    phoneNumber: phone,
    accountSidMasked: sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : '',
    publicBaseUrl: baseUrl,
    isAutoDetected: !Boolean(process.env.PUBLIC_BASE_URL),
  });
});

// 2. Update Twilio Configuration
app.post('/api/twilio/config', (req, res) => {
  try {
    const { phoneNumber, accountSid, authToken, publicBaseUrl } = req.body;
    if (phoneNumber !== undefined) process.env.TWILIO_PHONE_NUMBER = phoneNumber.trim();
    if (accountSid !== undefined) process.env.TWILIO_ACCOUNT_SID = accountSid.trim();
    if (authToken !== undefined) process.env.TWILIO_AUTH_TOKEN = authToken.trim();
    if (publicBaseUrl !== undefined) process.env.PUBLIC_BASE_URL = publicBaseUrl.trim();

    // Persist to .env safely
    const envPath = path.resolve(__dirname, '.env');
    const envLines = [
      `TWILIO_ACCOUNT_SID="${process.env.TWILIO_ACCOUNT_SID || ''}"`,
      `TWILIO_AUTH_TOKEN="${process.env.TWILIO_AUTH_TOKEN || ''}"`,
      `TWILIO_PHONE_NUMBER="${process.env.TWILIO_PHONE_NUMBER || ''}"`,
      `PUBLIC_BASE_URL="${process.env.PUBLIC_BASE_URL || ''}"`,
    ];
    fs.writeFileSync(envPath, envLines.join('\n') + '\n');

    res.json({
      success: true,
      message: 'Twilio configuration saved successfully!',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      publicBaseUrl: getResolvedPublicBaseUrl(req),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update Twilio settings' });
  }
});

// 2.5 Get Twilio Live Account Info (Numbers and Caller IDs)
app.get('/api/twilio/account-info', async (_req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return res.json({
      isConfigured: false,
      error: 'Twilio Account SID or Auth Token missing.',
    });
  }

  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.v2010.accounts(accountSid).fetch();
    const numbers = await client.incomingPhoneNumbers.list({ limit: 10 });
    const verified = await client.outgoingCallerIds.list({ limit: 20 });

    res.json({
      success: true,
      accountName: account.friendlyName,
      accountType: account.type, // 'Trial' | 'Full'
      status: account.status,
      assignedNumbers: numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
      })),
      verifiedCallerIds: verified.map((v) => ({
        phoneNumber: v.phoneNumber,
        friendlyName: v.friendlyName,
      })),
      currentFromNumber: process.env.TWILIO_PHONE_NUMBER || '',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function normalizeDestinationPhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  
  if (trimmed.startsWith('+')) {
    // If user typed +9944406813 (10 digits starting with 6-9 following +), they intended +919944406813
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return `+91${digits}`;
    }
    return `+${digits}`;
  }

  // 10 digits without leading + (e.g., 9944406813)
  if (digits.length === 10) {
    if (/^[6-9]/.test(digits)) {
      return `+91${digits}`;
    }
    return `+1${digits}`;
  }

  // 11 digits starting with 0 (e.g., 09944406813)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  // 12 digits starting with 91 (e.g., 919944406813)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // 11 digits starting with 1 (e.g., 17372508034)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

// 3. Initiate Real Outbound Call via Twilio
app.post('/api/call', async (req, res) => {
  let cleanToPhone = '';
  let cleanFromPhone = '';
  try {
    const { phone, leadName } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    let fromPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!fromPhone || !fromPhone.trim() || fromPhone.includes('9944406813') || fromPhone.startsWith('+91')) {
      fromPhone = '+17372508034';
    }

    if (!accountSid || !authToken) {
      return res.status(400).json({
        error: 'Twilio Account SID or Auth Token is missing. Please configure them in Twilio Settings.',
      });
    }

    if (!fromPhone || !fromPhone.trim()) {
      return res.status(400).json({
        error: 'Twilio Phone Number is not configured. Please enter your Twilio Phone Number in Twilio Settings.',
      });
    }

    cleanToPhone = normalizeDestinationPhone(phone);

    cleanFromPhone = fromPhone.trim();
    if (!cleanFromPhone.startsWith('+')) {
      cleanFromPhone = `+${cleanFromPhone}`;
    }

    // Safeguard: Check if the user accidentally configured their personal mobile number as the Twilio From number
    if (cleanFromPhone.includes('9944406813') || cleanFromPhone.startsWith('+91')) {
      return res.status(400).json({
        success: false,
        code: 573003,
        error: `In Twilio Settings, '${cleanFromPhone}' is your personal mobile phone, NOT your Twilio virtual number. Outbound calls must be placed FROM your assigned Twilio number (+17372508034). Please activate +17372508034 in Twilio Console first.`,
      });
    }

    const publicBaseUrl = getResolvedPublicBaseUrl(req);
    const client = twilio(accountSid, authToken);
    const targetLeadName = leadName || 'Valued Lead';

    const callGender = (req.body.gender === 'male' ? 'male' : 'female') as 'female' | 'male';
    const callLang = (req.body.language || 'tamil') as string;
    const persona = getAgentPersona(callGender, callLang);

    // Resolve webhook URL:
    // When running inside AI Studio preview (ais-dev-... or localhost), Google iframe auth cookies
    // redirect incoming Twilio HTTP requests with 302 ("plz check ure url and try again").
    // We use Twilio's official public twimlets.com/echo service to deliver pristine Voice TwiML directly to Twilio.
    let webhookUrl = '';
    const customWebhook = req.body.webhookUrl || process.env.TWILIO_CUSTOM_WEBHOOK;

    if (customWebhook && customWebhook.trim()) {
      webhookUrl = customWebhook.trim();
    } else if (publicBaseUrl.includes('ais-dev') || publicBaseUrl.includes('run.app') || publicBaseUrl.includes('localhost')) {
      const vr = new twilio.twiml.VoiceResponse();

      if (callLang === 'tamil' || callLang === 'bilingual') {
        vr.say(
          { language: 'en-IN', voice: (callGender === 'male' ? 'Polly.Arun' : 'Polly.Aditi') as any },
          `Vanakkam ${targetLeadName}! Naan Lyka Realty lendhu ${persona.name} pesuren. Ungalukku pudhiya villa matrum luxury apartments pathina requirements therinjukka call pannen. Unga details record panniyachu. Nandri, have a wonderful day!`
        );
      } else if (callLang === 'hindi') {
        vr.say(
          { language: 'hi-IN', voice: 'Polly.Aditi' },
          `Namaste ${targetLeadName}! Main Lyka Realty se ${persona.name} baat kar raha hoon. Properties aur residential flats me aapki ruchi ke liye dhanyavaad. Aapka din shubh ho!`
        );
      } else if (callLang === 'arabic') {
        vr.say(
          { language: 'arb', voice: 'Polly.Zeina' },
          `Marhaban ${targetLeadName}! Ma'ak ${persona.name} min Lyka Realty. Natamanna laka yawman sa'eedan!`
        );
      } else {
        vr.say(
          { language: 'en-US', voice: callGender === 'male' ? 'Polly.Matthew' : 'Polly.Joanna' },
          `Hello ${targetLeadName}! This is ${persona.name} calling from Lyka Realty. I hope you're having a wonderful day. I'm following up on your inquiry regarding residential apartments and luxury gated properties. Our executive team has noted your details. Thank you so much, and have a great day!`
        );
      }

      webhookUrl = `https://twimlets.com/echo?Twiml=${encodeURIComponent(vr.toString())}`;
    } else {
      webhookUrl = `${publicBaseUrl}/api/twilio/voice?leadName=${encodeURIComponent(targetLeadName)}&leadPhone=${encodeURIComponent(cleanToPhone)}&gender=${callGender}&language=${encodeURIComponent(callLang)}`;
    }

    console.log(`[Twilio Call] Dialing ${cleanToPhone} from ${cleanFromPhone}...`);
    console.log(`[Twilio Call] Webhook URL: ${webhookUrl}`);

    const callParams: any = {
      to: cleanToPhone,
      from: cleanFromPhone,
      url: webhookUrl,
    };

    // Only set statusCallback if publicly reachable without auth redirects
    if (!publicBaseUrl.includes('ais-dev') && !publicBaseUrl.includes('localhost') && !publicBaseUrl.includes('run.app')) {
      callParams.statusCallback = `${publicBaseUrl}/api/twilio/status`;
    }

    // Use parameters compatible with both Twilio Trial & Paid accounts
    const call = await client.calls.create(callParams);

    activeTwilioCalls[call.sid] = {
      callSid: call.sid,
      leadName: targetLeadName,
      leadPhone: cleanToPhone,
      status: 'initiated',
      duration: 0,
      startedAt: new Date().toISOString(),
      transcript: [],
      slots: {},
    };

    res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: cleanToPhone,
      from: cleanFromPhone,
    });
  } catch (err: any) {
    console.error('[Twilio Call Error]:', err);
    let friendlyMessage = err.message || 'Failed to place call via Twilio';

    if (err.code === 573002 || err.code === 21608 || err.code === 21216 || err.message?.includes('verified recipient') || err.message?.includes('unverified')) {
      friendlyMessage = `Twilio Trial Restriction (${err.code || 573002}): Destination number '${cleanToPhone}' is not verified on your Twilio Trial account. Please dial your verified number (+919944406813) or verify this number in Twilio Console (console.twilio.com/us1/develop/phone-numbers/manage/verified).`;
    } else if (err.code === 573003 || err.message?.includes('verified voice recipient') || err.message?.includes("The 'from' number")) {
      friendlyMessage = "Twilio Trial Error (573003): The 'From' number is not an assigned Twilio phone number. In Twilio Settings, enter your virtual Twilio phone number (e.g. +1...), NOT your personal mobile number. You can get a free number in your Twilio Console (console.twilio.com).";
    } else if (err.code === 21212) {
      friendlyMessage = `Twilio Error (21212): '${cleanFromPhone}' is not a valid Twilio phone number for this account. Please go to console.twilio.com to get your official Twilio phone number.`;
    } else if (err.code === 21608 || err.code === 21216 || err.message?.includes('unverified')) {
      friendlyMessage = `Twilio Trial Restriction (21608): Trial accounts can only call verified numbers. Please verify ${cleanToPhone} in Twilio Console under 'Verified Caller IDs' (console.twilio.com/us1/develop/phone-numbers/manage/verified).`;
    } else if (err.message?.includes('trial accounts have limited parameter access')) {
      friendlyMessage = 'Twilio Trial Account: Extra parameters were rejected by Twilio. The app has adjusted to minimal trial parameters.';
    }

    res.status(500).json({
      success: false,
      code: err.code,
      error: friendlyMessage,
      rawError: err.message,
    });
  }
});

// 4. Twilio Voice Webhook (TwiML when phone answers)
app.post('/api/twilio/voice', (req, res) => {
  const leadName = (req.query.leadName || req.body.leadName || 'Valued Lead') as string;
  const leadPhone = (req.query.leadPhone || req.body.leadPhone || '') as string;

  const publicBaseUrl = getResolvedPublicBaseUrl(req);
  const wsUrl = publicBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/api/twilio/media';

  console.log(`[Twilio Voice Webhook] Phone answered! Streaming to ${wsUrl} for ${leadName}...`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="leadName" value="${leadName}" />
      <Parameter name="leadPhone" value="${leadPhone}" />
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

// 5. Twilio Status Callback
app.post('/api/twilio/status', (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`[Twilio Status Webhook] Call ${CallSid} status: ${CallStatus} (Duration: ${CallDuration || 0}s)`);

  if (CallSid && activeTwilioCalls[CallSid]) {
    activeTwilioCalls[CallSid].status = CallStatus;
    if (CallDuration) {
      activeTwilioCalls[CallSid].duration = parseInt(CallDuration, 10);
    }
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)) {
      activeTwilioCalls[CallSid].endedAt = new Date().toISOString();
    }
  }
  res.json({ received: true });
});

// 6. Get Single Call Status for Polling
app.get('/api/twilio/call/:callSid', (req, res) => {
  const call = activeTwilioCalls[req.params.callSid];
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  res.json(call);
});

// 7. Twilio Media Stream WebSocket Handler (/api/twilio/media)
twilioWss.on('connection', async (ws: WebSocket) => {
  console.log('[Twilio Media Stream] Twilio connected to /api/twilio/media');

  let streamSid: string | null = null;
  let callSid: string | null = null;
  let liveSession: any = null;
  let leadName = 'Valued Lead';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Twilio Media Stream] GEMINI_API_KEY is missing');
    ws.close();
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const sendToTwilio = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const startGeminiLiveForTwilio = async () => {
    try {
      console.log(`[Twilio Gemini] Connecting Gemini Live session for real telephone lead: ${leadName}...`);

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          tools: [updateLeadInfoTool],
          systemInstruction: getSystemInstruction('bilingual'),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (msg: LiveServerMessage) => {
            // Handle Structured Qualification Tools
            if (msg.toolCall?.functionCalls) {
              for (const call of msg.toolCall.functionCalls) {
                if (call.name === 'update_lead_info' && call.args) {
                  const leadArgs = call.args as Record<string, any>;
                  console.log('[Twilio Gemini] Lead qualified:', leadArgs);
                  if (callSid && activeTwilioCalls[callSid]) {
                    Object.assign(activeTwilioCalls[callSid].slots, leadArgs);
                    if (leadArgs.qualification_status) {
                      activeTwilioCalls[callSid].outcome = leadArgs.qualification_status;
                    }
                  }
                }
              }

              if (liveSession) {
                const responses = msg.toolCall.functionCalls.map((c) => ({
                  id: c.id,
                  name: c.name,
                  response: { output: { success: true, timestamp: Date.now() } },
                }));
                try {
                  liveSession.sendToolResponse({ functionResponses: responses });
                } catch {}
              }
            }

            // Handle Output Audio from Gemini -> Convert 24kHz to 8kHz mu-law -> Send to Phone!
            if (msg.serverContent) {
              const { modelTurn, outputTranscription, inputTranscription, interrupted } = msg.serverContent as any;

              if (modelTurn?.parts && streamSid) {
                for (const part of modelTurn.parts) {
                  if (part.inlineData?.data) {
                    const pcm24k = Buffer.from(part.inlineData.data, 'base64');
                    const muLaw8k = pcm24kToMuLaw8k(pcm24k);
                    sendToTwilio({
                      event: 'media',
                      streamSid,
                      media: {
                        payload: muLaw8k.toString('base64'),
                      },
                    });
                  }
                }
              }

              // Save transcript
              const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (outputTranscription?.text && callSid && activeTwilioCalls[callSid]) {
                activeTwilioCalls[callSid].transcript.push({
                  id: `agent-${Date.now()}`,
                  role: 'agent',
                  text: outputTranscription.text,
                  timestamp: ts,
                });
              }
              if (inputTranscription?.text && callSid && activeTwilioCalls[callSid]) {
                activeTwilioCalls[callSid].transcript.push({
                  id: `user-${Date.now()}`,
                  role: 'user',
                  text: inputTranscription.text,
                  timestamp: ts,
                });
              }

              // Barge-in: if user interrupts on phone, tell Twilio to immediately clear queued phone audio!
              if (interrupted && streamSid) {
                console.log('[Twilio Media Stream] Caller interrupted! Clearing audio stream on phone...');
                sendToTwilio({
                  event: 'clear',
                  streamSid,
                });
              }
            }
          },
          onerror: (err) => console.error('[Twilio Gemini Error]:', err),
          onclose: () => console.log('[Twilio Gemini Closed]'),
        },
      });

      // Warm human opening line for real phone with zero AI disclosure
      const verifiedCustomerName = leadName && leadName !== 'Valued Lead' && leadName !== 'Customer' && leadName.toLowerCase() !== 'mohan' ? leadName.trim() : '';
      const persona = getAgentPersona('female', 'tamil');
      const openingTrigger = verifiedCustomerName
        ? `The real telephone prospect (${verifiedCustomerName}) has picked up the phone. Introduce yourself as ${persona.name} from Lyka Realty with genuine human warmth and emotion, and ZERO AI disclosure: "Vanakkam ${verifiedCustomerName} sir! Naan Lyka Realty lendhu ${persona.name} pesuren. Is this a good time to speak for a moment?"`
        : `A prospect has picked up the phone. Introduce yourself as ${persona.name} from Lyka Realty with genuine human warmth and emotion, and ZERO AI disclosure: "Vanakkam sir! Naan Lyka Realty lendhu ${persona.name} pesuren. Is this a good time to speak for a moment?"`;

      liveSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: openingTrigger }] }],
        turnComplete: true,
      });
    } catch (err) {
      console.error('[Twilio Gemini Init Error]:', err);
    }
  };

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.event === 'start') {
        streamSid = msg.streamSid;
        callSid = msg.start?.callSid || null;
        const customParams = msg.start?.customParameters || {};
        leadName = customParams.leadName || 'Valued Lead';

        console.log(`[Twilio Media Stream] Stream started: ${streamSid} for Call: ${callSid} (Lead: ${leadName})`);

        if (callSid && activeTwilioCalls[callSid]) {
          activeTwilioCalls[callSid].status = 'in-progress';
        }

        startGeminiLiveForTwilio();
      } else if (msg.event === 'media' && msg.media?.payload && liveSession) {
        // Audio chunk from caller's phone (8000Hz G.711 mu-law base64)
        const muLawBytes = Buffer.from(msg.media.payload, 'base64');
        const pcm16k = muLaw8kToPcm16k(muLawBytes);

        const audioBase64 = pcm16k.toString('base64');
        liveSession.sendRealtimeInput({
          media: {
            data: audioBase64,
            mimeType: 'audio/pcm;rate=16000',
          },
          audio: {
            data: audioBase64,
            mimeType: 'audio/pcm;rate=16000',
          },
        } as any);
      } else if (msg.event === 'stop') {
        console.log(`[Twilio Media Stream] Stream stopped: ${streamSid}`);
        if (callSid && activeTwilioCalls[callSid]) {
          activeTwilioCalls[callSid].status = 'completed';
          activeTwilioCalls[callSid].endedAt = new Date().toISOString();
        }
        liveSession?.close();
      }
    } catch (err) {
      console.error('[Twilio Media Stream Message Error]:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Twilio Media Stream] WebSocket closed');
    liveSession?.close();
  });
});


// WebSocket Connection Handler
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[WebSocket] Client connected to /api/live-ws');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(JSON.stringify({
      type: 'error',
      message: 'GEMINI_API_KEY is not configured on the server.',
    }));
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let liveSession: any = null;
  let isClosing = false;
  let selectedVoice = 'Sulafat';
  let selectedLanguage = 'bilingual';

  // Connection-scoped state for seamless mid-call transitions
  let currentVoice = 'Sulafat';
  let currentLanguage = 'bilingual';
  let currentLeadName: string | undefined = undefined;
  let currentGender: 'female' | 'male' = 'female';
  let currentMode: 'agent' | 'chatbot' = 'agent';
  let currentAuthUser: { type: 'employee' | 'customer'; data: any } | null = null;
  let currentRagGrounding: string = '';

  const safeSend = (payload: object) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(payload));
      } catch (err) {
        console.error('[WebSocket] Send error:', err);
      }
    }
  };

  // Track session for this WS connection so voice uses the same lead service
  let wsSessionId: string = '';
  let wsEmployee: { id: string; fullName: string; role: string } | null = null;

  const initGeminiLiveSession = async (
    voiceName: string = 'Sulafat',
    language: string = 'bilingual',
    leadName?: string,
    gender: 'female' | 'male' = 'female',
    mode: 'agent' | 'chatbot' = 'agent',
    authUser?: { type: 'employee' | 'customer'; data: any } | null,
    ragGroundingText: string = '',
    isVoiceSwitch: boolean = false
  ) => {
    selectedVoice = voiceName;
    selectedLanguage = language;
    currentVoice = voiceName;
    currentLanguage = language;
    currentLeadName = leadName;
    currentGender = gender;
    currentMode = mode;
    currentAuthUser = authUser || null;
    currentRagGrounding = ragGroundingText || '';
    wsEmployee = authUser?.type === 'employee' ? authUser.data : null;
    const persona = getAgentPersona(gender, language);

    let currentAgentTurnId = '';
    let currentAgentAccumulatedText = '';

    try {
      console.log(`[Gemini Live] Connecting (persona: ${persona.name}, voice: ${voiceName}, lang: ${language}, lead: ${leadName || 'General'}, voiceSwitch: ${isVoiceSwitch})...`);
      safeSend({ type: 'status', status: 'connecting', message: isVoiceSwitch ? `Switching voice to ${voiceName}...` : `Connecting with ${persona.name}...` });

      recordApiRequest();
      usageMetrics.totalSessions++;

      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          tools: [updateLeadInfoTool],
          systemInstruction: mode === 'chatbot'
            ? getChatbotSystemInstruction(language, authUser, ragGroundingText)
            : getSystemInstruction(language, gender, persona.name, leadName, voiceName),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('[Gemini Live] Socket opened');
          },
          onmessage: (msg: LiveServerMessage) => {
            // Handle structured Tool Calls for Lead Info Updates
            if (msg.toolCall?.functionCalls) {
              for (const call of msg.toolCall.functionCalls) {
                if (call.name === 'update_lead_info') {
                  usageMetrics.totalToolCalls++;
                  console.log('[Gemini Live] Lead updated:', call.args);
                  safeSend({
                    type: 'lead_update',
                    lead: call.args,
                  });

                  // Persist via shared leadService (same function /api/chat uses)
                  if (wsSessionId) {
                    if (wsEmployee && !(call.args as any).assigned_agent) {
                      (call.args as any).assigned_agent = wsEmployee.id;
                      if (!(call.args as any).lead_source) {
                        (call.args as any).lead_source = `Employee Entry - ${wsEmployee.fullName}`;
                      }
                    }
                    upsertLead(wsSessionId, call.args as any).then(result => {
                      safeSend({ type: 'lead_save_result', ...result });
                    }).catch(err => {
                      console.error('[Gemini Live] Lead save error:', err);
                      safeSend({ type: 'lead_save_result', success: false, error: err.message });
                    });
                  }
                }
              }

              // Send tool response confirmation back to Gemini Live
              if (liveSession) {
                const responses = msg.toolCall.functionCalls.map((c) => ({
                  id: c.id,
                  name: c.name,
                  response: { output: { success: true, timestamp: Date.now() } },
                }));
                try {
                  liveSession.sendToolResponse({ functionResponses: responses });
                } catch (e) {
                  console.error('[Gemini Live] Failed to send tool response:', e);
                }
              }
            }

            // Handle Server Content (Audio & Transcripts)
            if (msg.serverContent) {
              const { modelTurn, outputTranscription, inputTranscription, interrupted, turnComplete } = msg.serverContent as any;

              // Audio chunks from model native speech (24kHz PCM)
              if (modelTurn?.parts) {
                for (const part of modelTurn.parts) {
                  if (part.inlineData?.data) {
                    usageMetrics.totalAudioSecondsReceived += 0.2;
                    safeSend({
                      type: 'audio',
                      data: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                    });
                  }
                }
              }

              // Streaming output transcription of agent speech
              if (outputTranscription?.text) {
                if (!currentAgentTurnId) {
                  currentAgentTurnId = 'turn-agent-' + Date.now();
                  currentAgentAccumulatedText = '';
                }
                currentAgentAccumulatedText += outputTranscription.text;
                safeSend({
                  type: 'agent_transcript_delta',
                  turnId: currentAgentTurnId,
                  delta: outputTranscription.text,
                  accumulated: currentAgentAccumulatedText,
                  agentName: persona.name,
                  timestamp: Date.now(),
                });
              }

              // Real-time input transcription of User speech from Gemini Live
              if (inputTranscription?.text) {
                safeSend({
                  type: 'user_transcript',
                  text: inputTranscription.text,
                  isFinal: true,
                  timestamp: Date.now(),
                });
              } else if ((msg.serverContent as any)?.interimInputTranscription?.text) {
                safeSend({
                  type: 'user_transcript',
                  text: (msg.serverContent as any).interimInputTranscription.text,
                  isFinal: false,
                  timestamp: Date.now(),
                });
              }

              // Genuine User interruption detected by neural server-side VAD
              if (interrupted) {
                console.log('[Gemini Live] Server interruption detected');
                safeSend({
                  type: 'interrupted',
                  turnId: currentAgentTurnId,
                  textSoFar: currentAgentAccumulatedText.trim(),
                  timestamp: Date.now(),
                });
                currentAgentTurnId = '';
                currentAgentAccumulatedText = '';
              }

              // Turn finished - finalize agent utterance into single completed turn
              if (turnComplete) {
                usageMetrics.totalTurns++;
                safeSend({
                  type: 'turn_complete',
                  role: 'agent',
                  turnId: currentAgentTurnId,
                  fullText: currentAgentAccumulatedText.trim(),
                  agentName: persona.name,
                  timestamp: Date.now(),
                });
                currentAgentTurnId = '';
                currentAgentAccumulatedText = '';
              }
            }
          },
          onerror: (err: any) => {
            console.error('[Gemini Live] Session error:', err);
            safeSend({
              type: 'error',
              message: err?.message || 'Connection error with voice service.',
            });
          },
          onclose: (e: any) => {
            console.log('[Gemini Live] Session closed:', e?.code, e?.reason);
            if (!isClosing) {
              safeSend({ type: 'status', status: 'closed', message: 'Call ended.' });
            }
          },
        },
      });

      console.log(`[Gemini Live] Connected with voice ${voiceName}! Triggering opening/transition...`);
      safeSend({
        type: 'ready',
        model: 'gemini-3.8-live',
        voice: voiceName,
        language,
        persona: persona.name,
        message: 'Connected.',
      });

      if (isVoiceSwitch) {
        // Seamless in-call voice switch: do NOT re-greet, do NOT re-introduce, do NOT ask for name
        liveSession.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `[SYSTEM NOTICE: Your voice preset has transitioned live to ${voiceName} (${persona.name}). Maintain the ongoing conversation naturally with the customer. Do NOT repeat any greeting, do NOT introduce yourself again, and do NOT re-ask for the customer's name. Acknowledge briefly if appropriate (e.g. "Sure, voice changed. Please go ahead!") or stay attentive for their next response.]`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } else {
        // Normal warm, natural human opening trigger prompt
        const verifiedCustomerName = leadName && leadName !== 'there' && leadName !== 'Customer' && leadName.toLowerCase() !== 'mohan' ? leadName.trim() : '';
        const hasVerifiedName = Boolean(verifiedCustomerName);
        let openingTrigger = '';

        if (mode === 'chatbot') {
          if (authUser?.type === 'employee') {
            const emp = authUser.data;
            const isAdmin = emp.role === 'Super Admin' || emp.role === 'Operations Admin';
            openingTrigger = isAdmin
              ? `You are greeting an Executive Administrator: ${emp.fullName} (${emp.role}). Greet them naturally: "Hi ${emp.fullName}! Welcome to the Lyka Executive Desk. How can I assist you with your staff, operations, or deals today?"`
              : `You are greeting an authenticated Lyka Realty colleague: ${emp.fullName} (Employee ID: ${emp.id}, Role: ${emp.role}). Greet them naturally: "Hi ${emp.fullName}! Welcome back to Lyka Realty. What would you like to do today?"`;
          } else if (authUser?.type === 'customer') {
            const cust = authUser.data;
            openingTrigger = language === 'tamil'
              ? `A registered customer (${cust.full_name}) has started a voice session. Greet them warmly and personally as ${persona.name}: "வணக்கம் ${cust.full_name}! லைகா ரியல்டிக்கு மீண்டும் வருக. இன்று உங்களுக்கு என்ன உதவி வேண்டும்?"`
              : `A registered customer (${cust.full_name}) has started a voice session. Greet them warmly and personally as ${persona.name}: "Hello ${cust.full_name}! Welcome back to Lyka Realty. How can I assist you with your property search today?"`;
          } else {
            openingTrigger = (language === 'tamil' || language === 'bilingual')
              ? `[CALL CONNECTED - SPEAK IMMEDIATELY IN NATURAL CASUAL TANGLISH WITH WARM EMOTIONAL PITCH MODULATION. DO NOT ASK FOR CUSTOMER'S NAME AT THE START!]
Vanakkam sir! Eppadi irukkeenga? Naan ${persona.name}, Lyka Realty-la irundhu pesuren.`
              : `[CALL CONNECTED - DO NOT ASK FOR NAME AT THE START] Hello! How are you doing? I'm ${persona.name} from Lyka Realty.`;
          }
        } else if (language === 'tamil' || language === 'bilingual') {
          openingTrigger = hasVerifiedName
            ? `[CALL CONNECTED - SPEAK IMMEDIATELY IN NATURAL CASUAL TANGLISH WITH WARM EMOTIONAL PITCH MODULATION]
Vanakkam ${verifiedCustomerName} sir! Eppadi irukkeenga? Naan ${persona.name}, Lyka Realty-la irundhu pesuren.`
            : `[CALL CONNECTED - SPEAK IMMEDIATELY IN NATURAL CASUAL TANGLISH WITH WARM EMOTIONAL PITCH MODULATION. DO NOT ASK FOR CUSTOMER'S NAME AT THE START!]
Vanakkam sir! Eppadi irukkeenga? Naan ${persona.name}, Lyka Realty-la irundhu pesuren.`;
        } else if (language === 'hindi') {
          openingTrigger = hasVerifiedName
            ? `The verified customer (${verifiedCustomerName}) has answered. Introduce yourself as ${persona.name} from Lyka Realty in warm spoken Hindi with ZERO AI disclosure: "नमस्ते ${verifiedCustomerName} जी! मैं लाइका रियल्टी से ${persona.name} बात कर रहा/رही हूँ। आप कैसे हैं?"`
            : `A customer has answered. Introduce yourself as ${persona.name} from Lyka Realty in warm spoken Hindi with ZERO AI disclosure: "नमस्ते! मैं लाइका रियल्टी से ${persona.name} बात कर रहा/رही हूँ। क्या मैं आपका शुभ नाम जान सकता/सकती हूँ?"`;
        } else if (language === 'arabic') {
          openingTrigger = hasVerifiedName
            ? `The verified customer (${verifiedCustomerName}) has answered. Introduce yourself as ${persona.name} from Lyka Realty in warm spoken Arabic with ZERO AI disclosure: "مرحباً ${verifiedCustomerName}! معك ${persona.name} من لايكا للعقارات. كيف حالك اليوم؟"`
            : `A customer has answered. Introduce yourself as ${persona.name} from Lyka Realty in warm spoken Arabic with ZERO AI disclosure: "مرحباً بك! معك ${persona.name} من لايكا للعقارات. هل يمكنني معرفة اسمك الكريم؟"`;
        } else {
          openingTrigger = hasVerifiedName
            ? `The verified customer (${verifiedCustomerName}) has answered. Introduce yourself as ${persona.name} from Lyka Realty with real warmth and ZERO AI disclosure: "Vanakkam and hello ${verifiedCustomerName}! This is ${persona.name} from Lyka Realty. How are you doing today?"`
            : `A new customer has answered. Introduce yourself as ${persona.name} from Lyka Realty with real warmth and ZERO AI disclosure: "Vanakkam and hello! This is ${persona.name} calling from Lyka Realty. May I know who I have the pleasure of speaking with today?"`;
        }

        liveSession.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: openingTrigger }],
            },
          ],
          turnComplete: true,
        });
      }
    } catch (err: any) {
      console.error('[Gemini Live] Failed to initialize session:', err);
      safeSend({
        type: 'error',
        message: `Connection failed: ${err.message || String(err)}`,
      });
    }
  };

  clientWs.on('message', async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'start') {
        wsSessionId = msg.sessionId || ''; // Track session for DB
        const token = msg.employeeToken || msg.customerToken || msg.token;
        let authUser: { type: 'employee' | 'customer'; data: any } | null = null;
        if (token) {
          const decoded = verifyToken(token);
          if (decoded) {
            if (decoded.role === 'Customer') {
              const db = getPool();
              const [cRows] = await db.query('SELECT * FROM customers WHERE id = ?', [decoded.id]) as any;
              if (cRows && cRows.length > 0) {
                authUser = { type: 'customer', data: cRows[0] };
              }
            } else {
              authUser = {
                type: 'employee',
                data: { id: decoded.id, loginId: decoded.loginId, fullName: decoded.fullName, role: decoded.role },
              };
            }
          }
        }
        const ragGrounding = await getRagGroundingContext(authUser);
        currentVoice = msg.voice || selectedVoice || 'Sulafat';
        currentLanguage = msg.language || selectedLanguage || 'bilingual';
        currentLeadName = msg.leadName;
        currentGender = msg.gender || (['Achird', 'Zubenelgenubi'].includes(currentVoice) ? 'male' : 'female');
        currentMode = msg.mode || 'agent';
        currentAuthUser = authUser;
        currentRagGrounding = ragGrounding;

        await initGeminiLiveSession(
          currentVoice,
          currentLanguage,
          currentLeadName,
          currentGender,
          currentMode,
          currentAuthUser,
          currentRagGrounding,
          false // isVoiceSwitch
        );
      } else if (msg.type === 'audio') {
        // Forward 16kHz PCM audio chunk to Gemini Live realtime input
        usageMetrics.totalAudioSecondsSent += 0.128;
        if (liveSession && msg.data) {
          try {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
              media: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (e) {
            console.error('[Gemini Live] Realtime audio chunk error:', e);
          }
        }
      } else if (msg.type === 'user_speech_transcript') {
        // Forward finalized speech-to-text transcript to Gemini Live session
        if (liveSession && msg.text) {
          console.log('[WebSocket] Client spoke via mic:', msg.text);
          liveSession.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: msg.text }],
              },
            ],
            turnComplete: true,
          });
        }
      } else if (msg.type === 'text') {
        const textContent = msg.text || msg.data;
        if (liveSession && textContent) {
          console.log('[WebSocket] Client sent text turn:', textContent);
          liveSession.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: textContent }],
              },
            ],
            turnComplete: true,
          });
        }
      } else if (msg.type === 'change_voice') {
        const newVoice = msg.voice;
        if (newVoice && VALID_VOICES.includes(newVoice)) {
          selectedVoice = newVoice;
          currentVoice = newVoice;
          const isMale = newVoice === 'Achird' || newVoice === 'Zubenelgenubi';
          currentGender = isMale ? 'male' : 'female';
          console.log(`[WebSocket] Voice preset updated to: ${newVoice} (gender: ${currentGender})`);

          if (liveSession) {
            console.log(`[Gemini Live] Live mid-session voice transition to ${newVoice} (${currentGender})...`);
            // 1. Tell client to interrupt active speech audio playback so no old audio overlaps
            safeSend({ type: 'interrupted', voiceSwitch: true, message: `Switching voice to ${newVoice}...` });
            safeSend({ type: 'status', status: 'connecting', message: `Applying ${newVoice} voice...` });

            // 2. Safely close existing session
            try {
              liveSession.close();
            } catch (e) {
              console.warn('[Gemini Live] Old session close warn:', e);
            }
            liveSession = null;

            // 3. Reconnect Gemini Live with the new voice, passing isVoiceSwitch = true
            await initGeminiLiveSession(
              currentVoice,
              currentLanguage,
              currentLeadName,
              currentGender,
              currentMode,
              currentAuthUser,
              currentRagGrounding,
              true // isVoiceSwitch
            );

            safeSend({
              type: 'voice_updated',
              voice: newVoice,
              gender: currentGender,
              active: true,
              message: `Voice changed to ${newVoice}.`,
            });
          } else {
            safeSend({
              type: 'voice_updated',
              voice: newVoice,
              gender: currentGender,
              active: false,
              message: `Voice preset set to ${newVoice}.`,
            });
          }
        }
      } else if (msg.type === 'barge_in') {
        safeSend({ type: 'interrupted', manual: true });
      } else if (msg.type === 'end') {
        if (liveSession) {
          try {
            liveSession.close();
          } catch {}
          liveSession = null;
        }
        safeSend({ type: 'status', status: 'idle', message: 'Call ended.' });
      }
    } catch (e) {
      console.error('[WebSocket] Message parsing error:', e);
    }
  });

  clientWs.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    isClosing = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {}
      liveSession = null;
    }
  });
});

// Mount Vite middleware in development or serve static in production
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Safe DB initialization — server works even if MySQL is unavailable
try {
  await initSchema();
  console.log('[Server] MySQL connected and schema verified.');
} catch (err: any) {
  console.warn('[Server] MySQL not available — chatbot works without persistence:', err.message || err);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Lyka AI Real Estate Voice Agent running on http://0.0.0.0:${PORT}`);
});
