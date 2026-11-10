import React, { useEffect, useRef, useState } from 'react';
import { extractAudioFeatures, AudioFrequencyFeatures } from '../utils/audio';
import { LOGO_POSITIONS, LOGO_COLORS, LOGO_PARTICLE_COUNT } from '../utils/lykaLogoParticles';
import { CallStatus } from '../types/agent';

/**
 * LYKA Realty — Unified Interactive Particle System
 *
 * THREE visual states, ONE particle engine:
 *
 * 1. IDLE / NO CALL → Exact LYKA Realty particle logo (gold icon + white typography).
 *    • Continuous visible organic floating animation (CPU spring physics).
 *    • Pointer proximity: particles visibly fly away with velocity, spring back on leave.
 *    • Logo is 100% complete, fully readable, perfectly positioned.
 *
 * 2. CALL ACTIVE → 3D Fibonacci Particle Sphere.
 *    • Logo completely invisible (morph = 1.0, no ghosting).
 *    • Genuine 3D drag rotation with inertial decay.
 *    • Agent Speaking → Gold/Yellow (#f3cf7a). Customer Speaking → Emerald Green (#22c58f).
 *    • Medium-intensity real-time Web Audio FFT reactivity.
 *    • Perfectly circular, uniform spherical Fibonacci lattice (matches reference GIF).
 *
 * 3. CALL ENDS → Smooth cinematic sphere-to-logo reconstruction.
 */

export interface VoiceParticleVisualizerProps {
  voiceState: string;
  audioEnergy: number;
  micEnergy: number;
  isCallActive: boolean;
  callStatus?: CallStatus;
  className?: string;
}

const PARTICLE_COUNT = 4800;
const DEFAULT_CLASS  = 'w-full h-64 sm:h-72 block mx-auto';

type Rgb = [number, number, number];
const COLOR_GOLD_AGENT    : Rgb = [0.953, 0.812, 0.478]; // #f3cf7a
const COLOR_GOLD_CALM     : Rgb = [0.850, 0.700, 0.400]; // warm gold for silence
const COLOR_GREEN_CUSTOMER: Rgb = [0.133, 0.773, 0.561]; // #22c58f

