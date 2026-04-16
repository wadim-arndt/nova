// ─────────────────────────────────────────────────────────────
//  NOVA — Noise Oriented Visual Aesthetics
//  Cosmic, audio-reactive space visualizer
//  Vanilla JS + HTML Canvas + Web Audio API
// ─────────────────────────────────────────────────────────────

// ── Canvas setup ──────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];          // force star-field rebuild at new dimensions
}
resize();
window.addEventListener('resize', resize);

// ── Overlay / Start button ────────────────────────────────────
const overlay  = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
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

// Linear interpolation — applied each frame for organic smoothing.
function lerp(a, b, t) { return a + (b - a) * t; }

// Slow sine wave — drives idle motion even in silence.
function breath(t, period = 4.2) {
  return 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);
}

// ─────────────────────────────────────────────────────────────
//  AUDIO STATE  (module-level so values persist across frames)
// ─────────────────────────────────────────────────────────────
let prevBassRaw = 0;
let bloomAlpha  = 0;          // beat bloom: decays each frame
let sBass = 0, sMid = 0, sHigh = 0, sOverall = 0;
let sPulse = -1;              // -1 = uninitialised; set on first draw
let sSmoothBins = null;       // smoothed per-bin magnitude array

// Waveform rolling-average buffer (removes sample-level jitter)
const WAVE_FRAMES = 6;
let waveBuf = null;
let waveAcc = null;

function smoothWave(raw) {
  const len = raw.length;
  if (!waveBuf) {
    waveBuf = new Float32Array(len).fill(128);
    waveAcc = new Float32Array(len * WAVE_FRAMES).fill(128);
  }
  // Shift frames back, write newest at index 0
  for (let f = WAVE_FRAMES - 1; f > 0; f--)
    for (let i = 0; i < len; i++)
      waveAcc[f * len + i] = waveAcc[(f - 1) * len + i];
  for (let i = 0; i < len; i++) waveAcc[i] = raw[i];
  // Compute average
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let f = 0; f < WAVE_FRAMES; f++) s += waveAcc[f * len + i];
    waveBuf[i] = s / WAVE_FRAMES;
  }
  return waveBuf;
}

// ─────────────────────────────────────────────────────────────
//  FLOW FIELD
// ─────────────────────────────────────────────────────────────
function flowAngle(x, y, t) {
  const s = 0.0022;
  return Math.sin(x * s + t * 0.28) * Math.PI * 2
       + Math.cos(y * s + t * 0.17) * Math.PI;
}

// ─────────────────────────────────────────────────────────────
//  PARTICLE SYSTEM  — space-dust / nebula feel
//  Palette biased to blue-violet to suit the cosmic look.
// ─────────────────────────────────────────────────────────────
class Particle {
  constructor() { this.reset(true); }

  reset(stagger = false) {
    this.x         = Math.random() * canvas.width;
    this.y         = Math.random() * canvas.height;
    this.size      = Math.random() * 1.6 + 0.3;
    this.life      = stagger ? Math.random() : 1.0;
    this.decay     = Math.random() * 0.0025 + 0.001;
    this.hueOffset = Math.random() * 150 - 120;   // blue-violet bias
    this.speed     = Math.random() * 0.55 + 0.2;
    this.twinkle   = Math.random() * Math.PI * 2;
  }

  update(bassNorm, t) {
    const angle = flowAngle(this.x, this.y, t);
    this.x += Math.cos(angle) * (this.speed + bassNorm * 1.4);
    this.y += Math.sin(angle) * (this.speed + bassNorm * 1.4);
    this.life    -= this.decay;
    this.twinkle += 0.04;
    if (this.life <= 0 ||
        this.x < -10 || this.x > canvas.width  + 10 ||
        this.y < -10 || this.y > canvas.height + 10)
      this.reset(false);
  }

