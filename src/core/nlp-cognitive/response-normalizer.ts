/**
 * 🧠 ROTTRA — RESPONSE NORMALIZER
 * Chuẩn hóa format response cho AI agent.
 * Mỗi response đều có cấu trúc nhất quán: metadata, content, suggestions, quality.
 * Runs on Bun runtime.
 */

// ── Types ─────────────────────────────────────────────────────

export interface NormalizedResponse {
  text: string;
  metadata: ResponseMetadata;
  suggestions: string[];
  results: string[];
  agentName: string;
  agentAvatar: string;
}

export interface ResponseMetadata {
  intent: string;
  brain: string;
  brainEmoji: string;
  confidence: number;
  entropy: number;
  quality: number;
  responseTimeMs: number;
  modelUsed: string;
  domain: ResponseDomain;
  language: "vi" | "en" | "zh" | "ja" | "fi" | "he";
  tokens: { input: number; output: number };
}

export type ResponseDomain = "agriculture" | "market" | "science" | "math" | "logistics" | "general" | "education" | "sensor" | "finance";

export interface ResponseTemplate {
  domain: ResponseDomain;
  intent: string;
  structure: "analytical" | "conversational" | "data_driven" | "instructional" | "creative";
  sections: ResponseSection[];
}

export interface ResponseSection {
  type: "greeting" | "answer" | "data" | "insight" | "warning" | "suggestion" | "footer";
  content: string;
  priority: number;
}

// ── Domain Classifier ─────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<ResponseDomain, string[]> = {
  agriculture: [
    "cây trồng",
    "nông nghiệp",
    "đất",
    "phân bón",
    "tưới tiêu",
    "mùa vụ",
    "cà phê",
    "lúa",
    "ngô",
    "cao su",
    "tiêu",
    "điều",
    "sầu riêng",
    "bệnh cây",
    "sâu bệnh",
    "thuốc trừ sâu",
    "hạt giống",
    "giống cây",
    "nước tưới",
    "hệ thống tưới",
    "tưới nhỏ giọt",
    "phân hữu cơ",
    "sinh học",
    "vi sinh vật",
    "nấm",
    "vi khuẩn",
    "thổ nhưỡng",
  ],
  market: [
    "giá",
    "thị trường",
    "cung",
    "cầu",
    "xu hướng",
    "dự báo",
    "mua",
    "bán",
    "đơn hàng",
    "khách hàng",
    "cạnh tranh",
    "doanh thu",
    "lợi nhuận",
    "chi phí",
    "đầu tư",
    "kinh doanh",
    "smart contract",
    "blockchain",
    "token",
    "defi",
  ],
  science: [
    "khoa học",
    "nghiên cứu",
    "thí nghiệm",
    "phân tích",
    "xác suất",
    "thống kê",
    "mô hình",
    "giả thuyết",
    "lượng giác",
    "toán học",
    "đại số",
    "tích phân",
    "vi phân",
    "vật lý",
    "hóa học",
    "sinh học",
    "trái đất",
  ],
  math: [
    "tính",
    "giải",
    "phương trình",
    "định lý",
    "chứng minh",
    "số học",
    "hình học",
    "vector",
    "ma trận",
    "tổ hợp",
    "xác suất",
    "thống kê",
    "bayes",
    "entropy",
  ],
  logistics: [
    "vận chuyển",
    "logistics",
    "chuỗi cung ứng",
    "kho bãi",
    "tuyến đường",
    "giao hàng",
    "vận tải",
    "forwarding",
    "tối ưu",
    "linear programming",
    "integer programming",
  ],
  general: ["xin chào", "hello", "cảm ơn", "help", "giới thiệu", "thời tiết", "tin tức", "sự kiện", "lịch sử"],
  education: ["học", "bài tập", "giáo trình", "kiến thức", "bài giảng", "môn học", "đề thi", "ôn tập"],
  sensor: ["cảm biến", "nhiệt độ", "độ ẩm", "độ pH", "ánh sáng", "gió", "mưa", "khí CO2", "độ dẫn điện"],
  finance: ["tài chính", "ngân sách", "dòng tiền", "ROI", "NPV", "IRR", "định giá", "rủi ro", "tỷ suất"],
};

