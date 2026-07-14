import { Deterministic } from "~/shared/utils/rng";
import { Amygdala } from "./amygdala";
import { Hippocampus } from "./hippocampus";
import { runCognitiveArena } from "./meta-evaluator";
import { MarketSimulator } from "../neural-memory/market-simulator";
import { IntentClassifier, type IntentResult } from "./intent-classifier";
import { ReflexTemplates } from "./reflex-templates";
import { analyzeEmotion, emotionToPrompt, type EmotionResult } from "../cognitive-swarm/emotion-recognition";
import { classifyRisk, type RiskLevel } from "../cognitive-swarm/ai-risk-classification";
import { selectBestPersonality, personalityToModifiers } from "../cognitive-swarm/adaptive-personality";
import { detectDomain, getRelevantKnowledge, generateCrossDomainInsight } from "../cognitive-swarm/cross-domain-learning";

export type BrainSource = "Amygdala" | "Hippocampus" | "PrefrontalCortex" | "Fallback";

export interface BrainAction {
  response: string;
  source: BrainSource;
  intent?: string;
  /** Thời gian định tuyến (ms) — phục vụ giám sát hiệu năng System 1 (<10ms). */
  latencyMs?: number;
}

/** Ngưỡng chống-lạc-đề: dưới mức này, KHÔNG dùng template thương mại. */
const LOW_CONFIDENCE = 0.35;
/** Ngưỡng tin cậy tối thiểu để bắn template System 1. */
const TEMPLATE_CONFIDENCE = 0.5;
/** Ngưỡng khớp semantic memory (giữ nguyên hành vi cũ). */
const SEMANTIC_THRESHOLD = 0.25;

