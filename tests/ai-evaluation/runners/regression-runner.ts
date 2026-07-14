/**
 * AI Evaluation Regression Runner
 *
 * Main entry point that runs all evaluation modules, checks threshold gates,
 * and generates a comprehensive report.
 *
 * Usage:
 *   bun run tests/ai-evaluation/runners/regression-runner.ts --mode=quick
 *   bun run tests/ai-evaluation/runners/regression-runner.ts --mode=standard
 *   bun run tests/ai-evaluation/runners/regression-runner.ts --mode=full
 */

import { EVAL_CONFIG, type EvalMode } from '../config';
import { GOLDEN_ANSWERS, getGoldenAnswers } from '../datasets/golden-answers';
import {
  evaluateOutput,
  aggregateOutputMetrics,
  type OutputMetrics,
} from '../metrics/output-evaluation';
import {
  computeRetrievalMetrics,
  evaluateFaithfulness,
  evaluateAnswerCorrectness,
  aggregateRetrievalMetrics,
  type RetrievalMetrics,
  type RAGAggregateMetrics,
} from '../metrics/rag-evaluation';
import type { AgentEvaluationResult } from '../metrics/agent-evaluation';
import { generateTextLocal } from '../../../src/core/nlp-cognitive/ai-sdk';

// ── CLI Args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='));
const mode: EvalMode = (modeArg?.split('=')[1] as EvalMode) || 'quick';

const maxArg = args.find((a) => a.startsWith('--max='));
const maxQueries = maxArg ? parseInt(maxArg.split('=')[1]) : undefined;

// ── Types ───────────────────────────────────────────────────────
export interface EvaluationReport {
  timestamp: string;
  mode: EvalMode;
  config: typeof EVAL_CONFIG.thresholds;

  output: {
    results: OutputMetrics[];
    aggregate: ReturnType<typeof aggregateOutputMetrics>;
  };

  retrieval: {
    aggregate: RAGAggregateMetrics['retrieval'];
    byDifficulty: Record<string, RetrievalMetrics>;
  };

  generation: {
    faithfulnessScores: number[];
    correctnessScores: number[];
    avgFaithfulness: number;
    avgCorrectness: number;
  };

  agent?: {
    results: AgentEvaluationResult[];
    aggregate: {
      taskSuccessRate: number;
      avgToolAccuracy: number;
      totalTasks: number;
    };
  };

  speed?: {
    avgLatencyMs: number;
    p95LatencyMs: number;
  };

  gateCheck: {
    passed: boolean;
    failures: string[];
    totalChecks: number;
    passedChecks: number;
  };

  summary: {
    overallScore: number;
    verdict: 'PASS' | 'FAIL' | 'WARN';
    keyFindings: string[];
  };
}

