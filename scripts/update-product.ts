import { db } from "../src/infra/database/db-pool";
import { product } from "../src/infra/database/schema";
import { like } from "drizzle-orm";

async function main() {
  try {
    const products = await db.select().from(product).where(like(product.name, "%Nấm lim xanh%"));
    if (products.length > 0) {
      for (const p of products) {
        await db.update(product)
          .set({ media: [{ link: "/uploads/nam_lim_xanh.avif", name: "Nấm lim xanh AVIF", type: "image/avif" }] })
          .where(like(product.name, "%Nấm lim xanh%"));
        console.log(`Updated product: ${p.name}`);
      }
    } else {
      console.log("Product not found");
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
