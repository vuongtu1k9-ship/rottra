/**
 * 🧠 ROTTRA — FEDERATED LEARNING API ROUTER
 * API endpoints for FL system.
 * Uses Hono framework.
 */

import { Hono } from "hono";
import { createLogger } from "~/shared/logger";
import { flCoordinator } from "~/core/federated-learning/coordinator";
import { flBlockchainAudit } from "~/core/federated-learning/blockchain-audit";
import { privacyEngine } from "~/core/federated-learning/privacy-engine";
import { db } from "~/infra/database/db-pool";
import { flRound, flModelVersion, flNode, flGradientUpdate } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import type { StartRoundRequest, SubmitGradientRequest, FLRoundConfig } from "~/core/federated-learning/types";

const log = createLogger("api/fl-router");

// ── Router ───────────────────────────────────────────────────

export const flApp = new Hono();

// ── Coordinator Endpoints ────────────────────────────────────

/**
 * Start a new FL round
 * POST /api/fl/start-round
 */
flApp.post("/start-round", async (c) => {
  try {
    const body = await c.req.json<StartRoundRequest>();
    const config: Partial<FLRoundConfig> = body.config || {};

    const round = await flCoordinator.startRound(config);

    return c.json({
      success: true,
      roundId: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
      config: round.config,
    });
  } catch (err: any) {
    log.error("[FL API] Start round error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Submit gradient update
 * POST /api/gradients/submit
 */
flApp.post("/gradients/submit", async (c) => {
  try {
    const body = await c.req.json<SubmitGradientRequest>();

    const result = await flCoordinator.submitGradient(body.roundId, body.nodeId, body.encryptedGradients, body.metrics);

    return c.json({
      success: true,
      accepted: result.accepted,
      message: result.message,
    });
  } catch (err: any) {
    log.error("[FL API] Submit gradient error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Get global model
 * GET /api/fl/global-model
 */
flApp.get("/global-model", async (c) => {
  try {
    const model = await flCoordinator.getGlobalModel();

    if (!model) {
      return c.json({
        success: true,
        hasModel: false,
        message: "No global model available yet",
      });
    }

    return c.json({
      success: true,
      hasModel: true,
      modelId: model.modelId,
      weights: model.weights,
    });
  } catch (err: any) {
    log.error("[FL API] Get model error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Get FL status
 * GET /api/fl/status
 */
flApp.get("/status", async (c) => {
  try {
    const status = await flCoordinator.getStatus();

    return c.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    log.error("[FL API] Status error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Model Endpoints ──────────────────────────────────────────

/**
 * Get model version details
 * GET /api/fl/model/:modelId
 */
flApp.get("/model/:modelId", async (c) => {
  try {
    const modelId = c.req.param("modelId");

    const model = await db.select().from(flModelVersion).where(eq(flModelVersion.id, modelId)).limit(1);

    if (!model[0]) {
      return c.json({ success: false, error: "Model not found" }, 404);
    }

    return c.json({
      success: true,
      model: model[0],
    });
  } catch (err: any) {
    log.error("[FL API] Get model error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Compare two model versions
 * GET /api/fl/compare/:modelId1/:modelId2
 */
flApp.get("/compare/:modelId1/:modelId2", async (c) => {
  try {
    const modelId1 = c.req.param("modelId1");
    const modelId2 = c.req.param("modelId2");

    const [model1, model2] = await Promise.all([
      db.select().from(flModelVersion).where(eq(flModelVersion.id, modelId1)).limit(1),
      db.select().from(flModelVersion).where(eq(flModelVersion.id, modelId2)).limit(1),
    ]);

    if (!model1[0] || !model2[0]) {
      return c.json({ success: false, error: "One or both models not found" }, 404);
    }

    return c.json({
      success: true,
      comparison: {
        model1: {
          id: model1[0].id,
          version: model1[0].versionNumber,
          metrics: model1[0].metrics,
          parameterCount: model1[0].modelWeights?.parameterCount || 0,
        },
        model2: {
          id: model2[0].id,
          version: model2[0].versionNumber,
          metrics: model2[0].metrics,
          parameterCount: model2[0].modelWeights?.parameterCount || 0,
        },
      },
    });
  } catch (err: any) {
    log.error("[FL API] Compare models error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Blockchain Audit Endpoints ───────────────────────────────

/**
 * Verify model provenance
 * POST /api/fl/verify-model
 */
flApp.post("/verify-model", async (c) => {
  try {
    const body = await c.req.json<{ modelId: string }>();
    const result = await flBlockchainAudit.verifyProvenance(body.modelId);

    return c.json({
      success: true,
      valid: result.valid,
      chain: result.chain,
      errors: result.errors,
    });
  } catch (err: any) {
    log.error("[FL API] Verify model error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Get model provenance chain
 * GET /api/fl/provenance/:modelId
 */
flApp.get("/provenance/:modelId", async (c) => {
  try {
    const modelId = c.req.param("modelId");
    const chain = await flBlockchainAudit.getProvenanceChain(modelId);

    return c.json({
      success: true,
      chain,
      length: chain.length,
    });
  } catch (err: any) {
    log.error("[FL API] Get provenance error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Node Endpoints ───────────────────────────────────────────

/**
 * Get all registered nodes
 * GET /api/fl/nodes
 */
flApp.get("/nodes", async (c) => {
  try {
    const nodes = await db.select().from(flNode);

    return c.json({
      success: true,
      nodes,
      count: nodes.length,
    });
  } catch (err: any) {
    log.error("[FL API] Get nodes error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Get node details
 * GET /api/fl/nodes/:nodeId
 */
flApp.get("/nodes/:nodeId", async (c) => {
  try {
    const nodeId = c.req.param("nodeId");

    const node = await db.select().from(flNode).where(eq(flNode.id, nodeId)).limit(1);

    if (!node[0]) {
      return c.json({ success: false, error: "Node not found" }, 404);
    }

    // Get privacy budget
    const budget = await privacyEngine.getPrivacyBudget(nodeId);

    return c.json({
      success: true,
      node: node[0],
      privacyBudget: budget,
    });
  } catch (err: any) {
    log.error("[FL API] Get node error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Privacy Endpoints ────────────────────────────────────────

/**
 * Get privacy budget for a node
 * GET /api/fl/privacy/:nodeId
 */
flApp.get("/privacy/:nodeId", async (c) => {
  try {
    const nodeId = c.req.param("nodeId");
    const budget = await privacyEngine.getPrivacyBudget(nodeId);

    return c.json({
      success: true,
      budget: budget || {
        nodeId,
        epsilonUsed: 0,
        epsilonLimit: 10.0,
        deltaUsed: 0,
        roundCount: 0,
      },
    });
  } catch (err: any) {
    log.error("[FL API] Get privacy error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Compute privacy budget estimate
 * POST /api/fl/privacy/estimate
 */
flApp.post("/privacy/estimate", async (c) => {
  try {
    const body = await c.req.json<{
      rounds: number;
      samplesPerRound: number;
      noiseMultiplier: number;
    }>();

    const estimate = await privacyEngine.computePrivacyBudget(body.rounds, body.samplesPerRound, body.noiseMultiplier);

    return c.json({
      success: true,
      estimate,
    });
  } catch (err: any) {
    log.error("[FL API] Privacy estimate error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ── Round History Endpoints ──────────────────────────────────

/**
 * Get round history
 * GET /api/fl/rounds
 */
flApp.get("/rounds", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "10");
    const offset = parseInt(c.req.query("offset") || "0");

    const rounds = await db
      .select()
      .from(flRound)
      .orderBy(sql`${flRound.roundNumber} DESC`)
      .limit(limit)
      .offset(offset);

    const total = await db.select({ count: sql<number>`count(*)` }).from(flRound);

    return c.json({
      success: true,
      rounds,
      total: total[0]?.count || 0,
      limit,
      offset,
    });
  } catch (err: any) {
    log.error("[FL API] Get rounds error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * Get round details
 * GET /api/fl/rounds/:roundId
 */
flApp.get("/rounds/:roundId", async (c) => {
  try {
    const roundId = c.req.param("roundId");

    const round = await db.select().from(flRound).where(eq(flRound.id, roundId)).limit(1);

    if (!round[0]) {
      return c.json({ success: false, error: "Round not found" }, 404);
    }

    // Get gradient submissions for this round
    const gradients = await db.select().from(flGradientUpdate).where(eq(flGradientUpdate.roundId, roundId));

    return c.json({
      success: true,
      round: round[0],
      gradients,
      gradientCount: gradients.length,
    });
  } catch (err: any) {
    log.error("[FL API] Get round error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});
