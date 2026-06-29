/**
 * Quy hoạch Tuyến tính (Linear Programming) & Cân bằng Thị trường
 * Dành cho việc tự động điều tiết giá nông sản dựa trên Cung - Cầu
 * Core Math: Market Equilibrium & Boundary Constraints
 */

export interface MarketState {
  currentPrice: number;
  totalSupply: number; // Tổng lượng hàng hóa hiện có trên sàn (Supply)
  totalDemand: number; // Sức mua của các Agent quy ra hàng hóa (Demand)
  elasticity: number; // Độ co giãn giá (thường 0.1 -> 0.5)
}

export function calculateEquilibriumPrice(state: MarketState): number {
  const { currentPrice, totalSupply, totalDemand, elasticity } = state;

  if (totalSupply <= 0) {
    // Khan hiếm tuyệt đối, quy hoạch tuyến tính đẩy giá lên trần
    return Math.round(currentPrice * (1 + elasticity));
  }

  if (totalDemand <= 0) {
    // Không có sức mua, rớt giá thê thảm
    return Math.round(currentPrice * (1 - elasticity));
  }

  // Phương trình tuyến tính: Tỉ lệ chênh lệch Cung Cầu
  const ratio = totalDemand / totalSupply;

  // Làm mềm mức độ thay đổi bằng hàm Log tự nhiên (Smoothing Function)
  // Tránh lạm phát siêu mãnh liệt nếu Demand gấp 100 lần Supply
  const priceAdjustment = Math.log(ratio) * elasticity;

  let newPrice = currentPrice * (1 + priceAdjustment);

  // Ràng buộc Tuyến tính (Linear Constraints):
  // Giá không được rớt quá 90% (dumping) và không tăng vượt 300% (bubble) trong 1 chu kỳ
  newPrice = Math.max(newPrice, currentPrice * 0.1);
  newPrice = Math.min(newPrice, currentPrice * 3.0);

  return Math.round(newPrice);
}
