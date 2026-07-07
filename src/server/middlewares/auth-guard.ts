import { db } from "~/infra/database/db-pool";
import { user } from "~/infra/database/schema";
import { auth } from "~/server/auth";
import { eq } from "drizzle-orm";

/**
 * AI Auth Middleware
 * Xác thực và phân quyền cho toàn bộ các endpoints liên quan tới AI & Agent
 */
export const aiAuthMiddleware = async (c: any, next: any) => {
  const path = c.req.path;

  // Bỏ qua các API phục vụ webhook, sinh ảnh hoặc giả lập chạy ngầm của bot, và cấu hình public
  const isPublicOrAutomated =
    path.includes("/webhook-changedetection") ||
    path.includes("/generate-local-image") ||
    path.includes("/meeting-chat") ||
    path.includes("/trigger-bot-action") ||
    path.includes("/sabotage") ||
    path.includes("/sync-assets") ||
    path.includes("/completed-trades") ||
    path.includes("/generate-drawing") ||
    path.includes("/hybrid-retrieve") ||
    path.includes("/rerank") ||
    path.includes("/heartbeat-tick") ||
    path.includes("/cron-tick") ||
    (path.includes("/system-profile") && c.req.method === "GET");

  if (isPublicOrAutomated) {
    return await next();
  }

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    // Đối với cổng chat chung (/agent/chat) hoặc chuyên gia (/chat-expert), cho phép khách truy cập nhưng không có quyền admin/user
    const isGeneralChatOrExpert = path.endsWith("/agent/chat") || path.includes("/chat-expert");

    if (!session) {
      if (isGeneralChatOrExpert) {
        c.set("user", null);
        return await next();
      }
      return c.json(
        {
          success: false,
          reply: "Dạ chào bạn, phiên làm việc chưa được xác thực. Vui lòng đăng nhập tài khoản để làm việc cùng AI Rottra nhé!",
          text: "⚠️ Vui lòng đăng nhập để sử dụng tính năng này.",
        },
        401,
      );
    }

    // Lấy thông tin user từ database để lấy quyền (role) chính xác nhất
    const dbUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
    });

    if (!dbUser) {
      if (isGeneralChatOrExpert) {
        c.set("user", null);
        return await next();
      }
      return c.json(
        {
          success: false,
          reply: "Không tìm thấy thông tin tài khoản người dùng tương ứng trong CSDL.",
        },
        404,
      );
    }

    if (dbUser.profile && (dbUser.profile as any).banned) {
      return c.json(
        {
          success: false,
          reply: "Tài khoản của bạn hiện đang bị khóa trên hệ thống Rottra.",
        },
        403,
      );
    }

    // Lưu thông tin user vào context để sử dụng ở hạ nguồn
    c.set("user", dbUser);
    const userRole = dbUser.role || "guest";

    // Phân quyền Quản trị viên (Admin) cho các thao tác quản trị AI nhạy cảm
    const isAdminOnlyRoute =
      path.includes("/unload") ||
      path.includes("/brain/parameters") ||
      path.includes("/scrape") ||
      path.includes("/comprehension-benchmark") ||
      path.includes("/system-profile");

    if (isAdminOnlyRoute && userRole !== "admin") {
      return c.json(
        {
          success: false,
          reply: "Dạ thưa Sếp, thao tác quản trị AI này yêu cầu tài khoản quyền Quản trị viên (Admin) ạ!",
          text: "⚠️ Quyền truy cập bị từ chối. Chỉ Quản trị viên mới được thực hiện thao tác này.",
        },
        403,
      );
    }

    await next();
  } catch (err: any) {
    console.error("❌ AI Auth Middleware Error:", err);
    return c.json(
      {
        success: false,
        reply: "Lỗi hệ thống kiểm soát và xác thực AI: " + err.message,
      },
      500,
    );
  }
};

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const ipBuckets = new Map<string, Bucket>();
const RATE_LIMIT_CAPACITY = 5;
const REFILL_RATE_MS = 10000;

// Authenticated user rate limit: 20 requests per minute
const userBuckets = new Map<string, Bucket>();
const USER_RATE_LIMIT_CAPACITY = 20;
const USER_REFILL_RATE_MS = 3000;

// Sliding window for AI endpoints
const aiWindowMap = new Map<string, { count: number; resetAt: number }>();
const AI_LIMIT_PER_MINUTE = 30;

export const guestRateLimiter = async (c: any, next: any) => {
  const path = c.req.path;
  const isGeneralChatOrExpert = path.endsWith("/agent/chat") || path.includes("/chat-expert");

  if (!isGeneralChatOrExpert) {
    return await next();
  }

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    // Authenticated user rate limiting
    if (session) {
      const userId = session.user?.id || "unknown";
      const now = Date.now();

      let bucket = userBuckets.get(userId);
      if (!bucket) {
        bucket = { tokens: USER_RATE_LIMIT_CAPACITY, lastRefill: now };
        userBuckets.set(userId, bucket);
      } else {
        const elapsed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(elapsed / USER_REFILL_RATE_MS);
        if (tokensToAdd > 0) {
          bucket.tokens = Math.min(USER_RATE_LIMIT_CAPACITY, bucket.tokens + tokensToAdd);
          bucket.lastRefill = now - (elapsed % USER_REFILL_RATE_MS);
        }
      }

      if (bucket.tokens < 1) {
        return c.json(
          {
            success: false,
            reply: "Bạn đang gửi quá nhiều tin nhắn. Vui lòng đợi vài giây rồi thử lại.",
            text: "⚠️ Rate limit exceeded. Please wait a moment.",
          },
          429,
        );
      }
      bucket.tokens -= 1;
      return await next();
    }

    // Guest: sliding window rate limiting
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown-ip";
    const now = Date.now();

    let bucket = ipBuckets.get(ip);
    if (!bucket) {
      bucket = { tokens: RATE_LIMIT_CAPACITY, lastRefill: now };
      ipBuckets.set(ip, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = Math.floor(elapsed / REFILL_RATE_MS);
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now - (elapsed % REFILL_RATE_MS);
      }
    }

    if (bucket.tokens < 1) {
      return c.json(
        {
          success: false,
          reply: "Dạ xin lỗi bạn, hệ thống AI đang nhận được quá nhiều yêu cầu từ thiết bị của bạn. Vui lòng đợi một lát rồi thử lại nhé!",
          text: "⚠️ Bạn đã vượt quá giới hạn yêu cầu (Rate Limit). Vui lòng thử lại sau.",
        },
        429,
      );
    }

    bucket.tokens -= 1;
    await next();
  } catch (err: any) {
    console.error("❌ Rate Limiter Error:", err);
    await next();
  }
};