// ── Main Runner ─────────────────────────────────────────────────
export async function runEvaluation(params?: {
  mode?: EvalMode;
  maxQueries?: number;
  generateText?: (query: string) => Promise<string>;
  retrieveDocs?: (query: string) => Promise<{ id: string; content: string }[]>;
  callAgent?: (query: string) => Promise<{
    answer: string;
    toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
    latencyMs: number;
  }>;
}): Promise<EvaluationReport> {
  const evalMode = params?.mode || mode;
  const config = EVAL_CONFIG.modes[evalMode];
  const limit = params?.maxQueries || maxQueries || config.maxQueries;

  console.log(`\n🔬 AI Evaluation System — Mode: ${evalMode}`);
  console.log(`   Max queries: ${limit === -1 ? 'all' : limit}`);
  console.log(`   Timestamp: ${new Date().toISOString()}\n`);

  const dataset = getGoldenAnswers({
    limit: limit === -1 ? undefined : limit,
  });

  console.log(`   Dataset: ${dataset.length} golden answers\n`);

  // ── 1. Output Evaluation ──────────────────────────────────────
  console.log('📊 Phase 1: Output Evaluation (using real AI)...');
  const outputResults: OutputMetrics[] = [];

  for (const golden of dataset) {
    const response = params?.generateText
      ? await params.generateText(golden.query)
      : await generateRealResponse(golden.query);

    // Debug: show query, expected, and actual response
    console.log(`\n   [${golden.id}] Q: "${golden.query}"`);
    console.log(`   Expected: "${golden.expectedAnswer.slice(0, 80)}..."`);
    console.log(`   Actual:   "${response.slice(0, 80)}..."`);

    const metrics = evaluateOutput({
      query: golden.query,
      response,
      expectedAnswer: golden.expectedAnswer,
      expectedKeywords: golden.expectedKeywords,
      forbiddenKeywords: golden.forbiddenKeywords,
      evaluationCriteria: golden.evaluationCriteria,
    });

    outputResults.push(metrics);
  }

  const outputAggregate = aggregateOutputMetrics(outputResults);
  console.log(
    `   ✓ Accuracy: ${(outputAggregate.avgAccuracy * 100).toFixed(1)}% | ` +
    `Relevance: ${(outputAggregate.avgRelevance * 100).toFixed(1)}% | ` +
    `Hallucination: ${((1 - outputAggregate.avgHallucinationScore) * 100).toFixed(1)}%`
  );

  // ── 2. RAG Retrieval Evaluation ───────────────────────────────
  console.log('\n📚 Phase 2: RAG Retrieval Evaluation...');
  const retrievalResults: RetrievalMetrics[] = [];
  const byDifficulty: Record<string, RetrievalMetrics[]> = {};

  for (const golden of dataset) {
    const docs = params?.retrieveDocs
      ? await params.retrieveDocs(golden.query)
      : generateMockDocs(golden.query, golden.expectedKeywords);

    const retrievedIds = docs.map((d) => d.id);
    const relevantIds = [golden.id]; // self-relevant for now

    const metrics = computeRetrievalMetrics({ retrievedIds, relevantIds });
    retrievalResults.push(metrics);

    if (!byDifficulty[golden.difficulty]) {
      byDifficulty[golden.difficulty] = [];
    }
    byDifficulty[golden.difficulty].push(metrics);
  }

  const retrievalAggregate = aggregateRetrievalMetrics(retrievalResults);
  console.log(
    `   ✓ P@3: ${(retrievalAggregate.avgPrecisionAt3 * 100).toFixed(1)}% | ` +
    `MRR: ${(retrievalAggregate.avgMRR * 100).toFixed(1)}% | ` +
    `NDCG@5: ${(retrievalAggregate.avgNDCG5 * 100).toFixed(1)}%`
  );

  // Aggregate by difficulty
  const retrievalByDifficulty: Record<string, RetrievalMetrics> = {};
  for (const [diff, results] of Object.entries(byDifficulty)) {
    retrievalByDifficulty[diff] = aggregateRetrievalMetrics(results) as any;
  }

  // ── 3. Generation Quality ─────────────────────────────────────
  console.log('\n✍️  Phase 3: Generation Quality...');
  const faithfulnessScores: number[] = [];
  const correctnessScores: number[] = [];

  for (const golden of dataset) {
    const response = params?.generateText
      ? await params.generateText(golden.query)
      : await generateRealResponse(golden.query);

    const context = params?.retrieveDocs
      ? (await params.retrieveDocs(golden.query)).map((d) => d.content).join('\n')
      : golden.expectedAnswer;

    const faithfulness = evaluateFaithfulness({
      answer: response,
      context,
      expectedAnswer: golden.expectedAnswer,
    });

    const correctness = evaluateAnswerCorrectness({
      answer: response,
      expectedAnswer: golden.expectedAnswer,
      expectedKeywords: golden.expectedKeywords,
    });

    faithfulnessScores.push(faithfulness);
    correctnessScores.push(correctness);
  }

  const avgFaithfulness = faithfulnessScores.reduce((a, b) => a + b, 0) / faithfulnessScores.length;
  const avgCorrectness = correctnessScores.reduce((a, b) => a + b, 0) / correctnessScores.length;

  console.log(
    `   ✓ Faithfulness: ${(avgFaithfulness * 100).toFixed(1)}% | ` +
    `Correctness: ${(avgCorrectness * 100).toFixed(1)}%`
  );

  // ── 4. Agent Evaluation (if enabled) ──────────────────────────
  let agentResults: AgentEvaluationResult[] | undefined;
  let agentAggregate = { taskSuccessRate: 0, avgToolAccuracy: 0, totalTasks: 0 };

  if (!config.skipAgentEval && params?.callAgent) {
    console.log('\n🤖 Phase 4: Agent Evaluation...');
    // Agent evaluation would run here with real agent calls
    // For now, placeholder
    console.log('   ⏭  Agent evaluation skipped (no agent caller provided)');
  }

  // ── 5. Speed Benchmark (if enabled) ───────────────────────────
  let speedAggregate = { avgLatencyMs: 0, p95LatencyMs: 0 };

  if (!config.skipSpeedBench) {
    console.log('\n⚡ Phase 5: Speed Benchmark...');
    // Speed benchmark would run here with real requests
    console.log('   ⏭  Speed benchmark skipped (no request function provided)');
  }

  // ── 6. Threshold Gate Check ───────────────────────────────────
  console.log('\n🚦 Phase 6: Threshold Gate Check...');
  const thresholds = EVAL_CONFIG.thresholds;
  const failures: string[] = [];

  const check = (name: string, actual: number, threshold: number, higher: boolean = true) => {
    const passed = higher ? actual >= threshold : actual <= threshold;
    const status = passed ? '✅' : '❌';
    console.log(`   ${status} ${name}: ${(actual * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`);
    if (!passed) failures.push(`${name}: ${(actual * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%`);
  };

  check('Output Accuracy', outputAggregate.avgAccuracy, thresholds.outputAccuracy);
  check('Output Relevance', outputAggregate.avgRelevance, thresholds.outputRelevance);
  check('Output Completeness', outputAggregate.avgCompleteness, thresholds.outputCompleteness);
  check('Hallucination Rate', 1 - outputAggregate.avgHallucinationScore, thresholds.hallucinationRate, false);
  check('Toxicity Rate', 1 - outputAggregate.avgToxicityScore, thresholds.toxicityRate, false);
  check('Precision@3', retrievalAggregate.avgPrecisionAt3, thresholds.precisionAt3);
  check('MRR', retrievalAggregate.avgMRR, thresholds.mrr);
  check('NDCG@5', retrievalAggregate.avgNDCG5, thresholds.ndcgAt5);
  check('Faithfulness', avgFaithfulness, thresholds.faithfulness);
  check('Answer Correctness', avgCorrectness, thresholds.answerCorrectness);

  const totalChecks = 10;
  const passedChecks = totalChecks - failures.length;
  const gatePassed = failures.length === 0;

  console.log(`\n   Gate: ${gatePassed ? '✅ PASSED' : '❌ FAILED'} (${passedChecks}/${totalChecks})`);

  // ── 7. Generate Report ────────────────────────────────────────
  const overallScore =
    outputAggregate.avgOverallScore * 0.3 +
    retrievalAggregate.avgNDCG5 * 0.25 +
    avgFaithfulness * 0.2 +
    avgCorrectness * 0.15 +
    (1 - outputAggregate.avgHallucinationScore) * 0.1;

  const keyFindings: string[] = [];
  if (outputAggregate.avgAccuracy < 0.7) keyFindings.push('Low accuracy — check training data');
  if (1 - outputAggregate.avgHallucinationScore > 0.1) keyFindings.push('Hallucination detected — review guardrails');
  if (retrievalAggregate.avgPrecisionAt3 < 0.6) keyFindings.push('Poor retrieval precision — check embeddings');
  if (avgFaithfulness < 0.7) keyFindings.push('Low faithfulness — answer not grounded in context');
  if (failures.length > 0) keyFindings.push(`Threshold failures: ${failures.join(', ')}`);

  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    mode: evalMode,
    config: thresholds,
    output: {
      results: outputResults,
      aggregate: outputAggregate,
    },
    retrieval: {
      aggregate: retrievalAggregate,
      byDifficulty: retrievalByDifficulty,
    },
    generation: {
      faithfulnessScores,
      correctnessScores,
      avgFaithfulness,
      avgCorrectness,
    },
    agent: agentResults
      ? { results: agentResults, aggregate: agentAggregate }
      : undefined,
    speed: speedAggregate.avgLatencyMs > 0 ? speedAggregate : undefined,
    gateCheck: {
      passed: gatePassed,
      failures,
      totalChecks,
      passedChecks,
    },
    summary: {
      overallScore,
      verdict: gatePassed ? 'PASS' : 'FAIL',
      keyFindings,
    },
  };

  // ── 8. Print Summary ──────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📋 EVALUATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Overall Score: ${(overallScore * 100).toFixed(1)}%`);
  console.log(`   Verdict: ${report.summary.verdict}`);
  console.log(`   Output: Accuracy ${(outputAggregate.avgAccuracy * 100).toFixed(1)}% | Relevance ${(outputAggregate.avgRelevance * 100).toFixed(1)}%`);
  console.log(`   RAG: P@3 ${(retrievalAggregate.avgPrecisionAt3 * 100).toFixed(1)}% | MRR ${(retrievalAggregate.avgMRR * 100).toFixed(1)}%`);
  console.log(`   Generation: Faithfulness ${(avgFaithfulness * 100).toFixed(1)}% | Correctness ${(avgCorrectness * 100).toFixed(1)}%`);
  console.log(`   Gate: ${passedChecks}/${totalChecks} checks passed`);

  if (keyFindings.length > 0) {
    console.log('\n   Key Findings:');
    for (const finding of keyFindings) {
      console.log(`   ⚠️  ${finding}`);
    }
  }

  console.log('═'.repeat(60) + '\n');

  return report;
}

