/**
 * Hybrid Intent Classifier (self-contained, ZERO external deps)
 * ------------------------------------------------------------------
 * Được thiết kế để chạy đồng bộ (<1ms), KHÔNG import tokenizer/db/LLM
 * nhằm tránh import vòng (semantic-cache.ts đã ghi chú vấn đề này) và
 * để BasalGanglia có thể phân luồng System 1 / System 2 tức thời.
 *
 * 3 tầng theo chi phí tăng dần:
 *   Tầng 1 — REGEX: bắt intent hệ thống & xã giao (độ chính xác cao).
 *   Tầng 2 — KEYWORD có trọng số: bắt biến thể tự nhiên (bỏ dấu tiếng Việt).
 *   Tầng 3 — (để dành) semantic do lớp gọi bên ngoài đảm nhiệm.
 *
 * Nhãn intent được canh khớp với tool keys trong game-theory.getAgentTools()
 * để planner có thể map trực tiếp mà không cần LLM sinh JSON.
 */

export type CognitiveSystem = "SYSTEM_1" | "SYSTEM_2";

export type IntentLabel =
  // ── SYSTEM 1 (phản xạ, KHÔNG cần suy luận nặng) ──
  | "GREETING"
  | "FAREWELL"
  | "THANKS"
  | "AFFIRM"
  | "DENY"
  | "COMPLAINT"
  | "IDENTITY"
  | "AUTHOR"
  | "CLEAR_HISTORY"
  | "PRICE_QUERY"
  | "PRODUCT_INFO"
  | "PSYCHOLOGY"
  | "NAVIGATION"
  | "SMALLTALK"
  // ── SYSTEM 2 nhẹ (tra cứu, không tính toán) ──
  | "DEFINITION"
  | "WHY_QUESTION"
  | "SEARCH"
  | "WEB_SEARCH"
  // ── SYSTEM 2 nặng (cần Cognitive Arena / Planner) ──
  | "NPV"
  | "TSP"
  | "WARDROP"
  | "FORECAST"
  | "STATISTICS"
  | "ACADEMIC"
  // ── không rõ ──
  | "UNKNOWN";

export interface IntentResult {
  system: CognitiveSystem;
  intent: IntentLabel;
  /** 0..1 — dùng cho cổng chống-lạc-đề trong BasalGanglia */
  confidence: number;
  matchedBy: "regex" | "keyword" | "fallback";
}

/** Các intent BẮT BUỘC chạy System 2 nặng (LLM/Arena/Planner). */
const HEAVY_INTENTS: ReadonlySet<IntentLabel> = new Set<IntentLabel>(["NPV", "TSP", "WARDROP", "FORECAST", "STATISTICS", "ACADEMIC"]);

/** Ánh xạ intent -> System 1 / System 2. */
const SYSTEM_MAP: Record<IntentLabel, CognitiveSystem> = {
  GREETING: "SYSTEM_1",
  FAREWELL: "SYSTEM_1",
  THANKS: "SYSTEM_1",
  AFFIRM: "SYSTEM_1",
  DENY: "SYSTEM_1",
  COMPLAINT: "SYSTEM_1",
  IDENTITY: "SYSTEM_1",
  AUTHOR: "SYSTEM_1",
  CLEAR_HISTORY: "SYSTEM_1",
  PRICE_QUERY: "SYSTEM_1",
  PRODUCT_INFO: "SYSTEM_1",
  PSYCHOLOGY: "SYSTEM_1",
  NAVIGATION: "SYSTEM_1",
  SMALLTALK: "SYSTEM_1",
  DEFINITION: "SYSTEM_2",
  WHY_QUESTION: "SYSTEM_2",
  SEARCH: "SYSTEM_2",
  WEB_SEARCH: "SYSTEM_2",
  NPV: "SYSTEM_2",
  TSP: "SYSTEM_2",
  WARDROP: "SYSTEM_2",
  FORECAST: "SYSTEM_2",
  STATISTICS: "SYSTEM_2",
  ACADEMIC: "SYSTEM_2",
  UNKNOWN: "SYSTEM_2",
};

