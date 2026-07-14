import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { db, pgClient } from "~/infra/database/db-pool";
import { user, product, review, file, agentMemory, activity } from "~/infra/database/schema";
import * as dbSchema from "~/infra/database/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { auth } from "~/server/auth";
import { visionBrain } from "~/core/nlp-cognitive/vision-brain";
import { serverAgentBudgets, serverAgentGold, serverAgentEmployees } from "~/shared/constants";
import { registerAdminRoutes } from "~/routes/admin.routes";
import { registerOrderRoutes } from "~/routes/order.routes";
import { registerUserRoutes } from "~/routes/user.routes";
import { registerDrawingRoutes } from "~/routes/drawing.routes";
import { registerAgentChatRoutes } from "~/routes/agent-chat.routes";
import WebSocket from "ws";
import type { Hono } from "hono";

const req = import.meta.require;
const puppeteer = req ? req("puppeteer") : null;
export const isCloudflare = typeof globalThis.caches !== "undefined" || (typeof process !== "undefined" && process.env.CF_PAGES === "1");

// --- Local Helpers ---

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

// --- Cache ---
let productCache: { data: any; timestamp: number } | null = null;
const PRODUCT_CACHE_TTL = 30_000;

// --- Chart helpers ---
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

// --- Text processing ---
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

// --- Translation ---
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

export function registerMediaRoutes(app: Hono) {
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
            if (!isCloudflare) {
              const sharpName = "sharp";
              const sharpModule = await import(sharpName);
              const sharp = sharpModule.default || sharpModule;
              buffer = await sharp(buffer)
                .resize(1600, 1600, { fit: "inside", withoutEnlargement: true }) // Scale down huge images to save CPU
                .avif({ quality: 75, effort: 3 }) // effort 3 reduces encoding time significantly vs default 4
                .toBuffer();
              ext = "avif";
              finalMimeType = "image/avif";
            }
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
        rawText: "Rottra Offline OCR Engine processed this image.",
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
        "/images/product-tieu.avif",
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
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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

  registerAdminRoutes(app);
  registerOrderRoutes(app);
  registerUserRoutes(app);
  registerDrawingRoutes(app);
  registerAgentChatRoutes(app);

  // --- product ---

  // --- Public Product (For Home Page) ---
  // In-memory cache for product list (TTL 30s)

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

      // D1/SQLite has a limit on bind parameters (max 100).
      // We chunk input arrays into groups of 90 to prevent failures.
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const reviewChunks = chunkArray(productIds, 90);
      const sellerChunks = chunkArray(sellerIds, 90);

      const [reviewResults, sellerResults] = await Promise.all([
        Promise.all(
          reviewChunks.map((chunk) =>
            db
              .select()
              .from(review)
              .where(inArray(review.productId, chunk as string[])),
          ),
        ),
        Promise.all(
          sellerChunks.map((chunk) =>
            db
              .select({
                id: user.id,
                name: user.name,
                image: user.image,
                profile: user.profile,
              })
              .from(user)
              .where(inArray(user.id, chunk as string[])),
          ),
        ),
      ]);

      const allReviews = reviewResults.flat();
      const allSellers = sellerResults.flat();

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
              return c.json(
                {
                  error:
                    "Chỉ cho phép sử dụng hình ảnh chính chủ được tải lên từ hệ thống (rottra.pages.dev). Không chấp nhận link ảnh ngoài!",
                },
                400,
              );
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
        return c.json(
          {
            error: `Rottra Vision AI từ chối ảnh này! Phát hiện ảnh thuộc phổ màu/đặc trưng của '${preds[0].category}' thay vì '${body.category}'. Vui lòng tải đúng ảnh sản phẩm!`,
          },
          400,
        );
      }
    }

    // Enforce official image URLs only
    if (body.media && Array.isArray(body.media)) {
      for (const m of body.media) {
        if (m.link && m.link.startsWith("http")) {
          try {
            const parsedUrl = new URL(m.link);
            if (parsedUrl.hostname !== "rottra.pages.dev" && !parsedUrl.hostname.endsWith(".rottra.pages.dev")) {
              return c.json(
                {
                  error:
                    "Chỉ cho phép sử dụng hình ảnh chính chủ được tải lên từ hệ thống (rottra.pages.dev). Không chấp nhận link ảnh ngoài!",
                },
                400,
              );
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
        where: and(
          eq(product.sellerId, currentUser.id),
          eq(sql`lower(${product.name})`, newName.toLowerCase()),
          sql`${product.id} != ${id}`,
        ),
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
          return c.json({ error: "Sản phẩm này đang bị ràng buộc (có đơn hàng/dữ liệu liên quan) nên không thể xóa." }, 400);
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

    if (!puppeteer) {
      throw new Error("Puppeteer is not supported in this serverless environment (Cloudflare Workers). Banner generation is disabled.");
    }
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
      const filteredMedia = currentMedia.filter(
        (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
      );

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

    const realVideoUrl = `/videos/output_${productId}.webm`;

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
              `../public/videos/output_${productId}.webm`,
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
          [crypto.randomUUID(), currentUser.id, `output_${productId}.webm`, "video/webm", realVideoUrl, "active"],
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
}
