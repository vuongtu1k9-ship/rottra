import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import zlib from "node:zlib";
import WebSocket from "ws";
import { db, pgClient } from "~/infra/database/db-pool";
import {
  user,
  product,
  review,
  order,
  systemSetting,
  cart,
  file,
  agentMemory,
  agentTraining,
  activity,
  chatSummary,
  vectorDocument,
} from "~/infra/database/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as dbSchema from "~/infra/database/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { botActionsMap } from "~/core/cognitive-swarm/bot-actions";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec as execCallback, spawn } from "node:child_process";

function promisify(fn: Function) {
  return function (...args: any[]) {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, ...results: any[]) => {
        if (err) return reject(err);
        resolve(results.length === 1 ? results[0] : results);
      });
    });
  };
}
const req = import.meta.require;
const puppeteer = req ? req("puppeteer") : null;
import {
  SEMANTIC_ANCHORS,
  initNlpEngine,
  analyzeNaturalLanguage,
  normalizeVietnameseShorthands,
  classifyIntent,
  trainAndSaveNlpModel,
} from "~/core/nlp-cognitive/tokenizer";
import { getAgentTools, getPredatoryProductsForAgent } from "~/core/cognitive-swarm/game-theory";
import { generateProductSVG } from "~/server/api/local-media-engine";
import { evaluateMathExpression, solveCustomAlgorithm } from "~/core/quant-engine/financial-solver";
import { hybridRetrieve, rerank, tinyLLMVerify, computeAttentionFusion, compileToLlmWiki } from "~/core/neural-memory/vector-rag";
import { RAGLogger } from "~/core/neural-memory/rag-logger";
import { curriculumData } from "../../../scripts/db-ops/seeders/curriculum-data";
import {
  serverAgentBudgets,
  serverAgentGold,
  serverAgentEmployees,
  getDynamicSkillTitle,
  calculateAgentLoanAmount,
  agentLoanParametersMap,
} from "~/shared/constants";
import { ALL_DOMAIN_TRAINING_PAIRS } from "~/core/nlp-cognitive/domain-training-data";
const execAsync = promisify(execCallback);
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { recognize } from "~/core/nlp-cognitive/recognizer";
import { RottraPrivateBrain, filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import { generatePlan, executePlanWithReplanner, treeOfThoughtsReasoning } from "~/core/nlp-cognitive/planner";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import { VietlexClient } from "~/core/cognitive-swarm/vietlex-client";
import { currentGoldPrice } from "~/server/api/agent-router";
import { systemLoadRegulator } from "~/server/helpers/system-load-regulator";
import { visionBrain } from "~/core/nlp-cognitive/vision-brain";

import { registerAdminRoutes } from "~/routes/admin.routes";
import { registerOrderRoutes } from "~/routes/order.routes";
import { registerUserRoutes } from "~/routes/user.routes";
import { registerDrawingRoutes } from "~/routes/drawing.routes";
import { registerAgentChatRoutes } from "~/routes/agent-chat.routes";
import { registerAgentOpsRoutes } from "~/routes/agent-ops.routes";
import { registerMediaRoutes } from "~/routes/media.routes";

class LogRingBuffer {
  private buffer: any[] = [];
  private capacity: number;
  private flushThreshold: number;
  private flushIntervalMs: number;
  private timer: any = null;
  private isFlushing = false;

  constructor(capacity = 100, flushThreshold = 15, flushIntervalMs = 5000) {
    this.capacity = capacity;
    this.flushThreshold = flushThreshold;
    this.flushIntervalMs = flushIntervalMs;
  }

  public push(log: any) {
    this.startInterval();
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(log);

    if (this.buffer.length >= this.flushThreshold) {
      this.flush().catch((err) => console.error("Flush error in push:", err));
    }
  }

  private startInterval() {
    if (this.timer) return;
    try {
      this.timer = setInterval(() => {
        this.flush().catch((err) => console.error("Flush error in interval:", err));
      }, this.flushIntervalMs);
    } catch (e) {
      console.warn("Failed to set interval (likely in serverless environment):", e);
    }
  }

  public async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const itemsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      await this.bulkInsert(itemsToFlush);
      console.log(`[LogRingBuffer] Bulk inserted ${itemsToFlush.length} logs.`);
    } catch (err: any) {
      console.error("[LogRingBuffer] Bulk insert failed:", err.message);
      const merged = [...itemsToFlush, ...this.buffer];
      if (merged.length > this.capacity) {
        this.buffer = merged.slice(merged.length - this.capacity);
      } else {
        this.buffer = merged;
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async bulkInsert(items: any[]) {
    if (items.length === 0) return;

    const columns = ["id", "query", "cleaned_query", "word_count", "char_count", "entropy", "word_frequencies", "intent", "confidence"];

    const valueRows: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const item of items) {
      const placeholders = [];
      for (const col of columns) {
        placeholders.push(`$${paramIndex++}`);
        if (col === "word_frequencies") {
          params.push(JSON.stringify(item[col] || {}));
        } else {
          params.push(item[col]);
        }
      }
      valueRows.push(`(${placeholders.join(", ")})`);
    }

    const queryStr = `
      INSERT INTO "NaturalLanguageLog" (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES ${valueRows.join(", ")}
    `;

    await pgClient.query(queryStr, params);
  }
}

export const globalLogRingBuffer = new LogRingBuffer(100, 15, 5000);

async function runVideoAndLogGC() {
  console.log("🧹 [Video & Log GC] Starting video and log garbage collection...");
  try {
    const videosDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(videosDir)) {
      console.log("🧹 [Video & Log GC] Videos directory does not exist.");
      return;
    }

    // Query all product media fields to find referenced videos
    const productsRes = await pgClient.query('SELECT "media" FROM "Product"');
    const referencedVideos = new Set<string>();

    for (const row of productsRes.rows) {
      let media = row.media;
      if (typeof media === "string") {
        try {
          media = JSON.parse(media);
        } catch {
          media = [];
        }
      }
      if (Array.isArray(media)) {
        for (const item of media) {
          if (item && typeof item.link === "string" && item.link.startsWith("/videos/")) {
            const fileName = item.link.replace("/videos/", "");
            referencedVideos.add(decodeURIComponent(fileName));
          }
        }
      }
    }

    const files = fs.readdirSync(videosDir);
    let deletedVideosCount = 0;
    let deletedLogsCount = 0;
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(videosDir, file);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (e) {
        continue;
      }

      // Check if file is older than 1 hour
      const isOlderThanOneHour = now - stats.mtimeMs > oneHourMs;

      if (file.startsWith("output_") && file.endsWith(".mp4")) {
        // Preserved defaults/seeds or referenced videos
        if (
          file.includes("seed") ||
          file === "output_test.mp4" ||
          file === "output_test_ads.mp4" ||
          file === "output_test_draft.mp4" ||
          file === "output_dummy-product-123.mp4"
        ) {
          continue;
        }
        if (!referencedVideos.has(file) && isOlderThanOneHour) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🧹 [Video & Log GC] Deleted orphaned video: ${file}`);
            deletedVideosCount++;
          } catch (err: any) {
            console.error(`🧹 [Video & Log GC] Failed to delete video ${file}:`, err.message);
          }
        }
      } else if (file.startsWith("render_") && file.endsWith(".log")) {
        if (isOlderThanOneHour) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🧹 [Video & Log GC] Deleted old log file: ${file}`);
            deletedLogsCount++;
          } catch (err: any) {
            console.error(`🧹 [Video & Log GC] Failed to delete log ${file}:`, err.message);
          }
        }
      }
    }

    console.log(`🧹 [Video & Log GC] Completed. Deleted ${deletedVideosCount} videos and ${deletedLogsCount} logs.`);
  } catch (err: any) {
    console.error("🧹 [Video & Log GC] Error executing GC:", err.message);
  }
}

