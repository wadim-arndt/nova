# NOVA – Noise Oriented Visual Aesthetics

**NOVA** is a browser-based, audio-reactive generative art experience. It transforms your microphone’s audio input into a living, cosmic visualization in real time. 

Sound doesn’t just control a flat graphic—it shapes space itself. Watch as low bass frequencies expand a central planetary body (inspired by Saturn and Jupiter), while soundwaves visibly ripple outwards through a drifting field of stars. 

The goal of NOVA is not to be a complex technical dashboard, but to offer a calm, immersive, and atmospheric space that reacts organically to the environment around you.

## ✨ Features
- **Real-Time Audio Reactivity:** Uses your microphone to immediately translate surrounding sound into fluid motion.
- **Cosmic Environment:** A 3D-feeling starfield that gently accelerates and brightens with audio intensity.
- **Generative Planet:** A living celestial body that breathes with sound, featuring dynamic atmospheric bands and an equatorial energy ring.
- **Dynamic Wave Systems:** Sound spikes spawn vibrant, multi-tonal ripples that expand outward into deep space.

## 🚀 How to Run Locally 

You don't need any complex build steps or Node.js installations to run NOVA. Since it's built completely with vanilla web technologies, you only need your browser and a simple local web server.

1. **Download or Clone** this repository to your computer.
2. **Start a local server:** Modern browsers block microphone access for security reasons if you simply open the `index.html` file using your file explorer (the URL will start with `file:///`). You must serve the folder locally.
   - **Using VS Code / Cursor:** Install the "Live Server" extension, open the project folder, and click "Go Live" in the bottom right corner.
   - **Using Terminal (Mac/Linux):** Open your terminal, navigate to the NOVA folder, and run:
     ```bash
     python3 -m http.server 8000
     ```
     Then open your browser and go to `http://localhost:8000`.
3. Click the **START** button on the screen!

## 🎙️ Microphone Permissions

To create the visuals, NOVA needs to "hear" the room. When you click **START**, your browser will show a prompt asking for permission to use your microphone. 
- Click **Allow**. 
- NOVA does not record, save, or transmit any audio data. The sound is only analyzed instantaneously in your own browser to generate the graphics.

## 🛠️ Common Issues & Troubleshooting

- **The screen says "MIC BLOCKED - RETRY"**
  This happens if your browser blocks the microphone. Make sure you are accessing the site via a local server (like `http://localhost:8000` or `http://127.0.0.1`) and **not** by dragging the file into the browser (which results in a `file:///` restriction).
- **I am using localhost but it still doesn't work**
  Check your browser's address bar. On the far left (next to the URL), click the lock or settings icon and ensure "Microphone" is set to "Allow" instead of "Ask" or "Block". Load the page again.
- **The screen is black/unresponsive after allowing the mic**
  Ensure you are making noise! The visualization requires audio to come alive. You can also press `F12` to open the Developer Console and check for any bold red errors.

## 💻 Tech Stack

NOVA is built purely with native web standards. No heavy frameworks or libraries are required.
- **Vanilla JavaScript** for drawing logic, animation loops, and easing.
- **HTML5 Canvas API** for rendering the graphics, gradients, and particles.
- **Web Audio API** (`AnalyserNode` and Fast Fourier Transforms) for converting raw audio streams into real-time frequency and bass data.

---
*Created with a focus on immersive aesthetics and fluid generative art.*
