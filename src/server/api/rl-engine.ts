import { db } from "~/infra/database/db-pool";
import { rlQTable, Product } from "~/infra/database/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// Hyperparameters for Q-Learning
const ALPHA = 0.1; // Learning rate
const GAMMA = 0.9; // Discount factor (used if we have sequential states, but typically 0 for contextual bandit)
const EPSILON = 0.2; // Exploration rate (20% of the time, explore random/new products)

/**
 * Creates a unique state hash based on user preferences or current context.
 * For example: user location, search keyword, or recent activity.
 */
export function hashState(context: any): string {
  const str = JSON.stringify(context || {});
  return crypto.createHash("md5").update(str).digest("hex");
}

/**
 * Retrieves the Q-value for a specific state and action.
 */
export async function getQValue(stateHash: string, actionId: string): Promise<number> {
  const record = await db.query.rlQTable.findFirst({
    where: and(
      eq(rlQTable.stateHash, stateHash),
      eq(rlQTable.actionId, actionId)
    ),
  });
  return record?.qValue || 0;
}

/**
 * Updates the Q-value using the Bellman Equation with Anti-Reward Hacking.
 */
export async function updateQValue(stateHash: string, actionId: string, reward: number): Promise<void> {
  const record = await db.query.rlQTable.findFirst({
    where: and(
      eq(rlQTable.stateHash, stateHash),
      eq(rlQTable.actionId, actionId)
    ),
  });

  if (record) {
    // 🛡️ ANTI-REWARD HACKING: Diminishing returns for repetitive actions
    // Nếu AI spam 1 sản phẩm quá nhiều lần, phần thưởng sẽ bị giảm giá trị thực tế
    // Công thức: effective_reward = reward / log2(visitCount + 1)
    const effectiveReward = reward > 0 ? reward / Math.max(1, Math.log2(record.visitCount + 1)) : reward;

    // Q(s,a) = Q(s,a) + alpha * (effectiveReward - Q(s,a))
    const newQValue = record.qValue + ALPHA * (effectiveReward - record.qValue);
    
    await db.update(rlQTable)
      .set({ 
        qValue: newQValue, 
        visitCount: record.visitCount + 1,
        lastUpdated: new Date().toISOString()
      })
      .where(eq(rlQTable.id, record.id));
  } else {
    // Initial update
    const initialQValue = ALPHA * reward;
    await db.insert(rlQTable).values({
      id: crypto.randomUUID(),
      stateHash,
      actionId,
      qValue: initialQValue,
      visitCount: 1,
      lastUpdated: new Date().toISOString()
    });
  }
}

/**
 * Selects the best action (product to recommend) using Epsilon-Greedy strategy.
 */
export async function recommendProduct(context: any, availableProducts: any[]): Promise<any> {
  if (!availableProducts || availableProducts.length === 0) return null;
  
  const stateHash = hashState(context);
  const isExplore = Math.random() < EPSILON;

  if (isExplore) {
    // Exploration: Choose a random product
    const randomIndex = Math.floor(Math.random() * availableProducts.length);
    console.log(`[RL-Engine] 🎲 Exploration: Chọn ngẫu nhiên sản phẩm cho state ${stateHash.slice(0, 6)}`);
    return availableProducts[randomIndex];
  } else {
    // Exploitation: Choose the product with the highest Q-value
    let bestProduct = availableProducts[0];
    let maxQ = -Infinity;

    for (const product of availableProducts) {
      const qValue = await getQValue(stateHash, product.id);
      if (qValue > maxQ) {
        maxQ = qValue;
        bestProduct = product;
      }
    }
    console.log(`[RL-Engine] 🎯 Exploitation: Chọn sản phẩm tốt nhất (Q=${maxQ.toFixed(2)}) cho state ${stateHash.slice(0, 6)}`);
    return bestProduct;
  }
}
