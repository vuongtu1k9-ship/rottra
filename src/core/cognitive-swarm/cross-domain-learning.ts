import { Deterministic } from "~/shared/utils/rng";
/**
 * Cross-Domain Learning Engine
 * Học từ nhiều lĩnh vực, transfer knowledge giữa domains
 *
 * Rottra hiện chuyên nông nghiệp, engine này giúp:
 * - Transfer knowledge từ nông nghiệp sang các lĩnh vực khác
 * - Học pattern chung giữa các domain
 * - Adapt responses dựa trên domain knowledge
 * - Knowledge graph linking giữa domains
 *
 * Domains: agriculture, finance, technology, health, education, logistics
 */

export interface DomainKnowledge {
  domain: string;
  concepts: Concept[];
  patterns: Pattern[];
  relationships: Relationship[];
  confidence: number;
  lastUpdated: number;
}

export interface Concept {
  id: string;
  name: string;
  domain: string;
  definition: string;
  synonyms: string[];
  relatedConcepts: string[];
  examples: string[];
  importance: number; // 0-1
}

export interface Pattern {
  id: string;
  domain: string;
  template: string;
  variables: string[];
  examples: string[];
  confidence: number;
  transferable: boolean; // Có thể áp dụng sang domain khác không
}

export interface Relationship {
  source: string;
  target: string;
  type: "is_a" | "part_of" | "causes" | "enables" | "contradicts" | "analogous_to";
  weight: number;
  domain: string;
}

export interface TransferResult {
  sourceDomain: string;
  targetDomain: string;
  analogies: Analogy[];
  confidence: number;
  applicability: number;
}

export interface Analogy {
  sourceConcept: string;
  targetConcept: string;
  mapping: string;
  strength: number;
}

// ===== DOMAIN KNOWLEDGE BASE =====

