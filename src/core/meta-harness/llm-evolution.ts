import { Deterministic } from "~/shared/utils/rng";
/**
 * LLM-Driven Automated Algorithm Design (Auto-EA)
 * Sử dụng AI để tự tạo hoặc cải thiện thuật toán tiến hóa
 *
 * Thuật toán DiscoPOP và các hệ thống tiến hóa đệ quy từ Sakana AI
 * cho phép AI tự tìm kiếm và thiết kế các chiến lược tiến hóa
 * hiệu quả hơn con người tự thiết kế.
 *
 * Ứng dụng: AutoML, code generation, self-improving AI
 */

import { generateTextLocal } from "../nlp-cognitive/ai-sdk";

export interface EvolutionStrategy {
  name: string;
  description: string;
  parameters: Record<string, number>;
  operators: EvolutionOperator[];
  selectionMethod: SelectionMethod;
  replacementMethod: ReplacementMethod;
}

export interface EvolutionOperator {
  type: "crossover" | "mutation" | "local_search" | "adaptive";
  name: string;
  params: Record<string, number>;
  description: string;
}

export type SelectionMethod = "tournament" | "roulette" | "rank" | "truncation" | "stochastic_universal" | "nsga2_crowding";

export type ReplacementMethod = "generational" | "steady_state" | "elitist" | "age_based";

export interface AlgorithmGenome {
  id: string;
  strategy: EvolutionStrategy;
  fitness: number;
  generation: number;
  parentIds: string[];
  metadata: {
    createdVia: "mutation" | "crossover" | "llm_synthesis" | "random";
    improvementRate: number;
    computationalCost: number;
  };
}

export interface AutoEAConfig {
  populationSize?: number; // Số lượng chiến lược algorithms
  maxGenerations?: number;
  mutationRate?: number;
  crossoverRate?: number;
  targetFitness?: number;
  evaluationBudget?: number; // Số lần evaluate tối đa
}

/**
 * Tạo strategy template ngẫu nhiên
 */
function generateRandomStrategy(dimension: number): EvolutionStrategy {
  const operatorPool: EvolutionOperator[] = [
    {
      type: "crossover",
      name: "uniform_crossover",
      params: { rate: 0.5 },
      description: "Lai ghép đồng đều 50/50",
    },
    {
      type: "crossover",
      name: "sbx",
      params: { eta: 2, rate: 0.9 },
      description: "Simulated Binary Crossover",
    },
    {
      type: "crossover",
      name: "blend_alpha",
      params: { alpha: 0.5, rate: 0.8 },
      description: "BLX-α crossover",
    },
    {
      type: "mutation",
      name: "gaussian",
      params: { sigma: 0.1, rate: 0.1 },
      description: "Đột biến Gauss",
    },
    {
      type: "mutation",
      name: "polynomial",
      params: { eta: 20, rate: 0.1 },
      description: "Đột biến đa thức",
    },
    {
      type: "mutation",
      name: "cauchy",
      params: { scale: 0.05, rate: 0.05 },
      description: "Đột biến Cauchy (heavy tail)",
    },
    {
      type: "local_search",
      name: "pattern_search",
      params: { step: 0.01, max_iter: 10 },
      description: "Local search pattern",
    },
    {
      type: "adaptive",
      name: "self_adaptive",
      params: { learning_rate: 0.1 },
      description: "Tự thích ứng mutation rate",
    },
  ];

  const numOperators = 1 + Math.floor(Deterministic.random() * 3);
  const operators: EvolutionOperator[] = [];
  for (let i = 0; i < numOperators; i++) {
    operators.push({
      ...operatorPool[Math.floor(Deterministic.random() * operatorPool.length)],
      params: { ...operatorPool[Math.floor(Deterministic.random() * operatorPool.length)].params },
    });
  }

  const selectionMethods: SelectionMethod[] = ["tournament", "roulette", "rank", "truncation"];
  const replacementMethods: ReplacementMethod[] = ["generational", "steady_state", "elitist"];

  return {
    name: `EA_Strategy_${Date.now()}_${Math.floor(Deterministic.random() * 1000)}`,
    description: `Chiến lược tiến hóa ngẫu nhiên với ${numOperators} operators`,
    parameters: {
      populationSize: 20 + Math.floor(Deterministic.random() * 80),
      tournamentSize: 2 + Math.floor(Deterministic.random() * 5),
      elitismRate: Deterministic.random() * 0.3,
      diversityWeight: Deterministic.random(),
    },
    operators,
    selectionMethod: selectionMethods[Math.floor(Deterministic.random() * selectionMethods.length)],
    replacementMethod: replacementMethods[Math.floor(Deterministic.random() * replacementMethods.length)],
  };
}

