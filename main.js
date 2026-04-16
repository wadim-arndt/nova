// ─────────────────────────────────────────────────────────────
//  NOVA – Noise Oriented Visual Aesthetics
//  Step 6: Orbiting moon · Beat bloom
//  · Saturn-like planet core with layered atmospheric glow
//  · Orbital rings split into back/front arcs (planet occludes center)
//  · Nebula cloud layer: slow, large drifting soft blobs
//  · Waveform ring smoothed via rolling-average buffer
//  · Idle breath — scene stays alive even in silence
//  · All motion interpolated — no jitter
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
//  HELPERS
// ─────────────────────────────────────────────────────────────
function avg(data, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start);
}

function map(v, inMin, inMax, outMin, outMax) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// Smooth lerp — chases target with organic lag (kills jitter).
function lerp(a, b, t) { return a + (b - a) * t; }

// Simple 2D "noise" from layered sinusoids — no library needed.
function softNoise(x, y, t) {
  return (
    Math.sin(x * 0.011 + t * 0.23) * 0.5 +
    Math.cos(y * 0.009 - t * 0.17) * 0.3 +
    Math.sin((x + y) * 0.007 + t * 0.11) * 0.2
  );
}

// ─────────────────────────────────────────────────────────────
//  FLOW FIELD
//  Returns a direction angle at canvas position (x, y) and time t.
// ─────────────────────────────────────────────────────────────
function flowAngle(x, y, t) {
  const s = 0.0022;
  const a = Math.sin(x * s + t * 0.28) * Math.PI * 2;
  const b = Math.cos(y * s + t * 0.17) * Math.PI;
  return a + b;
}

// ─────────────────────────────────────────────────────────────
//  PARTICLE SYSTEM — space-dust / nebula feel
//  Palette biased toward blue-violet-teal to suit the cosmic look.
// ─────────────────────────────────────────────────────────────
class Particle {
  constructor() { this.reset(true); }

  reset(fullReset = false) {
    this.x         = Math.random() * canvas.width;
    this.y         = Math.random() * canvas.height;
    this.size      = Math.random() * 1.6 + 0.3;
    this.life      = fullReset ? Math.random() : 1.0;
    this.decay     = Math.random() * 0.0025 + 0.001;
    // Hue offset biased toward blue-violet (-120 … +30 relative to base hue)
    this.hueOffset = Math.random() * 150 - 120;
    this.speed     = Math.random() * 0.55 + 0.2;
    this.twinkle   = Math.random() * Math.PI * 2; // random phase for twinkling
  }

  update(bassNorm, t) {
    const angle = flowAngle(this.x, this.y, t);
    const speed = this.speed + bassNorm * 1.4;
    this.x += Math.cos(angle) * speed;
    this.y += Math.sin(angle) * speed;
    this.life -= this.decay;
    this.twinkle += 0.04;

    if (
      this.life <= 0 ||
      this.x < -10 || this.x > canvas.width  + 10 ||
      this.y < -10 || this.y > canvas.height + 10
    ) {
      this.reset();
    }
  }

