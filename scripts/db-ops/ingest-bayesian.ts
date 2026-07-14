import * as cheerio from "cheerio";
import { db } from "../../src/infra/database/db-pool";
import { vectorDocument } from "../../src/infra/database/schema";
import { initMultilingualEmbedding, embed } from "../../src/core/neural-memory/multilingual-embedding";
import { smartChunking } from "../../src/core/neural-memory/chunking-strategies";
import crypto from "node:crypto";

const BASE_URL = "https://people.bath.ac.uk/masss/ma40189/_book/";

async function fetchHtml(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.text();
}

async function scrapeBook() {
  console.log("🚀 Starting Bayesian Statistics Ingestion...");
  
  await initMultilingualEmbedding();
  console.log("✅ Embedding Engine Initialized.");

  const indexHtml = await fetchHtml(BASE_URL + "index.html");
  const $ = cheerio.load(indexHtml);
  
  const links: string[] = [];
  $(".summary li a").each((i, el) => {
    let href = $(el).attr("href");
    if (href) {
      // Clean up hash fragments so we only download unique pages, not just scroll anchors
      href = href.split("#")[0]; 
      if (href && href !== "./" && !href.startsWith("http") && !links.includes(href)) {
        links.push(href);
      }
    }
  });

  console.log(`📚 Found ${links.length} chapters to scrape.`);

  let totalChunks = 0;

  for (const link of links) {
    console.log(`\n⬇️ Fetching ${link}...`);
    try {
      const html = await fetchHtml(BASE_URL + link);
      const $page = cheerio.load(html);
      
      const title = $page("h1").first().text().trim() || "Bayesian Statistics Chapter";
      
      // Extract main content paragraphs and formulas
      const contentParts: string[] = [];
      $page(".page-inner section p, .page-inner section .math").each((i, el) => {
        contentParts.push($page(el).text().trim());
      });

      const fullText = contentParts.filter(t => t.length > 20).join("\n\n");
      
      // Chunk the text
      const chunks = smartChunking(fullText, { maxChunkSize: 500, overlap: 50 });
      console.log(`✂️ Chunked ${title} into ${chunks.length} chunks.`);

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        
        // 1. Generate Embedding
        const vector = await embed(chunkText);
        
        // 2. Wrap into KnowledgeItem structure
        const item = {
          title: `${title} (Part ${i + 1})`,
          subtitle: "Topics in Bayesian statistics",
          definition: "Bayesian mathematical concept from University of Bath.",
          explanation: chunkText,
          application: "Statistical Inference, Machine Learning, Predatory Routing.",
          formulas: []
        };

        // 3. Insert into Postgres
        await db.insert(vectorDocument).values({
          id: crypto.randomUUID(),
          category: "bayesian_statistics_math",
          title: item.title,
          content: item.explanation,
          metadata: JSON.stringify(item),
          embedding: JSON.stringify(vector), // JSON stringified vector
          tenantId: "global"
        });

        totalChunks++;
        process.stdout.write("."); // progress indicator
      }
    } catch (e) {
      console.error(`❌ Failed to process ${link}:`, e);
    }
  }

  console.log(`\n🎉 Ingestion Complete! Inserted ${totalChunks} high-quality Bayesian chunks into the Hive Mind.`);
  process.exit(0);
}

scrapeBook();
