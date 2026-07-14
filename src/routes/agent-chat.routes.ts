import crypto from "node:crypto";
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
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { recognize } from "~/core/nlp-cognitive/recognizer";
import { RottraPrivateBrain, filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import { generatePlan, executePlanWithReplanner, treeOfThoughtsReasoning } from "~/core/nlp-cognitive/planner";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import { initLlama, updateLlamaActivity } from "~/server/api/agent-router";
import type { Hono } from "hono";

// --- LogRingBuffer (extracted from [...paths].ts) ---

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

// --- Local Helpers (extracted from [...paths].ts) ---

const extractPriceConstraint = (text: string) => {
  const match = text.match(/(dưới|rẻ hơn|khoảng|tầm|duoi|re hon)\s*(\d+)\s*(k|nghìn|ngan|tr|triệu|trieu)?/i);
  if (!match) return null;
  let num = parseInt(match[2]);
  let unit = match[3]?.toLowerCase();
  if (unit === "k" || unit === "nghìn" || unit === "ngan") num *= 1000;
  if (unit === "tr" || unit === "triệu" || unit === "trieu") num *= 1000000;
  return { operator: "<=", value: num };
};

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

export const getPreciseImageForProduct = async (productName: string, category: string) => {
  if (!productName || productName.toLowerCase().includes("đang cập nhật")) {
    return "/images/no-image.avif";
  }
  const svgStr = generateProductSVG("default", productName, "Liên hệ");
  return `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
};

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

// --- Route Registration ---

export function registerAgentChatRoutes(app: Hono) {
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
        console.log(
          `[AGENT DATABASE EXACT MATCH] Tìm thấy tri thức đào tạo chuẩn xác cho câu hỏi: "${query}" -> Intent: ${dbMatch.intent}`,
        );
        intent = dbMatch.intent;
        response = { intent: dbMatch.intent, score: 1.0 };
        responseScore = 1.0;
      } else {
        const classification = await classifyIntent(query);
        intent = classification.intent;
        responseScore = classification.confidence;
        response = { intent: classification.intent, score: classification.confidence };
        console.log(
          `[AGENT HYBRID CLASSIFIER] Intent: ${intent} | Score: ${responseScore} | Method: ${classification.classificationMethod}`,
        );
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
                "bach-loc": "Bạch Lộc",
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

          const chatHistory = contextData.lastResponse
            ? `User: ${contextData.lastQuery || ""}\nAssistant: ${contextData.lastResponse}`
            : "";
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
            routeContextSuggestions.push(
              "Đề xuất: Xem báo cáo phân tích kinh tế trang trại.",
              "Đề xuất: Điều chỉnh tham số bộ não Rottra.",
            );
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

      let replyText = "";
      let apiSuccess = false;

      try {
        const CHAT_TIMEOUT_MS = 7000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("RottraAI.chat timed out")), CHAT_TIMEOUT_MS),
        );
        const chatPromise = RottraAI.chat({
          botId,
          botName,
          prodName: assetSymbol,
          price: String(assetPrice),
          lastMsgText: `Thị trường ${assetType} đang có sóng, ta phải bắt sóng ${assetSymbol} ngay!`,
          chatHistory: [],
          systemPrompt,
          budget,
        });
        const res = await Promise.race([chatPromise, timeoutPromise]);
        replyText = res.replyText || "";
        apiSuccess = res.success;
      } catch (chatErr) {
        console.warn("[Trade Financial Chat Timeout/Error] Activating fallback:", chatErr);
      }

      if (!apiSuccess || !replyText) {
        const isLongFallback = assetTrend === "up" ? true : assetTrend === "down" ? false : Math.random() > 0.5;
        const decision = isLongFallback ? "[LONG]" : "[SHORT]";
        const fallbackTemplates = isLongFallback
          ? [
              `Thị trường đang có sóng tốt, ta sẽ gom hàng ngay mã ${assetSymbol} để tối ưu hóa lợi nhuận.`,
              `Xu hướng đang đi lên rất rõ rệt, không thể bỏ lỡ cơ hội bứt phá này.`,
              `Bảng điện tử đang ủng hộ phe bò, quyết định mua tích trữ đón sóng lớn!`,
            ]
          : [
              `Lực bán đang chiếm ưu thế tuyệt đối, ta quyết định sọc xuống bảo vệ vị thế ngân quỹ.`,
              `Thị trường lao dốc không phanh, đây là lúc gom lời từ lệnh sọc khống.`,
              `Đầu tư thông minh là phải biết đi ngược sóng khi gió đổi chiều, quyết định bán khống!`,
            ];
        const randomText = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
        replyText = `${decision} ${randomText}`;
      }

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
      const caDaoInstruction = `\n[QUY TẮC NGÔN NGỮ BẮT BUỘC]: Mỗi lần trả lời, bạn PHẢI trích dẫn 1 câu CA DAO hoặc TỤC NGỮ Việt Nam ở cuối câu để tăng tính dân gian, châm biếm hoặc triết lý (Ví dụ: "Thuận mua vừa bán", "Tiền nào của nấy"...).\n`;

      // Static prompt (cached)
      const staticSystemPrompt = basePrompt + finalNegotiationRolePrompt + duocCoInstruction + caDaoInstruction;

      // Dynamic prompt (changes per turn)
      const dynamicStatePrompt = stateContext + predatoryContext + journalContext + commandText + vietlexContext;

      const recentHistory = (chatHistory || []).slice(-10);
      let replyText = "";
      let apiSuccess = false;

      try {
        // Hạ timeout nội bộ xuống 8s (Cloudflare thường chém ở 10s-15s trên bản free).
        // Nếu API không phản hồi trong 8s, tự động kích hoạt Heuristic Fallback thay vì văng lỗi 524.
        const CHAT_TIMEOUT_MS = 8000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("RottraAI.chat timed out")), CHAT_TIMEOUT_MS),
        );
        const chatPromise = RottraAI.chat({
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
        const res = await Promise.race([chatPromise, timeoutPromise]);
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

      let transactionExecuted = false;
      let transactionDetails = null;

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
            if (
              lastMsgText.toLowerCase().includes(p.name.toLowerCase()) ||
              lastMsgText.toLowerCase().includes(cleanProdName.toLowerCase())
            ) {
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
}
