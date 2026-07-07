/**
 * 🧠 GRAPH-SDM HYBRID AI ENGINE
 *
 * Kiến trúc kết hợp 3 cơ chế:
 * 1. SDM Engine — Auto-associative recall, partial match, generalization
 * 2. Knowledge Graph — Semantic relationships, explainable context
 * 3. Hybrid Orchestrator — Weighted combination + quality scoring
 *
 * Flow:
 *   User Query
 *     ├──→ SDM Recall (find similar patterns, score)
 *     ├──→ Graph Context (traverse relationships, gather context)
 *     └──→ Combine & Rank → Response
 *
 * Không cần Transformer. Không cần GPU. Chạy trên CPU thường.
 */

import { SDMEngine } from "./sdm-engine";
import { KnowledgeGraph } from "./knowledge-graph";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MODEL_DIR = join(process.cwd(), "finetune", "data");
const HYBRID_MODEL_PATH = join(MODEL_DIR, "graph_sdm_hybrid.json");

interface HybridResponse {
  text: string;
  confidence: number;
  source: "sdm" | "graph" | "combined" | "fallback";
  matchedPatterns: number;
  graphContextSize: number;
  responseTime: number;
}

interface TrainingSample {
  utterance: string;
  response: string;
  intent: string;
}

/**
 * Hybrid AI Engine
 */
export class GraphSDMHybrid {
  private sdm: SDMEngine;
  private kg: KnowledgeGraph;
  private ready = false;
  private trainingStats = { patterns: 0, graphNodes: 0, graphEdges: 0 };

  constructor() {
    this.sdm = new SDMEngine(512); // 512 hard locations
    this.kg = new KnowledgeGraph();
  }

  /**
   * Khởi tạo: load model hoặc train mới
   */
  async initialize(): Promise<void> {
    if (existsSync(HYBRID_MODEL_PATH)) {
      try {
        const data = JSON.parse(readFileSync(HYBRID_MODEL_PATH, "utf-8"));
        this.sdm.import(data.sdm);
        this.kg.import(data.kg);
        this.trainingStats = data.stats || {};
        this.ready = true;
        console.log(`[Graph-SDM] Loaded: ${this.trainingStats.patterns} patterns, ${this.trainingStats.graphNodes} nodes`);
        return;
      } catch (e: any) {
        console.warn(`[Graph-SDM] Failed to load model, retraining: ${e.message}`);
      }
    }

    await this.trainFromDataset();
    this.ready = true;
  }

