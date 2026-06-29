import { pgClient } from "./db";

async function main() {
  console.log("⚙️  [Migration] Aligning database table indexes...");
  try {
    // Index on Product table sellerId column (since Drizzle is case-sensitive, it's "sellerId")
    console.log('1. Creating index on Product("sellerId")...');
    await pgClient.query(`
      CREATE INDEX IF NOT EXISTS idx_product_seller_id ON "Product" ("sellerId");
    `);

    // Index on AgentMemory table sessionId and contextKey
    console.log('2. Creating indexes on AgentMemory("sessionId") and ("contextKey")...');
    await pgClient.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_session_id ON "AgentMemory" ("sessionId");
    `);
    await pgClient.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_context_key ON "AgentMemory" ("contextKey");
    `);

    // Index on Message table assemblyId
    console.log('3. Creating index on Message("assemblyId")...');
    await pgClient.query(`
      CREATE INDEX IF NOT EXISTS idx_message_assembly_id ON "Message" ("assemblyId");
    `);

    console.log("✅ [Migration] Database indexes aligned successfully!");
  } catch (err: any) {
    console.error("❌ [Migration] Error creating database indexes:", err.message || err);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(console.error);
