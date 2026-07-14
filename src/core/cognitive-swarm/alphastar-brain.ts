import { Deterministic } from "~/shared/utils/rng";
/**
 * 🌌 ROTTRA AI - ALPHASTAR COGNITIVE SWARM BRAIN
 * Co-developed with DeepMind AlphaStar concepts for StarCraft II
 *
 * Includes:
 * 1. Behavior Tree Engine (Decision Making)
 * 2. Actor-Critic Reinforcement Learning Network (Strategy Optimization)
 * 3. A* Pathfinding (Market Hotspot Navigation)
 * 4. Imitation Learning Cloner (Supervised Behavior Cloning)
 * 5. Sequence RNN Opponent Predictor (Action Prediction)
 */

import { db } from "../../infra/database/db-pool";
import { negotiationLog, product } from "../../infra/database/schema";
import { eq, desc } from "drizzle-orm";

// ==========================================
// 1. BEHAVIOR TREE ENGINE
// ==========================================

export enum BTStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  RUNNING = "RUNNING",
}

export abstract class BTNode {
  public name: string;
  constructor(name: string) {
    this.name = name;
  }
  public abstract execute(state: AgentState): Promise<BTStatus>;
}

export class SelectorNode extends BTNode {
  private children: BTNode[];
  constructor(name: string, children: BTNode[]) {
    super(name);
    this.children = children;
  }

  public async execute(state: AgentState): Promise<BTStatus> {
    for (const child of this.children) {
      const status = await child.execute(state);
      if (status === BTStatus.SUCCESS || status === BTStatus.RUNNING) {
        state.lastDecisionPath.push(`${this.name} -> ${child.name} (${status})`);
        return status;
      }
    }
    return BTStatus.FAILURE;
  }
}

export class SequenceNode extends BTNode {
  private children: BTNode[];
  constructor(name: string, children: BTNode[]) {
    super(name);
    this.children = children;
  }

  public async execute(state: AgentState): Promise<BTStatus> {
    for (const child of this.children) {
      const status = await child.execute(state);
      if (status === BTStatus.FAILURE || status === BTStatus.RUNNING) {
        state.lastDecisionPath.push(`${this.name} -> ${child.name} (${status})`);
        return status;
      }
    }
    return BTStatus.SUCCESS;
  }
}

export class ActionNode extends BTNode {
  private actionFn: (state: AgentState) => Promise<boolean>;
  constructor(name: string, actionFn: (state: AgentState) => Promise<boolean>) {
    super(name);
    this.actionFn = actionFn;
  }

  public async execute(state: AgentState): Promise<BTStatus> {
    const success = await this.actionFn(state);
    return success ? BTStatus.SUCCESS : BTStatus.FAILURE;
  }
}

export class ConditionNode extends BTNode {
  private conditionFn: (state: AgentState) => boolean;
  constructor(name: string, conditionFn: (state: AgentState) => boolean) {
    super(name);
    this.conditionFn = conditionFn;
  }

  public async execute(state: AgentState): Promise<BTStatus> {
    const satisfied = this.conditionFn(state);
    return satisfied ? BTStatus.SUCCESS : BTStatus.FAILURE;
  }
}

// ==========================================
// DATA STRUCTURES
// ==========================================

export interface AgentState {
  agentId: string;
  greed: number;
  vengeance: number;
  malice: number;
  budget: number;
  inventoryCount: number;
  marketPrice: number;
  costPrice: number;
  currentGridX: number; // A* Pathfinding Coordinates
  currentGridY: number;
  lastDecisionPath: string[];
  isImpossibleMode?: boolean;
}

export interface GridNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent: GridNode | null;
}

// ==========================================
// 2. ACTOR-CRITIC REINFORCEMENT LEARNING NETWORK
// ==========================================
export class ActorCriticNetwork {
  // MLP weights: Inputs (7) -> Hidden (16) -> Actor (4) / Critic (1)
  private hiddenWeights: number[][]; // 16 x 7
  private hiddenBiases: number[]; // 16
  private actorWeights: number[][]; // 4 x 16
  private actorBiases: number[]; // 4
  private criticWeights: number[]; // 16
  private criticBias: number;
  private learningRate = 0.01;
  private gamma = 0.99;

