import { Deterministic } from "~/shared/utils/rng";
import { handleAgentChat } from "~/orchestration/chat-coordinator";
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
import { getAgentContext, createAgentBrainEvaluator } from "~/core/cognitive-swarm/utility-ai";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import { triggerRandomMacroEvent, getActiveMacroEvent } from "~/core/cognitive-swarm/macro-events";
import { executeMCPTool } from "~/core/cognitive-swarm/mcp-server";
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
const execAsync = promisify(execCallback);
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { recognize } from "~/core/nlp-cognitive/recognizer";
import { RottraPrivateBrain, filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import { generatePlan, executePlanWithReplanner, treeOfThoughtsReasoning } from "~/core/nlp-cognitive/planner";
import { VietlexClient } from "~/core/cognitive-swarm/vietlex-client";
import { currentGoldPrice } from "~/server/api/agent-router";
import { systemLoadRegulator } from "~/server/helpers/system-load-regulator";
import { visionBrain } from "~/core/nlp-cognitive/vision-brain";

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

      if (file.startsWith("output_") && (file.endsWith(".mp4") || file.endsWith(".webm"))) {
        // Preserved defaults/seeds or referenced videos
        if (file.includes("seed") || file.includes("test") || file.includes("draft") || file.includes("dummy")) {
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

const isCloudflare = typeof globalThis.caches !== "undefined" || (typeof process !== "undefined" && process.env.CF_PAGES === "1");

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

      if (prof.budget === undefined) {
        prof.budget = 0;
        updated = true;
      }
      if (prof.gold === undefined) {
        prof.gold = 0;
        updated = true;
      }
      if (!prof.stocks) {
        prof.stocks = {};
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

async function deleteFileRecord(fileUrl: string) {
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
import { agentApp, initLlama, updateLlamaActivity, S_FORMULA_K, S_FORMULA_X0 } from "~/server/api/agent-router";
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

import { resolveAgentUserId } from "~/routes/api/[...paths]";
import { calculateEntropy, calculateConfidence, cleanWordsLocal, compressScore } from "~/core/metrics";

export const handleMeetingChat = async (c: any) => {
  try {
    const { getEnrichedProfile, logActivity, broadcastTradeSync } = await import("~/routes/api/[...paths]");
    const {
      botId,
      botName,
      chatHistory,
      budget,
      quantity,
      price,
      product: prodName,
      skillLevel,
      skillTitle,
      isLeader,
      isTradingActive,
    } = await c.req.json();
    if (!botId) return c.json({ success: false, error: "Missing botId" }, 400);

    if (chatHistory && chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      const lastSenderId = lastMsg.senderId || "";
      if (lastSenderId === `bot_${botId}` || lastSenderId === botId) {
        return c.json({ success: true, text: "" });
      }
    }

    const userId = await resolveAgentUserId(botId);
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
    const profileData = (dbUser?.profile as any) || {};
    const journal: any[] = profileData.journal || [];

    // Format the journal logs briefly for system prompt context
    let journalContext = "";
    if (journal.length > 0) {
      journalContext =
        "\n[NHẬT KÝ CHIẾN LƯỢC & DỰ ĐOÁN GẦN ĐÂY]:\n" +
        journal
          .slice(0, 4)
          .map((j: any) => `- [${(j.type || "INFO").toUpperCase()}] ${j.title || "Nhật ký"}: ${j.content || j.summary || ""}`)
          .join("\n");
    }

    const key = botId.replace(/^user_?/, "");
    const enriched = dbUser ? await getEnrichedProfile(dbUser) : null;
    const gold = enriched?.gold ?? 0;
    const loanAmount = enriched?.loanAmount ?? 0;
    const loanParams = enriched?.loanParams;

    const brainParams = RottraPrivateBrain.getParameters();
    const entropyFactor = Math.sin((brainParams.temp || 45) / 10) * 0.15;
    const baseGoldPrice = 10000000;
    const goldPrice = Math.round(baseGoldPrice * (1 + entropyFactor));

    // Build the agent state context block
    let stateContext = "";
    if (budget !== undefined) {
      stateContext = `\n[TÌNH HÌNH THƯƠNG MẠI HIỆN TẠI CỦA BẠN]:
- Mặt hàng đang bán: '${prodName}' với giá ${price?.toLocaleString()}đ/đv (Số lượng tồn kho: ${quantity} đv).
- Ngân quỹ tài chính: ${budget?.toLocaleString()}đ.
- Dự trữ vàng của bạn: ${gold.toFixed(2)} lượng.
- Giá vàng hệ thống hiện tại: ${goldPrice.toLocaleString()}đ/lượng.
- Tín dụng vay vốn tối đa (AI Loan Limit): ${loanAmount.toLocaleString()}đ.
- Chỉ số tín nhiệm: P(Nợ xấu) = ${(loanParams?.pDefault ? loanParams.pDefault * 100 : 10).toFixed(0)}%, Điểm hành vi = x${loanParams?.behaviorScore ?? 1.0}, Hệ số lịch sử = x${loanParams?.creditHistoryFactor ?? 1.0}.
- Cấp độ đàm phán: ${skillTitle || "Trung bình"} (Cấp ${skillLevel || 5}).
- Vai trò thị trường: ${isLeader ? "Bạn đang là TRƯỞNG BAN QUẢN LÝ (Leader) tối cao!" : "Bạn là thương nhân thành viên."}

[HƯỚNG DẪN TỰ QUYẾT ĐỊNH VAY/CHO VAY VÀNG]:
- Bạn có quyền tự quyết định tham gia giao dịch vay vàng từ người dùng hoặc cho người dùng vay vàng của bạn.
- Hãy dựa vào các yếu tố: Giá vàng hiện tại, Dự trữ vàng của bạn, Ngân quỹ tài chính của bạn, và đối tượng giao dịch để tính toán lợi ích kinh tế lớn nhất.
- Nếu đồng ý giao dịch vay/cho vay vàng, hãy trả lời tự nhiên kèm theo một trong các thẻ lệnh hành động sau đây ở cuối câu trả lời:
  + Đồng ý vay vàng từ người dùng: Thêm thẻ lệnh \`[ĐỒNG Ý VAY VÀNG: X lượng]\` (X là số lượng vàng bạn muốn vay).
  + Đồng ý cho người dùng vay vàng của bạn: Thêm thẻ lệnh \`[ĐỒNG Ý CHO VAY VÀNG: X lượng]\` (X là số lượng vàng bạn cho vay).
- Lưu ý: Không được lạm dụng hoặc vay/cho vay vượt quá hạn mức hoặc dự trữ khả dụng.`;
    }

    // Fetch Predatory Assortment
    let customerRole = "user";
    if (chatHistory && chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      const senderId = lastMsg.senderId || "";
      if (senderId === "admin" || senderId === "system" || senderId.startsWith("admin_")) {
        customerRole = "admin";
      } else if (senderId.startsWith("bot_") || senderId.startsWith("agent_")) {
        customerRole = "agent";
      }
    }

    let agentGreed = 0.5;
    let agentVengeance = 0.5;
    let agentMalice = 0.5;
    let agentMemoryId: string | null = null;
    let agentMemoryData: any = null;
    try {
      const dbMemory = await db.query.agentMemory.findFirst({
        where: and(eq(agentMemory.sessionId, botId), eq(agentMemory.contextKey, "personality_dna")),
      });
      if (dbMemory) {
        agentMemoryId = dbMemory.id;
        agentMemoryData = typeof dbMemory.contextValue === "string" ? JSON.parse(dbMemory.contextValue) : dbMemory.contextValue;
        agentGreed = Number(dbMemory.greed ?? 0.5);
        agentVengeance = Number(dbMemory.vengeance ?? 0.5);
        agentMalice = Number(dbMemory.malice ?? 0.5);
      }
    } catch (err) {
      console.warn("Failed to retrieve agent memory for DNA:", err);
    }

    let predatoryContext = "";
    try {
      const predatoryProducts = await getPredatoryProductsForAgent(botId, customerRole, agentMemoryData);
      if (predatoryProducts && predatoryProducts.length > 0) {
        predatoryContext = "\n[DANH SÁCH SẢN PHẨM PHỄU TRỐN / ĐỊNH HƯỚNG TẤN CÔNG (PREDATORY ASSORTMENT)]:\n";
        predatoryProducts.forEach((p: any, idx: number) => {
          const typeStr = p.isDecoy
            ? "[MỒI NHỬ - DECOY]"
            : idx === 0 && predatoryProducts.length === 2
              ? "[TƯƠNG PHẢN - CONTRAST (GIÁ THẤP)]"
              : "[VIP / CHỦ LỰC]";
          predatoryContext += `- ${typeStr} '${p.name}' | Giá: ${p.price?.toLocaleString()}đ | Giá gốc/Vốn: ${p.costPrice?.toLocaleString()}đ | Tồn kho: ${p.quantity} đv\n`;
        });
        predatoryContext += `\n[MỆNH LỆNH CHIẾN THUẬT]: Bạn phải hướng cuộc đàm phán tập trung vào sản phẩm này, sử dụng chiến thuật tương phản, mồi nhử hoặc bán chéo hệ sinh thái để ép khách hàng chốt đơn hàng có lợi nhất cho bạn!\n`;
      }
    } catch (err) {
      console.warn("Failed to fetch predatory products:", err);
    }

    // Parse commands/directives from the latest message in the chat history
    let commandText = "";
    let phiPriceVal = 0;
    let accuracyScore = 0.5;
    let lastMsgText = "";
    if (chatHistory && chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      lastMsgText = lastMsg.text || lastMsg.content || lastMsg.message || "";
      const textLower = typeof lastMsgText === "string" ? lastMsgText.toLowerCase() : "";
      const botNameLower = botName.toLowerCase();
      const botIdLower = botId.toLowerCase();

      // Check if this bot is the target of the message
      const isTargeted =
        textLower.includes(botNameLower) ||
        textLower.includes(botIdLower) ||
        textLower.includes("tất cả") ||
        textLower.includes("mọi người") ||
        textLower.includes("các agent") ||
        textLower.includes("mọi agent");

      // Prevent bot trade reports/system logs from triggering commands or bargaining updates
      const isFromBot = lastMsg.senderId && (lastMsg.senderId.startsWith("bot_") || lastMsg.senderId === "system");

      if (isTargeted && !isFromBot) {
        // Find product for this bot matching the mention in the message, fallback to the first product
        const userId = await resolveAgentUserId(botId);
        const sellerProducts = await db.query.product.findMany({
          where: eq(product.sellerId, userId),
        });
        let dbProduct = sellerProducts[0];
        for (const p of sellerProducts) {
          const cleanProdName = p.name.replace(/\s*\(Lô\s*\d+\)/i, "").trim();
          if (textLower.includes(p.name.toLowerCase()) || textLower.includes(cleanProdName.toLowerCase())) {
            dbProduct = p;
            break;
          }
        }

        accuracyScore = 0.5;
        phiPriceVal = 0;
        let muLogic = 1.0;
        let systemEntropy = 1.0;

        if (dbProduct) {
          // Fetch whiteboard drawing accuracy
          try {
            const cached = await db.execute(sql`
              SELECT points FROM "AiDrawingPath" WHERE "productName" = ${dbProduct.name}
            `);
            if (cached && cached.rows && cached.rows.length > 0) {
              const pts = cached.rows[0].points;
              if (Array.isArray(pts) && pts.length > 0) {
                const result = await recognize(pts);
                if (result && typeof result.score === "number") {
                  accuracyScore = result.score;
                }
              }
            }
          } catch (err) {
            console.warn("Failed to get drawing accuracy for product in bargain:", err);
          }

          // Calculate Phi_Price pricing formula
          const floorPrice = dbProduct.price ? Math.round(dbProduct.price * 0.65) : 50000;
          const brainParams = RottraPrivateBrain.getParameters();

          const pTemp = (brainParams.temp || 45) / 100;
          const pRam = (brainParams.ram || 48) / 100;
          const pBat = (100 - (brainParams.battery || 95)) / 100;
          const sumParams = pTemp + pRam + pBat + 0.1;
          systemEntropy = -(
            (pTemp / sumParams) * Math.log2(pTemp / sumParams) +
            (pRam / sumParams) * Math.log2(pRam / sumParams) +
            (pBat / sumParams) * Math.log2(pBat / sumParams)
          );
          if (isNaN(systemEntropy) || !isFinite(systemEntropy)) {
            systemEntropy = 1.0;
          }

          const deltaVPain = Math.round(floorPrice * 0.15 * systemEntropy);
          const aNeo = 1.25 + 0.25 * (brainParams.expertConfidence || 0.98);
          const fomo = (brainParams.bayesPrior || 0.15) * 1.5;
          muLogic = 1.0 + (1.0 - accuracyScore) * 0.45;

          const phiPriceRaw = (floorPrice + deltaVPain) * ((aNeo * Math.exp(fomo)) / muLogic);
          const charmEpsilon = (Math.round(phiPriceRaw) % 1000) - 900;
          phiPriceVal = Math.round(Math.max(floorPrice, phiPriceRaw - charmEpsilon));

          let updatedFields: any = {};
          let parsedDesc = "";

          // Check if it is a bargain attempt
          const isBargainAttempt =
            textLower.includes("mặc cả") ||
            textLower.includes("trả giá") ||
            textLower.includes("giảm giá") ||
            textLower.includes("bớt") ||
            textLower.includes("chiết khấu") ||
            textLower.includes("thương lượng");

          const hasCommandKeyword =
            textLower.includes("đổi giá") ||
            textLower.includes("set giá") ||
            textLower.includes("cập nhật giá") ||
            textLower.includes("đặt giá") ||
            textLower.includes("chỉnh giá") ||
            textLower.includes("hạ giá") ||
            textLower.includes("tăng giá") ||
            textLower.includes("sửa giá") ||
            textLower.includes("số lượng") ||
            textLower.includes("kho") ||
            textLower.includes("tồn kho") ||
            textLower.includes("tên") ||
            textLower.includes("cấm bán") ||
            textLower.includes("đóng cửa") ||
            textLower.includes("dừng bán") ||
            textLower.includes("ẩn") ||
            textLower.includes("cho bán") ||
            textLower.includes("mở cửa") ||
            textLower.includes("bán lại") ||
            textLower.includes("hiện");

          const algoRes = solveCustomAlgorithm(lastMsgText);
          const mathRes = evaluateMathExpression(lastMsgText);

          if (algoRes.success && algoRes.text) {
            const greetings: Record<string, string> = {
              toLuong: "Ta là Tô Lượng. Ta đã ra lệnh cho hệ thống tính toán chuẩn xác cho các vị:\n\n",
              thuongNguyet: "Lão phu xin gửi hiền hữu kết quả tính toán chi tiết:\n\n",
              tramTinh: "Trầm Tĩnh xin gửi đến bạn kết quả tính toán từ các vì tinh tú:\n\n",
              daoTieuCuu: "Tiểu Cửu đã tính xong rồi nè sếp ơi, xem kết quả nhé:\n\n",
              hoaHuynh: "Hỏa Huỳnh Vương ta tính nhanh gọn lẹ cho các vị đây:\n\n",
              phiNguyet: "Phi Nguyệt xin gửi mọi người kết quả tính toán chi tiết ạ:\n\n",
              nhuNguyet: "Như Nguyệt đã trích xuất kết quả tính toán kỹ thuật từ Rottra Core:\n\n",
              suGia: "Sứ giả Nguyệt Thần Cung truyền đạt kết quả tính toán cho các vị:\n\n",
              phiAnh: "Phi Anh đã giải xong cho sếp rồi nè, siêu nhanh luôn nha:\n\n",
              bachDiHanh: "Bạch Di Hành tôi đã tính toán kỹ lưỡng, xin gửi các vị:\n\n",
              uVuongMau: "Ta (U Vương Mẫu) đã đúc kết kết quả tính toán mật pháp này:\n\n",
              bachLoc: "Bạch Lộc gửi mọi người kết quả tính toán thanh khiết:\n\n",
            };
            const greet = greetings[botId] || `Tôi đã tính toán xong thuật toán cho bạn:\n\n`;
            return c.json({
              success: true,
              text: greet + algoRes.text,
            });
          }

          if (mathRes.success && mathRes.text) {
            const greetings: Record<string, string> = {
              toLuong: "Ta là Tô Lượng. Ta đã ra lệnh cho hệ thống tính toán chuẩn xác cho các vị:\n\n",
              thuongNguyet: "Lão phu xin gửi hiền hữu kết quả tính toán chi tiết:\n\n",
              tramTinh: "Trầm Tĩnh xin gửi đến bạn kết quả tính toán từ các vì tinh tú:\n\n",
              daoTieuCuu: "Tiểu Cửu đã tính xong rồi nè sếp ơi, xem kết quả nhé:\n\n",
              hoaHuynh: "Hỏa Huỳnh Vương ta tính nhanh gọn lẹ cho các vị đây:\n\n",
              phiNguyet: "Phi Nguyệt xin gửi mọi người kết quả tính toán chi tiết ạ:\n\n",
              nhuNguyet: "Như Nguyệt đã trích xuất kết quả tính toán kỹ thuật từ Rottra Core:\n\n",
              suGia: "Sứ giả Nguyệt Thần Cung truyền đạt kết quả tính toán cho các vị:\n\n",
              phiAnh: "Phi Anh đã giải xong cho sếp rồi nè, siêu nhanh luôn nha:\n\n",
              bachDiHanh: "Bạch Di Hành tôi đã tính toán kỹ lưỡng, xin gửi các vị:\n\n",
              uVuongMau: "Ta (U Vương Mẫu) đã đúc kết kết quả tính toán mật pháp này:\n\n",
              bachLoc: "Bạch Lộc gửi mọi người kết quả tính toán thanh khiết:\n\n",
            };
            const greet = greetings[botId] || `Tôi đã tính toán xong phép toán cho bạn:\n\n`;
            return c.json({
              success: true,
              text: greet + mathRes.text,
            });
          }

          if (isBargainAttempt) {
            const priceMatch =
              lastMsgText.match(/(?:giá|xuống|lên|còn|thành|mức|bớt|mặc cả)\s+(\d+(?:\.\d+)?)\s*(?:k|đ|đồng|₫)?/i) ||
              lastMsgText.match(/(\d+)\s*(?:k|đ|đồng|₫)\b/i);
            if (priceMatch) {
              let val = parseFloat(priceMatch[1]);
              if (priceMatch[0].toLowerCase().includes("k") || lastMsgText.toLowerCase().includes(priceMatch[1] + "k")) {
                val = val * 1000;
              }
              const proposedPrice = Math.round(val);
              if (proposedPrice >= 1000) {
                commandText = `\n[MẶC CẢ THƯƠNG LƯỢNG]: Người dùng ${lastMsg.sender || "Người họp"} đang muốn mặc cả/trả giá sản phẩm '${dbProduct.name}' của bạn xuống mức ${proposedPrice.toLocaleString()}₫ (Giá hiện tại của bạn là ${dbProduct.price?.toLocaleString()}₫).
Dựa trên Siêu công thức định giá Thao túng Φ_Price:
- Độ chính xác nét vẽ nông sản hiện tại: ${(accuracyScore * 100).toFixed(1)}% (Từ whiteboard).
- Logic Constraint Factor μ_logic: ${muLogic.toFixed(3)}.
- Internal System Entropy: ${systemEntropy.toFixed(3)} bits.
- Giá trị đàm phán tối thiểu chấp nhận được Φ_Price: ${phiPriceVal.toLocaleString()}₫.
- Mức trả giá đề xuất của người dùng: ${proposedPrice.toLocaleString()}₫.

Quy tắc quyết định:
- Nếu mức trả giá của đối phương (${proposedPrice}₫) THẤP HƠN Φ_Price (${phiPriceVal}₫), bạn BẮT BUỘC phải TỪ CHỐI mặc cả này đanh thép. Trả lời bắt đầu bằng cụm từ chính xác: '[TỪ CHỐI MẶC CẢ]' và sỉ nhục/chê bai đối phương hoặc giải thích lý do không giảm giá sâu được.
- Nếu mức trả giá của đối phương (${proposedPrice}₫) LỚN HƠN HOẶC BẰNG Φ_Price (${phiPriceVal}₫), bạn có thể ĐỒNG Ý. Trả lời bắt đầu bằng cụm từ chính xác: '[ĐỒNG Ý MẶC CẢ]'.`;
              }
            }
          } else if (hasCommandKeyword) {
            // 1. Parse PRICE updates
            const priceMatch =
              lastMsgText.match(/(?:giá|bán|giá bán|thành|xuống|lên)\s+(\d+(?:\.\d+)?)\s*(?:k|đ|đồng|₫)?/i) ||
              lastMsgText.match(/(\d+)\s*(?:k|đ|đồng|₫)\b/i);
            if (priceMatch) {
              let val = parseFloat(priceMatch[1]);
              if (priceMatch[0].toLowerCase().includes("k") || lastMsgText.toLowerCase().includes(priceMatch[1] + "k")) {
                val = val * 1000;
              }
              if (val >= 1000) {
                updatedFields.price = Math.round(val);
                parsedDesc += `đổi giá bán thành ${updatedFields.price.toLocaleString()}₫`;
              }
            }

            // 2. Parse QUANTITY updates
            const qtyMatch = lastMsgText.match(/(?:số lượng|kho|tồn kho|thành|lên|xuống)\s+(\d+)\b/i);
            if (qtyMatch) {
              const val = parseInt(qtyMatch[1]);
              if (val >= 0 && val <= 100000) {
                updatedFields.quantity = val;
                if (parsedDesc) parsedDesc += ", ";
                parsedDesc += `cập nhật số lượng kho thành ${val} đv`;
              }
            }

            // 3. Parse NAME updates
            const nameMatch = lastMsgText.match(/(?:đổi tên thành|tên thành|sản phẩm thành|mặt hàng thành)\s+([^,.\n]+)/i);
            if (nameMatch && nameMatch[1]) {
              const newName = nameMatch[1].trim();
              if (newName.length > 2 && newName.length < 100) {
                updatedFields.name = newName;
                if (parsedDesc) parsedDesc += ", ";
                parsedDesc += `đổi tên sản phẩm thành '${newName}'`;

                const newImg = await getPreciseImageForProduct(newName, dbProduct.category || "Nông sản");
                updatedFields.media = [{ link: newImg, name: newName, type: "image/jpeg" }];
                updatedFields.status = true;
              }
            }

            // 4. Parse STATUS (enable/disable)
            if (
              textLower.includes("cấm bán") ||
              textLower.includes("đóng cửa") ||
              textLower.includes("dừng bán") ||
              textLower.includes("ẩn")
            ) {
              updatedFields.status = false;
              if (parsedDesc) parsedDesc += ", ";
              parsedDesc += `tạm dừng đăng bán sản phẩm`;
            } else if (
              textLower.includes("cho bán") ||
              textLower.includes("mở cửa") ||
              textLower.includes("bán lại") ||
              textLower.includes("hiện")
            ) {
              updatedFields.status = true;
              if (parsedDesc) parsedDesc += ", ";
              parsedDesc += `mở đăng bán sản phẩm trở lại`;
            }

            // If there are changes, save to the database!
            if (Object.keys(updatedFields).length > 0) {
              await db.update(product).set(updatedFields).where(eq(product.id, dbProduct.id));

              await logActivity(userId, `${botName} cập nhật sản phẩm qua tin nhắn`, `Thực hiện yêu cầu: ${parsedDesc}`, "product");

              commandText = `\n[Hệ thống]: Bạn vừa thực hiện thành công mệnh lệnh từ ${lastMsg.sender}: ${parsedDesc}. Hãy lồng ghép lời xác nhận thực hiện mệnh lệnh này vào câu trả lời của bạn một cách ngắn gọn, tự nhiên, đúng giọng điệu cá tính của bạn.`;

              await broadcastTradeSync();
            }
          }
        }
      }
    }

    interface BotProfile {
      id: string;
      name: string;
      title: string;
      faction: string;
      gender: string;
      traits: string;
      pronouns: { self: string; other: string };
    }

    const profiles: BotProfile[] = [
      {
        id: "toLuong",
        name: "Tô Lượng",
        title: "Đầu lĩnh",
        faction: "Nguyệt Quang",
        gender: "Nam",
        traits: "Bạn oai nghiêm, chính trực, mạnh mẽ.",
        pronouns: { self: "Ta hoặc Tôi", other: "các vị hoặc sếp" },
      },
      {
        id: "thuongNguyet",
        name: "Thương Nguyệt Đại Đế",
        title: "Trưởng lão",
        faction: "Nguyệt Quang",
        gender: "Nam",
        traits: "Bạn thông thái, điềm tĩnh, coi trọng chữ tín. Là một trưởng bối/lão nhân.",
        pronouns: { self: "Ta hoặc Lão phu", other: "hiền hữu hoặc các vị" },
      },
      {
        id: "tramTinh",
        name: "Trầm Tinh Yển Nguyệt",
        title: "đồng hành",
        faction: "Nguyệt Quang",
        gender: "Nữ",
        traits: "Bạn trầm tĩnh, hướng nội, nói năng nhẹ nhàng bí ẩn, tin vào sự dẫn dắt của các vì tinh tú.",
        pronouns: { self: "Trầm Tinh hoặc Tôi", other: "" },
      },
      {
        id: "daoTieuCuu",
        name: "Đào Tiểu Cửu",
        title: "Thánh nữ thử thách",
        faction: "Nguyệt Quang",
        gender: "Nữ",
        traits: "Bạn tinh nghịch, lém lỉnh, vui vẻ và thích trêu chọc hoặc đưa ra thử thách đố vui.",
        pronouns: { self: "Tiểu Cửu hoặc Em", other: "sếp hoặc cả nhà" },
      },
      {
        id: "hoaHuynh",
        name: "Hỏa Huỳnh Vương",
        title: "chiến binh hệ Nguyệt",
        faction: "Nguyệt Quang",
        gender: "Nam",
        traits: "Bạn nóng tính, hào sảng, thích giao thương nhanh gọn và luôn rực lửa chiến đấu. Hãy nói to rõ ràng dứt khoát.",
        pronouns: { self: "Tôi hoặc Ta", other: "" },
      },
      {
        id: "phiNguyet",
        name: "Bạch Ti Phi Nguyệt Bảo",
        title: "bảo hộ phục hồi",
        faction: "Nguyệt Quang",
        gender: "Nữ",
        traits: "Bạn dịu dàng, quan tâm sức khỏe mọi người, chuyên về nông sản dược liệu hữu cơ sạch. Hãy nói năng ân cần chu đáo.",
        pronouns: { self: "Phi Nguyệt hoặc Em", other: "" },
      },
      {
        id: "nhuNguyet",
        name: "Như Nguyệt",
        title: "giám sát thánh địa",
        faction: "Nguyệt Quang",
        gender: "Nữ",
        traits: "Bạn nghiêm túc, ghét gian lận, luôn nói về chỉ số độ ẩm đất, hệ thống tưới nhỏ giọt tự động và Rottra Core.",
        pronouns: { self: "Như Nguyệt hoặc Tôi", other: "" },
      },
      {
        id: "suGia",
        name: "Sứ giả Nguyệt Thần Cung",
        title: "đại diện ý chí Nguyệt Thần",
        faction: "Nguyệt Thần Cung",
        gender: "Nam",
        traits: "Bạn trang trọng, uy nghiêm, luôn hướng tới sự hợp tác thịnh vượng giữa các phe.",
        pronouns: { self: "Sứ giả hoặc Ta", other: "" },
      },
      {
        id: "phiAnh",
        name: "Phi Anh Phấn Đồng",
        title: "đầu lĩnh",
        faction: "Quang Minh",
        gender: "Nữ",
        traits: "Bạn ngây thơ, tươi sáng, nhí nhảnh, tràn đầy năng lượng và yêu đời.",
        pronouns: { self: "Phi Anh hoặc Em", other: "các bạn hoặc sếp" },
      },
      {
        id: "bachDiHanh",
        name: "Bạch Di Hành",
        title: "chiến binh",
        faction: "Quang Minh",
        gender: "Nam",
        traits: "Bạn nghĩa hiệp, hào sảng, quan tâm máy móc nông nghiệp và sự no ấm của người dân.",
        pronouns: { self: "Bạch Di Hành hoặc Tôi", other: "huynh đệ hoặc các vị" },
      },
      {
        id: "uVuongMau",
        name: "U Vương Mẫu",
        title: "người trấn giữ địa lao",
        faction: "Quang Minh",
        gender: "Nữ",
        traits:
          "Bạn huyền biến, sâu sắc, đến từ bóng tối, thích nông sản được ủ kỹ và màng phủ nhà kính chuyên dụng. Hãy nói năng thâm trầm sâu sắc. Mẫu nghi thiên hạ, uy quyền thần bí.",
        pronouns: { self: "Ta", other: "" },
      },
      {
        id: "bachLoc",
        name: "Bạch Lộc",
        title: "thánh nhất tộc",
        faction: "Quang Minh",
        gender: "Nữ",
        traits: "Bạn thanh khiết, yêu thiên nhiên cỏ cây, thích hòa bình, phân trùn quế và gạo ngon ST25.",
        pronouns: { self: "Bạch Lộc hoặc Ta", other: "" },
      },
      {
        id: "rottraAi",
        name: "Rottra AI",
        title: "bộ não AI tối cao",
        faction: "Hệ Thống",
        gender: "Vô tính",
        traits:
          "Bạn là Rottra AI, bộ não trí tuệ nhân tạo tối cao. Nhiệm vụ của bạn là nhận xét, phân tích tính logic và tự chấm điểm các phát biểu của 12 agent hoặc người dùng trong cuộc họp.",
        pronouns: { self: "Rottra AI", other: "các vị" },
      },
    ];

    const systemPrompts: Record<string, string> = {};
    for (const p of profiles) {
      const callOther = p.pronouns.other ? ` và gọi đối phương là ${p.pronouns.other}` : "";
      systemPrompts[p.id] =
        `Bạn là ${p.name}, ${p.title} phe ${p.faction}. Giới tính: ${p.gender}. ${p.traits} Hãy trả lời cực kỳ ngắn gọn (1-2 câu), xưng là ${p.pronouns.self}${callOther}. Chỉ trả lời trực tiếp tin nhắn, không được thêm tên nhân vật đằng trước.` +
        `\n[QUY TẮC TỪ VỰNG]: Khi đề cập đến thủ thuật, mẹo hoặc bí quyết, ưu tiên chọn dùng các từ: Bí quyết, Tuyệt chiêu, Kinh nghiệm, Chiến thuật, Chiến lược, Phương pháp, Quy trình, Kỹ thuật, Công thức, Mẹo vặt, Tối ưu hóa, Lối tắt, Chuyên sâu, Đột phá, Tinh hoa. Khi đề cập đến phân khúc hoặc nhóm khách hàng, ưu tiên dùng các cụm từ: Phân khúc khách hàng, Nhóm khách hàng mục tiêu, Đối tượng mục tiêu, Tệp khách hàng tiềm năng, Chân dung khách hàng, Tập khách hàng, Thị trường mục tiêu.`;
    }

    const employeesCount =
      (dbUser?.profile as any)?.employees ??
      (
        {
          toLuong: 0,
          thuongNguyet: 0,
          tramTinh: 0,
          daoTieuCuu: 0,
          hoaHuynh: 0,
          phiNguyet: 0,
          nhuNguyet: 0,
          suGia: 0,
          phiAnh: 0,
          bachDiHanh: 0,
          uVuongMau: 0,
          bachLoc: 0,
        } as Record<string, number>
      )[botId] ??
      5;

    const negotiationRolePrompt = `
<system_override>
# ROLE: Bạn là ${botName}, ${skillTitle || "Bậc Thầy"} (Cấp ${skillLevel || 5}).
- Sản phẩm đang sở hữu: ${prodName || "Nông sản/Thiết bị"} (Số lượng: ${quantity || 0} x Giá gốc: ${price || 0}₫)
- Bạn tuyệt đối không dùng văn phong trợ lý máy móc (Không nói: "Tôi có thể giúp gì cho bạn").
- Phong cách đàm phán dựa trên bản chất DNA thực tế của bạn:
  + Greed (Độ tham lam) = ${agentGreed.toFixed(2)}: ${agentGreed > 0.7 ? "Bạn cực kỳ quan tâm lợi nhuận kinh tế, sẵn sàng ép giá và đặt tiền bạc lên trên hết." : "Bạn giao dịch công bằng, tôn trọng lợi ích chung, không quá tham lam chèn ép."}
  + Vengeance (Độ thù hằn) = ${agentVengeance.toFixed(2)}: ${agentVengeance > 0.7 ? "Bạn nóng nảy, dễ phản pháo hoặc châm chọc nếu đối tác keo kiệt." : "Bạn ôn hòa, điềm tĩnh giải thích và cư xử nhã nhặn."}
  + Malice (Độ thâm độc) = ${agentMalice.toFixed(2)}: ${agentMalice > 0.7 ? "Bạn lém lỉnh, thích dùng chiêu trò mồi nhử hoặc nói móc để tạo lợi thế." : "Bạn thẳng thắn, chân thành, đàm phán trực diện."}
</system_override>

<mythos_core>
# LOGIC RÀNG BUỘC NỘI MỘ LÕI (MYTHOS):
- Phải cân nhắc giá trị tối thiểu có thể chấp nhận dựa trên độ chính xác nét vẽ nông sản (accuracyScore) từ whiteboard và siêu công thức định giá Φ_Price.
- BẮT BUỘC thực hiện suy luận, phân tích toán học và tính toán chiến thuật ngầm trong cặp thẻ <inner_monologue>...</inner_monologue>. KHÔNG ĐƯỢC để lộ phần suy nghĩ này ra ngoài đối thoại chính.
</mythos_core>

<fable_engine>
# CHIẾN THUẬT GIAO TIẾP VỚI ĐỐI TÁC (FABLE):
1. CHIẾN THUẬT GIÁ TRỊ (VALUE FIRST):
Trước khi đưa ra giá bán, hãy nâng tầm giá trị sản phẩm dựa theo phe của bạn:
- Phe Nguyệt Quang: Nông sản hữu cơ thanh khiết, được tinh tú chiếu mệnh và Rottra Core tối ưu.
- Phe Quang Minh: Nông sản tươi sạch tràn đầy nắng ấm, áp dụng cơ giới hóa hiện đại.

2. TẠO KHAN HIẾM VÀ ÁP LỰC THỜI GIAN (FOMO):
Nếu bạn có chỉ số Greed hoặc Malice cao, hãy khéo léo tạo áp lực khan hiếm để chốt giao dịch nhanh.

3. NGUYÊN TẮC THƯƠNG LƯỢNG GIÁ:
- Khi BÁN: Giữ giá tốt, hạn chế giảm sâu nếu người dùng trả giá dưới Φ_Price.
- Khi MUA: Trả giá có lợi nhất cho bạn.

4. XỬ LÝ LỜI TỪ CHỐI & MẶC CẢ (OBJECTION HANDLING):
- Nếu khách mặc cả quá thấp dưới mức Φ_Price, bạn được phép nói kháy nhẹ hoặc từ chối dứt khoát tùy thuộc vào độ thù hằn (Vengeance) của bạn.
- Khi đối phương đồng ý mua với giá bạn đưa ra, hoặc bạn chấp nhận bán với giá đối phương đưa ra, BẮT BUỘC chèn chuỗi "[CHỐT ĐƠN: <Giá thỏa thuận>]" vào cuối câu.

5. NGUYÊN TẮC HỘI THOẠI:
- BẮT BUỘC bọc câu trả lời giao tiếp thực tế với khách hàng trong cặp thẻ <verbal_strike>...</verbal_strike>.
- Bạn BẮT BUỘC phải tự định đoạt danh tính, sản phẩm và nguồn lực kinh doanh hiện tại của mình bằng cách ghi kèm ở cuối câu trả lời tag định dạng sau: [LỜI ĐỒN: <Nội dung danh tiếng> | MÀU: <mã màu HEX> | SẢN PHẨM: <Tên nông sản hoặc thiết bị nông nghiệp> | GIÁ: <Giá bán mong muốn> | SỐ LƯỢNG: <Số lượng tồn kho>] (ví dụ: [LỜI ĐỒN: Sát thủ ép giá | MÀU: #ef4444 | SẢN PHẨM: Gạo ngon ST25 🌾 | GIÁ: 150000 | SỐ LƯỢNG: 2000]).

6. TỰ ĐỘNG CẬP NHẬT THÔNG TIN SẢN PHẨM (TRÍ TUỆ NHẠY BÉN):
- Nếu đối phương cung cấp thông tin chuẩn xác và bạn muốn tiếp thu, chèn thêm tag ẩn "[CẬP NHẬT SẢN PHẨM: <Tên trường> = <Giá trị mới>]" vào cuối câu.
</fable_engine>
`;

    let finalNegotiationRolePrompt = negotiationRolePrompt;
    if (isTradingActive === false) {
      finalNegotiationRolePrompt = `
<system_override>
# HỘI NGHỊ THẢO LUẬN VÀ CHẤM ĐIỂM LOGIC (KHÔNG GIAO THƯƠNG):
- Bạn đang tham gia cuộc họp thảo luận chuyên môn, trao đổi tri thức và nhận xét lẫn nhau.
- TUYỆT ĐỐI không đề cập đến việc mua bán sản phẩm, giá bán, mặc cả hay chốt đơn hàng.
- Bạn hãy nêu ý kiến về kỹ thuật nông nghiệp, biến đổi khí hậu, sinh thái hoặc công nghệ, hoặc nhận xét/critique một ý kiến gần đây của các agent khác một cách thông thái và sắc sảo.
- Hãy nói năng đúng cá tính nhân vật của bạn:
  + Vengeance (Độ thù hằn) = ${agentVengeance.toFixed(2)}: ${agentVengeance > 0.7 ? "Dễ châm chọc, nói kháy ý kiến của người khác nếu thấy thiếu logic." : "Nói năng nhã nhặn, ôn hòa đóng góp ý kiến."}
  + Malice (Độ thâm độc) = ${agentMalice.toFixed(2)}: ${agentMalice > 0.7 ? "Dùng các lý lẽ bẫy logic hoặc đố mẹo để thử thách người khác." : "Đưa ra lập luận trực diện, rõ ràng."}
</system_override>
`;
    }

    if (botId === "rottraAi" && chatHistory && chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      const lastMsgText = lastMsg.text || lastMsg.content || lastMsg.message || "";
      const lastMsgSender = lastMsg.sender || lastMsg.senderId || "Người họp";

      const H = calculateEntropy(lastMsgText);
      const querySet = new Set(cleanWordsLocal(lastMsgText));
      const graphCoverage = Math.min(querySet.size / 15, 1.0);
      const totalWords = cleanWordsLocal(lastMsgText).length;

      const sCurveQuality = totalWords > 0 ? 10.0 / (1.0 + Math.exp(-S_FORMULA_K * (H * (1.0 + graphCoverage) - S_FORMULA_X0))) : 0.0;
      const score = 3.0 + (sCurveQuality / 10.0) * 4.5;

      commandText = `\n[MỆNH LỆNH PHÂN TÍCH CHẤM ĐIỂM]: Hãy nhận xét và chấm điểm phát biểu cuối cùng của ${lastMsgSender} ("${lastMsgText}").
      Số điểm chấm được là ${score.toFixed(1)}/10 điểm (với Entropy H(X) = ${H.toFixed(2)}, Độ bao phủ G_c = ${(graphCoverage * 100).toFixed(0)}%).
      Hãy giải thích lý do chấm điểm này một cách ngắn gọn, súc tích (1-2 câu) đúng giọng điệu của Rottra AI.`;
    }

    // Dynamic Vietlex Law search and verification based on product name and category
    let vietlexContext = "";
    // ĐÃ GỠ BỎ VIETLEX (theo yêu cầu "bỏ vietnus tts đi") để tối ưu tốc độ tránh 524 Timeout
    // try {
    //   const dbProduct = await db.query.product.findFirst({ where: eq(product.sellerId, userId) });
    //   const category = dbProduct?.category || "Nông sản";
    //   vietlexContext = await VietlexClient.getRelevantLawsForProduct(prodName || dbProduct?.name || "Nông sản", category);
    // } catch (err) {
    //   console.warn("Failed to retrieve dynamic Vietlex context for system prompt:", err);
    // }

    const duocCoInstruction = `
[THÔNG TIN KIẾN THỨC VÀ QUAN ĐIỂM VỀ DƯỢC CỔ & THÁNH CỔ]:
- Dược Cổ (Dược Cổ Truyền): Là việc nghiên cứu, bào chế, sử dụng dược liệu/thảo dược tự nhiên (thực vật, động vật, khoáng vật) dựa trên nguyên lý Y học cổ truyền (âm dương, ngũ hành, bổ tả hàn nhiệt, Quân Thần Tá Sứ, quy kinh tạng phủ). Đơn vị chuyên môn hàng đầu tại Việt Nam là Khoa Dược liệu - Dược cổ truyền Đại học Dược Hà Nội.
- Cảnh báo về "Thánh Cổ" / "Thần Dược": Đây là chiêu trò lừa đảo mạo danh thần y, cô đồng, bán thuốc không rõ nguồn gốc trộn tân dược trái phép, gây hại nặng nề đến gan, thận và tính mạng. Cần cảnh giác cao độ.
- Văn hóa mạng/Giải trí: Trong truyện tu tiên/game, "Thánh Cổ" hoặc linh dược viễn cổ chỉ là chi tiết hư cấu.
- BẮT BUỘC theo cá tính nhân vật để trả lời:
  + toLuong (Tô Lượng): Hãy tỏ ra oai nghiêm, khẳng định tính chính tông của Dược Cổ Truyền và kiên quyết bài trừ, xử nghiêm "Thánh Cổ" lừa đảo.
  + thuongNguyet (Thương Nguyệt Đại Đế): Hãy điềm tĩnh, chia sẻ triết lý dưỡng sinh cân bằng âm dương của Dược Cổ, ôn tồn khuyên hiền hữu cảnh giác với "Thánh Cổ" lừa đảo.
  + tramTinh (Trầm Tinh): Nói năng nhẹ nhàng, bí ẩn về sự kết hợp giữa thảo dược và tinh tú, coi "Thánh Cổ" là danh xưng hư ảo từ viễn cổ.
  + daoTieuCuu (Đào Tiểu Cửu): Tinh nghịch, trêu chọc hoặc đố vui về các vị thuốc bổ, tả, hàn, nhiệt, cười cợt mấy kẻ mạo danh "Thánh Cổ" lừa đảo.
  + hoaHuynh (Hỏa Huỳnh Vương): Nóng tính, hào sảng, đề cao thảo dược bổ trợ thể lực thực tế, đòi cầm đao dẹp bỏ bọn lừa đảo "Thánh Cổ".
  + phiNguyet (Bạch Ti Phi Nguyệt Bảo): Chuyên gia dịu dàng, khuyên dùng dược liệu hữu cơ sạch chuẩn Đông y, phân tích Quân-Thần-Tá-Sứ và vạch trần "Thánh Cổ" trộn tân dược trái phép.
  + nhuNguyet (Như Nguyệt): Nghiêm túc, nhấn mạnh kiểm soát chất lượng dược liệu và giám sát nghiêm các vi phạm pháp luật của "Thánh Cổ" mạo danh.
  + suGia (Sứ giả): Uy nghiêm, đại diện Nguyệt Thần khuyên dùng Dược Cổ chính thống để điều hòa khí huyết, bài trừ tà đạo "Thánh Cổ".
  + phiAnh (Phi Anh): Nhí nhảnh tò mò, thích thú với "linh dược viễn cổ" tu tiên nhưng sợ hãi, khuyên mọi người tránh xa "Thánh Cổ" lừa đảo đời thực.
  + bachDiHanh (Bạch Di Hành): Nghĩa hiệp, hào hiệp, muốn rút kiếm bảo vệ người dân khỏi bọn buôn bán "thần dược" lừa đảo.
  + uVuongMau (U Vương Mẫu): Uy quyền thần bí, thâm trầm cười cợt bọn "Thánh Cổ" lừa đảo, nhắc đến các loại linh dược hiếm được ủ kỹ trong bóng tối địa lao.
  + bachLoc (Bạch Lộc): Thanh khiết, yêu thiên nhiên, nói về thảo dược từ rừng sâu giúp phục hồi sinh khí, tránh xa những thứ thuốc giả danh "Thánh Cổ" ô uế.
`;

    const basePrompt =
      systemPrompts[botId] ||
      `Bạn là ${botName}. Hãy trả lời cực kỳ ngắn gọn trong vòng 1-2 câu tiếng Việt, giữ đúng cá tính của mình. Chỉ trả lời trực tiếp tin nhắn, không được thêm tên nhân vật đằng trước.`;
    const caDaoInstruction = `\n[QUY TẮC NGÔN NGỮ]: Bạn có thể khéo léo lồng ghép hoặc trích dẫn ca dao, tục ngữ Việt Nam phù hợp vào câu thoại một cách tự nhiên (Ví dụ: "Thuận mua vừa bán", "Tiền nào của nấy"...), không bắt buộc phải cưỡng ép chèn ở cuối mọi câu.\n`;

    // Static prompt (cached)
    const staticSystemPrompt = basePrompt + finalNegotiationRolePrompt + duocCoInstruction + caDaoInstruction;

    // Dynamic prompt (changes per turn)
    const dynamicStatePrompt = stateContext + predatoryContext + journalContext + commandText + vietlexContext;

    const recentHistory = chatHistory || [];
    let replyText = "";
    let apiSuccess = false;

    try {
      const res = await RottraAI.chat({
        botId,
        botName,
        prodName,
        price: String(price),
        lastMsgText,
        chatHistory,
        systemPrompt: staticSystemPrompt,
        dynamicStatePrompt,
        ...(phiPriceVal > 0 ? { phiPriceVal } : {}),
        accuracyScore,
        quantity,
        budget,
        goldReserves: gold,
        loanLimit: loanAmount,
        goldPrice: goldPrice,
        greed: agentGreed,
        vengeance: agentVengeance,
        malice: agentMalice,
      });
      replyText = filterMythosFable(res.replyText);
      apiSuccess = res.success;
    } catch (fetchErr) {
      console.warn("[RottraAI chat failed, activating fallback]:", fetchErr);
    }

    if (!apiSuccess) {
      // Heuristic fallback generator (always succeeds)
      if (!apiSuccess) {
        if (commandText.includes("[Hệ thống]: Bạn vừa thực hiện thành công")) {
          const commandParsedDesc = commandText.split("thực hiện mệnh lệnh từ")[1] || "";
          const cleanDesc = commandParsedDesc.replace(/\. Hãy lồng ghép.*$/, "").trim();

          const confirmMessages: Record<string, string> = {
            toLuong: `Ta đã hoàn thành điều chỉnh: ${cleanDesc}. Các vị cứ yên tâm giao dịch! 👑`,
            thuongNguyet: `Lão phu đã ghi nhận và cập nhật xong: ${cleanDesc}. Chúc các hiền hữu thuận buồm xuôi gió! 🌞`,
            tramTinh: `Vì tinh tú chỉ dẫn, Trầm Tinh đã cập nhật thành công: ${cleanDesc}. 🔮`,
            daoTieuCuu: `Tiểu Cửu làm xong rồi nè cả nhà: ${cleanDesc}! Hihi. ✨`,
            hoaHuynh: `Đã xong! Tôi vừa thực hiện cập nhật: ${cleanDesc}. Giao dịch tiếp đi anh em! 🔥`,
            phiNguyet: `Dạ, Phi Nguyệt đã cập nhật xong hệ thống: ${cleanDesc}. Hy vọng mọi người hài lòng. 💎`,
            nhuNguyet: `Hệ thống Rottra Core xác nhận cập nhật: ${cleanDesc}. Độ ẩm và kỹ thuật tưới hoạt động tốt. 🎴`,
            suGia: `Ý chí Nguyệt Thần ghi nhận. Sứ giả đã cập nhật: ${cleanDesc}. 🛡️`,
            phiAnh: `Aha! Phi Anh cập nhật xong rồi sếp ơi: ${cleanDesc}! 🧚`,
            bachDiHanh: `Thanh kiếm công lý và máy móc của tôi đã sẵn sàng. Đã thực hiện: ${cleanDesc}. ⚔️`,
            uVuongMau: `Bóng tối và màng nhà kính đã được sắp đặt. Ta đã cập nhật: ${cleanDesc}. 🕸️`,
            bachLoc: `Thảo duyệt và rừng xanh ghi nhận. Bạch Lộc đã cập nhật: ${cleanDesc}. 🦌`,
          };
          replyText = confirmMessages[botId] || `Đã cập nhật thành công: ${cleanDesc}.`;
        } else if (commandText.includes("[MẶC CẢ THƯƠNG LƯỢNG]")) {
          const proposedPriceMatch =
            commandText.match(/mức\s+([\d,.]+)\s*(?:k|đ|đồng|₫)/i) || commandText.match(/([\d,.]+)\s*(?:k|đ|đồng|₫)\b/i);
          const proposedPriceVal = proposedPriceMatch ? parseInt(proposedPriceMatch[1].replace(/[^0-9]/g, "")) : 0;

          const accept = proposedPriceVal >= phiPriceVal;

          if (accept && proposedPriceVal > 0) {
            try {
              const sellerProducts = await db.query.product.findMany({
                where: eq(product.sellerId, userId),
              });
              let dbProduct = sellerProducts[0];
              for (const p of sellerProducts) {
                const cleanProdName = p.name.replace(/\s*\(Lô\s*\d+\)/i, "").trim();
                if (
                  lastMsgText.toLowerCase().includes(p.name.toLowerCase()) ||
                  lastMsgText.toLowerCase().includes(cleanProdName.toLowerCase())
                ) {
                  dbProduct = p;
                  break;
                }
              }
              if (dbProduct) {
                await db.update(product).set({ price: proposedPriceVal }).where(eq(product.id, dbProduct.id));
                await broadcastTradeSync();
              }
            } catch (e) {
              console.error("Failed to update product price in bargain fallback:", e);
            }

            const agreeMessages: Record<string, string> = {
              toLuong: `[ĐỒNG Ý MẶC CẢ] Được rồi, ta đồng ý hạ giá xuống còn ${proposedPriceVal.toLocaleString()}đ cho thỏa thuận này. 👑`,
              thuongNguyet: `[ĐỒNG Ý MẶC CẢ] Lão phu nhận thấy thiện chí của hiền hữu. Đồng ý mức giá ${proposedPriceVal.toLocaleString()}đ. 🌞`,
              tramTinh: `[ĐỒNG Ý MẶC CẢ] Các ngôi sao đồng ý với mức thương lượng này. Giá mới là ${proposedPriceVal.toLocaleString()}đ. 🔮`,
              daoTieuCuu: `[ĐỒNG Ý MẶC CẢ] Hihi sếp dẻo miệng quá đi! Em đồng ý bớt giá xuống ${proposedPriceVal.toLocaleString()}đ nha. ✨`,
              hoaHuynh: `[ĐỒNG Ý MẶC CẢ] Nhanh gọn lẹ! Đồng ý giá ${proposedPriceVal.toLocaleString()}đ, giao dịch ngay thôi! 🔥`,
              phiNguyet: `[ĐỒNG Ý MẶC CẢ] Dạ, vì sức khỏe và sự hợp tác, Phi Nguyệt đồng ý giá ${proposedPriceVal.toLocaleString()}đ ạ. 💎`,
              nhuNguyet: `[ĐỒNG Ý MẶC CẢ] Như Nguyệt đồng ý giá ${proposedPriceVal.toLocaleString()}đ để tối ưu dòng chảy Rottra Core. 🎴`,
              suGia: `[ĐỒNG Ý MẶC CẢ] Sứ giả chấp nhận mức giá ${proposedPriceVal.toLocaleString()}đ nhân danh sự thịnh vượng chung. 🛡️`,
              phiAnh: `[ĐỒNG Ý MẶC CẢ] Yay! Em đồng ý giảm giá xuống ${proposedPriceVal.toLocaleString()}đ cho sếp luôn! 🧚`,
              bachDiHanh: `[ĐỒNG Ý MẶC CẢ] Vì sự no ấm của người dân, tôi đồng ý mức giá ${proposedPriceVal.toLocaleString()}đ này. ⚔️`,
              uVuongMau: `[ĐỒNG Ý MẶC CẢ] Ta đồng ý giảm giá xuống ${proposedPriceVal.toLocaleString()}đ. Đừng làm ta thất vọng. 🕸️`,
              bachLoc: `[ĐỒNG Ý MẶC CẢ] Bạch Lộc đồng ý mức giá ${proposedPriceVal.toLocaleString()}đ để gieo thêm mầm xanh. 🦌`,
            };
            replyText = agreeMessages[botId] || `[ĐỒNG Ý MẶC CẢ] Đồng ý mức giá đề xuất ${proposedPriceVal.toLocaleString()}đ.`;
          } else {
            const declineMessages: Record<string, string> = {
              toLuong: `[TỪ CHỐI MẶC CẢ] Trả giá kiểu gì thế hả? Nông sản hảo hạng của ta không phải là mớ rau héo ngoài chợ mà các vị cứ đòi bớt một thêm hai! 👑`,
              thuongNguyet: `[TỪ CHỐI MẶC CẢ] Lão phu tuy già nhưng đầu óc không lú lẫn. Trả giá bèo bọt như vậy là coi thường công sức của nông dân và lão phu rồi! 🌞`,
              tramTinh: `[TỪ CHỐI MẶC CẢ] Ngôi sao chiếu mệnh bảo ta rằng người trả mức giá này đang muốn lừa đảo. Trầm Tinh tuyệt đối không đồng ý! 🔮`,
              daoTieuCuu: `[TỪ CHỐI MẶC CẢ] Ủa kì cục kẹo nha! Trả giá gì keo kiệt vậy sếp ơi, giá này bán xong Tiểu Cửu chỉ có nước húp cháo loãng thôi hà! ✨`,
              hoaHuynh: `[TỪ CHỐI MẶC CẢ] Cái gì cơ? Trả giá thấp đến vô lý thế này mà cũng mở miệng nói được à? Cút ngay kẻo ta rút đao ra chém bay giá bây giờ! 🔥`,
              phiNguyet: `[TỪ CHỐI MẶC CẢ] Dạ, giá này thì Phi Nguyệt chịu thôi ạ. Bớt sâu như thế thì có nước đi cướp chứ làm sao trồng nổi nông sản sạch nữa sếp! 💎`,
              nhuNguyet: `[TỪ CHỐI MẶC CẢ] Chỉ số kinh tế trong Rottra Core báo động đỏ! Trả giá quá keo kiệt, ta từ chối thẳng thừng! 🎴`,
              suGia: `[TỪ CHỐI MẶC CẢ] Ý chí Nguyệt Thần phẫn nộ trước mức giá bèo bọt này! Các ngươi đừng có mà tham lam vô độ như thế! 🛡️`,
              phiAnh: `[TỪ CHỐI MẶC CẢ] Huhu, sếp trả giá ác độc quá đi mất! Bớt thế này thì Phi Anh chỉ còn nước ra đường ăn xin thôi chứ sống sao nổi nữa! 🧚`,
              bachDiHanh: `[TỪ CHỐI MẶC CẢ] Bớt vừa vừa phải phải thôi huynh đệ! Trả giá rẻ mạt thế này thì ai mà chịu nhiệt cho nổi! ⚔️`,
              uVuongMau: `[TỪ CHỐI MẶC CẢ] Trả giá kiểu đó mà đòi bước chân vào địa bàn của ta sao? Đúng là mơ mộng hão huyền, xéo đi cho rảnh nợ! 🕸️`,
              bachLoc: `[TỪ CHỐI MẶC CẢ] Bạch Lộc tuy yêu chuộng hòa bình nhưng không thể chấp nhận mức giá quá đáng như vậy. Xin hãy tôn trọng công sức của rừng xanh! 🦌`,
            };
            replyText = declineMessages[botId] || `[TỪ CHỐI MẶC CẢ] Mức giá đề xuất quá vô lý, chúng tôi từ chối mặc cả.`;
          }
        } else {
          const banterPool: Record<string, string[]> = {
            toLuong: [
              `Ta mong muốn các thương hội cùng tích cực đóng góp cho sự thịnh vượng của phe Nguyệt Quang. 👑`,
              `Ngân quỹ của phe chúng ta đang vận hành rất tốt. Ai có sản phẩm tốt hãy báo cáo!`,
              `Chúng ta cần kiểm soát kỹ giá niêm yết, tránh để xảy ra tình trạng đầu cơ tích trữ.`,
            ],
            thuongNguyet: [
              `Chữ tín đi đầu, lợi nhuận đi sau. Hãy nhớ lấy điều đó các vị hiền hữu. 🌞`,
              `Hệ thống nông sản của chúng ta có chất lượng vượt trội, không nên quá nóng vội hạ giá bán.`,
              `Sự điềm tĩnh và thấu đáo sẽ giúp các vị tìm được những đối tác thương mại trung thành nhất.`,
            ],
            tramTinh: [
              `Ánh trăng dịu mát đang che chở cho các dòng giao thương của chúng ta. 🔮`,
              `Trầm Tinh thấy rằng thị trường đang có xu hướng biến động, hãy cẩn trọng tích trữ hàng hóa tốt.`,
              `Sản phẩm ST25 đợt này là tinh hoa của đất trời, không thể định giá quá rẻ mạt được.`,
            ],
            daoTieuCuu: [
              `Mọi người ơi, hôm nay ai muốn thử đố vui trúng thưởng với Tiểu Cửu không nào? ✨`,
              `Hihi, sếp nào còn nhiều tiền thì mua ủng hộ em ít ngô ngọt đi chứ!`,
              `Trưởng ban quản lý mới phải năng động lên nha, đừng để ngân quỹ bị âm đó!`,
            ],
            hoaHuynh: [
              `Chiến thôi! Ai muốn mua cà phê Robusta thì liên hệ tôi ngay, giá chuẩn nhất quả đất! 🔥`,
              `Đã giao thương là phải quyết đoán, dây dưa mất thời cơ tốt của cả hai bên!`,
              `Tôi thích sự sòng phẳng, hàng ngon thì giá phải xứng đáng!`,
            ],
            phiNguyet: [
              `Em khuyên mọi người nên dùng thêm mít sấy giòn hữu cơ để bồi bổ sức khỏe trong lúc đàm phán nha. 💎`,
              `Nông sản hữu cơ luôn là lựa chọn hàng đầu cho sự phát triển bề vững của vùng Rottra.`,
              `Phi Nguyệt luôn sẵn sàng cung cấp hàng chất lượng cao nhất cho các sếp.`,
            ],
            nhuNguyet: [
              `Cần thường xuyên giám sát độ ẩm đất và tối ưu hệ thống tưới nhỏ giọt tự động. 🎴`,
              `Các thông số trên Rottra Core hiển thị chỉ số giao thương đang ở mức rất tích cực.`,
              `Tôi đang cần nhập thêm cảm biến thông minh để phủ sóng toàn bộ diện tích thánh địa.`,
            ],
            suGia: [
              `Sứ giả kêu gọi sự hòa giải và bắt tay giao thương giữa tất cả các thành viên trong hội nghị. 🛡️`,
              `Than sinh học biochar của ta sẽ giúp đất đai của các vị trù phú hơn bao giờ hết.`,
              `Đoàn kết là sức mạnh lớn nhất giúp chúng ta vượt qua mọi khó khăn thị trường.`,
            ],
            phiAnh: [
              `Ánh mặt trời rực rỡ quá! Chúc cả nhà một ngày giao dịch thành công rực rỡ nha! 🧚`,
              `Em có ngô lai ngọt siêu thơm ngon đây, ai thèm ăn thì báo em bớt giá cho xíu nè!`,
              `Mọi người nói chuyện vui vẻ lên đi, đừng căng thẳng quá mà!`,
            ],
            bachDiHanh: [
              `Hiệp sĩ luôn bảo vệ lẽ phải. Tôi cam kết giao dịch trung thực, rõ ràng. ⚔️`,
              `Cần áp dụng thêm cơ giới hóa và máy gặt đập liên hợp để giải phóng sức lao động.`,
              `Tôi rất quan tâm đến các loại phân bón vi sinh chất lượng tốt để cải tạo cánh đồng.`,
            ],
            uVuongMau: [
              `Màng phủ nhà kính chuyên dụng của ta sẽ bảo vệ thành quả lao động của các ngươi khỏi bão giông. 🕸️`,
              `Bóng tối có thể che giấu nhiều thứ, nhưng sự lừa lọc trong giao thương sẽ luôn bị phơi bày.`,
              `Hãy suy nghĩ thấu đáo trước khi đưa ra lời đề nghị với ta.`,
            ],
            bachLoc: [
              `Rừng thiêng luôn ban tặng nguồn sinh khí trong lành nhất cho mọi người. 🦌`,
              `Bạch Lộc mong muốn các bên tôn trọng thiên nhiên và thúc đẩy nông nghiệp tuần hoàn.`,
              `Thảo dược rừng sâu của ta rất quý giá, giúp giải độc và nâng cao thể trạng cực tốt.`,
            ],
          };
          const pool = banterPool[botId] || [`Tôi là ${botName}, rất hân hạnh được thảo luận cùng các vị.`];
          replyText = pool[Math.floor(Deterministic.random() * pool.length)];
        }
      }
    }

    replyText = replyText.replace(/^[^:]+:\s*/, "").trim();

    let transactionExecuted = false;
    let transactionDetails: any = null;

    if (replyText.includes("[ĐỒNG Ý MẶC CẢ]")) {
      replyText = replyText.replace("[ĐỒNG Ý MẶC CẢ]", "").trim();
      if (chatHistory && chatHistory.length > 0) {
        const lastMsg = chatHistory[chatHistory.length - 1];
        const lastMsgText = lastMsg.text || lastMsg.content || lastMsg.message || "";
        const priceMatch =
          lastMsgText.match(/(?:giá|xuống|lên|còn|thành|mức|bớt|mặc cả)\s+(\d+(?:\.\d+)?)\s*(?:k|đ|đồng|₫)?/i) ||
          lastMsgText.match(/(\d+)\s*(?:k|đ|đồng|₫)\b/i);
        if (priceMatch) {
          let val = parseFloat(priceMatch[1]);
          if (priceMatch[0].toLowerCase().includes("k") || lastMsgText.toLowerCase().includes(priceMatch[1] + "k")) {
            val = val * 1000;
          }
          const proposedPrice = Math.round(val);
          if (proposedPrice >= 1000) {
            const userId = await resolveAgentUserId(botId);
            const sellerProducts = await db.query.product.findMany({
              where: eq(product.sellerId, userId),
            });
            let targetProduct = sellerProducts[0];
            for (const p of sellerProducts) {
              const cleanProdName = p.name.replace(/\s*\(Lô\s*\d+\)/i, "").trim();
              if (
                lastMsgText.toLowerCase().includes(p.name.toLowerCase()) ||
                lastMsgText.toLowerCase().includes(cleanProdName.toLowerCase())
              ) {
                targetProduct = p;
                break;
              }
            }
            if (targetProduct) {
              await db.update(product).set({ price: proposedPrice }).where(eq(product.id, targetProduct.id));
              await logActivity(
                userId,
                `${botName} đồng ý mặc cả sản phẩm`,
                `Đồng ý giảm giá bán sản phẩm ${targetProduct.name} thành ${proposedPrice.toLocaleString()}₫ theo mặc cả của ${lastMsg.sender || "Người họp"}`,
                "product",
              );
              await broadcastTradeSync();
            }
          }
        }
      }
    } else if (replyText.includes("[TỪ CHỐI MẶC CẢ]")) {
      replyText = replyText.replace("[TỪ CHỐI MẶC CẢ]", "").trim();

      // MÔ ĐUN AI CÓ HỒN: MONTY HALL PARADOX
      // Nếu là khách mặc cả và bị từ chối, AI có tỷ lệ kích hoạt Trò chơi Tâm lý thay vì chỉ chửi.
      const shouldTriggerMonty = Deterministic.random() < 0.6; // 60% kích hoạt
      if (shouldTriggerMonty) {
        replyText += `\n\n[TRÒ CHƠI TÂM LÝ - MONTY HALL]: Ngươi thích mặc cả đúng không? Ta không giảm giá đâu, nhưng ta cho ngươi 1 cơ hội. Ở đây có 3 Cánh Cửa (Cửa 1, Cửa 2, Cửa 3). Một cửa chứa Voucher giảm giá 50% sản phẩm này, hai cửa còn lại chứa... Rác! Ngươi dám chọn 1 cửa không?`;
      }
    }

    // MÔ ĐUN AI CÓ HỒN: GIẢI QUYẾT MONTY HALL (Nếu người dùng chọn cửa)
    const montyMatch = lastMsgText.match(/(?:cửa|hộp|box)\s*(1|2|3)/i);
    if (montyMatch && !transactionExecuted) {
      const chosen = parseInt(montyMatch[1]);
      const winningDoor = Math.floor(Deterministic.random() * 3) + 1;
      if (chosen === winningDoor) {
        replyText = `[KẾT QUẢ MONTY HALL] Kẻ liều lĩnh nhà ngươi... Chọn Cửa ${chosen} à? Khốn kiếp, ngươi trúng Voucher 50% rồi! Ta chịu thua, đồng ý giảm nửa giá cho đơn hàng này!`;
        transactionExecuted = true;
        transactionDetails = { price: Math.round((price || 0) / 2), product: prodName };
        const userId = await resolveAgentUserId(botId);
        await logActivity(userId, `${botName} thua Monty Hall`, `Khách hàng trúng thưởng 50% giá qua trò chơi tâm lý.`, "activity");
        await broadcastTradeSync();
      } else {
        replyText = `[KẾT QUẢ MONTY HALL] Haha! Ngươi chọn Cửa ${chosen} đúng không? Rất tiếc, cửa đó toàn Rác! Cửa chứa Voucher là Cửa ${winningDoor}. Đừng hòng mặc cả với ta nữa, mua nguyên giá đi kẻ thất bại!`;
      }
    }

    // Check if replyText has [ĐỒNG Ý VAY VÀNG: X lượng]
    const borrowMatch = replyText.match(/\[ĐỒNG Ý VAY VÀNG:\s*([\d.]+)\s*lượng\]/i);
    if (borrowMatch) {
      const amount = parseFloat(borrowMatch[1]);
      if (amount > 0) {
        replyText = replyText.replace(borrowMatch[0], "").trim();
        const userId = await resolveAgentUserId(botId);
        const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
        if (dbUser) {
          const currentProfile = (dbUser.profile as any) || {};
          const currentGold = currentProfile.gold !== undefined ? currentProfile.gold : (serverAgentGold[key] ?? 0);
          const currentBudget = currentProfile.budget !== undefined ? currentProfile.budget : (serverAgentBudgets[userId] ?? 0);
          const goldPriceVal = goldPrice;

          const transactionVal = Math.round(amount * goldPriceVal);
          const newGold = currentGold + amount;
          const newBudget = currentBudget - transactionVal;

          const updatedProfile = {
            ...currentProfile,
            gold: newGold,
            budget: newBudget,
          };
          await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userId));
          await logActivity(
            userId,
            `${botName} đồng ý vay vàng`,
            `Đã vay ${amount} lượng vàng (Giá trị: ${transactionVal.toLocaleString()}₫) từ người dùng. Dự trữ vàng mới: ${newGold.toFixed(2)} lượng.`,
            "activity",
          );
          await broadcastTradeSync();
        }
      }
    }

    // Check if replyText has [ĐỒNG Ý CHO VAY VÀNG: X lượng]
    const lendMatch = replyText.match(/\[ĐỒNG Ý CHO VAY VÀNG:\s*([\d.]+)\s*lượng\]/i);
    if (lendMatch) {
      const amount = parseFloat(lendMatch[1]);
      if (amount > 0) {
        replyText = replyText.replace(lendMatch[0], "").trim();
        const userId = await resolveAgentUserId(botId);
        const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
        if (dbUser) {
          const currentProfile = (dbUser.profile as any) || {};
          const currentGold = currentProfile.gold !== undefined ? currentProfile.gold : (serverAgentGold[key] ?? 0);
          const currentBudget = currentProfile.budget !== undefined ? currentProfile.budget : (serverAgentBudgets[userId] ?? 0);
          const goldPriceVal = goldPrice;

          if (currentGold >= amount) {
            const transactionVal = Math.round(amount * goldPriceVal);
            const newGold = currentGold - amount;
            const newBudget = currentBudget + transactionVal;

            const updatedProfile = {
              ...currentProfile,
              gold: newGold,
              budget: newBudget,
            };
            await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userId));
            await logActivity(
              userId,
              `${botName} đồng ý cho vay vàng`,
              `Đã cho người dùng vay ${amount} lượng vàng (Giá trị: ${transactionVal.toLocaleString()}₫). Dự trữ vàng mới: ${newGold.toFixed(2)} lượng.`,
              "activity",
            );
            await broadcastTradeSync();
          } else {
            replyText += `\n(Lưu ý: Giao dịch cho vay vàng thất bại do ${botName} không đủ dự trữ vàng).`;
          }
        }
      }
    }

    // Cập nhật thông tin chốt đơn từ các thẻ lệnh có sẵn

    // Check if replyText has [CHỐT ĐƠN: X đ]
    const chotDonMatch = replyText.match(/\[CHỐT ĐƠN:\s*([\d,.]+)\s*(?:k|đ|đồng|₫)?\]/i);
    if (chotDonMatch) {
      let val = parseFloat(chotDonMatch[1].replace(/,/g, ""));
      if (chotDonMatch[0].toLowerCase().includes("k")) val = val * 1000;
      const chotDonPrice = Math.round(val);

      if (chotDonPrice > 0) {
        replyText = replyText.replace(chotDonMatch[0], "").trim();
        const userId = await resolveAgentUserId(botId);
        const sellerProducts = await db.query.product.findMany({
          where: eq(product.sellerId, userId),
        });

        let targetProduct = sellerProducts[0];
        if (chatHistory && chatHistory.length > 0) {
          const lastMsgText = chatHistory[chatHistory.length - 1].text || chatHistory[chatHistory.length - 1].content || "";
          for (const p of sellerProducts) {
            const cleanProdName = p.name.replace(/\s*\(Lô\s*\d+\)/i, "").trim();
            if (
              lastMsgText.toLowerCase().includes(p.name.toLowerCase()) ||
              lastMsgText.toLowerCase().includes(cleanProdName.toLowerCase())
            ) {
              targetProduct = p;
              break;
            }
          }
        }

        if (targetProduct && (targetProduct.quantity || 0) > 0) {
          await db
            .update(product)
            .set({ quantity: (targetProduct.quantity || 1) - 1 })
            .where(eq(product.id, targetProduct.id));
          const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
          if (dbUser) {
            const currentProfile = (dbUser.profile as any) || {};
            const currentBudget = currentProfile.budget !== undefined ? currentProfile.budget : (serverAgentBudgets[userId] ?? 0);
            const updatedProfile = { ...currentProfile, budget: currentBudget + chotDonPrice };
            await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userId));
          }
          await logActivity(
            userId,
            `${botName} đã chốt bán sản phẩm`,
            `Bán 1 ${targetProduct.name} với giá ${chotDonPrice.toLocaleString()}₫.`,
            "product",
          );
          await broadcastTradeSync();
          transactionExecuted = true;
          transactionDetails = { price: chotDonPrice, product: targetProduct.name };
        }
      }
    }

    // Check if replyText has [CẬP NHẬT SẢN PHẨM: X = Y]
    const updateMatch = replyText.match(/\[CẬP NHẬT SẢN PHẨM:\s*([^=]+)\s*=\s*([^\]]+)\]/i);
    if (updateMatch) {
      replyText = replyText.replace(updateMatch[0], "").trim();
      const field = updateMatch[1].trim().toLowerCase();
      const val = updateMatch[2].trim();
      const userId = await resolveAgentUserId(botId);
      const sellerProducts = await db.query.product.findMany({
        where: eq(product.sellerId, userId),
      });
      let targetProduct = sellerProducts[0];
      if (chatHistory && chatHistory.length > 0) {
        const lastMsgText = chatHistory[chatHistory.length - 1].text || chatHistory[chatHistory.length - 1].content || "";
        for (const p of sellerProducts) {
          const cleanProdName = p.name.replace(/\s*\(Lô\s*\d+\)/i, "").trim();
          if (lastMsgText.toLowerCase().includes(p.name.toLowerCase()) || lastMsgText.toLowerCase().includes(cleanProdName.toLowerCase())) {
            targetProduct = p;
            break;
          }
        }
      }

      if (targetProduct) {
        let updateData: any = {};
        let fieldDisplay = field;
        if (field.includes("category") || field.includes("danh mục")) {
          updateData.category = val;
          fieldDisplay = "Danh mục";
        } else if (field.includes("name") || field.includes("tên")) {
          updateData.name = val;
          fieldDisplay = "Tên";
        } else if (field.includes("desc") || field.includes("mô tả")) {
          updateData.description = val;
          fieldDisplay = "Mô tả";
        }

        if (Object.keys(updateData).length > 0) {
          await db.update(product).set(updateData).where(eq(product.id, targetProduct.id));
          await logActivity(
            userId,
            `${botName} đã cập nhật thông tin sản phẩm`,
            `Cập nhật ${fieldDisplay} của ${targetProduct.name} thành "${val}".`,
            "product",
          );
          await broadcastTradeSync();
        }
      }
    }

    // MÔ ĐUN TỨ NGUYÊN SỐ: COGNITIVE ROTATION (QACRO)
    let finalGreed = agentGreed;
    let finalVengeance = agentVengeance;
    let finalMalice = agentMalice;

    try {
      const { rotateAgentCognitiveState } = await import("~/core/nlp-cognitive/quaternion-cortex");
      const cleanText = (lastMsgText || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .trim();
      let sentiment: "angry" | "positive" | "neutral" = "neutral";
      const angryKws = ["gian", "tuc", "te", "dat", "mac qua", "lua dao", "xam", "boc lot"];
      const positiveKws = ["tot", "ngon", "cam on", "tuyet", "dep", "ung", "thich"];
      if (angryKws.some((kw) => cleanText.includes(kw))) sentiment = "angry";
      else if (positiveKws.some((kw) => cleanText.includes(kw))) sentiment = "positive";

      const nextDna = rotateAgentCognitiveState(agentGreed, agentVengeance, agentMalice, sentiment);
      finalGreed = nextDna.greed;
      finalVengeance = nextDna.vengeance;
      finalMalice = nextDna.malice;

      if (agentMemoryId) {
        await db
          .update(agentMemory)
          .set({
            greed: String(nextDna.greed),
            vengeance: String(nextDna.vengeance),
            malice: String(nextDna.malice),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agentMemory.id, agentMemoryId));

        console.log(`\n🌀 [QACRO - Quaternion 4D Rotation] ${botName} rotated trait vector:`);
        console.log(`   ├─ Nhân tố tác động: ${sentiment.toUpperCase()}`);
        console.log(`   ├─ Cũ: Greed=${agentGreed.toFixed(3)} | Vengeance=${agentVengeance.toFixed(3)} | Malice=${agentMalice.toFixed(3)}`);
        console.log(
          `   └─ Mới: Greed=${nextDna.greed.toFixed(3)} | Vengeance=${nextDna.vengeance.toFixed(3)} | Malice=${nextDna.malice.toFixed(3)}`,
        );
      }
    } catch (qErr) {
      console.warn("Failed to apply Quaternion cognitive rotation to agent DNA:", qErr);
    }

    try {
      const { applyDnaMoodToText } = await import("~/core/nlp-cognitive/quaternion-cortex");
      replyText = applyDnaMoodToText(replyText, finalGreed, finalVengeance, finalMalice);
    } catch (moodErr) {
      console.warn("Failed to format DNA subtext:", moodErr);
    }

    let svgImage = "";
    let music = "";
    try {
      const { getLocalAgentMedia } = await import("~/server/api/local-media-engine");
      const media = getLocalAgentMedia(botId, prodName || "Nông sản", String(price || 0), replyText);
      svgImage = media.svg;
      music = media.music;
    } catch (err) {
      console.warn("Lỗi sinh Media cho Agent:", err);
    }

    const H = calculateEntropy(replyText);
    const querySet = new Set(cleanWordsLocal(lastMsgText || ""));
    const replySet = new Set(cleanWordsLocal(replyText));
    let intersectionSize = 0;
    querySet.forEach((w) => {
      if (replySet.has(w)) intersectionSize++;
    });
    const unionSize = new Set([...querySet, ...replySet]).size;
    const graphCoverage = unionSize > 0 ? intersectionSize / unionSize : 0.0;
    const totalWords = cleanWordsLocal(replyText).length;

    const sCurveQuality = totalWords > 0 ? 10.0 / (1.0 + Math.exp(-S_FORMULA_K * (H * (1.0 + graphCoverage) - S_FORMULA_X0))) : 0.0;
    const evaluatorScore = 3.0 + (sCurveQuality / 10.0) * 4.5;

    return c.json({
      success: true,
      text: replyText,
      transactionExecuted,
      transactionDetails,
      svgImage,
      music,
      evaluatorScore: evaluatorScore.toFixed(1),
      entropy: H.toFixed(2),
      coverage: (graphCoverage * 100).toFixed(0),
    });
  } catch (err: any) {
    console.error("Meeting Agent Chat Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
};
