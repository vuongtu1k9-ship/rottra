import { db } from "./db-pool";
import { vectorDocument } from "./schema";

const docs = await db.select().from(vectorDocument);
console.log(`Total documents: ${docs.length}`);
for (const doc of docs) {
  console.log(`- ID: ${doc.id}, Category: ${doc.category}, Title: ${doc.title}`);
  if (doc.content.toLowerCase().includes("chuộc") || doc.content.toLowerCase().includes("cống")) {
    console.log(`  MATCH: ${doc.content.substring(0, 150)}...`);
  }
}
process.exit(0);