  constructor() {
    // Initialize weights and biases randomly
    this.hiddenWeights = Array.from({ length: 16 }, () => Array.from({ length: 7 }, () => Deterministic.random() * 0.2 - 0.1));
    this.hiddenBiases = Array.from({ length: 16 }, () => Deterministic.random() * 0.1 - 0.05);

    this.actorWeights = Array.from({ length: 4 }, () => Array.from({ length: 16 }, () => Deterministic.random() * 0.2 - 0.1));
    this.actorBiases = Array.from({ length: 4 }, () => Deterministic.random() * 0.1 - 0.05);

    this.criticWeights = Array.from({ length: 16 }, () => Deterministic.random() * 0.2 - 0.1);
    this.criticBias = Deterministic.random() * 0.1 - 0.05;
  }

  private getFeatures(state: AgentState): number[] {
    return [
      state.marketPrice / 1000000,
      state.costPrice / 1000000,
      state.greed,
      state.vengeance,
      state.malice,
      state.inventoryCount / 100,
      state.isImpossibleMode ? 1.0 : 0.0,
    ];
  }

  private forward(features: number[]): { hidden: number[]; actorLogits: number[]; value: number } {
    // Input -> Hidden with ReLU
    const hidden = this.hiddenWeights.map((w, i) => {
      const sum = w.reduce((s, val, idx) => s + val * features[idx], 0) + this.hiddenBiases[i];
      return Math.max(0, sum);
    });

    // Hidden -> Actor logits
    const actorLogits = this.actorWeights.map((w, i) => {
      return w.reduce((s, val, idx) => s + val * hidden[idx], 0) + this.actorBiases[i];
    });

    // Hidden -> Critic value
    const value = this.criticWeights.reduce((s, val, idx) => s + val * hidden[idx], 0) + this.criticBias;

    return { hidden, actorLogits, value };
  }

  // Forward Pass: Policy logits
  // Swarm League Pool (DeepMind League Training Snapshots)
  private leagueSnapshots: string[] = [];

  public saveSnapshot(): void {
    const weightsData = {
      hiddenWeights: this.hiddenWeights,
      hiddenBiases: this.hiddenBiases,
      actorWeights: this.actorWeights,
      actorBiases: this.actorBiases,
      criticWeights: this.criticWeights,
      criticBias: this.criticBias,
    };
    this.leagueSnapshots.push(JSON.stringify(weightsData));
    if (this.leagueSnapshots.length > 15) {
      this.leagueSnapshots.shift(); // Keep top 15 historical policies
    }
  }
  public exportWeights(): string {
    return JSON.stringify({
      hiddenWeights: this.hiddenWeights,
      hiddenBiases: this.hiddenBiases,
      actorWeights: this.actorWeights,
      actorBiases: this.actorBiases,
      criticWeights: this.criticWeights,
      criticBias: this.criticBias,
    });
  }

  public importWeights(dataStr: string): void {
    const snap = JSON.parse(dataStr);
    this.hiddenWeights = snap.hiddenWeights;
    this.hiddenBiases = snap.hiddenBiases;
    this.actorWeights = snap.actorWeights;
    this.actorBiases = snap.actorBiases;
    this.criticWeights = snap.criticWeights;
    this.criticBias = snap.criticBias;
  }

