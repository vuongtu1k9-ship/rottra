let tf: any = null;
import * as fs from "node:fs";
import * as path from "node:path";

const EMBEDDING_MODEL = "Rottra-Native-DL-v1";
const EMBEDDING_DIM = 1024;
const MAX_SEQ_LEN = 128;
const VOCAB_SIZE = 500; // Character-level hashing modulo

let model: any = null;
let embedderReady = false;

// Default path to save/load the custom model
const MODEL_DIR = path.join(process.cwd(), "scripts/ai-pipeline/output/rottra-native-dl");
const MODEL_PATH = `file://${MODEL_DIR}/model.json`;

function buildModel(): any {
  const input = tf.input({ shape: [MAX_SEQ_LEN], dtype: "int32" });

  const embedding = tf.layers
    .embedding({
      inputDim: VOCAB_SIZE,
      outputDim: 128,
      maskZero: true,
    })
    .apply(input);

  const conv = tf.layers
    .conv1d({
      filters: 256,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    })
    .apply(embedding);

  const pool = tf.layers.globalMaxPooling1d().apply(conv);

  const dense = tf.layers
    .dense({
      units: EMBEDDING_DIM,
      activation: "linear",
    })
    .apply(pool);

  return tf.model({ inputs: input, outputs: dense });
}

export async function initMultilingualEmbedding(): Promise<boolean> {
  if (embedderReady) return true;

  const isCloudflare = typeof (globalThis as any).caches !== "undefined" || (typeof process !== "undefined" && process.env && process.env.CF_PAGES === "1");
  if (isCloudflare) {
    console.log("[EMBEDDING] Cloudflare Pages environment detected. Bypassing TensorFlow model and running in TF-IDF fallback mode.");
    return false;
  }

  try {
    // Lazy load tfjs to avoid loading it entirely on Cloudflare Workers
    tf = await import("@tensorflow/tfjs");

    if (fs.existsSync(path.join(MODEL_DIR, "model.json"))) {
      console.log(`📦 Loading custom trained DL model from ${MODEL_DIR}...`);
      model = await tf.loadLayersModel(MODEL_PATH);
    } else {
      console.log(`⚠️ Custom model not found at ${MODEL_DIR}. Building a fresh untrained model...`);
      model = buildModel();
      // Ensure dir exists
      if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });
      await model.save(MODEL_PATH);
      console.log(`  Initialized random weights. Run fine-tune-embedding.ts to train it!`);
    }

    embedderReady = true;
    console.log(`[EMBEDDING] Native Deep Learning Model loaded (${EMBEDDING_DIM}-dim)`);
    return true;
  } catch (err: any) {
    console.error("[EMBEDDING] Model load/init failed:", err.message);
    return false;
  }
}

export function isEmbeddingReady(): boolean {
  return embedderReady;
}

/**
 * L2 Normalize a 1D tensor/array
 */
function l2NormalizeArray(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1e-12;
  return vec.map((v) => v / norm);
}

/**
 * Character-level tokenizer
 */
function tokenizeText(text: string): number[] {
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  const tokens = new Array(MAX_SEQ_LEN).fill(0);
  for (let i = 0; i < Math.min(clean.length, MAX_SEQ_LEN); i++) {
    tokens[i] = (clean.charCodeAt(i) % (VOCAB_SIZE - 1)) + 1; // +1 to reserve 0 for padding/mask
  }
  return tokens;
}

export async function embed(text: string): Promise<number[]> {
  if (!model || !text) return new Array(EMBEDDING_DIM).fill(0);

  const tokens = tokenizeText(text);
  const inputTensor = tf.tensor2d([tokens], [1, MAX_SEQ_LEN], "int32");

  const output = tf.tidy(() => {
    const pred = model!.apply(inputTensor, { training: false }) as any;
    return pred.dataSync();
  });

  inputTensor.dispose();

  const vec = Array.from(output) as number[];
  return l2NormalizeArray(vec);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!model || texts.length === 0) return [];

  const BATCH_SIZE = 32;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + BATCH_SIZE);
    const tokensBatch = batchTexts.map(tokenizeText);
    const inputTensor = tf.tensor2d(tokensBatch, [batchTexts.length, MAX_SEQ_LEN], "int32");

    const output = tf.tidy(() => {
      const preds = model!.apply(inputTensor, { training: false }) as any;
      return preds.arraySync() as number[][];
    });

    inputTensor.dispose();

    for (const vec of output) {
      results.push(l2NormalizeArray(vec));
    }
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
