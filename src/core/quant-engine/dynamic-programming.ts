/**
 * Tối ưu hóa Tổ hợp (Combinatorial Optimization) & Quy hoạch động (Dynamic Programming)
 * Bounded Knapsack Problem Algorithm
 * Dành riêng cho Rottra AI Commerce Trading
 */

export interface KnapsackItem {
  id: string;
  name: string;
  cost: number; // Trọng lượng (Weight - Số tiền mua)
  value: number; // Giá trị (Value - Điểm sinh lời)
  qty: number; // Số lượng gói khả dụng
}

export function dynamicProgrammingTradeOptimize(
  budget: number,
  items: KnapsackItem[],
  scaleFactor: number = 10000, // Scale down budget and cost để tránh tràn mảng RAM (Heap OOM)
): { totalCost: number; totalValue: number; selectedItems: KnapsackItem[] } {
  if (budget <= 0 || items.length === 0) {
    return { totalCost: 0, totalValue: 0, selectedItems: [] };
  }

  // Sanity scaling check
  let currentScale = scaleFactor;
  let scaledBudget = Math.floor(budget / currentScale);

  // Tự động điều chỉnh scaleFactor nếu ngân quỹ quá lớn (>1,000,000 mảng)
  while (scaledBudget > 1000000) {
    currentScale *= 10;
    scaledBudget = Math.floor(budget / currentScale);
  }

  // Chuyển Bounded Knapsack thành 0-1 Knapsack bằng cách đập phẳng (Flatten) các gói hàng
  const flatItems: KnapsackItem[] = [];
  for (const item of items) {
    for (let i = 0; i < item.qty; i++) {
      flatItems.push({ ...item, qty: 1 });
    }
  }

  // Khởi tạo bảng Quy hoạch động DP bằng Float64Array tối ưu hiệu suất
  // dp[w] lưu tổng 'value' lớn nhất đạt được với chi phí <= w
  const dp = new Float64Array(scaledBudget + 1).fill(0);

  // itemSelection[i][w] = 1 nếu chọn món đồ i tại mức ngân quỹ w
  const itemSelection = Array.from({ length: flatItems.length + 1 }, () => new Int8Array(scaledBudget + 1).fill(0));

  // Core Dynamic Programming Logic
  for (let i = 1; i <= flatItems.length; i++) {
    const item = flatItems[i - 1];
    const scaledCost = Math.ceil(item.cost / currentScale);
    const itemValue = item.value;

    // Duyệt ngược từ lớn xuống nhỏ (1D array optimization)
    for (let w = scaledBudget; w >= 0; w--) {
      if (scaledCost <= w) {
        if (dp[w - scaledCost] + itemValue > dp[w]) {
          dp[w] = dp[w - scaledCost] + itemValue;
          itemSelection[i][w] = 1; // Đánh dấu đã chọn
        }
      }
    }
  }

  // Backtracking: Truy vết đường đi để tìm các món đồ đã chọn
  const selected: KnapsackItem[] = [];
  let w = scaledBudget;
  let finalCost = 0;
  let finalValue = 0;

  for (let i = flatItems.length; i > 0; i--) {
    if (itemSelection[i][w] === 1) {
      const item = flatItems[i - 1];
      selected.push(item);
      const scaledCost = Math.ceil(item.cost / currentScale);
      w -= scaledCost;
      finalCost += item.cost;
      finalValue += item.value;
    }
  }

  // Gộp lại các món đồ giống nhau
  const resultMap = new Map<string, KnapsackItem>();
  for (const item of selected) {
    if (resultMap.has(item.id)) {
      resultMap.get(item.id)!.qty += 1;
      resultMap.get(item.id)!.cost += item.cost;
      resultMap.get(item.id)!.value += item.value;
    } else {
      resultMap.set(item.id, { ...item, qty: 1 });
    }
  }

  return {
    totalCost: finalCost,
    totalValue: finalValue,
    selectedItems: Array.from(resultMap.values()),
  };
}
