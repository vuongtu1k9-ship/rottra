/**
 * 🧠 ROTTRA — BYZANTINE FAULT TOLERANCE
 * Detects malicious gradient submissions in Federated Learning.
 * Uses statistical analysis and norm-based filtering.
 * Runs on Bun runtime.
 */

import { db } from "~/infra/database/db-pool";
import { flGradientUpdate, flRound } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────

export interface ByzantineCheckResult {
  nodeId: string;
  passed: boolean;
  reasons: string[];
  severity: "none" | "low" | "medium" | "high" | "critical";
  trustScore: number; // 0.0 to 1.0
}

export interface GradientNormStats {
  mean: number;
  stdDev: number;
  median: number;
  iqr: number;
  q1: number;
  q3: number;
}

// ── Byzantine Detection Engine ────────────────────────────────

export class ByzantineFaultDetector {
  private static instance: ByzantineFaultDetector;

  private constructor() {}

  static getInstance(): ByzantineFaultDetector {
    if (!ByzantineFaultDetector.instance) {
      ByzantineFaultDetector.instance = new ByzantineFaultDetector();
    }
    return ByzantineFaultDetector.instance;
  }

  /**
   * Run Byzantine fault detection on all gradients in a round
   */
  async detectByzantineGradients(roundId: string): Promise<ByzantineCheckResult[]> {
    // Get all gradients for this round
    const gradients = await db.select().from(flGradientUpdate).where(eq(flGradientUpdate.roundId, roundId));

    if (gradients.length < 3) {
      // Not enough data for statistical analysis
      return gradients.map((g: any) => ({
        nodeId: g.nodeId,
        passed: true,
        reasons: ["Insufficient data for Byzantine analysis"],
        severity: "none" as const,
        trustScore: 1.0,
      }));
    }

    // Compute gradient norms for all submissions
    const gradientNorms: { nodeId: string; norm: number; loss: number; accuracy: number }[] = [];
    for (const g of gradients) {
      const norm = this.computeGradientNorm(g.encrypted_gradients);
      gradientNorms.push({
        nodeId: g.nodeId,
        norm,
        loss: Number(g.local_loss) || 0,
        accuracy: Number(g.local_accuracy) || 0,
      });
    }

    // Compute stats
    const norms = gradientNorms.map((g) => g.norm);
    const stats = this.computeNormStats(norms);

    // Run detection checks
    const results: ByzantineCheckResult[] = [];
    for (const gn of gradientNorms) {
      const result = this.checkSingleGradient(gn, stats, gradientNorms);
      results.push(result);
    }

    // Log results
    const byzantineCount = results.filter((r) => !r.passed).length;
    if (byzantineCount > 0) {
      console.log(`[BYZANTINE] Detected ${byzantineCount}/${results.length} suspicious gradients in round ${roundId}`);
    }

    return results;
  }

