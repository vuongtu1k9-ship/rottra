/**
 * 🧠 ROTTRA — MARKETPLACE ANALYTICS
 * Price prediction dashboard, supply-demand visualization, farmer performance metrics.
 * Backend analytics engine for the marketplace dashboard.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";

// ── Types ─────────────────────────────────────────────────────

export interface PricePrediction {
  productId: string;
  productName: string;
  currentPrice: number;
  predictedPrice: number;
  trend: "up" | "down" | "stable";
  confidence: number;
  factors: string[];
  timeframe: "1day" | "1week" | "1month";
}

export interface SupplyDemandDataPoint {
  date: string;
  supply: number;
  demand: number;
  price: number;
  surplus: number; // supply - demand
}

export interface FarmerMetrics {
  farmerId: string;
  farmerName: string;
  totalRevenue: number;
  totalOrders: number;
  averageRating: number;
  responseTime: number; // hours
  fulfillmentRate: number; // percentage
  topProducts: { name: string; revenue: number; quantity: number }[];
  monthlyGrowth: number; // percentage
  rank: number;
}

export interface MarketOverview {
  totalProducts: number;
  totalFarmers: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topCategories: { name: string; revenue: number; growth: number }[];
  priceIndices: { product: string; index: number; change: number }[];
}

// ── Price Prediction Engine ───────────────────────────────────

/**
 * Simple exponential smoothing for price prediction
 */
function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Linear regression for trend detection
 */
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0 };

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  let ssRes = 0,
    ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Predict price using exponential smoothing + trend analysis
 */
export function predictPrice(
  productName: string,
  currentPrice: number,
  historicalPrices: number[],
  timeframe: PricePrediction["timeframe"] = "1week",
): PricePrediction {
  const smoothed = exponentialSmoothing(historicalPrices);
  const { slope, r2 } = linearRegression(smoothed);

  const horizonMap = { "1day": 1, "1week": 7, "1month": 30 };
  const horizon = horizonMap[timeframe];

  const predictedPrice = Math.max(0, Math.round(smoothed[smoothed.length - 1] + slope * horizon));
  const trend: PricePrediction["trend"] = slope > 100 ? "up" : slope < -100 ? "down" : "stable";

  const factors: string[] = [];
  if (Math.abs(slope) > 500) factors.push("Strong price trend detected");
  if (r2 > 0.7) factors.push("Historical data shows consistent pattern");
  if (historicalPrices.length > 14) factors.push("Sufficient data for reliable prediction");
  if (factors.length === 0) factors.push("Based on recent price movements");

  return {
    productId: productName,
    productName,
    currentPrice,
    predictedPrice,
    trend,
    confidence: Math.min(0.95, 0.5 + r2 * 0.4),
    factors,
    timeframe,
  };
}

// ── Supply-Demand Visualization Data ──────────────────────────

/**
 * Generate supply-demand data for visualization
 */
export function generateSupplyDemandData(productId: string, days: number = 30): SupplyDemandDataPoint[] {
  const data: SupplyDemandDataPoint[] = [];
  let baseSupply = 500;
  let baseDemand = 450;

  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const seasonalFactor = Math.sin((date.getMonth() / 12) * Math.PI * 2) * 0.15;
    const noise = (Math.random() - 0.5) * 0.1;

    baseSupply = Math.max(100, baseSupply + (Math.random() - 0.48) * 50);
    baseDemand = Math.max(100, baseDemand + (Math.random() - 0.5) * 60);

    const supply = Math.round(baseSupply * (1 + seasonalFactor + noise));
    const demand = Math.round(baseDemand * (1 - seasonalFactor * 0.5 + noise));
    const price = Math.round(40000 + (demand - supply) * 10 + Math.random() * 5000);

    data.push({
      date: date.toISOString().slice(0, 10),
      supply,
      demand,
      price,
      surplus: supply - demand,
    });
  }

  return data;
}

/**
 * Calculate supply-demand balance metrics
 */
export function calculateBalanceMetrics(data: SupplyDemandDataPoint[]): {
  avgSurplus: number;
  volatilityIndex: number;
  equilibriumPrice: number;
  marketState: "oversupply" | "shortage" | "balanced";
} {
  const avgSupply = data.reduce((a, d) => a + d.supply, 0) / data.length;
  const avgDemand = data.reduce((a, d) => a + d.demand, 0) / data.length;
  const avgSurplus = avgSupply - avgDemand;

  const priceStd = Math.sqrt(
    data.reduce((a, d) => a + (d.price - data.reduce((x, y) => x + y.price, 0) / data.length) ** 2, 0) / data.length,
  );

  // Simple equilibrium price estimation
  const equilibriumPrice = Math.round(data.reduce((a, d) => a + d.price, 0) / data.length);

  const marketState = avgSurplus > 50 ? "oversupply" : avgSurplus < -50 ? "shortage" : "balanced";

  return {
    avgSurplus: Math.round(avgSurplus),
    volatilityIndex: Math.round((priceStd / equilibriumPrice) * 100),
    equilibriumPrice,
    marketState,
  };
}

// ── Farmer Performance Metrics ────────────────────────────────

/**
 * Calculate farmer performance metrics
 */
