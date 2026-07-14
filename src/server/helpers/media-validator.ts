import { z } from "zod";
import { createLogger } from "~/shared/logger";

const log = createLogger("helpers/media-validator");

// Schema kiểm duyệt URL: Bắt buộc là đường dẫn nội bộ (bắt đầu bằng /)
// HOẶC là URL chính thức của hệ thống (rottra.pages.dev)
const safeUrlSchema = z.string().refine((url) => {
  if (url.startsWith("/")) return true; // Cục bộ (vd: /images/logo.png)
  if (url.startsWith("data:image/")) return true; // Hỗ trợ ảnh nhúng trực tiếp data URI (vd: SVG, PNG)

  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      // Cho phép localhost (test) và rottra.pages.dev (production)
      return host === "localhost" || host === "rottra.pages.dev" || host.endsWith(".rottra.pages.dev");
    } catch {
      return false;
    }
  }

  return false;
}, "Ảnh ngoại lai không được phép! Chỉ chấp nhận ảnh nội bộ của Rottra.");

export const mediaItemSchema = z.object({
  link: safeUrlSchema,
  name: z.string().optional(),
  type: z.string().optional(),
});

export const productMediaArraySchema = z.array(mediaItemSchema);

/**
 * Hàm lọc triệt để các ảnh ngoại lai khỏi mảng media.
 * Nếu phát hiện ảnh rác, nó sẽ tự động loại bỏ.
 * Nếu mảng trống sau khi lọc, sẽ trả về ảnh mặc định.
 */
export function sanitizeProductMedia(mediaInput: any): { link: string; name?: string; type?: string }[] {
  if (!mediaInput || !Array.isArray(mediaInput)) {
    return [{ link: "/images/no-image.avif", type: "image" }];
  }

  const safeMedia = mediaInput
    .filter((m: any) => {
      const link = typeof m === "string" ? m : m.link;
      const result = safeUrlSchema.safeParse(link);
      if (!result.success) {
        log.warn(`[SECURITY] Phóng lợn chặn đứng ảnh ngoại lai: ${link}`);
        return false;
      }
      return true;
    })
    .map((m: any) => {
      return typeof m === "string" ? { link: m, type: "image" } : m;
    });

  if (safeMedia.length === 0) {
    return [{ link: "/images/no-image.avif", type: "image" }];
  }

  return safeMedia;
}
