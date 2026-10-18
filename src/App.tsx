import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveAudioPlayer, LiveMicRecorder } from './utils/audio';
import { Header } from './components/Header';
import { LiveCallWorkspace } from './components/LiveCallWorkspace';
import { LeadsAndCallsTab } from './components/LeadsAndCallsTab';
import { DialTab } from './components/DialTab';
import { ApiUsageTab } from './components/ApiUsageTab';
import {
  MainAppTab,
  CallStatus,
  TranscriptTurn,
  ApiUsageData,
  getAgentPersona,
} from './types/agent';

export default function App() {
  // Navigation & Theme State (Defaulting to clean Light mode per Stitch design)
  const [activeTab, setActiveTab] = useState<MainAppTab>('live');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lyka_theme') as 'light' | 'dark') || 'light';
  });

  // Call & Voice State
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [voiceState, setVoiceState] = useState<string>('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [micEnergy, setMicEnergy] = useState<number>(0);
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
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([
    {
      id: 'turn-init',
      speaker: 'agent',
      role: 'agent',
      agentName: 'Priya',
      text: 'Vanakkam sir! Naan Lyka Realty-la irundhu Priya pesuren. Unga name therinjukkalama sir?',
      timestamp: new Date().toISOString(),
      timeFormatted: '00:00',
      isComplete: true,
    },
  ]);

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
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const recorderRef = useRef<LiveMicRecorder | null>(null);
  const timerRef = useRef<any>(null);

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

  // When gender switches, update initial greeting if it's the only turn
  const handleGenderChange = (newGender: 'female' | 'male') => {
    setGender(newGender);
    const defaultVoice = newGender === 'female' ? 'Sulafat' : 'Zubenelgenubi';
    setSelectedVoice(defaultVoice);
    const newPersona = getAgentPersona(newGender, selectedLanguage, defaultVoice);

    setTranscript((prev) => {
      if (prev.length <= 1 && prev[0]?.id === 'turn-init') {
        const greetingText = leadData.name
          ? `Vanakkam ${leadData.name} sir! Naan ${newPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga sir?`
          : `Vanakkam sir! Naan ${newPersona.name}, Lyka Realty-la irundhu pesuren. Unga name therinjukkalama sir?`;
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
    const isMale = newVoice === 'Achird' || newVoice === 'Zubenelgenubi';
    const resolvedGender: 'female' | 'male' = isMale ? 'male' : 'female';
    setGender(resolvedGender);
    const resolvedPersona = getAgentPersona(resolvedGender, selectedLanguage, newVoice);

    setTranscript((prev) => {
      if (prev.length <= 1 && prev[0]?.id === 'turn-init') {
        const greetingText = leadData.name
          ? `Vanakkam ${leadData.name} sir! Naan ${resolvedPersona.name}, Lyka Realty-la irundhu pesuren. Eppadi irukkeenga sir?`
          : `Vanakkam sir! Naan ${resolvedPersona.name}, Lyka Realty-la irundhu pesuren. Unga name therinjukkalama sir?`;
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
  const fetchUsageData = useCallback(() => {
    setIsUsageLoading(true);
    fetch('/api/usage')
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

  // ── Start Live Call Flow ──
  const startLiveCall = async () => {
    if (callStatus === 'connected' || callStatus === 'calling') return;
    setErrorMsg('');
    setCallStatus('calling');
    setVoiceState('connecting');
    setCallDuration(0);
    setStreamingAgentTurn(null);
    setInterimTranscript('');

    try {
      // 1. Initialize Audio Player
      playerRef.current = new LiveAudioPlayer(
        (playing) => {
          if (playing) {
            setVoiceState('speaking');
            recorderRef.current?.setAgentSpeaking(true);
          } else {
            setVoiceState('listening');
            recorderRef.current?.setAgentSpeaking(false);
          }
          setAudioEnergy(playing ? 0.6 : 0);
        },
        (energy) => setAudioEnergy(energy)
      );

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

      const micStarted = await recorderRef.current.start();
      if (!micStarted) {
        setCallStatus('error');
        setVoiceState('error');
        setErrorMsg('Microphone access denied. Please grant microphone permission in your browser.');
        return;
      }

      // 3. Connect to WebSocket (/api/live-ws)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            voice: selectedVoice,
            language: selectedLanguage,
            gender: gender,
            mode: 'agent',
            leadName: leadData.name || '',
            notes: leadData.notes || '',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setCallStatus('connected');
            setVoiceState('listening');
          } else if (msg.type === 'status') {
            if (msg.status === 'connecting') {
              setVoiceState('connecting');
            }
          } else if (msg.type === 'audio') {
            playerRef.current?.playChunk(msg.data);
          } else if (msg.type === 'agent_transcript_delta') {
            // Streaming delta for active agent turn — update in place without duplicate rows!
            setStreamingAgentTurn({
              turnId: msg.turnId,
              agentName: msg.agentName || (gender === 'male' ? 'Harish' : 'Priya'),
              text: msg.accumulated || msg.delta,
            });
            setInterimTranscript('');
          } else if (msg.type === 'turn_complete') {
            // Turn completed by model — commit once as completed turn!
            const textToCommit = (msg.fullText || '').trim();
            if (textToCommit) {
              const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              });
              setTranscript((prev) => {
                // Deduplicate if already present
                if (msg.turnId && prev.some((t) => t.id === msg.turnId)) return prev;
                return [
                  ...prev,
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
              const textToCommit = (msg.text || '').trim();
              if (textToCommit) {
                const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                });
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `turn-user-${Date.now()}`,
                    speaker: 'customer',
                    role: 'user',
                    text: textToCommit,
                    timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
                    timeFormatted: formattedTime,
                    isComplete: true,
                  },
                ]);
              }
              setInterimTranscript('');
            } else {
              setInterimTranscript(msg.text);
            }
          } else if (msg.type === 'lead_update') {
            if (msg.lead) {
              setLeadData((prev: any) => ({
                ...prev,
                name: msg.lead.name?.value || msg.lead.name || prev.name,
                customer_name_raw: msg.lead.customer_name_raw?.value || msg.lead.customer_name_raw || msg.lead.name?.value || msg.lead.name || prev.customer_name_raw,
                customer_preferred_name: msg.lead.customer_preferred_name?.value || msg.lead.customer_preferred_name || prev.customer_preferred_name,
                phone: msg.lead.phone?.value || msg.lead.phone || prev.phone,
                location: msg.lead.location?.value || msg.lead.location || prev.location,
                property_type: msg.lead.property_type?.value || msg.lead.property_type || prev.property_type,
                budget: msg.lead.budget?.value || msg.lead.budget || prev.budget,
                timeline: msg.lead.timeline?.value || msg.lead.timeline || prev.timeline,
              }));
            }
          } else if (msg.type === 'interrupted') {
            playerRef.current?.stopAndClear();
            setVoiceState('interrupted');
            // If there was speech before interruption, finalize it gracefully
            if (msg.textSoFar) {
              const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                minute: '2-digit',
                second: '2-digit',
              });
              setTranscript((prev) => [
                ...prev,
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
              const isMale = msg.voice === 'Achird' || msg.voice === 'Zubenelgenubi';
              setGender(isMale ? 'male' : 'female');
            }
            if (msg.active) {
              setVoiceState('listening');
            }
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Voice connection issue');
            setVoiceState('error');
          }
        } catch (e) {
          console.error('[LiveCall WS Parse Error]:', e);
        }
      };

      ws.onerror = () => {
        setCallStatus('error');
        setVoiceState('error');
        setErrorMsg('WebSocket connection failed to server.');
      };

      ws.onclose = () => {
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

  // ── End Live Call Flow ──
  const endLiveCall = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
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
      wsRef.current.send(JSON.stringify({ type: 'text', data: userText }));
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
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200`}>
      {/* ── Top Header Navigation Bar ── */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
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
        serverStatus={serverStatus}
      />

      {/* ── Main Tab View Area ── */}
      <main className="pb-12">
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
          />
        )}

        {activeTab === 'leads' && (
          <LeadsAndCallsTab
            onStartCallWithLead={(lead) => {
              setLeadData({
                name: lead.name,
                phone: lead.phone,
                location: lead.location,
                property_type: lead.propertyType,
                budget: lead.budget,
                timeline: lead.timeline,
              });
              setActiveTab('live');
              setTimeout(() => startLiveCall(), 300);
            }}
          />
        )}

        {activeTab === 'dial' && (
          <DialTab
            onStartBrowserCall={(num) => {
              setLeadData((prev: any) => ({ ...prev, phone: num }));
              setActiveTab('live');
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
              onRefresh={fetchUsageData}
              isLoading={isUsageLoading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
