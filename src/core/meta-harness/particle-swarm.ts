/**
 * Particle Swarm Optimization (PSO)
 * Trí tuệ bầy đàn - mô phỏng hành vi di chuyển của đàn chim/đàn cá
 *
 * Mỗi "hạt" (particle) di chuyển qua không gian tìm kiếm, điều chỉnh
 * vị trí dựa trên kinh nghiệm cá nhân (pbest) và thành công của các
 * láng giềng (gbest). Không cần thay thế theo thế hệ như GA.
 *
 * Ứng dụng: Tối ưu hóa đa modal, neural network training, robotics
 */

export interface PSOConfig {
  dimension: number; // Số chiều không gian tìm kiếm
  swarmSize?: number; // Kích thước bầy (N), mặc định = 30
  maxIterations?: number; // Số vòng lặp tối đa
  bounds?: [number, number][]; // Giới hạn [[min, max], ...] cho mỗi chiều
  inertiaWeight?: number; // Hệ số quán tính (w), [0.4, 0.9], mặc định = 0.7
  cognitiveCoeff?: number; // Hệ số nhận thức (c1), mặc định = 1.5
  socialCoeff?: number; // Hệ số xã hội (c2), mặc định = 1.5
  velocityClamp?: [number, number]; // Giới hạn vận tốc [vMin, vMax]
  topology?: PSOTopology; // Loại topology liên kết
  fitnessThreshold?: number; // Ngưỡng fitness dừng sớm
  tolerance?: number; // Ngưỡng hội tụ
  adaptiveInertia?: boolean; // Tự động điều chỉnh inertia weight
}

export type PSOTopology =
  | "global" // gbest: toàn bộ bầy liên kết
  | "local" // lbest: chỉ liên kết với hàng xóm gần nhất
  | "ring" // Ring topology: liên kết theo vòng tròn
  | "von_neumann"; // Von Neumann: lưới 2D

export interface Particle {
  id: number;
  position: number[]; // Vị trí hiện tại (x)
  velocity: number[]; // Vận tốc hiện tại (v)
  pbest: number[]; // Best position cá nhân
  pbestFitness: number; // Fitness tốt nhất cá nhân
  currentFitness: number; // Fitness hiện tại
  neighborhood: number[]; // Chỉ số láng giềng (cho local topology)
}

export interface PSOState {
  particles: Particle[];
  gbest: number[]; // Global best position
  gbestFitness: number; // Global best fitness
  iteration: number;
  fitnessHistory: number[];
  swarmDiversity: number;
  convergenceRate: number;
}

export interface PSOResult {
  bestSolution: number[];
  bestFitness: number;
  iterations: number;
  state: PSOState;
}

/**
 * Khởi tạo vận tốc ngẫu nhiên
 */
function initVelocity(dimension: number, bounds: [number, number][]): number[] {
  return bounds.map(([min, max]) => {
    const range = max - min;
    return (Math.random() - 0.5) * range * 0.1; // 10% của range
  });
}

/**
 * Clamp value trong bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Tạo swarm ngẫu nhiên
 */
function createSwarm(dimension: number, swarmSize: number, bounds: [number, number][], fitnessFn: (x: number[]) => number): Particle[] {
  const particles: Particle[] = [];

  for (let i = 0; i < swarmSize; i++) {
    // Vị trí ngẫu nhiên trong bounds
    const position = bounds.map(([min, max]) => min + Math.random() * (max - min));
    const velocity = initVelocity(dimension, bounds);
    const currentFitness = fitnessFn(position);

    particles.push({
      id: i,
      position,
      velocity,
      pbest: [...position],
      pbestFitness: currentFitness,
      currentFitness,
      neighborhood: [],
    });
  }

  return particles;
}

/**
 * Tạo neighborhood cho local topology
 */
function createLocalTopology(particles: Particle[], k: number = 3): void {
  const N = particles.length;
  for (let i = 0; i < N; i++) {
    const neighbors: number[] = [];
    for (let j = 1; j <= k; j++) {
      neighbors.push((i + j) % N);
      neighbors.push((i - j + N) % N);
    }
    particles[i].neighborhood = [...new Set(neighbors)];
  }
}

/**
 * Tạo ring topology
 */
function createRingTopology(particles: Particle[]): void {
  const N = particles.length;
  for (let i = 0; i < N; i++) {
    particles[i].neighborhood = [(i + 1) % N, (i - 1 + N) % N];
  }
}

