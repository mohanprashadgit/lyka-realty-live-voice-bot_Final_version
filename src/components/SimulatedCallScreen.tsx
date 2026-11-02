import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  User,
  ShieldCheck,
  Building2,
  Clock,
  Sparkles,
  Flame,
  SunMedium,
  Snowflake,
  ShieldBan,
  ArrowLeft,
  Radio,
  CheckCircle2,
  Smartphone,
  Laptop,
  Settings,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import {
  LeadRecord,
  LeadData,
  CallStatus,
  TranscriptTurn,
  LeadOutcome,
  CallRecord,
} from '../types/agent';
import { StageTracker } from './StageTracker';
import { TranscriptView } from './TranscriptView';
import { CallControls } from './CallControls';
import { LeadPanel } from './LeadPanel';

interface SimulatedCallScreenProps {
  lead: LeadRecord;
  leadData: LeadData;
  callStatus: CallStatus;
  callDuration: number;
  turns: TranscriptTurn[];
  isAgentSpeaking: boolean;
  agentAudioEnergy: number;
  micEnergy: number;
  isMicMuted: boolean;
  selectedLanguage: string;
  onToggleMic: () => void;
  onStartCall: () => void;
  onEndCall: (reason?: string) => void;
  onSendText: (text: string) => void;
  onTriggerBargeIn: () => void;
  onResetLead: () => void;
  onApplyPreset: (preset: Partial<LeadData>) => void;
  onReturnToDashboard: () => void;
  lastOutcomeResult?: {
    outcome: LeadOutcome;
    summary: string;
    nextAction: string;
  } | null;
  onOpenTwilioConfig: () => void;
  genderVoice?: 'female' | 'male';
  onGenderVoiceChange?: (gender: 'female' | 'male') => void;
  onLanguageChange?: (lang: string) => void;
  onRealCallSaved?: (record: CallRecord) => void;
  initialCallMode?: 'browser' | 'twilio';
}

