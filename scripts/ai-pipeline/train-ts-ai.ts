import { TSIntentClassifier } from "../../src/core/nlp-cognitive/ts-intent-classifier";

async function runDemo() {
  console.log("=== HỆ THỐNG TRÍ TUỆ NHÂN TẠO THUẦN TYPESCRIPT ===");
  console.log("Mô phỏng kiến thức từ khóa học Microsoft AI-For-Beginners\n");

  const classifier = new TSIntentClassifier();

  // Tập dữ liệu huấn luyện (Training Data)
  const trainingData = [
    { text: "Chào bạn, hôm nay thế nào?", intent: "GREETING" },
    { text: "Xin chào sếp", intent: "GREETING" },
    { text: "hello shop", intent: "GREETING" },
    { text: "chào nha", intent: "GREETING" },
    
    { text: "Cái này giá bao nhiêu vậy?", intent: "INQUIRY_PRICE" },
    { text: "cho hỏi giá sản phẩm này", intent: "INQUIRY_PRICE" },
    { text: "báo giá giúp mình", intent: "INQUIRY_PRICE" },
    { text: "bn tiền", intent: "INQUIRY_PRICE" },
    
    { text: "Đắt quá, giảm giá đi", intent: "BARGAIN" },
    { text: "fix thêm được không shop", intent: "BARGAIN" },
    { text: "bớt chút đi sếp", intent: "BARGAIN" },
    { text: "giảm xíu cho vui vẻ nha", intent: "BARGAIN" },
    
    { text: "Chốt đơn nhé", intent: "BUY" },
    { text: "mình mua cái này", intent: "BUY" },
    { text: "ship cho mình nhé", intent: "BUY" },
    { text: "đặt hàng luôn", intent: "BUY" }
  ];

  // Huấn luyện mô hình (Training)
  // Số epoch: 300, Learning Rate: 0.1
  classifier.train(trainingData, 300, 0.1);

  console.log("\n=== KIỂM THỬ MÔ HÌNH (INFERENCE) ===");
  
  // Tập dữ liệu kiểm thử (Test Data) - Những câu chưa từng học
  const testQueries = [
    "chào buổi sáng",
    "xin giá với",
    "có bớt giá không ạ",
    "ok mình lấy nhé"
  ];

  for (const query of testQueries) {
    const result = classifier.predict(query);
    console.log(`- Câu hỏi: "${query}"`);
    console.log(`  => Dự đoán: [${result.intent}] (Độ tự tin: ${(result.confidence * 100).toFixed(2)}%)\n`);
  }
}

runDemo().catch(console.error);
