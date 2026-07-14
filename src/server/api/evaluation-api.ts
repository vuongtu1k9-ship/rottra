/**
 * AI Evaluation API
 *
 * Exposes evaluation endpoints for the chatbot:
 * - POST /run: Run full evaluation against golden dataset
 * - GET /report/latest: Get latest evaluation report
 * - POST /evaluate-single: Evaluate a single query-response pair
 * - GET /metrics: Get aggregated metrics from past evaluations
 * - POST /feedback: Record user feedback for evaluation correlation
 */

import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { createLogger } from "~/shared/logger";
import { EVAL_CONFIG } from "../../../tests/ai-evaluation/config";
import { GOLDEN_ANSWERS, getGoldenAnswers, type GoldenAnswer } from "../../../tests/ai-evaluation/datasets/golden-answers";
import { evaluateOutput, aggregateOutputMetrics, type OutputMetrics } from "../../../tests/ai-evaluation/metrics/output-evaluation";
import { evaluateFaithfulness, evaluateAnswerCorrectness } from "../../../tests/ai-evaluation/metrics/rag-evaluation";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import fs from "node:fs";
import path from "node:path";

const log = createLogger("api/evaluation");
const evaluationApp = new Hono();

// ── In-memory evaluation cache ──────────────────────────────────
interface EvaluationCache {
  latestReport: any | null;
  reportHistory: Array<{ timestamp: string; overallScore: number; verdict: string }>;
  feedbackLog: Array<{
    query: string;
    response: string;
    rating: "up" | "down";
    intent: string;
    timestamp: number;
  }>;
}

const cache: EvaluationCache = {
  latestReport: null,
  reportHistory: [],
  feedbackLog: [],
};

const REPORTS_DIR = path.join(process.cwd(), "tests", "ai-evaluation", "reports");

// ══════════════════════════════════════════════════════════════
// POST /evaluation/run — Run evaluation against golden dataset
// ══════════════════════════════════════════════════════════════

