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

let audioCtx, analyser, dataArray;

// Start everything when the user clicks the button
startBtn.addEventListener('click', async () => {
  // Hide the initial overlay smoothly
  overlay.classList.add('hidden');
  
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
let time = 0; // Defines continuous time mapping

// The main animation loop
function draw() {
  requestAnimationFrame(draw);
  time += 0.02; // Idle time progression
  
  // Get current frequency data from the audio
  analyser.getByteFrequencyData(dataArray);
  
  // Calculate average volume (overall intensity)
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const rawIntensity = (sum / dataArray.length) / 255; 
  
  // 1. Smooth out raw audio data to remove jitter
  // The '0.1' factor determines how fast the smooth value catches up to the raw value
  smoothedIntensity = lerp(smoothedIntensity, rawIntensity, 0.1); 
  
  // Add a very subtle "breathing" effect using sine waves, so it feels alive even when silent
  const idleMotion = Math.sin(time) * 0.05 + 0.05; 
  const currentIntensity = smoothedIntensity + idleMotion;
  
  // 2. Cosmic Background Fading (Longer Trails)
  // Using lower alpha (0.1 instead of 0.15) for softer, more atmospheric trailing
  ctx.fillStyle = 'rgba(0, 0, 8, 0.1)'; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Find the center of the screen
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // 2.5 Draw Starfield (Atmospheric Background)
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    
    // Audio Reactive: Stars move faster outward when audio is loud
    let speed = star.baseSpeed + (smoothedIntensity * star.baseSpeed * 15);
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
    
    // Audio Reactive: Stars subtly pulse/brighten with sound
    let brightness = star.alpha + (smoothedIntensity * 0.8);
    
    // Stars appear slightly larger as they get further from center (perspective trick)
    let dynamicSize = star.size * (1 + (star.distance / maxDist)); 
    
    ctx.beginPath();
    ctx.arc(x, y, dynamicSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.fill();
  }
  
  // 3. Planet / Central Body
  const planetBase = 80;
  const planetRadius = planetBase + (currentIntensity * 120); 
  const hue = 220 + (currentIntensity * 60);

  // Create a spherical 3D gradient for a planet look instead of a flat circle
  const planetGradient = ctx.createRadialGradient(
    centerX - planetRadius * 0.3, centerY - planetRadius * 0.3, planetRadius * 0.1, // Offset highlight for depth
    centerX, centerY, planetRadius
  );
  
  planetGradient.addColorStop(0, `hsl(${hue + 40}, 90%, 85%)`); // Bright core
  planetGradient.addColorStop(0.6, `hsl(${hue}, 80%, 55%)`);    // Mid tone
  planetGradient.addColorStop(1, `hsl(${hue - 20}, 70%, 15%)`); // Dark shadow edge
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, planetRadius, 0, Math.PI * 2);
  ctx.fillStyle = planetGradient;
  
  // Soft atmospheric planet glow
  ctx.shadowBlur = 50 + (currentIntensity * 60);
  ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
  ctx.fill();
  
  // 4. Energy Field / Wave Ring
  // A bright outer ring that represents the audio wave radiating outwards
  ctx.beginPath();
  const waveRadius = planetRadius + 30 + (smoothedIntensity * 150); // Reacts more strongly to sound spikes
  ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
  
  ctx.strokeStyle = `hsla(${hue + 20}, 90%, 75%, ${0.15 + smoothedIntensity * 0.5})`; // Spikes in opacity
  ctx.lineWidth = 1.5 + (smoothedIntensity * 6); // Stroke gets thicker with volume
  ctx.shadowBlur = 30; 
  ctx.stroke();
  
  // Reset shadow for the next frame
  ctx.shadowBlur = 0;
}
