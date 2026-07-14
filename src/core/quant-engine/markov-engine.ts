import { Deterministic } from "~/shared/utils/rng";
// Rottra Markov Engine — MDP, HMM, MCMC
// Agricultural supply chain optimization, demand forecasting, probability sampling

// ============================================================================
// 1. MARKOV DECISION PROCESS (MDP) — Optimal Decision Making
// ============================================================================

export interface MDPState {
  id: string;
  label: string;
}

export interface MDPAction {
  id: string;
  label: string;
}

export interface MDPTransition {
  from: string;
  action: string;
  to: string;
  probability: number;
  reward: number;
}

export interface MDPConfig {
  discountFactor: number; // γ ∈ [0,1) — how much future rewards matter
  convergenceThreshold: number; // stop when value change < threshold
  maxIterations: number;
}

const DEFAULT_MDP_CONFIG: MDPConfig = {
  discountFactor: 0.95,
  convergenceThreshold: 0.001,
  maxIterations: 1000,
};

export class MarkovDecisionProcess {
  private states: Map<string, MDPState> = new Map();
  private actions: Map<string, MDPAction> = new Map();
  private transitions: MDPTransition[] = [];
  private values: Map<string, number> = new Map();
  private policy: Map<string, string> = new Map();
  private config: MDPConfig;

  constructor(config?: Partial<MDPConfig>) {
    this.config = { ...DEFAULT_MDP_CONFIG, ...config };
  }

  addState(state: MDPState): void {
    this.states.set(state.id, state);
    this.values.set(state.id, 0);
  }

  addAction(action: MDPAction): void {
    this.actions.set(action.id, action);
  }

  addTransition(transition: MDPTransition): void {
    this.transitions.push(transition);
  }

  private getTransitionsFrom(stateId: string, actionId?: string): MDPTransition[] {
    return this.transitions.filter((t) => t.from === stateId && (actionId ? t.action === actionId : true));
  }

  private getActionsFrom(stateId: string): string[] {
    const actions = new Set<string>();
    this.transitions.filter((t) => t.from === stateId).forEach((t) => actions.add(t.action));
    return Array.from(actions);
  }

  // Value Iteration: V(s) = max_a Σ P(s'|s,a) * [R(s,a,s') + γ * V(s')]
  solveValueIteration(): Map<string, number> {
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      const newValues = new Map<string, number>();
      let maxDelta = 0;

      for (const [stateId] of this.states) {
        const actions = this.getActionsFrom(stateId);
        if (actions.length === 0) {
          newValues.set(stateId, this.values.get(stateId) || 0);
          continue;
        }

        let bestValue = -Infinity;
        for (const actionId of actions) {
          const trans = this.getTransitionsFrom(stateId, actionId);
          let actionValue = 0;
          for (const t of trans) {
            const futureValue = this.values.get(t.to) || 0;
            actionValue += t.probability * (t.reward + this.config.discountFactor * futureValue);
          }
          if (actionValue > bestValue) bestValue = actionValue;
        }

        newValues.set(stateId, bestValue);
        maxDelta = Math.max(maxDelta, Math.abs(bestValue - (this.values.get(stateId) || 0)));
      }

      this.values = newValues;
      if (maxDelta < this.config.convergenceThreshold) break;
    }

