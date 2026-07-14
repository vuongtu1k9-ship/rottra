import { Hono } from "hono";
import { createLogger } from "~/shared/logger";
import { db } from "~/infra/database/db-pool";
import { blockchainLedger, agentMemory, product, user } from "~/infra/database/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import {
  createNegotiationSession,
  runNegotiation,
  englishAuction,
  dutchAuction,
  vickreyAuction,
  findNashEquilibrium,
  mixedStrategyNash,
  createAgriculturalAgents,
  simulateMarket,
  type NegotiationAgent,
  type AuctionConfig,
} from "~/core/cognitive-swarm/multi-agent-negotiation";
import {
  generateGoalsFromSituation,
  executeGoal,
  evaluateGoalProgress,
  replanGoal,
  saveGoals,
  loadGoals,
  type Situation,
  type Goal,
} from "~/core/cognitive-swarm/autonomous-goal-setting";
import {
  detectDomain,
  getRelevantKnowledge,
  generateCrossDomainInsight,
  transferKnowledge,
} from "~/core/cognitive-swarm/cross-domain-learning";

const log = createLogger("api/trade-ledger");

export const ledgerApp = new Hono();

// Hàm tiện ích tạo mã băm SHA-256
const generateHash = (dataString: string): string => {
  return crypto.createHash("sha256").update(dataString).digest("hex");
};

