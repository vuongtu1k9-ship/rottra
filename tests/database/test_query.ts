import { db } from "./db";
import { activity, user } from "./schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Executing activity query for last 10 logs...");
    const results = await db
      .select({
        id: activity.id,
        userId: activity.userId,
        userName: user.name,
        action: activity.action,
        message: activity.message,
        level: activity.level,
        device: activity.device,
        timestamp: activity.timestamp,
      })
      .from(activity)
      .leftJoin(user, eq(activity.userId, user.id))
      .orderBy(sql`${activity.timestamp} DESC`)
      .limit(10);

    console.log("Last 10 logs:", JSON.stringify(results, null, 2));
  } catch (error: any) {
    console.error("Query failed with error:", error);
  }
}

main().then(() => process.exit(0));
