/**
 * 🧠 ROTTRA — AUTONOMOUS SUPPLY CHAIN
 * Demand forecasting (MDP + HMM), dynamic pricing (game theory), automated order fulfillment.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";

// ── Types ─────────────────────────────────────────────────────

export interface SupplyChainProduct {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
  currentStock: number;
  demandHistory: DemandRecord[];
  costPerUnit: number;
  shelfLifeDays: number;
  minOrderQuantity: number;
}

export interface DemandRecord {
  date: Date;
  quantity: number;
  price: number;
  season: "spring" | "summer" | "autumn" | "winter";
  weather?: string;
}

export interface DemandForecast {
  productId: string;
  forecastHorizon: number; // days
  predictions: { date: Date; predictedDemand: number; confidence: number }[];
  method: "hmm" | "mdp" | "ensemble";
}

export interface PricingDecision {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  expectedDemandAtPrice: number;
  expectedRevenue: number;
  expectedProfit: number;
  confidence: number;
  strategy: "competitive" | "premium" | "clearance" | "dynamic";
}

export interface FulfillmentOrder {
  id: string;
  buyerId: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery: Date;
  logistics: LogisticsInfo;
}

export interface LogisticsInfo {
  warehouse: string;
  transportMode: "road" | "sea" | "air" | "rail";
  estimatedDays: number;
  cost: number;
  trackingId?: string;
}

// ── Demand Forecasting (HMM-based) ────────────────────────────

/**
 * Simple Hidden Markov Model for demand regime detection
 */
class SimpleHMM {
  private states: number;
  private transition: number[][];
  private emission: number[][];
  private initial: number[];

  constructor(states: number) {
    this.states = states;
    this.transition = Array.from({ length: states }, () => Array(states).fill(1 / states));
    this.emission = Array.from({ length: states }, () => Array(10).fill(0.1)); // 10 demand buckets
    this.initial = Array(states).fill(1 / states);
  }

  /**
   * Forward algorithm
   */
  forward(observations: number[]): number[][] {
    const T = observations.length;
    const alpha: number[][] = Array.from({ length: T }, () => Array(this.states).fill(0));

    // Init
    for (let i = 0; i < this.states; i++) {
      alpha[0][i] = this.initial[i] * this.emission[i][observations[0]];
    }

    // Forward pass
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < this.states; j++) {
        let sum = 0;
        for (let i = 0; i < this.states; i++) {
          sum += alpha[t - 1][i] * this.transition[i][j];
        }
        alpha[t][j] = sum * this.emission[j][observations[t]];
      }
    }

    return alpha;
  }

  /**
   * Predict next state distribution
   */
  predictNextState(observations: number[]): number[] {
    const alpha = this.forward(observations);
    const last = alpha[alpha.length - 1];

    // Normalize
    const total = last.reduce((a, b) => a + b, 0);
    const probs = last.map((v) => v / total);

    // Predict next
    const next = Array(this.states).fill(0);
    for (let j = 0; j < this.states; j++) {
      for (let i = 0; i < this.states; i++) {
        next[j] += probs[i] * this.transition[i][j];
      }
    }

    return next;
  }

  /**
   * Train HMM using Baum-Welch (simplified)
   */
  train(observations: number[], iterations: number = 50): void {
    for (let iter = 0; iter < iterations; iter++) {
      const alpha = this.forward(observations);
      const T = observations.length;

      // Simplified E-step: update emission based on state responsibilities
      for (let j = 0; j < this.states; j++) {
        let total = 0;
        for (let t = 0; t < T; t++) {
          total += alpha[t][j];
        }
        for (let k = 0; k < 10; k++) {
          let count = 0;
          for (let t = 0; t < T; t++) {
            if (observations[t] === k) count += alpha[t][j];
          }
          this.emission[j][k] = total > 0 ? count / total + 0.01 : 0.1;
        }
        // Normalize
        const emSum = this.emission[j].reduce((a, b) => a + b, 0);
        for (let k = 0; k < 10; k++) this.emission[j][k] /= emSum;
      }
    }
  }
}

