import { db } from "~/infra/database/db-pool";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CHECKPOINT_TABLE = "model_checkpoint";
const CHECKPOINT_DIR = path.join(process.cwd(), "finetune", "checkpoints");

export interface CheckpointPayload {
  vocabulary: string[];
  weights: Record<string, number[]>;
}

export interface CheckpointDbRow {
  id: string;
  model_name: string;
  version: number;
  weights: string;
  vocabulary: string | null;
  metrics: string | null;
  created_at: number;
  is_active: number;
}

async function ensureCheckpointTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(CHECKPOINT_TABLE)} (
        id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        version INTEGER NOT NULL,
        weights TEXT NOT NULL,
        vocabulary TEXT,
        metrics TEXT,
        created_at INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_checkpoint_model ON ${sql.identifier(CHECKPOINT_TABLE)}(model_name, version)
    `);
  } catch (e) {
    console.error("[Checkpoint] Table init error:", e);
  }
}

let tableReady = false;

export async function initCheckpointSystem() {
  if (tableReady) return;
  await ensureCheckpointTable();
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
  tableReady = true;
  console.log("[Checkpoint] Model checkpoint system ready");
}

export async function saveCheckpoint(
  modelName: string,
  weights: CheckpointPayload,
  vocabulary?: string[],
  metrics?: Record<string, number>,
): Promise<string> {
  await initCheckpointSystem();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const lastVersion = (await db.execute(sql`
    SELECT MAX(version) as max_ver FROM ${sql.identifier(CHECKPOINT_TABLE)}
    WHERE model_name = ${modelName}
  `)) as unknown as { max_ver: number | null }[];
  const version = ((lastVersion[0]?.max_ver as number) || 0) + 1;

  await db.execute(sql`
    INSERT INTO ${sql.identifier(CHECKPOINT_TABLE)} (id, model_name, version, weights, vocabulary, metrics, created_at, is_active)
    VALUES (${id}, ${modelName}, ${version}, ${JSON.stringify(weights)},
            ${vocabulary ? JSON.stringify(vocabulary) : null},
            ${metrics ? JSON.stringify(metrics) : null}, ${now}, 1)
  `);

  await db.execute(sql`
    UPDATE ${sql.identifier(CHECKPOINT_TABLE)}
    SET is_active = 0
    WHERE model_name = ${modelName} AND id != ${id}
  `);

  const filePath = path.join(CHECKPOINT_DIR, `${modelName}_v${version}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ weights, vocabulary, metrics, version, timestamp: now }, null, 2));

  console.log(`[Checkpoint] Saved ${modelName} v${version}`);
  return id;
}

export async function loadLatestCheckpoint(modelName: string): Promise<{
  weights: CheckpointPayload;
  vocabulary?: string[] | undefined;
  metrics?: Record<string, number> | undefined;
  version?: number | undefined;
} | null> {
  await initCheckpointSystem();

  const rows = (await db.execute(sql`
    SELECT * FROM ${sql.identifier(CHECKPOINT_TABLE)}
    WHERE model_name = ${modelName} AND is_active = 1
    LIMIT 1
  `)) as unknown as CheckpointDbRow[];

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    weights: JSON.parse(row.weights) as CheckpointPayload,
    vocabulary: row.vocabulary ? (JSON.parse(row.vocabulary) as string[]) : undefined,
    metrics: row.metrics ? (JSON.parse(row.metrics) as Record<string, number>) : undefined,
    version: row.version,
  };
}

export async function listCheckpoints(modelName: string) {
  await initCheckpointSystem();

  const rows = (await db.execute(sql`
    SELECT id, model_name, version, metrics, created_at, is_active
    FROM ${sql.identifier(CHECKPOINT_TABLE)}
    WHERE model_name = ${modelName}
    ORDER BY version DESC
  `)) as unknown as CheckpointDbRow[];

  return rows.map((r: CheckpointDbRow) => ({
    id: r.id,
    version: r.version,
    metrics: r.metrics ? (JSON.parse(r.metrics) as Record<string, number>) : null,
    createdAt: r.created_at,
    isActive: r.is_active === 1,
  }));
}

