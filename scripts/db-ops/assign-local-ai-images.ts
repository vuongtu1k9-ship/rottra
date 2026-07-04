import { db } from "../../src/infra/database/db-pool";
import { product, user } from "../../src/infra/database/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith("ai_auto_") && f.endsWith(".png"));
  
  if (files.length < 50) {
    console.error("Not enough images in public/uploads. Found:", files.length);
    process.exit(1);
  }
  
  // Shuffle the files to assign randomly
  for (let i = files.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }

  const products = await db.select().from(product);
  console.log(`Assigning unique images to ${products.length} products...`);
  
  let count = 0;
  for (const p of products) {
    const uniqueImage = "/uploads/" + files.pop();
    await db.update(product)
      .set({ media: [{ link: uniqueImage, type: "image", name: p.name }] })
      .where(eq(product.id, p.id));
    count++;
  }
  
  const agents = await db.select().from(user);
  console.log(`Assigning unique avatars to agents...`);
  
  let agentCount = 0;
  for (const a of agents) {
    if (a.role !== "system" && a.role !== "admin") continue;
    const uniqueAvatar = "/uploads/" + files.pop();
    await db.update(user)
      .set({ image: uniqueAvatar })
      .where(eq(user.id, a.id));
    agentCount++;
  }
  
  console.log(`Done! Updated ${count} products and ${agentCount} agents with totally unique local images.`);
  process.exit(0);
}

main();