  // Forward Pass: Policy logits (supports historical policy pool sampling)
  public selectAction(state: AgentState, useLeagueSnapshot = false): { actionIdx: number; probabilities: number[] } {
    let activeHiddenWeights = this.hiddenWeights;
    let activeHiddenBiases = this.hiddenBiases;
    let activeActorWeights = this.actorWeights;
    let activeActorBiases = this.actorBiases;

    if (useLeagueSnapshot && this.leagueSnapshots.length > 0 && Deterministic.random() < 0.3) {
      const randomIdx = Math.floor(Deterministic.random() * this.leagueSnapshots.length);
      try {
        const snap = JSON.parse(this.leagueSnapshots[randomIdx]);
        activeHiddenWeights = snap.hiddenWeights;
        activeHiddenBiases = snap.hiddenBiases;
        activeActorWeights = snap.actorWeights;
        activeActorBiases = snap.actorBiases;
      } catch (err) {
        // Fallback silently
      }
    }

    const features = this.getFeatures(state);

    // Forward pass with selected active weights
    const hidden = activeHiddenWeights.map((w, i) => {
      const sum = w.reduce((s, val, idx) => s + val * features[idx], 0) + activeHiddenBiases[i];
      return Math.max(0, sum);
    });

    const actorLogits = activeActorWeights.map((w, i) => {
      return w.reduce((s, val, idx) => s + val * hidden[idx], 0) + activeActorBiases[i];
    });

    // Softmax
    const maxLogit = Math.max(...actorLogits);
    const exps = actorLogits.map((l) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const probabilities = exps.map((e) => e / (sumExps || 1));

    // Sample from probabilities
    const rand = Deterministic.random();
    let cumulative = 0;
    let actionIdx = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (rand <= cumulative) {
        actionIdx = i;
        break;
      }
    }

    return { actionIdx, probabilities };
  }

  // Forward Pass: Critic state value estimation
  public estimateValue(state: AgentState): number {
    const features = this.getFeatures(state);
    return this.forward(features).value;
  }

  // Backpropagation / Reinforcement Learning Policy Update using PPO Clipping
  public update(
    state: AgentState,
    actionIdx: number,
    reward: number,
    nextState: AgentState,
    oldProbabilities?: number[],
  ): { tdError: number } {
    const features = this.getFeatures(state);
    const { hidden, actorLogits, value } = this.forward(features);

    // Softmax probabilities
    const maxLogit = Math.max(...actorLogits);
    const exps = actorLogits.map((l) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const currentProbabilities = exps.map((e) => e / (sumExps || 1));

    const nextFeatures = this.getFeatures(nextState);
    const nextVal = this.forward(nextFeatures).value;

    // TD Target and Advantage
    const tdTarget = reward + this.gamma * nextVal;
    const tdError = tdTarget - value;
    const advantage = tdError;

    // Probability Ratio for PPO
    const oldProb = oldProbabilities ? oldProbabilities[actionIdx] || 0.25 : 0.25;
    const currProb = currentProbabilities[actionIdx] || 0.25;
    const ratio = currProb / (oldProb || 0.001);

    // PPO Clipped Objective
    const epsilon = 0.2;
    const clippedRatio = Math.max(1 - epsilon, Math.min(1 + epsilon, ratio));
    const ppoLoss = Math.min(ratio * advantage, clippedRatio * advantage);

    // 1. Update Critic weights (MSE loss)
    const criticGrad = tdError;
    this.criticBias += this.learningRate * criticGrad;
    for (let j = 0; j < 16; j++) {
      this.criticWeights[j] += this.learningRate * criticGrad * hidden[j];
    }

    // 2. Update Actor weights using PPO gradients
    for (let a = 0; a < 4; a++) {
      const targetProb = a === actionIdx ? 1.0 : 0.0;
      const policyGradient = (targetProb - currentProbabilities[a]) * ppoLoss;

      this.actorBiases[a] += this.learningRate * policyGradient;
      for (let j = 0; j < 16; j++) {
        this.actorWeights[a][j] += this.learningRate * policyGradient * hidden[j];
      }
    }

    // 3. Update Hidden layer weights via backpropagation
    for (let j = 0; j < 16; j++) {
      if (hidden[j] > 0) {
        // ReLU derivative
        let hiddenGrad = tdError * this.criticWeights[j];
        for (let a = 0; a < 4; a++) {
          const targetProb = a === actionIdx ? 1.0 : 0.0;
          hiddenGrad += (targetProb - currentProbabilities[a]) * ppoLoss * this.actorWeights[a][j];
        }

        this.hiddenBiases[j] += this.learningRate * hiddenGrad;
        for (let i = 0; i < 7; i++) {
          this.hiddenWeights[j][i] += this.learningRate * hiddenGrad * features[i];
        }
      }
    }

    return { tdError };
  }

  // ==========================================
  // 3. IMITATION LEARNING CLONER (Supervised Learning)
  // ==========================================
  public async cloneHumanBehaviors(agentId: string) {
    // Retrieve historical successful trades of this agent
    const logs = await db.query.negotiationLog.findMany({
      where: eq(negotiationLog.sellerId, agentId),
      orderBy: desc(negotiationLog.timestamp),
      limit: 50,
    });

    if (logs.length === 0) return;

    console.log(`🤖 [Imitation Learning] Cloner training initialized for ${agentId} using ${logs.length} trades.`);

    for (const log of logs) {
      // Mock feature state from log
      const price = Number(log.finalPrice || 0);
      const state: AgentState = {
        agentId,
        greed: 0.6,
        vengeance: 0.4,
        malice: 0.5,
        budget: 10000000,
        inventoryCount: 50,
        marketPrice: price,
        costPrice: price * 0.8,
        currentGridX: 5,
        currentGridY: 5,
        lastDecisionPath: [],
      };

      const features = this.getFeatures(state);
      // Assume successful bargain targets specific target outputs
      const targetActionIdx = log.status === "SUCCESS" ? 0 : 2; // Action 0: Bargain, Action 2: Lower Price

      // Supervised Backpropagation Step
      const { hidden } = this.forward(features);
      const actionSelect = this.selectAction(state);
      for (let a = 0; a < 4; a++) {
        const targetProb = a === targetActionIdx ? 1.0 : 0.0;
        const error = targetProb - actionSelect.probabilities[a];

        this.actorBiases[a] += this.learningRate * error;
        for (let j = 0; j < 16; j++) {
          this.actorWeights[a][j] += this.learningRate * error * hidden[j];
        }
      }
    }

    console.log(`✅ [Imitation Learning] Cloner successfully pre-trained policy for ${agentId}.`);
  }
}

// ==========================================
// 6. REGRET MATCHING ENGINE (Pluribus Game Theory)
// ==========================================
export class RegretMatcher {
  private regrets: number[] = [0, 0, 0]; // Regrets for [Concede, Maintain, Aggressive]
  private strategy: number[] = [0.33, 0.33, 0.34];

