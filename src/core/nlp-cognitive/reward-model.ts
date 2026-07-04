/**
 * Reward Model cho hệ thống DPO
 * Sử dụng Heuristics siêu tốc để đánh giá chất lượng câu trả lời trước khi hiển thị cho người dùng.
 */

export function computeRewardScore(query: string, response: string): number {
  let score = 0;
  const lowerResp = response.toLowerCase();

  // 1. Độ dài tối ưu (+20 điểm)
  // Quá ngắn (hời hợt) hoặc quá dài (dài dòng) sẽ bị trừ điểm
  const charCount = response.length;
  if (charCount >= 100 && charCount <= 1500) {
    score += 20;
  } else if (charCount < 100) {
    score -= 10;
  } else {
    // Dài quá 1500 ký tự
    score -= 15;
  }

  // 2. Định dạng Markdown (+15 điểm)
  // Kiểm tra có dùng bold, italic, danh sách không
  if (/\*\*(.*?)\*\*/.test(response)) score += 5; // Có bold
  if (/^(\-|\*|\d+\.)\s/m.test(response)) score += 10; // Có dạng danh sách list

  // 3. Meta-Cognitive Depth: Logic Toán học, Khái niệm chuyên sâu, Step-by-step (+40 điểm)
  if (lowerResp.includes("bước 1") || lowerResp.includes("step 1")) score += 10;
  if (lowerResp.includes("tuy nhiên") || lowerResp.includes("mặt khác") || lowerResp.includes("tóm lại")) score += 10;
  if (/(\+|\-|\*|\/|=|<|>|%|\$|₫|∑|∫)/.test(response)) score += 10; // Chứa ký hiệu toán học/tài chính
  if (/<inner_monologue>|<think>|<verbal_strike>/.test(response)) score += 10; // Có tiến trình tự nhận thức (ToT/Private Brain)

  // 4. Độ bám sát từ khóa (+30 điểm)
  // Lấy các từ dài hơn 3 chữ cái từ query để kiểm tra
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let matchCount = 0;
  for (const kw of keywords) {
    if (lowerResp.includes(kw)) {
      matchCount++;
    }
  }
  if (keywords.length > 0) {
    const matchRatio = matchCount / keywords.length;
    score += Math.round(matchRatio * 30);
  } else {
    score += 15; // Mặc định nếu query quá ngắn
  }

  // 5. Tính lịch sự/Chuyên nghiệp (+10 điểm)
  if (lowerResp.includes("sếp") || lowerResp.includes("dạ") || lowerResp.includes("cảm ơn") || lowerResp.includes("thưa")) {
    score += 10;
  }

  // 5. Penalty: Từ chối phục vụ hoặc văn phong máy móc (-50 điểm)
  const refusalPhrases = [
    "tôi không thể",
    "i cannot",
    "tôi là một mô hình ngôn ngữ",
    "as an ai",
    "tôi không có khả năng",
    "xin lỗi, nhưng tôi không thể",
    "tôi chỉ là một trợ lý ảo",
  ];
  for (const phrase of refusalPhrases) {
    if (lowerResp.includes(phrase)) {
      score -= 50;
      break;
    }
  }

  return score;
}