export class BasalGanglia {
  /**
   * Action Selection Mechanism (đã tái thiết kế)
   * Phân luồng theo Ý ĐỊNH (intent) thay vì độ dài câu:
   *   L0 Boundary -> L1 Cache -> L2 Classify -> System1 (reflex/template)
   *   -> L4 Semantic -> System2 (Arena, CHỈ khi intent nặng) -> Fallback chống lạc đề.
   */
  public static async selectAction(
    botId: string,
    botName: string,
    prodName: string,
    price: string,
    query: string,
    userId?: string,
  ): Promise<BrainAction> {
    const t0 = performance.now();
    const done = (a: Omit<BrainAction, "latencyMs">): BrainAction => ({
      ...a,
      latencyMs: +(performance.now() - t0).toFixed(2),
    });

    // ── L0: BOUNDARY GUARD (Nguyên lý cực hạn) ──────────────────────────
    let q = query.trim();
    const qLen = q.length;
    if (qLen < 2) {
      return done({ response: `Dạ ${botName} nghe đây ạ, sếp cần em giúp gì không?`, source: "Amygdala", intent: "GREETING" });
    }
    if (qLen > 24000) q = q.slice(0, 24000) + "...";

    // ── L1: EMOTION RECOGNITION (System 1 Fast Path) ─────────────────────
    const emotionResult = analyzeEmotion(q);
    const emotionalPrefix = emotionToPrompt(emotionResult);

    // ── L2: RISK CLASSIFICATION (Safety Gate) ─────────────────────────────
    const risk = classifyRisk(query, "Rottra Local Inference");
    if (risk.level === "critical") {
      return done({
        response: "Câu hỏi này vượt quá ngưỡng an toàn. Em không thể trả lời. Sếp cần em hỗ trợ việc khác không ạ?",
        source: "PrefrontalCortex",
        intent: "SAFETY_BLOCK",
      });
    }

    // ── L4: INTENT CLASSIFICATION (đồng bộ, <1ms) ───────────────────────
    const intent: IntentResult = IntentClassifier.classify(q);
    const ctx = { botId, botName, prodName, price };

    // Bỏ qua phản xạ nhanh của BasalGanglia đối với GREETING để đi vào bộ lọc chào hỏi đặc thù có xoay vòng
    if (intent.intent === "GREETING") {
      return done({ response: "", source: "Fallback", intent: "GREETING" });
    }

    // ── L3: EPISODIC CACHE (nhanh nhất, in-memory) ──────────────────────
    const cached = Hippocampus.recallEpisodicMemory(botId, q);
    if (cached) return done({ response: cached, source: "Hippocampus", intent: "CACHE_HIT" });

    // ── ĐƯỜNG SYSTEM 1: phản xạ nhanh, TUYỆT ĐỐI không chạm LLM ──────────
    if (intent.system === "SYSTEM_1" && intent.confidence >= TEMPLATE_CONFIDENCE) {
      const emotionPolarity = emotionResult.sentiment.polarity;
      const baseProfile: any = {
        id: `dynamic_${botId}`,
        name: botName,
        openness: 0.6,
        conscientiousness: 0.8,
        extraversion: 0.4,
        agreeableness: 0.7,
        neuroticism: 0.2,
        formality: emotionResult.urgency === "critical" ? 0.9 : 0.7,
        verbosity: emotionResult.urgency === "critical" ? 0.8 : 0.6,
        humor: emotionResult.urgency === "critical" ? 0.1 : emotionPolarity === "positive" ? 0.4 : 0.2,
        empathy: emotionResult.suggestedResponse.empathy === "high" ? 0.9 : emotionPolarity === "negative" ? 0.8 : 0.5,
        assertiveness: 0.5,
        adaptationRate: 0.1,
        confidence: 0.7,
        interactionCount: 0,
        lastUpdated: Date.now(),
        expertise: { agriculture: 0.8 },
      };
      const personalityMods = personalityToModifiers(baseProfile);

      // 1a. Amygdala reflex (persona đặc biệt: chào hỏi / giá / phàn nàn)
      const reflex = Amygdala.triggerFastReflex(botId, botName, prodName, price, q, intent);
      if (reflex) {
        Hippocampus.storeEpisodicMemory(botId, q, reflex);
        return done({ response: `${personalityMods.prefix}${reflex}${personalityMods.suffix}`, source: "Amygdala", intent: intent.intent });
      }
      // 1b. Ngân hàng template đa dạng (author, thanks, farewell, navigation...)
      let tpl = ReflexTemplates.render(intent.intent, ctx);
      if (tpl) {
        Hippocampus.storeEpisodicMemory(botId, q, tpl);
        return done({ response: `${personalityMods.prefix}${tpl}${personalityMods.suffix}`, source: "Amygdala", intent: intent.intent });
      }
    }

    // ── L5: SEMANTIC MEMORY (TF-IDF, model đã cache trong RAM) ───────────
    const semantic = await Hippocampus.recallSemanticMemory(q);
    if (semantic && semantic.score > SEMANTIC_THRESHOLD) {
      Hippocampus.storeEpisodicMemory(botId, q, semantic.response);
      return done({ response: semantic.response, source: "Hippocampus", intent: intent.intent });
    }

    // L5.5: CROSS-DOMAIN LEARNING (Meta-harness transfer knowledge)
    const domainInfo = detectDomain(q);
    if (domainInfo.confidence > 0.3 && domainInfo.domain !== "agriculture") {
      const crossInsight = generateCrossDomainInsight(q);
      if (crossInsight) {
        Hippocampus.storeEpisodicMemory(botId, q, crossInsight);
        return done({ response: crossInsight, source: "Hippocampus", intent: intent.intent });
      }
    }

    // ── L6: SYSTEM 2 NẶNG — CHỈ khi intent thực sự cần tính toán ─────────
    if (intent.system === "SYSTEM_2" && IntentClassifier.needsHeavyReasoning(intent.intent)) {
      try {
        const baseParams = { x: 12, y: 16, z: 6, v: 4.5, mass: 180, battery: 95, temp: 45, ram: 48 };
        const arena = await runCognitiveArena(q, intent.intent, baseParams, emotionalPrefix);
        if (arena?.response) {
          Hippocampus.storeEpisodicMemory(botId, q, arena.response);
          return done({ response: arena.response, source: "PrefrontalCortex", intent: intent.intent });
        }
      } catch {
        // Arena lỗi -> rơi xuống fallback nội sinh (KHÔNG bắn ra DuckDuckGo).
      }
    }

    // ── L7: FALLBACK NỘI SINH (chống lạc đề) ────────────────────────────
    const resp = await this.safeFallback(ctx, intent, q, userId, emotionResult);
    Hippocampus.storeEpisodicMemory(botId, q, resp);
    return done({ response: resp, source: "PrefrontalCortex", intent: intent.intent });
  }

