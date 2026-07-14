import { createLogger } from "~/shared/logger";
import { db } from "~/infra/database/db-pool";
import { agentTask } from "~/infra/database/schema";
import { eq, and, lte } from "drizzle-orm";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";

const log = createLogger("api/cronjob-ai");

const HEARTBEAT_INTERVAL_MS = process.env.HEARTBEAT_INTERVAL_MS ? parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) : 60000; // 60 seconds

export function startCronjobAI() {
  log.info("🚀 [Cronjob AI] Autonomous Core starting up...");

  setInterval(async () => {
    try {
      const nowStr = new Date().toISOString();

      // Find pending tasks that are scheduled for now or earlier
      const tasks = await db.query.agentTask.findMany({
        where: and(eq(agentTask.status, "pending"), lte(agentTask.scheduledFor, nowStr)),
        limit: 5,
      });

      if (tasks.length === 0) return;

      log.info(`[Cronjob AI] Waking up to process ${tasks.length} pending tasks...`);

      for (const task of tasks) {
        // Lock the task
        await db.update(agentTask).set({ status: "running" }).where(eq(agentTask.id, task.id));

        log.info(`[Cronjob AI] Executing Task [${task.taskType}]: ${task.title}`);

        let resultData: any = {};
        let finalStatus = "completed";

        try {
          // Offload to Swarm/AI SDK
          const aiContext = `You are the Autonomous Background Agent. 
Perform the following task:
Title: ${task.title}
Description: ${task.description || "No detailed description"}
Task Type: ${task.taskType}

Return a concise text report of your findings.`;

          const { text } = await generateTextLocal({
            prompt: aiContext,
            isInternalReasoning: true,
          });

          resultData = {
            report: text,
            executedAt: new Date().toISOString(),
          };
          log.info(`[Cronjob AI] Task [${task.id}] completed successfully.`);
        } catch (execError: any) {
          log.error(`[Cronjob AI] Task [${task.id}] failed:`, execError);
          finalStatus = "failed";
          resultData = { error: execError.message };
        }

        // Save result
        await db
          .update(agentTask)
          .set({
            status: finalStatus,
            resultData,
            completedAt: new Date().toISOString(),
          })
          .where(eq(agentTask.id, task.id));
      }
    } catch (e) {
      log.error("[Cronjob AI] Engine heartbeat error:", e);
    }
  }, HEARTBEAT_INTERVAL_MS);
}
