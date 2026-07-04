import { db } from "./src/infra/database/db-pool";
import { vectorDocument } from "./src/infra/database/schema";

async function run() {
  const docs = await db.select().from(vectorDocument);
  const youtubeDocs = docs.filter(d => d.category.startsWith("YOUTUBE_"));
  console.log(`Total Youtube documents: ${youtubeDocs.length}`);
  
  youtubeDocs.forEach(d => {
    console.log(`- Title: ${d.title} | Category: ${d.category}`);
    console.log(`  Content: ${d.content.substring(0, 300)}...\n`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