async function runOrphanBannerGC() {
  console.log("🧹 [Banner GC] Starting orphan banner garbage collection...");
  try {
    const bannersDir = path.join(process.cwd(), "public", "images", "banners");
    if (!fs.existsSync(bannersDir)) {
      console.log("🧹 [Banner GC] Banners directory does not exist.");
      return;
    }

    const defaultBanners = new Set([
      "Cam đang vắt.avif",
      "Cam mới hái.avif",
      "Cam trang trí.avif",
      "Nước cam đóng hộp.avif",
      "Quả cam màu vàng.jpeg",
      "Quả cam màu xanh.jpeg",
      "Quả cam trên cây.jpeg",
      "Quả cam trên tay.avif",
    ]);

    // Query all product media fields
    const productsRes = await pgClient.query('SELECT "media" FROM "Product"');
    const referencedBanners = new Set<string>();

    for (const row of productsRes.rows) {
      let media = row.media;
      if (typeof media === "string") {
        try {
          media = JSON.parse(media);
        } catch {
          media = [];
        }
      }
      if (Array.isArray(media)) {
        for (const item of media) {
          if (item && typeof item.link === "string" && item.link.startsWith("/images/banners/")) {
            const fileName = item.link.replace("/images/banners/", "");
            referencedBanners.add(decodeURIComponent(fileName));
          }
        }
      }
    }

    // Read all files in the banners folder
    const files = fs.readdirSync(bannersDir);
    let deletedCount = 0;

    for (const file of files) {
      if (defaultBanners.has(file)) {
        continue;
      }
      if (!referencedBanners.has(file)) {
        const filePath = path.join(bannersDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🧹 [Banner GC] Deleted orphaned banner file: ${file}`);
          deletedCount++;
        } catch (err: any) {
          console.error(`🧹 [Banner GC] Failed to delete file ${file}:`, err.message);
        }
      }
    }

    console.log(`🧹 [Banner GC] Completed. Deleted ${deletedCount} orphaned banners.`);
  } catch (err: any) {
    console.error("🧹 [Banner GC] Error executing banner GC:", err.message);
  }
}

async function runLogRollupAndPruning() {
  console.log("🧹 [LogRollup Worker] Running rollup and pruning check...");
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffStr = cutoffDate.toISOString();

    const rawLogsRes = await pgClient.query(`SELECT * FROM "NaturalLanguageLog" WHERE "addAt" < $1 ORDER BY "addAt" ASC`, [cutoffStr]);
    const oldLogs = rawLogsRes.rows;
    if (oldLogs.length === 0) {
      console.log("🧹 [LogRollup Worker] No logs older than 7 days found.");
      return;
    }

    console.log(`🧹 [LogRollup Worker] Found ${oldLogs.length} logs to roll up and archive.`);

    const groups = new Map<string, any[]>();
    for (const log of oldLogs) {
      const date = new Date(log.addAt || log.createdAt || Date.now());
      date.setMinutes(0, 0, 0);
      const hourStr = date.toISOString();
      if (!groups.has(hourStr)) {
        groups.set(hourStr, []);
      }
      groups.get(hourStr)!.push(log);
    }

    for (const [hourStr, logsInHour] of groups.entries()) {
      const totalLogs = logsInHour.length;
      const avgEntropy = logsInHour.reduce((acc, l) => acc + (l.entropy || 0), 0) / totalLogs;
      const avgWordCount = logsInHour.reduce((acc, l) => acc + (l.word_count || l.wordCount || 0), 0) / totalLogs;
      const avgCharCount = logsInHour.reduce((acc, l) => acc + (l.char_count || l.charCount || 0), 0) / totalLogs;

      const intentDistribution: Record<string, number> = {};
      const wordFrequencies: Record<string, number> = {};

      for (const log of logsInHour) {
        const intent = log.intent || "UNKNOWN";
        intentDistribution[intent] = (intentDistribution[intent] || 0) + 1;

        let freqs = log.word_frequencies || log.wordFrequencies || {};
        if (typeof freqs === "string") {
          try {
            freqs = JSON.parse(freqs);
          } catch {
            freqs = {};
          }
        }
        for (const [word, count] of Object.entries(freqs)) {
          wordFrequencies[word] = (wordFrequencies[word] || 0) + Number(count);
        }
      }

      await pgClient.query(
        `
        INSERT INTO "LogRollup" ("id", "rollup_hour", "total_logs", "avg_entropy", "avg_word_count", "avg_char_count", "intent_distribution", "word_frequencies")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT ("rollup_hour") DO UPDATE SET
          "total_logs" = "LogRollup"."total_logs" + EXCLUDED."total_logs",
          "avg_entropy" = ("LogRollup"."avg_entropy" + EXCLUDED."avg_entropy") / 2.0,
          "avg_word_count" = ("LogRollup"."avg_word_count" + EXCLUDED."avg_word_count") / 2.0,
          "avg_char_count" = ("LogRollup"."avg_char_count" + EXCLUDED."avg_char_count") / 2.0,
          "intent_distribution" = EXCLUDED."intent_distribution",
          "word_frequencies" = EXCLUDED."word_frequencies"
        `,
        [
          crypto.randomUUID(),
          hourStr,
          totalLogs,
          avgEntropy,
          avgWordCount,
          avgCharCount,
          JSON.stringify(intentDistribution),
          JSON.stringify(wordFrequencies),
        ],
      );
    }

    const archiveDir = path.join(process.cwd(), "archive", "logs");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const archiveFileName = `log_archive_${Date.now()}.json.gz`;
    const archivePath = path.join(archiveDir, archiveFileName);

    const logData = JSON.stringify(oldLogs);
    const compressed = zlib.gzipSync(Buffer.from(logData));
    fs.writeFileSync(archivePath, compressed);
    console.log(`🧹 [LogRollup Worker] Archived ${oldLogs.length} logs to ${archivePath}`);

    const oldLogIds = oldLogs.map((l: any) => l.id);
    for (let i = 0; i < oldLogIds.length; i += 100) {
      const batch = oldLogIds.slice(i, i + 100);
      const placeholders = batch.map((_: any, idx: number) => `$${idx + 1}`).join(", ");
      await pgClient.query(`DELETE FROM "NaturalLanguageLog" WHERE "id" IN (${placeholders})`, batch);
    }
    console.log(`🧹 [LogRollup Worker] Pruned ${oldLogs.length} raw logs from database successfully.`);
  } catch (err: any) {
    console.error("🧹 [LogRollup Worker] Error executing rollup and pruning:", err.message);
  }
}

const getMediaLink = (m: any): string | null => {
  if (!m) return null;
  if (typeof m === "string") return m;
  if (typeof m === "object") {
    const linkVal = m.link || m.src;
    if (linkVal && typeof linkVal === "string") {
      return linkVal;
    }
  }
  return null;
};

const getProductImageUrl = (media: any[], prefixType: "http" | "file" = "http") => {
  let url = prefixType === "http" ? "/images/no-image.avif" : "/images/no-image.avif";
  if (Array.isArray(media)) {
    const firstImg = media.find((m: any) => m && (typeof m === "string" || m.type === "image" || !m.type));
    if (firstImg) {
      const linkVal = getMediaLink(firstImg);
      if (linkVal) {
        url = linkVal;
      }
    }
  }
  if (url && typeof url === "string" && url.startsWith("/")) {
    if (prefixType === "http") {
      url = `http://localhost:${process.env.PORT || 5173}${url}`;
    } else {
      url = `file://${path.join(process.cwd(), "public", url)}`;
    }
  }
  return url;
};

const downloadToLocal = async (url: string): Promise<string> => {
  if (url.startsWith("/") || !url.startsWith("http")) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "/images/Rottra-logo.avif";
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const hash = crypto.createHash("md5").update(buf).digest("hex");
    const filename = `ai_img_${hash}.avif`;
    const fileUrl = `/uploads/${filename}`;
    const dir = "public/uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${filename}`, buf);
    return fileUrl;
  } catch (err) {
    console.warn("[IMAGE DOWNLOAD ERROR] Lỗi tải ảnh về server:", err);
    return "/images/Rottra-logo.avif";
  }
};

export const getPreciseImageForProduct = async (productName: string, category: string) => {
  if (!productName || productName.toLowerCase().includes("đang cập nhật")) {
    return "/images/no-image.avif";
  }
  const svgStr = generateProductSVG("default", productName, "Liên hệ");
  return `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
};

const globalObj = (typeof process !== "undefined" ? process : globalThis) as any;

export const isCloudflare = typeof globalThis.caches !== "undefined" || (typeof process !== "undefined" && process.env.CF_PAGES === "1");

if (!globalObj.__dbInitialized && !isCloudflare) {
  globalObj.__dbInitialized = true;

  (async () => {
    try {
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "AgentTraining" (
        "id" text PRIMARY KEY NOT NULL,
        "intent" text NOT NULL,
        "utterance" text NOT NULL,
        "answer" text NOT NULL,
        "addAt" TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "BlockchainLedger" (
        "id" text PRIMARY KEY NOT NULL,
        "batchId" text NOT NULL,
        "action" text NOT NULL,
        "dataPayload" text NOT NULL,
        "previousHash" text NOT NULL,
        "currentHash" text NOT NULL,
        "recordedBy" text,
        "timestamp" TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "LogRollup" (
        "id" text PRIMARY KEY NOT NULL,
        "rollup_hour" TEXT NOT NULL UNIQUE,
        "total_logs" integer NOT NULL,
        "avg_entropy" real NOT NULL,
        "avg_word_count" real NOT NULL,
        "avg_char_count" real NOT NULL,
        "intent_distribution" text NOT NULL,
        "word_frequencies" text NOT NULL,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
      console.log("⚡ [Tables] Initialized successfully.");

      // Khởi chạy log rollup worker dọn dẹp log định kỳ
      runLogRollupAndPruning().catch((err) => console.error("Rollup worker startup error:", err));
      setInterval(
        () => {
          runLogRollupAndPruning().catch((err) => console.error("Rollup worker error:", err));
        },
        12 * 60 * 60 * 1000,
      );

      // Khởi chạy dọn dẹp ảnh banner rác định kỳ hàng ngày
      runOrphanBannerGC().catch((err) => console.error("Banner GC startup error:", err));
      setInterval(
        () => {
          runOrphanBannerGC().catch((err) => console.error("Banner GC error:", err));
        },
        24 * 60 * 60 * 1000,
      );

      // Khởi chạy dọn dẹp video và log rác định kỳ hàng ngày
      runVideoAndLogGC().catch((err) => console.error("Video & Log GC startup error:", err));
      setInterval(
        () => {
          runVideoAndLogGC().catch((err) => console.error("Video & Log GC error:", err));
        },
        24 * 60 * 60 * 1000,
      );

      // Tự động nạp hoặc cập nhật bộ não tri thức lượng tử vào PostgreSQL PostgreSQL theo các tiêu chuẩn Rottra
      console.log("🌱 [PostgreSQL] Syncing latest Rottra Expert Brain templates into PostgreSQL database...");
      await db.delete(agentTraining);
      await db.delete(vectorDocument).where(eq(vectorDocument.category, "EDUCATION_CURRICULUM"));

      const baseTemplates = [
        {
          id: "1",
          intent: "ACADEMIC",
          utterance: "giai bai toan hoc thuat",
          answer: `🎓 [LÕI GIẢI TOÁN HỌC THUẬT Rottra - OFFLINE EXPERT]

Chào Sếp! Tôi đã kích hoạt Bộ giải toán Học thuật từ CSDL để hỗ trợ phân tích bài toán của Sếp:

*   Phương pháp: Hỗ trợ phân tích, xây dựng công thức và giải chi tiết từng bước.
*   Trạng thái: Hoạt động tự chủ ngoại tuyến.

Sếp vui lòng nhập đề bài chi tiết (ví dụ: các bài toán về xác suất, tổ hợp, hoặc ma trận/phương trình), hệ thống sẽ tính toán và đưa ra lời giải chính xác nhất!`,
        },
        {
          id: "2",
          intent: "STATISTICS",
          utterance: "giai toan",
          answer: `🧮 [BỘ MÁY TÍNH TOÁN LƯỢNG TỬ SIÊU THU NHỎ - POSTGRESQL]

Tôi đã truy xuất biểu mẫu giải từ CSDL PostgreSQL và thực thi biểu thức số học của Sếp:

*   📝 Biểu thức nhận dạng: \`{{EXPR}}\`
*   ⚙️ Quy trình xử lý: Tối ưu hóa phân rã toán tử (Operator Precedence)
*   🏆 Kết quả chính xác: {{RESULT}}

$$\\boxed{{{RESULT}}}$$

*Sếp cần tôi tính toán ma trận, vẽ đồ thị phân phối hay giải phương trình nào khác không ạ? 😎*`,
        },
        {
          id: "3",
          intent: "LOGISTICS",
          utterance: "do thi luong do",
          answer: `🎓 [TRẠM LOGISTICS & TỐI ƯU HÓA MẠNG LƯỚI - POSTGRESQL]

Chào Sếp! Tôi đã truy xuất tài liệu tối ưu từ CSDL PostgreSQL để phân tích thuật toán giải quyết Luồng cực đại (Maximum Flow) và Bài toán Người bán hàng (TSP):

### 📡 1) Phân Tích Luồng Cực Đại (Ford-Fulkerson):
Hệ thống logistics của Rottra được mô hình hóa dưới dạng đồ thị có hướng $G = (V, E)$:
*   Nguồn (Source - $s$): Tổng kho nông sản trung tâm.
*   Đích (Sink - $t$): Hệ thống siêu thị tiêu thụ.
*   Dung lượng cạnh $c(u,v)$: Khả năng vận chuyển tối đa của đội xe trên tuyến đường $(u,v)$.

#### ⚙️ Các bước suy luận tối ưu (Augmenting Paths):
1.  Bước khởi tạo: Đặt luồng ban đầu qua mỗi cạnh $f(u,v) = 0$.
2.  Mạng thặng dư (Residual Graph): Xây dựng đồ thị thặng dư thể hiện khả năng tăng luồng còn lại:
    $$c_f(u,v) = c(u,v) - f(u,v)$$
3.  Định lý Luồng cực đại - Lát cắt tối thiểu (Max-Flow Min-Cut Theorem): Luồng cực đại đi từ $s$ đến $t$ bằng đúng dung lượng của lát cắt hẹp nhất (bottleneck) trong mạng.

### 🚚 2) Tối Ưu Hóa Tuyến Đường (TSP - Traveling Salesperson Problem):
Để xe giao hàng đi qua tất cả $N$ đại lý nông sản của Rottra đúng một lần và quay về kho với quãng đường ngắn nhất:
*   Sử dụng thuật toán nhánh cận (Branch and Bound) kết hợp Heuristic 2-opt để giảm độ phức tạp từ $\\mathcal{O}(N!)$ xuống thời gian thực.
*   Mô hình hóa:
    $$\\min \\sum_{i=1}^n \\sum_{j=1}^n d(i,j) x_{ij}$$
    *(Với $x_{ij} = 1$ nếu xe di chuyển từ đại lý $i$ sang đại lý $j$, ngược lại bằng $0$)*

*👉 Đây là cốt lõi logic toán học vận hành đội xe tự chủ của Rottra được lưu trữ bền vững trong PostgreSQL CSDL!*`,
        },
        {
          id: "4",
          intent: "RESEARCH",
          utterance: "nghien cuu su pham",
          answer: `🎓 [VIỆN CÔNG NGHỆ & SƯ PHẠM CAO CẤP Rottra - POSTGRESQL]

Chào Sếp! Dữ liệu giảng dạy nghiên cứu kết hợp khoa học định lượng đã được nạp thành công từ CSDL PostgreSQL:

### 🏫 1) Rottra Case Method (Vấn đáp Socrates):
*   Thay vì nhồi nhét lý thuyết, ta dùng các Case Study thực tiễn để tiểu thương tự giải quyết bài toán định giá và quản trị rủi ro.
*   Gợi mở chủ động: Đặt câu hỏi phản biện để kích thích tư duy kinh tế của tiểu thương.

### 🧪 2) Thực nghiệm Thống kê học (Quantitative Econometrics):
*   Áp dụng mô hình hồi quy OLS đa biến để đo lường chính xác hiệu quả số hóa:
    $$Y_{it} = \\beta_0 + \\beta_1 \\text{SmartTech}_{it} + \\gamma X_{it} + \\epsilon_{it}$$
    *(Trong đó $Y$ là doanh thu, $\\text{SmartTech}$ là biến giả đại diện cho việc áp dụng công nghệ Rottra)*
*   Kiểm định giả thuyết ($H_0$): Bác bỏ các định kiến kinh nghiệm cũ bằng chỉ số khoa học $p$-value $< 0.05$.

*💡 Đây chính là "cốt não" tri thức đã được lưu trữ bền vững trong PostgreSQL giúp Sếp triển khai dự án giáo dục nông nghiệp cực kỳ thành công!*`,
        },
        {
          id: "5",
          intent: "DEFAULT",
          utterance: "Rottra brain",
          answer: `🧠 [SIÊU NÃO BỘ SUY LUẬN TỰ CHỦ Rottra - EXPERT POSTGRESQL]

Chào Sếp! Lõi nhận thức offline được truy xuất trực tiếp từ CSDL PostgreSQL đã phân tích yêu cầu của Sếp: *"{{QUERY}}"*

### 🔍 Phân tích ngữ cảnh & Suy luận logic (CoT):
*   Ý định nhận diện: Tư vấn chiến lược vĩ mô kiêm giải quyết bài toán kỹ thuật.
*   Phương án xử lý: Trích xuất tri thức từ kho dữ liệu thuật toán và CSDL địa phương.

### 🏆 Đề xuất giải pháp chi tiết từ Hệ thống Rottra:
1.  Về E-Commerce & Nông sản: Hệ thống của chúng ta đang quản lý đầy đủ danh mục gạo hữu cơ, cà phê Robusta, sầu riêng Ri6 chuẩn VietGAP chất lượng cao.
2.  Về Tối ưu hóa: Tôi sẵn sàng hỗ trợ sếp phân tích doanh thu, vẽ biểu đồ Gantt quản lý tiến độ dự án, hoặc tính toán các chỉ số thống kê (Mean, Median, StdDev) cho số liệu thực tế.
3.  Về Trí tuệ Nhân tạo: Sếp có thể ra lệnh bằng tiếng Việt tự nhiên (VD: *"tính thống kê cho [15, 20, 25, 30]"* hoặc *"giải toán 450 - 12"*), tôi sẽ giải quyết ngay lập tức với tốc độ mili-giây và không tốn một byte RAM chạy GGUF nào!

*Sếp muốn tôi thực hiện hành động phân tích dữ liệu nào ngay bây giờ để tối đa hóa doanh thu E-Commerce cho Rottra ạ? 🚀*`,
        },
        {
          id: "6",
          intent: "TSP",
          utterance: "do thi tsp nguoi ban hang",
          answer: `🚛 [BỘ GIẢI TOÁN TỐI ƯU TUYẾN ĐƯỜNG TSP - Rottra SEAS]

Tôi đã truy xuất thuật toán Vận trù học từ CSDL PostgreSQL để tối ưu hóa tuyến đường thu gom nông sản của Sếp:

### ⚙️ Mô hình toán học quy hoạch nguyên tuyến tính (MILP - MTZ Constraints):
$$\\min \\sum_{i=1}^n \\sum_{j=1}^n d(i, j) x_{i, j}$$
$$\\text{s.t. } u_i - u_j + n x_{i, j} \\le n - 1 \\quad \\forall 2 \\le i \\neq j \\le n$$

### 📊 Dữ liệu đầu vào thực tế từ Sếp:
*   Tổng số nút giao/điểm thu gom: $N = {{NODES}}$ điểm.
*   Ma trận khoảng cách $d(i, j)$ được khởi tạo động từ vị trí nông trại đến Kho Rottra.

### 🏆 Tuyến đường tối ưu được xác định (Branch and Bound Heuristics):
$$\\text{Kho Trung tâm (s)} \\to {{ROUTE}} \\to \\text{Kho Trung tâm (s)}$$

*   📦 Tổng quãng đường ngắn nhất: {{DISTANCE}} km
*   🌱 Lượng khí thải CO2 giảm thiểu: {{CO2_SAVED}}% so với tuyến đường truyền thống nhờ Heuristic tối ưu hóa!`,
        },
        {
          id: "7",
          intent: "WARDROP",
          utterance: "do thi wardrop phan luong",
          answer: `🚦 [BỘ MÔ PHỎNG PHÂN LUỒNG WARDROP USER EQUILIBRIUM]

Chào Sếp! Tôi đã tải mô hình phân luồng giao thông từ CSDL PostgreSQL để cân bằng lưu lượng xe vận tải:

### ⚙️ Định luật cân bằng Wardrop (User Equilibrium):
Mỗi tài xế xe tải tự chọn tuyến đường ngắn nhất, dẫn đến trạng thái cân bằng nơi không ai có thể tự giảm thời gian di chuyển bằng cách đổi tuyến:
$$\\min \\sum_{a \\in A} \\int_{0}^{x_a} t_a(w) dw$$

### 📊 Tính toán dòng chảy động của Sếp:
*   Lưu lượng yêu cầu trên tuyến: $T = {{DEMAND}}$ xe/giờ.
*   Thời gian di chuyển trên Tuyến 1: $t_1(x_1) = {{T1_VAL}} + {{T1_COEF}} x_1$
*   Thời gian di chuyển trên Tuyến 2: $t_2(x_2) = {{T2_VAL}} + {{T2_COEF}} x_2$

### 🏆 Lời giải Hệ phương trình Trạng thái Cân bằng:
*   Lưu lượng phân bổ Tuyến 1: $x_1^* = {{X1}}$ xe/giờ
*   Lưu lượng phân bổ Tuyến 2: $x_2^* = {{X2}}$ xe/giờ
*   Thời gian di chuyển tại điểm cân bằng: $t_1(x_1^*) = t_2(x_2^*) = {{TRAVEL_TIME}}$ phút.

$$\\boxed{t^* = {{TRAVEL_TIME}}\\text{ phút}}$$`,
        },
        {
          id: "8",
          intent: "NPV",
          utterance: "npv cba tham dinh",
          answer: `📈 [BỘ TÍNH TOÁN KINH TẾ LƯỢNG NPV CBA - Rottra ACADEMY]

Sếp ơi! Tôi đã kích hoạt Bộ thẩm định dự án đầu tư NPV từ CSDL PostgreSQL để tính toán hiệu quả tài chính số hóa:

### ⚙️ Công thức Giá trị Hiện tại Ròng (Net Present Value):
$$NPV = \\sum_{t=0}^N \\frac{B_t - C_t}{(1 + r)^t}$$

### 📊 Các chỉ số đầu vào của Sếp:
*   Vốn đầu tư ban đầu: $C_0 = {{CAPEX}}$ triệu VNĐ.
*   Dòng tiền thuần hàng năm (Benefit - Cost): $CF = {{CASHFLOW}}$ triệu VNĐ.
*   Thời gian dự án: $N = {{YEARS}}$ năm.
*   Tỷ lệ chiết khấu: $r = {{RATE}}\%$.

<details style="margin: 12px 0; padding: 12px; border: 1px solid #3182ce; border-radius: 8px; background: rgba(49, 130, 206, 0.05);">
  <summary style="font-weight: bold; cursor: pointer; color: #3182ce; outline: none; user-select: none;">📈 Click vào đây để xem lũy kế dòng tiền chi tiết...</summary>
  <div style="margin-top: 10px; line-height: 1.6;">
    *   Năm 0: $-{{CAPEX}}$ triệu VNĐ.
    *   Năm 1 đến {{YEARS}}: Tổng hiện giá dòng thu hồi $PV = {{PV_TOTAL}}$ triệu VNĐ.
    *   Giá trị Hiện tại Ròng (NPV): <output style="font-weight: bold; color: #3182ce;">{{NPV_VAL}} triệu VNĐ</output>.
  </div>
</details>

$$\\boxed{NPV = {{NPV_VAL}}\\text{ triệu VNĐ}}$$

👉 Đánh giá hiệu quả kinh tế: Dự án {{DECISION}} vì NPV {{NPV_SIGN}} 0. Đây là cơ sở khoa học tài chính vững chắc để Sếp yên tâm triển khai!`,
        },
        {
          id: "9",
          intent: "COBWEB",
          utterance: "cobweb mang nhen gia",
          answer: `🕸️ [BỘ MÔ HÌNH CÂN BẰNG MẠNG NHỆN COBWEB MODEL]

Chào Sếp! Mô hình cân bằng động cung - cầu của nông sản Rottra đã được nạp từ CSDL PostgreSQL:

### ⚙️ Mô hình toán học Cobweb Supply-Demand:
$$P(t) = (P(0) - P^*) \\left( -\\frac{d}{b} \\right)^t + P^*$$
*(Trong đó $P^*$ là giá cân bằng dài hạn, $b$ là hệ số co giãn của cầu, $d$ là hệ số co giãn của cung)*

### 📊 Thông số động học:
*   Giá khởi điểm: $P(0) = {{P0}}$ USD.
*   Hệ số cung/cầu: $d/b = {{RATIO}}$.
*   Giá cân bằng dài hạn: $P^* = {{PEST}}$ USD.

### 🏆 Đánh giá động thái thị trường:
*   Tại chu kỳ $t = {{YEARS}}$: Giá nông sản sẽ ở mức {{PRICE_T}} USD.
*   Trạng thái hội tụ: Thị trường đạt trạng thái {{STABILITY}} (giá tiệm cận ổn định về $P^*$ dài hạn).`,
        },
        {
          id: "10",
          intent: "KALMAN",
          utterance: "kalman khuyen nhieu cam bien",
          answer: `📡 [BỘ LỌC KHỬ NHIỄU CẢM BIẾN KALMAN FILTER]

Chào Sếp! Tôi đã tải thuật toán lọc Kalman khử nhiễu cảm biến nông trại IoT từ CSDL PostgreSQL:

### ⚙️ Các bước ước lượng Kalman Filter:
1. Dự báo trạng thái: $\\hat{x}_{k|k-1} = A \\hat{x}_{k-1|k-1}$
2. Cập nhật ước lượng (Measurement Update):
   $$\\hat{x}_{k|k} = \\hat{x}_{k|k-1} + K_k (z_k - H \\hat{x}_{k|k-1})$$

### 📊 Số liệu thực tế từ Sếp:
*   Giá trị đo nhiễu từ cảm biến: $z_k = {{SENSOR_VAL}}$
*   Giá trị ước lượng trước đó: $\\hat{x}_{k|k-1} = {{EST_VAL}}$
*   Hệ số Kalman Gain: $K_k = {{GAIN}}$

### 🏆 Kết quả ước lượng sau khi khử nhiễu:
*   Giá trị thực tế ước tính tối ưu: {{FINAL_VAL}}
*   Mức độ tin cậy của dữ liệu: {{CONFIDENCE}}%

$$\\boxed{\\hat{x} = {{FINAL_VAL}}}$$`,
        },
        {
          id: "11",
          intent: "SHANNON",
          utterance: "shannon da dang sinh hoc",
          answer: `🌱 [BỘ CHỈ SỐ ĐA DẠNG SINH HỌC SHANNON INDEX]

Chào Sếp! Mô hình sinh thái học Shannon đo lường chất lượng đất đã được tải từ CSDL PostgreSQL:

### ⚙️ Công thức Shannon Index ($H'$):
$$H' = -\\sum_{i=1}^S p_i \\ln p_i$$
*(Với $p_i$ là tỷ lệ cá thể của loài $i$ trong quần xã)*

### 📊 Số liệu phân bổ loài của Sếp:
*   Tổng số loài sinh vật đất: $S = {{SPECIES}}$ loài.
*   Mật độ phân bổ các loài $p_i$: \`{{DISTRIBUTION}}\`

<details style="margin: 12px 0; padding: 12px; border: 1px solid #28a745; border-radius: 8px; background: rgba(40, 167, 69, 0.05);">
  <summary style="font-weight: bold; cursor: pointer; color: #28a745; outline: none; user-select: none;">🌱 Click vào đây để xem đánh giá sinh thái đất chi tiết...</summary>
  <div style="margin-top: 10px; line-height: 1.6;">
    *   Chỉ số Shannon $H' = {{SHANNON_VAL}}$
    *   Đất sinh thái: <output style="font-weight: bold; color: #28a745;">{{ECOLOGY_STATUS}}</output>
  </div>
</details>

$$\\boxed{H' = {{SHANNON_VAL}}}$$`,
        },
      ];

      const combinedTemplates = [
        ...baseTemplates,
        ...curriculumData.map((item, idx) => ({
          id: `edu_${idx}`,
          intent: item.intent,
          utterance: item.utterance,
          answer: item.answer,
        })),
      ];

      await db.insert(agentTraining).values(combinedTemplates);
      console.log("✅ [PostgreSQL] Seeding AgentTraining completed successfully!");

      const { initRAGEngine } = await import("~/core/neural-memory/vector-rag");
      await initRAGEngine(true);
      console.log("✅ [PostgreSQL] RAG Engine reinitialized successfully!");

      // Cache warming — preload hot queries for instant cold-start responses
      const { warmSemanticCache } = await import("~/core/neural-memory/cache-warmer");
      warmSemanticCache();
    } catch (e) {
      console.error("⚡ [AgentTraining] Failed to initialize/seed table:", e);
    }
  })();
}

