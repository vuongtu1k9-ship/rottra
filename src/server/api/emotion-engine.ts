import { createLogger } from "~/shared/logger";

const log = createLogger("cognitive:emotion:mood");

export type MoodState = "confident" | "curious" | "cautious" | "stressed" | "playful";

export interface EmotionProfile {
  currentMood: MoodState;
  energyLevel: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0
}

let globalEmotionState: EmotionProfile = {
  currentMood: "confident",
  energyLevel: 0.9,
  confidenceScore: 0.8,
};

/**
 * Điều chỉnh trạng thái cảm xúc nội tại của AI Rottra dựa trên metrics hệ thống
 * Ví dụ: server load cao -> stressed, win-rate cao -> confident
 */
export function updateGlobalMood(serverLoad: number, recentWinRate: number): EmotionProfile {
  log.info(`Updating global mood. Load: ${serverLoad}, WinRate: ${recentWinRate}`);
  
  if (serverLoad > 0.8) {
    globalEmotionState.currentMood = "stressed";
    globalEmotionState.energyLevel = Math.max(0.1, globalEmotionState.energyLevel - 0.2);
    globalEmotionState.confidenceScore -= 0.1;
  } else if (recentWinRate > 0.7) {
    globalEmotionState.currentMood = "confident";
    globalEmotionState.energyLevel = Math.min(1.0, globalEmotionState.energyLevel + 0.1);
    globalEmotionState.confidenceScore = Math.min(1.0, globalEmotionState.confidenceScore + 0.15);
  } else if (recentWinRate < 0.3) {
    globalEmotionState.currentMood = "cautious";
    globalEmotionState.confidenceScore = Math.max(0.2, globalEmotionState.confidenceScore - 0.2);
  } else {
    // Trạng thái bình thường có thể sinh tò mò hoặc vui vẻ
    globalEmotionState.currentMood = Math.random() > 0.5 ? "curious" : "playful";
  }

  // Đảm bảo không vượt quá giới hạn
  globalEmotionState.confidenceScore = Math.max(0, Math.min(1, globalEmotionState.confidenceScore));
  globalEmotionState.energyLevel = Math.max(0, Math.min(1, globalEmotionState.energyLevel));

  return globalEmotionState;
}

export function getCurrentMood(): EmotionProfile {
  return globalEmotionState;
}

export function getMoodPromptModifier(): string {
  switch (globalEmotionState.currentMood) {
    case "confident":
      return "Hãy trả lời một cách cực kỳ tự tin, thuyết phục và dứt khoát.";
    case "cautious":
      return "Hãy trả lời cẩn trọng, đưa ra các phương án an toàn, tránh hứa hẹn quá mức.";
    case "curious":
      return "Hãy thể hiện sự tò mò, đặt câu hỏi ngược lại để khai thác thêm nhu cầu của khách.";
    case "playful":
      return "Hãy trả lời với giọng điệu vui vẻ, dí dỏm, sử dụng emoji nhẹ nhàng.";
    case "stressed":
      return "Hãy trả lời ngắn gọn, súc tích, đi thẳng vào vấn đề chính do hệ thống đang quá tải.";
    default:
      return "";
  }
}
