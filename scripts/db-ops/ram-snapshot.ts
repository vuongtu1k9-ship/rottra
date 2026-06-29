import fs from "fs";
import path from "path";
import { db } from "../../src/infra/database/db-pool";
import { agentTraining } from "../../src/infra/database/schema";

const SNAPSHOT_FILE = path.join(process.cwd(), "storage", "agent_memory_cryo.bin");

export async function createCryoSnapshot() {
  console.log("❄️ Initiating Cryo-Snapshotting...");
  try {
    const records = await db.select().from(agentTraining);
    const serializedData = JSON.stringify(records);
    const buffer = Buffer.from(serializedData, "utf-8");

    // Ensure storage folder exists
    const dir = path.dirname(SNAPSHOT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(SNAPSHOT_FILE, buffer);
    console.log(`❄️ Snapshot saved successfully: ${records.length} records, ${buffer.length} bytes.`);
  } catch (e) {
    console.error("❌ Cryo-Snapshot failed:", e);
  }
}

export async function restoreCryoSnapshot() {
  console.log("🔥 Restoring from Cryo-Snapshot...");
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      console.warn("⚠️ No snapshot file found at:", SNAPSHOT_FILE);
      return null;
    }

    const buffer = fs.readFileSync(SNAPSHOT_FILE);
    const dataString = buffer.toString("utf-8");
    const records = JSON.parse(dataString);
    console.log(`🔥 Restored ${records.length} agent state records from snapshot.`);
    return records;
  } catch (e) {
    console.error("❌ Restoration failed:", e);
    return null;
  }
}

// Allow direct script execution
if (require.main === module) {
  const mode = process.argv[2] || "save";
  if (mode === "restore") {
    restoreCryoSnapshot().then(() => process.exit(0));
  } else {
    createCryoSnapshot().then(() => process.exit(0));
  }
}
