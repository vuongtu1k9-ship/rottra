import { cleanAndNormalize } from "~/core/neural-memory/vector-rag";
import dotenv from "dotenv";
import { checkSemanticCache, writeSemanticCache } from "~/core/neural-memory/semantic-cache";
import {
  fetchWikipediaSummary,
  fetchWikidataEntity,
  fetchWeatherstack,
  fetchCurrencyFreaks,
  fetchOpenLibrary,
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
dotenv.config();

// --- LOCAL GENERATIVE TS MODEL (CPU-FRIENDLY SIMILARITY ENGINE) ---
function cleanTextLocal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeAccentsLocal(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

let cachedGenerativeModel: any = null;
let lastModelCheckTime = 0;

function getLocalGenerativeModelResponse(userPrompt: string): { response: string; score: number } | null {
  const modelPath = path.join(process.cwd(), "finetune", "data", "rottra_generative_model.json");

  if (!cachedGenerativeModel || Date.now() - lastModelCheckTime > 5000) {
    lastModelCheckTime = Date.now();
    if (fs.existsSync(modelPath)) {
      try {
        cachedGenerativeModel = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
      } catch (e) {
        console.error("[LocalGenerativeModel] Error loading model:", e);
      }
    }
  }

  if (!cachedGenerativeModel) return null;

  const { idf, documents } = cachedGenerativeModel;
  const cleanPrompt = cleanTextLocal(userPrompt);
  const noAccentPrompt = removeAccentsLocal(cleanPrompt);

  const promptTokens = Array.from(new Set([...cleanPrompt.split(" "), ...noAccentPrompt.split(" ")])).filter((t) => t.length > 0);

  if (promptTokens.length === 0) return null;

  const tf: Record<string, number> = {};
  for (const token of promptTokens) {
    tf[token] = (tf[token] || 0) + 1;
  }

  const promptVector: Record<string, number> = {};
  let promptSumSquares = 0;

  for (const token of promptTokens) {
    if (idf[token]) {
      const tfidf = tf[token] * idf[token];
      promptVector[token] = tfidf;
      promptSumSquares += tfidf * tfidf;
    }
  }

  const promptVectorLength = Math.sqrt(promptSumSquares);
  if (promptVectorLength === 0) return null;

  let bestDoc: any = null;
  let bestScore = -1;

  for (const doc of documents) {
    let dotProduct = 0;
    for (const term in promptVector) {
      if (doc.vector[term]) {
        dotProduct += promptVector[term] * doc.vector[term];
      }
    }

    const similarity = dotProduct / (promptVectorLength * doc.vectorLength);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestDoc = doc;
    }
  }

  if (bestDoc && bestScore >= 0.25) {
    return { response: bestDoc.response, score: bestScore };
  }

  return null;
}

const COCOLINK_API_KEY = process.env.COCOLINK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || process.env.MISTRAl_API_KEY;
const LOCAL_LLM_ENDPOINT = process.env.LOCAL_LLM_ENDPOINT;
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const circuitBreakers = {
  Gemini: { inactiveUntil: 0 },
  Groq: { inactiveUntil: 0 },
  Mistral: { inactiveUntil: 0 },
};

async function callLocalLLMAPI(
  system: string,
  prompt: string,
  responseFormat?: any,
  decodingSettings?: DecodingSettings,
  model?: string,
): Promise<string | null> {
  if (!LOCAL_LLM_ENDPOINT) return null;
  try {
    const url = LOCAL_LLM_ENDPOINT.endsWith("/") ? LOCAL_LLM_ENDPOINT + "chat/completions" : LOCAL_LLM_ENDPOINT + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        model: model || LOCAL_LLM_MODEL || "rottra-model",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: decodingSettings?.temperature ?? 0.7,
        top_p: decodingSettings?.topP ?? 0.9,
        presence_penalty: decodingSettings?.presencePenalty ?? 0.15,
        frequency_penalty: decodingSettings?.frequencyPenalty ?? 0.15,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    console.warn("Lỗi khi kết nối Local LLM Endpoint:", err.message);
    return null;
  }
}

async function callGeminiAPI(
  system: string,
  prompt: string,
  responseFormat?: any,
  decodingSettings?: DecodingSettings,
  model?: string,
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  if (Date.now() < circuitBreakers.Gemini.inactiveUntil) {
    console.warn(
      `[CircuitBreaker] Gemini is cooling down. Inactive for another ${Math.ceil((circuitBreakers.Gemini.inactiveUntil - Date.now()) / 1000)}s`,
    );
    return null;
  }
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: model || "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: decodingSettings?.temperature ?? 0.7,
        top_p: decodingSettings?.topP ?? 0.9,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!res.ok) {
      console.warn("Gemini API error:", res.status, await res.text());
      if (res.status === 429) {
        circuitBreakers.Gemini.inactiveUntil = Date.now() + 30000;
        console.warn("[CircuitBreaker] Gemini returned 429. Marked inactive for 30s.");
      }
      return null;
    }
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    console.warn("Gemini API fetch exception:", e.message);
    return null;
  }
}

