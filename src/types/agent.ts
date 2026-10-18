export type LeadQualificationStatus = 'HOT' | 'WARM' | 'COLD' | 'PENDING' | 'REACH_AGAIN' | 'OPT_OUT';

export interface LeadData {
  name?: string;
  customer_name_raw?: string;
  customer_preferred_name?: string;
  phone?: string;
  email?: string;
  lead_source?: string;
  intent?: string;
  preferred_contact_method?: string;
  best_time_to_contact?: string;
  interest: string;
  buyer_type: string;
  property_type: string;
  budget: string;
  currency?: string;
  location: string;
  city?: string;
  country?: string;
  timeline: string;
  qualification_status: LeadQualificationStatus;
  score?: number;
  stage_reached: number;
  notes?: string;
  updated_at?: string;
}

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'interrupted'
  | 'ended'
  | 'error';

export interface TranscriptTurn {
  id?: string;
  role?: 'agent' | 'user' | 'system';
  speaker?: 'agent' | 'customer';
  agentName?: string;
  text: string;
  timestamp: string;
  timeFormatted?: string;
  isStreaming?: boolean;
  isComplete?: boolean;
  stage?: number;
  interrupted?: boolean;
  latencyMs?: number;
}

export interface AgentPersona {
  id: string;
  name: string;
  gender: 'female' | 'male';
  language: 'tamil' | 'english' | 'hindi' | 'arabic' | 'bilingual';
  title: string;
  voiceId: 'Sulafat' | 'Callirrhoe' | 'Aoede' | 'Achird' | 'Zubenelgenubi';
  tagline: string;
}

export const SUPPORTED_VOICES: Array<{ id: string; name: string; gender: 'female' | 'male'; tone: string; description: string }> = [
  { id: 'Sulafat', name: 'Sulafat (Default)', gender: 'female', tone: 'Expressive Tanglish, lively pitch variation & warm conversational rhythm', description: 'Primary female reference voice preset for Lyka Realty' },
  { id: 'Callirrhoe', name: 'Callirrhoe', gender: 'female', tone: 'Warm adult conversational delivery, empathetic & friendly', description: 'Female relationship manager' },
  { id: 'Aoede', name: 'Aoede', gender: 'female', tone: 'Warm adult conversational delivery, flexible pitch & engaging tone', description: 'Female portfolio manager' },
  { id: 'Achird', name: 'Achird', gender: 'male', tone: 'Natural male character, confident Tanglish conversation & pauses', description: 'Male portfolio executive' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Preferred Male)', gender: 'male', tone: 'Natural male character, emotional variation & clear emphasis', description: 'Primary male reference voice preset for Lyka Realty' },
];

export function getAgentPersona(gender: 'female' | 'male', language: string = 'bilingual', voiceId?: string): AgentPersona {
  const isFemale = gender === 'female';
  const resolvedVoice = (voiceId as any) || (isFemale ? 'Sulafat' : 'Zubenelgenubi');

  if (isFemale) {
    return {
      id: 'priya-realty',
      name: 'Priya',
      gender: 'female',
      language: (language as any) || 'bilingual',
      title: 'Senior Property Relationship Manager',
      voiceId: resolvedVoice,
      tagline: 'Vanakkam! Naan Lyka Realty-la irundhu Priya pesuren.',
    };
  } else {
    return {
      id: 'harish-realty',
      name: 'Harish',
      gender: 'male',
      language: (language as any) || 'bilingual',
      title: 'Senior Property Portfolio Executive',
      voiceId: resolvedVoice,
      tagline: 'Vanakkam! Naan Lyka Realty-la irundhu Harish pesuren.',
    };
  }
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  tone: string;
  description?: string;
}

export interface LanguageOption {
  id: string;
  name: string;
  desc: string;
}

export interface AudioInputDeviceInfo {
  deviceId: string;
  label: string;
  isBluetooth: boolean;
  isDefault: boolean;
}