  draw(baseHue) {
    const tw = 0.7 + 0.3 * Math.sin(this.twinkle);
    const h  = baseHue + this.hueOffset;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${h},75%,80%,${this.life * 0.45 * tw})`;
    ctx.shadowColor = `hsla(${h},100%,85%,0.2)`;
    ctx.shadowBlur  = 7;
    ctx.fill();
  }
}

const particles = Array.from({ length: 380 }, () => new Particle());

// ─────────────────────────────────────────────────────────────
//  STAR FIELD  — generated once per canvas size, then static
//  Three magnitude tiers (bright / mid / dim) give visual depth.
// ─────────────────────────────────────────────────────────────
let stars = [];

function buildStarField(W, H) {
  stars = [];
  for (let i = 0; i < 320; i++) {
    const t = Math.random();
    stars.push({
      x      : Math.random() * W,
      y      : Math.random() * H,
      size   : t > 0.97 ? Math.random() * 1.2 + 0.9
              : t > 0.85 ? Math.random() * 0.7 + 0.4
              :             Math.random() * 0.35 + 0.1,
      alpha  : t > 0.97 ? Math.random() * 0.5 + 0.5
              : t > 0.85 ? Math.random() * 0.35 + 0.2
              :             Math.random() * 0.2 + 0.05,
      phase  : Math.random() * Math.PI * 2,
      tSpeed : Math.random() * 0.6 + 0.2,
    });
  }
}

function drawStarField(t, overallNorm) {
  ctx.shadowBlur = 0;
  for (const s of stars) {
    const tw = 1 + 0.25 * Math.sin(s.phase + t * s.tSpeed);
    const a  = Math.min(1, s.alpha * tw * (1 + overallNorm * 0.3));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,230,255,${a})`;
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
//  RING CONSTANTS
//  Defined here — before ringParticles, which references them.
// ─────────────────────────────────────────────────────────────
const RING_DEFS = [
  { xScale: 2.15, yScale: 0.22, alpha: 0.42, lineW: 3.4, hueOff:  10 },
  { xScale: 2.62, yScale: 0.27, alpha: 0.24, lineW: 1.9, hueOff:  30 },
  { xScale: 3.08, yScale: 0.32, alpha: 0.14, lineW: 1.3, hueOff:  50 },
];
const RING_TILT = Math.PI * 0.18;

// ─────────────────────────────────────────────────────────────
//  RING PARTICLES  — tiny specks orbiting the rings
//  Uses RING_DEFS above; must come after that declaration.
// ─────────────────────────────────────────────────────────────
const ringParticles = Array.from({ length: 55 }, () => ({
  ringIdx  : Math.floor(Math.random() * RING_DEFS.length),
  angle    : Math.random() * Math.PI * 2,
  angSpeed : (Math.random() * 0.008 + 0.003) * (Math.random() < 0.5 ? 1 : -1),
  alpha    : Math.random() * 0.5 + 0.3,
  size     : Math.random() * 1.8 + 0.6,
  phase    : Math.random() * Math.PI * 2,
}));

function drawRingParticles(cx, cy, planetR, hue, bassNorm, t, rotZ) {
  const cosT = Math.cos(RING_TILT), sinT = Math.sin(RING_TILT);
  const cosR = Math.cos(rotZ),      sinR = Math.sin(rotZ);
  for (const rp of ringParticles) {
    const ring = RING_DEFS[rp.ringIdx];
    const rx   = planetR * ring.xScale;
    const ry   = planetR * ring.yScale;
    rp.angle  += rp.angSpeed * (1 + bassNorm * 1.6);
    const ex  = rx * Math.cos(rp.angle);
    const ey  = ry * Math.sin(rp.angle);
    // Apply ring tilt then screen-plane precession rotation
    const rx2 = ex * cosT - ey * sinT;
    const ry2 = ex * sinT + ey * cosT;
    const px  = cx + rx2 * cosR - ry2 * sinR;
    const py  = cy + rx2 * sinR + ry2 * cosR;
    const tw  = 0.6 + 0.4 * Math.sin(rp.phase + t * 1.4);
    const a   = rp.alpha * tw;
    const rHue = (hue + ring.hueOff + 200) % 360;
    ctx.beginPath();
    ctx.arc(px, py, rp.size, 0, Math.PI * 2);
    ctx.fillStyle   = `hsla(${rHue},80%,92%,${a})`;
    ctx.shadowColor = `hsla(${rHue},100%,95%,${a * 0.5})`;
    ctx.shadowBlur  = 6;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────
//  SHOCKWAVES  — beat-triggered expanding rings
// ─────────────────────────────────────────────────────────────
const shockwaves = [];

function spawnShockwave(hue) {
  shockwaves.push({ r: 55, alpha: 0.7, hue, lineW: 3.5 });
}

function drawShockwaves(cx, cy) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r     += 7;
    s.lineW *= 0.97;
    s.alpha -= 0.014;
    if (s.alpha <= 0) { shockwaves.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${s.hue},70%,85%,${s.alpha})`;
    ctx.lineWidth   = s.lineW;
    ctx.shadowColor = `hsla(${s.hue},100%,90%,${s.alpha * 0.6})`;
    ctx.shadowBlur  = 20;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  MOON  — small body on a slow inclined orbit
// ─────────────────────────────────────────────────────────────
const MOON = { speed: 0.07, tilt: 0.42, orbitScale: 3.6, bodyScale: 0.22 };

function drawMoon(cx, cy, planetR, hue, bassNorm, t) {
  const oR    = planetR * MOON.orbitScale;
  const mR    = planetR * MOON.bodyScale;
  const angle = t * MOON.speed;
  const rawX  = Math.cos(angle) * oR;
  const rawY  = Math.sin(angle) * oR;
  const mx    = cx + rawX;
  const my    = cy + rawY * Math.cos(MOON.tilt);
  const mz    = rawY * Math.sin(MOON.tilt);       // depth (+ = toward viewer)
  const mr    = Math.max(mR * (1 + (mz / Math.max(oR * 2.5, 1)) * 0.15), 1);
  const dA    = mz < -planetR * 0.4 ? 0.35 : 1.0; // fade when behind planet
  const mHue  = (hue + 170) % 360;

  // Atmospheric halo
  const haloR = Math.max(mr * (2.8 + bassNorm * 0.9), mr + 2);
  const hGrd  = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, haloR);
  hGrd.addColorStop(0,   `hsla(${mHue},80%,75%,${0.22 * dA})`);
  hGrd.addColorStop(0.5, `hsla(${mHue},70%,55%,${0.08 * dA})`);
  hGrd.addColorStop(1,   `hsla(${mHue},60%,40%,0)`);
  ctx.beginPath();
  ctx.arc(mx, my, haloR, 0, Math.PI * 2);
  ctx.fillStyle = hGrd;
  ctx.fill();

  // Surface sphere
  const sGrd = ctx.createRadialGradient(
    mx - mr * 0.28, my - mr * 0.28, mr * 0.05,
    mx, my, mr
  );
  sGrd.addColorStop(0,    `hsla(${mHue + 30},90%,92%,${dA})`);
  sGrd.addColorStop(0.45, `hsla(${mHue + 10},75%,65%,${dA})`);
  sGrd.addColorStop(1,    `hsla(${mHue - 10},60%,30%,${dA * 0.9})`);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle   = sGrd;
  ctx.shadowColor = `hsla(${mHue},100%,80%,${0.4 * dA})`;
  ctx.shadowBlur  = 14;
  ctx.fill();
  ctx.shadowBlur  = 0;
}

// ─────────────────────────────────────────────────────────────
//  PLANET CORE  — layered Saturn-inspired sphere
//    bassNorm : smoothed bass energy (0–1)
//    highNorm : smoothed treble energy (0–1)
// ─────────────────────────────────────────────────────────────
function drawPlanet(cx, cy, radius, hue, bassNorm, highNorm) {
  const r = Math.max(radius, 2);

  // 1. Outer atmospheric halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.6);
  halo.addColorStop(0,   `hsla(${hue + 220},90%,60%,0.18)`);
  halo.addColorStop(0.5, `hsla(${hue + 200},80%,40%,0.07)`);
  halo.addColorStop(1,   `hsla(${hue + 180},70%,20%,0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // 2. Planet surface gradient (off-centre focal point → 3-D feel)
  const surf = ctx.createRadialGradient(
    cx - r * 0.28, cy - r * 0.28, r * 0.05,
    cx, cy, r
  );
  surf.addColorStop(0,    `hsla(${hue + 230},100%,90%,0.98)`);
  surf.addColorStop(0.35, `hsla(${hue + 210}, 90%,60%,0.92)`);
  surf.addColorStop(0.75, `hsla(${hue + 180}, 80%,30%,0.88)`);
  surf.addColorStop(1,    `hsla(${hue + 160}, 70%,12%,0.85)`);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = surf;
  ctx.shadowColor = `hsla(${hue + 200},100%,70%,0.5)`;
  ctx.shadowBlur  = 38;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // 3. Gas-giant banding (5 soft elliptical stripes)
  for (let b = 0; b < 5; b++) {
    const frac  = b / 4;
    const yOff  = (frac - 0.5) * r * 1.8;
    const bH    = Math.max(r * 0.18 * (1 - Math.abs(frac - 0.5)), 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + yOff, r * 0.98, bH, 0, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue + 190 + b * 12},60%,75%,${0.03 + Math.abs(frac - 0.5) * 0.04})`;
    ctx.fill();
    ctx.restore();
  }

  // 4. Specular highlight (upper-left)
  const spec = ctx.createRadialGradient(
    cx - r * 0.3, cy - r * 0.3, 0,
    cx - r * 0.3, cy - r * 0.3, r * 0.55
  );
  spec.addColorStop(0,   `hsla(${hue + 240},100%,98%,0.55)`);
  spec.addColorStop(0.4, `hsla(${hue + 230}, 90%,80%,0.12)`);
  spec.addColorStop(1,   `hsla(${hue + 220}, 80%,70%,0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = spec;
  ctx.fill();

  // 5. Bass corona — glows with low frequencies
  const pa   = 0.08 + bassNorm * 0.28;
  const pGrd = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.9);
  pGrd.addColorStop(0, `hsla(${hue + 200},100%,80%,${pa})`);
  pGrd.addColorStop(1, `hsla(${hue + 200},100%,60%,0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = pGrd;
  ctx.fill();

  // 6. Treble shimmer — violet-white, fires with high frequencies
  if (highNorm > 0.05) {
    const shimHue = (hue + 280) % 360;
    const sA      = highNorm * 0.4;
    const sGrd    = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.1);
    sGrd.addColorStop(0,   `hsla(${shimHue},100%,98%,${sA * 0.7})`);
    sGrd.addColorStop(0.6, `hsla(${shimHue}, 90%,80%,${sA * 0.3})`);
    sGrd.addColorStop(1,   `hsla(${shimHue}, 80%,60%,0)`);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = sGrd;
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
//  NEBULA BLOBS  — slow drifting large gradients (spatial depth)
// ─────────────────────────────────────────────────────────────
const NEBULA_BLOBS = Array.from({ length: 6 }, (_, i) => ({
  phase  : (i / 6) * Math.PI * 2,
  speed  : 0.018 + i * 0.004,
  hueOff : i * 42,
}));

function drawNebula(W, H, hue, overallNorm, t) {
  const cx   = W / 2, cy = H / 2;
  const span = Math.min(W, H) * 0.55;
  for (const blob of NEBULA_BLOBS) {
    const bx    = cx + Math.cos(t * blob.speed + blob.phase) * span * 0.7;
    const by    = cy + Math.sin(t * blob.speed * 0.71 + blob.phase * 1.3) * span * 0.5;
    const br    = Math.max(Math.min(W, H) * (0.28 + 0.1 * Math.sin(blob.phase + t * 0.05)), 1);
    const alpha = (0.04 + overallNorm * 0.055) * (0.6 + 0.4 * Math.sin(blob.phase + t * 0.12));
    const bHue  = (hue + blob.hueOff + 190) % 360;
    const grd   = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grd.addColorStop(0,    `hsla(${bHue},70%,55%,${alpha})`);
    grd.addColorStop(0.45, `hsla(${bHue + 20},60%,40%,${alpha * 0.4})`);
    grd.addColorStop(1,    `hsla(${bHue + 40},50%,25%,0)`);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
//  ORBITAL RINGS  — Saturn-esque tilted ellipses
//  Draws only the BACK half, returns fn to draw the FRONT half
//  so the planet correctly occludes the ring behind it.
// ─────────────────────────────────────────────────────────────
function drawOrbitalRings(cx, cy, planetR, hue, bassNorm, rotZ) {
  const rings = RING_DEFS.map(rd => ({
    rx   : planetR * rd.xScale + bassNorm * planetR * 0.16,
    ry   : planetR * rd.yScale,
    rHue : (hue + rd.hueOff + 200) % 360,
    alpha: rd.alpha + bassNorm * 0.10,
    lineW: rd.lineW,
  }));

  function strokeArc(r, a0, a1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotZ);
    ctx.beginPath();
    ctx.ellipse(0, 0, r.rx, r.ry, RING_TILT, a0, a1);
    ctx.strokeStyle = `hsla(${r.rHue},65%,82%,${r.alpha})`;
    ctx.lineWidth   = r.lineW;
    ctx.shadowColor = `hsla(${r.rHue},100%,88%,${r.alpha * 0.5})`;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // Back arc (π → 2π, behind the planet)
  for (const r of rings) strokeArc(r, Math.PI, Math.PI * 2);
  // Return closure to draw front arc (0 → π, over the planet)
  return () => { for (const r of rings) strokeArc(r, 0, Math.PI); };
}

// ─────────────────────────────────────────────────────────────
//  ENERGY WAVES  — feathered gradient spokes from planet edge
// ─────────────────────────────────────────────────────────────
function drawEnergyWaves(cx, cy, innerR, hue, smoothBins, t) {
  const spokeCnt = 120;
  const maxLen   = Math.min(canvas.width, canvas.height) * 0.28;
  const binCount = smoothBins.length;
  const drift    = t * 0.06;
  for (let i = 0; i < spokeCnt; i++) {
    const val   = smoothBins[Math.floor((i / spokeCnt) * binCount)];
    const len   = map(val, 0, 255, 0, maxLen);
    if (len < 1) continue;
    const angle = i * (Math.PI * 2 / spokeCnt) - Math.PI / 2 + drift;
    const bHue  = (hue + (i / spokeCnt) * 140 + 200) % 360;
    const alpha = map(val, 0, 255, 0, 0.55);
    const x1    = cx + Math.cos(angle) * innerR;
    const y1    = cy + Math.sin(angle) * innerR;
    const x2    = cx + Math.cos(angle) * (innerR + len);
    const y2    = cy + Math.sin(angle) * (innerR + len);
    const grd   = ctx.createLinearGradient(x1, y1, x2, y2);
    grd.addColorStop(0,   `hsla(${bHue},80%,75%,${alpha * 0.8})`);
    grd.addColorStop(0.6, `hsla(${bHue},70%,65%,${alpha * 0.4})`);
    grd.addColorStop(1,   `hsla(${bHue},60%,55%,0)`);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = grd;
    ctx.lineWidth   = 2.2;
    ctx.shadowColor = `hsla(${bHue},100%,80%,${alpha * 0.3})`;
    ctx.shadowBlur  = 8;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────
//  WAVEFORM RING  — smoothed circular outline
// ─────────────────────────────────────────────────────────────
function drawWaveRing(cx, cy, waveRadius, hue, smoothedWave, overallNorm, idleBr) {
  const step = (Math.PI * 2) / smoothedWave.length;
  ctx.beginPath();
  for (let i = 0; i < smoothedWave.length; i++) {
    const dev = ((smoothedWave[i] / 128) - 1) * 26 + idleBr * 4;
    const ang = i * step - Math.PI / 2;
    const r   = waveRadius + dev;
    const x   = cx + Math.cos(ang) * r;
    const y   = cy + Math.sin(ang) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  const rHue = (hue + 150) % 360;
  ctx.strokeStyle = `hsla(${rHue},72%,82%,${map(overallNorm, 0, 1, 0.08, 0.50)})`;
  ctx.lineWidth   = 1.2;
  ctx.shadowColor = `hsla(${rHue},90%,88%,0.32)`;
  ctx.shadowBlur  = 11;
  ctx.stroke();
  ctx.shadowBlur  = 0;
}

// ─────────────────────────────────────────────────────────────
//  VIGNETTE  — dark radial gradient at edges
// ─────────────────────────────────────────────────────────────
function drawVignette(W, H) {
  const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,6,0.68)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────────────────────
//  AUDIO SETUP
// ─────────────────────────────────────────────────────────────
async function startAudio() {
  try {
    const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source   = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize               = 512;
    analyser.smoothingTimeConstant = 0.88;
    source.connect(analyser);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const waveData = new Uint8Array(analyser.fftSize);
    draw(analyser, freqData, waveData);
  } catch (err) {
    console.error('NOVA: microphone access failed —', err);
    // Restore overlay so user can try again or see the error
    overlay.classList.remove('hidden');
    startBtn.textContent = 'MIC BLOCKED — RETRY';
  }
}

// ─────────────────────────────────────────────────────────────
//  DRAW LOOP
// ─────────────────────────────────────────────────────────────
function draw(analyser, freqData, waveData) {
  requestAnimationFrame(() => draw(analyser, freqData, waveData));
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(waveData);

  const W  = canvas.width,  H  = canvas.height;
  const cx = W / 2,         cy = H / 2;
  const N  = freqData.length;
  const t  = performance.now() * 0.001;     // seconds, high-resolution

  // ── Raw audio values ────────────────────────────────────────
  const rawBass    = avg(freqData,  0,  10) / 255;
  const rawMid     = avg(freqData, 10,  80) / 255;
  const rawHigh    = avg(freqData, 80, 180) / 255;
  const rawOverall = avg(freqData,  0,   N) / 255;

  // ── Smoothed values (lerp — kills jitter) ───────────────────
  sBass    = lerp(sBass,    rawBass,    0.07);
  sMid     = lerp(sMid,     rawMid,     0.06);
  sHigh    = lerp(sHigh,    rawHigh,    0.05);
  sOverall = lerp(sOverall, rawOverall, 0.05);

  // ── Per-bin smooth array (for energy waves) ─────────────────
  if (!sSmoothBins) sSmoothBins = new Float32Array(N).fill(0);
  for (let i = 0; i < N; i++)
    sSmoothBins[i] = lerp(sSmoothBins[i], freqData[i], 0.10);

  // ── Derived values ──────────────────────────────────────────
  const hue    = (t * 8 + sMid * 40 + 220) % 360;  // blue-range base hue
  const rotZ   = t * 0.012;                          // ring precession
  const idleBr = breath(t);

  // ── Planet radius (smoothly lerped, avoids snapping) ────────
  const baseR = Math.min(W, H) * 0.095;
  if (sPulse < 0) sPulse = baseR;                     // initialise once
  sPulse = lerp(sPulse, baseR + sBass * Math.min(W, H) * 0.04, 0.08);
  const planetR = sPulse;

  // ── Beat detection — fires on rising bass edge ──────────────
  if (rawBass > 0.55 && prevBassRaw < 0.45) {
    spawnShockwave(hue);
    bloomAlpha = 0.12 + rawBass * 0.10;
  }
  prevBassRaw = rawBass;

  // ── Smoothed waveform ───────────────────────────────────────
  const sWave = smoothWave(waveData);

  // ── Build star field on demand ──────────────────────────────
  if (stars.length === 0) buildStarField(W, H);

  // ================================================================
  //  RENDER LAYERS  (back → front)
  // ================================================================

  // [1] Fade trail — gives ghost trails to particles
  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(0,0,4,0.14)';
  ctx.fillRect(0, 0, W, H);

  // [2] Star field — deepest, static layer
  drawStarField(t, sOverall);

  // [3] Flow-field particles — space dust, blue-violet palette
  for (const p of particles) { p.update(sBass, t); p.draw(hue); }

  // [4] Nebula blobs — large drifting atmospheric gradients
  drawNebula(W, H, hue, sOverall, t);

  // [5] Vignette — darkens edges, focuses eye on center
  drawVignette(W, H);

  // [6] Energy waves — feathered spokes radiating from planet
  const innerR = planetR + 12;
  drawEnergyWaves(cx, cy, innerR, hue, sSmoothBins, t);

  // [7] Waveform ring — fluid circular outline
  drawWaveRing(cx, cy, innerR + Math.min(W, H) * 0.27, hue, sWave, sOverall, idleBr);

  // [8] Shockwave ripples — beat-triggered
  drawShockwaves(cx, cy);

  // [9] Ring back arc + ring particles (behind planet)
  const drawRingFront = drawOrbitalRings(cx, cy, planetR, hue, sBass, rotZ);
  drawRingParticles(cx, cy, planetR, hue, sBass, t, rotZ);

  // [10] Planet core
  drawPlanet(cx, cy, planetR, hue, sBass + idleBr * 0.04, sHigh);

  // [11] Ring front arc (over planet — creates ring occlusion)
  drawRingFront();

  // [12] Moon — orbits above all ring layers
  drawMoon(cx, cy, planetR, hue, sBass, t);

  // [13] Outer presence ring — subtle marker at the scene edge
  const outerR    = innerR + Math.min(W, H) * 0.32;
  const ringAlpha = map(sOverall + idleBr * 0.03, 0, 1, 0.02, 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${(hue + 90) % 360},45%,65%,${ringAlpha})`;
  ctx.lineWidth   = 1;
  ctx.shadowBlur  = 0;
  ctx.stroke();

  // [14] Beat bloom — full-screen radial flash, topmost layer
  if (bloomAlpha > 0.002) {
    const bGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bGrd.addColorStop(0,   `hsla(${hue},80%,90%,${bloomAlpha})`);
    bGrd.addColorStop(0.4, `hsla(${hue},70%,70%,${bloomAlpha * 0.3})`);
    bGrd.addColorStop(1,   `hsla(${hue},60%,50%,0)`);
    ctx.fillStyle = bGrd;
    ctx.fillRect(0, 0, W, H);
    bloomAlpha *= 0.80;   // exponential decay — gone in ~18 frames
  }
}
