import { classifyIntent, ClassificationResult } from "~/core/nlp-cognitive/tokenizer";
import { hybridRetrieve } from "~/core/neural-memory/vector-rag";
import { advancedRAG, advancedGraphRAG } from "~/core/neural-memory/advanced-rag";
import { guardrails } from "~/core/neural-memory/guardrails";
import { promptRegistry } from "~/core/nlp-cognitive/prompt-registry";
import { selfCorrection } from "~/core/nlp-cognitive/self-correction";

export interface CognitiveContext {
  sessionId: string;
  intent: string;
  confidence: number;
  method: ClassificationResult["classificationMethod"];
  tokensUsed?: number;
}

export interface CognitiveResponse {
  reply: string;
  context: CognitiveContext;
  sources?: string[];
  confidence: number;
}

class CognitiveCore {
  private static instance: CognitiveCore;

  private constructor() {}

  static getInstance(): CognitiveCore {
    if (!CognitiveCore.instance) {
      CognitiveCore.instance = new CognitiveCore();
    }
    return CognitiveCore.instance;
  }

  async process(query: string, sessionId: string = "default"): Promise<CognitiveResponse> {
    let classification = await classifyIntent(query);
    classification = selfCorrection.applyCorrection(query, classification);

    const context: CognitiveContext = {
      sessionId,
      intent: classification.intent,
      confidence: classification.confidence,
      method: classification.classificationMethod,
    };

    if (classification.confidence < 0.3) {
      return {
        reply: "Xin lỗi, tôi chưa hiểu rõ câu hỏi. Bạn vui lòng diễn đạt lại được không?",
        context,
        sources: [],
        confidence: 0,
      };
    }

    const cachedPrompt = promptRegistry.render(classification.intent, {});
    if (cachedPrompt.text) {
      return {
        reply: cachedPrompt.text,
        context,
        sources: [],
        confidence: classification.confidence,
      };
    }

    const inputGuard = guardrails.checkInput(query);
    if (guardrails.isBlocked(inputGuard)) {
      return {
        reply: `Xin lỗi, tôi không thể xử lý yêu cầu này. ${inputGuard[0]?.reason || "Nội dung không phù hợp."}`,
        context,
        sources: [],
        confidence: 0,
      };
    }

    const isComplexQuery = query.split(/\s+/).length >= 8 || /(và|còn|đồng thời|so sánh|tại sao|làm thế nào)/i.test(query);

    let reply: string;
    let sources: string[] = [];
    let confidence = classification.confidence;

    if (isComplexQuery) {
      const advancedResult = await advancedRAG(query, {
        useHyde: true,
        useStepBack: true,
        useDecomposition: true,
        useContextual: true,
        topK: 3,
      });

      if (advancedResult.reranked.length > 0) {
        reply = advancedResult.finalAnswer;
        sources = advancedResult.reranked.map((r) => r.doc.item.title);
        confidence = Math.max(confidence, advancedResult.reranked[0]?.rerankScore ?? 0.5);
      } else {
        const candidates = await hybridRetrieve(query, 3);
        if (candidates.length > 0) {
          const bestCandidate = candidates[0];
          confidence = Math.max(confidence, bestCandidate.hybridScore ?? 0.5);
          sources = candidates.map((c) => c.doc.item.title);
          reply = `Dựa trên kiến thức "${bestCandidate.doc.item.title}":\n\n${bestCandidate.doc.item.definition}`;
        } else {
          reply = "Không tìm thấy thông tin liên quan.";
        }
      }
    } else {
      const candidates = await hybridRetrieve(query, 3);
      const bestCandidate = candidates.length > 0 ? candidates[0] : null;

      if (bestCandidate) {
        confidence = Math.max(confidence, bestCandidate.hybridScore ?? 0.5);
        sources = candidates.map((c) => c.doc.item.title);
        reply = `Dựa trên kiến thức "${bestCandidate.doc.item.title}":\n\n${bestCandidate.doc.item.definition}`;
      } else {
        reply = "Không tìm thấy thông tin liên quan.";
      }
    }

    const outputGuard = guardrails.checkOutput(reply);
    reply = guardrails.sanitize(reply, outputGuard);

    context.confidence = Math.min(1, confidence);

    return {
      reply,
      context,
      sources,
      confidence: context.confidence,
    };
  }
}

export const cognitiveCore = CognitiveCore.getInstance();
