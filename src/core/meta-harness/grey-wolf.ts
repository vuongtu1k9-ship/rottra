import { Deterministic } from "~/shared/utils/rng";
/**
 * Grey Wolf Optimizer (GWO)
 * Thuật toán tối ưu hóa dựa trên hệ thống xã hội của sói xám
 *
 * Mô phỏng hierarchical social structure:
 * - Alpha (α): Sói đầu đàn, giải pháp tốt nhất
 * - Beta (β): Sói thứ hai, trợ thủ của alpha
 * - Delta (δ): Sói thứ ba, thợ săn/giám sát
 * - Omega (ω): Sói cấp thấp nhất, tuân theo ba sói trên
 *
 * Thuật toán explore tốt nhờ cơ chế bao vây (encircling prey)
 * và exploit tốt nhờ hunting mechanism.
 *
 * Ứng dụng: Feature selection, neural network training, engineering optimization
 */

export interface GWOConfig {
  dimension: number; // Số chiều không gian tìm kiếm
  packSize?: number; // Kích thước bầy sói (N), mặc định = 30
  maxIterations?: number; // Số vòng lặp tối đa
  bounds?: [number, number][]; // Giới hạn [[min, max], ...]
  convergenceCurve?: boolean; // Lưu convergence curve
  fitnessThreshold?: number; // Ngưỡng fitness dừng sớm
  tolerance?: number; // Ngưỡng hội tụ
  huntingPhase?: boolean; // Bật chế độ săn mồi nâng cao
}

export interface Wolf {
  id: number;
  position: number[];
  fitness: number;
  rank: number; // 0=alpha, 1=beta, 2=delta, 3+=omega
}

export interface GWOState {
  wolves: Wolf[];
  alpha: Wolf;
  beta: Wolf;
  delta: Wolf;
  iteration: number;
  fitnessHistory: number[];
  a: number; // Coefficient vector a (giảm tuyến tính từ 2→0)
  explorationRate: number;
}

export interface GWOResult {
  bestSolution: number[];
  bestFitness: number;
  iterations: number;
  state: GWOState;
}

/**
 * Đánh giá và xếp hạng bầy sói
 */
function evaluateAndRank(wolves: Wolf[], fitnessFn: (x: number[]) => number): Wolf[] {
  for (const wolf of wolves) {
    wolf.fitness = fitnessFn(wolf.position);
  }

  // Sắp xếp theo fitness giảm dần
  wolves.sort((a, b) => b.fitness - a.fitness);

  // Gán rank
  wolves.forEach((wolf, idx) => {
    wolf.rank = idx;
  });

  return wolves;
}

/**
 * Tính toán vectors A và C cho encircling mechanism
 * A = 2a * r1 - a (a giảm từ 2→0)
 * C = 2 * r2
 */
function computeVectors(a: number, dimension: number): { A: number[]; C: number[] } {
  const A = Array.from({ length: dimension }, () => 2 * a * Deterministic.random() - a);
  const C = Array.from({ length: dimension }, () => 2 * Deterministic.random());
  return { A, C };
}

/**
 * Tính toán D_alpha, D_beta, D_delta (khoảng cách đến 3 sói leader)
 * D = |C * X_leader(t) - X(t)|
 * X(t+1) = X_leader(t) - A * D
 */
function computeComponent(leader: Wolf, current: number[], A: number[], C: number[], dimension: number): number[] {
  const result = new Array(dimension).fill(0);
  for (let d = 0; d < dimension; d++) {
    const D = Math.abs(C[d] * leader.position[d] - current[d]);
    result[d] = leader.position[d] - A[d] * D;
  }
  return result;
}

/**
 * Tính diversity của bầy sói
 */
function calculateDiversity(wolves: Wolf[]): number {
  const N = wolves.length;
  const dim = wolves[0].position.length;

  // Centroid
  const centroid = new Array(dim).fill(0);
  for (const w of wolves) {
    for (let d = 0; d < dim; d++) {
      centroid[d] += w.position[d];
    }
  }
  for (let d = 0; d < dim; d++) {
    centroid[d] /= N;
  }

  // Average distance
  let totalDist = 0;
  for (const w of wolves) {
    let dist = 0;
    for (let d = 0; d < dim; d++) {
      dist += Math.pow(w.position[d] - centroid[d], 2);
    }
    totalDist += Math.sqrt(dist);
  }

  return totalDist / N;
}

/**
 * Clamp value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Chạy Grey Wolf Optimizer
 *
 * @param config - Cấu hình GWO
 * @param fitnessFn - Hàm fitness cần tối ưu hóa (maximize)
 * @returns Kết quả tối ưu hóa
 */