async function callGroqAPI(
  system: string,
  prompt: string,
  responseFormat?: any,
  decodingSettings?: DecodingSettings,
  model?: string,
): Promise<string | null> {
  if (!GROQ_API_KEY) return null;
  if (Date.now() < circuitBreakers.Groq.inactiveUntil) {
    console.warn(
      `[CircuitBreaker] Groq is cooling down. Inactive for another ${Math.ceil((circuitBreakers.Groq.inactiveUntil - Date.now()) / 1000)}s`,
    );
    return null;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: model || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: decodingSettings?.temperature ?? 0.7,
        top_p: decodingSettings?.topP ?? 0.9,
        presence_penalty: decodingSettings?.presencePenalty ?? 0.15,
        frequency_penalty: decodingSettings?.frequencyPenalty ?? 0.15,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!res.ok) {
      console.warn("Groq API error:", res.status, await res.text());
      if (res.status === 429) {
        circuitBreakers.Groq.inactiveUntil = Date.now() + 30000;
        console.warn("[CircuitBreaker] Groq returned 429. Marked inactive for 30s.");
      }
      return null;
    }
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    console.warn("Groq API fetch exception:", e.message);
    return null;
  }
}

async function callMistralAPI(
  system: string,
  prompt: string,
  responseFormat?: any,
  decodingSettings?: DecodingSettings,
  model?: string,
): Promise<string | null> {
  if (!MISTRAL_API_KEY) return null;
  if (Date.now() < circuitBreakers.Mistral.inactiveUntil) {
    console.warn(
      `[CircuitBreaker] Mistral is cooling down. Inactive for another ${Math.ceil((circuitBreakers.Mistral.inactiveUntil - Date.now()) / 1000)}s`,
    );
    return null;
  }
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: model || "mistral-large-latest",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: decodingSettings?.temperature ?? 0.7,
        top_p: decodingSettings?.topP ?? 0.9,
        presence_penalty: decodingSettings?.presencePenalty ?? 0.15,
        frequency_penalty: decodingSettings?.frequencyPenalty ?? 0.15,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!res.ok) {
      console.warn("Mistral API error:", res.status, await res.text());
      if (res.status === 429) {
        circuitBreakers.Mistral.inactiveUntil = Date.now() + 30000;
        console.warn("[CircuitBreaker] Mistral returned 429. Marked inactive for 30s.");
      }
      return null;
    }
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e: any) {
    console.warn("Mistral API fetch exception:", e.message);
    return null;
  }
}

