console.log("okay");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v={{COMMIT_SHA}}");
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function drawGrid() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Draw background
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, rect.width, rect.height);
  
  // Grid settings (in CSS pixels)
  const gridSize = 50; // 50 CSS pixel grid
  
  // Draw vertical lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= rect.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  
  // Draw horizontal lines
  for (let y = 0; y <= rect.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
  }
  
  // Draw center crosshair in bright color
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 2;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  ctx.beginPath();
  ctx.moveTo(centerX - 20, centerY);
  ctx.lineTo(centerX + 20, centerY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 20);
  ctx.lineTo(centerX, centerY + 20);
  ctx.stroke();
  
  // Draw corner markers
  ctx.fillStyle = "#ff0000";
  const cornerSize = 10;
  ctx.fillRect(0, 0, cornerSize, cornerSize); // Top-left
  ctx.fillRect(rect.width - cornerSize, 0, cornerSize, cornerSize); // Top-right
  ctx.fillRect(0, rect.height - cornerSize, cornerSize, cornerSize); // Bottom-left
  ctx.fillRect(rect.width - cornerSize, rect.height - cornerSize, cornerSize, cornerSize); // Bottom-right
  
  // Add text showing canvas resolution
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px monospace";
  ctx.fillText(`Canvas: ${canvas.width}×${canvas.height}px`, 15, rect.height - 15);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  // Set canvas internal dimensions to match physical pixels
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  
  // Scale context to ensure 1 canvas pixel = 1 physical pixel
  ctx.scale(dpr, dpr);
  
  drawGrid();
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
