/**
 * Meta-Harness: Evolutionary & Swarm Intelligence Algorithms Suite
 * Bộ sưu tập đầy đủ các thuật toán tối ưu hóa cho Rottra
 *
 * THUẬT TOÁN TIẾN HÓA:
 * - Genetic Algorithm (GA) - Cổ điển với elitism
 * - CMA-ES - Tiêu chuẩn vàng cho tối ưu hóa liên tục
 * - Differential Evolution (DE) - Mạnh mẽ cho tham số thực
 * - LLM-driven Auto-EA - AI tự thiết kế thuật toán
 *
 * THUẬT TOÁN TRÍ TUỆ BẦY ĐÀN:
 * - Particle Swarm Optimization (PSO) - Trí tuệ bầy đàn
 * - Grey Wolf Optimizer (GWO) - Hệ thống sói xám
 */

// Genetic Algorithm
export {
  type AgentDNA,
  type AgentChromosome,
  generateRandomDNA,
  initializePopulation,
  crossover,
  mutate,
  evolvePopulation,
} from "./genetic-algorithm";

// CMA-ES
export { type CMAESConfig, type CMAESState, type CMAESResult, initCMAES, cmaesOptimize, exampleRosenbrock } from "./cma-es";

// Differential Evolution
export {
  type DEConfig,
  type DEState,
  type DEResult,
  type DEStrategy,
  deOptimize,
  deMultiObjective,
  exampleAckley,
} from "./differential-evolution";

// LLM-driven Auto-EA
export {
  type EvolutionStrategy,
  type EvolutionOperator,
  type SelectionMethod,
  type ReplacementMethod,
  type AlgorithmGenome,
  type AutoEAConfig,
  autoEADesign,
  benchmarkFunctions,
  exampleAutoEA,
} from "./llm-evolution";

// Particle Swarm Optimization (PSO)
export {
  type PSOConfig,
  type PSOTopology,
  type Particle,
  type PSOState,
  type PSOResult,
  psoOptimize,
  mopsoOptimize,
  examplePSO,
} from "./particle-swarm";

// Grey Wolf Optimizer (GWO)
export {
  type GWOConfig,
  type Wolf,
  type GWOState,
  type GWOResult,
  gwoOptimize,
  igwoOptimize,
  mgwoOptimize,
  gwoBenchmarks,
  exampleGWO,
} from "./grey-wolf";
