import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Radio,
} from 'lucide-react';
import { CallStatus } from '../types/agent';

interface CallControlsProps {
  callStatus: CallStatus;
  isMicMuted: boolean;
  onToggleMic: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onSendText: (text: string) => void;
  onTriggerBargeIn: () => void;
  micEnergy: number;
  selectedLanguage: string;
}

const QUICK_PROMPTS = [
  {
    label: '✓ ஆமா, நான்தான் மோகன் பேசுறேன்',
    text: 'ஆமா, நான் மோகன் தான் பேசறேன், சொல்லுங்க.',
  },
  {
    label: 'தமிழ்: 3BHK பிளாட் 1.5 கோடி',
    text: 'வணக்கம், நான் முதல் முறையா வீடு வாங்க போறேன், சென்னை அண்ணா நகர்ல 3BHK பிளாட் பட்ஜெட் 1.5 கோடி, அடுத்த 2 மாசத்துல வேணும்.',
  },
  {
    label: 'தமிழ்: தனி வில்லா முதலீடு 2 கோடி',
    text: 'நாங்க முதலீட்டுக்காக தனி வில்லா பார்க்கிறோம், பட்ஜெட் 2 கோடி.',
  },
  {
    label: 'தமிழ்: 2 மணி நேரம் கழிச்சு கூப்பிடுங்க',
    text: 'நான் தம்பி பேசுறேன். அண்ணன் வெளிய போயிருக்காரு, ஒரு 2 மணி நேரம் கழிச்சு கூப்பிடுங்க திரும்ப பேசலாம்.',
  },
  {
    label: 'தமிழ்: இப்போதைக்கு வேண்டாம்',
    text: 'இப்போதைக்கு வீடு வாங்குற எண்ணம் இல்லைங்க, வேண்டாம் நன்றி.',
  },
  {
    label: 'EN: Yes, speaking',
    text: 'Yes, speaking. What is this call regarding?',
  },
  {
    label: 'EN: 3BHK Flat $800k in 2 months',
    text: "I'm a first-time buyer looking for a 3BHK apartment for around $800k within 60 days.",
  },
];

export const CallControls: React.FC<CallControlsProps> = ({
  callStatus,
  isMicMuted,
  onToggleMic,
  onStartCall,
  onEndCall,
  onSendText,
  onTriggerBargeIn,
  micEnergy,
  selectedLanguage,
}) => {
  const [inputText, setInputText] = useState('');
  const isCallActive = callStatus !== 'idle' && callStatus !== 'ended' && callStatus !== 'error';

  // Press Enter when idle to trigger start call
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCallActive && e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        onStartCall();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCallActive, onStartCall]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm">
      {/* Primary Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {!isCallActive ? (
            <button
              onClick={onStartCall}
              title="Click or Press Enter to start browser test call"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-slate-950" />
              <span>
                {selectedLanguage === 'tamil' ? 'அழைக்க (Enter ↵)' : 'Start Call (Enter ↵)'}
              </span>
            </button>
          ) : (
            <button
              onClick={onEndCall}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          )}

          {/* Mic Mute Button */}
          <button
            onClick={onToggleMic}
            disabled={!isCallActive}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              !isCallActive
                ? 'opacity-40 bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                : isMicMuted
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-emerald-400'
            }`}
          >
            {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isMicMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Simple Mic Volume Meter */}
          {isCallActive && !isMicMuted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono">MIC</span>
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(10, micEnergy * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Interrupt Button */}
        {isCallActive && (
          <button
            onClick={onTriggerBargeIn}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Interrupt / Speak</span>
          </button>
        )}
      </div>

      {/* Quick Test Responses */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] text-slate-400 mr-1">Quick Test:</span>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSendText(p.text)}
            disabled={!isCallActive}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Clean text chat input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isCallActive
              ? "Type response in English or தமிழ் (or talk into your mic)..."
              : "Click 'Start Call' to begin..."
          }
          disabled={!isCallActive}
          className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isCallActive || !inputText.trim()}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
