/**
 * 🧠 ROTTRA — NATIVE DL EMBEDDING EVALUATION
 * Compare Native TF.js Model vs Baseline.
 */

import * as tf from "@tensorflow/tfjs";
import { readFileSync, existsSync } from "fs";
import { initMultilingualEmbedding, embed, cosineSimilarityDense } from "../../src/core/neural-memory/multilingual-embedding";

// ── Helpers ───────────────────────────────────────────────────

interface Triplet {
  query: string;
  positive: string;
  negative: string;
}

function loadTriplets(): Triplet[] {
  const path = "scripts/data-cleaning/output/triplets.jsonl";
  if (!existsSync(path)) throw new Error(`Data not found: ${path}`);
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// ── Evaluation ────────────────────────────────────────────────

async function evaluate() {
  const triplets = loadTriplets();
  console.log(`📊 Evaluating on ${triplets.length} triplets`);

  await initMultilingualEmbedding();

  let correctCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < triplets.length; i++) {
    const t = triplets[i];

    const qEmb = await embed(t.query);
    const pEmb = await embed(t.positive);
    const nEmb = await embed(t.negative);

    const posSim = cosineSimilarityDense(qEmb, pEmb);
    const negSim = cosineSimilarityDense(qEmb, nEmb);

    if (posSim > negSim) {
      correctCount++;
    }

    if (i % 50 === 0) {
      process.stdout.write(`\r  Evaluated ${i}/${triplets.length}...`);
    }
  }

  const accuracy = (correctCount / triplets.length) * 100;
  const timeSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n🎯 NATIVE DL EVALUATION RESULTS`);
  console.log(`  Accuracy (Pos > Neg): ${accuracy.toFixed(2)}%`);
  console.log(`  Time taken: ${timeSec}s`);
}

evaluate().catch(console.error);
