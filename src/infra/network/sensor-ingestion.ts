/**
 * 🧠 ROTTRA — REAL-TIME SENSOR INTEGRATION
 * MQTT ingestion, WebSocket streaming, time-series aggregation, anomaly detection.
 * Agricultural IoT data pipeline for smart farming.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { sensorData } from "~/infra/database/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────

export interface SensorReading {
  id: string;
  farmId: string;
  cropSeasonId?: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  recordedAt: Date;
  metadata?: Record<string, any>;
}

export type SensorType =
  | "temperature"
  | "humidity"
  | "soil_moisture"
  | "soil_ph"
  | "light_intensity"
  | "wind_speed"
  | "rainfall"
  | "co2_level"
  | "leaf_wetness"
  | "electrical_conductivity";

export interface SensorConfig {
  farmId: string;
  sensorType: SensorType;
  minThreshold: number;
  maxThreshold: number;
  alertOnAnomaly: boolean;
}

export interface AnomalyResult {
  sensorType: SensorType;
  value: number;
  expectedRange: [number, number];
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: Date;
}

export interface TimeSeriesBucket {
  timestamp: Date;
  avg: number;
  min: number;
  max: number;
  count: number;
}

// ── Sensor Registry ───────────────────────────────────────────

const SENSOR_UNITS: Record<SensorType, string> = {
  temperature: "°C",
  humidity: "%",
  soil_moisture: "%",
  soil_ph: "pH",
  light_intensity: "lux",
  wind_speed: "m/s",
  rainfall: "mm",
  co2_level: "ppm",
  leaf_wetness: "%",
  electrical_conductivity: "mS/cm",
};

const SENSOR_THRESHOLDS: Record<SensorType, [number, number]> = {
  temperature: [-10, 50],
  humidity: [0, 100],
  soil_moisture: [0, 100],
  soil_ph: [3.0, 10.0],
  light_intensity: [0, 120000],
  wind_speed: [0, 60],
  rainfall: [0, 200],
  co2_level: [300, 2000],
  leaf_wetness: [0, 100],
  electrical_conductivity: [0, 8],
};

// ── Sensor Ingestion Engine ───────────────────────────────────

export class SensorIngestionEngine {
  private static instance: SensorIngestionEngine;
  private wsClients: Map<string, (data: SensorReading) => void> = new Map();
  private mqttBuffer: SensorReading[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private anomalyCallbacks: ((anomaly: AnomalyResult) => void)[] = [];

  private constructor() {}

  static getInstance(): SensorIngestionEngine {
    if (!SensorIngestionEngine.instance) {
      SensorIngestionEngine.instance = new SensorIngestionEngine();
    }
    return SensorIngestionEngine.instance;
  }

  /**
   * Start the sensor ingestion engine
   */
  start(): void {
    // Flush MQTT buffer to DB every 5 seconds
    this.flushInterval = setInterval(() => this.flushBuffer(), 5000);
    console.log("[SENSOR] Ingestion engine started (flush interval: 5s)");
  }

  /**
   * Stop the ingestion engine
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.wsClients.clear();
    this.mqttBuffer = [];
    console.log("[SENSOR] Ingestion engine stopped");
  }

  /**
   * Ingest a sensor reading (from MQTT or WebSocket)
   */
  async ingestReading(reading: Omit<SensorReading, "id" | "recordedAt">): Promise<SensorReading> {
    const fullReading: SensorReading = {
      ...reading,
      id: randomUUID(),
      recordedAt: new Date(),
    };

    // Validate
    const validation = this.validateReading(fullReading);
    if (!validation.valid) {
      throw new Error(`Invalid reading: ${validation.error}`);
    }

    // Check for anomalies
    const anomaly = await this.checkAnomaly(fullReading);
    if (anomaly) {
      for (const cb of this.anomalyCallbacks) {
        try {
          cb(anomaly);
        } catch (err) {
          console.error("[SENSOR] Anomaly callback error:", err);
        }
      }
    }

    // Add to buffer for batch DB write
    this.mqttBuffer.push(fullReading);

    // Broadcast to WebSocket clients
    this.broadcastToClients(fullReading);

    return fullReading;
  }

  /**
   * Validate a sensor reading
   */
  private validateReading(reading: SensorReading): { valid: boolean; error?: string } {
    const [min, max] = SENSOR_THRESHOLDS[reading.sensorType] || [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    if (reading.value < min || reading.value > max) {
      return { valid: false, error: `Value ${reading.value} out of range [${min}, ${max}] for ${reading.sensorType}` };
    }
    if (!reading.farmId) {
      return { valid: false, error: "farmId is required" };
    }
    return { valid: true };
  }

  /**
   * Check if a reading is an anomaly
   */
  private async checkAnomaly(reading: SensorReading): Promise<AnomalyResult | null> {
    const [min, max] = SENSOR_THRESHOLDS[reading.sensorType] || [0, 0];
    const rangeSize = max - min;
    const lowBound = min + rangeSize * 0.1;
    const highBound = max - rangeSize * 0.1;

    // Simple threshold-based anomaly detection
    if (reading.value < lowBound || reading.value > highBound) {
      const isCritical = reading.value < min + rangeSize * 0.05 || reading.value > max - rangeSize * 0.05;
      const isHigh = reading.value < lowBound - rangeSize * 0.05 || reading.value > highBound + rangeSize * 0.05;

      return {
        sensorType: reading.sensorType,
        value: reading.value,
        expectedRange: [lowBound, highBound],
        severity: isCritical ? "critical" : isHigh ? "high" : "medium",
        description: this.getAnomalyDescription(reading),
        timestamp: reading.recordedAt,
      };
    }

    return null;
  }

  /**
   * Get human-readable anomaly description
   */
  private getAnomalyDescription(reading: SensorReading): string {
    const descriptions: Record<SensorType, string> = {
      temperature: reading.value > 40 ? "Nhiệt độ cực cao, nguy hiểm cho cây trồng" : "Nhiệt độ thấp, nguy cơ đóng băng",
      humidity: reading.value > 90 ? "Độ ẩm không khí quá cao, dễ phát sinh nấm bệnh" : "Độ ẩm quá thấp, cây khô héo",
      soil_moisture: reading.value < 20 ? "Đất khô nghiêm trọng, cần tưới ngay" : "Đất quá ướt, nguy cơ ngập úng",
      soil_ph: reading.value < 5.0 ? "Đất quá chua, cần bón vôi" : "Đất quá kiềm, cần cải tạo",
      light_intensity: reading.value > 100000 ? "Ánh sáng quá mạnh, cần che phủ" : "Thiếu ánh sáng, ảnh hưởng quang hợp",
      wind_speed: reading.value > 30 ? "Gió mạnh, nguy cơ đổ gãy cây" : "Gió bình thường",
      rainfall: reading.value > 100 ? "Mưa lớn, nguy cơ ngập úng" : "Mưa bình thường",
      co2_level: reading.value > 1500 ? "CO2 cao, cần thông gió" : "CO2 thấp",
      leaf_wetness: reading.value > 80 ? "Lá ướt kéo dài, dễ nhiễm nấm" : "Lá khô bình thường",
      electrical_conductivity: reading.value > 5 ? "Độ dẫn điện cao, cây có thể bị ngộ độc muối" : "Độ dẫn điện bình thường",
    };
    return descriptions[reading.sensorType] || `Giá trị bất thường: ${reading.value} ${SENSOR_UNITS[reading.sensorType]}`;
  }

  /**
   * Flush MQTT buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.mqttBuffer.length === 0) return;

    const batch = this.mqttBuffer.splice(0, this.mqttBuffer.length);
    try {
      await db.insert(sensorData).values(
        batch.map((r) => ({
          id: r.id,
          farmId: r.farmId,
          cropSeasonId: r.cropSeasonId || null,
          sensorType: r.sensorType,
          value: r.value,
          unit: SENSOR_UNITS[r.sensorType] || "",
          recordedAt: r.recordedAt.toISOString(),
        })),
      );
      console.log(`[SENSOR] Flushed ${batch.length} readings to DB`);
    } catch (err) {
      console.error("[SENSOR] Flush failed:", err);
      // Re-add failed readings to buffer for retry
      this.mqttBuffer.unshift(...batch);
    }
  }

  /**
   * Broadcast reading to WebSocket clients
   */
  private broadcastToClients(reading: SensorReading): void {
    for (const [clientId, callback] of this.wsClients) {
      try {
        callback(reading);
      } catch (err) {
        console.error(`[SENSOR] Broadcast to ${clientId} failed:`, err);
        this.wsClients.delete(clientId);
      }
    }
  }

  /**
   * Register a WebSocket client for real-time updates
   */
  registerClient(clientId: string, callback: (data: SensorReading) => void): void {
    this.wsClients.set(clientId, callback);
    console.log(`[SENSOR] Client ${clientId} registered for real-time updates`);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.wsClients.delete(clientId);
  }

  /**
   * Register anomaly callback
   */
  onAnomaly(callback: (anomaly: AnomalyResult) => void): void {
    this.anomalyCallbacks.push(callback);
  }
}

