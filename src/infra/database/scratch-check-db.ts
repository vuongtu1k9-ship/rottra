import { db } from "~/infra/database/db-pool";
import { product, user } from "~/infra/database/schema";

async function main() {
  console.log("Fetching all products...");
  const prods = await db.select().from(product);
  console.log(`Found ${prods.length} products.`);
  for (const p of prods) {
    console.log(`- Product: ${p.name}`);
    console.log(`  Seller ID: ${p.sellerId}`);
    console.log(`  Quantity: ${p.quantity}`);
    console.log(`  Price: ${p.price}`);
    console.log(`  Media:`, JSON.stringify(p.media));
    console.log(`  Status: ${p.status}`);
  }
}

main().then(() => process.exit(0));
