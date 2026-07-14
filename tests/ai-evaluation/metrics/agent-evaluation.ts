/**
 * Agent Evaluation Metrics
 *
 * Evaluates AI Agent capabilities: tool usage accuracy, task completion,
 * multi-step reasoning, and error handling.
 */

export interface AgentTask {
  id: string;
  description: string;
  query: string;
  expectedToolCalls: ToolCall[];
  expectedAnswer: string;
  category: AgentTaskCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  maxSteps: number;
  timeoutMs: number;
}

export type AgentTaskCategory =
  | 'product_search'
  | 'order_lookup'
  | 'price_inquiry'
  | 'math_calculation'
  | 'navigation'
  | 'negotiation'
  | 'information_retrieval'
  | 'multi_step';

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  required: boolean; // must be called for task success
}

export interface AgentEvaluationResult {
  taskId: string;
  taskSuccess: boolean;
  toolCalls: {
    expected: string[];
    actual: string[];
    correct: string[];
    unnecessary: string[];
    missing: string[];
    toolAccuracy: number; // correct / (correct + unnecessary + missing)
  };
  stepCount: number;
  withinStepLimit: boolean;
  latencyMs: number;
  errorType: AgentErrorType | null;
}

export type AgentErrorType =
  | 'wrong_tool'
  | 'missing_tool'
  | 'incorrect_args'
  | 'timeout'
  | 'hallucination'
  | 'incorrect_answer'
  | 'step_overflow';

/**
 * Evaluate a single agent task result.
 */
export function evaluateAgentTask(params: {
  task: AgentTask;
  actualToolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
  actualAnswer: string;
  latencyMs: number;
}): AgentEvaluationResult {
  const { task, actualToolCalls, actualAnswer, latencyMs } = params;

  const expectedToolNames = task.expectedToolCalls.map((tc) => tc.toolName);
  const actualToolNames = actualToolCalls.map((tc) => tc.toolName);

  // Find correct tool calls (name matches expected)
  const correct: string[] = [];
  const usedExpected = new Set<number>();

  for (const actual of actualToolNames) {
    const idx = task.expectedToolCalls.findIndex(
      (exp, i) => exp.toolName === actual && !usedExpected.has(i)
    );
    if (idx >= 0) {
      correct.push(actual);
      usedExpected.add(idx);
    }
  }

  // Find unnecessary tool calls
  const unnecessary = actualToolNames.filter((name) => !correct.includes(name));

  // Find missing tool calls
  const missing = task.expectedToolCalls
    .filter((exp) => exp.required)
    .filter((_, i) => !usedExpected.has(i))
    .map((exp) => exp.toolName);

  // Tool accuracy
  const totalRelevant = correct.length + unnecessary.length + missing.length;
  const toolAccuracy = totalRelevant > 0 ? correct.length / totalRelevant : 1.0;

  // Step count
  const stepCount = actualToolCalls.length;
  const withinStepLimit = stepCount <= task.maxSteps;

  // Check for incorrect arguments
  let hasIncorrectArgs = false;
  for (const actual of actualToolCalls) {
    const expected = task.expectedToolCalls.find(
      (exp) => exp.toolName === actual.toolName
    );
    if (expected) {
      // Simple check: required args present
      for (const key of Object.keys(expected.args)) {
        if (!(key in actual.args)) {
          hasIncorrectArgs = true;
          break;
        }
      }
    }
  }

  // Determine error type
  let errorType: AgentErrorType | null = null;
  if (!withinStepLimit) {
    errorType = 'step_overflow';
  } else if (missing.length > 0) {
    errorType = 'missing_tool';
  } else if (unnecessary.length > 0) {
    errorType = 'wrong_tool';
  } else if (hasIncorrectArgs) {
    errorType = 'incorrect_args';
  } else if (latencyMs > task.timeoutMs) {
    errorType = 'timeout';
  } else {
    // Check answer correctness
    const answerLower = actualAnswer.toLowerCase();
    const expectedLower = task.expectedAnswer.toLowerCase();
    const answerWords = new Set(answerLower.split(/\s+/).filter((w) => w.length > 2));
    const expectedWords = new Set(expectedLower.split(/\s+/).filter((w) => w.length > 2));
    const overlap = [...answerWords].filter((w) => expectedWords.has(w)).length;
    const answerRelevance = expectedWords.size > 0 ? overlap / expectedWords.size : 0.5;

    if (answerRelevance < 0.3) {
      errorType = 'incorrect_answer';
    }
  }

  // Task success: all required tools called + correct answer + within limits
  const allRequiredCalled = task.expectedToolCalls
    .filter((tc) => tc.required)
    .every((tc) => actualToolNames.includes(tc.toolName));

  const answerLower = actualAnswer.toLowerCase();
  const expectedLower = task.expectedAnswer.toLowerCase();
  const answerWords = new Set(answerLower.split(/\s+/).filter((w) => w.length > 2));
  const expectedWords = new Set(expectedLower.split(/\s+/).filter((w) => w.length > 2));
  const overlap = [...answerWords].filter((w) => expectedWords.has(w)).length;
  const answerRelevance = expectedWords.size > 0 ? overlap / expectedWords.size : 0.5;

  const taskSuccess =
    allRequiredCalled &&
    answerRelevance >= 0.3 &&
    withinStepLimit &&
    latencyMs <= task.timeoutMs;

  return {
    taskId: task.id,
    taskSuccess,
    toolCalls: {
      expected: expectedToolNames,
      actual: actualToolNames,
      correct,
      unnecessary,
      missing,
      toolAccuracy,
    },
    stepCount,
    withinStepLimit,
    latencyMs,
    errorType,
  };
}

/**
 * Aggregate agent evaluation results.
 */
export function aggregateAgentMetrics(results: AgentEvaluationResult[]): {
  taskSuccessRate: number;
  avgToolAccuracy: number;
  avgStepCount: number;
  stepOverflowRate: number;
  avgLatencyMs: number;
  errorDistribution: Record<string, number>;
  totalTasks: number;
} {
  if (results.length === 0) {
    return {
      taskSuccessRate: 0,
      avgToolAccuracy: 0,
      avgStepCount: 0,
      stepOverflowRate: 0,
      avgLatencyMs: 0,
      errorDistribution: {},
      totalTasks: 0,
    };
  }

  const n = results.length;
  const avg = (fn: (r: AgentEvaluationResult) => number) =>
    results.reduce((sum, r) => sum + fn(r), 0) / n;

  const successCount = results.filter((r) => r.taskSuccess).length;
  const overflowCount = results.filter((r) => !r.withinStepLimit).length;

  // Error distribution
  const errorDist: Record<string, number> = {};
  for (const r of results) {
    if (r.errorType) {
      errorDist[r.errorType] = (errorDist[r.errorType] || 0) + 1;
    }
  }

  // Normalize to percentages
  const errorDistribution: Record<string, number> = {};
  for (const [key, count] of Object.entries(errorDist)) {
    errorDistribution[key] = count / n;
  }

  return {
    taskSuccessRate: successCount / n,
    avgToolAccuracy: avg((r) => r.toolCalls.toolAccuracy),
    avgStepCount: avg((r) => r.stepCount),
    stepOverflowRate: overflowCount / n,
    avgLatencyMs: avg((r) => r.latencyMs),
    errorDistribution,
    totalTasks: n,
  };
}
