// Script kiểm thử truy vấn đơn: "hôm nay bạn như nào"
// Chạy bằng lệnh: bun src/lib/test-single-query.ts

import { classifyIntent } from "./agent/nlp";
import { db } from "../db/db";
import { agentTraining } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("==========================================================================");
  console.log("🔍 ĐÁNH GIÁ CHẤT LƯỢNG PHẢN HỒI CỦA AI VỚI TRUY VẤN XÃ GIAO");
  console.log("==========================================================================");

  const query = "hôm nay bạn như nào";
  console.log(`💬 Câu hỏi của người dùng: "${query}"`);

  // 1. Phân loại ý định (Intent Classification)
  const classification = await classifyIntent(query);
  console.log(`\n🧠 Phân loại ý định (NLU Intent):`);
  console.log(`   - Ý định phân loại: [${classification.intent}]`);
  console.log(`   - Độ tin cậy (Confidence): ${classification.confidence.toFixed(2)}`);
  console.log(`   - Phương thức: ${classification.classificationMethod}`);

  // Đánh giá NLU
  const isCorrectIntent = classification.intent === "GREETING" || classification.intent === "STATUS";
  console.log(`   ➡️ Đánh giá NLU: ${isCorrectIntent ? "✅ ĐÚNG (Ý định chào hỏi/trạng thái)" : "❌ SAI"}`);

  // 2. Truy vấn câu trả lời từ CSDL (Giả lập logic tìm kiếm câu trả lời)
  console.log(`\n📖 Truy vấn câu trả lời từ CSDL:`);

  // Tìm trong AgentTraining mẫu gần nhất
  const matched = await db.query.agentTraining.findFirst({
    where: (t: any, { eq, and, ilike }: any) => and(eq(t.intent, "GREETING"), ilike(t.utterance, "%hôm nay%")),
  });

  if (matched) {
    console.log(`   - Tìm thấy câu trả lời khớp: "${matched.answer}"`);
    console.log(`   - Độ dài câu trả lời: ${matched.answer.length} ký tự`);

    // 3. Đánh giá chất lượng ngôn ngữ (Linguistic Evaluation)
    console.log(`\n📋 Đánh giá Chất lượng Ngôn ngữ:`);

    // 3.1 Chính tả (Typo check)
    const typoCheck = /[^a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s\.\!\,\?\:\-]/g.test(matched.answer);
    console.log(`   - Kiểm tra chính tả: ${!typoCheck ? "✅ ĐẠT (Không chứa lỗi chính tả)" : "❌ CẢNH BÁO (Phát hiện ký tự lạ)"}`);

    // 3.2 Ngữ pháp cấu trúc câu (SVO & Politeness)
    const hasSubject = matched.answer.toLowerCase().includes("em") || matched.answer.toLowerCase().includes("tôi") || matched.answer.toLowerCase().includes("hệ thống");
    const hasObjectPolite = matched.answer.toLowerCase().includes("sếp") || matched.answer.toLowerCase().includes("bạn") || matched.answer.endsWith("ạ!");
    console.log(`   - Cấu trúc xưng hô (Chủ ngữ): ${hasSubject ? "✅ ĐẠT (Có xưng hô rõ ràng)" : "❌ THIẾU"}`);
    console.log(`   - Kính ngữ (Politeness): ${hasObjectPolite ? "✅ ĐẠT (Có kính ngữ lịch sự)" : "❌ THIẾU"}`);

    // 4. Kết luận
    console.log("\n==========================================================================");
    console.log("🏆 KẾT LUẬN CHUNG:");
    if (isCorrectIntent && !typoCheck && hasSubject && hasObjectPolite) {
      console.log("🎉 CÂU TRẢ LỜI ĐẠT TIÊU CHUẨN CHẤT LƯỢNG AI TIẾNG VIỆT HOÀN HẢO!");
    } else {
      console.log("⚠️ CÂU TRẢ LỜI CẦN ĐƯỢC CẢI THIỆN THÊM.");
    }
    console.log("==========================================================================");
  } else {
    console.log("   ❌ Không tìm thấy dữ liệu mẫu trong CSDL.");
  }

  process.exit(0);
}

run();
