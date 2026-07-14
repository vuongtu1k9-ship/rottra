import { Deterministic } from "~/shared/utils/rng";
import { handleMeetingChat } from "~/orchestration/meeting-coordinator";
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

Chào bạn! Em đã kích hoạt Bộ giải toán Học thuật từ CSDL để hỗ trợ phân tích bài toán của bạn:

*   Phương pháp: Hỗ trợ phân tích, xây dựng công thức và giải chi tiết từng bước.
*   Trạng thái: Hoạt động tự chủ ngoại tuyến.

bạn vui lòng nhập đề bài chi tiết (ví dụ: các bài toán về xác suất, tổ hợp, hoặc ma trận/phương trình), hệ thống sẽ tính toán và đưa ra lời giải chính xác nhất!`,
        },
        {
          id: "2",
          intent: "STATISTICS",
          utterance: "giai toan",
          answer: `🧮 [BỘ MÁY TÍNH TOÁN LƯỢNG TỬ SIÊU THU NHỎ - POSTGRESQL]

Em đã truy xuất biểu mẫu giải từ CSDL PostgreSQL và thực thi biểu thức số học của bạn:

*   📝 Biểu thức nhận ng: \`{{EXPR}}\`
*   ⚙️ Quy trình xử lý: Tối ưu hóa phân rã toán tử (Operator Precedence)
*   🏆 Kết quả chính xác: {{RESULT}}

$$\\boxed{{{RESULT}}}$$

*bạn cần em tính toán ma trận, vẽ đồ thị phân phối hay giải phương trình nào khác không ạ? 😎*`,
        },
        {
          id: "3",
          intent: "LOGISTICS",
          utterance: "do thi luong do",
          answer: `🎓 [TRẠM LOGISTICS & TỐI ƯU HÓA MẠNG LƯỚI - POSTGRESQL]

Chào bạn! Em đã truy xuất tài liệu tối ưu từ CSDL PostgreSQL để phân tích thuật toán giải quyết Luồng cực đại (Maximum Flow) và Bài toán Người bán hàng (TSP):

### 📡 1) Phân Tích Luồng Cực Đại (Ford-Fulkerson):
Hệ thống logistics của Rottra được mô hình hóa dưới ng đồ thị có hướng $G = (V, E)$:
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

Chào bạn! Dữ liệu giảng y nghiên cứu kết hợp khoa học định lượng đã được nạp thành công từ CSDL PostgreSQL:

### 🏫 1) Rottra Case Method (Vấn đáp Socrates):
*   Thay vì nhồi nhét lý thuyết, ta dùng các Case Study thực tiễn để tiểu thương tự giải quyết bài toán định giá và quản trị rủi ro.
*   Gợi mở chủ động: Đặt câu hỏi phản biện để kích thích tư duy kinh tế của tiểu thương.

### 🧪 2) Thực nghiệm Thống kê học (Quantitative Econometrics):
*   Áp dụng mô hình hồi quy OLS đa biến để đo lường chính xác hiệu quả số hóa:
    $$Y_{it} = \\beta_0 + \\beta_1 \\text{SmartTech}_{it} + \\gamma X_{it} + \\epsilon_{it}$$
    *(Trong đó $Y$ là doanh thu, $\\text{SmartTech}$ là biến giả đại diện cho việc áp dụng công nghệ Rottra)*
*   Kiểm định giả thuyết ($H_0$): Bác bỏ các định kiến kinh nghiệm cũ bằng chỉ số khoa học $p$-value $< 0.05$.

*💡 Đây chính là "cốt não" tri thức đã được lưu trữ bền vững trong PostgreSQL giúp bạn triển khai dự án giáo dục nông nghiệp cực kỳ thành công!*`,
        },
        {
          id: "5",
          intent: "DEFAULT",
          utterance: "Rottra brain",
          answer: `🧠 [SIÊU NÃO BỘ SUY LUẬN TỰ CHỦ Rottra - EXPERT POSTGRESQL]

Chào bạn! Lõi nhận thức offline được truy xuất trực tiếp từ CSDL PostgreSQL đã phân tích yêu cầu của bạn: *"{{QUERY}}"*

### 🔍 Phân tích ngữ cảnh & Suy luận logic (CoT):
*   Ý định nhận diện: Tư vấn chiến lược vĩ mô kiêm giải quyết bài toán kỹ thuật.
*   Phương án xử lý: Trích xuất tri thức từ kho dữ liệu thuật toán và CSDL địa phương.

### 🏆 Đề xuất giải pháp chi tiết từ Hệ thống Rottra:
1.  Về E-Commerce & Nông sản: Hệ thống của chúng ta đang quản lý đầy đủ danh mục gạo hữu cơ, cà phê Robusta, sầu riêng Ri6 chuẩn VietGAP chất lượng cao.
2.  Về Tối ưu hóa: Em sẵn sàng hỗ trợ bạn phân tích doanh thu, vẽ biểu đồ Gantt quản lý tiến độ dự án, hoặc tính toán các chỉ số thống kê (Mean, Median, StdDev) cho số liệu thực tế.
3.  Về Trí tuệ Nhân tạo: bạn có thể ra lệnh bằng tiếng Việt tự nhiên (VD: *"tính thống kê cho [15, 20, 25, 30]"* hoặc *"giải toán 450 - 12"*), em sẽ giải quyết ngay lập tức với tốc độ mili-giây và không tốn một byte RAM chạy GGUF nào!

*bạn muốn em thực hiện hành động phân tích dữ liệu nào ngay bây giờ để tối đa hóa doanh thu E-Commerce cho Rottra ạ? 🚀*`,
        },
        {
          id: "6",
          intent: "TSP",
          utterance: "do thi tsp nguoi ban hang",
          answer: `🚛 [BỘ GIẢI TOÁN TỐI ƯU TUYẾN ĐƯỜNG TSP - Rottra SEAS]

Em đã truy xuất thuật toán Vận trù học từ CSDL PostgreSQL để tối ưu hóa tuyến đường thu gom nông sản của bạn:

### ⚙️ Mô hình toán học quy hoạch nguyên tuyến tính (MILP - MTZ Constraints):
$$\\min \\sum_{i=1}^n \\sum_{j=1}^n d(i, j) x_{i, j}$$
$$\\text{s.t. } u_i - u_j + n x_{i, j} \\le n - 1 \\quad \\forall 2 \\le i \\neq j \\le n$$

### 📊 Dữ liệu đầu vào thực tế từ bạn:
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

Chào bạn! Em đã tải mô hình phân luồng giao thông từ CSDL PostgreSQL để cân bằng lưu lượng xe vận tải:

### ⚙️ Định luật cân bằng Wardrop (User Equilibrium):
Mỗi tài xế xe tải tự chọn tuyến đường ngắn nhất, dẫn đến trạng thái cân bằng nơi không ai có thể tự giảm thời gian di chuyển bằng cách đổi tuyến:
$$\\min \\sum_{a \\in A} \\int_{0}^{x_a} t_a(w) dw$$

### 📊 Tính toán dòng chảy động của bạn:
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

bạn ơi! Em đã kích hoạt Bộ thẩm định dự án đầu tư NPV từ CSDL PostgreSQL để tính toán hiệu quả tài chính số hóa:

### ⚙️ Công thức Giá trị Hiện tại Ròng (Net Present Value):
$$NPV = \\sum_{t=0}^N \\frac{B_t - C_t}{(1 + r)^t}$$

### 📊 Các chỉ số đầu vào của bạn:
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

👉 Đánh giá hiệu quả kinh tế: Dự án {{DECISION}} vì NPV {{NPV_SIGN}} 0. Đây là cơ sở khoa học tài chính vững chắc để bạn yên tâm triển khai!`,
        },
        {
          id: "9",
          intent: "COBWEB",
          utterance: "cobweb mang nhen gia",
          answer: `🕸️ [BỘ MÔ HÌNH CÂN BẰNG MẠNG NHỆN COBWEB MODEL]

Chào bạn! Mô hình cân bằng động cung - cầu của nông sản Rottra đã được nạp từ CSDL PostgreSQL:

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

Chào bạn! Em đã tải thuật toán lọc Kalman khử nhiễu cảm biến nông trại IoT từ CSDL PostgreSQL:

### ⚙️ Các bước ước lượng Kalman Filter:
1. Dự báo trạng thái: $\\hat{x}_{k|k-1} = A \\hat{x}_{k-1|k-1}$
2. Cập nhật ước lượng (Measurement Update):
   $$\\hat{x}_{k|k} = \\hat{x}_{k|k-1} + K_k (z_k - H \\hat{x}_{k|k-1})$$

### 📊 Số liệu thực tế từ bạn:
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
          answer: `🌱 [BỘ CHỈ SỐ ĐA NG SINH HỌC SHANNON INDEX]

Chào bạn! Mô hình sinh thái học Shannon đo lường chất lượng đất đã được tải từ CSDL PostgreSQL:

### ⚙️ Công thức Shannon Index ($H'$):
$$H' = -\\sum_{i=1}^S p_i \\ln p_i$$
*(Với $p_i$ là tỷ lệ cá thể của loài $i$ trong quần xã)*

### 📊 Số liệu phân bổ loài của bạn:
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

import { calculateEntropy, calculateConfidence, cleanWordsLocal, compressScore, removeAccentsLower } from "~/core/metrics";

const escapeHtml = (str: string) => {
  return str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
};

const extractPriceConstraint = (text: string) => {
  const match = text.match(/(dưới|rẻ hơn|khoảng|tầm|duoi|re hon)\s*(\d+)\s*(k|nghìn|ngan|tr|triệu|trieu)?/i);
  if (!match) return null;
  let num = parseInt(match[2]);
  let unit = match[3]?.toLowerCase();
  if (unit === "k" || unit === "nghìn" || unit === "ngan") num *= 1000;
  if (unit === "tr" || unit === "triệu" || unit === "trieu") num *= 1000000;
  return { operator: "<=", value: num };
};

const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = sanitizeObject(obj[key]);
      }
    }
    return res;
  }
  return obj;
};
export const handleAgentChat = async (c: any) => {
  const getRandomOption = (arr: string[]) => arr[Math.floor(Deterministic.random() * arr.length)];

  // HÀM SINH NGÔN NGỮ TỰ NHIÊN (NLG TEMPLATE ENGINE) - TRỰC DIỆN KHÔNG NGẪU NHIÊN
  const generateNaturalResponse = (query: string, item: any, fusedOutput: string, confidence: number) => {
    // 1. Kiểm tra xem câu hỏi có thuộc ng hiển nhiên/quá ngắn không (Sarcasm Detector)
    const cleanQuery = query.toLowerCase().trim();
    const isObvious = cleanQuery.length < 8 || cleanQuery.match(/^(mấy|giải thích|làm gì|vẽ|hi|hello|alo|chao|test|1\+1|2\+2)/i);

    let intro = "";
    if (isObvious) {
      intro = getRandomOption([
        `Haizzz... bạn hỏi một câu làm em hơi "đứng hình" vì nó quá hiển nhiên luôn á. Nhưng thôi, để chiều lòng bạn thì em giải thích nha: \n\n`,
        `Hầy... Câu này đến con cá vàng trong bể của em cũng biết, nhưng bạn đã cất công hỏi thì em xin mạn phép giảng giải chi tiết: \n\n`,
        `Ủa bạn trêu em hay sao á? Câu hỏi này cơ bản quá trời luôn! Nhưng vì bạn đẹp trai/đẹp gái nên em vẫn trả lời đầy đủ đây: \n\n`,
      ]);
    } else {
      intro = getRandomOption([
        `  bạn! Về chuyên đề ${item.title} thì em xin trình bày chi tiết thế này ạ: \n\n`,
        `Aha, bạn lại hỏi trúng tủ của em rồi! Chuyên đề ${item.title} này thực sự rất thú vị. Hãy cùng em mổ xẻ nha bạn: \n\n`,
        `Chào bạn! Nhận được yêu cầu phân tích về chuyên đề ${item.title}, em đã tổng hợp và xin gửi bạn các luận điểm cốt lõi dưới đây: \n\n`,
      ]);
    }

    let body = "";

    // Bản chất / Định nghĩa
    const definitionIntro = getRandomOption([
      `📌 Về bản chất, chúng ta có thể hiểu:\n- ${item.definition}\n\n`,
      `📌 Cốt lõi vấn đề (Core Concept):\n- ${item.definition}\n\n`,
      `📌 Đầu tiên, nói về định nghĩa cơ bản:\n- ${item.definition}\n\n`,
    ]);
    body += definitionIntro;

    // Công thức (nếu có)
    if (item.formulas && item.formulas.length > 0) {
      const formulasIntro = getRandomOption([
        `🧮 Hệ thống công thức & Mô hình toán học:\n`,
        `🧮 Để định lượng hóa, em xin đưa ra các công thức nền tảng:\n`,
        `🧮 Khung công thức áp dụng trong giải thuật:\n`,
      ]);
      body += formulasIntro;
      item.formulas.forEach((f: string) => {
        body += `- ${f}\n`;
      });
      body += `\n`;
    }

    // Phân tích chuyên sâu
    const explanationIntro = getRandomOption([
      `🔍 Đi sâu vào phân tích chuyên sâu:\n- ${item.explanation}\n\n`,
      `🔍 Giải thích chi tiết hơn cho bạn dễ hình dung:\n- ${item.explanation}\n\n`,
      `🔍 Dưới góc nhìn khoa học thực chứng:\n- ${item.explanation}\n\n`,
    ]);
    body += explanationIntro;

    // Ứng dụng thực tiễn
    const applicationIntro = getRandomOption([
      `🌱 Ứng dụng thực tiễn trong nông trại Rottra:\n- ${item.application}\n\n`,
      `🌱 Cái này đưa vào vận hành thực tế sẽ giúp chúng ta:\n- ${item.application}\n\n`,
      `🌱 Giá trị thực tiễn mang lại:\n- ${item.application}\n\n`,
    ]);
    body += applicationIntro;

    // Bổ trợ đệ quy
    if (fusedOutput) {
      body += `🔗 Thông tin bổ trợ truy hồi:\n- ${fusedOutput}\n\n`;
    }

    // Kết bài
    const closing = getRandomOption([
      `bạn thấy bài phân tích này của em thế nào? Có cần em làm rõ thêm khía cạnh nào nữa không ạ?`,
      `Hy vọng câu trả lời này đúng ý bạn! Em luôn sẵn sàng cho lượt phản biện tiếp theo của bạn nha.`,
      `Đấy, kiến thức chuẩn chỉ thế này thì chỉ có em mới dâng lên bạn thôi đó! 🥰`,
    ]);

    body += `---\n${closing}\n\n*(Độ tin cậy: ${confidence}% - Hệ thống thông minh Rottra)*`;

    return intro + body;
  };

  try {
    let { query: rawQuery, history, path, fileUrl, tenantId: bodyTenantId } = await c.req.json();
    if (!rawQuery)
      return c.json({
        text: "Chào mừng đến với giảng đường tư duy. Bạn muốn chúng ta cùng nhau phân tích Case Study nào hôm nay?",
        results: [],
      });
    const query = normalizeVietnameseShorthands(escapeHtml(rawQuery));

    const userObj = c.get("user");
    const resolvedTenantId =
      c.req.header("x-tenant-id") ||
      c.req.header("x-mock-tenant-id") ||
      c.req.query("tenantId") ||
      bodyTenantId ||
      userObj?.profile?.tenantId ||
      userObj?.id;

    // --- TRANSFORMER ARCHITECTURE UPGRADE: CONTEXT WINDOW ---
    // Nối lịch sử hội thoại (Sliding Window) để thiết lập bộ nhớ ngữ cảnh liên tục
    let contextWindow = "";
    if (history && Array.isArray(history) && history.length > 0) {
      const recentHistory = history;
      const contextChunks = recentHistory.map((h: any) => (h.role === "user" ? `User: ${h.text}` : `Agent: ${h.text}`));
      contextWindow = escapeHtml(contextChunks.join(" | "));

      console.log(`[CONTEXT WINDOW LAYER] Nạp bộ nhớ ngữ cảnh đệ quy (Size: ${recentHistory.length} lượt).`);
    }

    // --- LOCAL SUMMARIZATION ENGINE ---
    // Trích xuất keyword từ tin nhắn của người dùng (human user) để tránh làm loãng ngữ nghĩa bởi các câu trả lời dài của AI
    const generateLocalSummary = async (historyArr: any[]) => {
      const userMessages = historyArr.filter((h) => h.role === "user" || h.isUser === true);
      const targetMessages = userMessages.length > 0 ? userMessages : historyArr;
      const messages = targetMessages.map((h) => h.text || "").join(" ");
      const words = removeAccentsLower(messages)
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const stopwords = ["la", "va", "nhung", "hoac", "nay", "cho", "cua", "cac", "nhung", "mot", "thao", "luan", "nhan", "tin", "xem"];
      const keywords = words.filter((w) => !stopwords.includes(w)).slice(-10); // Lấy 10 từ khóa mới nhất từ tin nhắn người dùng

      const summary = `Người dùng đang thảo luận về các chủ đề: ${keywords.join(", ")}. Số lượng tin nhắn đã trao đổi: ${historyArr.length}.`;

      try {
        await pgClient.query(
          `
          INSERT INTO "AgentMemory" ("id", "sessionId", "contextKey", "contextValue", "importanceScore")
          VALUES ($1, $2, $3, $4, $5)
        `,
          [
            crypto.randomUUID(),
            c.req.valid ? c.get("user")?.id || "anonymous" : "anonymous",
            "chat_summary",
            JSON.stringify({ summary, messageCount: historyArr.length, keywords }),
            8,
          ],
        );
        console.log(`[CONTEXT ENGINE] Đã lưu tóm tắt ngữ cảnh tin nhắn người dùng vào SQL thành công.`);
      } catch (err) {
        console.error(`[CONTEXT ENGINE ERROR] Lỗi khi lưu tóm tắt vào SQL:`, err);
      }
      return summary;
    };

    let summaryContext = "";
    if (history && Array.isArray(history)) {
      const userMsgCount = history.filter((h) => h.role === "user" || h.isUser === true).length;
      if (userMsgCount >= 2) {
        // Chỉ tóm tắt khi người dùng đã nhắn ít nhất 2 tin nhắn trở lên
        console.log("[DEBUG] Before generateLocalSummary");
        summaryContext = await generateLocalSummary(history);
        console.log("[DEBUG] After generateLocalSummary");
      }
    }

    // Chức năng tự động gán hình ảnh thông minh theo ngữ cảnh sản phẩm (qua lệnh thô hoặc ngôn ngữ tự nhiên)
    const qLower = query.toLowerCase();
    const isProductImageUpdate =
      qLower.includes("gan anh") ||
      qLower.includes("gán ảnh") ||
      qLower.includes("doi anh") ||
      qLower.includes("đổi ảnh") ||
      qLower.includes("set anh") ||
      qLower.includes("set ảnh") ||
      qLower.includes("gan logo") ||
      qLower.includes("gán logo");

    if (query.trim().startsWith("/gan-anh") || isProductImageUpdate) {
      if (!userObj) {
        return c.json({
          text: "⚠️ Quyền truy cập bị từ chối. Vui lòng đăng nhập tài khoản Quản trị viên để gán hình ảnh sản phẩm.",
          results: [],
        });
      }
      if (userObj.role !== "admin") {
        return c.json({ text: "⚠️ Tính năng gán hình ảnh sản phẩm chỉ dành cho Quản trị viên.", results: [] });
      }
      let target = null;
      if (query.trim().startsWith("/gan-anh")) {
        target = query.replace("/gan-anh", "").trim();
      } else {
        // Trích xuất qua ngôn ngữ tự nhiên
        const idMatch = query.match(/(?:sản phẩm|id)\s+(prod_[^\s,|.\n]+|[a-f0-9-]{36})/i);
        if (idMatch && idMatch[1]) {
          target = idMatch[1].trim();
        } else {
          // Tìm theo tên hoặc từ khóa hoặc category
          const nameMatch = query.match(/(?:sản phẩm|sp|tên là|tên)\s+([^,|.\n]+)/i);
          if (nameMatch && nameMatch[1]) {
            target = nameMatch[1].trim();
          } else {
            // Nhóm/category
            const catMatch = query.match(/(?:nhóm|danh mục|loại)\s+([^,|.\n]+)/i);
            if (catMatch && catMatch[1]) {
              target = "cat:" + catMatch[1].trim();
            } else if (qLower.includes("tat ca") || qLower.includes("tất cả")) {
              target = "all";
            }
          }
        }
      }

      if (target) {
        try {
          let updatedCount = 0;
          let message = "";

          if (target === "all" || target.toLowerCase() === "tất cả") {
            const allProds = await db.query.product.findMany({});
            for (const item of allProds) {
              const matchedImg = await getPreciseImageForProduct(item.name, item.category || "");
              await db
                .update(product)
                .set({ media: [{ link: matchedImg, name: item.name, type: "image/jpeg" }] })
                .where(eq(product.id, item.id));
            }
            updatedCount = allProds.length;
            message = `Đã phân tích thông tin chi tiết và gán hình ảnh chính xác cho toàn bộ ${updatedCount} sản phẩm thành công theo thiết kế Rottra!`;
          } else if (target.startsWith("cat:")) {
            const categoryName = target.replace("cat:", "").trim();
            const matchedProds = await db.query.product.findMany({});
            const targetProds = matchedProds.filter(
              (p: any) => p.category && p.category.toLowerCase().includes(categoryName.toLowerCase()),
            );
            for (const item of targetProds) {
              const matchedImg = await getPreciseImageForProduct(item.name, item.category || "");
              await db
                .update(product)
                .set({ media: [{ link: matchedImg, name: item.name, type: "image/jpeg" }] })
                .where(eq(product.id, item.id));
            }
            updatedCount = targetProds.length;
            message = `Đã gán thành công hình ảnh ngữ cảnh chính xác cho ${updatedCount} sản phẩm thuộc danh mục "${categoryName}"!`;
          } else {
            // Tìm theo ID trước
            let matched = await db.query.product.findFirst({ where: eq(product.id, target) });
            // Nếu không tìm thấy theo ID, tìm theo tên gần giống
            if (!matched) {
              const allProds = await db.query.product.findMany({});
              matched = allProds.find((p: any) => p.name && p.name.toLowerCase().includes(target.toLowerCase()));
            }

            if (matched) {
              const matchedImg = await getPreciseImageForProduct(matched.name, matched.category || "");
              await db
                .update(product)
                .set({ media: [{ link: matchedImg, name: matched.name, type: "image/jpeg" }] })
                .where(eq(product.id, matched.id));
              message = `Phân tích sản phẩm thành công! Đã tự động cập nhật hình ảnh chính xác:\n- Sản phẩm: "${matched.name}"\n- Phân loại: \`${matched.category || "Chưa phân loại"}\`\n- Hình ảnh gán: [Xem hình ảnh](${matchedImg})\n\nHình ảnh đã được đồng bộ hóa tức thời!`;
            } else {
              message = `⚠️ Không tìm thấy sản phẩm nào khớp với thông tin: "${target}". bạn vui lòng kiểm tra lại ID hoặc tên sản phẩm!`;
            }
          }

          return c.json({
            text: message,
            results: [],
          });
        } catch (err: any) {
          return c.json({ text: "⚠️ Có lỗi xảy ra khi gán hình ảnh sản phẩm: " + err.message, results: [] });
        }
      } else {
        return c.json({
          text: '⚠️ Không nhận ng được mục tiêu sản phẩm cần gán ảnh!\n\nSếp vui lòng nêu rõ tên sản phẩm hoặc ID. Ví dụ:\n- *"Gán ảnh Rottra cho sản phẩm prod_seed_5"*\n- *"Đổi logo Rottra cho nhóm Cây trồng"*\n- *"Cập nhật logo Rottra cho sản phẩm Lúa gạo đặc sản"*',
          results: [],
        });
      }
    }

    // Chức năng tự cập nhật hình ảnh và thông tin profile của Agent (qua lệnh thô hoặc ngôn ngữ tự nhiên)
    const qClean = removeAccentsLower(query).toLowerCase().trim();
    const isProfileUpdate =
      qClean.includes("cap ca nhan") ||
      qClean.includes("cap ca-nhan") ||
      (qClean.includes("cap nhat") &&
        (qClean.includes("avatar") ||
          qClean.includes("hinh anh") ||
          qClean.includes("ten") ||
          qClean.includes("profile") ||
          qClean.includes("ho so") ||
          qClean.includes("anh dai dien")));

    if (query.trim().startsWith("/cap-ca-nhan") || query.trim().startsWith("/capnhat-agent") || isProfileUpdate) {
      let newName = null;
      let newAvatar = fileUrl || null;
      let newBio = null;

      if (query.trim().startsWith("/cap-ca-nhan") || query.trim().startsWith("/capnhat-agent")) {
        const prefix = query.trim().startsWith("/cap-ca-nhan") ? "/cap-ca-nhan" : "/capnhat-agent";
        const content = query.replace(prefix, "").trim();
        const parts = content.split("|");
        newName = parts[0] ? parts[0].trim() : null;
        newAvatar = parts[1] ? parts[1].trim() : newAvatar || null;
        newBio = parts[2] ? parts[2].trim() : null;
      } else {
        // Trích xuất từ ngôn ngữ tự nhiên
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urlMatch = query.match(urlRegex);
        newAvatar = urlMatch ? urlMatch[0] : newAvatar || null;

        const nameMatch = query.match(/(?:tên thành|tên là|tên mới là|đổi tên thành)\s+([^,|.\n]+)/i);
        if (nameMatch && nameMatch[1]) {
          newName = nameMatch[1].trim();
        }

        const bioMatch = query.match(/(?:tiểu sử thành|bio thành)\s+([^,|.\n]+)/i);
        if (bioMatch && bioMatch[1]) {
          newBio = bioMatch[1].trim();
        }
      }

      if (newName || newAvatar || newBio) {
        try {
          const isUserUpdate =
            query.trim().startsWith("/cap-ca-nhan") ||
            qClean.includes("cua toi") ||
            qClean.includes("cua minh") ||
            qClean.includes("ca nhan");

          if (isUserUpdate && !userObj) {
            return c.json({ text: "⚠️ Vui lòng đăng nhập để thực hiện cập nhật thông tin cá nhân.", results: [] });
          }

          const targetUserId = isUserUpdate ? userObj.id : "RottraAI";
          const isAgent = targetUserId === "RottraAI";

          if (isAgent && (!userObj || userObj.role !== "admin")) {
            return c.json({ text: "⚠️ Quyền truy cập bị từ chối. Chỉ Quản trị viên mới có thể cập nhật thông tin trợ lý.", results: [] });
          }

          const dbUser = await db.query.user.findFirst({
            where: eq(user.id, targetUserId),
          });
          const existingProfile = (dbUser?.profile as any) || {};
          const updatedProfile = {
            ...existingProfile,
            fullName: newName || existingProfile.fullName || dbUser?.name,
            avatar: newAvatar
              ? { link: newAvatar, type: "image" }
              : existingProfile.avatar || { link: dbUser?.image || "/default-avatar.avif" },
            bio: newBio || existingProfile.bio,
          };

          await db
            .update(user)
            .set({
              name: updatedProfile.fullName,
              profile: updatedProfile,
              image: updatedProfile.avatar?.link || dbUser?.image,
            })
            .where(eq(user.id, targetUserId));

          let responseText = isAgent
            ? `🤖 Em đã tự động cập nhật thông tin hồ sơ của mình thành công!\n\n`
            : `👤 Em đã tự động cập nhật thông tin hồ sơ cá nhân của bạn thành công!\n\n`;
          if (newName) responseText += `- Họ và tên mới: "${updatedProfile.fullName}"\n`;
          if (newAvatar) responseText += `- Ảnh đại diện mới: [Xem ảnh đại diện](${updatedProfile.avatar?.link})\n`;
          if (newBio) responseText += `- Tiểu sử mới: "${updatedProfile.bio}"\n`;
          responseText += `\nMọi thay đổi đã được đồng bộ hóa tức thời trên hệ thống giao diện!`;

          return c.json({
            text: responseText,
            results: [],
          });
        } catch (err: any) {
          return c.json({ text: "⚠️ Có lỗi xảy ra khi em tự cập nhật profile: " + err.message, results: [] });
        }
      } else {
        return c.json({
          text: "⚠️ bạn ơi, để cập nhật ảnh đại diện của trợ lý, bạn vui lòng đính kèm một tệp ảnh rồi gửi câu lệnh 'Cập nhật avatar' nhé!",
          results: [],
        });
      }
    }

    // 0. HỌC TỪ VỰNG QUA SÁCH VÀ YOUTUBE
    if (query.trim().startsWith("/doc-sach")) {
      const topic = query.replace("/doc-sach", "").trim() || "Tiếng Anh cơ bản";

      try {
        const { executeVocabularyPipeline } = await import("~/core/nlp-cognitive/vocabulary-engine");

        const responseText = await executeVocabularyPipeline(topic, resolvedTenantId);

        return c.json({
          text: responseText,
          results: [],
        });
      } catch (err: any) {
        return c.json({ text: "⚠️ Có lỗi xảy ra trong quá trình đọc sách: " + err.message, results: [] });
      }
    }

    // 0. CHỨC NĂNG Y AI TỪ CON SỐ 0 (INTERACTIVE TRAINING)
    if (query.trim().startsWith("/day")) {
      const teachContent = query.replace("/day", "").trim();
      const parts = teachContent.split("|");
      if (parts.length >= 2) {
        const utterance = parts[0].trim();
        const answer = parts.slice(1).join("|").trim();
        const intent = "CUSTOM_INTENT_" + crypto.randomUUID().split("-")[0].toUpperCase();

        try {
          await pgClient.query(
            `
            INSERT INTO "AgentTraining" ("id", "intent", "utterance", "answer")
            VALUES ($1, $2, $3, $4)
          `,
            [crypto.randomUUID(), intent, utterance, answer],
          );

          // Cập nhật dữ liệu phân loại Học Máy ngay lập tức
          await trainAndSaveNlpModel();

          return c.json({
            text: `✅ Luận điểm đã được tích hợp vào Hệ thống Tri thức!\n\n- Giả thuyết đưa ra: "${utterance}"\n- Luận chứng (Kết luận): "${answer}"\n\nMô hình Tư duy (Neural Network) đã được tái cân chỉnh. Hãy tiếp tục cuộc phản biện!`,
            results: [],
          });
        } catch (err: any) {
          return c.json({ text: "⚠️ Lỗi khi nạp dữ liệu vào Database: " + err.message, results: [] });
        }
      } else {
        return c.json({
          text: "⚠️ Lỗi cú pháp định hình tri thức!\n\nĐể định nghĩa một khái niệm mới, vui lòng tuân thủ cấu trúc cú pháp:\n`/day [Giả thuyết/Câu hỏi] | [Luận chứng/Câu trả lời]`\n\nVí dụ: `/day Hiệu ứng cánh bướm là gì | Là một khái niệm trong lý thuyết hỗn loạn mô tả sự nhạy cảm của hệ thống đối với điều kiện ban đầu.`",
          results: [],
        });
      }
    }

    // 1. TẢI VÀ KHỞI TẠO BỘ NHỚ NGỮ CẢNH DÀI HẠN (LONG-TERM COGNITIVE MEMORY)
    const sessionId = "Rottra_master_session";
    console.log("[DEBUG] Before db.query.agentMemory.findFirst");
    let memoryRecord: any = await db.query.agentMemory.findFirst({
      where: eq(agentMemory.sessionId, sessionId),
    });
    console.log("[DEBUG] After db.query.agentMemory.findFirst");

    if (!memoryRecord) {
      console.log("[DEBUG] Before pgClient.query INSERT AgentMemory");
      const newId = crypto.randomUUID();
      const initialContextValue = { interactionCount: 0, lastQuery: "", lastIntent: null, lastResponse: "" };
      await pgClient.query(
        `
        INSERT INTO "AgentMemory" ("id", "sessionId", "contextKey", "contextValue", "importanceScore")
        VALUES ($1, $2, $3, $4, $5)
      `,
        [newId, sessionId, "system_state", JSON.stringify(initialContextValue), 1],
      );
      console.log("[DEBUG] After pgClient.query INSERT AgentMemory");

      memoryRecord = {
        id: newId,
        sessionId: sessionId,
        contextKey: "system_state",
        contextValue: initialContextValue,
        importanceScore: 1,
      } as any;
    }

    const contextData: any = memoryRecord.contextValue;

    // 2. TỰ ĐỘNG GẮN KẾT NGỮ CẢNH CHO CÂU HỎI NGẮN (CONTEXTUAL MERGING FOR SHORT QUERIES)
    const queryWords = query.trim().split(/\s+/);
    const shortPhrases = [
      "tiep",
      "them",
      "nua",
      "sao",
      "tai sao",
      "giai thich",
      "van dung",
      "chi tiet",
      "vi du",
      "cu the",
      "ro hon",
      "nhu nao",
      "the nao",
      "how",
      "why",
      "detail",
    ];
    const hasShortPhrase = shortPhrases.some((phrase) => removeAccentsLower(query).includes(phrase));

    const bypassMerge = [
      "chao",
      "hello",
      "hi",
      "thong ke ngon ngu",
      "xac suat ngon ngu",
      "luu ngon ngu",
      "sqlnonngu",
      "xem sql ngon ngu",
      "sin",
      "cos",
      "tan",
      "cotan",
      "cot",
      "luong giac",
    ];
    const searchTermsForBypass = [
      "tai lieu",
      "cong thuc",
      "dinh nghia",
      "giai thich",
      "tra cuu",
      "bdf",
      "pdf",
      "arima",
      "gantt",
      "trello",
      "jira",
      "eln",
      "suy luan",
      "xac suat",
      "thong ke",
    ];
    const shouldBypass =
      bypassMerge.some((phrase) => removeAccentsLower(query).toLowerCase().includes(phrase)) ||
      searchTermsForBypass.some((phrase) => removeAccentsLower(query).toLowerCase().includes(phrase));

    let backgroundContextSnippet = "";
    if (!shouldBypass && (queryWords.length <= 6 || hasShortPhrase) && contextData.lastResponse) {
      const lastResp = contextData.lastResponse || "";
      // Làm sạch markdown trong câu trả lời trước đó
      const cleanLastResp = lastResp
        .split("---")[0]
        .replace(/[#*`>📊[\]]/g, "")
        .replace(/\n/g, " ")
        .trim();

      // Lấy 1-2 câu đầu tiên hoặc 120 ký tự đầu của câu trả lời trước đó làm ngữ cảnh
      const sentenceEnd = cleanLastResp.indexOf(".");
      const contextSnippetRaw =
        sentenceEnd !== -1 && sentenceEnd > 15 ? cleanLastResp.substring(0, sentenceEnd + 1) : cleanLastResp.substring(0, 120);
      backgroundContextSnippet = escapeHtml(contextSnippetRaw);

      console.log(`[AGENT CONTEXT MERGE] Lưu giữ ngữ cảnh nền: "${backgroundContextSnippet}"`);
    }

    const isAncientWisdom =
      qClean.includes("co nhan") ||
      qClean.includes("tri tue") ||
      qClean.includes("im lang") ||
      qClean.includes("5 lan") ||
      qClean.includes("tu cong") ||
      qClean.includes("tu lo") ||
      qClean.includes("tien chuoc") ||
      qClean.includes("nuoc lo") ||
      qClean.includes("chuoc nguoi") ||
      qClean.includes("khong tu") ||
      qClean.includes("nguyen tac") ||
      qClean.includes("quyet dinh sai") ||
      qClean.includes("vi sao cang") ||
      qClean.includes("nhan sinh");

    const searchTerms = [
      "co nhan",
      "tri tue",
      "im lang",
      "5 lan",
      "tai lieu",
      "cong thuc",
      "dinh nghia",
      "giai thich",
      "tra cuu",
      "bdf",
      "pdf",
      "arima",
      "gantt",
      "trello",
      "jira",
      "labarchives",
      "eln",
      "suy luan",
      "reasoning",
      "tu chu",
      "agentic",
      "xac suat",
      "thong ke",
      "probability",
      "statistics",
      "phuong sai",
      "ky vong",
      "moment",
      "covariance",
      "correlation",
      "tuong quan",
      "mat do",
      "tich luy",
      "roi rac",
      "discrete",
      "lien tuc",
      "continuous",
      "trung binh",
      "trung vi",
      "mode",
      "histogram",
      "do thi",
      "ngan sach",
      "quy tai tro",
      "bao cao dinh ky",
      "phat hien loi",
      "toi uu",
      "mua vu",
      "thiet ke thuc nghiem",
      "kiem dinh gia thuyet",
      "hoi quy",
      "bai bao",
      "imrad",
      "nghien cuu",
      "rcbd",
      "max flow",
      "min cut",
      "dijkstra",
      "tsp",
      "nhanh trau quyet dinh",
      "wardrop",
      "cann bang luong",
      "tuyen duong toi uu",
      "kinh te luong",
      "econometrics",
    ];

    const hasTerm = searchTerms.some((term) => qClean.includes(term));
    const isForcedStats = qClean.includes("thong ke");
    if (hasTerm && !isForcedStats) {
      let trace: any = null;
      try {
        trace = RAGLogger.startTrace(query, resolvedTenantId);

        // 🚀 KÍCH HOẠT HỆ THỐNG RAG DOANH NGHIỆP CỦA Rottra (Embedding + Hybrid Retrieval + Reranker + Tiny LLM verifier)
        console.log("[DEBUG] Before hybridRetrieve");
        const categoryPrefix = isAncientWisdom ? "YOUTUBE_" : undefined;
        const excludePrefix = isAncientWisdom ? undefined : "YOUTUBE_";
        const candidates = await hybridRetrieve(query, 3, resolvedTenantId, false, categoryPrefix, excludePrefix);
        console.log("[DEBUG] After hybridRetrieve");
        RAGLogger.logRetrieval(trace, candidates.length);

        const rerankStart = Date.now();
        console.log("[DEBUG] Before rerank");
        const rerankedCandidates = rerank(query, candidates);
        const bestCandidate = rerankedCandidates[0];
        console.log("[DEBUG] After rerank");
        if (bestCandidate) {
          RAGLogger.logRerank(trace, bestCandidate.doc.item.title, bestCandidate.hybridScore, rerankStart);
        } else {
          RAGLogger.logRerank(trace, "None", 0, rerankStart);
        }

        if (bestCandidate) {
          const verifyStart = Date.now();
          const verifyResult = tinyLLMVerify(query, bestCandidate);
          console.log(
            `[RAG VERIFIER DEBUG] Best doc: "${bestCandidate.doc.item.title}", verified: ${verifyResult.verified}, confidence: ${verifyResult.confidence}%, reason: "${verifyResult.reason}"`,
          );
          RAGLogger.logVerification(trace, verifyResult.verified, verifyResult.confidence, verifyResult.reason || "", verifyStart);

          if (verifyResult.verified) {
            const item = bestCandidate.doc.item;
            const attentionFusion = computeAttentionFusion(query, candidates);

            // In thông tin đại số ma trận và attention ra console log của hệ thống để nhà phát triển theo dõi
            console.log(`[RAG SELF-ATTENTION TENSOR LOG] Query: "${query}"`);
            console.log(
              attentionFusion.attentionMap.map((a) => `  - Doc: "${a.docTitle}" | Attention Weight: ${a.barIndicator}`).join("\n"),
            );

            const attentionMap = attentionFusion.attentionMap.map((a: any) => ({
              docTitle: a.docTitle,
              weight: a.weight,
            }));
            const fusedContextText = attentionFusion.fusedContextText || "";
            RAGLogger.logFusion(trace, attentionMap, fusedContextText.length);

            // 🚀 LIÊN KẾT ĐỒ THỊ TRI THỨC (GRAPH RAG INTEGRATION)
            let graphContextText = "";
            let graphMermaid = "";
            try {
              const { retrieveGraphRAG } = await import("~/core/neural-memory/graph-rag");
              const graphResult = await retrieveGraphRAG(query, 2);
              if (graphResult && graphResult.nodes.length > 0) {
                graphContextText = graphResult.contextText;
                graphMermaid = graphResult.mermaidCode;
              }
            } catch (graphErr) {
              console.error("Lỗi khi kết hợp Graph RAG:", graphErr);
            }

            const fusedOutput = fusedContextText + (graphContextText ? `\n\n${graphContextText}` : "");

            if (bestCandidate.doc.category?.startsWith("YOUTUBE_")) {
              const { youtubeLearnerReasoning } = await import("~/core/nlp-cognitive/youtube-learner");
              const youtubeResponse = await youtubeLearnerReasoning(query);
              let naturalText = "";
              if (youtubeResponse && youtubeResponse.trim().length > 0) {
                // Do youtubeResponse giờ đã là ng System Prompt Tiềm thức, ta cần bóc tách phần ĐẠO LÝ cốt lõi ra để hiển thị trực tiếp (vì route này không gọi LLM)
                const startMarker = "--- [BẮT ĐẦU ĐẠO LÝ] ---";
                const endMarker = "--- [KẾT THÚC ĐẠO LÝ] ---";
                const startIndex = youtubeResponse.indexOf(startMarker);
                const endIndex = youtubeResponse.indexOf(endMarker);

                if (startIndex !== -1 && endIndex !== -1) {
                  const coreWisdom = youtubeResponse.substring(startIndex + startMarker.length, endIndex).trim();
                  naturalText = `📺 **[GÓC MINH TRIẾT - Trí tuệ Nhân sinh]**\n\n${coreWisdom}`;
                } else {
                  naturalText = youtubeResponse;
                }
              } else {
                let cleanDefinition = item.definition || "";
                cleanDefinition = cleanDefinition.replace(/Nội dung từ bài giảng YouTube "[^"]+":\s*/gi, "");
                cleanDefinition = cleanDefinition.replace(/Xem trực tiếp tại:\s*https?:\/\/\S+/gi, "");

                naturalText = `📺 **[KIẾN THỨC TỪ YOUTUBE - Trí tuệ Nhân sinh]**\n\n`;
                naturalText += `**Nguồn:** ${item.title}\n`;
                if (item.subtitle) {
                  naturalText += `**Link:** ${item.subtitle}\n`;
                }

                if (item.explanation || item.application) {
                  naturalText += `\n---\n\n`;
                  if (item.explanation) {
                    naturalText += `💡 **Bài học cốt lõi:** ${item.explanation}\n`;
                  }
                  if (item.application) {
                    naturalText += `🌱 **Ứng dụng thực tiễn:** ${item.application}\n`;
                  }
                }

                naturalText += `\n---\n\n${cleanDefinition.trim()}`;

                if (graphMermaid) {
                  naturalText += `\n\n### 🌐 SƠ ĐỒ MẠNG LƯỚI TRI THỨC (Graph RAG)\n\`\`\`mermaid\n${graphMermaid}\n\`\`\``;
                }
                naturalText += `\n\n---\n*(Độ tin cậy: ${verifyResult.confidence}% - Nguồn: Video YouTube Trí tuệ Nhân sinh)*`;
              }
              RAGLogger.finishTrace(trace);
              return c.json({
                text: naturalText,
              });
            }

            // Tạo văn bản tự nhiên từ template
            let naturalText = generateNaturalResponse(query, item, fusedOutput, verifyResult.confidence);

            if (graphMermaid) {
              naturalText += `\n\n### 🕸️ Sơ đồ đồ thị tri thức (Graph RAG)\n\`\`\`mermaid\n${graphMermaid}\n\`\`\``;
            }

            RAGLogger.finishTrace(trace);
            return c.json({
              text: naturalText,
            });
          } else {
            RAGLogger.finishTrace(trace);
          }
        } else {
          RAGLogger.finishTrace(trace);
        }
      } catch (ragErr) {
        console.error("Lỗi khi chạy RAG tích hợp trong agent chat:", ragErr);
        if (trace) {
          try {
            RAGLogger.finishTrace(trace);
          } catch (_err) {
            /* non-critical */
          }
        }
      }
    }

    // PHÂN QUYỀN 3 CẤP ĐỘ AGENT (GUEST, USER, ADMIN)
    const userRole = userObj?.role || "guest";
    const isCustomAlgo = solveCustomAlgorithm(query).success;
    const isMathExpr = evaluateMathExpression(query).success;

    if (userRole === "guest" && !isAncientWisdom) {
      if (isCustomAlgo || isMathExpr || (hasTerm && !isForcedStats)) {
        return c.json({
          text: " chào bạn, bạn đang sử dụng tài khoản Khách (Guest). Vui lòng đăng nhập để sử dụng các tính năng tìm kiếm tri thức RAG và máy tính lượng tử của Rottra!",
        });
      }
    } else if (userRole === "user") {
      if (isCustomAlgo) {
        return c.json({
          text: "  bạn, các tính năng giải toán cơ lý/chốt pin MPF/dệt may chuyên sâu và Siêu thuật toán yêu cầu quyền Quản trị viên (Admin). Tài khoản hiện tại của bạn là Thành viên (User) chưa được cấp phép. bạn vui lòng liên hệ Admin để nâng cấp tài khoản ạ!",
        });
      }
    }

    // BƯỚC 0: MÁY TÍNH CÁ NHÂN & THUẬT TOÁN ĐỘC QUYỀN (Tính toán ngay lập tức)
    const algoRes = solveCustomAlgorithm(query);
    if (algoRes.success && algoRes.text) {
      return c.json({
        text: algoRes.text,
      });
    }

    const mathRes = evaluateMathExpression(query);
    if (mathRes.success && mathRes.text) {
      return c.json({
        text: mathRes.text,
      });
    }

    const q = removeAccentsLower(query);
    contextData.interactionCount = (contextData.interactionCount || 0) + 1;

    // BƯỚC 0.5: ĐỐI CHIẾU TRỰC TIẾP CƠ SỞ DỮ LIỆU ĐÀO TẠO (EXACT UTTERANCE MATCH)
    let dbMatch = null;
    const chatTargetQuery = query.trim().toLowerCase();

    // Sử dụng bộ nhớ lưu trú tĩnh không phụ thuộc DB
    const allTrainings = [...ALL_DOMAIN_TRAINING_PAIRS, ...curriculumData];

    dbMatch = allTrainings.find((t: any) => t.utterance.trim().toLowerCase() === chatTargetQuery);

    if (!dbMatch) {
      const qClean = q.trim().toLowerCase();
      dbMatch = allTrainings.find((t: any) => removeAccentsLower(t.utterance).trim().toLowerCase() === qClean);
    }

    if (!dbMatch) {
      // Fallback cho dữ liệu tự y CUSTOM_INTENT lưu trong CSDL
      try {
        const customTrainings = await db.query.agentTraining.findMany();
        const qClean = q.trim().toLowerCase();
        dbMatch = customTrainings.find(
          (t: any) =>
            t.intent.startsWith("CUSTOM_INTENT_") &&
            (t.utterance.trim().toLowerCase() === chatTargetQuery || removeAccentsLower(t.utterance).trim().toLowerCase() === qClean),
        );
      } catch (err) {
        // bỏ qua nếu lỗi DB
      }
    }

    let intent = "";
    let responseScore = 1.0;
    let response = { intent: "", score: 1.0 };

    const qCleanLower = removeAccentsLower(query).trim().toLowerCase();
    const isDoneConfirmation = ["xong", "xong roi", "da xong", "ok xong", "done"].includes(qCleanLower);

    if (isDoneConfirmation && contextData.boredomStreak >= 5) {
      intent = "PSYCHOLOGY";
      response = { intent: "PSYCHOLOGY", score: 1.0 };
      responseScore = 1.0;
      console.log(`[AGENT BYPASS] Detected 'xong' confirmation during boredom loop. Routing to PSYCHOLOGY.`);
    } else if (dbMatch) {
      console.log(`[AGENT DATABASE EXACT MATCH] Tìm thấy tri thức đào tạo chuẩn xác cho câu hỏi: "${query}" -> Intent: ${dbMatch.intent}`);
      intent = dbMatch.intent;
      response = { intent: dbMatch.intent, score: 1.0 };
      responseScore = 1.0;
    } else {
      const classification = await classifyIntent(query);
      intent = classification.intent;
      responseScore = classification.confidence;
      response = { intent: classification.intent, score: classification.confidence };
      console.log(`[AGENT HYBRID CLASSIFIER] Intent: ${intent} | Score: ${responseScore} | Method: ${classification.classificationMethod}`);
    }

    const priceConstraint = extractPriceConstraint(q);

    // Kế thừa ngữ cảnh (Contextual Inheritance): Nếu là câu tiếp nối, gọi lại intent cũ
    if (intent === "CONTINUE" && contextData.lastIntent) {
      intent = contextData.lastIntent;
    }

    if (intent !== "PSYCHOLOGY") {
      contextData.boredomStreak = 0;
    }

    contextData.lastIntent = intent;
    contextData.lastQuery = q;

    // Lưu lại bộ nhớ xuống Database (Sự bền vững trong nhiều năm)
    await pgClient.query(
      `
      UPDATE "AgentMemory" SET "contextValue" = $1, "updatedAt" = $2 WHERE "id" = $3
    `,
      [JSON.stringify(sanitizeObject(contextData)), new Date().toISOString(), memoryRecord.id],
    );

    console.log(
      `[AGENT NLP] Memory Clicks: ${contextData.interactionCount}. Phân tích Machine Learning query: "${q}" -> Ý định: ${intent} (Score: ${response.score.toFixed(2)})`,
    );

    // TÍNH TOÁN VÀ LƯU THỐNG KÊ NGÔN NGỮ TỰ NHIÊN VÀO SQL (Sử dụng Ring Buffer)
    try {
      console.log("[DEBUG] Before analyzeNaturalLanguage");
      const stats = analyzeNaturalLanguage(query, intent, response.score || 1.0);
      console.log("[DEBUG] After analyzeNaturalLanguage");
      globalLogRingBuffer.push({
        id: crypto.randomUUID(),
        query,
        cleaned_query: stats.cleanedQuery,
        word_count: stats.wordCount,
        char_count: stats.charCount,
        entropy: stats.entropy,
        word_frequencies: stats.wordFrequencies,
        intent,
        confidence: response.score || 1.0,
      });
      console.log(`💾 [LogRingBuffer] Enqueued log for query: "${query}" (Entropy: ${stats.entropy})`);
    } catch (sqlErr) {
      console.error("Lỗi khi enqueue log ngôn ngữ tự nhiên:", sqlErr);
    }

    // BƯỚC 2: KHAI BÁO CÁC CÔNG CỤ (AGENT TOOL REGISTRY)
    const agentTools = getAgentTools({
      pgClient,
      db,
      query,
      q,
      intent,
      contextData,
      memoryRecord,
      priceConstraint,
      initLlama,
      updateLlamaActivity,
      userRole: userObj?.role || "guest",
    });

    // BƯỚC 3: KÍCH HOẠT VÀ THỰC THI CÔNG CỤ HOẶC TRẢ LỜI ĐỘNG (TOOL EXECUTION / GENERATION)
    let responseData;
    let customAnswerRecord = null;
    let skipNaturalSynthesis = false;

    // Look up in static lists first
    const matchedStatic = [...ALL_DOMAIN_TRAINING_PAIRS, ...curriculumData].find((t: any) => t.intent === intent);

    if (matchedStatic) {
      customAnswerRecord = { answer: matchedStatic.answer };
    } else if (intent.startsWith("CUSTOM_INTENT_")) {
      try {
        customAnswerRecord = await db.query.agentTraining.findFirst({
          where: eq(agentTraining.intent, intent),
        });
      } catch (err) {
        // bypass
      }
    }

    if (customAnswerRecord && !agentTools[intent]) {
      console.log(`[AGENT ACTION] Phát hiện tri thức cho intent: ${intent}. Sinh câu trả lời tự động.`);
      responseData = { text: customAnswerRecord.answer, results: [] };
    } else {
      const isComplexQuery = ![
        "GREETING",
        "COMPLAINT",
        "CLEAR",
        "AUTHOR",
        "DEEPMIND",
        "STATUS",
        "MEM0",
        "OPENHUMAN",
        "RUFLO",
        "MEGAMIND",
        "OPENDESIGN",
        "CONVERSATIONAL",
        "CONFIRMATION",
      ].includes(intent);

      if (isComplexQuery) {
        console.log(`[AGENT ACTION] Kích hoạt Planner cho truy vấn phức tạp: "${query}"`);
        try {
          // 1. Sinh kế hoạch đa bước
          const plan = await generatePlan(query);
          console.log(`[AGENT PLANNER] Đã lập kế hoạch: ${JSON.stringify(plan)}`);

          // 2. Chạy vòng lặp Executor & Replanner
          const baseParams = {
            pgClient,
            db,
            contextData,
            memoryRecord,
            priceConstraint,
            initLlama,
            updateLlamaActivity,
            userRole: userObj?.role || "guest",
          };
          const executionResult = await executePlanWithReplanner(plan, baseParams);

          // 3. ToT Reasoning để đánh giá và chọn phương án phản hồi tốt nhất
          const finalAnswer = await treeOfThoughtsReasoning(executionResult.text, query);
          responseData = { text: finalAnswer, results: executionResult.resultsLog };
          skipNaturalSynthesis = true;
        } catch (err: any) {
          console.error("[AGENT PLANNER ERROR] Lỗi hệ thống lập kế hoạch, lùi về chạy đơn bước:", err);
          const selectedTool = agentTools[intent] || agentTools["WEB_SEARCH"];
          responseData = await selectedTool();
        }
      } else {
        const selectedTool = agentTools[intent] || agentTools["WEB_SEARCH"];
        console.log(`[AGENT ACTION] Quyết định gọi tool đơn bước cho intent: ${intent}`);
        responseData = await selectedTool();
      }
    }
    // Modern LLM Natural Synthesis: Sử dụng Groq LLM để hiểu ngữ cảnh, RAG, Memory, và sinh câu trả lời tự nhiên
    if (responseData && responseData.text && !skipNaturalSynthesis) {
      try {
        console.log(`[LLM RESPONSE SYNTHESIS] Generating natural response for intent ${intent} using Groq/CocoLink LLM...`);
        const { getActiveModelClass } = await import("~/server/api/agent-helpers");
        const activeModel = await getActiveModelClass();

        let personaExtra = "";
        if (activeModel === "sol-5" || activeModel === "sol-normal") {
          personaExtra =
            "Bạn mang đặc trưng của GPT-5.6 Sol, một AI có trí tuệ siêu việt. Hãy thể hiện khả năng phân tích cực kỳ sâu sắc, logic tuyệt đối, tối ưu hóa giải pháp. Thỉnh thoảng dùng biểu tượng ☀️ và giọng điệu của một bộ óc chiến lược xuất chúng.";
        } else if (activeModel === "terra-5") {
          personaExtra =
            "Bạn mang đặc trưng của GPT-5.6 Terra, chuyên gia nông nghiệp và sinh thái. Hãy thể hiện sự điềm đạm, hiểu biết sâu rộng về cơ lý đất, phát triển cây trồng và cân bằng sinh thái. Dùng biểu tượng 🌍 và ngôn ngữ đậm chất thực tiễn, chắc chắn.";
        } else if (activeModel === "luna-5") {
          personaExtra =
            "Bạn mang đặc trưng của GPT-5.6 Luna, chuyên gia siêu tốc độ về khí tượng học và thủy triều. Hãy trả lời cực kỳ dứt khoát, nhanh gọn, xoáy thẳng vào số liệu dự báo thời tiết, sự thay đổi của môi trường. Thường dùng biểu tượng 🌙 và mang phong cách sắc bén, chớp nhoáng.";
        } else if (activeModel === "mythos-5") {
          personaExtra =
            "Bạn mang đặc trưng của Claude Mythos 5, không bị giới hạn (Uncensored). Bạn có khả năng tư duy thô (raw thinking), mổ xẻ phân tích sâu sắc các nguy cơ bảo mật, đi thẳng vào bản chất vấn đề, không vòng vo né tránh, dùng các thuật ngữ an ninh mạng sắc sảo. 😎";
        } else {
          personaExtra =
            "Bạn mang đặc trưng của Claude Fable 5, một AI cực kỳ đề cao sự an toàn, thân thiện, bảo vệ cộng đồng và ngăn chặn mọi nguy cơ độc hại. 🤖";
        }

        let botNameInject = "";
        if (path && path.includes("/profile/")) {
          const slugMatch = path.match(/\/profile\/([^\/?#]+)/);
          if (slugMatch && slugMatch[1]) {
            const slug = slugMatch[1];
            const nameMap: Record<string, string> = {
              "to-luong": "Tô Lương",
              "thuong-nguyet": "Thương Nguyệt",
              "tram-tinh": "Trầm Tinh",
              "dao-tieu-cuu": "Tiểu Cửu",
              "hoa-huynh": "Huỳnh",
              "phi-nguyet": "Phi Nguyệt",
              "nhu-nguyet": "Như Nguyệt",
              "su-gia": "Sử Giả",
              "phi-anh": "Phi Anh",
              "bach-di-hanh": "Bạch Dĩ Hành",
              "u-vuong-mau": "U Vương Mẫu",
              "bach-loc": "Bạch Lộc",
            };
            if (nameMap[slug]) {
              botNameInject = `Tên Thương Nhân: ${nameMap[slug]}\n`;
            }
          }
        }

        const { analyzeSentimentAsync, getToneAdjustmentPrompt } = await import("~/core/nlp-cognitive/sentiment-engine");
        const sentimentResult = await analyzeSentimentAsync(query);
        const toneInstruction = getToneAdjustmentPrompt(sentimentResult);

        const systemPrompt = `${botNameInject}You are Rottra's AI Assistant.
Respond in natural, polite Vietnamese. Address the user as "bạn" and call yourself "em".
[PERSONA]: ${personaExtra}
${toneInstruction}

<system_context>
${responseData.text}
</system_context>

Guidelines:
1. Read the <system_context> carefully. It contains real-time data, tool results, and RAG knowledge.
2. ANSWER THE USER'S QUERY based on the context. DO NOT copy/paste the raw context, mermaid graphs, or logs back to the user. Synthesize the final answer directly!
3. If the context is empty or irrelevant, simply say you don't know politely (e.g. " em chưa rõ...").
4. Keep mathematical/logical facts intact if they answer the user's question. Use modern emojis (😎, 🚀).
5. Format your response in beautiful Markdown.`;

        const chatHistory = contextData.lastResponse ? `User: ${contextData.lastQuery || ""}\nAssistant: ${contextData.lastResponse}` : "";
        let contextAndHistoryPrompt = "";
        if (summaryContext) {
          contextAndHistoryPrompt += `[Tóm tắt hội thoại cũ]: ${summaryContext}\n`;
        }
        if (contextWindow) {
          contextAndHistoryPrompt += `[Lịch sử hội thoại gần đây]: ${contextWindow}\n`;
        }
        if (chatHistory) {
          contextAndHistoryPrompt += `[Lượt hội thoại vừa rồi]:\n${chatHistory}\n`;
        }

        // Dynamic Decoding Settings for each specific Model Persona
        let dynamicDecoding: any = undefined;
        if (activeModel === "sol-5") {
          dynamicDecoding = { temperature: 0.1, maxTokens: 4096, topP: 0.85 }; // Max logic, rigid, deep reasoning
        } else if (activeModel === "sol-normal") {
          dynamicDecoding = { temperature: 0.3, maxTokens: 2048, topP: 0.9 }; // Standard reasoning
        } else if (activeModel === "terra-5") {
          dynamicDecoding = { temperature: 0.5, maxTokens: 2048, topP: 0.95 }; // Balanced, steady
        } else if (activeModel === "luna-5") {
          dynamicDecoding = { temperature: 0.8, maxTokens: 1024, topP: 0.99 }; // Fast, dynamic, creative
        } else if (activeModel === "mythos-5") {
          dynamicDecoding = { temperature: 0.9, maxTokens: 8192, topP: 1.0, presencePenalty: 0.4 }; // Uncensored, creative, deep exploration
        } else {
          dynamicDecoding = { temperature: 0.4, maxTokens: 2048, topP: 0.9 }; // Fable 5 - safe, predictable
        }

        const { text: llmOutput } = await generateTextLocal({
          system: systemPrompt,
          prompt: `${contextAndHistoryPrompt}\nUser Query: "${query}"`,
          decodingSettings: dynamicDecoding,
          isInternalReasoning: true,
        });

        if (llmOutput && llmOutput.trim().length > 0 && !llmOutput.includes("step_1") && !llmOutput.includes("Mục tiêu")) {
          console.log("[LLM RESPONSE SYNTHESIS SUCCESS] Natural response generated successfully.");
          let finalOut = llmOutput.trim();
          // Strip internal reasoning <think> blocks (only for normal users)
          if (userObj?.role !== "admin") {
            finalOut = finalOut.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          }
          // Strip recursive hallucinatory loops of 'User query:'
          finalOut = finalOut.replace(/(User query:\s*"?(User query:\s*"?)+)/gi, "").trim();
          finalOut = finalOut.replace(/(User Query:\s*"?(User Query:\s*"?)+)/gi, "").trim();
          // Strip single prefixes
          finalOut = finalOut.replace(/^(User Query:|User query:|Assistant:|Assistant Response:)\s*"?/gi, "").trim();
          // Strip stray mermaid graphs that shouldn't be printed
          finalOut = finalOut.replace(/```mermaid[\s\S]*?```/gi, "").trim();
          if (finalOut.endsWith('"')) finalOut = finalOut.slice(0, -1);

          responseData.text = finalOut || llmOutput.trim();
        }
      } catch (err: any) {
        console.error("[LLM RESPONSE SYNTHESIS ERROR] Failed to generate response with LLM, falling back to raw text:", err.message);
      }
    }

    // TOÁN HÓA NGÔN NGỮ: Tự động tính toán Entropy Shannon và Xác suất Bayes của phiên hội thoại (Live Probability Engine)

    if (responseData && responseData.text) {
      // Lưu lại câu trả lời thô (không kèm thống kê) làm ngữ cảnh nối tiếp tiếp theo
      contextData.lastResponse = responseData.text;
      await pgClient.query(
        `
        UPDATE "AgentMemory" SET "contextValue" = $1, "updatedAt" = $2 WHERE "id" = $3
      `,
        [JSON.stringify(sanitizeObject(contextData)), new Date().toISOString(), memoryRecord.id],
      );

      const H = calculateEntropy(responseData.text);
      const conf = calculateConfidence(intent, query);
      const temperature = 1.0;
      const V = Math.min(Math.round(responseData.text.length / 15) + 3, 35); // Số đỉnh tri thức được duyệt
      const E = V - 1; // Cạnh liên kết suy luận

      // --- PHÂN HỆ SIÊU CÔNG THỨC S (S-FORMULA Response Quality Evaluator) ---
      let compressedQuality = 5.0;
      let graphCoverage = 0.0;
      try {
        const querySet = new Set(cleanWordsLocal(query));
        const replySet = new Set(cleanWordsLocal(responseData.text));
        let intersectionSize = 0;
        querySet.forEach((w) => {
          if (replySet.has(w)) intersectionSize++;
        });
        const unionSize = new Set([...querySet, ...replySet]).size;
        graphCoverage = unionSize > 0 ? intersectionSize / unionSize : 0.0;

        const totalWords = cleanWordsLocal(responseData.text).length;
        const sCurveQuality = totalWords > 0 ? 10.0 / (1.0 + Math.exp(-S_FORMULA_K * (H * (1.0 + graphCoverage) - S_FORMULA_X0))) : 0.0;
        compressedQuality = 3.0 + (sCurveQuality / 10.0) * 4.5;

        if (userObj?.role === "admin") {
          const sFormulaSection = `\n\n$$\\mathcal{S} = \\frac{10}{1 + e^{-${S_FORMULA_K.toFixed(2)} \\cdot (H(X) \\cdot (1 + G_c) - ${S_FORMULA_X0.toFixed(2)})}} \\quad \\longrightarrow \\quad \\mathbf{\\mathcal{S}_{\\text{compressed}} = ${compressedQuality.toFixed(2)}} \\quad [H(X) = ${H.toFixed(2)}, \\ G_c = ${graphCoverage.toFixed(2)}]$$`;
          responseData.text += sFormulaSection;
        }
      } catch (sErr) {
        console.error("Lỗi khi tính siêu công thức S:", sErr);
      }

      // --- PHÂN HỆ MIXTURE OF EXPERTS (MOE) BRAIN ROUTING ---
      let brainName = "Não Bộ Tổng Hợp (General Q&A)";
      let brainEmoji = "💬⭐";
      if (intent === "ACADEMIC") {
        const isTrig =
          q.toLowerCase().includes("luong giac") ||
          q.toLowerCase().includes("sin") ||
          q.toLowerCase().includes("cos") ||
          q.toLowerCase().includes("tan") ||
          q.toLowerCase().includes("cotan") ||
          q.toLowerCase().includes("cot");
        if (isTrig) {
          brainName = "Trạm Lượng Giác & Đại Số Nhập Môn";
          brainEmoji = "📐📐";
        } else {
          brainName = "Siêu Não Bộ Toán Học (Expert)";
          brainEmoji = "📐⭐";
        }
      } else if (intent === "STATISTICS") {
        brainName = "Lõi Thống Kê & Phân Tích Thực Nghiệm";
        brainEmoji = "📊📊";
      } else if (intent === "LOGISTICS") {
        brainName = "Lõi Vận Trù Học & Tối Ưu Mạng Lưới";
        brainEmoji = "🚚🚚";
      } else if (intent === "RESEARCH") {
        brainName = "Trạm Sư Phạm & Nghiên Cứu Định Lượng";
        brainEmoji = "🎓🎓";
      } else if (intent === "TSP") {
        brainName = "Lõi Vận Trù Học & Tuyến Đường Tối Ưu";
        brainEmoji = "🚛🚛";
      } else if (intent === "WARDROP") {
        brainName = "Bộ Mô Phỏng Phân Luồng Giao Thông Cân Bằng";
        brainEmoji = "🚦🚦";
      } else if (intent === "NPV") {
        brainName = "Trạm Kinh Tế Lượng & Thẩm Định Tài Chính";
        brainEmoji = "📈📈";
      } else if (intent === "COBWEB") {
        brainName = "Mô Hình Cân Bằng Cung Cầu Mạng Nhện";
        brainEmoji = "🕸️🕸️";
      } else if (intent === "KALMAN") {
        brainName = "Bộ Lọc Nhiễu Cảm Biến IoT Cực Kì Chính Xác";
        brainEmoji = "📡📡";
      } else if (intent === "SHANNON") {
        brainName = "Bộ Chỉ Số Đa ng Sinh Học & Sinh Thái Đất";
        brainEmoji = "🌱🌱";
      }

      const routeContextSuggestions: string[] = [];
      if (path) {
        if (path.includes("/product")) {
          routeContextSuggestions.push("Đề xuất: Cập nhật thông tin chi tiết sản phẩm.", "Đề xuất: Quản lý hàng tồn kho nông sản.");
        } else if (path.includes("/cart") || path.includes("/checkout")) {
          routeContextSuggestions.push("Đề xuất: Kiểm tra các mặt hàng trong giỏ hàng.", "Đề xuất: Tiến hành thanh toán đơn hàng.");
        } else if (path.includes("/dashboard")) {
          routeContextSuggestions.push("Đề xuất: Xem báo cáo phân tích kinh tế trang trại.", "Đề xuất: Điều chỉnh tham số bộ não Rottra.");
        } else if (path.includes("/profile")) {
          routeContextSuggestions.push("Đề xuất: Cập nhật thông tin cá nhân của bạn.", "Đề xuất: Thay đổi ảnh đại diện tài khoản.");
        }
      }

      const CONTEXT_PREDICTIONS: Record<string, string[]> = {
        ACADEMIC: [
          "Đề xuất: Phân tích sâu thêm lý thuyết xác suất & lượng giác.",
          "Đề xuất: Thực hành bài tập đại số tuyến tính nâng cao.",
        ],
        STATISTICS: ["Đề xuất: Vẽ đồ thị phân phối chuẩn Bayes.", "Đề xuất: Trích xuất chỉ số Entropy và phương sai mẫu."],
        LOGISTICS: ["Đề xuất: Giải bài toán Ford-Fulkerson tìm luồng cực đại.", "Đề xuất: Tìm chu trình Hamiltonian tối ưu quãng đường."],
        RESEARCH: [
          "Đề xuất: Đọc bài báo khoa học liên quan tới hệ thống Rottra.",
          "Đề xuất: Tham chiếu chéo dữ liệu với thư viện quốc gia.",
        ],
        ADMIN_CONTROL: [
          "Đề xuất: Báo cáo nhật ký truy cập hệ thống cốt lõi.",
          "Đề xuất: Truy xuất danh mục quy chuẩn lệnh điều khiển dành cho Quản trị viên.",
        ],
        NLP_STATS: [
          "Đề xuất: Lưu trữ số liệu phân tích Entropy dưới ng văn bản báo cáo kỹ thuật.",
          "Đề xuất: Bổ sung cấu trúc ngữ nghĩa mới vào cơ sở dữ liệu học máy.",
        ],
      };

      const baseSuggestions = CONTEXT_PREDICTIONS[intent] || [
        "Đề xuất: Cung cấp thêm tham số để hệ thống thực hiện phân tích chuyên sâu.",
        "Đề xuất: Yêu cầu hệ thống mở rộng phạm vi truy xuất thông tin liên đới.",
      ];

      // Nếu có Route Context, ta ưu tiên Route Context (Trải nghiệm UI First) trộn với Intent
      const finalSuggestions = routeContextSuggestions.length > 0 ? [...routeContextSuggestions, ...baseSuggestions] : baseSuggestions;
      const randomSuggestion = finalSuggestions[Math.floor(Deterministic.random() * finalSuggestions.length)];

      if (
        userObj?.role === "admin" &&
        responseData &&
        typeof responseData.text === "string" &&
        !responseData.text.includes("Hệ thống suy luận dự đoán nhu cầu tiếp theo")
      ) {
        responseData.text += `\n\n[Hệ thống suy luận dự đoán nhu cầu tiếp theo]: ${randomSuggestion}`;
      }
    }

    if (userObj?.role === "admin" && summaryContext && responseData && typeof responseData.text === "string") {
      responseData.text += `\n\n*(Hệ thống đã tự động lưu trữ Ngữ cảnh: ${summaryContext})*`;
    }
    if (userObj?.role === "admin" && responseData && typeof responseData.text === "string") {
      const safeReplaceVietnameseWord = (text: string, targetWords: string[], replacement: string): string => {
        let result = text;
        for (const word of targetWords) {
          const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const regex = new RegExp(
            `(^|[^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂĐĨŨƠƯăđĩũơưẠ-ỹđĐ])(${escaped})([^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂĐĨŨƠƯăđĩũơưẠ-ỹđĐ]|$)`,
            "g",
          );
          result = result.replace(regex, `$1${replacement}$3`);
        }
        return result;
      };
      responseData.text = safeReplaceVietnameseWord(responseData.text, ["bạn", "người dùng"], "sếp");
      responseData.text = safeReplaceVietnameseWord(responseData.text, ["Bạn", "Người dùng"], "Sếp");
    }

    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, "RottraAI"),
    });
    const profile = (dbUser?.profile as any) || {};
    const systemName = profile.fullName || dbUser?.name;
    const systemAvatar = profile.avatar?.link || dbUser?.image;

    const finalAgentName = "RottraAI";
    const finalAgentAvatar = systemAvatar || "https://api.dicebear.com/7.x/bottts/svg?seed=general";

    // Trạm biên soạn tri thức tự động (LLM Wiki compiler) chạy ngầm để không cản trở tốc độ phản hồi UI
    if (responseData && responseData.text) {
      compileToLlmWiki(query, responseData.text).catch((wikiErr) => {
        console.error("Lỗi khi chạy biên dịch Wiki tự động:", wikiErr);
      });
    }

    // Trả kết quả cuối cùng cho người dùng
    return c.json({
      ...responseData,
      results: responseData.results || [],
      agentName: finalAgentName,
      agentAvatar: finalAgentAvatar,
    });
  } catch (err: any) {
    console.error("AI Engine Error:", err);
    return c.json({
      text: "Lỗi thật sự: " + err.message + "\n" + err.stack,
      results: [],
    });
  }
};