  /**
   * Fallback an toàn:
   *  - Ngữ cảnh THƯƠNG MẠI rõ ràng (giá/sản phẩm/phàn nàn) -> template bán hàng.
   *  - Ý định KHÔNG rõ hoặc confidence thấp -> HỎI LẠI để làm rõ (không chào hàng lạc đề).
   */
  private static async safeFallback(
    ctx: { botId: string; botName: string; prodName: string; price: string },
    intent: IntentResult,
    q: string,
    userId?: string,
    emotionResult?: EmotionResult,
  ): Promise<string> {
    const commercial = new Set(["PRICE_QUERY", "PRODUCT_INFO", "COMPLAINT"]);

    let response: string;
    if (commercial.has(intent.intent) && intent.confidence >= LOW_CONFIDENCE) {
      response = this.commercialResponse(ctx, intent);
    } else {
      // SỰ NGU NGỐC BỊ LỘ RA: Khi AI không hiểu ý định hoặc confidence quá thấp.
      // Sếp dặn KHÔNG ĐƯỢC GIẤU DỐT. Ghi log sự thất bại này vào DPO Training Data thông qua SQLite Buffer.
      try {
        const SQLiteBuffer = require("../../infra/database/sqlite-buffer").SQLiteBuffer;
        SQLiteBuffer.push("dpoTrainingData", {
          id: `dpo-fail-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          prompt: q,
          chosenResponse: "", // Cần con người hoặc AI cấp cao điền vào sau
          rejectedResponse: intent.intent, // Cái AI nghĩ sai
          metadata: { botId: ctx.botId, confidence: intent.confidence, error: "STUPIDITY_EXPOSED" },
        });
      } catch (e) {
        // Ignore if buffer not initialized
      }

      // Ý định lạ / confidence thấp -> làm rõ, tuyệt đối KHÔNG bịa hay chào hàng.
      response = this.clarify(ctx.botName, q);
    }

    // Emotion-aware personalization
    if (emotionResult) {
      const style = emotionResult.suggestedResponse;
      if (style.empathy === "high") {
        response = `Em hiểu cảm xúc của sếp. ${response}`;
      } else if (style.tone === "enthusiastic") {
        response = `Tuyệt vời! ${response}`;
      } else if (style.tone === "apologetic") {
        response = `Em xin lỗi. ${response}`;
      }
    }

    // Cá nhân hoá (giữ tính năng cũ): nhắc lại sở thích người dùng nếu có.
    if (userId && userId !== "guest") {
      const pref = await Hippocampus.getUserPreference(userId);
      if (pref) response += `\n\n(Nhân tiện, em nhớ sếp dặn: "${pref}" ạ!)`;
    }
    return response;
  }

  /** Phản hồi thương mại (giữ Chrono-Cognition + giá động của bản cũ). */
  private static commercialResponse(ctx: { prodName: string; price: string; botName: string }, intent: IntentResult): string {
    const dynamicPrice = MarketSimulator.getDynamicPrice(ctx.prodName);
    const priceStr = new Intl.NumberFormat("vi-VN").format(dynamicPrice);
    const tpl = ReflexTemplates.render(intent.intent, { ...ctx, price: priceStr });
    if (tpl) return tpl;
    return `Dạ về ${ctx.prodName}, hiện giá tốt là ${priceStr}₫ ạ. Sếp cần em tư vấn thêm chi tiết nào không ạ?`;
  }

  /** Phản hồi "làm rõ" — bám sát câu hỏi, không lạc đề, không bịa. */
  private static clarify(botName: string, q: string): string {
    const topic = q.length > 60 ? q.slice(0, 60).trim() + "..." : q.trim();
    const variants = [
      `Dạ về "${topic}", em muốn hiểu đúng ý sếp trước khi trả lời. Sếp cho em thêm 1–2 chi tiết cụ thể được không ạ?`,
      `Em chưa đủ dữ kiện để trả lời thật chính xác về "${topic}". Sếp mô tả rõ hơn giúp em nhé, em không muốn trả lời qua loa ạ.`,
      `Câu "${topic}" của sếp khá rộng. Sếp đang cần em TÍNH TOÁN, TRA CỨU hay GIẢI THÍCH ạ?`,
    ];
    return variants[Math.floor(Deterministic.random() * variants.length)];
  }
}
