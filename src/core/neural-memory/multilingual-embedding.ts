import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false;

let embedder: any = null;
let embedderReady = false;

const EMBEDDING_MODEL = "Xenova/bge-m3";
const EMBEDDING_DIM = 1024;

export async function initMultilingualEmbedding(): Promise<boolean> {
  if (embedderReady) return true;
  try {
    embedder = await pipeline("feature-extraction", EMBEDDING_MODEL);
    embedderReady = true;
    console.log(`[EMBEDDING] bge-m3 loaded — dim=${EMBEDDING_DIM}`);
    return true;
  } catch (err: any) {
    console.error("[EMBEDDING] bge-m3 load failed:", err.message);
    return false;
  }
}

export function isEmbeddingReady(): boolean {
  return embedderReady;
}

export async function embed(text: string): Promise<number[]> {
  if (!embedder || !text) return [];

  const output = await embedder(text, {
    pooling: "cls",
    normalize: true,
  });

  const vec = Array.from(output.data) as number[];
  return vec.length >= EMBEDDING_DIM ? vec.slice(0, EMBEDDING_DIM) : vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!embedder || texts.length === 0) return [];

  const results: number[][] = [];
  const BATCH_SIZE = 16;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((t) => embed(t)));
    results.push(...batchResults);
  }

  return results;
}

export function cosineSimilarityDense(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function getEmbeddingInfo(): { model: string; dim: number; ready: boolean } {
  return { model: EMBEDDING_MODEL, dim: EMBEDDING_DIM, ready: embedderReady };
}
