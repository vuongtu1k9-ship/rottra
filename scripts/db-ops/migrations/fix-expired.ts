import { db } from "./db";
import { product } from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔍 Checking all products in the database...");
  const allProducts = await db.query.product.findMany();
  console.log(`Total products: ${allProducts.length}`);

  let nullCount = 0;
  for (const p of allProducts) {
    if (!p.expired) {
      nullCount++;
    }
  }
  console.log(`Products with NULL expiry: ${nullCount}`);

  if (nullCount > 0) {
    console.log("updating products to have a valid future expiry date...");
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // YYYY-MM-DD
    const result = await db
      .update(product)
      .set({
        expired: futureDate,
      })
      .where(sql`expired IS NULL`);
    console.log("✅ Update complete.");
  } else {
    console.log("No products with NULL expiry found.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
