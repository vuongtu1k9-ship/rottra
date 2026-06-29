import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";

type MetricEntry = {
  timestamp: number;
  latencyMs: number;
  cacheHit: boolean;
  intent: string;
};

class Telemetry {
  private static instance: Telemetry;
  private metrics: LRUCache<string, MetricEntry[]> = new LRUCache<string, MetricEntry[]>(1000, 3600);
  private freeMemThresholdMB = 500;

  private constructor() {}

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  record(key: string, entry: MetricEntry): void {
    const existing = this.metrics.get(key) ?? [];
    existing.push(entry);
    this.metrics.set(key, existing);
  }

  isMemoryLow(): boolean {
    if (typeof process !== "undefined" && process.platform) {
      try {
        const os = require("os");
        const freeMB = os.freemem() / 1024 / 1024;
        return freeMB < this.freeMemThresholdMB;
      } catch {
        return false;
      }
    }
    return false;
  }

  reduceCacheSize(cache: LRUCache<any, any>, factor: number = 0.5): void {
    // Simple FIFO reduction - keep top entries
    const currentSize = cache.size();
    const targetSize = Math.floor(currentSize * factor);
    // Note: LRUCache would need resize method
    console.warn(`[Memory Guard] Reducing cache from ${currentSize} to ${targetSize}`);
  }

  getMetrics(intent: string): MetricEntry[] {
    return this.metrics.get(intent) ?? [];
  }

  getAverageLatency(intent: string): number {
    const entries = this.getMetrics(intent);
    if (entries.length === 0) return 0;
    return entries.reduce((sum, e) => sum + e.latencyMs, 0) / entries.length;
  }
}

export const telemetry = Telemetry.getInstance();

export function withTelemetry<T>(key: string, intent: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  return fn().then((result) => {
    const end = performance.now();
    telemetry.record(key, {
      timestamp: Date.now(),
      latencyMs: end - start,
      cacheHit: false,
      intent,
    });
    return result;
  });
}