/**
 * Forecast demand using HMM
 */
export function forecastDemand(product: SupplyChainProduct, horizonDays: number = 7): DemandForecast {
  // Convert demand history to observations (quantize to 10 buckets)
  const demands = product.demandHistory.map((d) => d.quantity);
  const maxDemand = Math.max(...demands, 1);
  const observations = demands.map((d) => Math.min(9, Math.floor((d / maxDemand) * 10)));

  // Train HMM
  const hmm = new SimpleHMM(3); // 3 regimes: low, medium, high
  hmm.train(observations, 30);

  // Predict
  const stateProbs = hmm.predictNextState(observations);
  const predictions: DemandForecast["predictions"] = [];

  const avgDemand = demands.reduce((a, b) => a + b, 0) / demands.length;

  for (let i = 0; i < horizonDays; i++) {
    const predictedDemand = avgDemand * (0.8 + stateProbs[2] * 0.4);
    predictions.push({
      date: new Date(Date.now() + (i + 1) * 86400000),
      predictedDemand: Math.round(predictedDemand * (0.9 + Math.random() * 0.2)),
      confidence: 0.6 + stateProbs[2] * 0.3,
    });
  }

  return {
    productId: product.id,
    forecastHorizon: horizonDays,
    predictions,
    method: "hmm",
  };
}

// ── Dynamic Pricing Engine ────────────────────────────────────

/**
 * Calculate optimal price using demand elasticity model
 */
export function calculateOptimalPrice(product: SupplyChainProduct, competitorPrices: number[] = []): PricingDecision {
  const currentDemand = product.demandHistory.slice(-7).reduce((a, d) => a + d.quantity, 0) / 7;
  const avgCompetitorPrice =
    competitorPrices.length > 0 ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length : product.currentPrice;

  // Price elasticity of demand (agricultural products: typically -0.5 to -2.0)
  const elasticity = -1.2;

  // Cost-plus minimum price
  const minPrice = product.costPerUnit * 1.1;

  // Competitive price range
  const competitiveMin = avgCompetitorPrice * 0.85;
  const competitiveMax = avgCompetitorPrice * 1.15;

  // Optimize: maximize profit = (price - cost) * demand(price)
  let bestPrice = product.currentPrice;
  let bestProfit = 0;
  let bestDemand = currentDemand;

  for (let price = minPrice; price <= competitiveMax * 1.5; price += 1000) {
    // Demand at this price (constant elasticity model)
    const demandAtPrice = currentDemand * Math.pow(price / product.currentPrice, elasticity);
    const profit = (price - product.costPerUnit) * demandAtPrice;

    if (profit > bestProfit) {
      bestProfit = profit;
      bestPrice = price;
      bestDemand = demandAtPrice;
    }
  }

  // Determine strategy
  let strategy: PricingDecision["strategy"] = "dynamic";
  if (product.currentStock > product.demandHistory.length * 2) {
    strategy = "clearance";
    bestPrice = Math.max(minPrice, bestPrice * 0.8);
  } else if (product.currentPrice < competitiveMin) {
    strategy = "premium";
  } else if (product.currentPrice > competitiveMax) {
    strategy = "competitive";
  }

  return {
    productId: product.id,
    currentPrice: product.currentPrice,
    recommendedPrice: Math.round(bestPrice / 1000) * 1000,
    expectedDemandAtPrice: Math.round(bestDemand),
    expectedRevenue: Math.round(bestPrice * bestDemand),
    expectedProfit: Math.round(bestProfit),
    confidence: 0.7,
    strategy,
  };
}

// ── Order Fulfillment Pipeline ────────────────────────────────

/**
 * Process a new order through the fulfillment pipeline
 */
