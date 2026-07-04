/**
 * 🧠 ROTTRA — EMBEDDING FINE-TUNE DATA PIPELINE
 *
 * Export training triplets (query, positive, hard_negative) from multiple DB sources
 * for contrastive learning / Matryoshka fine-tuning of bge-m3 embedding model.
 *
 * Output: JSONL files compatible with sentence-transformers / FlagEmbedding
 *
 * Usage:
 *   bun scripts/data-cleaning/export-embedding-training-data.ts [--out DIR] [--format triplets|pairs|jsonl]
 */

import { db } from "../../src/infra/database/db-pool";
import {
  agentTraining,
  vectorDocument,
  chatMessage,
  product,
  bilingualCorpus,
  vietnameseLexicon,
} from "../../src/infra/database/schema";
import { ALL_DOMAIN_TRAINING_PAIRS } from "../../src/core/nlp-cognitive/domain-training-data";
import { AgentKnowledgeBase } from "../../src/core/neural-memory/knowledge-base";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── CLI args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : "scripts/data-cleaning/output";
const format = args.includes("--format") ? args[args.indexOf("--format") + 1] : "triplets";

// ── Helpers ───────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, " ")     // LaTeX blocks
    .replace(/\$[^$]+\$/g, " ")             // Inline LaTeX
    .replace(/\*\*([^*]+)\*\*/g, "$1")      // Bold
    .replace(/\*([^*]+)\*/g, "$1")           // Italic
    .replace(/#{1,6}\s/g, "")               // Headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/[`|]/g, " ")                  // Code pipes
    .replace(/\n{2,}/g, " ")                // Double newlines
    .replace(/\n/g, " ")                    // Single newlines
    .replace(/\s{2,}/g, " ")               // Multiple spaces
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Data Sources ──────────────────────────────────────────────

interface TrainingTriplet {
  query: string;
  positive: string;
  negative: string;
  source: string;
  category?: string;
}

interface TrainingPair {
  query: string;
  positive: string;
  source: string;
  category?: string;
}

async function exportAgentTrainingPairs(): Promise<TrainingTriplet[]> {
  console.log("📦 Exporting from agentTraining table...");
  const rows = await db.select().from(agentTraining);
  console.log(`   Found ${rows.length} training rows`);

  const triplets: TrainingTriplet[] = [];
  const allAnswers = rows.map((r) => stripMarkdown(r.answer));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const query = row.utterance;
    const positive = stripMarkdown(row.answer);

    // Hard negative: find most lexically similar but different answer
    const queryTokens = tokenize(query);
    let bestNegIdx = -1;
    let bestSim = -1;
    for (let j = 0; j < rows.length; j++) {
      if (j === i) continue;
      const otherTokens = tokenize(rows[j].utterance);
      const sim = jaccardSimilarity(queryTokens, otherTokens);
      if (sim > bestSim && sim < 0.95) {
        bestSim = sim;
        bestNegIdx = j;
      }
    }
    const negative = bestNegIdx >= 0 ? allAnswers[bestNegIdx] : allAnswers[(i + 1) % allAnswers.length];

    triplets.push({
      query,
      positive,
      negative,
      source: "agentTraining",
      category: row.intent,
    });
  }

  return triplets;
}

async function exportVectorDocumentPairs(): Promise<TrainingTriplet[]> {
  console.log("📦 Exporting from vectorDocument table...");
  const rows = await db.select().from(vectorDocument);
  console.log(`   Found ${rows.length} vector docs`);

  const triplets: TrainingTriplet[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.title || "";
    const content = stripMarkdown(row.content || "");
    if (!title || !content) continue;

    // Query = title, Positive = content, Negative = random other doc's content
    const query = title;
    const positive = content;

    let negIdx = Math.floor(Math.random() * rows.length);
    while (negIdx === i && rows.length > 1) negIdx = Math.floor(Math.random() * rows.length);
    const negative = stripMarkdown(rows[negIdx].content || rows[negIdx].title || "");

    triplets.push({
      query,
      positive,
      negative,
      source: "vectorDocument",
      category: row.category || undefined,
    });
  }

  return triplets;
}

async function exportChatMessagePairs(): Promise<TrainingTriplet[]> {
  console.log("📦 Exporting from chatMessage table...");
  const rows = await db.select().from(chatMessage);
  console.log(`   Found ${rows.length} chat messages`);

  const triplets: TrainingTriplet[] = [];
  const userMsgs = rows.filter((r) => r.role === "user");
  const assistantMsgs = rows.filter((r) => r.role === "assistant");

  if (userMsgs.length === 0 || assistantMsgs.length === 0) return triplets;

  // Pair consecutive user→assistant messages by userId
  const byUser = new Map<string, { user: typeof userMsgs; assistant: typeof assistantMsgs }>();
  for (const msg of userMsgs) {
    const key = msg.userId;
    if (!byUser.has(key)) byUser.set(key, { user: [], assistant: [] });
    byUser.get(key)!.user.push(msg);
  }
  for (const msg of assistantMsgs) {
    const key = msg.userId;
    if (!byUser.has(key)) byUser.set(key, { user: [], assistant: [] });
    byUser.get(key)!.assistant.push(msg);
  }

  for (const [, msgs] of byUser) {
    const len = Math.min(msgs.user.length, msgs.assistant.length);
    for (let i = 0; i < len; i++) {
      const query = stripMarkdown(msgs.user[i].content);
      const positive = stripMarkdown(msgs.assistant[i].content);
      if (!query || !positive) continue;

      const negIdx = Math.floor(Math.random() * assistantMsgs.length);
      const negative = stripMarkdown(assistantMsgs[negIdx].content);

      triplets.push({ query, positive, negative, source: "chatMessage" });
    }
  }

  return triplets;
}