export function gwoOptimize(config: GWOConfig, fitnessFn: (x: number[]) => number): GWOResult {
  const n = config.dimension;
  const N = config.packSize ?? 30;
  const maxIter = config.maxIterations ?? 200;
  const bounds = config.bounds ?? Array.from({ length: n }, () => [-10, 10]);
  const fitThreshold = config.fitnessThreshold ?? Infinity;
  const tol = config.tolerance ?? 1e-8;
  const huntingPhase = config.huntingPhase ?? false;

  // Khởi tạo bầy sói ngẫu nhiên
  let wolves: Wolf[] = [];
  for (let i = 0; i < N; i++) {
    const position = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
    wolves.push({
      id: i,
      position,
      fitness: -Infinity,
      rank: i,
    });
  }

  // Đánh giá ban đầu
  wolves = evaluateAndRank(wolves, fitnessFn);

  // 3 sói leader
  let alpha = { ...wolves[0] };
  let beta = { ...wolves[1] };
  let delta = { ...wolves[2] };

  let state: GWOState = {
    wolves: wolves.map((w) => ({ ...w })),
    alpha: { ...alpha },
    beta: { ...beta },
    delta: { ...delta },
    iteration: 0,
    fitnessHistory: [alpha.fitness],
    a: 2,
    explorationRate: 1,
  };

  for (let iter = 0; iter < maxIter; iter++) {
    // a giảm tuyến tính từ 2 → 0
    const a = 2 - (2 * iter) / maxIter;

    // Cập nhật mỗi con sói omega
    for (let i = 3; i < N; i++) {
      const wolf = wolves[i];

      // Tính toán vectors cho alpha
      const { A: A_alpha, C: C_alpha } = computeVectors(a, n);
      const X_alpha = computeComponent(alpha, wolf.position, A_alpha, C_alpha, n);

      // Tính toán vectors cho beta
      const { A: A_beta, C: C_beta } = computeVectors(a, n);
      const X_beta = computeComponent(beta, wolf.position, A_beta, C_beta, n);

      // Tính toán vectors cho delta
      const { A: A_delta, C: C_delta } = computeVectors(a, n);
      const X_delta = computeComponent(delta, wolf.position, A_delta, C_delta, n);

      // Cập nhật vị trí: trung bình-weighted từ 3 leader
      for (let d = 0; d < n; d++) {
        // Alpha có weight cao nhất
        wolf.position[d] = (X_alpha[d] + X_beta[d] + X_delta[d]) / 3;

        // Clamp bounds
        wolf.position[d] = clamp(wolf.position[d], bounds[d][0], bounds[d][1]);
      }
    }

    // Hunting phase: 3 leader cũng explore
    if (huntingPhase) {
      for (const leader of [alpha, beta, delta]) {
        const { A, C } = computeVectors(a, n);

        // Leader hunt prey
        const prey = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
        const D = C.map((c, d) => Math.abs(c * prey[d] - leader.position[d]));
        const newPosition = leader.position.map((x, d) => prey[d] - A[d] * D[d]);

        // Đánh giá vị trí mới
        const newFitness = fitnessFn(newPosition);
        if (newFitness > leader.fitness) {
          leader.position = newPosition.map((x, d) => clamp(x, bounds[d][0], bounds[d][1]));
          leader.fitness = newFitness;
        }
      }
    }

    // Đánh giá lại toàn bộ bầy
    wolves = evaluateAndRank(wolves, fitnessFn);

    // Cập nhật 3 leader (có thể thay đổi sau evaluation)
    if (wolves[0].fitness > alpha.fitness) {
      alpha = { ...wolves[0] };
    }
    if (wolves[1].fitness > beta.fitness) {
      beta = { ...wolves[1] };
    }
    if (wolves[2].fitness > delta.fitness) {
      delta = { ...wolves[2] };
    }

    // Đảm bảo alpha > beta > delta
    const sorted = [alpha, beta, delta].sort((a, b) => b.fitness - a.fitness);
    alpha = { ...sorted[0] };
    beta = { ...sorted[1] };
    delta = { ...sorted[2] };

    const diversity = calculateDiversity(wolves);

    state = {
      wolves: wolves.map((w) => ({ ...w })),
      alpha: { ...alpha },
      beta: { ...beta },
      delta: { ...delta },
      iteration: iter + 1,
      fitnessHistory: [...state.fitnessHistory, alpha.fitness],
      a,
      explorationRate: diversity,
    };

    // Dừng sớm
    if (alpha.fitness >= fitThreshold) break;

    // Kiểm tra hội tụ
    if (iter > 20) {
      const recent = state.fitnessHistory.slice(-20);
      const variance = recent.reduce((sum, f) => sum + Math.pow(f - recent[0], 2), 0) / 20;
      if (variance < tol) break;
    }
  }

  return {
    bestSolution: [...alpha.position],
    bestFitness: alpha.fitness,
    iterations: state.iteration,
    state,
  };
}

