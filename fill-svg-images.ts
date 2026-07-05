import { db } from './src/infra/database/db-pool.ts';
import { product } from './src/infra/database/schema.ts';
import { eq } from 'drizzle-orm';
import { generateProductSVG } from './src/server/api/local-media-engine.ts';

async function main() {
  console.log("Generating SVG images for products...");
  const allProducts = await db.select().from(product);
  let count = 0;

  for (const p of allProducts) {
    let needsImage = false;
    
    // Check if it has no media or just the placeholder
    if (!p.media || (Array.isArray(p.media) && p.media.length === 0)) {
      needsImage = true;
    } else if (Array.isArray(p.media)) {
      for (const m of p.media) {
        if (m.link === '/no-image.avif' || m.link === '/default-avatar.avif') {
          needsImage = true;
          break;
        }
      }
    }

    if (needsImage) {
      // Pick a random agent style
      const agents = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet"];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      
      const priceStr = p.price ? p.price.toLocaleString("vi-VN") + "đ" : "Giá Liên Hệ";
      
      const svgString = generateProductSVG(randomAgent, p.name, priceStr);
      const base64Svg = Buffer.from(svgString).toString("base64");
      const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
      
      const newMedia = [{
        link: dataUrl,
        name: p.name,
        type: "image/svg+xml"
      }];
      
      await db.update(product).set({ media: newMedia }).where(eq(product.id, p.id));
      count++;
    }
  }
  console.log(`Successfully generated SVG for ${count} products.`);
  process.exit(0);
}

main();