    return this.values;
  }

  // Extract optimal policy from converged values
  extractPolicy(): Map<string, string> {
    this.policy.clear();
    for (const [stateId] of this.states) {
      const actions = this.getActionsFrom(stateId);
      if (actions.length === 0) continue;

      let bestAction = actions[0];
      let bestValue = -Infinity;

      for (const actionId of actions) {
        const trans = this.getTransitionsFrom(stateId, actionId);
        let actionValue = 0;
        for (const t of trans) {
          const futureValue = this.values.get(t.to) || 0;
          actionValue += t.probability * (t.reward + this.config.discountFactor * futureValue);
        }
        if (actionValue > bestValue) {
          bestValue = actionValue;
          bestAction = actionId;
        }
      }

      this.policy.set(stateId, bestAction);
    }

    return this.policy;
  }

  // Policy Iteration: alternate policy evaluation + improvement
  solvePolicyIteration(): Map<string, string> {
    // Initialize random policy
    for (const [stateId] of this.states) {
      const actions = this.getActionsFrom(stateId);
      if (actions.length > 0) this.policy.set(stateId, actions[0]);
    }

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // Policy Evaluation: solve V^π(s) = Σ P(s'|s,π(s)) * [R + γV(s')]
      for (let evalIter = 0; evalIter < 100; evalIter++) {
        const newValues = new Map<string, number>();
        for (const [stateId] of this.states) {
          const actionId = this.policy.get(stateId);
          if (!actionId) {
            newValues.set(stateId, 0);
            continue;
          }
          const trans = this.getTransitionsFrom(stateId, actionId);
          let value = 0;
          for (const t of trans) {
            value += t.probability * (t.reward + this.config.discountFactor * (this.values.get(t.to) || 0));
          }
          newValues.set(stateId, value);
        }
        this.values = newValues;
      }

      // Policy Improvement
      let policyStable = true;
      for (const [stateId] of this.states) {
        const oldAction = this.policy.get(stateId);
        const actions = this.getActionsFrom(stateId);
        if (actions.length === 0) continue;

        let bestAction = actions[0];
        let bestValue = -Infinity;
        for (const actionId of actions) {
          const trans = this.getTransitionsFrom(stateId, actionId);
          let actionValue = 0;
          for (const t of trans) {
            actionValue += t.probability * (t.reward + this.config.discountFactor * (this.values.get(t.to) || 0));
          }
          if (actionValue > bestValue) {
            bestValue = actionValue;
            bestAction = actionId;
          }
        }

        this.policy.set(stateId, bestAction);
        if (bestAction !== oldAction) policyStable = false;
      }

      if (policyStable) break;
    }

    return this.policy;
  }

  getStateValue(stateId: string): number {
    return this.values.get(stateId) || 0;
  }

  getPolicy(stateId: string): string | undefined {
    return this.policy.get(stateId);
  }
}

// ============================================================================
// 2. HIDDEN MARKOV MODEL (HMM) — Hidden State Inference
// ============================================================================

export interface HMMConfig {
  states: string[];
  observations: string[];
  transitionMatrix: number[][]; // P(state_j | state_i)
  emissionMatrix: number[][]; // P(observation_k | state_i)
  initialProbs: number[]; // π(i) = P(state_i at t=0)
}

export class HiddenMarkovModel {
  private config: HMMConfig;
  private T: number[][]; // transition
  private E: number[][]; // emission
  private pi: number[]; // initial

  constructor(config: HMMConfig) {
    this.config = config;
    this.T = config.transitionMatrix;
    this.E = config.emissionMatrix;
    this.pi = config.initialProbs;
  }

