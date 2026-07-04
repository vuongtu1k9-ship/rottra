import { computeRewardScore } from "./reward-model";
import { treeOfThoughtsReasoning, generatePlan, executePlanWithReplanner } from "./planner";
import { RottraPrivateBrain } from "../cognitive-swarm/hive-mind";
import { bookScholarReasoning } from "./book-scholar";
import { youtubeLearnerReasoning } from "./youtube-learner";
import { db } from "~/infra/database/db-pool";
import { dpoTrainingData } from "~/infra/database/schema";
import crypto from "crypto";

export type CognitiveMode = "TreeOfThoughts" | "AgenticReplanner" | "PrivateBrain" | "BookScholar" | "YoutubeLearner";

export interface ArenaResult {
  winnerMode: CognitiveMode;
  response: string;
  scores: Record<CognitiveMode, number>;
}

/**
 * Đấu Trường Tư Duy (Meta-Cognitive Arena)
 * Chạy song song nhiều lối tư duy, chấm điểm bằng Reward Model, chọn ra kết quả tốt nhất.
 * Sau đó, lưu kết quả chiến thắng vào CSDL để Tăng cường học (RL).
 */
export async function runCognitiveArena(query: string, intent: string, baseParams: any, lexiconContext: string = ""): Promise<ArenaResult> {
  console.log(`⚔️ [COGNITIVE ARENA] Khởi động đấu trường tư duy cho câu hỏi: "${query}" (Intent: ${intent})`);

  // 1. Chạy song song các lối tư duy
  const [totResult, replannerResult, brainResult, bookResult, youtubeResult] = await Promise.allSettled([
    // Nhánh 1: Tree of Thoughts (Sinh 3 nhánh, tự phản biện)
    treeOfThoughtsReasoning(lexiconContext, query),

    // Nhánh 2: Agentic Workflow (Lập kế hoạch đa bước + Replanner)
    (async () => {
      const plan = await generatePlan(query);
      const { text } = await executePlanWithReplanner(plan, baseParams);
      return text;
    })(),

    // Nhánh 3: Tứ Linh Private Brain (Toán học vĩ mô + Cân bằng nội môi)
    RottraPrivateBrain.solve(query, lexiconContext).then((res) => res.reply),

    // Nhánh 4: Book Scholar (Đọc Sách Hàn lâm)
    bookScholarReasoning(query),

    // Nhánh 5: YouTube Learner (Thực chiến Video)
    youtubeLearnerReasoning(query),
  ]);

  const responses: Partial<Record<CognitiveMode, string>> = {};

  if (totResult.status === "fulfilled" && totResult.value) {
    responses["TreeOfThoughts"] = totResult.value;
  }
  if (replannerResult.status === "fulfilled" && replannerResult.value) {
    responses["AgenticReplanner"] = replannerResult.value;
  }
  if (brainResult.status === "fulfilled" && brainResult.value) {
    responses["PrivateBrain"] = brainResult.value;
  }
  if (bookResult.status === "fulfilled" && bookResult.value) {
    responses["BookScholar"] = bookResult.value;
  }
  if (youtubeResult.status === "fulfilled" && youtubeResult.value) {
    responses["YoutubeLearner"] = youtubeResult.value;
  }

  // 2. Gọi Reward Model (Trọng tài) chấm điểm
  const scores: Record<CognitiveMode, number> = {
    TreeOfThoughts: -999,
    AgenticReplanner: -999,
    PrivateBrain: -999,
    BookScholar: -999,
    YoutubeLearner: -999,
  };

  let winnerMode: CognitiveMode = "PrivateBrain";
  let maxScore = -9999;
  let bestResponse = "Hệ thống đang bận, xin vui lòng thử lại sau.";

  for (const [mode, responseText] of Object.entries(responses)) {
    if (!responseText) continue;
    const score = computeRewardScore(query, responseText);
    scores[mode as CognitiveMode] = score;

    console.log(`📊 [ARENA] Lối tư duy [${mode}] đạt điểm: ${score}`);

    if (score > maxScore) {
      maxScore = score;
      winnerMode = mode as CognitiveMode;
      bestResponse = responseText;
    }
  }

  console.log(`🏆 [ARENA WINNER] Kẻ chiến thắng là: ${winnerMode} với ${maxScore} điểm!`);

  // 3. Tăng cường Học Tư duy (Reinforcement Learning - Ghi nhận vào DpoTrainingData)
  try {
    await db.insert(dpoTrainingData).values({
      id: crypto.randomUUID(),
      prompt: query,
      chosenResponse: bestResponse,
      rejectedResponse: "Các lối tư duy khác có điểm Reward thấp hơn đã bị loại.",
      metadata: {
        intent,
        winnerMode,
        scores,
        timestamp: new Date().toISOString(),
      },
      addAt: new Date().toISOString(),
    });
    console.log(`🧠 [META-COGNITIVE] Đã nạp thành công kiến thức vào CSDL DPO (Preferred Mode: ${winnerMode})`);
  } catch (err) {
    console.error(`❌ [META-COGNITIVE ERROR] Không thể lưu DPO data:`, err);
  }

  return {
    winnerMode,
    response: bestResponse,
    scores,
  };
}