// 1. Ghi lại một khối dữ liệu mới vào Sổ cái (Record new block)
ledgerApp.post("/record", async (c: any) => {
  try {
    const { batchId, action, dataPayload, recordedBy } = await c.req.json();

    if (!batchId || !action || !dataPayload) {
      return c.json({ success: false, error: "Thiếu trường dữ liệu bắt buộc (batchId, action, dataPayload)." }, 400);
    }

    // Lấy khối dữ liệu gần nhất của lô hàng này để lấy previousHash
    const lastBlock = await db.query.blockchainLedger.findFirst({
      where: eq(blockchainLedger.batchId, batchId),
      orderBy: [desc(blockchainLedger.timestamp)],
    });

    const previousHash = lastBlock ? lastBlock.currentHash : "0000000000000000000000000000000000000000000000000000000000000000"; // Genesis block hash
    const blockId = crypto.randomUUID();
    const timestampStr = new Date().toISOString();

    // Thuật toán đồng thuận cục bộ: Tạo chữ ký băm
    const rawData = `${batchId}|${action}|${JSON.stringify(dataPayload)}|${previousHash}|${timestampStr}`;
    const currentHash = generateHash(rawData);

    await db.insert(blockchainLedger).values({
      id: blockId,
      batchId,
      action,
      dataPayload,
      previousHash,
      currentHash,
      recordedBy: recordedBy || "SYSTEM_AGENT",
      timestamp: timestampStr,
    });

    return c.json({
      success: true,
      message: "Đã khắc ghi dữ liệu vào Sổ cái chuỗi khối.",
      block: { id: blockId, currentHash, previousHash },
    });
  } catch (error: any) {
    log.error("[LEDGER ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 2. Lấy toàn bộ lịch sử truy xuất nguồn gốc của một lô hàng
ledgerApp.get("/trace/:batchId", async (c: any) => {
  try {
    const { batchId } = c.req.param() as any;

    // Truy vấn chuỗi dữ liệu, sắp xếp từ cũ đến mới (tạo thành Blockchain)
    const blocks = await db.query.blockchainLedger.findMany({
      where: eq(blockchainLedger.batchId, batchId),
      orderBy: (table: any, { asc }: any) => [asc(table.timestamp)],
    });

    if (blocks.length === 0) {
      return c.json({
        success: true,
        isChainValid: true,
        corruptedBlockId: null,
        totalBlocks: 0,
        chain: [],
      });
    }

    // Xác minh tính toàn vẹn (Immutability Check)
    let isChainValid = true;
    let corruptedBlockId = null;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const expectedPreviousHash = i === 0 ? "0000000000000000000000000000000000000000000000000000000000000000" : blocks[i - 1].currentHash;

      // Khôi phục chữ ký để kiểm tra xem có ai can thiệp sửa đổi Database (PostgreSQL) không
      const rawData = `${block.batchId}|${block.action}|${JSON.stringify(block.dataPayload)}|${block.previousHash}|${block.timestamp}`;
      const recalculatedHash = generateHash(rawData);

      if (block.previousHash !== expectedPreviousHash || block.currentHash !== recalculatedHash) {
        isChainValid = false;
        corruptedBlockId = block.id;
        break;
      }
    }

    return c.json({
      success: true,
      isChainValid,
      corruptedBlockId,
      totalBlocks: blocks.length,
      chain: blocks,
    });
  } catch (error: any) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 3. Swarm Self-Play Arena Simulation Loop (Dưới góc nhìn Self-supervised Learning)
ledgerApp.post("/self-play", async (c: any) => {
  try {
    const { rounds = 5, sessionId = "global_self_play_session" } = await c.req.json().catch(() => ({}));

    const result = await RottraAI.executeSwarmSelfPlay(rounds, sessionId);

    return c.json({
      success: true,
      message: "Swarm Self-Play Simulation epoch completed, optimized, and recorded on Blockchain.",
      blockchainBlock: result.blockchainBlock,
      results: result.results,
    });
  } catch (error: any) {
    log.error("[SELF-PLAY SIMULATION ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 4. Multi-Agent Negotiation Engine (Game Theory + Nash Equilibrium)
ledgerApp.post("/negotiate", async (c: any) => {
  try {
    const { product: prodName, maxRounds = 10, strategy = "cooperative" } = await c.req.json();
    if (!prodName) return c.json({ success: false, error: "Thiếu tên sản phẩm (product)." }, 400);
    const agents = createAgriculturalAgents();
    const buyers = agents.filter((a) => a.role === "buyer");
    const sellers = agents.filter((a) => a.role === "seller");
    const session = createNegotiationSession(prodName, buyers.slice(0, 1), sellers.slice(0, 1));
    const result = runNegotiation(session, maxRounds);

    const payoffMatrix = [
      [3, 0],
      [2, 1],
    ];
    const nash = findNashEquilibrium(payoffMatrix);
    const mixedNash = mixedStrategyNash(
      [
        [3, 0],
        [0, 2],
      ],
      [
        [2, 0],
        [0, 3],
      ],
    );

    return c.json({
      success: true,
      sessionId: result.id,
      status: result.status,
      finalPrice: result.finalPrice,
      rounds: result.rounds.length,
      nashEquilibrium: nash,
      mixedStrategyNash: mixedNash,
    });
  } catch (error: any) {
    log.error("[NEGOTIATE ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 5. Auction Mechanisms (English, Dutch, Vickrey)
ledgerApp.post("/auction", async (c: any) => {
  try {
    const { type = "english", reservePrice = 50000, minBidIncrement = 1000, maxRounds = 20 } = await c.req.json();
    const agents = createAgriculturalAgents();
    const config: AuctionConfig = { type: type as any, reservePrice, minBidIncrement, maxRounds };
    let result;
    switch (type) {
      case "dutch":
        result = dutchAuction(config, agents);
        break;
      case "vickrey":
        result = vickreyAuction(config, agents);
        break;
      default:
        result = englishAuction(config, agents);
        break;
    }
    return c.json({ success: true, auctionType: type, ...result });
  } catch (error: any) {
    log.error("[AUCTION ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 6. Autonomous Goal Setting
ledgerApp.post("/goals", async (c: any) => {
  try {
    const { action, userId = "system", situation, goalId } = await c.req.json();
    switch (action) {
      case "generate": {
        const sit: Situation = situation || {
          context: "Agricultural e-commerce",
          domain: "agriculture",
          availableResources: ["database", "AI"],
          constraints: [],
          recentEvents: [],
          userGoals: [],
        };
        const goals = generateGoalsFromSituation(sit, loadGoals(userId));
        saveGoals(userId, goals);
        return c.json({ success: true, goals, count: goals.length });
      }
      case "execute": {
        const goals = loadGoals(userId);
        const goal = goals.find((g: Goal) => g.id === goalId);
        if (!goal) return c.json({ success: false, error: "Goal not found" }, 404);
        const executed = executeGoal(goal);
        return c.json({ success: true, goal: executed });
      }
      case "status": {
        const goals = loadGoals(userId);
        const progress = evaluateGoalProgress(goals);
        return c.json({ success: true, ...progress, goals });
      }
      default:
        return c.json({ success: false, error: "Invalid action. Use: generate, execute, status" }, 400);
    }
  } catch (error: any) {
    log.error("[GOALS ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

// 7. Cross-Domain Learning
ledgerApp.post("/cross-domain", async (c: any) => {
  try {
    const { action, query, sourceDomain, targetDomain } = await c.req.json();
    switch (action) {
      case "detect": {
        const result = detectDomain(query || "");
        return c.json({ success: true, ...result });
      }
      case "knowledge": {
        const knowledge = getRelevantKnowledge(query || "");
        return c.json({ success: true, knowledge });
      }
      case "transfer": {
        if (!sourceDomain || !targetDomain) return c.json({ success: false, error: "Thiếu sourceDomain/targetDomain" }, 400);
        const transferResult = transferKnowledge(query || "", sourceDomain, targetDomain);
        return c.json({ success: true, transfer: transferResult });
      }
      case "insight": {
        const insight = generateCrossDomainInsight(query || "");
        return c.json({ success: true, insight });
      }
      case "market-simulate": {
        const agents = createAgriculturalAgents();
        const simResult = simulateMarket(agents, 50);
        return c.json({ success: true, ...simResult });
      }
      default:
        return c.json({ success: false, error: "Invalid action. Use: detect, knowledge, transfer, insight, market-simulate" }, 400);
    }
  } catch (error: any) {
    log.error("[CROSS-DOMAIN ERROR]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
