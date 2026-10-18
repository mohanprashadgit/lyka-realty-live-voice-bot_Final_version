/**
 * Real-time Audio Streaming Utility for Gemini Live Native Audio
 * - Input: 16kHz 16-bit linear PCM microphone capture with echo suppression
 * - Output: 24kHz 16-bit linear PCM playback with jitter-buffered gapless scheduling
 * - Environment Noise Immunity: Ignores ambient sounds; prevents false cutoffs
 * - Multi-device support: Default, Bluetooth headsets/AirPods, USB mics, etc.
 */

import { AudioInputDeviceInfo } from '../types/agent';

// Helper to convert base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert ArrayBuffer or ArrayBufferLike to base64
export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  let binary = '';
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Float32Array to Int16Array PCM
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const l = float32Array.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

// Convert Int16Array PCM to Float32Array
export function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const l = int16Array.length;
  const float32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    const s = int16Array[i];
    float32[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return float32;
}

// Downsample audio buffer to 16kHz
export function downsampleBuffer(
  buffer: Float32Array,
  inputRate: number,
  outputRate: number = 16000
): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Enumerate available audio input devices (Default, Bluetooth, Built-in, USB).
 */
export async function getAvailableMicrophones(): Promise<AudioInputDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [{ deviceId: 'default', label: 'Default Microphone', isBluetooth: false, isDefault: true }];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    if (audioInputs.length === 0) {
      return [{ deviceId: 'default', label: 'Default Microphone', isBluetooth: false, isDefault: true }];
    }

    return audioInputs.map((d, index) => {
      let label = d.label || `Microphone ${index + 1}`;
      const lower = label.toLowerCase();
      const isBluetooth =
        lower.includes('bluetooth') ||
        lower.includes('airpod') ||
        lower.includes('headset') ||
        lower.includes('earbuds') ||
        lower.includes('buds') ||
        lower.includes('hands-free') ||
        lower.includes('wireless') ||
        lower.includes('bt');
      const isDefault = d.deviceId === 'default' || lower.includes('default');

      return {
        deviceId: d.deviceId,
        label,
        isBluetooth,
        isDefault,
      };
    });
  } catch (err) {
    console.warn('[Audio] Failed to enumerate audio devices:', err);
    return [{ deviceId: 'default', label: 'Default Microphone', isBluetooth: false, isDefault: true }];
  }
}

export class LiveAudioPlayer {
  private ctx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  public isPlaying: boolean = false;
  private onPlayStateChange?: (playing: boolean) => void;
  private onAudioEnergy?: (energy: number) => void;

  constructor(
    onPlayStateChange?: (playing: boolean) => void,
    onAudioEnergy?: (energy: number) => void
  ) {
    this.onPlayStateChange = onPlayStateChange;
    this.onAudioEnergy = onAudioEnergy;
  }

  private initContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
      this.nextPlayTime = 0;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playChunk(base64Pcm24k: string) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const rawBuffer = base64ToArrayBuffer(base64Pcm24k);
      const int16Data = new Int16Array(rawBuffer);
      const float32Data = int16ToFloat32(int16Data);

      // Energy calculation for visualizer
      let sumSquares = 0;
      for (let i = 0; i < float32Data.length; i++) {
        sumSquares += float32Data[i] * float32Data[i];
      }
      const rms = Math.sqrt(sumSquares / float32Data.length);
      this.onAudioEnergy?.(Math.min(1, rms * 4));

      // Create Web Audio Buffer at 24,000 Hz
      const audioBuffer = this.ctx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.ctx.destination);

      const currentTime = this.ctx.currentTime;
      // Small 80ms jitter buffer on fresh start
      if (this.nextPlayTime <= currentTime) {
        this.nextPlayTime = currentTime + 0.08;
      }

      const startTime = this.nextPlayTime;
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);
      this.updatePlayingState(true);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          this.updatePlayingState(false);
          this.onAudioEnergy?.(0);
          this.nextPlayTime = 0;
        }
      };
    } catch (err) {
      console.error('[AudioPlayer] Error playing chunk:', err);
    }
  }

  private updatePlayingState(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.onPlayStateChange?.(playing);
    }
  }

  public stopAndClear() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.ctx) {
      this.nextPlayTime = 0;
    }
    this.updatePlayingState(false);
    this.onAudioEnergy?.(0);
  }

  public close() {
    this.stopAndClear();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}

