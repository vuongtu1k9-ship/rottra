import { Deterministic, Secure } from "~/shared/utils/rng";
/**
 * Multi-Agent Negotiation Engine
 * Hệ thống đàm phán đaagent cho nông sản
 *
 * Tích hợp Game Theory + Evolutionary Algorithms:
 * - Nash Equilibrium finder cho pricing
 * - PSO-based negotiation strategy optimizer
 * - GWO-based market equilibrium searcher
 * - Auction mechanisms (English, Dutch, Vickrey)
 *
 * Ứng dụng: Tự động đàm phán giá giữa các agents nông sản
 */

import { psoOptimize, type PSOConfig } from "../meta-harness/particle-swarm";
import { gwoOptimize, type GWOConfig } from "../meta-harness/grey-wolf";
import { deOptimize, type DEConfig } from "../meta-harness/differential-evolution";

// ===== TYPES =====

export interface NegotiationAgent {
  id: string;
  name: string;
  role: "buyer" | "seller" | "mediator";
  budget: number;
  minAcceptablePrice: number; // Giá tối thiểu chấp nhận
  maxAcceptablePrice: number; // Giá tối đa chấp nhận
  strategy: NegotiationStrategy;
  reputation: number; // 0-100
  riskTolerance: number; // 0-1
}

export interface NegotiationStrategy {
  type: "aggressive" | "cooperative" | "tit-for-tat" | "adaptive" | "pso-optimized" | "gwo-optimized";
  aggressiveness: number; // 0-1
  concessionRate: number; // Tốc độ nhượng bộ
  patience: number; // Số vòng tối đa
  bluffProbability: number; // Xác suất bluff
}

export interface NegotiationRound {
  round: number;
  offer: NegotiationOffer;
  response: NegotiationResponse;
  timestamp: number;
}

export interface NegotiationOffer {
  agentId: string;
  price: number;
  quantity: number;
  terms: string[];
  message: string;
}

export interface NegotiationResponse {
  agentId: string;
  accepted: boolean;
  counterOffer?: number;
  message: string;
}