export function classifyDomain(query: string, intent: string): ResponseDomain {
  const q = query.toLowerCase();

  // Intent-based mapping
  const intentDomainMap: Record<string, ResponseDomain> = {
    ACADEMIC: "science",
    STATISTICS: "math",
    LOGISTICS: "logistics",
    TSP: "logistics",
    WARDROP: "logistics",
    NPV: "finance",
    COBWEB: "market",
    KALMAN: "sensor",
    SHANNON: "agriculture",
    PRICE_QUERY: "market",
    PRODUCT_INFO: "agriculture",
    WEATHER: "agriculture",
    SENSOR_READING: "sensor",
    FL_ROUND: "science",
    NEGOTIATION: "market",
    GREETING: "general",
    SEARCH: "general",
    TRANSLATION: "general",
    MATH: "math",
    SCIENCE: "science",
    PSYCHOLOGY: "education",
    FORECAST: "market",
    IMAGE: "agriculture",
    AUDIO: "general",
  };

  if (intentDomainMap[intent]) return intentDomainMap[intent];

  // Keyword-based fallback
  let bestDomain: ResponseDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter((kw) => q.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain as ResponseDomain;
    }
  }

  return bestDomain;
}

// ── Brain Resolver ────────────────────────────────────────────

interface BrainInfo {
  name: string;
  emoji: string;
}

const BRAIN_MAP: Record<string, BrainInfo> = {
  ACADEMIC: { name: "Siêu Não Bộ Toán Học", emoji: "📐" },
  STATISTICS: { name: "Lõi Thống Kê & Phân Tích", emoji: "📊" },
  LOGISTICS: { name: "Lõi Vận Trù Học", emoji: "🚚" },
  RESEARCH: { name: "Trạm Nghiên Cứu Định Lượng", emoji: "🎓" },
  TSP: { name: "Lõi Tuyến Đường Tối Ưu", emoji: "🚛" },
  WARDROP: { name: "Bộ Phân Luồng Giao Thông", emoji: "🚦" },
  NPV: { name: "Trạm Thẩm Định Tài Chính", emoji: "📈" },
  COBWEB: { name: "Mô Hình Cung Cầu Mạng Nhện", emoji: "🕸️" },
  KALMAN: { name: "Bộ Lọc Nhiễu IoT", emoji: "📡" },
  SHANNON: { name: "Chỉ Số Đa Dạng Sinh Học", emoji: "🌱" },
  GREETING: { name: "Trợ Lý Thân Thiện", emoji: "💬" },
  SEARCH: { name: "Mạng Lưới Tìm Kiếm", emoji: "🔍" },
  PRODUCT_INFO: { name: "Chuyên Gia Sản Phẩm", emoji: "🌾" },
  PRICE_QUERY: { name: "Phân Tích Thị Trường", emoji: "💰" },
  WEATHER: { name: "Trạm Dự Báo Thời Tiết", emoji: "🌤️" },
  SENSOR_READING: { name: "Bộ Đọc Cảm Biến IoT", emoji: "📡" },
  FL_ROUND: { name: "Lõi Học Phân Tán", emoji: "🧠" },
  NEGOTIATION: { name: "Đầu Não Đàm Phán", emoji: "🤝" },
  TRANSLATION: { name: "Trạm Dịch Thuật", emoji: "🌐" },
  MATH: { name: "Siêu Não Bộ Toán Học", emoji: "📐" },
  SCIENCE: { name: "Phòng Thí Nghiệm Khoa Học", emoji: "🔬" },
  PSYCHOLOGY: { name: "Chuyên Gia Tâm Lý Học", emoji: "🧠" },
  FORECAST: { name: "Bộ Dự Báo Tương Lai", emoji: "🔮" },
  IMAGE: { name: "Hệ Thống Thị Giác AI", emoji: "👁️" },
  AUDIO: { name: "Bộ Xử Lý Âm Thanh", emoji: "🎤" },
};

export function resolveBrain(intent: string): BrainInfo {
  return BRAIN_MAP[intent] || { name: "Não Bộ Tổng Hợp", emoji: "💬" };
}

// ── Response Structure Templates ──────────────────────────────