/**
 * Đánh giá fitness của một Evolution Strategy
 * Bằng cách chạy bài toán benchmark nhỏ
 */
function evaluateStrategy(
  strategy: EvolutionStrategy,
  benchmarkFn: (x: number[]) => number,
  dimension: number,
  bounds: [number, number][],
  maxEval: number = 100,
): number {
  // Giả lập chạy strategy trên benchmark
  let bestFitness = -Infinity;
  const popSize = strategy.parameters.populationSize || 30;

  // Khởi tạo quần thể
  const population: number[][] = [];
  const fitness: number[] = [];

  for (let i = 0; i < popSize; i++) {
    const individual = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
    population.push(individual);
    fitness.push(benchmarkFn(individual));
  }

  let evalCount = popSize;

  // Chạy tiến hóa
  for (let gen = 0; gen < maxEval / popSize; gen++) {
    // Selection
    const parents = selectParents(population, fitness, strategy.selectionMethod, strategy.parameters.tournamentSize || 3);

    // Apply operators
    const offspring: number[][] = [];
    for (let i = 0; i < parents.length; i++) {
      let child = [...parents[i]];
      for (const op of strategy.operators) {
        if (Deterministic.random() < (op.params.rate || 0.1)) {
          child = applyOperator(child, op, bounds);
        }
      }
      offspring.push(child);
      evalCount++;
    }

    // Evaluate offspring
    const offspringFitness = offspring.map((ind) => benchmarkFn(ind));

    // Replacement
    applyReplacement(population, fitness, offspring, offspringFitness, strategy.replacementMethod, strategy.parameters.elitismRate || 0.1);

    // Update best
    const genBest = Math.max(...fitness);
    if (genBest > bestFitness) bestFitness = genBest;

    if (evalCount >= maxEval) break;
  }

  // Normalize fitness: 0-1 scale
  return Math.max(0, Math.min(1, bestFitness / 100));
}

/**
 * Chọn parent theo selection method
 */
function selectParents(population: number[][], fitness: number[], method: SelectionMethod, tournamentSize: number): number[][] {
  const NP = population.length;
  const parents: number[][] = [];

  switch (method) {
    case "tournament": {
      for (let i = 0; i < NP; i++) {
        let best = -1;
        for (let t = 0; t < tournamentSize; t++) {
          const idx = Math.floor(Deterministic.random() * NP);
          if (best === -1 || fitness[idx] > fitness[best]) {
            best = idx;
          }
        }
        parents.push([...population[best]]);
      }
      break;
    }

    case "roulette": {
      const totalFitness = fitness.reduce((a, b) => a + Math.max(0, b), 0);
      for (let i = 0; i < NP; i++) {
        let r = Deterministic.random() * totalFitness;
        for (let j = 0; j < NP; j++) {
          r -= Math.max(0, fitness[j]);
          if (r <= 0) {
            parents.push([...population[j]]);
            break;
          }
        }
      }
      break;
    }

    case "rank": {
      const sorted = fitness.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);
      const ranks = new Array(NP);
      sorted.forEach((item, rank) => {
        ranks[item.i] = rank + 1;
      });
      const totalRank = (NP * (NP + 1)) / 2;
      for (let i = 0; i < NP; i++) {
        let r = Deterministic.random() * totalRank;
        for (let j = 0; j < NP; j++) {
          r -= ranks[j];
          if (r <= 0) {
            parents.push([...population[j]]);
            break;
          }
        }
      }
      break;
    }

    case "truncation": {
      const sorted = fitness.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f);
      const topHalf = sorted.slice(0, Math.floor(NP / 2));
      for (let i = 0; i < NP; i++) {
        const parent = topHalf[Math.floor(Deterministic.random() * topHalf.length)];
        parents.push([...population[parent.i]]);
      }
      break;
    }

    default: {
      // Fallback: random selection
      for (let i = 0; i < NP; i++) {
        parents.push([...population[Math.floor(Deterministic.random() * NP)]]);
      }
    }
  }

  return parents;
}