// ─── Vertex Shader ────────────────────────────────────────────────────────────
// CPU physics now handles logo animation; aLogoDynOffset carries the per-particle offset
// uploaded every frame via DYNAMIC_DRAW buffer.
const VERT_SRC = `#version 300 es
precision highp float;

// Per-particle geometry
in vec3  aLogoPos;      // Exact LYKA logo coordinate (world-space from logo.png)
in vec3  aLogoCol;      // Exact logo color (gold or white from logo.png)
in vec3  aSpherePos;    // Fibonacci sphere coordinate
in vec3  aScatterDir;   // Outward unit vector for voice dispersion
in float aScatterWeight;// 0 = locked to sphere lattice, 1 = may disperse on voice
in float aSeed;         // Per-particle random phase seed
in float aSize;         // Base particle size

// CPU-computed logo physics offset (animated organic drift + pointer scatter)
in vec2  aLogoDynOffset;

// Morph & Audio
uniform float uSphereMorph;   // 0.0 = logo, 1.0 = sphere
uniform float uVolume;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uTime;

// Sphere rotation (manual drag + inertia)
uniform float uRotX;
uniform float uRotY;

// Canvas
uniform float uPixelRatio;
uniform float uAspect;

// Speaker colour
uniform vec3  uColorSpeaker;
uniform float uIsCustomer;

out float vAlpha;
out vec3  vColor;

void main() {
  // ── Staggered wave morph: each particle transitions at a slightly different time
  float localMorph = clamp((uSphereMorph - aSeed * 0.10) / 0.90, 0.0, 1.0);
  float morph = localMorph * localMorph * (3.0 - 2.0 * localMorph);

  // ════════════════════════════════════════════════════════
  // 1. LOGO POSITION (CPU physics offset applied here)
  // ════════════════════════════════════════════════════════
  vec3 pLogo = aLogoPos;
  // Apply CPU-computed physics offset (organic drift + mouse scatter)
  pLogo.x += aLogoDynOffset.x * (1.0 - morph);
  pLogo.y += aLogoDynOffset.y * (1.0 - morph);

  // ════════════════════════════════════════════════════════
  // 2. SPHERE POSITION (Fibonacci lattice + voice reactivity)
  // ════════════════════════════════════════════════════════
  vec3 pSphere = aSpherePos;
  vec3 norm = normalize(pSphere);

  // A. Calm breathing pulse
  pSphere += norm * sin(uTime * 1.5 + aSeed * 3.14) * 0.010;

  // B. Gentle volume expansion (+14% max)
  pSphere *= (1.0 + uVolume * 0.14);

  // C. Bass radial pulse (+5% max)
  pSphere += norm * uBass * 0.05 * cos(uTime * 4.0 - pSphere.y * 3.0);

  // D. Mid formant surface wave (+3% max)
  pSphere += norm * sin(pSphere.y * 4.0 + uTime * 3.0) * (uMid * 0.03);

  // E. Treble shimmer (fine 3-axis micro-vibration)
  pSphere += vec3(
    sin(uTime * 24.0 + aSeed * 30.0),
    cos(uTime * 28.0 + aSeed * 35.0),
    sin(uTime * 22.0 + aSeed * 40.0)
  ) * (uTreble * 0.015);

  // F. Gentle outward dispersion of outer 1-in-7 particles during speech
  pSphere += aScatterDir * (uVolume * 0.20 + uBass * 0.08) * aScatterWeight;

  // ── 3D Drag Rotation (applied to sphere only) ──
  float effRotY = uRotY * morph;
  float effRotX = uRotX * morph;
  float cy = cos(effRotY), sy = sin(effRotY);
  float cx = cos(effRotX), sx = sin(effRotX);

  vec3 rY;
  rY.x =  pSphere.x * cy + pSphere.z * sy;
  rY.y =  pSphere.y;
  rY.z = -pSphere.x * sy + pSphere.z * cy;

  vec3 rXY;
  rXY.x = rY.x;
  rXY.y = rY.y * cx - rY.z * sx;
  rXY.z = rY.y * sx + rY.z * cx;

  // ════════════════════════════════════════════════════════
  // 3. INTERPOLATE: Logo <-> Sphere
  // ════════════════════════════════════════════════════════
  vec3 finalPos = mix(pLogo, rXY, morph);

  // Perspective
  float persp = 1.0 / (1.0 + finalPos.z * 0.22);

  // ── Perfect circular projection (aspect-ratio corrected) ──
  gl_Position = vec4(finalPos.x * persp / uAspect, finalPos.y * persp, 0.0, 1.0);

  // ════════════════════════════════════════════════════════
  // 4. COLOR
  // ════════════════════════════════════════════════════════
  float depth = clamp((finalPos.z + 0.6) / 1.2, 0.0, 1.0);
  vec3 sphereColor = uColorSpeaker * (0.75 + 0.35 * depth);

  // Subtle sparkle glint
  float sparkle = pow(max(0.0, sin(aSeed * 63.0 + uTime * 2.5)), 12.0) * (0.14 + uTreble * 0.28);
  sphereColor += (uIsCustomer > 0.5 ? vec3(0.18, 0.40, 0.18) : vec3(0.28, 0.22, 0.08)) * sparkle;

  vColor = mix(aLogoCol, sphereColor, morph);

  // ════════════════════════════════════════════════════════
  // 5. ALPHA & SIZE
  // ════════════════════════════════════════════════════════
  float logoAlpha   = 0.95;
  float sphereAlpha = 0.30 + 0.62 * depth;
  vAlpha = mix(logoAlpha, sphereAlpha, morph);

  float logoSz   = aSize * 1.1;
  float sphereSz = aSize * (1.0 + 0.9 * depth);
  gl_PointSize = uPixelRatio * mix(logoSz, sphereSz, morph) * persp;
}
`;

// ─── Fragment Shader ──────────────────────────────────────────────────────────
const FRAG_SRC = `#version 300 es
precision mediump float;

in float vAlpha;
in vec3  vColor;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d2 = dot(c, c) * 4.0;
  if (d2 > 1.0) discard;

  // Soft antialiased disc with bright centre highlight
  float disc = smoothstep(1.0, 0.20, d2);
  float core = smoothstep(0.30, 0.0, d2) * 0.30;
  float a = (disc + core) * vAlpha;

  // Premultiplied output — no white channel burn-out
  fragColor = vec4(vColor * a, a);
}
`;

