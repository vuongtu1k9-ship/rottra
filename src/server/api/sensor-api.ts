/**
 * 🧠 ROTTRA — SENSOR WEBSOCKET INGESTION
 * Real-time sensor data ingestion via WebSocket.
 * Runs on Bun runtime.
 */

import { Hono } from "hono";
import { sensorEngine, type SensorType } from "~/infra/network/sensor-ingestion";

const sensorApi = new Hono();

/**
 * POST /sensors/ingest — Ingest a single sensor reading via HTTP POST
 */
sensorApi.post("/ingest", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || !body.farmId || !body.sensorType || body.value === undefined) {
    return c.json({ success: false, error: "farmId, sensorType, and value are required" }, 400);
  }

  try {
    const reading = await sensorEngine.ingestReading({
      farmId: body.farmId,
      cropSeasonId: body.cropSeasonId,
      sensorType: body.sensorType as SensorType,
      value: Number(body.value),
      unit: body.unit,
      metadata: body.metadata,
    });

    return c.json({ success: true, reading });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * POST /sensors/ingest-batch — Ingest multiple sensor readings
 */
sensorApi.post("/ingest-batch", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || !Array.isArray(body.readings) || body.readings.length === 0) {
    return c.json({ success: false, error: "readings array is required" }, 400);
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const r of body.readings) {
    try {
      const reading = await sensorEngine.ingestReading({
        farmId: r.farmId,
        cropSeasonId: r.cropSeasonId,
        sensorType: r.sensorType as SensorType,
        value: Number(r.value),
        unit: r.unit,
        metadata: r.metadata,
      });
      results.push({ id: reading.id, success: true });
    } catch (err: any) {
      results.push({ id: "unknown", success: false, error: err.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return c.json({ success: true, ingested: successCount, total: results.length, results });
});

/**
 * GET /sensors/data — Query sensor data
 */
sensorApi.get("/data", async (c) => {
  const farmId = c.req.query("farmId");
  const sensorType = c.req.query("sensorType") as SensorType | undefined;
  const limit = parseInt(c.req.query("limit") || "100", 10);

  if (!farmId) {
    return c.json({ success: false, error: "farmId is required" }, 400);
  }

  const { getSensorData } = await import("~/infra/network/sensor-ingestion");
  const data = await getSensorData(farmId, sensorType, undefined, undefined, limit);
  return c.json({ success: true, data });
});

/**
 * GET /sensors/summary — Get sensor summary stats
 */
sensorApi.get("/summary", async (c) => {
  const farmId = c.req.query("farmId");
  const lookbackHours = parseInt(c.req.query("hours") || "24", 10);

  if (!farmId) {
    return c.json({ success: false, error: "farmId is required" }, 400);
  }

  const { getSensorSummary } = await import("~/infra/network/sensor-ingestion");
  const summary = await getSensorSummary(farmId, lookbackHours);
  return c.json({ success: true, summary });
});

/**
 * GET /sensors/anomalies — Run statistical anomaly detection
 */
sensorApi.get("/anomalies", async (c) => {
  const farmId = c.req.query("farmId");
  const sensorType = c.req.query("sensorType") as SensorType | undefined;

  if (!farmId || !sensorType) {
    return c.json({ success: false, error: "farmId and sensorType are required" }, 400);
  }

  const { detectStatisticalAnomalies } = await import("~/infra/network/sensor-ingestion");
  const anomalies = await detectStatisticalAnomalies(farmId, sensorType);
  return c.json({ success: true, anomalies });
});

/**
 * POST /sensors/start — Start the sensor ingestion engine
 */
sensorApi.post("/start", async (c) => {
  sensorEngine.start();
  return c.json({ success: true, message: "Sensor ingestion engine started" });
});

/**
 * POST /sensors/stop — Stop the sensor ingestion engine
 */
sensorApi.post("/stop", async (c) => {
  sensorEngine.stop();
  return c.json({ success: true, message: "Sensor ingestion engine stopped" });
});

export default sensorApi;
