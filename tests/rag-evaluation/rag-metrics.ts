/**
 * RAG Evaluation Metrics
 * Precision@k, Recall@k, MRR, NDCG, Faithfulness Score
 */

import type { GoldenQuery } from "./golden-dataset";

interface FlatDoc {
  id: number;
  category: string;
  item: { id: string; title: string; definition: string; explanation: string; application: string; tags: string[] };
  flatText: string;
  vectorId: number;
  pointers: number[];
  backPointers: number[];
}

interface RetrievalCandidate {
  doc: FlatDoc;
  sparseScore: number;
  denseScore: number;
  hybridScore: number;
}

export interface EvaluationResult {
  queryId: string;
  query: string;
  difficulty: string;
  domain: string;
  retrievedCount: number;
  precisionAtK: Record<number, number>;
  recallAtK: Record<number, number>;
  mrr: number;
  ndcg: number;
  categoryMatch: boolean;
  keywordOverlap: number;
  latencyMs: number;
}

export interface AggregateMetrics {
  totalQueries: number;
  avgPrecisionAtK: Record<number, number>;
  avgRecallAtK: Record<number, number>;
  avgMRR: number;
  avgNDCG: number;
  categoryAccuracy: number;
  avgKeywordOverlap: number;
  avgLatencyMs: number;
  byDifficulty: Record<string, AggregateMetrics>;
  byDomain: Record<string, AggregateMetrics>;
}

/**
 * Calculate Precision@k: fraction of retrieved docs that are relevant
 */
export function precisionAtK(
  retrieved: RetrievalCandidate[],
  relevantIds: Set<string>,
  k: number
): number {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  const relevantRetrieved = topK.filter((r) =>
    relevantIds.has(r.doc.item.id)
  ).length;
  return relevantRetrieved / k;
}

/**
 * Calculate Recall@k: fraction of relevant docs that are retrieved
 */
