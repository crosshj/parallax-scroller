console.log("okay");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v={{COMMIT_SHA}}");
}

function updateViewportDimensions() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  document.getElementById(
    "viewport-dimensions"
  ).textContent = `Viewport: ${width} x ${height}`;
}

updateViewportDimensions();
window.addEventListener("resize", updateViewportDimensions);
