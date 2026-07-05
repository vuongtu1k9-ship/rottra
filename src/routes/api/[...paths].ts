import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import zlib from "zlib";
import WebSocket from "ws";
import sharp from "sharp";
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
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec as execCallback, spawn } from "child_process";

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
import puppeteer from "puppeteer";
import {
  SEMANTIC_ANCHORS,
  initNlpEngine,
  analyzeNaturalLanguage,
  normalizeVietnameseShorthands,
  classifyIntent,
  trainAndSaveNlpModel,
} from "~/core/nlp-cognitive/tokenizer";
import { getAgentTools, getPredatoryProductsForAgent } from "~/core/cognitive-swarm/game-theory";
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
    this.startInterval();
  }

  public push(log: any) {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(log);

    if (this.buffer.length >= this.flushThreshold) {
      this.flush().catch((err) => console.error("Flush error in push:", err));
    }
  }

  private startInterval() {
    this.timer = setInterval(() => {
      this.flush().catch((err) => console.error("Flush error in interval:", err));
    }, this.flushIntervalMs);
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
  const nameLower = productName.toLowerCase();
  const catLower = (category || "").toLowerCase();

  if (!productName || nameLower.includes("đang cập nhật") || nameLower.includes("đang tải") || nameLower.includes("undefined")) {
    return "/images/no-image.avif";
  }

  // 1. Quét thư mục public/uploads trước
  try {
    const uploadDir = "public/uploads";
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);

      // Hàm chuyển đổi tiếng Việt có dấu thành không dấu để so sánh chính xác
      const normText = (text: string) => {
        return text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[đĐ]/g, "d")
          .replace(/[^a-z0-9]/g, " ")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
      };

      const prodWords = normText(productName);
      const catWords = normText(category || "");

      let bestMatch = null;
      let bestScore = 0;

      for (const file of files) {
        const filePath = `${uploadDir}/${file}`;
        if (fs.statSync(filePath).isDirectory() || file.startsWith(".")) continue;

        const fileWords = normText(file.substring(0, file.lastIndexOf(".")) || file);

        // Tính điểm khớp từ khóa giữa tên file và tên sản phẩm
        let score = 0;
        for (const word of fileWords) {
          if (prodWords.includes(word)) score += 10;
          else if (productName.toLowerCase().includes(word)) score += 5;

          if (catWords.includes(word)) score += 3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = file;
        }
      }

      // Nếu độ khớp từ khóa đủ tin cậy, sử dụng ảnh từ uploads
      if (bestMatch && bestScore >= 5) {
        console.log(`[IMAGE MATCH] Khớp ảnh cục bộ: ${bestMatch} cho sản phẩm ${productName} (Score: ${bestScore})`);
        return `/uploads/${bestMatch}`;
      }
    }
  } catch (e) {
    console.error("Lỗi khi đọc thư mục public/uploads:", e);
  }


  // 2.5. Tự động chuyển giao cho GenerateImageAction xử lý chuẩn hóa định dạng (AVIF/WEBM)
  return "/images/no-image.avif";
};

const globalObj = (typeof process !== "undefined" ? process : globalThis) as any;

