import { Deterministic } from "~/shared/utils/rng";
/**
 * CMA-ES (Covariance Matrix Adaptation Evolution Strategy)
 * Tiêu chuẩn vàng cho tối ưu hóa liên tục không cần đạo hàm
 *
 * Thuật toán tự động học ma trận hiệp phương sai để điều chỉnh
 * hướng tìm kiếm tối ưu, cực kỳ hiệu quả với hàm phức tạp,
 * nhiễu, hoặc có nhiều đỉnh cục bộ.
 */

export interface CMAESConfig {
  dimension: number; // Số chiều của không gian tìm kiếm
  populationSize?: number; // Kích thước quần thể (λ), mặc định = 4 + floor(3 * ln(n))
  sigma?: number; // Độ lệch chuẩn bước nhảy ban đầu (mutation strength)
  maxGenerations?: number; // Số thế hệ tối đa
  fitnessThreshold?: number; // Ngưỡng fitness dừng sớm
  tolerance?: number; // Ngưỡng hội tụ (độ biến thiên_fitness < tolerance)
}

export interface CMAESState {
  mean: number[]; // Vector trung bình (μ) - vị trí tốt nhất hiện tại
  sigma: number; // Mutation strength
  covariance: number[][]; // Ma trận hiệp phương sai (C)
  eigenvalues: number[]; // Giá trị riêng
  eigenvectors: number[][]; // Vector riêng
  generation: number;
  bestFitness: number;
  bestSolution: number[];
  fitnessHistory: number[];
}

export interface CMAESResult {
  bestSolution: number[];
  bestFitness: number;
  generations: number;
  convergenceRate: number;
  state: CMAESState;
}

/**
 * Tạo ma trận đơn vị I_n
 */
function identityMatrix(n: number): number[][] {
  const I: number[][] = [];
  for (let i = 0; i < n; i++) {
    I[i] = new Array(n).fill(0);
    I[i][i] = 1;
  }
  return I;
}

/**
 * Nhân ma trận với vector: M * v
 */
function matVecMul(M: number[][], v: number[]): number[] {
  const n = M.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += M[i][j] * v[j];
    }
  }
  return result;
}

/**
 * Cộng hai vector
 */
function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/**
 * Trừ hai vector
 */
function vecSub(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

/**
 * Tích vô hướng hai vector
 */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

/**
 * Nhân vô hướng scalar * vector
 */
function scalarMul(s: number, v: number[]): number[] {
  return v.map((x) => s * x);
}

/**
 * Outer product: a * b^T
 */
function outerProduct(a: number[], b: number[]): number[][] {
  const n = a.length;
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = a[i] * b[j];
    }
  }
  return result;
}

/**
 * Cộng hai ma trận
 */
function matAdd(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = A[i][j] + B[i][j];
    }
  }
  return result;
}

/**
 * Nhân ma trận với scalar
 */
function matScalarMul(s: number, M: number[][]): number[][] {
  return M.map((row) => row.map((v) => s * v));
}

/**
 * Phân rã Eigen (Jacobi eigenvalue algorithm) cho ma trận đối xứng
 * Trả về { eigenvalues, eigenvectors }
 */
function eigenDecomposition(M: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = M.length;
  // Copy ma trận
  let A = M.map((row) => [...row]);
  let V = identityMatrix(n);

  const maxIter = 100;
  const tol = 1e-10;

  for (let iter = 0; iter < maxIter; iter++) {
    // Tìm phần tử ngoài đường chéo lớn nhất
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < tol) break; // Đã hội tụ

    // Tính góc xoay Jacobi
    const theta = A[p][p] === A[q][q] ? Math.PI / 4 : 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Ma trận xoay J
    const J = identityMatrix(n);
    J[p][p] = c;
    J[q][q] = c;
    J[p][q] = s;
    J[q][p] = -s;

    // A = J^T * A * J
    const JT = J.map((row, i) => row.map((_, j) => J[j][i])); // Transpose
    const AJ = multiplyMatrices(A, J);
    A = multiplyMatrices(JT, AJ);

    // V = V * J
    V = multiplyMatrices(V, J);
  }

  // Eigenvalues = diagonal elements
  const eigenvalues = A.map((row, i) => row[i]);

  return { eigenvalues, eigenvectors: V };
}

/**
 * Nhân hai ma trận
 */
