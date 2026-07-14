/**
 * Speed & Performance Benchmark Metrics
 *
 * Measures latency, throughput, and resource usage for the AI pipeline.
 */

export interface SpeedBenchmarkResult {
  /** First token latency (time to first character in streaming) */
  firstTokenLatencyMs: number;
  /** Total end-to-end latency */
  totalLatencyMs: number;
  /** Tokens per second (throughput) */
  tokensPerSecond: number;
  /** Response length in characters */
  responseLength: number;
  /** Memory usage at peak (MB) */
  peakMemoryMB: number;
  /** Whether the request timed out */
  timedOut: boolean;
}

export interface SpeedAggregateResults {
  avgFirstTokenLatencyMs: number;
  p50FirstTokenLatencyMs: number;
  p95FirstTokenLatencyMs: number;
  p99FirstTokenLatencyMs: number;
  avgTotalLatencyMs: number;
  p50TotalLatencyMs: number;
  p95TotalLatencyMs: number;
  avgTokensPerSecond: number;
  p50TokensPerSecond: number;
  p95TokensPerSecond: number;
  totalRequests: number;
  timeoutRate: number;
  avgResponseLength: number;
  avgPeakMemoryMB: number;
}

/**
 * Measure a single request's speed metrics.
 */
export async function measureSpeed(params: {
  requestFn: () => Promise<{ text: string; firstTokenMs: number; totalMs: number }>;
  timeoutMs?: number;
}): Promise<SpeedBenchmarkResult> {
  const { requestFn, timeoutMs = 30000 } = params;
  const memBefore = process.memoryUsage().heapUsed / (1024 * 1024);

  let timedOut = false;
  let result = { text: '', firstTokenMs: 0, totalMs: 0 };

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    result = await Promise.race([requestFn(), timeoutPromise]);
  } catch (err) {
    timedOut = true;
  }

  const memAfter = process.memoryUsage().heapUsed / (1024 * 1024);
  const peakMemoryMB = Math.max(memBefore, memAfter);

  const responseLength = result.text.length;
  const tokensPerSecond =
    result.totalMs > 0 ? (responseLength / 4) / (result.totalMs / 1000) : 0; // rough char→token

  return {
    firstTokenLatencyMs: result.firstTokenMs,
    totalLatencyMs: result.totalMs,
    tokensPerSecond,
    responseLength,
    peakMemoryMB,
    timedOut,
  };
}

/**
 * Run speed benchmark with multiple iterations.
 */
export async function runSpeedBenchmark(params: {
  requestFn: () => Promise<{ text: string; firstTokenMs: number; totalMs: number }>;
  warmup?: number;
  iterations?: number;
  timeoutMs?: number;
}): Promise<{
  results: SpeedBenchmarkResult[];
  aggregate: SpeedAggregateResults;
}> {
  const { requestFn, warmup = 3, iterations = 10, timeoutMs = 30000 } = params;

  // Warmup
  for (let i = 0; i < warmup; i++) {
    try {
      await requestFn();
    } catch {
      // ignore warmup errors
    }
  }

  // Measurement
  const results: SpeedBenchmarkResult[] = [];
  for (let i = 0; i < iterations; i++) {
    const result = await measureSpeed({ requestFn, timeoutMs });
    results.push(result);
  }

  const aggregate = aggregateSpeedResults(results);
  return { results, aggregate };
}

/**
 * Aggregate speed benchmark results with percentiles.
 */
export function aggregateSpeedResults(results: SpeedBenchmarkResult[]): SpeedAggregateResults {
  if (results.length === 0) {
    return {
      avgFirstTokenLatencyMs: 0,
      p50FirstTokenLatencyMs: 0,
      p95FirstTokenLatencyMs: 0,
      p99FirstTokenLatencyMs: 0,
      avgTotalLatencyMs: 0,
      p50TotalLatencyMs: 0,
      p95TotalLatencyMs: 0,
      avgTokensPerSecond: 0,
      p50TokensPerSecond: 0,
      p95TokensPerSecond: 0,
      totalRequests: 0,
      timeoutRate: 0,
      avgResponseLength: 0,
      avgPeakMemoryMB: 0,
    };
  }

  const n = results.length;
  const sorted = <T>(arr: T[], fn: (r: T) => number) =>
    [...arr].sort((a, b) => fn(a) - fn(b));

  const percentile = <T>(arr: T[], fn: (r: T) => number, p: number) => {
    const sortedArr = sorted(arr, fn);
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return fn(sortedArr[Math.max(0, idx)]);
  };

  const avg = (fn: (r: SpeedBenchmarkResult) => number) =>
    results.reduce((sum, r) => sum + fn(r), 0) / n;

  const timeouts = results.filter((r) => r.timedOut).length;

  return {
    avgFirstTokenLatencyMs: avg((r) => r.firstTokenLatencyMs),
    p50FirstTokenLatencyMs: percentile(results, (r) => r.firstTokenLatencyMs, 50),
    p95FirstTokenLatencyMs: percentile(results, (r) => r.firstTokenLatencyMs, 95),
    p99FirstTokenLatencyMs: percentile(results, (r) => r.firstTokenLatencyMs, 99),
    avgTotalLatencyMs: avg((r) => r.totalLatencyMs),
    p50TotalLatencyMs: percentile(results, (r) => r.totalLatencyMs, 50),
    p95TotalLatencyMs: percentile(results, (r) => r.totalLatencyMs, 95),
    avgTokensPerSecond: avg((r) => r.tokensPerSecond),
    p50TokensPerSecond: percentile(results, (r) => r.tokensPerSecond, 50),
    p95TokensPerSecond: percentile(results, (r) => r.tokensPerSecond, 95),
    totalRequests: n,
    timeoutRate: timeouts / n,
    avgResponseLength: avg((r) => r.responseLength),
    avgPeakMemoryMB: avg((r) => r.peakMemoryMB),
  };
}
