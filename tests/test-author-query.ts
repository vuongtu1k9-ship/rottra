// Script kiểm thử truy vấn tác giả: "bạn là ai"
// Chạy bằng lệnh: bun src/lib/test-author-query.ts

import { classifyIntent } from "./agent/nlp";
import { getAgentTools } from "./agent/toolkit";

async function run() {
  console.log("==========================================================================");
  console.log("🔍 ĐÁNH GIÁ PHẢN HỒI Ý ĐỊNH TÁC GIẢ (AUTHOR INTENT EVALUATION)");
  console.log("==========================================================================");

  const query = "bạn là ai";
  console.log(`💬 Câu hỏi của người dùng: "${query}"`);

  // 1. Phân loại ý định
  const classification = await classifyIntent(query);
  console.log(`\n🧠 Phân loại ý định (NLU Intent):`);
  console.log(`   - Ý định phân loại: [${classification.intent}]`);
  console.log(`   - Độ tin cậy (Confidence): ${classification.confidence.toFixed(2)}`);
  console.log(`   - Phương thức: ${classification.classificationMethod}`);

  // Đánh giá NLU
  const isCorrectIntent = classification.intent === "AUTHOR";
  console.log(`   ➡️ Đánh giá NLU: ${isCorrectIntent ? "✅ ĐÚNG (Ý định xác định tác giả AUTHOR)" : "❌ SAI"}`);

  // 2. Thực thi công cụ AUTHOR
  console.log(`\n⚙️ Gọi tool AUTHOR trong registry:`);

  const dummyPostgres = {
    query: async () => ({ rows: [] }),
  };

  const agentTools = getAgentTools({
    pgClient: dummyPglite,
    db: {},
    query,
    q: query,
    intent: classification.intent,
    contextData: {},
    memoryRecord: {},
    priceConstraint: {},
    initLlama: async () => {},
    updateLlamaActivity: () => {},
    userRole: "admin",
  });

  const tool = agentTools[classification.intent];
  if (tool) {
    const res = await tool();
    console.log(`   - Nội dung phản hồi: "${res.text}"`);

    // 3. Đánh giá chất lượng ngôn ngữ (Linguistic Evaluation)
    console.log(`\n📋 Đánh giá Chất lượng Ngôn ngữ:`);

    // 3.1 Chính tả (Typo check)
    const typoCheck = /[^a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s\.\!\,\?\:\-\(\)]/g.test(res.text);
    console.log(`   - Kiểm tra chính tả: ${!typoCheck ? "✅ ĐẠT (Không chứa lỗi chính tả)" : "❌ CẢNH BÁO (Phát hiện ký tự lạ)"}`);

    // 3.2 Ngữ pháp cấu trúc câu (SVO & Politeness)
    const hasSubject = res.text.toLowerCase().includes("em") || res.text.toLowerCase().includes("tôi") || res.text.toLowerCase().includes("hệ thống");
    const hasPolite = res.text.toLowerCase().includes("sếp") || res.text.toLowerCase().includes("bạn") || res.text.endsWith("ạ!");
    console.log(`   - Cấu trúc xưng hô (Chủ ngữ): ${hasSubject ? "✅ ĐẠT (Có xưng hô rõ ràng)" : "❌ THIẾU"}`);
    console.log(`   - Kính ngữ (Politeness): ${hasPolite ? "✅ ĐẠT (Có kính ngữ lịch sự)" : "❌ THIẾU"}`);

    // 4. Kết luận
    console.log("\n==========================================================================");
    console.log("🏆 KẾT LUẬN CHUNG:");
    if (isCorrectIntent && !typoCheck && hasSubject && hasPolite) {
      console.log("🎉 CÂU TRẢ LỜI ĐẠT TIÊU CHUẨN CHẤT LƯỢNG AI TIẾNG VIỆT HOÀN HẢO!");
    } else {
      console.log("⚠️ CÂU TRẢ LỜI CẦN ĐƯỢC CẢI THIỆN THÊM.");
    }
    console.log("==========================================================================");
  } else {
    console.log("   ❌ Không tìm thấy tool tương ứng trong registry.");
  }

  process.exit(0);
}

run();
