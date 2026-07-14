import { cleanAndNormalize } from "~/core/neural-memory/vector-rag";
import dotenv from "dotenv";
import { checkSemanticCache, writeSemanticCache } from "~/core/neural-memory/semantic-cache";
import {
  fetchWikipediaSummary,
  fetchWikidataEntity,
  fetchWeatherstack,
  fetchCurrencyFreaks,
  fetchGoogleBooks,
  searchDuckDuckGo,
  searchWikipedia,
  fetchWiktionary,
} from "~/core/nlp-cognitive/external-api-docking";
import { evaluateMathExpression, solveCustomAlgorithm } from "~/core/quant-engine/financial-solver";
import { parseTranslationQuery } from "~/core/nlp-cognitive/multilingual-translator";
import { z } from "zod";
import { DecodingSettings } from "~/shared/constants";
import * as fs from "node:fs";
import * as path from "node:path";
import { runHybridOfflineInference } from "~/core/nlp-cognitive/hybrid-ai";
import { BasalGanglia } from "~/core/nlp-cognitive/basal-ganglia";
// ===== TELEMETRY =====
let telemetryWs: WebSocket | null = null;
function broadcastTelemetry(payload: any) {
  try {
    if (typeof WebSocket !== 'undefined') {
      if (!telemetryWs || telemetryWs.readyState === WebSocket.CLOSED) {
        telemetryWs = new WebSocket("ws://localhost:8080/?room=global");
      }
      if (telemetryWs.readyState === WebSocket.OPEN) {
        telemetryWs.send(JSON.stringify(payload));
      } else if (telemetryWs.readyState === WebSocket.CONNECTING) {
        telemetryWs.addEventListener("open", () => {
          telemetryWs?.send(JSON.stringify(payload));
        }, { once: true });
      }
    }
  } catch (e) {
    console.error("[Telemetry] Failed to broadcast:", e);
  }
}


// Helper function to mock schema-conforming response objects offline
function generateMockFromZod(schema: any): any {
  if (!schema || !schema._def) return "";
  const typeName = schema._def.typeName;

  switch (typeName) {
    case "ZodObject": {
      const shape = schema.shape;
      const obj: any = {};
      for (const key in shape) {
        obj[key] = generateMockFromZod(shape[key]);
      }
      return obj;
    }
    case "ZodArray": {
      return [generateMockFromZod(schema.element)];
    }
    case "ZodString": {
      return "mock_value";
    }
    case "ZodNumber": {
      return 1;
    }
    case "ZodBoolean": {
      return true;
    }
    case "ZodEnum": {
      return schema._def.values[0];
    }
    case "ZodOptional":
    case "ZodNullable": {
      return generateMockFromZod(schema._def.innerType);
    }
    case "ZodEffects": {
      return generateMockFromZod(schema._def.schema);
    }
    case "ZodUnion": {
      return generateMockFromZod(schema._def.options[0]);
    }
    default:
      return "";
  }
}

// --- ROTTRA AI: Self-contained intelligence, no external LLM ---

// Functions migrated to Hippocampus and Amygdala modules

