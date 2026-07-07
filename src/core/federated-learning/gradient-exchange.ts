/**
 * 🧠 ROTTRA — GRADIENT EXCHANGE
 * Handles secure gradient submission and model download.
 * Uses agent_message_queue for communication.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { flGradientUpdate, flRound, flNode } from "~/infra/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { flCoordinator } from "./coordinator";
import type { EncryptedPayload, GradientUpdate, ModelWeights, FLNode } from "./types";

// ── Gradient Exchange Class ──────────────────────────────────

export class GradientExchange {
  private nodeId: string;
  private nodeName: string;

  constructor(nodeId: string, nodeName: string) {
    this.nodeId = nodeId;
    this.nodeName = nodeName;
  }

  /**
   * Register this node with the coordinator
   */
  async registerNode(farmId?: string): Promise<FLNode> {
    const existing = await db.select().from(flNode).where(eq(flNode.id, this.nodeId)).limit(1);

    if (existing[0]) {
      // Update last seen
      await db.update(flNode).set({ last_seen: new Date() }).where(eq(flNode.id, this.nodeId));

      return existing[0] as FLNode;
    }

    // Create new node
    const publicKey = await this.generateKeyPair();

    await db.insert(flNode).values({
      id: this.nodeId,
      node_name: this.nodeName,
      farm_id: farmId || null,
      public_key: publicKey,
      last_seen: new Date(),
      totalRoundsParticipated: 0,
      reputation_score: 1.0,
    });

    console.log(`[GradientExchange] Node ${this.nodeName} registered (${this.nodeId})`);

    return {
      id: this.nodeId,
      nodeName: this.nodeName,
      farmId: farmId || null,
      publicKey,
      lastSeen: new Date(),
      totalRoundsParticipated: 0,
      reputationScore: 1.0,
    };
  }

  /**
   * Submit gradients to coordinator
   */
  async submitGradients(
    roundId: string,
    gradients: Float32Array[],
    metrics: { localLoss: number; localAccuracy: number; dataSampleCount: number },
  ): Promise<{ accepted: boolean; message: string }> {
    // Encrypt gradients
    const encryptedGradients = await this.encryptGradients(gradients);

    // Submit to coordinator
    const result = await flCoordinator.submitGradient(roundId, this.nodeId, encryptedGradients, metrics);

    if (result.accepted) {
      // Update node participation count
      await db
        .update(flNode)
        .set({
          totalRoundsParticipated: sql`${flNode.totalRoundsParticipated} + 1`,
          last_seen: new Date(),
        })
        .where(eq(flNode.id, this.nodeId));
    }

    return result;
  }

  /**
   * Get global model from coordinator
   */
  async getGlobalModel(): Promise<{ modelId: string; weights: ModelWeights } | null> {
    const model = await flCoordinator.getGlobalModel();

    if (!model) {
      console.log(`[GradientExchange] No global model available`);
      return null;
    }

    // Update node last seen
    await db.update(flNode).set({ last_seen: new Date() }).where(eq(flNode.id, this.nodeId));

    return model as { modelId: string; weights: ModelWeights };
  }

  /**
   * Check round status
   */
  async checkRoundStatus(roundId: string): Promise<string> {
    const round = await db.select({ status: flRound.status }).from(flRound).where(eq(flRound.id, roundId)).limit(1);

    return round[0]?.status || "unknown";
  }

  /**
   * Get available rounds for participation
   */
  async getAvailableRounds(): Promise<{ roundId: string; roundNumber: number; status: string }[]> {
    const rounds = await db
      .select({
        roundId: flRound.id,
        roundNumber: flRound.roundNumber,
        status: flRound.status,
      })
      .from(flRound)
      .where(eq(flRound.status, "collecting"));

    return rounds.map((r: any) => ({
      roundId: r.roundId,
      roundNumber: r.roundNumber,
      status: r.status,
    }));
  }

  /**
   * Encrypt gradients for secure transmission
   */
  private async encryptGradients(gradients: Float32Array[]): Promise<EncryptedPayload> {
    // Convert to buffer
    const buffers = gradients.map((g) => Buffer.from(g.buffer));
    const combined = Buffer.concat(buffers);

    // Simple XOR encryption (in production, use proper encryption)
    const key = await this.getEncryptionKey();
    const encrypted = Buffer.alloc(combined.length);
    for (let i = 0; i < combined.length; i++) {
      encrypted[i] = combined[i] ^ key[i % key.length];
    }

    return {
      data: encrypted.toString("base64"),
      algorithm: "xor-v1",
      iv: randomUUID(),
      keyId: this.nodeId,
    };
  }

  /**
   * Decrypt gradients
   */
  async decryptGradients(encrypted: EncryptedPayload): Promise<Float32Array[]> {
    const key = await this.getEncryptionKey();
    const encryptedBuffer = Buffer.from(encrypted.data, "base64");

    // XOR decrypt
    const decrypted = Buffer.alloc(encryptedBuffer.length);
    for (let i = 0; i < encryptedBuffer.length; i++) {
      decrypted[i] = encryptedBuffer[i] ^ key[i % key.length];
    }

    // Split back into individual gradient arrays
    // Note: In real implementation, would need to track shapes
    const gradients: Float32Array[] = [];
    const floatSize = 4; // 32-bit float
    const numArrays = Math.ceil(decrypted.length / (1000 * floatSize)); // Assume ~1000 elements per array

    for (let i = 0; i < numArrays; i++) {
      const start = i * 1000 * floatSize;
      const end = Math.min(start + 1000 * floatSize, decrypted.length);
      const slice = decrypted.subarray(start, end);
      gradients.push(new Float32Array(slice.buffer));
    }

    return gradients;
  }

  /**
   * Get encryption key
   */
  private async getEncryptionKey(): Promise<Buffer> {
    // Simple key derivation (in production, use proper key management)
    const { createHash } = await import("crypto");
    return createHash("sha256").update(`fl-key-${this.nodeId}`).digest();
  }

  /**
   * Generate key pair for node
   */
  private async generateKeyPair(): Promise<string> {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(`pubkey-${this.nodeId}-${Date.now()}`).digest("hex");
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createGradientExchange(nodeId: string, nodeName: string): GradientExchange {
  return new GradientExchange(nodeId, nodeName);
}
