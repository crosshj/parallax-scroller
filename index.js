import ScrollableCanvas from "./lib/ScrollableCanvas.js";
import ImageUtils from "./lib/image.utils.js";

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

  // Create scrollable canvas with image promises
  const scrollCanvas = new ScrollableCanvas({
    canvas: document.getElementById("canvas"),
    width: window.screen.width,
    height: window.screen.height,
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
      },
      {
        name: "front",
        image: layerImage("front", config.front),
        speed: 0.3,
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
  window.addEventListener("resize", () => updateViewportInfo(scrollCanvas));
};

document.addEventListener("DOMContentLoaded", contentLoaded);