// ─── Sphere Geometry Builder ──────────────────────────────────────────────────
function buildSphereGeometry(n: number) {
  const spherePos     = new Float32Array(n * 3);
  const scatterDir    = new Float32Array(n * 3);
  const scatterWeight = new Float32Array(n);
  const seeds         = new Float32Array(n);
  const sizes         = new Float32Array(n);

  const R      = 0.58;                    // sphere radius in world units
  const GOLDEN = 2.399963229728653322;    // pi * (3 - sqrt(5))

  for (let i = 0; i < n; i++) {
    // Exact spherical Fibonacci distribution
    const y   = 1.0 - (2.0 * i + 1.0) / n;
    const r   = Math.sqrt(Math.max(0.0, 1.0 - y * y));
    const phi = i * GOLDEN;
    const x   = Math.cos(phi) * r;
    const z   = Math.sin(phi) * r;

    spherePos[i * 3]     = x * R;
    spherePos[i * 3 + 1] = y * R;
    spherePos[i * 3 + 2] = z * R;

    scatterDir[i * 3]     = x;
    scatterDir[i * 3 + 1] = y;
    scatterDir[i * 3 + 2] = z;

    // Only 1-in-7 particles may disperse during voice → 85% always lock to lattice
    scatterWeight[i] = i % 7 === 0 ? 1.0 : 0.0;
    seeds[i] = (i * 1.6180339887) % (Math.PI * 2);
    sizes[i] = 1.0 + (i % 3) * 0.14;
  }

  return { spherePos, scatterDir, scatterWeight, seeds, sizes };
}

