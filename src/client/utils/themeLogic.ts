import { Solar, Lunar } from "lunar-typescript";

export type ThemeColors = {
  primary: string;
  background: string;
  text: string;
};

function getLunarHoliday(date: Date): string | null {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();

  // Tết Nguyên Đán (tháng 1 âm lịch, ngày 1-5)
  if (lunarMonth === 1 && lunarDay >= 1 && lunarDay <= 5) return "TET";
  // Giỗ Tổ Hùng Vương (10/3 âm)
  if (lunarMonth === 3 && lunarDay === 10) return "GIO_TO";
  // Tết Trung Thu (15/8 âm)
  if (lunarMonth === 8 && lunarDay >= 14 && lunarDay <= 16) return "TRUNG_THU";

  return null;
}

export function getAutoThemeColors(manualColors: ThemeColors): ThemeColors {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // 1. Solar Holidays
  if (mmdd === "01-01") return { primary: "#dc2626", background: "#fef2f2", text: "#1f2937" };
  if (mmdd === "04-30" || mmdd === "05-01" || mmdd === "09-02") return { primary: "#ef4444", background: "#fffbeb", text: "#1f2937" };
  if (mmdd === "03-08" || mmdd === "10-20") return { primary: "#ec4899", background: "#fdf2f8", text: "#1f2937" };
  if (month === 12 && day >= 23 && day <= 25) return { primary: "#16a34a", background: "#f0fdf4", text: "#1f2937" };
  if (month === 11 && now.getDay() === 5 && day >= 22 && day <= 28) return { primary: "#000000", background: "#111827", text: "#f9fafb" };

  // 2. Lunar Holidays (computed dynamically — no hardcoded dates)
  const lunarHoliday = getLunarHoliday(now);
  if (lunarHoliday === "TET") return { primary: "#dc2626", background: "#fffbeb", text: "#1f2937" };
  if (lunarHoliday === "GIO_TO") return { primary: "#b45309", background: "#fffbeb", text: "#1f2937" };
  if (lunarHoliday === "TRUNG_THU") return { primary: "#f59e0b", background: "#fffbeb", text: "#1f2937" };

  // 3. Seasons
  if (month >= 1 && month <= 3) return { primary: "#10b981", background: "#f0fdf4", text: "#1f2937" };
  if (month >= 4 && month <= 6) return { primary: "#0ea5e9", background: "#f0f9ff", text: "#1f2937" };
  if (month >= 7 && month <= 9) return { primary: "#d97706", background: "#fffbeb", text: "#1f2937" };
  if (month >= 10 && month <= 12) return { primary: "#1e3a8a", background: "#f3f4f6", text: "#111827" };

  return manualColors;
}