const DOMAIN_KNOWLEDGE: Record<string, DomainKnowledge> = {
  agriculture: {
    domain: "agriculture",
    concepts: [
      {
        id: "crop",
        name: "Mùa vụ",
        domain: "agriculture",
        definition: "Chu kỳ trồng trọt",
        synonyms: ["vụ mùa", "harvest"],
        relatedConcepts: ["soil", "weather"],
        examples: ["vụ lúa", "vụ rau"],
        importance: 0.9,
      },
      {
        id: "yield",
        name: "Năng suất",
        domain: "agriculture",
        definition: "Sản lượng trên đơn vị diện tích",
        synonyms: ["output", "harvest yield"],
        relatedConcepts: ["crop", "fertilizer"],
        examples: ["5 tấn/ha"],
        importance: 0.85,
      },
      {
        id: "irrigation",
        name: "Tưới tiêu",
        domain: "agriculture",
        definition: "Hệ thống cung cấp nước",
        synonyms: ["watering", "tưới"],
        relatedConcepts: ["drought", "water"],
        examples: ["tưới nhỏ giọt"],
        importance: 0.8,
      },
    ],
    patterns: [
      {
        id: "seasonal_planting",
        domain: "agriculture",
        template: "Tháng {month} nên trồng {crop}",
        variables: ["month", "crop"],
        examples: ["Tháng 3 nên trồng ngô"],
        confidence: 0.8,
        transferable: false,
      },
      {
        id: "price_fluctuation",
        domain: "agriculture",
        template: "{crop} giá {direction} do {reason}",
        variables: ["crop", "direction", "reason"],
        examples: ["Giá lúa tăng do hạn hán"],
        confidence: 0.75,
        transferable: true,
      },
    ],
    relationships: [
      { source: "drought", target: "yield", type: "causes", weight: -0.8, domain: "agriculture" },
      { source: "fertilizer", target: "yield", type: "enables", weight: 0.6, domain: "agriculture" },
    ],
    confidence: 0.9,
    lastUpdated: Date.now(),
  },

  finance: {
    domain: "finance",
    concepts: [
      {
        id: "investment",
        name: "Đầu tư",
        domain: "finance",
        definition: "Sử dụng vốn để tạo lợi nhuận",
        synonyms: ["investment", "invest"],
        relatedConcepts: ["risk", "return"],
        examples: ["đầu tư chứng khoán"],
        importance: 0.9,
      },
      {
        id: "inflation",
        name: "Lạm phát",
        domain: "finance",
        definition: "Tăng giá chung",
        synonyms: ["inflation", "price rise"],
        relatedConcepts: ["purchasing_power"],
        examples: ["lạm phát 5%"],
        importance: 0.85,
      },
    ],
    patterns: [
      {
        id: "market_trend",
        domain: "finance",
        template: "Thị trường {direction} do {factor}",
        variables: ["direction", "factor"],
        examples: ["Thị trường tăng do lãi suất giảm"],
        confidence: 0.7,
        transferable: true,
      },
    ],
    relationships: [{ source: "inflation", target: "purchasing_power", type: "causes", weight: -0.7, domain: "finance" }],
    confidence: 0.7,
    lastUpdated: Date.now(),
  },

  technology: {
    domain: "technology",
    concepts: [
      {
        id: "ai",
        name: "Trí tuệ nhân tạo",
        domain: "technology",
        definition: "Hệ thống mô phỏng trí thông minh",
        synonyms: ["AI", "artificial intelligence"],
        relatedConcepts: ["machine_learning", "deep_learning"],
        examples: ["chatbot", "self-driving"],
        importance: 0.95,
      },
      {
        id: "iot",
        name: "Internet vạn vật",
        domain: "technology",
        definition: "Mạng lưới thiết bị kết nối",
        synonyms: ["IoT", "Internet of Things"],
        relatedConcepts: ["sensor", "smart_device"],
        examples: [" cảm biến đất"],
        importance: 0.85,
      },
    ],
    patterns: [
      {
        id: "tech_adoption",
        domain: "technology",
        template: "{industry} đang áp dụng {technology}",
        variables: ["industry", "technology"],
        examples: ["Nông nghiệp đang áp dụng IoT"],
        confidence: 0.8,
        transferable: true,
      },
    ],
    relationships: [{ source: "ai", target: "automation", type: "enables", weight: 0.8, domain: "technology" }],
    confidence: 0.75,
    lastUpdated: Date.now(),
  },

  health: {
    domain: "health",
    concepts: [
      {
        id: "nutrition",
        name: "Dinh dưỡng",
        domain: "health",
        definition: "Chế độ ăn uống lành mạnh",
        synonyms: ["nutrition", "diet"],
        relatedConcepts: ["food", "health"],
        examples: ["dinh dưỡng cân đối"],
        importance: 0.9,
      },
    ],
    patterns: [
      {
        id: "health_advice",
        domain: "health",
        template: "{food} tốt cho {health_aspect}",
        variables: ["food", "health_aspect"],
        examples: ["Rau x tốt cho tiêu hóa"],
        confidence: 0.7,
        transferable: true,
      },
    ],
    relationships: [],
    confidence: 0.6,
    lastUpdated: Date.now(),
  },

  logistics: {
    domain: "logistics",
    concepts: [
      {
        id: "supply_chain",
        name: "Chuỗi cung ứng",
        domain: "logistics",
        definition: "Quy trình từ sản xuất đến tiêu dùng",
        synonyms: ["supply chain", "distribution"],
        relatedConcepts: ["warehouse", "transport"],
        examples: ["chuỗi cung ứng ngắn"],
        importance: 0.9,
      },
    ],
    patterns: [
      {
        id: "route_optimization",
        domain: "logistics",
        template: "Tuyến {route} tối ưu cho {cargo}",
        variables: ["route", "cargo"],
        examples: ["Tuyến Hà Nội - TP.HCM tối ưu cho nông sản"],
        confidence: 0.75,
        transferable: true,
      },
    ],
    relationships: [],
    confidence: 0.65,
    lastUpdated: Date.now(),
  },
};

