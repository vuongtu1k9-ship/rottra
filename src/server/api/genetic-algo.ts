import { createLogger } from "~/shared/logger";

const log = createLogger("cognitive:evolution:mutation");

export interface AIMutationDNA {
  temperature: number; // Sự sáng tạo
  topP: number; // Giới hạn lựa chọn từ vựng
  personaAggressiveness: number; // Mức độ chèo kéo khách hàng
  replyLengthFactor: number; // Độ dài câu trả lời
}

const DEFAULT_DNA: AIMutationDNA = {
  temperature: 0.6,
  topP: 0.9,
  personaAggressiveness: 0.5,
  replyLengthFactor: 1.0,
};

/**
 * Đột biến (Mutation) - Một phần của thuật toán di truyền.
 * Rottra AI sẽ tự động thay đổi nhẹ (mutate) các thông số cài đặt LLM.
 * Nếu phiên bản đột biến nào mang lại tỷ lệ chốt đơn cao hơn, hệ thống sẽ lưu lại (Selection & Inheritance).
 */
export function mutateAgentDNA(currentDNA: AIMutationDNA = DEFAULT_DNA, mutationRate: number = 0.1): AIMutationDNA {
  log.info("Triggering genetic mutation on AI hyperparameters...");

  // Hàm hỗ trợ random Gaussian đơn giản
  const randomGaussian = () => (Math.random() * 2 - 1) + (Math.random() * 2 - 1) + (Math.random() * 2 - 1);

  const mutate = (val: number, min: number, max: number) => {
    // Tỷ lệ đột biến xảy ra
    if (Math.random() > mutationRate) return val;
    
    // Nếu đột biến, cộng/trừ 1 lượng nhỏ (noise)
    const noise = randomGaussian() * 0.1;
    let newVal = val + noise;
    
    // Đảm bảo không vượt ngưỡng
    if (newVal < min) newVal = min;
    if (newVal > max) newVal = max;
    
    return Number(newVal.toFixed(2));
  };

  return {
    temperature: mutate(currentDNA.temperature, 0.1, 1.2),
    topP: mutate(currentDNA.topP, 0.5, 1.0),
    personaAggressiveness: mutate(currentDNA.personaAggressiveness, 0.1, 1.0),
    replyLengthFactor: mutate(currentDNA.replyLengthFactor, 0.5, 2.0),
  };
}

/**
 * Lựa chọn chéo (Crossover) giữa 2 bản thể AI thành công nhất để sinh ra thế hệ AI con
 */
export function crossoverDNA(parentA: AIMutationDNA, parentB: AIMutationDNA): AIMutationDNA {
  return {
    temperature: Math.random() > 0.5 ? parentA.temperature : parentB.temperature,
    topP: Math.random() > 0.5 ? parentA.topP : parentB.topP,
    personaAggressiveness: Math.random() > 0.5 ? parentA.personaAggressiveness : parentB.personaAggressiveness,
    replyLengthFactor: Math.random() > 0.5 ? parentA.replyLengthFactor : parentB.replyLengthFactor,
  };
}
