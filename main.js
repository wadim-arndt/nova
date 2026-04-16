const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

async function start() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(data);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / data.length;

    for (let i = 0; i < data.length; i++) {
      const value = data[i];

      ctx.fillStyle = `rgb(${value}, 50, 200)`;
      ctx.fillRect(
        i * barWidth,
        canvas.height - value * 2,
        barWidth,
        value * 2
      );
    }
  }

  draw();
}

start();