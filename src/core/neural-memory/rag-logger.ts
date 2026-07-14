import fs from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export interface RAGTrace {
  query: string;
  tenantId: string;
  startTime: number;
  retrieval?: {
    candidateCount: number;
    latencyMs: number;
  };
  rerank?: {
    topTitle: string;
    topScore: number;
    latencyMs: number;
  };
  verification?: {
    verified: boolean;
    confidence: number;
    reason: string;
    latencyMs: number;
  };
  fusion?: {
    attentionMap: { docTitle: string; weight: number }[];
    contextLength: number;
  };
  overallLatencyMs?: number;
  timestamp: string;
}

export class RAGLogger {
  private static logPath = path.resolve(process.cwd(), "rag-observability.log");

  /**
   * Starts a new RAG execution trace
   */
  static startTrace(query: string, tenantId?: string | null): RAGTrace {
    return {
      query,
      tenantId: tenantId || "Global",
      startTime: Date.now(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Logs candidate retrieval statistics
   */
  static logRetrieval(trace: RAGTrace, candidateCount: number) {
    trace.retrieval = {
      candidateCount,
      latencyMs: Date.now() - trace.startTime,
    };
  }

  /**
   * Logs reranker phase details
   */
  static logRerank(trace: RAGTrace, topTitle: string, topScore: number, startTime: number) {
    trace.rerank = {
      topTitle,
      topScore,
      latencyMs: Math.max(0, Date.now() - startTime),
    };
  }

  /**
   * Logs LLM verification/filtering details
   */
  static logVerification(trace: RAGTrace, verified: boolean, confidence: number, reason: string, startTime: number) {
    trace.verification = {
      verified,
      confidence,
      reason,
      latencyMs: Math.max(0, Date.now() - startTime),
    };
  }

  /**
   * Logs self-attention fusion maps and final context size
   */
  static logFusion(trace: RAGTrace, attentionMap: { docTitle: string; weight: number }[], contextLength: number) {
    trace.fusion = {
      attentionMap,
      contextLength,
    };
  }

  /**
   * Flushes the finished trace to the rag-observability.log file
   */
  static finishTrace(trace: RAGTrace) {
    trace.overallLatencyMs = Date.now() - trace.startTime;

    const logEntry =
      JSON.stringify({
        timestamp: trace.timestamp,
        query: trace.query,
        tenantId: trace.tenantId,
        overallLatencyMs: trace.overallLatencyMs,
        retrieval: trace.retrieval,
        rerank: trace.rerank,
        verification: trace.verification,
        fusion: trace.fusion,
      }) + "\n";

    try {
      appendFile(this.logPath, logEntry, "utf8").catch((err) => {
        console.error("[RAG OBSERVABILITY] Failed to write trace to file:", err.message);
      });
      console.log(`[RAG OBSERVABILITY] Trace queued to ${this.logPath} (Latency: ${trace.overallLatencyMs}ms)`);
    } catch (err: any) {
      console.error("[RAG OBSERVABILITY] Failed to queue trace to file:", err.message);
    }
  }
}
