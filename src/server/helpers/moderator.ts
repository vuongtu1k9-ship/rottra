import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";

export const DEFAULT_SAFE_IMAGE = "/assets/Rottra-default-agri.png";

// Domains that are strictly allowed for media links
const ALLOWED_DOMAINS = ["image.pollinations.ai", "rottra.pages.dev", "cdn.jsdelivr.net", "fonts.googleapis.com"];

/**
 * Uses the local LLM to evaluate if text contains sensitive/NSFW content.
 */
export async function isTextSafeAI(text: string): Promise<boolean> {
  if (!text || text.trim() === "") return true;

  try {
    const response = await generateTextLocal({
      system:
        "You are a strict content moderation AI. Read the text and if it contains ANY NSFW, porn, gore, violence, or illegal content, reply exactly with 'UNSAFE'. Otherwise, reply exactly with 'SAFE'. Do not explain.",
      prompt: `Text to evaluate: "${text}"`,
    });

    if (response?.text?.toUpperCase().includes("UNSAFE")) {
      return false;
    }
    return true;
  } catch (error) {
    console.error("Text Moderation AI failed, defaulting to safe:", error);
    return true;
  }
}

/**
 * Validates a media URL based on a strict allowlist.
 */
export function isMediaSafe(url: string): boolean {
  if (!url) return true;
  // Local paths are inherently safe
  if (url.startsWith("/") || url.startsWith(".")) return true;
  // Base64 is allowed if needed, though we can restrict it
  if (url.startsWith("data:image")) return true;

  try {
    const parsedUrl = new URL(url);
    const isAllowed = ALLOWED_DOMAINS.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Moderates a product's text and media array using Keywordless AI methods and Domain checks.
 */
export async function moderateProductData(productData: any): Promise<any> {
  const sanitized = { ...productData };

  // Moderate Name
  if (sanitized.name) {
    const isNameSafe = await isTextSafeAI(sanitized.name);
    if (!isNameSafe) {
      sanitized.name = "Sản phẩm không phù hợp (Đã bị ẩn)";
    }
  }

  // Moderate Description
  if (sanitized.description) {
    const isDescSafe = await isTextSafeAI(sanitized.description);
    if (!isDescSafe) {
      sanitized.description = "Mô tả vi phạm chính sách cộng đồng và đã bị hệ thống AI tự động gỡ bỏ.";
    }
  }

  // Moderate Media Images (Domain strict check)
  if (sanitized.media && Array.isArray(sanitized.media)) {
    const safeMedia = [];
    for (const m of sanitized.media) {
      if (m?.link) {
        if (isMediaSafe(m.link)) {
          safeMedia.push(m);
        } else {
          safeMedia.push({ ...m, link: DEFAULT_SAFE_IMAGE });
        }
      } else {
        safeMedia.push(m);
      }
    }
    sanitized.media = safeMedia;
  } else if (sanitized.media && typeof sanitized.media === "string") {
    if (!isMediaSafe(sanitized.media)) {
      sanitized.media = DEFAULT_SAFE_IMAGE;
    }
  }

  return sanitized;
}