  draw(baseHue) {
    const twinkleFactor = 0.7 + 0.3 * Math.sin(this.twinkle);
    const alpha = this.life * 0.45 * twinkleFactor;
    const h     = baseHue + this.hueOffset;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${h}, 75%, 80%, ${alpha})`;
    ctx.shadowColor = `hsla(${h}, 100%, 85%, 0.2)`;
    ctx.shadowBlur  = 7;
    ctx.fill();
  }
}

const particles = Array.from({ length: 380 }, () => new Particle());

// ─────────────────────────────────────────────────────────────
//  STAR FIELD  — generated once, fixed in place
//  Three magnitude tiers (bright / mid / dim) give depth.
//  Stars are drawn every frame beneath all other layers.
// ─────────────────────────────────────────────────────────────
const STAR_COUNT = 320;
let stars = [];  // populated on first draw (canvas may not be sized yet)

function buildStarField(W, H) {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const tier  = Math.random();        // 0–1 → determines brightness
    stars.push({
      x       : Math.random() * W,
      y       : Math.random() * H,
      // Bright stars are rare; most are dim
      size    : tier > 0.97 ? Math.random() * 1.2 + 0.9   // bright
              : tier > 0.85 ? Math.random() * 0.7 + 0.4   // mid
              :               Math.random() * 0.35 + 0.1,  // dim
      alpha   : tier > 0.97 ? Math.random() * 0.5 + 0.5
              : tier > 0.85 ? Math.random() * 0.35 + 0.2
              :               Math.random() * 0.2  + 0.05,
      // Slow independent twinkle phase
      phase   : Math.random() * Math.PI * 2,
      tSpeed  : Math.random() * 0.6 + 0.2,
    });
  }
}

function drawStarField(t, overallNorm) {
  for (const s of stars) {
    // Twinkle: alpha oscillates gently around the base value
    const twinkle = 1 + 0.25 * Math.sin(s.phase + t * s.tSpeed);
    // Stars get very slightly brighter when sound is loud
    const a = Math.min(1, s.alpha * twinkle * (1 + overallNorm * 0.3));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 230, 255, ${a})`;
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
//  SHOCKWAVES — widened, softer rolling energy ripples
// ─────────────────────────────────────────────────────────────
const shockwaves = [];

function spawnShockwave(hue) {
  shockwaves.push({ r: 55, alpha: 0.7, hue, lineW: 3.5 });
}

function updateAndDrawShockwaves(cx, cy) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r      += 7;
    s.lineW  *= 0.97;           // line softens as it expands
    s.alpha  -= 0.014;
    if (s.alpha <= 0) { shockwaves.splice(i, 1); continue; }

    ctx.beginPath();
    ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${s.hue}, 70%, 85%, ${s.alpha})`;
    ctx.lineWidth   = s.lineW;
    ctx.shadowColor = `hsla(${s.hue}, 100%, 90%, ${s.alpha * 0.6})`;
    ctx.shadowBlur  = 20;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  RING PARTICLES  — tiny glowing specks orbiting the rings
//  They ride the same ellipse math as the rings, so they look
//  physically attached.  Audio speeds them up subtly.
// ─────────────────────────────────────────────────────────────
const RING_PARTICLE_COUNT = 55;
const ringParticles = Array.from({ length: RING_PARTICLE_COUNT }, (_, i) => ({
  // Assign to a random ring tier (0, 1, or 2)
  ringIdx  : Math.floor(Math.random() * RING_DEFS.length),
  // Angle along the ellipse (0 → 2π)
  angle    : Math.random() * Math.PI * 2,
  // Individual angular speed — vary so they don't clump
  angSpeed : (Math.random() * 0.008 + 0.003) * (Math.random() < 0.5 ? 1 : -1),
  // Brightness
  alpha    : Math.random() * 0.5 + 0.3,
  size     : Math.random() * 1.8 + 0.6,
  // Twinkling
  phase    : Math.random() * Math.PI * 2,
}));

function updateAndDrawRingParticles(cx, cy, planetR, hue, bassNorm, t, rotZ) {
  for (const rp of ringParticles) {
    const ring    = RING_DEFS[rp.ringIdx];
    const rx      = planetR * ring.xScale;
    const ry      = planetR * ring.yScale;

    // Advance angle (bass adds urgency)
    rp.angle += rp.angSpeed * (1 + bassNorm * 1.6);

    // Ellipse point — apply same tilt + rotZ as the visual rings
    const cosT = Math.cos(RING_TILT), sinT = Math.sin(RING_TILT);
    const ex   = rx * Math.cos(rp.angle);
    const ey   = ry * Math.sin(rp.angle);
    // Rotate by RING_TILT
    const rx2  = ex * cosT - ey * sinT;
    const ry2  = ex * sinT + ey * cosT;
    // Rotate by screen-plane precession (same as rings)
    const cosR = Math.cos(rotZ), sinR = Math.sin(rotZ);
    const px   = cx + rx2 * cosR - ry2 * sinR;
    const py   = cy + rx2 * sinR + ry2 * cosR;

    // Twinkle
    const tw = 0.6 + 0.4 * Math.sin(rp.phase + t * 1.4);
    const a  = rp.alpha * tw;

    const rHue = (hue + ring.hueOff + 200) % 360;
    ctx.beginPath();
    ctx.arc(px, py, rp.size, 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${rHue}, 80%, 92%, ${a})`;
    ctx.shadowColor = `hsla(${rHue}, 100%, 95%, ${a * 0.5})`;
    ctx.shadowBlur  = 6;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────
