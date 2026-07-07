import { db } from "~/infra/database/db-pool";
import { activity } from "~/infra/database/schema";
import { auth } from "~/server/auth";
import crypto from "node:crypto";

// Helper phân tích thiết bị từ User-Agent
const parseDevice = (userAgent?: string) => {
  if (!userAgent) return "Không xác định";
  const ua = userAgent.toLowerCase();
  if (ua.includes("tablet") || ua.includes("ipad")) return "Máy tính bảng (Tablet)";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Điện thoại (Mobile)";
  return "Máy tính (PC/Laptop)";
};

// Telemetry & MITM Auto-Logger Middleware
export const telemetryLogger = async (c: any, next: any) => {
  const method = c.req.method;
  const path = c.req.path;
  const startTime = performance.now();
  const userAgent = c.req.header("user-agent") || "Unknown";

  // Cho phép request tiếp tục xử lý
  await next();

  // Đo lường độ trễ phản hồi (Latency)
  const latencyMs = Math.round(performance.now() - startTime);
  const status = c.res.status;

  // Chỉ tự động ghi nhận vết cho các thao tác thay đổi dữ liệu nhạy cảm hoặc truy vấn chính của Agent.
  // Loại bỏ các API tự động/polling/meeting simulation tần suất cao gây rác bảng Activity (SQL junk).
  const isAutomatedOrPolling =
    path.includes("/agent/unload") ||
    path.includes("/agent/trigger-bot-action") ||
    path.includes("/agent/sabotage") ||
    path.includes("/agent/toolkit-report") ||
    path.includes("/agent/assets") ||
    path.includes("/agent/sync-assets") ||
    path.includes("/agent/generate-drawing") ||
    path.includes("/agent/generate-local-image") ||
    path.includes("/agent/meeting-chat") ||
    path.includes("/agent/system-profile");

  const shouldLog =
    (["POST", "PUT", "DELETE"].includes(method) || path.includes("/agent") || path.includes("/ledger")) && !isAutomatedOrPolling;

  if (shouldLog) {
    try {
      // Nhận diện người dùng đang kích hoạt yêu cầu
      let userId: string | null = null;
      let userEmail = "Ẩn danh (Guest)";

      const session = await auth.api
        .getSession({
          headers: c.req.raw.headers,
        })
        .catch(() => null);

      if (session && session.user) {
        userId = session.user.id;
        userEmail = session.user.email;
      }

      // Xây dựng thông điệp telemetry chi tiết
      const message = `API [${method}] ${path} - Trạng thái: ${status} | Độ trễ: ${latencyMs}ms | Kích hoạt bởi: ${userEmail}`;
      const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
      const device = parseDevice(userAgent);

      // Thêm log vào cơ sở dữ liệu
      await db.insert(activity).values({
        id: crypto.randomUUID(),
        userId: userId,
        action: `${method} ${path}`,
        message: message,
        level: level,
        device: device,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("❌ Telemetry Auto-Logger Error:", err);
    }
  }
};
