/**
 * Differential Evolution (DE)
 * Phương pháp mạnh mẽ cho tối ưu hóa tham số thực
 *
 * DE tạo ra thế hệ mới bằng cách cộng thêm sự khác biệt có trọng số
 * giữa các giải pháp đã chọn vào các giải pháp khác.
 * Nổi tiếng với sự đơn giản nhưng hiệu suất cực cao.
 */

export interface DEConfig {
  dimension: number; // Số chiều không gian tìm kiếm
  populationSize?: number; // Kích thước quần thể (NP), mặc định = 10 * dimension
  maxGenerations?: number; // Số thế hệ tối đa
  F?: number; // Hệ số đột biến (scaling factor), [0.5, 1.0], mặc định = 0.8
  CR?: number; // Tỷ lệ lai ghép (crossover rate), [0.1, 0.9], mặc định = 0.7
  strategy?: DEStrategy; // Chiến lược DE
  fitnessThreshold?: number; // Ngưỡng fitness dừng sớm
  tolerance?: number; // Ngưỡng hội tụ
}

export type DEStrategy =
  | "DE/rand/1" // ClasDE cổ điển: v = x_r1 + F * (x_r2 - x_r3)
  | "DE/best/1" // Dùng best: v = x_best + F * (x_r1 - x_r2)
  | "DE/rand/2" // DE/rand/2/bin: v = x_r1 + F*(x_r2-x_r3) + F*(x_r4-x_r5)
  | "DE/best/2" // DE/best/2/bin: v = x_best + F*(x_r1-x_r2) + F*(x_r3-x_r4)
  | "DE/current-to-best/1"; // v = x_i + F*(x_best - x_i) + F*(x_r1 - x_r2)

export interface DEState {
  population: number[][];
  fitness: number[];
  bestIndex: number;
  bestFitness: number;
  bestSolution: number[];
  generation: number;
  fitnessHistory: number[];
  strategyStats: {
    crossoverRate: number;
    mutationRate: number;
    diversityMeasure: number;
  };
}

export interface DEResult {
  bestSolution: number[];
  bestFitness: number;
  generations: number;
  state: DEState;
}

/**
 * Khởi tạo quần thể ngẫu nhiên trong bounds
 */
function initializePopulation(dimension: number, populationSize: number, bounds: [number, number][]): number[][] {
  const population: number[][] = [];
  for (let i = 0; i < populationSize; i++) {
    const individual: number[] = [];
    for (let d = 0; d < dimension; d++) {
      const [min, max] = bounds[d];
      individual[d] = min + Math.random() * (max - min);
    }
    population.push(individual);
  }
  return population;
}

/**
 * Đánh giá fitness cho toàn bộ quần thể
 */
function evaluatePopulation(population: number[][], fitnessFn: (x: number[]) => number): number[] {
  return population.map((individual) => fitnessFn(individual));
}

/**
 * Chọn 3个体 ngẫu nhiên khác index
 */
function selectRandomIndices(populationSize: number, excludeIndex: number, count: number): number[] {
  const indices: number[] = [];
  while (indices.length < count) {
    const idx = Math.floor(Math.random() * populationSize);
    if (idx !== excludeIndex && !indices.includes(idx)) {
      indices.push(idx);
    }
  }
  return indices;
}

/**
 * Tạo mutant vector theo chiến lược DE
 */
