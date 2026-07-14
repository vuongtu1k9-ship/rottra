import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

let featureExtractor: any = null;
let imageClassifier: any = null;
let isInitializing = false;

export async function initHFEmbedding(): Promise<boolean> {
  if (featureExtractor) return true;
  if (isInitializing) return false;
  isInitializing = true;
  try {
    console.log("🤗 [HF] Loading feature-extraction pipeline (Xenova/all-MiniLM-L6-v2)...");
    featureExtractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      progress_callback: (p) => {
        if (p.status === "progress") {
          process.stdout.write(`\r  [HF] ${p.file}: ${((p.loaded / p.total) * 100).toFixed(0)}%`);
        } else if (p.status === "done") {
          console.log(`\n  ✅ Loaded ${p.file}`);
        }
      },
    });
    console.log("✅ [HF] Feature extraction pipeline ready.");
    return true;
  } catch (err: any) {
    console.error("❌ [HF] Failed to load embedding pipeline:", err.message);
    featureExtractor = null;
    return false;
  } finally {
    isInitializing = false;
  }
}

export async function initHFImageClassifier(): Promise<boolean> {
  if (imageClassifier) return true;
  if (isInitializing) return false;
  isInitializing = true;
  try {
    console.log("🤗 [HF] Loading image-classification pipeline (Xenova/mobilevit-small)...");
    imageClassifier = await pipeline("image-classification", "Xenova/mobilevit-small", {
      progress_callback: (p) => {
        if (p.status === "progress") {
          process.stdout.write(`\r  [HF] ${p.file}: ${((p.loaded / p.total) * 100).toFixed(0)}%`);
        } else if (p.status === "done") {
          console.log(`\n  ✅ Loaded ${p.file}`);
        }
      },
    });
    console.log("✅ [HF] Image classifier ready.");
    return true;
  } catch (err: any) {
    console.error("❌ [HF] Failed to load image classifier:", err.message);
    imageClassifier = null;
    return false;
  } finally {
    isInitializing = false;
  }
}

export function isHFEmbeddingReady(): boolean {
  return featureExtractor !== null;
}

export function isHFImageClassifierReady(): boolean {
  return imageClassifier !== null;
}

export async function embedWithHF(text: string): Promise<number[]> {
  if (!featureExtractor) {
    throw new Error("HF embedding pipeline not initialized");
  }
  const output = await featureExtractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

export async function embedBatchWithHF(texts: string[]): Promise<number[][]> {
  if (!featureExtractor) {
    throw new Error("HF embedding pipeline not initialized");
  }
  const results: number[][] = [];
  for (const text of texts) {
    const output = await featureExtractor(text, {
      pooling: "mean",
      normalize: true,
    });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

export async function classifyImageWithHF(imagePath: string): Promise<{ label: string; score: number }[]> {
  if (!imageClassifier) {
    throw new Error("HF image classifier not initialized");
  }
  const results = await imageClassifier(imagePath);
  return results.map((r: any) => ({
    label: r.label,
    score: r.score,
  }));
}

export function cosineSimilarity(a: number[], b: number[]): number {
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
