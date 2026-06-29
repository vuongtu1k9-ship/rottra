/**
 * Meta-Heuristics: Genetic Algorithm (Thuật toán Di truyền)
 * Tối ưu hóa siêu suy diễn dành cho Rottra Agents
 */

export interface AgentDNA {
  greed: number; // Lòng tham (0 -> 1.0): Ảnh hưởng đến mức độ ép giá
  vengeance: number; // Thù dai (0 -> 1.0): Ảnh hưởng việc cạch mặt đối thủ
  riskTolerance: number; // Chấp nhận rủi ro (0 -> 1.0): Mua hàng giá cao nhưng rủi ro sinh lời lớn
  priceSensitivity: number; // Độ nhạy giá (0 -> 1.0): Dễ bị thao túng bởi giá rẻ hay không
}

export interface AgentChromosome {
  id: string;
  dna: AgentDNA;
  fitnessScore: number; // Tương đương tổng tài sản (Profit) sau quá trình sinh tồn
}

export function generateRandomDNA(): AgentDNA {
  return {
    greed: Math.random(),
    vengeance: Math.random(),
    riskTolerance: Math.random(),
    priceSensitivity: Math.random(),
  };
}

/**
 * Khởi tạo một Quần thể (Population) các Đặc vụ
 */
export function initializePopulation(size: number): AgentChromosome[] {
  const population: AgentChromosome[] = [];
  for (let i = 0; i < size; i++) {
    population.push({
      id: `Agent_Gen0_${i}`,
      dna: generateRandomDNA(),
      fitnessScore: 0,
    });
  }
  return population;
}

/**
 * Lai ghép (Crossover) 2 đoạn DNA để tạo ra con cái mang Gen của cả bố và mẹ
 * Dùng phương pháp Uniform Crossover (lấy ngẫu nhiên 50/50)
 */
export function crossover(dna1: AgentDNA, dna2: AgentDNA): AgentDNA {
  return {
    greed: Math.random() > 0.5 ? dna1.greed : dna2.greed,
    vengeance: Math.random() > 0.5 ? dna1.vengeance : dna2.vengeance,
    riskTolerance: Math.random() > 0.5 ? dna1.riskTolerance : dna2.riskTolerance,
    priceSensitivity: Math.random() > 0.5 ? dna1.priceSensitivity : dna2.priceSensitivity,
  };
}

/**
 * Đột biến gen (Mutation)
 * Nhằm tránh kẹt ở cực tiểu địa phương (Local Minima) trong hệ sinh thái
 */
export function mutate(dna: AgentDNA, mutationRate: number = 0.05): AgentDNA {
  const newDna = { ...dna };
  if (Math.random() < mutationRate) newDna.greed = Math.random();
  if (Math.random() < mutationRate) newDna.vengeance = Math.random();
  if (Math.random() < mutationRate) newDna.riskTolerance = Math.random();
  if (Math.random() < mutationRate) newDna.priceSensitivity = Math.random();
  return newDna;
}

/**
 * Chọn lọc Tự nhiên (Natural Selection)
 * Lấy Top tinh anh, vứt bỏ những con yếu kém, sinh ra thế hệ mới
 */
export function evolvePopulation(
  population: AgentChromosome[],
  generation: number,
  survivalRate: number = 0.2,
  mutationRate: number = 0.05,
): AgentChromosome[] {
  // 1. Xếp hạng Fitness (Lợi nhuận giảm dần)
  const sorted = [...population].sort((a, b) => b.fitnessScore - a.fitnessScore);

  // 2. Chọn ra những cá thể sống sót (The Elites)
  const survivorsCount = Math.max(2, Math.floor(sorted.length * survivalRate));
  const elites = sorted.slice(0, survivorsCount);

  const nextGeneration: AgentChromosome[] = [];

  // 3. Elitism: Giữ nguyên vẹn 1-2 con xuất sắc nhất (Không lai ghép/Không đột biến) để bảo tồn Gen
  nextGeneration.push({ id: `Agent_Gen${generation}_Elite0`, dna: { ...elites[0].dna }, fitnessScore: 0 });
  nextGeneration.push({ id: `Agent_Gen${generation}_Elite1`, dna: { ...elites[1].dna }, fitnessScore: 0 });

  // 4. Lai ghép & Sinh sản cho đủ sĩ số Quần thể
  while (nextGeneration.length < population.length) {
    // Chọn ngẫu nhiên 2 bố mẹ từ nhóm Tinh anh
    const parent1 = elites[Math.floor(Math.random() * elites.length)].dna;
    const parent2 = elites[Math.floor(Math.random() * elites.length)].dna;

    // Lai ghép
    let childDNA = crossover(parent1, parent2);
    // Đột biến
    childDNA = mutate(childDNA, mutationRate);

    nextGeneration.push({
      id: `Agent_Gen${generation}_Child${nextGeneration.length}`,
      dna: childDNA,
      fitnessScore: 0,
    });
  }

  return nextGeneration;
}
