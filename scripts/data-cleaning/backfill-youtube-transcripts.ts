#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import puppeteer from "puppeteer";
import { extractYoutubeTranscript } from "../lib/youtube-transcript-helper";

async function main() {
  const limitArg = process.argv.find(arg => arg.startsWith("--limit="));
  const workerArg = process.argv.find(arg => arg.startsWith("--workers="));
  const force = process.argv.includes("--force");

  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;
  const numWorkers = workerArg ? parseInt(workerArg.split("=")[1], 10) : 2;

  console.log(`🧹 [YOUTUBE BACKFILL] Starting backfill process...`);
  console.log(`- Limit: ${limit}`);
  console.log(`- Workers: ${numWorkers}`);
  console.log(`- Force: ${force}`);

  // 1. Initialize RAG
  console.log("⚙️ Loading RAG vocabulary...");
  const { vocabulary } = await initRAGEngine();

  // 2. Fetch all YOUTUBE_WISDOM documents
  const allDocs = await db
    .select()
    .from(vectorDocument)
    .where(eq(vectorDocument.category, "youtube_wisdom"));

  console.log(`📋 Found ${allDocs.length} total YOUTUBE_WISDOM documents in database.`);

  // Filter those that need backfilling
  const pendingDocs = allDocs.filter(doc => {
    if (force) return true;
    const meta = (doc.metadata as any) || {};
    return !meta.transcriptIngested;
  });

  console.log(`🆕 Pending documents for transcript backfill: ${pendingDocs.length}`);

  if (pendingDocs.length === 0) {
    console.log("✅ No documents need backfilling.");
    process.exit(0);
  }

  // Slice to limit
  const docsToProcess = pendingDocs.slice(0, limit);
  console.log(`🚀 Processing a batch of ${docsToProcess.length} documents using ${numWorkers} parallel workers...`);

  // 3. Launch Puppeteer Browser
  console.log("🌐 Launching Puppeteer browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  let processedCount = 0;
  let successCount = 0;
  let queueIndex = 0;

  async function worker(workerId: number) {
    const page = await browser.newPage();

    // Request interception disabled to ensure YouTube player metadata and components (like products) render fully,
    // which is required for dynamic transcript loading to trigger reliably.
    /*
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    */

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 1000 });
    await new Promise(r => setTimeout(r, 2000));

    while (true) {
      // Get next document index
      const currentIndex = queueIndex++;
      if (currentIndex >= docsToProcess.length) {
        break;
      }

      const doc = docsToProcess[currentIndex];
      const meta = (doc.metadata as any) || {};
      const videoUrl = meta.url || doc.content.match(/https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/)?.[0];

      if (!videoUrl) {
        console.log(`[Worker ${workerId}] [${currentIndex + 1}/${docsToProcess.length}] Skipping "${doc.title}" - No video URL`);
        continue;
      }

      console.log(`[Worker ${workerId}] [${currentIndex + 1}/${docsToProcess.length}] Processing: "${doc.title}"`);
      const transcript = await extractYoutubeTranscript(page, videoUrl);

      if (transcript && transcript.trim().length > 0) {
        const cleanTitle = doc.title.normalize("NFC");
        const newContent = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${transcript} Xem trực tiếp tại: ${videoUrl}`;
        const flatText = cleanAndNormalize(`${cleanTitle} ${newContent}`);
        const newEmbedding = generateEmbedding(flatText, vocabulary);

        const newMetadata = {
          ...meta,
          transcriptIngested: true,
          transcriptLength: transcript.length,
          updatedAt: new Date().toISOString(),
        };

        await db
          .update(vectorDocument)
          .set({
            content: newContent,
            metadata: newMetadata,
            embedding: newEmbedding,
          })
          .where(eq(vectorDocument.id, doc.id));

        console.log(`[Worker ${workerId}] ✅ Successfully backfilled: "${doc.title}" (${transcript.length} chars)`);
        successCount++;
      } else {
        console.log(`[Worker ${workerId}] ⚠️ Failed to get transcript for: "${doc.title}". Keeping metadata description.`);
        const newMetadata = {
          ...meta,
          transcriptIngested: false,
          transcriptExtractionFailed: true,
          updatedAt: new Date().toISOString(),
        };
        await db
          .update(vectorDocument)
          .set({
            metadata: newMetadata,
          })
          .where(eq(vectorDocument.id, doc.id));
      }

      processedCount++;
      // A small delay to not overload YouTube
      await new Promise(r => setTimeout(r, 1500));
    }

    await page.close();
  }

  try {
    // Run workers in parallel
    const workers = Array.from({ length: numWorkers }).map((_, id) => worker(id));
    await Promise.all(workers);
  } catch (err: any) {
    console.error("❌ Error in worker pool:", err.message);
  } finally {
    await browser.close();
    console.log(`\n🎉 Backfill process completed!`);
    console.log(`- Total processed: ${processedCount}/${docsToProcess.length}`);
    console.log(`- Success count: ${successCount}`);
    process.exit(0);
  }
}

main().catch(console.error);