//  AUDIO SETUP
// ─────────────────────────────────────────────────────────────
async function startAudio() {
  const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new AudioContext();
  const source   = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize               = 512;
  analyser.smoothingTimeConstant = 0.88; // Web Audio first smooting pass
  source.connect(analyser);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const waveData = new Uint8Array(analyser.fftSize);
  draw(analyser, freqData, waveData);
}

// ─────────────────────────────────────────────────────────────
//  MOON  — small glowing body on a slow inclined circular orbit
//  Orbit radius is a fixed multiple of the planet radius so it
//  scales naturally with the planet.  Bass gently expands the
//  moon’s own halo so it “pulses” in sync with the beat.
// ─────────────────────────────────────────────────────────────
const MOON = {
  orbitSpeed : 0.07,    // radians per second (slow, majestic)
  orbitTilt  : 0.42,    // inclination of orbit plane (radians)
  orbitScale : 3.6,     // orbit radius = planetR * orbitScale
  moonScale  : 0.22,    // moon radius = planetR * moonScale
};

function drawMoon(cx, cy, planetR, hue, bassNorm, t) {
  const angle  = t * MOON.orbitSpeed;
  const oR     = planetR * MOON.orbitScale;
  const mR     = planetR * MOON.moonScale;

  // 3-D inclined orbit: rotate orbit plane around X-axis by tilt
  // x stays in screen-plane, y is foreshortened, z gives depth cue.
  const rawX = Math.cos(angle) * oR;
  const rawY = Math.sin(angle) * oR;
  const mx   = cx + rawX;
  const my   = cy + rawY * Math.cos(MOON.orbitTilt);
  const mz   = rawY * Math.sin(MOON.orbitTilt);  // positive = toward viewer

  // Depth cue: moon appears slightly smaller when behind, larger in front
  const depthScale = 1 + mz / (oR * 2.5) * 0.15;
  const mr = mR * depthScale;

  // Alpha reduced when z < 0 (behind planet)
  const depthAlpha = mz < -planetR * 0.4 ? 0.35 : 1.0;

  // Halo (atmospheric glow)
  const haloR = mr * (2.8 + bassNorm * 0.9);
  const mHue  = (hue + 170) % 360;
  const haloGrd = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, haloR);
  haloGrd.addColorStop(0,   `hsla(${mHue}, 80%, 75%, ${0.22 * depthAlpha})`);
  haloGrd.addColorStop(0.5, `hsla(${mHue}, 70%, 55%, ${0.08 * depthAlpha})`);
  haloGrd.addColorStop(1,   `hsla(${mHue}, 60%, 40%, 0)`);
  ctx.beginPath();
  ctx.arc(mx, my, haloR, 0, Math.PI * 2);
  ctx.fillStyle = haloGrd;
  ctx.fill();

  // Surface (small radial gradient sphere)
  const mSurface = ctx.createRadialGradient(
    mx - mr * 0.28, my - mr * 0.28, mr * 0.05,
    mx, my, mr
  );
  mSurface.addColorStop(0,    `hsla(${mHue + 30}, 90%, 92%, ${depthAlpha})`);
  mSurface.addColorStop(0.45, `hsla(${mHue + 10}, 75%, 65%, ${depthAlpha})`);
  mSurface.addColorStop(1,    `hsla(${mHue - 10}, 60%, 30%, ${depthAlpha * 0.9})`);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle   = mSurface;
  ctx.shadowColor = `hsla(${mHue}, 100%, 80%, ${0.4 * depthAlpha})`;
  ctx.shadowBlur  = 14;
  ctx.fill();
  ctx.shadowBlur  = 0;
}