function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Tạo mẫu ngẫu nhiên từ phân phối chuẩn đa chiều
 * z ~ N(0, I), rồi transform bằng B (eigenvectors) và D (sqrt(eigenvalues))
 */
function sampleMultivariateNormal(dimension: number, eigenvectors: number[][], eigenvalues: number[]): number[] {
  // z ~ N(0, I)
  const z = Array.from({ length: dimension }, () => {
    // Box-Muller transform
    const u1 = Deterministic.random();
    const u2 = Deterministic.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  });

  // x = B * D^(1/2) * z
  // D^(1/2) * z
  const Dz = z.map((zi, i) => Math.sqrt(Math.max(0, eigenvalues[i])) * zi);

  // B * (D^(1/2) * z)
  return matVecMul(eigenvectors, Dz);
}

/**
 * Khởi tạo CMA-ES state
 */
export function initCMAES(config: CMAESConfig): CMAESState {
  const n = config.dimension;
  const lambda = config.populationSize ?? 4 + Math.floor(3 * Math.log(n));
  const sigma0 = config.sigma ?? 0.3;

  return {
    mean: new Array(n).fill(0), // Bắt đầu từ gốc tọa độ
    sigma: sigma0,
    covariance: identityMatrix(n),
    eigenvalues: new Array(n).fill(1),
    eigenvectors: identityMatrix(n),
    generation: 0,
    bestFitness: -Infinity,
    bestSolution: new Array(n).fill(0),
    fitnessHistory: [],
  };
}

/**
 * Chạy CMA-ES optimization
 *
 * @param config - Cấu hình bài toán
 * @param fitnessFn - Hàm fitness cần tối ưu hóa (maximize)
 * @param bounds - Giới hạn cho mỗi chiều [[min, max], ...] (tùy chọn)
 * @returns Kết quả tối ưu hóa
 */
