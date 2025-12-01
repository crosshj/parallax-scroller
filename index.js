if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(
    "sw.js?v=9b9d83ae7e8c9e8f293c227739a7d6e638d99014"
  );
}

const contentLoaded = () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Three layer images for parallax effect
  const layers = {
    back: { img: new Image(), loaded: false, speed: 0.04, rulerCanvas: null },
    middle: { img: new Image(), loaded: false, speed: 0.12, rulerCanvas: null },
    front: { img: new Image(), loaded: false, speed: 1.0, rulerCanvas: null },
  };

  // Scroll state (in CSS pixels)
  let scrollOffset = 0;

  // Momentum (px/ms)
  let velocityPxPerMs = 0;

  // Drag state
  let isDragging = false;
  let lastX = 0;
  let lastTime = 0;
  let velocityHistory = [];

  // Canvas sizing
  let isInitialized = false;
  let canvasDpr = 1;
  let canvasWidthCss = 0;
  let canvasHeightCss = 0;

  // Scroll limits (CSS px) based on front layer
  let maxScroll = 0;

  // Load all images
  let loadedCount = 0;
  const totalLayers = Object.keys(layers).length;

  Object.entries(layers).forEach(([name, layer]) => {
    layer.img.onload = function () {
      layer.loaded = true;
      loadedCount++;

      // Add ruler markings to the middle layer once, via offscreen canvas
      if (name === "middle") {
        addRulerToMiddleLayer(layer);
      }

      // Recompute max scroll once we know image sizes
      if (isInitialized) {
        computeMaxScroll();
      }

      if (loadedCount === totalLayers && isInitialized) {
        requestRender();
      }
    };

    layer.img.src = `/images/layers1/${name}.png?v=9b9d83ae7e8c9e8f293c227739a7d6e638d99014`;
  });

  function addRulerToMiddleLayer(layer) {
    const img = layer.img;

    // Create offscreen canvas to draw on the image
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
    const tickHeight = 30;
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

      if (x < 0 || x > img.width) continue;

      offscreenCtx.beginPath();
      offscreenCtx.moveTo(x, centerY - tickHeight / 2);
      offscreenCtx.lineTo(x, centerY + tickHeight / 2);
      offscreenCtx.stroke();

      offscreenCtx.fillText(
        pixelValue.toString(),
        x,
        centerY + tickHeight / 2 + fontSize
      );
    }

    // Horizontal ruler line
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, centerY);
    offscreenCtx.lineTo(img.width, centerY);
    offscreenCtx.stroke();

    // Store the composited canvas as the source for this layer
    layer.rulerCanvas = offscreenCanvas;
  }

  // Compute max scroll range from the foreground layer and canvas width
  function computeMaxScroll() {
    const frontLayer = layers.front;
    if (!isInitialized || !frontLayer.loaded) {
      maxScroll = 0;
      return;
    }

    const source = frontLayer.rulerCanvas || frontLayer.img;
    const imgWidth = source.width;

    if (imgWidth <= canvasWidthCss) {
      maxScroll = 0;
    } else {
      maxScroll = (imgWidth - canvasWidthCss) / 2;
    }

    clampScrollOffset();
  }

  function clampScrollOffset() {
    scrollOffset = Math.max(-maxScroll, Math.min(maxScroll, scrollOffset));
  }

  // Drawing in CSS pixel space (ctx is scaled by DPR)
  function drawCanvas() {
    if (!isInitialized) return;

    ctx.clearRect(0, 0, canvasWidthCss, canvasHeightCss);

    // Draw each layer with parallax offset
    Object.values(layers).forEach((layer) => {
      if (!layer.loaded) return;

      const source = layer.rulerCanvas || layer.img;
      const imgWidth = source.width;
      const imgHeight = source.height;

      // Apply parallax speed to scroll offset
      const layerOffset = scrollOffset * layer.speed;

      // Centered: start from (imgWidth - canvasWidthCss)/2, then offset
      const sourceX = (imgWidth - canvasWidthCss) / 2 + layerOffset;

      // Draw visible slice
      ctx.drawImage(
        source,
        sourceX,
        0,
        canvasWidthCss,
        imgHeight,
        0,
        0,
        canvasWidthCss,
        canvasHeightCss
      );
    });

    // Debug: red pixel at canvas center
    const centerX = Math.floor(canvasWidthCss / 2);
    const centerY = Math.floor(canvasHeightCss / 2);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(centerX, centerY, 1, 1);
  }

  // Initialize canvas once, based on initial viewport
  function initCanvas() {
    const rawDpr = window.devicePixelRatio || 1;
    const maxDpr = 2; // cap if needed
    const dpr = Math.min(rawDpr, maxDpr);

    canvasDpr = dpr;
    canvasWidthCss = window.innerWidth;
    canvasHeightCss = window.innerHeight;

    canvas.style.width = `${canvasWidthCss}px`;
    canvas.style.height = `${canvasHeightCss}px`;

    canvas.width = Math.round(canvasWidthCss * dpr);
    canvas.height = Math.round(canvasHeightCss * dpr);

    // Work in CSS pixels in all logic
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Prevent touch scrolling / gestures over the canvas
    canvas.style.touchAction = "none";

    isInitialized = true;

    if (loadedCount === totalLayers) {
      computeMaxScroll();
      requestRender();
    }

    updateViewportDimensions();
  }

  function updateViewportDimensions() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = canvasDpr;

    const info = document.getElementById("viewport-dimensions");
    if (info) {
      info.textContent = `Canvas: ${canvas.width} x ${canvas.height} physical px | Viewport: ${width} x ${height} CSS px (DPR: ${dpr})`;
    }
  }

  // -----------------
  // Momentum + render
  // -----------------

  let needsRender = true;

  function requestRender() {
    needsRender = true;
  }

  function isMoving() {
    return Math.abs(velocityPxPerMs) > 0.001;
  }

  function updateMomentum(dtMs) {
    if (!velocityPxPerMs) return;

    // Integrate position
    scrollOffset -= velocityPxPerMs * dtMs;
    clampScrollOffset();

    // Simple linear friction
    const friction = 0.003; // px/ms^2
    const sign = Math.sign(velocityPxPerMs);
    let speed = Math.abs(velocityPxPerMs);
    speed = Math.max(0, speed - friction * dtMs);

    if (speed === 0) {
      velocityPxPerMs = 0;
    } else {
      velocityPxPerMs = sign * speed;
    }

    if (speed < 0.001) {
      velocityPxPerMs = 0;
    }
  }

  let lastFrameTime = performance.now();

  function tick(now) {
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    updateMomentum(dt);

    if (needsRender || isMoving() || isDragging) {
      drawCanvas();
      needsRender = false;
    }

    requestAnimationFrame(tick);
  }

  // -----------------
  // Input handling
  // -----------------

  function handleStart(x) {
    isDragging = true;
    lastX = x;
    lastTime = performance.now();
    velocityPxPerMs = 0;
    velocityHistory = [];
  }

  function handleMove(x) {
    if (!isDragging) return;

    const now = performance.now();
    const deltaTime = now - lastTime;
    const deltaX = x - lastX;

    if (deltaTime > 0) {
      const instantVelocity = deltaX / deltaTime; // px/ms
      velocityHistory.push({ velocity: instantVelocity, time: now });
      if (velocityHistory.length > 5) velocityHistory.shift();
    }

    scrollOffset -= deltaX;
    clampScrollOffset();

    lastX = x;
    lastTime = now;

    requestRender();
  }

  function handleEnd() {
    if (!isDragging) return;
    isDragging = false;

    const now = performance.now();
    const recentSamples = velocityHistory.filter((s) => now - s.time < 50);

    if (recentSamples.length > 0) {
      const avgVelocity =
        recentSamples.reduce((sum, s) => sum + s.velocity, 0) /
        recentSamples.length;
      velocityPxPerMs = avgVelocity;
    } else {
      velocityPxPerMs = 0;
    }

    velocityHistory = [];
    requestRender();
  }

  // Pointer events (covers mouse + touch)
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    handleStart(e.clientX);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  });

  canvas.addEventListener("pointerup", (e) => {
    canvas.releasePointerCapture(e.pointerId);
    handleEnd();
  });

  canvas.addEventListener("pointercancel", (e) => {
    canvas.releasePointerCapture(e.pointerId);
    handleEnd();
  });

  // ---------------
  // Bootstrapping
  // ---------------

  initCanvas();
  requestAnimationFrame(tick);

  // Only update dimensions display on resize, not canvas itself
  window.addEventListener("resize", updateViewportDimensions);
};

document.addEventListener("DOMContentLoaded", contentLoaded);