// ─────────────────────────────────────────────────────────────
//  SMOOTHED AUDIO STATE  (persists across frames)
// ─────────────────────────────────────────────────────────────
let prevBassNorm = 0;
let bloomAlpha   = 0;   // beat bloom: full-screen flash that decays each frame
let sBass    = 0;
let sMid     = 0;
let sHigh    = 0;
let sOverall = 0;
let sPulse   = 0;

// Smoothed per-bin snapshot for energy waves
let sSmoothBins = null;

// ── Waveform rolling-average buffer ───────────────────────────
// Accumulates the last N waveData frames and averages them
// so the waveform ring is silky-smooth rather than steppy.
const WAVE_SMOOTH_FRAMES = 6;
let waveBuffer = null;   // Float32Array of length fftSize
let waveAccum  = null;   // running sum (Float32Array)

function smoothWave(rawWave) {
  const len = rawWave.length;
  if (!waveBuffer) {
    waveBuffer = new Float32Array(len).fill(128);
    waveAccum  = new Float32Array(len * WAVE_SMOOTH_FRAMES).fill(128);
  }
  // Shift oldest frame out, write newest frame in, recompute average
  const frameLen = len;
  for (let f = WAVE_SMOOTH_FRAMES - 1; f > 0; f--) {
    for (let i = 0; i < frameLen; i++) {
      waveAccum[f * frameLen + i] = waveAccum[(f - 1) * frameLen + i];
    }
  }
  for (let i = 0; i < frameLen; i++) {
    waveAccum[i] = rawWave[i];
  }
  for (let i = 0; i < frameLen; i++) {
    let sum = 0;
    for (let f = 0; f < WAVE_SMOOTH_FRAMES; f++) sum += waveAccum[f * frameLen + i];
    waveBuffer[i] = sum / WAVE_SMOOTH_FRAMES;
  }
  return waveBuffer;
}

// ── Idle breath ───────────────────────────────────────────────
// A gentle sine that drives visible motion even in silence.
// Amplitude is 1.0; callers scale it as needed.
function breath(t, period = 4.2) {
  return 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);
}

