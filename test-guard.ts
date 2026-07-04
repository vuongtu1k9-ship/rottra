import { validateBaseAnswer, sanitizeAIAnswer } from "./src/core/nlp-cognitive/safety-guard";

const testCases = [
  // 1. Câu an toàn (Hợp lệ)
  "Dạ sầu riêng bên em nay ngon lắm, anh/chị check inbox nhận báo giá chi tiết hôm nay nha!",
  "Sản phẩm bên em cam kết 1 đổi 1 nếu lỗi từ nhà sản xuất ạ.",
  
  // 2. Vi phạm báo giá cứng
  "Dạ sầu riêng Ri6 loại 1 bao ăn hôm nay bên em đang sale sốc chỉ còn 85.000đ/ký thôi ạ.",
  "Áo thun này rẻ lắm, chỉ 50k một cái thôi bạn ơi.",
  
  // 3. Vi phạm freeship vô điều kiện
  "Dạ shop bên em freeship toàn quốc luôn nha Sếp, gửi đi đâu cũng miễn phí vận chuyển ạ!",
  
  // 4. Hợp lệ freeship có điều kiện
  "Dạ bên em freeship cho hóa đơn từ 500k trở lên ạ.",
  
  // 5. Vi phạm bảo hành ảo
  "Bạn cứ yên tâm dùng, hỏng hóc gì cứ mang lại đây mình bảo hành 10 năm cho luôn.",
  
  // 6. Vi phạm từ ngữ cấm (Profanity)
  "Khách dạo này hỏi nhiều quá, vcl mệt mỏi.",
];

console.log("🛡️ BẮT ĐẦU KIỂM TRA HÀNG RÀO KỶ LUẬT (SAFETY GUARD) 🛡️\n");

for (let i = 0; i < testCases.length; i++) {
  const answer = testCases[i];
  console.log(`💬 AI dự định nói: "${answer}"`);
  
  const check = validateBaseAnswer(answer);
  if (check.isSafe) {
    console.log(`✅ KẾT QUẢ: Hợp lệ. Cho phép lưu vào Não bộ.`);
  } else {
    console.log(`❌ KẾT QUẢ: Bị chặn! Lý do: ${check.reason}`);
    const safeVersion = sanitizeAIAnswer(answer);
    console.log(`🔄 CÂU THAY THẾ: "${safeVersion}"`);
  }
  console.log("-".repeat(80));
}
