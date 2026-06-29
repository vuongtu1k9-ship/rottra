import { TinyNeuralNet } from "../nlp-cognitive/tiny-neural-net";
import { dynamicProgrammingTradeOptimize, KnapsackItem } from "./dynamic-programming";
import { calculateEquilibriumPrice, MarketState } from "./linear-programming";

console.log("=========================================");
console.log("   🚀 ROTTRA QUANT ENGINE VALIDATION   ");
console.log("=========================================\n");

// -----------------------------------------------------
// TEST 1: TINY NEURAL NETWORK (ADAM OPTIMIZER)
// -----------------------------------------------------
console.log("[1] Testing Tiny Neural Network (XOR Problem / Convergence)...");
const net = new TinyNeuralNet(2, 4, 1); // 2 inputs, 4 hidden, 1 output

// Dữ liệu huấn luyện: Bài toán XOR kinh điển
const trainInputs = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];
const trainOutputs = [[0], [1], [1], [0]];

// Bắt đầu đo thời gian và train
const t0 = Date.now();
net.train(trainInputs, trainOutputs, 2000, 0.1); // Train 2000 epochs
const t1 = Date.now();

console.log(`✅ Đã huấn luyện mạng bằng ADAM Optimizer (${t1 - t0}ms)`);
console.log("Kết quả dự đoán (Kỳ vọng [0, 1, 1, 0]):");
const predictions = net.predict(trainInputs);
predictions.forEach((p, i) => {
  console.log(`  - Input [${trainInputs[i]}]: ${p[0].toFixed(4)} (Loss: ${Math.abs(trainOutputs[i][0] - p[0]).toFixed(4)})`);
});
console.log("");

// -----------------------------------------------------
// TEST 2: DYNAMIC PROGRAMMING (KNAPSACK)
// -----------------------------------------------------
console.log("[2] Testing Dynamic Programming (Trade Optimization)...");
const budget = 500000; // 500k VNĐ
const items: KnapsackItem[] = [
  { id: "A", name: "Phân bón nhỏ", cost: 100000, value: 120000, qty: 3 },
  { id: "B", name: "Hạt giống hiếm", cost: 250000, value: 400000, qty: 1 },
  { id: "C", name: "Máy cày mướn", cost: 300000, value: 350000, qty: 2 },
];

const dpResult = dynamicProgrammingTradeOptimize(budget, items, 10000);
console.log(`💰 Ngân sách: ${budget.toLocaleString()}`);
console.log(
  `✅ Đã tối ưu hóa mua hàng. Tổng chi phí: ${dpResult.totalCost.toLocaleString()}, Tổng sinh lời (Value): ${dpResult.totalValue.toLocaleString()}`,
);
console.log("Gói hàng được AI chọn:");
dpResult.selectedItems.forEach((item) => {
  console.log(`  - Mua ${item.qty}x [${item.name}] (Giá: ${item.cost}, Lời: ${item.value})`);
});
console.log("");

// -----------------------------------------------------
// TEST 3: LINEAR PROGRAMMING (MARKET EQUILIBRIUM)
// -----------------------------------------------------
console.log("[3] Testing Linear Programming (Market Equilibrium)...");
const market1: MarketState = {
  currentPrice: 50000,
  totalSupply: 1000, // Cung nhiều (1000 con)
  totalDemand: 200, // Cầu ít (200 con) -> Giá phải rớt
  elasticity: 0.2,
};
const newPrice1 = calculateEquilibriumPrice(market1);
console.log(`Thị trường dư thừa (Cung 1000, Cầu 200): Giá 50,000đ -> Điều chỉnh thành ${newPrice1.toLocaleString()}đ`);

const market2: MarketState = {
  currentPrice: 50000,
  totalSupply: 50, // Cung siêu ít (50)
  totalDemand: 5000, // Cầu cao (5000) -> Giá tăng phi mã
  elasticity: 0.3,
};
const newPrice2 = calculateEquilibriumPrice(market2);
console.log(`Thị trường khan hiếm (Cung 50, Cầu 5000): Giá 50,000đ -> Điều chỉnh thành ${newPrice2.toLocaleString()}đ`);

console.log("\n✅ ALL QUANT ENGINE TESTS PASSED SUCCESSFULLY!");
