console.log("okay");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v={{COMMIT_SHA}}");
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Three layer images for parallax effect
const layers = {
  back: { img: new Image(), loaded: false, speed: 0.05 }, // Background (slowest)
  middle: { img: new Image(), loaded: false, speed: 0.2 }, // Mid-ground
  front: { img: new Image(), loaded: false, speed: 1.2 }, // Foreground (fastest)
};

// Scroll offset (0 = centered, negative = scroll left, positive = scroll right)
let scrollOffset = 0;
let velocity = 0;
let isDragging = false;
let lastX = 0;
let lastTime = 0;
let rafId = null;
let needsRender = false;
let lastDimensionUpdate = 0;

// Load all images
let loadedCount = 0;
const totalLayers = Object.keys(layers).length;

Object.entries(layers).forEach(([name, layer]) => {
  layer.img.onload = function () {
    layer.loaded = true;
    loadedCount++;

    // Add ruler markings to the middle layer after it loads
    if (name === "middle") {
      addRulerToMiddleLayer(layer.img);
    }

    if (loadedCount === totalLayers && isInitialized) {
      drawCanvas();
    }
  };
  // Update these paths to match your actual image files
  layer.img.src = `/images/layers1/${name}.png?v={{COMMIT_SHA}}`;
});

// Store initial dimensions to prevent canvas from resizing
let initialWidth, initialHeight, initialDpr;
let isInitialized = false;

function addRulerToMiddleLayer(img) {
  // Create an offscreen canvas to draw on the image
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = img.width;
  offscreenCanvas.height = img.height;
  const offscreenCtx = offscreenCanvas.getContext("2d");

  // Draw the original image
  offscreenCtx.drawImage(img, 0, 0);

  // Setup for ruler
  const centerX = img.width / 2;
  const centerY = img.height / 2;
  const interval = 100; // Pixels between tick marks
  const tickHeight = 30; // Height of tick marks
  const fontSize = 20;

  offscreenCtx.strokeStyle = "#ffffff";
  offscreenCtx.fillStyle = "#ffffff";
  offscreenCtx.lineWidth = 2;
  offscreenCtx.font = `${fontSize}px monospace`;
  offscreenCtx.textAlign = "center";
  offscreenCtx.textBaseline = "middle";

  // Draw tick marks and labels from center outward
  for (
    let i = -Math.floor(img.width / interval);
    i <= Math.floor(img.width / interval);
    i++
  ) {
    const x = centerX + i * interval;
    const pixelValue = i * interval;

    // Skip if outside image bounds
    if (x < 0 || x > img.width) continue;

    // Draw tick mark (vertical line at center)
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(x, centerY - tickHeight / 2);
    offscreenCtx.lineTo(x, centerY + tickHeight / 2);
    offscreenCtx.stroke();

    // Draw label below the tick mark
    offscreenCtx.fillText(
      pixelValue.toString(),
      x,
      centerY + tickHeight / 2 + fontSize
    );
  }

  // Draw horizontal ruler line through vertical center
  offscreenCtx.beginPath();
  offscreenCtx.moveTo(0, centerY);
  offscreenCtx.lineTo(img.width, centerY);
  offscreenCtx.stroke();

  // Replace the image source with the modified version
  img.src = offscreenCanvas.toDataURL();
}

function drawCanvas() {
  if (!isInitialized) return;

  // Use actual canvas dimensions
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Calculate the max scroll for the front layer to use as global limit
  const frontLayer = layers.front;
  let globalMaxScroll = Infinity;

  if (frontLayer.loaded) {
    globalMaxScroll = (frontLayer.img.width - canvasWidth) / 2;
  }

  // Draw each layer with parallax offset
  Object.entries(layers).forEach(([name, layer]) => {
    if (!layer.loaded) return;

    const img = layer.img;
    const imgWidth = img.width;
    const imgHeight = img.height;

    // Calculate the scroll range for this layer
    const maxScroll = (imgWidth - canvasWidth) / 2;

    // Apply parallax speed to scroll offset
    const layerOffset = scrollOffset * layer.speed;

    // Clamp the layer offset to both its own max AND the global max (scaled by speed)
    const effectiveMaxScroll = Math.min(
      maxScroll,
      globalMaxScroll * layer.speed
    );

    // Clamp the offset to prevent showing edges
    const clampedOffset = Math.max(
      -effectiveMaxScroll,
      Math.min(effectiveMaxScroll, layerOffset)
    );

    // Calculate source position (which part of the image to draw)
    // Start from center of image, then apply offset
    const sourceX = (imgWidth - canvasWidth) / 2 + clampedOffset;

    // Draw this layer
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(
      img,
      sourceX,
      0, // Source position in image
      canvasWidth,
      imgHeight, // Source dimensions
      0,
      0, // Destination position on canvas
      canvasWidth,
      canvasHeight // Destination dimensions on canvas
    );
  });

  // Draw a single red pixel in the exact center
  const centerX = Math.floor(canvasWidth / 2);
  const centerY = Math.floor(canvasHeight / 2);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(centerX, centerY, 1, 1);
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

  // Don't scale the context - work in actual canvas pixels
  // ctx.scale(dpr, dpr);

  isInitialized = true;

  if (loadedCount === totalLayers) {
    drawCanvas();
  }
  updateViewportDimensions();
}

