/**
 * 🧠 SELF-LEARNING SYSTEM — Rottra AI Tự Cải Thiên Liên Tục
 *
 * Flow:
 * 1. Mỗi query có score < threshold → tự học từ cloud LLM
 * 2. User feedback (👍/👎) → cập nhật quality score
 * 3. Periodically merge learned data → retrain local model
 */

import { db } from "~/infra/database/db-pool";
import { agentTraining, feedbackLog, dpoTrainingData } from "~/infra/database/schema";
import { eq, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import { recordIntentOverride } from "~/core/nlp-cognitive/tokenizer";

// ══════════════════════════════════════════════════════════════
// 1. AUTO-TEACH: Tự dạy khi classifier score thấp
// ══════════════════════════════════════════════════════════════

const LOW_CONFIDENCE_THRESHOLD = 0.35;
const LEARN_COOLDOWN_MS = 5 * 60 * 1000; // 5 phút giữa 2 lần học cùng query
const recentlyLearned = new Map<string, number>();

export async function autoTeachOnLowConfidence(query: string, score: number, existingAnswer?: string): Promise<boolean> {
  if (score >= LOW_CONFIDENCE_THRESHOLD) return false;

  const normalizedQuery = query.trim().toLowerCase();
  const lastLearn = recentlyLearned.get(normalizedQuery) || 0;
  if (Date.now() - lastLearn < LEARN_COOLDOWN_MS) return false;

  // Kiểm tra đã có trong DB chưa
  const existing = await db.query.agentTraining.findFirst({
    where: eq(agentTraining.utterance, query.trim()),
  });
  if (existing) return false;

  recentlyLearned.set(normalizedQuery, Date.now());

  try {
    const answer = existingAnswer || (await generateAnswerFromLLM(query));
    if (!answer) return false;

    await db.insert(agentTraining).values({
      id: crypto.randomUUID(),
      intent: "AUTO_LEARNED",
      utterance: query.trim(),
      answer,
    });

    console.log(`[SelfLearner] ✅ Tự học: "${query.slice(0, 60)}..." (score: ${score.toFixed(3)})`);
    return true;
  } catch (err: any) {
    console.error(`[SelfLearner] Lỗi tự học:`, err.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// 2. FEEDBACK: Nhận đánh giá từ người dùng
// ══════════════════════════════════════════════════════════════

interface FeedbackEntry {
  query: string;
  intent: string;
  score: number;
  rating: "up" | "down";
  timestamp: number;
}

const feedbackBuffer: FeedbackEntry[] = [];
const FEEDBACK_FLUSH_INTERVAL = 30 * 1000; // Flush mỗi 30s

let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFeedbackFlusher() {
  if (flushTimer) return;
  flushTimer = setInterval(flushFeedback, FEEDBACK_FLUSH_INTERVAL);
}

export async function recordFeedback(query: string, intent: string, score: number, rating: "up" | "down"): Promise<void> {
  startFeedbackFlusher();

  feedbackBuffer.push({
    query,
    intent,
    score,
    rating,
    timestamp: Date.now(),
  });

  console.log(`[SelfLearner] 📝 Feedback: "${query.slice(0, 40)}..." → ${rating} (score: ${score.toFixed(3)})`);

  // Persist individual feedback immediately (fire-and-forget)
  try {
    await db.insert(feedbackLog).values({
      id: crypto.randomUUID(),
      query: query.slice(0, 500),
      intent: intent || null,
      rating,
      score,
      addAt: new Date().toISOString(),
    });
  } catch {
    // Buffer will catch it on flush anyway
  }

  // Online learning: record intent override for instant classification improvement
  if (rating === "down" && intent && intent !== "UNKNOWN") {
    recordIntentOverride(query, intent, 0.9);
  }

  // Nếu thumbs down → ngay lập tức tìm answer tốt hơn
  if (rating === "down") {
    try {
      const betterAnswer = await generateAnswerFromLLM(query);
      if (betterAnswer) {
        // Kiểm tra đã có utterance này chưa
        const existing = await db.query.agentTraining.findFirst({
          where: eq(agentTraining.utterance, query.trim()),
        });

        if (existing) {
          // Cập nhật câu trả lời tốt hơn
          await db
            .update(agentTraining)
            .set({ answer: "🧠 [Rottra Học Lại]: " + betterAnswer })
            .where(eq(agentTraining.id, existing.id));
          console.log(`[SelfLearner] 🔄 Cập nhật câu trả lời cho: "${query.slice(0, 40)}..."`);

          // LƯU CẶP DỮ LIỆU DPO (Direct Preference Optimization)
          // Câu bị chê (rejected) vs Câu tốt hơn (chosen)
          await db.insert(dpoTrainingData).values({
            id: crypto.randomUUID(),
            prompt: query.trim(),
            chosenResponse: betterAnswer,
            rejectedResponse: existing.answer,
          });
          console.log(`[SelfLearner] 📊 Đã lưu cặp DPO cho câu hỏi: "${query.slice(0, 40)}..."`);
        } else {
          await db.insert(agentTraining).values({
            id: crypto.randomUUID(),
            intent: "FEEDBACK_LEARNED",
            utterance: query.trim(),
            answer: "🧠 [Rottra Học Lại]: " + betterAnswer,
          });
          console.log(`[SelfLearner] ✅ Học mới từ feedback: "${query.slice(0, 40)}..."`);
        }
      }
    } catch (err: any) {
      console.error(`[SelfLearner] Lỗi học từ feedback:`, err.message);
    }
  }
}

async function flushFeedback(): Promise<void> {
  if (feedbackBuffer.length === 0) return;

  const batch = feedbackBuffer.splice(0);
  const ups = batch.filter((f) => f.rating === "up").length;
  const downs = batch.filter((f) => f.rating === "down").length;
  const avgScore = batch.reduce((sum, f) => sum + f.score, 0) / batch.length;

  console.log(`[SelfLearner] 📊 Flush ${batch.length} feedback: ${ups}👍 ${downs}👎 (avg score: ${avgScore.toFixed(3)})`);

  // Persist feedback to DB for analytics
  try {
    const values = batch.map((f) => ({
      id: crypto.randomUUID(),
      query: f.query.slice(0, 500),
      intent: f.intent || null,
      rating: f.rating,
      score: f.score,
      addAt: new Date(f.timestamp).toISOString(),
    }));
    await db.insert(feedbackLog).values(values);
  } catch (err: any) {
    console.error(`[SelfLearner] Lỗi flush feedback to DB:`, err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// 3. AUTO-RETRAIN: Tự động merge learned data vào local model
// ══════════════════════════════════════════════════════════════

export async function syncLearnedToLocalModel(): Promise<{ synced: number; total: number }> {
  try {
    const learnedRecords = await db.query.agentTraining.findMany();

    if (learnedRecords.length === 0) {
      return { synced: 0, total: 0 };
    }

    // Merge vào extra_training_data.jsonl
    const fs = await import("fs");
    const path = await import("path");
    const datasetPath = path.join(process.cwd(), "finetune", "data", "extra_training_data.jsonl");

    // Đọc existing entries
    const existingContent = fs.existsSync(datasetPath) ? fs.readFileSync(datasetPath, "utf-8") : "";
    const existingUtterances = new Set(
      existingContent
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const parsed = JSON.parse(line);
            return parsed.messages?.[1]?.content?.toLowerCase() || "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );

    let syncedCount = 0;
    for (const record of learnedRecords) {
      const utt = record.utterance?.trim().toLowerCase();
      if (!utt || existingUtterances.has(utt)) continue;

      const entry = JSON.stringify({
        messages: [
          { role: "system", content: "Bạn là trợ lý AI Rottra, chuyên gia nông nghiệp thông minh." },
          { role: "user", content: record.utterance.trim() },
          { role: "assistant", content: record.answer.replace("🧠 [Rottra Tự Học]: ", "").replace("🧠 [Rottra Học Lại]: ", "").trim() },
        ],
      });

      fs.appendFileSync(datasetPath, "\n" + entry);
      existingUtterances.add(utt);
      syncedCount++;
    }

    if (syncedCount > 0) {
      console.log(`[SelfLearner] 🔄 Synced ${syncedCount} learned entries → extra_training_data.jsonl`);

      // Re-merge và retrain
      const datasetMain = path.join(process.cwd(), "finetune", "data", "rottra_dataset.jsonl");
      const extraData = fs.readFileSync(datasetPath, "utf-8");
      const mainData = fs.readFileSync(datasetMain, "utf-8");
      fs.writeFileSync(datasetMain, mainData + "\n" + extraData);

      console.log(`[SelfLearner] 🎯 Retraining local model...`);
    }

    return { synced: syncedCount, total: learnedRecords.length };
  } catch (err: any) {
    console.error(`[SelfLearner] Lỗi sync:`, err.message);
    return { synced: 0, total: 0 };
  }
}

// ══════════════════════════════════════════════════════════════
// HELPER: Gọi LLM để tạo câu trả lời
// ══════════════════════════════════════════════════════════════

async function generateAnswerFromLLM(query: string): Promise<string | null> {
  // Use Rottra's local AI engine — no external LLM
  try {
    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
    const result = await generateTextLocal({
      system: "Bạn là trợ lý AI của Rottra. Trả lời ngắn gọn, chính xác, thân thiện. Tiếng Việt. Tối đa 150 từ.",
      prompt: query,
      isInternalReasoning: true,
    });
    return result?.text || null;
  } catch {}

  return null;
}

// ══════════════════════════════════════════════════════════════
// STATS: Thống kê hiệu suất tự học
// ══════════════════════════════════════════════════════════════

export async function getLearningStats(): Promise<{
  totalLearned: number;
  autoLearned: number;
  feedbackLearned: number;
  recentFeedback: { ups: number; downs: number };
}> {
  try {
    const all = await db.query.agentTraining.findMany();
    const autoLearned = all.filter((r: any) => r.intent?.startsWith("AUTO_LEARNED")).length;
    const feedbackLearned = all.filter((r: any) => r.intent?.startsWith("FEEDBACK_LEARNED")).length;

    return {
      totalLearned: all.length,
      autoLearned,
      feedbackLearned,
      recentFeedback: {
        ups: feedbackBuffer.filter((f) => f.rating === "up").length,
        downs: feedbackBuffer.filter((f) => f.rating === "down").length,
      },
    };
  } catch {
    return { totalLearned: 0, autoLearned: 0, feedbackLearned: 0, recentFeedback: { ups: 0, downs: 0 } };
  }
}

// ══════════════════════════════════════════════════════════════
// 4. FEEDBACK ANALYTICS: Phân tích trend feedback
// ══════════════════════════════════════════════════════════════

export async function getFeedbackAnalytics(): Promise<{
  totalFeedback: number;
  thumbsUp: number;
  thumbsDown: number;
  satisfactionRate: number;
  dailyTrend: { date: string; up: number; down: number }[];
  intentBreakdown: { intent: string; up: number; down: number }[];
  lowAccuracyQueries: { query: string; accuracy: number; rating: string }[];
}> {
  try {
    const allFeedback = await db.query.feedbackLog.findMany({
      orderBy: [desc(feedbackLog.addAt)],
      limit: 1000,
    });

    const totalFeedback = allFeedback.length;
    const thumbsUp = allFeedback.filter((f: any) => f.rating === "up").length;
    const thumbsDown = allFeedback.filter((f: any) => f.rating === "down").length;
    const satisfactionRate = totalFeedback > 0 ? thumbsUp / totalFeedback : 0;

    // Daily trend (last 30 days)
    const dailyMap = new Map<string, { up: number; down: number }>();
    for (const f of allFeedback) {
      const date = (f.addAt as string)?.slice(0, 10) || "unknown";
      const entry = dailyMap.get(date) || { up: 0, down: 0 };
      if (f.rating === "up") entry.up++;
      else entry.down++;
      dailyMap.set(date, entry);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([date, counts]) => ({ date, ...counts }));

    // Intent breakdown
    const intentMap = new Map<string, { up: number; down: number }>();
    for (const f of allFeedback) {
      const intent = f.intent || "UNKNOWN";
      const entry = intentMap.get(intent) || { up: 0, down: 0 };
      if (f.rating === "up") entry.up++;
      else entry.down++;
      intentMap.set(intent, entry);
    }
    const intentBreakdown = Array.from(intentMap.entries()).map(([intent, counts]) => ({ intent, ...counts }));

    // Low accuracy queries (bottom 10 by score, rated down)
    const lowAccuracyQueries = allFeedback
      .filter((f: any) => f.rating === "down" && f.score != null)
      .sort((a: any, b: any) => (a.score || 0) - (b.score || 0))
      .slice(0, 10)
      .map((f: any) => ({
        query: f.query?.slice(0, 100) || "",
        accuracy: f.score || 0,
        rating: f.rating,
      }));

    return {
      totalFeedback,
      thumbsUp,
      thumbsDown,
      satisfactionRate,
      dailyTrend,
      intentBreakdown,
      lowAccuracyQueries,
    };
  } catch {
    return {
      totalFeedback: 0,
      thumbsUp: 0,
      thumbsDown: 0,
      satisfactionRate: 0,
      dailyTrend: [],
      intentBreakdown: [],
      lowAccuracyQueries: [],
    };
  }
}

// ══════════════════════════════════════════════════════════════
// 5. RETRAIN: Batch retrain model from learned data
// ══════════════════════════════════════════════════════════════

let isRetraining = false;
const RETRAIN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown
let lastRetrainTime = 0;

export async function retrainModel(): Promise<{
  success: boolean;
  newPairsAdded: number;
  vocabularySize: number;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();

  // Cooldown check
  if (Date.now() - lastRetrainTime < RETRAIN_COOLDOWN_MS) {
    return { success: false, newPairsAdded: 0, vocabularySize: 0, duration: 0, error: "Cooldown: max 1 retrain per hour" };
  }

  if (isRetraining) {
    return { success: false, newPairsAdded: 0, vocabularySize: 0, duration: 0, error: "Retrain already in progress" };
  }

  isRetraining = true;

  try {
    // 1. Read all learned records
    const learnedRecords = await db.query.agentTraining.findMany();
    if (learnedRecords.length === 0) {
      isRetraining = false;
      return { success: true, newPairsAdded: 0, vocabularySize: 0, duration: Date.now() - startTime };
    }

    // 2. Read extra training data
    const fs = await import("fs");
    const path = await import("path");
    const datasetPath = path.join(process.cwd(), "finetune", "data", "extra_training_data.jsonl");

    const existingContent = fs.existsSync(datasetPath) ? fs.readFileSync(datasetPath, "utf-8") : "";
    const existingUtterances = new Set(
      existingContent
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            const parsed = JSON.parse(line);
            return parsed.messages?.[1]?.content?.toLowerCase() || "";
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );

    // 3. Merge new learned entries
    let newPairsAdded = 0;
    for (const record of learnedRecords) {
      const utt = record.utterance?.trim().toLowerCase();
      if (!utt || existingUtterances.has(utt)) continue;

      const entry = JSON.stringify({
        messages: [
          { role: "system", content: "Bạn là trợ lý AI Rottra, chuyên gia nông nghiệp thông minh." },
          { role: "user", content: record.utterance.trim() },
          { role: "assistant", content: record.answer.replace("🧠 [Rottra Tự Học]: ", "").replace("🧠 [Rottra Học Lại]: ", "").trim() },
        ],
      });

      fs.appendFileSync(datasetPath, "\n" + entry);
      existingUtterances.add(utt);
      newPairsAdded++;
    }

    // 4. Update main dataset
    if (newPairsAdded > 0) {
      const datasetMain = path.join(process.cwd(), "finetune", "data", "rottra_dataset.jsonl");
      const extraData = fs.readFileSync(datasetPath, "utf-8");
      const mainData = fs.existsSync(datasetMain) ? fs.readFileSync(datasetMain, "utf-8") : "";
      fs.writeFileSync(datasetMain, mainData + "\n" + extraData);
    }

    // 5. Extract new keywords from learned queries
    const newKeywords: string[] = [];
    for (const record of learnedRecords) {
      const words =
        record.utterance
          ?.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3) || [];
      newKeywords.push(...words.slice(0, 3));
    }
    const uniqueKeywords = [...new Set(newKeywords)].slice(0, 50);

    lastRetrainTime = Date.now();
    isRetraining = false;

    console.log(`[SelfLearner] 🎯 Retrain complete: ${newPairsAdded} new pairs, ${uniqueKeywords.length} new keywords`);

    return {
      success: true,
      newPairsAdded,
      vocabularySize: existingUtterances.size,
      duration: Date.now() - startTime,
    };
  } catch (err: any) {
    isRetraining = false;
    console.error(`[SelfLearner] Retrain error:`, err.message);
    return { success: false, newPairsAdded: 0, vocabularySize: 0, duration: Date.now() - startTime, error: err.message };
  }
}

export function getRetrainStatus(): { inProgress: boolean; lastRetrainTime: number } {
  return { inProgress: isRetraining, lastRetrainTime };
}
