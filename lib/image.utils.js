const ImageUtils = ({ layerImageUrl }) => {
  // Helper to load an image
  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  };

  // Adds ruler markings to a canvas context
  function addRuler(ctx, width, height, config = {}) {
    const {
      interval = 100,
      tickHeight = 30,
      fontSize = 20,
      color = "#ffffff",
      y, // Optional: specific y position, defaults to center
    } = config;

    const centerX = width / 2;
    const rulerY = y !== undefined ? y : height / 2;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw tick marks and labels from center outward
    for (
      let i = -Math.floor(width / interval);
      i <= Math.floor(width / interval);
      i++
    ) {
      const x = centerX + i * interval;
      const pixelValue = i * interval;

      if (x < 0 || x > width) continue;

      ctx.beginPath();
      ctx.moveTo(x, rulerY - tickHeight / 2);
      ctx.lineTo(x, rulerY + tickHeight / 2);
      ctx.stroke();

      ctx.fillText(
        pixelValue.toString(),
        x,
        rulerY + tickHeight / 2 + fontSize
      );
    }

    // Horizontal ruler line
    ctx.beginPath();
    ctx.moveTo(0, rulerY);
    ctx.lineTo(width, rulerY);
    ctx.stroke();
  }

  // Adds a center dot to a canvas context
  function addCenterDot(ctx, width, height, config = {}) {
    const { color = "#ff0000", size = 1 } = config;

    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    ctx.fillStyle = color;
    ctx.fillRect(centerX, centerY, size, size);
  }

  // Load an image and optionally decorate it with debug markings
  function layerImage(name, options = {}) {
    const { rulerConfig, centerDotConfig } = options;

    return (async () => {
      const img = await loadImage(layerImageUrl(name));

      // If no decorations requested, return the image as-is
      if (!rulerConfig && !centerDotConfig) {
        return img;
      }

      // Create canvas to apply decorations
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Add debug decorations
      if (rulerConfig) {
        addRuler(ctx, img.width, img.height, {
          interval: 100,
          tickHeight: 30,
          fontSize: 20,
          color: "#ffffff",
          ...rulerConfig,
        });
      }

      if (centerDotConfig) {
        addCenterDot(ctx, img.width, img.height, {
          color: "#ff0000",
          size: 1,
          ...centerDotConfig,
        });
      }

      return canvas;
    })();
  }

  return { layerImage };
};
export default ImageUtils;
