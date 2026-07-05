import { db } from './src/infra/database/db-pool.ts';
import { product } from './src/infra/database/schema.ts';
import { eq } from 'drizzle-orm';
import { generateProductVideoAd } from './src/server/helpers/video-ad-generator.ts';

async function main() {
  console.log("Generating Video Ads for the first 2 products...");
  const allProducts = await db.select().from(product).limit(2);
  let count = 0;

  for (const p of allProducts) {
    console.log(`Generating video for: ${p.name}`);
    const renderRes = await generateProductVideoAd(p.id);
    
    if (renderRes.success) {
      const realVideoUrl = `/videos/output_${p.id}.mp4`;
      
      let currentMedia: any[] = [];
      if (typeof p.media === "string") {
        try { currentMedia = JSON.parse(p.media); } catch(e){}
      } else if (Array.isArray(p.media)) {
        currentMedia = p.media;
      }
      
      const newMedia = [...currentMedia, { link: realVideoUrl, type: "video/mp4" }];
      await db.update(product).set({ media: newMedia }).where(eq(product.id, p.id));
      count++;
      console.log(`Successfully generated video for ${p.name}`);
    } else {
      console.log(`Failed to generate video for ${p.name}`);
    }
  }
  
  console.log(`Successfully attached videos for ${count} products.`);
  process.exit(0);
}

main();
