const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Starfield state
let stars = [];
const NUM_STARS = 200;

function initStars() {
  stars = [];
  const maxDist = Math.max(window.innerWidth, window.innerHeight);
  for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * maxDist,
      baseSpeed: Math.random() * 0.4 + 0.1,
      size: Math.random() * 1.2 + 0.5,
      alpha: Math.random() * 0.7 + 0.1
    });
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars(); // Re-initialize starfield on window resize
}
window.addEventListener('resize', resize);
resize();

const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

// --- Start Screen Starfield ---
const startCanvas = document.getElementById('start-canvas');
let startCtx = null;
let startAnimationId = null;

if (startCanvas) {
  startCtx = startCanvas.getContext('2d');
  let startStars = [];
  const NUM_START_STARS = 150;

  function initStartStars() {
    startStars = [];
    for (let i = 0; i < NUM_START_STARS; i++) {
      startStars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 1.2 + 0.3,
        speed: Math.random() * 0.05 + 0.01,
        alpha: Math.random() * 0.5 + 0.1
      });
    }
  }

  function resizeStartCanvas() {
    startCanvas.width = window.innerWidth;
    startCanvas.height = window.innerHeight;
    initStartStars();
  }

  window.addEventListener('resize', resizeStartCanvas);
  resizeStartCanvas();

  function drawStartStars() {
    startCtx.clearRect(0, 0, startCanvas.width, startCanvas.height);
    
    startStars.forEach(star => {
      // Drift upwards/diagonally very slowly
      star.y -= star.speed;
      star.x -= star.speed * 0.3;
      
      if (star.y < 0) star.y = startCanvas.height;
      if (star.x < 0) star.x = startCanvas.width;
      
      startCtx.beginPath();
      startCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      startCtx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      startCtx.fill();
    });
    
    startAnimationId = requestAnimationFrame(drawStartStars);
  }
  
  drawStartStars();
}
// ------------------------------

let audioCtx, analyser, dataArray;

// Start everything when the user clicks the button
startBtn.addEventListener('click', async () => {
  // Hide the initial overlay smoothly
  overlay.classList.add('hidden');
  
  // Stop start screen animation to save resources
  if (startAnimationId) {
    cancelAnimationFrame(startAnimationId);
  }
  
  try {
    // 1. Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 2. Set up Web Audio API 
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // Defines how many frequency bands we want (must be power of 2)
    analyser.smoothingTimeConstant = 0.8; // Smooths the data out slightly
    
    source.connect(analyser);
    
    // We only need half the fftSize for frequency data
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // 3. Start the animation loop
    draw();
  } catch (err) {
    console.error("Microphone access denied or error:", err);
    overlay.classList.remove('hidden');
    startBtn.textContent = 'MIC BLOCKED - RETRY';
  }
});

// Helper to smoothly interpolate between two values (easing)
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

// Global state for continuous, smooth motion
let smoothedIntensity = 0;
let smoothedBass = 0; // Added for bass-specific reactions
let time = 0; // Defines continuous time mapping
let waveRings = []; // To hold the expanding ripples