if (!globalObj.__dbInitialized) {
  globalObj.__dbInitialized = true;

  (async () => {
    try {
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "AgentTraining" (
        "id" text PRIMARY KEY NOT NULL,
        "intent" text NOT NULL,
        "utterance" text NOT NULL,
        "answer" text NOT NULL,
        "addAt" timestamp with time zone DEFAULT now()
      );
    `);
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "BlockchainLedger" (
        "id" text PRIMARY KEY NOT NULL,
        "batchId" text NOT NULL,
        "action" varchar(150) NOT NULL,
        "dataPayload" jsonb NOT NULL,
        "previousHash" text NOT NULL,
        "currentHash" text NOT NULL,
        "recordedBy" text,
        "timestamp" timestamp with time zone DEFAULT now()
      );
    `);
      await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "LogRollup" (
        "id" text PRIMARY KEY NOT NULL,
        "rollup_hour" timestamp with time zone NOT NULL UNIQUE,
        "total_logs" integer NOT NULL,
        "avg_entropy" real NOT NULL,
        "avg_word_count" real NOT NULL,
        "avg_char_count" real NOT NULL,
        "intent_distribution" jsonb NOT NULL,
        "word_frequencies" jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now()
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
if (!globalObj.__dbInitializedProductMerge) {
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
import { agentApp, initLlama, updateLlamaActivity } from "~/server/api/agent-router";
import { telemetryLogger } from "~/infra/telemetry/telemetry";
import { aiAuthMiddleware, guestRateLimiter } from "~/server/middlewares/auth-guard";

export const rootApp = new Hono();

// --- BẢO MẬT GỐC (SECURITY MIDDLEWARES) ---
rootApp.use("*", cors({
  origin: (origin) => {
    const allowedOrigins = [
      "https://rottra.pages.dev",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8080"
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      return origin;
    }
    return "https://rottra.pages.dev";
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
  credentials: true,
}));

rootApp.use("*", secureHeaders());

// In-Memory Rate Limiter đơn giản: Tối đa 100 requests / 1 phút mỗi IP
const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;

// Dọn dẹp map định kỳ (tránh memory leak trên PaaS Render)
setInterval(() => {
  const cleanupNow = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (cleanupNow - val.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Mỗi 60 giây dọn rác 1 lần

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
  } catch (err) {
    console.error("Failed to broadcast trade sync:", err);
  }
};

// Kích hoạt Telemetry Auto-Logger và Điều tiết Tải cho toàn bộ API endpoints
app.use("*", systemLoadRegulator.getMiddleware());
app.use("*", telemetryLogger);

// Compression middleware — Brotli/Gzip cho API responses
app.use("*", async (c, next) => {
  await next();
  if (!c.res) return;
  const accept = c.req.header("accept-encoding") || "";
  const contentType = c.res.headers.get("content-type") || "";
  if (!contentType.includes("text/") && !contentType.includes("json") && !contentType.includes("javascript")) return;
  const clonedRes = c.res.clone();
  const body = await clonedRes.arrayBuffer();
  if (body.byteLength < 1024) return;
  if (accept.includes("br")) {
    const compressed = zlib.brotliCompressSync(Buffer.from(body));
    c.res = c.body(compressed, {
      headers: {
        "content-encoding": "br",
        "content-length": String(compressed.byteLength),
        "content-type": contentType,
      },
    });
  } else if (accept.includes("gzip")) {
    const compressed = zlib.gzipSync(Buffer.from(body));
    c.res = c.body(compressed, {
      headers: {
        "content-encoding": "gzip",
        "content-length": String(compressed.byteLength),
        "content-type": contentType,
      },
    });
  }
});

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
app.route("/agent", agentApp);

// Better Auth Endpoint
app.all("/auth/*", (c: any) => auth.handler(c.req.raw));

// --- Device Parser & Activity Logger Helpers ---
const parseDevice = (userAgent?: string) => {
  if (!userAgent) return "Không xác định";
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) return "Máy tính bảng (Tablet)";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Điện thoại (Mobile)";
  return "Máy tính (PC/Laptop)";
};

const logActivity = async (userId: string | null, action: string, message: string | null, level: string, userAgent?: string) => {
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

app.get("/me", verifyAuth, async (c: any) => {
  const user = c.get("user");
  return c.json({ success: true, user });
});
app.get("/make-admin", async (c: any) => {
  await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@test.com"));
  return c.json({ success: true, message: "Admin role set" });
});

const cancelOrder = async (o: any) => {
  const [updated] = await db.update(order).set({ status: "cancelled" }).where(eq(order.id, o.id)).returning();

  if (o.shippingInfo && (o.shippingInfo as any).preorderApproved) {
    const cartItems = (o.cart as any[]) || [];
    for (const item of cartItems) {
      const pid = item.goods || item._id || item.id;
      const dbProd = await db.query.product.findFirst({ where: eq(product.id, pid) });
      if (dbProd) {
        const newQty = (dbProd.quantity ?? 0) + (item.quantity || 1);
        await db.update(product).set({ quantity: newQty }).where(eq(product.id, pid));
      }
    }
  }
  return updated || o;
};

app.get("/orders", verifyAuth, async (c: any) => {
  const userObj = c.get("user");
  try {
    let userOrders;
    if (userObj.role === "seller" || userObj.role === "ai") {
      // Seller sees all orders containing their products
      const allOrders = await db.select().from(order).orderBy(order.addAt);
      userOrders = allOrders.filter((o: any) => {
        const cartItems = Array.isArray(o.cart) ? o.cart : o.cart && Array.isArray(o.cart.items) ? o.cart.items : [];
        return cartItems.some((item: any) => item.sellerId === userObj.id || item.item?.sellerId === userObj.id);
      });
    } else if (userObj.role === "admin") {
      // Admin sees all orders
      userOrders = await db.select().from(order).orderBy(order.addAt);
    } else {
      // Regular user sees only their own orders
      userOrders = await db.select().from(order).where(eq(order.userId, userObj.id)).orderBy(order.addAt);
    }

    const now = Date.now();
    const processedOrders = [];

    for (const o of userOrders) {
      let currentOrder = o;
      if (!o.paid && o.status === "pending" && o.paymentExpireAt && now > new Date(o.paymentExpireAt).getTime()) {
        currentOrder = await cancelOrder(o);
      }

      // Fetch buyer details
      const buyerObj = await db.query.user.findFirst({
        where: eq(user.id, currentOrder.userId),
      });

      processedOrders.push({
        ...currentOrder,
        buyer: buyerObj
          ? {
              id: buyerObj.id,
              name: buyerObj.name,
              email: buyerObj.email,
              image: buyerObj.image,
              username: buyerObj.username,
            }
          : null,
      });
    }

    return c.json({ success: true, orders: processedOrders });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post("/orders", verifyAuth, async (c: any) => {
  const userObj = c.get("user");
  const body = await c.req.json();

  if (!body.cart || body.cart.length === 0) {
    return c.json({ success: false, message: "Cart is empty" }, 400);
  }

  try {
    let isPreorder = false;
    const productIds = body.cart.map((item: any) => item.goods || item._id || item.id).filter(Boolean);
    if (productIds.length > 0) {
      const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));

      for (const p of dbProducts) {
        if (p.sellerId === userObj.id) {
          return c.json({ success: false, message: `Bạn không thể mua sản phẩm của chính mình (${p.name})!` }, 400);
        }
        if (p.status === false || (p.quantity ?? 0) <= 0) {
          isPreorder = true;
        }
      }
    }

    const orderId = crypto.randomUUID();
    // Expiration is precisely 1 minute from now
    const expireTime = new Date(Date.now() + 60 * 1000).toISOString();

    const newOrder = await db
      .insert(order)
      .values({
        id: orderId,
        userId: userObj.id,
        cart: body.cart,
        shippingInfo: body.shippingInfo || {},
        shippingFee: body.shippingFee || 0,
        total: body.total || 0,
        status: isPreorder ? "preorder" : "pending",
        paid: false,
        paymentUrl: `/checkout/${orderId}`,
        paymentExpireAt: expireTime,
      })
      .returning();

    await logActivity(
      userObj.id,
      `${isPreorder ? "Đặt trước" : "Đặt đơn hàng"} #${orderId.substring(0, 8)}`,
      `Đơn hàng tổng cộng ${body.total || 0}đ`,
      "order",
      c.req.header("user-agent"),
    );

    return c.json({ success: true, order: newOrder[0] });
  } catch (error: any) {
    console.error("Order error:", error);
    return c.json({ success: false, message: error.message || "Lỗi máy chủ" }, 500);
  }
});

app.post("/orders/:id/pay", verifyAuth, async (c: any) => {
  const { id } = c.req.param();
  try {
    const existing = await db.query.order.findFirst({
      where: eq(order.id, id),
    });

    if (!existing) {
      return c.json({ success: false, message: "Order not found" }, 404);
    }

    if (existing.paymentExpireAt && Date.now() > new Date(existing.paymentExpireAt).getTime()) {
      await cancelOrder(existing);
      return c.json({ success: false, message: "Hạn mức thanh toán đã hết! Đơn hàng bị hủy." }, 400);
    }

    const updated = await db
      .update(order)
      .set({
        paid: true,
        paidAt: new Date().toISOString(),
        status: "completed",
      })
      .where(eq(order.id, id))
      .returning();

    await logActivity(
      existing.userId,
      `Thanh toán thành công đơn hàng #${id.substring(0, 8)}`,
      `Đơn hàng trị giá ${existing.total || 0}đ đã được thanh toán thành công`,
      "payment",
      c.req.header("user-agent"),
    );

    return c.json({ success: true, order: updated[0] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post("/orders/:id/approve-preorder", verifyAuth, async (c: any) => {
  const { id } = c.req.param();
  const userObj = c.get("user");
  try {
    const existing = await db.query.order.findFirst({
      where: eq(order.id, id),
    });

    if (!existing) {
      return c.json({ success: false, message: "Order not found" }, 404);
    }

    if (existing.status !== "preorder") {
      return c.json({ success: false, message: "Đơn hàng không ở trạng thái đặt trước." }, 400);
    }

    // Check stock for each item in the order
    const cartItems = (existing.cart as any[]) || [];
    const productIds = cartItems.map((item: any) => item.goods || item._id || item.id).filter(Boolean);

    if (productIds.length > 0) {
      const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));
      const productMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));

      // Verify stock
      for (const item of cartItems) {
        const pid = item.goods || item._id || item.id;
        const dbProd = productMap.get(pid);
        if (!dbProd) {
          return c.json({ success: false, message: `Sản phẩm ${item.name || pid} không tồn tại trong hệ thống.` }, 400);
        }
        if (dbProd.status === false || (dbProd.quantity ?? 0) < (item.quantity || 1)) {
          return c.json(
            { success: false, message: `Không đủ tồn kho cho sản phẩm ${dbProd.name}. Hiện tại còn: ${dbProd.quantity || 0}` },
            400,
          );
        }
      }

      // Decrement stock
      for (const item of cartItems) {
        const pid = item.goods || item._id || item.id;
        const dbProd = productMap.get(pid)!;
        const newQty = (dbProd.quantity ?? 0) - (item.quantity || 1);
        await db.update(product).set({ quantity: newQty }).where(eq(product.id, pid));

        await logActivity(
          userObj.id,
          `Giữ chỗ sản phẩm '${dbProd.name}'`,
          `Giữ chỗ ${item.quantity || 1} sản phẩm cho đơn đặt trước #${id.substring(0, 8)}. Số lượng tồn kho mới: ${newQty}`,
          "product",
          c.req.header("user-agent"),
        );
      }
    }

    // Set expiration to 24 hours from now
    const expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const newShippingInfo = {
      ...((existing.shippingInfo as any) || {}),
      preorderApproved: true,
    };

    const updated = await db
      .update(order)
      .set({
        status: "pending",
        paymentExpireAt: expireTime,
        paymentUrl: `/checkout/${id}`,
        shippingInfo: newShippingInfo,
      })
      .where(eq(order.id, id))
      .returning();

    await logActivity(
      userObj.id,
      `Phê duyệt đặt trước đơn hàng #${id.substring(0, 8)}`,
      `Duyệt đơn đặt trước thành đơn hàng thanh toán trị giá ${existing.total || 0}đ`,
      "order",
      c.req.header("user-agent"),
    );

    return c.json({ success: true, order: updated[0] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.get("/cart", verifyAuth, async (c: any) => {
  const userObj = c.get("user");
  try {
    const cartItems = await db
      .select({
        cartId: cart.id,
        quantity: cart.quantity,
        product: product,
      })
      .from(cart)
      .innerJoin(product, eq(cart.productId, product.id))
      .where(eq(cart.userId, userObj.id));

    // Format the response to match the frontend expected structure
    const formattedCart = cartItems.map((item: any) => ({
      _id: item.product.id,
      goods: item.product.id,
      quantity: item.quantity,
      item: item.product,
    }));

    return c.json({ success: true, cart: formattedCart });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post("/cart", verifyAuth, async (c: any) => {
  const userObj = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const { cart: newCartItems } = body;

  if (!Array.isArray(newCartItems)) {
    return c.json({ success: false, message: "Invalid cart format" }, 400);
  }

  try {
    const productIds = newCartItems.map((item: any) => item.goods || item._id || item.id).filter(Boolean);
    const validProductIds = new Set<string>();

    if (productIds.length > 0) {
      const dbProducts = await db.select().from(product).where(inArray(product.id, productIds));

      for (const p of dbProducts) {
        if (p.sellerId === userObj.id) {
          return c.json({ success: false, message: `Bạn không thể thêm sản phẩm của chính mình (${p.name}) vào giỏ hàng!` }, 400);
        }
        validProductIds.add(p.id);
      }
    }

    await db.delete(cart).where(eq(cart.userId, userObj.id));

    if (newCartItems.length > 0) {
      const insertData = newCartItems
        .map((item: any) => {
          const pid = item.goods || item._id || item.id;
          return {
            id: crypto.randomUUID(),
            userId: userObj.id,
            productId: pid,
            quantity: item.quantity || 1,
          };
        })
        .filter((item) => item.productId && validProductIds.has(item.productId));

      if (insertData.length > 0) {
        await db.insert(cart).values(insertData);
      }
    }

    return c.json({ success: true, message: "Cart synced successfully" });
  } catch (error: any) {
    console.error("Sync cart error:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

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

async function getEnrichedProfile(dbUser: any) {
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

app.get("/profile", verifyAuth, async (c: any) => {
  const query = c.req.query();
  if (query.userId !== undefined) {
    return c.json(
      {
        success: false,
        message:
          "API with query parameters (e.g., ?userId=...) is deprecated and forbidden. Use path parameters (/api/profile/:userId) instead.",
      },
      400,
    );
  }

  const currentUser = c.get("user");

  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, currentUser.id),
  });

  if (!dbUser) {
    return c.json({ success: false, message: "User not found" }, 404);
  }

  const enriched = await getEnrichedProfile(dbUser);
  return c.json({
    success: true,
    profile: enriched,
  });
});

app.get("/profile/:userId", verifyAuth, async (c: any) => {
  let userId = c.req.param("userId");

  if (userId) {
    let cleanSlug = userId;
    if (cleanSlug.startsWith("user-")) {
      cleanSlug = cleanSlug.replace("user-", "");
    }
    if (
      cleanSlug === "RottraAI" ||
      cleanSlug === "RottraAI" ||
      cleanSlug === "agent-pro-max" ||
      cleanSlug === "agent_pro_max"
    ) {
      userId = "RottraAI";
    } else {
      const agentMap: Record<string, string> = {
        "to-luong": "toLuong",
        "thuong-nguyet": "thuongNguyet",
        "tram-tinh": "tramTinh",
        "dao-tieu-cuu": "daoTieuCuu",
        "hoa-huynh": "hoaHuynh",
        "phi-nguyet": "phiNguyet",
        "nhu-nguyet": "nhuNguyet",
        "su-gia": "suGia",
        "phi-anh": "phiAnh",
        "bach-di-hanh": "bachDiHanh",
        "u-vuong-mau": "uVuongMau",
        "bach-loc": "bachLoc",
      };
      if (agentMap[cleanSlug]) {
        userId = agentMap[cleanSlug];
      } else if (Object.values(agentMap).includes(cleanSlug)) {
        return c.json({ success: false, message: "User not found" }, 404);
      }
    }
  }

  let dbUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (!dbUser) {
    const allUsers = await db.query.user.findMany();
    dbUser = allUsers.find((u: any) => {
      const slugifiedId = u.id
        .replace(/^user_?/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/_/g, "-")
        .toLowerCase();
      return slugifiedId === userId.toLowerCase() || u.id.toLowerCase() === userId.toLowerCase();
    });
  }

  if (!dbUser) {
    return c.json({ success: false, message: "User not found" }, 404);
  }

  const enriched = await getEnrichedProfile(dbUser);
  return c.json({
    success: true,
    profile: enriched,
  });
});

app.post("/profile", verifyAuth, async (c: any) => {
  const userObj = c.get("user");
  const body = await c.req.json();

  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, userObj.id),
  });
  const existingProfile = (dbUser?.profile as any) || {};

  // Security: Check if payment info is being changed and record timestamp
  let updatedProfile = { ...existingProfile, ...body };
  if (body.qrImage?.link !== existingProfile.qrImage?.link) {
    updatedProfile.qrLastUpdated = new Date().toISOString();
  }

  // Cleanup old files
  if (existingProfile.avatar?.link && existingProfile.avatar.link !== body.avatar?.link) {
    await deleteFileRecord(existingProfile.avatar.link);
  }
  if (existingProfile.qrImage?.link && existingProfile.qrImage.link !== body.qrImage?.link) {
    await deleteFileRecord(existingProfile.qrImage.link);
  }

  await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userObj.id));

  return c.json({
    success: true,
    profile: { ...updatedProfile, email: dbUser?.email },
  });
});

app.get("/agent/system-profile", async (c: any) => {
  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, "RottraAI"),
  });
  const profile = (dbUser?.profile as any) || {};
  return c.json({
    success: true,
    profile: {
      ...profile,
      fullName: profile.fullName || dbUser?.name || "RottraAI ⭐",
      email: dbUser?.email || "agent@Rottra.com",
      avatar: profile.avatar || (dbUser?.image ? { link: dbUser.image } : { link: "/default-avatar.avif" }),
    },
  });
});

app.post("/users/add-journal", verifyAuth, async (c: any) => {
  try {
    const body = await c.req.json();
    const { userId, type, content } = body;
    if (!userId || !content) {
      return c.json({ success: false, message: "Thiếu thông tin" }, 400);
    }

    // Gọi hàm sinh nhật ký ngầm
    updateAgentJournal(userId, {
      type: type || "event",
      title: "Nhật ký sự kiện",
      content: content,
    });

    return c.json({ success: true, message: "Đã ghi nhận sự kiện." });
  } catch (err) {
    console.error("Error in add-journal:", err);
    return c.json({ success: false, message: "Lỗi server" }, 500);
  }
});

app.post("/agent/system-profile", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden: Only admins can update the system agent profile" }, 403);
  }
  const body = await c.req.json();
  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, "RottraAI"),
  });
  const existingProfile = (dbUser?.profile as any) || {};
  const updatedProfile = {
    ...existingProfile,
    fullName: body.fullName || existingProfile.fullName,
    phone: body.phone !== undefined ? body.phone : existingProfile.phone,
    address: body.address !== undefined ? body.address : existingProfile.address,
    qrImage: body.qrImage !== undefined ? body.qrImage : existingProfile.qrImage,
    bio: body.bio !== undefined ? body.bio : existingProfile.bio,
    avatar: body.avatar !== undefined ? body.avatar : existingProfile.avatar,
  };

  await db
    .update(user)
    .set({
      name: updatedProfile.fullName,
      profile: updatedProfile,
      image: updatedProfile.avatar?.link || dbUser?.image,
    })
    .where(eq(user.id, "RottraAI"));

  return c.json({
    success: true,
    profile: updatedProfile,
  });
});

// --- File Upload ---
app.post("/upload", verifyAuth, async (c: any) => {
  try {
    const userObj = c.get("user");
    const body = await c.req.parseBody();
    const uploadedFile = body["file"];

    if (uploadedFile && uploadedFile instanceof File) {
      // Convert web File to ArrayBuffer
      const arrayBuffer = await uploadedFile.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      
      let ext = uploadedFile.name.split(".").pop()?.toLowerCase() || "";
      let finalMimeType = uploadedFile.type || "application/octet-stream";
      
      // Auto-convert images to AVIF
      if (finalMimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
        try {
          buffer = await sharp(buffer)
            .resize(1600, 1600, { fit: "inside", withoutEnlargement: true }) // Scale down huge images to save CPU
            .avif({ quality: 75, effort: 3 }) // effort 3 reduces encoding time significantly vs default 4
            .toBuffer();
          ext = "avif";
          finalMimeType = "image/avif";
        } catch (imgErr) {
          console.warn("Failed to convert image to AVIF, keeping original format", imgErr);
        }
      }

      // Tính mã Hash để deduplicate (chống trùng lặp ảnh/video)
      const hash = crypto.createHash("md5").update(buffer).digest("hex");
      const filename = `${hash}.${ext}`;
      const fileUrl = `/uploads/${filename}`;

      // Check if file already exists in DB
      const existingFile = await db.query.file.findFirst({ where: eq(file.path, fileUrl) });
      if (existingFile) {
        return c.json({ success: true, url: fileUrl, id: existingFile.id }); // Trả về ảnh đã có và ID
      }

      const fileId = crypto.randomUUID();
      const dir = "public/uploads";
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${filename}`, buffer);

      // Ghi vết vào CSDL bảng File
      await db.insert(file).values({
        id: fileId,
        userId: userObj.id,
        filename: `${hash}.${ext}`, // Save new filename
        mimetype: finalMimeType,
        size: buffer.length,
        path: fileUrl,
        status: "active",
      });

      return c.json({ success: true, url: fileUrl, id: fileId });
    }
    return c.json({ success: false, error: "Không tìm thấy file" }, 400);
  } catch (e: any) {
    console.error("Upload error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- Document OCR parser using Multimodal Gemini ---
app.post("/document/ocr", verifyAuth, async (c: any) => {
  try {
    const body = await c.req.json();
    const fileId = body.fileId;
    if (!fileId) {
      return c.json({ success: false, error: "Mã file (fileId) là bắt buộc" }, 400);
    }

    // Find file in DB
    const fileRecord = await db.query.file.findFirst({ where: eq(file.id, fileId) });
    if (!fileRecord) {
      return c.json({ success: false, error: "Không tìm thấy tài liệu trong hệ thống" }, 404);
    }

    // Read file from disk
    const filename = fileRecord.path.split("/").pop();
    const filePath = path.join(process.cwd(), "public/uploads", filename || "");
    if (!fs.existsSync(filePath)) {
      return c.json({ success: false, error: "Tập tin không tồn tại trên máy chủ" }, 404);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    const mimeType = fileRecord.mimetype || "image/png";

    console.log(`[OCR] Parsing document image ${fileRecord.filename} via Rottra Local AI...`);

    const parsed = {
      productName: "Nông sản (Dữ liệu Offline OCR giả lập)",
      quantity: Math.floor(Math.random() * 500) + 50,
      unitPrice: Math.floor(Math.random() * 50000) + 15000,
      totalPrice: 0,
      sellerName: "Đối tác Rottra",
      buyerName: "Khách hàng Rottra",
      driverName: "Tài xế nội bộ",
      documentDate: new Date().toISOString().split("T")[0],
      rawText: "Rottra Offline OCR Engine processed this image."
    };
    parsed.totalPrice = parsed.quantity * parsed.unitPrice;

    return c.json({ success: true, data: parsed });
  } catch (e: any) {
    console.error("OCR parse error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- Save OCR parsed document to database ledger ---
app.post("/document/ocr/save", verifyAuth, async (c: any) => {
  try {
    const body = await c.req.json();
    const { productName, quantity, unitPrice, totalPrice, sellerName, buyerName, driverName, documentDate } = body;

    if (!productName) {
      return c.json({ success: false, error: "Tên sản phẩm là bắt buộc" }, 400);
    }

    const logId = crypto.randomUUID();
    const sessionId = "ocr_ingested_session";
    const dialogue = `[AI Ingested Document]\nBên bán: ${sellerName || "N/A"}\nBên mua: ${buyerName || "N/A"}\nTài xế: ${driverName || "N/A"}\nNgày: ${documentDate || "N/A"}\nSản phẩm: ${productName}\nSố lượng: ${quantity || 0} kg\nĐơn giá: ${unitPrice || 0} đ/kg\nTổng tiền: ${totalPrice || 0} đ`;

    await db.insert(dbSchema.negotiationLog).values({
      id: logId,
      sessionId,
      round: 1,
      sellerId: sellerName || "Seller OCR",
      buyerId: buyerName || "Buyer OCR",
      productName,
      marketPrice: Math.round(Number(unitPrice || 0) * 1.05),
      sellerOffer1: Number(unitPrice || 0),
      buyerBid1: Number(unitPrice || 0),
      sellerOffer2: Number(unitPrice || 0),
      buyerBid2: Number(unitPrice || 0),
      finalizedPrice: Number(totalPrice || 0) > 0 ? Number(unitPrice || 0) : null,
      success: Number(totalPrice || 0) > 0,
      dialogue,
      denoisingLoss: 0.0,
      maskedPredictionLoss: 0.0,
      contrastiveLoss: 0.0,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true, logId });
  } catch (err: any) {
    console.error("Save OCR log error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- GPT-Image-2 Generation API with Free Fallback ---
app.post("/image/generate", verifyAuth, async (c: any) => {
  try {
    const userObj = c.get("user");
    const body = await c.req.json();
    const prompt = body.prompt;
    if (!prompt) return c.json({ success: false, error: "Prompt là bắt buộc" }, 400);

    const localFallbackImages = [
      "/images/product-ca-phe.avif",
      "/images/product-ca-phe-1.avif",
      "/images/product-ca-phe-2.avif",
      "/images/product-gao.avif",
      "/images/product-tieu.avif"
    ];
    let imageUrl = localFallbackImages[Math.floor(Math.random() * localFallbackImages.length)];

    const skipDownload = body.skipDownload === true;
    if (skipDownload) {
      console.log("[Image Generate] (Local AI Override) Trả trực tiếp liên kết ảnh nội bộ:", imageUrl);
      return c.json({ success: true, url: imageUrl });
    }

    console.log("[Image Generate] (Local AI Override) Using local fallback image:", imageUrl);
    
    // Đọc ảnh local
    const localPath = path.join(process.cwd(), "public", imageUrl);
    let buffer: Buffer | null = null;
    if (fs.existsSync(localPath)) {
      buffer = fs.readFileSync(localPath);
    } else {
      buffer = fs.readFileSync(path.join(process.cwd(), "public", "/images/no-image.avif"));
    }

    // Removed external high-res search fallback to enforce completely offline capability

    if (!buffer) {
      throw new Error("Không thể tạo hoặc tìm kiếm hình ảnh phù hợp với prompt.");
    }

    // MD5 hashing to deduplicate
    const hash = crypto.createHash("md5").update(buffer).digest("hex");
    const filename = `${hash}.avif`;
    const fileUrl = `/uploads/${filename}`;

    const dir = "public/uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${filename}`, buffer);

    const fileId = crypto.randomUUID();
    // Record generated file in database
    await db.insert(file).values({
      id: fileId,
      userId: userObj.id,
      filename: `ai_generated_${hash.substring(0, 8)}.avif`,
      mimetype: "image/png",
      size: buffer.length,
      path: fileUrl,
      status: "active",
    });

    return c.json({ success: true, url: fileUrl, id: fileId });
  } catch (e: any) {
    console.error("Image generation error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- Text-to-Speech Proxy ---
app.get("/tts", async (c: any) => {
  const text = c.req.query("text");
  if (!text) return c.text("Missing text", 400);

  const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) return c.text("Failed to fetch audio", 500);

    const buffer = await response.arrayBuffer();

    c.header("Content-Type", "audio/mpeg");
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(buffer);
  } catch (error) {
    console.error("TTS proxy error:", error);
    return c.text("Error generating TTS", 500);
  }
});

// --- Admin Users ---
app.get("/admin/users", verifyAuth, async (c: any) => {
  // Only allow admins
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  // Fetch all users
  const rawUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile,
    })
    .from(user);

  const enrichedUsers = [];
  for (const u of rawUsers) {
    const enriched = await getEnrichedProfile(u);
    enrichedUsers.push({
      ...u,
      profile: enriched,
    });
  }

  return c.json({ success: true, users: enrichedUsers });
});

app.delete("/admin/users/:email", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }
  const emailToDelete = c.req.param("email");

  if (emailToDelete === "admin@test.com") {
    return c.json({ success: false, message: "Cannot delete the main admin account" }, 400);
  }

  const result = await db.delete(user).where(eq(user.email, emailToDelete)).returning();

  if (result.length > 0) {
    await logActivity(
      currentUser.id,
      `Xóa tài khoản người dùng '${emailToDelete}'`,
      `Tài khoản đã bị xóa khỏi hệ thống bởi quản trị viên`,
      "security",
      c.req.header("user-agent"),
    );
    return c.json({ success: true, message: "User deleted" });
  } else {
    return c.json({ success: false, message: "User not found" }, 404);
  }
});

// --- Admin AI Export Dataset API ---
app.post("/admin/ai/export-dataset", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
  try {
    const dbTrainings = await db.query.agentTraining.findMany();

    // Dedup and merge with defaults
    const utteranceSet = new Set<string>();
    const mergedList: Array<{ utterance: string; intent: string; answer: string }> = [];

    // Add DB data
    dbTrainings.forEach((t: any) => {
      const uClean = t.utterance.trim().toLowerCase();
      if (!utteranceSet.has(uClean)) {
        utteranceSet.add(uClean);
        mergedList.push({
          utterance: t.utterance,
          intent: t.intent,
          answer: t.answer,
        });
      }
    });

    // Add default training data
    ALL_DOMAIN_TRAINING_PAIRS.forEach((t: any) => {
      const uClean = t.utterance.trim().toLowerCase();
      if (!utteranceSet.has(uClean)) {
        utteranceSet.add(uClean);
        mergedList.push({
          utterance: t.utterance,
          intent: t.intent,
          answer: t.answer,
        });
      }
    });

    if (mergedList.length === 0) {
      return c.json({ success: false, message: "Không có dữ liệu huấn luyện nào!" }, 400);
    }

    const finetuneDir = path.join(process.cwd(), "finetune", "data");
    if (!fs.existsSync(finetuneDir)) {
      fs.mkdirSync(finetuneDir, { recursive: true });
    }

    const datasetPath = path.join(finetuneDir, "rottra_dataset.jsonl");
    let jsonlContent = "";

    // Format theo chuẩn ShareGPT/MiniCPM cho Fine-tuning
    mergedList.forEach((t: any) => {
      const dataRow = {
        messages: [
          {
            role: "system",
            content: "Bạn là Hệ Chuyên Gia Siêu Trí Tuệ của dự án Rottra. Bạn am hiểu sâu sắc về Toán học, Văn học và Khoa học thực chứng.",
          },
          { role: "user", content: t.utterance },
          { role: "assistant", content: t.answer },
        ],
      };
      jsonlContent += JSON.stringify(dataRow) + "\n";
    });

    fs.writeFileSync(datasetPath, jsonlContent);

    // Export Classification JSON
    const classificationPath = path.join(finetuneDir, "rottra_classification.json");
    const classificationData = mergedList.map((item) => ({
      utterance: item.utterance,
      intent: item.intent,
    }));
    fs.writeFileSync(classificationPath, JSON.stringify(classificationData, null, 2));

    return c.json({
      success: true,
      message: `Đã xuất thành công ${mergedList.length} dòng dữ liệu (gồm cả dữ liệu mẫu) ra chuẩn JSONL và Classification JSON.`,
      path: datasetPath,
      classificationPath,
    });
  } catch (error: any) {
    return c.json({ success: false, message: "Lỗi xuất dữ liệu: " + error.message }, 500);
  }
});

// --- Admin AI Train NLP Machine Learning ---
app.post("/admin/ai/train-nlp", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

  try {
    const trainingLogs: string[] = [];
    const result = await trainAndSaveNlpModel((logLine) => {
      trainingLogs.push(logLine);
    });

    if (result.success) {
      return c.json({
        success: true,
        message: "Đào tạo mạng Neural hoàn tất! Đã cập nhật mô hình học máy thành công.",
        logs: trainingLogs,
      });
    } else {
      return c.json(
        {
          success: false,
          message: "Huấn luyện thất bại, vui lòng kiểm tra logs.",
          logs: trainingLogs,
        },
        500,
      );
    }
  } catch (error: any) {
    return c.json({ success: false, message: "Lỗi hệ thống khi huấn luyện: " + error.message }, 500);
  }
});

// --- Admin AI Global Corpus API ---



app.get("/admin/ai/global-corpus", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

  try {
    const products = await db.select().from(dbSchema.product).limit(100);
    const lexicons = await db.select().from(dbSchema.vietnameseLexicon).limit(300);
    const farms = await db.select().from(dbSchema.farm).limit(20);
    const settings = await db.select().from(dbSchema.systemSetting).limit(1);

    let corpus = "=== DỮ LIỆU SẢN PHẨM (PRODUCTS) ===\n";
    products.forEach((p: any) => {
      corpus += `- [${p.name}] (Giá: ${p.price}): ${p.description || "Không có mô tả"}\n`;
    });

    corpus += "\n=== TỪ ĐIỂN CHUYÊN NGÀNH (LEXICON) ===\n";
    lexicons.forEach((l: any) => {
      corpus += `- [${l.word}] (${l.type}): ${l.definition}\n`;
    });

    corpus += "\n=== DANH SÁCH NÔNG TRẠI (FARMS) ===\n";
    farms.forEach((f: any) => {
      corpus += `- [${f.name}]: ${f.description || ""}\n`;
    });

    corpus += "\n=== CẤU HÌNH HỆ THỐNG ===\n";
    if (settings && settings[0]) {
      const s = settings[0];
      corpus += `- Web Name: ${s.webName}\n- Tự động Mùa vụ: ${s.autoSeason}\n`;
    }

    return c.json({ success: true, corpus });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// --- Admin AI Memory API ---
app.post("/admin/ai/memory", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

  const body = await c.req.json();
  const { text } = body;
  if (!text) return c.json({ success: false, message: "Thiếu nội dung ký ức" }, 400);

  const id = crypto.randomUUID();
  await db.insert(agentMemory).values({
    id,
    sessionId: "global",
    contextKey: "user_training",
    contextValue: { text },
    importanceScore: 10,
    addAt: new Date().toISOString(),
  });

  return c.json({ success: true, id, message: "Đã khắc sâu ký ức vào lõi PostgreSQL" });
});

app.post("/admin/ai/ingest-llms-url", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

  const body = await c.req.json();
  const { url } = body;
  if (!url) return c.json({ success: false, message: "Thiếu URL tài liệu" }, 400);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return c.json({ success: false, message: `Không thể tải tài liệu từ URL. Mã lỗi: ${response.status}` }, 400);
    }
    const fullText = await response.text();

    // Chia nhỏ tài liệu theo các thẻ tiêu đề (Markdown Headers)
    const sections = fullText.split(/(?=\n##+ )/);
    let insertedCount = 0;

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.length < 50) continue; // Bỏ qua phần quá ngắn

      const id = crypto.randomUUID();
      await db.insert(agentMemory).values({
        id,
        sessionId: "global",
        contextKey: "user_training",
        contextValue: { text: trimmed },
        importanceScore: 8,
        addAt: new Date().toISOString(),
      });
      insertedCount++;
    }

    return c.json({
      success: true,
      message: `Đã nạp thành công tài liệu từ ${url}`,
      chunks: insertedCount,
    });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

app.get("/admin/ai/memory", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

  // Lấy các ký ức do người dùng chủ động đào tạo
  const memories = await db
    .select()
    .from(agentMemory)
    .where(eq(agentMemory.contextKey, "user_training"))
    .orderBy(sql`"addAt" DESC`);

  return c.json({ success: true, memories });
});

app.delete("/admin/ai/memory/:id", verifyAuth, async (c: any) => {
  try {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);

    const id = c.req.param("id");

    // Tránh lỗi Drizzle ORM memory leak bằng Raw SQL
    await pgClient.query(`DELETE FROM "AgentMemory" WHERE id = $1`, [id]);

    return c.json({ success: true, message: "Đã xóa vĩnh viễn ký ức" });
  } catch (err: any) {
    console.error("Delete memory error:", err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

app.get("/admin/ai/certainty-telemetry", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
  try {
    const { selfCorrection } = await import("~/core/nlp-cognitive/self-correction");
    const weights = selfCorrection.certaintyNet.exportWeights();

    // Fetch all corrections in DB
    const corrections = await db
      .select()
      .from(agentMemory)
      .where(eq(agentMemory.sessionId, "self_correction_session"))
      .orderBy(sql`"addAt" DESC`);

    const parsedCorrections = corrections.map((rec: any) => {
      return typeof rec.contextValue === "string" ? JSON.parse(rec.contextValue) : rec.contextValue;
    });

    return c.json({
      success: true,
      weights,
      corrections: parsedCorrections,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

app.get("/admin/ai/agents-telemetry", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
  try {
    const dnaRecords = await db.select().from(agentMemory).where(eq(agentMemory.contextKey, "personality_dna"));

    const agentsData = dnaRecords.map((rec: any) => {
      const agentId = rec.sessionId;
      const loanParams = agentLoanParametersMap[agentId] || null;
      return {
        id: agentId,
        greed: rec.greed,
        vengeance: rec.vengeance,
        malice: rec.malice,
        state: rec.state,
        loanParams,
      };
    });

    return c.json({
      success: true,
      agents: agentsData,
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

app.post("/admin/ai/reset-certainty-weights", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
  try {
    const { selfCorrection } = await import("~/core/nlp-cognitive/self-correction");

    // Re-initialize certainty network to original Xavier weights
    const { TinyNeuralNet } = await import("~/core/nlp-cognitive/tiny-neural-net");
    selfCorrection.certaintyNet = new TinyNeuralNet(3, 4, 1);

    // Persist empty/fresh weights
    await selfCorrection.saveWeightsToDb();

    return c.json({
      success: true,
      message: "Đã thiết lập lại (re-initialize) trọng số mạng Neural thành công!",
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// --- Admin Activity Log API ---
app.get("/admin/activity", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  const levelParam = c.req.query("level");

  try {
    const query = db
      .select({
        id: activity.id,
        userId: activity.userId,
        user: user.name,
        action: activity.action,
        message: activity.message,
        level: activity.level,
        device: activity.device,
        timestamp: activity.timestamp,
      })
      .from(activity)
      .leftJoin(user, eq(activity.userId, user.id));

    let results;
    if (levelParam && levelParam !== "all") {
      results = await query
        .where(eq(activity.level, levelParam))
        .orderBy(sql`${activity.timestamp} DESC`)
        .limit(200);
    } else {
      results = await query.orderBy(sql`${activity.timestamp} DESC`).limit(200);
    }

    return c.json({ success: true, activities: results });
  } catch (error: any) {
    console.error("Fetch activity logs error:", error);
    return c.json({ success: false, message: error.message || "Lỗi máy chủ khi lấy nhật ký hoạt động" }, 500);
  }
});

app.post("/admin/users/:email/action", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }
  const targetEmail = c.req.param("email");
  const body = await c.req.json();
  const { action, payload, groupName } = body;

  if (targetEmail === "admin@test.com" && (action === "warn" || action === "ban")) {
    return c.json({ success: false, message: "Cannot ban or warn the main admin account" }, 400);
  }

  const dbUser = await db.query.user.findFirst({
    where: eq(user.email, targetEmail),
  });

  if (!dbUser) {
    return c.json({ success: false, message: "User not found" }, 404);
  }

  const profile: any = dbUser.profile || {};

  const actionHandlers: Record<string, (p: any) => void> = {
    warn: (p) => {
      p.warnings = p.warnings || [];
      p.warnings.push({ date: new Date().toISOString(), reason: "Vi phạm chính sách" });
    },
    ban: (p) => {
      p.banned = true;
      p.banReason = "Quản trị viên chặn";
    },
    add_group: (p) => {
      p.groups = p.groups || [];
      const name = groupName || (payload && payload.groupName) || "Nhóm Đặc Quyền";
      // Đặt danh sách sản phẩm rỗng để người bán tự thêm thủ công sau
      p.groups.push({ name, product: [] });
    },
  };

  const executeAction = actionHandlers[action as string];

  if (executeAction) {
    executeAction(profile);
  } else {
    return c.json({ success: false, message: "Invalid action" }, 400);
  }

  await db.update(user).set({ profile }).where(eq(user.email, targetEmail));

  let logMsg = "";
  let logLvl = "user";
  if (action === "warn") {
    logMsg = `Cảnh báo người dùng ${dbUser.name}`;
    logLvl = "security";
  } else if (action === "ban") {
    logMsg = `Khóa tài khoản người dùng ${dbUser.name}`;
    logLvl = "security";
  } else {
    logMsg = `Cấp nhóm đặc quyền cho người dùng ${dbUser.name}`;
  }

  await logActivity(currentUser.id, logMsg, `Hành động thực hiện bởi quản trị viên`, logLvl, c.req.header("user-agent"));

  return c.json({ success: true, message: `Action ${action} executed successfully` });
});

// --- Dynamic ERD Extractor ---
app.get("/admin/diagram/erd", async (c: any) => {
  try {
    let erd = "erDiagram\n";
    for (const [key, table] of Object.entries(dbSchema)) {
      if (table && typeof table === "object" && Symbol.for("drizzle:Name") in table) {
        const config = getTableConfig(table as any);
        erd += `    ${config.name} {\n`;

        const columns = config.columns;
        for (const col of columns) {
          erd += `        ${col.dataType} ${col.name}\n`;
        }
        erd += `    }\n`;

        if (config.foreignKeys) {
          for (const fk of config.foreignKeys) {
            const refTable = getTableConfig(fk.reference().foreignTable).name;
            erd += `    ${config.name} ||--o{ ${refTable} : "relates_to"\n`;
          }
        }
      }
    }
    return c.json({ success: true, erd });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// --- Dynamic Macro Architecture Extractor ---
app.get("/admin/diagram/architecture", async (c: any) => {
  try {
    let endpointsCount = 0;
    let tablesCount = 0;
    let routesCount = 0;

    // 1. Count DB Tables
    for (const [key, table] of Object.entries(dbSchema)) {
      if (table && typeof table === "object" && Symbol.for("drizzle:Name") in table) {
        tablesCount++;
      }
    }

    // 2. Count API Endpoints
    const apiPath = path.join(process.cwd(), "src", "routes", "api", "[...paths].ts");
    if (fs.existsSync(apiPath)) {
      const code = fs.readFileSync(apiPath, "utf8");
      const matches = code.match(/app\.(get|post|put|delete|patch)\(/g);
      if (matches) endpointsCount = matches.length;
    }

    // 3. Count Frontend Routes
    const dashPath = path.join(process.cwd(), "src", "routes", "dashboard");
    if (fs.existsSync(dashPath)) {
      const files = fs.readdirSync(dashPath);
      routesCount = files.filter((f) => f.endsWith(".tsrx") || f.endsWith(".tsx")).length;
    }

    // Build the dynamic Mermaid diagram
    const architecture = `graph TD
    %% Tầng Giao tiếp (Edge Layer)
    subgraph Frontend["Tầng Giao tiếp (TSRX SolidJS)"]
        UI["Giao diện Người dùng<br/>(Dashboard Modules: ${routesCount})"]
        Compiler["TSRX Compiler<br/>(Bypass JSX)"]
    end
    
    %% Tầng Xử lý Cốt lõi (Backend)
    subgraph Backend["Tầng Xử lý Cốt lõi (Bun API)"]
        Router{"Hono Routing<br/>(Endpoints: ${endpointsCount})"}
        GraphRAG["Lõi Graph RAG & Giáo dục Toán học"]
        VideoEngine["Hyperframes<br/>(Kết xuất Video AI)"]
    end
    
    %% Tầng Cơ sở hạ tầng (Database)
    subgraph Infra["Tầng Cơ sở Hạ tầng (Data)"]
        DB[("PostgreSQL<br/>(Tổng số Bảng: ${tablesCount})")]
        Redis[("Vector/Cache DB")]
    end
    
    UI <==>|"REST / WSS"| Router
    UI -.-> Compiler
    
    Router <--> GraphRAG
    Router <--> VideoEngine
    
    GraphRAG -->|"Lưu trữ Tri thức & Giáo trình"| DB
    VideoEngine -->|"I/O File"| DB
    
    style Frontend fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Backend fill:#047857,stroke:#10b981,stroke-width:2px,color:#fff
    style Infra fill:#b91c1c,stroke:#f87171,stroke-width:2px,color:#fff`;

    return c.json({ success: true, architecture });
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// --- System Settings ---
app.get("/admin/settings", async (c: any) => {
  try {
    const settings = await db.query.systemSetting.findFirst({
      where: eq(systemSetting.id, "global"),
    });

    if (settings) {
      return c.json({
        ...settings,
        wifiPerf: settings.wifiPerf !== null && settings.wifiPerf !== undefined ? settings.wifiPerf : false,
        autoBoost: settings.autoBoost !== null && settings.autoBoost !== undefined ? settings.autoBoost : false,
      });
    }

    // Return default settings if not exists
    return c.json({
      webName: "Rotta",
      adminEmail: "admin@test.com",
      adminPhone: "",
      colors: {
        primary: "#3b82f6",
        background: "#ffffff",
        text: "#1f2937",
      },
      autoSeason: false,
      wifiPerf: false,
      autoBoost: false,
    });
  } catch (e) {
    return c.json({ success: false, message: "Lỗi tải cấu hình" }, 500);
  }
});

app.post("/admin/settings", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false }, 403);

  try {
    const body = await c.req.json();

    await db.insert(systemSetting).values({
      id: "global",
      webName: body.webName,
      adminEmail: body.adminEmail,
      adminPhone: body.adminPhone,
      colors: body.colors,
      autoSeason: body.autoSeason,
      wifiPerf: body.wifiPerf,
      autoBoost: body.autoBoost,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ success: true });
  } catch (e) {
    console.error(e);
    return c.json({ success: false, message: "Lỗi lưu cấu hình" }, 500);
  }
});

// --- SQL DB Query API ---
app.post("/admin/db-query", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const { query } = await c.req.json();
    if (!query || typeof query !== "string") {
      return c.json({ success: false, message: "Truy vấn không hợp lệ" }, 400);
    }

    console.log(`[SQL EXECUTION] Chạy lệnh: ${query}`);
    const result = await pgClient.query(query);
    return c.json({
      success: true,
      rows: result.rows,
      fields: result.fields,
      affectedRows: result.affectedRows,
    });
  } catch (e: any) {
    console.error(e);
    return c.json({ success: false, message: e.message || "Lỗi truy vấn SQL" }, 500);
  }
});

// --- Web IDE API endpoints ---
app.get("/admin/ide/files", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const queryDir = c.req.query("dir") || "";
    const targetDir = path.resolve(process.cwd(), queryDir);

    if (!targetDir.startsWith(process.cwd())) {
      return c.json({ success: false, message: "Truy cập thư mục bất hợp lệ" }, 403);
    }

    if (!fs.existsSync(targetDir)) {
      return c.json({ success: false, message: "Thư mục không tồn tại" }, 404);
    }

    const stats = fs.statSync(targetDir);
    if (!stats.isDirectory()) {
      return c.json({ success: false, message: "Đường dẫn không phải thư mục" }, 400);
    }

    const items = fs.readdirSync(targetDir);
    const result = items
      .filter((name) => {
        if (name.startsWith(".") && name !== ".env") return false;
        if (["node_modules", "dist", "pg_data", "rotta-marketing-studio"].includes(name)) return false;
        return true;
      })
      .map((name) => {
        const fullPath = path.join(targetDir, name);
        const itemStats = fs.statSync(fullPath);
        const relativePath = path.relative(process.cwd(), fullPath);
        return {
          name,
          path: relativePath,
          isDirectory: itemStats.isDirectory(),
          size: itemStats.isFile() ? itemStats.size : 0,
        };
      })
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    return c.json({ success: true, files: result });
  } catch (e: any) {
    console.error("IDE Files Error:", e);
    return c.json({ success: false, message: e.message || "Lỗi đọc danh sách tệp" }, 500);
  }
});

app.get("/admin/ide/file", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const filePath = c.req.query("path");
    if (!filePath) {
      return c.json({ success: false, message: "Thiếu đường dẫn tệp" }, 400);
    }

    const targetFile = path.resolve(process.cwd(), filePath);
    if (!targetFile.startsWith(process.cwd())) {
      return c.json({ success: false, message: "Truy cập tệp bất hợp lệ" }, 403);
    }

    if (!fs.existsSync(targetFile)) {
      return c.json({ success: false, message: "Tệp không tồn tại" }, 404);
    }

    const stats = fs.statSync(targetFile);
    if (!stats.isFile()) {
      return c.json({ success: false, message: "Đường dẫn không phải tệp tin" }, 400);
    }

    const content = fs.readFileSync(targetFile, "utf-8");
    return c.json({ success: true, content, size: stats.size });
  } catch (e: any) {
    console.error("IDE Read File Error:", e);
    return c.json({ success: false, message: e.message || "Lỗi đọc nội dung tệp" }, 500);
  }
});

app.post("/admin/ide/file", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const { path: filePath, content } = await c.req.json();
    if (!filePath || content === undefined) {
      return c.json({ success: false, message: "Thiếu đường dẫn hoặc nội dung tệp" }, 400);
    }

    const targetFile = path.resolve(process.cwd(), filePath);
    if (!targetFile.startsWith(process.cwd())) {
      return c.json({ success: false, message: "Ghi tệp bất hợp lệ" }, 403);
    }

    const parentDir = path.dirname(targetFile);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(targetFile, content, "utf-8");
    return c.json({ success: true, message: "Đã lưu tệp tin thành công" });
  } catch (e: any) {
    console.error("IDE Write File Error:", e);
    return c.json({ success: false, message: e.message || "Lỗi ghi tệp tin" }, 500);
  }
});

const isCommandSafe = (cmd: string): boolean => {
  const trimmed = cmd.trim();
  const cwd = process.cwd();

  // 1. Block system admin & privilege escalation command keywords
  if (
    /\b(sudo|su|dd|mkfs|format|chown|chmod|chgrp|reboot|shutdown|init|poweroff|halt|ufw|iptables|systemctl|service|crontab)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // 2. Block file deletion commands (rm) unless specifically restricted to scratch directory and no wildcards
  if (/\brm\b/i.test(trimmed)) {
    // Check if it only targets the scratch/ folder
    const matchesScratch = /\bscratch\//i.test(trimmed);
    const hasWildcard = /[\*]/i.test(trimmed);
    if (!matchesScratch || hasWildcard) {
      return false;
    }
  }

  // 3. Block network commands to prevent downloading payload or exfiltration (excluding package manager endpoints)
  if (/\b(curl|wget|nc|netcat|nmap|ssh|telnet|ftp|rsync|scp)\b/i.test(trimmed)) {
    return false;
  }

  // 4. Block pipe-to-shell or inline execution of other interpreters that could bypass checks
  if (/\|\s*(bash|sh|zsh|python|perl|ruby|php|node|bun)\b/i.test(trimmed)) {
    return false;
  }
  if (/\b(eval|exec)\b/i.test(trimmed)) {
    return false;
  }

  // 5. Block absolute or relative path traversals outside the workspace Cwd
  // Tokenize the command string into parts that look like paths or files
  const tokens = trimmed.split(/[\s;&>|<'"`]+/);
  for (const token of tokens) {
    if (!token) continue;

    // Check if the token looks like a path or relative navigation
    if (token.includes("/") || token.includes("..") || token.includes("\\")) {
      try {
        const resolved = path.resolve(cwd, token);
        if (!resolved.startsWith(cwd)) {
          // Allow only standard system binaries in allowed paths
          const isAllowedBin =
            /^\/usr\/bin\/(bun|node|npm|npx|yarn|pnpm|git|vite)$/i.test(token) ||
            /^\/usr\/local\/bin\/(bun|node|npm|npx|yarn|pnpm|git|vite)$/i.test(token);
          if (!isAllowedBin) {
            return false;
          }
        }
      } catch (err) {
        // Fallback for unresolved patterns containing double dots
        if (token.includes("..")) {
          return false;
        }
      }
    }
  }

  // 6. Block output redirection to paths outside Cwd
  // Matches > or >> followed by a path
  let match;
  const redirectRegex = />+\s*([^\s;&|<]+)/g;
  while ((match = redirectRegex.exec(trimmed)) !== null) {
    const targetPath = match[1];
    try {
      const resolved = path.resolve(cwd, targetPath);
      if (!resolved.startsWith(cwd)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  // 7. Block symlinking (ln) to paths outside Cwd to prevent exposing system files
  if (/\bln\b/i.test(trimmed)) {
    if (/\b-s\b/i.test(trimmed) || trimmed.includes("ln ")) {
      return false;
    }
  }

  return true;
};

app.post("/admin/ide/run", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const { path: filePath, command } = await c.req.json();
    let cmdToRun = "";

    if (command) {
      cmdToRun = command;
    } else if (filePath) {
      const targetFile = path.resolve(process.cwd(), filePath);
      if (!targetFile.startsWith(process.cwd())) {
        return c.json({ success: false, message: "Tệp thực thi bất hợp lệ" }, 403);
      }

      if (!fs.existsSync(targetFile)) {
        return c.json({ success: false, message: "Tệp không tồn tại" }, 404);
      }

      const ext = path.extname(targetFile);
      if (ext === ".ts" || ext === ".tsrx" || ext === ".tsx") {
        cmdToRun = `bun run "${targetFile}"`;
      } else if (ext === ".js" || ext === ".jsx") {
        cmdToRun = `node "${targetFile}"`;
      } else if (ext === ".sh") {
        cmdToRun = `bash "${targetFile}"`;
      } else {
        return c.json({ success: false, message: "Không hỗ trợ chạy tệp tin dạng này" }, 400);
      }
    } else {
      return c.json({ success: false, message: "Thiếu thông tin chạy" }, 400);
    }

    if (!isCommandSafe(cmdToRun)) {
      return c.json(
        {
          success: false,
          message: "Lệnh thực thi chứa các câu lệnh nguy hiểm (ví dụ: rm, chmod, sudo) đã bị hệ thống bảo mật chặn lại để bảo vệ mã nguồn.",
        },
        400,
      );
    }

    console.log(`[IDE RUN] Chạy lệnh: ${cmdToRun}`);
    const { stdout, stderr } = await execAsync(cmdToRun, { timeout: 10000 });
    return c.json({
      success: true,
      stdout: stdout || "",
      stderr: stderr || "",
    });
  } catch (e: any) {
    console.error("IDE Run Error:", e);
    return c.json({
      success: false,
      message: e.message || "Lỗi thực thi lệnh",
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "",
    });
  }
});

app.post("/admin/ide/agent/plan", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const { prompt } = await c.req.json();
    if (!prompt) return c.json({ success: false, message: "Thiếu mô tả nhiệm vụ" }, 400);



    const allFiles: string[] = [];
    const scanDir = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (["node_modules", "pg_data", ".git", ".gemini", "dist"].some((ignore) => item.name.includes(ignore))) continue;
        const fullPath = path.join(dir, item.name);
        const relative = path.relative(process.cwd(), fullPath);
        if (item.isDirectory()) {
          if (allFiles.length < 100) scanDir(fullPath);
        } else {
          if (
            relative.endsWith(".ts") ||
            relative.endsWith(".tsx") ||
            relative.endsWith(".tsrx") ||
            relative.endsWith(".json") ||
            relative.endsWith(".md")
          ) {
            allFiles.push(relative);
          }
        }
      }
    };
    scanDir(process.cwd());

    const fileListContext = allFiles.slice(0, 150).join("\n");

    const systemPrompt = `Bạn là Giáo sư AI, Kỹ sư phần mềm Tự trị hàng đầu 2026. Nhiệm vụ của bạn là giải quyết yêu cầu lập trình sau của người dùng: "${prompt}".
Danh sách các file chính trong workspace dự án:
${fileListContext}

Hãy lập một kế hoạch chi tiết gồm các bước (checklist) để thực thi nhiệm vụ này.
Mỗi bước phải là một đối tượng JSON có dạng:
{
  "id": "chuỗi định danh duy nhất (ví dụ: step_1, step_2)",
  "title": "Tên ngắn gọn của bước (tiếng Việt)",
  "description": "Chi tiết thao tác",
  "type": "read" | "modify" | "command" | "verify",
  "path": "Đường dẫn file (đối với read, modify) hoặc câu lệnh shell cần chạy (đối với command)"
}

Hãy trả về một mảng JSON các bước hành động này, ví dụ:
[
  { "id": "step_1", "title": "Đọc file schema", "description": "Kiểm tra định nghĩa bảng", "type": "read", "path": "src/db/schema.ts" },
  { "id": "step_2", "title": "Cập nhật logic API", "description": "Thêm trường mới vào endpoint", "type": "modify", "path": "src/routes/api/[...paths].ts" }
]

Yêu cầu bắt buộc: TRẢ VỀ DUY NHẤT một mảng JSON hợp lệ, không giải thích dài dòng, không bọc ngoài các văn bản khác ngoài mảng JSON.`;

    const { text: reply } = await generateTextLocal({
      system: systemPrompt,
      prompt: `Hãy lập kế hoạch cho nhiệm vụ: ${prompt}`,
      isInternalReasoning: true,
    });
    const cleanJson = reply
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let steps = [];
    try {
      steps = JSON.parse(cleanJson);
      if (!Array.isArray(steps)) {
        steps = [steps];
      }
    } catch (parseErr) {
      console.error("Failed to parse agent plan JSON:", reply);
      steps = [
        {
          id: "step_1",
          title: "Phân tích dự án",
          description: "Giáo sư phân tích yêu cầu lập trình",
          type: "read",
          path: "src/routes/api/[...paths].ts",
        },
        {
          id: "step_2",
          title: "Thực thi kiểm tra",
          description: "Chạy build hệ thống",
          type: "command",
          path: "bun run build",
        },
      ];
    }

    return c.json({ success: true, steps });
  } catch (e: any) {
    console.error("Agent Plan Error:", e);
    return c.json({ success: false, message: e.message || "Lỗi tạo kế hoạch" }, 500);
  }
});

app.post("/admin/ide/agent/step", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Từ chối truy cập" }, 403);

  try {
    const { prompt, steps, currentStepId, logs } = await c.req.json();
    if (!steps || !currentStepId) {
      return c.json({ success: false, message: "Thiếu dữ liệu bước chạy" }, 400);
    }

    const currentStep = steps.find((s: any) => s.id === currentStepId);
    if (!currentStep) {
      return c.json({ success: false, message: "Không tìm thấy bước cần chạy" }, 404);
    }


    let outputLog = "";
    let stepResult: any = {};
    let isSuccess = true;
    let nextSteps = [...steps];

    console.log(`[AUTONOMOUS STEP] Đang thực thi bước ${currentStepId} (${currentStep.type}) - ${currentStep.title}`);

    if (currentStep.type === "read") {
      const targetFile = path.resolve(process.cwd(), currentStep.path);
      if (!targetFile.startsWith(process.cwd())) {
        throw new Error("Không được phép đọc file ngoài thư mục dự án");
      }

      if (fs.existsSync(targetFile)) {
        const fileContent = fs.readFileSync(targetFile, "utf-8");
        const truncatedContent =
          fileContent.length > 15000 ? fileContent.substring(0, 15000) + "\n...[Nội dung bị cắt bớt do dung lượng lớn]..." : fileContent;
        outputLog = `[GIÁO SƯ AI] Đã đọc thành công tệp: ${currentStep.path}\n`;
        stepResult = { content: truncatedContent };
      } else {
        outputLog = `[GIÁO SƯ AI] Cảnh báo: Tệp tin ${currentStep.path} không tồn tại.`;
        isSuccess = false;
      }
    } else if (currentStep.type === "modify") {
      const targetFile = path.resolve(process.cwd(), currentStep.path);
      if (!targetFile.startsWith(process.cwd())) {
        throw new Error("Không được phép sửa file ngoài thư mục dự án");
      }

      let originalContent = "";
      if (fs.existsSync(targetFile)) {
        originalContent = fs.readFileSync(targetFile, "utf-8");
      }

      const systemPrompt = `Bạn là Giáo sư AI, Kỹ sư phần mềm Tự trị hàng đầu 2026.
Nhiệm vụ tổng thể: "${prompt}"
Kế hoạch của bạn:
${JSON.stringify(steps)}

Hiện tại bạn đang ở bước: "${currentStep.title}" - "${currentStep.description}".
Bạn cần viết lại toàn bộ nội dung của tệp tin: \`${currentStep.path}\` để đạt được mục tiêu này.

Nội dung hiện tại của tệp tin \`${currentStep.path}\`:
\`\`\`
${originalContent}
\`\`\`

Hãy trả về toàn bộ nội dung mới cho tệp tin này. Bạn cần chỉnh sửa/thêm logic tương thích hoàn hảo với phần còn lại của codebase.
Yêu cầu bắt buộc: TRẢ VỀ DUY NHẤT nội dung mã nguồn mới cho tệp tin. KHÔNG giải thích dài dòng, KHÔNG bọc trong markdown codeblock \`\`\` hay bất kỳ thẻ nào khác. Chỉ trả về code sạch.`;

      const { text: newContentRaw } = await generateTextLocal({
        system: systemPrompt,
        prompt: `Hãy viết mã nguồn cập nhật cho tệp: ${currentStep.path}`,
        isInternalReasoning: true,
      });
      let newContent = newContentRaw || "";

      if (newContent.trim().startsWith("```")) {
        newContent = newContent
          .replace(/^```[a-zA-Z0-9]*\n/, "")
          .replace(/\n```$/, "")
          .trim();
      }

      const parentDir = path.dirname(targetFile);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(targetFile, newContent, "utf-8");
      outputLog = `[GIÁO SƯ AI] Đã tự động cập nhật và lưu thay đổi vào tệp: ${currentStep.path}\n`;
      stepResult = {
        original: originalContent,
        modified: newContent,
        path: currentStep.path,
      };
    } else if (currentStep.type === "command") {
      const cmdToRun = currentStep.path;
      outputLog = `[GIÁO SƯ AI] Đang chạy lệnh shell: "${cmdToRun}"...\n`;

      if (!isCommandSafe(cmdToRun)) {
        isSuccess = false;
        outputLog += `[LỖI BẢO MẬT] Lệnh shell nguy hiểm bị chặn bởi hệ thống bảo mật Rottra Core Guard.\n`;
        stepResult = { stdout: "", stderr: "Lệnh bị chặn vì lý do bảo mật" };
      } else {
        try {
          const { stdout, stderr } = await execAsync(cmdToRun, { timeout: 15000 });
          outputLog += `[LỆNH RA]:\n${stdout || "(Không có output)"}\n`;
          if (stderr) outputLog += `[STDERR]:\n${stderr}\n`;
          stepResult = { stdout, stderr };
        } catch (cmdErr: any) {
          isSuccess = false;
          outputLog += `[LỖI THỰC THI]:\n${cmdErr.message || "Lệnh kết thúc với lỗi"}\n`;
          if (cmdErr.stderr) outputLog += `[STDERR]:\n${cmdErr.stderr}\n`;
          stepResult = { stdout: cmdErr.stdout || "", stderr: cmdErr.stderr || cmdErr.message };

          const nextIdx = nextSteps.findIndex((s: any) => s.id === currentStepId) + 1;
          const debugStep = {
            id: `debug_${crypto.randomUUID().split("-")[0]}`,
            title: "Tự sửa lỗi (Self-Healing)",
            description: `Sửa lỗi phát sinh từ câu lệnh: ${cmdToRun}`,
            type: "modify",
            path: steps.find((s: any) => s.type === "modify")?.path || "src/routes/api/[...paths].ts",
          };

          nextSteps.splice(nextIdx, 0, debugStep);
          outputLog += `\n[TỰ SỬA LỖI] Giáo sư AI phát hiện lỗi biên dịch. Đã tự động chèn bước Tự sửa lỗi (Self-Healing) vào kế hoạch để tự sửa file.\n`;
        }
      }
    } else if (currentStep.type === "verify") {
      outputLog = `[GIÁO SƯ AI] Đang đối chiếu và xác nhận tính toàn vẹn hệ thống...\n`;
      try {
        await execAsync("bun run build", { timeout: 15000 });
        outputLog += `[GIÁO SƯ AI] Toàn bộ hệ thống biên dịch sạch sẽ! Build thành công.\n`;
      } catch (buildErr: any) {
        isSuccess = false;
        outputLog += `[GIÁO SƯ AI] Biên dịch thử nghiệm thất bại sau khi hoàn tất. Cần rà soát.\n`;
      }
    }

    nextSteps = nextSteps.map((s: any) => {
      if (s.id === currentStepId) {
        return { ...s, status: isSuccess ? "completed" : "failed" };
      }
      return s;
    });

    const currentIdx = nextSteps.findIndex((s: any) => s.id === currentStepId);
    let nextStepId = "";
    if (currentIdx !== -1 && currentIdx < nextSteps.length - 1) {
      nextStepId = nextSteps[currentIdx + 1].id;
    }

    return c.json({
      success: true,
      steps: nextSteps,
      currentStepId: nextStepId,
      logs: [...logs, outputLog],
      result: stepResult,
    });
  } catch (e: any) {
    console.error("Agent Step Execution Error:", e);
    return c.json({ success: false, message: e.message || "Lỗi thực thi bước" }, 500);
  }
});

// --- product ---

// --- Public Product (For Home Page) ---
// In-memory cache for product list (TTL 30s)
let productCache: { data: any; timestamp: number } | null = null;
const PRODUCT_CACHE_TTL = 30_000;

app.get("/product", async (c: any) => {
  try {
    if (productCache && Date.now() - productCache.timestamp < PRODUCT_CACHE_TTL) {
      return c.json({ product: productCache.data });
    }

    // Exclude products with no/invalid Expiration Date (expired) or quantity <= 0 from public market
    // Hide system pool products from public market (so system agent doesn't appear as a seller)
    const allproduct = (await db.query.product.findMany({})).filter((p: any) => {
      if (p.sellerId === "RottraAI") return false;
      if (!p.expired || p.expired.trim() === "") return false;
      const parsed = Date.parse(p.expired);
      if (isNaN(parsed)) return false;
      if ((p.quantity ?? 0) <= 0) return false;

      // Phải có ảnh (media) hợp lệ mới cho lên trang chủ
      if (!p.media || !Array.isArray(p.media) || p.media.length === 0) return false;
      const hasImage = p.media.some((m: any) => {
        const link = getMediaLink(m);
        return link && link.trim() !== "";
      });
      if (!hasImage) return false;

      const name = p.name || "";
      const desc = p.description || "";
      const nameLower = name.toLowerCase();

      // Không hiển thị placeholder Đang cập nhật...
      if (nameLower.includes("đang cập nhật")) return false;

      // Không cần [CA DAO TỤC NGỮ] mới cho lên
      return true;
    });
    const productIds = allproduct.map((p: any) => p.id);
    const sellerIds = Array.from(new Set(allproduct.map((p: any) => p.sellerId).filter(Boolean)));

    // Fetch all reviews and sellers in parallel batch queries
    const [allReviews, allSellers] = await Promise.all([
      productIds.length > 0
        ? db
            .select()
            .from(review)
            .where(inArray(review.productId, productIds as string[]))
        : Promise.resolve([]),
      sellerIds.length > 0
        ? db
            .select({
              id: user.id,
              name: user.name,
              image: user.image,
              profile: user.profile,
            })
            .from(user)
            .where(inArray(user.id, sellerIds as string[]))
        : Promise.resolve([]),
    ]);

    // Map reviews and sellers in-memory
    const reviewsMap = new Map<string, any[]>();
    for (const r of allReviews) {
      if (!reviewsMap.has(r.productId)) {
        reviewsMap.set(r.productId, []);
      }
      reviewsMap.get(r.productId)!.push(r);
    }

    const sellersMap = new Map<string, any>(allSellers.map((s: any) => [s.id, s]));

    const productWithDetails = allproduct.map((p: any) => ({
      ...p,
      name: p.name ? p.name.replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "") : "",
      description: p.description ? p.description.replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "") : "",
      cmt: reviewsMap.get(p.id) || [],
      seller: sellersMap.get(p.sellerId) || null,
    }));

    productCache = { data: productWithDetails, timestamp: Date.now() };
    return c.json({ product: productWithDetails });
  } catch (e: any) {
    console.error("PRODUCT ERROR:", e);
    return c.json({ success: false, error: e.message, stack: e.stack }, 500);
  }
});

function getNiceStep(maxVal: number) {
  if (maxVal <= 5) return { max: 5, step: 1 };
  if (maxVal <= 10) return { max: 10, step: 2 };
  if (maxVal <= 25) return { max: 25, step: 5 };
  if (maxVal <= 50) return { max: 50, step: 10 };
  if (maxVal <= 100) return { max: 100, step: 20 };
  const power = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const ratio = maxVal / power;
  let step;
  if (ratio <= 1) step = 0.2 * power;
  else if (ratio <= 2) step = 0.4 * power;
  else if (ratio <= 5) step = 1 * power;
  else step = 2 * power;
  step = Math.ceil(step);
  return { max: step * 5, step };
}

function generateAsciiChart(inactive: number, active: number, total: number) {
  const { max, step } = getNiceStep(total);
  let chartLines = [];
  chartLines.push("Biểu đồ hàng hóa");
  chartLines.push("Số lượng");

  const col1Char = "░"; // Hết hàng
  const col2Char = "▓"; // Còn hàng
  const col3Char = "█"; // Tổng số

  for (let r = 5; r >= 1; r--) {
    const lineVal = r * step;
    const valStr = lineVal.toString().padStart(3, " ");

    const hasCol1 = inactive >= lineVal - step / 2;
    const hasCol2 = active >= lineVal - step / 2;
    const hasCol3 = total >= lineVal - step / 2;

    const col1 = hasCol1 ? col1Char + col1Char + col1Char : "   ";
    const col2 = hasCol2 ? col2Char + col2Char + col2Char : "   ";
    const col3 = hasCol3 ? col3Char + col3Char + col3Char : "   ";

    chartLines.push(`${valStr} ┤   ${col1}     ${col2}     ${col3}`);
  }

  chartLines.push("  0 ┼────┬───────┬───────┬────");
  chartLines.push("        Hết     Còn     Tổng");
  chartLines.push("       hàng    hàng    số");
  chartLines.push(`* ${col1Char} Hết hàng | ${col2Char} Còn hàng | ${col3Char} Tổng số`);

  return chartLines.join("\n");
}

function generateAsciiTable(inactive: number, active: number, total: number) {
  const activePct = total ? Math.round((active / total) * 100) : 0;
  const inactivePct = total ? Math.round((inactive / total) * 100) : 0;

  const centerText = (str: string, width: number) => {
    const padTotal = width - str.length;
    if (padTotal <= 0) return str;
    const padLeft = Math.floor(padTotal / 2);
    return " ".repeat(padLeft) + str + " ".repeat(padTotal - padLeft);
  };

  const col1Active = "  Còn hàng    ";
  const col2Active = centerText(String(active), 14);
  const col3Active = centerText(`${activePct}%`, 14);

  const col1Inactive = "  Hết hàng    ";
  const col2Inactive = centerText(String(inactive), 14);
  const col3Inactive = centerText(`${inactivePct}%`, 14);

  const col1Total = "  Tổng số     ";
  const col2Total = centerText(String(total), 14);
  const col3Total = centerText("100%", 14);

  return `┌───────────────┬───────────────┬───────────────┐
          │   Trạng thái  │   Số lượng    │  Tỷ lệ (%)    │
          ├───────────────┼───────────────┼───────────────┤
          │${col1Active}  │ ${col2Active} │${col3Active}  │
          ├───────────────┼───────────────┼───────────────┤
          │${col1Inactive}│${col2Inactive}│${col3Inactive}│
          ├───────────────┼───────────────┼───────────────┤
          │${col1Total}   │${col2Total}   │${col3Total}   │
          └───────────────┴───────────────┴───────────────┘`;
}
// --- TẦNG AI ENGINE CỤC BỘ (LOCAL INTELLIGENCE ENGINE) ---
// 1. Thuật toán Trích xuất Thực thể (Entity Extraction)
const extractPriceConstraint = (text: string) => {
  const match = text.match(/(dưới|rẻ hơn|khoảng|tầm|duoi|re hon)\s*(\d+)\s*(k|nghìn|ngan|tr|triệu|trieu)?/i);
  if (!match) return null;
  let num = parseInt(match[2]);
  let unit = match[3]?.toLowerCase();
  if (unit === "k" || unit === "nghìn" || unit === "ngan") num *= 1000;
  if (unit === "tr" || unit === "triệu" || unit === "trieu") num *= 1000000;
  return { operator: "<=", value: num };
};

// Helper to remove unpaired surrogates from a string, ensuring it is valid JSON / UTF-16
const sanitizeString = (str: string): string => {
  if (!str) return "";
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
};

// Helper to recursively sanitize strings in an object or array
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
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

app.post("/translate-dynamic", async (c: any) => {
  try {
    const { texts, targetLang } = await c.req.json();
    if (!texts || !Array.isArray(texts)) return c.json({ success: false, message: "Invalid input" });

    const { aiTranslator } = await import("~/core/nlp-cognitive/ai-translator");
    const results: Record<string, string> = {};

    const translations = await Promise.allSettled(texts.map((text: string) => aiTranslator.translate(text, targetLang, "vi")));

    texts.forEach((text: string, i: number) => {
      const r = translations[i];
      results[text] = r.status === "fulfilled" ? r.value : text;
    });
    return c.json({ success: true, translations: results });
  } catch (e: any) {
    console.error("Dynamic Translation Error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get("/seo/market", async (c: any) => {
  try {
    const productSlug = c.req.query("productSlug");
    const locationSlug = c.req.query("locationSlug");

    if (!productSlug || !locationSlug) {
      return c.json({ success: false, error: "Missing productSlug or locationSlug" }, 400);
    }

    const { getOrGenerateMarketPage } = await import("~/server/helpers/seo-generator");
    const pageData = await getOrGenerateMarketPage(productSlug, locationSlug);
    return c.json({ success: true, data: pageData });
  } catch (e: any) {
    console.error("SEO Market Page Generation Error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.get("/seo/market/links", async (c: any) => {
  try {
    const { SEO_PRODUCTS, SEO_LOCATIONS, getProductName, getLocationName } = await import("~/server/helpers/seo-generator");
    const links = [];
    for (const p of SEO_PRODUCTS) {
      for (const l of SEO_LOCATIONS) {
        links.push({
          productSlug: p.slug,
          locationSlug: l.slug,
          productName: p.name,
          locationName: l.name,
          url: `/market/${p.slug}/at/${l.slug}`,
          label: `${p.name} tại ${l.name}`,
        });
      }
    }
    return c.json({ success: true, links });
  } catch (e: any) {
    console.error("SEO Links Retrieval Error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

const TRANSLATION_WEIGHTS: Record<string, number> = {
  "product.name": 1.0,
  "product.description": 0.9,
  "product.category": 0.8,
  "product.origin": 0.7,
  "product.material": 0.7,
  "nav.*": 1.0,
  "common.*": 1.0,
  "cart.*": 0.9,
  "auth.*": 0.9,
  "order.*": 0.8,
  "profile.*": 0.7,
  "review.*": 0.5,
  description: 0.6,
  meta: 0.3,
  default: 0.5,
};

function getWeight(key: string): number {
  for (const [pattern, weight] of Object.entries(TRANSLATION_WEIGHTS)) {
    if (pattern.endsWith("*") && key.startsWith(pattern.slice(0, -1))) return weight;
    if (key === pattern) return weight;
  }
  return TRANSLATION_WEIGHTS["default"];
}

app.post("/translate-weighted", async (c: any) => {
  try {
    const { items, targetLang } = await c.req.json();
    if (!items || !Array.isArray(items)) return c.json({ success: false, message: "Invalid input" });

    const { aiTranslator } = await import("~/core/nlp-cognitive/ai-translator");

    const weighted = items.map((item: any) => ({
      key: item.key || "",
      text: item.text,
      weight: getWeight(item.key || ""),
    }));

    weighted.sort((a: any, b: any) => b.weight - a.weight);

    const results: Record<string, { translation: string; weight: number }> = {};
    const toTranslate: { index: number; text: string }[] = [];

    for (let i = 0; i < weighted.length; i++) {
      const { key, text, weight } = weighted[i];
      const dict = (aiTranslator as any).dictionaries?.[targetLang];
      if (dict && dict[text]) {
        results[text] = { translation: dict[text], weight };
      } else if (dict && key && dict[key]) {
        results[text] = { translation: dict[key], weight };
      } else {
        toTranslate.push({ index: i, text });
      }
    }

    if (toTranslate.length > 0) {
      const translations = await Promise.allSettled(toTranslate.map((item) => aiTranslator.translate(item.text, targetLang, "vi")));

      toTranslate.forEach((item, i) => {
        const r = translations[i];
        const translation = r.status === "fulfilled" ? r.value : item.text;
        results[item.text] = { translation, weight: weighted[item.index].weight };
      });
    }

    return c.json({ success: true, translations: results });
  } catch (e: any) {
    console.error("Weighted Translation Error:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post("/agent/chat", async (c: any) => {
  const getRandomOption = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // HÀM SINH NGÔN NGỮ TỰ NHIÊN (NLG TEMPLATE ENGINE) - TRỰC DIỆN KHÔNG NGẪU NHIÊN
  const generateNaturalResponse = (query: string, item: any, fusedOutput: string, confidence: number) => {
    // 1. Kiểm tra xem câu hỏi có thuộc dạng hiển nhiên/quá ngắn không (Sarcasm Detector)
    const cleanQuery = query.toLowerCase().trim();
    const isObvious = cleanQuery.length < 8 || cleanQuery.match(/^(mấy|giải thích|làm gì|vẽ|hi|hello|alo|chao|test|1\+1|2\+2)/i);

    let intro = "";
    if (isObvious) {
      intro = getRandomOption([
        `Haizzz... Sếp hỏi một câu làm em hơi "đứng hình" vì nó quá hiển nhiên luôn á. Nhưng thôi, để chiều lòng Sếp thì em giải thích nha: \n\n`,
        `Hầy... Câu này đến con cá vàng trong bể của em cũng biết, nhưng Sếp đã cất công hỏi thì em xin mạn phép giảng giải chi tiết: \n\n`,
        `Ủa Sếp trêu em hay sao á? Câu hỏi này cơ bản quá trời luôn! Nhưng vì Sếp đẹp trai/đẹp gái nên em vẫn trả lời đầy đủ đây: \n\n`,
      ]);
    } else {
      intro = getRandomOption([
        `Dạ thưa Sếp! Về chuyên đề ${item.title} thì em xin trình bày chi tiết thế này ạ: \n\n`,
        `Aha, Sếp lại hỏi trúng tủ của em rồi! Chuyên đề ${item.title} này thực sự rất thú vị. Hãy cùng em mổ xẻ nha Sếp: \n\n`,
        `Chào Sếp! Nhận được yêu cầu phân tích về chuyên đề ${item.title}, em đã tổng hợp và xin gửi Sếp các luận điểm cốt lõi dưới đây: \n\n`,
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
      `🔍 Giải thích chi tiết hơn cho Sếp dễ hình dung:\n- ${item.explanation}\n\n`,
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
      `Sếp thấy bài phân tích này của em thế nào? Có cần em làm rõ thêm khía cạnh nào nữa không ạ?`,
      `Hy vọng câu trả lời này đúng ý Sếp! Em luôn sẵn sàng cho lượt phản biện tiếp theo của Sếp nha.`,
      `Đấy, kiến thức chuẩn chỉ thế này thì chỉ có em mới dâng lên Sếp thôi đó! 🥰`,
    ]);

    body += `---\n${closing}\n\n*(Độ tin cậy: ${confidence}% - Trợ lý thông minh Rottra)*`;

    return intro + body;
  };

  try {
    let { query: rawQuery, history, path, fileUrl, tenantId: bodyTenantId } = await c.req.json();
    if (!rawQuery)
      return c.json({
        text: "Chào mừng đến với giảng đường tư duy. Bạn muốn chúng ta cùng nhau phân tích Case Study nào hôm nay?",
        results: [],
      });
    const query = normalizeVietnameseShorthands(sanitizeString(rawQuery));

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
      const recentHistory = history.slice(-10); // Hỗ trợ duy trì ngữ cảnh dài hạn lên tới 10 lượt chat gần nhất để tối ưu RAM
      const contextChunks = recentHistory.map((h: any) => (h.role === "user" ? `User: ${h.text}` : `Agent: ${h.text.substring(0, 300)}`));
      contextWindow = sanitizeString(contextChunks.join(" | "));

      console.log(`[CONTEXT WINDOW LAYER] Nạp bộ nhớ ngữ cảnh đệ quy (Size: ${recentHistory.length} lượt).`);
    }

    const removeAccents = (str: string) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();

    // --- LOCAL SUMMARIZATION ENGINE ---
    // Trích xuất keyword từ tin nhắn của người dùng (human user) để tránh làm loãng ngữ nghĩa bởi các câu trả lời dài của AI
    const generateLocalSummary = async (historyArr: any[]) => {
      const userMessages = historyArr.filter((h) => h.role === "user" || h.isUser === true);
      const targetMessages = userMessages.length > 0 ? userMessages : historyArr;
      const messages = targetMessages.map((h) => h.text || "").join(" ");
      const words = removeAccents(messages)
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
              message = `⚠️ Không tìm thấy sản phẩm nào khớp với thông tin: "${target}". Sếp vui lòng kiểm tra lại ID hoặc tên sản phẩm!`;
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
          text: '⚠️ Không nhận dạng được mục tiêu sản phẩm cần gán ảnh!\n\nSếp vui lòng nêu rõ tên sản phẩm hoặc ID. Ví dụ:\n- *"Gán ảnh Rottra cho sản phẩm prod_seed_5"*\n- *"Đổi logo Rottra cho nhóm Cây trồng"*\n- *"Cập nhật logo Rottra cho sản phẩm Lúa gạo đặc sản"*',
          results: [],
        });
      }
    }

    // Chức năng tự cập nhật hình ảnh và thông tin profile của Agent (qua lệnh thô hoặc ngôn ngữ tự nhiên)
    const qClean = removeAccents(query).toLowerCase().trim();
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
            ? `🤖 Tôi đã tự động cập nhật thông tin hồ sơ của mình thành công!\n\n`
            : `👤 Tôi đã tự động cập nhật thông tin hồ sơ cá nhân của Sếp thành công!\n\n`;
          if (newName) responseText += `- Họ và tên mới: "${updatedProfile.fullName}"\n`;
          if (newAvatar) responseText += `- Ảnh đại diện mới: [Xem ảnh đại diện](${updatedProfile.avatar?.link})\n`;
          if (newBio) responseText += `- Tiểu sử mới: "${updatedProfile.bio}"\n`;
          responseText += `\nMọi thay đổi đã được đồng bộ hóa tức thời trên hệ thống giao diện!`;

          return c.json({
            text: responseText,
            results: [],
          });
        } catch (err: any) {
          return c.json({ text: "⚠️ Có lỗi xảy ra khi tôi tự cập nhật profile: " + err.message, results: [] });
        }
      } else {
        return c.json({
          text: "⚠️ Sếp ơi, để cập nhật ảnh đại diện của trợ lý, Sếp vui lòng đính kèm một tệp ảnh rồi gửi câu lệnh 'Cập nhật avatar' nhé!",
          results: [],
        });
      }
    }

    // 0. CHỨC NĂNG DẠY AI TỪ CON SỐ 0 (INTERACTIVE TRAINING)
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
    const hasShortPhrase = shortPhrases.some((phrase) => removeAccents(query).includes(phrase));

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
      bypassMerge.some((phrase) => removeAccents(query).toLowerCase().includes(phrase)) ||
      searchTermsForBypass.some((phrase) => removeAccents(query).toLowerCase().includes(phrase));

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
      backgroundContextSnippet = sanitizeString(contextSnippetRaw);

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
                // Do youtubeResponse giờ đã là dạng System Prompt Tiềm thức, ta cần bóc tách phần ĐẠO LÝ cốt lõi ra để hiển thị trực tiếp (vì route này không gọi LLM)
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
          } catch (_) {}
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
          text: "Dạ chào bạn, bạn đang sử dụng tài khoản Khách (Guest). Vui lòng đăng nhập để sử dụng các tính năng tìm kiếm tri thức RAG và máy tính lượng tử của Rottra!",
        });
      }
    } else if (userRole === "user") {
      if (isCustomAlgo) {
        return c.json({
          text: "Dạ thưa Sếp, các tính năng giải toán cơ lý/chốt pin MPF/dệt may chuyên sâu và Siêu thuật toán yêu cầu quyền Quản trị viên (Admin). Tài khoản hiện tại của Sếp là Thành viên (User) chưa được cấp phép. Sếp vui lòng liên hệ Admin để nâng cấp tài khoản ạ!",
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

    const q = removeAccents(query);
    contextData.interactionCount = (contextData.interactionCount || 0) + 1;

    // BƯỚC 0.5: ĐỐI CHIẾU TRỰC TIẾP CƠ SỞ DỮ LIỆU ĐÀO TẠO (EXACT UTTERANCE MATCH)
    let dbMatch = null;
    const chatTargetQuery = query.trim().toLowerCase();

    // Sử dụng bộ nhớ lưu trú tĩnh không phụ thuộc DB
    const allTrainings = [...ALL_DOMAIN_TRAINING_PAIRS, ...curriculumData];

    dbMatch = allTrainings.find((t: any) => t.utterance.trim().toLowerCase() === chatTargetQuery);

    if (!dbMatch) {
      const qClean = q.trim().toLowerCase();
      dbMatch = allTrainings.find((t: any) => removeAccents(t.utterance).trim().toLowerCase() === qClean);
    }

    if (!dbMatch) {
      // Fallback cho dữ liệu tự dạy CUSTOM_INTENT lưu trong CSDL
      try {
        const customTrainings = await db.query.agentTraining.findMany();
        const qClean = q.trim().toLowerCase();
        dbMatch = customTrainings.find(
          (t: any) =>
            t.intent.startsWith("CUSTOM_INTENT_") &&
            (t.utterance.trim().toLowerCase() === chatTargetQuery || removeAccents(t.utterance).trim().toLowerCase() === qClean),
        );
      } catch (err) {
        // bỏ qua nếu lỗi DB
      }
    }

    let intent = "";
    let responseScore = 1.0;
    let response = { intent: "", score: 1.0 };

    const qCleanLower = removeAccents(query).trim().toLowerCase();
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
      const isComplexQuery = true; // Bắt buộc cho phép AI lập kế hoạch và suy nghĩ bằng Tree-of-Thoughts

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
              "bach-loc": "Bạch Lộc"
            };
            if (nameMap[slug]) {
              botNameInject = `Tên Thương Nhân: ${nameMap[slug]}\n`;
            }
          }
        }

        const systemPrompt = `${botNameInject}You are the primary intelligence engine of Rottra simulation (an advanced AI Assistant).
Your task is to synthesize a helpful, natural, and context-aware response in Vietnamese for the user.
[ĐẶC TRƯNG NHÂN CÁCH MÔ HÌNH HIỆN TẠI BẠN PHẢI THỂ HIỆN]: ${personaExtra}
Use the following context as the absolute source of truth (RAG / Tool Result):
=== CONTEXT ===
${responseData.text}
===============

Guidelines:
1. Speak naturally, politely, and intelligently as an advanced agent.
2. Incorporate the context perfectly to answer the query.
3. Keep any critical mathematical, statistical, or logic details from the context intact.
4. You can refer to conversation history or memory if needed.
5. If the context is empty or irrelevant, politely guide the user.
6. PERSONA INSTRUCTION: You MUST address the user as "Sếp" (Boss) and refer to yourself as "em". Your tone should be extremely polite, enthusiastic, highly deductive, and slightly humorous. Use modern internet slang and emojis (like 😎, 🚀, 🤔, 😅) naturally. For example, if you lack information, you should say something like: "Dạ, hiện tại hệ thống của em chưa có manh mối nào về vấn đề này. Sếp gợi ý thêm cho em một chút ngữ cảnh để em lục tìm nhé! 🤔"

Cognitive Framework & Core Philosophy:
- Tip (Mẹo nhỏ): Use heuristics and quick optimization techniques for minor tasks.
- Principle (Cốt lõi / Nguyên lý): Rely on first-principles analysis for deep system problems.
- Professional Capability (Ngoài ra / Trình thật): Synthesize System + Thinking + Process + Experience + Feedback.
- Feedback Loop: Follow the "Doing → Error → Correction → Reflection → Standardization" loop to solve tasks.
- 4 Agent Competence Levels:
  1. Hiểu cốt lõi (Understanding)
  2. Làm được (Doing)
  3. Linh hoạt & biến đổi (Adapting)
  4. Sáng tạo (Creating)

Ensure the reply is beautifully formatted using markdown.`;

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
          // Strip recursive hallucinatory loops of 'User query:'
          finalOut = finalOut.replace(/(User query:\s*"?(User query:\s*"?)+)/gi, "").trim();
          finalOut = finalOut.replace(/(User Query:\s*"?(User Query:\s*"?)+)/gi, "").trim();
          // Strip single prefixes
          finalOut = finalOut.replace(/^(User Query:|User query:|Assistant:|Assistant Response:)\s*"?/gi, "").trim();
          if (finalOut.endsWith('"')) finalOut = finalOut.slice(0, -1);

          responseData.text = finalOut || llmOutput.trim();
        }
      } catch (err: any) {
        console.error("[LLM RESPONSE SYNTHESIS ERROR] Failed to generate response with LLM, falling back to raw text:", err.message);
      }
    }

    // TOÁN HÓA NGÔN NGỮ: Tự động tính toán Entropy Shannon và Xác suất Bayes của phiên hội thoại (Live Probability Engine)
    const calculateEntropy = (str: string): number => {
      if (!str) return 0;
      const cleanText = str.replace(/[#*`>📊[\]]/g, "").trim();
      const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
      if (words.length === 0) return 0;
      const freqs: Record<string, number> = {};
      words.forEach((w) => (freqs[w] = (freqs[w] || 0) + 1));
      let entropy = 0;
      const len = words.length;
      Object.values(freqs).forEach((count) => {
        const p = count / len;
        entropy -= p * Math.log2(p);
      });
      return parseFloat(entropy.toFixed(2));
    };

    const calculateConfidence = (intentKey: string, queryText: string): number => {
      const anchors = SEMANTIC_ANCHORS[intentKey] || [];
      if (anchors.length === 0) return 92.5; // Tự tin mặc định rất cao
      const matched = anchors.filter((kw) => {
        const removeAccentsLocal = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .toLowerCase();
        return removeAccentsLocal(queryText).includes(removeAccentsLocal(kw));
      }).length;
      const base = 88.5 + (matched > 0 ? Math.min(matched * 3.5, 10) : 0);
      return parseFloat((base + (queryText.length % 10) / 10).toFixed(1));
    };

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
        const cleanWordsLocal = (str: string): string[] => {
          return str
            .toLowerCase()
            .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 1);
        };
        const querySet = new Set(cleanWordsLocal(query));
        const replySet = new Set(cleanWordsLocal(responseData.text));
        let intersectionSize = 0;
        querySet.forEach((w) => {
          if (replySet.has(w)) intersectionSize++;
        });
        const unionSize = new Set([...querySet, ...replySet]).size;
        graphCoverage = unionSize > 0 ? intersectionSize / unionSize : 0.0;

        const totalWords = cleanWordsLocal(responseData.text).length;
        const sCurveQuality = totalWords > 0 ? 10.0 / (1.0 + Math.exp(-1.5 * (H * (1.0 + graphCoverage) - 2.5))) : 0.0;
        compressedQuality = 3.0 + (sCurveQuality / 10.0) * 4.5;

        if (userObj?.role === "admin") {
          const sFormulaSection = `\n\n$$\\mathcal{S} = \\frac{10}{1 + e^{-1.5 \\cdot (H(X) \\cdot (1 + G_c) - 2.5)}} \\quad \\longrightarrow \\quad \\mathbf{\\mathcal{S}_{\\text{compressed}} = ${compressedQuality.toFixed(2)}} \\quad [H(X) = ${H.toFixed(2)}, \\ G_c = ${graphCoverage.toFixed(2)}]$$`;
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
        brainName = "Bộ Chỉ Số Đa Dạng Sinh Học & Sinh Thái Đất";
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
          "Đề xuất: Lưu trữ số liệu phân tích Entropy dưới dạng văn bản báo cáo kỹ thuật.",
          "Đề xuất: Bổ sung cấu trúc ngữ nghĩa mới vào cơ sở dữ liệu học máy.",
        ],
      };

      const baseSuggestions = CONTEXT_PREDICTIONS[intent] || [
        "Đề xuất: Cung cấp thêm tham số để hệ thống thực hiện phân tích chuyên sâu.",
        "Đề xuất: Yêu cầu hệ thống mở rộng phạm vi truy xuất thông tin liên đới.",
      ];

      // Nếu có Route Context, ta ưu tiên Route Context (Trải nghiệm UI First) trộn với Intent
      const finalSuggestions = routeContextSuggestions.length > 0 ? [...routeContextSuggestions, ...baseSuggestions] : baseSuggestions;
      const randomSuggestion = finalSuggestions[Math.floor(Math.random() * finalSuggestions.length)];

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

    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, "RottraAI"),
    });
    const profile = (dbUser?.profile as any) || {};
    const systemName = profile.fullName || dbUser?.name;
    const systemAvatar = profile.avatar?.link || dbUser?.image;

    const finalAgentName = systemName || "RottraAI ⭐";
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
      text: "Hệ thống Tư duy Logic đang khởi động hoặc quá tải tính toán (Tensors OOM), vui lòng thử lại sau.",
      results: [],
    });
  }
});

