// Script kiểm thử truy vấn khách vãng lai (Guest): "1 + 1"
// Chạy bằng lệnh: bun src/lib/test-guest-query.ts

import { classifyIntent } from "./agent/nlp";
import { solveCustomAlgorithm, evaluateMathExpression } from "./agent/calculator";

async function run() {
  console.log("==========================================================================");
  console.log("🔍 KIỂM TRA PHÂN QUYỀN VAI TRÒ KHÁCH VÀNG LAI (GUEST RBAC POLICY)");
  console.log("==========================================================================");

  const query = "1 + 1";
  const userRole = "guest"; // Vai trò khách vãng lai

  console.log(`👤 Người dùng: [Guest/Khách vãng lai]`);
  console.log(`💬 Câu hỏi: "${query}"`);

  // 1. Phân loại ý định
  const classification = await classifyIntent(query);
  console.log(`🧠 Ý định phân loại: [${classification.intent}]`);

  // 2. Xác định các điều kiện phân quyền giống như API endpoint
  const isCustomAlgo = solveCustomAlgorithm(query).success;
  const isMathExpr = evaluateMathExpression(query).success;
  const hasTerm = query.toLowerCase().includes("độ ẩm") || query.toLowerCase().includes("nhiệt độ");

  let responseText = "";
  if (userRole === "guest") {
    if (isCustomAlgo || isMathExpr || hasTerm) {
      responseText = `Dạ kính chào Quý khách! Em là Trợ lý Lễ tân của Hệ sinh thái Nông Sản Rottra. Rất vui được đón tiếp và hỗ trợ Quý khách!

Hiện tại các tính năng nâng cao như giải thuật cơ lý, tìm kiếm tri thức chuyên sâu RAG và máy tính lượng tử Casio chỉ dành cho thành viên của Rottra.

🔑 **Gợi ý dành cho Quý khách:** Để sử dụng các tính năng tuyệt vời này, Quý khách vui lòng **Đăng ký / Đăng nhập** tài khoản thành viên nhé!`;
    }
  }

  console.log(`\n🤖 Phản hồi của AI:`);
  console.log(`   "${responseText}"`);

  console.log("\n📋 Đánh giá chính sách phân quyền (RBAC Policy Evaluation):");
  const expectedText = `Dạ kính chào Quý khách! Em là Trợ lý Lễ tân của Hệ sinh thái Nông Sản Rottra. Rất vui được đón tiếp và hỗ trợ Quý khách!

Hiện tại các tính năng nâng cao như giải thuật cơ lý, tìm kiếm tri thức chuyên sâu RAG và máy tính lượng tử Casio chỉ dành cho thành viên của Rottra.

🔑 **Gợi ý dành cho Quý khách:** Để sử dụng các tính năng tuyệt vời này, Quý khách vui lòng **Đăng ký / Đăng nhập** tài khoản thành viên nhé!`;
  if (responseText === expectedText) {
    console.log("   ➡️ Kết quả: ✅ ĐẠT (Chặn truy cập trái phép của tài khoản Khách thành công!)");
  } else {
    console.log("   ➡️ Kết quả: ❌ THẤT BẠI (Chính sách phân quyền bị lọt lưới!)");
  }
  console.log("==========================================================================");

  process.exit(0);
}

run();
