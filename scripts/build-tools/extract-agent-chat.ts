#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(import.meta.dir, "../../src/routes/api/[...paths].ts"), "utf-8");
const lines = src.split("\n");

function getLines(start: number, end: number): string {
  return lines.slice(start - 1, end).join("\n");
}

const header = `import crypto from "node:crypto";
import WebSocket from "ws";
import { db, pgClient } from "~/infra/database/db-pool";
import { user, product, agentMemory, agentTraining, activity } from "~/infra/database/schema";
import { eq, sql, and } from "drizzle-orm";
import {
  SEMANTIC_ANCHORS,
  normalizeVietnameseShorthands,
  classifyIntent,
  trainAndSaveNlpModel,
  analyzeNaturalLanguage,
} from "~/core/nlp-cognitive/tokenizer";
import { getAgentTools, getPredatoryProductsForAgent } from "~/core/cognitive-swarm/game-theory";
import { generateProductSVG } from "~/server/api/local-media-engine";
import { evaluateMathExpression, solveCustomAlgorithm } from "~/core/quant-engine/financial-solver";
import {
  hybridRetrieve,
  rerank,
  tinyLLMVerify,
  computeAttentionFusion,
  compileToLlmWiki,
} from "~/core/neural-memory/vector-rag";
import { RAGLogger } from "~/core/neural-memory/rag-logger";
import { curriculumData } from "../../scripts/db-ops/seeders/curriculum-data";
import {
  serverAgentBudgets,
  serverAgentGold,
  serverAgentEmployees,
  getDynamicSkillTitle,
  calculateAgentLoanAmount,
  agentLoanParametersMap,
} from "~/shared/constants";
import { ALL_DOMAIN_TRAINING_PAIRS } from "~/core/nlp-cognitive/domain-training-data";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { recognize } from "~/core/nlp-cognitive/recognizer";
import { RottraPrivateBrain, filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import {
  generatePlan,
  executePlanWithReplanner,
  treeOfThoughtsReasoning,
} from "~/core/nlp-cognitive/planner";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import { initLlama, updateLlamaActivity } from "~/server/api/agent-router";
import type { Hono } from "hono";

`;

// LogRingBuffer class: lines 81-170
const logRingBufferClass = getLines(81, 170);

// globalLogRingBuffer instance (line 172)
const globalLogRingBufferInstance = getLines(172, 172);

// extractPriceConstraint: lines 2082-2090
const extractPriceConstraint = getLines(2082, 2090);

// sanitizeString + sanitizeObject: lines 2093-2113
const sanitizeHelpers = getLines(2093, 2113);

// parseDevice: lines 1275-1281
const parseDevice = getLines(1275, 1281);

// logActivity: lines 1283-1354
const logActivity = getLines(1283, 1354);

// getActivityStats: lines 1384-1427
const getActivityStats = getLines(1384, 1427);

// serverDefaultProducts: lines 1429-1442
const serverDefaultProducts = getLines(1429, 1442);

// serverAgentSkills: lines 1444-1457
const serverAgentSkills = getLines(1444, 1457);

// getPreciseImageForProduct: lines 487-493
const getPreciseImageForProduct = getLines(487, 493);

// resolveAgentUserId: lines 1091-1099
const resolveAgentUserId = getLines(1091, 1099);

// broadcastTradeSync: lines 1101-1173
const broadcastTradeSync = getLines(1101, 1173);

// getEnrichedProfile: lines 1459-1564
const getEnrichedProfile = getLines(1459, 1564);

// Route: /agent/chat - lines 2250-3570
const agentChatRoute = getLines(2250, 3570);

// Route: /agent/trade-financial - lines 3572-3737 (closing }); at 3737)
const agentTradeRoute = getLines(3572, 3737);

// Route: /agent/meeting-chat - lines 3739-4833 (closing }); at 4833)
const agentMeetingRoute = getLines(3739, 4833);

const output = `${header}
// --- LogRingBuffer (extracted from [...paths].ts) ---

${logRingBufferClass}

${globalLogRingBufferInstance}

// --- Local Helpers (extracted from [...paths].ts) ---

${extractPriceConstraint}

${sanitizeHelpers}

${parseDevice}

${logActivity}

${getActivityStats}

${serverDefaultProducts}

${serverAgentSkills}

${getPreciseImageForProduct}

${resolveAgentUserId}

${broadcastTradeSync}

${getEnrichedProfile}

// --- Route Registration ---

export function registerAgentChatRoutes(app: Hono) {
  ${agentChatRoute.replace(/^app\.post\("/, '  app.post("')}
  ${agentTradeRoute.replace(/^app\.post\("/, '  app.post("')}
  ${agentMeetingRoute.replace(/^app\.post\("/, '  app.post("')}
}
`;

const outPath = resolve(import.meta.dir, "../../src/routes/agent-chat.routes.ts");
writeFileSync(outPath, output, "utf-8");
console.log(`Written to ${outPath}`);
console.log(`Lines: ${output.split("\n").length}`);
