import { db } from "~/infra/database/db-pool";
import { createLogger } from "~/shared/logger";
import { agentTraining } from "~/infra/database/schema";
import { eq } from "drizzle-orm";

const log = createLogger("api/clean_bad_db");

async function cleanDB() {
  log.info("Cleaning up hallucinated records from AgentTraining...");
  try {
    const allRecords = await db.query.agentTraining.findMany();
    let deletedCount = 0;
    for (const record of allRecords) {
      if (
        record.answer &&
        (record.answer.includes("Tư duy bảo thủ") ||
          record.answer.includes("Thách thức trí tuệ giáo sư") ||
          record.answer.includes("S = 10") ||
          record.answer.includes("Hệ thống suy luận dự đoán"))
      ) {
        await db.delete(agentTraining).where(eq(agentTraining.id, record.id));
        log.info(`Deleted bad record for utterance: ${record.utterance}`);
        deletedCount++;
      }
    }
    log.info(`Successfully deleted ${deletedCount} bad records.`);
  } catch (e) {
    log.error("Error:", e);
  }
  process.exit(0);
}

cleanDB();