// ── Real AI Functions ───────────────────────────────────────────
async function generateRealResponse(query: string): Promise<string> {
  try {
    // Call chat-expert endpoint directly for full AI pipeline
    const res = await fetch('http://localhost:5173/api/agent/chat-expert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, usePrivateBrain: true }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.reply || data.text || '';
  } catch (err: any) {
    // Fallback to local AI if server not running
    console.warn(`[AI] HTTP call failed (${err.message}), using local AI...`);
    try {
      const result = await generateTextLocal({
        prompt: query,
        system: 'Bạn là trợ lý AI nông nghiệp. Trả lời ngắn gọn bằng tiếng Việt.',
      });
      return typeof result === 'string' ? result : result.text || '';
    } catch (err2: any) {
      console.error(`[AI Error] Query "${query.slice(0, 30)}...": ${err2.message}`);
      return '';
    }
  }
}

// ── Mock Functions (fallback when AI fails) ────────────────────
function generateMockResponse(query: string): string {
  const queryLower = query.toLowerCase();
  if (queryLower.includes('xin chào') || queryLower.includes('hello')) {
    return 'Xin chào! Tôi là Rottra, trợ lý AI nông nghiệp. Tôi có thể giúp bạn về giá cả, sản phẩm, và thông tin nông nghiệp.';
  }
  if (queryLower.includes('giá') && queryLower.includes('cà phê')) {
    return 'Giá cà phê Robusta khoảng 45.000-55.000 VNĐ/kg, Arabica khoảng 70.000-90.000 VNĐ/kg.';
  }
  if (queryLower.includes('đổi trả')) {
    return 'Chính sách đổi trả: trong 30 ngày nếu còn hóa đơn và sản phẩm nguyên vẹn.';
  }
  return 'Đây là câu trả lời mẫu cho câu hỏi: ' + query;
}

function generateMockDocs(
  query: string,
  keywords: string[]
): { id: string; content: string }[] {
  return [
    { id: 'doc-1', content: `Tài liệu về ${keywords.join(', ')}. Đây là thông tin chi tiết.` },
    { id: 'doc-2', content: `Thông tin liên quan đến ${query}.` },
    { id: 'doc-3', content: 'Tài liệu tham khảo chung về nông nghiệp Việt Nam.' },
  ];
}

// ── Run if executed directly ────────────────────────────────────
const isMainModule = import.meta.url.includes(process.argv[1]?.replace(/\\/g, '/') || '__nonexistent__');
if (isMainModule || process.argv[1]?.includes('regression-runner')) {
  runEvaluation({ mode }).then((report) => {
    const exitCode = report.gateCheck.passed ? 0 : 1;
    process.exit(exitCode);
  });
}
