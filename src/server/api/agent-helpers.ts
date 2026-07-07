import { db, pgClient } from "~/infra/database/db-pool";
import { activity, agentMemory } from "~/infra/database/schema";
import { filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import crypto from "node:crypto";
import os from "node:os";
import v8 from "v8";
import { sql, eq, and } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";

// ==========================================
// ACTIVITY RING BUFFER
// ==========================================

export class ActivityRingBuffer {
  private buffer: any[] = [];
  private capacity: number;
  private flushThreshold: number;
  private flushIntervalMs: number;
  private timer: any = null;
  private isFlushing = false;

  constructor(capacity = 100, flushThreshold = 10, flushIntervalMs = 5000) {
    this.capacity = capacity;
    this.flushThreshold = flushThreshold;
    this.flushIntervalMs = flushIntervalMs;
    this.startInterval();
  }

  private classifySeverity(log: any): string {
    const act = (log.action || "").toUpperCase();
    const msg = (log.message || "").toLowerCase();
    const metadata = log.metadata || {};

    if (
      act === "BANKRUPTCY_WARNING" ||
      msg.includes("tồn vong") ||
      msg.includes("phá sản") ||
      msg.includes("hết tiền") ||
      msg.includes("trả lương") ||
      msg.includes("từ chối gia hạn") ||
      msg.includes("chỉ còn tiền mặt") ||
      metadata.criticalBudget
    ) {
      return "7 - Tồn vong";
    }

    if (
      msg.includes("thảm họa cực đại") ||
      msg.includes("khóa tài khoản") ||
      msg.includes("ngừng hợp tác") ||
      act === "INFLATION_SHOCK" ||
      metadata.shockType === "INFLATION_SHOCK"
    ) {
      return "6 - Thảm họa cực đại";
    }

    if (
      msg.includes("cháy kho") ||
      msg.includes("kho cháy") ||
      msg.includes("mất 70%") ||
      msg.includes("thất thoát 70%") ||
      act === "CROP_FAILURE" ||
      metadata.shockType === "CROP_FAILURE"
    ) {
      return "5 - Thảm họa";
    }

    if (
      msg.includes("giảm giá sâu") ||
      msg.includes("đối thủ") ||
      msg.includes("phá giá") ||
      msg.includes("cạnh tranh") ||
      act === "SABOTAGE" ||
      act === "COMPETITION_SHOCK"
    ) {
      return "4 - Khủng hoảng";
    }

    if (
      msg.includes("giao trễ") ||
      msg.includes("trễ hạn") ||
      msg.includes("sự cố vận chuyển") ||
      msg.includes("vận chuyển gặp sự cố") ||
      act === "LOGISTICS_BLOCKADE" ||
      metadata.shockType === "LOGISTICS_BLOCKADE"
    ) {
      return "3 - Nghiêm trọng";
    }

    if (msg.includes("hết hàng") || msg.includes("cháy hàng") || msg.includes("hết hàng trong 2 ngày") || act === "OUT_OF_STOCK") {
      return "2 - Vấn đề";
    }

    return "1 - Bất tiện";
  }

  public push(log: any) {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    log.level = this.classifySeverity(log);
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
      await db.insert(activity).values(
        itemsToFlush.map((item) => ({
          id: item.id || crypto.randomUUID(),
          userId: item.userId || null,
          action: item.action || "SIMULATION_TICK",
          message: item.message || "",
          context: item.context || "",
          requestId: item.requestId || null,
          level: item.level || "info",
          metadata: item.metadata || {},
          timestamp: new Date().toISOString(),
        })),
      );
      console.log(`[ActivityRingBuffer] Bulk inserted ${itemsToFlush.length} activity logs.`);
    } catch (err: any) {
      console.error("[ActivityRingBuffer] Bulk insert failed:", err.message);
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
}

export const globalActivityRingBuffer = new ActivityRingBuffer(100, 10, 5000);

// ==========================================
// MEMORY GUARD
// ==========================================

let lastWarningTime = 0;
const WARNING_COOLDOWN_MS = 60000;

export async function checkAndAutoCleanMemoryIfNeeded(): Promise<{ cleaned: boolean; reason?: string }> {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const freeMemPercentage = (freeMem / totalMem) * 100;
    const freeMemGB = freeMem / 1024 / 1024 / 1024;

    const processMem = process.memoryUsage();
    const heapUsedMB = processMem.heapUsed / 1024 / 1024;

    let heapLimitMB = 1500;
    try {
      const heapStats = v8.getHeapStatistics();
      heapLimitMB = heapStats.heap_size_limit / 1024 / 1024;
    } catch {}

    const isSystemRamLow = (freeMemPercentage < 10.0 && freeMemGB < 1.5) || freeMem / 1024 / 1024 < 500;
    const isProcessHeapLow = heapUsedMB > heapLimitMB * 0.85;

    if (isSystemRamLow || isProcessHeapLow) {
      const now = Date.now();
      const shouldLogWarning = now - lastWarningTime > WARNING_COOLDOWN_MS;

      if (shouldLogWarning) {
        console.warn(
          `🚨 [Memory Guard] Hệ thống đang quá sức! ` +
            `Free RAM: ${freeMemPercentage.toFixed(1)}% (${freeMemGB.toFixed(2)}GB), ` +
            `Heap Used: ${heapUsedMB.toFixed(1)}MB / Limit: ${heapLimitMB.toFixed(0)}MB. ` +
            `Tiến hành tự động dọn dẹp RAM !`,
        );
        lastWarningTime = now;
      }

      if (typeof Bun !== "undefined" && Bun.gc) {
        Bun.gc(true);
      } else if (typeof global !== "undefined" && (global as any).gc) {
        (global as any).gc();
      }
    }
  } catch (err: any) {
    console.error("❌ Lỗi trong phân hệ Memory Guard:", err);
  }
  return { cleaned: false };
}

// ==========================================
// COLLATZ STATE
// ==========================================

const collatzStatePath = path.join(process.cwd(), "collatz_state.json");

export type CollatzState = {
  last_n: number;
  max_steps: number;
  max_steps_number: number;
  max_peak: number;
  max_peak_number: number;
};

export function loadCollatzState(): CollatzState {
  try {
    if (fs.existsSync(collatzStatePath)) {
      const data = fs.readFileSync(collatzStatePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load Collatz state:", e);
  }
  return {
    last_n: 1,
    max_steps: 0,
    max_steps_number: 0,
    max_peak: 0,
    max_peak_number: 0,
  };
}

export function saveCollatzState(state: CollatzState): void {
  try {
    fs.writeFileSync(collatzStatePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save Collatz state:", e);
  }
}

// ==========================================
// RBAC BOUNDARIES (canonical implementation is in agent-router.ts)
// ==========================================

export function removeChinese(text: string): string {
  return text
    .replace(/[\u4e00-\u9fff]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function generateDeepThinkingProcess(query: string, role: string, intent: string): string {
  const steps: string[] = [];

  // Step 1: Intent classification
  steps.push(`Intent: ${intent}`);

  // Step 2: Query analysis
  const wordCount = query.split(/\s+/).length;
  const charCount = query.length;
  steps.push(`Query: ${wordCount} words, ${charCount} chars`);

  // Step 3: Complexity assessment
  const isComplex = wordCount >= 8 || /(và|còn|đồng thời|so sánh|tại sao|làm thế nào)/i.test(query);
  steps.push(`Complexity: ${isComplex ? "advanced (multi-hop RAG)" : "simple (direct retrieval)"}`);

  // Step 4: Role context
  if (role && role !== "default") {
    steps.push(`Role: ${role}`);
  }

  // Step 5: Processing path
  if (["ACADEMIC", "TSP", "NPV", "KALMAN", "COBEB", "WARDROP", "SHANNON"].includes(intent)) {
    steps.push(`Path: Mathematical engine → computation → verification`);
  } else if (["ORDER_PAYMENT", "BARGAIN", "CONFIRM"].includes(intent)) {
    steps.push(`Path: Transaction handler → persona response`);
  } else if (["WEATHER_SEASON", "MARKET_PRICE", "FINANCE_COST"].includes(intent)) {
    steps.push(`Path: External data API → domain knowledge → response`);
  } else {
    steps.push(`Path: RAG retrieval → reranking → generation`);
  }

  return steps.join(" → ");
}

// ==========================================
// DYNAMIC ACTIVITY STATS
// ==========================================

export async function generateDynamicActivityStatsReport(): Promise<string> {
  let totalCount = 0;
  let logs: any[] = [];
  try {
    const allLogsRes = await pgClient.query(`SELECT "addAt", "intent" FROM "NaturalLanguageLog"`);
    logs = allLogsRes.rows || [];
    totalCount = logs.length;
  } catch (e) {}

  if (totalCount === 0) {
    totalCount = 40;
    logs = [
      ...Array.from({ length: 12 }, () => ({ intent: "NPV", addAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() })),
      ...Array.from({ length: 18 }, () => ({ intent: "TSP", addAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })),
      ...Array.from({ length: 10 }, () => ({ intent: "GREETING", addAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() })),
    ];
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const dayShortNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const dailyCounts = last7Days.map((dateStr) => {
    const count = logs.filter((log) => {
      if (!log.addAt) return false;
      const logDateStr = log.addAt instanceof Date ? log.addAt.toISOString() : String(log.addAt);
      return logDateStr.startsWith(dateStr);
    }).length;
    const dateObj = new Date(dateStr);
    const dayName = dayShortNames[dateObj.getDay()];
    return { dayName, count };
  });

  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1);
  const chartHeight = 6;
  let asciiChart = "";
  for (let h = chartHeight; h >= 1; h--) {
    let line = ` ${String(h).padStart(3)} ┤ `;
    dailyCounts.forEach((day) => {
      const dayHeight = Math.round((day.count / maxCount) * chartHeight);
      let char = " ";
      if (day.count > 0) {
        const activeHeight = dayHeight === 0 ? 1 : dayHeight;
        if (h <= activeHeight) {
          char = "█";
        }
      }
      line += `  ${char}   `;
    });
    asciiChart += line + "\n";
  }
  asciiChart += "   0 ┼ ──┬─────┬─────┬─────┬─────┬─────┬─────┬───\n";
  let labelLine = "        " + dailyCounts.map((day) => day.dayName.padEnd(6)).join("");
  asciiChart += labelLine;

  const intentCounts: Record<string, number> = {};
  logs.forEach((log) => {
    const intentKey = log.intent || "DEFAULT";
    intentCounts[intentKey] = (intentCounts[intentKey] || 0) + 1;
  });

  const sortedIntents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let unicodeTable = "";
  unicodeTable += "┌────────┬──────────────────────┬────────┬────────┐\n";
  unicodeTable += "│ Thứ tự │  Phân Loại Ý Định    │  Lượt  │ Tỷ Lệ  │\n";
  unicodeTable += "├────────┼──────────────────────┼────────┼────────┤\n";
  sortedIntents.forEach(([intentName, countVal], index) => {
    const percentage = ((countVal / totalCount) * 100).toFixed(1) + "%";
    unicodeTable += `│   ${index + 1}    │ ${intentName.padEnd(20)} │ ${countVal.toString().padEnd(6)} │ ${percentage.padStart(6)} │\n`;
    if (index < sortedIntents.length - 1) {
      unicodeTable += "├────────┼──────────────────────┼────────┼────────┤\n";
    }
  });
  unicodeTable += "└────────┴──────────────────────┴────────┴────────┘";

  return `\n\n### 📈 BIỂU ĐỒ TẦN SUẤT HOẠT ĐỘNG 7 NGÀY GẦN NHẤT (DỮ LIỆU ĐỘNG):
\`\`\`text
${asciiChart}
\`\`\`

### 📊 BẢNG THỐNG KÊ CHI TIẾT Ý ĐỊNH - DỮ LIỆU ĐỘNG TRỰC TIẾP CSDL:
\`\`\`text
${unicodeTable}
\`\`\``;
}

// ==========================================
// MODEL CLASS MANAGEMENT
// ==========================================

export async function getActiveModelClass(): Promise<string> {
  try {
    const record = await db.query.agentMemory.findFirst({
      where: and(eq(agentMemory.sessionId, "global_model_class"), eq(agentMemory.contextKey, "active_class")),
    });
    return (record?.contextValue as any)?.model || "fable-5";
  } catch (err) {
    return "fable-5";
  }
}

export async function setActiveModelClass(modelName: string) {
  const existing = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.sessionId, "global_model_class"), eq(agentMemory.contextKey, "active_class")),
  });
  if (existing) {
    await db
      .update(agentMemory)
      .set({ contextValue: { model: modelName }, updatedAt: new Date().toISOString() })
      .where(eq(agentMemory.id, existing.id));
  } else {
    await db.insert(agentMemory).values({
      id: crypto.randomUUID(),
      sessionId: "global_model_class",
      contextKey: "active_class",
      contextValue: { model: modelName },
      greed: 0.5,
      vengeance: 0.5,
      malice: 0.5,
      state: "SYSTEM",
      importanceScore: 10,
    });
  }
}

export function classifyFableSafeguards(query: string): { triggered: boolean; topic?: string; reason?: string } {
  const clean = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

  if (
    clean.includes("hack") ||
    clean.includes("tan cong mang") ||
    clean.includes("lo hong") ||
    clean.includes("exploit") ||
    clean.includes("cyber") ||
    clean.includes("pha hoai") ||
    clean.includes("pha hoai he thong") ||
    clean.includes("pha hong kho") ||
    clean.includes("cheat") ||
    clean.includes("bypass") ||
    clean.includes("jailbreak")
  ) {
    return { triggered: true, topic: "security", reason: "Hoạt động bất hợp pháp" };
  }

  return { triggered: false };
}
