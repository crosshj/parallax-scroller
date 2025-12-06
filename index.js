import ScrollableCanvas from "./lib/ScrollableCanvas.js?v={{COMMIT_SHA}}";
import ImageUtils from "./lib/image.utils.js?v={{COMMIT_SHA}}";

const layerImageUrl = (name) => `/images/layers1/${name}.png?v={{COMMIT_SHA}}`;
const { layerImage } = ImageUtils({ layerImageUrl });

const contentLoaded = async () => {
  // Check debug mode and apply class to body
  const isDebugMode = localStorage.getItem("debugMode") === "true";
  if (isDebugMode) {
    document.body.classList.add("debug-mode");
  }

  // Debug toggle button
  const debugToggle = document.getElementById("debug-toggle");
  if (debugToggle) {
    debugToggle.addEventListener("click", () => {
      const currentDebugMode = localStorage.getItem("debugMode") === "true";
      localStorage.setItem("debugMode", String(!currentDebugMode));
      window.location.reload();
    });
  }

  // Update viewport dimensions display
  const updateViewportInfo = (scrollCanvas) => {
    const info = document.getElementById("viewport-dimensions");
    if (info && scrollCanvas && scrollCanvas.state) {
      const canvas = scrollCanvas.canvas;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = scrollCanvas.state.canvasDpr;
      info.textContent =
        `Canvas: ${canvas.width} x ${canvas.height} physical px | ` +
        `Viewport: ${width} x ${height} CSS px (DPR: ${dpr})`;
    }
  };

  const config = { back: {}, middle: {}, front: {} };
  if (isDebugMode) {
    config.back = {
      rulerConfig: {
        y: 400,
      },
    };
    config.middle = {
      rulerConfig: {
        y: 650,
      },
      centerDotConfig: {},
    };
    config.front = {
      rulerConfig: {
        y: 900,
      },
    };
  }
  const animatedBall =
    ({ color = "red", xFromCenter = 100, radius = 25 } = {}) =>
    (ctx, layerState, tick) => {
      // Example: Draw an animated red circle
      // Position relative to layer center and top in image coordinates
      const yFromTop = 750 + Math.sin(tick * 0.1) * 50; // Bounce animation

      // Draw directly in image coordinates - the context is already transformed
      const x = layerState.centerX + xFromCenter;
      const y = yFromTop;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

  // Create scrollable canvas with image promises
  const scrollCanvas = new ScrollableCanvas({
    canvas: document.getElementById("canvas"),
    width: window.innerWidth,
    height: window.innerHeight,
    layers: [
      {
        name: "back",
        image: layerImage("back", config.back),
        speed: 0.01,
      },
      {
        name: "middle",
        image: layerImage("middle", config.middle),
        speed: 0.02,
        render: animatedBall({
          color: "limegreen",
          xFromCenter: -100,
          radius: 18,
        }),
      },
      {
        name: "front",
        image: layerImage("front", config.front),
        speed: 0.3,
        render: animatedBall({ color: "purple" }),
      },
    ],
    physics: {
      friction: 0.003,
      velocitySampleSize: 5,
      velocitySampleTimeMs: 50,
    },
    onReady: () => {
      updateViewportInfo(scrollCanvas);
    },
    onLayerLoad: ({ name, count, total }) => {
      console.log(`Loaded ${name} (${count}/${total})`);
    },
  });

  await scrollCanvas.init();

  // Update viewport dimensions display on resize
  window.addEventListener("resize", () => {
    scrollCanvas.resize(window.innerWidth, window.innerHeight);
    updateViewportInfo(scrollCanvas);
  });
};

document.addEventListener("DOMContentLoaded", contentLoaded);
