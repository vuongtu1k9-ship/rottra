import { createLogger } from "~/shared/logger";

const log = createLogger("cognitive:empathy:sentiment");

export interface SentimentScore {
  positivity: number; // 0.0 to 1.0
  negativity: number; // 0.0 to 1.0
  urgency: number; // 0.0 to 1.0
  dominantEmotion: "happy" | "angry" | "sad" | "confused" | "neutral";
}

/**
 * Phân tích cảm xúc văn bản khách hàng để giúp AI Rottra thấu hiểu và điều chỉnh thái độ
 */
export function analyzeCustomerSentiment(text: string): SentimentScore {
  log.info("Analyzing customer sentiment for:", text.substring(0, 50) + "...");
  
  const lowerText = text.toLowerCase();
  
  let positivity = 0.5;
  let negativity = 0.2;
  let urgency = 0.1;
  
  // Từ khóa tích cực
  const positiveWords = ["cảm ơn", "tuyệt", "tốt", "hay", "oke", "ok", "thích", "mua", "chốt", "đẹp"];
  // Từ khóa tiêu cực
  const negativeWords = ["chê", "kém", "tệ", "đắt", "lừa", "không", "chán", "lỗi", "hỏng", "thất vọng"];
  // Từ khóa gấp gáp
  const urgentWords = ["gấp", "ngay", "luôn", "nhanh", "sắp", "mai", "liền"];
  
  let posCount = 0;
  let negCount = 0;
  let urgCount = 0;
  
  positiveWords.forEach(w => lowerText.includes(w) && posCount++);
  negativeWords.forEach(w => lowerText.includes(w) && negCount++);
  urgentWords.forEach(w => lowerText.includes(w) && urgCount++);
  
  positivity = Math.min(1.0, positivity + posCount * 0.15);
  negativity = Math.min(1.0, negativity + negCount * 0.2);
  urgency = Math.min(1.0, urgency + urgCount * 0.3);
  
  let dominantEmotion: SentimentScore["dominantEmotion"] = "neutral";
  if (negativity > 0.6) dominantEmotion = "angry";
  else if (positivity > 0.7) dominantEmotion = "happy";
  else if (lowerText.includes("sao") || lowerText.includes("hả") || lowerText.includes("?")) dominantEmotion = "confused";
  
  return {
    positivity,
    negativity,
    urgency,
    dominantEmotion
  };
}

/**
 * Tự động gắn nhãn (tagging) tin nhắn để bộ định tuyến (router) đưa cho AI phù hợp
 */
export function tagMessageIntent(score: SentimentScore): string[] {
  const tags: string[] = [];
  if (score.urgency > 0.7) tags.push("URGENT");
  if (score.dominantEmotion === "angry") tags.push("ESCALATE_TO_HUMAN");
  if (score.positivity > 0.8) tags.push("READY_TO_BUY");
  return tags;
}
