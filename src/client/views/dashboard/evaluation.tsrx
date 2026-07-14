/**
 * AI Evaluation Dashboard
 *
 * Admin view for monitoring AI quality metrics, running evaluations,
 * and viewing reports.
 */

import { createSignal, onMount, Show, For } from "solid-js";
import { authClient } from "~/client/utils/auth-client";

interface EvalMetrics {
  totalFeedback: number;
  satisfactionRate: number;
  upCount: number;
  downCount: number;
  intentBreakdown: Record<string, { total: number; up: number; down: number }>;
  latestReport: {
    timestamp: string;
    overallScore: number;
    verdict: string;
  } | null;
  reportCount: number;
}

interface EvalReport {
  timestamp: string;
  mode: string;
  totalQueries: number;
  output: {
    avgAccuracy: number;
    avgRelevance: number;
    avgCompleteness: number;
    avgHallucinationScore: number;
    avgOverallScore: number;
    passRate: number;
  };
  generation: {
    avgFaithfulness: number;
    avgCorrectness: number;
  };
  gateCheck: {
    passed: boolean;
    failures: string[];
    totalChecks: number;
    passedChecks: number;
  };
  summary: {
    overallScore: number;
    verdict: string;
  };
}

export component EvaluationView() {
  const [metrics, setMetrics] = createSignal<EvalMetrics | null>(null);
  const [report, setReport] = createSignal<EvalReport | null>(null);
  const [isRunning, setIsRunning] = createSignal(false);
  const [selectedMode, setSelectedMode] = createSignal<"quick" | "standard" | "full">("quick");
  const [maxQueries, setMaxQueries] = createSignal(20);
  const [error, setError] = createSignal<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/evaluation/metrics");
      const data = await res.json();
      if (data.success) setMetrics(data.metrics);
    } catch (err: any) {
      console.error("Failed to fetch metrics:", err);
    }
  };

  const fetchLatestReport = async () => {
    try {
      const res = await fetch("/api/evaluation/report/latest");
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err: any) {
      // No report yet
    }
  };

  const runEvaluation = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode(),
          maxQueries: maxQueries(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        await fetchMetrics();
      } else {
        setError(data.error || "Evaluation failed");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  onMount(() => {
    fetchMetrics();
    fetchLatestReport();
  });

  <tsx>
    <div class="p-6 max-w-6xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold">AI Evaluation Dashboard</h1>

      {/* ── Run Evaluation ───────────────────────────────── */}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold mb-4">Run Evaluation</h2>
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <label class="block text-sm font-medium mb-1">Mode</label>
            <select
              class="border rounded-lg px-3 py-2 text-sm"
              value={selectedMode()}
              onChange={(e) => setSelectedMode(e.target.value as any)}
            >
              <option value="quick">Quick (20 queries)</option>
              <option value="standard">Standard (50 queries)</option>
              <option value="full">Full (all 50 + adversarial)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Max Queries</label>
            <input
              type="number"
              class="border rounded-lg px-3 py-2 text-sm w-24"
              value={maxQueries()}
              onChange={(e) => setMaxQueries(parseInt(e.target.value) || 20)}
              min="1"
              max="100"
            />
          </div>
          <button
            class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            onClick={runEvaluation}
            disabled={isRunning()}
          >
            {isRunning() ? "Running..." : "Run Evaluation"}
          </button>
        </div>
        <Show when={error()}>
          <div class="mt-3 text-red-600 text-sm">{error()}</div>
        </Show>
      </div>

      {/* ── Summary Cards ────────────────────────────────── */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Satisfaction Rate"
          value={metrics() ? `${(metrics()!.satisfactionRate * 100).toFixed(1)}%` : "--"}
          color={metrics() && metrics()!.satisfactionRate >= 0.8 ? "green" : "yellow"}
        />
        <MetricCard
          label="Total Feedback"
          value={metrics() ? String(metrics()!.totalFeedback) : "0"}
          color="blue"
        />
        <MetricCard
          label="Latest Score"
          value={
            report()
              ? `${(report()!.summary.overallScore * 100).toFixed(1)}%`
              : "--"
          }
          color={report() && report()!.summary.verdict === "PASS" ? "green" : "red"}
        />
        <MetricCard
          label="Reports"
          value={metrics() ? String(metrics()!.reportCount) : "0"}
          color="purple"
        />
      </div>

      {/* ── Latest Report ────────────────────────────────── */}
      <Show when={report()}>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Latest Report</h2>
            <span
              class={`px-3 py-1 rounded-full text-sm font-medium ${
                report()!.summary.verdict === "PASS"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {report()!.summary.verdict}
            </span>
          </div>

          <div class="text-sm text-gray-500 mb-4">
            {new Date(report()!.timestamp).toLocaleString()} · Mode: {report()!.mode} ·{" "}
            {report()!.totalQueries} queries
          </div>

          {/* Score bars */}
          <div class="space-y-3">
            <ScoreBar
              label="Overall Score"
              value={report()!.summary.overallScore}
            />
            <ScoreBar
              label="Accuracy"
              value={report()!.output.avgAccuracy}
            />
            <ScoreBar
              label="Relevance"
              value={report()!.output.avgRelevance}
            />
            <ScoreBar
              label="Completeness"
              value={report()!.output.avgCompleteness}
            />
            <ScoreBar
              label="Faithfulness"
              value={report()!.generation.avgFaithfulness}
            />
            <ScoreBar
              label="Answer Correctness"
              value={report()!.generation.avgCorrectness}
            />
            <ScoreBar
              label="Hallucination (inv.)"
              value={1 - report()!.output.avgHallucinationScore}
            />
          </div>

          {/* Gate check */}
          <div class="mt-6 pt-4 border-t">
            <h3 class="font-medium mb-2">
              Threshold Gates: {report()!.gateCheck.passedChecks}/
              {report()!.gateCheck.totalChecks} passed
            </h3>
            <Show
              when={report()!.gateCheck.failures.length > 0}
              fallback={
                <div class="text-green-600 text-sm">All checks passed</div>
              }
            >
              <ul class="text-sm space-y-1">
                <For each={report()!.gateCheck.failures}>
                  {(f) => <li class="text-red-600">❌ {f}</li>}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Feedback Breakdown ───────────────────────────── */}
      <Show when={metrics() && Object.keys(metrics()!.intentBreakdown).length > 0}>
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold mb-4">Feedback by Intent</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2">Intent</th>
                  <th class="text-right py-2">Total</th>
                  <th class="text-right py-2">👍</th>
                  <th class="text-right py-2">👎</th>
                  <th class="text-right py-2">Satisfaction</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={Object.entries(metrics()!.intentBreakdown).sort(
                    (a, b) => b[1].total - a[1].total
                  )}
                >
                  {([intent, data]) => (
                    <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td class="py-2 font-mono text-xs">{intent}</td>
                      <td class="text-right py-2">{data.total}</td>
                      <td class="text-right py-2 text-green-600">{data.up}</td>
                      <td class="text-right py-2 text-red-600">{data.down}</td>
                      <td class="text-right py-2">
                        {data.total > 0
                          ? `${((data.up / data.total) * 100).toFixed(0)}%`
                          : "--"}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  </tsx>
}

// ── Helper Components ─────────────────────────────────────────

function MetricCard(props: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };
  return <tsx>
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="text-sm text-gray-500">{props.label}</div>
      <div class={`text-2xl font-bold ${colorMap[props.color] || "text-gray-900"}`}>
        {props.value}
      </div>
    </div>
  </tsx>;
}

function ScoreBar(props: { label: string; value: number }) {
  const pct = Math.round(props.value * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

  return <tsx>
    <div class="flex items-center gap-3">
      <div class="w-40 text-sm text-gray-600 dark:text-gray-400">{props.label}</div>
      <div class="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div class="w-12 text-sm font-medium text-right">{pct}%</div>
    </div>
  </tsx>;
}
