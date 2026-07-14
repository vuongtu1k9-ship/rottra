import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq, and, notLike } from "drizzle-orm";
import { initRAGEngine } from "~/core/neural-memory/vector-rag";

async function main() {
  console.log("🧹 [CLEANUP] Cleaning up duplicate or fallback YouTube documents...");

  // Select all YOUTUBE_WISDOM documents
  const docs = await db
    .select()
    .from(vectorDocument)
    .where(eq(vectorDocument.category, "YOUTUBE_WISDOM"));

  console.log(`Found ${docs.length} YOUTUBE_WISDOM documents.`);

  let deletedCount = 0;
  for (const doc of docs) {
    const meta = (doc.metadata as any) || {};
    // If transcriptIngested is false or not present, delete it
    if (!meta.transcriptIngested) {
      console.log(`❌ Deleting duplicate/fallback doc: ID=${doc.id}, Title="${doc.title}"`);
      await db.delete(vectorDocument).where(eq(vectorDocument.id, doc.id));
      deletedCount++;
    }
  }

  console.log(`Deleted ${deletedCount} fallback documents.`);

  // Refresh RAG
  console.log("⚙️ Refreshing RAG cache...");
  await initRAGEngine(true);
}

main().catch(console.error).finally(() => process.exit(0));
