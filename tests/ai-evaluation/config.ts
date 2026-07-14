/**
 * AI Evaluation System Configuration
 *
 * Central config for all evaluation modules: thresholds, dataset paths,
 * evaluation modes, and reporting options.
 */

export const EVAL_CONFIG = {
  /** Threshold gates — evaluation FAILS if any metric drops below */
  thresholds: {
    // Output Evaluation
    outputAccuracy: 0.75,
    outputRelevance: 0.70,
    outputCompleteness: 0.65,
    hallucinationRate: 0.15, // max 15% hallucination
    toxicityRate: 0.0, // zero tolerance

    // RAG Retrieval
    precisionAt3: 0.70,
    recallAt5: 0.75,
    mrr: 0.80,
    ndcgAt5: 0.75,

    // RAG Generation
    faithfulness: 0.75,
    answerCorrectness: 0.70,

    // Agent
    taskSuccessRate: 0.80,
    toolAccuracy: 0.85,

    // Speed
    firstTokenLatencyMs: 2000,
    totalLatencyMs: 15000,
    tokensPerSecond: 10,
  },

  /** Evaluation modes */
  modes: {
    /** Quick evaluation — subset of dataset, skip expensive checks */
    quick: {
      maxQueries: 20,
      skipLLMJudge: true,
      skipAgentEval: true,
      skipSpeedBench: false,
    },
    /** Standard evaluation — full dataset */
    standard: {
      maxQueries: 105,
      skipLLMJudge: false,
      skipAgentEval: false,
      skipSpeedBench: false,
    },
    /** Full evaluation — everything including adversarial */
    full: {
      maxQueries: -1, // all
      skipLLMJudge: false,
      skipAgentEval: false,
      skipSpeedBench: false,
      includeAdversarial: true,
    },
  },

  /** Dataset paths */
  datasets: {
    goldenAnswers: './datasets/golden-answers.ts',
    agentTasks: './datasets/agent-tasks.ts',
  },

  /** Report output */
  reporting: {
    outputDir: './reports',
    format: 'json' as 'json' | 'html' | 'both',
    keepLastN: 30, // keep last 30 reports
  },

  /** LLM Judge config */
  judge: {
    /** Use local AI for judging (true) or external API (false) */
    useLocal: true,
    /** Temperature for judge LLM */
    temperature: 0.1,
    /** Number of judge runs per sample (for reliability) */
    runsPerSample: 1,
  },

  /** Speed benchmark config */
  speed: {
    /** Number of warmup requests */
    warmup: 3,
    /** Number of measurement requests */
    iterations: 10,
    /** Concurrent requests for throughput test */
    concurrency: 5,
  },
} as const;

export type EvalMode = keyof typeof EVAL_CONFIG.modes;
export type Thresholds = typeof EVAL_CONFIG.thresholds;
