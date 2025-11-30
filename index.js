console.log("okay");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v={{COMMIT_SHA}}");
}

function updateViewportDimensions() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const physicalWidth = Math.round(width * dpr);
  const physicalHeight = Math.round(height * dpr);

  document.getElementById(
    "viewport-dimensions"
  ).textContent = `Viewport: ${width} x ${height} CSS pixels | ${physicalWidth} x ${physicalHeight} physical pixels (DPR: ${dpr})`;
}

updateViewportDimensions();
window.addEventListener("resize", updateViewportDimensions);
