console.log("okay");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v={{COMMIT_SHA}}");
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const img = new Image();

img.onload = function () {
  drawCanvas();
};
img.src = "/images/sample_bg.png?v={{COMMIT_SHA}}";

function drawCanvas() {
  const rect = canvas.getBoundingClientRect();

  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Draw the image to fill the canvas
  ctx.drawImage(img, 0, 0, rect.width, rect.height);

  // Add text overlay showing canvas resolution
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, rect.height - 30, 300, 25);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px monospace";
  ctx.fillText(
    `Canvas: ${canvas.width}×${canvas.height}px`,
    15,
    rect.height - 12
  );
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Set canvas internal dimensions to match physical pixels
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  // Scale context to ensure 1 canvas pixel = 1 physical pixel
  ctx.scale(dpr, dpr);

  if (img.complete) {
    drawCanvas();
  }
  updateViewportDimensions();
}

function updateViewportDimensions() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const physicalWidth = Math.round(width * dpr);
  const physicalHeight = Math.round(height * dpr);

  document.getElementById(
    "viewport-dimensions"
  ).textContent = `Canvas: ${canvas.width} x ${canvas.height} pixels | Viewport: ${width} x ${height} CSS pixels (DPR: ${dpr})`;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
