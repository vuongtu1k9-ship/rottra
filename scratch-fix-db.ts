import { db } from "./src/infra/database/db-pool";
import { product } from "./src/infra/database/schema";
import { eq } from "drizzle-orm";

async function fix() {
  const products = await db.select().from(product);
  for (const p of products) {
    const mediaList = Array.isArray(p.media) ? [...p.media] : [];
    let changed = false;
    for (const m of mediaList) {
      if (m.link && m.link.startsWith("http")) {
        m.link = "/images/no-image.avif";
        changed = true;
      }
    }
    if (changed) {
      await db.update(product).set({ media: mediaList }).where(eq(product.id, p.id));
      console.log(`Updated product ${p.name}`);
    }
  }
  console.log("Done fixing DB.");
  process.exit(0);
}
fix();