/**
 * Áp dụng operator lên individual
 */
function applyOperator(individual: number[], operator: EvolutionOperator, bounds: [number, number][]): number[] {
  const dim = individual.length;
  const result = [...individual];

  switch (operator.name) {
    case "uniform_crossover": {
      // Self-crossover với một template ngẫu nhiên
      const template = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
      for (let d = 0; d < dim; d++) {
        if (Deterministic.random() < operator.params.rate) {
          result[d] = template[d];
        }
      }
      break;
    }

    case "sbx": {
      const eta = operator.params.eta || 2;
      const template = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
      for (let d = 0; d < dim; d++) {
        if (Deterministic.random() < 0.5) {
          const beta = Math.pow(Deterministic.random(), 1 / (eta + 1));
          result[d] = 0.5 * ((1 + beta) * individual[d] + (1 - beta) * template[d]);
        }
      }
      break;
    }

    case "gaussian": {
      const sigma = operator.params.sigma || 0.1;
      for (let d = 0; d < dim; d++) {
        result[d] += sigma * (Deterministic.random() * 2 - 1) * bounds[d][1] - bounds[d][0];
      }
      break;
    }

    case "polynomial": {
      const eta = operator.params.eta || 20;
      for (let d = 0; d < dim; d++) {
        const u = Deterministic.random();
        const delta = u < 0.5 ? Math.pow(2 * u, 1 / (eta + 1)) - 1 : 1 - Math.pow(2 * (1 - u), 1 / (eta + 1));
        result[d] += delta * (bounds[d][1] - bounds[d][0]);
      }
      break;
    }

    case "cauchy": {
      const scale = operator.params.scale || 0.05;
      for (let d = 0; d < dim; d++) {
        // Cauchy distribution via inverse CDF
        const u = Deterministic.random() - 0.5;
        result[d] += scale * Math.tan(Math.PI * u) * (bounds[d][1] - bounds[d][0]);
      }
      break;
    }

    default:
      break;
  }

  // Clamp
  return result.map((v, d) => Math.max(bounds[d][0], Math.min(bounds[d][1], v)));
}

/**
 * Áp dụng replacement strategy
 */
function applyReplacement(
  population: number[][],
  fitness: number[],
  offspring: number[][],
  offspringFitness: number[],
  method: ReplacementMethod,
  elitismRate: number,
): void {
  const NP = population.length;
  const elitesCount = Math.floor(NP * elitismRate);

  switch (method) {
    case "elitist": {
      // Giữ elites, thay thế phần còn lại
      const allIndices = fitness.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f);

      // Giữ elites
      const eliteIndices = allIndices.slice(0, elitesCount).map((x) => x.i);
      const newPop: number[][] = [];
      const newFit: number[] = [];

      for (const idx of eliteIndices) {
        newPop.push([...population[idx]]);
        newFit.push(fitness[idx]);
      }

      // Thêm offspring
      for (let i = 0; i < offspring.length && newPop.length < NP; i++) {
        newPop.push([...offspring[i]]);
        newFit.push(offspringFitness[i]);
      }

      // Copy back
      for (let i = 0; i < NP; i++) {
        population[i] = newPop[i] || population[i];
        fitness[i] = newFit[i] || fitness[i];
      }
      break;
    }

    case "steady_state": {
      // Thay thế individual xấu nhất bằng offspring tốt nhất
      const worstIdx = fitness.indexOf(Math.min(...fitness));
      let bestOffspringIdx = 0;
      for (let i = 1; i < offspring.length; i++) {
        if (offspringFitness[i] > offspringFitness[bestOffspringIdx]) {
          bestOffspringIdx = i;
        }
      }
      if (offspringFitness[bestOffspringIdx] > fitness[worstIdx]) {
        population[worstIdx] = [...offspring[bestOffspringIdx]];
        fitness[worstIdx] = offspringFitness[bestOffspringIdx];
      }
      break;
    }

    default: {
      // Generational: thay thế toàn bộ
      for (let i = 0; i < NP; i++) {
        if (i < offspring.length) {
          population[i] = [...offspring[i]];
          fitness[i] = offspringFitness[i];
        }
      }
    }
  }
}

/**
 * LLM-driven strategy mutation
 * Sử dụng LLM để tạo biến thể mới của strategy
 */