function updateViewportDimensions() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  document.getElementById("viewport-dimensions").textContent = `Canvas: ${
    canvas.width
  } x ${
    canvas.height
  } pixels | Viewport: ${width} x ${height} CSS pixels (DPR: ${dpr}) | Scroll: ${Math.round(
    scrollOffset
  )}`;
}

function renderLoop() {
  if (needsRender) {
    drawCanvas();

    // Only update dimensions display occasionally (not every frame)
    const now = Date.now();
    if (now - lastDimensionUpdate > 100) {
      updateViewportDimensions();
      lastDimensionUpdate = now;
    }

    needsRender = false;
  }
  rafId = requestAnimationFrame(renderLoop);
}

function requestRender() {
  needsRender = true;
}

// Mouse/Touch event handlers for scrolling
function handleStart(x) {
  isDragging = true;
  lastX = x * initialDpr; // Convert CSS pixels to canvas pixels
  lastTime = Date.now();
  velocity = 0; // Stop any momentum scrolling
}

function handleMove(x) {
  if (!isDragging) return;

  const now = Date.now();
  const canvasX = x * initialDpr; // Convert CSS pixels to canvas pixels
  const deltaTime = now - lastTime;
  const deltaX = canvasX - lastX;

  // Calculate velocity for momentum
  if (deltaTime > 0) {
    velocity = (deltaX / deltaTime) * 16; // Normalize to ~60fps
  }

  const newScrollOffset = scrollOffset - deltaX;

  // Calculate the max scroll range based on the foreground layer
  const canvasWidth = canvas.width;
  const frontLayer = layers.front;

  if (frontLayer.loaded) {
    const frontMaxScroll = (frontLayer.img.width - canvasWidth) / 2;
    // Clamp scroll offset to foreground layer's limits
    scrollOffset = Math.max(
      -frontMaxScroll,
      Math.min(frontMaxScroll, newScrollOffset)
    );
  } else {
    scrollOffset = newScrollOffset;
  }

  lastX = canvasX;
  lastTime = now;

  requestRender();
}

function handleEnd() {
  isDragging = false;
  // Start momentum scrolling
  startMomentum();
}

function startMomentum() {
  const friction = 0.95; // Friction coefficient (0-1, higher = less friction)
  const minVelocity = 0.1; // Stop when velocity gets very small

  function momentumStep() {
    if (Math.abs(velocity) < minVelocity) {
      velocity = 0;
      return;
    }

    // Apply friction
    velocity *= friction;

    const newScrollOffset = scrollOffset - velocity;

    // Calculate the max scroll range based on the foreground layer
    const canvasWidth = canvas.width;
    const frontLayer = layers.front;

    if (frontLayer.loaded) {
      const frontMaxScroll = (frontLayer.img.width - canvasWidth) / 2;
      const previousScrollOffset = scrollOffset;

      // Clamp scroll offset to foreground layer's limits
      scrollOffset = Math.max(
        -frontMaxScroll,
        Math.min(frontMaxScroll, newScrollOffset)
      );

      // If we hit a boundary, stop momentum
      if (
        scrollOffset === previousScrollOffset &&
        scrollOffset !== newScrollOffset
      ) {
        velocity = 0;
        return;
      }
    } else {
      scrollOffset = newScrollOffset;
    }

    requestRender();
    requestAnimationFrame(momentumStep);
  }

  if (Math.abs(velocity) >= minVelocity) {
    requestAnimationFrame(momentumStep);
  }
}

// Mouse events
canvas.addEventListener("mousedown", (e) => {
  handleStart(e.clientX);
});

canvas.addEventListener("mousemove", (e) => {
  handleMove(e.clientX);
});

canvas.addEventListener("mouseup", handleEnd);
canvas.addEventListener("mouseleave", handleEnd);

// Touch events
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    handleEnd();
  },
  { passive: false }
);

// Initialize once
initCanvas();

// Start the render loop
renderLoop();

// Only update dimensions display on resize, not canvas itself
window.addEventListener("resize", updateViewportDimensions);
