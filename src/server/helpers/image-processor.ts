import { Deterministic } from "~/shared/utils/rng";
import { randomBytes } from "node:crypto";
import { createLogger } from "~/shared/logger";

const log = createLogger("helpers/image-processor");

type ImageStyle = "watercolor" | "sketch" | "cyberpunk" | "oil" | "realism" | "corrupt" | "restore_blind";

let sharpInstance: any = null;
async function getSharp() {
  if (sharpInstance) return sharpInstance;
  const sharpName = "sharp";
  const mod = await import(sharpName);
  sharpInstance = mod.default || mod;
  return sharpInstance;
}

async function generatePaperTexture(width: number, height: number): Promise<Buffer> {
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i += 3) {
    const val = Math.round(128 + (Deterministic.random() * 24 - 12));
    noise[i] = noise[i + 1] = noise[i + 2] = val;
  }
  const sharp = await getSharp();
  return sharp(noise, {
    raw: { width, height, channels: 3 },
  })
    .blur(1.2)
    .raw()
    .toBuffer();
}

export async function applySketchStyle(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Invalid image");

  const [gray, paper] = await Promise.all([img.grayscale().raw().toBuffer(), generatePaperTexture(width, height)]);

  const sketchBuffer = await sharp(gray, { raw: { width, height, channels: 1 } })
    .linear(1, 0)
    .raw()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: sketchBuffer, raw: { width, height, channels: 1 } }])
    .modulate({ brightness: 1.6 })
    .raw()
    .toBuffer();
}

export async function applyWatercolorStyle(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Invalid image");

  return img.median(9).modulate({ saturation: 1.35 }).sharpen().raw().toBuffer();
}

export async function applyCyberpunkStyle(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Invalid image");

  return img.modulate({ saturation: 2.6, brightness: 1.2 }).tint({ r: 255, g: 0, b: 255 }).raw().toBuffer();
}

export async function applyOilStyle(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(inputPath).median(5).sharpen().modulate({ saturation: 1.3 }).raw().toBuffer();
}

export async function applyRealismStyle(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(inputPath)
    .median(3)
    .sharpen({ sigma: 1.5, m1: 1.4, m2: 2 })
    .modulate({ saturation: 1.15, brightness: 1.03 })
    .raw()
    .toBuffer();
}

export async function restoreImage(inputPath: string): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(inputPath).median(3).sharpen({ sigma: 2, m1: 1.3, m2: 3 }).modulate({ brightness: 1.12, saturation: 1.08 }).raw().toBuffer();
}

export async function splitImage(inputPath: string, outputBase: string, gridSize: number): Promise<string[]> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Invalid image");
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);
  const filenames: string[] = [];
  const baseName = outputBase.substring(0, outputBase.lastIndexOf("_split.avif"));
  const baseNameClean = baseName.substring(baseName.lastIndexOf("/") + 1);
  const dir = baseName.substring(0, baseName.lastIndexOf("/") + 1);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const partFileName = `${baseNameClean}_part_${r}_${c}.avif`;
      const outputPath = `${dir}${partFileName}`;
      await sharp(inputPath)
        .extract({
          left: c * cellWidth,
          top: r * cellHeight,
          width: cellWidth,
          height: cellHeight,
        })
        .toFile(outputPath);
      filenames.push(partFileName);
    }
  }
  return filenames;
}