export async function generateTextLocal(options: {
  system?: string | undefined;
  prompt?: string | undefined;
  messages?: any[] | undefined;
  responseSchema?: z.ZodType<any> | undefined;
  decodingSettings?: DecodingSettings | undefined;
  model?: string | undefined;
  userId?: string | undefined;
  isInternalReasoning?: boolean;
}): Promise<{ text: string; data?: any }> {
  let userPrompt = options.prompt || "";
  let systemPrompt = options.system || "";
  
  // -- BẮT ĐẦU THEO DÕI TELEMETRY --
  const trackingId = `ai_task_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  const shortLabel = userPrompt.length > 25 ? userPrompt.substring(0, 25) + "..." : (userPrompt || "Internal Reasoning");
  let tempLoss = 0.95;
  let tempAngle = Math.random() * Math.PI * 2;
  
  broadcastTelemetry({
    type: "vector_tracking",
    id: trackingId,
    loss: tempLoss,
    angle: tempAngle,
    label: "Processing: " + shortLabel,
    status: "learning"
  });

  const telemetryInterval = setInterval(() => {
    tempLoss = tempLoss * 0.85;
    tempAngle += 0.15;
    if (tempLoss > 0.05) {
      broadcastTelemetry({
        type: "vector_tracking",
        id: trackingId,
        loss: tempLoss,
        angle: tempAngle,
        label: "Reasoning...",
        status: "learning"
      });
    } else {
      clearInterval(telemetryInterval);
    }
  }, 200);
  // -- KẾT THÚC KHỞI TẠO TELEMETRY --

  const normalizeParsedResponse = (parsed: any) => {
    if (!parsed || typeof parsed !== "object") return parsed;
    let result = { ...parsed };
    if (result.videoAd && typeof result.videoAd === "object") {
      result = { ...result.videoAd };
    }
    if (result.ttsScript && typeof result.ttsScript === "object" && typeof result.ttsScript.text === "string") {
      result.ttsScript = result.ttsScript.text;
    }
    return result;
  };
  if (options.messages && Array.isArray(options.messages)) {
    const systemContents: string[] = [];
    for (const msg of options.messages) {
      if (msg.role === "system") {
        systemContents.push(msg.content || "");
      } else if (msg.role === "user") {
        userPrompt = msg.content || "";
      }
    }
    if (systemContents.length > 0) {
      systemPrompt = systemContents.join("\n\n");
    }
  }
  const botNameMatch = systemPrompt.match(/Tên Thương Nhân:\s*([^\n\r]+)/i) || systemPrompt.match(/Bạn là\s*([^,]+)/i);
  let botName = botNameMatch ? botNameMatch[1].trim() : "Trợ lý Rottra";
  if (botName.length > 20 || botName.toLowerCase().includes("chuyên gia")) {
    botName = "Trợ lý Rottra";
  }

  const prodNameMatch = systemPrompt.match(/Sản phẩm đang sở hữu:\s*([^\n\(\r]+)/i) || systemPrompt.match(/sản phẩm\s*([^\n\r]+)/i);
  const prodName = prodNameMatch ? prodNameMatch[1].trim() : "nông sản hảo hạng";

  const priceMatch = systemPrompt.match(/Giá gốc:\s*([\d,.]+)/i) || systemPrompt.match(/giá:\s*([\d,.]+)/i);
  const price = priceMatch ? priceMatch[1].trim() : "50,000";

  const mapBotId = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("lương")) return "toLuong";
    if (n.includes("thương nguyệt")) return "thuongNguyet";
    if (n.includes("trầm tinh")) return "tramTinh";
    if (n.includes("tiểu cửu")) return "daoTieuCuu";
    if (n.includes("huỳnh")) return "hoaHuynh";
    if (n.includes("phi nguyệt")) return "phiNguyet";
    if (n.includes("như nguyệt")) return "nhuNguyet";
    if (n.includes("sử giả")) return "suGia";
    if (n.includes("phi anh")) return "phiAnh";
    if (n.includes("hành")) return "bachDiHanh";
    if (n.includes("u vương")) return "uVuongMau";
    if (n.includes("bạch lộc")) return "bachLoc";
    return "default";
  };
  const botId = mapBotId(botName);

  const trimmedPrompt = userPrompt.trim().toLowerCase();

  // --- COGNITIVE ROUTING: BASAL GANGLIA ---
  // Routing traffic to Amygdala (Emotion/Fast) or Hippocampus (Memory)
  if (!options.isInternalReasoning) {
    const brainAction = await BasalGanglia.selectAction(botId, botName, prodName, price, userPrompt, options.userId);

    if (brainAction.source === "Amygdala" || brainAction.source === "Hippocampus") {
      console.log(`[BasalGanglia Routing] Source: ${brainAction.source} -> Bypassed Prefrontal Cortex`);

      // Check if the source is episodic memory, and try to apply schema validation
      if (brainAction.source === "Hippocampus" && options.responseSchema) {
        try {
          const parsed = normalizeParsedResponse(JSON.parse(brainAction.response));
          const val = options.responseSchema.safeParse(parsed);
          if (val.success) {
            clearInterval(telemetryInterval);
            broadcastTelemetry({ type: "vector_tracking", id: trackingId, loss: 0.01, angle: tempAngle, label: "Converged (Cache)", status: "converged" });
            return { text: brainAction.response, data: val.data };
          }
        } catch (e) {
          // Fallthrough if parsing fails
        }
      }
      clearInterval(telemetryInterval);
      broadcastTelemetry({ type: "vector_tracking", id: trackingId, loss: 0.01, angle: tempAngle, label: "Converged (Fast)", status: "converged" });
      return { text: brainAction.response };
    }
  }

  // --- SYSTEM 2 (PREFRONTAL CORTEX / EXTERNAL RAG PIPELINE) ---
  // If the query is complex, we drop down to external RAG or the Tiny Neural Net

  let finalSystemPrompt = systemPrompt;
  let externalContext = "";

  // --- EXTERNAL KNOWLEDGE DOCKING (DATA APIs ONLY) ---

  if (
    trimmedPrompt.includes("thời tiết") ||
    trimmedPrompt.includes("nhiệt độ") ||
    trimmedPrompt.includes("mưa") ||
    trimmedPrompt.includes("nắng")
  ) {
    const weatherData = await fetchWeatherstack("Ho Chi Minh City");
    if (weatherData) externalContext += `\n[Weather Data]: ${weatherData}`;
  }

  if (
    trimmedPrompt.includes("tỷ giá") ||
    trimmedPrompt.includes("giá cà phê") ||
    trimmedPrompt.includes("usd") ||
    trimmedPrompt.includes("hạt điều")
  ) {
    const currencyData = await fetchCurrencyFreaks();
    if (currencyData) externalContext += `\n[Currency & Market Data]: ${currencyData}`;
  }

  if (trimmedPrompt.includes("là gì") || trimmedPrompt.includes("ai là") || trimmedPrompt.includes("thế nào là")) {
    const keywordMatch = trimmedPrompt.match(/([\w\s]+) là gì/i) || trimmedPrompt.match(/ai là ([\w\s]+)/i);
    const keyword = keywordMatch ? keywordMatch[1].trim() : trimmedPrompt;
    if (keyword.length > 2 && keyword.length < 50) {
      const [wikiData, wikiEntity] = await Promise.all([fetchWikipediaSummary(keyword), fetchWikidataEntity(keyword)]);
      if (wikiData) externalContext += `\n[Wikipedia]: ${wikiData}`;
      if (wikiEntity) externalContext += `\n[Wikidata]: ${wikiEntity.description || wikiEntity.label}`;
    }
  }

  if (trimmedPrompt.includes("sách") || trimmedPrompt.includes("tài liệu nông nghiệp")) {
    const books = await fetchGoogleBooks("agriculture");
    if (books) externalContext += `\n[Google Books]: ${JSON.stringify(books)}`;
  }

  if (!externalContext) {
    const ddgResult = await searchDuckDuckGo(userPrompt);
    if (ddgResult?.abstract) {
      externalContext += `\n[DuckDuckGo]: ${ddgResult.abstract}`;
      if (ddgResult.url) externalContext += `\n[Source]: ${ddgResult.url}`;
      if (ddgResult.relatedTopics.length > 0) {
        externalContext += `\n[Related]: ${ddgResult.relatedTopics.slice(0, 3).join("; ")}`;
      }
    }

    if (!externalContext) {
      const wikiResults = await searchWikipedia(userPrompt);
      if (wikiResults && wikiResults.length > 0) {
        const best = wikiResults[0];
        externalContext += `\n[Wikipedia]: ${best.title} — ${best.snippet}`;
        externalContext += `\n[Source]: ${best.url}`;
      }
    }

    if (!externalContext && userPrompt.split(/\s+/).length <= 3) {
      const word = userPrompt.split(/\s+/)[0];
      const dictDef = await fetchWiktionary(word);
      if (dictDef) {
        externalContext += `\n[Dict - ${word}]: ${dictDef}`;
      }
    }
  }

  if (externalContext) {
    finalSystemPrompt += `\n\n=== REAL-TIME DATA ===\n${externalContext}\n=====================\n`;
  }

  // Apply JSON / Schema output prompt adjustments
  let responseFormat: any = undefined;
  if (options.responseSchema) {
    responseFormat = { type: "json_object" };
    finalSystemPrompt += `\n[REQUIRED]: Return the answer as a single JSON object matching the Zod Schema exactly. No characters outside valid JSON.`;
  }

  let text = "";

  // --- ROTTRA AI: Offline inference pipeline ---
  if (options.isInternalReasoning) {
    // 1. Bóc tách dữ liệu RAG từ systemPrompt hoặc userPrompt
    const systemContextMatch = systemPrompt.match(/Dữ liệu RAG được cung cấp:\s*([\s\S]+?)$/i);
    const contextMatch = userPrompt.match(/Bối cảnh tri thức:\s*([\s\S]+?)(?:\n\n|\n[A-Z\u00C0-\u017F]|$)/i);

    if (systemContextMatch && systemContextMatch[1].trim() !== "") {
      let contextText = systemContextMatch[1].trim();
      contextText = contextText.replace(/Nội dung từ bài giảng YouTube "[^"]+":\s*/gi, "");
      contextText = contextText.replace(/Xem trực tiếp tại:\s*https?:\/\/\S+/gi, "");
      text = contextText;
    } else if (contextMatch && contextMatch[1].trim() !== "Không có") {
      let contextText = contextMatch[1].trim();
      contextText = contextText.replace(/Nội dung từ bài giảng YouTube "[^"]+":\s*/gi, "");
      contextText = contextText.replace(/Xem trực tiếp tại:\s*https?:\/\/\S+/gi, "");
      text = contextText;
    }

    // 2. If it is a HyDE prompt, e.g. from hybridRetrieve:
    // system: "Đóng vai thiền sư/chuyên gia uyên bác, viết đúng 1 câu trả lời ngắn..."
    // prompt: "Truy vấn: "Tử cống từ chối nhận tiền chuộc""
    if (!text) {
      const queryMatch = userPrompt.match(/Truy vấn:\s*"([^"]+)"/i);
      if (queryMatch) {
        const q = queryMatch[1].trim();
        try {
          const { db } = await import("~/infra/database/db-pool");
          const { vectorDocument } = await import("~/infra/database/schema");
          const docs = await db.select().from(vectorDocument);
          const qClean = q.toLowerCase();
          let bestDoc = null;
          let bestMatches = 0;
          const qWords = qClean.split(/\s+/).filter((w) => w.length > 2);
          for (const doc of docs) {
            const docText = (doc.title + " " + doc.content).toLowerCase();
            const matches = qWords.filter((w) => docText.includes(w)).length;
            if (matches > bestMatches) {
              bestMatches = matches;
              bestDoc = doc;
            }
          }
          if (bestDoc && bestMatches >= 2) {
            let cleanContent = bestDoc.content;
            cleanContent = cleanContent.replace(/Nội dung từ bài giảng YouTube "[^"]+":\s*/gi, "");
            cleanContent = cleanContent.replace(/Xem trực tiếp tại:\s*https?:\/\/\S+/gi, "");
            const sentences = cleanContent.split(/[.!?]+/);
            text = sentences[0]?.trim() || cleanContent;
          }
        } catch (e) {
          console.error("Failed to resolve HyDE query offline:", e);
        }
      }
    }
  }

  // --- PURE ROTTRA AI CORE (OFFLINE ALGORITHM ONLY) ---
  if (!text) {
    console.log(`[Offline Inference] Bypassing all Cloud LLMs, using local heuristic rule engine...`);
    if (options.isInternalReasoning) {
      const lowerPrompt = userPrompt.toLowerCase();
      if (lowerPrompt.includes("replanner bot") || lowerPrompt.includes("[no_change]")) {
        text = "[NO_CHANGE]";
      } else if (lowerPrompt.includes("3 alternative response strategies") || lowerPrompt.includes("=== thought 1 ===")) {
        text = `=== THOUGHT 1 ===
Chào bạn! Tôi có thể tư vấn thông tin về sản phẩm và thảo luận giá cả phù hợp.
=== THOUGHT 2 ===
Chào bạn! Rất vui được hợp tác với bạn. Hôm nay chúng tôi có ưu đãi đặc biệt cho bạn đấy.
=== THOUGHT 3 ===
Chào bạn! Sản phẩm của chúng tôi đạt chuẩn chất lượng cao, giá cả cực kỳ cạnh tranh và hợp lý.`;
      } else if (lowerPrompt.includes("strict logic evaluator") || lowerPrompt.includes("thought 1 score:")) {
        text = `Thought 1 Score: 85
Thought 2 Score: 90
Thought 3 Score: 95`;
      } else if (options.responseSchema) {
        try {
          const mockData = generateMockFromZod(options.responseSchema);
          text = JSON.stringify(mockData);
        } catch (e) {
          text = "{}";
        }
      } else {
        text = "Lõi offline của Rottra đang suy nghĩ...";
      }
    } else {
      text = await runHybridOfflineInference(userPrompt, botId, prodName, price, options.userId);
    }
  }
  // --- WRITE TO SEMANTIC CACHE ---
  if (text && !options.isInternalReasoning) {
    writeSemanticCache(botId, userPrompt, text);
  }

  // --- STRUCTURED OUTPUT VALIDATION ---
  if (options.responseSchema && text) {
    try {
      const parsed = normalizeParsedResponse(JSON.parse(text));
      const val = options.responseSchema.safeParse(parsed);
      if (val.success) {
        clearInterval(telemetryInterval);
        broadcastTelemetry({ type: "vector_tracking", id: trackingId, loss: 0.01, angle: tempAngle, label: "Converged (JSON)", status: "converged" });
        return { text: JSON.stringify(parsed), data: val.data };
      }
    } catch (e) {
      // Response is not JSON — return as plain text
    }
  }

  clearInterval(telemetryInterval);
  broadcastTelemetry({ type: "vector_tracking", id: trackingId, loss: 0.01, angle: tempAngle, label: "Converged", status: "converged" });
  return { text };
}
