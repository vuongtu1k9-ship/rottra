import { db } from "./src/infra/database/db-pool";
import { product } from "./src/infra/database/schema";

async function check() {
  const products = await db.select().from(product);
  const badProducts = products.filter(p => {
    const mediaList = Array.isArray(p.media) ? p.media : [];
    return mediaList.some((m: any) => m.link && m.link.includes("http"));
  });
  console.log("Products with http:", JSON.stringify(badProducts.map(p => ({ id: p.id, media: p.media })), null, 2));
  process.exit(0);
}
check();