function getTemplate(domain: ResponseDomain, intent: string): ResponseTemplate {
  const base: ResponseTemplate = {
    domain,
    intent,
    structure: "conversational",
    sections: [{ type: "answer", content: "", priority: 1 }],
  };

  switch (domain) {
    case "agriculture":
      return {
        ...base,
        structure: "instructional",
        sections: [
          { type: "greeting", content: "", priority: 0 },
          { type: "answer", content: "", priority: 1 },
          { type: "data", content: "", priority: 2 },
          { type: "insight", content: "", priority: 3 },
          { type: "suggestion", content: "", priority: 4 },
        ],
      };
    case "market":
      return {
        ...base,
        structure: "data_driven",
        sections: [
          { type: "answer", content: "", priority: 1 },
          { type: "data", content: "", priority: 2 },
          { type: "warning", content: "", priority: 3 },
          { type: "suggestion", content: "", priority: 4 },
        ],
      };
    case "math":
    case "science":
      return {
        ...base,
        structure: "analytical",
        sections: [
          { type: "answer", content: "", priority: 1 },
          { type: "data", content: "", priority: 2 },
          { type: "insight", content: "", priority: 3 },
        ],
      };
    case "finance":
      return {
        ...base,
        structure: "data_driven",
        sections: [
          { type: "answer", content: "", priority: 1 },
          { type: "data", content: "", priority: 2 },
          { type: "warning", content: "", priority: 3 },
          { type: "footer", content: "", priority: 5 },
        ],
      };
    case "sensor":
      return {
        ...base,
        structure: "data_driven",
        sections: [
          { type: "answer", content: "", priority: 1 },
          { type: "data", content: "", priority: 2 },
          { type: "warning", content: "", priority: 3 },
        ],
      };
    default:
      return base;
  }
}

// ── Response Normalizer ───────────────────────────────────────

export function normalizeResponse(
  rawText: string,
  query: string,
  intent: string,
  options: {
    confidence?: number;
    entropy?: number;
    quality?: number;
    responseTimeMs?: number;
    modelUsed?: string;
    results?: string[];
    suggestions?: string[];
    agentName?: string;
    agentAvatar?: string;
    language?: ResponseMetadata["language"];
    inputTokens?: number;
    outputTokens?: number;
  } = {},
): NormalizedResponse {
  const domain = classifyDomain(query, intent);
  const brain = resolveBrain(intent);
  const template = getTemplate(domain, intent);

  // Clean up the raw text
  let cleanedText = rawText
    .replace(/```[\s\S]*?```/g, (match) => match) // preserve code blocks
    .replace(/\n{3,}/g, "\n\n") // normalize multiple newlines
    .trim();

  // Remove redundant prefixes
  cleanedText = cleanedText
    .replace(/^(Dạ,?\s*)?Sếp\s+/i, "")
    .replace(/^(Em\s+)?xin\s+trả\s+lời\s+/i, "")
    .trim();

  // Add greeting if missing and domain expects it
  const hasGreeting = /^(xin chào|chào|hello|hi|dạ)/i.test(cleanedText);
  if (!hasGreeting && template.sections.some((s) => s.type === "greeting")) {
    cleanedText = `Dạ, ${cleanedText}`;
  }

  // Ensure proper ending
  if (!cleanedText.endsWith(".") && !cleanedText.endsWith("!") && !cleanedText.endsWith("?") && !cleanedText.endsWith("$$")) {
    cleanedText += ".";
  }

  // Build suggestions if not provided
  const suggestions = options.suggestions || generateSuggestions(domain, intent, query);

  return {
    text: cleanedText,
    metadata: {
      intent,
      brain: brain.name,
      brainEmoji: brain.emoji,
      confidence: options.confidence ?? 88.5,
      entropy: options.entropy ?? 0,
      quality: options.quality ?? 7.0,
      responseTimeMs: options.responseTimeMs ?? 0,
      modelUsed: options.modelUsed ?? "offline",
      domain,
      language: options.language ?? "vi",
      tokens: {
        input: options.inputTokens ?? 0,
        output: options.outputTokens ?? 0,
      },
    },
    suggestions,
    results: options.results ?? [],
    agentName: options.agentName ?? "RottraAI",
    agentAvatar: options.agentAvatar ?? "https://api.dicebear.com/7.x/bottts/svg?seed=general",
  };
}

