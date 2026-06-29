import { createSignal, createEffect } from "solid-js";
import { syncUserPreferences } from "~/server/helpers/user-sync";

// Khởi tạo theme từ localStorage hoặc hệ thống
const getInitialTheme = () => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

export const [theme, setTheme] = createSignal(getInitialTheme());

// Hàm chuyển đổi theme tập trung
export const toggleTheme = () => {
  const next = theme() === "dark" ? "light" : "dark";
  setTheme(next);
  localStorage.setItem("theme", next);
  applyTheme(next);
  syncUserPreferences({ theme: next });
};

// Hàm áp dụng theme lên thẻ html
export const applyTheme = (t: string) => {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  if (t === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
  }
};

// Lắng nghe thay đổi hệ thống nếu người dùng chưa chọn thủ công
if (typeof window !== "undefined") {
  window.addEventListener("theme_updated", () => {
    const saved = localStorage.getItem("theme");
    if (saved && (saved === "dark" || saved === "light")) {
      setTheme(saved);
      applyTheme(saved);
    }
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      const next = e.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    }
  });
}
