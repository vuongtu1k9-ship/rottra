import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { blockchainLedger, agentMemory, product, user } from "~/infra/database/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";

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
    console.error("[LEDGER ERROR]", error);
    return c.json({ success: false, error: error.message }, 500);
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
    return c.json({ success: false, error: error.message }, 500);
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
    console.error("[SELF-PLAY SIMULATION ERROR]", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