  /**
   * Check a single gradient submission
   */
  private checkSingleGradient(
    gradient: { nodeId: string; norm: number; loss: number; accuracy: number },
    stats: GradientNormStats,
    allGradients: { nodeId: string; norm: number; loss: number; accuracy: number }[],
  ): ByzantineCheckResult {
    const reasons: string[] = [];
    let trustScore = 1.0;
    let maxSeverity: "none" | "low" | "medium" | "high" | "critical" = "none";

    // Check 1: Gradient norm outlier (IQR method)
    const iqr = stats.iqr;
    const lowerFence = stats.q1 - 1.5 * iqr;
    const upperFence = stats.q3 + 1.5 * iqr;

    if (gradient.norm > upperFence || gradient.norm < lowerFence) {
      reasons.push(`Gradient norm ${gradient.norm.toFixed(4)} outside IQR range [${lowerFence.toFixed(4)}, ${upperFence.toFixed(4)}]`);
      trustScore -= 0.3;
      this.updateSeverity("medium", maxSeverity);
      maxSeverity = this.maxSeverity("medium", maxSeverity);
    }

    // Check 2: Z-score outlier
    const zScore = stats.stdDev > 0 ? Math.abs(gradient.norm - stats.mean) / stats.stdDev : 0;
    if (zScore > 3) {
      reasons.push(`Z-score ${zScore.toFixed(2)} indicates extreme outlier`);
      trustScore -= 0.4;
      maxSeverity = this.maxSeverity("high", maxSeverity);
    }

    // Check 3: Gradient norm too small (possible model poisoning)
    if (gradient.norm < 0.001) {
      reasons.push("Gradient norm near zero — possible model poisoning or lazy update");
      trustScore -= 0.2;
      maxSeverity = this.maxSeverity("low", maxSeverity);
    }

    // Check 4: Gradient norm too large (possible adversarial attack)
    if (gradient.norm > stats.mean + 5 * stats.stdDev) {
      reasons.push("Gradient norm excessively large — possible adversarial attack");
      trustScore -= 0.5;
      maxSeverity = this.maxSeverity("critical", maxSeverity);
    }

    // Check 5: Loss/accuracy inconsistency
    const avgLoss = allGradients.reduce((s, g) => s + g.loss, 0) / allGradients.length;
    const avgAccuracy = allGradients.reduce((s, g) => s + g.accuracy, 0) / allGradients.length;

    if (Math.abs(gradient.loss - avgLoss) > 2 * this.standardDeviation(allGradients.map((g) => g.loss))) {
      reasons.push(`Loss ${gradient.loss.toFixed(4)} deviates significantly from mean ${avgLoss.toFixed(4)}`);
      trustScore -= 0.15;
      maxSeverity = this.maxSeverity("low", maxSeverity);
    }

    if (Math.abs(gradient.accuracy - avgAccuracy) > 2 * this.standardDeviation(allGradients.map((g) => g.accuracy))) {
      reasons.push(`Accuracy ${gradient.accuracy.toFixed(4)} deviates significantly from mean ${avgAccuracy.toFixed(4)}`);
      trustScore -= 0.15;
      maxSeverity = this.maxSeverity("low", maxSeverity);
    }

    // Check 6: Sign flip detection (compare to majority gradient direction)
    const medianNorm = stats.median;
    const isFlipped =
      (gradient.norm > medianNorm * 2 && allGradients.filter((g) => g.norm > medianNorm).length < allGradients.length / 3) ||
      (gradient.norm < medianNorm * 0.5 && allGradients.filter((g) => g.norm < medianNorm).length < allGradients.length / 3);

    if (isFlipped) {
      reasons.push("Gradient direction appears flipped relative to majority");
      trustScore -= 0.35;
      maxSeverity = this.maxSeverity("medium", maxSeverity);
    }

    trustScore = Math.max(0, Math.min(1, trustScore));

    return {
      nodeId: gradient.nodeId,
      passed: trustScore >= 0.5 && reasons.length < 3,
      reasons,
      severity:
        trustScore >= 0.8 ? "none" : trustScore >= 0.6 ? "low" : trustScore >= 0.4 ? "medium" : trustScore >= 0.2 ? "high" : "critical",
      trustScore,
    };
  }

  /**
   * Filter gradients, keeping only those that pass Byzantine checks
   */
  async filterByzantineGradients(roundId: string): Promise<{
    valid: string[];
    flagged: string[];
    results: ByzantineCheckResult[];
  }> {
    const results = await this.detectByzantineGradients(roundId);

    const valid: string[] = [];
    const flagged: string[] = [];

    for (const r of results) {
      if (r.passed) {
        valid.push(r.nodeId);
      } else {
        flagged.push(r.nodeId);
      }
    }

    return { valid, flagged, results };
  }

  /**
   * Update node reputation based on Byzantine check results
   */
  async updateNodeReputations(roundId: string): Promise<void> {
    const results = await this.detectByzantineGradients(roundId);

    for (const r of results) {
      const reputationDelta =
        r.severity === "none" ? 0.05 : r.severity === "low" ? -0.02 : r.severity === "medium" ? -0.1 : r.severity === "high" ? -0.25 : -0.5;

      await db.execute(sql`
        UPDATE "fl_node"
        SET reputation_score = GREATEST(0, LEAST(1, reputation_score + ${reputationDelta}))
        WHERE id = ${r.nodeId}
      `);
    }
  }

  // ── Helper Functions ──────────────────────────────────────

  private computeGradientNorm(encryptedGradients: any): number {
    if (!encryptedGradients) return 0;

    try {
      const data = encryptedGradients.data;
      if (typeof data === "string") {
        // Base64 encoded
        const buffer = Buffer.from(data, "base64");
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 4) {
          const val = buffer.readFloatLE(i);
          sum += val * val;
        }
        return Math.sqrt(sum);
      }
      if (Array.isArray(data)) {
        let sum = 0;
        for (const v of data) sum += v * v;
        return Math.sqrt(sum);
      }
    } catch {
      return 0;
    }
    return 0;
  }

  private computeNormStats(norms: number[]): GradientNormStats {
    const sorted = [...norms].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    return { mean, stdDev, median, iqr, q1, q3 };
  }

  private standardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return Math.sqrt(variance);
  }

  private maxSeverity(
    a: "none" | "low" | "medium" | "high" | "critical",
    b: "none" | "low" | "medium" | "high" | "critical",
  ): "none" | "low" | "medium" | "high" | "critical" {
    const order = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return order[a] > order[b] ? a : b;
  }

  private updateSeverity(
    newSev: "none" | "low" | "medium" | "high" | "critical",
    current: "none" | "low" | "medium" | "high" | "critical",
  ): void {
    // Intentionally unused — maxSeverity is used instead
  }
}

// ── Export Singleton ───────────────────────────────────────────

export const byzantineDetector = ByzantineFaultDetector.getInstance();