// ===== KNOWLEDGE TRANSFER =====

/**
 * Tìm analogies giữa 2 domains
 */
export function findAnalogies(sourceDomain: string, targetDomain: string): TransferResult {
  const source = DOMAIN_KNOWLEDGE[sourceDomain];
  const target = DOMAIN_KNOWLEDGE[targetDomain];

  if (!source || !target) {
    return { sourceDomain, targetDomain, analogies: [], confidence: 0, applicability: 0 };
  }

  const analogies: Analogy[] = [];

  // Find concept mappings
  for (const sourceConcept of source.concepts) {
    for (const targetConcept of target.concepts) {
      const similarity = calculateConceptSimilarity(sourceConcept, targetConcept);
      if (similarity > 0.3) {
        analogies.push({
          sourceConcept: sourceConcept.name,
          targetConcept: targetConcept.name,
          mapping: `${sourceConcept.name} trong ${sourceDomain} tương đương ${targetConcept.name} trong ${targetDomain}`,
          strength: similarity,
        });
      }
    }
  }

  // Find pattern transfers
  for (const pattern of source.patterns) {
    if (pattern.transferable) {
      analogies.push({
        sourceConcept: `Pattern: ${pattern.template}`,
        targetConcept: `Pattern: ${pattern.template}`,
        mapping: `Cấu trúc này có thể transfer sang ${targetDomain}.`,
        strength: pattern.confidence * 0.8,
      });
    }
  }

  const avgStrength = analogies.length > 0 ? analogies.reduce((sum, a) => sum + a.strength, 0) / analogies.length : 0;

  return {
    sourceDomain,
    targetDomain,
    analogies,
    confidence: (source.confidence + target.confidence) / 2,
    applicability: avgStrength,
  };
}

/**
 * Tính similarity giữa 2 concepts
 */
function calculateConceptSimilarity(a: Concept, b: Concept): number {
  let score = 0;

  // Synonym overlap
  const aWords = new Set([a.name, ...a.synonyms].map((w) => w.toLowerCase()));
  const bWords = new Set([b.name, ...b.synonyms].map((w) => w.toLowerCase()));
  const overlap = [...aWords].filter((w) => bWords.has(w)).length;
  score += overlap * 0.3;

  // Related concepts overlap
  const aRelated = new Set(a.relatedConcepts);
  const bRelated = new Set(b.relatedConcepts);
  const relatedOverlap = [...aRelated].filter((r) => bRelated.has(r)).length;
  score += relatedOverlap * 0.2;

  // Definition similarity (simple word overlap)
  const aDefWords = new Set(a.definition.toLowerCase().split(/\s+/));
  const bDefWords = new Set(b.definition.toLowerCase().split(/\s+/));
  const defOverlap = [...aDefWords].filter((w) => bDefWords.has(w)).length;
  score += (defOverlap / Math.max(aDefWords.size, bDefWords.size)) * 0.3;

  // Importance similarity
  score += (1 - Math.abs(a.importance - b.importance)) * 0.2;

  return Math.min(1, score);
}

/**
 * Transfer knowledge từ source sang target domain
 */
export function transferKnowledge(query: string, sourceDomain: string, targetDomain: string): string | null {
  const transfer = findAnalogies(sourceDomain, targetDomain);

  if (transfer.analogies.length === 0) return null;

  // Find best matching analogy for query
  const queryLower = query.toLowerCase();
  let bestAnalogy: Analogy | null = null;
  let bestScore = 0;

  for (const analogy of transfer.analogies) {
    const sourceWords = analogy.sourceConcept.toLowerCase().split(/\s+/);
    const matchCount = sourceWords.filter((w) => queryLower.includes(w)).length;
    const score = (matchCount / sourceWords.length) * analogy.strength;

    if (score > bestScore) {
      bestScore = score;
      bestAnalogy = analogy;
    }
  }

  if (!bestAnalogy || bestScore < 0.2) return null;

  return `Dựa trên kiến thức từ ${sourceDomain}: ${bestAnalogy.mapping}. Áp dụng cho ${targetDomain}: ${bestAnalogy.targetConcept}`;
}