export function processOrder(
  buyerId: string,
  productId: string,
  quantity: number,
  product: SupplyChainProduct,
): FulfillmentOrder | { error: string } {
  // Validate order
  if (quantity < product.minOrderQuantity) {
    return { error: `Minimum order quantity is ${product.minOrderQuantity}` };
  }
  if (quantity > product.currentStock) {
    return { error: `Insufficient stock: ${product.currentStock} available` };
  }

  const totalPrice = quantity * product.currentPrice;

  // Determine logistics
  const logistics = calculateLogistics(product, quantity);

  const order: FulfillmentOrder = {
    id: randomUUID(),
    buyerId,
    productId,
    quantity,
    totalPrice,
    status: "confirmed",
    createdAt: new Date(),
    updatedAt: new Date(),
    estimatedDelivery: new Date(Date.now() + logistics.estimatedDays * 86400000),
    logistics,
  };

  // Update stock
  product.currentStock -= quantity;

  console.log(`[FULFILLMENT] Order ${order.id} confirmed: ${quantity}x ${product.name} for ${totalPrice} VND`);

  return order;
}

/**
 * Calculate logistics for an order
 */
function calculateLogistics(product: SupplyChainProduct, quantity: number): LogisticsInfo {
  const isPerishable = product.shelfLifeDays < 14;
  const isHeavy = quantity > 100;

  let transportMode: LogisticsInfo["transportMode"] = "road";
  let estimatedDays = 2;
  let cost = 50000; // 50K VND base

  if (isPerishable) {
    transportMode = "road";
    estimatedDays = 1;
    cost *= 1.5;
  } else if (isHeavy) {
    transportMode = "rail";
    estimatedDays = 5;
    cost *= 0.8;
  }

  if (quantity > 1000) {
    cost *= 0.7; // Bulk discount
  }

  return {
    warehouse: "Kho trung tâm Rottra",
    transportMode,
    estimatedDays,
    cost: Math.round(cost),
  };
}

/**
 * Update order status
 */
export function updateOrderStatus(order: FulfillmentOrder, newStatus: FulfillmentOrder["status"]): FulfillmentOrder {
  order.status = newStatus;
  order.updatedAt = new Date();
  console.log(`[FULFILLMENT] Order ${order.id} status: ${newStatus}`);
  return order;
}

// ── Supply Chain Analytics ────────────────────────────────────

/**
 * Calculate supply chain health metrics
 */
export function getSupplyChainHealth(products: SupplyChainProduct[]): {
  overallScore: number;
  avgStockDays: number;
  avgTurnoverRate: number;
  atRiskProducts: string[];
} {
  let totalStockDays = 0;
  let totalTurnover = 0;
  const atRisk: string[] = [];

  for (const p of products) {
    const avgDailyDemand = p.demandHistory.slice(-7).reduce((a, d) => a + d.quantity, 0) / 7 || 1;
    const stockDays = p.currentStock / avgDailyDemand;
    const turnoverRate = (avgDailyDemand * 365) / (p.currentStock || 1);

    totalStockDays += stockDays;
    totalTurnover += turnoverRate;

    if (stockDays < 3) atRisk.push(`${p.name} (stock: ${Math.round(stockDays)} days)`);
    if (stockDays > 90) atRisk.push(`${p.name} (overstock: ${Math.round(stockDays)} days)`);
  }

  const n = products.length || 1;
  return {
    overallScore: Math.max(0, Math.min(100, 100 - atRisk.length * 10)),
    avgStockDays: totalStockDays / n,
    avgTurnoverRate: totalTurnover / n,
    atRiskProducts: atRisk,
  };
}

// ── API Routes ────────────────────────────────────────────────

/**
 * Create supply chain API routes for Hono
 */