export interface NegotiationSession {
  id: string;
  product: string;
  agents: NegotiationAgent[];
  rounds: NegotiationRound[];
  finalPrice?: number;
  finalQuantity?: number;
  status: "pending" | "active" | "completed" | "failed";
  winner?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AuctionConfig {
  type: "english" | "dutch" | "vickrey" | "sealed-bid";
  reservePrice: number;
  minBidIncrement: number;
  maxRounds: number;
  timeLimit?: number; // ms
}

export interface AuctionResult {
  winner: string;
  winningBid: number;
  totalBids: number;
  rounds: number;
  efficiency: number; // price / reservePrice
}

// ===== NASH EQUILIBRIUM FINDER =====

/**
 * Tìm Nash Equilibrium cho 2-player pricing game
 * Dùng Iterated Best Response
 */
export function findNashEquilibrium(payoffMatrix: number[][]): { row: number; col: number; payoff: [number, number] } | null {
  const rows = payoffMatrix.length;
  const cols = payoffMatrix[0].length;

  // Tìm best response cho row player
  const rowBestResponse = new Set<number>();
  for (let col = 0; col < cols; col++) {
    let maxPayoff = -Infinity;
    let bestRow = 0;
    for (let row = 0; row < rows; row++) {
      if (payoffMatrix[row][col] > maxPayoff) {
        maxPayoff = payoffMatrix[row][col];
        bestRow = row;
      }
    }
    rowBestResponse.add(bestRow);
  }

  // Tìm best response cho col player (looking at column payoffs)
  const colBestResponse = new Set<number>();
  for (let row = 0; row < rows; row++) {
    let maxPayoff = -Infinity;
    let bestCol = 0;
    for (let col = 0; col < cols; col++) {
      // Col player wants to maximize their payoff (second element)
      if (payoffMatrix[row][col] > maxPayoff) {
        maxPayoff = payoffMatrix[row][col];
        bestCol = col;
      }
    }
    colBestResponse.add(bestCol);
  }

  // Nash Equilibrium là intersection
  for (const row of rowBestResponse) {
    for (const col of colBestResponse) {
      if (rowBestResponse.has(row) && colBestResponse.has(col)) {
        return {
          row,
          col,
          payoff: [payoffMatrix[row][col], payoffMatrix[row][col]],
        };
      }
    }
  }

  return null;
}

/**
 * Tính toán Mixed Strategy Nash Equilibrium cho 2x2 game
 */
export function mixedStrategyNash(
  payoffA: [number, number][], // [[A_wins, A_loses], [A_loses, A_wins]]
  payoffB: [number, number][],
): { probA: number; probB: number; expectedPayoff: [number, number] } {
  // Player A's mixed strategy
  const p = (payoffB[1][1] - payoffB[0][1]) / (payoffB[0][0] - payoffB[0][1] - payoffB[1][0] + payoffB[1][1]);

  // Player B's mixed strategy
  const q = (payoffA[1][1] - payoffA[1][0]) / (payoffA[0][0] - payoffA[0][1] - payoffA[1][0] + payoffA[1][1]);

  const expectedA = p * q * payoffA[0][0] + p * (1 - q) * payoffA[0][1] + (1 - p) * q * payoffA[1][0] + (1 - p) * (1 - q) * payoffA[1][1];

  const expectedB = p * q * payoffB[0][0] + p * (1 - q) * payoffB[0][1] + (1 - p) * q * payoffB[1][0] + (1 - p) * (1 - q) * payoffB[1][1];

  return {
    probA: Math.max(0, Math.min(1, p)),
    probB: Math.max(0, Math.min(1, q)),
    expectedPayoff: [expectedA, expectedB],
  };
}

// ===== NEGOTIATION STRATEGIES =====

/**
 * Aggressive Strategy: Đòi giá cao, nhượng bộ chậm
 */
function aggressiveStrategy(agent: NegotiationAgent, round: number, opponentLastOffer?: number): number {
  const range = agent.maxAcceptablePrice - agent.minAcceptablePrice;
  const basePrice =
    agent.role === "seller"
      ? agent.maxAcceptablePrice - range * 0.1 * Math.min(round, 5)
      : agent.minAcceptablePrice + range * 0.1 * Math.min(round, 5);

  // Bluff: randomly inflate/deflate
  const bluff = Deterministic.random() < agent.strategy.bluffProbability ? (Deterministic.random() - 0.5) * range * 0.2 : 0;

  return basePrice + bluff;
}

/**
 * Cooperative Strategy: Nhượng bộ nhanh, tìm mutually beneficial
 */
function cooperativeStrategy(agent: NegotiationAgent, round: number, opponentLastOffer?: number): number {
  const range = agent.maxAcceptablePrice - agent.minAcceptablePrice;
  const midPrice = (agent.maxAcceptablePrice + agent.minAcceptablePrice) / 2;

  // Concede towards midpoint
  const concession = Math.min(1, round * agent.strategy.concessionRate);
  return midPrice + (1 - concession) * (agent.role === "seller" ? range * 0.3 : -range * 0.3);
}

/**
 * Tit-for-Tat Strategy: Mirror opponent's behavior
 */
function titForTatStrategy(agent: NegotiationAgent, round: number, opponentLastOffer?: number): number {
  if (round === 1 || !opponentLastOffer) {
    // Start with aggressive offer
    return aggressiveStrategy(agent, round);
  }

  // Mirror opponent's concession
  const range = agent.maxAcceptablePrice - agent.minAcceptablePrice;
  const midPrice = (agent.maxAcceptablePrice + agent.minAcceptablePrice) / 2;

  // If opponent conceded, we concede too
  const concession = agent.strategy.concessionRate * 0.8;
  return midPrice + (1 - concession) * (agent.role === "seller" ? range * 0.2 : -range * 0.2);
}

/**
 * PSO-optimized Strategy: Dùng PSO tìm giá tối ưu
 */
function psoOptimizedStrategy(
  agent: NegotiationAgent,
  round: number,
  opponentLastOffer?: number,
  对手history?: NegotiationRound[],
): number {
  // Define fitness: maximize utility while staying in acceptable range
  const fitnessFn = (x: number[]): number => {
    const price = x[0];

    // Hard constraint: must be in acceptable range
    if (price < agent.minAcceptablePrice || price > agent.maxAcceptablePrice) {
      return -1000;
    }

    // Utility: closer to opponent's last offer = better (if cooperative)
    let utility = 0;
    if (opponentLastOffer) {
      const diff = Math.abs(price - opponentLastOffer);
      utility -= diff * 0.01; // Penalty for distance
    }

    // Bonus for being in sweet spot
    const sweetSpot = agent.role === "seller" ? agent.maxAcceptablePrice * 0.9 : agent.minAcceptablePrice * 1.1;
    utility -= Math.abs(price - sweetSpot) * 0.005;

    // Round-based pressure: concede more as rounds increase
    utility -= round * 0.5;

    return utility;
  };

  const bounds: [number, number][] = [[agent.minAcceptablePrice, agent.maxAcceptablePrice]];

  const config: PSOConfig = {
    dimension: 1,
    swarmSize: 15,
    maxIterations: 20,
    bounds,
  };

  const result = psoOptimize(config, fitnessFn);
  return result.bestSolution[0];
}

function gwoOptimizedStrategy(agent: NegotiationAgent, round: number, opponentLastOffer?: number): number {
  const fitnessFn = (x: number[]): number => {
    const price = x[0];
    if (price < agent.minAcceptablePrice || price > agent.maxAcceptablePrice) return -1000;
    let utility = 0;
    const midPrice = (agent.maxAcceptablePrice + agent.minAcceptablePrice) / 2;
    utility -= Math.abs(price - midPrice) * 0.005;
    if (opponentLastOffer) {
      const diff = Math.abs(price - opponentLastOffer);
      utility -= diff * 0.008;
    }
    const urgency = Math.min(1, round / (agent.strategy.patience || 10));
    utility -= urgency * 1.5;
    if (agent.role === "seller") {
      utility += (price - agent.minAcceptablePrice) * 0.003;
    } else {
      utility += (agent.maxAcceptablePrice - price) * 0.003;
    }
    return utility;
  };
  const bounds: [number, number][] = [[agent.minAcceptablePrice, agent.maxAcceptablePrice]];
  const config: GWOConfig = { dimension: 1, packSize: 12, maxIterations: 15, bounds };
  const result = gwoOptimize(config, fitnessFn);
  return result.bestSolution[0];
}
// ===== NEGOTIATION ENGINE =====

/**
 * Tạo negotiation session mới
 */
export function createNegotiationSession(product: string, buyers: NegotiationAgent[], sellers: NegotiationAgent[]): NegotiationSession {
  return {
    id: `neg_${Date.now()}_${Secure.uuid().slice(2, 8)}`,
    product,
    agents: [...buyers, ...sellers],
    rounds: [],
    status: "pending",
    createdAt: Date.now(),
  };
}

/**
 * Chạy 1 round đàm phán
 */
export function executeNegotiationRound(session: NegotiationSession, round: number): NegotiationRound {
  const buyers = session.agents.filter((a) => a.role === "buyer");
  const sellers = session.agents.filter((a) => a.role === "seller");

  // Buyer提出offer
  const buyer = buyers[0]; // Simplified: first buyer
  const seller = sellers[0]; // Simplified: first seller

  const lastSellerOffer = session.rounds.length > 0 ? session.rounds[session.rounds.length - 1].offer.price : undefined;

  const lastBuyerResponse = session.rounds.length > 0 ? session.rounds[session.rounds.length - 1].response.counterOffer : undefined;

  // Generate buyer's offer
  let buyerPrice: number;
  switch (buyer.strategy.type) {
    case "aggressive":
      buyerPrice = aggressiveStrategy(buyer, round, lastSellerOffer);
      break;
    case "cooperative":
      buyerPrice = cooperativeStrategy(buyer, round, lastSellerOffer);
      break;
    case "tit-for-tat":
      buyerPrice = titForTatStrategy(buyer, round, lastSellerOffer);
      break;
    case "pso-optimized":
      buyerPrice = psoOptimizedStrategy(buyer, round, lastSellerOffer, session.rounds);
      break;
    case "gwo-optimized":
      buyerPrice = gwoOptimizedStrategy(buyer, round, lastSellerOffer);
      break;
    default:
      buyerPrice = cooperativeStrategy(buyer, round, lastSellerOffer);
  }

  const buyerOffer: NegotiationOffer = {
    agentId: buyer.id,
    price: buyerPrice,
    quantity: 100,
    terms: ["payment_on_delivery"],
    message:
      round === 1
        ? `Tôi muốn mua ${session.product} với giá ${buyerPrice.toLocaleString()}đ`
        : `Đề xuất mới: ${buyerPrice.toLocaleString()}đ`,
  };

  // Seller responds
  let sellerResponse: NegotiationResponse;

  if (buyerPrice >= seller.minAcceptablePrice) {
    // Accept
    sellerResponse = {
      agentId: seller.id,
      accepted: true,
      message: `Chấp nhận giá ${buyerPrice.toLocaleString()}đ!`,
    };
  } else if (round >= buyer.strategy.patience) {
    // Timeout - reject
    sellerResponse = {
      agentId: seller.id,
      accepted: false,
      message: "Hết thời gian đàm phán, từ chối.",
    };
  } else {
    // Counter-offer
    let sellerPrice: number;
    switch (seller.strategy.type) {
      case "aggressive":
        sellerPrice = aggressiveStrategy(seller, round, buyerPrice);
        break;
      case "cooperative":
        sellerPrice = cooperativeStrategy(seller, round, buyerPrice);
        break;
      case "pso-optimized":
        sellerPrice = psoOptimizedStrategy(seller, round, buyerPrice, session.rounds);
        break;
      default:
        sellerPrice = cooperativeStrategy(seller, round, buyerPrice);
    }

    sellerResponse = {
      agentId: seller.id,
      accepted: false,
      counterOffer: sellerPrice,
      message: `Giá quá thấp, đề xuất ${sellerPrice.toLocaleString()}đ`,
    };
  }

  const roundData: NegotiationRound = {
    round,
    offer: buyerOffer,
    response: sellerResponse,
    timestamp: Date.now(),
  };

  session.rounds.push(roundData);

  // Check if done
  if (sellerResponse.accepted) {
    session.status = "completed";
    session.finalPrice = buyerPrice;
    session.winner = buyer.id;
    session.completedAt = Date.now();
  } else if (round >= buyer.strategy.patience) {
    session.status = "failed";
    session.completedAt = Date.now();
  } else {
    session.status = "active";
  }

  return roundData;
}

/**
 * Chạy toàn bộ negotiation session
 */
export function runNegotiation(session: NegotiationSession, maxRounds: number = 10): NegotiationSession {
  session.status = "active";

  for (let round = 1; round <= maxRounds; round++) {
    executeNegotiationRound(session, round);

    const currentStatus = session.status as string;
    if (currentStatus === "completed" || currentStatus === "failed") {
      break;
    }
  }

  return session;
}

// ===== AUCTION MECHANISMS =====

/**
 * English Auction: Giá tăng dần, ai trả cao nhất thắng
 */
export function englishAuction(config: AuctionConfig, bidders: NegotiationAgent[]): AuctionResult {
  let currentPrice = config.reservePrice;
  let highestBidder = "";
  let round = 0;
  const bidHistory: { agentId: string; price: number }[] = [];

  while (round < config.maxRounds) {
    round++;
    let bidThisRound = false;

    for (const bidder of bidders) {
      // Bidder decides whether to bid
      const willBid = bidder.budget >= currentPrice + config.minBidIncrement && Deterministic.random() < bidder.strategy.aggressiveness;

      if (willBid) {
        const bid = currentPrice + config.minBidIncrement * (1 + Deterministic.random());
        bidHistory.push({ agentId: bidder.id, price: bid });

        if (bid > currentPrice) {
          currentPrice = bid;
          highestBidder = bidder.id;
          bidThisRound = true;
        }
      }
    }

    if (!bidThisRound) break; // No more bids
  }

  return {
    winner: highestBidder,
    winningBid: currentPrice,
    totalBids: bidHistory.length,
    rounds: round,
    efficiency: currentPrice / config.reservePrice,
  };
}

/**
 * Dutch Auction: Giá giảm dần, ai chấp nhận trước thắng
 */
export function dutchAuction(config: AuctionConfig, bidders: NegotiationAgent[]): AuctionResult {
  let currentPrice = config.reservePrice * 2; // Start high
  const decrement = (currentPrice - config.reservePrice) / config.maxRounds;
  let winner = "";
  let round = 0;

  while (round < config.maxRounds && currentPrice > config.reservePrice) {
    round++;

    for (const bidder of bidders) {
      // Bidder accepts if price is below their valuation
      const valuation = (bidder.minAcceptablePrice + bidder.maxAcceptablePrice) / 2;
      if (currentPrice <= valuation && bidder.budget >= currentPrice) {
        winner = bidder.id;
        break;
      }
    }

    if (winner) break;
    currentPrice -= decrement;
  }

  return {
    winner,
    winningBid: currentPrice,
    totalBids: winner ? 1 : 0,
    rounds: round,
    efficiency: currentPrice / config.reservePrice,
  };
}

/**
 * Vickrey Auction: sealed-bid, highest bidder wins nhưng trả giá thứ hai
 */
export function vickreyAuction(config: AuctionConfig, bidders: NegotiationAgent[]): AuctionResult {
  // Each bidder submits sealed bid
  const bids: { agentId: string; price: number }[] = [];

  for (const bidder of bidders) {
    // Bid their true valuation (dominant strategy in Vickrey)
    const trueValue = (bidder.minAcceptablePrice + bidder.maxAcceptablePrice) / 2;
    const bid = Math.min(trueValue, bidder.budget);
    bids.push({ agentId: bidder.id, price: bid });
  }

  // Sort by bid descending
  bids.sort((a, b) => b.price - a.price);

  const winner = bids[0];
  const secondPrice = bids.length > 1 ? bids[1].price : config.reservePrice;

  return {
    winner: winner?.agentId || "",
    winningBid: secondPrice, // Winner pays second price
    totalBids: bids.length,
    rounds: 1,
    efficiency: secondPrice / config.reservePrice,
  };
}

// ===== MARKET SIMULATION =====

/**
 * Mô phỏng thị trường nông sản với nhiều agents
 */
export function simulateMarket(
  agents: NegotiationAgent[],
  rounds: number = 100,
): {
  priceHistory: number[];
  volumeHistory: number[];
  equilibriumPrice: number;
  giniCoefficient: number;
} {
  const priceHistory: number[] = [];
  const volumeHistory: number[] = [];
  let currentPrice = 50000; // Starting price

  for (let round = 0; round < rounds; round++) {
    // Buyers bid, sellers ask
    const buyers = agents.filter((a) => a.role === "buyer");
    const sellers = agents.filter((a) => a.role === "seller");

    // Calculate aggregate demand/supply
    let totalDemand = 0;
    let totalSupply = 0;

    for (const buyer of buyers) {
      if (currentPrice <= buyer.maxAcceptablePrice) {
        totalDemand += 100; // Each buyer wants 100 units
      }
    }

    for (const seller of sellers) {
      if (currentPrice >= seller.minAcceptablePrice) {
        totalSupply += 100; // Each seller offers 100 units
      }
    }

    // Price adjustment (Walrasian tâtonnement)
    const excess = totalDemand - totalSupply;
    currentPrice *= 1 + excess * 0.001;

    // Add noise
    currentPrice *= 1 + (Deterministic.random() - 0.5) * 0.02;

    // Clamp
    currentPrice = Math.max(10000, Math.min(200000, currentPrice));

    priceHistory.push(currentPrice);
    volumeHistory.push(Math.min(totalDemand, totalSupply));
  }

  // Calculate equilibrium (average of last 20% of prices)
  const stablePrices = priceHistory.slice(-Math.floor(rounds * 0.2));
  const equilibriumPrice = stablePrices.reduce((a, b) => a + b, 0) / stablePrices.length;

  // Calculate Gini coefficient (wealth distribution)
  const wealths = agents.map((a) => a.budget).sort((a, b) => a - b);
  const n = wealths.length;
  const mean = wealths.reduce((a, b) => a + b, 0) / n;
  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      giniSum += Math.abs(wealths[i] - wealths[j]);
    }
  }
  const giniCoefficient = giniSum / (2 * n * n * mean);

  return {
    priceHistory,
    volumeHistory,
    equilibriumPrice,
    giniCoefficient,
  };
}

