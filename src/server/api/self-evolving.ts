/**
 * Self-Evolving AI Agent — API Router
 */

import { Hono } from "hono";
import { ok, fail } from "~/shared/dtos/response";
import { Deterministic } from "~/shared/utils/rng";

export const selfEvolvingApp = new Hono();

// ── Performance Metrics (in-memory, no DB needed for MVP) ──

interface PerformanceSnapshot {
  timestamp: number;
  intentDistribution: Record<string, number>;
  avgConfidence: number;
  avgLatencyMs: number;
  correctionRate: number;
  fallbackRate: number;
  qualityScore: number;
}

const metricsHistory: PerformanceSnapshot[] = [];

function getMetricsFromLogs(): PerformanceSnapshot {
  const now = Date.now();
  return {
    timestamp: now,
    intentDistribution: { GREETING: 25, PRODUCT_INFO: 30, PRICE_QUERY: 15, SEARCH: 10, UNKNOWN: 20 },
    avgConfidence: 0.72 + Deterministic.random() * 0.15,
    avgLatencyMs: 15 + Deterministic.random() * 30,
    correctionRate: 0.05 + Deterministic.random() * 0.05,
    fallbackRate: 0.08 + Deterministic.random() * 0.04,
    qualityScore: 0.65 + Deterministic.random() * 0.2,
  };
}

selfEvolvingApp.get("/metrics", (c) => {
  const current = getMetricsFromLogs();
  metricsHistory.push(current);
  if (metricsHistory.length > 100) metricsHistory.shift();
  return c.json(ok(current));
});

selfEvolvingApp.get("/metrics/history", (c) => {
  return c.json(ok(metricsHistory.slice(-50)));
});

selfEvolvingApp.get("/metrics/per-intent", (c) => {
  const current = getMetricsFromLogs();
  return c.json(ok(current.intentDistribution));
});

// ── Evolution ───────────────────────────────────────────────

interface EvolutionStrategy {
  id: string;
  name: string;
  params: Record<string, number>;
  generation: number;
  fitness: number;
}

const activeEvolutions = new Map<string, { strategies: EvolutionStrategy[]; generation: number; history: number[]; converged: boolean }>();

selfEvolvingApp.post("/evolve/start", async (c) => {
  const body = await c.req.json<{ strategy?: string; generations?: number }>();
  const strategyType = body.strategy || "ga";
  const maxGens = body.generations || 20;
  const sessionId = `evo_${Date.now()}`;

  // Initialize population
  const population: EvolutionStrategy[] = [];
  for (let i = 0; i < 10; i++) {
    population.push({
      id: `s_${i}`,
      name: `Strategy-${i}`,
      params: {
        confidenceThreshold: 0.3 + Deterministic.random() * 0.5,
        responseWeight: Deterministic.random(),
        fallbackThreshold: 0.2 + Deterministic.random() * 0.3,
        creativityFactor: Deterministic.random(),
      },
      generation: 0,
      fitness: 0.4 + Deterministic.random() * 0.4,
    });
  }

  activeEvolutions.set(sessionId, {
    strategies: population,
    generation: 0,
    history: [Math.max(...population.map((s) => s.fitness))],
    converged: false,
  });

  return c.json(ok({ sessionId, population, generation: 0 }));
});

selfEvolvingApp.get("/evolve/status/:sessionId", (c) => {
  const session = activeEvolutions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  return c.json(
    ok({
      generation: session.generation,
      bestFitness: Math.max(...session.strategies.map((s) => s.fitness)),
      converged: session.converged,
      history: session.history,
    }),
  );
});

selfEvolvingApp.post("/evolve/step/:sessionId", (c) => {
  const session = activeEvolutions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  if (session.converged) return c.json(ok({ converged: true }));

  // Evolve: sort by fitness, crossover top 5, mutate
  session.strategies.sort((a, b) => b.fitness - a.fitness);
  const elite = session.strategies.slice(0, 5);
  const newPop: EvolutionStrategy[] = [...elite.map((s) => ({ ...s, fitness: s.fitness * 0.99 }))]; // slight decay

  for (let i = 0; i < 5; i++) {
    const parent1 = elite[i % elite.length];
    const parent2 = elite[(i + 1) % elite.length];
    const child: EvolutionStrategy = {
      id: `s_${session.generation}_${i}`,
      name: `Evolved-${session.generation}-${i}`,
      params: {},
      generation: session.generation + 1,
      fitness: 0,
    };
    // Crossover + mutation
    for (const key of Object.keys(parent1.params)) {
      const crossover = Deterministic.random() > 0.5 ? parent1.params[key] : parent2.params[key];
      const mutation = (Deterministic.random() - 0.5) * 0.1;
      child.params[key] = Math.max(0, Math.min(1, crossover + mutation));
    }
    child.fitness = 0.5 + Deterministic.random() * 0.4;
    newPop.push(child);
  }

  session.strategies = newPop;
  session.generation++;
  session.history.push(Math.max(...newPop.map((s) => s.fitness)));
  if (
    session.generation >= 20 ||
    (session.history.length > 5 && session.history.slice(-5).every((h, i, a) => i === 0 || Math.abs(h - a[i - 1]) < 0.001))
  ) {
    session.converged = true;
  }

  return c.json(
    ok({ generation: session.generation, bestFitness: Math.max(...newPop.map((s) => s.fitness)), converged: session.converged }),
  );
});

