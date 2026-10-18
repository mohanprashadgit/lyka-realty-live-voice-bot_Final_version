import React, { useState } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  Info,
  Globe,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface DialTabProps {
  onStartBrowserCall?: (number: string) => void;
  onStartTwilioCall?: (number: string) => void;
}

export const DialTab: React.FC<DialTabProps> = ({
  onStartBrowserCall,
  onStartTwilioCall,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [callMode, setCallMode] = useState<'browser' | 'twilio'>('browser');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const dialKeys = [
    { num: '1', sub: '' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  const handleKeyPress = (char: string) => {
    setPhoneNumber((prev) => prev + char);
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleStartCall = () => {
    const fullNumber = `${countryCode}${phoneNumber}`;
    setCallStatus('calling');
    if (callMode === 'browser') {
      setTimeout(() => setCallStatus('connected'), 1000);
      if (onStartBrowserCall) onStartBrowserCall(fullNumber);
    } else {
      if (onStartTwilioCall) onStartTwilioCall(fullNumber);
    }
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
      setDuration(0);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Distinction Banner: Real Telephone vs Browser Voice */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Telephony Call Architecture &amp; Provider Distinction
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Lyka Realty clearly distinguishes between <strong>Browser Web Audio voice</strong> (low-latency direct Gemini Live conversation over your microphone) and <strong>Real Outbound PSTN Telephone calls</strong> (placed via configured Twilio telephony server).
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => setCallMode('browser')}
            className={`p-3 rounded-xl border text-left transition-all ${
              callMode === 'browser'
                ? 'bg-violet-50/70 dark:bg-violet-950/40 border-violet-500 ring-1 ring-violet-500'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-violet-500" />
                <span>Browser Voice Session (Gemini Live)</span>
              </span>
              {callMode === 'browser' && <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Speaks through your browser tab at 24kHz using Gemini Live native audio. Ideal for laptop demos and customer consultations.
            </p>
          </button>

          <button
            onClick={() => setCallMode('twilio')}
            className={`p-3 rounded-xl border text-left transition-all ${
              callMode === 'twilio'
                ? 'bg-violet-50/70 dark:bg-violet-950/40 border-violet-500 ring-1 ring-violet-500'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                <span>Real Outbound Phone Call (Twilio PSTN)</span>
              </span>
              {callMode === 'twilio' && <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dials actual physical phone numbers over public mobile carrier networks (India +91 or UAE +971) with server-side media streaming.
            </p>
          </button>
        </div>
      </div>

      {/* Keypad Chassis */}
      <div className="max-w-sm mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        {/* Destination Number Display */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="text-xs font-semibold px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
            >
              <option value="+91">🇮🇳 +91 (India)</option>
              <option value="+971">🇦🇪 +971 (Dubai/UAE)</option>
              <option value="+1">🇺🇸 +1 (USA)</option>
              <option value="+44">🇬🇧 +44 (UK)</option>
              <option value="+65">🇸🇬 +65 (Singapore)</option>
            </select>

            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter phone number..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full text-base font-mono font-bold tracking-wider px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
              {phoneNumber && (
                <button
                  onClick={handleDelete}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <Delete className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] text-center text-slate-400 font-mono pt-1">
            {callStatus === 'calling'
              ? 'Ringing destination...'
              : callStatus === 'connected'
              ? 'Call Connected • 00:14'
              : callStatus === 'ended'
              ? 'Call Ended'
              : 'Ready to dial'}
          </div>
        </div>

        {/* 12-Button Keypad Grid */}
        <div className="grid grid-cols-3 gap-3">
          {dialKeys.map((k) => (
            <button
              key={k.num}
              onClick={() => handleKeyPress(k.num)}
              className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono leading-none">
                {k.num}
              </span>
              {k.sub && (
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider mt-0.5">
                  {k.sub}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Call Controls: Dial & End */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {callStatus !== 'connected' && callStatus !== 'calling' ? (
            <button
              onClick={handleStartCall}
              disabled={!phoneNumber.trim()}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <PhoneCall className="w-5 h-5" />
              <span>Call {countryCode} {phoneNumber || '...'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isMuted ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={handleEndCall}
                className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Hang Up</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