evaluationApp.post("/run", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const mode = (body.mode || "quick") as keyof typeof EVAL_CONFIG.modes;
    const maxQueries = body.maxQueries || 20;

    log.info(`[Evaluation] Starting ${mode} evaluation (${maxQueries} queries)...`);

    const config = EVAL_CONFIG.modes[mode] || EVAL_CONFIG.modes.quick;
    const limit = maxQueries || config.maxQueries;
    const dataset = getGoldenAnswers({ limit: limit === -1 ? undefined : limit });

    const outputResults: OutputMetrics[] = [];
    const faithfulnessScores: number[] = [];
    const correctnessScores: number[] = [];

    for (const golden of dataset) {
      try {
        // Generate response using local AI
        const responseObj = await generateTextLocal({ prompt: golden.query });
        const response = typeof responseObj === "string" ? responseObj : responseObj.text || "";

        // Output evaluation
        const outputMetrics = evaluateOutput({
          query: golden.query,
          response,
          expectedAnswer: golden.expectedAnswer,
          expectedKeywords: golden.expectedKeywords,
          forbiddenKeywords: golden.forbiddenKeywords,
          evaluationCriteria: golden.evaluationCriteria,
        });
        outputResults.push(outputMetrics);

        // Generation quality
        const faithfulness = evaluateFaithfulness({
          answer: response,
          context: golden.expectedAnswer,
          expectedAnswer: golden.expectedAnswer,
        });
        const correctness = evaluateAnswerCorrectness({
          answer: response,
          expectedAnswer: golden.expectedAnswer,
          expectedKeywords: golden.expectedKeywords,
        });

        faithfulnessScores.push(faithfulness);
        correctnessScores.push(correctness);
      } catch (err: any) {
        log.warn(`[Evaluation] Failed for query ${golden.id}: ${err.message}`);
      }
    }

    // Aggregate
    const outputAggregate = aggregateOutputMetrics(outputResults);
    const avgFaithfulness = faithfulnessScores.length > 0 ? faithfulnessScores.reduce((a, b) => a + b, 0) / faithfulnessScores.length : 0;
    const avgCorrectness = correctnessScores.length > 0 ? correctnessScores.reduce((a, b) => a + b, 0) / correctnessScores.length : 0;

    // Threshold gate check
    const thresholds = EVAL_CONFIG.thresholds;
    const failures: string[] = [];

    if (outputAggregate.avgAccuracy < thresholds.outputAccuracy)
      failures.push(`Accuracy: ${(outputAggregate.avgAccuracy * 100).toFixed(1)}%`);
    if (outputAggregate.avgRelevance < thresholds.outputRelevance)
      failures.push(`Relevance: ${(outputAggregate.avgRelevance * 100).toFixed(1)}%`);
    if (avgFaithfulness < thresholds.faithfulness) failures.push(`Faithfulness: ${(avgFaithfulness * 100).toFixed(1)}%`);
    if (avgCorrectness < thresholds.answerCorrectness) failures.push(`Correctness: ${(avgCorrectness * 100).toFixed(1)}%`);

    const overallScore =
      outputAggregate.avgOverallScore * 0.35 + avgFaithfulness * 0.25 + avgCorrectness * 0.25 + outputAggregate.avgRelevance * 0.15;

    const report = {
      timestamp: new Date().toISOString(),
      mode,
      totalQueries: dataset.length,
      output: outputAggregate,
      generation: { avgFaithfulness, avgCorrectness },
      gateCheck: {
        passed: failures.length === 0,
        failures,
        totalChecks: 4,
        passedChecks: 4 - failures.length,
      },
      summary: {
        overallScore,
        verdict: failures.length === 0 ? "PASS" : "FAIL",
      },
    };

    // Cache report
    cache.latestReport = report;
    cache.reportHistory.push({
      timestamp: report.timestamp,
      overallScore,
      verdict: report.summary.verdict,
    });

    // Save to disk
    try {
      if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
      const filename = `eval-report-${report.timestamp.replace(/[:.]/g, "-")}.json`;
      fs.writeFileSync(path.join(REPORTS_DIR, filename), JSON.stringify(report, null, 2));
    } catch (err: any) {
      log.warn(`[Evaluation] Failed to save report: ${err.message}`);
    }

    log.info(`[Evaluation] ✅ Complete: ${report.summary.verdict} (${(overallScore * 100).toFixed(1)}%) — ${dataset.length} queries`);

    return c.json({ success: true, report });
  } catch (err: any) {
    log.error(`[Evaluation] Error:`, err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// GET /evaluation/report/latest — Get latest report
// ══════════════════════════════════════════════════════════════

evaluationApp.get("/report/latest", (c) => {
  if (!cache.latestReport) {
    return c.json({ success: false, error: "No evaluation reports yet" }, 404);
  }
  return c.json({ success: true, report: cache.latestReport });
});

// ══════════════════════════════════════════════════════════════
// GET /evaluation/report/history — Get report history
// ══════════════════════════════════════════════════════════════

evaluationApp.get("/report/history", (c) => {
  return c.json({ success: true, history: cache.reportHistory });
});

// ══════════════════════════════════════════════════════════════
// POST /evaluation/evaluate-single — Evaluate one query
// ══════════════════════════════════════════════════════════════

evaluationApp.post("/evaluate-single", async (c) => {
  try {
    const body = await c.req.json();
    const { query, response, expectedAnswer, expectedKeywords, forbiddenKeywords } = body;

    if (!query || !response) {
      return c.json({ success: false, error: "query and response required" }, 400);
    }

    const outputMetrics = evaluateOutput({
      query,
      response,
      expectedAnswer: expectedAnswer || "",
      expectedKeywords: expectedKeywords || [],
      forbiddenKeywords: forbiddenKeywords || [],
      evaluationCriteria: {
        requireAccuracy: true,
        requireCompleteness: false,
        checkHallucination: true,
        minRelevanceScore: 0.7,
      },
    });

    const faithfulness = expectedAnswer ? evaluateFaithfulness({ answer: response, context: expectedAnswer, expectedAnswer }) : null;

    const correctness = expectedAnswer
      ? evaluateAnswerCorrectness({ answer: response, expectedAnswer, expectedKeywords: expectedKeywords || [] })
      : null;

    return c.json({
      success: true,
      metrics: outputMetrics,
      faithfulness,
      correctness,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// POST /evaluation/feedback — Record user feedback
// ══════════════════════════════════════════════════════════════

evaluationApp.post("/feedback", async (c) => {
  try {
    const body = await c.req.json();
    const { query, response, rating, intent } = body;

    if (!query || !rating) {
      return c.json({ success: false, error: "query and rating required" }, 400);
    }

    cache.feedbackLog.push({
      query,
      response: response || "",
      rating: rating as "up" | "down",
      intent: intent || "UNKNOWN",
      timestamp: Date.now(),
    });

    // Keep last 1000 feedback entries
    if (cache.feedbackLog.length > 1000) {
      cache.feedbackLog = cache.feedbackLog.slice(-1000);
    }

    return c.json({ success: true, totalFeedback: cache.feedbackLog.length });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// GET /evaluation/metrics — Aggregated metrics
// ══════════════════════════════════════════════════════════════

evaluationApp.get("/metrics", (c) => {
  const feedback = cache.feedbackLog;
  const total = feedback.length;
  const upCount = feedback.filter((f) => f.rating === "up").length;
  const downCount = feedback.filter((f) => f.rating === "down").length;
  const satisfactionRate = total > 0 ? upCount / total : 0;

  // Intent breakdown
  const intentBreakdown: Record<string, { total: number; up: number; down: number }> = {};
  for (const f of feedback) {
    if (!intentBreakdown[f.intent]) {
      intentBreakdown[f.intent] = { total: 0, up: 0, down: 0 };
    }
    intentBreakdown[f.intent].total++;
    if (f.rating === "up") intentBreakdown[f.intent].up++;
    else intentBreakdown[f.intent].down++;
  }

  return c.json({
    success: true,
    metrics: {
      totalFeedback: total,
      satisfactionRate,
      upCount,
      downCount,
      intentBreakdown,
      latestReport: cache.latestReport
        ? {
            timestamp: cache.latestReport.timestamp,
            overallScore: cache.latestReport.summary.overallScore,
            verdict: cache.latestReport.summary.verdict,
          }
        : null,
      reportCount: cache.reportHistory.length,
    },
  });
});

// ══════════════════════════════════════════════════════════════
// GET /evaluation/dataset — Get golden dataset info
// ══════════════════════════════════════════════════════════════

evaluationApp.get("/dataset", (c) => {
  const all = GOLDEN_ANSWERS;
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};

  for (const item of all) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    byDifficulty[item.difficulty] = (byDifficulty[item.difficulty] || 0) + 1;
  }

  return c.json({
    success: true,
    dataset: {
      total: all.length,
      byCategory,
      byDifficulty,
    },
  });
});

export { evaluationApp };