// ===== DEFAULT AGENTS =====

/**
 * Tạo default agents cho agricultural market
 */
export function createAgriculturalAgents(): NegotiationAgent[] {
  return [
    // Buyers
    {
      id: "buyer_1",
      name: "Chợ Đầu mối Hà Nội",
      role: "buyer",
      budget: 50000000,
      minAcceptablePrice: 30000,
      maxAcceptablePrice: 80000,
      strategy: { type: "cooperative", aggressiveness: 0.4, concessionRate: 0.2, patience: 8, bluffProbability: 0.1 },
      reputation: 85,
      riskTolerance: 0.3,
    },
    {
      id: "buyer_2",
      name: "Siêu thị BigC",
      role: "buyer",
      budget: 100000000,
      minAcceptablePrice: 35000,
      maxAcceptablePrice: 90000,
      strategy: { type: "aggressive", aggressiveness: 0.7, concessionRate: 0.1, patience: 12, bluffProbability: 0.3 },
      reputation: 90,
      riskTolerance: 0.2,
    },
    // Sellers
    {
      id: "seller_1",
      name: "Nông trại Organic Hòa Bình",
      role: "seller",
      budget: 20000000,
      minAcceptablePrice: 40000,
      maxAcceptablePrice: 100000,
      strategy: { type: "cooperative", aggressiveness: 0.3, concessionRate: 0.15, patience: 10, bluffProbability: 0.05 },
      reputation: 88,
      riskTolerance: 0.4,
    },
    {
      id: "seller_2",
      name: "Hợp tác xã Nông nghiệp Sơn La",
      role: "seller",
      budget: 15000000,
      minAcceptablePrice: 35000,
      maxAcceptablePrice: 85000,
      strategy: { type: "tit-for-tat", aggressiveness: 0.5, concessionRate: 0.18, patience: 9, bluffProbability: 0.15 },
      reputation: 82,
      riskTolerance: 0.5,
    },
  ];
}