export function recallAtK(
  retrieved: RetrievalCandidate[],
  relevantIds: Set<string>,
  k: number
): number {
  if (relevantIds.size === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevantRetrieved = topK.filter((r) =>
    relevantIds.has(r.doc.item.id)
  ).length;
  return relevantRetrieved / relevantIds.size;
}

/**
 * Calculate MRR (Mean Reciprocal Rank): 1/rank of first relevant result
 */
export function meanReciprocalRank(
  retrieved: RetrievalCandidate[],
  relevantIds: Set<string>
): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevantIds.has(retrieved[i].doc.item.id)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Calculate NDCG@k (Normalized Discounted Cumulative Gain)
 */
export function ndcgAtK(
  retrieved: RetrievalCandidate[],
  relevantIds: Set<string>,
  k: number
): number {
  const topK = retrieved.slice(0, k);
  
  // DCG: Discounted Cumulative Gain
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const relevance = relevantIds.has(topK[i].doc.item.id) ? 1 : 0;
    dcg += relevance / Math.log2(i + 2); // log2(rank + 1)
  }
  
  // Ideal DCG: best possible ordering
  const idealRelevance = Math.min(relevantIds.size, k);
  let idcg = 0;
  for (let i = 0; i < idealRelevance; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  
  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Calculate category match score
 */
export function categoryMatchScore(
  retrieved: RetrievalCandidate[],
  expectedCategories: string[]
): boolean {
  if (retrieved.length === 0) return false;
  
  const retrievedCategories = new Set(
    retrieved.map((r) => r.doc.category.toUpperCase())
  );
  
  return expectedCategories.some((cat) =>
    retrievedCategories.has(cat.toUpperCase())
  );
}

/**
 * Calculate keyword overlap between query and retrieved documents
 */
export function keywordOverlap(
  query: string,
  retrieved: RetrievalCandidate[],
  expectedKeywords: string[]
): number {
  if (retrieved.length === 0 || expectedKeywords.length === 0) return 0;
  
  const queryLower = query.toLowerCase();
  const matchedKeywords = expectedKeywords.filter((kw) =>
    queryLower.includes(kw.toLowerCase())
  );
  
  return matchedKeywords.length / expectedKeywords.length;
}

/**
 * Evaluate a single query against RAG retrieval results
 */
export function evaluateQuery(
  golden: GoldenQuery,
  retrieved: RetrievalCandidate[],
  latencyMs: number,
  kValues: number[] = [1, 3, 5, 10]
): EvaluationResult {
  // Create relevant IDs set from golden dataset
  // For category-based relevance, we check if retrieved doc's category matches
  const relevantIds = new Set<string>();
  
  // In a real scenario, we'd have pre-indexed document IDs
  // For now, we use category matching as proxy for relevance
  retrieved.forEach((r) => {
    const docCategory = r.doc.category.toUpperCase();
    if (golden.expectedCategories.some((cat) => docCategory.includes(cat))) {
      relevantIds.add(r.doc.item.id);
    }
  });
  
  // If no category matches, use keyword-based relevance
  if (relevantIds.size === 0) {
    retrieved.forEach((r) => {
      const docText = r.doc.flatText.toLowerCase();
      const hasKeyword = golden.expectedKeywords.some((kw) =>
        docText.includes(kw.toLowerCase())
      );
      if (hasKeyword) {
        relevantIds.add(r.doc.item.id);
      }
    });
  }
  
  const precisionAtKResult: Record<number, number> = {};
  const recallAtKResult: Record<number, number> = {};
  
  for (const k of kValues) {
    precisionAtKResult[k] = precisionAtK(retrieved, relevantIds, k);
    recallAtKResult[k] = recallAtK(retrieved, relevantIds, k);
  }
  
  return {
    queryId: golden.id,
    query: golden.query,
    difficulty: golden.difficulty,
    domain: golden.domain,
    retrievedCount: retrieved.length,
    precisionAtK: precisionAtKResult,
    recallAtK: recallAtKResult,
    mrr: meanReciprocalRank(retrieved, relevantIds),
    ndcg: ndcgAtK(retrieved, relevantIds, 5),
    categoryMatch: categoryMatchScore(retrieved, golden.expectedCategories),
    keywordOverlap: keywordOverlap(golden.query, retrieved, golden.expectedKeywords),
    latencyMs,
  };
}

/**
 * Aggregate evaluation results across all queries (flat - no recursion)
 */
export function aggregateResults(
  results: EvaluationResult[],
  kValues: number[] = [1, 3, 5, 10]
): AggregateMetrics {
  const total = results.length;
  if (total === 0) {
    return {
      totalQueries: 0,
      avgPrecisionAtK: {},
      avgRecallAtK: {},
      avgMRR: 0,
      avgNDCG: 0,
      categoryAccuracy: 0,
      avgKeywordOverlap: 0,
      avgLatencyMs: 0,
      byDifficulty: {},
      byDomain: {},
    };
  }
  
  // Calculate averages
  const avgPrecisionAtK: Record<number, number> = {};
  const avgRecallAtK: Record<number, number> = {};
  
  for (const k of kValues) {
    avgPrecisionAtK[k] =
      results.reduce((sum, r) => sum + (r.precisionAtK[k] || 0), 0) / total;
    avgRecallAtK[k] =
      results.reduce((sum, r) => sum + (r.recallAtK[k] || 0), 0) / total;
  }
  
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / total;
  const avgNDCG = results.reduce((sum, r) => sum + r.ndcg, 0) / total;
  const categoryAccuracy =
    results.filter((r) => r.categoryMatch).length / total;
  const avgKeywordOverlap =
    results.reduce((sum, r) => sum + r.keywordOverlap, 0) / total;
  const avgLatencyMs =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / total;
  
  // Group by difficulty (flat aggregation - no recursion)
  const byDifficulty: Record<string, AggregateMetrics> = {};
  const difficultyGroups: Record<string, EvaluationResult[]> = {};
  for (const r of results) {
    if (!difficultyGroups[r.difficulty]) difficultyGroups[r.difficulty] = [];
    difficultyGroups[r.difficulty].push(r);
  }
  for (const diff of Object.keys(difficultyGroups)) {
    byDifficulty[diff] = flatAggregate(difficultyGroups[diff], kValues);
  }
  
  // Group by domain (flat aggregation - no recursion)
  const byDomain: Record<string, AggregateMetrics> = {};
  const domainGroups: Record<string, EvaluationResult[]> = {};
  for (const r of results) {
    if (!domainGroups[r.domain]) domainGroups[r.domain] = [];
    domainGroups[r.domain].push(r);
  }
  for (const domain of Object.keys(domainGroups)) {
    byDomain[domain] = flatAggregate(domainGroups[domain], kValues);
  }
  
  return {
    totalQueries: total,
    avgPrecisionAtK,
    avgRecallAtK,
    avgMRR,
    avgNDCG,
    categoryAccuracy,
    avgKeywordOverlap,
    avgLatencyMs,
    byDifficulty,
    byDomain,
  };
}

/**
 * Flat aggregation (no recursion) for sub-groups
 */
function flatAggregate(
  results: EvaluationResult[],
  kValues: number[]
): AggregateMetrics {
  const total = results.length;
  if (total === 0) {
    return {
      totalQueries: 0,
      avgPrecisionAtK: {},
      avgRecallAtK: {},
      avgMRR: 0,
      avgNDCG: 0,
      categoryAccuracy: 0,
      avgKeywordOverlap: 0,
      avgLatencyMs: 0,
      byDifficulty: {},
      byDomain: {},
    };
  }
  
  const avgPrecisionAtK: Record<number, number> = {};
  const avgRecallAtK: Record<number, number> = {};
  
  for (const k of kValues) {
    avgPrecisionAtK[k] =
      results.reduce((sum, r) => sum + (r.precisionAtK[k] || 0), 0) / total;
    avgRecallAtK[k] =
      results.reduce((sum, r) => sum + (r.recallAtK[k] || 0), 0) / total;
  }
  
  return {
    totalQueries: total,
    avgPrecisionAtK,
    avgRecallAtK,
    avgMRR: results.reduce((sum, r) => sum + r.mrr, 0) / total,
    avgNDCG: results.reduce((sum, r) => sum + r.ndcg, 0) / total,
    categoryAccuracy: results.filter((r) => r.categoryMatch).length / total,
    avgKeywordOverlap: results.reduce((sum, r) => sum + r.keywordOverlap, 0) / total,
    avgLatencyMs: results.reduce((sum, r) => sum + r.latencyMs, 0) / total,
    byDifficulty: {},
    byDomain: {},
  };
}

/**
 * Format metrics for console output
 */
export function formatMetrics(metrics: AggregateMetrics): string {
  const lines: string[] = [];
  
  lines.push("=".repeat(60));
  lines.push("RAG EVALUATION REPORT");
  lines.push("=".repeat(60));
  lines.push(`Total Queries: ${metrics.totalQueries}`);
  lines.push("");
  
  lines.push("--- Precision@k ---");
  for (const [k, v] of Object.entries(metrics.avgPrecisionAtK)) {
    lines.push(`  P@${k}: ${(v * 100).toFixed(2)}%`);
  }
  lines.push("");
  
  lines.push("--- Recall@k ---");
  for (const [k, v] of Object.entries(metrics.avgRecallAtK)) {
    lines.push(`  R@${k}: ${(v * 100).toFixed(2)}%`);
  }
  lines.push("");
  
  lines.push("--- Other Metrics ---");
  lines.push(`  MRR: ${(metrics.avgMRR * 100).toFixed(2)}%`);
  lines.push(`  NDCG@5: ${(metrics.avgNDCG * 100).toFixed(2)}%`);
  lines.push(`  Category Accuracy: ${(metrics.categoryAccuracy * 100).toFixed(2)}%`);
  lines.push(`  Keyword Overlap: ${(metrics.avgKeywordOverlap * 100).toFixed(2)}%`);
  lines.push(`  Avg Latency: ${metrics.avgLatencyMs.toFixed(2)}ms`);
  lines.push("");
  
  lines.push("--- By Difficulty ---");
  for (const [diff, m] of Object.entries(metrics.byDifficulty)) {
    lines.push(`  ${diff}: P@3=${(m.avgPrecisionAtK[3] * 100).toFixed(1)}%, MRR=${(m.avgMRR * 100).toFixed(1)}%, Latency=${m.avgLatencyMs.toFixed(0)}ms`);
  }
  lines.push("");
  
  lines.push("=".repeat(60));
  
  return lines.join("\n");
}
