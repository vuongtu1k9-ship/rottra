import app from "../routes/api/[...paths]";
import { dbContext } from "../infra/database/als";
import { startCronjobAI } from "./api/cronjob-ai";

const PORT = parseInt(process.env.PORT || "8080", 10);
console.log(`🚀 Cloudflare Worker starting...`);

export default {
  async fetch(request: Request, env: any, ctx: any) {
    // Inject the D1 database binding into the async context for global access
    return dbContext.run(env.ROTTRA_D1, async () => {
      return app.fetch(request, env, ctx);
    });
  },
  async scheduled(event: any, env: any, ctx: any) {
    // Inject DB context for cron jobs
    return dbContext.run(env.ROTTRA_D1, async () => {
      console.log("Running scheduled autonomous background engine...");
      // Wrap in try-catch to prevent crashing the worker
      try {
        // Assuming startCronjobAI performs a single run when adapted, or we call the logic here
        // If startCronjobAI is purely setInterval, it will need to be refactored to run once per trigger.
        startCronjobAI(); 
      } catch (e) {
        console.error("Cronjob error:", e);
      }
    });
  }
};
