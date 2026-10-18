import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Radio,
  Clock,
  Volume2,
  AlertCircle,
  Pause,
  Sliders,
  Activity,
  CheckCircle2,
  Headphones,
  User,
  Shield,
  Zap,
  CheckCheck,
  Bot,
  Sparkles,
  Move3d,
} from 'lucide-react';
import { CallStatus, TranscriptTurn, SUPPORTED_VOICES, getAgentPersona } from '../types/agent';
import { renderHighlightedText } from '../utils/highlightKeywords';

interface LiveCallWorkspaceProps {
  callStatus: CallStatus;
  callDuration: number;
  voiceState: string;
  isMicMuted: boolean;
  micEnergy: number;
  audioEnergy: number;
  selectedVoice: string;
  selectedLanguage: string;
  gender: 'female' | 'male';
  onGenderChange: (gender: 'female' | 'male') => void;
  onVoiceChange: (voice: string) => void;
  onLanguageChange: (lang: string) => void;
  onToggleMic: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onInterrupt: () => void;
  onSendText: (text: string) => void;
  transcript: TranscriptTurn[];
  streamingAgentTurn?: { turnId: string; agentName: string; text: string } | null;
  interimTranscript?: string;
  leadData: any;
  onUpdateLeadData: (updated: any) => Promise<boolean>;
  errorMsg?: string;
}