/**
 * Tạo Von Neumann topology (lưới 2D)
 */
function createVonNeumannTopology(particles: Particle[]): void {
  const N = particles.length;
  const cols = Math.ceil(Math.sqrt(N));

  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const neighbors: number[] = [];

    // Trên
    if (row > 0) neighbors.push(i - cols);
    // Dưới
    if (row < Math.floor((N - 1) / cols)) neighbors.push(i + cols);
    // Trái
    if (col > 0) neighbors.push(i - 1);
    // Phải
    if (col < cols - 1 && i + 1 < N) neighbors.push(i + 1);

    particles[i].neighborhood = neighbors;
  }
}

/**
 * Tìm best trong neighborhood
 */
function findLocalBest(particle: Particle, particles: Particle[]): { position: number[]; fitness: number } {
  let best = { position: particle.pbest, fitness: particle.pbestFitness };

  for (const idx of particle.neighborhood) {
    if (particles[idx].pbestFitness > best.fitness) {
      best = { position: particles[idx].pbest, fitness: particles[idx].pbestFitness };
    }
  }

  return best;
}

/**
 * Tính diversity của swarm
 */
function calculateDiversity(particles: Particle[]): number {
  const N = particles.length;
  const dim = particles[0].position.length;

  // Centroid
  const centroid = new Array(dim).fill(0);
  for (const p of particles) {
    for (let d = 0; d < dim; d++) {
      centroid[d] += p.position[d];
    }
  }
  for (let d = 0; d < dim; d++) {
    centroid[d] /= N;
  }

  // Average distance to centroid
  let totalDist = 0;
  for (const p of particles) {
    let dist = 0;
    for (let d = 0; d < dim; d++) {
      dist += Math.pow(p.position[d] - centroid[d], 2);
    }
    totalDist += Math.sqrt(dist);
  }

  return totalDist / N;
}

/**
 * Cập nhật inertia weight (adaptive)
 */
function adaptInertia(w: number, iteration: number, maxIter: number, diversity: number, diversityThreshold: number = 0.1): number {
  // Linear decrease
  const wMin = 0.4;
  const wMax = 0.9;
  const wLinear = wMax - (wMax - wMin) * (iteration / maxIter);

  // Nếu diversity thấp, giảm w đểexploitation nhiều hơn
  if (diversity < diversityThreshold) {
    return Math.max(wMin, wLinear * 0.8);
  }

  return wLinear;
}

/**
 * Chạy PSO optimization
 *
 * @param config - Cấu hình PSO
 * @param fitnessFn - Hàm fitness cần tối ưu hóa (maximize)
 * @returns Kết quả tối ưu hóa
 */