  // Forward Algorithm: compute P(observations | model)
  forward(observations: string[]): number {
    const N = this.config.states.length;
    const obs = observations.map((o) => this.config.observations.indexOf(o));
    if (obs.some((o) => o === -1)) throw new Error("Unknown observation in sequence");

    // alpha[t][i] = P(o_1,...,o_t, state_i at t | model)
    const alpha: number[][] = [];

    // t=0
    alpha[0] = [];
    for (let i = 0; i < N; i++) {
      alpha[0][i] = this.pi[i] * this.E[i][obs[0]];
    }

    // t=1..T-1
    for (let t = 1; t < observations.length; t++) {
      alpha[t] = [];
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let i = 0; i < N; i++) {
          sum += alpha[t - 1][i] * this.T[i][j];
        }
        alpha[t][j] = sum * this.E[j][obs[t]];
      }
    }

    // P(obs | model) = Σ alpha[T-1][i]
    return alpha[observations.length - 1].reduce((a, b) => a + b, 0);
  }

  // Backward Algorithm: β[t][i] = P(o_{t+1},...,o_T | state_i at t)
  backward(observations: string[]): number[][] {
    const N = this.config.states.length;
    const T_len = observations.length;
    const obs = observations.map((o) => this.config.observations.indexOf(o));

    const beta: number[][] = [];

    // t=T-1
    beta[T_len - 1] = [];
    for (let i = 0; i < N; i++) {
      beta[T_len - 1][i] = 1;
    }

    // t=T-2..0
    for (let t = T_len - 2; t >= 0; t--) {
      beta[t] = [];
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++) {
          sum += this.T[i][j] * this.E[j][obs[t + 1]] * beta[t + 1][j];
        }
        beta[t][i] = sum;
      }
    }

    return beta;
  }

  // Viterbi Algorithm: find most likely state sequence
  viterbi(observations: string[]): { states: string[]; probability: number } {
    const N = this.config.states.length;
    const T_len = observations.length;
    const obs = observations.map((o) => this.config.observations.indexOf(o));

    const delta: number[][] = [];
    const psi: number[][] = [];

    // t=0
    delta[0] = [];
    psi[0] = [];
    for (let i = 0; i < N; i++) {
      delta[0][i] = this.pi[i] * this.E[i][obs[0]];
      psi[0][i] = 0;
    }

    // t=1..T-1
    for (let t = 1; t < T_len; t++) {
      delta[t] = [];
      psi[t] = [];
      for (let j = 0; j < N; j++) {
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < N; i++) {
          const val = delta[t - 1][i] * this.T[i][j];
          if (val > maxVal) {
            maxVal = val;
            maxIdx = i;
          }
        }
        delta[t][j] = maxVal * this.E[j][obs[t]];
        psi[t][j] = maxIdx;
      }
    }

    // Backtrack
    const stateSequence: number[] = new Array(T_len);
    let maxFinal = -Infinity;
    for (let i = 0; i < N; i++) {
      if (delta[T_len - 1][i] > maxFinal) {
        maxFinal = delta[T_len - 1][i];
        stateSequence[T_len - 1] = i;
      }
    }

    for (let t = T_len - 2; t >= 0; t--) {
      stateSequence[t] = psi[t + 1][stateSequence[t + 1]];
    }

    return {
      states: stateSequence.map((s) => this.config.states[s]),
      probability: maxFinal,
    };
  }

  // Baum-Welch (EM) for parameter estimation
  baumWelch(observations: string[], maxIter: number = 100): void {
    const N = this.config.states.length;
    const T_len = observations.length;
    const K = this.config.observations.length;
    const obs = observations.map((o) => this.config.observations.indexOf(o));

    for (let iter = 0; iter < maxIter; iter++) {
      // E-step: Forward-Backward
      const alpha = this.forwardRaw(obs);
      const beta = this.backwardRaw(obs);
      const logP = alpha[T_len - 1].reduce((a, b) => a + b, 0);

      // gamma[t][i] = P(state_i at t | obs, model)
      const gamma: number[][] = [];
      for (let t = 0; t < T_len; t++) {
        gamma[t] = [];
        let sum = 0;
        for (let i = 0; i < N; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i];
          sum += gamma[t][i];
        }
        for (let i = 0; i < N; i++) {
          gamma[t][i] = sum > 0 ? gamma[t][i] / sum : 1 / N;
        }
      }

      // xi[t][i][j] = P(state_i at t, state_j at t+1 | obs, model)
      const xi: number[][][] = [];
      for (let t = 0; t < T_len - 1; t++) {
        xi[t] = [];
        let sum = 0;
        for (let i = 0; i < N; i++) {
          xi[t][i] = [];
          for (let j = 0; j < N; j++) {
            xi[t][i][j] = alpha[t][i] * this.T[i][j] * this.E[j][obs[t + 1]] * beta[t + 1][j];
            sum += xi[t][i][j];
          }
        }
        if (sum > 0) {
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
              xi[t][i][j] /= sum;
            }
          }
        }
      }

      // M-step: Re-estimate parameters
      // Initial probs
      for (let i = 0; i < N; i++) {
        this.pi[i] = gamma[0][i];
      }

      // Transition matrix
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          let num = 0;
          let den = 0;
          for (let t = 0; t < T_len - 1; t++) {
            num += xi[t][i][j];
            den += gamma[t][i];
          }
          this.T[i][j] = den > 0 ? num / den : 1 / N;
        }
      }

      // Emission matrix
      for (let j = 0; j < N; j++) {
        for (let k = 0; k < K; k++) {
          let num = 0;
          let den = 0;
          for (let t = 0; t < T_len; t++) {
            if (obs[t] === k) num += gamma[t][j];
            den += gamma[t][j];
          }
          this.E[j][k] = den > 0 ? num / den : 1 / K;
        }
      }
    }
  }

  private forwardRaw(obs: number[]): number[][] {
    const N = this.config.states.length;
    const T_len = obs.length;
    const alpha: number[][] = [];

    alpha[0] = [];
    for (let i = 0; i < N; i++) {
      alpha[0][i] = this.pi[i] * this.E[i][obs[0]];
    }

    for (let t = 1; t < T_len; t++) {
      alpha[t] = [];
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let i = 0; i < N; i++) {
          sum += alpha[t - 1][i] * this.T[i][j];
        }
        alpha[t][j] = sum * this.E[j][obs[t]];
      }
    }

    return alpha;
  }

  private backwardRaw(obs: number[]): number[][] {
    const N = this.config.states.length;
    const T_len = obs.length;
    const beta: number[][] = [];

    beta[T_len - 1] = [];
    for (let i = 0; i < N; i++) {
      beta[T_len - 1][i] = 1;
    }

    for (let t = T_len - 2; t >= 0; t--) {
      beta[t] = [];
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++) {
          sum += this.T[i][j] * this.E[j][obs[t + 1]] * beta[t + 1][j];
        }
        beta[t][i] = sum;
      }
    }

    return beta;
  }

  getTransitionMatrix(): number[][] {
    return this.T.map((row) => [...row]);
  }

  getEmissionMatrix(): number[][] {
    return this.E.map((row) => [...row]);
  }

  getInitialProbs(): number[] {
    return [...this.pi];
  }
}