function createMutant(
  population: number[][],
  fitness: number[],
  targetIndex: number,
  F: number,
  strategy: DEStrategy,
  bestIndex: number,
): number[] {
  const NP = population.length;
  const dim = population[0].length;
  const target = population[targetIndex];

  switch (strategy) {
    case "DE/rand/1": {
      const [r1, r2, r3] = selectRandomIndices(NP, targetIndex, 3);
      return target.map((_, d) => population[r1][d] + F * (population[r2][d] - population[r3][d]));
    }

    case "DE/best/1": {
      const [r1, r2] = selectRandomIndices(NP, targetIndex, 2);
      return target.map((_, d) => population[bestIndex][d] + F * (population[r1][d] - population[r2][d]));
    }

    case "DE/rand/2": {
      const [r1, r2, r3, r4, r5] = selectRandomIndices(NP, targetIndex, 5);
      return target.map(
        (_, d) => population[r1][d] + F * (population[r2][d] - population[r3][d]) + F * (population[r4][d] - population[r5][d]),
      );
    }

    case "DE/best/2": {
      const [r1, r2, r3, r4] = selectRandomIndices(NP, targetIndex, 4);
      return target.map(
        (_, d) => population[bestIndex][d] + F * (population[r1][d] - population[r2][d]) + F * (population[r3][d] - population[r4][d]),
      );
    }

    case "DE/current-to-best/1": {
      const [r1, r2] = selectRandomIndices(NP, targetIndex, 2);
      return target.map((_, d) => target[d] + F * (population[bestIndex][d] - target[d]) + F * (population[r1][d] - population[r2][d]));
    }

    default:
      return [...target];
  }
}

/**
 * Tạo trial vector bằng crossover (binomial)
 */
function crossover(target: number[], mutant: number[], CR: number): number[] {
  const dim = target.length;
  const trial = [...target];

  // Chọn至少 1 chiều từ mutant
  const jRand = Math.floor(Math.random() * dim);

  for (let j = 0; j < dim; j++) {
    if (Math.random() < CR || j === jRand) {
      trial[j] = mutant[j];
    }
  }

  return trial;
}

/**
 * Clamp individual theo bounds
 */
function clampToBounds(individual: number[], bounds: [number, number][]): number[] {
  return individual.map((v, d) => {
    const [min, max] = bounds[d];
    return Math.max(min, Math.min(max, v));
  });
}

/**
 * Tính diversity measure của quần thể
 */
function calculateDiversity(population: number[][]): number {
  const NP = population.length;
  const dim = population[0].length;

  // Mean của quần thể
  const mean = new Array(dim).fill(0);
  for (const ind of population) {
    for (let d = 0; d < dim; d++) {
      mean[d] += ind[d];
    }
  }
  for (let d = 0; d < dim; d++) {
    mean[d] /= NP;
  }

  // Tính variance
  let variance = 0;
  for (const ind of population) {
    for (let d = 0; d < dim; d++) {
      variance += Math.pow(ind[d] - mean[d], 2);
    }
  }
  return Math.sqrt(variance / (NP * dim));
}

/**
 * Chạy Differential Evolution optimization
 *
 * @param config - Cấu hình DE
 * @param fitnessFn - Hàm fitness cần tối ưu hóa (maximize)
 * @param bounds - Giới hạn cho mỗi chiều [[min, max], ...]
 * @returns Kết quả tối ưu hóa
 */
