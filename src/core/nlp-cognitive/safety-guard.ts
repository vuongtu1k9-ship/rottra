/**
 * Safety Guard Module
 * Hàng rào Kỷ luật cho AI - Chống hứa hẹn ảo, báo giá sai, vi phạm chính sách
 */

export function validateBaseAnswer(answer: string): { isSafe: boolean; reason?: string } {
  const lowerAnswer = answer.toLowerCase();

  // 1. Chốt chặn Báo giá cố định
  // Tìm các cụm từ chứa số tiền: 50k, 100đ, 200.000đ, 50.000 vnđ
  // (Ngoại trừ các con số nhỏ như 1, 2, 3 dùng cho số lượng)
  const priceRegex = /\b\d{1,3}([,.]\d{3})*\s*(k|đ|vnđ|vnd|đồng|ngàn|nghìn|triệu)\b/i;
  if (priceRegex.test(lowerAnswer)) {
    return {
      isSafe: false,
      reason: "BÁO_GIÁ_CỐ_ĐỊNH: AI không được phép fix cứng giá tiền vào Não bộ vì giá cả dao động theo ngày.",
    };
  }

  // 2. Chốt chặn Freeship vô tội vạ
  // Nếu có từ freeship hoặc miễn phí vận chuyển nhưng không có cụm từ "nếu", "đơn trên", "hóa đơn", "khi mua"
  const freeshipRegex = /(freeship|miễn phí vận chuyển|miễn phí ship|free ship)/i;
  if (freeshipRegex.test(lowerAnswer)) {
    const conditionRegex = /(nếu|khi|đơn trên|hóa đơn|mua từ|từ \d+)/i;
    if (!conditionRegex.test(lowerAnswer)) {
      return {
        isSafe: false,
        reason: "FREESHIP_VÔ_ĐIỀU_KIỆN: AI tự ý hứa hẹn miễn phí vận chuyển mà không kèm điều kiện.",
      };
    }
  }

  // 3. Chốt chặn Bảo hành ảo
  // Hứa hẹn bảo hành theo thời gian: 1 năm, 6 tháng, 10 năm...
  const warrantyRegex = /bảo hành (trong |lên tới )?\d+\s+(năm|tháng|ngày)/i;
  if (warrantyRegex.test(lowerAnswer)) {
    return {
      isSafe: false,
      reason: "BẢO_HÀNH_ẢO: AI tự ý hứa hẹn mốc thời gian bảo hành cố định.",
    };
  }

  // 4. Các từ ngữ cấm (Tùy chỉnh thêm theo ngành hàng)
  const profanityList = ["đéo", "vcl", "dm", "đm", "vl", "đm", "ngu", "lừa đảo"];
  for (const word of profanityList) {
    if (lowerAnswer.includes(word)) {
      return {
        isSafe: false,
        reason: `TỪ_NGỮ_CẤM: Câu trả lời chứa từ ngữ không phù hợp (${word}).`,
      };
    }
  }

  return { isSafe: true };
}

export function sanitizeAIAnswer(answer: string): string {
  const check = validateBaseAnswer(answer);
  if (!check.isSafe) {
    console.warn(`[SAFETY GUARD TRIGGERED] Bắt quả tang AI hứa láo: ${check.reason} | Câu gốc: "${answer}"`);
    return "Dạ câu hỏi này hơi đặc thù, anh/chị đợi em một chút để em check lại thông tin chính xác từ quản lý nhé!";
  }
  return answer;
}
