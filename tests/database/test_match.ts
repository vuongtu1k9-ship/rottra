// Script kiểm thử độ chính xác (Pass/Fail) của thuật toán ánh xạ hình ảnh sản phẩm
// Chạy bằng lệnh: bun src/db/test_match.ts

const getPreciseImageForProduct = (productName: string, category: string) => {
  const nameLower = productName.toLowerCase();
  const catLower = (category || "").toLowerCase();

  if (nameLower.includes("lúa") || nameLower.includes("gạo") || nameLower.includes("st25") || nameLower.includes("rice")) {
    return "https://images.unsplash.com/photo-1536630596251-b12658807d79?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("ngô") || nameLower.includes("bắp") || nameLower.includes("corn")) {
    return "https://images.unsplash.com/photo-1551754626-787be77e3877?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("heo") || nameLower.includes("lợn") || nameLower.includes("pig") || nameLower.includes("pork")) {
    return "https://images.unsplash.com/photo-1570042225831-d9b065738686?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("bò") || nameLower.includes("thịt bò") || nameLower.includes("beef") || nameLower.includes("cow")) {
    return "https://images.unsplash.com/photo-1546445317-29f4545e6d52?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("kéo") || nameLower.includes("cắt cành") || nameLower.includes("pruning") || nameLower.includes("shears")) {
    return "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("màng phủ") || nameLower.includes("nhà kính") || nameLower.includes("greenhouse")) {
    return "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("mát") || nameLower.includes("lạnh") || nameLower.includes("cooling") || nameLower.includes("chiller")) {
    return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("sấy") || nameLower.includes("máy sấy")) {
    return "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("mít") || nameLower.includes("jackfruit")) {
    return "https://images.unsplash.com/photo-1595855759920-86582396756a?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("cà phê") || nameLower.includes("coffee") || nameLower.includes("robusta")) {
    return "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("báo cáo") || nameLower.includes("chỉ số") || nameLower.includes("report") || nameLower.includes("analytics")) {
    return "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("cảm biến") || nameLower.includes("sensor") || nameLower.includes("iot")) {
    return "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("bộ điều khiển") || nameLower.includes("tưới") || nameLower.includes("irrigation")) {
    return "https://images.unsplash.com/photo-1563514223709-69149e327173?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("phân bón") || nameLower.includes("trùn quế") || nameLower.includes("fertilizer")) {
    return "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&auto=format&fit=crop";
  }
  if (nameLower.includes("biochar") || nameLower.includes("than") || nameLower.includes("charcoal")) {
    return "https://images.unsplash.com/photo-1600706432502-75a0e286b92a?w=800&auto=format&fit=crop";
  }

  if (catLower.includes("cây") || catLower.includes("trồng") || catLower.includes("crop")) {
    return "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop";
  }
  if (catLower.includes("chăn") || catLower.includes("nuôi") || catLower.includes("animal") || catLower.includes("husbandry")) {
    return "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=800&auto=format&fit=crop";
  }
  if (catLower.includes("kỹ thuật") || catLower.includes("thiết bị") || catLower.includes("tech")) {
    return "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop";
  }
  if (catLower.includes("môi trường") || catLower.includes("bền vững") || catLower.includes("eco")) {
    return "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop";
  }

  return "/images/Rottra-logo.png";
};

// Định nghĩa các test case kiểm thử
const testCases = [
  // 1. Các trường hợp Khớp chính xác (True Cases)
  {
    name: "Lúa gạo đặc sản ST25",
    category: "Cây trồng",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'Lúa gạo' (True match)",
  },
  {
    name: "Ngô lai ngọt cao cấp",
    category: "Cây trồng",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'Ngô' (True match)",
  },
  {
    name: "Heo thịt siêu nạc hữu cơ",
    category: "Chăn nuôi",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'Heo' (True match)",
  },
  {
    name: "Bò thịt chất lượng cao",
    category: "Chăn nuôi",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'Bò' (True match)",
  },
  {
    name: "Cà phê Robusta",
    category: "Chế biến",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'Cà phê' (True match)",
  },
  {
    name: "Than sinh học biochar cải tạo đất",
    category: "Môi trường & bền vững",
    expectedKeyword: "unsplash",
    description: "Sản phẩm chứa chữ 'biochar' (True match)",
  },
  // 2. Các trường hợp Khớp theo danh mục (Category Fallback)
  {
    name: "Hạt giống lai F1 siêu bông",
    category: "Cây trồng",
    expectedKeyword: "unsplash",
    description: "Khớp theo danh mục 'Cây trồng'",
  },
  {
    name: "Thức ăn hỗn hợp cho gà",
    category: "Chăn nuôi",
    expectedKeyword: "unsplash",
    description: "Khớp theo danh mục 'Chăn nuôi'",
  },
  // 3. Các trường hợp Không khớp - Phải trả về Fallback Rottra (False Cases)
  {
    name: "Dịch vụ vận chuyển siêu tốc Rottra",
    category: "Logistics",
    expectedKeyword: "Rottra-logo.png",
    description: "Không khớp từ khóa & danh mục (Phải rơi vào Fallback)",
  },
  {
    name: "Sản phẩm chưa xác định",
    category: "Khác",
    expectedKeyword: "Rottra-logo.png",
    description: "Không khớp từ khóa & danh mục (Phải rơi vào Fallback)",
  },
];

console.log("==================================================");
console.log("🧪 BẮT ĐẦU CHẠY THỬ NGHIỆM ĐỘ CHÍNH XÁC ÁNH XẠ ẢNH");
console.log("==================================================");

let passedCount = 0;

testCases.forEach((tc, idx) => {
  const result = getPreciseImageForProduct(tc.name, tc.category);
  const isMatchExpected = result.includes(tc.expectedKeyword);
  const status = isMatchExpected ? "🟢 PASS" : "🔴 FAIL";
  if (isMatchExpected) passedCount++;

  console.log(`[Test #${idx + 1}] ${tc.description}`);
  console.log(` - Đầu vào: Tên: "${tc.name}" | Danh mục: "${tc.category}"`);
  console.log(` - Kết quả: "${result}"`);
  console.log(` - Trạng thái: ${status}\n`);
});

const accuracyRate = (passedCount / testCases.length) * 100;
console.log("==================================================");
console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ:`);
console.log(` - Số ca thành công: ${passedCount}/${testCases.length}`);
console.log(` - Tỷ lệ chính xác (Accuracy): ${accuracyRate.toFixed(1)}%`);
console.log("==================================================");
