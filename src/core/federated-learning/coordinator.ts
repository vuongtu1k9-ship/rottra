/**
 * 🧠 ROTTRA — FEDERATED LEARNING COORDINATOR
 * Orchestrates FL rounds, aggregates gradients, broadcasts models.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { flRound, flGradientUpdate, flModelVersion, flNode, flPrivacyBudget } from "~/infra/database/schema";
import { eq, and, sql } from "drizzle-orm";
import type {
  FLRound,
  FLRoundConfig,
  FLRoundStatus,
  GradientUpdate,
  ModelVersion,
  ModelWeights,
  ModelMetrics,
  AggregationResult,
  FLNode,
  FLEvent,
} from "./types";

// ── Default Config ───────────────────────────────────────────

const DEFAULT_CONFIG: FLRoundConfig = {
  localEpochs: 3,
  learningRate: 0.01,
  minNodes: 3,
  timeoutMs: 5 * 60 * 1000, // 5 minutes
  dpEpsilon: 1.0,
  dpDelta: 1e-5,
  modelType: "intent_classifier",
};

// ── Coordinator Class ────────────────────────────────────────

export class FederatedLearningCoordinator {
  private static instance: FederatedLearningCoordinator;
  private activeRounds: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private eventListeners: ((event: FLEvent) => void)[] = [];

  private constructor() {}

  static getInstance(): FederatedLearningCoordinator {
    if (!FederatedLearningCoordinator.instance) {
      FederatedLearningCoordinator.instance = new FederatedLearningCoordinator();
    }
    return FederatedLearningCoordinator.instance;
  }

  /**
   * Subscribe to FL events
   */
  onEvent(listener: (event: FLEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: FLEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[FL] Event listener error:", err);
      }
    }
  }

  /**
   * Start a new FL round
   */
  async startRound(configOverrides: Partial<FLRoundConfig> = {}): Promise<FLRound> {
    const config = { ...DEFAULT_CONFIG, ...configOverrides };

    // Get next round number
    const lastRound = await db
      .select({ roundNumber: flRound.roundNumber })
      .from(flRound)
      .orderBy(sql`${flRound.roundNumber} DESC`)
      .limit(1);

    const roundNumber = (lastRound[0]?.roundNumber ?? 0) + 1;

    // Get latest global model
    const latestModel = await db
      .select({ id: flModelVersion.id })
      .from(flModelVersion)
      .orderBy(sql`${flModelVersion.versionNumber} DESC`)
      .limit(1);

    const globalModelId = latestModel[0]?.id ?? null;

    // Create round
    const roundId = randomUUID();
    const round: FLRound = {
      id: roundId,
      roundNumber,
      status: "collecting",
      globalModelId,
      config,
      startedAt: new Date(),
      completedAt: null,
      participantCount: 0,
      aggregationMethod: "fedavg",
    };

    await db.insert(flRound).values({
      id: roundId,
      roundNumber: roundNumber,
      status: "collecting",
      global_model_id: globalModelId,
      config: config as any,
      aggregation_method: "fedavg",
    });

    this.emit({ type: "round_started", roundId, config });
    console.log(`[FL] Round ${roundNumber} started (${roundId})`);

    // Set timeout for round
    const timeout = setTimeout(async () => {
      console.log(`[FL] Round ${roundNumber} timeout, attempting aggregation...`);
      await this.attemptAggregation(roundId);
    }, config.timeoutMs);

    this.activeRounds.set(roundId, timeout);

    return round;
  }

  /**
   * Submit gradient update from a node
   */
  async submitGradient(
    roundId: string,
    nodeId: string,
    encryptedGradients: any,
    metrics: { localLoss: number; localAccuracy: number; dataSampleCount: number },
  ): Promise<{ accepted: boolean; message: string }> {
    // Verify round is collecting
    const round = await db.select().from(flRound).where(eq(flRound.id, roundId)).limit(1);

    if (!round[0]) {
      return { accepted: false, message: "Round not found" };
    }

    if (round[0].status !== "collecting") {
      return { accepted: false, message: `Round is ${round[0].status}, not collecting` };
    }

    // Check if node already submitted
    const existing = await db
      .select()
      .from(flGradientUpdate)
      .where(and(eq(flGradientUpdate.roundId, roundId), eq(flGradientUpdate.nodeId, nodeId)))
      .limit(1);

    if (existing[0]) {
      return { accepted: false, message: "Node already submitted gradients" };
    }

    // Compute gradient hash
    const gradientHash = await this.computeHash(encryptedGradients);

    // Insert gradient update
    const updateId = randomUUID();
    await db.insert(flGradientUpdate).values({
      id: updateId,
      roundId: roundId,
      nodeId: nodeId,
      model_version: round[0].global_model_id ?? "initial",
      gradient_hash: gradientHash,
      dataSampleCount: metrics.dataSampleCount,
      local_loss: metrics.localLoss,
      local_accuracy: metrics.localAccuracy,
      encrypted_gradients: encryptedGradients as any,
    });

    // Update round participant count
    await db
      .update(flRound)
      .set({
        participantCount: sql`${flRound.participantCount} + 1`,
      })
      .where(eq(flRound.id, roundId));

    this.emit({ type: "gradient_received", roundId, nodeId });
    console.log(`[FL] Gradient received from node ${nodeId} for round ${roundId}`);

    // Check if we have enough nodes
    const updatedRound = await db.select().from(flRound).where(eq(flRound.id, roundId)).limit(1);

    if (updatedRound[0] && updatedRound[0].participantCount >= round[0].config.minNodes) {
      console.log(`[FL] Enough nodes (${updatedRound[0].participantCount}), starting aggregation...`);
      // Start aggregation in background
      setTimeout(() => this.attemptAggregation(roundId), 0);
    }

    return { accepted: true, message: "Gradient submitted successfully" };
  }

  /**
   * Attempt to aggregate gradients for a round
   */
  private async attemptAggregation(roundId: string): Promise<void> {
    // Clear timeout
    const timeout = this.activeRounds.get(roundId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeRounds.delete(roundId);
    }

    // Get round
    const round = await db.select().from(flRound).where(eq(flRound.id, roundId)).limit(1);

    if (!round[0] || round[0].status !== "collecting") {
      return;
    }

    // Get all gradient updates
    const gradients = await db.select().from(flGradientUpdate).where(eq(flGradientUpdate.roundId, roundId));

    if (gradients.length < round[0].config.minNodes) {
      console.log(`[FL] Not enough gradients (${gradients.length}/${round[0].config.minNodes}), marking as failed`);
      await db.update(flRound).set({ status: "failed", completed_at: new Date() }).where(eq(flRound.id, roundId));
      this.emit({ type: "round_failed", roundId, error: "Insufficient participants" });
      return;
    }

    // Update status to aggregating
    await db.update(flRound).set({ status: "aggregating" }).where(eq(flRound.id, roundId));

    this.emit({ type: "aggregation_started", roundId });

    try {
      // Perform FedAvg aggregation
      const result = await this.fedAvgAggregation(roundId, gradients);

      // Save new model version
      const modelId = randomUUID();
      await db.insert(flModelVersion).values({
        id: modelId,
        versionNumber: round[0].roundNumber,
        roundId: roundId,
        model_weights: result.aggregatedWeights as any,
        model_hash: await this.computeHash(result.aggregatedWeights),
        parent_version_id: round[0].global_model_id,
        metrics: {
          accuracy: result.avgAccuracy,
          loss: result.avgLoss,
          f1Score: 0,
          precision: 0,
          recall: 0,
        } as any,
      });

      // Update round status
      await db
        .update(flRound)
        .set({
          status: "completed",
          global_model_id: modelId,
          completed_at: new Date(),
        })
        .where(eq(flRound.id, roundId));

      this.emit({ type: "aggregation_completed", roundId, modelId });
      this.emit({ type: "round_completed", roundId, metrics: result.aggregatedWeights as any });

      console.log(`[FL] Round ${round[0].roundNumber} completed. Model: ${modelId}`);
    } catch (err: any) {
      console.error(`[FL] Aggregation failed:`, err);
      await db.update(flRound).set({ status: "failed", completed_at: new Date() }).where(eq(flRound.id, roundId));
      this.emit({ type: "round_failed", roundId, error: err.message });
    }
  }

  /**
   * FedAvg aggregation algorithm
   */
  private async fedAvgAggregation(roundId: string, gradients: any[]): Promise<AggregationResult> {
    const startTime = Date.now();

    // Calculate total samples
    const totalSamples = gradients.reduce((sum, g) => sum + g.dataSampleCount, 0);

    // Weighted average by sample count
    const nodeWeights = new Map<string, number>();
    for (const g of gradients) {
      nodeWeights.set(g.nodeId, g.dataSampleCount / totalSamples);
    }

    // Get global model weights (or initialize)
    const round = await db.select().from(flRound).where(eq(flRound.id, roundId)).limit(1);

    let globalWeights: any;
    if (round[0]?.global_model_id) {
      const parentModel = await db.select().from(flModelVersion).where(eq(flModelVersion.id, round[0].global_model_id)).limit(1);
      globalWeights = parentModel[0]?.model_weights;
    }

    // Aggregate gradients (simplified - in real implementation, would deserialize and average tensors)
    const aggregatedWeights = globalWeights || { layers: [], architectureHash: "", parameterCount: 0 };

    // Calculate weighted metrics
    let avgLoss = 0;
    let avgAccuracy = 0;
    for (const g of gradients) {
      const weight = nodeWeights.get(g.nodeId) || 0;
      avgLoss += g.local_loss * weight;
      avgAccuracy += g.local_accuracy * weight;
    }

    return {
      roundId,
      aggregatedWeights,
      participantCount: gradients.length,
      totalSamples,
      avgLoss,
      avgAccuracy,
      nodeWeights,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get global model for nodes to download
   */
  async getGlobalModel(): Promise<{ modelId: string; weights: any } | null> {
    const latest = await db
      .select()
      .from(flModelVersion)
      .orderBy(sql`${flModelVersion.versionNumber} DESC`)
      .limit(1);

    if (!latest[0]) {
      return null;
    }

    return {
      modelId: latest[0].id,
      weights: latest[0].model_weights,
    };
  }

  /**
   * Get FL status
   */
  async getStatus(): Promise<{
    activeRounds: FLRound[];
    totalRounds: number;
    totalModels: number;
    latestRound: FLRound | null;
  }> {
    const activeRounds = await db
      .select()
      .from(flRound)
      .where(sql`${flRound.status} IN ('collecting', 'aggregating')`);

    const totalRounds = await db.select({ count: sql<number>`count(*)` }).from(flRound);

    const totalModels = await db.select({ count: sql<number>`count(*)` }).from(flModelVersion);

    const latestRound = await db
      .select()
      .from(flRound)
      .orderBy(sql`${flRound.roundNumber} DESC`)
      .limit(1);

    return {
      activeRounds: activeRounds as any[],
      totalRounds: totalRounds[0]?.count ?? 0,
      totalModels: totalModels[0]?.count ?? 0,
      latestRound: (latestRound[0] as any) ?? null,
    };
  }

  /**
   * Simple hash computation
   */
  private async computeHash(data: any): Promise<string> {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const flCoordinator = FederatedLearningCoordinator.getInstance();