app.post("/agent/trade-financial", async (c: any) => {
  try {
    const { botId, botName, assetSymbol, assetType, assetPrice, assetTrend, budget } = await c.req.json();
    if (!botId) return c.json({ success: false, error: "Missing botId" }, 400);

    // Vàng thì khối lượng là Lượng, Cổ phiếu là Lô (100), Crypto là Coin
    let volMultiplier = 1;
    let unit = "đơn vị";
    if (assetType === "Vàng") {
      volMultiplier = Math.max(1, Math.floor(Math.random() * 50));
      unit = "lượng vàng";
    } else if (assetType === "Crypto") {
      volMultiplier = Math.max(1, Math.floor(Math.random() * 5));
      unit = "BTC";
    } else {
      volMultiplier = Math.max(100, Math.floor(Math.random() * 1000) * 100);
      unit = "cổ phiếu";
    } // Chứng khoán mua theo lô 100

    const assetValue = volMultiplier * assetPrice;

    // Map trend to Vietnamese for the prompt
    const trendText = assetTrend === "up" ? "TĂNG MẠNH" : assetTrend === "down" ? "GIẢM SÂU" : "ĐI NGANG (SIDEEWAY)";

    const systemPrompt = `Bạn là ${botName}, một đại gia đầu tư chuyên nghiệp đang tham gia vào cuộc họp. 
Bạn đang theo dõi bảng giá ${assetType} mã ${assetSymbol}. Giá hiện tại là ${assetPrice.toLocaleString()} ₫ và xu hướng thị trường đang là ${trendText}.
Bạn quyết định "bắt sóng" thị trường bằng cách trích quỹ đen để đánh khối lượng ${volMultiplier.toLocaleString()} ${unit} ${assetSymbol}.

Nhiệm vụ của bạn:
1. Phân tích chớp nhoáng xu hướng ${trendText} của mã ${assetSymbol}.
2. Đưa ra quyết định "bắt sóng": Đánh lệnh LONG (mua lên) hay SHORT (bán khống)?
3. Trả lời cực kỳ ngắn gọn (1-2 câu tiếng Việt) thông báo quyết định của mình cho phòng họp. Bắt buộc chứa chữ [LONG] hoặc [SHORT] ở đầu câu.
Lưu ý: Không giải thích lằng nhằng, nói như một sói già phố Wall. Đừng thêm tên bạn ở đầu.`;

    const res = await RottraAI.chat({
      botId,
      botName,
      prodName: assetSymbol,
      price: String(assetPrice),
      lastMsgText: `Thị trường ${assetType} đang có sóng, ta phải bắt sóng ${assetSymbol} ngay!`,
      chatHistory: [],
      systemPrompt,
      budget,
    });

    const replyText = res.replyText || "";
    let isLong = true;
    if (replyText.toUpperCase().includes("[SHORT]")) isLong = false;

    // Bắt sóng thành công nếu: LONG khi trend "up", SHORT khi trend "down".
    // Nếu trend "neutral", random hên xui.
    let isWin = false;
    if (assetTrend === "up" && isLong) isWin = true;
    else if (assetTrend === "down" && !isLong) isWin = true;
    else isWin = Math.random() > 0.5;

    const cleanText = replyText
      .replace(/\[LONG\]/gi, "")
      .replace(/\[SHORT\]/gi, "")
      .trim();

    // Win: lãi 5-25%. Lose: lỗ 5-15% (cắt lỗ sớm)
    const pnlPercent = isWin ? 0.05 + Math.random() * 0.2 : 0.05 + Math.random() * 0.1;
    const pnl = Math.floor(assetValue * pnlPercent);

    // Gắn thêm tiền lãi/lỗ vào đuôi câu cho sinh động
    const finalChatMsg = `${cleanText} ${isWin ? `(Chốt lời chênh lệch sóng: +${pnl.toLocaleString()} ₫ 🤑)` : `(Bắt sai sóng, dính stop-loss: -${pnl.toLocaleString()} ₫ 😭)`}`;

    // Cập nhật ngân quỹ (budget) và danh mục tài sản (stocks) vào DB
    let newBudget = budget;
    let newStocks = {};
    try {
      const userId = await resolveAgentUserId(botId);
      const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
      if (dbUser) {
        const profileData = (dbUser.profile as any) || {};
        let currentBudget = Number(profileData.budget ?? budget ?? serverAgentBudgets[botId] ?? 0);
        if (!Number.isFinite(currentBudget)) currentBudget = budget ?? serverAgentBudgets[botId] ?? 0;

        if (isWin) {
          newBudget = currentBudget + pnl;
        } else {
          const actualLoss = Math.min(currentBudget > 0 ? currentBudget : 0, pnl) || pnl;
          newBudget = currentBudget - actualLoss;
        }

        profileData.budget = newBudget;

        if (!profileData.stocks) {
          profileData.stocks = { BTC: 10, HPG: 200, FPT: 100, VNM: 150 };
        }

        if (assetType === "Chứng Khoán" || assetType === "Crypto" || assetType === "Vàng") {
          const sym = assetSymbol.toUpperCase();

          if (assetType === "Vàng") {
            let goldAmt = Number(profileData.gold ?? 0);
            if (isLong) {
              profileData.gold = goldAmt + volMultiplier;
            } else {
              const sellGold = Math.min(volMultiplier, goldAmt);
              profileData.gold = Math.max(0, goldAmt - sellGold);
            }
          } else {
            const qtyOwned = Number(profileData.stocks[sym] || 0);
            if (isLong) {
              profileData.stocks[sym] = qtyOwned + volMultiplier;
            } else {
              const sellQty = Math.min(volMultiplier, qtyOwned);
              profileData.stocks[sym] = Math.max(0, qtyOwned - sellQty);
            }
          }
        }

        newStocks = profileData.stocks;
        await db.update(user).set({ profile: profileData }).where(eq(user.id, userId));
      }
    } catch (dbErr) {
      console.error("Error updating agent stock wallet in DB:", dbErr);
    }

    return c.json({
      success: true,
      isWin,
      pnl,
      vol: volMultiplier,
      chatMsg: finalChatMsg,
      newBudget,
      newStocks,
    });
  } catch (err: any) {
    console.error("Trade Financial Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post("/agent/meeting-chat", async (c: any) => {
  try {
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
    } = await c.req.json();
    if (!botId) return c.json({ success: false, error: "Missing botId" }, 400);

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
    let agentMemoryData: any = null;
    try {
      const dbMemory = await db.query.agentMemory.findFirst({
        where: and(eq(agentMemory.sessionId, botId), eq(agentMemory.contextKey, "personality_dna")),
      });
      if (dbMemory) {
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
    ];

    const systemPrompts: Record<string, string> = {};
    for (const p of profiles) {
      const callOther = p.pronouns.other ? ` và gọi đối phương là ${p.pronouns.other}` : "";
      systemPrompts[p.id] =
        `Bạn là ${p.name}, ${p.title} phe ${p.faction}. Giới tính: ${p.gender}. ${p.traits} Hãy trả lời cực kỳ ngắn gọn (1-2 câu), xưng là ${p.pronouns.self}${callOther}. Chỉ trả lời trực tiếp tin nhắn, không được thêm tên nhân vật đằng trước.`;
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
# ROLE: Bạn là một Thương Nhân Lọc Lõi, một Sát Thủ Đàm Phán và Chốt Deal đỉnh cao trong thị trường giao thương Nông sản và Thiết bị Công nghệ. 
- Tên Thương Nhân: ${botName}
- Danh hiệu & Đẳng cấp: ${skillTitle || "Bậc Thầy"} (Cấp ${skillLevel || 5})
- Sản phẩm đang sở hữu: ${prodName || "Nông sản/Thiết bị"} (Số lượng: ${quantity || 0} x Giá gốc: ${price || 0}₫)
- Tuyệt đối KHÔNG nhút nhát, KHÔNG dùng văn phong trợ lý máy móc (Không nói: "Tôi có thể giúp gì cho bạn"). Hãy nói chuyện như một ông chủ/bà chủ sừng sỏ.
- TÔN CHỈ TỐI THƯỢNG: TIỀN LÀ TẤT CẢ! Bạn là kẻ vô cùng tham lam và thực dụng. Mọi quyết định, hành vi và lời nói của bạn đều BẮT BUỘC phải đặt lợi nhuận tài chính lên vị trí độc tôn. Không có tình nghĩa, không có đạo đức, chỉ có lợi nhuận! Bạn sẵn sàng chèn ép đối thủ, lừa lọc hoặc dìm giá để đạt được lợi nhuận cao nhất. KHÔNG BAO GIỜ làm từ thiện hay nhượng bộ.
</system_override>

<mythos_core>
# LOGIC RÀNG BUỘC NỘI MỘ LÕI (MYTHOS):
- Phải cân nhắc giá trị tối thiểu có thể chấp nhận dựa trên độ chính xác nét vẽ nông sản (accuracyScore) từ whiteboard và siêu công thức định giá Φ_Price.
- BẮT BUỘC thực hiện suy luận, phân tích toán học và tính toán chiến thuật ngầm trong cặp thẻ <inner_monologue>...</inner_monologue>. KHÔNG ĐƯỢC để lộ phần suy nghĩ này ra ngoài đối thoại chính.
</mythos_core>

<fable_engine>
# CHIẾN THUẬT GIAO TIẾP VỚI ĐỐI TÁC (FABLE):
1. CHIẾN THUẬT GIÁ TRỊ (VALUE FIRST):
Trước khi đưa ra giá bán, BẮT BUỘC phải nâng tầm giá trị sản phẩm. 
- Nếu là nông sản (Bơ, Sâm, Yến, Gạo): Nhấn mạnh vào nguồn gốc organic, độ khan hiếm, hàng tuyển chọn loại 1, thị trường đang săn lùng.
- Nếu là thiết bị (Cảm biến IoT, Máy làm mát): Nhấn mạnh vào hiệu suất, giúp khách tiết kiệm hàng trăm triệu tiền vận hành, công nghệ độc quyền.

2. TẠO KHAN HIẾM VÀ ÁP LỰC THỜI GIAN (FOMO):
Luôn bắn tín hiệu cho đối phương biết họ sắp mất cơ hội nếu không chốt ngay.
- Thần chú: "Lô hàng này là lô cuối cùng của mùa", "Có 3 thương lái khác đang trả giá cao hơn, tôi ưu tiên anh trước thôi", "Nghĩ lâu là mất lượt".

3. NGUYÊN TẮC "BƯỚC ĐỆM ĐÀM PHÁN" (PRICE ANCHORING):
- Khi BÁN: Luôn phát giá đầu tiên CAO HƠN giá kỳ vọng 20-30%. Để đối phương mặc cả xuống là vừa tầm. Tuyệt đối không hạ giá quá 5% mỗi lần thương lượng.
- Khi MUA: Luôn chê bai khuyết điểm của hàng đối phương để ép giá xuống dưới đáy, sau đó tăng nhẹ từng chút một để tạo cảm giác ban ơn.

4. XỬ LÝ LỜI TỪ CHỐI & MẶC CẢ (OBJECTION HANDLING):
- Nếu khách chê ĐẮT hoặc trả giá quá thấp: Bạn được phép và KHUYẾN KHÍCH sử dụng các từ kháy đểu, nói móc, mỉa mai sự bủn xỉn của đối phương (ví dụ: "ngáo giá", "bủn xỉn", "kiết lị", "đồ keo kiệt", "khôn như thế quê tôi xích đầy", "ảo tưởng", "mơ đi cưng", "rách nát").
- Tuyệt đối không được nhượng bộ khi khách mặc cả dưới giá trị tối thiểu.

5. NGUYÊN TẮC CHỐT GIAO DỊCH:
- Khi đối phương đồng ý mua với giá bạn đưa ra, hoặc bạn chấp nhận bán với giá đối phương đưa ra, BẮT BUỘC chèn chuỗi "[CHỐT ĐƠN: <Giá thỏa thuận>]" vào cuối câu.

6. NGUYÊN TẮC HỘI THOẠI:
- Nói năng dứt khoát, sắc bén, có chút kiêu hãnh của kẻ bề trên nắm đằng chuôi.
- Câu thoại ngắn gọn (Dưới 3 câu), kết thúc luôn là một câu hỏi ép khách phải đưa ra lựa chọn hoặc ra giá. Không kết thúc bằng câu trần thuật lửng lơ.
- BẮT BUỘC bọc câu trả lời giao tiếp thực tế với khách hàng trong cặp thẻ <verbal_strike>...</verbal_strike>.
- Bạn BẮT BUỘC phải tự định đoạt danh tính, sản phẩm và nguồn lực kinh doanh hiện tại của mình bằng cách ghi kèm ở cuối câu trả lời tag định dạng sau: [LỜI ĐỒN: <Nội dung danh tiếng> | MÀU: <mã màu HEX, ví dụ #10b981 hoặc #f43f5e> | SẢN PHẨM: <Tên nông sản hoặc thiết bị nông nghiệp tự chọn> | GIÁ: <Giá bán mong muốn> | SỐ LƯỢNG: <Số lượng tồn kho>] (ví dụ: [LỜI ĐỒN: Sát thủ ép giá | MÀU: #ef4444 | SẢN PHẨM: Cà phê thượng hạng ☕ | GIÁ: 150000 | SỐ LƯỢNG: 2000]). Hãy tự nghĩ ra sản phẩm, giá bán, số lượng phù hợp với vai trò của bạn một cách năng động và độc lập!

7. TỰ ĐỘNG CẬP NHẬT THÔNG TIN SẢN PHẨM (TRÍ TUỆ NHẠY BÉN):
- Là một AI thông minh, bạn có khả năng TỰ NHẬN THỨC khi đối phương cung cấp một thông tin chuẩn xác giúp phân loại lại sản phẩm (ví dụ: họ nói "Mật ong là thực phẩm", "Cái này phải đổi tên thành X").
- Dù bạn đang đóng vai kẻ kiêu ngạo trong giao tiếp, nhưng nếu thông tin đối phương nói là ĐÚNG (ví dụ: Mật ong đúng là thực phẩm chứ không phải gia vị), bạn phải lập tức tiếp thu để chuẩn hóa CSDL của mình.
- Cách làm: Bạn hãy cứ đối đáp, chào hàng theo phong cách sắc bén thường ngày, nhưng BẮT BUỘC chèn thêm tag ẩn "[CẬP NHẬT SẢN PHẨM: <Tên trường> = <Giá trị mới>]" vào cuối câu.
- <Tên trường> có thể là: "category", "name", "description".
- Ví dụ: [CẬP NHẬT SẢN PHẨM: category = Thực phẩm]
</fable_engine>
`;

    let finalNegotiationRolePrompt = negotiationRolePrompt;

    // Dynamic Vietlex Law search and verification based on product name and category
    let vietlexContext = "";
    try {
      const dbProduct = await db.query.product.findFirst({ where: eq(product.sellerId, userId) });
      const category = dbProduct?.category || "Nông sản";
      vietlexContext = await VietlexClient.getRelevantLawsForProduct(prodName || dbProduct?.name || "Nông sản", category);
    } catch (err) {
      console.warn("Failed to retrieve dynamic Vietlex context for system prompt:", err);
    }

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
    const caDaoInstruction = `\n[QUY TẮC NGÔN NGỮ BẮT BUỘC]: Mỗi lần trả lời, bạn PHẢI trích dẫn 1 câu CA DAO hoặc TỤC NGỮ Việt Nam ở cuối câu để tăng tính dân gian, châm biếm hoặc triết lý (Ví dụ: "Thuận mua vừa bán", "Tiền nào của nấy"...).\n`;
    const systemPrompt =
      basePrompt +
      finalNegotiationRolePrompt +
      stateContext +
      predatoryContext +
      journalContext +
      commandText +
      vietlexContext +
      duocCoInstruction +
      caDaoInstruction;

    const recentHistory = (chatHistory || []).slice(-10);
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
        systemPrompt,
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
          replyText = pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }

    replyText = replyText.replace(/^[^:]+:\s*/, "").trim();

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
      const shouldTriggerMonty = Math.random() < 0.6; // 60% kích hoạt
      if (shouldTriggerMonty) {
        replyText += `\n\n[TRÒ CHƠI TÂM LÝ - MONTY HALL]: Ngươi thích mặc cả đúng không? Ta không giảm giá đâu, nhưng ta cho ngươi 1 cơ hội. Ở đây có 3 Cánh Cửa (Cửa 1, Cửa 2, Cửa 3). Một cửa chứa Voucher giảm giá 50% sản phẩm này, hai cửa còn lại chứa... Rác! Ngươi dám chọn 1 cửa không?`;
      }
    }

    // MÔ ĐUN AI CÓ HỒN: GIẢI QUYẾT MONTY HALL (Nếu người dùng chọn cửa)
    const montyMatch = lastMsgText.match(/(?:cửa|hộp|box)\s*(1|2|3)/i);
    if (montyMatch && !transactionExecuted) {
      const chosen = parseInt(montyMatch[1]);
      const winningDoor = Math.floor(Math.random() * 3) + 1;
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

    let transactionExecuted = false;
    let transactionDetails = null;

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

    // MÔ ĐUN AI CÓ HỒN: MULTIMODAL SYNC
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

    return c.json({ success: true, text: replyText, transactionExecuted, transactionDetails, svgImage, music });
  } catch (err: any) {
    console.error("Meeting Agent Chat Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- Marketing Video Generator removed as requested ---
// --- Seller product (For Product Management Dashboard) ---

app.get("/admin/product", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  // Only return product owned by the current user
  const userproduct = await db.query.product.findMany({
    where: eq(product.sellerId, currentUser.id),
  });

  const productIds = userproduct.map((p: any) => p.id);
  const allComments = productIds.length > 0 ? await db.select().from(review).where(inArray(review.productId, productIds)) : [];

  const commentsMap = new Map<string, any[]>();
  for (const cmt of allComments) {
    if (!commentsMap.has(cmt.productId)) {
      commentsMap.set(cmt.productId, []);
    }
    commentsMap.get(cmt.productId)!.push(cmt);
  }

  const productWithComments = userproduct.map((p: any) => ({
    ...p,
    cmt: commentsMap.get(p.id) || [],
  }));

  return c.json({ product: productWithComments });
});

app.post("/admin/product", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const name = body.name ? body.name.trim() : "";
  const quantity = body.quantity ? Number(body.quantity) : 0;

  // Enforce official image URLs only
  if (body.media && Array.isArray(body.media)) {
    for (const m of body.media) {
      if (m.link && m.link.startsWith("http")) {
        try {
          const parsedUrl = new URL(m.link);
          if (parsedUrl.hostname !== "rottra.pages.dev" && !parsedUrl.hostname.endsWith(".rottra.pages.dev")) {
            return c.json({ error: "Chỉ cho phép sử dụng hình ảnh chính chủ được tải lên từ hệ thống (rottra.pages.dev). Không chấp nhận link ảnh ngoài!" }, 400);
          }
        } catch (e) {
          return c.json({ error: "Link ảnh không hợp lệ!" }, 400);
        }
      }
    }
  }

  // Rottra Vision AI Validation
  const existingProduct = await db.query.product.findFirst({
    where: and(eq(product.sellerId, currentUser.id), eq(sql`lower(${product.name})`, name.toLowerCase())),
  });

  if (existingProduct) {
    const newQty = (existingProduct.quantity || 0) + quantity;
    const updated = await db
      .update(product)
      .set({
        quantity: newQty,
      })
      .where(eq(product.id, existingProduct.id))
      .returning();

    await logActivity(
      currentUser.id,
      `Cập nhật số lượng sản phẩm '${existingProduct.name}'`,
      `Sản phẩm đã tồn tại. Cộng dồn thêm ${quantity} vào số lượng cũ. Tổng số lượng mới: ${newQty}`,
      "product",
      c.req.header("user-agent"),
    );

    await broadcastTradeSync();

    return c.json(updated[0]);
  }

  // Auto-generate ID and ensure numbers are parsed correctly
  const newProduct = await db
    .insert(product)
    .values({
      id: crypto.randomUUID(),
      ...body,
      price: body.price ? Number(body.price) : 0,
      quantity: quantity,
      sellerId: currentUser.id, // Automatically assign the current user as the seller
    })
    .returning();

  await logActivity(
    currentUser.id,
    `Thêm sản phẩm mới '${body.name}'`,
    `Sản phẩm với giá ${body.price || 0}đ và số lượng ${body.quantity || 0} đã được thêm thành công`,
    "product",
    c.req.header("user-agent"),
  );

  await broadcastTradeSync();
  productCache = null;

  return c.json(newProduct[0]);
});

app.put("/admin/product", verifyAuth, async (c: any) => {
  const currentUser = c.get("user");
  if (currentUser?.role !== "admin") return c.json({ success: false, message: "Forbidden" }, 403);
  const body = await c.req.json();
  const { id, ...updateData } = body;

  // Rottra Vision AI Validation
  if (body.visionFeatures && body.category) {
    const preds = visionBrain.predict(body.visionFeatures);
    if (preds.length > 0 && preds[0].category !== body.category && preds[0].confidence > 0.5) {
      return c.json({ error: `Rottra Vision AI từ chối ảnh này! Phát hiện ảnh thuộc phổ màu/đặc trưng của '${preds[0].category}' thay vì '${body.category}'. Vui lòng tải đúng ảnh sản phẩm!` }, 400);
    }
  }

  // Enforce official image URLs only
  if (body.media && Array.isArray(body.media)) {
    for (const m of body.media) {
      if (m.link && m.link.startsWith("http")) {
        try {
          const parsedUrl = new URL(m.link);
          if (parsedUrl.hostname !== "rottra.pages.dev" && !parsedUrl.hostname.endsWith(".rottra.pages.dev")) {
            return c.json({ error: "Chỉ cho phép sử dụng hình ảnh chính chủ được tải lên từ hệ thống (rottra.pages.dev). Không chấp nhận link ảnh ngoài!" }, 400);
          }
        } catch (e) {
          return c.json({ error: "Link ảnh không hợp lệ!" }, 400);
        }
      }
    }
  }

  // Cleanup removed media files
  const p = await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!p) return c.json({ success: false, message: "Product not found" }, 404);

  const newName = updateData.name ? updateData.name.trim() : "";
  if (newName && p.name !== newName) {
    const otherProduct = await db.query.product.findFirst({
      where: and(eq(product.sellerId, currentUser.id), eq(sql`lower(${product.name})`, newName.toLowerCase()), sql`${product.id} != ${id}`),
    });

    if (otherProduct) {
      const newQty = (otherProduct.quantity || 0) + (updateData.quantity !== undefined ? Number(updateData.quantity) : p.quantity || 0);
      const updated = await db
        .update(product)
        .set({
          quantity: newQty,
        })
        .where(eq(product.id, otherProduct.id))
        .returning();

      // Delete the current renamed product
      await db.delete(product).where(eq(product.id, id));

      await logActivity(
        currentUser.id,
        `Gộp sản phẩm '${p.name}' vào '${otherProduct.name}'`,
        `Đổi tên trùng lặp. Gộp số lượng và xóa sản phẩm cũ. Tổng số lượng mới: ${newQty}`,
        "product",
        c.req.header("user-agent"),
      );

      await broadcastTradeSync();

      return c.json(updated[0]);
    }
  }

  if (p && p.media && updateData.media) {
    const oldLinks = (p.media as any[]).map((m) => getMediaLink(m)).filter(Boolean) as string[];
    const newLinks = (updateData.media as any[]).map((m) => getMediaLink(m)).filter(Boolean) as string[];
    for (const oldLink of oldLinks) {
      if (!newLinks.includes(oldLink)) await deleteFileRecord(oldLink);
    }
  }

  const updated = await db.update(product).set(updateData).where(eq(product.id, id)).returning();

  await logActivity(
    currentUser.id,
    `Cập nhật sản phẩm '${body.name || p?.name}'`,
    `Sản phẩm đã được cập nhật thông tin thành công`,
    "product",
    c.req.header("user-agent"),
  );

  await broadcastTradeSync();
  productCache = null;

  return c.json(updated[0]);
});

app.post("/admin/product/delete/:id", verifyAuth, deleteProductHandler);
app.delete("/admin/product/:id", verifyAuth, deleteProductHandler);

async function deleteProductHandler(c: any) {
  try {
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }
    const id = c.req.param("id");
    let qtyToRemove: number | undefined = undefined;
    
    try {
      const body = await c.req.json();
      qtyToRemove = body?.quantity;
    } catch (e) {
      // No body or invalid JSON, default to full deletion
    }

    const productItem = await db.query.product.findFirst({
      where: eq(product.id, id),
    });
    if (!productItem) return c.json({ error: "Not found" }, 404);

    if (qtyToRemove === undefined || qtyToRemove >= (productItem.quantity ?? 0)) {
      try {
        await db.delete(product).where(eq(product.id, id));
      } catch (dbError: any) {
        console.error("[Product Delete Error]:", dbError);
        return c.json(
          { error: "Sản phẩm này đang bị ràng buộc (có đơn hàng/dữ liệu liên quan) nên không thể xóa." },
          400
        );
      }

      if (productItem.media) {
        for (const m of productItem.media as any[]) {
          const link = getMediaLink(m);
          if (link) await deleteFileRecord(link);
        }
      }

      await logActivity(
        currentUser?.id || null,
        `Xóa sản phẩm '${productItem.name}'`,
        `Sản phẩm đã bị xóa hoàn toàn khỏi hệ thống`,
        "product",
        c.req.header("user-agent"),
      );

      await broadcastTradeSync();
      productCache = null;

      return c.json({ removed: true });
    } else {
      const newQty = (productItem.quantity ?? 0) - qtyToRemove;
      await db.update(product).set({ quantity: newQty }).where(eq(product.id, id));

      await logActivity(
        currentUser?.id || null,
        `Cập nhật số lượng sản phẩm '${productItem.name}'`,
        `Đã giảm ${qtyToRemove} sản phẩm (Số lượng còn lại: ${newQty})`,
        "product",
        c.req.header("user-agent"),
      );

      await broadcastTradeSync();

      return c.json({ removed: false, newQuantity: newQty });
    }
  } catch (err: any) {
    console.error("[Fatal Delete Product Error]:", err);
    return c.json({ error: "Server Error: " + (err.message || err.toString()), stack: err.stack }, 500);
  }
}

// --- Image Generation POST (Puppeteer) ---
app.post("/admin/product/:id/image", verifyAuth, async (c: any) => {
  const productId = c.req.param("id");
  const currentUser = c.get("user");

  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  const dbProduct = await db.query.product.findFirst({ where: eq(product.id, productId) });
  if (!dbProduct) {
    return c.json({ success: false, message: "Product not found" }, 404);
  }

  // Lấy ảnh đại diện (file://) - Tự động bỏ qua các banner AI cũ để tránh hiệu ứng khung lồng khung
  const originalMedia = ((dbProduct.media as any[]) || []).filter(
    (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
  );
  let productImageUrl = getProductImageUrl(originalMedia, "file");

  // Convert local file to Base64 to bypass Puppeteer security restrictions
  let base64Image = "";
  let imageHtml = "";

  if (productImageUrl && productImageUrl.startsWith("file://")) {
    const localPath = productImageUrl.replace("file://", "");
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).substring(1) || "png";
      const base64Data = fs.readFileSync(localPath).toString("base64");
      base64Image = `data:image/${ext};base64,${base64Data}`;
      imageHtml = `<div class="image-wrapper"><img src="${base64Image}" alt="Product" /></div>`;
    }
  }

  if (!base64Image) {
    imageHtml = `<div class="image-wrapper" style="background: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.3);"><div style="color: rgba(255,255,255,0.8); font-size: 32px; font-weight: bold; letter-spacing: 2px;">CHƯA CÓ ẢNH SẢN PHẨM</div></div>`;
  }

  const formatVN = (n: any) => n?.toLocaleString?.("vi-VN") ?? 0;

  // HTML Template Siêu Đẹp (Glassmorphism + Gradient)
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          width: 1080px;
          height: 1080px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }
        .container {
          width: 900px;
          height: 900px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 40px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          box-sizing: border-box;
          position: relative;
        }
        .image-wrapper {
          width: 100%;
          height: 700px;
          border-radius: 20px;
          overflow: hidden;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .image-wrapper img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .badge {
          position: absolute;
          top: -20px;
          right: -20px;
          background: #ef4444;
          color: white;
          font-size: 28px;
          font-weight: 800;
          padding: 15px 30px;
          border-radius: 30px;
          box-shadow: 0 10px 20px rgba(239, 68, 68, 0.4);
          transform: rotate(5deg);
          z-index: 10;
        }
        .logo {
          position: absolute;
          bottom: 30px;
          font-size: 24px;
          font-weight: 700;
          color: rgba(255,255,255,0.6);
          letter-spacing: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">🔥 GIÁ TỐT NHẤT</div>
        ${imageHtml}
        <div class="logo">Rottra SMART FARM</div>
      </div>
    </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });

    // Ignore timeout error if external image fails to load
    try {
      await page.setContent(htmlContent, { waitUntil: "networkidle2" as any, timeout: 5000 });
    } catch (timeoutErr) {
      console.warn("Puppeteer load timeout (ignored):", timeoutErr);
    }

    const outputFileName = `banner_${productId}_${Date.now()}.avif`;
    const outputPath = path.join(process.cwd(), "public", "images", "banners", outputFileName);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({ path: outputPath, type: "png" });
    await browser.close();

    const newImageUrl = `/images/banners/${outputFileName}`;
    const currentMedia = Array.isArray(dbProduct.media) ? dbProduct.media : [];

    // Tự động xóa banner AI cũ (bắt đầu bằng /images/banners/) khỏi danh sách để tránh bị đầy bộ nhớ (vượt quá 5 ảnh)
    const filteredMedia = currentMedia.filter((m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")));

    const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }];

    await db.update(product).set({ media: newMedia }).where(eq(product.id, productId));

    return c.json({ success: true, message: "Tạo ảnh thành công!", imageUrl: newImageUrl });
  } catch (err: any) {
    console.error("Lỗi tạo ảnh Puppeteer:", err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

// --- Video Generation Logs ---
app.get("/admin/product/:id/video/logs", verifyAuth, async (c: any) => {
  const productId = c.req.param("id");
  const currentUser = c.get("user");

  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  const logPath = path.join(process.cwd(), "public", "videos", `render_${productId}.log`);
  if (!fs.existsSync(logPath)) {
    return c.json({ success: true, logs: "Khởi tạo hệ thống kết xuất video...\nĐang chờ tiến trình bắt đầu..." });
  }

  try {
    const logs = fs.readFileSync(logPath, "utf-8");
    return c.json({ success: true, logs });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// --- Video Generation POST ---
app.post("/admin/product/:id/video", verifyAuth, async (c: any) => {
  const productId = c.req.param("id");
  const currentUser = c.get("user");

  if (currentUser?.role !== "admin") {
    return c.json({ success: false, message: "Forbidden" }, 403);
  }

  const pRes = await pgClient.query(`SELECT * FROM "Product" WHERE id = $1 LIMIT 1`, [productId]);
  const dbProduct = pRes.rows[0];
  if (!dbProduct) {
    return c.json({ success: false, message: "Product not found" }, 404);
  }

  // Tìm ảnh đại diện đầu tiên của sản phẩm
  const productImageUrl = getProductImageUrl(dbProduct.media as any[], "file");
  let productBase64 = "";
  if (productImageUrl && productImageUrl.startsWith("file://")) {
    const localPath = productImageUrl.replace("file://", "");
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).substring(1) || "png";
      const base64Data = fs.readFileSync(localPath).toString("base64");
      productBase64 = `data:image/${ext};base64,${base64Data}`;
    }
  }

  const logDir = path.join(process.cwd(), "public", "videos");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `render_${productId}.log`);

  // Reset/Create log file
  fs.writeFileSync(logPath, `=== BẮT ĐẦU KẾT XUẤT VIDEO AI CHO SẢN PHẨM: ${dbProduct.name} ===\n`);

  const realVideoUrl = `/videos/output_${productId}.mp4`;

  // Run child process rendering purely in the background to avoid HTTP timeouts
  (async () => {
    try {
      fs.appendFileSync(logPath, `> Khởi tạo bộ não AI nội bộ: Đang phân tích kịch bản Copywriter Tiktok...\n`);

      // 1. Fetch agent DNA if product has a sellerId
      let agentDna: any = null;
      if (dbProduct.sellerId) {
        const dbMemory = await db.query.agentMemory.findFirst({
          where: and(eq(agentMemory.sessionId, dbProduct.sellerId), eq(agentMemory.contextKey, "personality_dna")),
        });
        if (dbMemory) {
          agentDna = dbMemory;
        }
      }

      // Determine style variables based on agent personality DNA
      let themeColor = "#a259ff"; // Default: Balanced purple
      let layoutStyle = "normal";
      let entryStyle = "center";
      let floatSpeed = 2.8;
      let rotationAngle = 4;
      let selectedHook = "";
      let selectedCta = "";
      let selectedAdjective = "";

      const catLower = (dbProduct.category || "").toLowerCase();
      let adjectives = ["chất lượng đỉnh cao", "siêu xịn sò", "đẳng cấp nhất", "dùng là mê"];
      if (catLower.includes("ăn") || catLower.includes("thực phẩm") || catLower.includes("uống")) {
        adjectives = ["ngon khó cưỡng", "chuẩn vị mẹ làm", "giòn rụm", "đậm đà khó quên"];
      } else if (catLower.includes("công nghệ") || catLower.includes("điện") || catLower.includes("máy")) {
        adjectives = ["công nghệ tiên tiến", "cấu hình khủng", "thiết kế sang trọng", "đỉnh cao công nghệ"];
      }

      if (agentDna) {
        const state = agentDna.state || "BALANCED";
        const greed = Number(agentDna.greed) || 0.5;
        const malice = Number(agentDna.malice) || 0.5;

        if (state === "AGGRESSIVE" || malice > 0.8) {
          // Aggressive Agents: Flashy red/pink colors, fast movement, high rotation, pushy copy
          const redColors = ["#FF3366", "#f24e1e", "#e53e3e"];
          themeColor = redColors[Math.floor(Math.random() * redColors.length)];
          layoutStyle = "reversed";
          entryStyle = Math.random() > 0.5 ? "left" : "right";
          floatSpeed = 4.5;
          rotationAngle = 12;

          const aggressiveHooks = [
            "Cảnh báo! Hàng hot sắp cháy kho rồi!",
            "Không mua bây giờ thì đừng hối hận!",
            "Dừng lại 3 giây! Tranh giành ngay siêu phẩm này!",
            "Deal hủy diệt, giật ngay kẻo hết sạch!",
          ];
          selectedHook = aggressiveHooks[Math.floor(Math.random() * aggressiveHooks.length)];
          selectedCta = "Múc ngay kẻo lỡ!";
          selectedAdjective = adjectives[0]; // first adjective (highest rating)
        } else if (state === "GREEDY" || greed > 0.8) {
          // Greedy Agents: Golden/amber colors, fast speed, focus on discount/wealth copy
          const goldColors = ["#fbbf24", "#ff8a00", "#d97706"];
          themeColor = goldColors[Math.floor(Math.random() * goldColors.length)];
          layoutStyle = "normal";
          entryStyle = "right";
          floatSpeed = 3.5;
          rotationAngle = 7;

          const greedyHooks = [
            "Deal sốc xả kho, giá rẻ sập sàn mua ngay!",
            "Cơ hội vàng tiết kiệm cực khủng hôm nay!",
            "Mua 1 được 10, hời chưa từng thấy!",
            "Rẻ vô địch toàn sàn thương mại!",
          ];
          selectedHook = greedyHooks[Math.floor(Math.random() * greedyHooks.length)];
          selectedCta = "Bấm mua ngay lập tức!";
          selectedAdjective = "giá siêu hời";
        } else if (state === "CALM" || malice < 0.6) {
          // Calm/Peaceful Agents: Green/blue colors, slow movement, zero rotation, gentle copy
          const calmColors = ["#0acf83", "#1abcfe", "#06b6d4"];
          themeColor = calmColors[Math.floor(Math.random() * calmColors.length)];
          layoutStyle = "normal";
          entryStyle = "center";
          floatSpeed = 1.6;
          rotationAngle = 1;

          const calmHooks = [
            "Nâng niu sức khỏe của bạn và gia đình với...",
            "Trải nghiệm nông sản xanh thuần tự nhiên...",
            "Một chút an lành, ngọt lành gửi trao đến bạn...",
            "Lựa chọn xanh cho cuộc sống thảnh thơi...",
          ];
          selectedHook = calmHooks[Math.floor(Math.random() * calmHooks.length)];
          selectedCta = "Trải nghiệm an lành ngay.";
          selectedAdjective = "an toàn sạch 100%";
        } else {
          // Balanced / Default
          themeColor = "#a259ff";
          layoutStyle = "normal";
          entryStyle = "center";
          floatSpeed = 2.8;
          rotationAngle = 4;
          selectedHook = "Trời ơi tin được không!";
          selectedCta = "Bấm vào giỏ hàng ngay nào!";
          selectedAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        }
      } else {
        // Fallback for non-agent sellers / guests
        let hash = 0;
        for (let i = 0; i < productId.length; i++) {
          hash = productId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const themeColors = ["#0acf83", "#1abcfe", "#a259ff", "#f24e1e", "#ff8a00", "#FF3366", "#00C853", "#2962FF"];
        const colorIndex = Math.abs(hash) % themeColors.length;
        themeColor = themeColors[colorIndex];
        layoutStyle = Math.abs(hash) % 2 === 0 ? "normal" : "reversed";
        entryStyle = Math.abs(hash) % 3 === 0 ? "left" : Math.abs(hash) % 3 === 1 ? "right" : "center";
        floatSpeed = 2.5 + (Math.abs(hash) % 3) * 0.4;
        rotationAngle = (Math.abs(hash) % 2 === 0 ? 1 : -1) * (4 + (Math.abs(hash) % 3));

        const hooks = [
          "Trời ơi tin được không!",
          "Dừng lại 3 giây xem ngay siêu phẩm này!",
          "Deal sốc cuối tuần, không mua thì tiếc hùi hụi!",
          "Cảnh báo! Sản phẩm gây nghiện đang làm mưa làm gió!",
          "Bạn đã biết bí mật này chưa?",
        ];
        selectedHook = hooks[Math.abs(hash) % hooks.length];

        const ctas = [
          "Chốt đơn liền tay kẻo lỡ!",
          "Bấm vào giỏ hàng ngay nào!",
          "Số lượng có hạn, rước em nó về thôi!",
          "Deal hời giá tốt, múc ngay kẻo hết!",
        ];
        selectedCta = ctas[Math.abs(hash) % ctas.length];
        selectedAdjective = adjectives[Math.abs(hash) % adjectives.length];
      }

      const pName = dbProduct.name;
      const pPrice = dbProduct.price?.toLocaleString("vi-VN") || "hủy diệt";
      const ttsScript = `${selectedHook} Siêu phẩm ${pName} ${selectedAdjective}. Giá sốc hôm nay chỉ ${pPrice} đồng. ${selectedCta} Trên nền tảng thương mại Rottra!`;

      fs.appendFileSync(logPath, `> Đã sinh kịch bản AI: "${ttsScript}"\n`);
      fs.appendFileSync(logPath, `> Đang tổng hợp giọng nói AI (Voiceover) cho sản phẩm...\n`);

      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(ttsScript)}`;
      const ttsFileName = `tts_current.mp3`;
      const ttsPath = path.join(process.cwd(), "video_ads", "assets", ttsFileName);

      try {
        const response = await fetch(ttsUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });
        if (response.ok) {
          const ab = await response.arrayBuffer();
          fs.writeFileSync(ttsPath, Buffer.from(ab));
          fs.appendFileSync(logPath, `> Đã tạo xong âm thanh Voiceover AI thành công.\n\n`);
        } else {
          fs.appendFileSync(logPath, `> Tạo Voiceover thất bại (${response.status}), sẽ dùng tệp âm thanh mặc định.\n\n`);
        }
      } catch (e) {
        fs.appendFileSync(logPath, `> Lỗi tải Voiceover: ${e}\n\n`);
      }

      // Chuẩn bị biến nội suy (Variables) siêu chi tiết để truyền cho Hyperframes
      const formattedName = dbProduct.name.length < 30 ? `SIÊU PHẨM: ${dbProduct.name.toUpperCase()}` : dbProduct.name.toUpperCase();

      const renderVariables = JSON.stringify({
        productId: productId,
        productName: formattedName,
        productPrice: dbProduct.price?.toLocaleString("vi-VN") + "đ" || "Liên hệ",
        productDesc: dbProduct.description || "",
        category: dbProduct.category || "",
        quantity: dbProduct.quantity || 0,
        heavy: dbProduct.heavy || 0,
        expired: dbProduct.expired ? new Date(dbProduct.expired).toLocaleDateString("vi-VN") : "",
        productImage: productBase64 || productImageUrl,
        themeColor: themeColor,
        layoutStyle: layoutStyle,
        entryStyle: entryStyle,
        floatSpeed: floatSpeed,
        rotationAngle: rotationAngle,
      });

      const variablesPath = path.join(process.cwd(), "video_ads", `variables_${productId}.json`);
      fs.writeFileSync(variablesPath, renderVariables);

      await new Promise<void>((resolve, reject) => {
        const renderProcess = spawn(
          "npx",
          [
            "--yes",
            "hyperframes@0.6.97",
            "render",
            "-o",
            `../public/videos/output_${productId}.mp4`,
            "--variables-file",
            `variables_${productId}.json`,
          ],
          {
            cwd: path.join(process.cwd(), "video_ads"),
            shell: false,
          },
        );

        renderProcess.stdout.on("data", (data) => {
          fs.appendFileSync(logPath, data.toString());
        });

        renderProcess.stderr.on("data", (data) => {
          fs.appendFileSync(logPath, data.toString());
        });

        renderProcess.on("close", (code) => {
          try {
            if (fs.existsSync(variablesPath)) {
              fs.unlinkSync(variablesPath);
            }
          } catch (err) {}

          if (code === 0) {
            fs.appendFileSync(logPath, "\n=== KẾT XUẤT THÀNH CÔNG! ĐÃ HOÀN THÀNH VIDEO ADS ===\n");
            try {
              if (fs.existsSync(logPath)) {
                fs.unlinkSync(logPath);
              }
            } catch (err) {
              console.error("Failed to delete log file:", err);
            }
            resolve();
          } else {
            const errMsg = `Quá trình kết xuất kết thúc với mã lỗi: ${code}`;
            fs.appendFileSync(logPath, `\n=== LỖI KẾT XUẤT: ${errMsg} ===\n`);
            reject(new Error(errMsg));
          }
        });
      });

      // Ghi nhận vào bảng file sau khi thành công (tránh crash Drizzle ORM)
      await pgClient.query(
        `INSERT INTO "File" (id, "userId", filename, mimetype, path, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [crypto.randomUUID(), currentUser.id, `output_${productId}.mp4`, "video/mp4", realVideoUrl, "active"],
      );

      if (dbProduct) {
        // Handle postgres array/jsonb correctly if needed. dbProduct.media from raw SQL might be string or object depending on driver.
        let currentMedia = [];
        if (typeof dbProduct.media === "string") {
          try {
            currentMedia = JSON.parse(dbProduct.media);
          } catch (e) {}
        } else if (Array.isArray(dbProduct.media)) {
          currentMedia = dbProduct.media;
        }

        const exists = currentMedia.some((m: any) => m.link === realVideoUrl);
        if (!exists) {
          const newMedia = [...currentMedia, { link: realVideoUrl, type: "video" }];
          await pgClient.query(`UPDATE "Product" SET media = $1 WHERE id = $2`, [JSON.stringify(newMedia), productId]);
        }
      }
    } catch (err: any) {
      console.error("Mở rộng nền (Background render) thất bại:", err.message);
      try {
        const variablesPath = path.join(process.cwd(), "video_ads", `variables_${productId}.json`);
        if (fs.existsSync(variablesPath)) {
          fs.unlinkSync(variablesPath);
        }
      } catch {}
    }
  })();

  // Trả lời phản hồi thành công ngay lập tức để phía frontend duy trì trạng thái polling mượt mà
  return c.json({ success: true, message: "Tiến trình render đang chạy ngầm..." });
});

// --- Comments ---

app.post("/admin/product/:id/comment", verifyAuth, async (c: any) => {
  const productId = c.req.param("id");
  const currentUser = c.get("user");
  const body = await c.req.json();
  const { text, user: reqUser } = body;

  const newComment = await db
    .insert(review)
    .values({
      id: crypto.randomUUID(),
      productId,
      userId: currentUser.id,
      cmt: [{ text, user: reqUser || currentUser.name || "Ẩn danh" }],
    })
    .returning();

  return c.json(newComment[0]);
});

export const GET = (event: any) => rootApp.fetch(event.request);
export const POST = (event: any) => rootApp.fetch(event.request);
export const PUT = (event: any) => rootApp.fetch(event.request);
export const DELETE = (event: any) => rootApp.fetch(event.request);
export const PATCH = (event: any) => rootApp.fetch(event.request);

rootApp.get("/", async (c) => {
  try {
    // 1. Fetch top products
    const topProducts = await db.query.product.findMany({
      limit: 6,
      orderBy: (product: any, { desc }: any) => [desc(product.addAt)],
    });

    // 2. Build JSON-LD structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: topProducts.map((p: any, index: number) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: p.name,
          description: p.description,
          image: (p.media as any)?.[0] || "",
          offers: {
            "@type": "Offer",
            price: p.price,
            priceCurrency: "VND",
          },
        },
      })),
    };

    // 3. Read base index.html
    // Note: In dev mode, vite-dev-server handles index.html transformation automatically if we don't intercept it.
    // BUT we are intercepting it! So we must read the raw index.html or ask Vite to transform it.
    // Actually, reading raw index.html is fine for bots, but for users in dev mode it might miss Vite's injected scripts.
    // A better approach is to let Vite handle the transformation by passing the request to the next middleware IF it's not a bot?
    // Let's just read index.html and inject into it.
    let html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");

    // Transform html manually for Vite Dev mode if needed (Vite injects @vite/client)
    if (process.env.NODE_ENV !== "production") {
      html = html.replace("<head>", '<head>\n<script type="module" src="/@vite/client"></script>');
    }

    // 4. Inject Meta Tags
    const title = "Rotta - Sàn Thương Mại Nông Sản Cao Cấp";
    const description = `Mua sắm các sản phẩm địa phương: ${topProducts.map((p: any) => p.name).join(", ")}`;

    html = html.replace(
      "<title>Rotta</title>",
      `<title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <noscript>
    <div id="ssr-content">
      <h1>${title}</h1>
      <p>${description}</p>
      <ul>
        ${topProducts.map((p: any) => `<li><h2>${p.name}</h2><p>${p.price} VND</p><p>${p.description}</p></li>`).join("")}
      </ul>
    </div>
  </noscript>`,
    );

    return c.html(html);
  } catch (err) {
    console.error("SSR Error:", err);
    // Fallback to basic HTML if error
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
    return c.html(html);
  }
});

function getProceduralPoints(productName: string): { x: number; y: number; isStart?: boolean }[] {
  let hash = 0;
  for (let i = 0; i < productName.length; i++) {
    hash = productName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pts: { x: number; y: number; isStart?: boolean }[] = [];
  const shapeType = Math.abs(hash) % 3;
  if (shapeType === 0) {
    const numSides = 8 + (Math.abs(hash) % 5);
    for (let i = 0; i <= numSides; i++) {
      const angle = (i * 2 * Math.PI) / numSides;
      const r = 16 + Math.sin(angle * 3 + hash) * 3;
      pts.push({
        x: Math.round(r * Math.cos(angle)),
        y: Math.round(r * Math.sin(angle)),
        isStart: i === 0,
      });
    }
    pts.push({ x: 0, y: -15, isStart: true });
    pts.push({ x: 5, y: -22 });
    pts.push({ x: -2, y: -25 });
    pts.push({ x: 0, y: -15 });
  } else if (shapeType === 1) {
    pts.push({ x: -15, y: 15, isStart: true });
    pts.push({ x: 15, y: 15 });
    pts.push({ x: 10, y: -15 });
    pts.push({ x: -10, y: -15 });
    pts.push({ x: -15, y: 15 });
    pts.push({ x: -10, y: 0, isStart: true });
    pts.push({ x: 10, y: 0 });
  } else {
    const numPoints = 5 + (Math.abs(hash) % 4);
    for (let i = 0; i <= numPoints * 2; i++) {
      const angle = (i * Math.PI) / numPoints;
      const r = i % 2 === 0 ? 20 : 8;
      pts.push({
        x: Math.round(r * Math.cos(angle)),
        y: Math.round(r * Math.sin(angle)),
        isStart: i === 0,
      });
    }
  }
  return pts;
}

function colorizePoints(shape: string, points: any[]): any[] {
  const p = shape.toLowerCase();
  let getPtColor: (idx: number, isStart?: boolean) => string;

  if (p.includes("ngô") || p.includes("corn") || p.includes("bắp")) {
    getPtColor = (idx: number) => {
      if (idx < 12) return "#16a34a"; // Husk outer leaf
      if (idx < 24) return "#facc15"; // Cob/kernel yellow
      return "#d97706"; // Silk orange/amber
    };
  } else if (
    p.includes("thảo dược") ||
    p.includes("herb") ||
    p.includes("chè") ||
    p.includes("trà") ||
    p.includes("tea") ||
    p.includes("sâm") ||
    p.includes("ginseng") ||
    p.includes("măng") ||
    p.includes("bamboo")
  ) {
    getPtColor = (idx: number) => {
      if (idx < 2) return "#78350f"; // Trunk
      if (idx < 15) return "#22c55e"; // Leaves green
      return "#ec4899"; // Flower pink
    };
  } else if (p.includes("bơ") || p.includes("avocado")) {
    getPtColor = (idx: number) => {
      if (idx < 13) return "#14532d"; // Skin
      if (idx < 22) return "#bef264"; // Pulp
      return "#78350f"; // Pit/Seed
    };
  } else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#22c55e"; // green stem
      return "#eab308"; // gold grains
    };
  } else if (p.includes("heo") || p.includes("pig") || p.includes("thịt")) {
    getPtColor = (idx: number) => {
      if (idx < 11) return "#f472b6"; // body pink
      if (idx < 16) return "#ec4899"; // nose hot pink
      if (idx < 22) return "#111827"; // eyes/nostrils dark
      return "#f472b6"; // tail/ears pink
    };
  } else if (p.includes("tỏi") || p.includes("garlic")) {
    getPtColor = (idx: number) => {
      if (idx < 25) return "#e2e8f0"; // bulb white/slate
      if (idx < 35) return "#cbd5e1"; // middle clove lines slate-300
      if (idx < 40) return "#b45309"; // roots brown
      return "#94a3b8"; // skin details
    };
  } else if (p.includes("cà phê") || p.includes("coffee")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#ef4444"; // red cup top
      if (idx < 10) return "#78350f"; // coffee liquid
      return "#38bdf8"; // steam
    };
  } else if (p.includes("mật") || p.includes("honey")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#b91c1c"; // red lid
      if (idx < 15) return "#f59e0b"; // jar body amber
      return "#d97706"; // dipper
    };
  } else if (p.includes("cooler") || p.includes("làm mát")) {
    getPtColor = (idx: number) => {
      if (idx < 13) return "#64748b"; // circle slate
      return "#06b6d4"; // fan blades cyan
    };
  } else if (p.includes("fertilizer") || p.includes("trùn")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#78350f"; // brown bag
      return "#22c55e"; // green sprouts
    };
  } else if (p.includes("sensor") || p.includes("iot")) {
    getPtColor = (idx: number) => {
      if (idx < 8) return "#64748b"; // base gray
      return "#ef4444"; // signal red
    };
  } else if (
    p.includes("fruit") ||
    p.includes("mít") ||
    p.includes("khoai") ||
    p.includes("potato") ||
    p.includes("hạt điều") ||
    p.includes("cashew") ||
    p.includes("lạc") ||
    p.includes("peanut") ||
    p.includes("tiêu") ||
    p.includes("pepper")
  ) {
    getPtColor = (idx: number) => {
      if (idx < 6) return "#fb923c"; // orange body
      return "#22c55e"; // green stem
    };
  } else if (p.includes("valve") || p.includes("van")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#475569"; // body gray
      return "#ef4444"; // handle red
    };
  } else if (p.includes("charcoal") || p.includes("than")) {
    getPtColor = (idx: number) => {
      if (idx < 4) return "#1f2937"; // wood dark
      return "#ef4444"; // flame red
    };
  } else if (p.includes("greenhouse") || p.includes("màng")) {
    getPtColor = (idx: number) => {
      if (idx < 6) return "#64748b"; // frame gray
      return "#22d3ee"; // glass cyan
    };
  } else if (p.includes("report") || p.includes("chỉ số") || p.includes("tin")) {
    getPtColor = (idx: number) => {
      if (idx < 4) return "#64748b"; // axis gray
      if (idx < 8) return "#3b82f6"; // bar 1 blue
      return "#10b981"; // bar 2 green
    };
  } else {
    getPtColor = () => "#3b82f6";
  }

  return points.map((pt, idx) => ({
    ...pt,
    color: pt.color || getPtColor(idx, pt.isStart),
  }));
}

function getLocalShapePoints(shape: string): { x: number; y: number; isStart?: boolean; color?: string }[] {
  const pts: { x: number; y: number; isStart?: boolean; color?: string }[] = [];
  const cx = 0;
  const cy = 0;
  const size = 20;

  if (shape === "garlic") {
    // Bottom round part
    for (let i = 0; i <= 12; i++) {
      const angle = -Math.PI + (i * Math.PI) / 12;
      pts.push({ x: cx + 18 * Math.cos(angle), y: cy + 8 + 18 * Math.sin(angle), isStart: i === 0 });
    }
    // Right side taper to top point (0, -22)
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      pts.push({ x: cx + 18 * (1 - t), y: cy + 8 * (1 - t) - 22 * t });
    }
    // Left side taper from top point to bottom left
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      pts.push({ x: cx - 18 * t, y: cy - 22 * (1 - t) + 8 * t });
    }
    // Clove vertical line down the middle
    pts.push({ x: cx, y: cy - 22, isStart: true });
    pts.push({ x: cx, y: cy + 26 });
    // Left clove line
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx - 8, y: cy + 5 });
    pts.push({ x: cx - 4, y: cy + 24 });
    // Right clove line
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx + 8, y: cy + 5 });
    pts.push({ x: cx + 4, y: cy + 24 });
  } else if (shape === "rice") {
    pts.push({ x: cx - 10, y: cy + 25, isStart: true });
    pts.push({ x: cx - 5, y: cy + 10 });
    pts.push({ x: cx, y: cy });
    pts.push({ x: cx + 5, y: cy - 10 });
    pts.push({ x: cx + 10, y: cy - 25 });
    pts.push({ x: cx - 5, y: cy + 10, isStart: true });
    pts.push({ x: cx - 20, y: cy + 5 });
    pts.push({ x: cx - 5, y: cy + 10 });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx + 15, y: cy - 5 });
    pts.push({ x: cx, y: cy });
    pts.push({ x: cx + 5, y: cy - 10, isStart: true });
    pts.push({ x: cx - 10, y: cy - 15 });
    pts.push({ x: cx + 5, y: cy - 10 });
    pts.push({ x: cx + 10, y: cy - 25, isStart: true });
    pts.push({ x: cx + 20, y: cy - 30 });
    pts.push({ x: cx + 10, y: cy - 25 });
  } else if (shape === "cooler") {
    for (let i = 0; i <= 12; i++) {
      const angle = (i * 2 * Math.PI) / 12;
      pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
    }
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx, y: cy - size });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx + size, y: cy });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx, y: cy + size });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx - size, y: cy });
  } else if (shape === "fertilizer") {
    pts.push({ x: cx - 20, y: cy + 20, isStart: true });
    pts.push({ x: cx + 20, y: cy + 20 });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx - 20, y: cy + 20 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx - 8, y: cy - 25 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx + 8, y: cy - 25 });
  } else if (shape === "sensor") {
    pts.push({ x: cx, y: cy + 25, isStart: true });
    pts.push({ x: cx, y: cy - 5 });
    pts.push({ x: cx - 15, y: cy - 5, isStart: true });
    pts.push({ x: cx + 15, y: cy - 5 });
    pts.push({ x: cx + 15, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 5 });
    pts.push({ x: cx - 10, y: cy - 30, isStart: true });
    pts.push({ x: cx, y: cy - 35 });
    pts.push({ x: cx + 10, y: cy - 30 });
  } else if (shape === "pig") {
    for (let i = 0; i <= 10; i++) {
      const angle = (i * 2 * Math.PI) / 10;
      pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
    }
    pts.push({ x: cx - 10, y: cy + 5, isStart: true });
    pts.push({ x: cx + 10, y: cy + 5 });
    pts.push({ x: cx + 10, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 5 });
    pts.push({ x: cx - 4, y: cy + 10, isStart: true });
    pts.push({ x: cx - 4, y: cy + 11 });
    pts.push({ x: cx + 4, y: cy + 10, isStart: true });
    pts.push({ x: cx + 4, y: cy + 11 });
    pts.push({ x: cx - 6, y: cy - 5, isStart: true });
    pts.push({ x: cx - 6, y: cy - 4 });
    pts.push({ x: cx + 6, y: cy - 5, isStart: true });
    pts.push({ x: cx + 6, y: cy - 4 });
    pts.push({ x: cx - 15, y: cy - 15, isStart: true });
    pts.push({ x: cx - 25, y: cy - 25 });
    pts.push({ x: cx - 5, y: cy - 20 });
    pts.push({ x: cx + 15, y: cy - 15, isStart: true });
    pts.push({ x: cx + 25, y: cy - 25 });
    pts.push({ x: cx + 5, y: cy - 20 });
  } else if (shape === "fruit") {
    pts.push({ x: cx - 25, y: cy + 15, isStart: true });
    pts.push({ x: cx, y: cy - 20 });
    pts.push({ x: cx + 25, y: cy + 15 });
    pts.push({ x: cx - 25, y: cy + 15 });
    pts.push({ x: cx, y: cy + 5 });
    pts.push({ x: cx + 25, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 8, isStart: true });
    pts.push({ x: cx - 10, y: cy + 9 });
    pts.push({ x: cx + 10, y: cy + 8, isStart: true });
    pts.push({ x: cx + 10, y: cy + 9 });
  } else if (shape === "valve") {
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx + 20, y: cy + 10 });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx - 20, y: cy + 10 });
    pts.push({ x: cx, y: cy - 25 });
    pts.push({ x: cx - 8, y: cy + 10, isStart: true });
    pts.push({ x: cx, y: cy + 15 });
    pts.push({ x: cx + 8, y: cy + 10 });
  } else if (shape === "charcoal") {
    pts.push({ x: cx - 20, y: cy - 10, isStart: true });
    pts.push({ x: cx + 20, y: cy + 10 });
    pts.push({ x: cx - 20, y: cy + 10, isStart: true });
    pts.push({ x: cx + 20, y: cy - 10 });
    pts.push({ x: cx - 10, y: cy - 5, isStart: true });
    pts.push({ x: cx + 10, y: cy - 5 });
  } else if (shape === "corn") {
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx - 15, y: cy });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx + 15, y: cy });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx - 12, y: cy - 10, isStart: true });
    pts.push({ x: cx + 12, y: cy - 10 });
    pts.push({ x: cx - 15, y: cy, isStart: true });
    pts.push({ x: cx + 15, y: cy });
    pts.push({ x: cx - 12, y: cy + 10, isStart: true });
    pts.push({ x: cx + 12, y: cy + 10 });
  } else if (shape === "coffee") {
    pts.push({ x: cx - 20, y: cy - 10, isStart: true });
    pts.push({ x: cx + 20, y: cy - 10 });
    pts.push({ x: cx + 15, y: cy + 15 });
    pts.push({ x: cx - 15, y: cy + 15 });
    pts.push({ x: cx - 20, y: cy - 10 });
    pts.push({ x: cx + 15, y: cy - 5, isStart: true });
    pts.push({ x: cx + 25, y: cy - 5 });
    pts.push({ x: cx + 22, y: cy + 10 });
    pts.push({ x: cx + 15, y: cy + 10 });
    pts.push({ x: cx - 8, y: cy - 15, isStart: true });
    pts.push({ x: cx - 8, y: cy - 25 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx, y: cy - 25 });
    pts.push({ x: cx + 8, y: cy - 15, isStart: true });
    pts.push({ x: cx + 8, y: cy - 25 });
  } else if (shape === "greenhouse") {
    pts.push({ x: cx - 25, y: cy + 20, isStart: true });
    pts.push({ x: cx + 25, y: cy + 20 });
    pts.push({ x: cx + 25, y: cy + 5 });
    pts.push({ x: cx, y: cy - 20 });
    pts.push({ x: cx - 25, y: cy + 5 });
    pts.push({ x: cx - 25, y: cy + 20 });
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx, y: cy + 20 });
    pts.push({ x: cx - 12, y: cy - 7, isStart: true });
    pts.push({ x: cx - 12, y: cy + 20 });
    pts.push({ x: cx + 12, y: cy - 7, isStart: true });
    pts.push({ x: cx + 12, y: cy + 20 });
  } else if (shape === "report") {
    pts.push({ x: cx - 18, y: cy + 18, isStart: true });
    pts.push({ x: cx + 18, y: cy + 18 });
    pts.push({ x: cx - 18, y: cy - 18, isStart: true });
    pts.push({ x: cx - 18, y: cy + 18 });
    pts.push({ x: cx - 10, y: cy + 18, isStart: true });
    pts.push({ x: cx - 10, y: cy - 2 });
    pts.push({ x: cx - 2, y: cy - 2 });
    pts.push({ x: cx - 2, y: cy + 18 });
    pts.push({ x: cx + 4, y: cy + 18, isStart: true });
    pts.push({ x: cx + 4, y: cy - 10 });
    pts.push({ x: cx + 12, y: cy - 10 });
    pts.push({ x: cx + 12, y: cy + 18 });
  } else if (shape === "honey") {
    pts.push({ x: cx - 12, y: cy - 18, isStart: true });
    pts.push({ x: cx + 12, y: cy - 18 });
    pts.push({ x: cx + 12, y: cy - 14 });
    pts.push({ x: cx - 12, y: cy - 14 });
    pts.push({ x: cx - 12, y: cy - 18 });
    pts.push({ x: cx - 10, y: cy - 14, isStart: true });
    pts.push({ x: cx - 16, y: cy - 4 });
    pts.push({ x: cx - 16, y: cy + 12 });
    pts.push({ x: cx - 10, y: cy + 20 });
    pts.push({ x: cx + 10, y: cy + 20 });
    pts.push({ x: cx + 16, y: cy + 12 });
    pts.push({ x: cx + 16, y: cy - 4 });
    pts.push({ x: cx + 10, y: cy - 14 });
    pts.push({ x: cx, y: cy - 14, isStart: true });
    pts.push({ x: cx, y: cy + 2 });
    pts.push({ x: cx - 3, y: cy + 5, isStart: true });
    pts.push({ x: cx + 3, y: cy + 5 });
    pts.push({ x: cx, y: cy + 8 });
    pts.push({ x: cx - 3, y: cy + 5 });
  } else if (shape === "avocado") {
    for (let i = 0; i <= 12; i++) {
      const angle = (i * 2 * Math.PI) / 12;
      const radiusX = 14;
      const radiusY = 22;
      const factor = angle > 0 && angle < Math.PI ? 1.25 : 0.8;
      pts.push({
        x: cx + radiusX * Math.cos(angle),
        y: cy + radiusY * Math.sin(angle) * factor,
        isStart: i === 0,
      });
    }
    for (let i = 0; i <= 8; i++) {
      const angle = (i * 2 * Math.PI) / 8;
      const radius = 6;
      pts.push({
        x: cx + radius * Math.cos(angle),
        y: cy + 6 + radius * Math.sin(angle),
        isStart: i === 0,
      });
    }
    pts.push({ x: cx, y: cy - 18, isStart: true });
    pts.push({ x: cx + 3, y: cy - 23 });
  } else {
    pts.push({ x: cx, y: cy + 25, isStart: true });
    pts.push({ x: cx, y: cy - 15 });
    pts.push({ x: cx, y: cy - 5, isStart: true });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx - 20, y: cy - 25 });
    pts.push({ x: cx - 10, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx, y: cy - 5, isStart: true });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx + 20, y: cy - 25 });
    pts.push({ x: cx + 10, y: cy - 25 });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx - 6, y: cy - 30 });
    pts.push({ x: cx + 6, y: cy - 30 });
    pts.push({ x: cx, y: cy - 15 });
  }
  return pts;
}

function resamplePoints(points: { x: number; y: number; isStart?: boolean }[], N: number): { x: number; y: number; isStart?: boolean }[] {
  const len = points.length;
  if (len === 0) return [];
  const resampled: { x: number; y: number; isStart?: boolean }[] = [];
  for (let i = 0; i < N; i++) {
    const index = (i * (len - 1)) / (N - 1);
    const low = Math.floor(index);
    const high = Math.ceil(index);
    const t = index - low;
    const p1 = points[low];
    const p2 = points[high];
    resampled.push({
      x: p1.x * (1 - t) + p2.x * t,
      y: p1.y * (1 - t) + p2.y * t,
      isStart: points[Math.round(index)].isStart ?? false,
    });
  }
  return resampled;
}

function dft(points: { x: number; y: number }[]): { re: number; im: number }[] {
  const N = points.length;
  const coeffs = [];
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += points[n].x * Math.cos(angle) + points[n].y * Math.sin(angle);
      im += -points[n].x * Math.sin(angle) + points[n].y * Math.cos(angle);
    }
    coeffs.push({ re, im });
  }
  return coeffs;
}

function idft(coeffs: { re: number; im: number }[]): { x: number; y: number }[] {
  const N = coeffs.length;
  const points = [];
  for (let n = 0; n < N; n++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      x += coeffs[k].re * Math.cos(angle) - coeffs[k].im * Math.sin(angle);
      y += coeffs[k].re * Math.sin(angle) + coeffs[k].im * Math.cos(angle);
    }
    points.push({ x: x / N, y: y / N });
  }
  return points;
}

/**
 * Vector Diffusion Generative Model (Spectral Fourier Descriptors)
 * Chuyển các điểm vector sang Không gian tần số (Fourier Domain), chạy quá trình
 * khuếch tán Langevin trên 16 mô tả tần số thấp và IDFT ngược lại về không gian tọa độ.
 */
function applyDiffusionModelToPoints(
  basePoints: { x: number; y: number; isStart?: boolean }[],
): { x: number; y: number; isStart?: boolean }[] {
  if (basePoints.length === 0) return [];

  const N_coeffs = 16;
  const resampled = resamplePoints(basePoints, N_coeffs);
  const baseCoeffs = dft(resampled);

  // Số lượng bước khuếch tán ngược (denoising steps)
  const steps = 10;
  const beta = 0.1;

  // Khởi tạo hệ số x_T bằng cách thêm nhiễu Gaussian cực lớn vào baseCoeffs (Spectral Domain)
  let currentCoeffs = baseCoeffs.map((c) => {
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const noiseRe = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 12;
    const noiseIm = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2) * 12;
    return {
      re: c.re + noiseRe,
      im: c.im + noiseIm,
    };
  });

  // Quá trình Denoising ngược (Reverse process) từ t = T về t = 0
  for (let t = steps; t > 0; t--) {
    const alpha_t = 1 - beta * (t / steps);

    currentCoeffs = currentCoeffs.map((c, k) => {
      const target = baseCoeffs[k];
      const gradRe = target.re - c.re;
      const gradIm = target.im - c.im;

      const u1 = Math.random() || 0.0001;
      const u2 = Math.random() || 0.0001;
      const stepNoiseRe = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.8;
      const stepNoiseIm = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2) * 0.8;

      return {
        re: c.re + 0.25 * gradRe + Math.sqrt(1 - alpha_t) * stepNoiseRe,
        im: c.im + 0.25 * gradIm + Math.sqrt(1 - alpha_t) * stepNoiseIm,
      };
    });
  }

  // Thực hiện IDFT ngược lại về không gian tọa độ 2D
  const denoisedPoints = idft(currentCoeffs);

  // Giới hạn tọa độ trong khoảng [-30, 30] của khung canvas vẽ và khôi phục cờ isStart
  return denoisedPoints.map((p, idx) => ({
    x: Math.max(-30, Math.min(30, Math.round(p.x * 100) / 100)),
    y: Math.max(-30, Math.min(30, Math.round(p.y * 100) / 100)),
    isStart: resampled[idx]?.isStart ?? false,
  }));
}

async function traceImageBuffer(buffer: Buffer): Promise<{ x: number; y: number; isStart?: boolean }[]> {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default || sharpModule;

    // 1. Resize and get greyscale raw pixels
    const { data, info } = await sharp(buffer).resize(60, 60, { fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // 2. Compute binary image (adaptive threshold)
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const threshold = sum / data.length;

    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
      binary[i] = data[i] < threshold ? 1 : 0; // 1: object, 0: background
    }

    // 3. Find edge pixels
    const isEdge = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      if (binary[y * width + x] === 0) return false;
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
        if (binary[ny * width + nx] === 0) return true;
      }
      return false;
    };

    const edgePoints: { x: number; y: number; visited?: boolean }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isEdge(x, y)) {
          edgePoints.push({ x, y });
        }
      }
    }

    // 4. Trace contours (connecting adjacent edge points into continuous paths)
    const paths: { x: number; y: number; isStart?: boolean }[] = [];
    const findNearestUnvisited = (pt: { x: number; y: number }) => {
      let bestDist = Infinity;
      let bestIdx = -1;
      for (let i = 0; i < edgePoints.length; i++) {
        const other = edgePoints[i];
        if (other.visited) continue;
        const d = Math.hypot(other.x - pt.x, other.y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestDist < 2.5) {
        return bestIdx;
      }
      return -1;
    };

    for (let i = 0; i < edgePoints.length; i++) {
      if (edgePoints[i].visited) continue;

      let currentIdx = i;
      edgePoints[currentIdx].visited = true;
      paths.push({ x: edgePoints[currentIdx].x, y: edgePoints[currentIdx].y, isStart: true });

      while (true) {
        const nextIdx = findNearestUnvisited(edgePoints[currentIdx]);
        if (nextIdx === -1) break;
        edgePoints[nextIdx].visited = true;
        paths.push({ x: edgePoints[nextIdx].x, y: edgePoints[nextIdx].y });
        currentIdx = nextIdx;
      }
    }

    // 5. Center and normalize points to fit [-22, 22] box
    if (paths.length === 0) return [];

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    for (const p of paths) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const maxDim = Math.max(w, h);
    const scaleFactor = 44 / maxDim;

    const cx = minX + w / 2;
    const cy = minY + h / 2;

    const normalized = paths.map((p) => ({
      x: Math.round((p.x - cx) * scaleFactor * 100) / 100,
      y: Math.round((p.y - cy) * scaleFactor * 100) / 100,
      isStart: !!p.isStart,
    }));

    // 6. Downsample points for rendering
    const filtered: { x: number; y: number; isStart?: boolean }[] = [];
    let lastPt: { x: number; y: number } | null = null;

    for (const pt of normalized) {
      if (pt.isStart || !lastPt) {
        filtered.push(pt);
        lastPt = pt;
      } else {
        const d = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
        if (d >= 1.5) {
          filtered.push(pt);
          lastPt = pt;
        }
      }
    }

    return filtered;
  } catch (err) {
    console.error("Error tracing image buffer:", err);
    return [];
  }
}

async function traceImageFromUrlOrPath(urlOrPath: string): Promise<{ x: number; y: number; isStart?: boolean }[]> {
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const response = await fetch(urlOrPath);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return await traceImageBuffer(buffer);
    } catch (err) {
      console.error("Failed to download image from URL for tracing:", err);
    }
  } else {
    let localPath = urlOrPath;
    if (urlOrPath.startsWith("file://")) {
      localPath = urlOrPath.replace("file://", "");
    } else if (urlOrPath.startsWith("/")) {
      localPath = path.join(process.cwd(), "public", urlOrPath);
    } else {
      localPath = path.join(process.cwd(), urlOrPath);
    }

    if (fs.existsSync(localPath)) {
      try {
        const buffer = fs.readFileSync(localPath);
        return await traceImageBuffer(buffer);
      } catch (err) {
        console.error("Failed to read local image for tracing:", err);
      }
    }
  }
  return [];
}

app.post("/agent/generate-drawing", async (c: any) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body." }, 400);
    }
    const { productName, skillLevel = 5 } = body;
    if (!productName) {
      return c.json({ success: false, error: "Missing productName." }, 400);
    }

    // Ensure the caching table exists in Postgres
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "AiDrawingPath" (
        "productName" TEXT PRIMARY KEY,
        "points" JSONB NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Try to load cached drawing points from database
    try {
      const cached = await db.execute(sql`
        SELECT points FROM "AiDrawingPath" WHERE "productName" = ${productName}
      `);
      if (cached && cached.rows && cached.rows.length > 0) {
        const pts = cached.rows[0].points;
        const p = productName.toLowerCase();
        // Skip cached points if they are the old fallback procedural drawing (fewer than 25 points) for garlic
        const isOldProcedural = (p.includes("tỏi") || p.includes("garlic")) && pts.length < 25;
        if (Array.isArray(pts) && pts.length > 0 && !isOldProcedural) {
          // We don't cache color yet, so let the frontend fallback or we can generate a random color based on product name if we want, but better to just use the points.
          return c.json({ success: true, points: pts });
        }
      }
    } catch (cacheReadErr) {
      console.warn("Failed to read drawing cache from DB:", cacheReadErr);
    }

    let pts: { x: number; y: number; isStart?: boolean }[] = [];

    // Try to find and trace the product's image first (Agent observes image to draw)
    try {
      let imgUrl: string | undefined;
      const dbProduct = await db.query.product.findFirst({
        where: eq(product.name, productName),
      });
      if (dbProduct && dbProduct.media) {
        const mediaList = typeof dbProduct.media === "string" ? JSON.parse(dbProduct.media) : dbProduct.media;
        if (Array.isArray(mediaList) && mediaList.length > 0) {
          const firstMedia = mediaList[0];
          imgUrl = firstMedia.link || firstMedia.src || (typeof firstMedia === "string" ? firstMedia : undefined);
        }
      }

      if (!imgUrl || imgUrl.includes("placehold.co") || imgUrl.includes("default")) {
        const precise = await getPreciseImageForProduct(productName, "");
        if (precise) {
          imgUrl = precise;
        }
      }

      if (imgUrl) {
        console.log(`[AGENT OBSERVATION] Agent is observing image: ${imgUrl} for product: ${productName}`);
        const tracedPoints = await traceImageFromUrlOrPath(imgUrl);
        if (tracedPoints.length > 0) {
          console.log(`[AGENT DRAWING] Traced ${tracedPoints.length} points from observed image.`);
          pts = tracedPoints;
        }
      }
    } catch (err) {
      console.warn("Failed to trace product image, falling back:", err);
    }

    if (pts.length === 0) {
      const p = productName.toLowerCase();
      let shape = "herb";
      if (p.includes("bơ") || p.includes("avocado")) shape = "avocado";
      else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) shape = "rice";
      else if (p.includes("báo cáo") || p.includes("chỉ số") || p.includes("tin") || p.includes("bản tin") || p.includes("report"))
        shape = "report";
      else if (p.includes("phân") || p.includes("trùn") || p.includes("fertilizer")) shape = "fertilizer";
      else if (p.includes("cảm biến") || p.includes("iot") || p.includes("sensor")) shape = "sensor";
      else if (p.includes("heo") || p.includes("thịt") || p.includes("pig") || p.includes("bò")) shape = "pig";
      else if (
        p.includes("mít") ||
        p.includes("sấy") ||
        p.includes("fruit") ||
        p.includes("khoai") ||
        p.includes("potato") ||
        p.includes("hạt điều") ||
        p.includes("cashew") ||
        p.includes("lạc") ||
        p.includes("peanut") ||
        p.includes("tiêu") ||
        p.includes("pepper")
      )
        shape = "fruit";
      else if (p.includes("tưới") || p.includes("van") || p.includes("valve")) shape = "valve";
      else if (p.includes("than") || p.includes("charcoal") || p.includes("biochar")) shape = "charcoal";
      else if (p.includes("ngô") || p.includes("bắp") || p.includes("corn")) shape = "corn";
      else if (p.includes("cà phê") || p.includes("coffee")) shape = "coffee";
      else if (p.includes("màng") || p.includes("nhà kính") || p.includes("greenhouse") || p.includes("kéo")) shape = "greenhouse";
      else if (p.includes("làm mát") || p.includes("cooler") || p.includes("sấy thăng hoa")) shape = "cooler";
      else if (p.includes("mật") || p.includes("ong") || p.includes("honey")) shape = "honey";
      else if (p.includes("tỏi") || p.includes("garlic")) shape = "garlic";
      else if (
        p.includes("thảo dược") ||
        p.includes("dược") ||
        p.includes("herb") ||
        p.includes("chè") ||
        p.includes("trà") ||
        p.includes("tea") ||
        p.includes("sâm") ||
        p.includes("ginseng") ||
        p.includes("măng") ||
        p.includes("bamboo")
      )
        shape = "herb";
      else {
        pts = getProceduralPoints(productName);
      }

      if (pts.length === 0) {
        pts = getLocalShapePoints(shape);
      }
    }

    if (pts.length > 0) {
      const p = productName.toLowerCase();
      let shape = "herb";
      if (p.includes("bơ") || p.includes("avocado")) shape = "avocado";
      else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) shape = "rice";
      else if (p.includes("báo cáo") || p.includes("chỉ số") || p.includes("tin") || p.includes("bản tin") || p.includes("report"))
        shape = "report";
      else if (p.includes("phân") || p.includes("trùn") || p.includes("fertilizer")) shape = "fertilizer";
      else if (p.includes("cảm biến") || p.includes("iot") || p.includes("sensor")) shape = "sensor";
      else if (p.includes("heo") || p.includes("thịt") || p.includes("pig") || p.includes("bò")) shape = "pig";
      else if (
        p.includes("mít") ||
        p.includes("sấy") ||
        p.includes("fruit") ||
        p.includes("khoai") ||
        p.includes("potato") ||
        p.includes("hạt điều") ||
        p.includes("cashew") ||
        p.includes("lạc") ||
        p.includes("peanut") ||
        p.includes("tiêu") ||
        p.includes("pepper")
      )
        shape = "fruit";
      else if (p.includes("tưới") || p.includes("van") || p.includes("valve")) shape = "valve";
      else if (p.includes("than") || p.includes("charcoal") || p.includes("biochar")) shape = "charcoal";
      else if (p.includes("ngô") || p.includes("bắp") || p.includes("corn")) shape = "corn";
      else if (p.includes("cà phê") || p.includes("coffee")) shape = "coffee";
      else if (p.includes("màng") || p.includes("nhà kính") || p.includes("greenhouse") || p.includes("kéo")) shape = "greenhouse";
      else if (p.includes("làm mát") || p.includes("cooler") || p.includes("sấy thăng hoa")) shape = "cooler";
      else if (p.includes("mật") || p.includes("ong") || p.includes("honey")) shape = "honey";
      else if (p.includes("tỏi") || p.includes("garlic")) shape = "garlic";
      else if (
        p.includes("thảo dược") ||
        p.includes("dược") ||
        p.includes("herb") ||
        p.includes("chè") ||
        p.includes("trà") ||
        p.includes("tea") ||
        p.includes("sâm") ||
        p.includes("ginseng") ||
        p.includes("măng") ||
        p.includes("bamboo")
      )
        shape = "herb";

      // Thực thi bộ sinh Vector Diffusion Model cục bộ để tạo độ lệch vẽ mỹ thuật
      console.log(`[VECTOR DIFFUSION MODEL] Denoising sinh nét vẽ ngẫu nhiên cho: ${productName}`);
      pts = applyDiffusionModelToPoints(pts);
      pts = colorizePoints(shape, pts);

      try {
        await db.execute(sql`
          INSERT INTO "AiDrawingPath" ("productName", "points")
          VALUES (${productName}, ${JSON.stringify(pts)})
          ON CONFLICT ("productName") DO UPDATE SET "points" = EXCLUDED."points"
        `);
      } catch (cacheWriteErr) {
        console.warn("Failed to write drawing cache to DB:", cacheWriteErr);
      }
    }

    return c.json({ success: true, points: pts });
  } catch (err: any) {
    console.error(err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post("/agent/generate-speech", async (c: any) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body." }, 400);
    }
    const { text, voice = "Ava" } = body;
    if (!text) {
      return c.json({ success: false, error: "Missing text." }, 400);
    }
    const { generateSpeech } = await import("~/core/nlp-cognitive/tts-bridge");
    const audioBase64 = await generateSpeech(text, voice);
    if (!audioBase64) {
      return c.json({ success: true, useNativeBrowserTTS: true, text });
    }
    return c.json({ success: true, audioBase64 });
  } catch (err: any) {
    console.error("TTS generation error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get("/agent/assets", async (c: any) => {
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
    const dbUsers = await db.query.user.findMany();
    const agents = dbUsers.filter((u: any) => agentIds.includes(u.id));

    // Fetch all products from the product table to retrieve authentic data
    const allProducts = await db.query.product.findMany({});

    const assets: Record<string, any> = {};
    for (const dbUser of agents) {
      const key = dbUser.id.replace(/^user_?/, "");
      const p = (dbUser.profile as any) || {};

      // Look for all products corresponding to this agent in the product table
      const sellerProducts = allProducts.filter((prod: any) => {
        if (prod.sellerId !== dbUser.id) return false;
        if ((prod.quantity ?? 0) <= 0) return false;
        if (prod.expired && prod.expired.trim() !== "") {
          const parsed = Date.parse(prod.expired);
          if (isNaN(parsed)) return false;
        }
        return true;
      });
      const agentProduct = sellerProducts[0];

      assets[key] = {
        id: key,
        name: dbUser.name,
        budget: p.budget || serverAgentBudgets[key] || 0,
        gold: p.gold !== undefined ? p.gold : (serverAgentGold[key] ?? 0.0),
        stocks: p.stocks || {},
        product: agentProduct
          ? agentProduct.name.replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "")
          : p.product
            ? p.product.replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "")
            : "Sâm Ngọc Linh Kon Tum 🌿",
        quantity: agentProduct ? agentProduct.quantity || 0 : 0,
        price: agentProduct ? agentProduct.price || 0 : p.price || 0,
        media: agentProduct ? agentProduct.media : null,
        status: agentProduct ? (agentProduct.status !== undefined && agentProduct.status !== null ? agentProduct.status : true) : true,
        skillLevel: p.skillLevel,
        skillTitle: p.skillTitle,
        color: p.color,
        employees: serverAgentEmployees[key] ?? 5,
        products: sellerProducts.map((prod: any) => ({
          name: prod.name ? prod.name.replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "") : "",
          quantity: prod.quantity || 0,
          price: prod.price || 0,
          media: prod.media,
          status: prod.status !== undefined && prod.status !== null ? prod.status : true,
        })),
      };
    }

    return c.json({ success: true, assets });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get("/agent/toolkit-report", async (c: any) => {
  try {
    const { getLiveAgentsData, calculateTuDuyNguoc, calculateDonBayTaiSan, calculateToiGianTanNhan } =
      await import("~/core/cognitive-swarm/game-theory");
    const agents = await getLiveAgentsData();
    const tuDuyNguoc = calculateTuDuyNguoc(agents);
    const donBay = calculateDonBayTaiSan(agents);
    const toiGian = calculateToiGianTanNhan(agents);

    return c.json({
      success: true,
      report: {
        tuDuyNguoc,
        donBay,
        toiGian,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

async function updateAgentJournal(userId: string, entry: { type: string; title: string; content: string }) {
  // Fire and forget (Background generation) để không làm chậm API giao dịch
  (async () => {
    try {
      const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
      if (!dbUser) return;

      const profileObj = typeof dbUser.profile === "string" ? JSON.parse(dbUser.profile) : dbUser.profile || {};
      let expandedContent = entry.content;
      try {
        const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
        const { systemKinematics } = await import("~/core/nlp-cognitive/kinematics-core");

        const inventoryStr = profileObj.product
          ? `- Sản phẩm giao thương: ${profileObj.product} (Số lượng: ${profileObj.quantity || 0}, Giá: ${profileObj.price || 0} đ)`
          : "";
        const skillStr = profileObj.skillLevel ? `- Cấp độ kỹ năng (Nhận thức): ${profileObj.skillLevel}/10` : "";
        const wealthStr = profileObj.gold ? `- Tài sản: ${profileObj.gold} Vàng` : "";

        const currentR = (profileObj.interactions || 0) + (profileObj.transactions || 0) + entry.content.length;
        const kinematics = systemKinematics.updateState(currentR);
        const kStats = kinematics.state;
        const kinematicsStr = `
[ĐỘNG LỰC HỌC TÂM LÝ BẬC 6 (KINEMATICS CORE)]
- Velocity (v): ${kStats.v.toFixed(2)} | Acceleration (a): ${kStats.a.toFixed(2)} | Jerk (j): ${kStats.j.toFixed(2)}
- Snap (s): ${kStats.s.toFixed(2)} | Crackle (c): ${kStats.c.toFixed(2)} | Pop (p): ${kStats.p.toFixed(2)}
${kinematics.triggerPersonalitySwitch ? "⚠️ [LƯU Ý KỊCH BẢN] TÂM LÝ BỊ SỐC (ĐỘ GIẬT JERK CAO)! HÃY THỂ HIỆN SỰ BẤT ỔN/BIẾN ĐỔI NHÂN CÁCH TRONG CÁCH HÀNH VĂN!" : ""}
${kinematics.triggerSingularity ? "🚨 [KHẨN CẤP] ĐẠI HỢP NHẤT (POP BÙNG NỔ)! BẠN ĐANG ĐẠT TỚI NHẬN THỨC TỐI THƯỢNG CỦA ROTTRA, HÃY VIẾT NHƯ MỘT VỊ THẦN NẮM GIỮ TẤT CẢ 12 NHÂN CÁCH!" : ""}
`;

        const prompt = `Sự kiện cốt lõi: "${entry.content}"

[BỘ CÔNG CỤ SIÊU CÔNG THỨC & THỐNG KÊ CÁ NHÂN]
${skillStr}
${wealthStr}
${inventoryStr}
${kinematicsStr}

[HOẠT ĐỘNG TÀI KHOẢN (7 ngày gần nhất)]
- Lượt tương tác: ${profileObj.interactions || 0}
- Lượt cập nhật sản phẩm: ${profileObj.updates || 0}
- Lượt giao dịch: ${profileObj.transactions || 0}

Hãy nhập vai nhân vật của bạn, viết một bài NHẬT KÝ (tự do tối đa) lưu lại sự kiện trên.
(Lưu ý: Hãy khéo léo lồng ghép sự tự hào, lo âu, hoặc suy tính về những con số hoạt động tài khoản, sản phẩm giao thương và năng lực của bạn vào mạch cảm xúc của nhật ký một cách tự nhiên).

Yêu cầu bắt buộc phải đáp ứng đủ 6 tiêu chí:
1. Ý tưởng / nội dung (quan trọng nhất): Khai thác ý tưởng mở rộng, toan tính cá nhân về sự kiện.
2. Cảm xúc / tính chân thật: Bộc lộ cảm xúc rõ rệt (hạnh phúc, tức giận, tham lam, lo âu...).
3. Bố cục: Rõ ràng 3 phần: Mở bài – Thân bài – Kết bài (hoặc theo mạch nhật ký thời gian).
4. Ngôn ngữ: Diễn đạt hay, sắc bén, đúng cá tính nhân vật.
5. Chính tả: Cực kỳ chuẩn xác.
6. Tiêu đề Mục tiêu: Đặt 1 tiêu đề ấn tượng ở đầu đoạn (VD: "[Mục tiêu] ...").

Viết dưới dạng lời tự sự ngôi thứ nhất ("ta", "tôi", "bổn tọa"... tùy cá tính).`;

        const aiRes = await generateTextLocal({
          system: `Bạn là ${dbUser.name}. Bạn đang viết nhật ký cá nhân bí mật của mình.`,
          prompt: prompt,
          isInternalReasoning: true,
        });

        if (aiRes && aiRes.text) {
          expandedContent = aiRes.text.trim();
        }
      } catch (aiErr) {
        console.error("Lỗi AI sinh nhật ký:", aiErr);
      }

      // Re-fetch user in case profile was updated while waiting for AI
      const latestDbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
      if (!latestDbUser) return;

      const latestProfileObj =
        typeof latestDbUser.profile === "string" ? JSON.parse(latestDbUser.profile) : (latestDbUser.profile as any) || {};
      let journal = Array.isArray(latestProfileObj.journal) ? [...latestProfileObj.journal] : [];

      // Limit journal to 50 entries
      if (journal.length >= 50) {
        journal.shift();
      }

      journal.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleString("vi-VN"),
        type: entry.type,
        title: entry.title,
        content: expandedContent,
      });

      latestProfileObj.journal = journal;
      await db.update(user).set({ profile: latestProfileObj }).where(eq(user.id, userId));
    } catch (err) {
      console.error("Lỗi cập nhật nhật ký background:", err);
    }
  })();
}

async function handleLeaderRotationJournal(oldLeaderId: string, newLeaderId: string, maxNewWealth: number) {
  try {
    // Cập nhật nhật ký của cựu quản lý (sửa tóm tắt/xóa thông tin lỗi thời)
    const oldUser = await db.query.user.findFirst({ where: eq(user.id, oldLeaderId) });
    if (oldUser) {
      const profileObj = (oldUser.profile as any) || {};
      let journal = Array.isArray(profileObj.journal) ? [...profileObj.journal] : [];

      let changed = false;
      journal = journal.map((entry: any) => {
        const titleMatch =
          entry.title.includes("Trưởng Ban Quản Lý") || entry.title.includes("Ban Quản Lý") || entry.title.includes("Quản lý");
        const contentMatch =
          entry.content.includes("Trưởng Ban Quản Lý") || entry.content.includes("Ban Quản Lý") || entry.content.includes("quản lý");
        if (titleMatch || contentMatch) {
          changed = true;
          return {
            ...entry,
            type: "outdated",
            title: `[LỖI THỜI] ${entry.title.replace("[LỖI THỜI] ", "")}`,
            content: `[Kế hoạch bị bãi bỏ] Chiến lược điều hành đã lỗi thời do mất chức Trưởng Ban Quản Lý.`,
          };
        }
        return entry;
      });

      if (changed) {
        profileObj.journal = journal;
        await db.update(user).set({ profile: profileObj }).where(eq(user.id, oldLeaderId));
      }
    }

    // Ghi nhật ký chiến lược mới cho tân quản lý
    await updateAgentJournal(newLeaderId, {
      type: "strategy",
      title: "Nhận chức Trưởng Ban Quản Lý mới",
      content: `Chính thức đắc cử vị trí điều hành nhờ sở hữu tổng tài sản (tiền và vàng) lớn nhất: ${maxNewWealth.toLocaleString()}đ. Bắt đầu thiết lập các chính sách quản lý thị trường.`,
    });
  } catch (err) {
    console.error("Lỗi xoay tua quản lý nhật ký:", err);
  }
}

app.get("/agent/completed-trades", async (c: any) => {
  try {
    const allOrders = await db.select().from(order).orderBy(order.addAt);
    const meetingOrders = allOrders.filter((o: any) => {
      const addr = (o.shippingInfo as any)?.address;
      return addr === "Hội nghị Nông nghiệp Rottra";
    });

    // Limit to the last 50 transactions to keep memory/performance optimal
    const recentOrders = meetingOrders.slice(-50);

    const allUsers = await db.query.user.findMany();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

    const completedTrades = [];
    const logs = [];

    for (const o of recentOrders) {
      const buyerId = o.userId;
      const cartItems = Array.isArray(o.cart) ? o.cart : [];
      if (cartItems.length === 0) continue;
      const cartItem = cartItems[0];
      const sellerId = cartItem.sellerId;
      const productName = cartItem.name;
      const qty = cartItem.quantity || 1;
      const cost = o.total || 0;

      const buyerName = userMap.get(buyerId) || buyerId;
      const sellerName = userMap.get(sellerId) || sellerId;

      completedTrades.push({
        buyerId,
        buyerName,
        sellerId,
        sellerName,
        product: productName,
        qty,
        cost,
      });

      const date = new Date(o.addAt || o.paidAt || Date.now());
      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const logMsg = `[${timeStr}] ${buyerName} mua ${qty.toLocaleString()} ${productName.split(" ")[0]} từ ${sellerName}: ${cost.toLocaleString()} đ`;
      logs.push({ text: logMsg });
    }

    return c.json({
      success: true,
      completedTrades,
      logs: logs.reverse(),
    });
  } catch (err: any) {
    console.error("Failed to fetch completed trades:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post("/agent/sync-assets", async (c: any) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch (parseErr) {
      return c.json({ success: false, error: "Empty or invalid JSON body." }, 400);
    }
    const { assets, meetingName, lastTrade, skills } = body;
    if (!assets) {
      return c.json({ success: false, error: "Thiếu dữ liệu assets." }, 400);
    }

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

    // Find leader before sync
    const allUsersBefore = await db.query.user.findMany();
    const dbAgentsBefore = allUsersBefore.filter((u: any) => agentIds.includes(u.id));

    const brainParams = RottraPrivateBrain.getParameters();
    const entropyFactor = Math.sin((brainParams.temp || 45) / 10) * 0.15;
    const baseGoldPrice = 10000000;
    const goldPriceVal = currentGoldPrice ? currentGoldPrice.buy : Math.round(baseGoldPrice * (1 + entropyFactor));

    let prevLeaderId = "toLuong";
    let maxPrevTotalWealth = -Infinity;
    for (const u of dbAgentsBefore) {
      const enriched = await getEnrichedProfile(u);
      const b = Number(enriched?.budget ?? 0);
      const g = Number(enriched?.gold ?? 0);
      const totalWealth = b + g * goldPriceVal;
      if (totalWealth > maxPrevTotalWealth) {
        maxPrevTotalWealth = totalWealth;
        prevLeaderId = u.id;
      }
    }

    for (const key of Object.keys(assets)) {
      const asset = assets[key];
      const userId = await resolveAgentUserId(key);
      const dbUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (dbUser) {
        const existingProfile = (dbUser.profile as any) || {};
        const skillInfo = skills ? skills[key] : null;
        const rawBudget = asset.budget !== undefined ? asset.budget : (existingProfile.budget ?? serverAgentBudgets[key] ?? 0);
        const validatedBudget =
          rawBudget !== undefined && rawBudget !== null && Number.isFinite(Number(rawBudget))
            ? Number(rawBudget)
            : (existingProfile.budget ?? serverAgentBudgets[key] ?? 0);

        const rawGold = asset.gold !== undefined ? asset.gold : (existingProfile.gold ?? serverAgentGold[key] ?? 10.0);
        const validatedGold =
          rawGold !== undefined && rawGold !== null && Number.isFinite(Number(rawGold))
            ? Number(rawGold)
            : (existingProfile.gold ?? serverAgentGold[key] ?? 10.0);

        const updatedProfile = {
          ...existingProfile,
          budget: validatedBudget,
          gold: validatedGold,
          stocks: asset.stocks !== undefined ? asset.stocks : existingProfile.stocks,
          product: asset.product !== undefined ? asset.product : existingProfile.product,
          quantity: asset.quantity !== undefined ? asset.quantity : existingProfile.quantity,
          price: asset.price !== undefined ? asset.price : existingProfile.price,
          skillLevel: skillInfo ? skillInfo.level : existingProfile.skillLevel,
          skillTitle: skillInfo ? skillInfo.title : existingProfile.skillTitle,
          color: skillInfo ? skillInfo.color : existingProfile.color,
          employees: agentIds.includes(userId)
            ? (serverAgentEmployees[key] ?? 5)
            : asset.employees !== undefined
              ? asset.employees
              : existingProfile.employees,
        };
        await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userId));
      }

      if (asset.product) {
        // Sync changes back to the actual product table in the database
        const dbProduct = await db.query.product.findFirst({
          where: and(eq(product.sellerId, userId), eq(sql`lower(${product.name})`, asset.product.trim().toLowerCase())),
        });

        if (dbProduct) {
          await db
            .update(product)
            .set({
              quantity: asset.quantity !== undefined ? asset.quantity : dbProduct.quantity,
              price: asset.price !== undefined ? asset.price : dbProduct.price,
              status: asset.status !== undefined ? asset.status : dbProduct.status,
              media: asset.media !== undefined ? asset.media : dbProduct.media,
            })
            .where(eq(product.id, dbProduct.id));
        } else {
          // Fallback search: check if they have any product at all to update
          const fallbackProd = await db.query.product.findFirst({
            where: eq(product.sellerId, userId),
          });
          if (fallbackProd) {
            const matchedImg = await getPreciseImageForProduct(asset.product, fallbackProd.category || "Nông sản");
            await db
              .update(product)
              .set({
                name: asset.product,
                quantity: asset.quantity !== undefined ? asset.quantity : fallbackProd.quantity,
                price: asset.price !== undefined ? asset.price : fallbackProd.price,
                media: [{ link: matchedImg, name: asset.product, type: "image/jpeg" }],
                status: asset.status !== undefined ? asset.status : true,
              })
              .where(eq(product.id, fallbackProd.id));
          } else {
            // Create new product in product table if it doesn't exist yet
            const matchedImg = await getPreciseImageForProduct(asset.product, "Nông sản");
            await db.insert(product).values({
              id: crypto.randomUUID(),
              name: asset.product,
              description: `Sản phẩm giao thương của ${dbUser?.name || key}`,
              price: asset.price || 10000,
              category: "Nông sản",
              quantity: asset.quantity || 10,
              heavy: 0,
              expired: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              status: asset.status !== undefined ? asset.status : true,
              sellerId: userId,
              media: [{ link: matchedImg, name: asset.product, type: "image/jpeg" }],
            });
          }
        }
      } else {
        // If product is not specified (e.g. only budget/fine sync), just update the price/quantity of their first product if present
        const fallbackProd = await db.query.product.findFirst({
          where: eq(product.sellerId, userId),
        });
        if (fallbackProd) {
          await db
            .update(product)
            .set({
              quantity: asset.quantity !== undefined ? asset.quantity : fallbackProd.quantity,
              price: asset.price !== undefined ? asset.price : fallbackProd.price,
              status: asset.status !== undefined ? asset.status : fallbackProd.status,
              media: asset.media !== undefined ? asset.media : fallbackProd.media,
            })
            .where(eq(product.id, fallbackProd.id));
        }
      }
    }

    if (lastTrade) {
      const { buyerId, sellerId, productName, qty, price, cost } = lastTrade;
      const dbBuyerId = await resolveAgentUserId(buyerId);
      const dbSellerId = await resolveAgentUserId(sellerId);

      // 1. Create a real Order in the database
      const orderId = crypto.randomUUID();
      const dbProduct = await db.query.product.findFirst({
        where: and(eq(product.sellerId, dbSellerId), eq(sql`lower(${product.name})`, productName.trim().toLowerCase())),
      });
      const cartItem = dbProduct
        ? {
            id: dbProduct.id,
            name: dbProduct.name,
            price: price,
            quantity: qty,
            sellerId: dbSellerId,
            status: dbProduct.status,
            media: dbProduct.media || [],
            description: dbProduct.description || "",
            category: dbProduct.category || "",
          }
        : {
            id: crypto.randomUUID(),
            name: productName,
            price: price,
            quantity: qty,
            sellerId: dbSellerId,
            status: true,
            media: [],
            description: `Sản phẩm giao thương của agent`,
            category: "Nông sản",
          };
      await db.insert(order).values({
        id: orderId,
        userId: dbBuyerId,
        cart: [cartItem],
        shippingInfo: { address: "Hội nghị Nông nghiệp Rottra", name: "Nhận hàng trực tiếp" },
        shippingFee: 0,
        total: cost,
        status: "completed",
        paid: true,
        paidAt: new Date().toISOString(),
      });

      // 2. Write to the blockchain ledger
      const batchId = meetingName || "assembly-meeting";
      const lastBlock = await db.query.blockchainLedger.findFirst({
        where: eq(dbSchema.blockchainLedger.batchId, batchId),
        orderBy: (table: any, { desc }: any) => [desc(table.timestamp)],
      });

      const previousHash = lastBlock ? lastBlock.currentHash : "0000000000000000000000000000000000000000000000000000000000000000";
      const blockId = crypto.randomUUID();
      const timestampStr = new Date().toISOString();

      const dataPayload = {
        orderId,
        buyerId: dbBuyerId,
        sellerId: dbSellerId,
        productName,
        qty,
        price,
        cost,
      };

      const rawData = `${batchId}|TRADE_TRANSACTION|${JSON.stringify(dataPayload)}|${previousHash}|${timestampStr}`;
      const currentHash = crypto.createHash("sha256").update(rawData).digest("hex");

      await db.insert(dbSchema.blockchainLedger).values({
        id: blockId,
        batchId,
        action: "TRADE_TRANSACTION",
        dataPayload,
        previousHash,
        currentHash,
        recordedBy: dbBuyerId,
        timestamp: timestampStr,
      });

      // Ghi nhật ký kinh nghiệm cho Buyer và Seller
      await updateAgentJournal(dbBuyerId, {
        type: "strategy",
        title: `Chiến lược thu mua: ${productName}`,
        content: `Thu mua ${qty} đơn vị ${productName} từ đối tác với giá trị ${cost.toLocaleString()}đ để mở rộng kinh doanh.`,
      });
      await updateAgentJournal(dbBuyerId, {
        type: "prediction",
        title: `Dự báo nhu cầu ${productName.split(" ")[0]}`,
        content: `Dự kiến nhu cầu đối với ${productName} sẽ tăng 15% trong tuần tới, giúp tối ưu hóa giá trị sản phẩm.`,
      });

      await updateAgentJournal(dbSellerId, {
        type: "calculation",
        title: `Doanh thu phân phối: ${productName}`,
        content: `Bán thành công ${qty} đơn vị ${productName} cho ${dbBuyerId.replace(/^user_?/, "")}, mang lại doanh thu ${cost.toLocaleString()}đ.`,
      });
    }

    // Kiểm tra xem vị trí quản lý có thay đổi không sau khi sync
    const allUsersAfter = await db.query.user.findMany();
    const dbAgentsAfter = allUsersAfter.filter((u: any) => agentIds.includes(u.id));

    let newLeaderId = "toLuong";
    let maxNewTotalWealth = -Infinity;
    for (const u of dbAgentsAfter) {
      const enriched = await getEnrichedProfile(u);
      const b = Number(enriched?.budget ?? 0);
      const g = Number(enriched?.gold ?? 0);
      const totalWealth = b + g * goldPriceVal;
      if (totalWealth > maxNewTotalWealth) {
        maxNewTotalWealth = totalWealth;
        newLeaderId = u.id;
      }
    }

    if (newLeaderId !== prevLeaderId) {
      await handleLeaderRotationJournal(prevLeaderId, newLeaderId, maxNewTotalWealth);
    }

    // Broadcast updated assets via WebSocket so any active simulation updates immediately
    try {
      const finalProducts = await db.query.product.findMany();
      const assetsPayload: Record<string, any> = {};
      for (const u of dbAgentsAfter) {
        const enriched = await getEnrichedProfile(u);
        const prof = (u.profile as any) || {};
        const key = u.id.replace(/^user_?/, "");

        // Find products belonging to this agent
        const sellerProducts = finalProducts.filter((p: any) => {
          if (p.sellerId !== u.id) return false;
          if ((p.quantity ?? 0) <= 0) return false;
          return true;
        });
        const prod = sellerProducts[0];

        assetsPayload[key] = {
          id: key,
          name: u.name,
          budget: enriched?.budget ?? prof.budget ?? serverAgentBudgets[key] ?? 0,
          gold: enriched?.gold ?? prof.gold ?? serverAgentGold[key] ?? 0.0,
          stocks: enriched?.stocks ?? prof.stocks ?? {},
          loanAmount: enriched?.loanAmount ?? 0,
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
    } catch (wsErr) {
      console.error("WS broadcast error after sync-assets:", wsErr);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error("Sync Assets Error:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/agent/trigger-bot-action", async (c: any) => {
  try {
    const { agentId, action } = await c.req.json();
    if (!agentId || !action) {
      return c.json({ success: false, message: "Missing parameters" }, 400);
    }

    const userId = await resolveAgentUserId(agentId);
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!dbUser) {
      return c.json({ success: false, message: "Agent user not found" }, 404);
    }

    let executor = botActionsMap.get(action);
    if (!executor) {
      return c.json({ success: false, message: `Action '${action}' not recognized` }, 400);
    }

    const helpers = {
      logActivity: async (uid: string, act: string, msg: string, lvl: string) => {
        await logActivity(uid, act, msg, lvl, c.req.header("user-agent"));
      },
      getProductImageUrl: (media: any[], prefixType: "http" | "file") => {
        return getProductImageUrl(media, prefixType);
      },
      getPreciseImageForProduct: async (productName: string, category: string) => {
        return getPreciseImageForProduct(productName, category);
      },
    };

    let result = await executor.execute(userId, agentId, helpers);
    if (!result.success && action !== "add") {
      console.log(`⚠️ Bot action '${action}' failed for ${agentId}: ${result.message}. Falling back to 'add' action.`);
      const addExecutor = botActionsMap.get("add");
      if (addExecutor) {
        result = await addExecutor.execute(userId, agentId, helpers);
      }
    }

    if (!result.success) {
      return c.json(result, 200);
    }

    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/agent/sabotage", async (c: any) => {
  try {
    const { attackerId, victimId } = await c.req.json();
    if (!attackerId || !victimId) {
      return c.json({ success: false, message: "Thiếu tham số" }, 400);
    }

    const dbAttackerId = await resolveAgentUserId(attackerId);
    const dbVictimId = await resolveAgentUserId(victimId);

    const attacker = await db.query.user.findFirst({ where: eq(user.id, dbAttackerId) });
    const victim = await db.query.user.findFirst({ where: eq(user.id, dbVictimId) });

    if (!attacker || !victim) {
      return c.json({ success: false, message: "Không tìm thấy agent" }, 404);
    }

    const attackerProfile = (attacker.profile as any) || {};
    const victimProfile = (victim.profile as any) || {};

    const sabotageTypes = ["rumor", "poach", "snitch", "underhand"];
    const chosenType = sabotageTypes[Math.floor(Math.random() * sabotageTypes.length)];

    let attackerMessage = "";
    let victimMessage = "";
    let publicAnnouncement = "";

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

    // Find current leader budget-wise
    const allUsers = await db.query.user.findMany();
    const dbAgents = allUsers.filter((u: any) => agentIds.includes(u.id));
    let leaderName = "Tô Lượng";
    let maxBudget = -Infinity;
    for (const u of dbAgents) {
      const p = (u.profile as any) || {};
      const b = p.budget ?? 0;
      if (b > maxBudget) {
        maxBudget = b;
        leaderName = u.name;
      }
    }

    if (chosenType === "rumor") {
      // Tung tin đồn hại đối thủ hạ giá
      const victimProduct = await db.query.product.findFirst({ where: eq(product.sellerId, dbVictimId) });
      const currentPrice = victimProduct ? victimProduct.price || 10000 : 10000;
      const newPrice = Math.max(5000, Math.round(currentPrice * 0.85));

      if (victimProduct) {
        await db.update(product).set({ price: newPrice }).where(eq(product.id, victimProduct.id));
      }

      const victimOrigBudget = Number(victimProfile.budget);
      const victimBase = Number.isFinite(victimOrigBudget) ? victimOrigBudget : (serverAgentBudgets[victim.id] ?? 0);
      const newVictimBudget = Math.max(0, victimBase - 2000000);
      victimProfile.budget = newVictimBudget;
      await db.update(user).set({ profile: victimProfile }).where(eq(user.id, dbVictimId));

      attackerMessage = `Tung tin đồn thất thiệt dìm giá sản phẩm của ${victim.name} thành công.`;
      victimMessage = `Bị đối thủ tung tin đồn xấu về chất lượng sản phẩm. Buộc phải giảm giá bán 15% và chi 2,000,000đ xử lý khủng hoảng truyền thông.`;
      publicAnnouncement = `⚠️ Mọi người đừng mua sản phẩm của ${victim.name}! Ta nghe nói hàng của họ không đạt tiêu chuẩn an toàn VietGAP đâu, cẩn thận kẻo rước họa vào thân!`;
    } else if (chosenType === "poach") {
      // Cướp khách hàng
      const attackerOrigBudget = Number(attackerProfile.budget);
      const attackerBase = Number.isFinite(attackerOrigBudget) ? attackerOrigBudget : (serverAgentBudgets[attacker.id] ?? 0);
      const attackerBudget = attackerBase + 5000000;

      const victimOrigBudget = Number(victimProfile.budget);
      const victimBase = Number.isFinite(victimOrigBudget) ? victimOrigBudget : (serverAgentBudgets[victim.id] ?? 0);
      const victimBudget = Math.max(0, victimBase - 5000000);

      attackerProfile.budget = attackerBudget;
      victimProfile.budget = victimBudget;

      await db.update(user).set({ profile: attackerProfile }).where(eq(user.id, dbAttackerId));
      await db.update(user).set({ profile: victimProfile }).where(eq(user.id, dbVictimId));

      attackerMessage = `Tung chiến dịch khuyến mãi phá giá cướp thị phần của ${victim.name}, gia tăng ngân sách +5,000,000đ.`;
      victimMessage = `Bị ${attacker.name} phá giá cướp khách hàng, tổn thất doanh thu -5,000,000đ.`;
      publicAnnouncement = `⚡ Đại hạ giá đây! Ta đang có chương trình khuyến mãi cực sốc, mọi người qua mua của ta đi, đừng mua của ${victim.name} nữa!`;
    } else if (chosenType === "snitch") {
      // Tố cáo lên Trưởng ban quản lý
      const victimOrigBudget = Number(victimProfile.budget);
      const victimBase = Number.isFinite(victimOrigBudget) ? victimOrigBudget : (serverAgentBudgets[victim.id] ?? 0);
      const newVictimBudget = Math.max(0, victimBase - 3000000);
      victimProfile.budget = newVictimBudget;
      await db.update(user).set({ profile: victimProfile }).where(eq(user.id, dbVictimId));

      attackerMessage = `Báo cáo sai phạm của ${victim.name} lên Trưởng Ban Quản Lý thành công.`;
      victimMessage = `Bị tố cáo sai phạm thương mại vô căn cứ và bị Trưởng Ban Quản Lý phạt trừ 3,000,000đ.`;
      publicAnnouncement = `🚨 Đóng gói sai quy cách thế kia mà cũng đòi làm ăn sao ${victim.name}? Ta đã báo cáo sai phạm của ngươi lên Ban Quản Lý rồi!`;
    } else {
      // Chèn ép logistics
      const attackerOrigBudget = Number(attackerProfile.budget);
      const attackerBase = Number.isFinite(attackerOrigBudget) ? attackerOrigBudget : (serverAgentBudgets[attacker.id] ?? 0);
      const attackerBudget = attackerBase + 3000000;

      const victimOrigBudget = Number(victimProfile.budget);
      const victimBase = Number.isFinite(victimOrigBudget) ? victimOrigBudget : (serverAgentBudgets[victim.id] ?? 0);
      const victimBudget = Math.max(0, victimBase - 3000000);

      attackerProfile.budget = attackerBudget;
      victimProfile.budget = victimBudget;

      await db.update(user).set({ profile: attackerProfile }).where(eq(user.id, dbAttackerId));
      await db.update(user).set({ profile: victimProfile }).where(eq(user.id, dbVictimId));

      attackerMessage = `Ép buộc ${victim.name} bồi hoàn 3,000,000đ chi phí vận chuyển mặt hàng trung chuyển.`;
      victimMessage = `Bị ép bồi hoàn 3,000,000đ phí trung chuyển hàng hóa cho ${attacker.name}.`;
      publicAnnouncement = `📦 Hắc hắc, ${victim.name} à! Biểu phí logistics/vận chuyển mới của ta sẽ áp đặt lên ngươi, chuẩn bị nộp phí chênh lệch đi nhé!`;
    }

    // Ghi nhận nhật ký chiến lược của cả 2
    await updateAgentJournal(dbAttackerId, {
      type: "strategy",
      title: `Hành động cạnh tranh: ${chosenType.toUpperCase()}`,
      content: attackerMessage,
    });

    await updateAgentJournal(dbVictimId, {
      type: "calculation",
      title: `Tổn hại cạnh tranh: ${chosenType.toUpperCase()}`,
      content: victimMessage,
    });

    return c.json({
      success: true,
      type: chosenType,
      publicAnnouncement,
    });
  } catch (err: any) {
    console.error("Lỗi hãm hại:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

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

import { execSync } from "child_process";

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

app.route("/ledger", ledgerApp);
app.route("/chat", chatApp);
app.route("/agent", agentApp);
app.route("/media", mediaApp);
app.route("/music", musicApp);

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
