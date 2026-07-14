import { createLogger } from "~/shared/logger";

const log = createLogger("cognitive:intelligence:heuristic");

export interface HeuristicResult {
  confidence: number;
  suggestedAction: "SKIP" | "RESPOND_FAST" | "ESCALATE" | "USE_LLM";
  fastReplyTemplate?: string;
  reason?: string;
}

/**
 * Trực giác (Heuristics)
 * Giúp hệ thống ra quyết định nhanh, phản xạ thần tốc với các tin nhắn phổ biến
 * mà không cần gọi LLM (tốn kém, chậm).
 */
export function fastIntuitionJudgment(message: string): HeuristicResult {
  log.info("Applying heuristic intuition to message:", message.substring(0, 30));
  
  const lowerMsg = message.toLowerCase().trim();
  
  // 1. Chào hỏi cơ bản
  const greetings = ["hi", "hello", "chào", "chào bạn", "alo", "ê"];
  if (greetings.includes(lowerMsg)) {
    return {
      confidence: 0.95,
      suggestedAction: "RESPOND_FAST",
      fastReplyTemplate: "Dạ em chào anh/chị ạ! Rottra AI có thể giúp gì cho anh/chị hôm nay?",
      reason: "Matched exact greeting"
    };
  }

  // 2. Hỏi giá ngắn gọn
  if (lowerMsg === "giá" || lowerMsg === "bao nhiêu" || lowerMsg === "inbox giá") {
    return {
      confidence: 0.85,
      suggestedAction: "RESPOND_FAST",
      fastReplyTemplate: "Dạ sản phẩm này bên em đang có ưu đãi đặc biệt ạ. Anh/chị đang quan tâm đến phiên bản nào để em báo giá chuẩn nhất nhé!",
      reason: "Matched direct pricing inquiry"
    };
  }

  // 3. Chửi thề hoặc phẫn nộ (Cần người thật xử lý)
  const toxicWords = ["lừa đảo", "chó", "mẹ", "điên", "tẩy chay", "scam"];
  if (toxicWords.some(w => lowerMsg.includes(w))) {
    return {
      confidence: 0.99,
      suggestedAction: "ESCALATE",
      reason: "Detected high toxicity or scam accusations"
    };
  }

  // 4. Quá ngắn hoặc không có ý nghĩa
  if (lowerMsg.length < 2) {
    return {
      confidence: 0.7,
      suggestedAction: "SKIP",
      reason: "Message too short to process"
    };
  }

  // Nếu trực giác không thể giải quyết, chuyển cho vùng não logic (LLM)
  return {
    confidence: 0.2,
    suggestedAction: "USE_LLM",
    reason: "Complex intent requires deep reasoning"
  };
}