export function psoOptimize(config: PSOConfig, fitnessFn: (x: number[]) => number): PSOResult {
  const n = config.dimension;
  const N = config.swarmSize ?? 30;
  const maxIter = config.maxIterations ?? 200;
  const bounds = config.bounds ?? Array.from({ length: n }, () => [-10, 10]);
  let w = config.inertiaWeight ?? 0.7;
  const c1 = config.cognitiveCoeff ?? 1.5;
  const c2 = config.socialCoeff ?? 1.5;
  const topology = config.topology ?? "global";
  const adaptiveW = config.adaptiveInertia ?? false;
  const tol = config.tolerance ?? 1e-8;
  const fitThreshold = config.fitnessThreshold ?? Infinity;

  // Velocity clamping
  const vMax: number[] = config.velocityClamp ? new Array(n).fill(config.velocityClamp[1]) : bounds.map(([min, max]) => (max - min) * 0.2);
  const vMin: number[] = config.velocityClamp ? new Array(n).fill(config.velocityClamp[0]) : bounds.map(([min, max]) => -(max - min) * 0.2);

  // Khởi tạo swarm
  let particles = createSwarm(n, N, bounds, fitnessFn);

  // Tạo topology
  switch (topology) {
    case "local":
      createLocalTopology(particles);
      break;
    case "ring":
      createRingTopology(particles);
      break;
    case "von_neumann":
      createVonNeumannTopology(particles);
      break;
    default: // global - không cần neighborhood
      break;
  }

  // Tìm global best ban đầu
  let gbest = particles[0].pbest;
  let gbestFitness = particles[0].pbestFitness;

  for (const p of particles) {
    if (p.pbestFitness > gbestFitness) {
      gbestFitness = p.pbestFitness;
      gbest = [...p.pbest];
    }
  }

  let state: PSOState = {
    particles: particles.map((p) => ({ ...p })),
    gbest: [...gbest],
    gbestFitness,
    iteration: 0,
    fitnessHistory: [gbestFitness],
    swarmDiversity: calculateDiversity(particles),
    convergenceRate: 0,
  };

  for (let iter = 0; iter < maxIter; iter++) {
    const diversity = calculateDiversity(particles);

    // Adaptive inertia
    if (adaptiveW) {
      w = adaptInertia(w, iter, maxIter, diversity);
    }

    for (const particle of particles) {
      // Xác định reference point (gbest hoặc lbest)
      let reference = gbest;
      if (topology !== "global") {
        const localBest = findLocalBest(particle, particles);
        reference = localBest.position;
      }

      // Cập nhật vận tốc
      for (let d = 0; d < n; d++) {
        const r1 = Math.random();
        const r2 = Math.random();

        const cognitiveComponent = c1 * r1 * (particle.pbest[d] - particle.position[d]);
        const socialComponent = c2 * r2 * (reference[d] - particle.position[d]);

        particle.velocity[d] = w * particle.velocity[d] + cognitiveComponent + socialComponent;

        // Velocity clamping
        particle.velocity[d] = clamp(particle.velocity[d], vMin[d], vMax[d]);
      }

      // Cập nhật vị trí
      for (let d = 0; d < n; d++) {
        particle.position[d] += particle.velocity[d];

        // Position clamping
        particle.position[d] = clamp(particle.position[d], bounds[d][0], bounds[d][1]);
      }

      // Đánh giá fitness
      particle.currentFitness = fitnessFn(particle.position);

      // Cập nhật pbest
      if (particle.currentFitness > particle.pbestFitness) {
        particle.pbestFitness = particle.currentFitness;
        particle.pbest = [...particle.position];
      }

      // Cập nhật gbest
      if (particle.currentFitness > gbestFitness) {
        gbestFitness = particle.currentFitness;
        gbest = [...particle.position];
      }
    }

    state = {
      particles: particles.map((p) => ({ ...p })),
      gbest: [...gbest],
      gbestFitness,
      iteration: iter + 1,
      fitnessHistory: [...state.fitnessHistory, gbestFitness],
      swarmDiversity: diversity,
      convergenceRate: iter > 0 ? (gbestFitness - state.fitnessHistory[iter]) / (iter + 1) : 0,
    };

    // Dừng sớm
    if (gbestFitness >= fitThreshold) break;

    // Kiểm tra hội tụ
    if (iter > 20) {
      const recent = state.fitnessHistory.slice(-20);
      const variance = recent.reduce((sum, f) => sum + Math.pow(f - recent[0], 2), 0) / 20;
      if (variance < tol) break;
    }
  }

  return {
    bestSolution: gbest,
    bestFitness: gbestFitness,
    iterations: state.iteration,
    state,
  };
}

/**
 * Multi-objective PSO (MOPSO)
 */
