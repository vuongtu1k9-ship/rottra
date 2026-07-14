import { Deterministic } from "~/shared/utils/rng";
import { AgentState } from "./alphastar-brain";

export interface MCTSNode {
  action: number;
  visitCount: number;
  totalValue: number;
  prior: number;
  children: Map<number, MCTSNode>;
  hiddenState: number[]; // Latent state representation
}

export class MuZeroPlanner {
  // Simple neural networks weights for Dynamics, Prediction, and Representation
  // Representation: State -> Hidden (8 dimensions)
  private repWeights: number[][]; // 8 x 7 (inputs: marketPrice, costPrice, greed, vengeance, malice, inventory, isImpossible)
  private repBiases: number[]; // 8

  // Dynamics: Hidden (8) + Action (1) -> Next Hidden (8) + Reward (1)
  private dynWeights: number[][]; // 9 x 9
  private dynBiases: number[]; // 9

  // Prediction: Hidden (8) -> Policy (4 actions) + Value (1)
  private predPolicyWeights: number[][]; // 4 x 8
  private predPolicyBiases: number[]; // 4
  private predValueWeights: number[]; // 8
  private predValueBias: number;

  constructor() {
    // Initialize weights randomly
    this.repWeights = Array.from({ length: 8 }, () => Array.from({ length: 7 }, () => Deterministic.random() * 0.2 - 0.1));
    this.repBiases = Array.from({ length: 8 }, () => Deterministic.random() * 0.1 - 0.05);

    this.dynWeights = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => Deterministic.random() * 0.2 - 0.1));
    this.dynBiases = Array.from({ length: 9 }, () => Deterministic.random() * 0.1 - 0.05);

    this.predPolicyWeights = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => Deterministic.random() * 0.2 - 0.1));
    this.predPolicyBiases = Array.from({ length: 4 }, () => Deterministic.random() * 0.1 - 0.05);

    this.predValueWeights = Array.from({ length: 8 }, () => Deterministic.random() * 0.2 - 0.1);
    this.predValueBias = Deterministic.random() * 0.1 - 0.05;
  }

  // 1. Representation: State -> Latent Hidden State
  public representation(state: AgentState): number[] {
    const inputs = [
      state.marketPrice / 1000000,
      state.costPrice / 1000000,
      state.greed,
      state.vengeance,
      state.malice,
      state.inventoryCount / 100,
      state.isImpossibleMode ? 1.0 : 0.0,
    ];
    return this.repWeights.map((w, i) => {
      const sum = w.reduce((s, val, idx) => s + val * inputs[idx], 0) + this.repBiases[i];
      return Math.max(0, sum); // ReLU activation
    });
  }

  // 2. Dynamics: (Hidden State, Action) -> (Next Hidden State, Reward)
  public dynamics(hiddenState: number[], action: number): { nextHiddenState: number[]; reward: number } {
    const inputs = [...hiddenState, action];
    const outputs = this.dynWeights.map((w, i) => {
      const sum = w.reduce((s, val, idx) => s + val * inputs[idx], 0) + this.dynBiases[i];
      return sum;
    });

    const nextHiddenState = outputs.slice(0, 8).map((v) => Math.max(0, v)); // ReLU for next hidden state
    const reward = outputs[8]; // Expected reward
    return { nextHiddenState, reward };
  }

  // 3. Prediction: Hidden State -> (Policy Probabilities, State Value)
  public prediction(hiddenState: number[]): { policy: number[]; value: number } {
    // Policy logits
    const policyLogits = this.predPolicyWeights.map((w, i) => {
      return w.reduce((s, val, idx) => s + val * hiddenState[idx], 0) + this.predPolicyBiases[i];
    });

    // Softmax
    const maxLogit = Math.max(...policyLogits);
    const exps = policyLogits.map((l) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const policy = exps.map((e) => e / (sumExps || 1));

    // Value
    const value = this.predValueWeights.reduce((s, val, idx) => s + val * hiddenState[idx], 0) + this.predValueBias;

    return { policy, value };
  }

  // 4. Monte Carlo Tree Search (MCTS) Planning Loop
  public plan(state: AgentState, iterations = 20): { bestAction: number; visitCounts: number[] } {
    const rootHiddenState = this.representation(state);
    const { policy, value: rootValue } = this.prediction(rootHiddenState);

    const root: MCTSNode = {
      action: -1,
      visitCount: 0,
      totalValue: 0,
      prior: 0,
      children: new Map<number, MCTSNode>(),
      hiddenState: rootHiddenState,
    };

    // Expand root node
    for (let a = 0; a < 4; a++) {
      root.children.set(a, {
        action: a,
        visitCount: 0,
        totalValue: 0,
        prior: policy[a],
        children: new Map<number, MCTSNode>(),
        hiddenState: [],
      });
    }

    for (let iter = 0; iter < iterations; iter++) {
      let node = root;
      const searchPath: MCTSNode[] = [node];

      // 4.1 Selection phase using PUCT (Predictive Upper Confidence trees)
      while (node.children.size > 0) {
        let bestChild: MCTSNode | null = null;
        let bestScore = -Infinity;
        const totalVisits = node.visitCount;

        for (const [action, child] of node.children) {
          // PUCT formula: Q-value + U-value
          const qValue = child.visitCount > 0 ? child.totalValue / child.visitCount : 0;
          const pbC = 1.25; // Exploration constant
          const uValue = child.prior * (Math.sqrt(totalVisits || 1) / (1 + child.visitCount)) * pbC;
          const score = qValue + uValue;

          if (score > bestScore) {
            bestScore = score;
            bestChild = child;
          }
        }

        if (!bestChild) break;
        node = bestChild;
        searchPath.push(node);
      }

      // 4.2 Expansion & Evaluation phase
      const leafNode = searchPath[searchPath.length - 1];
      let leafValue = 0;

      if (leafNode.visitCount === 0 || leafNode.children.size === 0) {
        // Evaluate Dynamics function from parent to leaf
        const parentNode = searchPath[searchPath.length - 2];
        if (parentNode) {
          const { nextHiddenState, reward } = this.dynamics(parentNode.hiddenState, leafNode.action);
          leafNode.hiddenState = nextHiddenState;

          const { policy: leafPolicy, value: leafVal } = this.prediction(nextHiddenState);
          leafValue = leafVal + reward;

          // Expand children
          for (let a = 0; a < 4; a++) {
            leafNode.children.set(a, {
              action: a,
              visitCount: 0,
              totalValue: 0,
              prior: leafPolicy[a],
              children: new Map<number, MCTSNode>(),
              hiddenState: [],
            });
          }
        } else {
          // Fallback to root
          leafValue = rootValue;
        }
      } else {
        leafValue = this.prediction(leafNode.hiddenState).value;
      }

      // 4.3 Backup / Backpropagation phase
      for (const pNode of searchPath) {
        pNode.visitCount++;
        pNode.totalValue += leafValue;
      }
    }

    // Select the best action based on visit counts (most robust action)
    let bestAction = 0;
    let maxVisits = -1;
    const visitCounts = [0, 0, 0, 0];

    for (const [action, child] of root.children) {
      visitCounts[action] = child.visitCount;
      if (child.visitCount > maxVisits) {
        maxVisits = child.visitCount;
        bestAction = action;
      }
    }

    return { bestAction, visitCounts };
  }
}