export function deOptimize(config: DEConfig, fitnessFn: (x: number[]) => number, bounds: [number, number][]): DEResult {
  const n = config.dimension;
  const NP = config.populationSize ?? 10 * n;
  const maxGen = config.maxGenerations ?? 500;
  const F = config.F ?? 0.8;
  const CR = config.CR ?? 0.7;
  const strategy = config.strategy ?? "DE/rand/1";
  const tol = config.tolerance ?? 1e-8;
  const fitThreshold = config.fitnessThreshold ?? Infinity;

  // Khởi tạo quần thể
  let population = initializePopulation(n, NP, bounds);
  let fitness = evaluatePopulation(population, fitnessFn);

  // Tìm best
  let bestIndex = 0;
  for (let i = 1; i < NP; i++) {
    if (fitness[i] > fitness[bestIndex]) {
      bestIndex = i;
    }
  }

  let state: DEState = {
    population: population.map((p) => [...p]),
    fitness: [...fitness],
    bestIndex,
    bestFitness: fitness[bestIndex],
    bestSolution: [...population[bestIndex]],
    generation: 0,
    fitnessHistory: [fitness[bestIndex]],
    strategyStats: {
      crossoverRate: 0,
      mutationRate: 0,
      diversityMeasure: calculateDiversity(population),
    },
  };

  for (let gen = 0; gen < maxGen; gen++) {
    let crossoverSuccess = 0;
    let totalTrials = 0;

    for (let i = 0; i < NP; i++) {
      // 1. Tạo mutant vector
      const mutant = createMutant(population, fitness, i, F, strategy, bestIndex);

      // 2. Crossover
      const trial = crossover(population[i], mutant, CR);

      // 3. Clamp bounds
      const trialClamped = clampToBounds(trial, bounds);

      // 4. Đánh giá fitness
      const trialFitness = fitnessFn(trialClamped);

      // 5. Selection: Nếu trial tốt hơn target, giữ trial
      totalTrials++;
      if (trialFitness >= fitness[i]) {
        population[i] = trialClamped;
        fitness[i] = trialFitness;
        crossoverSuccess++;
      }
    }

    // Cập nhật best
    for (let i = 0; i < NP; i++) {
      if (fitness[i] > state.bestFitness) {
        state.bestFitness = fitness[i];
        state.bestSolution = [...population[i]];
        state.bestIndex = i;
      }
    }

    state.fitnessHistory.push(state.bestFitness);
    state.generation = gen + 1;
    state.population = population.map((p) => [...p]);
    state.fitness = [...fitness];
    state.strategyStats.crossoverRate = crossoverSuccess / totalTrials;
    state.strategyStats.diversityMeasure = calculateDiversity(population);

    // Dừng sớm nếu đạt ngưỡng
    if (state.bestFitness >= fitThreshold) break;

    // Kiểm tra hội tụ
    if (gen > 20) {
      const recent = state.fitnessHistory.slice(-20);
      const variance = recent.reduce((sum, f) => sum + Math.pow(f - recent[0], 2), 0) / 20;
      if (variance < tol) break;
    }
  }

  return {
    bestSolution: state.bestSolution,
    bestFitness: state.bestFitness,
    generations: state.generation,
    state,
  };
}

/**
 * Ví dụ: Tối ưu hóa hàm Ackley (nhiều đỉnh cục bộ)
 */
export function exampleAckley() {
  const ackley = (x: number[]): number => {
    const n = x.length;
    const sum1 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sum2 = x.reduce((sum, xi) => sum + Math.cos(2 * Math.PI * xi), 0);
    const result = -20 * Math.exp(-0.2 * Math.sqrt(sum1 / n)) - Math.exp(sum2 / n) + 20 + Math.E;
    return -result; // Negate for maximization
  };

  const bounds: [number, number][] = Array.from({ length: 5 }, () => [-5, 5]);

  const result = deOptimize({ dimension: 5, maxGenerations: 200, strategy: "DE/rand/1" }, ackley, bounds);

  return result;
}

/**
 * Multi-objective DE (NSGA-II style cho 2 objectives)
 */