async function exportBilingualPairs(): Promise<TrainingPair[]> {
  console.log("📦 Exporting from bilingualCorpus table...");
  const rows = await db.select().from(bilingualCorpus);
  console.log(`   Found ${rows.length} bilingual pairs`);

  const pairs: TrainingPair[] = [];
  for (const row of rows) {
    if (row.vi && row.en) {
      pairs.push({ query: row.vi, positive: row.en, source: "bilingualCorpus", category: "vi-en" });
      pairs.push({ query: row.en, positive: row.vi, source: "bilingualCorpus", category: "en-vi" });
    }
    if (row.vi && row.zh) {
      pairs.push({ query: row.vi, positive: row.zh, source: "bilingualCorpus", category: "vi-zh" });
    }
    if (row.vi && row.ja) {
      pairs.push({ query: row.vi, positive: row.ja, source: "bilingualCorpus", category: "vi-ja" });
    }
  }

  return pairs;
}

async function exportProductPairs(): Promise<TrainingTriplet[]> {
  console.log("📦 Exporting from product table...");
  const rows = await db.select().from(product);
  console.log(`   Found ${rows.length} products`);

  const triplets: TrainingTriplet[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row.name || "";
    const desc = stripMarkdown(row.description || "");
    const cat = row.category || "";
    if (!name) continue;

    const query = `${name} ${cat}`.trim();
    const positive = desc || name;

    let negIdx = Math.floor(Math.random() * rows.length);
    while (negIdx === i && rows.length > 1) negIdx = Math.floor(Math.random() * rows.length);
    const neg = rows[negIdx];
    const negative = stripMarkdown(neg.description || neg.name || "");

    triplets.push({ query, positive, negative, source: "product", category: cat });
  }

  return triplets;
}

function exportDomainTrainingPairs(): TrainingTriplet[] {
  console.log("📦 Exporting from domain-training-data (in-memory)...");
  console.log(`   Found ${ALL_DOMAIN_TRAINING_PAIRS.length} curated pairs`);

  const triplets: TrainingTriplet[] = [];
  const allAnswers = ALL_DOMAIN_TRAINING_PAIRS.map((p) => stripMarkdown(p.answer));

  for (let i = 0; i < ALL_DOMAIN_TRAINING_PAIRS.length; i++) {
    const pair = ALL_DOMAIN_TRAINING_PAIRS[i];
    const query = pair.utterance;
    const positive = stripMarkdown(pair.answer);

    const queryTokens = tokenize(query);
    let bestNegIdx = -1;
    let bestSim = -1;
    for (let j = 0; j < ALL_DOMAIN_TRAINING_PAIRS.length; j++) {
      if (j === i) continue;
      const otherTokens = tokenize(ALL_DOMAIN_TRAINING_PAIRS[j].utterance);
      const sim = jaccardSimilarity(queryTokens, otherTokens);
      if (sim > bestSim && sim < 0.95) {
        bestSim = sim;
        bestNegIdx = j;
      }
    }
    const negative = bestNegIdx >= 0 ? allAnswers[bestNegIdx] : allAnswers[(i + 1) % allAnswers.length];

    triplets.push({
      query,
      positive,
      negative,
      source: "domainTrainingData",
      category: pair.intent,
    });
  }

  return triplets;
}

function exportKnowledgeBasePairs(): TrainingTriplet[] {
  console.log("📦 Exporting from AgentKnowledgeBase (in-memory)...");
  const categories = Object.keys(AgentKnowledgeBase);
  console.log(`   Found ${categories.length} knowledge categories`);

  const triplets: TrainingTriplet[] = [];
  const allItems = categories.flatMap((cat) =>
    (AgentKnowledgeBase[cat] || []).map((item) => ({
      cat,
      title: item.title,
      text: stripMarkdown(
        [item.title, item.subtitle, item.definition, item.explanation, item.application]
          .filter(Boolean)
          .join(" ")
      ),
    }))
  );

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!item.title || !item.text) continue;

    const query = item.title;
    const positive = item.text;

    let negIdx = Math.floor(Math.random() * allItems.length);
    while (negIdx === i && allItems.length > 1) negIdx = Math.floor(Math.random() * allItems.length);
    const negative = allItems[negIdx].text;

    triplets.push({ query, positive, negative, source: "knowledgeBase", category: item.cat });
  }

  return triplets;
}

