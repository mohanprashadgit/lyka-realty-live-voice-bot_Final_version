import React from 'react';
import {
  PhoneCall,
  Users,
  Phone,
  Zap,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { CallStatus, MainAppTab } from '../types/agent';

interface HeaderProps {
  activeTab: MainAppTab;
  onSelectTab: (tab: MainAppTab) => void;
  callStatus: CallStatus;
  callDuration: number;
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  selectedLanguage: string;
  onLanguageChange: (langId: string) => void;
  agentGender?: 'female' | 'male';
  agentName?: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  serverStatus: 'checking' | 'ok' | 'error';
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  callStatus,
  callDuration,
  selectedVoice,
  onVoiceChange,
  selectedLanguage,
  onLanguageChange,
  agentGender = 'female',
  agentName,
  theme,
  onToggleTheme,
  serverStatus,
}) => {
  const isCallActive = callStatus !== 'idle' && callStatus !== 'ended' && callStatus !== 'error';
  const effectiveAgentName = agentName || (agentGender === 'male' ? 'Harish' : 'Priya');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity matching Stitch design specifications */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center p-1 font-bold font-serif text-sm shadow-sm ring-1 ring-slate-900/10">
            <span>Lyka</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-none">
                Voice Calling Agent
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60">
                AI Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Agent <strong className="text-slate-800 dark:text-slate-200 font-semibold">{effectiveAgentName}</strong> ({agentGender === 'male' ? 'Male' : 'Female'}) · Voice: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedVoice}</span>
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs (Pills) matching reference screenshot */}
        <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => onSelectTab('live')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-violet-600" />
            <span>Live call</span>
          </button>

          <button
            onClick={() => onSelectTab('leads')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Leads &amp; calls</span>
          </button>

          <button
            onClick={() => onSelectTab('dial')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'dial'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            <span>Dial</span>
          </button>

          <button
            onClick={() => onSelectTab('usage')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'usage'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>API Usage</span>
          </button>
        </nav>

        {/* Right Area: Screen indicator, Theme toggle, Status dot */}
        <div className="flex items-center gap-2.5">
          {/* Responsive screen badge matching screenshot */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 text-[11px] font-mono">
            <Monitor className="w-3 h-3 text-slate-400" />
            <span>Desktop</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Connection status dot */}
          <div className="flex items-center gap-1.5 pl-1">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus === 'ok'
                  ? 'bg-emerald-500 animate-pulse'
                  : serverStatus === 'checking'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              {serverStatus === 'ok' ? 'Ready' : 'Checking'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
