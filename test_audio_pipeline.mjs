import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🔍 Testing Voice Agent Audio Pipeline...\n');

console.log('Test 1: API Key Configuration');
console.log('API Key:', GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 15)}...` : '❌ MISSING');

if (!GEMINI_API_KEY) {
  console.error('\n❌ GEMINI_API_KEY not found in .env file!');
  process.exit(1);
}

console.log('\nTest 2: Testing Gemini Live Audio Generation');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function testAudioGeneration() {
  let session;
  let receivedSetup = false;
  let receivedAudio = false;
  
  const modelName = 'gemini-3.8-live';
  
  try {
    console.log(`Connecting with model: ${modelName}...`);
    
    session = await ai.live.connect({
      model: modelName,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
      callbacks: {
        onopen: () => {
          console.log('✅ WebSocket opened');
        },
        onmessage: (msg) => {
          console.log('📨 Message keys:', Object.keys(msg).join(', '));
          
          if (msg.setupComplete) {
            console.log('✅ Setup complete!');
            receivedSetup = true;
            
            console.log('Sending test message...');
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: 'Say hello in one word' }] }],
              turnComplete: true,
            });
          }
          
          if (msg.serverContent) {
            const { modelTurn, outputTranscription, turnComplete } = msg.serverContent;
            
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.inlineData?.data) {
                  console.log('✅ Audio chunk received!', part.inlineData.data.length, 'bytes');
                  receivedAudio = true;
                } else if (part.text) {
                  console.log('📝 Text:', part.text);
                }
              }
            }
            
            if (outputTranscription?.text) {
              console.log('📝 Transcription:', outputTranscription.text);
            }
            
            if (turnComplete) {
              console.log('✅ Turn complete!');
              
              if (receivedAudio) {
                console.log('\n✅ SUCCESS! Voice agent is generating audio!');
                session.close();
                process.exit(0);
              } else {
                console.log('\n⚠️  No audio received - only text response');
                session.close();
                process.exit(1);
              }
            }
          }
        },
        onerror: (err) => {
          console.error('❌ Error:', err);
          if (session) session.close();
          process.exit(1);
        },
        onclose: (event) => {
          console.log('🔌 Closed. Code:', event?.code, 'Reason:', event?.reason);
          
          if (!receivedSetup) {
            console.error('\n❌ Connection closed before setup.');
            console.error('Error reason:', event?.reason);
            process.exit(1);
          }
        },
      },
    });
    
    console.log('✅ Connection initiated...');
    
    setTimeout(() => {
      if (!receivedSetup) {
        console.error('\n❌ Timeout waiting for setup');
        if (session) session.close();
        process.exit(1);
      }
    }, 15000);
    
  } catch (err) {
    console.error('❌ Failed:', err.message);
    if (session) session.close();
    process.exit(1);
  }
}

testAudioGeneration();
