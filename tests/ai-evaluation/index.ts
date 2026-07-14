/**
 * AI Evaluation System — Entry Point
 *
 * Rottra's comprehensive AI evaluation framework.
 *
 * Modules:
 * - Output Evaluation: accuracy, relevance, completeness, hallucination, toxicity
 * - RAG Evaluation: retrieval metrics (P@k, MRR, NDCG) + generation quality (faithfulness, correctness)
 * - Agent Evaluation: tool usage accuracy, task success rate, error classification
 * - Speed Benchmark: first token latency, total latency, throughput
 * - LLM-as-a-Judge: AI-evaluates-AI with pairwise comparison
 * - Regression Runner: threshold gates, automated pass/fail
 * - Report Generator: JSON + HTML reports
 *
 * Usage:
 *   # Quick evaluation (20 queries, no LLM judge)
 *   bun run tests/ai-evaluation/index.ts --mode=quick
 *
 *   # Standard evaluation (full dataset)
 *   bun run tests/ai-evaluation/index.ts --mode=standard
 *
 *   # Full evaluation (everything)
 *   bun run tests/ai-evaluation/index.ts --mode=full
 *
 *   # Custom max queries
 *   bun run tests/ai-evaluation/index.ts --mode=quick --max=10
 */

export { EVAL_CONFIG, type EvalMode, type Thresholds } from './config';

export {
  GOLDEN_ANSWERS,
  getGoldenAnswers,
  type GoldenAnswer,
  type GoldenCategory,
} from './datasets/golden-answers';

export {
  evaluateOutput,
  aggregateOutputMetrics,
  type OutputMetrics,
} from './metrics/output-evaluation';

export {
  precisionAtK,
  recallAtK,
  meanReciprocalRank,
  ndcgAt5,
  evaluateFaithfulness,
  evaluateAnswerCorrectness,
  computeRetrievalMetrics,
  aggregateRetrievalMetrics,
  type RetrievalMetrics,
  type GenerationMetrics,
  type RAGEvaluationResult,
  type RAGAggregateMetrics,
} from './metrics/rag-evaluation';

export {
  evaluateAgentTask,
  aggregateAgentMetrics,
  type AgentTask,
  type AgentEvaluationResult,
  type AgentTaskCategory,
} from './metrics/agent-evaluation';

export {
  measureSpeed,
  runSpeedBenchmark,
  aggregateSpeedResults,
  type SpeedBenchmarkResult,
  type SpeedAggregateResults,
} from './metrics/speed-benchmark';

export {
  llmJudge,
  batchJudge,
  pairwiseCompare,
  type JudgeScore,
  type JudgeEvaluationResult,
} from './metrics/llm-judge';

export { runEvaluation, type EvaluationReport } from './runners/regression-runner';
export {
  saveReport,
  loadLatestReport,
  generateHTMLReport,
  saveReportFull,
} from './runners/report-generator';
