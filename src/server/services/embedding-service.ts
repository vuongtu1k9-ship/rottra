import { pipeline, env } from "@huggingface/transformers";
import { createLogger } from "~/shared/logger";

const log = createLogger("embedding-service");

// Configure environment for Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false; // We are in Node/Bun

let extractor: any = null;

export async function getEmbeddingExtractor() {
  if (!extractor) {
    log.info("Loading embedding model (Xenova/all-MiniLM-L6-v2)...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    log.info("Embedding model loaded successfully.");
  }
  return extractor;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === "") return [];
  try {
    const fn = await getEmbeddingExtractor();
    const output = await fn(text, { pooling: "mean", normalize: true });
    // Convert Float32Array to standard number[]
    return Array.from(output.data);
  } catch (err) {
    log.error("Failed to generate embedding", err);
    return [];
  }
}

/**
 * Tính độ tương đồng Cosine giữa 2 vector.
 * Dùng để tra cứu In-Memory nếu Database không hỗ trợ phép `<=>`.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