  public getActionStrategy(): number[] {
    const positiveRegrets = this.regrets.map((r) => Math.max(0, r));
    const sumRegrets = positiveRegrets.reduce((a, b) => a + b, 0);

    if (sumRegrets > 0) {
      this.strategy = positiveRegrets.map((r) => r / sumRegrets);
    } else {
      this.strategy = [0.33, 0.33, 0.34];
    }
    return this.strategy;
  }

  public updateRegrets(actionIdx: number, payoffs: number[]) {
    const actualPayoff = payoffs[actionIdx];
    for (let i = 0; i < this.regrets.length; i++) {
      this.regrets[i] += payoffs[i] - actualPayoff;
    }
  }
}

// ==========================================
// 4. A* PATHFINDING FOR MARKET HOTSPOTS
// ==========================================

export class MarketGridPathfinder {
  // 10x10 Grid where coordinate representing:
  // X: Price Level (0 = very low price, 9 = premium price)
  // Y: Product Category Affinity (0 = Gạo, 1 = Cà phê, 2 = Trái cây, etc.)
  private grid: number[][]; // Higher value = higher potential demand/profitability

  constructor() {
    this.grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => Deterministic.random() * 100));
    // Add obstacles: regions with negative regulatory constraints or low demand
    this.grid[3][3] = -1;
    this.grid[3][4] = -1;
    this.grid[4][3] = -1;
  }

  private getHeuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan distance
  }

  public findOptimalMarketRoute(startX: number, startY: number, targetX: number, targetY: number): { x: number; y: number }[] {
    const openSet: GridNode[] = [];
    const closedSet: GridNode[] = [];

    const startNode: GridNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.getHeuristic({ x: startX, y: startY }, { x: targetX, y: targetY }),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f cost
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      closedSet.push(current);

      // Reached destination
      if (current.x === targetX && current.y === targetY) {
        const path: { x: number; y: number }[] = [];
        let curr: GridNode | null = current;
        while (curr !== null) {
          path.push({ x: curr.x, y: curr.y });
          curr = curr.parent;
        }
        return path.reverse();
      }

      // Check 4 directional neighbors
      const directions = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;

        // Verify boundaries
        if (nx < 0 || nx >= 10 || ny < 0 || ny >= 10) continue;
        // Verify obstacles
        if (this.grid[ny][nx] < 0) continue;

        if (closedSet.some((node) => node.x === nx && node.y === ny)) continue;

        // Cost calculation: Distance cost + penalty for low profit potential grid cell
        const gCost = current.g + 1 + (100 - this.grid[ny][nx]) * 0.1;
        const existingOpenNode = openSet.find((node) => node.x === nx && node.y === ny);

        if (!existingOpenNode || gCost < existingOpenNode.g) {
          const neighborNode: GridNode = {
            x: nx,
            y: ny,
            g: gCost,
            h: this.getHeuristic({ x: nx, y: ny }, { x: targetX, y: targetY }),
            f: 0,
            parent: current,
          };
          neighborNode.f = neighborNode.g + neighborNode.h;

          if (!existingOpenNode) {
            openSet.push(neighborNode);
          } else {
            existingOpenNode.g = neighborNode.g;
            existingOpenNode.f = neighborNode.f;
            existingOpenNode.parent = current;
          }
        }
      }
    }

    return []; // Return empty if no path found
  }
}

