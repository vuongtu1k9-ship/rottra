/**
 * RAG Cache Warmer — Preloads hot queries into semantic cache on server startup.
 * Eliminates cold-start latency for the most common user queries.
 */

import { writeSemanticCache } from "./semantic-cache";

interface WarmEntry {
  botId: string;
  query: string;
  response: string;
}

/**
 * Common greeting patterns for each bot persona.
 * These are the first queries new users send — caching them eliminates cold-start lag.
 */
const GREETING_WARMUP: WarmEntry[] = [
  // Default / generic
  {
    botId: "default",
    query: "xin chào",
    response: "Chào sếp! Hệ thống Rottra Core sẵn sàng hỗ trợ thương lượng. Sếp muốn tìm hiểu về sản phẩm nào?",
  },
  { botId: "default", query: "chào bạn", response: "Xin chào sếp, tôi là trợ lý giao thương Rottra. Sếp cần tôi tư vấn gì hôm nay?" },
  {
    botId: "default",
    query: "hello",
    response: "Chào sếp! Chào mừng đến với Rottra. Tôi sẵn sàng hỗ trợ sếp về nông sản và thương lượng.",
  },
  { botId: "default", query: "chào sếp", response: "Chào sếp! Hệ thống Rottra Core đã sẵn sàng. Sếp muốn mua hay bán nông sản hôm nay?" },

  // toLuong
  {
    botId: "toLuong",
    query: "xin chào",
    response: "Tô Lương ta xin kính chào các vị! Rất vui được gặp hiền hữu. Hôm nay ta có lô hàng tuyệt vời chờ các vị đây!",
  },
  {
    botId: "toLuong",
    query: "chào bạn",
    response: "Chào bằng hữu, ta là Tô Lương. Hôm nay được gặp hữu là niềm vui của ta đó! Hữu muốn xem hàng gì?",
  },

  // thuongNguyet
  {
    botId: "thuongNguyet",
    query: "xin chào",
    response: "Lão phu Thương Nguyệt chào hiền hữu. Rất vui được gặp cố nhân! Hữu ghé thăm là lão phu vui lắm!",
  },
  {
    botId: "thuongNguyet",
    query: "chào bạn",
    response: "Chào hiền hữu, Thương Nguyệt ta rất vinh hạnh được trò chuyện cùng hữu. Hữu muốn tìm hiểu gì?",
  },

  // tramTinh
  { botId: "tramTinh", query: "xin chào", response: "Vũ trụ đã đưa sếp đến với Trầm Tinh, em vui lắm! Sếp muốn em tư vấn gì hôm nay?" },
  {
    botId: "tramTinh",
    query: "chào bạn",
    response: "Trầm Tinh chào sếp. Ánh trăng dịu dàng đang soi đường cho cuộc gặp gỡ này. Sếp cần gì?",
  },

  // daoTieuCuu
  {
    botId: "daoTieuCuu",
    query: "xin chào",
    response: "Tiểu Cửu kính chào sếp! Sếp ghé chơi khiến tiểu cô vui lắm! Sếp muốn xem hàng gì nào?",
  },
];

/**
 * Common product inquiry patterns — cached for instant response.
 */
const PRODUCT_WARMUP: WarmEntry[] = [
  { botId: "default", query: "giá bao nhiêu", response: "Sếp vui lòng cho em biết sản phẩm cụ thể để em báo giá chính xác nhất ạ!" },
  { botId: "default", query: "còn hàng không", response: "Dạ hiện tại shop còn hàng ạ. Sếp muốn đặt lô bao nhiêu ký ạ?" },
  {
    botId: "default",
    query: "sản phẩm gì",
    response:
      "Shop chuyên các loại nông sản chất lượng cao: cà phê, hồ tiêu, điều, sầu riêng, xoài, cam và nhiều loại khác. Sếp quan tâm loại nào ạ?",
  },
  {
    botId: "default",
    query: "bán gì đó",
    response: "Chào sếp! Rottra chuyên cung cấp nông sản thượng hạng từ các vùng miền Việt Nam. Sếp muốn tìm hiểu sản phẩm nào?",
  },
];

/**
 * Common intent patterns that benefit from caching.
 */
const INTENT_WARMUP: WarmEntry[] = [
  // Weather
  {
    botId: "default",
    query: "thời tiết hôm nay",
    response: "Để em tra cứu thông tin thời tiết cho sếp nhé! Hiện tại hệ thống đang cập nhật dữ liệu thời tiết real-time.",
  },
  {
    botId: "default",
    query: "thời tiết ngày mai",
    response: "Em sẽ kiểm tra dự báo thời tiết ngày mai cho sếp. Thời tiết ảnh hưởng lớn đến kế hoạch nông vụ!",
  },

  // Currency
  {
    botId: "default",
    query: "tỷ giá usd",
    response: "Em đang cập nhật tỷ giá USD mới nhất cho sếp. Tỷ giá thay đổi liên tục nên em sẽ lấy dữ liệu real-time ạ.",
  },
  {
    botId: "default",
    query: "giá cà phê",
    response: "Giá cà phê hôm nay đang có biến động. Em sẽ lấy giá cập nhật từ thị trường cho sếp nhé!",
  },

  // Common navigation
  { botId: "default", query: "giỏ hàng", response: "Sếp muốn xem giỏ hàng ạ? Em sẽ hiển thị danh sách sản phẩm đã chọn cho sếp." },
  { botId: "default", query: "đơn hàng", response: "Sếp muốn kiểm tra đơn hàng ạ? Em sẽ tra cứu thông tin đơn hàng cho sếp ngay." },

  // Bargaining patterns
  {
    botId: "default",
    query: "giảm giá",
    response: "Sếp ơi, giá hiện tại đã là giá tốt nhất rồi ạ. Nếu sếp mua số lượng lớn, em có thể thương lượng thêm优惠 nhé!",
  },
  {
    botId: "default",
    query: "giá rẻ hơn được không",
    response: "Sếp ơi, giá này đã là giá gốc rồi ạ. Hàng chất lượng cao nên giá tương xứng với giá trị ạ!",
  },
];

/**
 * Preloads all warm-up entries into the semantic cache.
 * Called once on server startup — non-blocking, fire-and-forget.
 */
export function warmSemanticCache(): void {
  const startTime = Date.now();
  let count = 0;

  const allEntries = [...GREETING_WARMUP, ...PRODUCT_WARMUP, ...INTENT_WARMUP];

  for (const entry of allEntries) {
    writeSemanticCache(entry.botId, entry.query, entry.response);
    count++;
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[CacheWarmer] Warmed ${count} entries in ${elapsed}ms (${GREETING_WARMUP.length} greetings, ${PRODUCT_WARMUP.length} product, ${INTENT_WARMUP.length} intent)`,
  );
}