export function mopsoOptimize(
  config: PSOConfig,
  fitnessFns: ((x: number[]) => number)[],
  bounds: [number, number][],
): { paretoFront: number[][]; paretoFitness: number[][] } {
  const n = config.dimension;
  const N = config.swarmSize ?? 50;
  const maxIter = config.maxIterations ?? 100;
  const objectives = fitnessFns.length;

  // Repository (Pareto archive)
  let repository: { position: number[]; fitness: number[] }[] = [];
  const maxRepositorySize = 100;

  // Khởi tạo particles
  const particles = createSwarm(n, N, bounds, (x) => fitnessFns[0](x));

  // Crowding distance cho repository
  const crowdingDistance = (fits: number[][]): number[] => {
    const size = fits.length;
    const dist = new Array(size).fill(0);

    for (let obj = 0; obj < objectives; obj++) {
      const sorted = Array.from({ length: size }, (_, i) => i).sort((a, b) => fits[a][obj] - fits[b][obj]);
      dist[sorted[0]] = Infinity;
      dist[sorted[size - 1]] = Infinity;
      const range = fits[sorted[size - 1]][obj] - fits[sorted[0]][obj];
      if (range === 0) continue;
      for (let i = 1; i < size - 1; i++) {
        dist[sorted[i]] += (fits[sorted[i + 1]][obj] - fits[sorted[i - 1]][obj]) / range;
      }
    }
    return dist;
  };

  // Non-dominated sorting
  const nonDominatedSort = (fits: number[][]): number[][] => {
    const fronts: number[][] = [];
    const dominatedCount = new Array(fits.length).fill(0);
    const dominatesSet: number[][] = Array.from({ length: fits.length }, () => []);

    for (let i = 0; i < fits.length; i++) {
      for (let j = i + 1; j < fits.length; j++) {
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
    for (let i = 0; i < fits.length; i++) {
      if (dominatedCount[i] === 0) {
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
            nextFront.push(j);
          }
        }
      }
      frontIdx++;
      if (nextFront.length > 0) fronts.push(nextFront);
    }

    return fronts;
  };

  // Chọn leader từ repository
  const selectLeader = (): number[] => {
    if (repository.length === 0) {
      return bounds.map(([min, max]) => min + Math.random() * (max - min));
    }

    const fits = repository.map((r) => r.fitness);
    const cd = crowdingDistance(fits);

    // Roulette wheel trên crowding distance
    const totalCD = cd.reduce((a, b) => a + (b === Infinity ? 1000 : b), 0);
    let r = Math.random() * totalCD;
    for (let i = 0; i < repository.length; i++) {
      r -= cd[i] === Infinity ? 1000 : cd[i];
      if (r <= 0) {
        return repository[i].position;
      }
    }
    return repository[repository.length - 1].position;
  };

  // Cập nhật repository
  const updateRepository = (position: number[], fitness: number[]) => {
    // Kiểm tra dominance
    let dominated = false;
    const toRemove: number[] = [];

    for (let i = 0; i < repository.length; i++) {
      let dominates = true;
      let dominatedBy = true;
      for (let k = 0; k < objectives; k++) {
        if (fitness[k] < repository[i].fitness[k]) dominates = false;
        if (fitness[k] > repository[i].fitness[k]) dominatedBy = false;
      }
      if (dominatedBy) {
        dominated = true;
        break;
      }
      if (dominates) {
        toRemove.push(i);
      }
    }

    if (!dominated) {
      // Xóa dominated solutions
      for (let i = toRemove.length - 1; i >= 0; i--) {
        repository.splice(toRemove[i], 1);
      }
      repository.push({ position: [...position], fitness: [...fitness] });

      // Giữ kích thước repository
      if (repository.length > maxRepositorySize) {
        const fits = repository.map((r) => r.fitness);
        const cd = crowdingDistance(fits);
        const sorted = cd.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d);
        repository.splice(sorted[0].i, 1);
      }
    }
  };

  // Main loop
  const w = config.inertiaWeight ?? 0.7;
  const c1 = config.cognitiveCoeff ?? 1.5;
  const c2 = config.socialCoeff ?? 1.5;

  for (let iter = 0; iter < maxIter; iter++) {
    for (const particle of particles) {
      const leader = selectLeader();

      // Cập nhật vận tốc
      for (let d = 0; d < n; d++) {
        const r1 = Math.random();
        const r2 = Math.random();
        particle.velocity[d] =
          w * particle.velocity[d] + c1 * r1 * (particle.pbest[d] - particle.position[d]) + c2 * r2 * (leader[d] - particle.position[d]);
        particle.velocity[d] = clamp(particle.velocity[d], -1, 1);
      }

      // Cập nhật vị trí
      for (let d = 0; d < n; d++) {
        particle.position[d] += particle.velocity[d];
        particle.position[d] = clamp(particle.position[d], bounds[d][0], bounds[d][1]);
      }

      // Đánh giá fitness
      const fitness = fitnessFns.map((fn) => fn(particle.position));

      // Cập nhật pbest (dùng non-domination comparison)
      let dominated = false;
      for (let k = 0; k < objectives; k++) {
        if (fitness[k] < particle.pbestFitness) {
          dominated = true;
          break;
        }
      }
      if (!dominated) {
        particle.pbestFitness = fitness[0]; // Simplified
        particle.pbest = [...particle.position];
      }

      // Cập nhật repository
      updateRepository(particle.position, fitness);
    }
  }

  return {
    paretoFront: repository.map((r) => r.position),
    paretoFitness: repository.map((r) => r.fitness),
  };
}

/**
 * Ví dụ: Tối ưu hóa hàm Sphere
 */
export function examplePSO() {
  const sphere = (x: number[]): number => {
    return -x.reduce((sum, xi) => sum + xi * xi, 0);
  };

  const result = psoOptimize(
    {
      dimension: 5,
      swarmSize: 30,
      maxIterations: 100,
      topology: "global",
      adaptiveInertia: true,
    },
    sphere,
  );

  return result;
}
