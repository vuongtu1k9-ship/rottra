/**
 * RAG Evaluation Runner
 * Runs golden dataset against RAG system and generates metrics report
 */

import { GOLDEN_DATASET, type GoldenQuery } from "./golden-dataset";
import { evaluateQuery, aggregateResults, formatMetrics, type EvaluationResult } from "./rag-metrics";

// Dynamic import to avoid circular dependencies
async function getHybridRetrieve() {
  const mod = await import("../../src/core/neural-memory/vector-rag");
  return mod.hybridRetrieve;
}

interface EvaluationConfig {
  topK: number;
  kValues: number[];
  maxQueries?: number;
  skipDomains?: string[];
  onlyDomains?: string[];
  onlyDifficulty?: "easy" | "medium" | "hard";
}

const DEFAULT_CONFIG: EvaluationConfig = {
  topK: 10,
  kValues: [1, 3, 5, 10],
  maxQueries: undefined,
  skipDomains: ["greeting", "general"],
  onlyDomains: undefined,
  onlyDifficulty: undefined,
};

async function runEvaluation(config: EvaluationConfig = DEFAULT_CONFIG): Promise<{
  results: EvaluationResult[];
  aggregated: ReturnType<typeof aggregateResults>;
  report: string;
}> {
  console.log("[RAG Evaluation] Starting evaluation...");
  console.log(`[RAG Evaluation] Config: topK=${config.topK}, kValues=${config.kValues.join(",")}`);

  // Get hybridRetrieve function
  const hybridRetrieve = await getHybridRetrieve();

  // Filter dataset
  let dataset = [...GOLDEN_DATASET];

  if (config.skipDomains) {
    dataset = dataset.filter((q) => !config.skipDomains!.includes(q.domain));
  }
  if (config.onlyDomains) {
    dataset = dataset.filter((q) => config.onlyDomains!.includes(q.domain));
  }
  if (config.onlyDifficulty) {
    dataset = dataset.filter((q) => q.difficulty === config.onlyDifficulty);
  }
  if (config.maxQueries) {
    dataset = dataset.slice(0, config.maxQueries);
  }

  console.log(`[RAG Evaluation] Running ${dataset.length} queries...`);

  const results: EvaluationResult[] = [];
  let totalLatency = 0;

  for (let i = 0; i < dataset.length; i++) {
    const golden = dataset[i];
    const startTime = Date.now();

    try {
      const retrieved = await hybridRetrieve(golden.query, config.topK, null, false);
      const latencyMs = Date.now() - startTime;
      totalLatency += latencyMs;

      const result = evaluateQuery(golden, retrieved, latencyMs, config.kValues);
      results.push(result);

      // Progress indicator
      if ((i + 1) % 10 === 0 || i === dataset.length - 1) {
        const avgLatency = totalLatency / (i + 1);
        console.log(`[RAG Evaluation] Progress: ${i + 1}/${dataset.length} (avg ${avgLatency.toFixed(0)}ms/query)`);
      }
    } catch (error) {
      console.error(`[RAG Evaluation] Error on query ${golden.id}: ${error}`);
      // Add failed result
      results.push({
        queryId: golden.id,
        query: golden.query,
        difficulty: golden.difficulty,
        domain: golden.domain,
        retrievedCount: 0,
        precisionAtK: {},
        recallAtK: {},
        mrr: 0,
        ndcg: 0,
        categoryMatch: false,
        keywordOverlap: 0,
        latencyMs: Date.now() - startTime,
      });
    }
  }

  const aggregated = aggregateResults(results, config.kValues);
  const report = formatMetrics(aggregated);

  console.log("\n" + report);

  return { results, aggregated, report };
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--top-k":
        config.topK = parseInt(args[++i]) || 10;
        break;
      case "--max":
        config.maxQueries = parseInt(args[++i]);
        break;
      case "--difficulty":
        config.onlyDifficulty = args[++i] as "easy" | "medium" | "hard";
        break;
      case "--domain":
        config.onlyDomains = [args[++i]];
        break;
      case "--help":
        console.log(`
RAG Evaluation Runner

Usage: bun run tests/rag-evaluation/run-evaluation.ts [options]

Options:
  --top-k <n>         Number of documents to retrieve (default: 10)
  --max <n>           Maximum number of queries to run
  --difficulty <d>    Filter by difficulty: easy, medium, hard
  --domain <d>        Filter by domain (e.g., agriculture, market_price)
  --help              Show this help message
        `);
        process.exit(0);
    }
  }

  const { results, aggregated, report } = await runEvaluation(config);

  // Save report to file
  const reportPath = `tests/rag-evaluation/report-${Date.now()}.json`;
  const reportData = {
    timestamp: new Date().toISOString(),
    config,
    summary: {
      totalQueries: aggregated.totalQueries,
      avgPrecisionAt3: aggregated.avgPrecisionAtK[3],
      avgRecallAt3: aggregated.avgRecallAtK[3],
      avgMRR: aggregated.avgMRR,
      avgNDCG: aggregated.avgNDCG,
      categoryAccuracy: aggregated.categoryAccuracy,
      avgLatencyMs: aggregated.avgLatencyMs,
    },
    results,
  };

  const fs = await import("fs");
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n[RAG Evaluation] Report saved to: ${reportPath}`);
}

// Run if executed directly
main().catch(console.error);

export { runEvaluation };
