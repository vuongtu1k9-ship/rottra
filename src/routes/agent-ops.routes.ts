import crypto from "node:crypto";
import path from "node:path";
import { WebSocket } from "ws";
import { db } from "~/infra/database/db-pool";
import { user, product, order, activity } from "~/infra/database/schema";
import * as dbSchema from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { RottraPrivateBrain } from "~/core/cognitive-swarm/hive-mind";
import { botActionsMap } from "~/core/cognitive-swarm/bot-actions";
import { currentGoldPrice } from "~/server/api/agent-router";
import { generateProductSVG } from "~/server/api/local-media-engine";
import {
  serverAgentBudgets,
  serverAgentGold,
  serverAgentEmployees,
  getDynamicSkillTitle,
  calculateAgentLoanAmount,
  agentLoanParametersMap,
} from "~/shared/constants";
import { auth } from "~/server/auth";
import type { Hono } from "hono";

// --- Local Helpers (extracted from [...paths].ts) ---

const verifyAuth = async (c: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) {
      return c.json({ success: false, reason: "Unauthorized" }, 401);
    }
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

// --- Signaling types ---
interface SignalingClient {
  socket: any;
  room: string;
}
const activeSignalingClients: SignalingClient[] = [];

export function registerAgentOpsRoutes(app: Hono) {
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

      // Pre-fetch all users and products to avoid sequential D1 queries
      const allUsersBefore = await db.query.user.findMany();
      const allProducts = await db.query.product.findMany();
      const dbAgentsBefore = allUsersBefore.filter((u: any) => agentIds.includes(u.id));

      const brainParams = RottraPrivateBrain.getParameters();
      const entropyFactor = Math.sin((brainParams.temp || 45) / 10) * 0.15;
      const baseGoldPrice = 10000000;
      const goldPriceVal = currentGoldPrice ? currentGoldPrice.buy : Math.round(baseGoldPrice * (1 + entropyFactor));

      let prevLeaderId = "toLuong";
      let maxPrevTotalWealth = -Infinity;
      for (const u of dbAgentsBefore) {
        const prof = (u.profile as any) || {};
        const b = Number(prof.budget !== undefined ? prof.budget : serverAgentBudgets[u.id] || 0);
        const g = Number(prof.gold !== undefined ? prof.gold : (serverAgentGold[u.id] ?? 10.0));
        const totalWealth = b + g * goldPriceVal;
        if (totalWealth > maxPrevTotalWealth) {
          maxPrevTotalWealth = totalWealth;
          prevLeaderId = u.id;
        }
      }

      // Process all asset synchronizations in parallel
      const assetSyncPromises = Object.keys(assets).map(async (key) => {
        const asset = assets[key];
        const userId = key.replace(/^bot_/, "");
        const dbUser = allUsersBefore.find((u: any) => u.id === userId);

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
          const dbProduct = allProducts.find(
            (p: any) => p.sellerId === userId && p.name.trim().toLowerCase() === asset.product.trim().toLowerCase(),
          );

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
            const fallbackProd = allProducts.find((p: any) => p.sellerId === userId);
            if (fallbackProd) {
              const svgStr = generateProductSVG(key, asset.product, (fallbackProd.price || 0).toString());
              const matchedImg = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
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
              const svgStr = generateProductSVG(key, asset.product, (asset.price || 10000).toString());
              const matchedImg = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
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
          const fallbackProd = allProducts.find((p: any) => p.sellerId === userId);
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
      });

      await Promise.all(assetSyncPromises);

      if (lastTrade) {
        const { buyerId, sellerId, productName, qty, price, cost } = lastTrade;
        const dbBuyerId = buyerId.replace(/^bot_/, "");
        const dbSellerId = sellerId.replace(/^bot_/, "");

        // 1. Create a real Order in the database
        const orderId = crypto.randomUUID();
        const dbProduct = allProducts.find(
          (p: any) => p.sellerId === dbSellerId && p.name.trim().toLowerCase() === productName.trim().toLowerCase(),
        );
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

        // Ghi nhật ký kinh nghiệm cho Buyer và Seller (background)
        updateAgentJournal(dbBuyerId, {
          type: "strategy",
          title: `Chiến lược thu mua: ${productName}`,
          content: `Thu mua ${qty} đơn vị ${productName} từ đối tác với giá trị ${cost.toLocaleString()}đ để mở rộng kinh doanh.`,
        }).catch(() => {});
        updateAgentJournal(dbBuyerId, {
          type: "prediction",
          title: `Dự báo nhu cầu ${productName.split(" ")[0]}`,
          content: `Dự kiến nhu cầu đối với ${productName} sẽ tăng 15% trong tuần tới, giúp tối ưu hóa giá trị sản phẩm.`,
        }).catch(() => {});

        updateAgentJournal(dbSellerId, {
          type: "calculation",
          title: `Doanh thu phân phối: ${productName}`,
          content: `Bán thành công ${qty} đơn vị ${productName} cho ${dbBuyerId.replace(/^user_?/, "")}, mang lại doanh thu ${cost.toLocaleString()}đ.`,
        }).catch(() => {});
      }

      // Kiểm tra xem vị trí quản lý có thay đổi không sau khi sync
      const allUsersAfter = await db.query.user.findMany();
      const dbAgentsAfter = allUsersAfter.filter((u: any) => agentIds.includes(u.id));

      let newLeaderId = "toLuong";
      let maxNewTotalWealth = -Infinity;
      for (const u of dbAgentsAfter) {
        const prof = (u.profile as any) || {};
        const b = Number(prof.budget ?? 0);
        const g = Number(prof.gold ?? 0);
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
          const enriched = getEnrichedProfileInMemory(u, finalProducts);
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

  app.all("/agent/cron-tick", async (c: any) => {
    try {
      const secret = c.req.query("secret") || (await c.req.json().catch(() => ({}))).secret;

      const getSecret = (ctx: any) => {
        if (ctx.env && ctx.env.CRON_SECRET) return ctx.env.CRON_SECRET;
        if (ctx.env && ctx.env.BETTER_AUTH_SECRET) return ctx.env.BETTER_AUTH_SECRET;
        if (typeof process !== "undefined" && process.env) {
          if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
          if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
        }
        return "super_secret_rontra_key_2026_safe";
      };

      const expectedSecret = getSecret(c);
      if (secret !== expectedSecret) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
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

      const logs: string[] = [];

      // --- STEP 1: Random Bot Product Action ---
      const randomBotId = agentIds[Math.floor(Math.random() * agentIds.length)];
      const actions = ["add", "edit", "delete", "image", "video"];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      const userId = await resolveAgentUserId(randomBotId);
      const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });

      if (dbUser) {
        const executor = botActionsMap.get(randomAction);
        if (executor) {
          const helpers = {
            logActivity: async (uid: string, act: string, msg: string, lvl: string) => {
              await logActivity(uid, act, msg, lvl, "Cron Simulator");
            },
            getProductImageUrl: (media: any[], prefixType: "http" | "file") => {
              return getProductImageUrl(media, prefixType);
            },
            getPreciseImageForProduct: async (productName: string, category: string) => {
              return getPreciseImageForProduct(productName, category);
            },
          };

          try {
            let result = await executor.execute(userId, randomBotId, helpers);
            if (!result.success && randomAction !== "add") {
              const addExecutor = botActionsMap.get("add");
              if (addExecutor) {
                result = await addExecutor.execute(userId, randomBotId, helpers);
              }
            }
            logs.push(`Bot Action: ${randomBotId} - ${randomAction} -> ${JSON.stringify(result)}`);

            const wsMsg = {
              type: "chat",
              id: `sys-${Date.now()}`,
              senderId: "system",
              senderName: "Hệ thống",
              text: `📢 [Hành động Bot] ${dbUser.name} vừa thực hiện hành động ${randomAction.toUpperCase()} (Tự động 24h).`,
              timestamp: new Date().toISOString(),
            };
            activeSignalingClients.forEach((peer) => {
              if (peer.socket.readyState === 1) {
                try {
                  peer.socket.send(JSON.stringify(wsMsg));
                } catch (_) {}
              }
            });
          } catch (e: any) {
            logs.push(`Bot Action Error for ${randomBotId}: ${e.message}`);
          }
        }
      }

      // --- STEP 2: Random Sabotage ---
      if (Math.random() < 0.35) {
        const attackerId = agentIds[Math.floor(Math.random() * agentIds.length)];
        let victimId = agentIds[Math.floor(Math.random() * agentIds.length)];
        while (victimId === attackerId) {
          victimId = agentIds[Math.floor(Math.random() * agentIds.length)];
        }

        const dbAttackerId = await resolveAgentUserId(attackerId);
        const dbVictimId = await resolveAgentUserId(victimId);

        const attacker = await db.query.user.findFirst({ where: eq(user.id, dbAttackerId) });
        const victim = await db.query.user.findFirst({ where: eq(user.id, dbVictimId) });

        if (attacker && victim) {
          const attackerProfile = (attacker.profile as any) || {};
          const victimProfile = (victim.profile as any) || {};

          const sabotageTypes = ["rumor", "poach", "snitch", "underhand"];
          const chosenType = sabotageTypes[Math.floor(Math.random() * sabotageTypes.length)];

          let attackerMessage = "";
          let victimMessage = "";
          let publicAnnouncement = "";

          if (chosenType === "rumor") {
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
            const victimOrigBudget = Number(victimProfile.budget);
            const victimBase = Number.isFinite(victimOrigBudget) ? victimOrigBudget : (serverAgentBudgets[victim.id] ?? 0);
            const newVictimBudget = Math.max(0, victimBase - 3000000);
            victimProfile.budget = newVictimBudget;
            await db.update(user).set({ profile: victimProfile }).where(eq(user.id, dbVictimId));

            attackerMessage = `Báo cáo sai phạm của ${victim.name} lên Trưởng Ban Quản Lý thành công.`;
            victimMessage = `Bị tố cáo sai phạm thương mại vô căn cứ và bị Trưởng Ban Quản Lý phạt trừ 3,000,000đ.`;
            publicAnnouncement = `🚨 Đóng gói sai quy cách thế kia mà cũng đòi làm ăn sao ${victim.name}? Ta đã báo cáo sai phạm của ngươi lên Ban Quản Lý rồi!`;
          } else {
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

          logs.push(`Sabotage Event: ${attackerId} attacked ${victimId} using ${chosenType}`);

          const wsSabotageMsg = {
            type: "chat",
            id: `sys-sab-${Date.now()}`,
            senderId: "system",
            senderName: "Hệ thống",
            text: `🚨 [Cạnh tranh] ${attacker.name} vừa chọn hình thức hãm hại '${chosenType}' đối với ${victim.name}! Thông điệp: "${publicAnnouncement}"`,
            timestamp: new Date().toISOString(),
          };

          activeSignalingClients.forEach((peer) => {
            if (peer.socket.readyState === 1) {
              try {
                peer.socket.send(JSON.stringify(wsSabotageMsg));
              } catch (_) {}
            }
          });
        }
      }

      return c.json({ success: true, logs });
    } catch (err: any) {
      console.error("Cron Tick Error:", err);
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  app.post("/users/add-journal", verifyAuth, async (c: any) => {
    try {
      const body = await c.req.json();
      const { userId, type, content } = body;
      if (!userId || !content) {
        return c.json({ success: false, message: "Thiếu thông tin" }, 400);
      }

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
}