export function cmaesOptimize(config: CMAESConfig, fitnessFn: (x: number[]) => number, bounds?: [number, number][]): CMAESResult {
  const n = config.dimension;
  const maxGen = config.maxGenerations ?? 500;
  const tol = config.tolerance ?? 1e-8;
  const fitThreshold = config.fitnessThreshold ?? Infinity;

  let state = initCMAES(config);

  // Strategy parameters cho CMA-ES
  const mu = Math.floor(config.populationSize ?? 4 + 3 * Math.log(n)) / 2; // Parents count
  const weights = Array.from({ length: mu }, (_, i) => {
    return Math.log(mu + 0.5) - Math.log(i + 1);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => w / weightSum);

  // Learning rates
  const muEff = 1 / normalizedWeights.reduce((w) => w * w, 0);
  const cc = (4 + muEff / n) / (n + 4 + (2 * muEff) / n);
  const cs = (muEff + 2) / (n + muEff + 5);
  const c1 = 2 / ((n + 1.3) * (n + 1.3) + muEff);
  const cmu = Math.min(1 - c1, (2 * muEff * (muEff - 1) + 0.00001) / ((n + 2) * (n + 2) + muEff));
  const damps = 1 + 2 * Math.max(0, Math.sqrt((muEff - 1) / (n + 1)) - 1) + cs;

  // Evolution paths
  let pc = new Array(n).fill(0); // Cumulative step path
  let ps = new Array(n).fill(0); // Evolution path for sigma

  let sigma = state.sigma;
  let C = state.covariance.map((row) => [...row]);
  let mean = [...state.mean];

  for (let gen = 0; gen < maxGen; gen++) {
    // 1. Phân rã eigen và tạo mẫu
    const { eigenvalues, eigenvectors } = eigenDecomposition(C);
    state.eigenvalues = eigenvalues;
    state.eigenvectors = eigenvectors;

    // 2. Tạo λ mẫu con
    const offspring: { x: number[]; fitness: number }[] = [];
    for (let i = 0; i < (config.populationSize ?? 4 + 3 * Math.log(n)); i++) {
      const z = sampleMultivariateNormal(n, eigenvectors, eigenvalues);
      const x = vecAdd(mean, scalarMul(sigma, z));

      // Clamp theo bounds nếu có
      if (bounds) {
        for (let d = 0; d < n; d++) {
          x[d] = Math.max(bounds[d][0], Math.min(bounds[d][1], x[d]));
        }
      }

      const fitness = fitnessFn(x);
      offspring.push({ x, fitness });
    }

    // 3. Sắp xếp theo fitness (giảm dần - maximize)
    offspring.sort((a, b) => b.fitness - a.fitness);

    // 4. Cập nhật mean (Recombination)
    const oldMean = [...mean];
    mean = new Array(n).fill(0);
    for (let i = 0; i < mu; i++) {
      const weighted = scalarMul(normalizedWeights[i], offspring[i].x);
      mean = vecAdd(mean, weighted);
    }

    // 5. Cập nhật evolution path
    const meanDiff = vecSub(mean, oldMean);
    const CinvSqrt = eigenvectors.map((v, i) => scalarMul(1 / Math.sqrt(Math.max(1e-20, eigenvalues[i])), v));
    const invSqrtDiff = matVecMul(CinvSqrt, scalarMul(1 / sigma, meanDiff));

    // hsig: Heuristic for sigma path
    const psNorm = Math.sqrt(dot(ps, ps));
    const expectedPsNorm = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    const hsig = psNorm / Math.sqrt(Math.pow(1 - cs, 2 * gen)) < 2 + 1.5 / (n - 0.5) ? 1 : 0;

    ps = vecAdd(scalarMul(1 - cs, ps), scalarMul(Math.sqrt(cs * (2 - cs) * muEff), scalarMul(hsig, invSqrtDiff)));

    // Cumulative step path for covariance
    const chsig = (1 - hsig) * cc * (2 - cc);
    pc = vecAdd(scalarMul(1 - cc, pc), scalarMul(Math.sqrt(cc * (2 - cc) * muEff) * (1 - chsig), scalarMul(sigma, meanDiff)));

    // 6. Cập nhật covariance matrix C
    // Rank-1 update
    const rank1 = outerProduct(pc, pc);
    C = matAdd(
      matAdd(C, matScalarMul(c1, rank1)),
      matScalarMul(-c1, C), // Remove old
    );

    // Rank-μ update
    const yDiff = offspring.slice(0, mu).map((o) => scalarMul(1 / sigma, vecSub(o.x, oldMean)));
    let rankMuUpdate: number[][] = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let i = 0; i < mu; i++) {
      const rankMuI = outerProduct(yDiff[i], yDiff[i]);
      rankMuUpdate = matAdd(rankMuUpdate, matScalarMul(normalizedWeights[i], rankMuI));
    }
    C = matAdd(C, matScalarMul(cmu, rankMuUpdate));

    // 7. Cập nhật sigma (Step size adaptation)
    const psSqNorm = dot(ps, ps);
    sigma = sigma * Math.exp((cs / damps) * (psSqNorm / n - 1));

    // 8. Track best
    if (offspring[0].fitness > state.bestFitness) {
      state.bestFitness = offspring[0].fitness;
      state.bestSolution = [...offspring[0].x];
    }

    state.fitnessHistory.push(state.bestFitness);
    state.generation = gen + 1;
    state.sigma = sigma;
    state.mean = mean;
    state.covariance = C;

    // Dừng sớm nếu đạt ngưỡng
    if (state.bestFitness >= fitThreshold) break;

    // Kiểm tra hội tụ
    if (gen > 10) {
      const recentFitness = state.fitnessHistory.slice(-10);
      const variance = recentFitness.reduce((sum, f) => sum + Math.pow(f - recentFitness[0], 2), 0) / 10;
      if (variance < tol) break;
    }
  }

  return {
    bestSolution: state.bestSolution,
    bestFitness: state.bestFitness,
    generations: state.generation,
    convergenceRate: state.generation < maxGen ? 1 : 0,
    state,
  };
}

/**
 * Ví dụ sử dụng: Tối ưu hóa hàm Rosenbrock (nhiều đỉnh cục bộ)
 */
export function exampleRosenbrock() {
  const rosenbrock = (x: number[]): number => {
    let sum = 0;
    for (let i = 0; i < x.length - 1; i++) {
      sum += 100 * Math.pow(x[i + 1] - x[i] * x[i], 2) + Math.pow(1 - x[i], 2);
    }
    return -sum; // Negate because CMA-ES maximizes
  };

  const result = cmaesOptimize({ dimension: 5, maxGenerations: 200 }, rosenbrock, [
    [-5, 5],
    [-5, 5],
    [-5, 5],
    [-5, 5],
    [-5, 5],
  ]);

  return result;
}