/** Chuẩn hoá: lowercase + bỏ dấu tiếng Việt để bắt "gia"/"giá"/"gía". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tầng 1: luật regex (ưu tiên tuyệt đối, confidence cao). */
const REGEX_RULES: ReadonlyArray<{ intent: IntentLabel; re: RegExp; conf: number }> = [
  {
    intent: "CLEAR_HISTORY",
    conf: 0.95,
    re: /\b(xoa|clear|reset|lam moi)\b.*\b(lich su|hoi thoai|tin nhan|chat|cuoc tro chuyen|doan chat)\b|^\/?(clear|reset)$/,
  },
  {
    intent: "AUTHOR",
    conf: 0.92,
    re: /\b(ai (tao|lam|phat trien|viet|sang tao|xay dung) ra (ban|em|may|rottra|con))|tac gia (cua ban|la ai)|nguoi tao ra (ban|em)|do ai (lam|tao) ra|cha de cua ban\b/,
  },
  {
    intent: "IDENTITY",
    conf: 0.9,
    re: /\b(ban la ai|ban ten (la )?gi|ban la gi|em la ai|em ten gi|gioi thieu ve ban|ban lam duoc gi|ban co the lam gi)\b/,
  },
  {
    intent: "GREETING",
    conf: 0.9,
    re: /\b(xin chao|chao|helo|hello|^hi\b|^hey\b|^alo\b|chao buoi (sang|trua|chieu|toi)|co o do khong)\b/,
  },
  { intent: "FAREWELL", conf: 0.9, re: /\b(tam biet|bye|goodbye|hen gap lai|di nhe|chao nhe|di day)\b/ },
  { intent: "THANKS", conf: 0.9, re: /\b(cam on|thank you|thanks|cam ta|tks|thx|biet on)\b/ },
  // Neo \s*$: chỉ khớp câu xác nhận/từ chối NGẮN ĐỘC LẬP (tránh "có sản phẩm không" -> AFFIRM).
  { intent: "AFFIRM", conf: 0.7, re: /^(co|dung|dung roi|ok|okay|oke|uh|um|dong y|chuan|chot|duoc|vang|da)\s*$/ },
  { intent: "DENY", conf: 0.7, re: /^(khong|ko|kg|thoi|khoi|khong can|khong phai|sai roi)\s*$/ },
  {
    intent: "TSP",
    conf: 0.85,
    re: /\b(tsp|traveling salesman|nguoi ban hang|duong di ngan nhat|toi uu (lo trinh|tuyen duong|duong di)|dinh tuyen giao hang)\b/,
  },
  {
    intent: "WARDROP",
    conf: 0.85,
    re: /\b(wardrop|phan luong giao thong|can bang mang luoi|user equilibrium|traffic flow|diem can bang giao thong)\b/,
  },
  { intent: "NPV", conf: 0.85, re: /\b(npv|gia tri hien tai rong|net present value|dong tien chiet khau|irr|thoi gian hoan von)\b/ },
  { intent: "FORECAST", conf: 0.82, re: /\b(arima|du bao|chuoi thoi gian|time series|du doan (san luong|xu huong|gia)|forecast)\b/ },
];

/** Tầng 2: từ điển có trọng số. Trọng số cao = intent "áp đảo" khi xuất hiện. */
const LEXICON: ReadonlyArray<{ intent: IntentLabel; weight: number; kw: string[] }> = [
  // System 2 nặng (trọng số cao)
  {
    intent: "STATISTICS",
    weight: 3,
    kw: ["xac suat", "phuong sai", "do lech chuan", "thong ke", "phan phoi", "trung binh cong", "trung vi", "hoi quy", "tuong quan"],
  },
  {
    intent: "ACADEMIC",
    weight: 3,
    kw: [
      "giai phuong trinh",
      "he phuong trinh",
      "tich phan",
      "dao ham",
      "hinh hoc",
      "chung minh",
      "ma tran",
      "logarit",
      "luong giac",
      "bat phuong trinh",
    ],
  },
  { intent: "NPV", weight: 3, kw: ["dong tien", "lai suat chiet khau", "hoan von", "dau tu"] },
  { intent: "FORECAST", weight: 3, kw: ["du bao", "xu huong", "san luong tuong lai", "mua vu toi"] },
  // System 2 nhẹ
  { intent: "DEFINITION", weight: 2, kw: ["la gi", "nghia la gi", "the nao la", "dinh nghia", "khai niem"] },
  { intent: "WHY_QUESTION", weight: 2, kw: ["tai sao", "vi sao", "ly do", "nguyen nhan", "tai lam sao"] },
  {
    intent: "WEB_SEARCH",
    weight: 1,
    kw: ["tin tuc", "moi nhat", "hom nay", "ty gia", "thoi tiet", "gia usd", "tra cuu tren mang", "search"],
  },
  { intent: "SEARCH", weight: 1, kw: ["tim san pham", "co ban", "con hang", "danh sach san pham", "shop co"] },
  // System 1
  {
    intent: "PRICE_QUERY",
    weight: 2,
    kw: ["gia bao nhieu", "bao nhieu tien", "gia the nao", "may dong", "nhieu tien", "dat khong", "re khong"],
  },
  { intent: "PRODUCT_INFO", weight: 1, kw: ["san pham gi", "ban gi", "hang gi", "san pham la gi", "co gi", "mat hang"] },
  {
    intent: "COMPLAINT",
    weight: 2,
    kw: ["dat qua", "mac qua", "te qua", "kem qua", "toi qua", "chan qua", "buc minh", "than phien", "khong hai long", "do dom", "lua dao"],
  },
  {
    intent: "PSYCHOLOGY",
    weight: 2,
    kw: ["buon qua", "co don", "met moi", "stress", "tam su", "lo lang", "chan nan", "muon khoc", "ap luc", "tuyet vong"],
  },
  {
    intent: "NAVIGATION",
    weight: 2,
    kw: ["gio hang", "trang ca nhan", "profile", "trang chu", "cuoc hop", "chuyen den trang", "mo trang", "dang xuat", "dang nhap"],
  },
  { intent: "THANKS", weight: 1, kw: ["cam on nhe", "cam on ban"] },
];

