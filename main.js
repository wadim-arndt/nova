// ─────────────────────────────────────────────────────────────
//  NOVA – Noise Oriented Visual Aesthetics
//  Step 2: Particles · Waveform ring · Beat shockwaves
// ─────────────────────────────────────────────────────────────

// ── Canvas setup ──────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ── Overlay / Start button ────────────────────────────────────
const overlay  = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");

startBtn.addEventListener("click", () => {
  overlay.classList.add("hidden");
  startAudio();
});

// ─────────────────────────────────────────────────────────────
//  FLOW FIELD
//  Returns a direction angle at canvas position (x, y) and time t.
//  Layering two sin/cos functions at different frequencies creates
//  smooth, non-repeating swirling motion that never looks mechanical.
// ─────────────────────────────────────────────────────────────
function flowAngle(x, y, t) {
  const s = 0.0022;               // spatial scale – lower = larger, calmer swirls
  const a = Math.sin(x * s + t * 0.30) * Math.PI * 2;
  const b = Math.cos(y * s + t * 0.19) * Math.PI;
  return a + b;
}

// ─────────────────────────────────────────────────────────────
//  PARTICLE SYSTEM  (flow-field driven)
// ─────────────────────────────────────────────────────────────
class Particle {
  constructor() { this.reset(true); }

  // Particles now spawn anywhere on the canvas, not just the center.
  reset(fullReset = false) {
    this.x         = Math.random() * canvas.width;
    this.y         = Math.random() * canvas.height;
    this.size      = Math.random() * 1.8 + 0.4;
    this.life      = fullReset ? Math.random() : 1.0;  // stagger on init
    this.decay     = Math.random() * 0.003 + 0.0012;
    this.hueOffset = (Math.random() - 0.5) * 90;
    this.speed     = Math.random() * 0.7 + 0.3;        // individual base speed
  }

  // t = current time in seconds (from Date.now() * 0.001)
  update(bassNorm, t) {
    // Sample the flow field at this particle's position
    const angle = flowAngle(this.x, this.y, t);
    // Bass adds urgency – more energy → faster flow
    const speed = this.speed + bassNorm * 1.8;

    this.x += Math.cos(angle) * speed;
    this.y += Math.sin(angle) * speed;
    this.life -= this.decay;

    // Respawn when faded out or drifted off-screen
    if (
      this.life <= 0 ||
      this.x < -10 || this.x > canvas.width  + 10 ||
      this.y < -10 || this.y > canvas.height + 10
    ) {
      this.reset();
    }
  }

  draw(hue) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${hue + this.hueOffset}, 80%, 78%, ${this.life * 0.48})`;
    ctx.shadowColor = `hsla(${hue + this.hueOffset}, 100%, 82%, 0.25)`;
    ctx.shadowBlur  = 9;
    ctx.fill();
  }
}

// More particles since they now cover the full canvas.
const particles = Array.from({ length: 350 }, () => new Particle());

// ─────────────────────────────────────────────────────────────
//  SHOCKWAVES
// ─────────────────────────────────────────────────────────────
const shockwaves = [];

function spawnShockwave(hue) {
  shockwaves.push({ r: 60, alpha: 0.8, hue });
}

function updateAndDrawShockwaves(cx, cy) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r    += 9;
    s.alpha -= 0.018;
    if (s.alpha <= 0) { shockwaves.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${s.hue}, 80%, 85%, ${s.alpha})`;
    ctx.lineWidth   = 2;
    ctx.shadowColor = `hsla(${s.hue}, 100%, 90%, ${s.alpha * 0.5})`;
    ctx.shadowBlur  = 14;
    ctx.stroke();
  }
}

// ── Audio setup ───────────────────────────────────────────────
async function startAudio() {
  const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new AudioContext();
  const source   = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize               = 512;
  // Web Audio's built-in smoothing (first layer)
  analyser.smoothingTimeConstant = 0.88;
  source.connect(analyser);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const waveData = new Uint8Array(analyser.fftSize);
  draw(analyser, freqData, waveData);
}

// ── Helpers ───────────────────────────────────────────────────
function avg(data, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start);
}

function map(v, inMin, inMax, outMin, outMax) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// lerp: second smoothing layer applied manually each frame.
// a = current smoothed value, b = raw target, t = speed (0=frozen, 1=instant).
// Small t (0.05–0.12) creates organic lag that kills jitter.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

let prevBassNorm = 0;

// Smoothed audio state – persists across frames.
// Each value chases its raw counterpart via lerp.
let sBass    = 0;  // smoothed bass  (lerp speed 0.08 → ~8 frames to react)
let sMid     = 0;  // smoothed mids  (lerp speed 0.06 → even calmer)
let sOverall = 0;  // smoothed overall loudness
let sPulse   = 0;  // smoothed pulse radius (separate so glow doesn't pop)