// The main animation loop
function draw() {
  requestAnimationFrame(draw);
  time += 0.02; // Idle time progression
  
  // Get current frequency data from the audio
  analyser.getByteFrequencyData(dataArray);
  
  // Calculate average volume (overall intensity) and Bass
  let sum = 0;
  let bassSum = 0;
  const bassRange = 10; // First 10 bins represent low frequencies
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
    if (i < bassRange) bassSum += dataArray[i];
  }
  const rawIntensity = (sum / dataArray.length) / 255; 
  const rawBass = (bassSum / bassRange) / 255; // Extract just the bass
  
  // 1. Smooth out raw audio data for fluid transitions
  smoothedIntensity = lerp(smoothedIntensity, rawIntensity, 0.1); 
  smoothedBass = lerp(smoothedBass, rawBass, 0.15); // Bass is smoothed slightly faster 
  
  // Add a very subtle "breathing" effect using sine waves
  const idleMotion = Math.sin(time) * 0.05 + 0.05; 
  const currentIntensity = smoothedIntensity + idleMotion;
  const currentBass = smoothedBass + idleMotion;
  
  // 2. Cosmic Background Fading (Longer Trails with dynamic color)
  const bgHue = 220 + (currentBass * 60);
  ctx.fillStyle = `hsla(${bgHue}, 40%, 5%, 0.15)`; // slightly shift background color based on bass
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Find the center of the screen
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // 2.5 Draw Starfield (Atmospheric Background)
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    
    // Audio Reactive: Stars move faster outward when Bass drops
    let speed = star.baseSpeed + (currentBass * star.baseSpeed * 25);
    star.distance += speed;
    
    // Add a very subtle rotation to the entire starfield for an orbital feel
    star.angle += 0.0005; 
    
    // Reset star if it goes out of bounds (re-spawn near the center)
    const maxDist = Math.max(canvas.width, canvas.height);
    if (star.distance > maxDist) {
      star.distance = Math.random() * 50; // spawn slightly hidden behind the planet
      star.angle = Math.random() * Math.PI * 2;
    }
    
    // Convert polar coordinates (angle, distance) to standard x,y
    let x = centerX + Math.cos(star.angle) * star.distance;
    let y = centerY + Math.sin(star.angle) * star.distance;
    
    // Audio Reactive: Stars subtly pulse/brighten with bass
    let brightness = star.alpha + (currentBass * 0.8);
    
    // Stars appear slightly larger as they get further from center (perspective trick)
    let dynamicSize = star.size * (1 + (star.distance / maxDist)); 
    
    ctx.beginPath();
    ctx.arc(x, y, dynamicSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.fill();
  }
  
  // 3. Planet / Central Body (Jupiter/Saturn Inspired)
  const planetBase = 60; // Slightly smaller base
  // Planet size driven by general intensity, but slightly influenced by bass
  const planetRadius = planetBase + (currentIntensity * 70) + (currentBass * 30); 
  
  // Subtle floating motion (organic drift)
  const planetX = centerX + Math.cos(time * 0.4) * 15;
  const planetY = centerY + Math.sin(time * 0.5) * 10;

  // Planet color shifts dynamically over time and intensity
  const hue = 220 + (currentIntensity * 80) + (Math.sin(time * 0.5) * 30);

  // Clipping region to draw atmospheric bands neatly on the planet
  ctx.save();
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
  ctx.clip(); // Ensure bands don't paint outside the planet bounds

  // Create a spherical 3D gradient for the planet base
  const planetGradient = ctx.createRadialGradient(
    planetX - planetRadius * 0.3, planetY - planetRadius * 0.3, planetRadius * 0.1,
    planetX, planetY, planetRadius
  );
  planetGradient.addColorStop(0, `hsl(${hue + 30}, 90%, 85%)`); // Bright core
  planetGradient.addColorStop(0.5, `hsl(${hue}, 70%, 50%)`);    // Mid tone
  planetGradient.addColorStop(0.8, `hsl(${hue - 30}, 80%, 25%)`); // Deep atmosphere
  planetGradient.addColorStop(1, `hsl(${hue - 40}, 90%, 5%)`);  // Dark shadow edge
  
  ctx.fillStyle = planetGradient;
  ctx.fill();

  // Draw gaseous Jupiter-like bands across the planet
  for(let b = 0; b < 5; b++) {
     ctx.beginPath();
     // Draw thick, soft ellipses over the surface
     const bandY = planetY - planetRadius + (b * (planetRadius * 0.5));
     // The thickness of the bands pulses dynamically with the bass
     const bandHeight = planetRadius * 0.2 + (currentBass * 20);
     ctx.ellipse(planetX, bandY, planetRadius, bandHeight, 0, 0, Math.PI * 2);
     ctx.fillStyle = `hsla(${hue + (b * 15)}, 60%, 50%, 0.15)`;
     ctx.fill();
  }
  ctx.restore(); // Remove clipping mask

  // Soft atmospheric planet glow (rendered outside so it isn't clipped)
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
  ctx.shadowBlur = 60 + (currentIntensity * 80);
  ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
  ctx.fillStyle = 'rgba(0,0,0,0)'; // transparent fill just to trigger the outer shadow
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // 4. Energy Fields / Radial Expanding Waves (Organic distortion)
  // Spawn new expanding waves spontaneously, mapped to bass spikes
  if (Math.random() < currentBass * 0.3 + 0.02) {
      waveRings.push({ 
          radius: planetRadius, 
          alpha: 0.5, // Start more transparent
          hueOffset: Math.random() * 60 - 30, 
          speed: 1 + (currentBass * 4),
          seed: Math.random() * 100 // Seed for organic jitter
      });
  }

  // Draw and update all active expanding waves
  for (let i = waveRings.length - 1; i >= 0; i--) {
      let wave = waveRings[i];
      
      wave.radius += wave.speed + (currentIntensity * 3);
      wave.alpha -= 0.003 + (currentIntensity * 0.002); // Fade out even slower for atmosphere
      
      if (wave.alpha <= 0) {
          waveRings.splice(i, 1);
      } else {
          // Organic "Vibration" / Jittery Energy Circle
          ctx.beginPath();
          const segments = 60;
          for (let s = 0; s <= segments; s++) {
              const angle = (s / segments) * Math.PI * 2;
              // Subtle oscillation/jitter in the radius based on time and segment
              const jitter = Math.sin(time * 5 + s + wave.seed) * (2 + currentBass * 10);
              const r = wave.radius + jitter;
              const wx = planetX + Math.cos(angle) * r;
              const wy = planetY + Math.sin(angle) * r;
              
              if (s === 0) ctx.moveTo(wx, wy);
              else ctx.lineTo(wx, wy);
          }
          ctx.closePath();
          
          const waveHue = hue + wave.hueOffset + (wave.radius * 0.1);
          ctx.strokeStyle = `hsla(${waveHue}, 90%, 65%, ${wave.alpha})`;
          ctx.lineWidth = 0.5 + (wave.alpha * 2) + (currentBass * 2);
          
          ctx.shadowBlur = 15;
          ctx.shadowColor = `hsl(${waveHue}, 100%, 70%)`;
          ctx.stroke();
          ctx.shadowBlur = 0;
      }
  }
  
  // 5. Aesthetic Equatorial Energy Ring (Saturn ring aspect)
  const ringRotation = time * 0.15; // Slow continuous rotation
  const ringHue = hue + 20 + Math.sin(time * 0.3) * 40; // Slowly shifting hue

  ctx.beginPath();
  const ringRadiusX = planetRadius * 2.2 + (currentIntensity * 60);
  const ringRadiusY = planetRadius * 0.4 + (currentIntensity * 15);
  // Dynamic rotation and center tied to planet
  ctx.ellipse(planetX, planetY, ringRadiusX, ringRadiusY, 0.35 + ringRotation, 0, Math.PI * 2);
  
  const ringGrad = ctx.createLinearGradient(
    planetX - ringRadiusX, planetY - ringRadiusY, 
    planetX + ringRadiusX, planetY + ringRadiusY
  );
  ringGrad.addColorStop(0, `hsla(${ringHue + 40}, 80%, 70%, 0.05)`);
  ringGrad.addColorStop(0.5, `hsla(${ringHue}, 90%, 80%, ${0.2 + currentBass * 0.4})`);
  ringGrad.addColorStop(1, `hsla(${ringHue + 20}, 70%, 60%, 0.0)`);
  
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 3 + (currentBass * 8);
  ctx.stroke();
}