// ─────────────────────────────────────────────────────────────
//  PLANET CORE  — layered sphere  (Saturn-style render)
// ─────────────────────────────────────────────────────────────
function drawPlanet(cx, cy, radius, hue, bassNorm, t) {
  // ── 1. Outer atmosphere (large soft halo) ──────────────────
  const haloR = radius * 2.6;
  const halo  = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, haloR);
  halo.addColorStop(0,   `hsla(${hue + 220}, 90%, 60%, 0.18)`);
  halo.addColorStop(0.5, `hsla(${hue + 200}, 80%, 40%, 0.07)`);
  halo.addColorStop(1,   `hsla(${hue + 180}, 70%, 20%, 0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // ── 2. Surface gradient (deep navy → bright corona) ────────
  const surface = ctx.createRadialGradient(
    cx - radius * 0.28, cy - radius * 0.28, radius * 0.05,
    cx, cy, radius
  );
  const coreHue  = hue + 210;
  const crownHue = hue + 180;
  surface.addColorStop(0,    `hsla(${coreHue + 20}, 100%, 90%, 0.98)`);
  surface.addColorStop(0.35, `hsla(${coreHue},      90%, 60%, 0.92)`);
  surface.addColorStop(0.75, `hsla(${crownHue},     80%, 30%, 0.88)`);
  surface.addColorStop(1,    `hsla(${crownHue - 20},70%, 12%, 0.85)`);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = surface;
  ctx.shadowColor = `hsla(${hue + 200}, 100%, 70%, 0.5)`;
  ctx.shadowBlur  = 38;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // ── 3. Subtle banding (soft horizontal stripes like a gas giant) ─
  const bandCount = 5;
  for (let b = 0; b < bandCount; b++) {
    const frac  = b / (bandCount - 1);
    const yOff  = (frac - 0.5) * radius * 1.8;
    const bHue  = hue + 190 + b * 12;
    const bAlpha = 0.03 + Math.abs(frac - 0.5) * 0.04;
    const bH    = radius * 0.18 * (1 - Math.abs(frac - 0.5));

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + yOff, radius * 0.98, bH, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${bHue}, 60%, 75%, ${bAlpha})`;
    ctx.fill();
    ctx.restore();
  }

  // ── 4. Specular highlight (bright spot, upper-left) ────────
  const specGrd = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, 0,
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.55
  );
  specGrd.addColorStop(0,   `hsla(${hue + 240}, 100%, 98%, 0.55)`);
  specGrd.addColorStop(0.4, `hsla(${hue + 230}, 90%, 80%, 0.12)`);
  specGrd.addColorStop(1,   `hsla(${hue + 220}, 80%, 70%, 0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = specGrd;
  ctx.fill();

  // ── 5. Bass corona pulse ────────────────────────────────────
  const pulseAlpha = 0.08 + bassNorm * 0.28;
  const pulseGrd   = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.9);
  pulseGrd.addColorStop(0, `hsla(${hue + 200}, 100%, 80%, ${pulseAlpha})`);
  pulseGrd.addColorStop(1, `hsla(${hue + 200}, 100%, 60%, 0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = pulseGrd;
  ctx.fill();

  // ── 6. Treble shimmer — high-freq melody reacts here ───────
  // A fast, tighter corona that flares on treble hits.
  // Clipped to the planet disc so it reads as a surface effect.
  if (bassNorm > 0) {  // parameter reused; actual treble passed as arg below
    // (treble is forwarded via the bassNorm arg — see draw loop)
  }
  // The caller passes (bassNorm + trebleBoost) as the bass arg;
  // we split the "extra" part out here for a distinct colour.
  const trebleExtra = Math.max(0, bassNorm - 0.08);
  if (trebleExtra > 0.01) {
    const shimHue  = (hue + 280) % 360;   // violet-white shimmer
    const shimAlpha = trebleExtra * 0.5;
    const shimGrd  = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.1);
    shimGrd.addColorStop(0,   `hsla(${shimHue}, 100%, 98%, ${shimAlpha * 0.7})`);
    shimGrd.addColorStop(0.6, `hsla(${shimHue},  90%, 80%, ${shimAlpha * 0.3})`);
    shimGrd.addColorStop(1,   `hsla(${shimHue},  80%, 60%, 0)`);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = shimGrd;
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
//  NEBULA CLOUDS  — slow atmospheric blobs for spatial depth
//  Each blob is a large radial gradient drawn at a drifting
//  position.  They move so slowly they feel painted into space.
// ─────────────────────────────────────────────────────────────
const NEBULA_BLOBS = Array.from({ length: 6 }, (_, i) => ({
  phase : (i / 6) * Math.PI * 2,   // stagger around the clock
  speed : 0.018 + i * 0.004,       // each blob drifts at a different rate
  radius: 0,                        // set on first draw based on canvas size
  hueOff: i * 42,                   // spread hues so blobs contrast nicely
}));

function drawNebulaLayer(W, H, hue, overallNorm, t) {
  const cx = W / 2;
  const cy = H / 2;
  const span = Math.min(W, H) * 0.55;  // max displacement from center

  for (const blob of NEBULA_BLOBS) {
    // Lissajous-ish drift — never repeats exactly
    const bx = cx + Math.cos(t * blob.speed + blob.phase) * span * 0.7;
    const by = cy + Math.sin(t * blob.speed * 0.71 + blob.phase * 1.3) * span * 0.5;
    const br = Math.min(W, H) * (0.28 + 0.1 * Math.sin(blob.phase + t * 0.05));
    // Breathe softly with overall loudness
    const alpha = (0.04 + overallNorm * 0.055) * (0.6 + 0.4 * Math.sin(blob.phase + t * 0.12));
    const bHue  = (hue + blob.hueOff + 190) % 360;

    const grd = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grd.addColorStop(0,    `hsla(${bHue}, 70%, 55%, ${alpha})`);
    grd.addColorStop(0.45, `hsla(${bHue + 20}, 60%, 40%, ${alpha * 0.4})`);
    grd.addColorStop(1,    `hsla(${bHue + 40}, 50%, 25%, 0)`);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
//  ORBITAL RINGS  — Saturn-esque tilted ellipses
//  Returns a function to draw the FRONT arc (over the planet)
//  so the planet correctly occludes the back half of the ring.
// ─────────────────────────────────────────────────────────────
const RING_DEFS = [
  { xScale: 2.15, yScale: 0.22, alpha: 0.42, lineW: 3.4, hueOff:  10 },
  { xScale: 2.62, yScale: 0.27, alpha: 0.24, lineW: 1.9, hueOff:  30 },
  { xScale: 3.08, yScale: 0.32, alpha: 0.14, lineW: 1.3, hueOff:  50 },
];

// tilt angle (radians) for all rings — shared so back/front match exactly.
const RING_TILT = Math.PI * 0.18;

// drawOrbitalRings draws only the BACK half (behind the planet) and
// returns a closure that the caller should invoke AFTER painting the
// planet to draw the FRONT half (over the planet).
function drawOrbitalRings(cx, cy, radius, hue, bassNorm, t) {
  const rotZ = t * 0.012;  // very slow screen-plane precession

  // Collect ring params first (same values needed for back and front)
  const rings = RING_DEFS.map(ring => ({
    rx    : radius * ring.xScale + bassNorm * radius * 0.16,
    ry    : radius * ring.yScale,
    rHue  : (hue + ring.hueOff + 200) % 360,
    alpha : ring.alpha + bassNorm * 0.10,
    lineW : ring.lineW,
  }));

  function strokeRing(r, startAngle, endAngle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotZ);
    ctx.beginPath();
    ctx.ellipse(0, 0, r.rx, r.ry, RING_TILT, startAngle, endAngle);
    ctx.strokeStyle = `hsla(${r.rHue}, 65%, 82%, ${r.alpha})`;
    ctx.lineWidth   = r.lineW;
    ctx.shadowColor = `hsla(${r.rHue}, 100%, 88%, ${r.alpha * 0.5})`;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── Draw BACK arc (π → 2π, i.e. bottom half of the ellipse)
  for (const r of rings) strokeRing(r, Math.PI, Math.PI * 2);

  // ── Return closure to draw FRONT arc (0 → π, top half)
  return () => {
    for (const r of rings) strokeRing(r, 0, Math.PI);
  };
}

// ─────────────────────────────────────────────────────────────
//  ENERGY WAVES  — smooth, soft radial pulses from each band
//  Replaces the raw hard frequency bars with feathered arcs.
// ─────────────────────────────────────────────────────────────
function drawEnergyWaves(cx, cy, innerR, hue, smoothBins, t) {
  // Combine bins into a smaller set of "spokes" — smoother and less noisy
  const spokeCount = 120; // number of spokes around the circle
  const maxLen     = Math.min(canvas.width, canvas.height) * 0.28;
  const binCount   = smoothBins.length;
  const angleStep  = (Math.PI * 2) / spokeCount;
  // Slow angular drift to make waves feel alive
  const drift      = t * 0.06;

  for (let i = 0; i < spokeCount; i++) {
    const binIdx = Math.floor((i / spokeCount) * binCount);
    const value  = smoothBins[binIdx];              // 0–255 smoothed
    const len    = map(value, 0, 255, 0, maxLen);

    if (len < 1) continue;

    const angle  = i * angleStep - Math.PI / 2 + drift;
    const bHue   = (hue + (i / spokeCount) * 140 + 200) % 360;
    const alpha  = map(value, 0, 255, 0, 0.55);

    // Gradient spoke: bright at base, fades to zero at tip
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * (innerR + len);
    const y2 = cy + Math.sin(angle) * (innerR + len);

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0,   `hsla(${bHue}, 80%, 75%, ${alpha * 0.8})`);
    grad.addColorStop(0.6, `hsla(${bHue}, 70%, 65%, ${alpha * 0.4})`);
    grad.addColorStop(1,   `hsla(${bHue}, 60%, 55%, 0)`);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 2.2;
    ctx.shadowColor = `hsla(${bHue}, 100%, 80%, ${alpha * 0.3})`;
    ctx.shadowBlur  = 8;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────
//  CIRCULAR WAVEFORM RING  — silky-smooth via rolling buffer
//  Uses the pre-averaged waveBuffer from smoothWave() so the
//  ring outline stays fluid rather than jittering sample-by-sample.
// ─────────────────────────────────────────────────────────────
function drawWaveRing(cx, cy, radius, hue, smoothedWave, overallNorm, idleBr) {
  const waveRadius = radius * 1.82;
  // Idle breath adds a subtle pulsing deviation even in silence
  const idleAmp   = idleBr * 4;
  const wStep     = (Math.PI * 2) / smoothedWave.length;
  ctx.beginPath();
  for (let i = 0; i < smoothedWave.length; i++) {
    const deviation = ((smoothedWave[i] / 128) - 1) * 26 + idleAmp;
    const angle     = i * wStep - Math.PI / 2;
    const r         = waveRadius + deviation;
    const x         = cx + Math.cos(angle) * r;
    const y         = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const ringHue = (hue + 150) % 360;
  ctx.strokeStyle = `hsla(${ringHue}, 72%, 82%, ${map(overallNorm, 0, 1, 0.08, 0.50)})`;
  ctx.lineWidth   = 1.2;
  ctx.shadowColor = `hsla(${ringHue}, 90%, 88%, 0.32)`;
  ctx.shadowBlur  = 11;
  ctx.stroke();
  ctx.shadowBlur  = 0;
}

// ─────────────────────────────────────────────────────────────
//  DEEP-SPACE VIGNETTE  — radial darkening at edges
// ─────────────────────────────────────────────────────────────
function drawVignette(W, H) {
  const vgr = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  vgr.addColorStop(0, "rgba(0,0,0,0)");
  vgr.addColorStop(1, "rgba(0,0,6,0.68)");
  ctx.fillStyle = vgr;
  ctx.fillRect(0, 0, W, H);
}

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

  // ── Raw audio ──────────────────────────────────────────────
  const rawBass    = avg(freqData,  0,  10) / 255;
  const rawMid     = avg(freqData, 10,  80) / 255;
  const rawHigh    = avg(freqData, 80, 180) / 255;
  const rawOverall = avg(freqData,  0, binCount) / 255;

  // ── Smoothed values (manual lerp, second layer) ────────────
  sBass    = lerp(sBass,    rawBass,    0.07);
  sMid     = lerp(sMid,     rawMid,     0.06);
  sHigh    = lerp(sHigh,    rawHigh,    0.05);
  sOverall = lerp(sOverall, rawOverall, 0.05);

  const bassNorm    = sBass;
  const midNorm     = sMid;
  const overallNorm = sOverall;

  // ── Smoothed per-bin snapshot (used for energy waves) ──────
  if (!sSmoothBins) sSmoothBins = new Float32Array(binCount).fill(0);
  for (let i = 0; i < binCount; i++) {
    sSmoothBins[i] = lerp(sSmoothBins[i], freqData[i], 0.10);
  }

  // ── Hue — drifts slowly with time, nudged by mids ──────────
  // Base hue in the deep blue range (200–260) → space feel
  const hue = (Date.now() * 0.008 + midNorm * 40 + 220) % 360;

  // ── Beat detection (raw → still snappy) ───────────────────
  if (rawBass > 0.55 && prevBassNorm < 0.45) {
    spawnShockwave(hue);
    bloomAlpha = 0.12 + rawBass * 0.10;  // stronger hit → brighter flash
  }
  prevBassNorm = rawBass;

  // ── Planet radius — smoothly interpolated ──────────────────
  const baseRadius  = Math.min(W, H) * 0.095;
  const targetPulse = baseRadius + bassNorm * Math.min(W, H) * 0.04;
  sPulse            = lerp(sPulse, targetPulse, 0.08);
  const planetR     = sPulse;

  // ── Time (seconds) ─────────────────────────────────────────
  const t = Date.now() * 0.001;

  // ── Idle breath ── always-on sine so scene stays alive in silence
  const idleBr = breath(t, 4.2);

  // ── Smooth waveform via rolling buffer ────────────────────────
  const smoothedWave = smoothWave(waveData);

  // ── Ring precession angle ─ shared by rings + ring particles ──
  const rotZ = t * 0.012;

  // ================================================================
  //  RENDER LAYERS  (back to front)
  // ================================================================

  // · Background fade trail
  ctx.shadowBlur = 0;
  ctx.fillStyle  = "rgba(0, 0, 4, 0.14)";
  ctx.fillRect(0, 0, W, H);

  // · Static star field (deepest fixed layer)
  if (stars.length === 0) buildStarField(W, H);
  drawStarField(t, overallNorm);

  // · Flow-field star-dust particles
  for (const p of particles) { p.update(bassNorm, t); p.draw(hue); }

  // · Nebula cloud layer — atmospheric depth, behind vignette
  drawNebulaLayer(W, H, hue, overallNorm, t);

  // · Deep-space vignette — darkens edges, focuses eye on center
  drawVignette(W, H);

  // · Energy waves radiating from planet surface
  const innerR = planetR + 12;
  drawEnergyWaves(cx, cy, innerR, hue, sSmoothBins, t);

  // · Smoothed waveform ring (soft spatial boundary)
  drawWaveRing(cx, cy, innerR + Math.min(W, H) * 0.27, hue, smoothedWave, overallNorm, idleBr);

  // · Shockwave ripples (beat-triggered)
  updateAndDrawShockwaves(cx, cy);

  // · Orbital rings — BACK arc (behind planet)
  const drawRingFront = drawOrbitalRings(cx, cy, planetR, hue, bassNorm, t);

  // · Ring orbiting particles — BACK half (same z-order as ring back)
  updateAndDrawRingParticles(cx, cy, planetR, hue, bassNorm, t, rotZ);

  // · Planet core  (bass + treble shimmer routed via bassNorm arg)
  const trebleBoost = sHigh * 0.18;
  drawPlanet(cx, cy, planetR, hue, bassNorm + idleBr * 0.04 + trebleBoost, t);

  // · Orbital rings — FRONT arc (over planet, occlusion effect)
  drawRingFront();

  // · Moon (orbits proudly above everything except bloom)
  drawMoon(cx, cy, planetR, hue, bassNorm, t);

  // · Outer presence ring — subtle boundary marker
  const outerR    = innerR + Math.min(W, H) * 0.32;
  const ringAlpha = map(overallNorm + idleBr * 0.03, 0, 1, 0.02, 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${(hue + 90) % 360}, 45%, 65%, ${ringAlpha})`;
  ctx.lineWidth   = 1;
  ctx.shadowBlur  = 0;
  ctx.stroke();

  // · Beat bloom — full-screen radial flash, decays ~18 frames
  if (bloomAlpha > 0.002) {
    const bloomGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bloomGrd.addColorStop(0,   `hsla(${hue}, 80%, 90%, ${bloomAlpha})`);
    bloomGrd.addColorStop(0.4, `hsla(${hue}, 70%, 70%, ${bloomAlpha * 0.3})`);
    bloomGrd.addColorStop(1,   `hsla(${hue}, 60%, 50%, 0)`);
    ctx.fillStyle = bloomGrd;
    ctx.fillRect(0, 0, W, H);
    bloomAlpha *= 0.80;  // exponential decay — gone in ~18 frames
  }
}
