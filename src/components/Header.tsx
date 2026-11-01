import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  Phone,
  Zap,
  Sun,
  Moon,
  Monitor,
  Mic,
  Bluetooth,
} from 'lucide-react';
import { CallStatus, MainAppTab, AudioInputDeviceInfo } from '../types/agent';

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
  micDevices?: AudioInputDeviceInfo[];
  selectedMicDeviceId?: string;
  onMicDeviceChange?: (deviceId: string) => void;
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
  micDevices = [],
  selectedMicDeviceId = 'default',
  onMicDeviceChange,
}) => {
  const isCallActive = callStatus !== 'idle' && callStatus !== 'ended' && callStatus !== 'error';
  const effectiveAgentName = agentName || (agentGender === 'male' ? 'Harish' : 'Priya');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 xl:max-w-none xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-4">
        {/* Brand & Identity matching Stitch design specifications */}
        <div className="flex items-center gap-3 xl:min-w-0 xl:justify-self-start">
          <button
            type="button"
            onClick={() => onSelectTab('live')}
            title="Lyka Realty — open Live call"
            aria-label="Lyka Realty — open Live call"
            className="shrink-0 flex items-center rounded-lg bg-slate-800 dark:bg-slate-900 p-1 shadow-sm ring-1 ring-slate-900/10 dark:ring-white/5 hover:bg-slate-700 dark:hover:bg-slate-850 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <img
              src="/logo.png"
              alt="Lyka Realty"
              draggable={false}
              className="h-8 w-auto object-contain select-none"
            />
          </button>

          <div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
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
        <nav
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs [scrollbar-width:none] dark:bg-slate-800 max-lg:w-full xl:justify-self-center [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-violet-600" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onSelectTab('live')}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
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
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
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
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
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
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
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
        <div className="flex items-center gap-2.5 max-md:w-full xl:min-w-0 xl:justify-end">
          {/* Responsive screen badge matching screenshot */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 text-[11px] font-mono xl:shrink-0">
            <Monitor className="w-3 h-3 text-slate-400" />
            <span>Desktop</span>
          </div>

          {/* ── Microphone Input Device Selector (Default / Bluetooth / USB / Built-in) ── */}
          <div
            className="relative flex items-center max-md:flex-1 xl:min-w-0"
            title="Select microphone input device"
          >
            <Mic className="pointer-events-none absolute left-2.5 w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMicDeviceId}
              onChange={(e) => onMicDeviceChange?.(e.target.value)}
              className="appearance-none pl-8 pr-7 py-1.5 max-w-[210px] max-md:max-w-none max-md:w-full truncate rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-200 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors cursor-pointer xl:min-w-0"
            >
              {micDevices.length === 0 && (
                <option value="default">Default Microphone</option>
              )}
              {micDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.isDefault ? 'Default' : d.isBluetooth ? 'Bluetooth' : 'Mic'} — {d.label}
                </option>
              ))}
            </select>
            {/* Bluetooth indicator dot */}
            {micDevices.some((d) => d.deviceId === selectedMicDeviceId && d.isBluetooth) && (
              <Bluetooth className="pointer-events-none absolute right-7 w-3 h-3 text-sky-500" />
            )}
            {/* Dropdown caret */}
            <svg
              className="pointer-events-none absolute right-2 w-3 h-3 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer xl:shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

        </div>
      </div>
    </header>
  );
};
