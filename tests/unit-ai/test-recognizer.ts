// Test Script for $P Whiteboard Drawing Recognizer
// Run with: bun src/lib/test-recognizer.ts

import { recognize, Point } from "./agent/recognizer";

console.log("==========================================================================");
console.log("🎨 ĐÁNH GIÁ THUẬT TOÁN NHẬN DIỆN HÌNH VẼ & CHỮ CÁI ($P CLOUD RECOGNIZER)");
console.log("==========================================================================");

// Helper to add minor noise to points
function addNoise(points: Point[], noiseLevel: number = 0.05): Point[] {
  return points.map((p) => ({
    x: p.x + (Math.random() - 0.5) * noiseLevel,
    y: p.y + (Math.random() - 0.5) * noiseLevel,
  }));
}

// Case 1: Test Circle with noise
const rawCircle: Point[] = [];
for (let i = 0; i < 30; i++) {
  const angle = (i * 2 * Math.PI) / 30;
  rawCircle.push({ x: 200 + 100 * Math.cos(angle), y: 200 + 100 * Math.sin(angle) });
}
const noisyCircle = addNoise(rawCircle, 5);
const resultCircle = await recognize(noisyCircle);

console.log("\n🧪 Test Case 1: Vẽ Hình Tròn (Circle with Noise)");
console.log(`   - Số lượng điểm vẽ: ${noisyCircle.length}`);
console.log(`   - Kết quả nhận diện: [${resultCircle.name}]`);
console.log(`   - Độ tin cậy (Score): ${resultCircle.score.toFixed(2)}`);
console.log(`   ➡️ Đánh giá: ${resultCircle.name === "Vòng tròn" && resultCircle.score > 0.8 ? "✅ ĐẠT" : "❌ THẤT BẠI"}`);

// Case 2: Test Triangle with noise
const rawTriangle: Point[] = [];
for (let i = 0; i <= 10; i++) rawTriangle.push({ x: 100 + 10 * i, y: 300 - 20 * i });
for (let i = 1; i <= 10; i++) rawTriangle.push({ x: 200 + 10 * i, y: 100 + 20 * i });
for (let i = 1; i < 10; i++) rawTriangle.push({ x: 300 - 20 * i, y: 300 });
const noisyTriangle = addNoise(rawTriangle, 10);
const resultTriangle = await recognize(noisyTriangle);

console.log("\n🧪 Test Case 2: Vẽ Tam Giác (Triangle with Noise)");
console.log(`   - Số lượng điểm vẽ: ${noisyTriangle.length}`);
console.log(`   - Kết quả nhận diện: [${resultTriangle.name}]`);
console.log(`   - Độ tin cậy (Score): ${resultTriangle.score.toFixed(2)}`);
console.log(`   ➡️ Đánh giá: ${resultTriangle.name === "Hình tam giác" && resultTriangle.score > 0.8 ? "✅ ĐẠT" : "❌ THẤT BẠI"}`);

// Case 3: Test Letter V
const rawV: Point[] = [];
for (let i = 0; i <= 15; i++) rawV.push({ x: 100 + 5 * i, y: 100 + 10 * i });
for (let i = 1; i <= 15; i++) rawV.push({ x: 175 + 5 * i, y: 250 - 10 * i });
const resultV = await recognize(rawV);

console.log("\n🧪 Test Case 3: Vẽ Chữ V (Letter V)");
console.log(`   - Số lượng điểm vẽ: ${rawV.length}`);
console.log(`   - Kết quả nhận diện: [${resultV.name}]`);
console.log(`   - Độ tin cậy (Score): ${resultV.score.toFixed(2)}`);
console.log(`   ➡️ Đánh giá: ${resultV.name === "Chữ V" && resultV.score > 0.8 ? "✅ ĐẠT" : "❌ THẤT BẠI"}`);

console.log("\n==========================================================================");
if (resultCircle.name === "Vòng tròn" && resultTriangle.name === "Hình tam giác" && resultV.name === "Chữ V") {
  console.log("🎉 TẤT CẢ CÁC BÀI TEST NHẬN DIỆN HÌNH VẼ ĐỀU ĐẠT TIÊU CHUẨN!");
} else {
  console.log("⚠️ CÓ BÀI TEST THẤT BẠI. CẦN CÂN CHỈNH LẠI THAM SỐ $P.");
}
console.log("==========================================================================");
