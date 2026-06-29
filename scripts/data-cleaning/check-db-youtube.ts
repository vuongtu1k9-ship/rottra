import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(vectorDocument)
    .where(eq(vectorDocument.category, "YOUTUBE_WISDOM"));
  
  console.log("Total YOUTUBE_WISDOM documents in database:", result[0].count);

  const samples = await db
    .select({
      id: vectorDocument.id,
      title: vectorDocument.title,
      content: vectorDocument.content
    })
    .from(vectorDocument)
    .where(eq(vectorDocument.category, "YOUTUBE_WISDOM"))
    .limit(5);

  console.log("Sample records:");
  console.log(JSON.stringify(samples, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