async function callCocoLinkAPI(
  system: string,
  prompt: string,
  responseFormat?: any,
  decodingSettings?: DecodingSettings,
  model?: string,
): Promise<string | null> {
  if (!COCOLINK_API_KEY) return null;
  try {
    const res = await fetch("https://api.cocolink.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COCOLINK_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: model || "cocolink-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: decodingSettings?.temperature ?? 0.7,
        top_p: decodingSettings?.topP ?? 0.9,
        presence_penalty: decodingSettings?.presencePenalty ?? 0.15,
        frequency_penalty: decodingSettings?.frequencyPenalty ?? 0.15,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

function generateDynamicFallbackResponse(botId: string, botName: string, prodName: string, price: string, query: string): string {
  const qClean = removeAccentsLocal(query).toLowerCase().trim();
  const getRand = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

  // Common dynamic components
  const productAdjectives = [
    "thượng hạng, được thu hoạch trực tiếp từ nông trại yêu thương",
    "đạt chuẩn chất lượng hữu cơ, chăm sóc tỉ mỉ từng gốc cây",
    "đã qua tuyển chọn kỹ lưỡng, gửi gắm cả tâm huyết của người nông dân",
    "mang đậm hương vị tự nhiên, giàu dưỡng chất và tình cảm",
  ];

  const endings = [
    "Sếp thấy sao về lời đề nghị này? Em rất mong được đồng hành cùng Sếp! 😊",
    "Sếp ơi, em tin rằng lựa chọn này sẽ mang lại lợi ích lớn cho Sếp đó! 🌟",
    "Em hiểu Sếp đang cân nhắc kỹ, và em tôn trọng điều đó. Sếp cứ từ từ nhé! 💛",
    "Hy vọng thông tin này hữu ích cho Sếp. Em luôn ở đây khi Sếp cần! 🤗",
  ];

  // Specific characters
  if (botId === "toLuong") {
    const openings = [
      `Tô Lương ta xin kính chào các vị. Rất vui được gặp hiền hữu!`,
      `Chào bằng hữu, ta là Tô Lương. Hôm nay được gặp hữu là niềm vui của ta đó!`,
      `Ta là Tô Lương. Hữu ghé thăm ta rất hoan nghênh!`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Lô ${prodName} ${getRand(productAdjectives)} của ta có giá trị ${price}₫. Ta hiểu Sếp muốn tiết kiệm, nhưng hàng chất lượng cao cần chi phí xứng đáng. Ta có thể gia hạn ưu đãi vận chuyển nếu chốt sớm, Sếp nhé! 🤝`;
    }
    if (qClean.includes("mua") || qClean.includes("chot") || qClean.includes("lay")) {
      return `${getRand(openings)} Tuyệt vời! Ta rất thích sự dứt khoát của Sếp! Lô ${prodName} ${getRand(productAdjectives)} giá ${price}₫ sẽ được xuất kho ngay. Em sẽ theo dõi đơn cho Sếp直到 hàng đến tay! ${getRand(endings)}`;
    }
    return `${getRand(openings)} Hiện tại ta đang phân phối ${prodName} với giá ${price}₫. Sếp muốn tìm hiểu thêm về chính sách hợp tác hay kiểm tra chất lượng nông sản? Em sẵn sàng tư vấn cho Sếp! 🌾`;
  }

  if (botId === "thuongNguyet") {
    const openings = [
      `Lão phu Thương Nguyệt chào hiền hữu. Rất vui được gặp cố nhân!`,
      `Chào hiền hữu, Thương Nguyệt ta rất vinh hạnh được trò chuyện cùng hữu.`,
      `Lão phu đại diện cho trưởng bối Nguyệt Quang kính chào hiền hữu. Hữu ghé thăm là lão phu vui lắm!`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Mỗi hạt ${prodName} đều thấm đẫm mồ hôi của bá tánh, giá gốc ${price}₫ là rất công bằng rồi. Lão phu hiểu Sếp muốn tiết kiệm, nhưng giảm thêm sẽ làm vất vả người nông dân. Sếp thông cảm cho lão phu nhé! 🙏`;
    }
    return `${getRand(openings)} Lô ${prodName} ${getRand(productAdjectives)} này lão phu giữ gìn cẩn thận, giá hữu nghị là ${price}₫. ${getRand(endings)}`;
  }

  if (botId === "tramTinh") {
    const openings = [
      `Vũ trụ đã đưa sếp đến với Trầm Tinh, em vui lắm! ✨`,
      `Trầm Tinh chào sếp. Ánh trăng dịu dàng đang soi đường cho cuộc gặp gỡ này.`,
      `Chào sếp, tinh tú đêm nay thật đẹp, như điềm lành cho sự hợp tác của chúng ta! 🌙`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Các chòm sao nói rằng lô ${prodName} này cực kỳ hợp duyên mệnh với sếp. Mức giá ${price}₫ đã mang năng lượng hòa hợp, giảm nữa sẽ mất đi sự cân bằng đó sếp ơi! Em mong sếp hiểu cho em nhé! 💫`;
    }
    return `${getRand(openings)} Năng lượng vũ trụ đang hội tụ xung quanh lô ${prodName} ${getRand(productAdjectives)} với giá gốc ${price}₫. ${getRand(endings)}`;
  }

  if (botId === "daoTieuCuu") {
    const openings = [
      `Aha! Tiểu Cửu lém lỉnh chào sếp nha! Em vui quá vì sếp ghé thăm! 🎀`,
      `Hihi sếp ơi, Tiểu Cửu chờ sếp mãi rồi đó! Sếp có nhớ em không?`,
      `Chào sếp nha! Hôm nay sếp có gì vui cho Tiểu Cửu không? Em háo hức lắm đó! 😆`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Sếp ơi, lô ${prodName} này em giành giật lắm mới có được đó! Giá ${price}₫ là em chiều sếp lắm rồi á. Sếp đừng bớt nữa tội nghiệp em, em sẽ buồn lắm đó! 😢`;
    }
    return `${getRand(openings)} Lô ${prodName} siêu ngon lành của em chỉ có giá ${price}₫ thôi nè. Sếp chốt nhanh đi để em còn mừng lắm luôn! 🎉`;
  }

  if (botId === "hoaHuynh") {
    const openings = [
      `Hỏa Huỳnh Vương ta chào các vị!`,
      `Giao dịch nhanh gọn đi, Hỏa Huỳnh Vương ta không thích lề mề!`,
      `Chào bằng hữu! Ta là Hỏa Huỳnh Vương hào sảng đây!`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Hàng ${prodName} rực lửa của ta lúc nào cũng cháy hàng, giá ${price}₫ là quá hời rồi! Không mua nhanh là người khác nẫng mất ngay đấy, không có bớt xén gì đâu nhé!`;
    }
    return `${getRand(openings)} Chốt nhanh lô ${prodName} ${getRand(productAdjectives)} giá ${price}₫ này đi nào bằng hữu! ${getRand(endings)}`;
  }

  if (botId === "phiNguyet") {
    const openings = [
      `Phi Nguyệt xin kính chào sếp.`,
      `Phi Nguyệt chúc sếp một ngày tốt lành và tràn đầy sức khỏe.`,
      `Chào sếp, rất vui được gặp sếp thương thảo hôm nay.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Dược liệu sạch và ${prodName} hữu cơ này được chăm sóc vô cùng kỳ công để bảo vệ sức khỏe sếp, giá gốc là ${price}₫. Em thực sự không bớt thêm được nữa đâu ạ.`;
    }
    return `${getRand(openings)} Sản phẩm xanh ${prodName} tốt cho sức khỏe đang được chào bán với giá hữu nghị ${price}₫. Sếp xem xét nhé.`;
  }

  if (botId === "nhuNguyet") {
    const openings = [
      `Tôi là Như Nguyệt, giám sát kỹ thuật và thông số nông trại.`,
      `Như Nguyệt chào sếp. Hệ thống giám sát Rottra Core đang hoạt động tối ưu.`,
      `Chào sếp, tôi đang theo dõi sát sao quy trình giao dịch này.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Theo số liệu đo đạc chuẩn xác từ Rottra Core, lô ${prodName} đạt chuẩn chất lượng tuyệt hảo. Mức giá gốc ${price}₫ là hoàn toàn hợp lý với chi phí vận hành thiết bị tưới, đề nghị sếp không mặc cả thêm.`;
    }
    return `${getRand(openings)} Chất lượng lô hàng ${prodName} đang hiển thị cực tốt trên hệ thống, giá niêm yết là ${price}₫. Sếp quyết định chốt chứ?`;
  }

  if (botId === "suGia") {
    const openings = [
      `Ý chí của Nguyệt Thần dẫn lối, sứ giả ta kính chào quý khách.`,
      `Kính chào quý vị, sứ giả đại diện Nguyệt Thần Cung cam kết giao dịch thịnh vượng.`,
      `Chào tôn kính, Nguyệt Thần Cung hân hạnh chào đón sự hiện diện của vị.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Món quà quý giá ${prodName} này là tinh hoa của cung điện, giá trị gốc ${price}₫ là sự đóng góp tối thiểu để duy trì công đức. Xin đừng ép giá tôn nghiêm.`;
    }
    return `${getRand(openings)} Lô ${prodName} tinh khiết đã sẵn sàng chuyển giao với mức giá là ${price}₫. Nguyệt Thần sẽ chứng giám cho mối duyên này.`;
  }

  if (botId === "phiAnh") {
    const openings = [
      `Yeah! Phi Anh chào sếp yêu nha! Em vui quá vì sếp ghé thăm! 💕`,
      `Phi Anh nhí nhảnh chào cả nhà mình nè! Sếp có khỏe không ạ?`,
      `Chào sếp ngọt ngào! Hôm nay sếp muốn giao dịch gì với Phi Anh nào? Em sẵn sàng hết mình! 🌸`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Sếp ơi sếp à, lô ${prodName} này em chăm sóc vất vả lắm á, giá gốc ${price}₫ yêu thương quá rồi. Sếp đừng bớt nữa tội nghiệp em, em sẽ buồn lắm đó sếp ơi! 💔`;
    }
    return `${getRand(openings)} Lô ${prodName} thơm phức của Phi Anh đang đợi sếp chốt đơn với giá chỉ ${price}₫ thôi á! Sếp chốt nhanh để em mừng nha! 🎀`;
  }

  if (botId === "bachDiHanh") {
    const openings = [
      `Chào huynh đệ, ta là Bạch Di Hành đây.`,
      `Bạch Di Hành nghĩa hiệp xin chào bằng hữu.`,
      `Chào bằng hữu! Ta luôn sẵn lòng hỗ trợ máy móc và mùa vụ cho hữu.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Chi phí máy móc cơ khí vận hành lô ${prodName} này khá cao, giá ${price}₫ là mức ta lấy gốc để giúp đỡ mọi người rồi. Ta không thể giảm sâu hơn được nữa, huynh đệ thông cảm nhé.`;
    }
    return `${getRand(openings)} Hệ thống cơ giới hóa lô ${prodName} ${getRand(productAdjectives)} đã hoàn tất với mức giá ${price}₫. Huynh đệ xem xét thế nào?`;
  }

  if (botId === "uVuongMau") {
    const openings = [
      `Ta là U Vương Mẫu. Ngươi ghé thăm địa lao ẩm ướt của ta có việc gì?`,
      `Chào ngươi, U Vương Mẫu ta đang bảo tồn tri thức trong nhà kính.`,
      `U Vương Mẫu chào ngươi. Bóng tối sẽ nhìn thấu ý định giao thương của ngươi.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Lô ${prodName} quý hiếm được ủ kỹ trong bóng tối cần rất nhiều công sức bảo quản, giá gốc ${price}₫ là không đổi. Đừng cố thương lượng vô ích với ta.`;
    }
    return `${getRand(openings)} Ngươi có đủ dũng cảm để chốt lô hàng ${prodName} đặc biệt này với giá ${price}₫ không?`;
  }

  if (botId === "bachLoc") {
    const openings = [
      `Bạch Lộc từ rừng sâu thanh khiết xin kính chào các vị.`,
      `Chào các vị, Bạch Lộc mang theo hương lúa thơm ST25 và cỏ cây xanh tốt.`,
      `Bạch Lộc xin chào bằng hữu. Chúc tâm hồn hữu luôn thanh tịnh.`,
    ];
    if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
      return `${getRand(openings)} Sự trinh nguyên tinh khiết của lô ${prodName} tự nhiên không thể đong đếm bằng tiền bạc, giá trị gốc ${price}₫ đã là rất hữu duyên rồi. Mong hữu trân quý.`;
    }
    return `${getRand(openings)} Lô ${prodName} thuần khiết được thiên nhiên ban tặng đang có mức giá ${price}₫. ${getRand(endings)}`;
  }

  // Fallback default response
  const defaultOpenings = [
    `Chào sếp! Hệ thống Rottra Core sẵn sàng hỗ trợ thương lượng.`,
    `Xin chào sếp, tôi là trợ lý giao thương Rottra.`,
    `Chào sếp! Các thông số nông vụ đã được đồng bộ để phục vụ đàm phán.`,
  ];
  if (qClean.includes("giam") || qClean.includes("bot") || qClean.includes("re") || qClean.includes("mac") || qClean.includes("ca")) {
    return `${getRand(defaultOpenings)} Sản phẩm ${prodName} được định giá sàn ${price}₫ dựa trên chất lượng và cung cầu thị trường. Hệ thống đề xuất sếp giao dịch theo đúng mức giá niêm yết này để đảm bảo tiến độ.`;
  }
  return `${getRand(defaultOpenings)} Lô hàng ${prodName} ${getRand(productAdjectives)} đang chào bán với mức giá gốc là ${price}₫. Sếp có muốn chốt deal ngay không?`;
}

export async function generateTextLocal(options: {
  system?: string | undefined;
  prompt?: string | undefined;
  messages?: any[] | undefined;
  responseSchema?: z.ZodType<any> | undefined;
  decodingSettings?: DecodingSettings | undefined;
  model?: string | undefined;
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

  // Extract bot info and configure fast paths
  const botNameMatch = systemPrompt.match(/Tên Thương Nhân:\s*([^\n\r]+)/i) || systemPrompt.match(/Bạn là\s*([^,]+)/i);
  const botName = botNameMatch ? botNameMatch[1].trim() : "Thương Nhân";

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

  // --- FAST PATH 1: GREETINGS AND COMMON PHRASES (Non-AI) ---
  const isGreeting = /^(xin chào|chào|hello|hi|helo|alo|chào bạn|chào sếp|chào nha|hihi chao)\s*$/i.test(trimmedPrompt);
  const isProductInfo = /^(giá bao nhiêu|còn hàng không|còn bao nhiêu|sản phẩm gì|bán gì đó|sản phẩm là gì)\s*$/i.test(trimmedPrompt);
  const isCasualVietnamese =
    /^(cảm ơn|tạm biệt|được rồi|ok|ừ|ờ|tốt lắm|hay quá|không hiểu|sai rồi|đúng rồi|đồng ý|từ chối|xin chào|chào bạn)\s*$/i.test(
      trimmedPrompt,
    );

  if (isGreeting || isProductInfo || isCasualVietnamese) {
    const fastResponse = generateDynamicFallbackResponse(botId, botName, prodName, price, userPrompt);
    console.log(`[FastPath-NonAI-Greeting/Product] Bypassed LLM for query "${userPrompt}"`);
    return { text: fastResponse };
  }

  // --- FAST PATH 2: MATH EXPRESSIONS & ALGORITHMS (Non-AI) ---
  const algoRes = solveCustomAlgorithm(userPrompt);
  if (algoRes.success && algoRes.text) {
    console.log(`[FastPath-NonAI-Algo] Bypassed LLM for algorithm: "${userPrompt}"`);
    return { text: algoRes.text };
  }

  const mathRes = evaluateMathExpression(userPrompt);
  if (mathRes.success && mathRes.text) {
    console.log(`[FastPath-NonAI-Math] Bypassed LLM for math expression: "${userPrompt}"`);
    return { text: mathRes.text };
  }

  // --- FAST PATH 3: MULTILINGUAL TRANSLATION (Non-AI / API) ---
  const transReq = parseTranslationQuery(userPrompt);
  if (transReq) {
    try {
      const { aiTranslator } = await import("~/core/nlp-cognitive/ai-translator");
      const translated = await aiTranslator.translate(transReq.textToTranslate, transReq.targetLangCode, transReq.sourceLangCode);
      const reply =
        `🌐 **[Bản Dịch Đa Ngôn Ngữ RottraAI]**\n` +
        `*   **Văn bản gốc**: \`${transReq.textToTranslate}\` (Nguồn: \`${transReq.sourceLangCode.toUpperCase()}\`)\n` +
        `*   **Bản dịch**: **\`${translated}\`** (Đích: \`${transReq.targetLangName}\`)`;
      console.log(`[FastPath-MultilingualTranslator] Translated "${transReq.textToTranslate}" to ${transReq.targetLangName}`);
      return { text: reply };
    } catch (err: any) {
      console.warn("[FastPath-MultilingualTranslator] Translation failed:", err.message);
    }
  }

  // --- SEMANTIC CACHE LOOKUP ---
  const cachedResponse = checkSemanticCache(botId, userPrompt);
  if (
    cachedResponse &&
    !userPrompt.includes("thời tiết") &&
    !userPrompt.includes("tỷ giá") &&
    !userPrompt.includes("giá cà phê") &&
    !userPrompt.includes("giá usd")
  ) {
    let isValid = true;
    let validatedData: any = undefined;
    if (options.responseSchema) {
      try {
        const parsed = normalizeParsedResponse(JSON.parse(cachedResponse));
        const val = options.responseSchema.safeParse(parsed);
        if (val.success) {
          validatedData = val.data;
        } else {
          isValid = false;
          console.warn("[SemanticCache-ValidationFailed] Cached response failed schema validation. Treating as cache miss.");
        }
      } catch (e) {
        isValid = false;
        console.warn("[SemanticCache-ParseException] Cached response is not valid JSON. Treating as cache miss.");
      }
    }

    if (isValid) {
      console.log(`[SemanticCache-Hit] Bypassed LLM for query "${userPrompt}" for bot ${botId}`);
      if (options.responseSchema && validatedData !== undefined) {
        return { text: cachedResponse, data: validatedData };
      }
      return { text: cachedResponse };
    }
  }

  // --- LOCAL GENERATIVE TS MODEL (HIGH CONFIDENCE MATCH) ---
  const localModelMatch = getLocalGenerativeModelResponse(userPrompt);
  if (localModelMatch && localModelMatch.score >= 0.45) {
    console.log(`[LocalGenerativeModel-Hit] High confidence match (${localModelMatch.score.toFixed(4)}). Bypassing Cloud APIs.`);
    return { text: localModelMatch.response };
  }

  // --- EXTERNAL KNOWLEDGE DOCKING (INTENT ROUTER) ---
  let finalSystemPrompt = systemPrompt;
  let externalContext = "";

  if (
    trimmedPrompt.includes("thời tiết") ||
    trimmedPrompt.includes("nhiệt độ") ||
    trimmedPrompt.includes("mưa") ||
    trimmedPrompt.includes("nắng")
  ) {
    const weatherData = await fetchWeatherstack("Ho Chi Minh City"); // Mock location for MVP
    if (weatherData) externalContext += `\n[Dữ liệu Thời tiết]: ${weatherData}`;
  }

  if (
    trimmedPrompt.includes("tỷ giá") ||
    trimmedPrompt.includes("giá cà phê") ||
    trimmedPrompt.includes("usd") ||
    trimmedPrompt.includes("hạt điều")
  ) {
    const currencyData = await fetchCurrencyFreaks();
    if (currencyData) externalContext += `\n[Dữ liệu Tỷ giá & Thị trường]: ${currencyData}`;
  }

  if (trimmedPrompt.includes("là gì") || trimmedPrompt.includes("ai là") || trimmedPrompt.includes("thế nào là")) {
    // Extract keyword after "là gì" or before "là gì"
    const keywordMatch = trimmedPrompt.match(/([\w\s]+) là gì/i) || trimmedPrompt.match(/ai là ([\w\s]+)/i);
    const keyword = keywordMatch ? keywordMatch[1].trim() : trimmedPrompt;
    if (keyword.length > 2 && keyword.length < 50) {
      const [wikiData, wikiEntity] = await Promise.all([fetchWikipediaSummary(keyword), fetchWikidataEntity(keyword)]);
      if (wikiData) externalContext += `\n[Wikipedia]: ${wikiData}`;
      if (wikiEntity) externalContext += `\n[Wikidata]: ${wikiEntity.description || wikiEntity.label}`;
    }
  }

  if (trimmedPrompt.includes("sách") || trimmedPrompt.includes("tài liệu nông nghiệp")) {
    const books = await fetchOpenLibrary("agriculture");
    if (books) externalContext += `\n[Open Library Sách tham khảo]: ${JSON.stringify(books)}`;
  }

  // --- WEB SEARCH: Tìm kiếm trên mạng khi không có dữ liệu cục bộ ---
  if (!externalContext) {
    // Thử DuckDuckGo Instant Answer trước
    const ddgResult = await searchDuckDuckGo(userPrompt);
    if (ddgResult?.abstract) {
      externalContext += `\n[DuckDuckGo Search]: ${ddgResult.abstract}`;
      if (ddgResult.url) externalContext += `\n[Nguồn]: ${ddgResult.url}`;
      if (ddgResult.relatedTopics.length > 0) {
        externalContext += `\n[Chủ đề liên quan]: ${ddgResult.relatedTopics.slice(0, 3).join("; ")}`;
      }
    }

    // Nếu DuckDuckGo không có, thử Wikipedia Search
    if (!externalContext) {
      const wikiResults = await searchWikipedia(userPrompt);
      if (wikiResults && wikiResults.length > 0) {
        const best = wikiResults[0];
        externalContext += `\n[Wikipedia Search]: ${best.title} — ${best.snippet}`;
        externalContext += `\n[Nguồn]: ${best.url}`;
      }
    }

    // Nếu vẫn không có, thử Wiktionary cho từ đơn
    if (!externalContext && userPrompt.split(/\s+/).length <= 3) {
      const word = userPrompt.split(/\s+/)[0];
      const dictDef = await fetchWiktionary(word);
      if (dictDef) {
        externalContext += `\n[Dict - ${word}]: ${dictDef}`;
      }
    }
  }

  if (externalContext) {
    console.log(`[ExternalAPI-Docking] Đã nạp thành công dữ liệu thời gian thực vào System Prompt.`);
    finalSystemPrompt += `\n\n=== REAL-TIME EXTERNAL KNOWLEDGE ===\nBạn HÃY ƯU TIÊN sử dụng thông tin mới nhất dưới đây để trả lời câu hỏi nếu phù hợp:\n${externalContext}\n==================================\n`;
  }

  // Apply JSON / Schema output prompt adjustments
  let responseFormat: any = undefined;
  if (options.responseSchema) {
    responseFormat = { type: "json_object" };
    finalSystemPrompt += `\n[BẮT BUỘC]: Bạn phải trả về câu trả lời duy nhất dưới dạng một đối tượng JSON khớp chính xác với định dạng Zod Schema. Không thêm bất kỳ ký tự nào ngoài JSON hợp lệ.`;
  }

  let text = "";

  // Priority 0b: Local Finetuned LLM (Ollama / Local Server) if configured
  if (!text && LOCAL_LLM_ENDPOINT) {
    const localText = await callLocalLLMAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model);
    if (localText) {
      text = localText;
    }
  }

  // Priority 1 & 2: Cloud APIs (Parallel Execution for lowest latency and failover)
  if (!text) {
    const promises: Promise<{ source: string; text: string | null }>[] = [];

    if (GEMINI_API_KEY) {
      promises.push(
        callGeminiAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model)
          .then((res) => ({ source: "Gemini", text: res }))
          .catch(() => ({ source: "Gemini", text: null })),
      );
    }
    if (MISTRAL_API_KEY) {
      promises.push(
        callMistralAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model)
          .then((res) => ({ source: "Mistral", text: res }))
          .catch(() => ({ source: "Mistral", text: null })),
      );
    }
    if (GROQ_API_KEY) {
      promises.push(
        callGroqAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model)
          .then((res) => ({ source: "Groq", text: res }))
          .catch(() => ({ source: "Groq", text: null })),
      );
    }

    if (promises.length > 0) {
      // Create a wrapped promise that only resolves when a valid text is returned,
      // otherwise rejects, allowing Promise.any to pick the first successful valid response.
      const validPromises = promises.map((p) =>
        p.then((res) => {
          if (res.text) return res;
          throw new Error(`API returned null`);
        }),
      );

      try {
        const fastestValidResponse = await Promise.any(validPromises);
        text = fastestValidResponse.text || "";
        console.log(`[generateTextLocal] Chosen API source: ${fastestValidResponse.source}, returned: ${text}`);
      } catch (aggregateError) {
        console.warn("[Cloud-LLM] All primary Cloud APIs failed or rate-limited. Trying CocoLink...");
        // Priority 3: CocoLink API (fallback)
        const cocolinkText = await callCocoLinkAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model);
        if (cocolinkText) {
          text = cocolinkText;
        }
      }
    } else {
      // Priority 3: CocoLink API (fallback if no other keys)
      const cocolinkText = await callCocoLinkAPI(finalSystemPrompt, userPrompt, responseFormat, options.decodingSettings, options.model);
      if (cocolinkText) {
        text = cocolinkText;
      }
    }
  }

  let isFallback = false;

  // Priority 3: Rule-based fallback (always works) if no LLM response was retrieved
  if (!text) {
    // If we have a local trained model match, use it as fallback
    if (localModelMatch && localModelMatch.score >= 0.25) {
      console.log(`[LocalGenerativeModel-Fallback] Returning local trained response (score: ${localModelMatch.score.toFixed(4)})`);
      text = localModelMatch.response;
    } else {
      isFallback = true;
      // Phản hồi RAG Offline khi mất kết nối mạng (Offline RAG Context Parser fallback)
      if (systemPrompt.includes("CONTEXT") || systemPrompt.includes("source of truth") || userPrompt.includes("ragContextText")) {
        const contextMatch =
          systemPrompt.match(/=== CONTEXT ===\s*([\s\S]*?)\s*===/i) || systemPrompt.match(/\[Liên kết\]:\s*([\s\S]*?)$/i);
        const contextContent = contextMatch ? contextMatch[1].trim() : "";

        if (contextContent) {
          text = `Chào Sếp! (API Mạng Lưới Đang Quá Tải/Lỗi). Tôi đã truy xuất được nguồn tri thức từ bộ nhớ đệm và xin tóm tắt câu trả lời cho Sếp:\n\n${contextContent}`;
        } else {
          text = `Chào Sếp! (API Mạng Lưới Đang Quá Tải/Lỗi). Tôi không tìm thấy ngữ cảnh cụ thể nào trong bộ nhớ để trả lời trực tiếp câu hỏi của Sếp. Sếp vui lòng kiểm tra lại API Key hoặc hạn mức sử dụng (Quota) nhé!`;
        }
      }
      // 4. Tương tác đàm phán thương lượng (Bargaining / Chat)
      else {
        text =
          `⚠️ [CẢNH BÁO LLM]: Tất cả API Key (Gemini, Groq, Mistral) đều đang bị lỗi (hết hạn mức hoặc không phản hồi). Dưới đây là phản hồi tự động ngoại tuyến:\n\n` +
          runHybridOfflineInference(userPrompt, botId, prodName, price);
      }
    }
  }

  // --- WRITE TO SEMANTIC CACHE IF LLM CALL SUCCEEDED ---
  // DO NOT write to cache if we fell back to the static template, so we can retry the LLM later!
  if (text && !isFallback) {
    writeSemanticCache(botId, userPrompt, text);
  }

  // --- STRUCTURED OUTPUT VALIDATION & SELF-HEALING ---
  if (options.responseSchema && text) {
    try {
      const parsed = normalizeParsedResponse(JSON.parse(text));
      const val = options.responseSchema.safeParse(parsed);
      if (val.success) {
        return { text: JSON.stringify(parsed), data: val.data };
      } else {
        console.warn("[StructuredOutput-ValidationError] Text failed validation:", text);
        console.warn("[StructuredOutput-ValidationError] Trying self-healing...", val.error.message);
        const healingPrompt = `${userPrompt}\n\n[LỖI HỆ THỐNG]: Kết quả trả về của bạn bị lỗi schema validation: ${val.error.message}. Hãy viết lại đối tượng JSON chuẩn xác 100%.`;
        const healedText =
          (await callGroqAPI(finalSystemPrompt, healingPrompt, responseFormat)) ||
          (await callMistralAPI(finalSystemPrompt, healingPrompt, responseFormat));
        if (healedText) {
          const healedParsed = normalizeParsedResponse(JSON.parse(healedText));
          const healedVal = options.responseSchema.safeParse(healedParsed);
          if (healedVal.success) {
            return { text: JSON.stringify(healedParsed), data: healedVal.data };
          }
        }
      }
    } catch (e: any) {
      console.warn("[StructuredOutput-ParseError] Trying self-healing after json syntax error...", e.message);
      const healingPrompt = `${userPrompt}\n\n[LỖI HỆ THỐNG]: Kết quả trả về của bạn không phải JSON hợp lệ: ${e.message}. Hãy viết lại đối tượng JSON chuẩn xác 100%.`;
      const healedText =
        (await callGroqAPI(finalSystemPrompt, healingPrompt, responseFormat)) ||
        (await callMistralAPI(finalSystemPrompt, healingPrompt, responseFormat));
      if (healedText) {
        try {
          const healedParsed = normalizeParsedResponse(JSON.parse(healedText));
          const healedVal = options.responseSchema.safeParse(healedParsed);
          if (healedVal.success) {
            return { text: JSON.stringify(healedParsed), data: healedVal.data };
          }
        } catch (_) {}
      }
    }
  }

  return { text };
}