// ============================================================================
// 3. MARKOV CHAIN MONTE CARLO (MCMC) — Probability Sampling
// ============================================================================

export interface MCMCConfig {
  burnIn: number; // samples to discard
  thinning: number; // keep every nth sample
  proposalStd: number; // standard deviation of proposal distribution
  maxIterations: number;
}

const DEFAULT_MCMC_CONFIG: MCMCConfig = {
  burnIn: 1000,
  thinning: 10,
  proposalStd: 0.5,
  maxIterations: 10000,
};

export class MCMCSampler {
  private config: MCMCConfig;
  private samples: number[] = [];

  constructor(config?: Partial<MCMCConfig>) {
    this.config = { ...DEFAULT_MCMC_CONFIG, ...config };
  }

  // Gaussian random number (Box-Muller)
  private gaussianRandom(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Deterministic.random();
    while (v === 0) v = Deterministic.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Metropolis-Hastings algorithm
  metropolisHastings(targetLogDensity: (x: number) => number, initialValue: number = 0): number[] {
    this.samples = [];
    let current = initialValue;
    let currentLogDensity = targetLogDensity(current);

    for (let i = 0; i < this.config.maxIterations; i++) {
      // Propose new state
      const proposal = current + this.gaussianRandom() * this.config.proposalStd;
      const proposalLogDensity = targetLogDensity(proposal);

      // Acceptance ratio (symmetric proposal → ratio = target ratio)
      const logAlpha = proposalLogDensity - currentLogDensity;

      // Accept or reject
      if (Math.log(Deterministic.random()) < logAlpha) {
        current = proposal;
        currentLogDensity = proposalLogDensity;
      }

      // Store samples after burn-in
      if (i >= this.config.burnIn && (i - this.config.burnIn) % this.config.thinning === 0) {
        this.samples.push(current);
      }
    }

    return this.samples;
  }

  // Gibbs Sampling for multivariate distributions
  gibbsSampling(
    conditionalSamplers: Array<(current: number[], idx: number) => number>,
    initialValue: number[],
    iterations?: number,
  ): number[][] {
    const iters = iterations || this.config.maxIterations;
    const dim = initialValue.length;
    const multiSamples: number[][] = [];
    let current = [...initialValue];

    for (let i = 0; i < iters; i++) {
      // Sample each variable conditional on all others
      for (let d = 0; d < dim; d++) {
        current[d] = conditionalSamplers[d](current, d);
      }

      if (i >= this.config.burnIn && (i - this.config.burnIn) % this.config.thinning === 0) {
        multiSamples.push([...current]);
      }
    }

    return multiSamples;
  }

  // Rejection Sampling for distributions without efficient samplers
  rejectionSampling(
    targetDensity: (x: number) => number,
    proposalSampler: () => number,
    proposalDensity: (x: number) => number,
    M: number, // envelope constant: target(x) <= M * proposal(x)
    count: number = 1000,
  ): number[] {
    const samples: number[] = [];

    while (samples.length < count) {
      const x = proposalSampler();
      const u = Deterministic.random();
      const acceptanceProb = targetDensity(x) / (M * proposalDensity(x));

      if (u < acceptanceProb) {
        samples.push(x);
      }
    }

    return samples;
  }

  // Utility: compute sample statistics
  static computeStats(samples: number[]): {
    mean: number;
    variance: number;
    stdDev: number;
    median: number;
    credibleInterval: [number, number];
  } {
    const n = samples.length;
    if (n === 0) return { mean: 0, variance: 0, stdDev: 0, median: 0, credibleInterval: [0, 0] };

    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    const lowerIdx = Math.floor(n * 0.025);
    const upperIdx = Math.floor(n * 0.975);

    return {
      mean,
      variance,
      stdDev,
      median,
      credibleInterval: [sorted[lowerIdx], sorted[upperIdx]],
    };
  }
}

// ============================================================================
// 4. AGRICULTURAL MARKOV SOLVER — Pre-built use cases
// ============================================================================

// Supply chain: Farm → Warehouse → Market state transitions
export function createSupplyChainMDP(): MarkovDecisionProcess {
  const mdp = new MarkovDecisionProcess({ discountFactor: 0.9 });

  mdp.addState({ id: "farm", label: "Nông trại" });
  mdp.addState({ id: "warehouse", label: "Kho trung chuyển" });
  mdp.addState({ id: "market", label: "Chợ đầu mối" });
  mdp.addState({ id: "delivered", label: "Đã giao" });
  mdp.addState({ id: "spoiled", label: "Hỏng/hết hạn" });

  mdp.addAction({ id: "store_cold", label: "Bảo quản lạnh" });
  mdp.addAction({ id: "ship_fast", label: "Vận chuyển nhanh" });
  mdp.addAction({ id: "ship_normal", label: "Vận chuyển thường" });
  mdp.addAction({ id: "sell_discount", label: "Giảm giá bán" });

  // Farm transitions
  mdp.addTransition({ from: "farm", action: "ship_fast", to: "warehouse", probability: 0.95, reward: 10 });
  mdp.addTransition({ from: "farm", action: "ship_fast", to: "spoiled", probability: 0.05, reward: -20 });
  mdp.addTransition({ from: "farm", action: "ship_normal", to: "warehouse", probability: 0.85, reward: 15 });
  mdp.addTransition({ from: "farm", action: "ship_normal", to: "spoiled", probability: 0.15, reward: -20 });

  // Warehouse transitions
  mdp.addTransition({ from: "warehouse", action: "store_cold", to: "market", probability: 0.9, reward: 20 });
  mdp.addTransition({ from: "warehouse", action: "store_cold", to: "spoiled", probability: 0.1, reward: -15 });
  mdp.addTransition({ from: "warehouse", action: "ship_fast", to: "market", probability: 0.95, reward: 8 });
  mdp.addTransition({ from: "warehouse", action: "ship_fast", to: "spoiled", probability: 0.05, reward: -15 });

  // Market transitions
  mdp.addTransition({ from: "market", action: "sell_discount", to: "delivered", probability: 0.9, reward: 25 });
  mdp.addTransition({ from: "market", action: "sell_discount", to: "spoiled", probability: 0.1, reward: -10 });
  mdp.addTransition({ from: "market", action: "ship_normal", to: "delivered", probability: 0.7, reward: 35 });
  mdp.addTransition({ from: "market", action: "ship_normal", to: "spoiled", probability: 0.3, reward: -10 });

  // Terminal states
  mdp.addTransition({ from: "delivered", action: "sell_discount", to: "delivered", probability: 1, reward: 0 });
  mdp.addTransition({ from: "spoiled", action: "sell_discount", to: "spoiled", probability: 1, reward: 0 });

  return mdp;
}

// Demand forecasting: Hidden states (high/medium/low demand) from observable sales
export function createDemandHMM(): HiddenMarkovModel {
  return new HiddenMarkovModel({
    states: ["high_demand", "medium_demand", "low_demand"],
    observations: ["high_sales", "medium_sales", "low_sales"],
    transitionMatrix: [
      [0.7, 0.2, 0.1], // high → high, medium, low
      [0.3, 0.4, 0.3], // medium → high, medium, low
      [0.1, 0.3, 0.6], // low → high, medium, low
    ],
    emissionMatrix: [
      [0.8, 0.15, 0.05], // high_demand → high_sales, medium_sales, low_sales
      [0.2, 0.6, 0.2], // medium_demand → high_sales, medium_sales, low_sales
      [0.05, 0.25, 0.7], // low_demand → high_sales, medium_sales, low_sales
    ],
    initialProbs: [0.33, 0.34, 0.33],
  });
}

// Price distribution sampling via MCMC
export function createPriceSampler(): MCMCSampler {
  const sampler = new MCMCSampler({ burnIn: 500, proposalStd: 2.0 });

  // Target: mixture of Gaussians (multi-modal price distribution)
  const targetLogDensity = (x: number): number => {
    const g1 = Math.exp(-0.5 * ((x - 50000) / 10000) ** 2) * 0.6; // main price cluster
    const g2 = Math.exp(-0.5 * ((x - 80000) / 5000) ** 2) * 0.3; // premium cluster
    const g3 = Math.exp(-0.5 * ((x - 30000) / 8000) ** 2) * 0.1; // budget cluster
    return Math.log(g1 + g2 + g3 + 1e-10);
  };

  sampler.metropolisHastings(targetLogDensity, 50000);
  return sampler;
}
