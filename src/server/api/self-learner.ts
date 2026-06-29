/**
 * 🧠 SELF-LEARNING SYSTEM — Rottra AI Tự Cải Thiên Liên Tục
 *
 * Flow:
 * 1. Mỗi query có score < threshold → tự học từ cloud LLM
 * 2. User feedback (👍/👎) → cập nhật quality score
 * 3. Periodically merge learned data → retrain local model
 */

import { db } from "~/infra/database/db-pool";
import { agentTraining } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

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

  // TODO: Lưu feedback history vào DB để phân tích trend
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
  // Thử Groq trước
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `Bạn là trợ lý AI của nền tảng nông nghiệp Rottra. Trả lời ngắn gọn, chính xác, thân thiện. Không xưng "tôi là AI". Trả lời bằng tiếng Việt. Tối đa 150 từ.`,
            },
            { role: "user", content: query },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch {}
  }

  // Fallback: dùng generateTextLocal
  try {
    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
    const result = await generateTextLocal({
      system: "Bạn là trợ lý AI của Rottra. Trả lời ngắn gọn, chính xác. Tiếng Việt. Tối đa 150 từ.",
      prompt: query,
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