export async function rollbackCheckpoint(modelName: string, version: number) {
  await initCheckpointSystem();

  await db.execute(sql`
    UPDATE ${sql.identifier(CHECKPOINT_TABLE)}
    SET is_active = 0
    WHERE model_name = ${modelName}
  `);

  await db.execute(sql`
    UPDATE ${sql.identifier(CHECKPOINT_TABLE)}
    SET is_active = 1
    WHERE model_name = ${modelName} AND version = ${version}
  `);

  console.log(`[Checkpoint] Rolled back ${modelName} to v${version}`);
}

export async function autoRetrain(
  modelName: string,
  trainingData: Array<{ utterance: string; intent: string }>,
  onProgress?: (msg: string) => void,
): Promise<{ success: boolean; version?: number; accuracy?: number }> {
  await initCheckpointSystem();

  const lastCheckpoint = await loadLatestCheckpoint(modelName);

  const vocabulary = Array.from(new Set(trainingData.flatMap((d) => d.utterance.toLowerCase().split(/\s+/))));
  const INTENTS = Array.from(new Set(trainingData.map((d) => d.intent)));

  let weights: Record<string, number[]> = {};
  if (lastCheckpoint?.weights?.vocabulary && lastCheckpoint?.weights?.weights) {
    weights = lastCheckpoint.weights.weights;
  } else {
    INTENTS.forEach((i) => {
      weights[i] = new Array(vocabulary.length).fill(0).map(() => (Math.random() - 0.5) * 0.01);
    });
  }

  const getFeatures = (text: string): number[] => {
    const tokens = text.toLowerCase().split(/\s+/);
    return vocabulary.map((w) => (tokens.includes(w) ? 1 : 0));
  };

  const epochs = 10;
  let totalCorrect = 0;
  let totalSamples = 0;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    let epochLoss = 0;

    for (const item of trainingData) {
      const x = getFeatures(item.utterance);
      const logits = INTENTS.map((intent) => {
        let score = 0;
        for (let j = 0; j < vocabulary.length; j++) {
          score += x[j] * weights[intent][j];
        }
        return score;
      });

      const exps = logits.map(Math.exp);
      const sumExp = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map((e) => e / sumExp);

      const trueIdx = INTENTS.indexOf(item.intent);
      epochLoss -= Math.log(probs[trueIdx] + 1e-15);

      if (logits.indexOf(Math.max(...logits)) === trueIdx) totalCorrect++;
      totalSamples++;

      const error = 1 - probs[trueIdx];
      for (let j = 0; j < vocabulary.length; j++) {
        weights[item.intent][j] += 0.01 * error * x[j];
        weights[item.intent][j] *= 0.999;
      }
    }

    const avgLoss = (epochLoss / trainingData.length).toFixed(4);
    onProgress?.(`Epoch ${epoch}/${epochs} — loss: ${avgLoss}`);
  }

  const accuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;

  const id = await saveCheckpoint(modelName, { vocabulary, weights }, vocabulary, {
    accuracy,
    loss: 0,
    samples: trainingData.length,
    epochs,
  });

  console.log(`[AutoRetrain] ${modelName} — accuracy: ${(accuracy * 100).toFixed(1)}%`);
  return { success: true, version: (await listCheckpoints(modelName))[0]?.version, accuracy };
}

// ══════════════════════════════════════════════════════════════
// WEIGHT INHERITANCE SYSTEM - Hệ thống trọng số kế thừa
// "Vay → Dùng → Trả nợ → Mở mode"
// ══════════════════════════════════════════════════════════════

export interface WeightLoan {
  id: string;
  lenderModel: string;
  borrowerModel: string;
  coreWeights: Record<string, number[]>;
  borrowedAt: number;
  repaidAt: number | null;
  status: "borrowed" | "repaid" | "inherited";
}

