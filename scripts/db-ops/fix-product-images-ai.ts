import { db } from "../../src/infra/database/db-pool";
import { product, users } from "../../src/infra/database/schema";
import { eq } from "drizzle-orm";
import { generateAgentImage } from "../../src/server/api/creative-engine";

async function main() {
  const products = await db.select().from(product);
  console.log(`Found ${products.length} products to generate images for.`);
  
  for (const p of products) {
    const text = (p.name + " " + (p.description || "")).substring(0, 100);
    console.log(`Generating image for: ${p.name}...`);
    // Pass a default agentId if seller isn't matched easily
    const agentId = "toLuong"; 
    const res = await generateAgentImage(agentId, text, { width: 800, height: 450 });
    
    if (res.success && res.url) {
      console.log(`-> Success: ${res.url}`);
      await db.update(product)
        .set({ media: [{ link: res.url, type: "image", name: p.name }] })
        .where(eq(product.id, p.id));
    } else {
      console.log(`-> Failed for ${p.name}: ${res.error}`);
    }
    // Delay to avoid spamming the free API too hard
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log("Done updating products with AI images.");
  process.exit(0);
}

main();