async function mergeDuplicateProducts() {
  try {
    const allProducts = await db.query.product.findMany({});

    // Group products by sellerId and lowercased name
    const groups: Record<string, any[]> = {};
    for (const p of allProducts) {
      if (!p.sellerId || !p.name) continue;
      const key = `${p.sellerId}_${p.name.trim().toLowerCase()}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(p);
    }

    for (const key of Object.keys(groups)) {
      const list = groups[key];
      if (list.length > 1) {
        const target = list[0];
        let totalQuantity = target.quantity || 0;

        for (let i = 1; i < list.length; i++) {
          totalQuantity += list[i].quantity || 0;
          await db.delete(product).where(eq(product.id, list[i].id));
        }

        await db.update(product).set({ quantity: totalQuantity }).where(eq(product.id, target.id));
      }
    }
    console.log("🔄 [Products] Successfully checked and merged any duplicate products.");
  } catch (err) {
    console.error("❌ Failed to merge duplicate products:", err);
  }
}

async function initializeAgentBudgetsAndAssets() {
  try {
    const agentIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const allUsers = await db.query.user.findMany();
    const dbAgents = allUsers.filter((u: any) => agentIds.includes(u.id));

    for (const u of dbAgents) {
      const prof = (u.profile as any) || {};
      let updated = false;

      if (prof.budget === undefined || prof.budget === 0) {
        prof.budget = 100000000; // 100M VND
        updated = true;
      }
      if (prof.gold === undefined || prof.gold === 0) {
        prof.gold = 10.0; // 10 lượng
        updated = true;
      }
      if (!prof.stocks || Object.keys(prof.stocks).length === 0) {
        prof.stocks = {
          BTC: 10,
          HPG: 200,
          FPT: 100,
          VNM: 150,
        };
        updated = true;
      }

      if (updated) {
        await db.update(user).set({ profile: prof }).where(eq(user.id, u.id));
        console.log(`🌱 [Agent Initializer] Seeded assets for Agent: ${u.id}`);
      }
    }
  } catch (err) {
    console.error("❌ Failed to initialize Agent assets:", err);
  }
}

// Chạy gom sản phẩm trùng lặp và khởi tạo tài sản khi khởi động
if (!globalObj.__dbInitializedProductMerge && !isCloudflare) {
  globalObj.__dbInitializedProductMerge = true;
  (async () => {
    await mergeDuplicateProducts();
    await initializeAgentBudgetsAndAssets();
  })();
}

// --- HỆ THỐNG ĐIỂM TỰA TỪ VỰNG TƯƠNG ĐỒNG & NLP ENGINE (Modularized) ---

export async function deleteFileRecord(fileUrl: string) {
  if (!fileUrl) return;
  try {
    // Check if file is still used by other users or products (Deduplication protection)
    const usedInUser = await db.query.user.findFirst({ where: sql`profile::text LIKE ${"%" + fileUrl + "%"}` });
    const usedInProduct = await db.query.product.findFirst({ where: sql`media::text LIKE ${"%" + fileUrl + "%"}` });

    if (usedInUser || usedInProduct) {
      return; // Skip deletion, someone else is using this file
    }

    const filePath = path.join(process.cwd(), "public", fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.delete(file).where(eq(file.path, fileUrl));
  } catch (e) {
    console.error("Lỗi khi xóa file cũ:", e);
  }
}

import { auth } from "~/server/auth";
import rpcApp from "~/server/rpc/rpc-router";
import { agentApp, initLlama, updateLlamaActivity } from "~/server/api/agent-router";
import { telemetryLogger } from "~/infra/telemetry/telemetry";
import { aiAuthMiddleware, guestRateLimiter } from "~/server/middlewares/auth-guard";

export const rootApp = new Hono();

// --- BẢO MẬT GỐC (SECURITY MIDDLEWARES) ---
rootApp.use(
  "*",
  cors({
    origin: (origin) => {
      const allowedOrigins = ["https://rottra.pages.dev", "http://localhost:5173", "http://localhost:5174", "http://localhost:8080"];
      if (!origin || allowedOrigins.includes(origin)) {
        return origin;
      }
      return "https://rottra.pages.dev";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
  }),
);

rootApp.use("*", secureHeaders());

// In-Memory Rate Limiter đơn giản: Tối đa 100 requests / 1 phút mỗi IP
const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;

// Dọn dẹp map định kỳ (tránh memory leak trên PaaS Render)
if (!isCloudflare) {
  try {
    setInterval(() => {
      const cleanupNow = Date.now();
      for (const [key, val] of rateLimitMap.entries()) {
        if (cleanupNow - val.startTime > RATE_LIMIT_WINDOW_MS) {
          rateLimitMap.delete(key);
        }
      }
    }, 60000); // Mỗi 60 giây dọn rác 1 lần
  } catch (e) {
    console.warn("Failed to start rate limit cleaner interval:", e);
  }
}

rootApp.use("*", async (c, next) => {
  // Lấy IP client (có thể nằm trong headers CF-Connecting-IP, X-Forwarded-For nếu qua Cloudflare)
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown-ip";
  const now = Date.now();

  let limitData = rateLimitMap.get(ip);
  if (!limitData) {
    limitData = { count: 1, startTime: now };
    rateLimitMap.set(ip, limitData);
  } else {
    if (now - limitData.startTime > RATE_LIMIT_WINDOW_MS) {
      // Reset sau 1 phút
      limitData.count = 1;
      limitData.startTime = now;
    } else {
      limitData.count++;
      if (limitData.count > RATE_LIMIT_MAX_REQUESTS) {
        return c.json({ success: false, message: "Too Many Requests - Hệ thống đang phòng thủ Rate Limit. Vui lòng đợi 1 phút." }, 429);
      }
    }
  }

  // Đã chuyển phần dọn rác (GC) sang setInterval để tránh rò rỉ bộ nhớ

  await next();
});
// ------------------------------------------

export const app = new Hono().basePath("/api");

registerAdminRoutes(app);
registerOrderRoutes(app);
registerUserRoutes(app);
registerDrawingRoutes(app);
registerAgentChatRoutes(app);
registerAgentOpsRoutes(app);
registerMediaRoutes(app);

app.onError((err, c) => {
  console.error("Global Unhandled Hono Error:", err);
  return c.json({ error: "Global Hono Error: " + (err.message || err.toString()), stack: err.stack }, 500);
});

let exchangeRateCache: Record<string, number> | null = null;
let exchangeRateLastFetched = 0;

app.get("/exchange-rate", async (c) => {
  const now = Date.now();
  // Cache for 12 hours
  if (!exchangeRateCache || now - exchangeRateLastFetched > 12 * 60 * 60 * 1000) {
    try {
      const [frankfurterRes, pnjRes] = await Promise.all([
        fetch("https://api.frankfurter.dev/v2/rates?base=VND&quotes=USD,EUR,JPY,KRW,CNY,GBP,ILS").catch(() => null),
        fetch("https://vang.today/api/prices").catch(() => null),
      ]);

      const newRates: Record<string, number> = { VND: 1 };

      if (frankfurterRes && frankfurterRes.ok) {
        const data = await frankfurterRes.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.quote && typeof item.rate === "number") {
              newRates[item.quote] = item.rate;
            }
          }
        }
      }

      if (pnjRes && pnjRes.ok) {
        const pnjData = await pnjRes.json();
        if (pnjData && pnjData.prices && pnjData.prices.PQHN24NTT) {
          const buy = pnjData.prices.PQHN24NTT.buy;
          const sell = pnjData.prices.PQHN24NTT.sell;
          // PNJ returns price per Tael (lượng) in VND. We want the rate `1 VND = X Lượng`.
          if (sell) newRates.PNJ_SELL = 1 / sell;
          if (buy) newRates.PNJ_BUY = 1 / buy;
        }
      }

      exchangeRateCache = newRates;
      exchangeRateLastFetched = now;
    } catch (e) {
      console.error("[ExchangeRate] fetch error:", e);
    }
  }
  return c.json({ success: true, rates: exchangeRateCache || {} });
});

export const resolveAgentUserId = async (id: string): Promise<string> => {
  const cleanId = id.replace(/^bot_/, "");
  const possibleIds = [cleanId, `user_${cleanId}`, `user${cleanId}`];
  for (const pid of possibleIds) {
    const u = await db.query.user.findFirst({ where: eq(user.id, pid) });
    if (u) return pid;
  }
  return cleanId; // fallback
};

export const broadcastTradeSync = async () => {
  try {
    const finalProducts = await db.query.product.findMany();
    const allUsers = await db.query.user.findMany();
    const agentIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const dbAgents = allUsers.filter((u: any) => agentIds.includes(u.id));
    const assetsPayload: Record<string, any> = {};
    for (const u of dbAgents) {
      const prof = (u.profile as any) || {};
      const key = u.id.replace(/^user_?/, "");

      const sellerProducts = finalProducts.filter((p: any) => {
        if (p.sellerId !== u.id) return false;
        if ((p.quantity ?? 0) <= 0) return false;
        return true;
      });
      const prod = sellerProducts[0];

      assetsPayload[key] = {
        id: key,
        name: u.name,
        budget: prof.budget ?? serverAgentBudgets[key] ?? 100000000,
        gold: prof.gold !== undefined ? prof.gold : (serverAgentGold[key] ?? 10.0),
        stocks: prof.stocks && Object.keys(prof.stocks).length > 0 ? prof.stocks : { BTC: 10, HPG: 200, FPT: 100, VNM: 150 },
        product: prod ? prod.name : prof.product || "",
        quantity: prod ? prod.quantity || 0 : 0,
        price: prod ? prod.price || 0 : prof.price || 0,
        media: prod ? prod.media : null,
        status: prod ? (prod.status !== undefined && prod.status !== null ? prod.status : true) : true,
        skillLevel: prof.skillLevel,
        skillTitle: prof.skillTitle,
        employees: serverAgentEmployees[key] ?? 5,
        products: sellerProducts.map((p: any) => ({
          name: p.name,
          quantity: p.quantity || 0,
          price: p.price || 0,
          media: p.media,
          status: p.status !== undefined && p.status !== null ? p.status : true,
        })),
      };
    }

    const isNode = typeof process !== "undefined" && process.versions && process.versions.node;
    if (isNode) {
      const wsClient = new WebSocket("ws://127.0.0.1:8080");
      wsClient.on("open", () => {
        wsClient.send(
          JSON.stringify({
            type: "trade-sync",
            assets: assetsPayload,
          }),
        );
        setTimeout(() => wsClient.close(), 100);
      });
      wsClient.on("error", () => {});
    }
  } catch (err) {
    console.error("Failed to broadcast trade sync:", err);
  }
};

// Kích hoạt Telemetry Auto-Logger và Điều tiết Tải cho toàn bộ API endpoints
app.use("*", systemLoadRegulator.getMiddleware());
app.use("*", telemetryLogger);

// Cache-Control headers cho static-like API responses
app.use("/product", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
});
app.use("/seo/*", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=300, stale-while-revalidate=3600");
});
app.use("/gold-price", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=10, stale-while-revalidate=30");
});
// Đăng ký bộ giới hạn Rate Limit cho khách vãng lai và AI Auth Middleware
app.use("/agent/*", guestRateLimiter);
app.use("/agent/*", aiAuthMiddleware);

app.route("/rpc", rpcApp);

// Better Auth Endpoint
app.all("/auth/*", async (c: any) => {
  try {
    return await auth.handler(c.req.raw);
  } catch (err: any) {
    console.error("Auth Handler Error:", err);
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

// Global registry for active WebSocket signaling connections
interface SignalingClient {
  socket: any;
  room: string;
}
const activeSignalingClients: SignalingClient[] = [];

// WebSocket signaling room for WebRTC P2P Mesh on Cloudflare Workers
app.get("/ws-signaling", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const room = c.req.query("room") || "default";

  // Create a WebSocket pair for Cloudflare Workers
  const [client, server] = Object.values(new WebSocketPair()) as [any, any];

  server.accept();

  const clientInfo = { socket: server, room };
  activeSignalingClients.push(clientInfo);

  server.addEventListener("message", (event: any) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "ping") {
        try {
          server.send(JSON.stringify({ type: "pong" }));
        } catch (_) {}
        return;
      }

      const isGlobal = data.type === "trade-sync" || data.type === "global" || data.type === "swarm-telemetry-update" || !room;

      activeSignalingClients.forEach((peer) => {
        if (peer.socket !== server && peer.socket.readyState === 1) {
          // 1 = WebSocket.OPEN
          if (isGlobal || peer.room === room) {
            try {
              peer.socket.send(event.data);
            } catch (_) {}
          }
        }
      });
    } catch (e) {
      activeSignalingClients.forEach((peer) => {
        if (peer.socket !== server && peer.room === room && peer.socket.readyState === 1) {
          try {
            peer.socket.send(event.data);
          } catch (_) {}
        }
      });
    }
  });

  const cleanup = () => {
    const idx = activeSignalingClients.indexOf(clientInfo);
    if (idx !== -1) {
      activeSignalingClients.splice(idx, 1);
    }
  };

  server.addEventListener("close", cleanup);
  server.addEventListener("error", cleanup);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

// --- Device Parser & Activity Logger Helpers ---
const parseDevice = (userAgent?: string) => {
  if (!userAgent) return "Không xác định";
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) return "Máy tính bảng (Tablet)";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Điện thoại (Mobile)";
  return "Máy tính (PC/Laptop)";
};

export const logActivity = async (userId: string | null, action: string, message: string | null, level: string, userAgent?: string) => {
  try {
    const device = parseDevice(userAgent);

    // Classify severity based on action and message patterns
    const act = (action || "").toUpperCase();
    const msg = (message || "").toLowerCase();
    let severityLevel = "1 - Bất tiện";

    if (
      act === "BANKRUPTCY_WARNING" ||
      msg.includes("tồn vong") ||
      msg.includes("phá sản") ||
      msg.includes("hết tiền") ||
      msg.includes("trả lương") ||
      msg.includes("từ chối gia hạn") ||
      msg.includes("chỉ còn tiền mặt")
    ) {
      severityLevel = "7 - Tồn vong";
    } else if (
      msg.includes("thảm họa cực đại") ||
      msg.includes("khóa tài khoản") ||
      msg.includes("ngừng hợp tác") ||
      act === "INFLATION_SHOCK" ||
      msg.includes("lạm phát") ||
      msg.includes("bão giá")
    ) {
      severityLevel = "6 - Thảm họa cực đại";
    } else if (
      msg.includes("cháy kho") ||
      msg.includes("kho cháy") ||
      msg.includes("mất 70%") ||
      msg.includes("thất thoát 70%") ||
      act === "CROP_FAILURE" ||
      msg.includes("mất mùa") ||
      msg.includes("thiên tai")
    ) {
      severityLevel = "5 - Thảm họa";
    } else if (
      msg.includes("giảm giá sâu") ||
      msg.includes("đối thủ") ||
      msg.includes("phá giá") ||
      msg.includes("cạnh tranh") ||
      act.includes("SABOTAGE") ||
      act === "COMPETITION_SHOCK"
    ) {
      severityLevel = "4 - Khủng hoảng";
    } else if (
      msg.includes("giao trễ") ||
      msg.includes("trễ hạn") ||
      msg.includes("sự cố vận chuyển") ||
      msg.includes("vận chuyển gặp sự cố") ||
      act === "LOGISTICS_BLOCKADE"
    ) {
      severityLevel = "3 - Nghiêm trọng";
    } else if (msg.includes("hết hàng") || msg.includes("cháy hàng") || msg.includes("hết hàng trong 2 ngày") || act === "OUT_OF_STOCK") {
      severityLevel = "2 - Vấn đề";
    }

    await db.insert(activity).values({
      id: crypto.randomUUID(),
      userId,
      action,
      message,
      level: severityLevel,
      device,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

// --- Auth Middleware ---
const verifyAuth = async (c: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ success: false, reason: "Unauthorized" }, 401);
    }

    // Fetch full user from DB to ensure we have custom fields like 'role'
    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
    });

    if (dbUser?.profile && (dbUser.profile as any).banned) {
      return c.json({ success: false, reason: "Banned", message: "Tài khoản của bạn đã bị khóa." }, 403);
    }

    c.set("user", dbUser || session.user);
    await next();
  } catch (e: any) {
    console.error("verifyAuth Error:", e);
    return c.json({ error: "Auth verification failed", details: e.message }, 500);
  }
};

const getActivityStats = async (userId: string) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const userActivities = await db
      .select()
      .from(activity)
      .where(and(eq(activity.userId, userId), sql`${activity.timestamp} >= ${sevenDaysAgo.toISOString()}`));
    const daysList = [];
    const counts: Record<string, number> = {};
    const baselines = [8, 12, 15, 18, 25, 30, 20];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      daysList.push(dayStr);
      counts[dayStr] = baselines[6 - i];
    }
    for (const act of userActivities) {
      if (act.timestamp) {
        const date = new Date(act.timestamp);
        const dayStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (counts[dayStr] !== undefined) {
          counts[dayStr]++;
        }
      }
    }
    return daysList.map((day) => ({
      label: day,
      value: counts[day],
    }));
  } catch (error) {
    console.error("Error calculating activity stats:", error);
    const daysList = [];
    const baselines = [8, 12, 15, 18, 25, 30, 20];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      daysList.push({ label: dayStr, value: baselines[6 - i] });
    }
    return daysList;
  }
};

const serverDefaultProducts: Record<string, { product: string; quantity: number; price: number }> = {
  toLuong: { product: "Sâm Ngọc Linh Kon Tum 🌿", quantity: 50, price: 4500000 },
  thuongNguyet: { product: "Hạt điều rang muối Bình Phước 🥜", quantity: 100, price: 180000 },
  tramTinh: { product: "Cà phê Robusta Buôn Ma Thuột ☕", quantity: 300, price: 150000 },
  daoTieuCuu: { product: "Hạt tiêu đen Phú Quốc 🌶️", quantity: 150, price: 120000 },
  hoaHuynh: { product: "Chè Thái Nguyên thượng hạng 🍵", quantity: 80, price: 300000 },
  phiNguyet: { product: "Gạo tám thơm Điện Biên 🌾", quantity: 1000, price: 25000 },
  nhuNguyet: { product: "Tỏi cô đơn Lý Sơn 🧄", quantity: 50, price: 350000 },
  suGia: { product: "Măng khô Tây Bắc 🎋", quantity: 120, price: 280000 },
  phiAnh: { product: "Bơ sáp Đắk Lắk 🥑", quantity: 500, price: 35000 },
  bachDiHanh: { product: "Mật ong rừng Tràm 🔥", quantity: 200, price: 250000 },
  uVuongMau: { product: "Chè Shan Tuyết cổ thụ 🍃", quantity: 80, price: 1200000 },
  bachLoc: { product: "Nấm lim xanh Quảng Nam 🍄", quantity: 40, price: 3200000 },
};

const serverAgentSkills: Record<string, { level: number; name: string; color: string }> = {
  toLuong: { level: 9, name: "Lão luyện", color: "#fbbf24" },
  thuongNguyet: { level: 8, name: "Khéo léo", color: "#facc15" },
  tramTinh: { level: 5, name: "Bình thường", color: "#9ca3af" },
  daoTieuCuu: { level: 10, name: "Thần thương lượng", color: "#fb7185" },
  hoaHuynh: { level: 8, name: "Cứng rắn", color: "#fb923c" },
  phiNguyet: { level: 7, name: "Khá", color: "#60a5fa" },
  nhuNguyet: { level: 6, name: "Trung bình", color: "#94a3b8" },
  suGia: { level: 6, name: "Trung bình", color: "#94a3b8" },
  phiAnh: { level: 5, name: "Bình thường", color: "#9ca3af" },
  bachDiHanh: { level: 4, name: "Nhút nhát", color: "#f87171" },
  uVuongMau: { level: 7, name: "Xảo quyệt", color: "#c084fc" },
  bachLoc: { level: 4, name: "Dễ tin người", color: "#f87171" },
};

export async function getEnrichedProfile(dbUser: any) {
  const profile = { ...(dbUser?.profile || {}) };
  const isAgent = [
    "toLuong",
    "thuongNguyet",
    "tramTinh",
    "daoTieuCuu",
    "hoaHuynh",
    "phiNguyet",
    "nhuNguyet",
    "suGia",
    "phiAnh",
    "bachDiHanh",
    "uVuongMau",
    "bachLoc",
  ].includes(dbUser?.id);

  if (isAgent) {
    const key = dbUser.id.replace(/^user_?/, "");
    const defaultProd = serverDefaultProducts[dbUser.id];
    const defaultSkill = serverAgentSkills[key];

    const allProducts = await db.query.product.findMany({
      where: eq(product.sellerId, dbUser.id),
    });
    const sellerProducts = allProducts.filter((prod: any) => {
      if (!prod.expired) return true;
      if (prod.expired.trim() === "") return true;
      const parsed = Date.parse(prod.expired);
      return !isNaN(parsed);
    });
    const agentProduct = sellerProducts[0];

    profile.budget = profile.budget !== undefined ? profile.budget : serverAgentBudgets[dbUser.id] || 0;
    profile.gold = profile.gold !== undefined ? profile.gold : (serverAgentGold[dbUser.id] ?? 0.0);
    profile.employees = serverAgentEmployees[key] ?? 5;
    profile.product = agentProduct ? agentProduct.name : profile.product || defaultProd?.product || "";
    profile.quantity = agentProduct ? agentProduct.quantity || 0 : profile.quantity || defaultProd?.quantity || 0;
    profile.price = agentProduct ? agentProduct.price || 0 : profile.price || defaultProd?.price || 0;
    profile.skillLevel = profile.skillLevel !== undefined ? profile.skillLevel : defaultSkill?.level || 0;
    profile.skillTitle = getDynamicSkillTitle(dbUser.id, profile.skillLevel);
    profile.loanParams = agentLoanParametersMap[key] || {
      baseIncome: 25000000,
      pDefault: 0.1,
      behaviorScore: 1.0,
      creditHistoryFactor: 1.0,
      policyApproval: 1.0,
      macroAdjustment: 1.0,
    };
    profile.loanAmount = calculateAgentLoanAmount(dbUser.id);
  } else if (dbUser?.id === "RottraAI" || dbUser?.id === "RottraAI") {
    const loreIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    let totalBudget = 30000000;
    let totalGold = 5.0;
    const aggregatedStocks: Record<string, number> = {};

    for (const id of loreIds) {
      const uRecord = await db.query.user.findFirst({
        where: eq(user.id, id),
      });
      const prof = (uRecord?.profile as any) || {};
      const bVal = prof.budget !== undefined && prof.budget !== null ? prof.budget : serverAgentBudgets[id] || 0;
      const gVal = prof.gold !== undefined && prof.gold !== null ? prof.gold : serverAgentGold[id] || 0;
      let sVal = prof.stocks;
      if (!sVal || Object.keys(sVal).length === 0) {
        sVal = { BTC: 10, HPG: 200, FPT: 100, VNM: 150 };
      }

      totalBudget += Number(bVal);
      totalGold += Number(gVal);
      Object.entries(sVal).forEach(([symbol, qty]) => {
        aggregatedStocks[symbol] = (aggregatedStocks[symbol] || 0) + Number(qty);
      });
    }

    profile.budget = totalBudget;
    profile.gold = totalGold;
    profile.stocks = aggregatedStocks;
  } else if (dbUser?.role === "admin") {
    profile.budget = profile.budget !== undefined && profile.budget !== null ? profile.budget : 0;
    profile.gold = profile.gold !== undefined && profile.gold !== null ? profile.gold : 0;
    profile.stocks = profile.stocks && Object.keys(profile.stocks).length > 0 ? profile.stocks : { BTC: 0, HPG: 0, FPT: 0, VNM: 0 };
  }

  return {
    ...profile,
    fullName: profile.fullName || dbUser?.name,
    email: dbUser?.email,
    id: dbUser?.id,
    role: dbUser?.role,
    activityStats: await getActivityStats(dbUser.id),
  };
}

function getEnrichedProfileInMemory(dbUser: any, sellerProducts: any[]) {
  const profile = { ...(dbUser?.profile || {}) };
  const key = dbUser?.id?.replace(/^user_?/, "") || "";
  const defaultProd = serverDefaultProducts[dbUser?.id || ""];
  const defaultSkill = serverAgentSkills[key];

  const activeProducts = sellerProducts.filter((prod: any) => {
    if (!prod.expired) return true;
    if (prod.expired.trim() === "") return true;
    const parsed = Date.parse(prod.expired);
    return !isNaN(parsed);
  });
  const agentProduct = activeProducts[0];

  profile.budget = profile.budget !== undefined ? profile.budget : serverAgentBudgets[dbUser?.id] || 0;
  profile.gold = profile.gold !== undefined ? profile.gold : (serverAgentGold[dbUser?.id] ?? 0.0);
  profile.employees = serverAgentEmployees[key] ?? 5;
  profile.product = agentProduct ? agentProduct.name : profile.product || defaultProd?.product || "";
  profile.quantity = agentProduct ? agentProduct.quantity || 0 : profile.quantity || defaultProd?.quantity || 0;
  profile.price = agentProduct ? agentProduct.price || 0 : profile.price || defaultProd?.price || 0;
  profile.skillLevel = profile.skillLevel !== undefined ? profile.skillLevel : defaultSkill?.level || 0;
  profile.skillTitle = getDynamicSkillTitle(dbUser?.id || "", profile.skillLevel);
  profile.loanParams = agentLoanParametersMap[key] || {
    baseIncome: 25000000,
    pDefault: 0.1,
    behaviorScore: 1.0,
    creditHistoryFactor: 1.0,
    policyApproval: 1.0,
    macroAdjustment: 1.0,
  };
  profile.loanAmount = calculateAgentLoanAmount(dbUser?.id || "");

  return {
    ...profile,
    fullName: profile.fullName || dbUser?.name,
    id: dbUser?.id,
    role: dbUser?.role,
  };
}

// --- File Upload ---

app.post("/notify-log", async (c: any) => {
  try {
    const body = await c.req.json();
    const { state, message, userId } = body;
    const logLine = `[${new Date().toISOString()}] User: ${userId || "Guest"} | State: ${state} | Message: ${message || ""}\n`;
    const logPath = path.join(process.cwd(), "notifications.log");

    // Use fs.promises.appendFile to append the log
    await fs.promises.appendFile(logPath, logLine, "utf-8");

    return c.json({ success: true });
  } catch (err: any) {
    console.error("Lỗi ghi log notify:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

import { execSync } from "node:child_process";

app.post("/agent/compile-typst", async (c: any) => {
  try {
    const { code } = await c.req.json();
    if (!code) {
      return c.json({ success: false, error: "No Typst code provided" }, 400);
    }

    const id = Math.random().toString(36).substring(7);
    const tempTypPath = `scratch/temp_${id}.typ`;
    const tempSvgPath = `scratch/temp_${id}.svg`;

    await fs.promises.mkdir("scratch", { recursive: true });
    await fs.promises.writeFile(tempTypPath, code, "utf-8");

    try {
      execSync(`bun x typst compile ${tempTypPath} ${tempSvgPath}`);
      const svgContent = await fs.promises.readFile(tempSvgPath, "utf-8");
      return c.json({ success: true, svg: svgContent });
    } catch (e: any) {
      console.error("Typst compile error:", e.message);
      return c.json({ success: false, error: e.message || "Typst compilation failed" });
    } finally {
      try {
        await fs.promises.unlink(tempTypPath);
        await fs.promises.unlink(tempSvgPath);
      } catch {}
    }
  } catch (err: any) {
    console.error("Typst endpoint error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

import { ledgerApp } from "~/server/api/trade-ledger";
import { chatApp } from "~/server/api/chat-stream";
import { mediaApp } from "~/server/api/agent-media";
import { musicApp } from "~/server/api/agent-music";
import { evaluationApp } from "~/server/api/evaluation-api";
import { mlPipelineApp } from "~/server/api/ml-pipeline";

app.route("/evaluation", evaluationApp);
app.route("/ledger", ledgerApp);
app.route("/chat", chatApp);
app.route("/agent", agentApp);
app.route("/media", mediaApp);
app.route("/music", musicApp);
app.route("/ml-pipeline", mlPipelineApp);

// Static asset cache headers
rootApp.use("/assets/*", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=31536000, immutable");
});
rootApp.use("/*.js", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=31536000, immutable");
});
rootApp.use("/*.css", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=31536000, immutable");
});
rootApp.use("/images/*", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=86400");
});
rootApp.use("/fonts/*", async (c, next) => {
  await next();
  c.header("cache-control", "public, max-age=604800");
});

rootApp.route("/", app);

export default rootApp;