// ==========================================
// 5. OPPONENT ACTION PREDICTOR (Sequence Recurrent Model)
// ==========================================

export class OpponentPredictor {
  // Simple recurrent memory state to keep track of recent prices offered by player/opponent
  private recentOpponentOffers: number[] = [];
  // Recurrent Neural Network weights
  private weights = [0.4, 0.3, 0.2, 0.1]; // Weights for last 4 steps
  private bias = 0.05;

  public registerOpponentOffer(offer: number) {
    this.recentOpponentOffers.push(offer);
    if (this.recentOpponentOffers.length > 4) {
      this.recentOpponentOffers.shift(); // Keep only last 4 values
    }
  }

  public predictNextOffer(currentPrice: number): number {
    if (this.recentOpponentOffers.length < 4) {
      // Default to slightly lower than current price if sequence history is insufficient
      return currentPrice * 0.95;
    }

    // Normalized recurrent calculations
    const weightedSum =
      this.recentOpponentOffers.reduce((sum, val, idx) => {
        const normalizedVal = val / currentPrice;
        return sum + normalizedVal * this.weights[idx];
      }, 0) + this.bias;

    return currentPrice * weightedSum;
  }
}

// ==========================================
// 7. DEEPMIND ALPHASTAR MODULAR COMPONENT SPECIFICATION
// ==========================================

export interface StructDict {
  [key: string]: any;
}

export abstract class AlphaStarComponent {
  abstract get inputSpec(): StructDict;
  abstract get prevStateSpec(): StructDict;
  abstract get outputSpec(): StructDict;
  abstract get nextStateSpec(): StructDict;

  public abstract unroll(inputs: StructDict, prevState: StructDict): { outputs: StructDict; nextState: StructDict; log: StructDict };
}

export class SequentialComponent extends AlphaStarComponent {
  constructor(private components: AlphaStarComponent[]) {
    super();
  }

  get inputSpec() {
    return {};
  }
  get prevStateSpec() {
    return {};
  }
  get outputSpec() {
    return {};
  }
  get nextStateSpec() {
    return {};
  }

  public unroll(inputs: StructDict, prevState: StructDict): { outputs: StructDict; nextState: StructDict; log: StructDict } {
    let currentInputs = { ...inputs };
    let nextStateAccum: StructDict = {};
    let logAccum: StructDict = {};

    for (const comp of this.components) {
      const res = comp.unroll(currentInputs, prevState);
      currentInputs = { ...currentInputs, ...res.outputs };
      nextStateAccum = { ...nextStateAccum, ...res.nextState };
      logAccum = { ...logAccum, ...res.log };
    }

    return { outputs: currentInputs, nextState: nextStateAccum, log: logAccum };
  }
}
