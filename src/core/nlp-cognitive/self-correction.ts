import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";
import { ClassificationResult } from "~/core/nlp-cognitive/tokenizer";
import { db } from "~/infra/database/db-pool";
import { agentMemory } from "~/infra/database/schema";
import { eq, and } from "drizzle-orm";

interface FeedbackEntry {
  query: string;
  predictedIntent: string;
  correctIntent: string;
  confidence: number;
}

import { TinyNeuralNet } from "./tiny-neural-net";

export class SelfCorrectionEngine {
  private static instance: SelfCorrectionEngine;
  private feedbackCache: LRUCache<string, FeedbackEntry>;
  private correctionMap: Map<string, string>;
  public certaintyNet: TinyNeuralNet;

  private constructor() {
    this.feedbackCache = new LRUCache<string, FeedbackEntry>(100);
    this.correctionMap = new Map<string, string>();
    // Input: 3 features (word count, initial confidence, string length)
    // Hidden: 4 nodes
    // Output: 1 node (certainty probability)
    this.certaintyNet = new TinyNeuralNet(3, 4, 1);
  }

  static getInstance(): SelfCorrectionEngine {
    if (!SelfCorrectionEngine.instance) {
      SelfCorrectionEngine.instance = new SelfCorrectionEngine();
      SelfCorrectionEngine.instance.syncToServer().catch(console.error);
      SelfCorrectionEngine.instance.loadWeightsFromDb().catch(console.error);
    }
    return SelfCorrectionEngine.instance;
  }

  async recordCorrection(query: string, predicted: string, correct: string): Promise<void> {
    const key = query.trim().toLowerCase();
    const entry: FeedbackEntry = {
      query,
      predictedIntent: predicted,
      correctIntent: correct,
      confidence: 1.0,
    };
    this.feedbackCache.set(key, entry);
    this.correctionMap.set(key, correct);

    // Save to database
    try {
      const sessionId = "self_correction_session";
      const contextKey = `self_correction:${key}`;

      const existing = await db.query.agentMemory.findFirst({
        where: eq(agentMemory.contextKey, contextKey),
      });

      if (existing) {
        await db
          .update(agentMemory)
          .set({
            contextValue: entry as any,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agentMemory.id, existing.id));
      } else {
        await db.insert(agentMemory).values({
          id: crypto.randomUUID(),
          sessionId,
          contextKey,
          contextValue: entry as any,
          importanceScore: 5,
        });
      }
    } catch (err) {
      console.error("Failed to persist self correction to database:", err);
    }
  }

  applyCorrection(query: string, classification: ClassificationResult): ClassificationResult {
    const key = query.trim().toLowerCase();
    const correctIntent = this.getCorrection(key);
    if (correctIntent) {
      return {
        ...classification,
        intent: correctIntent,
        confidence: 1.0,
      };
    }
    return classification;
  }

  // Phương thức dùng Neural Net mini đánh giá sự phân vân và tự học giảm entropy
  async evaluateAndLearnCertainty(query: string, initialConfidence: number): Promise<number> {
    const wordCount = Math.min(1.0, query.split(/\s+/).length / 20.0); // scale 0-1
    const lenScore = Math.min(query.length / 100.0, 1.0);
    const features = [[wordCount, initialConfidence, lenScore]];

    // Lan truyền tiến: Dự đoán độ tin cậy (Cong xác suất lớp 1)
    const prediction = this.certaintyNet.predict(features)[0][0];

    // Học: Nếu AI đang phân vân (xác suất ~0.5), ta cung cấp nhãn ảo để nó học cách tự tin hơn
    // trong lần sau (giảm loss gradient về 0)
    if (prediction > 0.4 && prediction < 0.7) {
      // Nhãn ảo: Nếu độ tin cậy gốc > 0.6 thì coi là tự tin (1), ngược lại thiếu dữ kiện (0)
      const targetLabel = initialConfidence > 0.6 ? 1.0 : 0.0;
      this.certaintyNet.train(features, [[targetLabel]], 10, 0.1);
      this.saveWeightsToDb().catch(console.error);
    }

    return prediction;
  }

  getCorrection(query: string): string | undefined {
    const key = query.trim().toLowerCase();
    return this.correctionMap.get(key);
  }

  async syncToServer(): Promise<void> {
    try {
      const records = await db.query.agentMemory.findMany({
        where: eq(agentMemory.sessionId, "self_correction_session"),
      });
      for (const record of records) {
        if (record.contextValue) {
          const entry = record.contextValue as any as FeedbackEntry;
          if (entry && entry.query && entry.correctIntent) {
            const key = entry.query.trim().toLowerCase();
            this.correctionMap.set(key, entry.correctIntent);
            this.feedbackCache.set(key, entry);
          }
        }
      }
      console.log(`Synced ${records.length} self-corrections from server.`);
    } catch (err) {
      console.error("Failed to sync self-corrections from server:", err);
    }
  }

  async loadWeightsFromDb(): Promise<void> {
    try {
      const record = await db.query.agentMemory.findFirst({
        where: and(eq(agentMemory.sessionId, "global"), eq(agentMemory.contextKey, "certainty_net_weights")),
      });
      if (record && record.contextValue) {
        this.certaintyNet.importWeights(record.contextValue);
        console.log("Successfully loaded certaintyNet weights from database.");
      }
    } catch (err) {
      console.error("Failed to load certaintyNet weights from database:", err);
    }
  }

  async saveWeightsToDb(): Promise<void> {
    try {
      const weights = this.certaintyNet.exportWeights();
      const existing = await db.query.agentMemory.findFirst({
        where: and(eq(agentMemory.sessionId, "global"), eq(agentMemory.contextKey, "certainty_net_weights")),
      });
      if (existing) {
        await db
          .update(agentMemory)
          .set({
            contextValue: weights as any,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agentMemory.id, existing.id));
      } else {
        await db.insert(agentMemory).values({
          id: "certainty_net_weights",
          sessionId: "global",
          contextKey: "certainty_net_weights",
          contextValue: weights as any,
          importanceScore: 10,
        });
      }
      console.log("Successfully saved certaintyNet weights to database.");
    } catch (err) {
      console.error("Failed to save certaintyNet weights from database:", err);
    }
  }
}

export const selfCorrection = SelfCorrectionEngine.getInstance();
