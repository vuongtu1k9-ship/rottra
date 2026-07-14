/**
 * Rottra Sentiment AI Engine
 * Phân tích thái độ, cảm xúc của người dùng trong tin nhắn để điều chỉnh Tone of Voice của AI.
 */

export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentResult {
  score: number; // -1.0 to 1.0
  label: SentimentLabel;
  intensity: "high" | "medium" | "low";
}

const POSITIVE_WORDS = [
  "tuyệt",
  "tuyệt vời",
  "ngon",
  "đẹp",
  "xuất sắc",
  "thích",
  "yêu",
  "giỏi",
  "hay",
  "cảm ơn",
  "thanks",
  "ok",
  "đỉnh",
  "tốt",
  "mượt",
  "xịn",
  "nhanh",
  "dễ thương",
];

const NEGATIVE_WORDS = [
  "tệ",
  "chán",
  "chậm",
  "dở",
  "ngu",
  "lỗi",
  "đắt",
  "mắc",
  "xấu",
  "ghét",
  "thất vọng",
  "bực",
  "cáu",
  "lừa đảo",
  "scam",
  "vớ vẩn",
  "lag",
  "bỏ đi",
  "hủy",
];

const INTENSIFIERS = ["rất", "quá", "vô cùng", "cực kỳ", "vãi", "lắm"];

/**
 * Phân tích cảm xúc dựa trên từ vựng tiếng Việt (Heuristic).
 * Rất nhanh, phù hợp để chạy thời gian thực cho mỗi tin nhắn.
 */
export function analyzeSentiment(text: string): SentimentResult {
  const normalized = text.toLowerCase();

  let score = 0;
  let matches = 0;

  // Basic scoring
  for (const word of POSITIVE_WORDS) {
    if (normalized.includes(word)) {
      score += 0.5;
      matches++;
    }
  }

  for (const word of NEGATIVE_WORDS) {
    if (normalized.includes(word)) {
      score -= 0.5;
      matches++;
    }
  }

  // Boost score if intensifiers are present near sentiment words
  for (const intensifier of INTENSIFIERS) {
    if (normalized.includes(intensifier)) {
      if (score > 0) score += 0.3;
      if (score < 0) score -= 0.3;
    }
  }

  // Clamp score between -1 and 1
  score = Math.max(-1.0, Math.min(1.0, score));

  let label: SentimentLabel = "neutral";
  if (score > 0.2) label = "positive";
  else if (score < -0.2) label = "negative";

  let intensity: "high" | "medium" | "low" = "low";
  if (Math.abs(score) > 0.6) intensity = "high";
  else if (Math.abs(score) > 0.3) intensity = "medium";

  return { score, label, intensity };
}

/**
 * Tạo System Prompt Instruction (Chỉ dẫn Tone giọng) dựa trên Sentiment
 */
export function getToneAdjustmentPrompt(sentiment: SentimentResult): string {
  if (sentiment.label === "negative") {
    if (sentiment.intensity === "high") {
      return "[HƯỚNG DẪN TONE CẢM XÚC]: Người dùng đang cực kỳ TỨC GIẬN/KHÔNG HÀI LÒNG. Bạn BẮT BUỘC phải hạ tông giọng, nói chuyện vô cùng nhún nhường, xoa dịu, xin lỗi và tìm cách giải quyết ngay lập tức. Tuyệt đối không đùa giỡn.";
    }
    return "[HƯỚNG DẪN TONE CẢM XÚC]: Người dùng có vẻ đang không vui. Hãy nói chuyện nhẹ nhàng, an ủi và tỏ ra thấu hiểu.";
  }

  if (sentiment.label === "positive") {
    if (sentiment.intensity === "high") {
      return "[HƯỚNG DẪN TONE CẢM XÚC]: Người dùng đang RẤT VUI/PHẤN KHÍCH. Hãy hùa theo sự vui vẻ này, dùng icon cảm xúc, nói chuyện nhiệt tình và hào hứng!";
    }
    return "[HƯỚNG DẪN TONE CẢM XÚC]: Người dùng đang vui vẻ. Hãy giữ thái độ tích cực, niềm nở và thân thiện.";
  }

  return "[HƯỚNG DẪN TONE CẢM XÚC]: Cảm xúc người dùng bình thường. Hãy phản hồi với phong thái mặc định của bạn.";
}

/**
 * Phân tích cảm xúc Mô hình Lai (Hybrid: Heuristic + LLM Fallback)
 * Gọi LLM để đọc mỉa mai nếu Heuristic không chắc chắn và câu văn đủ dài.
 */
export async function analyzeSentimentAsync(text: string): Promise<SentimentResult> {
  // 1. Fast-lane (Heuristic)
  const heuristicResult = analyzeSentiment(text);

  // Nếu câu ngắn (dưới 15 ký tự) hoặc Heuristic đã chắc chắn (score > 0.3 or < -0.3), trả về luôn
  if (text.length < 15 || Math.abs(heuristicResult.score) > 0.3) {
    return heuristicResult;
  }

  // 2. Deep-lane (LLM Fallback cho Sarcasm / Ngữ cảnh phức tạp)
  try {
    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
    const { z } = await import("zod");

    const SentimentSchema = z.object({
      score: z.number().min(-1).max(1).describe("Điểm cảm xúc từ -1.0 (Tiêu cực nhất) đến 1.0 (Tích cực nhất)"),
      label: z.enum(["positive", "negative", "neutral"]),
    });

    const prompt = `Phân tích cảm xúc sâu của câu nói sau (chú ý bắt các lỗi mỉa mai, chửi khéo, bóng gió).\nCâu nói: "${text}"\nTrả về JSON đánh giá cảm xúc hợp lệ.`;

    const aiResponse = await generateTextLocal({
      prompt,
      responseSchema: SentimentSchema as any,
      isInternalReasoning: true,
      system: "SentimentAnalysis",
      userId: "0",
    });

    if (aiResponse.data) {
      const data = aiResponse.data as any;
      let intensity: "high" | "medium" | "low" = "low";
      if (Math.abs(data.score) > 0.6) intensity = "high";
      else if (Math.abs(data.score) > 0.3) intensity = "medium";

      console.log(`[Sentiment AI] Hybrid Deep-lane activated. Overrode Heuristic. Result: ${data.label} (${data.score})`);
      return { score: data.score, label: data.label, intensity };
    }
  } catch (error) {
    console.warn("[Sentiment AI] LLM Fallback failed, using Heuristic.", error);
  }

  // Fallback to heuristic if LLM fails
  return heuristicResult;
}