/**
 * Trích xuất trọng số cốt lõi (core weights) từ model cho vay.
 * Chỉ lấy weights có magnitude lớn (đóng góp nhiều vào dự đoán).
 */
export function extractCoreWeights(weights: Record<string, number[]>, threshold: number = 0.1): Record<string, number[]> {
  const coreWeights: Record<string, number[]> = {};

  for (const [intent, weightArr] of Object.entries(weights)) {
    const absWeights = weightArr.map((w) => Math.abs(w));
    const maxWeight = Math.max(...absWeights);
    const cutoff = maxWeight * threshold;

    coreWeights[intent] = weightArr.map((w) => (Math.abs(w) >= cutoff ? w : 0));
  }

  return coreWeights;
}

/**
 * Tính độ quan trọng của từng intent trong model.
 */
export function computeIntentImportance(weights: Record<string, number[]>): Record<string, number> {
  const importance: Record<string, number> = {};

  for (const [intent, weightArr] of Object.entries(weights)) {
    const sumAbs = weightArr.reduce((sum, w) => sum + Math.abs(w), 0);
    const maxAbs = Math.max(...weightArr.map(Math.abs));
    importance[intent] = (sumAbs + maxAbs) / (weightArr.length + 1);
  }

  return importance;
}

/**
 * Cho vay trọng số: Model A cho Model B mượn core weights.
 */
export async function borrowWeights(lenderModel: string, borrowerModel: string, coreThreshold: number = 0.1): Promise<WeightLoan> {
  await initCheckpointSystem();

  const lenderCheckpoint = await loadLatestCheckpoint(lenderModel);
  if (!lenderCheckpoint) {
    throw new Error(`Model "${lenderModel}" không tồn tại hoặc chưa có checkpoint`);
  }

  const coreWeights = extractCoreWeights(lenderCheckpoint.weights.weights, coreThreshold);
  const importance = computeIntentImportance(lenderCheckpoint.weights.weights);

  const loanId = crypto.randomUUID();
  const loan: WeightLoan = {
    id: loanId,
    lenderModel,
    borrowerModel,
    coreWeights,
    borrowedAt: Date.now(),
    repaidAt: null,
    status: "borrowed",
  };

  // Lưu thông tin vay vào file
  const loanPath = path.join(CHECKPOINT_DIR, `loan_${loanId}.json`);
  fs.writeFileSync(loanPath, JSON.stringify({ loan, importance }, null, 2));

  console.log(`[WeightLoan] ${lenderModel} → ${borrowerModel}: Borrowed ${Object.keys(coreWeights).length} intent weights`);
  return loan;
}

/**
 * Kế thừa trọng số: Model B nhận core weights từ Model A.
 */
export async function inheritWeights(childModel: string, loanId: string): Promise<{ success: boolean; inheritedIntents: string[] }> {
  await initCheckpointSystem();

  const loanPath = path.join(CHECKPOINT_DIR, `loan_${loanId}.json`);
  if (!fs.existsSync(loanPath)) {
    throw new Error(`Loan "${loanId}" không tồn tại`);
  }

  const loanData = JSON.parse(fs.readFileSync(loanPath, "utf-8")) as { loan: WeightLoan; importance: Record<string, number> };
  const { loan } = loanData;

  if (loan.status !== "borrowed") {
    throw new Error(`Loan "${loanId}" đã được trả hoặc kế thừa rồi`);
  }

  // Load checkpoint hiện tại của child model
  let childCheckpoint = await loadLatestCheckpoint(childModel);
  let childWeights: Record<string, number[]> = {};
  let childVocabulary: string[] = [];

  if (childCheckpoint?.weights?.weights) {
    childWeights = { ...childCheckpoint.weights.weights };
    childVocabulary = childCheckpoint.weights.vocabulary || [];
  }

  // Merge: child weights += parent core weights (weighted average)
  const inheritedIntents: string[] = [];
  for (const [intent, coreArr] of Object.entries(loan.coreWeights)) {
    if (!childWeights[intent]) {
      childWeights[intent] = coreArr;
      inheritedIntents.push(intent);
    } else {
      // Blend: 70% new + 30% inherited
      const blended = childWeights[intent].map((w, i) => w * 0.7 + coreArr[i] * 0.3);
      childWeights[intent] = blended;
      inheritedIntents.push(intent);
    }
  }

  // Lưu checkpoint mới
  const newVocabulary = Array.from(new Set([...childVocabulary, ...Object.keys(loan.coreWeights).flatMap((k) => k.split(" "))]));

  await saveCheckpoint(childModel, { vocabulary: newVocabulary, weights: childWeights }, newVocabulary, {
    inheritedIntents: inheritedIntents.length,
  });

  console.log(`[WeightInherit] ${childModel} kế thừa ${inheritedIntents.length} intents từ ${loan.lenderModel}`);
  return { success: true, inheritedIntents };
}

