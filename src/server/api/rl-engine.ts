import { db } from "~/infra/database/db-pool";
import { aiModels } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { NeuralNetwork } from "./rl-brain";

const EPSILON = 0.2; // Exploration rate
const MODEL_ID = "rl_product_recommender";

// --- Feature Encoding ---
// Convert arbitrary string to a fixed-size normalized float array [-1, 1]
function encodeString(str: string, size: number): number[] {
  const arr = new Array(size).fill(0);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    arr[i % size] += code;
  }
  // Normalize
  for (let i = 0; i < size; i++) {
    arr[i] = (arr[i] % 100) / 50 - 1; 
  }
  return arr;
}

function encodeStateAction(context: any, actionId: string): number[] {
  const stateStr = JSON.stringify(context || {});
  const stateFeatures = encodeString(stateStr, 10);
  const actionFeatures = encodeString(actionId, 5);
  return [...stateFeatures, ...actionFeatures];
}

// --- Model Management ---
let cachedModel: NeuralNetwork | null = null;

async function loadModel(): Promise<NeuralNetwork> {
  if (cachedModel) return cachedModel;

  const record = await db.query.aiModels.findFirst({
    where: eq(aiModels.id, MODEL_ID),
  });

  const nn = new NeuralNetwork(15, 16, 1, 0.1);
  if (record && record.weightsJson) {
    try {
      nn.fromJSON(record.weightsJson);
    } catch (e) {
      console.error("[RL-Engine] Lỗi parse model weights, khởi tạo lại từ đầu.");
    }
  }
  cachedModel = nn;
  return nn;
}

async function saveModel(nn: NeuralNetwork) {
  const jsonStr = nn.toJSON();
  const record = await db.query.aiModels.findFirst({
    where: eq(aiModels.id, MODEL_ID),
  });

  if (record) {
    await db.update(aiModels).set({ weightsJson: jsonStr, lastUpdated: new Date().toISOString() }).where(eq(aiModels.id, MODEL_ID));
  } else {
    await db.insert(aiModels).values({ id: MODEL_ID, weightsJson: jsonStr, lastUpdated: new Date().toISOString() });
  }
}

// --- Core API ---
export async function getQValue(context: any, actionId: string): Promise<number> {
  const nn = await loadModel();
  const input = encodeStateAction(context, actionId);
  const output = nn.predict(input);
  return output[0];
}

export async function updateQValue(context: any, actionId: string, reward: number): Promise<void> {
  const nn = await loadModel();
  
  // Anti-reward hacking can be done before passing reward
  // but for NN, we just train towards the reward directly.
  const input = encodeStateAction(context, actionId);
  
  // Lấy Q-value hiện tại để tính toán Bellman
  const currentQ = nn.predict(input)[0];
  const ALPHA = 0.1;
  const targetQ = currentQ + ALPHA * (reward - currentQ);

  nn.train(input, [targetQ]);
  
  // Lưu model (có thể tối ưu hóa lưu định kỳ thay vì mỗi lần)
  await saveModel(nn);
}

export async function recommendProduct(context: any, availableProducts: any[]): Promise<any> {
  if (!availableProducts || availableProducts.length === 0) return null;

  const isExplore = Math.random() < EPSILON;

  if (isExplore) {
    const randomIndex = Math.floor(Math.random() * availableProducts.length);
    console.log(`[RL-Engine] 🎲 Exploration: Chọn ngẫu nhiên sản phẩm bằng Mạng Nơ-ron.`);
    return availableProducts[randomIndex];
  } else {
    let bestProduct = availableProducts[0];
    let maxQ = -Infinity;

    for (const product of availableProducts) {
      const qValue = await getQValue(context, product.id);
      if (qValue > maxQ) {
        maxQ = qValue;
        bestProduct = product;
      }
    }
    console.log(`[RL-Engine] 🎯 Exploitation: Chọn sản phẩm tốt nhất (Q=${maxQ.toFixed(2)}) bằng Mạng Nơ-ron.`);
    return bestProduct;
  }
}