export const SimulatedCallScreen: React.FC<SimulatedCallScreenProps> = ({
  lead,
  leadData,
  callStatus,
  callDuration,
  turns,
  isAgentSpeaking,
  agentAudioEnergy,
  micEnergy,
  isMicMuted,
  selectedLanguage,
  genderVoice = 'female',
  onGenderVoiceChange,
  onLanguageChange,
  onToggleMic,
  onStartCall,
  onEndCall,
  onSendText,
  onTriggerBargeIn,
  onResetLead,
  onApplyPreset,
  onReturnToDashboard,
  lastOutcomeResult,
  onOpenTwilioConfig,
  onRealCallSaved,
  initialCallMode = 'browser',
}) => {
  // Mode: Browser voice simulator vs Real Outbound Phone Call via Twilio
  const [callMode, setCallMode] = useState<'browser' | 'twilio'>(initialCallMode);

  useEffect(() => {
    if (initialCallMode) {
      setCallMode(initialCallMode);
    }
  }, [initialCallMode, lead.id]);

  // Real Twilio Outbound State
  const [targetPhone, setTargetPhone] = useState(lead.phone);
  const [targetLeadName, setTargetLeadName] = useState(lead.name);
  const [twilioCallSid, setTwilioCallSid] = useState<string | null>(null);
  const [twilioStatus, setTwilioStatus] = useState<string>('idle');
  const [twilioDuration, setTwilioDuration] = useState<number>(0);
  const [twilioTranscript, setTwilioTranscript] = useState<TranscriptTurn[]>([]);
  const [twilioError, setTwilioError] = useState<string | null>(null);
  const [isDialingTwilio, setIsDialingTwilio] = useState(false);

  const pollingIntervalRef = useRef<any>(null);

  // Sync phone and name when lead changes
  useEffect(() => {
    setTargetPhone(lead.phone);
    setTargetLeadName(lead.name);
  }, [lead]);

  // Helper to format phone with country code
  const formatPhoneNumber = (val: string): string => {
    const trimmed = val.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) {
      if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return `+91${digits}`;
      }
      return `+${digits}`;
    }
    if (digits.length === 10) {
      if (/^[6-9]/.test(digits)) return `+91${digits}`;
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return digits ? `+${digits}` : '';
  };

  // Handle Real Outbound Phone Call via Twilio
  const handleStartRealPhoneCall = async () => {
    const cleanPhone = formatPhoneNumber(targetPhone);
    if (!cleanPhone) {
      setTwilioError('Please enter a destination phone number.');
      return;
    }
    setTargetPhone(cleanPhone);

    try {
      setIsDialingTwilio(true);
      setTwilioError(null);
      setTwilioStatus('initiating');
      setTwilioTranscript([]);
      setTwilioDuration(0);

      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          leadName: targetLeadName.trim() || 'Valued Lead',
          gender: genderVoice,
          language: selectedLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place call via Twilio');
      }

      setTwilioCallSid(data.callSid);
      setTwilioStatus(data.status || 'initiated');

      // Start status polling
      startPollingTwilioStatus(data.callSid);
    } catch (err: any) {
      console.error('[Twilio Call Error]:', err);
      setTwilioError(err.message || 'Call failed');
      setTwilioStatus('failed');
    } finally {
      setIsDialingTwilio(false);
    }
  };

  const startPollingTwilioStatus = (sid: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/twilio/call/${sid}`);
        if (res.ok) {
          const callData = await res.json();
          setTwilioStatus(callData.status);
          if (callData.duration) setTwilioDuration(callData.duration);
          if (callData.transcript && callData.transcript.length > 0) {
            setTwilioTranscript(callData.transcript);
          }

          // If call ended, stop polling and save call log
          if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callData.status)) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;

            if (onRealCallSaved) {
              const outcomeVal = (callData.outcome as LeadOutcome) || (callData.status === 'completed' ? 'COLD' : 'NO_ANSWER');
              const realRecord: CallRecord = {
                callId: sid,
                leadId: lead.id,
                leadName: targetLeadName,
                leadPhone: targetPhone,
                startedAt: callData.startedAt || new Date().toISOString(),
                endedAt: callData.endedAt || new Date().toISOString(),
                duration: callData.duration || 0,
                callStatus: callData.status === 'completed' ? 'COMPLETED' : 'FAILED',
                interest: callData.slots?.interest || 'Inquired',
                buyerType: callData.slots?.buyerType || '',
                propertyType: callData.slots?.propertyType || '',
                budget: callData.slots?.budget || '',
                location: callData.slots?.location || '',
                timeline: callData.slots?.timeline || '',
                sentiment: outcomeVal === 'HOT' ? 'positive' : 'neutral',
                outcome: outcomeVal,
                summary: callData.summary || `Real Twilio phone call to ${targetLeadName} completed (${callData.duration || 0}s).`,
                transcript: callData.transcript || [],
                nextAction: callData.nextAction || 'Sales specialist follow-up',
              };
              onRealCallSaved(realRecord);
            }
          }
        }
      } catch (e) {
        console.error('[Polling Error]:', e);
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const isBrowserConnecting = callStatus === 'connecting';
  const isBrowserConnected =
    callStatus === 'connected' ||
    callStatus === 'speaking' ||
    callStatus === 'listening' ||
    callStatus === 'interrupted';
  const isBrowserEnded = callStatus === 'ended' || callStatus === 'error';

  return (
    <div className="space-y-4">
      {/* Top Mode Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Back & Lead Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onReturnToDashboard}
              title="Return to Dashboard"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (callStatus === 'idle' || callStatus === 'ended') {
                  onStartCall();
                }
              }}
              title="Click logo to start call"
              className="w-10 h-10 rounded-xl bg-amber-500/15 hover:bg-emerald-500/20 border border-amber-500/30 hover:border-emerald-500/40 flex items-center justify-center text-amber-400 hover:text-emerald-400 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <User className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">{lead.name}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {lead.phone}
                </span>
                {lead.consent && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Consented</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Channel: <strong className="text-slate-300">{lead.source}</strong> &bull; Executive:{' '}
                <strong className="text-amber-400">
                  {genderVoice === 'female'
                    ? selectedLanguage === 'tamil'
                      ? 'Lyka'
                      : 'Stella'
                    : selectedLanguage === 'tamil'
                    ? 'Vinakya Mahadev'
                    : 'Stark'}
                </strong>{' '}
                ({selectedLanguage})
              </p>
            </div>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setCallMode('browser')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  callMode === 'browser'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Browser Test</span>
              </button>

              <button
                onClick={() => setCallMode('twilio')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  callMode === 'twilio'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Real Phone Call (Twilio)</span>
              </button>
            </div>

            {callMode === 'twilio' && (
              <button
                onClick={onOpenTwilioConfig}
                title="Configure Twilio Phone Number & Credentials"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-400 border border-slate-700 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Browser Test Info Bar */}
        {callMode === 'browser' && (
          <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span>Vivo Mobile Outbound Browser Test</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">10s Pick-up Timer</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Full-screen smartphone UI &bull; Vivo ringtone melody &bull; Greet &amp; verify prospect identity &bull; Auto-miss on 10s timeout
                </p>
              </div>
            </div>
            {(callStatus === 'idle' || callStatus === 'ended') && (
              <button
                onClick={onStartCall}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial Browser Test (Vivo Screen)</span>
              </button>
            )}
          </div>
        )}

        {/* Real Phone Call Configuration Bar (Shown when in Twilio Mode) */}
        {callMode === 'twilio' && (
          <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-3.5 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-rose-400" />
                <span>Twilio PSTN Calling Engine</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Caller ID: Twilio Voice • Recipient: Real Mobile
              </span>
            </div>

            {/* Quick Fill Verified Trial Number */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <span className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Twilio Verified Destination: <strong>+919944406813</strong></span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setTargetPhone('+919944406813');
                  setTargetLeadName('Mohan Prashad');
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer transition-all shadow-sm active:scale-95"
              >
                Auto-Fill My Phone (+919944406813)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[11px] text-slate-400 font-medium mb-1">
                  Destination Mobile Number (E.164 format):
                </label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  onBlur={() => {
                    if (targetPhone.trim()) {
                      setTargetPhone(formatPhoneNumber(targetPhone));
                    }
                  }}
                  placeholder="+919944406813"
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] text-slate-400 font-medium mb-1">
                  Lead Name:
                </label>
                <input
                  type="text"
                  value={targetLeadName}
                  onChange={(e) => setTargetLeadName(e.target.value)}
                  placeholder="Lead Name"
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  onClick={handleStartRealPhoneCall}
                  disabled={isDialingTwilio || ['in-progress', 'ringing', 'initiating'].includes(twilioStatus)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>
                    {isDialingTwilio
                      ? 'Dialing...'
                      : ['in-progress', 'ringing', 'initiating'].includes(twilioStatus)
                      ? 'Call Active'
                      : 'Dial Real Phone'}
                  </span>
                </button>
              </div>
            </div>

            {/* Trial Account Warning if user enters an unverified number */}
            {targetPhone.trim() && !targetPhone.includes('9944406813') && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between gap-2">
                <span>
                  ⚠️ Note: On Twilio Trial accounts, only your verified number (<strong>+919944406813</strong>) will ring.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetPhone('+919944406813');
                    setTargetLeadName('Mohan Prashad');
                  }}
                  className="underline text-amber-200 font-semibold shrink-0 cursor-pointer"
                >
                  Switch to +919944406813
                </button>
              </div>
            )}

            {/* Twilio Status Display */}
            {twilioStatus !== 'idle' && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  {twilioStatus === 'initiating' && (
                    <span className="flex items-center gap-1.5 text-amber-400 font-semibold animate-pulse">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Twilio Initiating Outbound Call...</span>
                    </span>
                  )}
                  {twilioStatus === 'ringing' && (
                    <span className="flex items-center gap-1.5 text-purple-400 font-semibold animate-pulse">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Mobile Phone is Ringing 🔔...</span>
                    </span>
                  )}
                  {twilioStatus === 'in-progress' && (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Call Answered &amp; Connected! AI Speaking ({formatTime(twilioDuration)})</span>
                    </span>
                  )}
                  {twilioStatus === 'completed' && (
                    <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Call Completed Successfully ({formatTime(twilioDuration)})</span>
                    </span>
                  )}
                  {['busy', 'no-answer', 'failed', 'canceled'].includes(twilioStatus) && (
                    <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Call {twilioStatus}</span>
                    </span>
                  )}
                </div>

                {twilioCallSid && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    SID: {twilioCallSid.slice(0, 10)}...
                  </span>
                )}
              </div>
            )}

            {/* Twilio Error Banner */}
            {twilioError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-rose-200">Unable to Place Outbound Twilio Call</div>
                    <p className="leading-relaxed">{twilioError}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
                  <button
                    onClick={onOpenTwilioConfig}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Configure Twilio Settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post-Call Outcome Summary Banner if Ended */}
      {isBrowserEnded && lastOutcomeResult && callMode === 'browser' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Call Completed &amp; Qualification Stored
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Classified Result:</span>
              {lastOutcomeResult.outcome === 'HOT' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>HOT LEAD</span>
                </span>
              )}
              {lastOutcomeResult.outcome === 'WARM' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 flex items-center gap-1">
                  <SunMedium className="w-3.5 h-3.5" />
                  <span>WARM LEAD</span>
                </span>
              )}
              {lastOutcomeResult.outcome === 'COLD' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 flex items-center gap-1">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>COLD LEAD</span>
                </span>
              )}
              {lastOutcomeResult.outcome === 'OPT_OUT' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 flex items-center gap-1">
                  <ShieldBan className="w-3.5 h-3.5" />
                  <span>OPT-OUT (DNC)</span>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-900 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-medium">
            {lastOutcomeResult.summary}
          </p>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400">
              Next Action: <strong className="text-emerald-400">{lastOutcomeResult.nextAction}</strong>
            </span>
            <button
              onClick={onReturnToDashboard}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
            >
              Return to Leads Table →
            </button>
          </div>
        </div>
      )}

      {/* 5-Stage Qualification Tracker */}
      <StageTracker lead={leadData} />

      {/* 2-Column Grid: Conversation + Lead Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Column: Real-time Transcript & Voice Controls */}
        <div className="md:col-span-7 flex flex-col space-y-3">
          <TranscriptView
            turns={callMode === 'twilio' && twilioTranscript.length > 0 ? twilioTranscript : turns}
            isAgentSpeaking={callMode === 'twilio' ? twilioStatus === 'in-progress' : isAgentSpeaking}
            agentAudioEnergy={callMode === 'twilio' ? 0.6 : agentAudioEnergy}
          />

          {callMode === 'browser' ? (
            <CallControls
              callStatus={callStatus}
              isMicMuted={isMicMuted}
              onToggleMic={onToggleMic}
              onStartCall={onStartCall}
              onEndCall={() => onEndCall()}
              onSendText={onSendText}
              onTriggerBargeIn={onTriggerBargeIn}
              micEnergy={micEnergy}
              selectedLanguage={selectedLanguage}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-rose-400" />
                <span>Twilio Live Phone Audio Stream Active</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                PSTN mu-law 8kHz ↔ Gemini Live 24kHz
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Lead Information Panel */}
        <div className="md:col-span-5">
          <LeadPanel
            lead={leadData}
            onResetLead={onResetLead}
            onApplyPreset={onApplyPreset}
          />
        </div>
      </div>
    </div>
  );
};