// ── Time-Series Aggregation ───────────────────────────────────

export async function aggregateTimeSeries(
  farmId: string,
  sensorType: SensorType,
  startTime: Date,
  endTime: Date,
  bucketMinutes: number = 60,
): Promise<TimeSeriesBucket[]> {
  const intervalMs = bucketMinutes * 60 * 1000;
  const buckets: TimeSeriesBucket[] = [];
  let currentTime = startTime.getTime();

  while (currentTime < endTime.getTime()) {
    const bucketEnd = currentTime + intervalMs;

    const result = await db
      .select({
        avg: sql<number>`AVG(${sensorData.value})`,
        min: sql<number>`MIN(${sensorData.value})`,
        max: sql<number>`MAX(${sensorData.value})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(sensorData)
      .where(
        and(
          eq(sensorData.farmId, farmId),
          eq(sensorData.sensorType, sensorType),
          gte(sensorData.recordedAt, new Date(currentTime).toISOString()),
          lte(sensorData.recordedAt, new Date(bucketEnd).toISOString()),
        ),
      );

    if (result[0] && result[0].count > 0) {
      buckets.push({
        timestamp: new Date(currentTime),
        avg: Number(result[0].avg) || 0,
        min: Number(result[0].min) || 0,
        max: Number(result[0].max) || 0,
        count: Number(result[0].count) || 0,
      });
    }

    currentTime = bucketEnd;
  }

  return buckets;
}

// ── Statistical Anomaly Detection ─────────────────────────────

/**
 * Z-score based anomaly detection using historical data
 */
export async function detectStatisticalAnomalies(
  farmId: string,
  sensorType: SensorType,
  lookbackHours: number = 24,
  zThreshold: number = 3.0,
): Promise<AnomalyResult[]> {
  const startTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Get historical readings
  const historical = await db
    .select({ value: sensorData.value })
    .from(sensorData)
    .where(and(eq(sensorData.farmId, farmId), eq(sensorData.sensorType, sensorType), gte(sensorData.recordedAt, startTime.toISOString())));

  if (historical.length < 10) return []; // Not enough data

  const values = historical.map((r: { value: any }) => Number(r.value));
  const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const variance = values.reduce((sum: number, v: number) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Get recent readings (last 5 minutes)
  const recentStart = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db
    .select({ value: sensorData.value, recorded_at: sensorData.recordedAt })
    .from(sensorData)
    .where(
      and(eq(sensorData.farmId, farmId), eq(sensorData.sensorType, sensorType), gte(sensorData.recordedAt, recentStart.toISOString())),
    );

  const anomalies: AnomalyResult[] = [];
  for (const r of recent) {
    const zScore = Math.abs((Number(r.value) - mean) / stdDev);
    if (zScore > zThreshold) {
      anomalies.push({
        sensorType,
        value: Number(r.value),
        expectedRange: [mean - stdDev * 2, mean + stdDev * 2],
        severity: zScore > 4 ? "critical" : zScore > 3.5 ? "high" : "medium",
        description: `Z-score: ${zScore.toFixed(2)} (value: ${r.value}, mean: ${mean.toFixed(2)}, std: ${stdDev.toFixed(2)})`,
        timestamp: new Date(r.recorded_at || Date.now()),
      });
    }
  }

  return anomalies;
}

// ── Sensor Data Query ─────────────────────────────────────────

export async function getSensorData(
  farmId: string,
  sensorType?: SensorType,
  startTime?: Date,
  endTime?: Date,
  limit: number = 100,
): Promise<SensorReading[]> {
  const conditions = [eq(sensorData.farmId, farmId)];
  if (sensorType) conditions.push(eq(sensorData.sensorType, sensorType));
  if (startTime) conditions.push(gte(sensorData.recordedAt, startTime.toISOString()));
  if (endTime) conditions.push(lte(sensorData.recordedAt, endTime.toISOString()));

  const results = await db
    .select()
    .from(sensorData)
    .where(and(...conditions))
    .orderBy(sql`${sensorData.recordedAt} DESC`)
    .limit(limit);

  return results.map((r: any) => ({
    id: r.id,
    farmId: r.farmId,
    cropSeasonId: r.cropSeasonId || undefined,
    sensorType: r.sensorType as SensorType,
    value: Number(r.value),
    unit: r.unit || "",
    recordedAt: new Date(r.recordedAt || Date.now()),
  }));
}

/**
 * Get sensor summary stats for a farm
 */
export async function getSensorSummary(
  farmId: string,
  lookbackHours: number = 24,
): Promise<Record<SensorType, { avg: number; min: number; max: number; count: number }>> {
  const startTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};

  const results = await db
    .select({
      sensorType: sensorData.sensorType,
      avg: sql<number>`AVG(${sensorData.value})`,
      min: sql<number>`MIN(${sensorData.value})`,
      max: sql<number>`MAX(${sensorData.value})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(sensorData)
    .where(and(eq(sensorData.farmId, farmId), gte(sensorData.recordedAt, startTime.toISOString())))
    .groupBy(sensorData.sensorType);

  for (const r of results) {
    summary[r.sensorType] = {
      avg: Number(r.avg) || 0,
      min: Number(r.min) || 0,
      max: Number(r.max) || 0,
      count: Number(r.count) || 0,
    };
  }

  return summary as Record<SensorType, { avg: number; min: number; max: number; count: number }>;
}

// ── Export Singleton ───────────────────────────────────────────

export const sensorEngine = SensorIngestionEngine.getInstance();
