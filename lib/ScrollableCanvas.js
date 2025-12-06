class ScrollableCanvas {
  constructor(options = {}) {
    // Required
    this.canvas = options.canvas;
    if (!this.canvas) {
      throw new Error("Canvas element required");
    }

    this.ctx = this.canvas.getContext("2d");

    // Layer configuration - each layer should have: { name, image, speed }
    // image can be an Image element, HTMLCanvasElement, or Promise that resolves to either
    this.layerConfig = options.layers || [];

    // Physics configuration
    this.physics = {
      friction: 0.003,
      velocitySampleSize: 5,
      velocitySampleTimeMs: 50,
      minVelocity: 0.001,
      ...options.physics,
    };

    // Canvas dimensions (required)
    this.width = options.width;
    this.height = options.height;

    if (!this.width || !this.height) {
      throw new Error("Width and height are required");
    }

    // Callbacks
    this.callbacks = {
      onReady: options.onReady || (() => {}),
      onScroll: options.onScroll || (() => {}),
      onLayerLoad: options.onLayerLoad || (() => {}),
      onError: options.onError || ((err) => console.error(err)),
    };

    // Input configuration
    this.input = {
      enabled: options.input?.enabled !== false,
      capturePointer: options.input?.capturePointer !== false,
      ...options.input,
    };

    // Internal state
    this.state = this._createState();
    this.initialized = false;
  }

  async init() {
    try {
      await this._loadLayers();
      this._initCanvas();
      if (this.input.enabled) {
        this._setupInputHandlers();
      }
      this._startAnimationLoop();
      this.initialized = true;
      this.callbacks.onReady(this);
    } catch (err) {
      this.callbacks.onError(err);
      throw err;
    }
    return this;
  }

  // Public API methods
  scrollTo(offset, animated = true) {
    if (animated) {
      // TODO: implement smooth scrolling
      this.state.scrollOffset = offset;
    } else {
      this.state.scrollOffset = offset;
    }
    this._clampScrollOffset();
    this._requestRender();
  }

  scrollBy(delta, animated = true) {
    this.scrollTo(this.state.scrollOffset + delta, animated);
  }

  getScrollOffset() {
    return this.state.scrollOffset;
  }

  getScrollLimits() {
    return {
      min: -this.state.maxScroll,
      max: this.state.maxScroll,
    };
  }

  pause() {
    if (this.state.animationFrameId) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }
  }

  resume() {
    if (!this.state.animationFrameId) {
      this._startAnimationLoop();
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this._initCanvas();
  }

  destroy() {
    this.pause();
    // Remove event listeners
    if (this._pointerDownHandler) {
      this.canvas.removeEventListener("pointerdown", this._pointerDownHandler);
      this.canvas.removeEventListener("pointermove", this._pointerMoveHandler);
      this.canvas.removeEventListener("pointerup", this._pointerUpHandler);
      this.canvas.removeEventListener(
        "pointercancel",
        this._pointerCancelHandler
      );
    }
    if (this._wheelHandler) {
      this.canvas.removeEventListener("wheel", this._wheelHandler);
    }
    if (this._wheelTimeout) {
      clearTimeout(this._wheelTimeout);
    }
  }

  // Private methods
  _createState() {
    return {
      layers: {},
      scrollOffset: 0,
      velocityPxPerMs: 0,
      isDragging: false,
      isWheeling: false,
      lastX: 0,
      lastTime: 0,
      velocityHistory: [],
      isInitialized: false,
      canvasDpr: 1,
      maxScroll: 0,
      needsRender: true,
      lastFrameTime: performance.now(),
      animationFrameId: null,
      loadedCount: 0,
      totalLayers: 0,
      tick: 0,
    };
  }

  async _loadLayers() {
    const layers = {};
    let loadedCount = 0;

    for (const layerConfig of this.layerConfig) {
      const { name, image, speed, render } = layerConfig;

      try {
        let loadedImage;

        if (image instanceof Promise) {
          loadedImage = await image;
        } else if (
          image instanceof Image ||
          image instanceof HTMLCanvasElement
        ) {
          if (image instanceof Image && !image.complete) {
            loadedImage = await this._waitForImageLoad(image);
          } else {
            loadedImage = image;
          }
        } else {
          throw new Error(`Invalid image type for layer "${name}"`);
        }

        // If there's a render callback, create an offscreen canvas for compositing
        let offscreenCanvas = null;
        let offscreenCtx = null;
        if (render && typeof render === "function") {
          offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = loadedImage.width;
          offscreenCanvas.height = loadedImage.height;
          offscreenCtx = offscreenCanvas.getContext("2d");
        }

        layers[name] = {
          source: loadedImage,
          loaded: true,
          speed: speed,
          render: render || null,
          offscreenCanvas,
          offscreenCtx,
        };

        loadedCount++;
        this.callbacks.onLayerLoad({
          name,
          count: loadedCount,
          total: this.layerConfig.length,
        });
      } catch (err) {
        this.callbacks.onError(
          new Error(`Failed to load layer "${name}": ${err.message}`)
        );
        throw err;
      }
    }

    this.state.layers = layers;
    this.state.totalLayers = Object.keys(layers).length;
    this.state.loadedCount = loadedCount;
  }

  _waitForImageLoad(image) {
    return new Promise((resolve, reject) => {
      if (image.complete) {
        resolve(image);
      } else {
        image.onload = () => resolve(image);
        image.onerror = reject;
      }
    });
  }

  _initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.state.canvasDpr = dpr;

    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);

    this.canvas.style.touchAction = "none";

    this.state.isInitialized = true;

    this._computeMaxScroll();
    this._requestRender();
  }

  _computeMaxScroll() {
    if (!this.state.isInitialized || this.state.totalLayers === 0) {
      this.state.maxScroll = 0;
      return;
    }

    // Use the last layer to determine scroll limits
    const layers = Object.values(this.state.layers);
    const lastLayer = layers[layers.length - 1];
    if (!lastLayer || !lastLayer.loaded) {
      this.state.maxScroll = 0;
      return;
    }

    const source = lastLayer.source;
    const imgWidth = source.width;
    const imgHeight = source.height;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Calculate the scale factor to make the image height match canvas height
    const scale = canvasHeight / imgHeight;

    // The viewport width in source pixels (how much of the source we see at once)
    const sourceWidth = canvasWidth / scale;

    if (imgWidth <= sourceWidth) {
      this.state.maxScroll = 0;
    } else {
      // Calculate scroll limit: the max distance we can scroll before running out of image
      // For the last layer with its speed, we need to account for the speed multiplier
      const lastLayerSpeed = lastLayer.speed;
      this.state.maxScroll = (imgWidth - sourceWidth) / 2 / lastLayerSpeed;
    }

    this._clampScrollOffset();
  }

  _clampScrollOffset() {
    this.state.scrollOffset = Math.max(
      -this.state.maxScroll,
      Math.min(this.state.maxScroll, this.state.scrollOffset)
    );
  }

  _drawCanvas() {
    if (!this.state.isInitialized) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    Object.values(this.state.layers).forEach((layer) => {
      if (!layer.loaded) return;

      let source = layer.source;

      // If layer has a render callback, composite to offscreen canvas first
      if (
        layer.render &&
        typeof layer.render === "function" &&
        layer.offscreenCanvas
      ) {
        const offscreenCtx = layer.offscreenCtx;
        const imgWidth = layer.source.width;
        const imgHeight = layer.source.height;

        // Clear offscreen canvas
        offscreenCtx.clearRect(0, 0, imgWidth, imgHeight);

        // Draw the original image
        offscreenCtx.drawImage(layer.source, 0, 0);

        // Calculate layer state in image coordinates
        const scale = canvasHeight / imgHeight;
        const sourceWidth = canvasWidth / scale;
        const layerOffset = this.state.scrollOffset * layer.speed;
        const sourceX = Math.max(
          0,
          Math.min(
            imgWidth - sourceWidth,
            (imgWidth - sourceWidth) / 2 + layerOffset
          )
        );

        const layerState = {
          x: sourceX,
          y: 0,
          width: sourceWidth,
          height: imgHeight,
          centerX: imgWidth / 2, // Center of the entire image, not the viewport
          imageWidth: imgWidth,
          imageHeight: imgHeight,
          canvasWidth,
          canvasHeight,
          scale,
        };

        // Call the custom render function to draw on the offscreen canvas
        layer.render(offscreenCtx, layerState, this.state.tick);

        // Use the offscreen canvas as the source
        source = layer.offscreenCanvas;
      }

      const imgWidth = source.width;
      const imgHeight = source.height;

      // Calculate the scale factor to make the image height match canvas height
      // This maintains the image's aspect ratio
      const scale = canvasHeight / imgHeight;

      // The scaled width of the entire image (this extends beyond the viewport)
      const scaledImgWidth = imgWidth * scale;

      // Source rectangle dimensions - we extract a "viewport" from the source image
      // The viewport width in source pixels corresponds to canvas width when scaled
      const sourceWidth = canvasWidth / scale;
      const sourceHeight = imgHeight; // Use full height of source

      // Calculate horizontal position in the source image
      const layerOffset = this.state.scrollOffset * layer.speed;
      // Center the viewport and apply the layer offset
      const sourceX = Math.max(
        0,
        Math.min(
          imgWidth - sourceWidth,
          (imgWidth - sourceWidth) / 2 + layerOffset
        )
      );

      this.ctx.drawImage(
        source,
        sourceX,
        0,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvasWidth,
        canvasHeight
      );
    });
  }

  _requestRender() {
    this.state.needsRender = true;
  }

  _isMoving() {
    return Math.abs(this.state.velocityPxPerMs) > this.physics.minVelocity;
  }

  _updateMomentum(dtMs) {
    if (!this.state.velocityPxPerMs) return;

    // Integrate position
    this.state.scrollOffset -= this.state.velocityPxPerMs * dtMs;
    this._clampScrollOffset();

    // Simple linear friction
    const sign = Math.sign(this.state.velocityPxPerMs);
    let speed = Math.abs(this.state.velocityPxPerMs);
    speed = Math.max(0, speed - this.physics.friction * dtMs);

    if (speed === 0 || speed < this.physics.minVelocity) {
      this.state.velocityPxPerMs = 0;
    } else {
      this.state.velocityPxPerMs = sign * speed;
    }
  }

  _tick(now) {
    const dt = now - this.state.lastFrameTime;
    this.state.lastFrameTime = now;

    this._updateMomentum(dt);

    // Check if any layer has a render callback
    const hasRenderCallbacks = Object.values(this.state.layers).some(
      (layer) => layer.render && typeof layer.render === "function"
    );

    // Always render if there are custom render callbacks, otherwise only render when needed
    if (
      this.state.needsRender ||
      this._isMoving() ||
      this.state.isDragging ||
      hasRenderCallbacks
    ) {
      this.state.tick++;
      this._drawCanvas();
      this.state.needsRender = false;

      if (this.callbacks.onScroll) {
        this.callbacks.onScroll(this.state.scrollOffset);
      }
    }

    this.state.animationFrameId = requestAnimationFrame(this._tick.bind(this));
  }

  _startAnimationLoop() {
    this.state.lastFrameTime = performance.now();
    this.state.animationFrameId = requestAnimationFrame(this._tick.bind(this));
  }

  _handleStart(xCss) {
    this.state.isDragging = true;
    this.state.lastX = xCss * this.state.canvasDpr;
    this.state.lastTime = performance.now();
    this.state.velocityPxPerMs = 0;
    this.state.velocityHistory = [];
  }

  _handleMove(xCss) {
    if (!this.state.isDragging) return;

    const now = performance.now();
    const canvasX = xCss * this.state.canvasDpr;
    const deltaTime = now - this.state.lastTime;
    const deltaX = canvasX - this.state.lastX;

    if (deltaTime > 0) {
      const instantVelocity = deltaX / deltaTime;
      this.state.velocityHistory.push({ velocity: instantVelocity, time: now });
      if (this.state.velocityHistory.length > this.physics.velocitySampleSize) {
        this.state.velocityHistory.shift();
      }
    }

    this.state.scrollOffset -= deltaX;
    this._clampScrollOffset();

    this.state.lastX = canvasX;
    this.state.lastTime = now;

    this._requestRender();
  }

  _handleEnd() {
    if (!this.state.isDragging) return;
    this.state.isDragging = false;

    const now = performance.now();
    const recentSamples = this.state.velocityHistory.filter(
      (s) => now - s.time < this.physics.velocitySampleTimeMs
    );

    if (recentSamples.length > 0) {
      const avgVelocity =
        recentSamples.reduce((sum, s) => sum + s.velocity, 0) /
        recentSamples.length;
      this.state.velocityPxPerMs = avgVelocity;
    } else {
      this.state.velocityPxPerMs = 0;
    }

    this.state.velocityHistory = [];
    this._requestRender();
  }

  _setupInputHandlers() {
    this._pointerDownHandler = (e) => {
      if (this.input.capturePointer) {
        this.canvas.setPointerCapture(e.pointerId);
      }
      this._handleStart(e.clientX);
    };

    this._pointerMoveHandler = (e) => {
      this._handleMove(e.clientX);
    };

    this._pointerUpHandler = (e) => {
      if (this.input.capturePointer) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      this._handleEnd();
    };

    this._pointerCancelHandler = (e) => {
      if (this.input.capturePointer) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      this._handleEnd();
    };

    this._wheelHandler = (e) => {
      e.preventDefault();

      // Use deltaX for horizontal scrolling (trackpad left/right)
      // Also support deltaY for vertical scroll gestures that should map to horizontal
      const deltaX = e.deltaX !== 0 ? e.deltaX : e.deltaY;

      // Simulate drag behavior: treat wheel events as continuous drag movements
      if (!this.state.isWheeling) {
        // Start a wheel "drag" session
        this.state.isWheeling = true;
        this.state.lastX = 0;
        this.state.lastTime = performance.now();
        this.state.velocityPxPerMs = 0;
        this.state.velocityHistory = [];
      }

      // Simulate a drag move by updating the virtual X position
      const virtualX = this.state.lastX - deltaX;

      // Use the same logic as _handleMove
      const now = performance.now();
      const canvasX = virtualX * this.state.canvasDpr;
      const deltaTime = now - this.state.lastTime;
      const deltaPixels = canvasX - this.state.lastX * this.state.canvasDpr;

      if (deltaTime > 0) {
        const instantVelocity = deltaPixels / deltaTime;
        this.state.velocityHistory.push({
          velocity: instantVelocity,
          time: now,
        });
        if (
          this.state.velocityHistory.length > this.physics.velocitySampleSize
        ) {
          this.state.velocityHistory.shift();
        }
      }

      this.state.scrollOffset -= deltaPixels;
      this._clampScrollOffset();

      this.state.lastX = virtualX;
      this.state.lastTime = now;

      this._requestRender();

      // Clear the wheel timeout and set a new one
      if (this._wheelTimeout) {
        clearTimeout(this._wheelTimeout);
      }

      // End the wheel session after a short delay (like releasing the drag)
      this._wheelTimeout = setTimeout(() => {
        if (this.state.isWheeling) {
          // Apply momentum like _handleEnd does
          const now = performance.now();
          const recentSamples = this.state.velocityHistory.filter(
            (s) => now - s.time < this.physics.velocitySampleTimeMs
          );

          if (recentSamples.length > 0) {
            const avgVelocity =
              recentSamples.reduce((sum, s) => sum + s.velocity, 0) /
              recentSamples.length;
            this.state.velocityPxPerMs = avgVelocity;
          } else {
            this.state.velocityPxPerMs = 0;
          }

          this.state.velocityHistory = [];
          this.state.isWheeling = false;
          this._requestRender();
        }
      }, 100);
    };

    this.canvas.addEventListener("pointerdown", this._pointerDownHandler);
    this.canvas.addEventListener("pointermove", this._pointerMoveHandler);
    this.canvas.addEventListener("pointerup", this._pointerUpHandler);
    this.canvas.addEventListener("pointercancel", this._pointerCancelHandler);
    this.canvas.addEventListener("wheel", this._wheelHandler, {
      passive: false,
    });
  }
}

// Static helper for convenience
ScrollableCanvas.loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

export default ScrollableCanvas;
