import { db } from './src/infra/database/db-pool.ts';
import { product, banner } from './src/infra/database/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("Cleaning products...");
  const allProducts = await db.select().from(product);
  let pCount = 0;
  for (const p of allProducts) {
    if (p.media && Array.isArray(p.media)) {
      let changed = false;
      const newMedia = p.media.map(m => {
        if (m.link && typeof m.link === 'string' && m.link.startsWith('http')) {
          changed = true;
          return { ...m, link: '/no-image.avif' };
        }
        return m;
      });
      if (changed) {
        await db.update(product).set({ media: newMedia }).where(eq(product.id, p.id));
        pCount++;
      }
    }
  }
  console.log(`Fixed ${pCount} products.`);

  console.log("Cleaning banners...");
  const allBanners = await db.select().from(banner);
  let bCount = 0;
  for (const b of allBanners) {
    if (b.media && typeof b.media === 'string' && b.media.startsWith('http')) {
      await db.update(banner).set({ media: '/no-image.avif' }).where(eq(banner.id, b.id));
      bCount++;
    }
  }
  console.log(`Fixed ${bCount} banners.`);

  process.exit(0);
}

main();
