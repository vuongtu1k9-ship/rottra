import { pgClient } from "./db";

async function main() {
  console.log("⚙️  [Migration] Aligning Product table columns...");
  try {
    await pgClient.query(`
      ALTER TABLE "Product" 
      ADD COLUMN IF NOT EXISTS target_price bigint DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cost_price bigint DEFAULT 0,
      ADD COLUMN IF NOT EXISTS velocity real DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS kalman_variance real DEFAULT 0.1,
      ADD COLUMN IF NOT EXISTS storage_cost real DEFAULT 0.0;
    `);
    console.log("✅ [Migration] Columns target_price, cost_price, velocity, kalman_variance, storage_cost ensured successfully.");
  } catch (err: any) {
    console.error("❌ [Migration] Error altering Product table:", err.message || err);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(console.error);