async function llmMutateStrategy(strategy: EvolutionStrategy, feedback: string): Promise<EvolutionStrategy> {
  const prompt = `
Bạn là chuyên gia tối ưu hóa. Một thuật toán tiến hóa hiện tại:

Tên: ${strategy.name}
Mô tả: ${strategy.description}
Selection: ${strategy.selectionMethod}
Replacement: ${strategy.replacementMethod}
Operators: ${strategy.operators.map((op) => `${op.name}(${JSON.stringify(op.params)})`).join(", ")}
Parameters: ${JSON.stringify(strategy.parameters)}

Hiệu suất gần đây: ${feedback}

Hãy tạo MỘT biến thể mới tốt hơn. Trả về JSON với cấu trúc:
{
  "name": "tên mới",
  "description": "mô tả",
  "parameters": { ... },
  "operators": [{ "type": "...", "name": "...", "params": {...}, "description": "..." }],
  "selectionMethod": "...",
  "replacementMethod": "...",
  "improvementReason": "lý do cải thiện"
}

Chỉ trả JSON, không giải thích.
`;

  try {
    const response = await generateTextLocal({ prompt, decodingSettings: { temperature: 0.3 } });
    const parsed = JSON.parse(response.text);

    return {
      name: parsed.name || `LLM_${Date.now()}`,
      description: parsed.description || "LLM-generated strategy",
      parameters: parsed.parameters || strategy.parameters,
      operators: parsed.operators || strategy.operators,
      selectionMethod: parsed.selectionMethod || strategy.selectionMethod,
      replacementMethod: parsed.replacementMethod || strategy.replacementMethod,
    };
  } catch {
    // Fallback: random mutation
    return {
      ...strategy,
      name: `Mutated_${Date.now()}`,
      parameters: {
        ...strategy.parameters,
        populationSize: (strategy.parameters.populationSize || 30) + Math.floor(Deterministic.random() * 10 - 5),
      },
    };
  }
}

/**
 * Chạy Auto-EA: LLM tự thiết kế và tối ưu hóa strategy
 */
export async function autoEADesign(
  config: AutoEAConfig,
  benchmarkFn: (x: number[]) => number,
  dimension: number,
  bounds: [number, number][],
): Promise<{
  bestStrategy: EvolutionStrategy;
  evolutionLog: AlgorithmGenome[];
  convergenceHistory: number[];
}> {
  const popSize = config.populationSize ?? 10;
  const maxGen = config.maxGenerations ?? 20;
  const targetFitness = config.targetFitness ?? 0.95;

  // Khởi tạo quần thể strategies
  let strategies: AlgorithmGenome[] = [];
  for (let i = 0; i < popSize; i++) {
    strategies.push({
      id: `algo_${i}`,
      strategy: generateRandomStrategy(dimension),
      fitness: 0,
      generation: 0,
      parentIds: [],
      metadata: {
        createdVia: "random",
        improvementRate: 0,
        computationalCost: 0,
      },
    });
  }

  const convergenceHistory: number[] = [];
  let bestOverallFitness = 0;
  let bestOverallStrategy = strategies[0].strategy;

  for (let gen = 0; gen < maxGen; gen++) {
    // Đánh giá fitness cho mỗi strategy
    for (const genome of strategies) {
      const startTime = Date.now();
      genome.fitness = evaluateStrategy(genome.strategy, benchmarkFn, dimension, bounds);
      genome.metadata.computationalCost = Date.now() - startTime;
    }

    // Sắp xếp theo fitness
    strategies.sort((a, b) => b.fitness - a.fitness);

    // Track best
    if (strategies[0].fitness > bestOverallFitness) {
      bestOverallFitness = strategies[0].fitness;
      bestOverallStrategy = { ...strategies[0].strategy };
    }

    convergenceHistory.push(bestOverallFitness);

    console.log(`[Auto-EA Gen ${gen + 1}] Best fitness: ${bestOverallFitness.toFixed(4)} | Strategy: ${strategies[0].strategy.name}`);

    // Dừng sớm nếu đạt target
    if (bestOverallFitness >= targetFitness) break;

    // Tạo thế hệ mới
    const newStrategies: AlgorithmGenome[] = [];

    // Elitism: giữ top 2
    newStrategies.push({
      ...strategies[0],
      id: `algo_elite_${gen}`,
      generation: gen + 1,
    });
    newStrategies.push({
      ...strategies[1],
      id: `algo_elite2_${gen}`,
      generation: gen + 1,
    });

    // LLM mutation cho top strategy
    if (gen < maxGen - 1) {
      const feedback = `Fitness: ${strategies[0].fitness.toFixed(4)}, Crossover rate: ${strategies[0].strategy.operators[0]?.params?.rate || 0.5}`;
      const llmMutated = await llmMutateStrategy(strategies[0].strategy, feedback);
      newStrategies.push({
        id: `algo_llm_${gen}`,
        strategy: llmMutated,
        fitness: 0,
        generation: gen + 1,
        parentIds: [strategies[0].id],
        metadata: {
          createdVia: "llm_synthesis",
          improvementRate: 0,
          computationalCost: 0,
        },
      });
    }

    // Traditional mutations
    while (newStrategies.length < popSize) {
      const parentIdx = Math.floor(Deterministic.random() * Math.min(5, strategies.length));
      const parent = strategies[parentIdx];

      // Random mutation
      const mutated = { ...parent.strategy };
      mutated.name = `mutated_${gen}_${newStrategies.length}`;
      if (mutated.operators[0]) {
        mutated.operators[0].params.rate = (mutated.operators[0].params.rate || 0.5) + (Deterministic.random() - 0.5) * 0.2;
      }

      newStrategies.push({
        id: `algo_mut_${gen}_${newStrategies.length}`,
        strategy: mutated,
        fitness: 0,
        generation: gen + 1,
        parentIds: [parent.id],
        metadata: {
          createdVia: "mutation",
          improvementRate: 0,
          computationalCost: 0,
        },
      });
    }

    strategies = newStrategies;
  }

  return {
    bestStrategy: bestOverallStrategy,
    evolutionLog: strategies,
    convergenceHistory,
  };
}

