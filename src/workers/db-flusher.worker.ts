import { SQLiteBuffer } from "../infra/database/sqlite-buffer";
import { getDb } from "../infra/database/db-pool";
import { negotiationLog, blockchainLedger } from "../infra/database/schema";

const db = getDb();

console.log("[DB Flusher] ⚙️ Worker started. Monitoring WAL SQLite...");

// Run every 5 seconds
setInterval(async () => {
  const records = SQLiteBuffer.pull(500); // pull max 500 records at a time
  if (records.length === 0) return;

  console.log(`[DB Flusher] 🔄 Found ${records.length} pending logs in SQLite. Flushing to Postgres...`);

  const negotiationInserts = [];
  const ledgerInserts = [];
  const dpoInserts = [];
  let maxId = 0;

  for (const record of records) {
    if (record.id > maxId) maxId = record.id;
    try {
      const payload = JSON.parse(record.payload);
      if (record.table_name === "negotiationLog") {
        negotiationInserts.push(payload);
      } else if (record.table_name === "blockchainLedger") {
        ledgerInserts.push(payload);
      } else if (record.table_name === "dpoTrainingData") {
        dpoInserts.push(payload);
      }
    } catch (e) {
      console.error(`[DB Flusher] Failed to parse payload for record ${record.id}`);
    }
  }

  try {
    // We use transactions or batch operations if needed, but since we're not inside the
    // same transaction as other things, we can just insert them concurrently.
    const promises = [];
    if (negotiationInserts.length > 0) {
      promises.push(db.insert(negotiationLog).values(negotiationInserts).onConflictDoNothing());
    }
    if (ledgerInserts.length > 0) {
      promises.push(db.insert(blockchainLedger).values(ledgerInserts).onConflictDoNothing());
    }
    if (dpoInserts.length > 0) {
      // Import the schema dynamically to avoid undefined schema if added later, but we can just import it at top
      const { dpoTrainingData } = require("../infra/database/schema");
      promises.push(db.insert(dpoTrainingData).values(dpoInserts).onConflictDoNothing());
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // Clear from SQLite
    SQLiteBuffer.clearUpToId(maxId);
    console.log(`[DB Flusher] ✅ Successfully flushed ${records.length} records. SQLite L2 cleared up to ID: ${maxId}.`);
  } catch (err: any) {
    console.error(`[DB Flusher] ❌ Flush failed! PostgreSQL error:`, err.message);
    // Don't clear SQLite if PostgreSQL insert failed. It will retry next tick.
  }
}, 5000);