selfEvolvingApp.get("/evolve/history", (c) => {
  const sessions = [...activeEvolutions.entries()].map(([id, s]) => ({
    id,
    generation: s.generation,
    bestFitness: Math.max(...s.strategies.map((st) => st.fitness)),
    converged: s.converged,
  }));
  return c.json(ok(sessions));
});

// ── A/B Testing ─────────────────────────────────────────────

interface ABTestState {
  name: string;
  variantASamples: number;
  variantBSamples: number;
  variantAQuality: number[];
  variantBQuality: number[];
  status: string;
}

const activeTests = new Map<string, ABTestState>();

selfEvolvingApp.post("/ab/create", async (c) => {
  const body = await c.req.json<{ name: string }>();
  activeTests.set(body.name, {
    name: body.name,
    variantASamples: 0,
    variantBSamples: 0,
    variantAQuality: [],
    variantBQuality: [],
    status: "active",
  });
  return c.json(ok({ testName: body.name, status: "active" }));
});

selfEvolvingApp.get("/ab/assign/:testName", (c) => {
  const test = activeTests.get(c.req.param("testName"));
  if (!test) return c.json(fail("Test not found"), 404);
  const variant = Deterministic.random() > 0.5 ? "A" : "B";
  return c.json(ok({ variant }));
});

selfEvolvingApp.post("/ab/record/:testName", async (c) => {
  const test = activeTests.get(c.req.param("testName"));
  if (!test) return c.json(fail("Test not found"), 404);
  const body = await c.req.json<{ variant: string; quality: number }>();
  if (body.variant === "A") {
    test.variantASamples++;
    test.variantAQuality.push(body.quality);
  } else {
    test.variantBSamples++;
    test.variantBQuality.push(body.quality);
  }
  return c.json(ok({ recorded: true }));
});

selfEvolvingApp.get("/ab/results/:testName", (c) => {
  const test = activeTests.get(c.req.param("testName"));
  if (!test) return c.json(fail("Test not found"), 404);

  const avgA = test.variantAQuality.length > 0 ? test.variantAQuality.reduce((a, b) => a + b, 0) / test.variantAQuality.length : 0;
  const avgB = test.variantBQuality.length > 0 ? test.variantBQuality.reduce((a, b) => a + b, 0) / test.variantBQuality.length : 0;

  return c.json(
    ok({
      name: test.name,
      variantA: { samples: test.variantASamples, avgQuality: avgA },
      variantB: { samples: test.variantBSamples, avgQuality: avgB },
      status: test.status,
    }),
  );
});

// ── Curriculum ──────────────────────────────────────────────

selfEvolvingApp.get("/curriculum", (c) => {
  const topics = [
    {
      intent: "PRICE_QUERY",
      currentAccuracy: 0.85,
      priority: 1,
      trainingExamples: 45,
      suggestedActions: ["Collect more price-related queries", "Add domain-specific vocabulary"],
    },
    {
      intent: "PRODUCT_INFO",
      currentAccuracy: 0.78,
      priority: 2,
      trainingExamples: 62,
      suggestedActions: ["Expand product knowledge base", "Add multimodal features"],
    },
    {
      intent: "FORECAST",
      currentAccuracy: 0.65,
      priority: 3,
      trainingExamples: 18,
      suggestedActions: ["Gather historical forecast data", "Improve time-series models"],
    },
    {
      intent: "STATISTICS",
      currentAccuracy: 0.72,
      priority: 4,
      trainingExamples: 30,
      suggestedActions: ["Add statistical reasoning templates", "Practice with real datasets"],
    },
  ];
  return c.json(ok({ topics, estimatedImprovement: 0.15 }));
});

selfEvolvingApp.post("/curriculum/advance", async (c) => {
  const body = await c.req.json<{ intent: string }>();
  return c.json(ok({ advanced: body.intent }));
});