/**
 * Benchmark functions cho testing
 */
export const benchmarkFunctions = {
  /**
   * Hàm Sphere: đơn giản, convex
   * Global min: f(0,0,...,0) = 0
   */
  sphere: (x: number[]): number => {
    return -x.reduce((sum, xi) => sum + xi * xi, 0);
  },

  /**
   * Hàm Rastrigin: nhiều đỉnh cục bộ
   * Global min: f(0,0,...,0) = 0
   */
  rastrigin: (x: number[]): number => {
    const n = x.length;
    const A = 10;
    return -(A * n + x.reduce((sum, xi) => sum + xi * xi - A * Math.cos(2 * Math.PI * xi), 0));
  },

  /**
   * Hàm Rosenbrock: valley-shaped
   * Global min: f(1,1,...,1) = 0
   */
  rosenbrock: (x: number[]): number => {
    let sum = 0;
    for (let i = 0; i < x.length - 1; i++) {
      sum += 100 * Math.pow(x[i + 1] - x[i] * x[i], 2) + Math.pow(1 - x[i], 2);
    }
    return -sum;
  },

  /**
   * Hàm Ackley: nhiều đỉnh cục bộ, phức tạp
   * Global min: f(0,0,...,0) = 0
   */
  ackley: (x: number[]): number => {
    const n = x.length;
    const sum1 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sum2 = x.reduce((sum, xi) => sum + Math.cos(2 * Math.PI * xi), 0);
    return -(20 * Math.exp(-0.2 * Math.sqrt(sum1 / n)) - Math.exp(sum2 / n) + 20 + Math.E);
  },
};

/**
 * Ví dụ sử dụng Auto-EA
 */
export async function exampleAutoEA() {
  console.log("🧬 Auto-EA: LLM-driven Algorithm Design");
  console.log("========================================\n");

  const result = await autoEADesign({ populationSize: 8, maxGenerations: 15, targetFitness: 0.9 }, benchmarkFunctions.rastrigin, 5, [
    [-5, 5],
    [-5, 5],
    [-5, 5],
    [-5, 5],
    [-5, 5],
  ]);

  console.log("\n✅ Auto-EA Complete!");
  console.log(`Best Strategy: ${result.bestStrategy.name}`);
  console.log(`Description: ${result.bestStrategy.description}`);
  console.log(`Fitness: ${result.convergenceHistory.slice(-1)[0]?.toFixed(4)}`);

  return result;
}
