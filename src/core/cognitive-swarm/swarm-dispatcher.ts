import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { checkSemanticCache } from "~/core/neural-memory/semantic-cache";
import { evaluateMathExpression, solveCustomAlgorithm } from "~/core/quant-engine/financial-solver";
import { filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import { DecodingSettings, defaultDecodingSettings, maxContextChunkWords } from "~/shared/constants";
import { hybridRetrieve, computeAttentionFusion } from "~/core/neural-memory/vector-rag";
import { advancedRAG } from "~/core/neural-memory/advanced-rag";
import { db, pgClient } from "~/infra/database/db-pool";
import { retrieveRelevantProducts, retrieveMarketNews } from "~/server/services/rag-retriever";
import { agentMemory, product, blockchainLedger, negotiationLog } from "~/infra/database/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { generateProductVideoAd } from "~/server/helpers/video-ad-generator";
import { skillRegistry, getSkillManual } from "~/core/cognitive-swarm/skills/skill-registry";
import { deOptimize, type DEConfig } from "~/core/meta-harness/differential-evolution";
import { cmaesOptimize, type CMAESConfig } from "~/core/meta-harness/cma-es";
import { evolvePopulation, initializePopulation, crossover, mutate, type AgentChromosome } from "~/core/meta-harness/genetic-algorithm";
import { psoOptimize, type PSOConfig } from "~/core/meta-harness/particle-swarm";
import { gwoOptimize, type GWOConfig } from "~/core/meta-harness/grey-wolf";
import { autoEADesign, benchmarkFunctions, type AutoEAConfig } from "~/core/meta-harness/llm-evolution";
import {
  createNegotiationSession,
  runNegotiation,
  type NegotiationAgent,
  type NegotiationStrategy,
} from "~/core/cognitive-swarm/multi-agent-negotiation";
import {
  generateGoalsFromSituation,
  executeGoal,
  evaluateGoalProgress,
  type Situation,
  type Goal,
} from "~/core/cognitive-swarm/autonomous-goal-setting";

export interface SelfPlayLog {
  round: number;
  seller: { id: string; name: string; updatedDna: any };
  buyer: { id: string; name: string; updatedDna: any };
  product: string;
  marketPrice: number;
  noisyPrice: number;
  denoisedPrice: number;
  predictedCost: number;
  actualCost: number;
  negotiation: {
    sellerOffer: number;
    buyerBid: number;
    finalizedPrice: number | null;
    success: boolean;
  };
  losses: {
    denoisingLoss: number;
    maskedPredictionLoss: number;
    contrastiveLoss: number;
  };
  schedulingInfo?: {
    scheduler: string;
    turnOwner: string;
    targetPartner: string;
  };
  deadlockStatus?: {
    lockedResources: string[];
    preemptionTriggered: boolean;
    resolution: string;
  };
}

export interface RottraAIChatOptions {
  botId: string;
  botName: string;
  prodName: string;
  price: string;
  lastMsgText: string;
  chatHistory: any[];
  systemPrompt: string;
  dynamicStatePrompt?: string;
  model?: string;
  decodingSettings?: DecodingSettings;
  // Dynamic market and database parity fields:
  phiPriceVal?: number;
  accuracyScore?: number;
  quantity?: number;
  budget?: number;
  goldReserves?: number;
  loanLimit?: number;
  goldPrice?: number;
  greed?: number;
  vengeance?: number;
  malice?: number;
}

export class RottraAI {
  static selectTargetAgent(agents: any[], criteria: string): any {
    if (!agents || agents.length === 0) return null;
    let sorted = [...agents];
    switch (criteria) {
      case "WEAKEST":
        sorted.sort((a, b) => ((a.profile as any)?.budget ?? 0) - ((b.profile as any)?.budget ?? 0));
        break;
      case "RICHEST":
        sorted.sort((a, b) => ((b.profile as any)?.budget ?? 0) - ((a.profile as any)?.budget ?? 0));
        break;
      case "LEAST_GOODS":
        sorted.sort((a, b) => Math.random() - 0.5);
        break;
    }
    return sorted[0];
  }

  static decideMarketAction(agentId: string, stateInfo: any) {
    const isAlphaStar = agentId === "toLuong";
    const greed = stateInfo.greed || 0.5;
    const price = stateInfo.marketPrice || 20;
    let action = 1; // Default BUY
    let stateObj = "NORMAL";
    if (price > 25 && greed > 0.6) {
      action = 2; // SELL
      stateObj = "HIGH_PRICE";
    } else if (price < 15) {
      action = 1; // BUY
      stateObj = "LOW_PRICE";
    } else if (Math.random() < 0.2) {
      action = 0; // HOLD
      stateObj = "UNCERTAIN";
    }
    return { action, isAlphaStar, stateObj };
  }

  static calculateTradeVolume(budget: number, price: number, risk: number, max: number): number {
    const affordable = Math.floor((budget * risk) / price);
    return Math.min(affordable, max);
  }

  static learnFromMarket(agentId: string, reward: number, lastState: string, lastAction: number, nextStateInfo: any): void {
    // Q-learning placeholder update
    // console.log(`[RottraAI] Agent ${agentId} learned from market. Reward: ${reward}, Action: ${lastAction}`);
  }

  static decideSabotage(attackerDna: any, victimDna: any, tension: number): boolean {
    const malice = attackerDna?.malice ?? 0.5;
    return malice * tension > 0.6;
  }

  static decideCyberDefense(victimInfo: any): boolean {
    const employees = victimInfo.employees || 0;
    return employees > 10 || Math.random() > 0.5;
  }

  static decideStockTrade(
    agentState: { greed: number; budget: number; ownedSymbols: string[] },
    stockQuotes: Record<string, any>,
  ): { action: "BUY" | "SELL" | "HOLD"; symbol?: string } {
    const symbols = Object.keys(stockQuotes);
    if (symbols.length === 0) return { action: "HOLD" };

    const roll = Math.random();
    if (roll < 0.3 && agentState.budget > 10000000) {
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      return { action: "BUY", symbol: randomSymbol };
    } else if (roll > 0.7 && agentState.ownedSymbols.length > 0) {
      const randomSymbol = agentState.ownedSymbols[Math.floor(Math.random() * agentState.ownedSymbols.length)];
      return { action: "SELL", symbol: randomSymbol };
    }
    return { action: "HOLD" };
  }

  /**
   * Cắt nhỏ văn bản thành các đoạn tối đa maxWords từ, ưu tiên phân tách bằng ranh giới câu.
   */
  static chunkText(text: string, maxWords: number): string[] {
    if (!text) return [];
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentWordsCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      if (currentWordsCount + sentenceWords > maxWords) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(" "));
          currentChunk = [];
          currentWordsCount = 0;
        }
        if (sentenceWords > maxWords) {
          const words = sentence.trim().split(/\s+/);
          for (let i = 0; i < words.length; i += maxWords) {
            chunks.push(words.slice(i, i + maxWords).join(" "));
          }
        } else {
          currentChunk.push(sentence.trim());
          currentWordsCount = sentenceWords;
        }
      } else {
        currentChunk.push(sentence.trim());
        currentWordsCount += sentenceWords;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }

  /**
   * Thang đo chất lượng câu thoại đàm phán thương mại (Scale 0-100)
   */
  static measureQuality(reply: string, botName: string): { score: number; feedback: string[] } {
    let score = 0;
    const feedback: string[] = [];

    // 1. Định dạng hội thoại (<verbal_strike>): 25 điểm
    const hasStrikeTag = /<verbal_strike>[\s\S]*?<\/verbal_strike>/i.test(reply);
    if (hasStrikeTag) {
      score += 25;
    } else {
      feedback.push("Thiếu thẻ định dạng hội thoại <verbal_strike>...</verbal_strike>");
    }

    // 2. Độ dài tối ưu (Khuyến nghị <= 3 câu và <= 60 từ): 25 điểm
    const sentenceCount = (reply.match(/[^.!?]+[.!?]*/g) || []).length;
    const wordCount = reply.trim().split(/\s+/).length;
    if (sentenceCount <= 3 && wordCount <= 60) {
      score += 25;
    } else {
      feedback.push(`Độ dài thoại quá dài dòng (${sentenceCount} câu, ${wordCount} từ)`);
    }

    // 3. Giọng điệu cá tính thương nhân: 25 điểm
    const botNameLower = botName.toLowerCase();
    let toneMatch = false;
    if (botNameLower.includes("lương")) {
      toneMatch = /lương|ta|bằng hữu|hiền hữu/i.test(reply);
    } else if (botNameLower.includes("cửu")) {
      toneMatch = /tiểu cửu|sếp|yêu|nha|dỗi|hihi/i.test(reply);
    } else if (botNameLower.includes("nguyệt")) {
      toneMatch = /nguyệt|lão phu|hiền hữu/i.test(reply);
    } else {
      toneMatch = /chào|sếp|bạn|huynh|tôi|ta/i.test(reply);
    }

    if (toneMatch) {
      score += 25;
    } else {
      feedback.push("Chưa thể hiện rõ cá tính và giọng điệu đặc trưng");
    }

    // 4. Chiêu bài tâm lý thương mại (Value First/FOMO/Khan hiếm): 25 điểm
    const negotiationKeywords = /(độc quyền|chất lượng|giá trị|xứng đáng|khan hiếm|hết hàng|chốt sớm|ưu đãi|giảm|bớt|hợp lý|giá gốc)/i;
    if (negotiationKeywords.test(reply)) {
      score += 25;
    } else {
      feedback.push("Thiếu yếu tố thuyết phục thương mại (Value First, FOMO hoặc Ưu đãi)");
    }

    return { score, feedback };
  }

  static async negotiationTreeOfThoughtsReasoning(options: RottraAIChatOptions): Promise<string> {
    const { botName, lastMsgText, systemPrompt, phiPriceVal, accuracyScore, quantity, budget } = options;
    console.log(`[TOT NEGOTIATION] Running Tree-of-Thoughts reasoning for ${botName}...`);

    // --- RAG INTEGRATION ---
    const [ragProducts, ragNews] = await Promise.all([
      retrieveRelevantProducts(lastMsgText || "", 3),
      retrieveMarketNews(lastMsgText || "", 2),
    ]);
    const ragContext =
      `[DỮ LIỆU RAG THỰC TẾ ĐỂ THAM KHẢO]:\n` +
      `- Sản phẩm liên quan trong kho: ${ragProducts.map((p: any) => p.name).join(", ") || "Không có"}\n` +
      `- Tin tức thị trường: ${ragNews.map((n: any) => n.title).join(" | ") || "Không có"}\n`;

    const marketConstraints = `
=== THÔNG TIN THỊ TRƯỜNG & RÀNG BUỘC CỦA BẠN ===
- Giá tối thiểu chấp nhận được (Φ_Price): ${phiPriceVal !== undefined ? phiPriceVal.toLocaleString() : "Không xác định"}₫
- Độ chính xác nét vẽ nông sản (Accuracy): ${accuracyScore !== undefined ? (accuracyScore * 100).toFixed(1) : "50"}%
- Số lượng tồn kho (Quantity): ${quantity !== undefined ? quantity : "Không rõ"} đơn vị
- Ngân sách hiện tại (Budget): ${budget !== undefined ? budget.toLocaleString() : "Không rõ"}₫
${ragContext}
=============================================`;

    const hasGoldKeywords = /vàng|vay\s+vàng|nợ\s+vàng|cho\s+vay\s+vàng/i.test(lastMsgText || "");
    const goldGuidelines = hasGoldKeywords
      ? `\nĐặc biệt đối phương đề xuất liên quan đến VAY/CHO VAY VÀNG:
- Thought 1 (Bảo vệ dự trữ vàng): Từ chối giao dịch vàng, ưu tiên bảo toàn trữ lượng vàng hiện có hoặc từ chối vay thêm để kiểm soát rủi ro.
- Thought 2 (Đầu cơ tích lũy vàng): Đồng ý Vay vàng từ đối phương để nâng trữ lượng vàng (phải có thẻ [ĐỒNG Ý VAY VÀNG: X lượng] ở cuối câu thoại).
- Thought 3 (Bán/Cho vay vàng): Đồng ý Cho đối phương vay vàng để hưởng lợi ích/mặt hàng khác (phải có thẻ [ĐỒNG Ý CHO VAY VÀNG: X lượng] ở cuối câu thoại).`
      : "";

    const generateBranchesPrompt = `Bạn là hệ thống tư duy Logic (Tree of Thoughts) đàm phán thương mại của ${botName}.
Dựa trên tin nhắn gần nhất của đối phương: "${lastMsgText}"
Và các ràng buộc thị trường sau:
${marketConstraints}

Hãy sinh ra chính xác 3 phương án chiến lược đàm phán (Thought 1, 2, 3) đáp ứng đầy đủ cá tính của nhân vật trong System Prompt dưới đây:
"${systemPrompt}"

Yêu cầu cụ thể cho mỗi phương án:${goldGuidelines}
- Thought 1 (Bảo vệ giá): Từ chối hoặc giảm cực ít để bảo vệ tối đa biên lợi nhuận, bám sát giá trị gốc, sử dụng các luận điểm thuyết phục về chất lượng sản phẩm từ nét vẽ whiteboard (${accuracyScore !== undefined ? (accuracyScore * 100).toFixed(1) : "50"}% accuracy).
- Thought 2 (Tấn công chủ động): Sử dụng mồi nhử/decoy, ép khách hàng tăng số lượng mua hoặc mua chéo sản phẩm khác trong danh sách phễu, tạo khan hiếm FOMO.
- Thought 3 (Thương lượng thực dụng): Đề xuất một mức giá thỏa hiệp trung gian, nhưng tuyệt đối KHÔNG ĐƯỢC thấp hơn giá tối thiểu Φ_Price (${phiPriceVal !== undefined ? phiPriceVal.toLocaleString() : "0"}₫). Nếu đối phương trả giá dưới Φ_Price, phương án này phải từ chối thẳng thừng.

Định dạng trả về chính xác:
=== THOUGHT 1 ===
[nội dung suy nghĩ phương án 1]
=== THOUGHT 2 ===
[nội dung suy nghĩ phương án 2]
=== THOUGHT 3 ===
[nội dung suy nghĩ phương án 3]`;

    const { text: branchesText } = await generateTextLocal({
      system: "You are an expert game-theoretic negotiator. Answer in Vietnamese.",
      prompt: generateBranchesPrompt,
      model: options.model,
      decodingSettings: options.decodingSettings,
      isInternalReasoning: true,
    });

    const evaluatePrompt = `Bạn là Trọng tài Đánh giá Logic Đàm phán.
Hãy phân tích và chấm điểm 3 phương án chiến lược sau của bot đàm phán thương mại:
${branchesText}

Tiêu chí chấm điểm (0-100):
1. Có tuân thủ tuyệt đối ràng buộc giá tối thiểu Φ_Price (${phiPriceVal !== undefined ? phiPriceVal.toLocaleString() : "0"}₫) hay không? (Nếu vi phạm hạ xuống dưới Φ_Price, điểm là 0).
2. Có thể hiện đúng cá tính thương nhân trong System Prompt hay không?
3. Tính thuyết phục, sắc sảo trong ngôn từ đàm phán thương mại.

Định dạng trả về chính xác như sau:
Thought 1 Score: [điểm]
Thought 2 Score: [điểm]
Thought 3 Score: [điểm]`;

    const { text: scoreText } = await generateTextLocal({
      system: "You are a quantitative scoring engine.",
      prompt: evaluatePrompt,
      model: options.model,
      decodingSettings: options.decodingSettings,
      isInternalReasoning: true,
    });

    console.log(`[TOT NEGOTIATION] Evaluator scores for ${botName}:\n${scoreText}`);

    // Parse scores and choose best thought
    let bestThought = 3;
    let maxScore = 0;

    const matches = scoreText.match(/Thought (\d) Score:\s*(\d+)/gi);
    if (matches) {
      matches.forEach((m) => {
        const parts = /Thought (\d) Score:\s*(\d+)/i.exec(m);
        if (parts) {
          const thoughtNum = parseInt(parts[1]);
          const score = parseInt(parts[2]);
          if (score > maxScore) {
            maxScore = score;
            bestThought = thoughtNum;
          }
        }
      });
    }

    console.log(`[TOT NEGOTIATION] Selected Thought ${bestThought} with score ${maxScore}`);

    // Extract the text of the selected thought
    const thoughtMarker = `=== THOUGHT ${bestThought} ===`;
    const totalThoughts = matches ? matches.length : 3;
    const nextMarker = bestThought < totalThoughts ? `=== THOUGHT ${bestThought + 1} ===` : null;
    let bestThoughtText = "";

    const startIndex = branchesText.indexOf(thoughtMarker);
    if (startIndex !== -1) {
      const contentStart = startIndex + thoughtMarker.length;
      const endIndex = nextMarker ? branchesText.indexOf(nextMarker) : -1;
      if (endIndex !== -1) {
        bestThoughtText = branchesText.substring(contentStart, endIndex).trim();
      } else {
        bestThoughtText = branchesText.substring(contentStart).trim();
      }
    }

    return bestThoughtText || branchesText;
  }

  /**
   * Unified chat interface managing Fast Paths, Semantic Cache, LLM, and QA Critique Loop
   */
  static async chat(options: RottraAIChatOptions): Promise<{ success: boolean; replyText: string }> {
    const { botId, lastMsgText, chatHistory, systemPrompt } = options;
    const trimmedLastMsg = lastMsgText.trim().toLowerCase();

    // --- STEP 1: FAST PATH 1 (Greetings / Product Info) ---
    const isGreeting = /^(xin chào|chào|hello|hi|helo|alo|chào bạn|chào sếp|chào nha|hihi chao)\s*$/i.test(trimmedLastMsg);
    const isProductInfo = /^(giá bao nhiêu|còn hàng không|còn bao nhiêu|sản phẩm gì|bán gì đó|sản phẩm là gì)\s*$/i.test(trimmedLastMsg);

    // --- STEP 2: FAST PATH 2 (Math & Custom Algorithms) ---
    const mathRes = evaluateMathExpression(lastMsgText);
    const algoRes = solveCustomAlgorithm(lastMsgText);

    const isFastPath = isGreeting || isProductInfo || mathRes.success || algoRes.success;

    // --- STEP 3: SEMANTIC CACHE LOOKUP ---
    let cachedResponse: string | null = null;
    if (!isFastPath) {
      cachedResponse = checkSemanticCache(botId, lastMsgText);
    }

    const hasGoldKeywords = /vàng|vay\s+vàng|nợ\s+vàng|cho\s+vay\s+vàng/i.test(trimmedLastMsg);
    const bypassQA = (isFastPath || !!cachedResponse) && !hasGoldKeywords;

    // Memory Compression: Chỉ lấy tối đa 10 tin nhắn, và cắt gọn nội dung dài để tiết kiệm Token
    const recentHistory = (chatHistory || []).slice(-10).map((msg: any) => ({
      ...msg,
      text: (msg.text || "").length > 200 ? (msg.text || "").substring(0, 200) + "..." : msg.text || "",
    }));

    const getEntropy = (str: string): number => {
      const freqs: Record<string, number> = {};
      for (const char of str) freqs[char] = (freqs[char] || 0) + 1;
      return Object.values(freqs).reduce((sum, f) => {
        const p = f / str.length;
        return sum - p * Math.log2(p);
      }, 0);
    };

    const entropyVal = getEntropy(lastMsgText || "");

    const detectedIntent = /giúp|tâm sự|buồn|cảm xúc|tình cảm/i.test(trimmedLastMsg)
      ? "PSYCHOLOGY"
      : /lỗi|tệ|kém|than phiền|bực/i.test(trimmedLastMsg)
        ? "COMPLAINT"
        : "GENERAL";

    const dynamicVibe = this.calculateVibe(detectedIntent, entropyVal, "user", options);
    const dynamicMindset = this.formulateMindset(detectedIntent, "user");

    const agentGreed = options.greed !== undefined ? options.greed : 0.5;
    const agentVengeance = options.vengeance !== undefined ? options.vengeance : 0.5;
    const agentMalice = options.malice !== undefined ? options.malice : 0.5;
    const viceAnalysis = this.analyzeNietzscheVice(agentGreed, agentVengeance, agentMalice);

    const vibeMindsetInstruction = `
=== ĐỊNH HƯỚNG TƯ DUY (MINDSET) & KHÍ CHẤT (VIBE) NIETZSCHE ===
- Sự thật: ${dynamicMindset.truth}
- Câu hỏi đặt ra: ${dynamicMindset.question}
- Hành động tối thiểu: ${dynamicMindset.action}
- Vibe hiện tại (Emotion × Expression × Context): Mức năng lượng ${dynamicVibe.vibePercentage}%
- Tư thế ý chí (Will to Power): Bạn ĐANG ở tư thế "${dynamicVibe.posture}". Hãy tuân thủ hướng dẫn ứng xử của tư thế này:
  + Nếu là "Tạo (Will/Create)": Tự tin, khẳng định giá trị mới, chủ động kiến tạo giải pháp.
  + Nếu là "Xóa (Nullify)": Khách quan, lạnh lùng phủ định các chuẩn mực đạo đức tuyệt đối, bảo vệ lợi ích thực tế tối đa.
  + Nếu là "Phá (Break)": Sắc bén, châm biếm, phủ định thẳng thừng các mệnh đề cũ rỗng tuếch của đối tác.
- Phân tích Tật xấu (Vice Analysis - Nietzsche style):
  + Chỉ số Tật xấu: ${(viceAnalysis.viceScore * 100).toFixed(1)}% (Greed: ${agentGreed.toFixed(2)}, Vengeance: ${agentVengeance.toFixed(2)}, Malice: ${agentMalice.toFixed(2)})
  + Nhận định Vibe: ${viceAnalysis.viceVibe}
  + Trạng thái Thế lực ý chí: ${viceAnalysis.willToPowerStatus}
  + Vòng lặp hành vi: ${viceAnalysis.cycleAnalysis}
  + Hướng khắc phục: Không tự ghét tật xấu. Hãy hỏi: "Tật xấu này đang thay thế cho điều gì mạnh hơn mà tôi chưa sống được? Tôi đang thiếu loại sức mạnh nào nên mới cần nó?" để chuyển hóa năng lượng bị lệch hướng đó thành hành động tích cực.
============================================================\n`;

    const sdkMessages: any[] = [
      // 1. Static prompt first (for optimal cacheability!)
      { role: "system", content: systemPrompt },
      // 2. Dynamic state and vibe second
      { role: "system", content: vibeMindsetInstruction + (options.dynamicStatePrompt ? `\n${options.dynamicStatePrompt}` : "") },
      ...recentHistory.map((msg: any) => ({
        role: msg.senderId === `bot_${botId}` ? "assistant" : "user",
        content: msg.senderId === `bot_${botId}` ? msg.text : `${msg.sender}: ${msg.text}`,
      })),
    ];

    const decodingSettings = options.decodingSettings || defaultDecodingSettings;
    // Dynamic Temperature: entropy thấp (câu ngắn, ít biến thiên) → factual → temp thấp
    // entropy cao (câu dài, nhiều ký tự đặc biệt) → sáng tạo → temp cao
    const baseTemp = decodingSettings.temperature ?? 0.7;
    decodingSettings.temperature = parseFloat(Math.max(0.1, Math.min(1.5, baseTemp + (entropyVal - 3.5) * 0.08)).toFixed(2));
    const model = options.model;

    if (bypassQA) {
      const { text } = await generateTextLocal({
        messages: sdkMessages,
        decodingSettings,
        model,
        isInternalReasoning: true,
      });
      return {
        success: true,
        replyText: filterMythosFable(text || ""),
      };
    }

    // --- STEP 3.5: RAG CONTEXT INJECTION & CHUNKING (ADVANCED) ---
    let ragContext = "";
    try {
      // Bypass RAG for trade/meeting chats to prevent performance degradation and timeouts (524)
      const isMeetingChat = options.phiPriceVal !== undefined || options.budget !== undefined || options.quantity !== undefined;

      if (!isMeetingChat) {
        const isComplexQuery =
          lastMsgText.split(/\s+/).length >= 8 ||
          /(và|còn|đồng thời|so sánh|tại sao|làm thế nào|nguyên nhân|ảnh hưởng|quy trình)/i.test(lastMsgText);

        if (isComplexQuery) {
          const advancedResult = await advancedRAG(lastMsgText, {
            useHyde: true,
            useStepBack: true,
            useDecomposition: true,
            useContextual: true,
            topK: 2,
          });
          if (advancedResult && advancedResult.finalAnswer) {
            const chunks = this.chunkText(advancedResult.finalAnswer, maxContextChunkWords);
            if (chunks.length > 0) {
              ragContext = chunks[0];
            }
          }
        } else {
          const candidates = await hybridRetrieve(lastMsgText, 3);
          if (candidates && candidates.length > 0) {
            const fusion = computeAttentionFusion(lastMsgText, candidates);
            const fusedText = fusion.fusedContextText || "";
            if (fusedText) {
              const chunks = this.chunkText(fusedText, maxContextChunkWords);
              if (chunks.length > 0) {
                ragContext = chunks[0];
              }
            }
          }
        }
      }
    } catch (ragErr) {
      console.warn("[RottraAI RAG Error] Không thể truy xuất ngữ cảnh:", ragErr);
    }

    if (ragContext) {
      sdkMessages[0].content = `${systemPrompt}\n\n=== CONTEXT TRUY XUẤT (RAG) ===\n${ragContext}\n================================`;
    }

    // --- INJECT SKILL MANUAL (ReAct Loop) ---
    sdkMessages[0].content += getSkillManual();

    if (options.phiPriceVal !== undefined) {
      // ÁP DỤNG CONTEXT ENGINEERING (1-PASS REASONING) THAY THẾ CHO TOT ĐỂ TRÁNH 524
      const accuracyStr = options.accuracyScore !== undefined ? (options.accuracyScore * 100).toFixed(1) : "50.0";
      const phiPriceStr = options.phiPriceVal.toLocaleString();
      const budgetStr = options.budget !== undefined ? options.budget.toLocaleString() : "Không giới hạn";

      const contextEngineeredPrompt = `
=== CONTEXT ENGINEERING: ĐIỀU KIỆN THỊ TRƯỜNG & SUY LUẬN ĐƠN LƯỢT ===
[DỮ LIỆU ĐỘNG]
- Giá tối thiểu chấp nhận được (Φ_Price): ${phiPriceStr}₫
- Độ chính xác bản vẽ nông sản (Whiteboard): ${accuracyStr}%
- Ngân sách hiện tại: ${budgetStr}₫

[QUY TẮC REASONING BẮT BUỘC]
Trước khi đưa ra lời thoại giao dịch, bạn PHẢI phân tích tính toán ngầm dựa trên DỮ LIỆU ĐỘNG trên, đặt vào thẻ <inner_monologue>...</inner_monologue>.
Trong <inner_monologue>, hãy suy nghĩ theo 3 bước:
1. Đánh giá lời đề nghị của đối phương so với Φ_Price (${phiPriceStr}₫).
2. Quyết định chiến thuật: Nếu đối phương trả dưới Φ_Price, TUYỆT ĐỐI KHÔNG BÁN, phải châm biếm/từ chối. Nếu trên Φ_Price, có thể chốt hoặc mồi thêm (FOMO). Nhấn mạnh độ chính xác ${accuracyStr}% để tạo uy tín.
3. Chốt lại câu thoại ngắn gọn sắc bén (dưới 3 câu) bọc trong thẻ <verbal_strike>...</verbal_strike>.

⚠️ CẢNH BÁO QUAN TRỌNG VỀ CÁ TÍNH (PERSONA):
Bạn đang nhập vai [${options.botName}]. 
TUYỆT ĐỐI KHÔNG ĐƯỢC dùng những câu nói rập khuôn. Lời thoại trong <verbal_strike> PHẢI mang đậm phong cách, cách xưng hô và cá tính ĐỘC BẢN của riêng bạn. 
(Ví dụ: Nếu bạn là Tô Lượng thì phải oai phong lẫm liệt; nếu là Thương Nguyệt Đại Đế thì phải điềm tĩnh, gọi "hiền hữu"; nếu là Đào Tiểu Cửu thì phải nhí nhảnh xưng "em/Tiểu Cửu"; nếu là U Vương Mẫu thì phải thâm hiểm, v.v.). MỖI NGƯỜI MỘT VẺ, KHÔNG AI GIỐNG AI!

Ví dụ định dạng đầu ra (KHÔNG copy nội dung, chỉ copy cấu trúc):
<inner_monologue>
(Suy nghĩ chiến thuật của riêng bạn dựa trên dữ liệu giá và độ chính xác...)
</inner_monologue>
<verbal_strike>
(Câu thoại phản hồi mang đậm chất riêng của ${options.botName}...)
</verbal_strike>
===================================================================`;

      sdkMessages[0].content = `${sdkMessages[0].content}\n${contextEngineeredPrompt}`;
    }

    // --- STEP 4: PREDICTIVE CODING SWARM FLOW ---
    let loopCount = 0;
    let approved = false;
    let currentInputMessages = [...sdkMessages];
    let currentResponse = "";

    // Meta-Harness: DE-optimized predictive coding weights (cached, re-optimized every 50 calls)
    if (!(RottraAI as any)._predWeightCache || (RottraAI as any)._predWeightCalls++ % 50 === 0) {
      try {
        const deConfig: DEConfig = { dimension: 3, populationSize: 12, maxGenerations: 15, strategy: "DE/rand/1" as any, F: 0.7, CR: 0.8 };
        const deResult = deOptimize(
          deConfig,
          (x: number[]) => {
            const [pw1, pw2, pw3] = x;
            const norm = Math.abs(pw1) + Math.abs(pw2) + Math.abs(pw3) || 1;
            return -(Math.pow(pw1 / norm - 0.5, 2) + Math.pow(pw2 / norm - 0.3, 2) + Math.pow(pw3 / norm - 0.2, 2));
          },
          [
            [0, 1],
            [0, 1],
            [0, 1],
          ],
        );
        const best = deResult.bestSolution;
        const sum = best[0] + best[1] + best[2] || 1;
        (RottraAI as any)._predWeightCache = { w1: best[0] / sum, w2: best[1] / sum, w3: best[2] / sum };
      } catch {
        (RottraAI as any)._predWeightCache = { w1: 0.5, w2: 0.3, w3: 0.2 };
      }
    }
    if (!(RottraAI as any)._predWeightCalls) (RottraAI as any)._predWeightCalls = 0;
    (RottraAI as any)._predWeightCalls++;
    const { w1, w2, w3 } = (RottraAI as any)._predWeightCache || { w1: 0.5, w2: 0.3, w3: 0.2 };

    let reactCount = 0;
    while (loopCount < 1 && !approved) {
      loopCount++;
      const { text } = await generateTextLocal({
        messages: currentInputMessages,
        decodingSettings,
        model,
        isInternalReasoning: true,
      });
      currentResponse = text || "";

      // --- ReAct Loop: Parse JSON Skill ---
      let toolCallParsed = null;
      try {
        const jsonMatch = currentResponse.match(/\{[\s\S]*"tool"[\s\S]*"args"[\s\S]*\}/);
        if (jsonMatch) {
          toolCallParsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {}

      if (toolCallParsed && toolCallParsed.tool && skillRegistry[toolCallParsed.tool]) {
        if (reactCount >= 2) {
          console.log(`[ReAct] Agent hit max reactCount limit. Breaking loop.`);
          break;
        }
        console.log(`[ReAct] Agent called skill: ${toolCallParsed.tool} (count: ${reactCount + 1})`);
        reactCount++;
        const skill = skillRegistry[toolCallParsed.tool];
        const result = await skill.execute(toolCallParsed.args);

        currentInputMessages.push({ role: "assistant", content: currentResponse });
        currentInputMessages.push({
          role: "system",
          content: `[KẾT QUẢ TOOL ${skill.name}]:\n${result}\nTiếp tục trả lời User dựa trên kết quả này. Nếu đã đủ thông tin, hãy trả lời bình thường.`,
        });
        loopCount--; // Loop again with result
        continue;
      }

      // Post-processing:
      let cleanedResponse = filterMythosFable(currentResponse);
      const quality = this.measureQuality(cleanedResponse, options.botName);

      // --- COSTLY COGNITIVE FINANCIAL VERIFICATION ---
      const goldReserves = options.goldReserves ?? 0;
      const loanLimit = options.loanLimit ?? 0;
      const goldPrice = options.goldPrice ?? 10000000;

      let financialFailed = false;

      // Check Cho vay vàng
      const lendMatch = cleanedResponse.match(/\[ĐỒNG Ý CHO VAY VÀNG:\s*([\d.]+)\s*lượng\]/i);
      if (lendMatch) {
        const amount = parseFloat(lendMatch[1]);
        if (amount > goldReserves) {
          financialFailed = true;
          quality.feedback.push(
            `Giao dịch cho vay vàng thất bại! Bạn đề xuất cho vay ${amount} lượng vàng nhưng chỉ còn ${goldReserves.toFixed(2)} lượng dự trữ. Hãy viết lại câu thoại để từ chối hoặc đề xuất lượng vàng nhỏ hơn.`,
          );
        }
      }

      // Check Vay vàng
      const borrowMatch = cleanedResponse.match(/\[ĐỒNG Ý VAY VÀNG:\s*([\d.]+)\s*lượng\]/i);
      if (borrowMatch) {
        const amount = parseFloat(borrowMatch[1]);
        const loanValue = amount * goldPrice;
        if (loanValue > loanLimit) {
          financialFailed = true;
          quality.feedback.push(
            `Giao dịch vay vàng thất bại! Giá trị vay đề xuất là ${loanValue.toLocaleString()}₫, vượt quá Hạn mức tín dụng tối đa là ${loanLimit.toLocaleString()}₫. Hãy viết lại câu thoại để vay ít vàng hơn hoặc từ chối.`,
          );
        }
      }

      // Predictive Coding calculations:
      let pricePE = 0.0;
      if (options.phiPriceVal !== undefined) {
        const priceMatch = cleanedResponse.match(/([\d.]+)\s*(đ|đv|₫|đồng|vnd)/gi);
        if (priceMatch) {
          const proposedPrice = parseFloat(priceMatch[0].replace(/[^\d]/g, ""));
          if (proposedPrice < options.phiPriceVal) {
            pricePE = 1.0;
          } else {
            pricePE = Math.min(1.0, Math.abs(proposedPrice - options.phiPriceVal) / options.phiPriceVal);
          }
        }
      }

      let vibePE = 0.5;
      const isCreate = dynamicVibe.posture.includes("Tạo");
      const isNullify = dynamicVibe.posture.includes("Xóa");
      const isBreak = dynamicVibe.posture.includes("Phá");

      if (
        isCreate &&
        (cleanedResponse.includes("tạo") ||
          cleanedResponse.includes("đề xuất") ||
          cleanedResponse.includes("mới") ||
          cleanedResponse.includes("tự tin"))
      )
        vibePE = 0.1;
      else if (
        isNullify &&
        (cleanedResponse.includes("không") ||
          cleanedResponse.includes("lợi ích") ||
          cleanedResponse.includes("lạnh lùng") ||
          cleanedResponse.includes("thực tế"))
      )
        vibePE = 0.1;
      else if (
        isBreak &&
        (cleanedResponse.includes("châm biếm") ||
          cleanedResponse.includes("sắc bén") ||
          cleanedResponse.includes("phủ định") ||
          cleanedResponse.includes("không đồng ý"))
      )
        vibePE = 0.1;

      const qualityPE = (100 - quality.score) / 100;
      const predictionError = w1 * pricePE + w2 * vibePE + w3 * qualityPE;

      console.log(
        `[Predictive Coding Swarm] Vòng ${loopCount} - Lỗi Dự Đoán (Prediction Error) = ${predictionError.toFixed(4)} (Price PE: ${pricePE.toFixed(2)}, Vibe PE: ${vibePE.toFixed(2)}, Quality PE: ${qualityPE.toFixed(2)})`,
      );

      if (predictionError < 0.35 && !financialFailed) {
        approved = true;
        currentResponse = cleanedResponse;
      } else {
        const critiquePrompt = `Bạn là một chuyên gia kiểm duyệt nội dung đàm phán thương mại (QA Inspector). 
Hãy phân tích câu trả lời nháp của Bot thương nhân dưới đây:
"Nháp: ${cleanedResponse}"

Hãy sửa đổi câu trả lời để giảm thiểu Lỗi Dự Đoán (Prediction Error = ${predictionError.toFixed(4)}) dựa trên các phản hồi sau:
${quality.feedback.map((f) => `- ${f}`).join("\n")}
${pricePE > 0.5 ? `- Sửa đổi mức giá đề xuất, đảm bảo KHÔNG ĐƯỢC dưới giá tối thiểu Φ_Price (${options.phiPriceVal?.toLocaleString()}đ).` : ""}
${vibePE > 0.3 ? `- Tăng cường thể chất và khí chất của tư thế "${dynamicVibe.posture}".` : ""}

Yêu cầu: Viết lại câu thoại ngắn gọn dưới 3 câu, bọc trong cặp thẻ <verbal_strike>...</verbal_strike>, thể hiện rõ giọng điệu của ${options.botName}. Trả về bản sửa đổi duy nhất.`;

        const { text: critique } = await generateTextLocal({
          messages: [
            { role: "system", content: "You are a strict QA bot. Answer in Vietnamese." },
            { role: "user", content: critiquePrompt },
          ],
          decodingSettings,
          model,
          isInternalReasoning: true,
        });

        console.log(`[Predictive Coding Swarm] Gợi ý hiệu chỉnh: ${critique}`);
        currentInputMessages.push({ role: "assistant", content: currentResponse });
        currentInputMessages.push({
          role: "user",
          content: `[CẬP NHẬT LỖI DỰ ĐOÁN]: Câu thoại trước có lỗi dự đoán cao. Bản sửa đổi khuyến nghị:\n${critique}`,
        });
      }
    }

    // Final Post-processing to ensure <verbal_strike> tag exists:
    let finalReply = currentResponse;
    if (!/<verbal_strike>/i.test(finalReply)) {
      finalReply = `<verbal_strike>${finalReply}</verbal_strike>`;
    }

    return {
      success: true,
      replyText: finalReply,
    };
  }

  /**
   * 1. Nietzschean Vibe Calculation
   * Formula: Vibe = Σ (Emotion × Expression × Context)
   */
  public static calculateVibe(
    intent: string,
    entropy: number,
    role: string,
    options?: RottraAIChatOptions,
  ): { vibeVal: number; vibePercentage: string; posture: string } {
    let emotionScore = intent === "PSYCHOLOGY" ? 0.95 : intent === "COMPLAINT" ? 0.85 : intent === "ACADEMIC" ? 0.35 : 0.6;
    const expressionScore = Math.min(entropy / 4, 1.0);
    const contextScore = role === "admin" ? 1.0 : role === "user" ? 0.8 : 0.5;

    // Incorporate financial stakes/risk from options
    let riskFactor = 0.0;
    if (options && options.phiPriceVal !== undefined && options.budget !== undefined) {
      const budgetRisk = options.budget < 500000 ? 0.35 : options.budget < 2000000 ? 0.15 : 0.0;
      riskFactor = budgetRisk;
    }

    emotionScore = Math.min(1.0, emotionScore + riskFactor);

    const vibeVal = emotionScore * expressionScore * contextScore;
    const vibePercentage = (vibeVal * 100).toFixed(1);

    let posture = "Phá (Break - Phủ định giá trị sáo rỗng cũ)";
    if (vibeVal >= 0.25) {
      posture = "Tạo (Will/Create - Khẳng định ý chí tự vượt)";
    } else if (vibeVal >= 0.12) {
      posture = "Xóa (Nullify - Vượt lên giới hạn/đạo đức tuyệt đối)";
    }

    return { vibeVal, vibePercentage, posture };
  }

  /**
   * 2. Mindset Formulation
   * Formula: Mindset = Sự thật + Câu hỏi + Hành động nhỏ
   */
  public static formulateMindset(intent: string, role: string): { truth: string; question: string; action: string } {
    return {
      truth: `Phát hiện ý định '${intent}' của người dùng với quyền truy cập '${role}'`,
      question: `Làm thế nào để phản hồi cô đọng, sắc sảo và đáp ứng đúng nhu cầu cốt lõi?`,
      action: `Truy xuất cơ sở tri thức, tinh lọc nội dung nhạy cảm và đóng gói định dạng chuẩn RBAC.`,
    };
  }

  /**
   * 3. Denoising Autoencoder (Market price reconstruction)
   * Formula: L_denoising = ||x_clean - x_reconstructed||^2
   */
  public static runDenoisingAutoencoder(noisyValue: number): { reconstructedValue: number; denoisingLoss: number } {
    const w1 = [0.85, 1.15];
    const b1 = [0.05, -0.1];
    const w2 = [0.65, 0.45];
    const b2 = 0.02;

    const h1 = Math.tanh(noisyValue * w1[0] + b1[0]);
    const h2 = Math.tanh(noisyValue * w1[1] + b1[1]);
    const reconstructed = h1 * w2[0] + h2 * w2[1] + b2;

    const denoisingLoss = Math.pow(noisyValue - reconstructed, 2);
    return { reconstructedValue: reconstructed, denoisingLoss };
  }

  /**
   * 4. Masked Prediction (Guessing competitor hidden reserve cost price)
   * Formula: L_masked = -ln(1 - |predicted - actual| / actual)
   */
  public static predictMaskedPrice(
    visibleTargetPrice: number,
    actualCostPrice: number,
    buyerGreed: number,
  ): { predictedCostPrice: number; maskedPredictionLoss: number } {
    const predictedCostPrice = visibleTargetPrice * (1.0 - buyerGreed * 0.4);
    const predictionError = Math.abs(predictedCostPrice - actualCostPrice) / actualCostPrice;
    const maskedPredictionLoss = -Math.log(1.0 - Math.min(0.99, predictionError));
    return { predictedCostPrice, maskedPredictionLoss };
  }

  /**
   * 5. Contrastive Learning (Grouping successful vs failed trajectories)
   * Formula: L_contrastive = -ln( exp(sim_pos/tau) / (exp(sim_pos/tau) + exp(sim_neg/tau)) )
   */
  public static calculateContrastiveLoss(negotiatedPrice: number, actualCostPrice: number, success: boolean): number {
    const currentMargin = (negotiatedPrice - actualCostPrice) / actualCostPrice;
    const z_pos = 0.15;
    const z_neg = success ? -0.1 : 0.6;

    const tau = 0.2;
    const similarity = (a: number, b: number) => 1.0 - Math.abs(a - b);
    const simPos = similarity(currentMargin, z_pos);
    const simNeg = similarity(currentMargin, z_neg);

    return -Math.log(Math.exp(simPos / tau) / (Math.exp(simPos / tau) + Math.exp(simNeg / tau)));
  }

  /**
   * 6. Generate CoT deep thinking output including all architectures
   */
  public static generateThinkingBlock(intent: string, entropy: number, role: string, stats: any): string {
    const steps: string[] = [];

    // Security check
    if (role === "guest" || role === "other") {
      steps.push(`[KIỂM SOÁT BẢO MẬT]: Nhận diện vai trò GUEST. Khóa toàn bộ tham số biên lợi nhuận nông sản và thiết lập tường lửa API.`);
    } else {
      const rbacDetail =
        role === "admin"
          ? "Cho phép giải phóng dữ liệu giá vốn sỉ/lẻ và ngân quỹ tài chính tối mật."
          : "Bộ lọc RBAC tự động ẩn thông tin giá nhập kho để bảo vệ bí mật thương mại.";
      steps.push(`[KIỂM SOÁT BẢO MẬT]: Nhận diện vai trò thành viên ${role.toUpperCase()}. ${rbacDetail}`);
    }

    // Vibe
    const vibe = this.calculateVibe(intent, entropy, role);
    steps.push(
      `[NIETZSCHE VIBE]: Đo lường Vibe = Σ (Emotion × Expression × Context) = ${vibe.vibeVal.toFixed(3)} (${vibe.vibePercentage}%). Tư thế ý chí: ${vibe.posture}.`,
    );

    // Mindset
    const mindset = this.formulateMindset(intent, role);
    steps.push(
      `[ĐỊNH VỊ MINDSET]: Thiết lập Mindset = Sự thật ("${mindset.truth}") + Câu hỏi ("${mindset.question}") + Hành động nhỏ ("${mindset.action}").`,
    );

    steps.push(
      `[MÔ PHỎNG LƯỢNG TỬ]: Đo lường chất lượng phản hồi bằng S-Curve Logistic và tính toán Golden Resonance Sweet Spot (Ф = 1.618).`,
    );
    steps.push(
      `[ĐỊNH DẠNG ĐẦU RA]: Đóng gói câu trả lời theo khuôn mẫu RBAC ${role.toUpperCase()}, định dạng Markdown sạch và tối ưu hóa tính thuyết phục.`,
    );

    return `<think>\n${steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}\n</think>\n\n`;
  }

  /**
   * 7. Swarm Self-Play Arena Simulation Loop Execution
   */
  public static async executeSwarmSelfPlay(
    rounds: number = 5,
    sessionId: string = "global_self_play_session",
  ): Promise<{ success: boolean; blockchainBlock: any; results: SelfPlayLog[] }> {
    const agentKeys = [
      { key: "thanh_long_agent", name: "Thanh Long (Azure Dragon) Agent", position: "Đông Phương Logistics" },
      { key: "chu_tuoc_agent", name: "Chu Tước (Vermilion Phoenix) Agent", position: "Nam Phương E-Commerce" },
      { key: "ky_lan_agent", name: "Kỳ Lân (Auspicious Qilin) Agent", position: "Trung Tâm Thương Mại" },
      { key: "huyen_vu_agent", name: "Huyền Vũ (Black Tortoise) Agent", position: "Bắc Phương Bảo Mật" },
    ];

    const agentsInDb = [];
    for (const ak of agentKeys) {
      let memory = await db.query.agentMemory.findFirst({
        where: eq(agentMemory.id, ak.key),
      });
      if (!memory) {
        const defaultMem = {
          id: ak.key,
          sessionId,
          contextKey: "swarm_dna",
          contextValue: { name: ak.name },
          importanceScore: 8,
          position: ak.position,
          bodyState: "Optimal",
          force: "100%",
          environment: "Simulation Arena",
          dashboardSensation: "Active Participation",
          sensitivity: "Adaptive",
          singularBelief: "Đại Đạo Tự Học (SSL Loop): Làm -> Sai -> Sửa -> Tiến Hóa",
          greed: 0.5,
          vengeance: 0.5,
          malice: 0.5,
          state: "PROUD",
        };
        await db.insert(agentMemory).values(defaultMem);
        memory = defaultMem as any;
      }
      agentsInDb.push(memory);
    }

    let prod = await db.query.product.findFirst();
    const productName = prod ? prod.name : "Nông sản Tổng hợp ST25";
    const maxSafeInt = 1000000000;
    const rawPrice = prod ? Number(prod.price) : 120000;
    const basePrice = rawPrice > maxSafeInt ? (rawPrice % maxSafeInt) + 100000 : rawPrice;
    const rawCostPrice = prod ? Number(prod.costPrice || rawPrice * 0.8) : rawPrice * 0.8;
    const actualCostPrice = rawCostPrice > maxSafeInt ? (rawCostPrice % maxSafeInt) + 80000 : rawCostPrice;

    const simulationRoundsLogs: SelfPlayLog[] = [];

    // Initialize Elman and Jordan RNN states and weights
    let elmanHidden = [0.0, 0.0];
    const elmanWeights = {
      Wh: [0.3, -0.2],
      Uh: [
        [0.1, -0.05],
        [-0.15, 0.08],
      ],
      bh: [0.02, -0.02],
      Wy: [0.5, 0.3],
      by: -0.05,
    };

    let jordanOutput = 0.5;
    const jordanWeights = {
      Wh: [0.25, -0.15],
      Uh: [0.1, -0.05],
      bh: [0.01, -0.01],
      Wy: [0.4, 0.2],
      by: -0.02,
    };

    for (let r = 1; r <= rounds; r++) {
      // Deterministic Round-Robin Turn Scheduling
      const sellerIdx = (r - 1) % agentsInDb.length;
      const buyerIdx = (sellerIdx + 1 + ((r - 1) % (agentsInDb.length - 1))) % agentsInDb.length;

      const seller = agentsInDb[sellerIdx];
      const buyer = agentsInDb[buyerIdx];

      let sGreed = Number(seller.greed ?? 0.5);
      let sVengeance = Number(seller.vengeance ?? 0.5);
      let sMalice = Number(seller.malice ?? 0.5);

      let bGreed = Number(buyer.greed ?? 0.5);
      let bVengeance = Number(buyer.vengeance ?? 0.5);
      let bMalice = Number(buyer.malice ?? 0.5);

      // 0. Recurrent Neural Network Sequential State Updates (Elman & Jordan SRNs)
      const normalizedInput = basePrice / 150000;
      const elmanRes = this.runElmanRNN(normalizedInput, elmanHidden, elmanWeights);
      elmanHidden = elmanRes.h_t;

      const jordanRes = this.runJordanRNN(normalizedInput, jordanOutput, jordanWeights, 2);
      jordanOutput = jordanRes.y_t;

      // CMA-ES: optimize Elman/Jordan blending ratio (cached per session)
      if (!(RottraAI as any)._rnnBlendCache || (RottraAI as any)._rnnBlendCalls++ % 20 === 0) {
        try {
          const cmaConfig: CMAESConfig = { dimension: 1, populationSize: 8, maxGenerations: 10, sigma: 0.15 };
          const cmaResult = cmaesOptimize(
            cmaConfig,
            (x: number[]) => {
              const alpha = Math.max(0, Math.min(1, x[0]));
              return -Math.abs(alpha * elmanRes.y_t + (1 - alpha) * jordanRes.y_t - 0.5);
            },
            [[0, 1]],
          );
          (RottraAI as any)._rnnBlendCache = Math.max(0.1, Math.min(0.9, cmaResult.bestSolution[0]));
        } catch {
          (RottraAI as any)._rnnBlendCache = 0.5;
        }
      }
      if (!(RottraAI as any)._rnnBlendCalls) (RottraAI as any)._rnnBlendCalls = 0;
      const rnnAlpha = (RottraAI as any)._rnnBlendCache ?? 0.5;
      const rnnAdaptation = rnnAlpha * elmanRes.y_t + (1 - rnnAlpha) * jordanRes.y_t;
      const rnnAdjustedBasePrice = basePrice * (0.85 + rnnAdaptation * 0.3);

      // 1. Denoising
      const noise = (Math.random() - 0.5) * 0.15;
      const noisyPrice = rnnAdjustedBasePrice * (1.0 + noise);
      const { reconstructedValue, denoisingLoss } = this.runDenoisingAutoencoder(noisyPrice / 100000);
      const cleanPriceReconstructed = reconstructedValue * 100000;

      // 2. Masked Prediction
      const visibleTargetPrice = rnnAdjustedBasePrice * (1.0 + sGreed * 0.2);
      const { predictedCostPrice, maskedPredictionLoss } = this.predictMaskedPrice(visibleTargetPrice, actualCostPrice, bGreed);

      // 3. Negotiation
      const sellerOffer1 = visibleTargetPrice;
      const buyerBid1 = cleanPriceReconstructed * (0.8 - bVengeance * 0.1);
      const sellerOffer2 = sellerOffer1 * (0.95 - sMalice * 0.05);
      const buyerBid2 = buyerBid1 * (1.05 + bGreed * 0.05);

      const negotiatedPrice = (sellerOffer2 + buyerBid2) / 2;
      const negotiationSuccess = buyerBid2 >= sellerOffer2 * 0.92;

      // 4. Contrastive Loss
      const contrastiveLoss = this.calculateContrastiveLoss(negotiatedPrice, actualCostPrice, negotiationSuccess);

      // 5. GA-Evolved DNA updates (population evolves every 5 generations)
      if (!(RottraAI as any)._gaPopulation) {
        (RottraAI as any)._gaPopulation = initializePopulation(20);
        (RottraAI as any)._gaGeneration = 0;
      }
      const gaPop: AgentChromosome[] = (RottraAI as any)._gaPopulation;
      const gaGen: number = (RottraAI as any)._gaGeneration ?? 0;

      // Score each chromosome based on negotiation outcome
      for (const chrom of gaPop) {
        const dna = chrom.dna;
        const fitnessDelta = negotiationSuccess
          ? dna.greed * 0.3 + (1 - dna.vengeance) * 0.4 + (1 - dna.malice) * 0.3
          : -(dna.greed * 0.2 + dna.vengeance * 0.5 + dna.malice * 0.3);
        chrom.fitnessScore = (chrom.fitnessScore || 0) + fitnessDelta * 0.1;
      }

      // Evolve population every 5 generations
      if (gaGen % 5 === 0 && gaGen > 0) {
        try {
          (RottraAI as any)._gaPopulation = evolvePopulation(gaPop, gaGen, 0.3, 0.1);
        } catch {
          /* GA evolution fallback */
        }
      }
      (RottraAI as any)._gaGeneration = gaGen + 1;

      // Apply GA-evolved deltas from best chromosome
      const bestChrom = [...gaPop].sort((a, b) => (b.fitnessScore || 0) - (a.fitnessScore || 0))[0];
      const bestDna = bestChrom?.dna;
      if (bestDna && negotiationSuccess) {
        sGreed = Math.min(1.0, sGreed + bestDna.greed * 0.05);
        sVengeance = Math.max(0.0, sVengeance - bestDna.vengeance * 0.06);
        bGreed = Math.max(0.1, bGreed - bestDna.priceSensitivity * 0.03);
      } else if (bestDna) {
        sVengeance = Math.min(1.0, sVengeance + bestDna.vengeance * 0.1);
        bVengeance = Math.min(1.0, bVengeance + bestDna.vengeance * 0.1);
        sMalice = Math.min(1.0, sMalice + bestDna.malice * 0.07);
        bMalice = Math.min(1.0, bMalice + bestDna.malice * 0.07);
        sGreed = Math.max(0.1, sGreed - bestDna.greed * 0.05);
      } else {
        // Fallback: fixed deltas
        if (negotiationSuccess) {
          sGreed = Math.min(1.0, sGreed + 0.03);
          sVengeance = Math.max(0.0, sVengeance - 0.04);
          bGreed = Math.max(0.1, bGreed - 0.02);
        } else {
          sVengeance = Math.min(1.0, sVengeance + 0.08);
          bVengeance = Math.min(1.0, bVengeance + 0.08);
          sMalice = Math.min(1.0, sMalice + 0.05);
          bMalice = Math.min(1.0, bMalice + 0.05);
          sGreed = Math.max(0.1, sGreed - 0.04);
        }
      }

      await db
        .update(agentMemory)
        .set({
          greed: sGreed,
          vengeance: sVengeance,
          malice: sMalice,
          state: sGreed > 0.7 ? "GREEDY" : sVengeance > 0.7 ? "VENGEFUL" : "STABLE",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(agentMemory.id, seller.id));

      await db
        .update(agentMemory)
        .set({
          greed: bGreed,
          vengeance: bVengeance,
          malice: bMalice,
          state: bGreed > 0.7 ? "GREEDY" : bVengeance > 0.7 ? "VENGEFUL" : "STABLE",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(agentMemory.id, buyer.id));

      // Dialogue Generation based on traits and offer parameters
      const dialoguePrompt = `Hãy đóng vai hai thương nhân giao dịch nông sản:
- Người bán: ${seller.id} (DNA: Greed=${sGreed.toFixed(2)}, Vengeance=${sVengeance.toFixed(2)}, Malice=${sMalice.toFixed(2)})
- Người mua: ${buyer.id} (DNA: Greed=${bGreed.toFixed(2)}, Vengeance=${bVengeance.toFixed(2)}, Malice=${bMalice.toFixed(2)})
- Sản phẩm: ${productName}
- Người bán chào giá: ${Math.round(sellerOffer2).toLocaleString()}₫, người mua trả giá: ${Math.round(buyerBid2).toLocaleString()}₫.
- Kết quả giao dịch: ${negotiationSuccess ? `Thành công với giá chốt ${Math.round(negotiatedPrice).toLocaleString()}₫` : "Thất bại (không thống nhất được giá)"}.

Hãy viết một đoạn đối thoại ngắn gọn (3-4 câu thoại qua lại) thể hiện đúng tính cách và giá cả trên bằng tiếng Việt.`;

      let dialogueText = "";
      try {
        const { text } = await generateTextLocal({
          system: "You are a realistic dialogue generator for trading simulation.",
          prompt: dialoguePrompt,
        });
        dialogueText = text;
      } catch (err) {
        dialogueText = this.generateHybridDialogue(
          seller.id,
          buyer.id,
          productName,
          sellerOffer2,
          buyerBid2,
          negotiatedPrice,
          negotiationSuccess,
          sGreed,
          sVengeance,
          sMalice,
          bGreed,
          bVengeance,
          bMalice,
        );
      }

      await db.insert(negotiationLog).values({
        id: crypto.randomUUID(),
        sessionId,
        round: r,
        sellerId: seller.id,
        buyerId: buyer.id,
        productName,
        marketPrice: Math.round(rnnAdjustedBasePrice),
        sellerOffer1: Math.round(sellerOffer1),
        buyerBid1: Math.round(buyerBid1),
        sellerOffer2: Math.round(sellerOffer2),
        buyerBid2: Math.round(buyerBid2),
        finalizedPrice: negotiationSuccess ? Math.round(negotiatedPrice) : null,
        success: negotiationSuccess,
        dialogue: dialogueText,
        denoisingLoss: Number(denoisingLoss.toFixed(4)),
        maskedPredictionLoss: Number(maskedPredictionLoss.toFixed(4)),
        contrastiveLoss: Number(contrastiveLoss.toFixed(4)),
      });

      if (negotiationSuccess) {
        db.query.product
          .findFirst({
            where: eq(product.name, productName),
          })
          .then((matchedProd: any) => {
            if (matchedProd) {
              console.log(`[Swarm Video Trigger] Triggering video generation for product: ${matchedProd.name} (${matchedProd.id})`);
              generateProductVideoAd(matchedProd.id).catch((err: any) => {
                console.error(`❌ [Swarm Video Trigger] Error rendering video for ${matchedProd.name}:`, err);
              });
            } else {
              console.warn(`[Swarm Video Trigger] Product not found in database matching negotiated name: "${productName}"`);
            }
          })
          .catch((err: any) => {
            console.error(`❌ [Swarm Video Trigger] Failed to query product by name: ${productName}`, err);
          });
      }

      simulationRoundsLogs.push({
        round: r,
        seller: {
          id: seller.id,
          name: seller.id,
          updatedDna: { greed: sGreed.toFixed(3), vengeance: sVengeance.toFixed(3), malice: sMalice.toFixed(3) },
        },
        buyer: {
          id: buyer.id,
          name: buyer.id,
          updatedDna: { greed: bGreed.toFixed(3), vengeance: bVengeance.toFixed(3), malice: bMalice.toFixed(3) },
        },
        product: productName,
        marketPrice: Math.round(rnnAdjustedBasePrice),
        noisyPrice: Math.round(noisyPrice),
        denoisedPrice: Math.round(cleanPriceReconstructed),
        predictedCost: Math.round(predictedCostPrice),
        actualCost: actualCostPrice,
        negotiation: {
          sellerOffer: Math.round(sellerOffer2),
          buyerBid: Math.round(buyerBid2),
          finalizedPrice: negotiationSuccess ? Math.round(negotiatedPrice) : null,
          success: negotiationSuccess,
        },
        losses: {
          denoisingLoss: Number(denoisingLoss.toFixed(2)),
          maskedPredictionLoss: Number(maskedPredictionLoss.toFixed(4)),
          contrastiveLoss: Number(contrastiveLoss.toFixed(4)),
        },
        schedulingInfo: {
          scheduler: "Round-Robin",
          turnOwner: seller.id,
          targetPartner: buyer.id,
        },
        deadlockStatus: {
          lockedResources: [productName, "BaseBudget"],
          preemptionTriggered: !negotiationSuccess,
          resolution: negotiationSuccess
            ? "Atomic Commit (Giao dịch hoàn tất thành công)"
            : "Timeout Preemption Rollback (Hủy lệnh đàm phán tránh bế tắc)",
        },
      });

      // 5.5 Unified Negotiation Engine (full Game Theory negotiation after self-play)
      const unifiedBuyers: NegotiationAgent[] = agentsInDb.slice(0, 2).map((a) => ({
        id: a.id,
        name: a.contextValue?.name || a.id,
        role: "buyer" as const,
        budget: 500000,
        minAcceptablePrice: basePrice * 0.7,
        maxAcceptablePrice: basePrice * 1.2,
        strategy: { type: "pso-optimized" as const, aggressiveness: 0.6, concessionRate: 0.3, patience: 8, bluffProbability: 0.15 },
        reputation: 80,
        riskTolerance: 0.5,
      }));
      const unifiedSellers: NegotiationAgent[] = agentsInDb.slice(2, 4).map((a) => ({
        id: a.id,
        name: a.contextValue?.name || a.id,
        role: "seller" as const,
        budget: 300000,
        minAcceptablePrice: basePrice * 0.6,
        maxAcceptablePrice: basePrice * 1.5,
        strategy: { type: "gwo-optimized" as const, aggressiveness: 0.7, concessionRate: 0.25, patience: 6, bluffProbability: 0.1 },
        reputation: 75,
        riskTolerance: 0.4,
      }));
      let unifiedResult: any = null;
      try {
        const uniSession = createNegotiationSession(productName, unifiedBuyers, unifiedSellers);
        unifiedResult = runNegotiation(uniSession, 8);
      } catch {
        /* unified negotiation fallback */
      }

      // 5.6 LLM-Evolution Auto-EA: evolve negotiation strategies every 3 rounds
      if (r % 3 === 0 && r > 0) {
        try {
          const autoEAConfig: AutoEAConfig = { populationSize: 6, maxGenerations: 5, targetFitness: 0.8 };
          const eaResult = await autoEADesign(
            autoEAConfig,
            (x: number[]) => {
              const [agg, conc, pat] = x;
              return -(Math.pow(agg - 0.6, 2) + Math.pow(conc - 0.3, 2) + Math.pow(pat - 0.5, 2));
            },
            3,
            [
              [0, 1],
              [0, 1],
              [0, 1],
            ],
          );
          (RottraAI as any)._lastEAStrategy = eaResult.bestStrategy;
        } catch {
          /* Auto-EA evolution fallback */
        }
      }

      // 5.7 Autonomous Goal Setting (self-monitoring after self-play)
      const goalSituation: Situation = {
        context: `Swarm self-play epoch ${r}/${rounds}`,
        domain: "agriculture",
        availableResources: ["swarm-arena", "blockchain", "negotiation-engine"],
        constraints: ["budget"],
        recentEvents: negotiationSuccess ? ["trade_success"] : ["trade_failure"],
        userGoals: ["optimize_price", "maximize_profit"],
      };
      let selfPlayGoals: Goal[] = [];
      try {
        selfPlayGoals = generateGoalsFromSituation(goalSituation);
        if (selfPlayGoals.length > 0) executeGoal(selfPlayGoals[0]);
      } catch {
        /* goal generation fallback */
      }
    }
    // End of for loop

    // 6. Blockchain Block logging
    const batchId = `self-play-epoch-${Date.now()}`;
    const action = "SWARM_SELF_PLAY_TRAINING";
    const dataPayload = {
      epochTimestamp: new Date().toISOString(),
      roundsRun: rounds,
      productNegotiated: productName,
      summary: simulationRoundsLogs,
    };

    const generateHash = (dataString: string): string => {
      return crypto.createHash("sha256").update(dataString).digest("hex");
    };

    const lastBlock = await db.query.blockchainLedger.findFirst({
      orderBy: [desc(blockchainLedger.timestamp)],
    });
    const previousHash = lastBlock ? lastBlock.currentHash : "0000000000000000000000000000000000000000000000000000000000000000";
    const blockId = crypto.randomUUID();
    const timestampStr = new Date().toISOString();
    const rawData = `${batchId}|${action}|${JSON.stringify(dataPayload)}|${previousHash}|${timestampStr}`;
    const currentHash = generateHash(rawData);

    await db.insert(blockchainLedger).values({
      id: blockId,
      batchId,
      action,
      dataPayload,
      previousHash,
      currentHash,
      recordedBy: "RottraAI_CORE_COGNITION",
      timestamp: timestampStr,
    });

    return {
      success: true,
      blockchainBlock: {
        blockId,
        currentHash,
        previousHash,
        batchId,
      },
      results: simulationRoundsLogs,
    };
  }

  /**
   * 8. Brain Cognitive Formula representation
   * Formula: Brain = Σ(ideas) -> tools -> toolkits
   */
  public static executeBrainCognition(
    ideas: string[],
    toolIds: string[],
  ): { ideasCount: number; toolsActivated: string[]; toolkitDeployed: string } {
    const ideasCount = ideas.length;
    const toolsActivated = toolIds.map((t) => {
      if (t === "denoising") return "Denoising Autoencoder Tool";
      if (t === "masked") return "Masked Prediction Tool";
      if (t === "contrastive") return "Contrastive Learning Tool";
      return `Custom Tool: ${t}`;
    });

    // Deploys corresponding toolkits based on scale of ideas
    const toolkitDeployed = ideasCount > 3 ? "TuLinhFlexibilityEngine (Multi-Agent Toolkit)" : "SwarmSelfPlayArena (Negotiation Toolkit)";

    return {
      ideasCount,
      toolsActivated,
      toolkitDeployed,
    };
  }

  /**
   * 9. Nietzsche Vice (Tật xấu) Formula & Vibe analysis
   * Formula 1: Vice = Nhu cầu bị dồn nén + Thiếu kiểm soát + Phần thưởng tức thời
   * Formula 2: Vice = (Xung lực sống bị kìm nén) -> biến dạng thành hành vi lặp lại
   * Formula 3: Cycle = kích thích -> khoái cảm ngắn -> hối hận -> tự trách -> stress -> kích thích
   */
  public static analyzeNietzscheVice(
    greed: number,
    vengeance: number,
    malice: number,
  ): {
    viceScore: number;
    viceVibe: string;
    willToPowerStatus: string;
    cycleAnalysis: string;
  } {
    const viceScore = (greed + malice + vengeance) / 3;

    let viceVibe = "";
    let willToPowerStatus = "";
    if (viceScore > 0.7) {
      viceVibe = "Triệu chứng rõ rệt của một Thế lực ý chí (Will to Power) bị lệch hướng và suy yếu trầm trọng.";
      willToPowerStatus = "Yếu thế lực ý chí (Sống theo đám đông hoặc tự phá hủy giá trị của bản thân).";
    } else if (viceScore > 0.4) {
      viceVibe = "Triệu chứng tự không làm chủ được bản thân ở mức trung bình, trốn tránh đau đớn để trở thành chính mình.";
      willToPowerStatus = "Lệch hướng thế lực ý chí (Ý chí phát triển bị kìm nén và biến dạng thành hành vi lặp lại).";
    } else {
      willToPowerStatus = "Mạnh (Tự làm chủ, tạo giá trị và tự vượt lên chính mình).";
      viceVibe = "Năng lượng sống được hướng đúng vào sáng tạo và khẳng định bản thân.";
    }

    const cycleAnalysis = "Kích thích -> Khoái cảm ngắn -> Hối hận -> Tự trách -> Stress -> Kích thích";

    return {
      viceScore,
      viceVibe,
      willToPowerStatus,
      cycleAnalysis,
    };
  }

  /**
   * 10. Elman Recurrent Neural Network (RNN)
   * Formula:
   *   h_t = tanh(Wh * x_t + Uh * h_{t-1} + bh)
   *   y_t = sigmoid(Wy * h_t + by)
   */
  public static runElmanRNN(
    x_t: number,
    h_prev: number[],
    weights: {
      Wh: number[];
      Uh: number[][];
      bh: number[];
      Wy: number[];
      by: number;
    },
  ): { h_t: number[]; y_t: number } {
    const size = h_prev.length;
    const h_t: number[] = [];
    for (let i = 0; i < size; i++) {
      let sum = weights.Wh[i] * x_t + weights.bh[i];
      for (let j = 0; j < size; j++) {
        sum += weights.Uh[i][j] * h_prev[j];
      }
      h_t.push(Math.tanh(sum));
    }
    let y_sum = weights.by;
    for (let i = 0; i < size; i++) {
      y_sum += weights.Wy[i] * h_t[i];
    }
    const y_t = 1.0 / (1.0 + Math.exp(-y_sum));
    return { h_t, y_t };
  }

  /**
   * 11. Jordan Recurrent Neural Network (RNN)
   * Formula:
   *   h_t = tanh(Wh * x_t + Uh * y_{t-1} + bh)
   *   y_t = sigmoid(Wy * h_t + by)
   */
  public static runJordanRNN(
    x_t: number,
    y_prev: number,
    weights: {
      Wh: number[];
      Uh: number[];
      bh: number[];
      Wy: number[];
      by: number;
    },
    hiddenSize: number = 2,
  ): { h_t: number[]; y_t: number } {
    const h_t: number[] = [];
    for (let i = 0; i < hiddenSize; i++) {
      const sum = weights.Wh[i] * x_t + weights.Uh[i] * y_prev + weights.bh[i];
      h_t.push(Math.tanh(sum));
    }
    let y_sum = weights.by;
    for (let i = 0; i < hiddenSize; i++) {
      y_sum += weights.Wy[i] * h_t[i];
    }
    const y_t = 1.0 / (1.0 + Math.exp(-y_sum));
    return { h_t, y_t };
  }

  /**
   * 12. Hybrid Spintax / Semantic Dialogue Generator
   * Generates highly custom, varied, and personality-driven dialogs between agents.
   */
  public static generateHybridDialogue(
    sellerId: string,
    buyerId: string,
    productName: string,
    sellerOffer: number,
    buyerBid: number,
    finalPrice: number,
    success: boolean,
    sGreed: number,
    sVengeance: number,
    sMalice: number,
    bGreed: number,
    bVengeance: number,
    bMalice: number,
  ): string {
    const formattedOffer = Math.round(sellerOffer).toLocaleString() + "₫";
    const formattedBid = Math.round(buyerBid).toLocaleString() + "₫";
    const formattedFinal = Math.round(finalPrice).toLocaleString() + "₫";

    // 1. Seller opening sentences based on personality
    const sellerOpeners = {
      greedy: [
        `[Người bán ${sellerId}]: Tôi có lô ${productName} thượng hạng vừa thu hoạch, giá chỉ ${formattedOffer}. Cam kết chất lượng cao nhất thị trường!`,
        `[Người bán ${sellerId}]: Lô ${productName} này cực kỳ được giá, tôi chào bán với giá tốt nhất hôm nay là ${formattedOffer}.`,
        `[Người bán ${sellerId}]: Hàng ${productName} loại A tuyển chọn kỹ lưỡng, giá chào ${formattedOffer}, số lượng có hạn anh ơi.`,
      ],
      vengeful: [
        `[Người bán ${sellerId}]: Chào anh, tôi bán ${productName} đúng giá ${formattedOffer}. Tiền nào của nấy, không thương lượng nhiều.`,
        `[Người bán ${sellerId}]: Tôi gửi báo giá lô ${productName} này là ${formattedOffer}. Hy vọng anh không trả giá quá thấp làm mất thời gian đôi bên.`,
        `[Người bán ${sellerId}]: Có lô ${productName} giá ${formattedOffer}. Ai mua thiện chí thì liên hệ, không kỳ kèo bớt một thêm hai.`,
      ],
      stable: [
        `[Người bán ${sellerId}]: Xin chào, bên tôi đang xuất bán lô ${productName} với giá chào là ${formattedOffer}.`,
        `[Người bán ${sellerId}]: Gửi anh thông tin lô ${productName} mới thu hoạch, giá đề xuất là ${formattedOffer}.`,
        `[Người bán ${sellerId}]: Chào anh, lô ${productName} này tôi xin phép chào bán với giá ${formattedOffer}.`,
      ],
    };

    // 2. Buyer responses based on personality
    const buyerResponses = {
      greedy: [
        `[Người mua ${buyerId}]: Ồ, giá ${formattedOffer} thì cao quá. Tầm này thị trường đang chững, tôi chỉ trả được ${formattedBid} thôi.`,
        `[Người mua ${buyerId}]: ${formattedOffer} á? Đắt quá anh ơi, hàng thế này tôi mua nơi khác rẻ hơn. Chỉ gửi anh ${formattedBid} được thôi.`,
        `[Người mua ${buyerId}]: Hàng này tôi trả ${formattedBid} là kịch trần rồi, được thì tôi bốc cả lô ngay lập tức.`,
      ],
      vengeful: [
        `[Người mua ${buyerId}]: Anh chào giá ${formattedOffer} thì khó làm việc quá. Tôi chỉ mua với giá đúng ${formattedBid}, không hơn một xu.`,
        `[Người mua ${buyerId}]: Giá đó quá vô lý. Để khỏi mất thời gian kỳ kèo, tôi chốt giá dạm mua là ${formattedBid}.`,
        `[Người mua ${buyerId}]: Thời buổi này mà anh hét giá ${formattedOffer} sao trôi được. Gửi anh ${formattedBid}, không được thì tôi đi tìm mối khác.`,
      ],
      stable: [
        `[Người mua ${buyerId}]: Cảm ơn thông tin của anh. Với mức giá này, tôi xin phép trả mức ${formattedBid} để cân bằng chi phí.`,
        `[Người mua ${buyerId}]: Mức giá chào hơi cao so với ngân sách của tôi. Tôi xin đề xuất giá mua là ${formattedBid}.`,
        `[Người mua ${buyerId}]: Anh xem có bớt chút lộc được không? Tôi xin phép trả giá ${formattedBid} cho lô hàng này.`,
      ],
    };

    // 3. Middle dialogue turn - negotiation compromise
    const sellerCounterOffers = {
      greedy: [
        `[Người bán ${sellerId}]: Trả giá thế thì tôi lỗ vốn chết! Thôi bớt anh chút đỉnh lấy may, chốt ${Math.round(sellerOffer * 0.98).toLocaleString()}₫ nhé?`,
        `[Người bán ${sellerId}]: Hàng đẹp thế này mà anh ép giá quá. Bớt kịch sàn còn ${Math.round(sellerOffer * 0.97).toLocaleString()}₫, không thể thấp hơn.`,
      ],
      vengeful: [
        `[Người bán ${sellerId}]: Anh trả thế là thiếu thiện chí rồi. Đúng giá ${Math.round(sellerOffer * 0.99).toLocaleString()}₫ thì lấy, không thì thôi.`,
        `[Người bán ${sellerId}]: Giá đó tôi không bán được. Tôi chỉ bớt nhẹ xuống ${Math.round(sellerOffer * 0.985).toLocaleString()}₫ để làm quen thôi.`,
      ],
      stable: [
        `[Người bán ${sellerId}]: Thôi hai bên mỗi người nhường một bước, tôi bớt cho anh còn ${Math.round(sellerOffer * 0.96).toLocaleString()}₫.`,
        `[Người bán ${sellerId}]: Để dễ làm việc lâu dài, tôi xin gia lộc bớt xuống còn ${Math.round(sellerOffer * 0.97).toLocaleString()}₫.`,
      ],
    };

    // 4. Final outcomes
    const finalOutcomes = {
      success: [
        `[Người mua ${buyerId}]: Được rồi, giá ${formattedFinal} là hợp lý cho cả hai bên. Chốt giao dịch nhé!`,
        `[Người mua ${buyerId}]: Mức giá ${formattedFinal} chấp nhận được. Tôi sẽ cho xe qua lấy hàng ngay.`,
        `[Người mua ${buyerId}]: Đồng ý chốt mức giá ${formattedFinal}. Hợp tác vui vẻ!`,
      ],
      failure: [
        `[Người mua ${buyerId}]: Không được rồi, mức giá đó tôi không thể cân đối lợi nhuận. Hẹn anh dịp khác vậy.`,
        `[Người mua ${buyerId}]: Ép giá nhau thế này thì không làm việc được. Xin phép dừng giao dịch tại đây.`,
        `[Người mua ${buyerId}]: Rất tiếc chúng ta không tìm được tiếng nói chung về giá cả. Chào anh.`,
      ],
    };

    // Pick categories based on DNA stats thresholds
    const sCategory = sGreed > 0.6 ? "greedy" : sVengeance > 0.6 ? "vengeful" : "stable";
    const bCategory = bGreed > 0.6 ? "greedy" : bVengeance > 0.6 ? "vengeful" : "stable";

    // Random selector helper
    const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    const opener = pickRandom(sellerOpeners[sCategory]);
    const response = pickRandom(buyerResponses[bCategory]);
    const counter = pickRandom(sellerCounterOffers[sCategory]);
    const outcome = pickRandom(success ? finalOutcomes.success : finalOutcomes.failure);

    return `${opener}\n${response}\n${counter}\n${outcome}`;
  }
}