export class LiveMicRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private recognition: any = null;
  public isRecording: boolean = false;
  public isAgentSpeaking: boolean = false;
  private ambientFloor: number = 0.008;
  private consecutiveSpeechFrames: number = 0;
  private speechHangoverFrames: number = 0;
  private onAudioChunk: (base64Chunk: string) => void;
  private onEnergy?: (energy: number) => void;
  private onUserTranscript?: (text: string, isFinal: boolean) => void;
  public language: string;
  public deviceId: string;

  private isMuted: boolean = false;

  constructor(
    onAudioChunk: (base64Chunk: string) => void,
    onEnergy?: (energy: number) => void,
    onUserTranscript?: (text: string, isFinal: boolean) => void,
    language: string = 'bilingual',
    deviceId: string = 'default'
  ) {
    this.onAudioChunk = onAudioChunk;
    this.onEnergy = onEnergy;
    this.onUserTranscript = onUserTranscript;
    this.language = language;
    this.deviceId = deviceId;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public setAgentSpeaking(speaking: boolean) {
    this.isAgentSpeaking = speaking;
  }

  private getAudioConstraints(deviceId?: string): MediaStreamConstraints {
    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    const targetId = deviceId || this.deviceId;
    if (targetId && targetId !== 'default') {
      audioConstraints.deviceId = { exact: targetId };
    }
    return { audio: audioConstraints };
  }

  public async start(deviceId?: string): Promise<boolean> {
    if (deviceId) this.deviceId = deviceId;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(
        this.getAudioConstraints(this.deviceId)
      );

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.processor = this.ctx.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // RMS Energy calculation for UI visualizer meter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const energy = Math.min(1, rms * 5);
        this.onEnergy?.(energy);

        // Track ambient noise floor dynamically
        if (rms < 0.03) {
          this.ambientFloor = this.ambientFloor * 0.95 + rms * 0.05;
        }

        // Voice Activity Detection (VAD) Speech Gate:
        // 1. When agent is speaking:
        //    Suppress background ambient sounds, room echo, breathing, and PC fan noise
        //    so the agent speaks fully without false interruptions.
        //    Only transmit if genuine human speech energy (barge-in) is detected.
        // 2. When agent is NOT speaking (agent has finished turn and is listening for user):
        //    Stream audio continuously so Gemini Live's neural server VAD receives the user's
        //    complete utterance including trailing silence to trigger immediate response!
        let shouldTransmitAudio = false;

        if (this.isAgentSpeaking) {
          const bargeInThreshold = Math.max(0.038, this.ambientFloor * 3.2);
          if (rms >= bargeInThreshold) {
            this.consecutiveSpeechFrames++;
          } else {
            this.consecutiveSpeechFrames = 0;
          }
          if (this.consecutiveSpeechFrames >= 2) {
            this.speechHangoverFrames = 10;
          } else if (this.speechHangoverFrames > 0) {
            this.speechHangoverFrames--;
          }
          shouldTransmitAudio = this.consecutiveSpeechFrames >= 2 || this.speechHangoverFrames > 0;
        } else {
          // Agent is listening for user speech: transmit continuously!
          shouldTransmitAudio = true;
        }

        if (shouldTransmitAudio && !this.isMuted) {
          const downsampled = downsampleBuffer(inputData, this.ctx!.sampleRate, 16000);
          const int16Array = float32ToInt16(downsampled);
          const base64Chunk = arrayBufferToBase64(int16Array.buffer);
          this.onAudioChunk(base64Chunk);
        }
      };

      this.source.connect(this.processor);

      // Route processor to a muted GainNode (gain = 0) before destination to prevent speaker feedback
      this.muteGain = this.ctx.createGain();
      this.muteGain.gain.value = 0;
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.ctx.destination);

      this.isRecording = true;

      // Start client-side speech recognition for instant real-time transcript inside chat
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          this.recognition = new SpeechRecognitionClass();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.maxAlternatives = 1;
          this.recognition.lang =
            this.language === 'tamil' || this.language === 'bilingual'
              ? 'ta-IN'
              : this.language === 'hindi'
              ? 'hi-IN'
              : this.language === 'arabic'
              ? 'ar-SA'
              : 'en-US';

          this.recognition.onresult = (event: any) => {
            if (!this.isRecording) return;
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript;
              } else {
                interimTranscript += res[0].transcript;
              }
            }

            const speechText = (finalTranscript || interimTranscript).trim();
            if (speechText) {
              this.onUserTranscript?.(speechText, Boolean(finalTranscript));
            }
          };

          let restartTimeout: any = null;
          this.recognition.onerror = (event: any) => {
            if (event?.error === 'network' || event?.error === 'no-speech' || event?.error === 'aborted') {
              return;
            }
            console.warn('[LiveMicRecorder] Speech recognition notice:', event?.error);
          };

          this.recognition.onend = () => {
            if (this.isRecording && this.recognition) {
              if (restartTimeout) clearTimeout(restartTimeout);
              restartTimeout = setTimeout(() => {
                if (this.isRecording && this.recognition) {
                  try {
                    this.recognition.start();
                  } catch {}
                }
              }, 1000);
            }
          };

          this.recognition.start();
        } catch (e) {
          console.warn('[LiveMicRecorder] Could not start speech recognition:', e);
        }
      }

      return true;
    } catch (err) {
      console.error('[MicRecorder] Failed to start microphone with constraints:', err);
      // Fallback to default mic without explicit deviceId constraint if failed
      if (this.deviceId !== 'default') {
        this.deviceId = 'default';
        return this.start('default');
      }
      return false;
    }
  }

  /**
   * Switch microphone input dynamically without interrupting the session.
   */
  public async switchDevice(newDeviceId: string): Promise<boolean> {
    this.deviceId = newDeviceId;
    if (!this.isRecording) return true;

    try {
      console.log(`[MicRecorder] Switching microphone input to: ${newDeviceId}`);
      const newStream = await navigator.mediaDevices.getUserMedia(
        this.getAudioConstraints(newDeviceId)
      );

      // Stop old tracks
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
      }
      this.stream = newStream;

      // Reconnect Web Audio Source
      if (this.source) {
        this.source.disconnect();
      }
      if (this.ctx && this.processor) {
        this.source = this.ctx.createMediaStreamSource(newStream);
        this.source.connect(this.processor);
      }
      return true;
    } catch (err) {
      console.error('[MicRecorder] Failed to switch microphone device:', err);
      return false;
    }
  }

  public stop() {
    this.isRecording = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
        this.recognition = null;
      } catch {}
    }
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }
    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {}
      this.muteGain = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.stream = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
    this.onEnergy?.(0);
  }
}

/**
 * Synthesizes a realistic Vivo/Android smartphone luxury marimba ringtone
 * using the Web Audio API. Requires zero external audio files.
 */
export class PhoneRingtone {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  public isPlaying: boolean = false;

  private playChime() {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    // Vivo-style melodic marimba notes: E5 (659.25), G#5 (830.61), B5 (987.77), E6 (1318.51)
    const notes = [
      { freq: 659.25, time: 0 },
      { freq: 830.61, time: 0.14 },
      { freq: 987.77, time: 0.28 },
      { freq: 1318.51, time: 0.42 },
      { freq: 987.77, time: 0.70 },
      { freq: 1318.51, time: 0.86 },
    ];

    notes.forEach(({ freq, time }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Warm marimba envelope
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.25, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + 0.46);
    });
  }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.playChime();
      this.intervalId = setInterval(() => {
        this.playChime();
      }, 2200);
    } catch (e) {
      console.warn('[PhoneRingtone] Failed to start ringtone:', e);
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}