// ─── WebGL Helpers ────────────────────────────────────────────────────────────
function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[VoiceParticleVisualizer] Shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compileShader(gl, gl.VERTEX_SHADER,   vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[VoiceParticleVisualizer] Link error:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const VoiceParticleVisualizer: React.FC<VoiceParticleVisualizerProps> = ({
  voiceState,
  audioEnergy,
  micEnergy,
  isCallActive,
  callStatus,
  className = DEFAULT_CLASS,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const [supported, setSupported] = useState(true);

  // Mirror latest props into a ref for the render loop
  const latestProps = useRef({ voiceState, audioEnergy, micEnergy, isCallActive, callStatus });
  useEffect(() => { latestProps.current = { voiceState, audioEnergy, micEnergy, isCallActive, callStatus }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'default',
    }) as WebGL2RenderingContext | null;

    if (!gl) { setSupported(false); return; }

    const program = linkProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) { setSupported(false); return; }

    const n      = Math.min(PARTICLE_COUNT, LOGO_PARTICLE_COUNT);
    const sphere = buildSphereGeometry(n);

    // ── CPU-side logo spring physics arrays ──
    const logoOffX   = new Float32Array(n);  // current X offset from home position
    const logoOffY   = new Float32Array(n);  // current Y offset from home position
    const logoVelX   = new Float32Array(n);  // X velocity
    const logoVelY   = new Float32Array(n);  // Y velocity
    // Per-particle organic drift parameters (randomised at init, golden-ratio spaced)
    const driftPhaseX = new Float32Array(n);
    const driftPhaseY = new Float32Array(n);
    const driftFreqX  = new Float32Array(n);
    const driftFreqY  = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      driftPhaseX[i] = (i * 2.6180339887) % (Math.PI * 2);
      driftPhaseY[i] = (i * 1.4142135623) % (Math.PI * 2);
      driftFreqX[i]  = 0.4 + (i % 7) * 0.08;   // 0.40–0.88 Hz, varied per particle
      driftFreqY[i]  = 0.3 + (i % 5) * 0.10;   // 0.30–0.70 Hz
    }
    // Packed interleaved [x0,y0, x1,y1, ...] for GPU upload
    const dynOffData = new Float32Array(n * 2);

    const vao  = gl.createVertexArray()!;
    const bufs : WebGLBuffer[] = [];
    gl.bindVertexArray(vao);

    const bindAttr = (name: string, data: Float32Array, size: number, dynamic = false) => {
      const buf = gl.createBuffer();
      if (!buf) return buf;
      bufs.push(buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      return buf;
    };

    bindAttr('aLogoPos',       LOGO_POSITIONS,       3);
    bindAttr('aLogoCol',       LOGO_COLORS,          3);
    bindAttr('aSpherePos',     sphere.spherePos,     3);
    bindAttr('aScatterDir',    sphere.scatterDir,    3);
    bindAttr('aScatterWeight', sphere.scatterWeight, 1);
    bindAttr('aSeed',          sphere.seeds,         1);
    bindAttr('aSize',          sphere.sizes,         1);

    // Dynamic offset buffer — uploaded every frame with CPU physics
    const dynOffBuf = gl.createBuffer()!;
    bufs.push(dynOffBuf);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynOffBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dynOffData, gl.DYNAMIC_DRAW);
    const dynOffLoc = gl.getAttribLocation(program, 'aLogoDynOffset');
    if (dynOffLoc >= 0) {
      gl.enableVertexAttribArray(dynOffLoc);
      gl.vertexAttribPointer(dynOffLoc, 2, gl.FLOAT, false, 0, 0);
    }

    gl.bindVertexArray(null);

    const U = {
      uSphereMorph  : gl.getUniformLocation(program, 'uSphereMorph'),
      uVolume       : gl.getUniformLocation(program, 'uVolume'),
      uBass         : gl.getUniformLocation(program, 'uBass'),
      uMid          : gl.getUniformLocation(program, 'uMid'),
      uTreble       : gl.getUniformLocation(program, 'uTreble'),
      uTime         : gl.getUniformLocation(program, 'uTime'),
      uRotX         : gl.getUniformLocation(program, 'uRotX'),
      uRotY         : gl.getUniformLocation(program, 'uRotY'),
      uPixelRatio   : gl.getUniformLocation(program, 'uPixelRatio'),
      uAspect       : gl.getUniformLocation(program, 'uAspect'),
      uColorSpeaker : gl.getUniformLocation(program, 'uColorSpeaker'),
      uIsCustomer   : gl.getUniformLocation(program, 'uIsCustomer'),
    };

    // Premultiplied alpha blending — rich colour, no white burn-out
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // ── Responsive canvas sizing ──
    let pixelRatio = 1;
    let aspect     = 1.5;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = rect.width  > 0 ? rect.width  : 400;
      const cssH = rect.height > 0 ? rect.height : 260;
      const w    = Math.max(1, Math.round(cssW * dpr));
      const h    = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }
      pixelRatio = dpr;
      aspect     = cssW / cssH;
    };
    resize();
    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(canvas);

    // ── 3D Drag Rotation state ──
    let rotX    = 0.36;    // current X tilt (radians)
    let rotY    = 0.0;     // current Y angle (radians)
    let velX    = 0.0;     // inertial X velocity
    let velY    = 0.004;   // gentle initial drift
    let isDragging = false;
    let lastPX  = 0, lastPY = 0;

    // ── Logo mouse repulsion state ──
    let mouseNDX    = 0.0;
    let mouseNDY    = 0.0;
    let repelActive = 0.0;  // 0 = pointer off canvas, 1 = pointer on canvas

    // ── Pointer events (dual-mode: logo repulsion vs sphere drag) ──
    const getIsLogo = () =>
      !latestProps.current.isCallActive &&
      latestProps.current.callStatus !== 'calling' &&
      latestProps.current.callStatus !== 'connecting';

    const canvasNDC = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const cx   = (e.clientX - rect.left) / rect.width;   // 0..1
      const cy   = (e.clientY - rect.top)  / rect.height;  // 0..1
      return [cx * 2 - 1, -(cy * 2 - 1)];                  // NDC: [-1,1] x [-1,1]
    };

    const onPointerDown = (e: PointerEvent) => {
      if (getIsLogo()) return;        // logo mode: no drag, only mouse-move
      isDragging = true;
      lastPX = e.clientX;
      lastPY = e.clientY;
      velX = 0; velY = 0;
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const [nx, ny] = canvasNDC(e);

      if (getIsLogo()) {
        // Logo mode: update pointer NDC for CPU physics repulsion
        mouseNDX = nx;
        mouseNDY = ny;
        repelActive = 1.0;
        return;
      }

      // Sphere drag mode
      if (!isDragging) return;
      const dx = e.clientX - lastPX;
      const dy = e.clientY - lastPY;
      velX = -dy * 0.0045;
      velY =  dx * 0.0045;
      rotX += velX;
      rotY += velY;
      rotX = Math.max(-1.3, Math.min(1.3, rotX));
      lastPX = e.clientX;
      lastPY = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onPointerLeave = () => {
      isDragging  = false;
      repelActive = 0.0;
    };

    canvas.addEventListener('pointerdown',   onPointerDown);
    canvas.addEventListener('pointermove',   onPointerMove);
    canvas.addEventListener('pointerup',     onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave',  onPointerLeave);

    // ── WebGL context loss ──
    const onCtxLost = (e: Event) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); };
    canvas.addEventListener('webglcontextlost', onCtxLost);

    // ── Shared animation state ──
    let clockT       = 0;
    let currentMorph = latestProps.current.isCallActive ? 1.0 : 0.0;
    let curVol    = 0, curBass = 0, curMid = 0, curTreble = 0;
    let curCol    : Rgb = latestProps.current.isCallActive ? [...COLOR_GOLD_AGENT] : [...COLOR_GOLD_CALM];
    let raf       = 0;
    let running   = true;
    let last      = performance.now();

    // ── Render loop ──────────────────────────────────────────────────────────
    const render = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last  = now;
      clockT += dt;

      const s = latestProps.current;

      // 1. Morph target
      const shouldBeSphere = s.isCallActive || s.callStatus === 'calling' || s.callStatus === 'connecting';
      const targetMorph    = shouldBeSphere ? 1.0 : 0.0;
      currentMorph += (targetMorph - currentMorph) * Math.min(1, dt / 1.1);

      // 2. Audio features
      const feat: AudioFrequencyFeatures = extractAudioFeatures(s.voiceState, s.audioEnergy, s.micEnergy);
      const aK = 1 - Math.exp(-dt / 0.014);
      const rK = 1 - Math.exp(-dt / 0.220);
      const ease = (c: number, t: number) => c + (t - c) * (t > c ? aK : rK);
      curVol    = ease(curVol,    feat.volume);
      curBass   = ease(curBass,   feat.bass);
      curMid    = ease(curMid,    feat.mid);
      curTreble = ease(curTreble, feat.treble);

      // 3. Speaker colours
      const isCustomer = s.voiceState === 'listening';
      const isAgent    = s.voiceState === 'speaking';
      const targetColor: Rgb = isCustomer ? COLOR_GREEN_CUSTOMER : isAgent ? COLOR_GOLD_AGENT : COLOR_GOLD_CALM;
      const customerFlag = isCustomer ? 1.0 : 0.0;
      const cK = 1 - Math.exp(-dt * 6.0);
      curCol = [curCol[0] + (targetColor[0] - curCol[0]) * cK,
                curCol[1] + (targetColor[1] - curCol[1]) * cK,
                curCol[2] + (targetColor[2] - curCol[2]) * cK];

      // 4. Rotation
      if (!isDragging && shouldBeSphere) {
        // Automatic drift when not dragged
        velY += (0.004 - velY) * 0.015;
        velX *= 0.96;
        rotX += velX;
        rotY += velY + curVol * 0.12 * dt;
        // Gentle axial tilt wobble
        rotX = 0.36 + Math.sin(clockT * 0.38) * 0.04 + rotX * 0.0;
      } else if (!isDragging) {
        // Inertial decay after drag release
        rotY += velY; velY *= 0.94;
        rotX += velX; velX *= 0.94;
      }

      // ── 5. CPU Logo Physics ───────────────────────────────────────────────
      // Run physics every frame (even when morphing, it fades out naturally via
      // the (1 - morph) blend in the shader — no wasted work since n=4800 is fast)
      {
        // Physics constants
        const REPEL_R   = 0.30;    // repulsion zone radius in world units
        const REPEL_STR = 4.5;    // max repulsion force (world units / s²)
        const SPRING_K  = 8.0;    // spring constant pulling back to home (1/s²)
        const DAMPING   = Math.pow(0.80, dt * 60); // per-frame velocity damping
        const DRIFT_AMP = 0.022;  // organic drift amplitude (world units) — clearly visible

        // Convert NDC mouse → logo world space
        // Logo shader: NDC.x = world.x / uAspect → world.x = mouseNDX * aspect
        const mx = mouseNDX * aspect;
        const my = mouseNDY;

        for (let i = 0; i < n; i++) {
          // Home position (from LOGO_POSITIONS, which is in world space)
          const hx = LOGO_POSITIONS[i * 3];
          const hy = LOGO_POSITIONS[i * 3 + 1];

          // Current world position (home + offset)
          const px = hx + logoOffX[i];
          const py = hy + logoOffY[i];

          // 1. Organic drift force — smooth sinusoidal floating
          const dfx = Math.sin(clockT * driftFreqX[i] + driftPhaseX[i]) * DRIFT_AMP;
          const dfy = Math.cos(clockT * driftFreqY[i] + driftPhaseY[i]) * DRIFT_AMP;

          // 2. Spring restoring force toward home
          const sfx = -SPRING_K * logoOffX[i];
          const sfy = -SPRING_K * logoOffY[i];

          // 3. Mouse repulsion force (only when pointer is on canvas)
          let rfx = 0, rfy = 0;
          if (repelActive > 0) {
            const ddx = px - mx;
            const ddy = py - my;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < REPEL_R && dist > 0.001) {
              const strength = (1 - dist / REPEL_R) * (1 - dist / REPEL_R) * REPEL_STR;
              rfx = (ddx / dist) * strength;
              rfy = (ddy / dist) * strength;
            }
          }

          // 4. Integrate velocity and position
          // Net force = drift target - spring + repulsion
          // We treat drift as a target position, not a force, to keep it clean:
          // combine spring-to-drift and spring-to-home
          // Effective: accel = (drift_target_offset - current_offset) * K_drift + repulsion
          const K_DRIFT = 2.5;
          const ax = (dfx - logoOffX[i]) * K_DRIFT + rfx;
          const ay = (dfy - logoOffY[i]) * K_DRIFT + rfy;

          logoVelX[i] = (logoVelX[i] + ax * dt) * DAMPING;
          logoVelY[i] = (logoVelY[i] + ay * dt) * DAMPING;
          logoOffX[i] += logoVelX[i] * dt;
          logoOffY[i] += logoVelY[i] * dt;

          // Pack into interleaved GPU buffer
          dynOffData[i * 2]     = logoOffX[i];
          dynOffData[i * 2 + 1] = logoOffY[i];
        }

        // Upload physics offsets to GPU every frame
        gl.bindBuffer(gl.ARRAY_BUFFER, dynOffBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynOffData);
      }

      // 6. Draw
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform1f(U.uSphereMorph,  currentMorph);
      gl.uniform1f(U.uVolume,       curVol);
      gl.uniform1f(U.uBass,         curBass);
      gl.uniform1f(U.uMid,          curMid);
      gl.uniform1f(U.uTreble,       curTreble);
      gl.uniform1f(U.uTime,         clockT);
      gl.uniform1f(U.uRotX,         rotX);
      gl.uniform1f(U.uRotY,         rotY);
      gl.uniform1f(U.uPixelRatio,   pixelRatio);
      gl.uniform1f(U.uAspect,       aspect);
      gl.uniform3f(U.uColorSpeaker, curCol[0], curCol[1], curCol[2]);
      gl.uniform1f(U.uIsCustomer,   customerFlag);

      gl.drawArrays(gl.POINTS, 0, n);
      gl.bindVertexArray(null);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resizeObs.disconnect();
      canvas.removeEventListener('pointerdown',      onPointerDown);
      canvas.removeEventListener('pointermove',      onPointerMove);
      canvas.removeEventListener('pointerup',        onPointerUp);
      canvas.removeEventListener('pointercancel',    onPointerUp);
      canvas.removeEventListener('pointerleave',     onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onCtxLost);
      bufs.forEach(b => gl.deleteBuffer(b));
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }, []);

  if (!supported) {
    return (
      <div
        aria-hidden
        className={`${className} rounded-full`}
        style={{
          background: 'radial-gradient(circle, rgba(243,207,122,0.45) 0%, rgba(156,103,22,0.18) 50%, rgba(31,5,24,0) 72%)',
          boxShadow:  '0 0 48px 12px rgba(216,158,67,0.18)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="LYKA Realty Particle Visualizer"
      className={`${className} cursor-crosshair`}
      style={{ touchAction: 'none' }}
    />
  );
};
