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
import * as fs from "fs";
import * as path from "path";
import { runHybridOfflineInference } from "~/core/nlp-cognitive/hybrid-ai";
import { BasalGanglia } from "~/core/nlp-cognitive/basal-ganglia";
dotenv.config();

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
    for (const msg of options.messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content || "";
      } else if (msg.role === "user") {
        userPrompt = msg.content || "";
      }
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

    if (brainAction.source !== "Fallback") {
      console.log(`[BasalGanglia Routing] Source: ${brainAction.source} -> Bypassed Prefrontal Cortex`);

      // Check if the source is episodic memory, and try to apply schema validation
      if (brainAction.source === "Hippocampus" && options.responseSchema) {
        try {
          const parsed = normalizeParsedResponse(JSON.parse(brainAction.response));
          const val = options.responseSchema.safeParse(parsed);
          if (val.success) {
            return { text: brainAction.response, data: val.data };
          }
        } catch (e) {
          // Fallthrough if parsing fails
        }
      }
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
    // 1. If it has a structured prompt with Bối cảnh tri thức from Private Brain
    const contextMatch = userPrompt.match(/Bối cảnh tri thức:\s*([\s\S]+?)(?:\n\n|\n[A-Z\u00C0-\u017F]|$)/i);
    if (contextMatch && contextMatch[1].trim() !== "Không có") {
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
  // --- PURE ROTTRA AI CORE (NANO BANANA LITE EDITION) ---
  if (!text) {
    text = await runHybridOfflineInference(userPrompt, botId, prodName, price, options.userId);
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
        return { text: JSON.stringify(parsed), data: val.data };
      }
    } catch (e) {
      // Response is not JSON — return as plain text
    }
  }

  return { text };
}