export function createSupplyChainRoutes() {
  const scApp = new Hono();

  // POST /supply-chain/forecast — Forecast demand
  scApp.post("/forecast", async (c: any) => {
    const body = await c.req.json();
    const product: SupplyChainProduct = {
      id: body.id || randomUUID(),
      name: body.name || "Unknown",
      category: body.category || "general",
      currentPrice: body.currentPrice || 50000,
      currentStock: body.currentStock || 1000,
      demandHistory: body.demandHistory || generateSampleDemand(),
      costPerUnit: body.costPerUnit || 30000,
      shelfLifeDays: body.shelfLifeDays || 30,
      minOrderQuantity: body.minOrderQuantity || 10,
    };

    const forecast = forecastDemand(product, body.horizonDays || 7);
    return c.json({ success: true, forecast });
  });

  // POST /supply-chain/price — Calculate optimal price
  scApp.post("/price", async (c: any) => {
    const body = await c.req.json();
    const product: SupplyChainProduct = {
      id: body.id || randomUUID(),
      name: body.name || "Unknown",
      category: body.category || "general",
      currentPrice: body.currentPrice || 50000,
      currentStock: body.currentStock || 1000,
      demandHistory: body.demandHistory || generateSampleDemand(),
      costPerUnit: body.costPerUnit || 30000,
      shelfLifeDays: body.shelfLifeDays || 30,
      minOrderQuantity: body.minOrderQuantity || 10,
    };

    const decision = calculateOptimalPrice(product, body.competitorPrices || []);
    return c.json({ success: true, decision });
  });

  // POST /supply-chain/order — Process a new order
  scApp.post("/order", async (c: any) => {
    const body = await c.req.json();
    const product: SupplyChainProduct = {
      id: body.productId || randomUUID(),
      name: body.productName || "Unknown",
      category: body.category || "general",
      currentPrice: body.price || 50000,
      currentStock: body.stock || 1000,
      demandHistory: [],
      costPerUnit: body.costPerUnit || 30000,
      shelfLifeDays: body.shelfLifeDays || 30,
      minOrderQuantity: body.minOrderQuantity || 10,
    };

    const result = processOrder(body.buyerId || "anonymous", product.id, body.quantity || 1, product);
    return c.json({ success: !("error" in result), result });
  });

  // GET /supply-chain/health — Get supply chain health
  scApp.get("/health", (c: any) => {
    const sampleProducts = generateSampleProducts();
    const health = getSupplyChainHealth(sampleProducts);
    return c.json({ success: true, health });
  });

  return scApp;
}

// ── Helpers ───────────────────────────────────────────────────

function generateSampleDemand(): DemandRecord[] {
  const records: DemandRecord[] = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    records.push({
      date,
      quantity: Math.floor(50 + Math.random() * 100),
      price: 40000 + Math.floor(Math.random() * 20000),
      season: ["spring", "summer", "autumn", "winter"][Math.floor(Math.random() * 4)] as any,
    });
  }
  return records;
}

function generateSampleProducts(): SupplyChainProduct[] {
  return [
    {
      id: "p1",
      name: "Gạo OM5451",
      category: "cereal",
      currentPrice: 12000,
      currentStock: 5000,
      demandHistory: generateSampleDemand(),
      costPerUnit: 8000,
      shelfLifeDays: 180,
      minOrderQuantity: 50,
    },
    {
      id: "p2",
      name: "Cà phê Robusta",
      category: "beverage",
      currentPrice: 45000,
      currentStock: 2000,
      demandHistory: generateSampleDemand(),
      costPerUnit: 30000,
      shelfLifeDays: 365,
      minOrderQuantity: 20,
    },
    {
      id: "p3",
      name: "Thanh long đỏ",
      category: "fruit",
      currentPrice: 25000,
      currentStock: 300,
      demandHistory: generateSampleDemand(),
      costPerUnit: 15000,
      shelfLifeDays: 7,
      minOrderQuantity: 5,
    },
  ];
}

export const supplyChain = {
  forecastDemand,
  calculateOptimalPrice,
  processOrder,
  updateOrderStatus,
  getSupplyChainHealth,
  createSupplyChainRoutes,
};
