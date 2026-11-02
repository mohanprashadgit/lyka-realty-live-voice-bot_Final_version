import { normalizeLeadFields } from './utils/leadFields';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveAudioPlayer, LiveMicRecorder, getAvailableMicrophones, getAvailableSpeakers, findMatchingOutputDevice } from './utils/audio';
import { Header } from './components/Header';
import { LiveCallWorkspace } from './components/LiveCallWorkspace';
import { CrmDashboard } from './components/CrmDashboard';
import { LeadsAndCallsTab } from './components/LeadsAndCallsTab';
import { DialTab } from './components/DialTab';
import { ApiUsageTab } from './components/ApiUsageTab';
import {
  MainAppTab,
  CallStatus,
  TranscriptTurn,
  ApiUsageData,
  AudioInputDeviceInfo,
  AudioOutputDeviceInfo,
  LeadRecord,
  getAgentPersona,
} from './types/agent';
import type {
  DashboardPeriod,
  LeadsNavigationTarget,
  LeadsOutcomeFilter,
  LeadsScopeFilter,
  LeadsSourceFilter,
  LeadsView,
} from './types/navigation';

interface LykaHistoryState {
  lyka: true;
  tab: MainAppTab;
  leads: LeadsView;
  dashboardPeriod: DashboardPeriod;
}

const DEFAULT_LEADS_VIEW: LeadsView = { outcome: 'ALL', scope: 'ALL', source: 'ALL' };

