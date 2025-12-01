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

// Store initial dimensions to prevent canvas from resizing
let initialWidth, initialHeight, initialDpr;
let isInitialized = false;

function drawCanvas() {
  // Use stored initial dimensions for drawing
  const cssWidth = initialWidth;
  const cssHeight = initialHeight;

  // Clear canvas
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // Draw the image to fill the canvas
  ctx.drawImage(img, 0, 0, cssWidth, cssHeight);

  // Draw a single red pixel in the exact center (in CSS coordinates)
  const centerX = Math.floor(cssWidth / 2);
  const centerY = Math.floor(cssHeight / 2);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(centerX, centerY, 1, 1);

  // Add text overlay showing canvas resolution
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, cssHeight - 30, 300, 25);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px monospace";
  ctx.fillText(
    `Canvas: ${canvas.width}×${canvas.height}px | Red pixel at (${centerX}, ${centerY})`,
    15,
    cssHeight - 12
  );
}

function initCanvas() {
  // Use screen dimensions instead of viewport
  const dpr = window.devicePixelRatio || 1;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Store initial dimensions
  initialWidth = screenWidth;
  initialHeight = screenHeight;
  initialDpr = dpr;

  // Set canvas CSS size to screen dimensions
  canvas.style.width = `${screenWidth}px`;
  canvas.style.height = `${screenHeight}px`;

  // Set canvas internal dimensions to match physical pixels
  canvas.width = Math.round(screenWidth * dpr);
  canvas.height = Math.round(screenHeight * dpr);

  // Scale context to ensure 1 canvas pixel = 1 physical pixel
  ctx.scale(dpr, dpr);

  isInitialized = true;

  if (img.complete) {
    drawCanvas();
  }
  updateViewportDimensions();
}

function updateViewportDimensions() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  document.getElementById(
    "viewport-dimensions"
  ).textContent = `Canvas: ${canvas.width} x ${canvas.height} pixels | Viewport: ${width} x ${height} CSS pixels (DPR: ${dpr})`;
}

// Initialize once
initCanvas();

// Only update dimensions display on resize, not canvas itself
window.addEventListener("resize", updateViewportDimensions);
