import pica from "pica";

const p = pica();

// Main Image Enhancer — pica Lanczos-3 for resize + custom bilateral/unsharp filters
export async function enhanceImage(imageSrc: string, options: { denoise: number; sharpen: number; upscale: boolean }): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject("Không thể nạp tệp hình ảnh để xử lý.");
    el.src = imageSrc;
  });

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (options.upscale) {
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = width;
    srcCanvas.height = height;
    srcCanvas.getContext("2d")!.drawImage(img, 0, 0);

    const scaledW = width * 2;
    const scaledH = height * 2;
    const destCanvas = document.createElement("canvas");
    destCanvas.width = scaledW;
    destCanvas.height = scaledH;

    await p.resize(srcCanvas, destCanvas, { quality: 3 });

    width = scaledW;
    height = scaledH;
    const ctx = destCanvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    if (options.denoise > 0) applyBilateralFilter(data, width, height, options.denoise / 100);
    if (options.sharpen > 0) applyUnsharpMask(data, width, height, options.sharpen);

    ctx.putImageData(imgData, 0, 0);
    return destCanvas.toDataURL("image/png");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  if (options.denoise > 0) applyBilateralFilter(data, width, height, options.denoise / 100);
  if (options.sharpen > 0) applyUnsharpMask(data, width, height, options.sharpen);

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

function applyBilateralFilter(data: Uint8ClampedArray, w: number, h: number, strength: number) {
  const src = new Uint8ClampedArray(data);
  const radius = 2;
  const spatialSigma = 2.0;
  const rangeSigma = 30.0;

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const idx = (y * w + x) * 4;
      const r = src[idx],
        g = src[idx + 1],
        b = src[idx + 2];
      let sumR = 0,
        sumG = 0,
        sumB = 0,
        wSum = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const kidx = ((y + ky) * w + (x + kx)) * 4;
          const colorDist = (r - src[kidx]) ** 2 + (g - src[kidx + 1]) ** 2 + (b - src[kidx + 2]) ** 2;
          const dist2 = ky * ky + kx * kx;
          const weight = Math.exp(-dist2 / (2 * spatialSigma * spatialSigma)) * Math.exp(-colorDist / (2 * rangeSigma * rangeSigma));
          sumR += src[kidx] * weight;
          sumG += src[kidx + 1] * weight;
          sumB += src[kidx + 2] * weight;
          wSum += weight;
        }
      }
      if (wSum > 0) {
        data[idx] = r * (1 - strength) + (sumR / wSum) * strength;
        data[idx + 1] = g * (1 - strength) + (sumG / wSum) * strength;
        data[idx + 2] = b * (1 - strength) + (sumB / wSum) * strength;
      }
    }
  }
}

function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, amount: number) {
  const kernel = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
  const blurred = new Uint8ClampedArray(data.length);
  const temp = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let k = 0; k < 5; k++) {
        const px = Math.min(w - 1, Math.max(0, x + k - 2));
        const i = (y * w + px) * 4;
        r += data[i] * kernel[k];
        g += data[i + 1] * kernel[k];
        b += data[i + 2] * kernel[k];
      }
      const oi = (y * w + x) * 4;
      temp[oi] = r;
      temp[oi + 1] = g;
      temp[oi + 2] = b;
      temp[oi + 3] = data[oi + 3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let k = 0; k < 5; k++) {
        const py = Math.min(h - 1, Math.max(0, y + k - 2));
        const i = (py * w + x) * 4;
        r += temp[i] * kernel[k];
        g += temp[i + 1] * kernel[k];
        b += temp[i + 2] * kernel[k];
      }
      const oi = (y * w + x) * 4;
      blurred[oi] = r;
      blurred[oi + 1] = g;
      blurred[oi + 2] = b;
    }
  }

  const strength = (amount / 100) * 2.2;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + strength * (data[i] - blurred[i])));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + strength * (data[i + 1] - blurred[i + 1])));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + strength * (data[i + 2] - blurred[i + 2])));
  }
}
