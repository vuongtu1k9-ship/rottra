/**
 * 🧠 ROTTRA — PRIVACY ENGINE
 * Differential privacy and secure aggregation for FL.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { flPrivacyBudget } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import type { DPParams, PrivacyBudget } from "./types";

// ── Privacy Engine Class ─────────────────────────────────────

export class PrivacyEngine {
  private static instance: PrivacyEngine;

  private constructor() {}

  static getInstance(): PrivacyEngine {
    if (!PrivacyEngine.instance) {
      PrivacyEngine.instance = new PrivacyEngine();
    }
    return PrivacyEngine.instance;
  }

  /**
   * Add differential privacy noise to gradients
   */
  async addDPNoise(gradients: Float32Array[], params: DPParams, nodeId: string): Promise<Float32Array[]> {
    const { epsilon, delta, clipNorm, noiseMultiplier } = params;

    // Check privacy budget
    const budget = await this.checkPrivacyBudget(nodeId, epsilon);
    if (!budget.allowed) {
      throw new Error(`Privacy budget exceeded for node ${nodeId}: ${budget.message}`);
    }

    // Apply gradient clipping and noise
    const noisyGradients = gradients.map((grad) => {
      // Step 1: Compute gradient norm
      let gradNorm = 0;
      for (let i = 0; i < grad.length; i++) {
        gradNorm += grad[i] * grad[i];
      }
      gradNorm = Math.sqrt(gradNorm);

      // Step 2: Clip gradient
      const clippedGrad = new Float32Array(grad.length);
      if (gradNorm > clipNorm) {
        const scale = clipNorm / gradNorm;
        for (let i = 0; i < grad.length; i++) {
          clippedGrad[i] = grad[i] * scale;
        }
      } else {
        clippedGrad.set(grad);
      }

      // Step 3: Add calibrated Gaussian noise
      const sigma = noiseMultiplier * clipNorm;
      const noisyGrad = new Float32Array(clippedGrad.length);
      for (let i = 0; i < noisyGrad.length; i++) {
        const noise = this.gaussianRandom() * sigma;
        noisyGrad[i] = clippedGrad[i] + noise;
      }

      return noisyGrad;
    });

    // Update privacy budget
    await this.updatePrivacyBudget(nodeId, epsilon, delta);

    return noisyGradients;
  }

  /**
   * Secure aggregation using secret sharing
   */
  async secureAggregate(encryptedGradients: { nodeId: string; data: Float32Array }[]): Promise<Float32Array> {
    if (encryptedGradients.length === 0) {
      throw new Error("No gradients to aggregate");
    }

    // Simple weighted averaging (in production, use proper secure aggregation)
    const totalWeight = encryptedGradients.length;
    const resultLength = encryptedGradients[0].data.length;
    const result = new Float32Array(resultLength);

    for (const { data } of encryptedGradients) {
      for (let i = 0; i < resultLength; i++) {
        result[i] += data[i] / totalWeight;
      }
    }

    return result;
  }

  /**
   * Compute privacy budget for a training session
   */
  async computePrivacyBudget(
    rounds: number,
    samplesPerRound: number,
    noiseMultiplier: number,
  ): Promise<{ epsilon: number; delta: number }> {
    // RDP accountant (simplified)
    // In production, use Opacus or similar library

    const alpha = 1.1; // Renyi divergence order
    const q = samplesPerRound / 10000; // Sampling rate

    // RDP at each step
    const rdpPerStep = ((q * q) / (2 * noiseMultiplier * noiseMultiplier)) * Math.min(1, (2 * q * q) / (noiseMultiplier * noiseMultiplier));

    // Total RDP
    const totalRDP = rdpPerStep * rounds;

    // Convert RDP to (epsilon, delta)-DP
    const deltaOut = 1e-5;
    const epsilon = totalRDP + Math.log(1 / deltaOut) / (alpha - 1);

    return { epsilon, delta: deltaOut };
  }

  /**
   * Check if node has exceeded privacy budget
   */
  private async checkPrivacyBudget(
    nodeId: string,
    requestedEpsilon: number,
  ): Promise<{ allowed: boolean; message: string; budget?: PrivacyBudget }> {
    const existing = await db.select().from(flPrivacyBudget).where(eq(flPrivacyBudget.nodeId, nodeId)).limit(1);

    if (!existing[0]) {
      // First time, create budget
      return { allowed: true, message: "First round" };
    }

    const budget = existing[0] as PrivacyBudget;
    const newEpsilonUsed = budget.epsilonUsed + requestedEpsilon;

    if (newEpsilonUsed > budget.epsilonLimit) {
      return {
        allowed: false,
        message: `Epsilon ${newEpsilonUsed.toFixed(4)} exceeds limit ${budget.epsilonLimit}`,
        budget,
      };
    }

    return { allowed: true, message: "Budget OK", budget };
  }

  /**
   * Update privacy budget after training
   */
  private async updatePrivacyBudget(nodeId: string, epsilon: number, delta: number): Promise<void> {
    const existing = await db.select().from(flPrivacyBudget).where(eq(flPrivacyBudget.nodeId, nodeId)).limit(1);

    if (!existing[0]) {
      await db.insert(flPrivacyBudget).values({
        id: randomUUID(),
        nodeId: nodeId,
        epsilonUsed: epsilon,
        epsilon_limit: 10.0,
        deltaUsed: delta,
        roundCount: 1,
      });
    } else {
      await db
        .update(flPrivacyBudget)
        .set({
          epsilonUsed: sql`${flPrivacyBudget.epsilonUsed} + ${epsilon}`,
          deltaUsed: sql`${flPrivacyBudget.deltaUsed} + ${delta}`,
          roundCount: sql`${flPrivacyBudget.roundCount} + 1`,
          updated_at: new Date(),
        })
        .where(eq(flPrivacyBudget.nodeId, nodeId));
    }
  }

  /**
   * Get privacy budget for a node
   */
  async getPrivacyBudget(nodeId: string): Promise<PrivacyBudget | null> {
    const existing = await db.select().from(flPrivacyBudget).where(eq(flPrivacyBudget.nodeId, nodeId)).limit(1);

    return (existing[0] as PrivacyBudget) || null;
  }

  /**
   * Gaussian random using Box-Muller transform
   */
  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const privacyEngine = PrivacyEngine.getInstance();