/**
 * Improved GWO with adaptive weights and spiral update
 */
export function igwoOptimize(config: GWOConfig, fitnessFn: (x: number[]) => number): GWOResult {
  const n = config.dimension;
  const N = config.packSize ?? 30;
  const maxIter = config.maxIterations ?? 200;
  const bounds = config.bounds ?? Array.from({ length: n }, () => [-10, 10]);

  let wolves: Wolf[] = [];
  for (let i = 0; i < N; i++) {
    const position = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
    wolves.push({ id: i, position, fitness: -Infinity, rank: i });
  }

  wolves = evaluateAndRank(wolves, fitnessFn);
  let alpha = { ...wolves[0] };
  let beta = { ...wolves[1] };
  let delta = { ...wolves[2] };

  const fitnessHistory = [alpha.fitness];

  for (let iter = 0; iter < maxIter; iter++) {
    const a = 2 - (2 * iter) / maxIter;

    // Adaptive weights cho 3 leader
    const totalFitness = alpha.fitness + beta.fitness + delta.fitness;
    const w_alpha = alpha.fitness / totalFitness;
    const w_beta = beta.fitness / totalFitness;
    const w_delta = delta.fitness / totalFitness;

    for (let i = 3; i < N; i++) {
      const wolf = wolves[i];

      // Spiral update (logarithmic spiral)
      const r = Deterministic.random();
      const l = (Deterministic.random() - 0.5) * 2; // [-1, 1]
      const spiralA = 2 * a * r - a;
      const spiralFactor = Math.exp(l) * Math.cos(2 * Math.PI * l);

      // Encircling với adaptive weights
      for (let d = 0; d < n; d++) {
        const D_alpha = Math.abs(2 * Deterministic.random() * alpha.position[d] - wolf.position[d]);
        const D_beta = Math.abs(2 * Deterministic.random() * beta.position[d] - wolf.position[d]);
        const D_delta = Math.abs(2 * Deterministic.random() * delta.position[d] - wolf.position[d]);

        // Weighted update
        const X1 = alpha.position[d] - spiralA * D_alpha;
        const X2 = beta.position[d] - spiralA * D_beta;
        const X3 = delta.position[d] - spiralA * D_delta;

        wolf.position[d] = w_alpha * X1 + w_beta * X2 + w_delta * X3;

        // Spiral perturbation
        wolf.position[d] += spiralFactor * 0.1 * (wolf.position[d] - alpha.position[d]);

        wolf.position[d] = clamp(wolf.position[d], bounds[d][0], bounds[d][1]);
      }
    }

    wolves = evaluateAndRank(wolves, fitnessFn);

    if (wolves[0].fitness > alpha.fitness) alpha = { ...wolves[0] };
    if (wolves[1].fitness > beta.fitness) beta = { ...wolves[1] };
    if (wolves[2].fitness > delta.fitness) delta = { ...wolves[2] };

    fitnessHistory.push(alpha.fitness);
  }

  return {
    bestSolution: [...alpha.position],
    bestFitness: alpha.fitness,
    iterations: maxIter,
    state: {
      wolves: wolves.map((w) => ({ ...w })),
      alpha: { ...alpha },
      beta: { ...beta },
      delta: { ...delta },
      iteration: maxIter,
      fitnessHistory,
      a: 0,
      explorationRate: calculateDiversity(wolves),
    },
  };
}

/**
 * Multi-objective GWO
 */
