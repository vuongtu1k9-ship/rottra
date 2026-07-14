import { Deterministic } from "~/shared/utils/rng";
import { createLogger } from "~/shared/logger";

const log = createLogger("quant-engine/q-learning");

const LEARNING_RATE = 0.1;
const DISCOUNT = 0.95;

export type QState = string;
export type QAction = 0 | 1 | 2; // 0 = Hold, 1 = Buy, 2 = Sell

// In-memory Q-Table (Can be synced to DB `aiModels` periodically)
export const globalQTable: Record<string, Record<QState, [number, number, number]>> = {};

export const QuantEngine = {
  /**
   * Initializes or retrieves the Q-Table for a specific agent.
   */
  getQTable(agentId: string): Record<QState, [number, number, number]> {
    if (!globalQTable[agentId]) {
      globalQTable[agentId] = {};
    }
    return globalQTable[agentId];
  },

  /**
   * Discretizes the continuous real-world variables into a distinct state string.
   */
  getState(inventory: number, budgetOrGold: number, marketPrice: number): QState {
    const invLevel = inventory > 20 ? "HIGH" : inventory > 0 ? "MED" : "EMPTY";
    const wealthLevel = budgetOrGold > marketPrice * 5 ? "RICH" : budgetOrGold >= marketPrice ? "OKAY" : "POOR";
    const priceLevel = marketPrice > 25 ? "EXP" : marketPrice > 15 ? "FAIR" : "CHEAP";
    return `${invLevel}_${wealthLevel}_${priceLevel}`;
  },

  /**
   * Retrieves the Q-Values for a specific state.
   */
  getQValues(agentId: string, state: QState): [number, number, number] {
    const table = this.getQTable(agentId);
    if (!table[state]) {
      // Initialize with small deterministic random weights
      table[state] = [Deterministic.random() * 0.1, Deterministic.random() * 0.1, Deterministic.random() * 0.1];
    }
    return table[state];
  },

  /**
   * AI decides an action based on Epsilon-Greedy policy.
   * Epsilon should naturally decay over time as the AI gets smarter.
   */
  decideAction(agentId: string, state: QState, epsilon = 0.1): QAction {
    if (Deterministic.random() < epsilon) {
      // Explore (Random)
      return Math.floor(Deterministic.random() * 3) as QAction;
    } else {
      // Exploit (Best Q-Value)
      const qs = this.getQValues(agentId, state);
      const maxQ = Math.max(...qs);
      return qs.indexOf(maxQ) as QAction;
    }
  },

  /**
   * Agent learns from the consequence of its action (Reward).
   * Applies the Bellman Equation to update weights.
   */
  learnFromReward(agentId: string, oldState: QState, action: QAction, reward: number, newState: QState) {
    const table = this.getQTable(agentId);
    const qs = this.getQValues(agentId, oldState);
    const maxNextQ = Math.max(...this.getQValues(agentId, newState));

    // Q(s,a) = Q(s,a) + alpha * (R + gamma * maxQ(s') - Q(s,a))
    qs[action] = qs[action] + LEARNING_RATE * (reward + DISCOUNT * maxNextQ - qs[action]);

    // log.info(`[Q-Learning] Agent ${agentId.slice(0, 8)} updated Q(${oldState}, Act:${action}) to ${qs[action].toFixed(3)} based on Reward: ${reward}`);
  },
};
