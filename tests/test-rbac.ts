// Script kiểm thử phân quyền 3-Agent (Guest, User, Admin)
// Chạy bằng lệnh: bun src/lib/test-rbac.ts

import { solveCustomAlgorithm, evaluateMathExpression } from "./agent/calculator";

// Định nghĩa mock kiểm thử
const TEST_CASES = [
  // 1. Lệnh của Khách (Guest)
  {
    role: "guest",
    query: "chào bạn",
    expected: "allow", // Cho phép chào hỏi xã giao
    description: "Khách chào hỏi xã giao",
  },
  {
    role: "guest",
    query: "2*3 + sin(pi/2)",
    expected: "block_guest", // Chặn máy tính lượng tử
    description: "Khách dùng máy tính lượng tử Casio",
  },
  {
    role: "guest",
    query: "MPF 5x5 saddle",
    expected: "block_guest", // Chặn giải thuật cơ lý MPF
    description: "Khách dùng bộ giải MPF nâng cao",
  },

  // 2. Lệnh của Thành viên (User)
  {
    role: "user",
    query: "chào em",
    expected: "allow",
    description: "Thành viên chào hỏi xã giao",
  },
  {
    role: "user",
    query: "factorial(5) + C(10,3)",
    expected: "allow", // Cho phép máy tính lượng tử Casio
    description: "Thành viên dùng máy tính lượng tử Casio",
  },
  {
    role: "user",
    query: "MPF 5x5 saddle",
    expected: "block_user", // Chặn giải thuật MPF nâng cao
    description: "Thành viên gọi bộ giải MPF (Yêu cầu Admin)",
  },
  {
    role: "user",
    query: "tính thuật toán dệt may cho tấm cao 50cm",
    expected: "block_user", // Chặn dệt may số hóa chuyên sâu
    description: "Thành viên gọi dệt may số hóa (Yêu cầu Admin)",
  },

  // 3. Lệnh của Quản trị viên (Admin)
  {
    role: "admin",
    query: "2*3 + sin(pi/2)",
    expected: "allow",
    description: "Admin dùng máy tính lượng tử Casio",
  },
  {
    role: "admin",
    query: "MPF 5x5 saddle",
    expected: "allow", // Cho phép giải thuật MPF nâng cao
    description: "Admin dùng bộ giải MPF nâng cao",
  },
  {
    role: "admin",
    query: "tính thuật toán dệt may cho tấm cao 50cm",
    expected: "allow", // Cho phép dệt may số hóa chuyên sâu
    description: "Admin dùng dệt may số hóa chuyên sâu",
  },
];

function simulateRBAC(role: string, query: string): { action: "allow" | "block_guest" | "block_user"; responseText: string } {
  const isCustomAlgo = solveCustomAlgorithm(query).success;
  const isMathExpr = evaluateMathExpression(query).success;

  // Giả lập từ khóa kích hoạt RAG chuyên môn
  const searchTerms = ["tai lieu", "cong thuc", "dinh nghia", "giai thich", "tra cuu", "dijkstra", "tsp", "npv", "shannon"];
  const qClean = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  const hasTerm = searchTerms.some((term) => qClean.includes(term));
  const isForcedStats = qClean.includes("thong ke");
  const hasRAG = hasTerm && !isForcedStats;

  if (role === "guest") {
    if (isCustomAlgo || isMathExpr || hasRAG) {
      return {
        action: "block_guest",
        responseText: `Dạ kính chào Quý khách! Em là Trợ lý Lễ tân của Hệ sinh thái Nông Sản Rottra. Rất vui được đón tiếp và hỗ trợ Quý khách!

Hiện tại các tính năng nâng cao như giải thuật cơ lý, tìm kiếm tri thức chuyên sâu RAG và máy tính lượng tử Casio chỉ dành cho thành viên của Rottra.

🔑 **Gợi ý dành cho Quý khách:** Để sử dụng các tính năng tuyệt vời này, Quý khách vui lòng **Đăng ký / Đăng nhập** tài khoản thành viên nhé!`,
      };
    }
  } else if (role === "user") {
    if (isCustomAlgo) {
      return {
        action: "block_user",
        responseText: "Dạ thưa Sếp, các tính năng giải toán cơ lý/chốt pin MPF/dệt may chuyên sâu và Siêu thuật toán yêu cầu quyền Quản trị viên (Admin). Tài khoản hiện tại của Sếp là Thành viên (User) chưa được cấp phép. Sếp vui lòng liên hệ Admin để nâng cấp tài khoản ạ!",
      };
    }
  }

  // Nếu cho phép, trả về kết quả từ solver tương ứng hoặc phản hồi giả định
  let text = "Phản hồi thông thường / RAG / Xã giao";
  if (isCustomAlgo) {
    text = solveCustomAlgorithm(query).text || "";
  } else if (isMathExpr) {
    text = evaluateMathExpression(query).text || "";
  }

  return {
    action: "allow",
    responseText: text,
  };
}

console.log("==========================================================================");
console.log("🔍 KỊCH BẢN KIỂM THỬ PHÂN QUYỀN 3-AGENT (GUEST, USER, ADMIN) TRÊN TERMINAL");
console.log("==========================================================================");

let passedCount = 0;

TEST_CASES.forEach((tc, index) => {
  const result = simulateRBAC(tc.role, tc.query);
  const isPassed = result.action === tc.expected;
  if (isPassed) passedCount++;

  console.log(`\n📌 [TEST CASE ${index + 1}] ${tc.description}`);
  console.log(`   - Vai trò: [${tc.role.toUpperCase()}]`);
  console.log(`   - Truy vấn: "${tc.query}"`);
  console.log(`   - Kỳ vọng hành vi: [${tc.expected.toUpperCase()}]`);
  console.log(`   - Thực tế hành vi: [${result.action.toUpperCase()}]`);
  console.log(`   - Trạng thái kiểm thử: ${isPassed ? "✅ ĐẠT (PASSED)" : "❌ THẤT BẠI (FAILED)"}`);
  console.log(`   - Phản hồi từ Agent (Trích đoạn): "${result.responseText.substring(0, 100).replace(/\n/g, " ")}..."`);
});

console.log("\n==========================================================================");
console.log(`📊 TỔNG KẾT KIỂM THỬ: ĐẠT ${passedCount}/${TEST_CASES.length} KỊCH BẢN`);
console.log("==========================================================================");
if (passedCount === TEST_CASES.length) {
  console.log("🎉 XÁC NHẬN: TOÀN BỘ CƠ CHẾ PHÂN QUYỀN HOẠT ĐỘNG HOÀN HẢO THEO ĐÚNG THIẾT KẾ!");
} else {
  console.log("⚠️ CẢNH BÁO: CÓ KỊCH BẢN KHÔNG ĐẠT KỲ VỌNG. VUI LÒNG KIỂM TRA LẠI!");
}
console.log("==========================================================================");
