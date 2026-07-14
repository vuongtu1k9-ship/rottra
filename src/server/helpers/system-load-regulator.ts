import { createLogger } from "~/shared/logger";
import { Context, Next } from "hono";
import { db } from "~/infra/database/db-pool";
import { systemSetting } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { fuzzyMatchCache } from "./product-search";
import { productSearchCache, imageGenerationCache } from "~/core/neural-memory/zero-alloc-lru";

const log = createLogger("helpers/system-load-regulator");

export type LoadState = "LOW_TRAFFIC" | "HIGH_TRAFFIC";

class LoadRegulator {
  private requestCount = 0;
  private currentMode: LoadState = "LOW_TRAFFIC";
  private checkInterval: any;
  private maxRequestsPerSecThreshold = 35; // Ngưỡng requests/s kích hoạt tăng tốc
  private memoryThresholdBytes = 1.2 * 1024 * 1024 * 1024; // 1.2 GB RSS RAM

  constructor() {
    this.startMonitoring();
  }

  // Middleware ghi nhận lượng truy cập
  public getMiddleware() {
    return async (c: Context, next: Next) => {
      this.requestCount++;
      await next();
    };
  }

  public getCurrentMode(): LoadState {
    return this.currentMode;
  }

  // Bắt đầu quét định kỳ mỗi 10 giây
  private startMonitoring() {
    if (typeof process === "undefined") return;
    const isCloudflare = typeof (globalThis as any).caches !== "undefined" && typeof (globalThis as any).WebSocketPair !== "undefined";
    if (isCloudflare) return;

    this.checkInterval = setInterval(async () => {
      let autoBoostEnabled = false;
      try {
        const settings = await db.query.systemSetting.findFirst({
          where: eq(systemSetting.id, "global"),
        });
        autoBoostEnabled = settings?.autoBoost ?? false;
      } catch (err) {
        // Fallback
      }

      if (!autoBoostEnabled) {
        if (this.currentMode === "HIGH_TRAFFIC") {
          log.info("[Load Regulator] Chế độ autoBoost bị tắt. Khôi phục về LOW_TRAFFIC.");
          this.currentMode = "LOW_TRAFFIC";
          this.restoreTtls();
        }
        this.requestCount = 0;
        return;
      }

      const reqPerSec = this.requestCount / 10;
      this.requestCount = 0;

      const memoryUsage = process.memoryUsage();
      const rss = memoryUsage.rss;

      const isHighRequest = reqPerSec > this.maxRequestsPerSecThreshold;
      const isHighMemory = rss > this.memoryThresholdBytes;

      const previousMode = this.currentMode;

      if (isHighRequest || isHighMemory) {
        this.currentMode = "HIGH_TRAFFIC";
      } else {
        this.currentMode = "LOW_TRAFFIC";
      }

      if (this.currentMode === "HIGH_TRAFFIC") {
        const ramMb = (rss / 1024 / 1024).toFixed(2);
        log.warn(`[Load Regulator] CẢNH BÁO CAO TẢI: Kích hoạt HIGH_TRAFFIC! (Req/s: ${reqPerSec}, RSS: ${ramMb} MB).`);

        // 1. Tối ưu hóa TTL của Cache: Kéo dài thời gian sống của cache lên gấp 5 lần để hạn chế truy vấn DB
        this.boostTtls();

        // 2. Dọn dẹp sạch bộ nhớ đệm hiện có
        this.evictCaches();

        // 3. Gọi Garbage Collector (nếu có cờ --expose-gc)
        if (global && typeof (global as any).gc === "function") {
          try {
            (global as any).gc();
            log.info("[Load Regulator] Đã gọi Garbage Collector để dọn dẹp RAM.");
          } catch (e) {
            // bypass
          }
        }
      } else if (previousMode === "HIGH_TRAFFIC" && this.currentMode === "LOW_TRAFFIC") {
        log.info("[Load Regulator] Hệ thống ổn định trở lại. Quay về LOW_TRAFFIC.");
        this.restoreTtls();
      }
    }, 10000);
  }

  private boostTtls() {
    try {
      // Tăng TTL từ 600s lên 3000s
      (fuzzyMatchCache as any).setTtlMs(3000 * 1000);
      // Tăng TTL từ 180s lên 900s
      (productSearchCache as any).setTtlMs(900 * 1000);
      log.info("[Load Regulator] Đã tăng TTL của cache gấp 5 lần.");
    } catch (_err) {
      /* non-critical */
    }
  }

  private restoreTtls() {
    try {
      (fuzzyMatchCache as any).setTtlMs(600 * 1000);
      (productSearchCache as any).setTtlMs(180 * 1000);
      log.info("[Load Regulator] Đã khôi phục TTL cache về mặc định.");
    } catch (_err) {
      /* non-critical */
    }
  }

  private evictCaches() {
    try {
      fuzzyMatchCache.clear();
      productSearchCache.clear();
      imageGenerationCache.clear();
      log.info("[Load Regulator] Đã dọn dẹp sạch các Cache Maps để giải phóng bộ nhớ.");
    } catch (err: any) {
      log.error("[Load Regulator] Lỗi dọn dẹp cache:", err.message);
    }
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const systemLoadRegulator = new LoadRegulator();
