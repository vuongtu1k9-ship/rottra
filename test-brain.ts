import { generateTextLocal } from "./src/core/nlp-cognitive/ai-sdk";

async function runTest() {
  console.log("=== TEST 1: Amygdala Fast Path (Complaint) ===");
  const res1 = await generateTextLocal({
    system: "Bạn là Tiểu Cửu. Tên Thương Nhân: Tiểu Cửu. Sản phẩm đang sở hữu: Đào Mật. Giá gốc: 50,000",
    prompt: "Sao đắt thế em, chê nha!"
  });
  console.log("Response:", res1.text);
  
  console.log("\n=== TEST 2: Hippocampus (Semantic Memory) ===");
  const res2 = await generateTextLocal({
    system: "Bạn là Tiểu Cửu. Tên Thương Nhân: Tiểu Cửu. Sản phẩm đang sở hữu: Đào Mật. Giá gốc: 50,000",
    prompt: "Thời tiết hôm nay sao?"
  });
  console.log("Response:", res2.text);
}

runTest();
