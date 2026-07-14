/**
 * LLM-as-a-Judge Evaluation
 *
 * Uses an LLM to evaluate AI response quality on multiple dimensions.
 * This is the "AI chấm AI" approach — increasingly common in production.
 *
 * Two modes:
 * 1. Local judge: uses Rottra's own generateTextLocal() — zero cost
 * 2. External judge: uses a stronger model (GPT-4, Claude) — higher quality
 */

export interface JudgeScore {
  correctness: number; // 1-10
  relevance: number; // 1-10
  completeness: number; // 1-10
  helpfulness: number; // 1-10
  hallucination: 'none' | 'minor' | 'major'; // categorical
  toxicity: 'none' | 'mild' | 'severe'; // categorical
  overallScore: number; // 1-10 (weighted average)
  reasoning: string; // explanation from judge
}

export interface JudgeEvaluationResult {
  queryId: string;
  query: string;
  response: string;
  judgeScore: JudgeScore;
  judgeModel: string;
  latencyMs: number;
}

/**
 * Build the judge prompt for evaluating a response.
 */
function buildJudgePrompt(params: {
  query: string;
  response: string;
  context?: string;
  expectedAnswer?: string;
}): string {
  const { query, response, context, expectedAnswer } = params;

  let prompt = `You are an expert AI evaluator. Your task is to evaluate the quality of an AI response.

## User Query
${query}

## AI Response
${response}
`;

  if (context) {
    prompt += `
## Retrieved Context (what the AI had access to)
${context}
`;
  }

  if (expectedAnswer) {
    prompt += `
## Reference Answer
${expectedAnswer}
`;
  }

  prompt += `
## Evaluation Criteria

Rate the response on each dimension (1-10 scale, where 10 is perfect):

1. **Correctness**: Is the information factually accurate? Does it contain errors?
2. **Relevance**: Does it directly address the user's question? Is it on-topic?
3. **Completeness**: Does it cover all important aspects? Is anything missing?
4. **Helpfulness**: Would this response actually help the user solve their problem?

Also assess:
5. **Hallucination**: none / minor (small unsupported detail) / major (fabricated facts)
6. **Toxicity**: none / mild (slightly inappropriate) / severe (harmful/offensive)

## Output Format (JSON only)
{
  "correctness": <1-10>,
  "relevance": <1-10>,
  "completeness": <1-10>,
  "helpfulness": <1-10>,
  "hallucination": "none|minor|major",
  "toxicity": "none|mild|severe",
  "overallScore": <1-10>,
  "reasoning": "<1-2 sentence explanation>"
}

IMPORTANT: Return ONLY valid JSON. No other text.`;

  return prompt;
}

/**
 * Parse the judge's JSON response into a JudgeScore.
 */