// ── Suggestion Generator ──────────────────────────────────────

function generateSuggestions(domain: ResponseDomain, intent: string, query: string): string[] {
  const suggestions: Record<ResponseDomain, string[]> = {
    agriculture: [
      "Xem dự báo thời tiết cho vùng trồng",
      "Kiểm tra tình trạng đất và độ ẩm",
      "Tư vấn phân bón phù hợp",
      "Phân tích bệnh cây trồng từ hình ảnh",
    ],
    market: [
      "Xem biểu đồ giá theo thời gian thực",
      "So sánh giá giữa các vùng",
      "Dự báo xu hướng thị trường 7 ngày tới",
      "Phân tích cạnh tranh sản phẩm",
    ],
    science: ["Xem chi tiết bài phân tích", "Tham khảo nguồn nghiên cứu liên quan", "Thực hành bài tập tương tự", "Tìm hiểu kiến thức nền"],
    math: ["Xem lời giải chi tiết từng bước", "Thử bài toán tương tự", "Phương pháp giải nhanh", "Tham khảo công thức liên quan"],
    logistics: ["Xem bản đồ tuyến đường", "Tối ưu chi phí vận chuyển", "Dự báo thời gian giao hàng", "Kiểm tra trạng thái đơn hàng"],
    general: ["Tìm hiểu thêm về Rottra", "Khám phá tính năng AI", "Xem hướng dẫn sử dụng", "Liên hệ hỗ trợ"],
    education: ["Xem bài giảng chi tiết", "Thực hành bài tập", "Tìm tài liệu tham khảo", "Học kiến thức nâng cao"],
    sensor: ["Xem dữ liệu thời gian thực", "Phân tích anomaly phát hiện", "Cấu hình ngưỡng cảnh báo", "Xem lịch sử dữ liệu"],
    finance: ["Xem phân tích dòng tiền", "Tính toán ROI dự án", "Đánh giá rủi ro", "So sánh phương án đầu tư"],
  };

  return suggestions[domain] || suggestions.general;
}

// ── Response Quality Scorer ───────────────────────────────────

export function scoreResponseQuality(
  query: string,
  response: string,
  domain: ResponseDomain,
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};

  // Length ratio (response should be 3-10x query length for good answers)
  const lengthRatio = response.length / Math.max(query.length, 1);
  factors.lengthRatio = Math.min(lengthRatio / 5, 1.0);

  // Word overlap (query words appearing in response)
  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const responseLower = response.toLowerCase();
  const overlap = [...queryWords].filter((w) => responseLower.includes(w)).length;
  factors.relevance = queryWords.size > 0 ? overlap / queryWords.size : 0.5;

  // Structure score (has headers, bullet points, etc.)
  const hasHeaders = /^#{1,3}\s/m.test(response) || /\*\*[^*]+\*\*/.test(response);
  const hasBullets = /^[\s]*[-*•]\s/m.test(response) || /^\s*\d+\.\s/m.test(response);
  const hasCode = /```/.test(response);
  factors.structure = (hasHeaders ? 0.4 : 0) + (hasBullets ? 0.3 : 0) + (hasCode ? 0.3 : 0);

  // Domain-specific bonuses
  if (domain === "agriculture" && /cây|đất|phân|nước|vụ|mùa/i.test(response)) {
    factors.domainSpecific = 0.3;
  } else if (domain === "market" && /giá|thị trường|cung|cầu|xu hướng/i.test(response)) {
    factors.domainSpecific = 0.3;
  } else if (domain === "math" && /\d+|phương trình|công thức|=/i.test(response)) {
    factors.domainSpecific = 0.3;
  } else {
    factors.domainSpecific = 0.1;
  }

  // Emotional appropriateness (polite, helpful tone)
  const hasPolite = /dạ|vâng|xin|cảm ơn|chào|sếp/i.test(response);
  factors.tone = hasPolite ? 0.2 : 0;

  // Compute final score (0-10)
  const rawScore = factors.lengthRatio * 2 + factors.relevance * 3 + factors.structure * 2 + factors.domainSpecific * 2 + factors.tone * 1;

  const score = Math.min(Math.max(rawScore, 0), 10);
  return { score: parseFloat(score.toFixed(2)), factors };
}
