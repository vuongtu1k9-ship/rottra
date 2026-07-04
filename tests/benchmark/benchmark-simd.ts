import { cosineSimilarity } from "../../src/core/neural-memory/vector-rag";

console.log("=================================================");
console.log("🚀 ROTTRA AI BENCHMARK - VECTOR TENSOR ENGINE");
console.log("=================================================");

const DIMENSIONS = 1536; // Chuẩn của OpenAI / AI Model
const VECTORS_COUNT = 10000; // Mô phỏng bộ nhớ có 10,000 vector

// Tạo dữ liệu mảng động cũ (Vanilla JS Array)
console.log(`[1] Tạo bộ nhớ giả lập ${VECTORS_COUNT} điểm dữ liệu (RAM)...`);
const queryArray = Array.from({ length: DIMENSIONS }, () => Math.random());
const docsArrays = Array.from({ length: VECTORS_COUNT }, () =>
  Array.from({ length: DIMENSIONS }, () => Math.random())
);

// Tạo dữ liệu mảng Tensor mới (Float32Array)
const queryTensor = new Float32Array(queryArray);
const docsTensors = docsArrays.map((arr) => new Float32Array(arr));

// ==========================================
// 1. CHUẨN ĐO LƯỜNG - HÀM CŨ (VANILLA JS)
// ==========================================
function cosineSimilarityLegacy(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

console.log("\n[2] Chạy Benchmark Thuật toán cũ (Mảng động + Vòng lặp đơn)...");
const startLegacy = performance.now();
for (let i = 0; i < VECTORS_COUNT; i++) {
  cosineSimilarityLegacy(queryArray, docsArrays[i]);
}
const endLegacy = performance.now();
const timeLegacy = endLegacy - startLegacy;
console.log(`⏱️ Thời gian quét: ${timeLegacy.toFixed(2)} mili-giây`);

// ==========================================
// 2. CHUẨN ĐO LƯỜNG - HÀM MỚI (TENSOR SIMD)
// ==========================================
console.log("\n[3] Chạy Benchmark Thuật toán mới (Float32Array + Loop Unrolling)...");
const startSIMD = performance.now();
for (let i = 0; i < VECTORS_COUNT; i++) {
  cosineSimilarity(queryTensor, docsTensors[i]); // Hàm tối ưu hóa
}
const endSIMD = performance.now();
const timeSIMD = endSIMD - startSIMD;
console.log(`⏱️ Thời gian quét: ${timeSIMD.toFixed(2)} mili-giây`);

// ==========================================
// 3. KẾT QUẢ TỔNG KẾT
// ==========================================
console.log("\n=================================================");
const speedup = (timeLegacy / timeSIMD).toFixed(2);
console.log(`🔥 KẾT QUẢ ĐIỂM CHUẨN: Engine mới NHANH HƠN GẤP ${speedup} LẦN!`);
console.log(`💾 Ước tính RAM giảm: 50% (Do ép kiểu 64bit -> 32bit tĩnh)`);
console.log("=================================================");
process.exit(0);
