import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const svgPath = path.resolve("public/favicon.svg");
const pngPath = path.resolve("public/favicon.png");

async function convert() {
  console.log("Reading SVG from:", svgPath);
  const svgBuffer = fs.readFileSync(svgPath);

  console.log("Converting to PNG using sharp...");
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(pngPath);

  console.log("Success! Saved PNG to:", pngPath);
}

convert().catch(console.error);