export function deMultiObjective(
  config: DEConfig,
  fitnessFns: ((x: number[]) => number)[],
  bounds: [number, number][],
): { paretoFront: number[][]; paretoFitness: number[][] } {
  const n = config.dimension;
  const NP = config.populationSize ?? 10 * n;
  const maxGen = config.maxGenerations ?? 100;
  const F = config.F ?? 0.8;
  const CR = config.CR ?? 0.7;
  const objectives = fitnessFns.length;

  let population = initializePopulation(n, NP, bounds);

  // Đánh giá multi-objective fitness
  const evaluateMultiObj = (pop: number[][]): number[][] => {
    return pop.map((ind) => fitnessFns.map((fn) => fn(ind)));
  };

  // Non-dominated sorting
  const nonDominatedSort = (fits: number[][]): { fronts: number[][]; ranks: number[] } => {
    const ranks = new Array(NP).fill(0);
    const fronts: number[][] = [];
    const dominatedCount = new Array(NP).fill(0);
    const dominatesSet: number[][] = Array.from({ length: NP }, () => []);

    for (let i = 0; i < NP; i++) {
      for (let j = i + 1; j < NP; j++) {
        let iDominatesJ = true;
        let jDominatesI = true;
        for (let k = 0; k < objectives; k++) {
          if (fits[i][k] < fits[j][k]) iDominatesJ = false;
          if (fits[j][k] < fits[i][k]) jDominatesI = false;
        }
        if (iDominatesJ) {
          dominatesSet[i].push(j);
          dominatedCount[j]++;
        }
        if (jDominatesI) {
          dominatesSet[j].push(i);
          dominatedCount[i]++;
        }
      }
    }

    let currentFront: number[] = [];
    for (let i = 0; i < NP; i++) {
      if (dominatedCount[i] === 0) {
        ranks[i] = 0;
        currentFront.push(i);
      }
    }
    fronts.push(currentFront);

    let frontIdx = 0;
    while (fronts[frontIdx].length > 0) {
      const nextFront: number[] = [];
      for (const i of fronts[frontIdx]) {
        for (const j of dominatesSet[i]) {
          dominatedCount[j]--;
          if (dominatedCount[j] === 0) {
            ranks[j] = frontIdx + 1;
            nextFront.push(j);
          }
        }
      }
      frontIdx++;
      if (nextFront.length > 0) fronts.push(nextFront);
    }

    return { fronts, ranks };
  };

  // Crowding distance
  const crowdingDistance = (fits: number[][], front: number[]): number[] => {
    const dist = new Array(front.length).fill(0);
    for (let obj = 0; obj < objectives; obj++) {
      const sorted = [...front].sort((a, b) => fits[a][obj] - fits[b][obj]);
      dist[0] = Infinity;
      dist[sorted.length - 1] = Infinity;
      const range = fits[sorted[sorted.length - 1]][obj] - fits[sorted[0]][obj];
      if (range === 0) continue;
      for (let i = 1; i < sorted.length - 1; i++) {
        dist[i] += (fits[sorted[i + 1]][obj] - fits[sorted[i - 1]][obj]) / range;
      }
    }
    return dist;
  };

  let fitness = evaluateMultiObj(population);

  for (let gen = 0; gen < maxGen; gen++) {
    const newPop: number[][] = [];

    for (let i = 0; i < NP; i++) {
      const mutant = createMutant(
        population,
        fitness.map((f) => f[0]),
        i,
        F,
        "DE/rand/1",
        0,
      );
      const trial = crossover(population[i], mutant, CR);
      const trialClamped = clampToBounds(trial, bounds);
      newPop.push(trialClamped);
    }

    // Merge parent + offspring
    const combined = [...population, ...newPop];
    const combinedFitness = evaluateMultiObj(combined);

    // Non-dominated sort
    const { fronts, ranks } = nonDominatedSort(combinedFitness);

    // Chọn NP个体 tốt nhất
    const selected: number[] = [];
    for (const front of fronts) {
      if (selected.length + front.length <= NP) {
        selected.push(...front);
      } else {
        // Crowding distance selection
        const cd = crowdingDistance(combinedFitness, front);
        const sorted = front.sort((a, b) => cd[front.indexOf(b)] - cd[front.indexOf(a)]);
        const remaining = NP - selected.length;
        selected.push(...sorted.slice(0, remaining));
        break;
      }
    }

    population = selected.map((i) => combined[i]);
    fitness = selected.map((i) => combinedFitness[i]);
  }

  // Trả về Pareto front
  const finalFitness = evaluateMultiObj(population);
  const { fronts } = nonDominatedSort(finalFitness);
  const paretoIndices = fronts[0] || [];

  return {
    paretoFront: paretoIndices.map((i) => population[i]),
    paretoFitness: paretoIndices.map((i) => finalFitness[i]),
  };
}