  /**
   * Train từ training data
   */
  async trainFromDataset(): Promise<void> {
    console.log("[Graph-SDM] Training from dataset...");

    // Load domain training data
    try {
      const { ALL_DOMAIN_TRAINING_PAIRS } = await import("./domain-training-data");
      const samples: TrainingSample[] = ALL_DOMAIN_TRAINING_PAIRS.map((p: any) => ({
        utterance: p.utterance,
        response: p.answer,
        intent: p.intent,
      }));

      this.ingest(samples);
    } catch (e: any) {
      console.warn(`[Graph-SDM] Failed to load training data: ${e.message}`);
    }

    // Also load extra training data if available
    try {
      const fs = await import("fs");
      const extraPath = join(MODEL_DIR, "extra_training_data.jsonl");
      if (fs.existsSync(extraPath)) {
        const lines = fs.readFileSync(extraPath, "utf-8").split("\n").filter(Boolean);
        const extraSamples: TrainingSample[] = [];
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const msgs = parsed.messages;
            if (msgs && msgs.length >= 3) {
              extraSamples.push({
                utterance: msgs[1].content,
                response: msgs[2].content,
                intent: "CONVERSATIONAL",
              });
            }
          } catch {}
        }
        this.ingest(extraSamples);
        console.log(`[Graph-SDM] Ingested ${extraSamples.length} extra samples`);
      }
    } catch {}

    // Save model
    this.save();
    console.log(`[Graph-SDM] Training complete: ${this.trainingStats.patterns} patterns, ${this.trainingStats.graphNodes} nodes`);
  }

  /**
   * Ingest batch training data
   */
  ingest(samples: TrainingSample[]): void {
    let patternCount = 0;

    for (const sample of samples) {
      // 1. Add to SDM
      this.sdm.addPattern(sample.utterance, sample.response, sample.intent);
      patternCount++;

      // 2. Add to Knowledge Graph
      this.kg.extractAndConnect(sample.utterance, sample.intent);
    }

    this.trainingStats.patterns = this.sdm.getStats().totalPatterns;
    const kgStats = this.kg.getStats();
    this.trainingStats.graphNodes = kgStats.totalNodes;
    this.trainingStats.graphEdges = kgStats.totalEdges;
  }

  /**
   * Main inference: Query → Response
   */
  async query(userQuery: string): Promise<HybridResponse> {
    const startTime = Date.now();

    if (!this.ready) {
      await this.initialize();
    }

    // Step 1: SDM Recall
    const sdmResults = this.sdm.findBestMatch(userQuery);
    const sdmScore = sdmResults?.score || 0;
    const sdmResponse = sdmResults?.pattern?.metadata?.response || null;

    // Step 2: Graph Context
    const graphResults = this.kg.search(userQuery, 5);
    let graphContext = "";
    let graphScore = 0;

    if (graphResults.length > 0) {
      const bestMatch = graphResults[0];
      const context = this.kg.graphAttention(bestMatch.node.id, 2, 10, 0.6);
      graphScore = bestMatch.score;

      // Extract response from graph context if available
      const responseNodes = context.nodes.filter((n) => n.type === "response");
      if (responseNodes.length > 0) {
        graphContext = responseNodes[0].attributes?.fullResponse || responseNodes[0].label;
      } else {
        // Build context from entity nodes
        const entityNodes = context.nodes.filter((n) => n.type === "entity");
        graphContext = entityNodes.map((n) => n.label).join(", ");
      }
    }

    // Step 3: Combine & Decide
    let finalResponse = "";
    let source: HybridResponse["source"] = "fallback";
    let confidence = 0;

    const WEIGHT_SDM = 0.6;
    const WEIGHT_GRAPH = 0.4;

    const combinedScore = sdmScore * WEIGHT_SDM + graphScore * WEIGHT_GRAPH;

    if (sdmScore > 0.6 && sdmResponse) {
      // High confidence SDM match — use directly
      finalResponse = sdmResponse;
      source = "sdm";
      confidence = sdmScore;
    } else if (graphScore > 0.5 && graphContext) {
      // High confidence graph match
      finalResponse = graphContext;
      source = "graph";
      confidence = graphScore;
    } else if (combinedScore > 0.4) {
      // Combined match — merge SDM + graph context
      if (sdmResponse && graphContext) {
        // Prefer SDM response, supplement with graph context
        finalResponse = sdmResponse;
        if (graphContext.length > 20 && !sdmResponse.includes(graphContext.substring(0, 20))) {
          finalResponse += `\n\n📌 *Thêm thông tin: ${graphContext}*`;
        }
      } else {
        finalResponse = sdmResponse || graphContext;
      }
      source = "combined";
      confidence = combinedScore;
    } else {
      // Fallback: generic response
      finalResponse = this.generateFallback(userQuery);
      source = "fallback";
      confidence = Math.max(sdmScore, graphScore);
    }

    const responseTime = Date.now() - startTime;

    return {
      text: finalResponse,
      confidence: Math.min(confidence * 100, 100),
      source,
      matchedPatterns: sdmResults ? 1 : 0,
      graphContextSize: graphContext ? 1 : 0,
      responseTime,
    };
  }

  /**
   * Auto-learn: Thêm pattern mới từ interaction
   */
  learn(utterance: string, response: string, intent: string = "LEARNED"): void {
    this.sdm.addPattern(utterance, response, intent);
    this.kg.extractAndConnect(utterance, intent);

    this.trainingStats.patterns = this.sdm.getStats().totalPatterns;
    const kgStats = this.kg.getStats();
    this.trainingStats.graphNodes = kgStats.totalNodes;
    this.trainingStats.graphEdges = kgStats.totalEdges;
  }

  /**
   * Save model to disk
   */
  save(): void {
    try {
      const data = {
        sdm: this.sdm.export(),
        kg: this.kg.export(),
        stats: this.trainingStats,
        savedAt: Date.now(),
      };
      writeFileSync(HYBRID_MODEL_PATH, JSON.stringify(data));
      console.log(`[Graph-SDM] Model saved to ${HYBRID_MODEL_PATH}`);
    } catch (e: any) {
      console.error(`[Graph-SDM] Failed to save model: ${e.message}`);
    }
  }

  /**
   * Generic fallback response
   */
  private generateFallback(query: string): string {
    const qLower = query.toLowerCase();

    if (qLower.includes("xin chào") || qLower.includes("hello") || qLower.includes("chào")) {
      return "Chào bạn! Em là trợ lý AI Rottra, sẵn sàng hỗ trợ bạn về nông sản và thương mại điện tử. Bạn cần gì ạ? 😊";
    }
    if (qLower.includes("cảm ơn") || qLower.includes("thank")) {
      return "Không có gì bạn! Rất vui được hỗ trợ bạn. 😊";
    }
    if (qLower.includes("tạm biệt") || qLower.includes("bye")) {
      return "Tạm biệt bạn! Hẹn gặp lại bạn lần sau. 👋";
    }

    return "Mình hiểu bạn đang hỏi về vấn đề này. Để mình phân tích thêm và trả lời chi tiết hơn nhé! Bạn có thể cung cấp thêm thông tin không?";
  }

  /**
   * Thống kê hệ thống
   */
  getStats() {
    return {
      ready: this.ready,
      ...this.trainingStats,
      sdmStats: this.sdm.getStats(),
      kgStats: this.kg.getStats(),
    };
  }
}

/**
 * Singleton instance
 */
let hybridInstance: GraphSDMHybrid | null = null;

export async function getHybridEngine(): Promise<GraphSDMHybrid> {
  if (!hybridInstance) {
    hybridInstance = new GraphSDMHybrid();
    await hybridInstance.initialize();
  }
  return hybridInstance;
}