/**
 * Trả nợ: Xác nhận kế thừa hoàn tất, đánh dấu model cho vay là deprecated.
 */
export async function repayLoan(loanId: string): Promise<{ success: boolean; message: string }> {
  await initCheckpointSystem();

  const loanPath = path.join(CHECKPOINT_DIR, `loan_${loanId}.json`);
  if (!fs.existsSync(loanPath)) {
    throw new Error(`Loan "${loanId}" không tồn tại`);
  }

  const loanData = JSON.parse(fs.readFileSync(loanPath, "utf-8")) as { loan: WeightLoan; importance: Record<string, number> };

  loanData.loan.status = "repaid";
  loanData.loan.repaidAt = Date.now();

  fs.writeFileSync(loanPath, JSON.stringify(loanData, null, 2));

  const message = `Model "${loanData.loan.lenderModel}" đã trả nợ. Model "${loanData.loan.borrowerModel}" sở hữu vĩnh viễn ${Object.keys(loanData.loan.coreWeights).length} core weights.`;
  console.log(`[WeightLoan] Repaid: ${message}`);

  return { success: true, message };
}

/**
 * Liệt kê tất cả các khoản vay trọng số.
 */
export async function listWeightLoans(status?: "borrowed" | "repaid" | "inherited"): Promise<WeightLoan[]> {
  await initCheckpointSystem();

  const loanFiles = fs.readdirSync(CHECKPOINT_DIR).filter((f) => f.startsWith("loan_") && f.endsWith(".json"));

  const loans: WeightLoan[] = [];
  for (const file of loanFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, file), "utf-8")) as { loan: WeightLoan };
      if (!status || data.loan.status === status) {
        loans.push(data.loan);
      }
    } catch {}
  }

  return loans.sort((a, b) => b.borrowedAt - a.borrowedAt);
}

/**
 * Auto-inherit: Khi model cũ hết giá trị, tự động chuyển core weights sang model mới.
 */
export async function autoInheritWeights(oldModel: string, newModel: string): Promise<{ success: boolean; message: string }> {
  await initCheckpointSystem();

  const oldCheckpoint = await loadLatestCheckpoint(oldModel);
  if (!oldCheckpoint) {
    return { success: false, message: `Model "${oldModel}" không tồn tại` };
  }

  const accuracy = oldCheckpoint.metrics?.accuracy || 0;

  // Chỉ auto-inherit nếu model cũ có accuracy thấp (< 0.5) = hết giá trị
  if (accuracy >= 0.5) {
    return { success: false, message: `Model "${oldModel}" vẫn còn giá trị (accuracy: ${(accuracy * 100).toFixed(1)}%)` };
  }

  // Cho vay và kế thừa
  const loan = await borrowWeights(oldModel, newModel, 0.15);
  const inherit = await inheritWeights(newModel, loan.id);
  await repayLoan(loan.id);

  return {
    success: true,
    message: `Auto-inherit: ${oldModel} (accuracy: ${(accuracy * 100).toFixed(1)}%) → ${newModel}: ${inherit.inheritedIntents.length} intents kế thừa`,
  };
}
