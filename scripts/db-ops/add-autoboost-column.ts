import { db } from "../../src/infra/database/db-pool";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Adding autoBoost column to SystemSetting table...");
  try {
    await db.execute(sql`
      ALTER TABLE "SystemSetting" ADD COLUMN "autoBoost" boolean DEFAULT false;
    `);
    console.log("✅ Column autoBoost added successfully!");
  } catch (err: any) {
    console.warn("⚠️ Column autoBoost might already exist or failed:", err.message);
  }
}

run();