// ─────────────────────────────────────────────────────────────
//  DRAW LOOP
// ─────────────────────────────────────────────────────────────
function draw(analyser, freqData, waveData) {
  requestAnimationFrame(() => draw(analyser, freqData, waveData));
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(waveData);

  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  const binCount = freqData.length;

  // ── Raw audio values (used ONLY for beat detection) ────────
  const rawBass    = avg(freqData,  0,  10) / 255;
  const rawMid     = avg(freqData, 10,  80) / 255;
  const rawOverall = avg(freqData,  0, binCount) / 255;

  // ── Smoothed values (used for all visuals) ──────────────────
  // lerp chases the raw value slowly → no sudden jumps in the image.
  sBass    = lerp(sBass,    rawBass,    0.08);  // bass: responsive but not twitchy
  sMid     = lerp(sMid,     rawMid,     0.06);  // mids: calmer
  sOverall = lerp(sOverall, rawOverall, 0.05);  // overall: very calm

  const bassNorm    = sBass;
  const midNorm     = sMid;
  const overallNorm = sOverall;

  // Hue: time-driven + smoothed mid influence → no hue flicker
  const hue = (Date.now() * 0.016 + midNorm * 80) % 360;

  // Beat detection runs on RAW values so beats still register sharply.
  if (rawBass > 0.55 && prevBassNorm < 0.45) spawnShockwave(hue);
  prevBassNorm = rawBass;

  // Background fade trail – slightly longer trail gives the flow
  // field a beautiful ink-in-water look.
  ctx.shadowBlur = 0;
  ctx.fillStyle  = "rgba(0, 0, 0, 0.13)";
  ctx.fillRect(0, 0, W, H);

  // Time in seconds – shared by flow field and all particles.
  const t = Date.now() * 0.001;

  // Layer 1 – Flow field particles
  for (const p of particles) { p.update(bassNorm, t); p.draw(hue); }

  // Layer 2 – Central pulse
  const baseRadius  = Math.min(W, H) * 0.09;
  // Pulse radius is lerped separately so the glow breathes, not pops.
  const targetPulse = baseRadius + bassNorm * Math.min(W, H) * 0.17;
  sPulse            = lerp(sPulse, targetPulse, 0.10);
  const pulseRadius = sPulse;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
  grd.addColorStop(0,   `hsla(${hue},      90%, 85%, 0.95)`);
  grd.addColorStop(0.5, `hsla(${hue + 30}, 80%, 55%, 0.5)`);
  grd.addColorStop(1,   `hsla(${hue + 60}, 70%, 20%, 0)`);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Layer 3 – Radial frequency bars
  const innerR    = pulseRadius + 8;
  const maxBarLen = Math.min(W, H) * 0.30;
  const angleStep = (Math.PI * 2) / binCount;
  for (let i = 0; i < binCount; i++) {
    const value  = freqData[i];
    const barLen = map(value, 0, 255, 2, maxBarLen);
    const angle  = i * angleStep - Math.PI / 2;
    const barHue = (hue + (i / binCount) * 180) % 360;
    const alpha  = map(value, 0, 255, 0.05, 0.85);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, innerR);
    ctx.lineTo(0, innerR + barLen);
    ctx.strokeStyle = `hsla(${barHue}, 85%, 65%, ${alpha})`;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = `hsla(${barHue}, 100%, 70%, 0.5)`;
    ctx.shadowBlur  = 6;
    ctx.stroke();
    ctx.restore();
  }

  // Layer 4 – Circular waveform ring
  const waveRadius = innerR + maxBarLen * 0.45;
  const wStep      = (Math.PI * 2) / waveData.length;
  ctx.beginPath();
  for (let i = 0; i < waveData.length; i++) {
    const deviation = ((waveData[i] / 128) - 1) * 35;
    const angle     = i * wStep - Math.PI / 2;
    const r         = waveRadius + deviation;
    const x         = cx + Math.cos(angle) * r;
    const y         = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.shadowColor = `hsla(${hue + 140}, 80%, 80%, 0.5)`;
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = `hsla(${hue + 140}, 70%, 80%, ${map(overallNorm, 0, 1, 0.1, 0.55)})`;
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // Layer 5 – Shockwaves
  updateAndDrawShockwaves(cx, cy);

  // Layer 6 – Outer presence ring
  const outerR    = innerR + maxBarLen + 22;
  const ringAlpha = map(overallNorm, 0, 1, 0.02, 0.2);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${hue + 90}, 50%, 70%, ${ringAlpha})`;
  ctx.lineWidth   = 1;
  ctx.shadowBlur  = 0;
  ctx.stroke();
}
