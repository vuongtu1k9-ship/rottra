import { Deterministic } from "~/shared/utils/rng";
/**
 * 🧠 ROTTRA — NATIVE DL EMBEDDING FINE-TUNE
 * Train the native Character-CNN model from scratch using Triplet Loss.
 */

import * as tf from "@tensorflow/tfjs";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Config ────────────────────────────────────────────────────

const OUTPUT_DIR = "scripts/ai-pipeline/output/rottra-native-dl";
const MAX_SEQ_LEN = 128;
const VOCAB_SIZE = 500;
const EMBEDDING_DIM = 1024;

interface Config {
  epochs: number;
  learningRate: number;
  batchSize: number;
  margin: number;
}

const DEFAULT_CONFIG: Config = {
  epochs: 10,
  learningRate: 0.001,
  batchSize: 32,
  margin: 0.5,
};

function parseArgs(): Partial<Config> {
  const args = process.argv.slice(2);
  const config: Partial<Config> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace("--", "") as keyof Config;
    const val = args[i + 1];
    if (key && val) {
      (config as any)[key] = Number(val);
    }
  }
  return config;
}

// ── Data Loading ──────────────────────────────────────────────

interface Triplet {
  query: string;
  positive: string;
  negative: string;
}

function loadTriplets(): Triplet[] {
  const path = "scripts/data-cleaning/output/triplets.jsonl";
  if (!existsSync(path)) {
    throw new Error(`Training data not found at ${path}.`);
  }
  const content = readFileSync(path, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function tokenizeText(text: string): number[] {
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const tokens = new Array(MAX_SEQ_LEN).fill(0);
  for (let i = 0; i < Math.min(clean.length, MAX_SEQ_LEN); i++) {
    tokens[i] = (clean.charCodeAt(i) % (VOCAB_SIZE - 1)) + 1;
  }
  return tokens;
}

// ── Model Architecture ────────────────────────────────────────

function buildModel(): tf.LayersModel {
  const input = tf.input({ shape: [MAX_SEQ_LEN], dtype: "int32" });

  const embedding = tf.layers.embedding({
    inputDim: VOCAB_SIZE,
    outputDim: 128,
    maskZero: true,
  }).apply(input) as tf.SymbolicTensor;

  const conv = tf.layers.conv1d({
    filters: 256,
    kernelSize: 3,
    activation: "relu",
    padding: "same",
  }).apply(embedding) as tf.SymbolicTensor;

  const pool = tf.layers.globalMaxPooling1d().apply(conv) as tf.SymbolicTensor;

  const dense = tf.layers.dense({
    units: EMBEDDING_DIM,
    activation: "linear",
  }).apply(pool) as tf.SymbolicTensor;

  return tf.model({ inputs: input, outputs: dense });
}

function l2NormalizeTensor(t: tf.Tensor): tf.Tensor {
  const norms = tf.norm(t, 2, 1, true);
  return tf.div(t, tf.add(norms, 1e-12));
}

// ── Triplet Loss ──────────────────────────────────────────────

function tripletLoss(anchor: tf.Tensor2D, positive: tf.Tensor2D, negative: tf.Tensor2D, margin: number): tf.Scalar {
  const a = l2NormalizeTensor(anchor);
  const p = l2NormalizeTensor(positive);
  const n = l2NormalizeTensor(negative);

  // Distance (cosine distance = 1 - cosine similarity)
  const distPos = tf.sub(1, tf.sum(tf.mul(a, p), 1));
  const distNeg = tf.sub(1, tf.sum(tf.mul(a, n), 1));

  // loss = max(0, distPos - distNeg + margin)
  const loss = tf.maximum(0, tf.add(tf.sub(distPos, distNeg), margin));
  return loss.mean() as tf.Scalar;
}

// ── Training Loop ─────────────────────────────────────────────

async function train(config: Config): Promise<void> {
  const triplets = loadTriplets();
  console.log(`\n📊 Loaded ${triplets.length} training triplets`);

  const model = buildModel();
  const optimizer = tf.train.adam(config.learningRate);

  console.log(`\n🚀 Starting training: ${config.epochs} epochs, lr=${config.learningRate}, batchSize=${config.batchSize}`);

  let bestLoss = Infinity;

  for (let epoch = 0; epoch < config.epochs; epoch++) {
    const shuffled = triplets.sort(() => Deterministic.random() - 0.5);
    const epochStartTime = Date.now();
    let totalLoss = 0;
    let batchCount = 0;

    for (let i = 0; i < shuffled.length; i += config.batchSize) {
      const batch = shuffled.slice(i, i + config.batchSize);

      const aTokens = batch.map((t) => tokenizeText(t.query));
      const pTokens = batch.map((t) => tokenizeText(t.positive));
      const nTokens = batch.map((t) => tokenizeText(t.negative));

      const aTensor = tf.tensor2d(aTokens, [batch.length, MAX_SEQ_LEN], "int32");
      const pTensor = tf.tensor2d(pTokens, [batch.length, MAX_SEQ_LEN], "int32");
      const nTensor = tf.tensor2d(nTokens, [batch.length, MAX_SEQ_LEN], "int32");

      const loss = tf.tidy(() => {
        const aEmb = model.apply(aTensor, { training: true }) as tf.Tensor2D;
        const pEmb = model.apply(pTensor, { training: true }) as tf.Tensor2D;
        const nEmb = model.apply(nTensor, { training: true }) as tf.Tensor2D;
        return tripletLoss(aEmb, pEmb, nEmb, config.margin);
      });

      const grads = tf.variableGrads(() => {
        const aEmb = model.apply(aTensor, { training: true }) as tf.Tensor2D;
        const pEmb = model.apply(pTensor, { training: true }) as tf.Tensor2D;
        const nEmb = model.apply(nTensor, { training: true }) as tf.Tensor2D;
        return tripletLoss(aEmb, pEmb, nEmb, config.margin);
      });

      optimizer.applyGradients(grads.grads);

      const lossVal = loss.dataSync()[0];
      totalLoss += lossVal;
      batchCount++;

      aTensor.dispose();
      pTensor.dispose();
      nTensor.dispose();
      loss.dispose();
      Object.values(grads.grads).forEach((g) => g.dispose());

      if (batchCount % 10 === 0) {
        process.stdout.write(`\r  Batch ${batchCount}/${Math.ceil(shuffled.length / config.batchSize)} loss: ${(totalLoss / batchCount).toFixed(4)}`);
      }
    }

    const avgLoss = totalLoss / batchCount;
    const epochTime = ((Date.now() - epochStartTime) / 1000).toFixed(1);
    console.log(`\n  Epoch ${epoch + 1}/${config.epochs} — avg loss: ${avgLoss.toFixed(4)} — time: ${epochTime}s`);

    if (avgLoss < bestLoss) {
      bestLoss = avgLoss;
      if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
      await model.save(`file://${OUTPUT_DIR}`);
      console.log(`  ✅ Best model saved (loss: ${avgLoss.toFixed(4)})`);
    }
  }

  console.log(`\n✅ Training complete. Best loss: ${bestLoss.toFixed(4)}`);
}

async function main() {
  const config = { ...DEFAULT_CONFIG, ...parseArgs() };

  console.log("═".repeat(60));
  console.log("  ROTTRA EMBEDDING FINE-TUNE (NATIVE DL)");
  console.log("═".repeat(60));

  await train(config);
}

main().catch((err) => {
  console.error("❌ Training failed:", err);
  process.exit(1);
});
