import sharp from "sharp";
import fs from "fs";
import path from "path";

async function main() {
  const inputPath = process.argv[2];
  const outputName = process.argv[3] || "nam_lim_xanh.avif";
  
  if (!inputPath) {
    console.error("Please provide input path");
    process.exit(1);
  }

  const outputPath = path.resolve(process.cwd(), "public/uploads", outputName);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    await sharp(inputPath)
      .avif({ quality: 80, effort: 4 })
      .toFile(outputPath);
    console.log(`Successfully created AVIF: ${outputPath}`);
  } catch (err) {
    console.error("Failed to create AVIF", err);
  }
}

main();
