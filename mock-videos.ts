import { db } from './src/infra/database/db-pool.ts';
import { product } from './src/infra/database/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("Mocking Video Ads for all products...");
  const allProducts = await db.select().from(product);
  let count = 0;

  const sampleVideos = [
    "/videos/test-video.mp4",
    "/videos/toLuong-sample.mp4",
    "/videos/thuongNguyet-sample.mp4",
    "/videos/daoTieuCuu-sample.mp4"
  ];

  for (const p of allProducts) {
    let currentMedia: any[] = [];
    if (typeof p.media === "string") {
      try { currentMedia = JSON.parse(p.media); } catch(e){}
    } else if (Array.isArray(p.media)) {
      currentMedia = p.media;
    }
    
    const hasVideo = currentMedia.some(m => m.type && m.type.startsWith('video'));
    
    if (!hasVideo) {
      const randomVideo = sampleVideos[Math.floor(Math.random() * sampleVideos.length)];
      const newMedia = [...currentMedia, { link: randomVideo, type: "video/mp4" }];
      
      await db.update(product).set({ media: newMedia }).where(eq(product.id, p.id));
      count++;
    }
  }
  
  console.log(`Successfully attached offline sample videos for ${count} products.`);
  process.exit(0);
}

main();
