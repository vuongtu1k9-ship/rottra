import { db } from "../../src/infra/database/db-pool.js";
import { product } from "../../src/infra/database/schema.js";
import { visionBrain } from "../../src/core/nlp-cognitive/vision-brain.js";
import puppeteer from "puppeteer";
import "dotenv/config";

async function main() {
  console.log("🚀 Bắt đầu luyện hóa Rottra Vision AI...");
  const products = await db.select().from(product);
  
  if (products.length === 0) {
    console.log("Không có sản phẩm nào để train.");
    process.exit(0);
  }

  console.log(`Đã tìm thấy ${products.length} sản phẩm. Khởi động Puppeteer Simulator...`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Inject extraction function
  await page.evaluate(() => {
    (window as any).rgbToOklch = function(r: number, g: number, b: number) {
      r /= 255; g /= 255; b /= 255;
      r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
      g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
      b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
      const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
      const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
      const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
      const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s);
      const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
      const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
      const b_lab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
      const c = Math.sqrt(a * a + b_lab * b_lab);
      let h = Math.atan2(b_lab, a) * (180 / Math.PI);
      if (h < 0) h += 360;
      return { L, c, h };
    };

    (window as any).extractFeatures = async function(url: string) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = 32;
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("No Canvas");
          ctx.drawImage(img, 0, 0, size, size);
          const imgData = ctx.getImageData(0, 0, size, size).data;
          const hueBins = new Array(32).fill(0);
          const chromaBins = new Array(16).fill(0);
          const lightnessBins = new Array(16).fill(0);
          let validPixels = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i]; const g = imgData[i + 1]; const b = imgData[i + 2]; const a = imgData[i + 3];
            if (a < 10) continue;
            validPixels++;
            const { L, c, h } = (window as any).rgbToOklch(r, g, b);
            if (c > 0.02) hueBins[Math.min(Math.floor((h / 360) * 32), 31)]++;
            chromaBins[Math.min(Math.floor((c / 0.4) * 16), 15)]++;
            lightnessBins[Math.min(Math.floor(L * 16), 15)]++;
          }
          const normalize = (arr: number[]) => arr.map(v => (validPixels > 0 ? v / validPixels : 0));
          resolve([...normalize(hueBins), ...normalize(chromaBins), ...normalize(lightnessBins)]);
        };
        img.onerror = () => reject("Load failed");
        img.src = url;
      });
    };
  });

  const dataset: { features: number[], category: string }[] = [];

  for (const p of products) {
    let imgUrl = "";
    if (p.media && Array.isArray(p.media) && p.media.length > 0) {
      imgUrl = (p.media[0] as any)?.link || "";
    }
    if (!imgUrl) continue;
    if (imgUrl.startsWith("/")) imgUrl = "http://localhost:8080" + imgUrl; // Assume local server for relative paths

    try {
      console.log(`Extracting features for ${p.name}...`);
      const features = await page.evaluate(async (url) => {
        return await (window as any).extractFeatures(url);
      }, imgUrl) as number[];
      dataset.push({ features, category: p.category || "Unknown" });
    } catch (e) {
      console.log(`Failed to extract ${p.name}`);
    }
  }

  await browser.close();

  if (dataset.length === 0) {
    console.log("Không lấy được đặc trưng ảnh nào.");
    process.exit(1);
  }

  console.log(`Tiến hành luyện đan với ${dataset.length} mẫu...`);
  // Train the network for 500 epochs
  const epochs = 500;
  for (let e = 0; e < epochs; e++) {
    for (const item of dataset) {
      visionBrain.trainSingle(item.features, item.category, 0.05); // High learning rate for fast converge
    }
  }

  visionBrain.saveWeights();
  console.log("✅ Luyện hóa thành công! Đã lưu trọng số vào storage/vision-weights.json.");
  process.exit(0);
}

main();