export default function App() {
  // Navigation & Theme State (Defaulting to the Lyka Royal Plum & Gold theme)
  const [activeTab, setActiveTab] = useState<MainAppTab>('dashboard');
  const [leadsView, setLeadsView] = useState<LeadsView>(DEFAULT_LEADS_VIEW);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lyka_theme') as 'light' | 'dark') || 'dark';
  });

  // Call & Voice State
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [voiceState, setVoiceState] = useState<string>('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [micEnergy, setMicEnergy] = useState<number>(0);
  // Microphone input device selection (Default driver / Bluetooth / USB / Built-in)
  const [micDevices, setMicDevices] = useState<AudioInputDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<AudioOutputDeviceInfo[]>([]);
  const [selectedMicDeviceId, setSelectedMicDeviceId] = useState<string>(
    () => localStorage.getItem('lyka_mic_device') || 'default'
  );
  // Output device auto-paired to the selected mic so input + output use the SAME hardware
  const pairedOutputRef = useRef<string>('default');
  // Ref mirror of the selected mic so the mount-only device effect reads the latest value
  const selectedMicDeviceIdRef = useRef<string>(selectedMicDeviceId);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [selectedVoice, setSelectedVoice] = useState<string>('Sulafat');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('bilingual');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  // Customer / Lead Data (Never assumes or hardcodes customer name)
  const [leadData, setLeadData] = useState<any>({
    name: '',
    phone: '',
    city: '',
    location: '',
    country: '',
    property_type: '',
    budget: '',
    timeline: '',
    notes: '',
  });

  // Initial Natural Tanglish Greeting for Priya / Harish (Stages 1-2: polite introduction & asks name)
  const activePersona = getAgentPersona(gender, selectedLanguage, selectedVoice);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);

  // Streaming Turn State (Accumulates deltas in-place to eliminate duplicates!)
  const [streamingAgentTurn, setStreamingAgentTurn] = useState<{
    turnId: string;
    agentName: string;
    text: string;
  } | null>(null);

  // Interim Speech Transcript for Customer
  const [interimTranscript, setInterimTranscript] = useState<string>('');

  // API Usage Data State
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState<boolean>(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const leadSessionRef = useRef(crypto.randomUUID());
  const conversationIdRef = useRef<string | undefined>(undefined);
  const leadSaveErrorRef = useRef('');
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const recorderRef = useRef<LiveMicRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const autoEndPendingRef = useRef(false);
  const callTerminatedRef = useRef(false);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoEndSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endLiveCallRef = useRef<(() => void) | null>(null);

  // ── Sync Theme with HTML Document Element ──
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('lyka_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // ── History-backed tab navigation (browser Back restores tab + lead filters) ──
  useEffect(() => {
    const initial = window.history.state as LykaHistoryState | null;
    if (initial?.lyka) {
      setActiveTab(initial.tab || 'dashboard');
      setLeadsView({ ...DEFAULT_LEADS_VIEW, ...(initial.leads || {}) });
      setDashboardPeriod(initial.dashboardPeriod);
    } else {
      window.history.replaceState(
        { lyka: true, tab: 'dashboard', leads: DEFAULT_LEADS_VIEW, dashboardPeriod: 'today' } satisfies LykaHistoryState,
        ''
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as LykaHistoryState | null;
      if (!state?.lyka) {
        setActiveTab('dashboard');
        return;
      }
      setActiveTab(state.tab || 'dashboard');
      setLeadsView({ ...DEFAULT_LEADS_VIEW, ...(state.leads || {}) });
      setDashboardPeriod(state.dashboardPeriod);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Live Call always opens at the very top of the page
  useEffect(() => {
    if (activeTab === 'live') window.scrollTo(0, 0);
  }, [activeTab]);

  const pushNavigation = (tab: MainAppTab, leads: LeadsView, period: DashboardPeriod) => {
    const state: LykaHistoryState = { lyka: true, tab, leads, dashboardPeriod: period };
    window.history.pushState(state, '');
    setActiveTab(tab);
    setLeadsView(leads);
    setDashboardPeriod(period);
  };

  const selectTab = (tab: MainAppTab) => {
    if (tab === activeTab) {
      if (tab === 'live') window.scrollTo(0, 0);
      return;
    }
    pushNavigation(tab, leadsView, dashboardPeriod);
  };

  const updateLeadsView = (next: LeadsView) => {
    setLeadsView(next);
    if (activeTab === 'leads') {
      window.history.replaceState(
        { lyka: true, tab: activeTab, leads: next, dashboardPeriod } satisfies LykaHistoryState,
        ''
      );
    }
  };

  const handleOutcomeFilterChange = (outcome: LeadsOutcomeFilter) => {
    updateLeadsView({
      ...leadsView,
      outcome,
      scope: 'ALL',
      focusLeadId: undefined,
      focusCallId: undefined,
      focusToken: undefined,
    });
  };

  const handleScopeFilterChange = (scope: LeadsScopeFilter) => {
    updateLeadsView({
      ...leadsView,
      scope,
      outcome: 'ALL',
      focusLeadId: undefined,
      focusCallId: undefined,
      focusToken: undefined,
    });
  };

  const handleSourceFilterChange = (source: LeadsSourceFilter) => {
    updateLeadsView({
      ...leadsView,
      source,
      outcome: 'ALL',
      scope: 'ALL',
      focusLeadId: undefined,
      focusCallId: undefined,
      focusToken: undefined,
    });
  };

  const handleClearLeadsFilters = () => {
    updateLeadsView({
      ...leadsView,
      outcome: 'ALL',
      scope: 'ALL',
      source: 'ALL',
      focusLeadId: undefined,
      focusCallId: undefined,
      focusToken: undefined,
    });
  };

  const navigateToLeads = (target: LeadsNavigationTarget) => {
    const hasFocus = Boolean(target.leadId || target.callId);
    pushNavigation(
      'leads',
      {
        outcome: target.outcome ?? leadsView.outcome,
        scope: target.scope ?? leadsView.scope,
        source: target.source ?? leadsView.source,
        focusLeadId: target.leadId,
        focusCallId: target.callId,
        focusToken: hasFocus ? Date.now() : undefined,
      },
      dashboardPeriod
    );
  };

  const handleDashboardPeriodChange = (period: DashboardPeriod) => {
    setDashboardPeriod(period);
    window.history.replaceState(
      { lyka: true, tab: activeTab, leads: leadsView, dashboardPeriod: period } satisfies LykaHistoryState,
      ''
    );
  };

  const clearLeadsFocus = () => {
    setLeadsView((prev) => {
      if (!prev.focusLeadId && !prev.focusCallId) return prev;
      return { ...prev, focusLeadId: undefined, focusCallId: undefined, focusToken: undefined };
    });
  };

  // ── Enumerate Audio Input + Output Devices (Default driver, Bluetooth, USB, Built-in) ──
  useEffect(() => {
    let cancelled = false;

    const loadDevices = async () => {
      const [inputs, outputs] = await Promise.all([
        getAvailableMicrophones(),
        getAvailableSpeakers(),
      ]);
      if (cancelled) return;
      setMicDevices(inputs);
      setSpeakerDevices(outputs);

      // Re-pair the output device to the selected mic (devices may have changed)
      const selectedInput = inputs.find((d) => d.deviceId === selectedMicDeviceIdRef.current);
      const matched = findMatchingOutputDevice(selectedInput, outputs);
      pairedOutputRef.current = matched?.deviceId || 'default';
      // Apply routing live if a call is already active
      playerRef.current?.setOutputDevice(pairedOutputRef.current);
    };

    loadDevices();

    // Refresh list when devices are plugged in / connected / disconnected (e.g. Bluetooth pairing)
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    // Labels are only exposed after mic permission is granted — rescan once on first grant
    const handlePermissionRefresh = () => loadDevices();
    window.addEventListener('lyka:mic-ready', handlePermissionRefresh);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      window.removeEventListener('lyka:mic-ready', handlePermissionRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref of the selected mic so the (mount-only) device effect can read the latest value
  useEffect(() => {
    selectedMicDeviceIdRef.current = selectedMicDeviceId;
  }, [selectedMicDeviceId]);

  // ── Persist + apply selected microphone & route OUTPUT to the SAME device ──
  const handleMicDeviceChange = (deviceId: string) => {
    setSelectedMicDeviceId(deviceId);
    localStorage.setItem('lyka_mic_device', deviceId);
    selectedMicDeviceIdRef.current = deviceId;

    // Input: switch the live mic capture
    recorderRef.current?.switchDevice(deviceId);

    // Output: pair the speaker of the same physical device (groupId / name match)
    const selectedInput = micDevices.find((d) => d.deviceId === deviceId);
    const matched = findMatchingOutputDevice(selectedInput, speakerDevices);
    const outId = matched?.deviceId || 'default';
    pairedOutputRef.current = outId;
    playerRef.current?.setOutputDevice(outId);
  };

  // When gender switches, update initial greeting if it's the only turn
  const handleGenderChange = (newGender: 'female' | 'male') => {
    setGender(newGender);
    const defaultVoice = newGender === 'female' ? 'Sulafat' : 'Puck';
    setSelectedVoice(defaultVoice);
    const newPersona = getAgentPersona(newGender, selectedLanguage, defaultVoice);

    setTranscript((prev) => {
      if (prev.length <= 1 && prev[0]?.id === 'turn-init') {
        const greetingText = leadData.name
          ? `Hello ${leadData.name} sir! Naan ${newPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga?`
          : `Hello sir! Naan ${newPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga?`;
        return [
          {
            id: 'turn-init',
            speaker: 'agent',
            role: 'agent',
            agentName: newPersona.name,
            text: greetingText,
            timestamp: new Date().toISOString(),
            timeFormatted: '00:00',
            isComplete: true,
          },
        ];
      }
      return prev;
    });

    // Notify backend WebSocket if session is live
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'change_voice',
          voice: defaultVoice,
          gender: newGender,
        })
      );
    }
  };

  const handleVoiceChange = (newVoice: string) => {
    setSelectedVoice(newVoice);
    const isMale = newVoice === 'Puck' || newVoice === 'Achird' || newVoice === 'Zubenelgenubi';
    const resolvedGender: 'female' | 'male' = isMale ? 'male' : 'female';
    setGender(resolvedGender);
    const resolvedPersona = getAgentPersona(resolvedGender, selectedLanguage, newVoice);

    setTranscript((prev) => {
      if (prev.length <= 1 && prev[0]?.id === 'turn-init') {
        const greetingText = leadData.name
          ? `Hello ${leadData.name} sir! Naan ${resolvedPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga?`
          : `Hello sir! Naan ${resolvedPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga?`;
        return [
          {
            id: 'turn-init',
            speaker: 'agent',
            role: 'agent',
            agentName: resolvedPersona.name,
            text: greetingText,
            timestamp: new Date().toISOString(),
            timeFormatted: '00:00',
            isComplete: true,
          },
        ];
      }
      return prev;
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'change_voice',
          voice: newVoice,
          gender: resolvedGender,
        })
      );
    }
  };

  // ── Check Server Health & Gemini API Configuration on Mount ──
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus(data.hasApiKey ? 'ok' : 'error');
        if (!data.hasApiKey) {
          setErrorMsg('Gemini API key not configured on server.');
        }
      })
      .catch(() => {
        setServerStatus('error');
        setErrorMsg('Unable to connect to Lyka Realty backend server.');
      });
  }, []);

  // ── Fetch API Usage Data ──
  const fetchUsageData = useCallback((probe = false) => {
    setIsUsageLoading(true);
    fetch(`/api/usage${probe ? '?probe=true' : ''}`)
      .then((r) => r.json())
      .then((data) => setUsageData(data))
      .catch((err) => console.error('Failed to fetch usage data:', err))
      .finally(() => setIsUsageLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsageData();
    }
  }, [activeTab, fetchUsageData]);

  // ── Call Duration Timer ──
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // ── Auto-end once the agent's closing audio has finished playing ──
  const clearAutoEndTimers = () => {
    if (autoEndTimerRef.current) {
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }
    if (autoEndSafetyRef.current) {
      clearTimeout(autoEndSafetyRef.current);
      autoEndSafetyRef.current = null;
    }
  };

  const cancelAutoEnd = () => {
    autoEndPendingRef.current = false;
    clearAutoEndTimers();
  };

  const finishLiveCallAfterPlayback = () => {
    if (!autoEndPendingRef.current || callTerminatedRef.current) return;
    if (playerRef.current?.isPlaying) return;
    autoEndPendingRef.current = false;
    clearAutoEndTimers();
    endLiveCallRef.current?.();
  };

  const scheduleAutoEndCheck = (delayMs: number) => {
    if (!autoEndPendingRef.current || callTerminatedRef.current) return;
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = setTimeout(() => {
      autoEndTimerRef.current = null;
      finishLiveCallAfterPlayback();
    }, delayMs);
  };

  const armAutoEndAfterGoodbye = () => {
    if (callTerminatedRef.current || autoEndPendingRef.current) return;
    autoEndPendingRef.current = true;
    clearAutoEndTimers();
    // Absolute safety net: never leave the line open if playback state stalls.
    autoEndSafetyRef.current = setTimeout(() => {
      autoEndSafetyRef.current = null;
      if (!autoEndPendingRef.current || callTerminatedRef.current) return;
      autoEndPendingRef.current = false;
      endLiveCallRef.current?.();
    }, 30000);
    if (!playerRef.current?.isPlaying) scheduleAutoEndCheck(600);
  };

  // ── Start Live Call Flow ──
  const startLiveCall = async () => {
    if (callStatus === 'connected' || callStatus === 'calling') return;
    setErrorMsg('');
    setCallStatus('calling');
    setVoiceState('connecting');
    setCallDuration(0);
    setTranscript([]);
    setStreamingAgentTurn(null);
    setInterimTranscript('');
    cancelAutoEnd();
    callTerminatedRef.current = false;

    try {
      // 1. Initialize Audio Player
      playerRef.current = new LiveAudioPlayer(
        (playing) => {
          if (playing) {
            setVoiceState('speaking');
            recorderRef.current?.setAgentSpeaking(true);
            // New audio started: defer the auto-end until this playback drains too.
            if (autoEndTimerRef.current) {
              clearTimeout(autoEndTimerRef.current);
              autoEndTimerRef.current = null;
            }
          } else {
            setVoiceState('listening');
            recorderRef.current?.setAgentSpeaking(false);
            if (autoEndPendingRef.current) scheduleAutoEndCheck(300);
          }
          setAudioEnergy(playing ? 0.6 : 0);
        },
        (energy) => setAudioEnergy(energy)
      );
      // Route the agent's voice to the SAME physical device as the selected mic
      playerRef.current.setOutputDevice(pairedOutputRef.current);

      // 2. Initialize Microphone Recorder
      recorderRef.current = new LiveMicRecorder(
        (base64Chunk) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'audio', data: base64Chunk }));
          }
        },
        (energy) => setMicEnergy(energy),
        (userText, isFinal) => {
          // Local interim display for fast visual feedback
          if (!isFinal) {
            setInterimTranscript(userText);
          }
        },
        selectedLanguage === 'tamil' ? 'tamil' : 'bilingual'
      );

      const micStarted = await recorderRef.current.start(selectedMicDeviceId);
      if (!micStarted) {
        setCallStatus('error');
        setVoiceState('error');
        setErrorMsg('Microphone access denied. Please grant microphone permission in your browser.');
        return;
      }
      // Mic permission now granted — device labels are visible, refresh the picker list
      window.dispatchEvent(new Event('lyka:mic-ready'));

      // 3. Connect to WebSocket (/api/live-ws)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-ws`);
      wsRef.current = ws;

      const activeSessionId = crypto.randomUUID();
      leadSessionRef.current = activeSessionId;
      conversationIdRef.current = undefined;
      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        ws.send(
          JSON.stringify({
            type: 'start',
            sessionId: activeSessionId,
            voice: selectedVoice,
            language: selectedLanguage,
            gender: gender,
            mode: 'agent',
            leadName: leadData.name || '',
            phone: leadData.phone || '',
            notes: leadData.notes || '',
          })
        );
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setCallStatus('connected');
            setVoiceState('listening');
          } else if (msg.type === 'status') {
            if (msg.status === 'connecting') {
              setVoiceState('connecting');
            } else if (msg.status === 'closed' || msg.status === 'idle') {
              cancelAutoEnd();
              callTerminatedRef.current = true;
              playerRef.current?.stopAndClear();
              recorderRef.current?.stop();
              setStreamingAgentTurn(null);
              setInterimTranscript('');
              setCallStatus('ended');
              setVoiceState('idle');
              if (msg.message && msg.message !== 'Call ended.') {
                setErrorMsg(msg.message);
              }
            }
          } else if (msg.type === 'unwanted_speech') {
            // Server-side 3-strike guard. Strike 1/2 are handled by the voice
            // agent's spoken warning; strike 3 arrives with call_ended.
            console.warn(`[Unwanted Speech] strike ${msg.strike}/${msg.maxStrikes || 3}`, msg.text || '');
          } else if (msg.type === 'call_ended') {
            cancelAutoEnd();
            callTerminatedRef.current = true;
            playerRef.current?.stopAndClear();
            recorderRef.current?.stop();
            setStreamingAgentTurn(null);
            setInterimTranscript('');
            setCallStatus('ended');
            setVoiceState('idle');
            if (msg.reason === 'unwanted_speech') {
              setErrorMsg('Call ended: repeated unwanted/romantic speech (3 strikes).');
            } else if (msg.message) {
              setErrorMsg(msg.message);
            }
          } else if (msg.type === 'call_ending') {
            // The agent finished a closing turn. Wait until its audio has fully
            // played (onPlayStateChange:false) before hanging up.
            armAutoEndAfterGoodbye();
          } else if (msg.type === 'audio') {
            playerRef.current?.playChunk(msg.data);
          } else if (msg.type === 'agent_transcript_delta') {
            // A new agent turn means the previous closing no longer applies.
            cancelAutoEnd();
            // Streaming delta for active agent turn — update in place without duplicate rows!
            setTranscript((prev) => prev.filter((t) => t.id !== 'turn-init'));
            setStreamingAgentTurn({
              turnId: msg.turnId,
              agentName: msg.agentName || (gender === 'male' ? 'Harish' : 'Priya'),
              text: msg.accumulated || msg.delta,
            });
            setInterimTranscript('');
          } else if (msg.type === 'turn_complete') {
            // Turn completed by model — commit once as completed turn!
            let textToCommit = (msg.fullText || '').trim();
            if (textToCommit) {
              const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              });
              setTranscript((prev) => {
                // If only turn-init placeholder exists, replace it
                const filtered = prev.filter((t) => t.id !== 'turn-init');
                // Deduplicate if already present by turnId
                if (msg.turnId && filtered.some((t) => t.id === msg.turnId)) return filtered;
                return [
                  ...filtered,
                  {
                    id: msg.turnId || `turn-agent-${Date.now()}`,
                    speaker: 'agent',
                    role: 'agent',
                    agentName: msg.agentName || (gender === 'male' ? 'Harish' : 'Priya'),
                    text: textToCommit,
                    timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                    timeFormatted: formattedTime,
                    isComplete: true,
                  },
                ];
              });
            }
            setStreamingAgentTurn(null);
            setInterimTranscript('');
          } else if (msg.type === 'user_transcript') {
            // Recognized customer speech from Gemini Live neural transcription
            if (msg.isFinal) {
              // The customer spoke again, so a pending goodbye is no longer final.
              cancelAutoEnd();
              const textToCommit = (msg.text || '').trim();
              if (textToCommit) {
                const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                });
                setTranscript((prev) => {
                  // Deduplicate: if this turn ID already exists, update text instead of adding
                  const turnId = msg.id || `turn-user-${Date.now()}`;
                  const exists = msg.id && prev.some((t: any) => t.id === msg.id);
                  if (exists) {
                    return prev.map((t: any) =>
                      t.id === msg.id ? { ...t, text: textToCommit } : t
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: turnId,
                      speaker: 'customer',
                      role: 'user',
                      text: textToCommit,
                      timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                      timeFormatted: formattedTime,
                      isComplete: true,
                    },
                  ];
                });
              }
              setInterimTranscript('');
            } else {
              setInterimTranscript(msg.text);
            }
          } else if (msg.type === 'lead_update') {
            if (msg.lead) setLeadData((prev: any) => ({ ...prev, ...normalizeLeadFields(msg.lead) }));
          } else if (msg.type === 'lead_save_result') {
            if (msg.sessionId && msg.sessionId !== leadSessionRef.current) return;
            if (msg.success) {
              conversationIdRef.current = msg.conversationId || conversationIdRef.current;
              setErrorMsg(prev => prev === leadSaveErrorRef.current ? '' : prev);
              leadSaveErrorRef.current = '';
              window.dispatchEvent(new Event('lyka:records-updated'));
            } else {
              leadSaveErrorRef.current = 'Lead information was captured but could not be saved. ' + (msg.error || 'Please check database availability.');
              setErrorMsg(leadSaveErrorRef.current);
            }
          } else if (msg.type === 'interrupted') {
            cancelAutoEnd();
            playerRef.current?.stopAndClear();
            setVoiceState('interrupted');
            // If there was speech before interruption, finalize it gracefully
            if (msg.textSoFar) {
              const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              });
              setTranscript((prev) => [
                ...prev.filter(t => !msg.turnId || t.id !== msg.turnId),
                {
                  id: msg.turnId || `turn-agent-${Date.now()}`,
                  speaker: 'agent',
                  role: 'agent',
                  agentName: gender === 'male' ? 'Harish' : 'Priya',
                  text: msg.textSoFar.trim(),
                  timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                  timeFormatted: formattedTime,
                  isComplete: true,
                  interrupted: true,
                },
              ]);
            }
            setStreamingAgentTurn(null);
            setTimeout(() => setVoiceState('listening'), 300);
          } else if (msg.type === 'voice_updated') {
            if (msg.voice) {
              setSelectedVoice(msg.voice);
              const isMale = msg.voice === 'Puck' || msg.voice === 'Achird' || msg.voice === 'Zubenelgenubi';
              setGender(isMale ? 'male' : 'female');
            }
            if (msg.active) {
              setVoiceState('listening');
            }
          } else if (msg.type === 'notice') {
            console.warn('[Server Notice]:', msg.message);
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Voice connection issue');
            setVoiceState('error');
            setCallStatus('error');
            playerRef.current?.stopAndClear();
            recorderRef.current?.stop();
          }
        } catch (e) {
          console.error('[LiveCall WS Parse Error]:', e);
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setCallStatus('error');
        setVoiceState('error');
        setErrorMsg('WebSocket connection failed to server.');
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        cancelAutoEnd();
        callTerminatedRef.current = true;
        setCallStatus('ended');
        setVoiceState('idle');
        recorderRef.current?.stop();
        setStreamingAgentTurn(null);
        setInterimTranscript('');
      };
    } catch (err: any) {
      setCallStatus('error');
      setVoiceState('error');
      setErrorMsg(err.message || 'Failed to start live call.');
    }
  };

  // ── Start a live call using a saved lead (Leads & Calls + Dashboard) ──
  const startCallWithLead = (lead: LeadRecord) => {
    if (lead.isOptedOut || lead.outcome === 'OPT_OUT' || lead.outcome === 'UNWANTED') {
      alert(`${lead.name || 'This lead'} is on the Do-Not-Call list. Outbound marketing calls are blocked unless the customer gives fresh permission.`);
      return;
    }
    setLeadData({
      name: lead.name,
      phone: lead.phone,
      location: lead.location,
      property_type: lead.propertyType,
      budget: lead.budget,
      timeline: lead.timeline,
    });
    selectTab('live');
    setTimeout(() => startLiveCall(), 300);
  };

  // ── End Live Call Flow ──
  const endLiveCall = () => {
    if (callTerminatedRef.current) return;
    callTerminatedRef.current = true;
    autoEndPendingRef.current = false;
    clearAutoEndTimers();
    if (streamingAgentTurn?.text) {
      const pending = streamingAgentTurn;
      setTranscript(prev => prev.some(t => t.id === pending.turnId) ? prev : [...prev, {
        id: pending.turnId, role: 'agent', speaker: 'agent', agentName: pending.agentName,
        text: pending.text, timestamp: new Date().toISOString(), isComplete: true, interrupted: true,
      }]);
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    playerRef.current?.close();
    playerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;

    setCallStatus('ended');
    setVoiceState('idle');
    setAudioEnergy(0);
    setMicEnergy(0);
    setStreamingAgentTurn(null);
    setInterimTranscript('');
  };

  useEffect(() => {
    endLiveCallRef.current = endLiveCall;
  });

  // ── Barge-In / Interrupt AI Speech ──
  const interruptAiSpeech = () => {
    playerRef.current?.stopAndClear();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'barge_in' }));
    }
    setVoiceState('listening');
  };

  // ── Toggle Microphone Mute ──
  const toggleMic = () => {
    if (recorderRef.current) {
      const nextMuted = !isMicMuted;
      setIsMicMuted(nextMuted);
      recorderRef.current.setMuted(nextMuted);
    }
  };

  // ── Send Typed Text Turn ──
  const sendTypedText = async (text: string) => {
    if (!text.trim()) return;

    const userText = text.trim();
    const formattedTime = new Date().toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    });

    // Add user turn to transcript immediately
    const userTurn: TranscriptTurn = {
      id: `turn-user-${Date.now()}`,
      speaker: 'customer',
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
      timeFormatted: formattedTime,
      isComplete: true,
    };
    setTranscript((prev) => [...prev, userTurn]);
    setInterimTranscript('');

    // If WebSocket is open and connected, forward text directly to Gemini Live
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', id: userTurn.id, data: userText }));
      setVoiceState('thinking');
      return;
    }

    // Otherwise use /api/chat fallback
    try {
      setVoiceState('thinking');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userText }],
          language: selectedLanguage === 'tamil' ? 'tamil' : 'bilingual',
          gender: gender,
          voice: selectedVoice,
        }),
      });
      const data = await response.json();
      if (data.message) {
        const replyTime = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
        setTranscript((prev) => [
          ...prev,
          {
            id: `turn-agent-${Date.now()}`,
            speaker: 'agent',
            role: 'agent',
            agentName: activePersona.name,
            text: data.message,
            timestamp: new Date().toISOString(),
            timeFormatted: replyTime,
            isComplete: true,
          },
        ]);
      }
      setVoiceState('idle');
    } catch (e) {
      console.error('Chat error:', e);
      setVoiceState('idle');
    }
  };

  // ── Save Operator Edits to Lead Data ──
  const updateLeadData = async (updated: any) => {
    setLeadData(updated);
    try {
      const response = await fetch('/api/lead/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: leadSessionRef.current, conversationId: conversationIdRef.current, leadData: normalizeLeadFields(updated) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Lead save failed');
      window.dispatchEvent(new Event('lyka:records-updated'));
      return true;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Lead save failed');
      return false;
    }
  };

  return (
    <div className={`lyka-app min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200`}>
      {/* ── Top Header Navigation Bar ── */}
      <Header
        activeTab={activeTab}
        onSelectTab={selectTab}
        callStatus={callStatus}
        callDuration={callDuration}
        selectedVoice={selectedVoice}
        onVoiceChange={handleVoiceChange}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        agentGender={gender}
        agentName={activePersona.name}
        theme={theme}
        onToggleTheme={toggleTheme}
        micDevices={micDevices}
        selectedMicDeviceId={selectedMicDeviceId}
        onMicDeviceChange={handleMicDeviceChange}
      />

      {/* ── Main Tab View Area ── */}
      <main className="pb-12">
        {activeTab === 'dashboard' && (
          <CrmDashboard
            onStartCallWithLead={startCallWithLead}
            onOpenQueue={() => navigateToLeads({})}
            onOpenLogs={() => navigateToLeads({})}
            onNavigateLeads={navigateToLeads}
            period={dashboardPeriod}
            onPeriodChange={handleDashboardPeriodChange}
          />
        )}

        {activeTab === 'live' && (
          <LiveCallWorkspace
            callStatus={callStatus}
            callDuration={callDuration}
            voiceState={voiceState}
            isMicMuted={isMicMuted}
            micEnergy={micEnergy}
            audioEnergy={audioEnergy}
            selectedVoice={selectedVoice}
            selectedLanguage={selectedLanguage}
            gender={gender}
            onGenderChange={handleGenderChange}
            onVoiceChange={handleVoiceChange}
            onLanguageChange={setSelectedLanguage}
            onToggleMic={toggleMic}
            onStartCall={startLiveCall}
            onEndCall={endLiveCall}
            onInterrupt={interruptAiSpeech}
            onSendText={sendTypedText}
            transcript={transcript}
            streamingAgentTurn={streamingAgentTurn}
            interimTranscript={interimTranscript}
            leadData={leadData}
            onUpdateLeadData={updateLeadData}
            errorMsg={errorMsg}
            serverStatus={serverStatus}
          />
        )}

        {activeTab === 'leads' && (
          <LeadsAndCallsTab
            onStartCallWithLead={startCallWithLead}
            outcomeFilter={leadsView.outcome}
            scopeFilter={leadsView.scope}
            sourceFilter={leadsView.source}
            onOutcomeFilterChange={handleOutcomeFilterChange}
            onScopeFilterChange={handleScopeFilterChange}
            onSourceFilterChange={handleSourceFilterChange}
            onClearFilters={handleClearLeadsFilters}
            focusLeadId={leadsView.focusLeadId}
            focusCallId={leadsView.focusCallId}
            focusToken={leadsView.focusToken}
            onFocusConsumed={clearLeadsFocus}
          />
        )}

        {activeTab === 'dial' && (
          <DialTab
            onStartBrowserCall={(num) => {
              setLeadData((prev: any) => ({ ...prev, phone: num }));
              selectTab('live');
              setTimeout(() => startLiveCall(), 300);
            }}
            onStartTwilioCall={(num) => {
              fetch('/api/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: num }),
              })
                .then((r) => r.json())
                .then((d) => alert(`Twilio outbound call placed! Call SID: ${d.callSid || 'Connected'}`))
                .catch((e) => alert(`Twilio call error: ${e.message}`));
            }}
          />
        )}

        {activeTab === 'usage' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ApiUsageTab
              usageData={usageData}
              onRefresh={() => fetchUsageData(true)}
              isLoading={isUsageLoading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
