/**
 * End-to-End RAG Evaluation Metrics
 *
 * Evaluates the full RAG pipeline: retrieval quality + generation quality.
 * Extends the existing RAG metrics with faithfulness and answer correctness.
 */

import type { GoldenAnswer } from '../datasets/golden-answers';

export interface RetrievalMetrics {
  precisionAt1: number;
  precisionAt3: number;
  precisionAt5: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number; // Mean Reciprocal Rank
  ndcgAt5: number;
  hitRate: number; // % of queries with at least 1 relevant result
}

export interface GenerationMetrics {
  faithfulness: number; // 0-1: does the answer stay faithful to retrieved context
  answerCorrectness: number; // 0-1: does the answer match the expected answer
  relevanceToContext: number; // 0-1: is the answer relevant to retrieved docs
}

export interface RAGEvaluationResult {
  queryId: string;
  query: string;
  retrieval: RetrievalMetrics;
  generation: GenerationMetrics;
  latencyMs: number;
  retrievedDocs: string[];
  generatedAnswer: string;
}

export interface RAGAggregateMetrics {
  retrieval: {
    avgPrecisionAt1: number;
    avgPrecisionAt3: number;
    avgPrecisionAt5: number;
    avgRecallAt3: number;
    avgRecallAt5: number;
    avgMRR: number;
    avgNDCG5: number;
    avgHitRate: number;
  };
  generation: {
    avgFaithfulness: number;
    avgAnswerCorrectness: number;
    avgRelevanceToContext: number;
  };
  totalQueries: number;
  avgLatencyMs: number;
  retrievalByDifficulty: Record<string, RetrievalMetrics>;
  retrievalByCategory: Record<string, RetrievalMetrics>;
}

/**
 * Compute Precision@K for a single query.
 * Precision@K = (relevant docs in top K) / K
 */
export function precisionAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  const topK = retrievedIds.slice(0, k);
  const relevantInTopK = topK.filter((id) => relevantIds.includes(id)).length;
  return relevantInTopK / k;
}

/**
 * Compute Recall@K for a single query.
 * Recall@K = (relevant docs in top K) / (total relevant docs)
 */
export function recallAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  if (relevantIds.length === 0) return 1.0;
  const topK = retrievedIds.slice(0, k);
  const relevantInTopK = topK.filter((id) => relevantIds.includes(id)).length;
  return relevantInTopK / relevantIds.length;
}

/**
 * Compute MRR (Mean Reciprocal Rank) for a single query.
 * MRR = 1 / rank of first relevant result
 */
