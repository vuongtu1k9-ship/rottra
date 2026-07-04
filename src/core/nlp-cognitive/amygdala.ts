export class Amygdala {
  /**
   * Tính toán độ biến động cảm xúc (Entropy) dựa trên tần suất ký tự
   */
  public static calculateEmotionalEntropy(text: string): number {
    const str = text.trim();
    if (!str) return 0;
    const freqs: Record<string, number> = {};
    for (const char of str) freqs[char] = (freqs[char] || 0) + 1;
    return Object.values(freqs).reduce((sum, f) => {
      const p = f / str.length;
      return sum - p * Math.log2(p);
    }, 0);
  }

  /**
   * Phân loại ý định cảm xúc (Fast Sentiment Analysis)
   */
  public static detectEmotionalIntent(text: string): "PSYCHOLOGY" | "COMPLAINT" | "GENERAL" {
    const trimmed = text.toLowerCase().trim();
    if (/giúp|tâm sự|buồn|cảm xúc|tình cảm/i.test(trimmed)) return "PSYCHOLOGY";
    if (/lỗi|tệ|kém|than phiền|bực|đắt|mắc|tồi/i.test(trimmed)) return "COMPLAINT";
    return "GENERAL";
  }

  /**
   * Phản xạ cực nhanh (System 1 Fast-Path)
   * Kích hoạt khi khách hàng quá tức giận, chê đắt hoặc hỏi câu đơn giản (Chào hỏi, Giá)
   */
  public static triggerFastReflex(botId: string, botName: string, prodName: string, price: string, query: string): string | null {
    const qClean = query.toLowerCase().trim();

    // Fast Path 1: Chào hỏi đơn giản
    const isGreeting = /^(xin chào|chào|hello|hi|helo|alo|chào bạn|chào sếp|chào nha|hihi chao)\s*$/i.test(qClean);
    // Fast Path 2: Hỏi thông tin sản phẩm
    const isProductInfo = /^(giá bao nhiêu|còn hàng không|còn bao nhiêu|sản phẩm gì|bán gì đó|sản phẩm là gì)\s*$/i.test(qClean);

    // Fast Path 3: Cảm xúc tiêu cực (Chê đắt)
    const isComplaint = this.detectEmotionalIntent(query) === "COMPLAINT";

    if (!isGreeting && !isProductInfo && !isComplaint) return null;

    const getRand = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];
    const productAdjectives = [
      "thượng hạng, được thu hoạch trực tiếp từ nông trại",
      "đạt chuẩn chất lượng hữu cơ, chăm sóc tỉ mỉ",
      "đã qua tuyển chọn kỹ lưỡng, mang đậm tình cảm",
      "giàu dưỡng chất và hương vị tự nhiên",
    ];

    if (botId === "daoTieuCuu" || botName.includes("Cửu")) {
      const openings = [
        `Tiểu Cửu kính chào sếp! Sếp ghé chơi làm em vui lắm!`,
        `Chào sếp yêu quý! Tiểu Cửu đây ạ!`,
        `Tiểu Cửu xin nghe! Sếp đang quan tâm ${prodName} đúng không ạ?`,
      ];
      if (isComplaint) {
        return `${getRand(openings)} Sếp ơi, ${prodName} này em tự tay chăm sóc đó! Giá ${price}₫ là lấy công làm lãi thôi, sếp thương em thì chốt đi nha!`;
      }
      return `${getRand(openings)} ${prodName} ${getRand(productAdjectives)} đang chờ sếp chốt với giá cực sốc ${price}₫ nha!`;
    }

    // Default Fallback cho các bot khác
    const defaultOpenings = [`Chào sếp. Rất hân hạnh được trò chuyện!`, `Xin chào! Sếp cần tư vấn về ${prodName} ạ?`];
    if (isComplaint) {
      return `${getRand(defaultOpenings)} Giá ${price}₫ hoàn toàn xứng đáng với chất lượng ${getRand(productAdjectives)}. Mong sếp cân nhắc kỹ ạ.`;
    }
    return `${getRand(defaultOpenings)} Sản phẩm ${prodName} hiện có giá ${price}₫. Sếp chốt đơn luôn chứ ạ?`;
  }
}
