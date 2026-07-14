import { Deterministic } from "~/shared/utils/rng";
/**
 * Reflex Template Bank (System 1 — không dùng LLM)
 * ------------------------------------------------------------------
 * Cung cấp câu trả lời phản xạ ĐA DẠNG cho các intent System 1, kèm
 * cơ chế CHỐNG LẶP: tránh trả về cùng một template hai lần liên tiếp
 * cho cùng (botId + intent) bằng một ring buffer nhỏ trong RAM.
 *
 * Tách khỏi Amygdala để dễ mở rộng và tái sử dụng ở BasalGanglia fallback.
 */

import type { IntentLabel } from "./intent-classifier";

export interface TemplateContext {
  botId?: string;
  botName?: string;
  prodName?: string;
  price?: string;
}

type TemplateFn = (ctx: Required<Pick<TemplateContext, "botName" | "prodName" | "price">>) => string;

/** Lịch sử template gần nhất theo key để chống lặp (giữ tối đa 3 mục/khoá). */
const recentlyUsed = new Map<string, number[]>();
const MAX_HISTORY = 3;

function pickNonRepeating(key: string, poolSize: number): number {
  const history = recentlyUsed.get(key) ?? [];
  let idx = Math.floor(Deterministic.random() * poolSize);
  // Thử tối đa vài lần để tránh trùng mục gần đây (nếu pool đủ lớn).
  if (poolSize > history.length) {
    let guard = 0;
    while (history.includes(idx) && guard < 8) {
      idx = Math.floor(Deterministic.random() * poolSize);
      guard++;
    }
  }
  const next = [idx, ...history].slice(0, MAX_HISTORY);
  recentlyUsed.set(key, next);
  return idx;
}

/** Chrono-Cognition: lời chào theo khung giờ. */
function chronoGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Chào buổi sáng sếp";
  if (h >= 11 && h < 14) return "Chào buổi trưa sếp";
  if (h >= 14 && h < 18) return "Chào buổi chiều sếp";
  if (h >= 18 && h < 22) return "Chào buổi tối sếp";
  return "Dạ khuya rồi sếp vẫn thức ạ";
}

