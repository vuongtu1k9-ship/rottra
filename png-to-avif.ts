import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function convertToAvif() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const filesToConvert = ["default-avatar.png", "no-image.png"];

  for (const file of filesToConvert) {
    const pngPath = path.join(process.cwd(), "public", file);
    if (!fs.existsSync(pngPath)) continue;

    const base64Png = fs.readFileSync(pngPath).toString("base64");
    const dataUri = `data:image/png;base64,${base64Png}`;

    const avifBase64 = await page.evaluate(async (uri) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/avif", 0.9));
        };
        img.src = uri;
      });
    }, dataUri);

    const avifData = avifBase64.replace(/^data:image\/avif;base64,/, "");
    const avifPath = path.join(process.cwd(), "public", file.replace(".png", ".avif"));
    fs.writeFileSync(avifPath, Buffer.from(avifData, "base64"));
    console.log(`Converted ${file} to AVIF using Chrome Canvas`);
  }

  await browser.close();
}

convertToAvif();