export const LiveCallWorkspace: React.FC<LiveCallWorkspaceProps> = ({
  callStatus,
  callDuration,
  voiceState,
  isMicMuted,
  micEnergy,
  audioEnergy,
  selectedVoice,
  selectedLanguage,
  gender,
  onGenderChange,
  onVoiceChange,
  onLanguageChange,
  onToggleMic,
  onStartCall,
  onEndCall,
  onInterrupt,
  onSendText,
  transcript,
  streamingAgentTurn,
  interimTranscript,
  leadData,
  onUpdateLeadData,
  errorMsg,
}) => {
  const [inputText, setInputText] = useState('');
  const [leadName, setLeadName] = useState(leadData?.name || '');
  const [leadPhone, setLeadPhone] = useState(leadData?.phone || '');
  const [leadCity, setLeadCity] = useState(leadData?.city || leadData?.location || '');
  const [callReason, setCallReason] = useState(leadData?.property_type || '');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [callId] = useState(() => `call-${Math.random().toString(36).substring(2, 8)}-${Math.random().toString(36).substring(2, 6)}`);

  // Voice Sample Preview (TTS Audition) State — isolated from live call audio
  const [previewPlayingVoice, setPreviewPlayingVoice] = useState<string | null>(null);
  const [previewLoadingVoice, setPreviewLoadingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop any active preview playback on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleTogglePreview = async (voiceId: string) => {
    // If this voice is currently playing, stop it
    if (previewPlayingVoice === voiceId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewPlayingVoice(null);
      return;
    }

    // If another voice is playing, stop it immediately first
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewPlayingVoice(null);
    setPreviewError(null);
    setPreviewLoadingVoice(voiceId);

    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.audioDataUrl) {
        throw new Error(data.error || `Failed to generate sample for ${voiceId}`);
      }

      const audio = new Audio(data.audioDataUrl);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setPreviewPlayingVoice(null);
        previewAudioRef.current = null;
      };

      audio.onerror = () => {
        setPreviewPlayingVoice(null);
        setPreviewError(`Failed to play sample for ${voiceId}`);
        previewAudioRef.current = null;
      };

      setPreviewLoadingVoice(null);
      setPreviewPlayingVoice(voiceId);
      await audio.play();
    } catch (err: any) {
      console.error('[Voice Preview Error]:', err);
      setPreviewLoadingVoice(null);
      setPreviewPlayingVoice(null);
      setPreviewError(err?.message || `Could not load sample for ${voiceId}`);
      setTimeout(() => setPreviewError(null), 5000);
    }
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive 3D Globe Physics and Rotation State
  const mouseRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    rotX: number;
    rotY: number;
    velX: number;
    velY: number;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    rotX: 0.22,
    rotY: 0,
    velX: 0,
    velY: 0.005,
  });

  const isCallActive = callStatus !== 'idle' && callStatus !== 'ended' && callStatus !== 'error';
  const persona = getAgentPersona(gender, selectedLanguage, selectedVoice);

  // Sync state if external lead updates
  useEffect(() => {
    if (leadData?.name && leadData.name !== leadName) setLeadName(leadData.name);
    if (leadData?.phone && leadData.phone !== leadPhone) setLeadPhone(leadData.phone);
    if (leadData?.location && leadData.location !== leadCity) setLeadCity(leadData.location);
  }, [leadData]);

  // Enhanced 3D Interactive Celestial Particle Orb (Stitch Celestial Void)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // 1. Fibonacci Sphere Lattice (200 particles)
    const sphereCount = 200;
    const sphereParticles = Array.from({ length: sphereCount }, (_, i) => {
      const y = 1 - (i / (sphereCount - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963229728653; // Golden angle
      return {
        x: Math.cos(phi) * radiusAtY,
        y: y,
        z: Math.sin(phi) * radiusAtY,
        baseR: 66,
        phase: i * 0.18,
        size: Math.random() * 1.5 + 0.9,
      };
    });

    // 2. Concentric Celestial Orbital Rings
    const ring1Count = 64; // Equatorial ring inclined 22 deg
    const ring1 = Array.from({ length: ring1Count }, (_, i) => {
      const angle = (i / ring1Count) * Math.PI * 2;
      const r = 92;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const tilt = 0.38; // ~22 deg
      return {
        x: x,
        y: z * Math.sin(tilt),
        z: z * Math.cos(tilt),
        phase: angle,
        size: 1.1,
      };
    });

    const ring2Count = 48; // Polar ring inclined -40 deg
    const ring2 = Array.from({ length: ring2Count }, (_, i) => {
      const angle = (i / ring2Count) * Math.PI * 2;
      const r = 84;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const tilt = -0.7; // ~-40 deg
      return {
        x: x * Math.cos(tilt),
        y: x * Math.sin(tilt),
        z: z,
        phase: angle,
        size: 0.9,
      };
    });

    // 3. Ambient Floating Cosmic Stardust (40 particles)
    const stardust = Array.from({ length: 40 }, () => ({
      x: (Math.random() - 0.5) * 220,
      y: (Math.random() - 0.5) * 220,
      size: Math.random() * 1.2 + 0.4,
      alpha: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.02 + 0.01,
    }));

    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Dynamic energy intensity based on agent voice state & mic
      const isSpeaking = voiceState === 'speaking';
      const isListening = voiceState === 'listening';
      const activeEnergy = isSpeaking ? Math.min(1.5, audioEnergy * 3.5) : isListening ? Math.min(1.2, micEnergy * 2.5) : 0;
      const energyPulse = 1 + activeEnergy * 0.35;

      // ── Ambient Coronal Aura Glow ──
      const outerR = Math.max(70, (isSpeaking ? 115 : 95) * energyPulse);
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, outerR);

      if (isSpeaking) {
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.65)'); // Luminous violet
        grad.addColorStop(0.35, 'rgba(99, 102, 241, 0.45)'); // Electric indigo
        grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)'); // Cyan flare
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (isListening) {
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.55)'); // Emerald
        grad.addColorStop(0.5, 'rgba(5, 150, 105, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, 'rgba(124, 58, 237, 0.35)'); // Gentle idle cosmic violet
        grad.addColorStop(0.6, 'rgba(79, 70, 229, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fill();

      // Coronal shockwave ripples when agent is actively speaking
      if (isSpeaking && activeEnergy > 0.12) {
        const rippleCount = 2;
        for (let rIdx = 0; rIdx < rippleCount; rIdx++) {
          const ripPhase = ((time * 1.5 + rIdx * 1.2) % 2) / 2; // 0 to 1
          const ripRadius = 55 + ripPhase * 58;
          const ripAlpha = (1 - ripPhase) * 0.45 * Math.min(1, activeEnergy);
          ctx.strokeStyle = `rgba(168, 85, 247, ${ripAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ripRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ── Floating Stardust ──
      for (const star of stardust) {
        star.y -= star.speed;
        if (star.y < -110) star.y = 110;
        const blink = Math.sin(time * 2 + star.x) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * blink * 0.5})`;
        ctx.beginPath();
        ctx.arc(cx + star.x, cy + star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Physics-based Rotation Update ──
      const m = mouseRef.current;
      if (!m.isDown) {
        m.rotY += m.velY + (isSpeaking ? 0.022 : isListening ? 0.014 : 0.007);
        m.velY *= 0.96;
        m.rotX += (0.24 - m.rotX) * 0.03;
      }

      const cosY = Math.cos(m.rotY);
      const sinY = Math.sin(m.rotY);
      const cosX = Math.cos(m.rotX);
      const sinX = Math.sin(m.rotX);

      type ProjectedItem = {
        type: 'sphere' | 'ring1' | 'ring2';
        px: number;
        py: number;
        pz: number;
        radius: number;
        color: string;
      };
      const projectedItems: ProjectedItem[] = [];

      const project3D = (x: number, y: number, z: number) => {
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;
        const fov = 260;
        const scale = fov / (fov + z2);
        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          pz: z2,
          scale,
        };
      };

      // Project Sphere Particles
      for (const p of sphereParticles) {
        let r = p.baseR;
        if (isSpeaking) {
          const wave = Math.sin(time * 7 + p.phase * 4);
          r += wave * (activeEnergy * 18) + (activeEnergy * 10);
        } else if (isListening) {
          const wave = Math.cos(time * 5 + p.phase * 3);
          r += wave * (activeEnergy * 12);
        }

        const worldX = p.x * r;
        const worldY = p.y * r;
        const worldZ = p.z * r;
        const proj = project3D(worldX, worldY, worldZ);

        if (proj.scale > 0) {
          const depthAlpha = Math.max(0.15, Math.min(1, (proj.pz + 80) / 160));
          let col = `rgba(255, 255, 255, ${depthAlpha * 0.9})`;
          if (isSpeaking) {
            col = depthAlpha > 0.6
              ? `rgba(255, 255, 255, ${depthAlpha})`
              : `rgba(192, 132, 252, ${depthAlpha * 0.95})`; // Radiant violet
          } else if (isListening) {
            col = depthAlpha > 0.6
              ? `rgba(255, 255, 255, ${depthAlpha})`
              : `rgba(52, 211, 153, ${depthAlpha * 0.95})`; // Emerald
          }

          projectedItems.push({
            type: 'sphere',
            px: proj.px,
            py: proj.py,
            pz: proj.pz,
            radius: Math.max(0.5, p.size * proj.scale * (isSpeaking ? 1.25 : 1)),
            color: col,
          });
        }
      }

      // Project Orbital Ring 1
      for (let i = 0; i < ring1.length; i++) {
        const rp = ring1[i];
        const r1Expand = isSpeaking ? 1 + activeEnergy * 0.22 : 1;
        const proj = project3D(rp.x * r1Expand, rp.y * r1Expand, rp.z * r1Expand);
        if (proj.scale > 0) {
          const depthAlpha = Math.max(0.1, Math.min(0.9, (proj.pz + 90) / 180));
          const ringCol = isSpeaking
            ? `rgba(56, 189, 248, ${depthAlpha * 0.85})` // Bright Cyan ring
            : isListening
            ? `rgba(52, 211, 153, ${depthAlpha * 0.8})`
            : `rgba(167, 139, 250, ${depthAlpha * 0.6})`;
          projectedItems.push({
            type: 'ring1',
            px: proj.px,
            py: proj.py,
            pz: proj.pz,
            radius: rp.size * proj.scale * (isSpeaking ? 1.4 : 1),
            color: ringCol,
          });
        }
      }

      // Project Orbital Ring 2
      for (let i = 0; i < ring2.length; i++) {
        const rp = ring2[i];
        const r2Expand = isSpeaking ? 1 + activeEnergy * 0.16 : 1;
        const proj = project3D(rp.x * r2Expand, rp.y * r2Expand, rp.z * r2Expand);
        if (proj.scale > 0) {
          const depthAlpha = Math.max(0.1, Math.min(0.85, (proj.pz + 80) / 160));
          const ringCol = isSpeaking
            ? `rgba(232, 121, 249, ${depthAlpha * 0.8})` // Fuchsia flare
            : `rgba(147, 197, 253, ${depthAlpha * 0.5})`;
          projectedItems.push({
            type: 'ring2',
            px: proj.px,
            py: proj.py,
            pz: proj.pz,
            radius: rp.size * proj.scale,
            color: ringCol,
          });
        }
      }

      // Depth sort back-to-front
      projectedItems.sort((a, b) => a.pz - b.pz);

      for (const item of projectedItems) {
        ctx.beginPath();
        ctx.arc(item.px, item.py, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCallActive, voiceState, audioEnergy, micEnergy]);

  // Auto-scroll transcript on new turns
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, streamingAgentTurn, interimTranscript]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  // Accurate Status Label Determination
  const getStatusBadge = () => {
    if (callStatus === 'idle') {
      return {
        label: 'Ready',
        bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        dot: 'bg-slate-400',
      };
    }
    if (callStatus === 'calling' || callStatus === 'connecting') {
      return {
        label: 'Connecting',
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500 animate-pulse',
      };
    }
    if (voiceState === 'speaking') {
      return {
        label: 'Agent Speaking',
        bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800',
        dot: 'bg-violet-500 animate-pulse',
      };
    }
    if (voiceState === 'interrupted') {
      return {
        label: 'Interrupted',
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    }
    if (voiceState === 'listening') {
      return {
        label: 'Listening',
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500 animate-pulse',
      };
    }
    if (voiceState === 'thinking') {
      return {
        label: 'Thinking',
        bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500 animate-pulse',
      };
    }
    if (callStatus === 'ended') {
      return {
        label: 'Call Ended',
        bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        dot: 'bg-slate-400',
      };
    }
    if (callStatus === 'error') {
      return {
        label: 'Error',
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500',
      };
    }
    return {
      label: 'Ready',
      bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      dot: 'bg-slate-400',
    };
  };

  const statusBadge = getStatusBadge();

  // Natural Tanglish Quick Prompt Chips for India & Dubai Real Estate
  const quickPillLines = [
    'Vanakkam! Dubai-la property investment pathi details venum.',
    'Chennai-la 3BHK flat budget 1.5 Cr, CMDA approved venum.',
    'Dubai Golden Visa real estate criteria evvalavu?',
    'Bangalore-la villa plots available irukka?',
    'WhatsApp-la brochure and payment plan anupunga.',
    'High rental yield commercial property enga irukku?',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* ── Sub-header Controls Bar matching Google Stitch specifications ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Voice Persona Selector */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">AGENT:</span>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-900">
            <button
              onClick={() => {
                onGenderChange('female');
                onVoiceChange('Sulafat');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                gender === 'female'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Priya (Female)
            </button>
            <button
              onClick={() => {
                onGenderChange('male');
                onVoiceChange('Achird');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                gender === 'male'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Harish (Male)
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px]">
            <span>Voice preset:</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {selectedVoice}
            </span>
          </div>
        </div>

        {/* Live Status Indicators matching Google Stitch */}
        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-[11px] ${statusBadge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.label}</span>
          </span>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <button
            onClick={() => setShowDiagnostics((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-all cursor-pointer ${
              showDiagnostics
                ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Toggle Technical Diagnostics"
          >
            <Sliders className="w-3 h-3" />
            <span>Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Error alert banner if any */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Optional Diagnostics Drawer */}
      {showDiagnostics && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Model Protocol</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">gemini-3.8-live / WebSocket</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Audio Pipeline</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">16kHz In · 24kHz Out (PCM)</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Preset</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">{selectedVoice} ({persona.name})</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Echo &amp; VAD Guard</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">Active (Neural Server VAD)</span>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          TWO-COLUMN WORKSPACE: LEFT COMPACT PANEL & RIGHT MAIN TRANSCRIPT
          ═════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Voice calling orb & customer controls (approx 4.5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Black Card: Celestial Interactive 3D Orb Visualizer */}
          <div className="bg-[#030712] text-white rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center relative overflow-hidden min-h-[320px] border border-slate-800 ring-1 ring-violet-500/20">
            {/* Interactive Canvas Wrapper with drag & hover */}
            <div
              className="relative group cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                mouseRef.current.isDown = true;
                mouseRef.current.startX = e.clientX;
                mouseRef.current.startY = e.clientY;
              }}
              onMouseMove={(e) => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const normY = (e.clientY - rect.top) / rect.height - 0.5;
                if (mouseRef.current.isDown) {
                  const dx = e.clientX - mouseRef.current.startX;
                  const dy = e.clientY - mouseRef.current.startY;
                  mouseRef.current.rotY += dx * 0.015;
                  mouseRef.current.rotX += dy * 0.015;
                  mouseRef.current.velY = dx * 0.002;
                  mouseRef.current.startX = e.clientX;
                  mouseRef.current.startY = e.clientY;
                } else {
                  mouseRef.current.rotX += (normY * 0.5 - mouseRef.current.rotX) * 0.04;
                }
              }}
              onMouseUp={() => {
                mouseRef.current.isDown = false;
              }}
              onMouseLeave={() => {
                mouseRef.current.isDown = false;
              }}
            >
              <canvas
                ref={canvasRef}
                width={260}
                height={260}
                className="w-56 h-56 block mx-auto transition-transform"
              />

              {/* Hover rotation prompt */}
              <div className="absolute bottom-1 inset-x-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] bg-slate-900/90 text-violet-300 px-2 py-0.5 rounded-full border border-violet-700/60 backdrop-blur-xs flex items-center gap-1 font-mono shadow-xs">
                  <Move3d className="w-3 h-3 text-cyan-400" />
                  <span>Interactive 3D Sphere · Drag to rotate</span>
                </span>
              </div>
            </div>

            {/* Dynamic Studio Audio Equalizer Spectrum */}
            <div className="flex items-center justify-center gap-1 my-2 h-6 z-10">
              {Array.from({ length: 16 }).map((_, i) => {
                const isSpeaking = voiceState === 'speaking';
                const isListening = voiceState === 'listening';
                const barHeight = isSpeaking
                  ? Math.max(4, Math.sin(i * 0.5 + Date.now() * 0.007) * 14 * (audioEnergy + 0.35) + 8)
                  : isListening
                  ? Math.max(4, Math.cos(i * 0.7 + Date.now() * 0.005) * 10 * (micEnergy + 0.25) + 6)
                  : 4;

                return (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      isSpeaking
                        ? 'bg-gradient-to-t from-violet-600 via-indigo-500 to-cyan-400 shadow-xs'
                        : isListening
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                        : 'bg-slate-700/80'
                    }`}
                    style={{ height: `${barHeight}px` }}
                  />
                );
              })}
            </div>

            {/* Status text below the orb */}
            <div className="text-center space-y-1 z-10">
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <span>
                  {isCallActive
                    ? `${persona.name} · ${statusBadge.label}`
                    : 'Ready to connect'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {isCallActive
                  ? `Active session • ${formatTime(callDuration)}`
                  : `${persona.title} · India & Dubai`}
              </p>
            </div>
          </div>

          {/* Form Below the Black Orb Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
            {/* Voice Preset Selector (Exactly 5 Selectable Presets Grouped by Gender) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-violet-500" />
                  <span>Voice Preset (5 Voices)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                    {selectedVoice} · {gender === 'female' ? 'Priya' : 'Harish'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePreview(selectedVoice)}
                    disabled={previewLoadingVoice !== null && previewLoadingVoice !== selectedVoice}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                      previewPlayingVoice === selectedVoice
                        ? 'bg-rose-500 text-white shadow-sm ring-1 ring-rose-600 animate-pulse'
                        : 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900 border border-violet-200 dark:border-violet-800'
                    }`}
                    title={previewPlayingVoice === selectedVoice ? 'Stop voice preview' : `Preview sample of ${selectedVoice}`}
                  >
                    {previewLoadingVoice === selectedVoice ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : previewPlayingVoice === selectedVoice ? (
                      <>
                        <span className="w-2 h-2 bg-white rounded-xs" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <select
                value={selectedVoice}
                onChange={(e) => {
                  const val = e.target.value;
                  onVoiceChange(val);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
              >
                <optgroup label="Female Voices — Agent Priya">
                  <option value="Sulafat">Sulafat (Default — Preferred Tanglish)</option>
                  <option value="Callirrhoe">Callirrhoe (Empathetic &amp; Professional)</option>
                  <option value="Aoede">Aoede (Lively &amp; Conversational)</option>
                </optgroup>
                <optgroup label="Male Voices — Agent Harish">
                  <option value="Achird">Achird (Default Male — Confident Natural)</option>
                  <option value="Zubenelgenubi">Zubenelgenubi (Calm Senior Advisor)</option>
                </optgroup>
              </select>

              {/* Compact 5-Voice Sample Audition List with Speaker Buttons */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                  Quick Preview &amp; Select
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {SUPPORTED_VOICES.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    const isPlaying = previewPlayingVoice === v.id;
                    const isLoading = previewLoadingVoice === v.id;

                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? 'bg-violet-50/80 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700/60 text-slate-900 dark:text-white font-medium ring-1 ring-violet-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onVoiceChange(v.id)}
                          className="flex-1 flex items-center gap-2 text-left cursor-pointer truncate mr-2"
                        >
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isSelected ? 'bg-violet-600 dark:bg-violet-400' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                          <div className="flex flex-col truncate">
                            <span className="text-[11px] font-semibold leading-tight flex items-center gap-1.5">
                              <span>{v.id}</span>
                              <span className="text-[9px] font-normal text-slate-500 dark:text-slate-400">
                                ({v.gender === 'female' ? 'Priya' : 'Harish'})
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                              {v.tone}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePreview(v.id)}
                          disabled={previewLoadingVoice !== null && previewLoadingVoice !== v.id}
                          className={`p-1.5 rounded-md text-[10px] flex-shrink-0 transition-all cursor-pointer ${
                            isPlaying
                              ? 'bg-rose-500 text-white shadow-sm ring-1 ring-rose-600 animate-pulse'
                              : 'bg-white dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                          title={isPlaying ? 'Stop voice sample' : `Preview sample of ${v.id}`}
                          aria-label={`Preview voice ${v.id}`}
                        >
                          {isLoading ? (
                            <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin block" />
                          ) : isPlaying ? (
                            <span className="w-3 h-3 bg-white rounded-xs block" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {previewError && (
                <p className="text-[10px] text-rose-500 dark:text-rose-400 leading-tight">
                  ⚠️ {previewError}
                </p>
              )}

              {isCallActive ? (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight flex items-center gap-1 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live voice switching active · Seamlessly transitions during call
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 leading-tight">
                  Click the speaker button to audition real sample: "Vanakkam! Naan Lyka Realty AI assistant..."
                </p>
              )}
            </div>

            {/* Lead Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="Customer's name"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Phone
              </label>
              <input
                type="text"
                placeholder="+91 ..."
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                City / Location
              </label>
              <input
                type="text"
                placeholder="Where they live or invest"
                value={leadCity}
                onChange={(e) => setLeadCity(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Language */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
              >
                <option value="bilingual">Tamil + English (Tamil Nadu Tanglish)</option>
                <option value="english">English (Professional)</option>
                <option value="tamil">தமிழ் (Tamil)</option>
              </select>
            </div>

            {/* Came from / Reason for call */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Reason for call
              </label>
              <select
                value={callReason}
                onChange={(e) => setCallReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="Dubai Investment Plan">Dubai Investment Plan</option>
                <option value="Chennai 3BHK Flat">Chennai 3BHK Flat</option>
                <option value="Villa / Land Investment">Villa / Land Investment</option>
                <option value="Bangalore Commercial Space">Bangalore Commercial Space</option>
                <option value="Direct Website Inquiry">Direct Website Inquiry</option>
                <option value="Not sure (property inquiry)">Not sure (property inquiry)</option>
              </select>
            </div>

            {/* Start / End Call Main Action Button */}
            <div className="pt-2">
              {!isCallActive ? (
                <button
                  onClick={() => {
                    onUpdateLeadData({
                      name: leadName || 'Customer',
                      phone: leadPhone || '',
                      location: leadCity || '',
                      notes: callReason,
                    });
                    onStartCall();
                  }}
                  className="w-full py-3 rounded-full bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-98 transition-all font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  <span>Start new call with {persona.name}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onEndCall}
                    className="flex-1 py-3 rounded-full bg-rose-600 text-white hover:bg-rose-500 active:scale-98 transition-all font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End call</span>
                  </button>

                  <button
                    onClick={onToggleMic}
                    title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`p-3 rounded-full border transition-all cursor-pointer ${
                      isMicMuted
                        ? 'bg-rose-50 border-rose-300 text-rose-500 dark:bg-rose-950/60'
                        : 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={onInterrupt}
                    title="Interrupt agent speech (barge-in)"
                    className="p-3 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Mode & Footnote */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center justify-between">
                <span>Mode: <strong className="text-slate-800 dark:text-slate-200">Live voice</strong></span>
                <span className="text-slate-400 font-mono text-[10px]">Priya &amp; Harish AI</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Live browser audio with low-latency bidirectional PCM streaming and noise immunity.
              </p>
            </div>
          </div>

          {/* ── Extracted Customer Information Panel (Section 4 & 14) ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <User className="w-3.5 h-3.5 text-violet-600" />
                <span>Extracted Prospect Profile</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                leadData?.qualification_status === 'HOT'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : leadData?.qualification_status === 'WARM'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {leadData?.qualification_status || 'COLD'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Customer Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {leadData?.name || leadName || 'Not provided'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Buyer / Investor Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {leadData?.buyer_type || 'Investor / Buyer'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Interest Territory</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {leadData?.country || 'India & Dubai'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Property Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {leadData?.property_type || 'Not provided'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Budget &amp; Currency</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block font-mono">
                  {leadData?.budget || 'Not provided'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Purchase Timeline</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {leadData?.timeline || 'Exploring'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Main Conversation Transcript (WhatsApp Style) ── */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col h-[740px]">
          {/* Header Bar matching Google Stitch & WhatsApp console specifications */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <Activity className="w-4 h-4 text-violet-600" />
              <span>Live Conversation Stream</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                WhatsApp Dual-Bubble
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-400 text-[11px]">
                {callId}
              </span>
            </div>
          </div>

          {/* Transcript Scrollable Area with WhatsApp Wallpaper backdrop */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4 px-2 sm:px-3 min-h-0 bg-slate-50/70 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800/80 rounded-xl my-2">
            {/* Session date pill in the center */}
            <div className="flex items-center justify-center my-1">
              <span className="px-3 py-1 rounded-full text-[10px] bg-white/90 dark:bg-slate-850/90 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/80 shadow-xs font-mono">
                Today · WhatsApp Live Voice Session · {persona.name} &amp; {leadName || 'Customer'}
              </span>
            </div>

            {transcript.length === 0 && !streamingAgentTurn && !interimTranscript ? (
              /* Clean initial greeting rendered on the LEFT as Agent's opening WhatsApp message */
              <div className="flex items-start gap-2.5 mr-auto max-w-[88%] sm:max-w-[80%]">
                {/* Agent Avatar */}
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-violet-200 dark:ring-violet-900">
                  <span>{persona.name.charAt(0)}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Online" />
                </div>

                {/* WhatsApp Incoming Bubble (Left) */}
                <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] pb-1 border-b border-slate-100 dark:border-slate-750">
                    <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-violet-600" />
                      <span>{persona.name} (AI Voice Agent)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Preset: {selectedVoice}</span>
                  </div>

                  <p className="text-[13px] sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                    "Vanakkam {leadName}! Eppadi irukkeenga? Naan Lyka Realty-la irundhu {persona.name} pesuren. Actually, neenga India-la property vaanga interested-ah irukkeengala, illa Dubai-la investment panna plan irukka?"
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-1 text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                      <Volume2 className="w-3 h-3" />
                      <span>Tamil Nadu Tanglish Live Voice</span>
                    </div>
                    <span>00:00</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {transcript.map((turn, i) => {
                  const isAgent = turn.speaker === 'agent' || turn.role === 'agent';
                  const agentDisplayName = turn.agentName || persona.name;
                  const displayTime = turn.timeFormatted || (turn.timestamp
                    ? new Date(turn.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
                    : '00:14');

                  if (isAgent) {
                    /* ── AGENT TURN: LEFT ALIGNED WHATSAPP BUBBLE ── */
                    return (
                      <div
                        key={turn.id || i}
                        className="flex items-start gap-2.5 mr-auto max-w-[88%] sm:max-w-[80%] transition-all"
                      >
                        {/* Agent Avatar */}
                        <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-violet-200 dark:ring-violet-900">
                          <span>{agentDisplayName.charAt(0)}</span>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Online" />
                        </div>

                        {/* WhatsApp Incoming Bubble (Left) */}
                        <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-[11px] pb-1 border-b border-slate-100 dark:border-slate-750">
                            <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                              <Bot className="w-3.5 h-3.5 text-violet-600" />
                              <span>{agentDisplayName} (AI Voice Agent)</span>
                            </span>
                            {turn.interrupted && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono">
                                Interrupted
                              </span>
                            )}
                          </div>

                          <div className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-100">
                            {renderHighlightedText(turn.text)}
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1 text-[10px] text-slate-400 font-mono">
                            <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                              <Volume2 className="w-3 h-3" />
                              <span>Tanglish Voice</span>
                            </div>
                            <span>{displayTime}</span>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    /* ── CUSTOMER TURN: RIGHT ALIGNED WHATSAPP BUBBLE ── */
                    return (
                      <div
                        key={turn.id || i}
                        className="flex items-end justify-end gap-2.5 ml-auto max-w-[88%] sm:max-w-[80%] transition-all"
                      >
                        {/* WhatsApp Outgoing Bubble (Right, Classic WhatsApp Green Tint) */}
                        <div className="bg-[#DCF8C6] dark:bg-[#005C4B] text-slate-950 dark:text-emerald-50 border border-emerald-300/80 dark:border-emerald-700/80 rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-[11px] pb-1 border-b border-emerald-200/60 dark:border-emerald-800/60">
                            <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                              {leadName || 'Customer'}
                            </span>
                            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-mono">
                              Live Voice / Chat
                            </span>
                          </div>

                          <div className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-line text-slate-900 dark:text-emerald-50 font-medium">
                            {turn.text}
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-0.5 text-[10px] text-emerald-800 dark:text-emerald-200 font-mono">
                            <span>{displayTime}</span>
                            <CheckCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" title="Delivered &amp; Understood" />
                          </div>
                        </div>

                        {/* Customer Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-200 dark:ring-emerald-900">
                          <span>{(leadName || 'C').charAt(0).toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  }
                })}

                {/* ── Active Streaming Agent Turn (Left Aligned Speaking Bubble with Audio Bars) ── */}
                {streamingAgentTurn && (
                  <div className="flex items-start gap-2.5 mr-auto max-w-[88%] sm:max-w-[80%] animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-violet-300 animate-pulse">
                      <span>{(streamingAgentTurn.agentName || persona.name).charAt(0)}</span>
                    </div>

                    <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-violet-400 dark:border-violet-600 rounded-2xl rounded-tl-xs px-4 py-3 shadow-md space-y-2 ring-1 ring-violet-400/20">
                      <div className="flex items-center justify-between gap-3 text-[11px] pb-1 border-b border-violet-100 dark:border-violet-900">
                        <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5">
                            <span className="w-1 h-3 bg-violet-600 animate-bounce rounded-full" />
                            <span className="w-1 h-4 bg-violet-600 animate-bounce delay-75 rounded-full" />
                            <span className="w-1 h-2 bg-violet-600 animate-bounce delay-150 rounded-full" />
                          </span>
                          <span>{streamingAgentTurn.agentName || persona.name} is speaking...</span>
                        </span>
                        <span className="text-[10px] text-violet-500 dark:text-violet-400 font-mono">Live audio</span>
                      </div>

                      <div className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-line text-slate-900 dark:text-slate-100">
                        {streamingAgentTurn.text}
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-violet-600 animate-pulse align-middle" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Active Customer Interim Utterance (Right Aligned Listening Bubble) ── */}
                {interimTranscript && (
                  <div className="flex items-end justify-end gap-2.5 ml-auto max-w-[88%] sm:max-w-[80%] animate-fade-in">
                    <div className="bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 border border-dashed border-emerald-400 dark:border-emerald-600 rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                        <span>Listening to customer...</span>
                      </div>
                      <p className="text-[13px] sm:text-sm italic font-medium">"{interimTranscript}..."</p>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-300 animate-pulse">
                      <span>{(leadName || 'C').charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom Area: Quick prompt chips and typed input bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
              Test without microphone: type what the customer says, or pick a line.
            </span>

            {/* Quick Pills */}
            <div className="flex flex-wrap gap-1.5">
              {quickPillLines.map((line, i) => (
                <button
                  key={i}
                  onClick={() => onSendText(line)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                >
                  {line}
                </button>
              ))}
            </div>

            {/* Input Bar matching reference */}
            <form onSubmit={handleTextSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder={isCallActive ? 'Type what the customer says...' : 'Start a call or type to test dialogue...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
