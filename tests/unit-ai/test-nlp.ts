import { trainAndSaveNlpModel, classifyIntent } from "./src/lib/agent/nlp.ts";

async function run() {
  console.log("=== STARTING TRAINING ===");
  const res = await trainAndSaveNlpModel();
  console.log("Training Result:", res.success);
  
  console.log("\n=== TESTING INFERENCE ===");
  const testQueries = [
    "tính xác suất rơi đồng xu",
    "muốn mua 500kg lúa",
    "thống kê lại kho hàng",
    "bạn khỏe không",
    "nhập hàng về kho bị lỗi",
  ];
  
  for (const q of testQueries) {
    const intent = await classifyIntent(q);
    console.log(`- Query: "${q}" -> Intent:`, intent);
  }
}
run();