export class IntentClassifier {
  /**
   * Phân loại ý định. Đồng bộ, không I/O — an toàn để gọi trên hot-path.
   */
  public static classify(rawQuery: string): IntentResult {
    const q = normalize(rawQuery);
    if (!q) return { system: "SYSTEM_2", intent: "UNKNOWN", confidence: 0, matchedBy: "fallback" };

    // ── Tầng 1: REGEX ─────────────────────────────────────────────
    for (const rule of REGEX_RULES) {
      if (rule.re.test(q)) {
        return { system: SYSTEM_MAP[rule.intent], intent: rule.intent, confidence: rule.conf, matchedBy: "regex" };
      }
    }

    // ── Tầng 2: KEYWORD có trọng số ───────────────────────────────
    const scores = new Map<IntentLabel, number>();
    for (const entry of LEXICON) {
      for (const kw of entry.kw) {
        const kwNorm = normalize(kw);
        if (kwNorm && q.includes(kwNorm)) {
          scores.set(entry.intent, (scores.get(entry.intent) ?? 0) + entry.weight);
        }
      }
    }

    if (scores.size > 0) {
      let bestIntent: IntentLabel = "UNKNOWN";
      let bestScore = 0;
      let totalScore = 0;
      for (const [intent, score] of scores) {
        totalScore += score;
        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent;
        }
      }
      // Confidence = độ trội của intent thắng so với tổng, cận trên 0.85.
      const dominance = totalScore > 0 ? bestScore / totalScore : 0;
      const confidence = Math.min(0.85, 0.45 + 0.4 * dominance);
      return { system: SYSTEM_MAP[bestIntent], intent: bestIntent, confidence, matchedBy: "keyword" };
    }

    // ── Không khớp gì: UNKNOWN, confidence thấp (kích hoạt chống-lạc-đề) ──
    return { system: "SYSTEM_2", intent: "UNKNOWN", confidence: 0, matchedBy: "fallback" };
  }

  /** Intent có cần suy luận nặng (Cognitive Arena / Planner LLM) không? */
  public static needsHeavyReasoning(intent: IntentLabel): boolean {
    return HEAVY_INTENTS.has(intent);
  }

  /** Map intent -> tool key hợp lệ trong game-theory.getAgentTools(). */
  public static toToolKey(intent: IntentLabel): string {
    switch (intent) {
      case "TSP":
      case "WARDROP":
      case "NPV":
        return "REASONING"; // các bài toán tối ưu/tài chính nằm trong REASONING
      case "DEFINITION":
      case "WHY_QUESTION":
        return "WEB_SEARCH";
      case "UNKNOWN":
        return "SEARCH";
      case "CLEAR_HISTORY":
        return "CLEAR";
      case "IDENTITY":
        return "GREETING";
      default:
        return intent; // ACADEMIC, STATISTICS, FORECAST, WEB_SEARCH, SEARCH, GREETING, COMPLAINT, AUTHOR, NAVIGATION, PSYCHOLOGY...
    }
  }
}