export function mgwoOptimize(
  config: GWOConfig,
  fitnessFns: ((x: number[]) => number)[],
  bounds: [number, number][],
): { paretoFront: number[][]; paretoFitness: number[][] } {
  const n = config.dimension;
  const N = config.packSize ?? 50;
  const maxIter = config.maxIterations ?? 100;
  const objectives = fitnessFns.length;

  // Archive (Pareto front)
  let archive: { position: number[]; fitness: number[] }[] = [];
  const maxArchiveSize = 100;

  // Khởi tạo wolves
  const wolves: Wolf[] = [];
  for (let i = 0; i < N; i++) {
    const position = bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
    wolves.push({ id: i, position, fitness: -Infinity, rank: i });
  }

  // Crowding distance
  const crowdingDistance = (fits: number[][]): number[] => {
    const dist = new Array(fits.length).fill(0);
    for (let obj = 0; obj < objectives; obj++) {
      const sorted = Array.from({ length: fits.length }, (_, i) => i).sort((a, b) => fits[a][obj] - fits[b][obj]);
      dist[sorted[0]] = Infinity;
      dist[sorted[fits.length - 1]] = Infinity;
      const range = fits[sorted[fits.length - 1]][obj] - fits[sorted[0]][obj];
      if (range === 0) continue;
      for (let i = 1; i < fits.length - 1; i++) {
        dist[sorted[i]] += (fits[sorted[i + 1]][obj] - fits[sorted[i - 1]][obj]) / range;
      }
    }
    return dist;
  };

  // Select leader from archive
  const selectLeader = (): number[] => {
    if (archive.length === 0) {
      return bounds.map(([min, max]) => min + Deterministic.random() * (max - min));
    }
    const fits = archive.map((r) => r.fitness);
    const cd = crowdingDistance(fits);
    const totalCD = cd.reduce((a, b) => a + (b === Infinity ? 1000 : b), 0);
    let r = Deterministic.random() * totalCD;
    for (let i = 0; i < archive.length; i++) {
      r -= cd[i] === Infinity ? 1000 : cd[i];
      if (r <= 0) return archive[i].position;
    }
    return archive[archive.length - 1].position;
  };

  // Update archive
  const updateArchive = (position: number[], fitness: number[]) => {
    let dominated = false;
    const toRemove: number[] = [];

    for (let i = 0; i < archive.length; i++) {
      let dominates = true;
      let dominatedBy = true;
      for (let k = 0; k < objectives; k++) {
        if (fitness[k] < archive[i].fitness[k]) dominates = false;
        if (fitness[k] > archive[i].fitness[k]) dominatedBy = false;
      }
      if (dominatedBy) {
        dominated = true;
        break;
      }
      if (dominates) toRemove.push(i);
    }

    if (!dominated) {
      for (let i = toRemove.length - 1; i >= 0; i--) {
        archive.splice(toRemove[i], 1);
      }
      archive.push({ position: [...position], fitness: [...fitness] });
      if (archive.length > maxArchiveSize) {
        const fits = archive.map((r) => r.fitness);
        const cd = crowdingDistance(fits);
        const sorted = cd.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
        archive.splice(sorted[0].i, 1);
      }
    }
  };

  for (let iter = 0; iter < maxIter; iter++) {
    const a = 2 - (2 * iter) / maxIter;
    const leader_pos = selectLeader();

    for (const wolf of wolves) {
      for (let d = 0; d < n; d++) {
        const A = 2 * a * Deterministic.random() - a;
        const C = 2 * Deterministic.random();
        const D = Math.abs(C * leader_pos[d] - wolf.position[d]);
        wolf.position[d] = leader_pos[d] - A * D;
        wolf.position[d] = clamp(wolf.position[d], bounds[d][0], bounds[d][1]);
      }

      const fitness = fitnessFns.map((fn) => fn(wolf.position));
      updateArchive(wolf.position, fitness);
    }
  }

  return {
    paretoFront: archive.map((r) => r.position),
    paretoFitness: archive.map((r) => r.fitness),
  };
}

/**
 * Benchmark functions
 */
export const gwoBenchmarks = {
  sphere: (x: number[]): number => -x.reduce((sum, xi) => sum + xi * xi, 0),
  rastrigin: (x: number[]): number => {
    const n = x.length;
    return -(10 * n + x.reduce((sum, xi) => sum + xi * xi - 10 * Math.cos(2 * Math.PI * xi), 0));
  },
  rosenbrock: (x: number[]): number => {
    let sum = 0;
    for (let i = 0; i < x.length - 1; i++) {
      sum += 100 * Math.pow(x[i + 1] - x[i] * x[i], 2) + Math.pow(1 - x[i], 2);
    }
    return -sum;
  },
  ackley: (x: number[]): number => {
    const n = x.length;
    const sum1 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sum2 = x.reduce((sum, xi) => sum + Math.cos(2 * Math.PI * xi), 0);
    return -(20 * Math.exp(-0.2 * Math.sqrt(sum1 / n)) - Math.exp(sum2 / n) + 20 + Math.E);
  },
};

/**
 * Ví dụ sử dụng
 */
export function exampleGWO() {
  const result = gwoOptimize({ dimension: 5, packSize: 30, maxIterations: 100, huntingPhase: true }, gwoBenchmarks.ackley);

  return result;
}
