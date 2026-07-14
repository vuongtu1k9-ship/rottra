/**
 * 🧠 ROTTRA — FEDERATED LEARNING API ROUTES
 * Hono API endpoints for FL system management.
 * Exposes coordinator, gradient exchange, and Byzantine detection.
 * Runs on Bun runtime.
 */

import { Hono } from "hono";
import { flCoordinator } from "~/core/federated-learning/coordinator";
import { byzantineDetector } from "~/core/federated-learning/byzantine-fault-tolerance";
import { privacyEngine } from "~/core/federated-learning/privacy-engine";
import { createGradientExchange } from "~/core/federated-learning/gradient-exchange";

const flApi = new Hono();

// ── Round Management ──────────────────────────────────────────

/**
 * POST /fl/rounds/start — Start a new FL training round
 */
flApi.post("/rounds/start", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const round = await flCoordinator.startRound(body);
  return c.json({ success: true, round });
});

/**
 * GET /fl/rounds/status — Get FL system status
 */
flApi.get("/rounds/status", async (c) => {
  const status = await flCoordinator.getStatus();
  return c.json({ success: true, ...status });
});

/**
 * POST /fl/rounds/:roundId/submit-gradient — Submit gradient from a node
 */
flApi.post("/rounds/:roundId/submit-gradient", async (c) => {
  const roundId = c.req.param("roundId");
  const body = await c.req.json().catch(() => null);

  if (!body || !body.nodeId || !body.encryptedGradients) {
    return c.json({ success: false, error: "nodeId and encryptedGradients are required" }, 400);
  }

  const result = await flCoordinator.submitGradient(roundId, body.nodeId, body.encryptedGradients, {
    localLoss: body.localLoss || 0,
    localAccuracy: body.localAccuracy || 0,
    dataSampleCount: body.dataSampleCount || 100,
  });

  return c.json({ success: result.accepted, message: result.message });
});

// ── Byzantine Fault Detection ─────────────────────────────────

/**
 * POST /fl/rounds/:roundId/detect-byzantine — Run Byzantine detection on round
 */
flApi.post("/rounds/:roundId/detect-byzantine", async (c) => {
  const roundId = c.req.param("roundId");
  const results = await byzantineDetector.detectByzantineGradients(roundId);
  return c.json({ success: true, results });
});

/**
 * POST /fl/rounds/:roundId/filter-byzantine — Filter malicious gradients and get clean list
 */
flApi.post("/rounds/:roundId/filter-byzantine", async (c) => {
  const roundId = c.req.param("roundId");
  const { valid, flagged, results } = await byzantineDetector.filterByzantineGradients(roundId);
  return c.json({ success: true, valid, flagged, results });
});

// ── Privacy Engine ────────────────────────────────────────────

/**
 * GET /fl/privacy/budget/:nodeId — Get privacy budget for a node
 */
flApi.get("/privacy/budget/:nodeId", async (c) => {
  const nodeId = c.req.param("nodeId");
  const budget = await privacyEngine.getPrivacyBudget(nodeId);
  return c.json({ success: true, budget });
});

/**
 * POST /fl/privacy/compute-budget — Compute expected privacy budget for training
 */
flApi.post("/privacy/compute-budget", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.rounds || !body.samplesPerRound || !body.noiseMultiplier) {
    return c.json({ success: false, error: "rounds, samplesPerRound, and noiseMultiplier are required" }, 400);
  }

  const budget = await privacyEngine.computePrivacyBudget(body.rounds, body.samplesPerRound, body.noiseMultiplier);

  return c.json({ success: true, budget });
});

// ── Model Distribution ────────────────────────────────────────

/**
 * GET /fl/model/global — Get latest global model
 */
flApi.get("/model/global", async (c) => {
  const model = await flCoordinator.getGlobalModel();
  if (!model) {
    return c.json({ success: false, error: "No global model available" }, 404);
  }
  return c.json({ success: true, model });
});

// ── Node Management ───────────────────────────────────────────

/**
 * POST /fl/nodes/:nodeId/register — Register a new FL node
 */
flApi.post("/nodes/:nodeId/register", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json().catch(() => ({}));
  const exchange = createGradientExchange(nodeId, body.nodeName || `node-${nodeId}`);
  const node = await exchange.registerNode(body.farmId);
  return c.json({ success: true, node });
});

/**
 * POST /fl/nodes/:nodeId/submit — Submit gradients from a node
 */
flApi.post("/nodes/:nodeId/submit", async (c) => {
  const nodeId = c.req.param("nodeId");
  const body = await c.req.json().catch(() => null);

  if (!body || !body.roundId) {
    return c.json({ success: false, error: "roundId is required" }, 400);
  }

  const exchange = createGradientExchange(nodeId, body.nodeName || `node-${nodeId}`);
  const result = await exchange.submitGradients(body.roundId, body.gradients || [], {
    localLoss: body.localLoss || 0,
    localAccuracy: body.localAccuracy || 0,
    dataSampleCount: body.dataSampleCount || 100,
  });

  return c.json({ success: result.accepted, message: result.message });
});

/**
 * GET /fl/nodes/:nodeId/model — Download global model
 */
flApi.get("/nodes/:nodeId/model", async (c) => {
  const nodeId = c.req.param("nodeId");
  const exchange = createGradientExchange(nodeId, "download");
  const model = await exchange.getGlobalModel();
  return c.json({ success: true, model });
});

/**
 * GET /fl/nodes/:nodeId/rounds — Get available rounds for node
 */
flApi.get("/nodes/:nodeId/rounds", async (c) => {
  const nodeId = c.req.param("nodeId");
  const exchange = createGradientExchange(nodeId, "list");
  const rounds = await exchange.getAvailableRounds();
  return c.json({ success: true, rounds });
});

export default flApi;
