import { Secure } from "~/shared/utils/rng";
import { createSignal } from "solid-js";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export { toasts };

export function showToast(type: ToastType, message: string) {
  const id = Secure.uuid().split("-")[0];
  setToasts((prev) => {
    const filtered = prev.filter((t) => t.message !== message);
    return [...filtered, { id, type, message }];
  });

  // Auto dismiss after 4 seconds
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
}

// Bind to window object for global usage across any file in the workspace
if (typeof window !== "undefined") {
  (window as any).showToast = showToast;

  // Override default browser alert with beautiful custom toast notifications
  window.alert = (message?: any) => {
    if (!message) return;
    const msgLower = message.toLowerCase();
    let type: ToastType = "info";
    if (msgLower.includes("thành công") || msgLower.includes("success") || msgLower.includes("🎉") || msgLower.includes("đã thêm")) {
      type = "success";
    } else if (
      msgLower.includes("lỗi") ||
      msgLower.includes("thất bại") ||
      msgLower.includes("error") ||
      msgLower.includes("hỏng") ||
      msgLower.includes("không thể")
    ) {
      type = "error";
    } else if (
      msgLower.includes("cảnh báo") ||
      msgLower.includes("chú ý") ||
      msgLower.includes("warning") ||
      msgLower.includes("vui lòng")
    ) {
      type = "warning";
    }
    showToast(type, message);
  };
}
