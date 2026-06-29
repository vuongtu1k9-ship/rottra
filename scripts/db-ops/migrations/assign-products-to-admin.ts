import { db } from "./db";
import { user, product } from "./schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
  console.log("Locating admin user...");
  const adminRecords = await db.select().from(user).where(eq(user.email, "admin@test.com")).limit(1);
  if (adminRecords.length === 0) {
    console.error("❌ Admin user not found!");
    process.exit(1);
  }

  const adminId = adminRecords[0].id;
  console.log(`✅ Found admin user: ${adminRecords[0].name} (ID: ${adminId})`);

  // Assign the first 20 seeded products to the admin user
  const targetProductIds = Array.from({ length: 20 }, (_, i) => `prod_seed_${i + 1}`);

  console.log("Updating product sellers in database...");
  const updated = await db.update(product).set({ sellerId: adminId }).where(inArray(product.id, targetProductIds)).returning();

  console.log(`✅ Successfully assigned ${updated.length} products to the admin user!`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