export async function corruptImage(inputPath: string, outputPath: string): Promise<void> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Invalid image");

  let svgContent = `<svg width="${width}" height="${height}">`;
  for (let i = 0; i < 15; i++) {
    const w = Math.floor(20 + Deterministic.random() * (width / 4));
    const h = Math.floor(20 + Deterministic.random() * (height / 4));
    const x = Math.floor(Deterministic.random() * (width - w));
    const y = Math.floor(Deterministic.random() * (height - h));
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", "#000000", "#ffffff"];
    const color = colors[Math.floor(Deterministic.random() * colors.length)];
    const opacity = 0.5 + Deterministic.random() * 0.4;
    svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="${opacity}"/>`;
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Deterministic.random() * width);
    const y = Math.floor(Deterministic.random() * height);
    svgContent += `<text x="${x}" y="${y}" fill="#00ff00" font-family="monospace" font-size="24">CORRUPT_ERR_0x${Math.floor(
      Deterministic.random() * 65536,
    )
      .toString(16)
      .toUpperCase()}</text>`;
  }
  svgContent += `</svg>`;

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
    .toFile(outputPath);
}

export async function processImage(inputPath: string, outputPath: string, style?: ImageStyle): Promise<boolean> {
  try {
    let result: Buffer;
    const sharp = await getSharp();

    switch (style) {
      case "sketch":
        result = await applySketchStyle(inputPath);
        break;
      case "watercolor":
        result = await applyWatercolorStyle(inputPath);
        break;
      case "cyberpunk":
        result = await applyCyberpunkStyle(inputPath);
        break;
      case "oil":
        result = await applyOilStyle(inputPath);
        break;
      case "realism":
        result = await applyRealismStyle(inputPath);
        break;
      case "corrupt":
        await corruptImage(inputPath, outputPath);
        return true;
      case "restore_blind":
        result = await restoreImage(inputPath);
        break;
      default:
        result = await restoreImage(inputPath);
    }

    await sharp(result).toFile(outputPath);
    return true;
  } catch (err: any) {
    log.error("[ImageProcessor] Error:", err.message);
    return false;
  }
}

/**
 * Embeds a text string as a blind watermark using LSB (Least Significant Bit) in lossless PNG format.
 */
export async function embedBlindWatermark(inputPath: string, outputPath: string, secretText: string): Promise<boolean> {
  try {
    const sharp = await getSharp();
    const img = sharp(inputPath);
    const { width, height, channels } = await img.metadata();
    if (!width || !height || !channels) throw new Error("Invalid image metadata");

    // Retrieve raw pixel data
    const rawBuffer = await img.raw().toBuffer();

    // Prepare message with magic header and null-terminator
    const fullText = `[RW]${secretText}\0`;
    const bits: number[] = [];
    for (let i = 0; i < fullText.length; i++) {
      const charCode = fullText.charCodeAt(i);
      for (let bit = 7; bit >= 0; bit--) {
        bits.push((charCode >> bit) & 1);
      }
    }

    if (bits.length > rawBuffer.length) {
      throw new Error("Secret text is too long for this image capacity");
    }

    // Embed bits into the LSB of raw pixels
    for (let i = 0; i < bits.length; i++) {
      rawBuffer[i] = (rawBuffer[i] & 0xfe) | bits[i];
    }

    // Write back to PNG (lossless) to preserve LSB
    await sharp(rawBuffer, {
      raw: { width, height, channels },
    })
      .avif({ lossless: true })
      .toFile(outputPath);

    return true;
  } catch (err: any) {
    log.error("[Watermark] Embedding failed:", err.message);
    return false;
  }
}

/**
 * Extracts a secret text embedded via LSB blind watermarking from an image.
 */
export async function extractBlindWatermark(inputPath: string): Promise<string | null> {
  try {
    const sharp = await getSharp();
    const img = sharp(inputPath);
    const { width, height, channels } = await img.metadata();
    if (!width || !height || !channels) throw new Error("Invalid image metadata");

    const rawBuffer = await img.raw().toBuffer();

    const bits: number[] = [];
    let text = "";
    const magicHeader = "[RW]";

    // Read bits in bytes (8 bits each)
    for (let i = 0; i < rawBuffer.length; i += 8) {
      if (i + 8 > rawBuffer.length) break;

      let charCode = 0;
      for (let bit = 0; bit < 8; bit++) {
        const bitVal = rawBuffer[i + bit] & 1;
        charCode = (charCode << 1) | bitVal;
      }

      const char = String.fromCharCode(charCode);
      if (char === "\0") {
        break;
      }
      text += char;

      // Early exit check if magic header doesn't match
      if (text.length === magicHeader.length && text !== magicHeader) {
        return null;
      }
    }

    if (text.startsWith(magicHeader)) {
      return text.substring(magicHeader.length);
    }

    return null;
  } catch (err: any) {
    log.error("[Watermark] Extraction failed:", err.message);
    return null;
  }
}