export function meanReciprocalRank(retrievedIds: string[], relevantIds: string[]): number {
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevantIds.includes(retrievedIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Compute NDCG@5 for a single query.
 * Uses binary relevance (1 if relevant, 0 if not).
 */
export function ndcgAt5(retrievedIds: string[], relevantIds: string[]): number {
  const k = 5;

  // DCG
  let dcg = 0;
  for (let i = 0; i < Math.min(k, retrievedIds.length); i++) {
    const relevance = relevantIds.includes(retrievedIds[i]) ? 1 : 0;
    dcg += relevance / Math.log2(i + 2); // log2(i+1) where i is 0-indexed
  }

  // Ideal DCG
  let idcg = 0;
  const idealRelevance = Array(k).fill(0);
  for (let i = 0; i < Math.min(relevantIds.length, k); i++) {
    idealRelevance[i] = 1;
  }
  for (let i = 0; i < k; i++) {
    idcg += idealRelevance[i] / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Remove Vietnamese diacritics for fuzzy comparison.
 */
function removeDiacritics(str: string): string {
  const diacriticsMap: Record<string, string> = {
    a: 'áàảãạăắằẳẵặâấầẩẫậ',
    e: 'éèẻẽẹêếềểễệ',
    i: 'íìỉĩị',
    o: 'óòỏõọôốồổỗộơớờởỡợ',
    u: 'úùủũụưứừửữự',
    y: 'ýỳỷỹỵ',
    d: 'đ',
  };

  let result = str.toLowerCase();
  for (const [char, accents] of Object.entries(diacriticsMap)) {
    for (const accent of accents) {
      result = result.split(accent).join(char);
    }
  }
  return result;
}

/**
 * Tokenize text into meaningful words.
 */
function tokenize(text: string): string[] {
  return removeDiacritics(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Check fuzzy word match (with diacritics and trigram).
 */
function fuzzyWordMatch(word: string, textTokens: string[]): boolean {
  const wordNorm = removeDiacritics(word.toLowerCase());

  // Direct match
  if (textTokens.some((t) => t === wordNorm)) return true;

  // Partial match
  if (textTokens.some((t) => t.includes(wordNorm) || wordNorm.includes(t))) return true;

  // Trigram similarity
  for (const token of textTokens) {
    if (token.length >= 3 && wordNorm.length >= 3) {
      const triA = token.slice(0, 3);
      const triB = wordNorm.slice(0, 3);
      if (triA === triB) return true;
    }
  }

  return false;
}

/**
 * Evaluate faithfulness: does the generated answer stay faithful to the retrieved context?
 *
 * Fuzzy approach:
 * - Check if key concepts in the answer are supported by the context
 * - Allow for diacritics variations and partial matches
 */
export function evaluateFaithfulness(params: {
  answer: string;
  context: string;
  expectedAnswer: string;
}): number {
  const { answer, context, expectedAnswer } = params;

  let faithfulness = 1.0;

  // Tokenize all texts
  const answerTokens = tokenize(answer);
  const contextTokens = tokenize(context);
  const expectedTokens = tokenize(expectedAnswer);

  // Check if answer words are supported by context or expected answer
  let supportedWords = 0;
  const allSupportTokens = [...new Set([...contextTokens, ...expectedTokens])];

  for (const token of answerTokens) {
    if (token.length <= 2) continue; // Skip short tokens
    if (fuzzyWordMatch(token, allSupportTokens)) {
      supportedWords++;
    }
  }

  const meaningfulTokens = answerTokens.filter((t) => t.length > 2);
  const wordSupportRatio = meaningfulTokens.length > 0
    ? supportedWords / meaningfulTokens.length
    : 0.5;

  // Penalize if answer is much longer than context
  const answerToContextRatio = context.length > 0 ? answer.length / context.length : 1;
  if (answerToContextRatio > 3) {
    faithfulness -= 0.15;
  }

  // Check for number hallucination (fuzzy)
  const answerNumbers = answer.match(/\d+[\.,]?\d*/g) || [];
  const contextNumbers = context.match(/\d+[\.,]?\d*/g) || [];
  const expectedNumbers = expectedAnswer.match(/\d+[\.,]?\d*/g) || [];
  const allValidNumbers = [...contextNumbers, ...expectedNumbers];

  let unsupportedNumbers = 0;
  for (const num of answerNumbers) {
    const numVal = parseFloat(num.replace(/[.,]/g, ''));
    const isSupported = allValidNumbers.some((vn) => {
      const vnVal = parseFloat(vn.replace(/[.,]/g, ''));
      if (isNaN(numVal) || isNaN(vnVal)) return vn === num;
      return Math.abs(numVal - vnVal) / Math.max(numVal, vnVal, 1) < 0.2;
    });
    if (!isSupported) unsupportedNumbers++;
  }

  if (answerNumbers.length > 0) {
    const numberHallucinationRate = unsupportedNumbers / answerNumbers.length;
    faithfulness -= numberHallucinationRate * 0.2;
  }

  // Blend metrics
  faithfulness = faithfulness * 0.4 + wordSupportRatio * 0.6;

  return Math.max(0, Math.min(1, faithfulness));
}

/**
 * Evaluate answer correctness against expected answer with fuzzy matching.
 */
export function evaluateAnswerCorrectness(params: {
  answer: string;
  expectedAnswer: string;
  expectedKeywords: string[];
}): number {
  const { answer, expectedAnswer, expectedKeywords } = params;

  // Fuzzy keyword match
  let keywordScore = 0;
  if (expectedKeywords.length > 0) {
    let totalScore = 0;
    for (const kw of expectedKeywords) {
      const kwTokens = tokenize(kw);
      const answerTokens = tokenize(answer);

      // Check if all tokens of the keyword are present (fuzzy)
      const tokensFound = kwTokens.filter((kt) =>
        answerTokens.some((at) => at.includes(kt) || kt.includes(at))
      );

      if (tokensFound.length >= kwTokens.length * 0.7) {
        totalScore += 1.0;
      } else if (tokensFound.length > 0) {
        totalScore += tokensFound.length / kwTokens.length * 0.7;
      }
    }
    keywordScore = totalScore / expectedKeywords.length;
  } else {
    keywordScore = 0.5;
  }

  // Fuzzy word overlap with expected answer
  const answerTokens = tokenize(answer);
  const expectedTokens = tokenize(expectedAnswer);

  let overlapCount = 0;
  for (const et of expectedTokens) {
    if (et.length <= 2) continue;
    if (fuzzyWordMatch(et, answerTokens)) {
      overlapCount++;
    }
  }

  const meaningfulExpected = expectedTokens.filter((t) => t.length > 2);
  const wordOverlap = meaningfulExpected.length > 0
    ? overlapCount / meaningfulExpected.length
    : 0;

  return keywordScore * 0.5 + wordOverlap * 0.5;
}

/**
 * Compute retrieval metrics for a single query against golden dataset.
 */
export function computeRetrievalMetrics(params: {
  retrievedIds: string[];
  relevantIds: string[];
}): RetrievalMetrics {
  const { retrievedIds, relevantIds } = params;

  return {
    precisionAt1: precisionAtK(retrievedIds, relevantIds, 1),
    precisionAt3: precisionAtK(retrievedIds, relevantIds, 3),
    precisionAt5: precisionAtK(retrievedIds, relevantIds, 5),
    recallAt3: recallAtK(retrievedIds, relevantIds, 3),
    recallAt5: recallAtK(retrievedIds, relevantIds, 5),
    mrr: meanReciprocalRank(retrievedIds, relevantIds),
    ndcgAt5: ndcgAt5(retrievedIds, relevantIds),
    hitRate: retrievedIds.some((id) => relevantIds.includes(id)) ? 1 : 0,
  };
}

/**
 * Aggregate retrieval metrics across multiple queries.
 */
export function aggregateRetrievalMetrics(
  results: RetrievalMetrics[]
): RAGAggregateMetrics['retrieval'] {
  if (results.length === 0) {
    return {
      avgPrecisionAt1: 0,
      avgPrecisionAt3: 0,
      avgPrecisionAt5: 0,
      avgRecallAt3: 0,
      avgRecallAt5: 0,
      avgMRR: 0,
      avgNDCG5: 0,
      avgHitRate: 0,
    };
  }

  const n = results.length;
  const avg = (fn: (r: RetrievalMetrics) => number) =>
    results.reduce((sum, r) => sum + fn(r), 0) / n;

  return {
    avgPrecisionAt1: avg((r) => r.precisionAt1),
    avgPrecisionAt3: avg((r) => r.precisionAt3),
    avgPrecisionAt5: avg((r) => r.precisionAt5),
    avgRecallAt3: avg((r) => r.recallAt3),
    avgRecallAt5: avg((r) => r.recallAt5),
    avgMRR: avg((r) => r.mrr),
    avgNDCG5: avg((r) => r.ndcgAt5),
    avgHitRate: avg((r) => r.hitRate),
  };
}