function exportLexiconPairs(): TrainingPair[] {
  console.log("📦 Exporting from vietnameseLexicon table (async)...");
  // Lexicon is accessed via dynamic import since it may not always be available
  return [];
}

// ── Main Pipeline ─────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  EMBEDDING FINE-TUNE DATA PIPELINE");
  console.log("  Export training triplets for bge-m3 fine-tuning");
  console.log("═".repeat(60) + "\n");

  const startTime = performance.now();

  // Gather all data sources
  const [
    agentTrainingTriplets,
    vectorDocTriplets,
    chatMsgTriplets,
    bilingualPairs,
    productTriplets,
    domainTriplets,
    knowledgeBaseTriplets,
  ] = await Promise.all([
    exportAgentTrainingPairs(),
    exportVectorDocumentPairs(),
    exportChatMessagePairs(),
    exportBilingualPairs(),
    exportProductPairs(),
    Promise.resolve(exportDomainTrainingPairs()),
    Promise.resolve(exportKnowledgeBasePairs()),
  ]);

  // Combine all triplets
  const allTriplets = shuffleArray([
    ...agentTrainingTriplets,
    ...vectorDocTriplets,
    ...chatMsgTriplets,
    ...productTriplets,
    ...domainTriplets,
    ...knowledgeBaseTriplets,
  ]);

  const allPairs: TrainingPair[] = shuffleArray([
    ...bilingualPairs,
    // Add simple pairs from triplets (query, positive only)
    ...allTriplets.map((t) => ({ query: t.query, positive: t.positive, source: t.source, category: t.category })),
  ]);

  // Stats
  console.log("\n" + "═".repeat(60));
  console.log("  EXPORT SUMMARY");
  console.log("═".repeat(60));

  const sourceStats = new Map<string, number>();
  const categoryStats = new Map<string, number>();
  for (const t of allTriplets) {
    sourceStats.set(t.source, (sourceStats.get(t.source) || 0) + 1);
    if (t.category) categoryStats.set(t.category, (categoryStats.get(t.category) || 0) + 1);
  }

  console.log(`\n  Total triplets: ${allTriplets.length}`);
  console.log(`  Total pairs (bilingual + all): ${allPairs.length}`);
  console.log("\n  By source:");
  for (const [src, count] of sourceStats) {
    console.log(`    ${src}: ${count}`);
  }

  if (categoryStats.size > 0) {
    console.log("\n  Top categories:");
    const sorted = [...categoryStats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [cat, count] of sorted) {
      console.log(`    ${cat}: ${count}`);
    }
  }

  // Create output directory
  mkdirSync(outDir, { recursive: true });

  // Write outputs
  if (format === "triplets" || format === "all") {
    // JSONL format for contrastive learning
    const tripletPath = join(outDir, "triplets.jsonl");
    const tripletLines = allTriplets.map((t) => JSON.stringify(t));
    writeFileSync(tripletPath, tripletLines.join("\n") + "\n");
    console.log(`\n  ✅ Written: ${tripletPath} (${allTriplets.length} triplets)`);
  }

  if (format === "pairs" || format === "all") {
    // Simple pairs format for contrastive fine-tuning
    const pairPath = join(outDir, "pairs.jsonl");
    const pairLines = allPairs.map((p) => JSON.stringify(p));
    writeFileSync(pairPath, pairLines.join("\n") + "\n");
    console.log(`  ✅ Written: ${pairPath} (${allPairs.length} pairs)`);
  }

  // FlagEmbedding format: anchor, positive, negative (tab-separated)
  const flagPath = join(outDir, "flagembedding_train.tsv");
  const flagLines = allTriplets.map((t) => `${t.query}\t${t.positive}\t${t.negative}`);
  writeFileSync(flagPath, flagLines.join("\n") + "\n");
  console.log(`  ✅ Written: ${flagPath} (${allTriplets.length} rows, TSV)`);

  // sentence-transformers format: JSON with anchor/positive/negative
  const stPath = join(outDir, "sentence_transformers_train.json");
  const stData = allTriplets.map((t) => ({
    anchor: t.query,
    positive: t.positive,
    negative: t.negative,
  }));
  writeFileSync(stPath, JSON.stringify(stData, null, 2));
  console.log(`  ✅ Written: ${stPath} (${stData.length} rows)`);

  // Metadata
  const meta = {
    generatedAt: new Date().toISOString(),
    totalTriplets: allTriplets.length,
    totalPairs: allPairs.length,
    sources: Object.fromEntries(sourceStats),
    categories: Object.fromEntries(categoryStats),
    format,
    outputDir: outDir,
  };
  const metaPath = join(outDir, "metadata.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`  ✅ Written: ${metaPath}`);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`\n  ⏱️  Export completed in ${elapsed}s`);
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
