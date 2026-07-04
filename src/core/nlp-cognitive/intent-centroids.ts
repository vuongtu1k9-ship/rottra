/**
 * Intent Centroids — Pre-computed centroid embeddings per intent
 *
 * Cách hoạt động:
 * 1. Với mỗi intent, lấy tất cả utterances từ training data
 * 2. Embed mỗi utterance, tính centroid (mean vector)
 * 3. Tại inference, embed query → cosine similarity với centroids
 * 4. Intent nào có similarity cao nhất được chọn
 *
 * Ưu điểm:
 * - Nhanh hơn LLM 10-50x
 * - Chính xác hơn keyword-only matching
 * - Handles paraphrases tốt hơn
 */

import { ALL_DOMAIN_TRAINING_PAIRS } from "./domain-training-data";
import { embed, cosineSimilarityDense, isEmbeddingReady, initMultilingualEmbedding } from "~/core/neural-memory/multilingual-embedding";

interface IntentCentroid {
  intent: string;
  centroid: number[];
  utteranceCount: number;
}

let centroids: IntentCentroid[] = [];
let centroidsReady = false;

/**
 * Pre-compute centroids từ training data
 */
export async function initIntentCentroids(): Promise<boolean> {
  if (centroidsReady) return true;

  // Ensure embedding model is loaded
  const embedReady = await initMultilingualEmbedding();
  if (!embedReady) {
    console.warn("[IntentCentroids] Embedding model not ready, skipping centroid computation");
    return false;
  }

  // Group utterances by intent
  const intentUtterances = new Map<string, string[]>();
  for (const pair of ALL_DOMAIN_TRAINING_PAIRS) {
    const intent = pair.intent;
    if (!intent) continue;
    const utterance = pair.utterance;
    if (!utterance || utterance.length < 3) continue;

    if (!intentUtterances.has(intent)) {
      intentUtterances.set(intent, []);
    }
    intentUtterances.get(intent)!.push(utterance);
  }

  console.log(`[IntentCentroids] Computing centroids for ${intentUtterances.size} intents...`);

  // Compute centroid for each intent
  centroids = [];
  for (const [intent, utterances] of intentUtterances) {
    // Sample max 20 utterances per intent for speed
    const sampled = utterances.length > 20 ? utterances.filter((_, i) => i % Math.ceil(utterances.length / 20) === 0) : utterances;

    // Embed all utterances
    const embeddings = await Promise.all(sampled.map((u) => embed(u)));
    const validEmbeddings = embeddings.filter((e) => e.length > 0);

    if (validEmbeddings.length === 0) continue;

    // Compute mean vector (centroid)
    const dim = validEmbeddings[0].length;
    const centroid = new Array(dim).fill(0);
    for (const emb of validEmbeddings) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      centroid[i] /= validEmbeddings.length;
    }

    centroids.push({
      intent,
      centroid,
      utteranceCount: utterances.length,
    });
  }

  centroidsReady = true;
  console.log(`[IntentCentroids] Computed ${centroids.length} centroids`);
  return true;
}

/**
 * Classify query using centroid similarity
 * Returns best intent + score, or null if below threshold
 */
export async function classifyByCentroids(query: string): Promise<{ intent: string; score: number } | null> {
  if (!centroidsReady || !isEmbeddingReady()) return null;

  const queryEmbedding = await embed(query);
  if (queryEmbedding.length === 0) return null;

  let bestIntent = "";
  let bestScore = 0;

  for (const c of centroids) {
    const score = cosineSimilarityDense(queryEmbedding, c.centroid);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = c.intent;
    }
  }

  // Threshold: require at least 0.55 cosine similarity
  if (bestScore >= 0.55) {
    return { intent: bestIntent, score: bestScore };
  }

  return null;
}

/**
 * Get centroid stats
 */
export function getCentroidStats(): { ready: boolean; intents: number; totalUtterances: number } {
  return {
    ready: centroidsReady,
    intents: centroids.length,
    totalUtterances: centroids.reduce((sum, c) => sum + c.utteranceCount, 0),
  };
}