/**
 * Detect domain từ query
 */
export function detectDomain(query: string): { domain: string; confidence: number } {
  const queryLower = query.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [domain, knowledge] of Object.entries(DOMAIN_KNOWLEDGE)) {
    let score = 0;

    // Check concept keywords
    for (const concept of knowledge.concepts) {
      const keywords = [concept.name, ...concept.synonyms].map((k) => k.toLowerCase());
      for (const kw of keywords) {
        if (queryLower.includes(kw)) {
          score += concept.importance;
        }
      }
    }

    // Check pattern variables
    for (const pattern of knowledge.patterns) {
      for (const variable of pattern.variables) {
        if (queryLower.includes(variable.toLowerCase())) {
          score += pattern.confidence * 0.5;
        }
      }
    }

    scores[domain] = score;
  }

  // Find best domain
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];

  return {
    domain: best[0],
    confidence: best[1] > 0 ? Math.min(1, best[1] / 3) : 0.1,
  };
}

/**
 * Get relevant knowledge for query
 */
export function getRelevantKnowledge(query: string, limit: number = 5): { domain: string; concepts: Concept[]; patterns: Pattern[] }[] {
  const domainResult = detectDomain(query);
  const results: { domain: string; concepts: Concept[]; patterns: Pattern[] }[] = [];

  // Primary domain
  const primary = DOMAIN_KNOWLEDGE[domainResult.domain];
  if (primary) {
    results.push({
      domain: domainResult.domain,
      concepts: primary.concepts.slice(0, limit),
      patterns: primary.patterns.slice(0, limit),
    });
  }

  // Related domains (via relationships)
  const relatedDomains = new Set<string>();
  for (const rel of primary?.relationships || []) {
    const targetKnowledge = Object.values(DOMAIN_KNOWLEDGE).find((k) => k.concepts.some((c) => c.id === rel.target));
    if (targetKnowledge) {
      relatedDomains.add(targetKnowledge.domain);
    }
  }

  for (const relatedDomain of relatedDomains) {
    if (relatedDomain !== domainResult.domain) {
      const knowledge = DOMAIN_KNOWLEDGE[relatedDomain];
      if (knowledge) {
        results.push({
          domain: relatedDomain,
          concepts: knowledge.concepts.slice(0, 3),
          patterns: knowledge.patterns.slice(0, 3),
        });
      }
    }
  }

  return results;
}

/**
 * Cross-domain insight generator
 */
export function generateCrossDomainInsight(query: string): string | null {
  const domain = detectDomain(query);
  const knowledge = DOMAIN_KNOWLEDGE[domain.domain];

  if (!knowledge || knowledge.confidence < 0.5) return null;

  // Find transferable patterns
  const transferable = knowledge.patterns.filter((p) => p.transferable);
  if (transferable.length === 0) return null;

  // Generate insight
  const pattern = transferable[0];
  const otherDomains = Object.keys(DOMAIN_KNOWLEDGE).filter((d) => d !== domain.domain);

  if (otherDomains.length === 0) return null;

  const targetDomain = otherDomains[Math.floor(Deterministic.random() * otherDomains.length)];
  const transfer = findAnalogies(domain.domain, targetDomain);

  if (transfer.analogies.length > 0) {
    const analogy = transfer.analogies[0];
    if (analogy.sourceConcept.startsWith("Pattern: ")) {
      const template = analogy.sourceConcept.replace("Pattern: ", "");
      return `💡 Insight: Cấu trúc "${template}" từ lĩnh vực ${domain.domain} có thể áp dụng tương tự sang lĩnh vực ${targetDomain}.`;
    }
    return `💡 Insight: Khái niệm "${analogy.sourceConcept}" trong ${domain.domain} có thể tương đồng với "${analogy.targetConcept}" trong ${targetDomain}.`;
  }

  return null;
}