export function calculateFarmerMetrics(
  farmerId: string,
  farmerName: string,
  orders: { revenue: number; rating: number; responseTime: number; fulfilled: boolean; product: string; quantity: number }[],
): FarmerMetrics {
  if (orders.length === 0) {
    return {
      farmerId,
      farmerName,
      totalRevenue: 0,
      totalOrders: 0,
      averageRating: 0,
      responseTime: 0,
      fulfillmentRate: 0,
      topProducts: [],
      monthlyGrowth: 0,
      rank: 0,
    };
  }

  const totalRevenue = orders.reduce((a, o) => a + o.revenue, 0);
  const totalOrders = orders.length;
  const averageRating = orders.reduce((a, o) => a + o.rating, 0) / totalOrders;
  const responseTime = orders.reduce((a, o) => a + o.responseTime, 0) / totalOrders;
  const fulfillmentRate = (orders.filter((o) => o.fulfilled).length / totalOrders) * 100;

  // Group by product for top products
  const productMap: Record<string, { revenue: number; quantity: number }> = {};
  for (const o of orders) {
    if (!productMap[o.product]) productMap[o.product] = { revenue: 0, quantity: 0 };
    productMap[o.product].revenue += o.revenue;
    productMap[o.product].quantity += o.quantity;
  }

  const topProducts = Object.entries(productMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Monthly growth (compare first half vs second half of orders)
  const mid = Math.floor(orders.length / 2);
  const firstHalfRevenue = orders.slice(0, mid).reduce((a, o) => a + o.revenue, 0);
  const secondHalfRevenue = orders.slice(mid).reduce((a, o) => a + o.revenue, 0);
  const monthlyGrowth = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

  return {
    farmerId,
    farmerName,
    totalRevenue,
    totalOrders,
    averageRating: Math.round(averageRating * 10) / 10,
    responseTime: Math.round(responseTime * 10) / 10,
    fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
    topProducts,
    monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
    rank: 0, // Would be calculated across all farmers
  };
}

/**
 * Get market overview
 */
export function getMarketOverview(): MarketOverview {
  return {
    totalProducts: 150,
    totalFarmers: 45,
    totalOrders: 2800,
    totalRevenue: 1250000000,
    avgOrderValue: 446429,
    topCategories: [
      { name: "Cà phê", revenue: 450000000, growth: 12.5 },
      { name: "Gạo", revenue: 320000000, growth: 8.3 },
      { name: "Hạt điều", revenue: 180000000, growth: 15.2 },
      { name: "Tiêu", revenue: 150000000, growth: -3.1 },
      { name: "Trái cây", revenue: 150000000, growth: 22.7 },
    ],
    priceIndices: [
      { product: "Cà phê Robusta", index: 112.5, change: 5.2 },
      { product: "Gạo OM5451", index: 101.3, change: 1.1 },
      { product: "Hạt tiêu đen", index: 95.8, change: -4.2 },
      { product: "Hạt điều", index: 108.7, change: 8.7 },
      { product: "Thanh long", index: 115.3, change: 15.3 },
    ],
  };
}

// ── Hono API Routes ───────────────────────────────────────────

/**
 * Create marketplace analytics API routes
 */
export function createAnalyticsRoutes() {
  const analyticsApp = new Hono();

  // GET /analytics/overview — Market overview
  analyticsApp.get("/overview", (c: any) => {
    return c.json({ success: true, overview: getMarketOverview() });
  });

  // POST /analytics/predict — Price prediction
  analyticsApp.post("/predict", async (c: any) => {
    const body = await c.req.json();
    const prediction = predictPrice(
      body.productName || "Unknown",
      body.currentPrice || 50000,
      body.historicalPrices || [45000, 47000, 48000, 50000, 52000, 51000, 50000],
      body.timeframe || "1week",
    );
    return c.json({ success: true, prediction });
  });

  // GET /analytics/supply-demand — Supply-demand data
  analyticsApp.get("/supply-demand", (c: any) => {
    const productId = c.req.query("productId") || "default";
    const days = parseInt(c.req.query("days") || "30", 10);
    const data = generateSupplyDemandData(productId, days);
    const metrics = calculateBalanceMetrics(data);
    return c.json({ success: true, data, metrics });
  });

  // GET /analytics/farmer — Farmer performance
  analyticsApp.get("/farmer", (c: any) => {
    const farmerId = c.req.query("farmerId") || "unknown";
    const farmerName = c.req.query("farmerName") || "Unknown Farmer";

    // Generate sample orders for demo
    const sampleOrders = Array.from({ length: 20 }, () => ({
      revenue: Math.floor(100000 + Math.random() * 500000),
      rating: 3.5 + Math.random() * 1.5,
      responseTime: 0.5 + Math.random() * 4,
      fulfilled: Math.random() > 0.1,
      product: ["Cà phê", "Gạo", "Tiêu", "Điều"][Math.floor(Math.random() * 4)],
      quantity: Math.floor(10 + Math.random() * 100),
    }));

    const metrics = calculateFarmerMetrics(farmerId, farmerName, sampleOrders);
    return c.json({ success: true, metrics });
  });

  // GET /analytics/prices — All product prices with indices
  analyticsApp.get("/prices", (c: any) => {
    const overview = getMarketOverview();
    return c.json({ success: true, priceIndices: overview.priceIndices });
  });

  return analyticsApp;
}

export const marketplaceAnalytics = {
  predictPrice,
  generateSupplyDemandData,
  calculateBalanceMetrics,
  calculateFarmerMetrics,
  getMarketOverview,
  createAnalyticsRoutes,
};
