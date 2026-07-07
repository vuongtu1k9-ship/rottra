/**
 * 🧠 ROTTRA — BLOCKCHAIN AUDIT
 * Verifiable training provenance for FL.
 * Extends existing BlockchainLedger.
 * Runs on Bun runtime.
 */

import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { blockchainLedger, flRound, flModelVersion, flGradientUpdate } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import type { FLProvenanceRecord, FLRound, ModelMetrics } from "./types";

// ── Blockchain Audit Class ───────────────────────────────────

export class FLBlockchainAudit {
  private static instance: FLBlockchainAudit;

  private constructor() {}

  static getInstance(): FLBlockchainAudit {
    if (!FLBlockchainAudit.instance) {
      FLBlockchainAudit.instance = new FLBlockchainAudit();
    }
    return FLBlockchainAudit.instance;
  }

  /**
   * Log FL training round to blockchain
   */
  async logRound(round: FLRound, modelHash: string, participantNodes: string[], metrics: ModelMetrics): Promise<string> {
    // Get previous hash
    const previousRecord = await db
      .select({ currentHash: blockchainLedger.currentHash })
      .from(blockchainLedger)
      .orderBy(sql`${blockchainLedger.timestamp} DESC`)
      .limit(1);

    const previousHash = previousRecord[0]?.currentHash || "0".repeat(64);

    // Create block data
    const blockData = {
      type: "FL_TRAINING_ROUND",
      roundId: round.id,
      roundNumber: round.roundNumber,
      modelHash,
      participantNodes,
      aggregationMethod: round.aggregationMethod,
      dpParams: {
        epsilon: round.config.dpEpsilon,
        delta: round.config.dpDelta,
      },
      metrics,
      timestamp: new Date().toISOString(),
    };

    // Compute hash
    const currentHash = this.computeHash(previousHash, blockData);

    // Insert into blockchain ledger
    const blockId = randomUUID();
    await db.insert(blockchainLedger).values({
      id: blockId,
      batchId: `FL-ROUND-${round.roundNumber}`,
      action: "FL_TRAINING",
      dataPayload: blockData as any,
      previousHash,
      currentHash,
      recordedBy: "fl-coordinator",
    });

    console.log(`[BlockchainAudit] Round ${round.roundNumber} logged. Hash: ${currentHash.substring(0, 16)}...`);

    return blockId;
  }

  /**
   * Verify training provenance for a model
   */
  async verifyProvenance(modelId: string): Promise<{
    valid: boolean;
    chain: FLProvenanceRecord[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const chain: FLProvenanceRecord[] = [];

    // Get model
    const model = await db.select().from(flModelVersion).where(eq(flModelVersion.id, modelId)).limit(1);

    if (!model[0]) {
      return { valid: false, chain: [], errors: ["Model not found"] };
    }

    // Get round
    const round = await db.select().from(flRound).where(eq(flRound.id, model[0].roundId)).limit(1);

    if (!round[0]) {
      return { valid: false, chain: [], errors: ["Round not found"] };
    }

    // Get blockchain record
    const record = await db
      .select()
      .from(blockchainLedger)
      .where(sql`${blockchainLedger.batchId} = ${`FL-ROUND-${round[0].roundNumber}`}`)
      .limit(1);

    if (!record[0]) {
      return { valid: false, chain: [], errors: ["Blockchain record not found"] };
    }

    // Verify hash chain
    const previousHash = record[0].previousHash;
    const currentHash = record[0].currentHash;

    // Check previous block exists
    if (previousHash !== "0".repeat(64)) {
      const prevBlock = await db.select().from(blockchainLedger).where(eq(blockchainLedger.currentHash, previousHash)).limit(1);

      if (!prevBlock[0]) {
        errors.push("Previous block not found in chain");
      }
    }

    // Verify current hash
    const dataPayload = record[0].dataPayload as any;
    const expectedHash = this.computeHash(previousHash, dataPayload);

    if (expectedHash !== currentHash) {
      errors.push("Hash mismatch - data may have been tampered");
    }

    // Get participant nodes
    const participantNodes = dataPayload.participantNodes || [];

    // Verify gradient submissions exist
    for (const nodeId of participantNodes) {
      const submission = await db
        .select()
        .from(flGradientUpdate)
        .where(sql`${flGradientUpdate.roundId} = ${round[0].id} AND ${flGradientUpdate.nodeId} = ${nodeId}`)
        .limit(1);

      if (!submission[0]) {
        errors.push(`Node ${nodeId} has no gradient submission for this round`);
      }
    }

    chain.push({
      id: record[0].id,
      roundId: round[0].id,
      modelId,
      modelHash: dataPayload.modelHash,
      previousHash,
      currentHash,
      participantNodes,
      aggregationMethod: dataPayload.aggregationMethod,
      dpParams: dataPayload.dpParams,
      metrics: dataPayload.metrics,
      timestamp: record[0].timestamp,
    });

    return {
      valid: errors.length === 0,
      chain,
      errors,
    };
  }

  /**
   * Detect tampering in model history
   */
  async detectTampering(modelHistory: { id: string; roundId: string }[]): Promise<{
    tampered: boolean;
    alerts: string[];
  }> {
    const alerts: string[] = [];

    for (const model of modelHistory) {
      const result = await this.verifyProvenance(model.id);
      if (!result.valid) {
        alerts.push(`Model ${model.id}: ${result.errors.join(", ")}`);
      }
    }

    return {
      tampered: alerts.length > 0,
      alerts,
    };
  }

  /**
   * Get full provenance chain for a model
   */
  async getProvenanceChain(modelId: string): Promise<FLProvenanceRecord[]> {
    const chain: FLProvenanceRecord[] = [];

    // Get model
    const model = await db.select().from(flModelVersion).where(eq(flModelVersion.id, modelId)).limit(1);

    if (!model[0]) {
      return [];
    }

    // Traverse chain backwards
    let currentId: string | null = modelId;
    while (currentId) {
      const currModel: any = await db.select().from(flModelVersion).where(eq(flModelVersion.id, currentId)).limit(1);

      if (!currModel[0]) break;

      // Get blockchain record
      const round = await db.select().from(flRound).where(eq(flRound.id, currModel[0].roundId)).limit(1);

      if (round[0]) {
        const record = await db
          .select()
          .from(blockchainLedger)
          .where(sql`${blockchainLedger.batchId} = ${`FL-ROUND-${round[0].roundNumber}`}`)
          .limit(1);

        if (record[0]) {
          const dataPayload = record[0].dataPayload as any;
          chain.push({
            id: record[0].id,
            roundId: round[0].id,
            modelId: currentId,
            modelHash: dataPayload.modelHash,
            previousHash: record[0].previousHash,
            currentHash: record[0].currentHash,
            participantNodes: dataPayload.participantNodes,
            aggregationMethod: dataPayload.aggregationMethod,
            dpParams: dataPayload.dpParams,
            metrics: dataPayload.metrics,
            timestamp: record[0].timestamp,
          });
        }
      }

      currentId = currModel[0].parentVersionId;
    }

    return chain.reverse();
  }

  /**
   * Compute SHA-256 hash
   */
  private computeHash(previousHash: string, data: any): string {
    const payload = JSON.stringify({
      previousHash,
      data,
    });

    return createHash("sha256").update(payload).digest("hex");
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const flBlockchainAudit = FLBlockchainAudit.getInstance();
