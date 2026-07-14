import { Deterministic } from "~/shared/utils/rng";
import { AgentChromosome, initializePopulation, evolvePopulation } from "./genetic-algorithm";
import { calculateEquilibriumPrice, MarketState } from "../quant-engine/linear-programming";
import { dynamicProgrammingTradeOptimize, KnapsackItem } from "../quant-engine/dynamic-programming";

/**
 * Meta-Harness: The Evolution Reactor
 * Lò phản ứng giả lập để chạy thử nghiệm các thuật toán Sinh tồn
 */

const POPULATION_SIZE = 100;
const TOTAL_GENERATIONS = 50;
const INITIAL_BUDGET = 500000; // 500k VNĐ

// Hàm mô phỏng 1 chu kỳ kinh tế (1 Epoch của thế hệ)
function simulateEconomicCycle(population: AgentChromosome[]) {
  // Môi trường thị trường ngẫu nhiên cho chu kỳ này
  const market: MarketState = {
    currentPrice: 50000,
    totalSupply: 500 + Deterministic.random() * 2000, // Ngẫu nhiên Cung
    totalDemand: 1000 + Deterministic.random() * 3000, // Ngẫu nhiên Cầu
    elasticity: 0.2,
  };

  // Linear Programming tính giá Cân bằng
  const basePrice = calculateEquilibriumPrice(market);

  // Tạo các gói hàng ngẫu nhiên (Items) trên chợ
  const marketItems: KnapsackItem[] = [];
  for (let i = 0; i < 5; i++) {
    // Giá thực tế dao động quanh BasePrice
    const cost = Math.max(10000, basePrice * (0.5 + Deterministic.random()));
    // Giá trị tương lai (Intrinsic Value) có thể cao hoặc thấp hơn chi phí (Lỗ/Lãi)
    const futureValue = cost * (0.8 + Deterministic.random() * 0.6);
    marketItems.push({
      id: `Item_${i}`,
      name: `Sản phẩm ${i}`,
      cost: cost,
      value: futureValue,
      qty: Math.floor(Deterministic.random() * 5) + 1,
    });
  }

  // Mỗi Agent bắt đầu đi chợ
  for (const agent of population) {
    let budget = INITIAL_BUDGET;
    const { greed, riskTolerance, priceSensitivity } = agent.dna;

    // Ảnh hưởng của DNA lên việc ra quyết định
    // Nếu nhạy cảm về giá (PriceSensitive cao) mà giá base quá cao -> Agent từ chối mua
    const isPriceTooHigh = basePrice > 60000;
    if (isPriceTooHigh && Deterministic.random() < priceSensitivity) {
      // Giữ tiền mặt, không mua bán
      agent.fitnessScore = budget;
      continue;
    }

    // Agent điều chỉnh góc nhìn "Value" của sản phẩm bằng Lòng Tham và Khẩu vị rủi ro
    const perceivedItems = marketItems.map((item) => {
      let perceivedValue = item.value;
      // Người tham lam sẽ tự thôi miên là hàng này rất có giá trị
      perceivedValue *= 1 + greed * 0.3;
      // Chấp nhận rủi ro: Đánh giá cao những món hàng đắt tiền
      if (item.cost > 100000) {
        perceivedValue *= 1 + riskTolerance * 0.5;
      }
      return { ...item, value: perceivedValue };
    });

    // Gọi Quy hoạch động (Knapsack DP) để mua hàng tối ưu nhất theo góc nhìn cá nhân
    const dpResult = dynamicProgrammingTradeOptimize(budget, perceivedItems, 10000);

    // Đánh giá thực tế (Fitness = Tiền còn dư + Giá trị thực của số hàng đã mua)
    const remainingBudget = budget - dpResult.totalCost;

    // Tính lại giá trị THỰC TẾ của hàng đã mua (Không tính theo giá ảo mộng của AI)
    let actualValueAcquired = 0;
    for (const selected of dpResult.selectedItems) {
      const realItem = marketItems.find((m) => m.id === selected.id);
      if (realItem) {
        actualValueAcquired += realItem.value * selected.qty;
      }
    }

    agent.fitnessScore = remainingBudget + actualValueAcquired;
  }
}

// Bắt đầu Lò Phản Ứng
console.log("==================================================");
console.log(" 🧬 ROTTRA META-HARNESS EVOLUTION REACTOR STARTED ");
console.log("==================================================\n");

let currentPopulation = initializePopulation(POPULATION_SIZE);

for (let gen = 1; gen <= TOTAL_GENERATIONS; gen++) {
  // 1. Chạy mô phỏng vòng đời
  simulateEconomicCycle(currentPopulation);

  // 2. Tính toán Lợi nhuận trung bình để Report
  const totalFitness = currentPopulation.reduce((sum, agent) => sum + agent.fitnessScore, 0);
  const avgFitness = totalFitness / POPULATION_SIZE;
  const bestAgent = currentPopulation.reduce((prev, curr) => (prev.fitnessScore > curr.fitnessScore ? prev : curr));

  if (gen === 1 || gen % 10 === 0) {
    console.log(
      `[Thế hệ ${gen}] Lợi nhuận trung bình: ${avgFitness.toLocaleString()} đ | Sinh tồn: Best = ${bestAgent.fitnessScore.toLocaleString()} đ`,
    );
    console.log(
      `   -> The Elite DNA [Greed: ${bestAgent.dna.greed.toFixed(2)}, Venge: ${bestAgent.dna.vengeance.toFixed(2)}, Risk: ${bestAgent.dna.riskTolerance.toFixed(2)}, Sensitive: ${bestAgent.dna.priceSensitivity.toFixed(2)}]`,
    );
  }

  // 3. Tiến hóa sang Thế hệ sau
  if (gen < TOTAL_GENERATIONS) {
    currentPopulation = evolvePopulation(currentPopulation, gen + 1, 0.2, 0.05);
  }
}

console.log("\n✅ EVOLUTION COMPLETED!");
const ultimateAgent = currentPopulation.reduce((prev, curr) => (prev.fitnessScore > curr.fitnessScore ? prev : curr));
console.log("🎉 The Ultimate AI DNA (Gen tối thượng đã được tối ưu hóa sau 50 Thế hệ):");
console.log(JSON.stringify(ultimateAgent.dna, null, 2));
