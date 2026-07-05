/**
 * Rottra Vision AI Extractor
 * Extracts a 64-D OKLCH color and texture histogram from an image
 */

// Math functions for OKLCH conversion
function rgbToOklch(r: number, g: number, b: number): { L: number; c: number; h: number } {
  // Convert 8-bit to 0-1
  r /= 255;
  g /= 255;
  b /= 255;

  // sRGB to Linear sRGB
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Linear sRGB to LMS
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // Non-linear LMS
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS to OKLab
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_lab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  // OKLab to OKLCH
  const c = Math.sqrt(a * a + b_lab * b_lab);
  let h = Math.atan2(b_lab, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return { L, c, h };
}

export async function extractImageFeatures(imageUrlOrFile: string | File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 32; // Resize to 32x32 to extract macro features
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas not supported");

      ctx.drawImage(img, 0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size).data;

      // 64-D Vector: 32 bins for Hue, 16 bins for Chroma, 16 bins for L/Contrast
      const hueBins = new Array(32).fill(0);
      const chromaBins = new Array(16).fill(0);
      const lightnessBins = new Array(16).fill(0);
      
      let validPixels = 0;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const alpha = imgData[i + 3];

        if (alpha < 10) continue; // Ignore transparent pixels
        validPixels++;

        const { L, c, h } = rgbToOklch(r, g, b);

        // Discard hue for grayscale pixels (low chroma)
        if (c > 0.02) {
          const hBin = Math.floor((h / 360) * 32);
          hueBins[Math.min(hBin, 31)]++;
        }

        const cBin = Math.floor((c / 0.4) * 16); // max chroma around 0.4
        chromaBins[Math.min(cBin, 15)]++;

        const lBin = Math.floor(L * 16);
        lightnessBins[Math.min(lBin, 15)]++;
      }

      // Normalize bins
      const normalize = (arr: number[]) => arr.map(v => (validPixels > 0 ? v / validPixels : 0));
      
      const features = [
        ...normalize(hueBins),
        ...normalize(chromaBins),
        ...normalize(lightnessBins)
      ];

      resolve(features); // exactly 64 floats
    };

    img.onerror = () => reject("Failed to load image");

    if (typeof imageUrlOrFile === "string") {
      img.src = imageUrlOrFile;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(imageUrlOrFile);
    }
  });
}
