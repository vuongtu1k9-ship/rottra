/**
 * Trái tim thị trường (Market Heartbeat) - Mô phỏng sự biến động giá nông sản động.
 * Sinh ra các nhiễu loạn giá cả trong khoảng ±5% mỗi chu kỳ (Brownian motion).
 */
export class MarketSimulator {
  private static prices: Map<string, number> = new Map();
  private static lastUpdate: number = 0;
  private static readonly UPDATE_INTERVAL_MS = 60 * 1000; // Cập nhật mỗi phút cho dễ test

  // Danh mục hàng hóa cơ bản và giá neo (Base Price)
  private static readonly BASE_PRODUCTS = {
    "sầu riêng": 60000,
    "cà phê": 110000,
    gạo: 18000,
    "hạt điều": 45000,
    tiêu: 80000,
    "nông sản": 50000, // default fallback
  };

  /**
   * Khởi tạo hoặc cập nhật giá trị thị trường
   */
  private static tick() {
    const now = Date.now();
    // Nếu chưa khởi tạo hoặc đã qua chu kỳ cập nhật
    if (this.prices.size === 0 || now - this.lastUpdate > this.UPDATE_INTERVAL_MS) {
      for (const [prod, basePrice] of Object.entries(this.BASE_PRODUCTS)) {
        // Sinh nhiễu loạn ngẫu nhiên từ -5% đến +5%
        // Công thức: fluctuation = (Math.random() * 0.1 - 0.05)
        const fluctuation = Math.random() * 0.1 - 0.05;
        let currentPrice = this.prices.get(prod) || basePrice;

        // Cập nhật giá mới nhưng chặn biên không quá ±20% so với Base Price để tránh lạm phát/giảm phát vô hạn
        currentPrice = currentPrice * (1 + fluctuation);

        // Ép biên
        const upperBound = basePrice * 1.2;
        const lowerBound = basePrice * 0.8;
        if (currentPrice > upperBound) currentPrice = upperBound;
        if (currentPrice < lowerBound) currentPrice = lowerBound;

        // Làm tròn tới hàng ngàn
        currentPrice = Math.round(currentPrice / 1000) * 1000;
        this.prices.set(prod, currentPrice);
      }
      this.lastUpdate = now;
      console.log("[MarketSimulator] Đã cập nhật nhịp đập thị trường (Price ticker updated).");
    }
  }

  /**
   * Lấy giá thị trường động cho một sản phẩm cụ thể
   */
  public static getDynamicPrice(prodName: string): number {
    this.tick();

    const pLower = prodName.toLowerCase();
    for (const [key, price] of this.prices.entries()) {
      if (pLower.includes(key)) {
        return price;
      }
    }

    // Nếu không khớp mặt hàng nào, lấy giá biến động của "nông sản" chung
    return this.prices.get("nông sản") || 50000;
  }
}
