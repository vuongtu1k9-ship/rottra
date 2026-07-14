import { cognitiveCore, type CognitiveContext, type CognitiveResponse } from "~/core/agent-core";
import { hybridRetrieve, guardrails } from "~/core/agent-core/rag";
import { generateTextLocal } from "~/core/agent-core/llm";

export interface PipelineRequest {
  query: string;
  sessionId: string;
  userId?: string;
  role?: string;
  lang?: string;
  context?: Record<string, any>;
}

export interface PipelineResponse {
  success: boolean;
  reply: string;
  context: CognitiveContext;
  sources: string[] | undefined;
  confidence: number;
  source: string;
  latencyMs: number;
  needsClarification: boolean | undefined;
  clarificationOptions: string[] | undefined;
}

export interface PipelineStage {
  name: string;
  startTime: number;
  endTime: number | undefined;
  metadata: Record<string, any> | undefined;
}

export class ChatPipeline {
  private stages: PipelineStage[] = [];

  async process(request: PipelineRequest): Promise<PipelineResponse> {
    const startTime = performance.now();
    this.stages = [];

    this.addStage("pipeline_start");

    try {
      const result = await cognitiveCore.process(request.query, request.sessionId);
      this.addStage("agent_core_complete");

      const latencyMs = Math.round(performance.now() - startTime);

      return {
        success: true,
        reply: result.reply,
        context: result.context,
        sources: result.sources,
        confidence: result.confidence,
        source: "ROTTRA_PIPELINE",
        latencyMs,
        needsClarification: result.needsClarification,
        clarificationOptions: result.clarificationOptions,
      };
    } catch (error: any) {
      this.addStage("pipeline_error", { error: error.message });
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        success: false,
        reply: "Xin lỗi, hệ thống gặp sự cố. Vui lòng thử lại sau.",
        context: {
          sessionId: request.sessionId,
          intent: "ERROR",
          confidence: 0,
          method: "FALLBACK_SEARCH",
        },
        confidence: 0,
        source: "ROTTRA_PIPELINE_ERROR",
        latencyMs,
        sources: undefined,
        needsClarification: undefined,
        clarificationOptions: undefined,
      };
    }
  }

  private addStage(name: string, metadata?: Record<string, any>) {
    this.stages.push({
      name,
      startTime: performance.now(),
      endTime: undefined,
      metadata,
    });
  }

  getStages(): PipelineStage[] {
    return this.stages.map((s) => ({
      ...s,
      endTime: s.endTime ?? performance.now(),
    }));
  }
}

export const chatPipeline = new ChatPipeline();
