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

// Load all images
let loadedCount = 0;
const totalLayers = Object.keys(layers).length;

Object.entries(layers).forEach(([name, layer]) => {
  layer.img.onload = function () {
    layer.loaded = true;
    loadedCount++;
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

// Mouse/Touch event handlers for scrolling
function handleStart(x) {
  isDragging = true;
  lastX = x;
  lastTime = Date.now();
  velocity = 0; // Stop any momentum scrolling
}

function handleMove(x) {
  if (!isDragging) return;

  const now = Date.now();
  const deltaTime = now - lastTime;
  const deltaX = x - lastX;

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

  lastX = x;
  lastTime = now;

  drawCanvas();
  updateViewportDimensions();
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

    drawCanvas();
    updateViewportDimensions();

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

// Only update dimensions display on resize, not canvas itself
window.addEventListener("resize", updateViewportDimensions);
