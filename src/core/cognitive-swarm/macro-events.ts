import { Deterministic } from "~/shared/utils/rng";
export interface MacroEvent {
  id: string;
  name: string;
  description: string;
  costPriceMultiplier: number;
  basePriceMultiplier: number;
  quantityMultiplier: number;
  negotiationSuccessRateDelta: number; // Tăng/giảm tỷ lệ đàm phán thành công
}

export const MACRO_EVENTS: MacroEvent[] = [
  {
    id: "HAN_MAN",
    name: "Thiên tai Hạn mặn Tây Nam Bộ ☀️",
    description: "Nắng nóng kéo dài và xâm nhập mặn nghiêm trọng khiến sản lượng nông sản sụt giảm mạnh, chi phí sản xuất tăng vọt.",
    costPriceMultiplier: 1.35, // Chi phí tăng 35%
    basePriceMultiplier: 1.25, // Giá bán tăng 25%
    quantityMultiplier: 0.7, // Nguồn cung giảm 30%
    negotiationSuccessRateDelta: -0.1, // Khó thương lượng hơn do khan hiếm
  },
  {
    id: "TRUNG_MUA",
    name: "Được mùa được giá ở Tây Nguyên 🌾",
    description: "Thời tiết thuận lợi giúp mùa vụ bội thu, nông sản dồi dào, các phân cách đẩy mạnh giao dịch và giảm giá nhẹ để đẩy hàng.",
    costPriceMultiplier: 0.8, // Chi phí sản xuất giảm 20%
    basePriceMultiplier: 0.85, // Giá thị trường hạ 15%
    quantityMultiplier: 1.5, // Nguồn cung tăng 50%
    negotiationSuccessRateDelta: 0.15, // Dễ thương lượng chốt giá thành công hơn
  },
  {
    id: "LAM_PHAT",
    name: "Cơn bão Lạm phát toàn cầu 📈",
    description: "Đồng tiền mất giá nhẹ, chi phí vận chuyển logisitics tăng mạnh khiến tất cả mặt hàng bị đẩy giá bán.",
    costPriceMultiplier: 1.15,
    basePriceMultiplier: 1.2,
    quantityMultiplier: 0.95,
    negotiationSuccessRateDelta: -0.05,
  },
  {
    id: "NHAP_SIEUTOC",
    name: "Thông quan siêu tốc đường biên ⚡",
    description:
      "Cửa khẩu mở rộng thông quan nhanh chóng, nhu cầu xuất khẩu tăng vọt, hoạt động đàm phán thương mại diễn ra cực kỳ sôi động.",
    costPriceMultiplier: 0.95,
    basePriceMultiplier: 1.1,
    quantityMultiplier: 1.1,
    negotiationSuccessRateDelta: 0.25, // Tỷ lệ đàm phán chốt thành công tăng 25%
  },
];

let activeMacroEvent: MacroEvent | null = null;

export function triggerRandomMacroEvent(): MacroEvent {
  const randomIndex = Math.floor(Deterministic.random() * MACRO_EVENTS.length);
  activeMacroEvent = MACRO_EVENTS[randomIndex];
  console.log(`\n📢 [Macroeconomics Event Triggered] ${activeMacroEvent.name}`);
  console.log(`   └─ ${activeMacroEvent.description}\n`);
  return activeMacroEvent;
}

export function getActiveMacroEvent(): MacroEvent | null {
  return activeMacroEvent;
}

export function clearActiveMacroEvent() {
  activeMacroEvent = null;
}

export function applyMacroEffects(
  basePrice: number,
  quantity: number,
  costPrice: number,
): { basePrice: number; quantity: number; costPrice: number } {
  if (!activeMacroEvent) {
    return { basePrice, quantity, costPrice };
  }
  return {
    basePrice: basePrice * activeMacroEvent.basePriceMultiplier,
    quantity: Math.round(quantity * activeMacroEvent.quantityMultiplier),
    costPrice: costPrice * activeMacroEvent.costPriceMultiplier,
  };
}