export type LeadCallStatus =
  | 'NOT_CALLED'
  | 'CALLING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'NO_ANSWER'
  | 'REACH_AGAIN'
  | 'FAILED';

export type LeadOutcome =
  | 'HOT'
  | 'WARM'
  | 'COLD'
  | 'OPT_OUT'
  | 'NO_ANSWER'
  | 'WRONG_NUMBER'
  | 'REACH_AGAIN'
  | 'PENDING';

export interface LeadScoreFactor {
  factor: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface LeadScoreBreakdown {
  score: number;
  temperature: 'HOT' | 'WARM' | 'COLD';
  factors: LeadScoreFactor[];
  reasons: string[];
  missingInformation: string[];
  nextAction: string;
}

export interface LeadRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  consent: boolean;
  callStatus: LeadCallStatus;
  outcome?: LeadOutcome;
  score?: number;
  scoreBreakdown?: LeadScoreBreakdown;
  interest?: string;
  buyerType?: string;
  propertyType?: string;
  budget?: string;
  currency?: string;
  location?: string;
  country?: string;
  timeline?: string;
  lastCalledAt?: string;
  createdAt: string;
  notes?: string;
  isOptedOut?: boolean;
}

export type FieldStatus = 'unknown' | 'extracted' | 'confirmed';

export interface LeadField {
  value: string | null;
  status: FieldStatus;
}

export interface LeadInfo {
  name: LeadField;
  phone: LeadField;
  email: LeadField;
  lead_source: LeadField;
  intent: LeadField;
  interest: LeadField;
  buyer_type: LeadField;
  property_type: LeadField;
  location: LeadField;
  country: LeadField;
  state_province: LeadField;
  city: LeadField;
  budget: LeadField;
  currency: LeadField;
  rental_period: LeadField;
  property_size: LeadField;
  area_unit: LeadField;
  bedrooms: LeadField;
  bathrooms: LeadField;
  amenities: LeadField;
  timeline: LeadField;
  notes: LeadField;
  qualification_status: LeadField;
}

export interface CallRecord {
  callId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  channel?: 'browser' | 'twilio' | 'simulation';
  startedAt: string;
  endedAt: string;
  duration: number; // in seconds
  callStatus: LeadCallStatus;
  interest: string;
  buyerType: string;
  propertyType: string;
  budget: string;
  location: string;
  timeline: string;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'opt_out';
  outcome: LeadOutcome;
  score?: number;
  summary: string;
  transcript: TranscriptTurn[];
  nextAction: string;
}

export interface DashboardStats {
  totalLeads: number;
  callsMade: number;
  callsConnected: number;
  noAnswer: number;
  interested: number;
  notInterested: number;
  hot: number;
  warm: number;
  cold: number;
  reachAgain: number;
  optOut: number;
  answerRate: number;
  interestedRate: number;
  qualificationRate: number;
  hotLeadRate: number;
}

export interface ApiUsageData {
  provider: string;
  model: string;
  tier: string;
  quotaStatus: 'HEALTHY' | 'WARNING' | 'EXHAUSTED';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  audioInputSeconds: number;
  audioOutputSeconds: number;
  estimatedCostUsd: number;
  actualBilledCostNote: string;
  daily: {
    limit: number;
    used: number;
    remaining: number;
    percentUsed: number;
    nextRefillIso: string;
    secondsUntilRefill: number;
    refillPolicy: string;
  };
  rateLimit: {
    minuteLimit: number;
    usedThisMinute: number;
    remainingThisMinute: number;
    secondsUntilMinuteRefill: number;
    refillPolicy: string;
  };
  activity: {
    totalRequestsAllTime: number;
    totalSessions: number;
    totalTurns: number;
    totalToolCalls: number;
    totalAudioMinutesStreamed: number;
    audioSecondsSent: number;
    audioSecondsReceived: number;
    lastRequestTime: string;
  };
  timestamp: string;
}

export type MainAppTab = 'live' | 'leads' | 'dial' | 'usage';
