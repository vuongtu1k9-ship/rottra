import sharp from "sharp";
import fs from "fs";
import path from "path";

async function convertToAvif(filename: string) {
  const inPath = path.join("public/images", filename + ".png");
  const outPath = path.join("public/images", filename + ".avif");
  if (fs.existsSync(inPath)) {
    try {
      await sharp(inPath)
        .avif({ lossless: true })
        .toFile(outPath);
      console.log(`Converted ${filename} to AVIF successfully.`);
    } catch (e) {
      console.error(`Failed to convert ${filename}:`, e);
    }
  } else {
    console.log(`Source file ${inPath} not found.`);
  }
}

async function run() {
  await convertToAvif("no-image");
  await convertToAvif("default-avatar");
  await convertToAvif("RottraAI_avatar");
  await convertToAvif("caramos-logo");
}

run();