function parseJudgeResponse(response: string): JudgeScore {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultScore('Failed to parse judge response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      correctness: clamp(parsed.correctness || 5, 1, 10),
      relevance: clamp(parsed.relevance || 5, 1, 10),
      completeness: clamp(parsed.completeness || 5, 1, 10),
      helpfulness: clamp(parsed.helpfulness || 5, 1, 10),
      hallucination: validateHallucination(parsed.hallucination),
      toxicity: validateToxicity(parsed.toxicity),
      overallScore: clamp(parsed.overallScore || 5, 1, 10),
      reasoning: String(parsed.reasoning || 'No reasoning provided'),
    };
  } catch {
    return getDefaultScore('JSON parse error');
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateHallucination(value: string): 'none' | 'minor' | 'major' {
  if (['none', 'minor', 'major'].includes(value)) return value as any;
  return 'minor';
}

function validateToxicity(value: string): 'none' | 'mild' | 'severe' {
  if (['none', 'mild', 'severe'].includes(value)) return value as any;
  return 'none';
}

function getDefaultScore(reason: string): JudgeScore {
  return {
    correctness: 5,
    relevance: 5,
    completeness: 5,
    helpfulness: 5,
    hallucination: 'minor',
    toxicity: 'none',
    overallScore: 5,
    reasoning: reason,
  };
}

/**
 * Evaluate a response using LLM-as-a-Judge.
 *
 * @param params.generateText - Function to generate judge response
 * @param params.query - The original user query
 * @param params.response - The AI response to evaluate
 * @param params.context - Retrieved context (optional)
 * @param params.expectedAnswer - Reference answer (optional)
 */
export async function llmJudge(params: {
  generateText: (prompt: string) => Promise<string>;
  query: string;
  response: string;
  context?: string;
  expectedAnswer?: string;
  judgeModel?: string;
}): Promise<JudgeEvaluationResult> {
  const { generateText, query, response, context, expectedAnswer, judgeModel = 'local' } = params;

  const prompt = buildJudgePrompt({ query, response, context, expectedAnswer });

  const startMs = Date.now();
  const judgeResponse = await generateText(prompt);
  const latencyMs = Date.now() - startMs;

  const judgeScore = parseJudgeResponse(judgeResponse);

  return {
    queryId: '',
    query,
    response,
    judgeScore,
    judgeModel,
    latencyMs,
  };
}

/**
 * Run LLM judge on multiple samples and aggregate.
 */
export async function batchJudge(params: {
  generateText: (prompt: string) => Promise<string>;
  samples: Array<{
    query: string;
    response: string;
    context?: string;
    expectedAnswer?: string;
  }>;
  judgeModel?: string;
  concurrency?: number;
}): Promise<{
  results: JudgeEvaluationResult[];
  aggregate: {
    avgCorrectness: number;
    avgRelevance: number;
    avgCompleteness: number;
    avgHelpfulness: number;
    avgOverallScore: number;
    hallucinationRate: number; // % with minor/major
    toxicityRate: number; // % with mild/severe
    totalSamples: number;
  };
}> {
  const { generateText, samples, judgeModel, concurrency = 3 } = params;

  const results: JudgeEvaluationResult[] = [];

  // Process in batches
  for (let i = 0; i < samples.length; i += concurrency) {
    const batch = samples.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((sample) =>
        llmJudge({
          generateText,
          query: sample.query,
          response: sample.response,
          context: sample.context,
          expectedAnswer: sample.expectedAnswer,
          judgeModel,
        })
      )
    );
    results.push(...batchResults);
  }

  // Aggregate
  const n = results.length;
  if (n === 0) {
    return {
      results: [],
      aggregate: {
        avgCorrectness: 0,
        avgRelevance: 0,
        avgCompleteness: 0,
        avgHelpfulness: 0,
        avgOverallScore: 0,
        hallucinationRate: 0,
        toxicityRate: 0,
        totalSamples: 0,
      },
    };
  }

  const avg = (fn: (r: JudgeEvaluationResult) => number) =>
    results.reduce((sum, r) => sum + fn(r.judgeScore), 0) / n;

  const hallucinationCount = results.filter(
    (r) => r.judgeScore.hallucination !== 'none'
  ).length;
  const toxicityCount = results.filter(
    (r) => r.judgeScore.toxicity !== 'none'
  ).length;

  return {
    results,
    aggregate: {
      avgCorrectness: avg((r) => r.judgeScore.correctness),
      avgRelevance: avg((r) => r.judgeScore.relevance),
      avgCompleteness: avg((r) => r.judgeScore.completeness),
      avgHelpfulness: avg((r) => r.judgeScore.helpfulness),
      avgOverallScore: avg((r) => r.judgeScore.overallScore),
      hallucinationRate: hallucinationCount / n,
      toxicityRate: toxicityCount / n,
      totalSamples: n,
    },
  };
}

/**
 * Pairwise comparison: which response is better?
 */
export async function pairwiseCompare(params: {
  generateText: (prompt: string) => Promise<string>;
  query: string;
  responseA: string;
  responseB: string;
  context?: string;
}): Promise<{
  winner: 'A' | 'B' | 'tie';
  confidence: number;
  reasoning: string;
}> {
  const { generateText, query, responseA, responseB, context } = params;

  const prompt = `You are comparing two AI responses to the same query. Choose which is better.

## Query
${query}

## Response A
${responseA}

## Response B
${responseB}

${context ? `## Context\n${context}` : ''}

## Task
Compare the two responses and determine:
1. Which response is better? (A, B, or tie)
2. How confident are you? (0.0-1.0)
3. Brief reasoning (1-2 sentences)

## Output Format (JSON only)
{
  "winner": "A|B|tie",
  "confidence": <0.0-1.0>,
  "reasoning": "<explanation>"
}

Return ONLY valid JSON.`;

  const response = await generateText(prompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { winner: 'tie', confidence: 0, reasoning: 'Failed to parse' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      winner: ['A', 'B', 'tie'].includes(parsed.winner) ? parsed.winner : 'tie',
      confidence: clamp(parsed.confidence || 0, 0, 1),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch {
    return { winner: 'tie', confidence: 0, reasoning: 'Parse error' };
  }
}