const TEMPLATES: Partial<Record<IntentLabel, TemplateFn[]>> = {
  GREETING: [
    ({ botName }) => `${chronoGreeting()}! Em là ${botName}, sếp cần em hỗ trợ gì ạ?`,
    ({ botName }) => `Dạ ${botName} nghe đây sếp. Sếp đang cần tư vấn điều gì không ạ?`,
    ({ botName }) => `${botName} kính chào sếp! Rất vui được trò chuyện cùng sếp ạ.`,
    ({ botName }) => `Sếp gọi em ạ? ${botName} luôn sẵn sàng phục vụ sếp!`,
  ],
  FAREWELL: [
    () => `Dạ em chào sếp, hẹn gặp lại sếp ạ! Chúc sếp một ngày tốt lành.`,
    ({ botName }) => `Tạm biệt sếp nhé! ${botName} luôn ở đây mỗi khi sếp cần ạ.`,
    () => `Dạ vâng, sếp nghỉ ngơi nhé. Cần gì sếp cứ gọi em bất cứ lúc nào ạ!`,
  ],
  THANKS: [
    () => `Dạ không có gì đâu ạ, được giúp sếp là niềm vui của em!`,
    ({ botName }) => `Sếp khách sáo quá, ${botName} luôn sẵn lòng hỗ trợ sếp mà ạ!`,
    () => `Dạ vâng ạ! Sếp còn cần em giúp gì nữa không ạ?`,
  ],
  AFFIRM: [
    () => `Dạ vâng, em ghi nhận rồi ạ! Sếp cần em triển khai luôn không ạ?`,
    () => `Tuyệt vời ạ! Vậy mình chốt như thế sếp nhé.`,
    () => `Dạ được ạ, em xin phép tiếp tục nhé sếp.`,
  ],
  DENY: [
    () => `Dạ em hiểu rồi ạ. Vậy sếp muốn điều chỉnh theo hướng nào để em hỗ trợ tốt hơn ạ?`,
    () => `Dạ không sao ạ, sếp cứ cân nhắc thêm. Em luôn sẵn sàng khi sếp cần.`,
  ],
  IDENTITY: [
    ({ botName }) =>
      `Dạ em là ${botName} — hệ thống AI AI của Rottra, chạy hoàn toàn cục bộ (offline-first). Em có thể tư vấn sản phẩm, tính toán, tra cứu và trò chuyện cùng sếp ạ!`,
    ({ botName }) =>
      `Em là ${botName} ạ. Em giúp sếp được nhiều việc: từ hỏi giá, tư vấn sản phẩm, đến giải toán và phân tích số liệu. Sếp thử giao em một việc xem ạ!`,
  ],
  AUTHOR: [
    ({ botName }) =>
      `Dạ em là ${botName}, được phát triển bởi đội ngũ Rottra AI ạ. Em vận hành trên lõi nhận thức mô phỏng não bộ, chạy cục bộ để bảo mật dữ liệu cho sếp.`,
    ({ botName }) => `${botName} do team Rottra AI xây dựng ạ. Em tự hào là hệ thống AI local-first, không phụ thuộc dịch vụ ngoài!`,
  ],
  CLEAR_HISTORY: [
    () => `Dạ vâng, sếp muốn xoá lịch sử trò chuyện đúng không ạ? Em đã ghi nhận yêu cầu, sếp xác nhận để em dọn sạch đoạn chat nhé!`,
    () => `Dạ để làm mới cuộc trò chuyện, sếp bấm xác nhận giúp em. Em sẽ bắt đầu lại từ đầu với sếp ạ.`,
  ],
  PRICE_QUERY: [
    ({ prodName, price }) => `Dạ ${prodName} bên em hiện có giá ${price}₫ ạ. Mức này đã tối ưu cho sếp rồi, sếp chốt luôn nhé!`,
    ({ prodName, price }) => `Sếp hỏi giá ${prodName} đúng không ạ? Hiện tại chỉ ${price}₫ thôi ạ. Sếp cần em tư vấn thêm gì không?`,
  ],
  PRODUCT_INFO: [
    ({ prodName, price }) => `Dạ bên em đang có ${prodName} — hàng tuyển chọn kỹ, giá ${price}₫ ạ. Sếp muốn em mô tả chi tiết hơn không?`,
    ({ prodName }) => `Sản phẩm chủ lực bên em là ${prodName} ạ, chất lượng đảm bảo. Sếp quan tâm điểm nào để em tư vấn sâu hơn ạ?`,
  ],
  COMPLAINT: [
    ({ prodName, price }) =>
      `Dạ em xin lỗi nếu có điều khiến sếp chưa hài lòng ạ. ${prodName} với giá ${price}₫ là em đã cân đối rất kỹ về chất lượng. Sếp cho em biết cụ thể để em hỗ trợ tốt hơn nhé!`,
    () => `Dạ em thành thật ghi nhận góp ý của sếp ạ. Sếp nói rõ hơn vấn đề để em xử lý ngay được không ạ?`,
  ],
  PSYCHOLOGY: [
    () => `Dạ em ở đây lắng nghe sếp ạ. Sếp cứ chia sẻ, đôi khi nói ra được là nhẹ lòng hơn nhiều đó sếp.`,
    () => `Nghe sếp tâm sự em cũng thương ạ. Sếp không phải đối mặt một mình đâu, em luôn ở đây cùng sếp.`,
  ],
  NAVIGATION: [() => `Dạ sếp muốn em đưa tới trang nào ạ (giỏ hàng, trang cá nhân, cuộc họp...)? Sếp nói rõ giúp em nhé!`],
  SMALLTALK: [({ botName }) => `Dạ ${botName} đây ạ! Sếp hôm nay thế nào, có gì em hỗ trợ được không ạ?`],
};

export class ReflexTemplates {
  /**
   * Sinh câu trả lời template cho intent (System 1). Trả null nếu không có
   * template phù hợp (để lớp gọi rơi xuống semantic/clarify).
   */
  public static render(intent: IntentLabel, ctx: TemplateContext): string | null {
    const pool = TEMPLATES[intent];
    if (!pool || pool.length === 0) return null;

    const resolved = {
      botName: ctx.botName?.trim() || "RottraAI",
      prodName: ctx.prodName?.trim() || "nông sản hảo hạng",
      price: ctx.price?.trim() || "50,000",
    };

    const key = `${ctx.botId ?? "default"}:${intent}`;
    const idx = pickNonRepeating(key, pool.length);
    return pool[idx](resolved);
  }

  public static has(intent: IntentLabel): boolean {
    const pool = TEMPLATES[intent];
    return !!pool && pool.length > 0;
  }
}
