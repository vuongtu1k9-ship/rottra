import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";

type Product = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price?: number;
  heavy?: number;
  lwh?: { l: number; w: number; h: number };
  status?: boolean;
};

type ScoredProduct = {
  product: Product;
  score: number;
};

function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function calculateJaccardSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (w1.length < 2 || w2.length < 2) return 0.0;

  const set1 = new Set(w1);
  const set2 = new Set(w2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

function calculateWordScore(qw: string, pw: string): number {
  if (pw === qw) return 1.5;
  if (pw.includes(qw)) return 1.0 + (qw.length / pw.length) * 0.4;
  if (qw.includes(pw)) return 0.8 + (pw.length / qw.length) * 0.4;

  const jaccard = calculateJaccardSimilarity(qw, pw);
  return jaccard > 0.5 ? jaccard * 1.2 : 0;
}

export const fuzzyMatchCache = new LRUCache<string, ScoredProduct[]>(100, 600);

export function fuzzySearchProducts(
  query: string,
  products: Product[],
  threshold: number = 0.15,
): { matches: Product[]; scoresMap: Map<string, number>; topMatch: Product | null; topScore: number } {
  const cacheKey = `${normalizeVietnamese(query)}:${products.length}`;
  const cached = fuzzyMatchCache.get(cacheKey);
  if (cached) {
    const matches = cached.filter((item) => item.score > threshold).map((item) => item.product);
    const top = cached[0];
    return {
      matches: matches.slice(0, 2),
      scoresMap: new Map(cached.map((item) => [item.product.id, item.score])),
      topMatch: top?.product ?? null,
      topScore: top?.score ?? 0,
    };
  }

  const qClean = normalizeVietnamese(query);
  const qWords = qClean.split(/\s+/).filter((w) => w.length > 0);

  const scored: ScoredProduct[] = [];
  for (const p of products) {
    const pName = normalizeVietnamese(p.name || "");
    const pWords = pName.split(/\s+/).filter((w) => w.length > 0);
    let totalScore = 0;

    for (const qw of qWords) {
      let bestWordScore = 0;
      for (const pw of pWords) {
        bestWordScore = Math.max(bestWordScore, calculateWordScore(qw, pw));
      }
      totalScore += bestWordScore;
    }

    const avgScore = qWords.length > 0 ? totalScore / qWords.length : 0;
    if (avgScore > threshold) {
      scored.push({ product: p, score: avgScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  fuzzyMatchCache.set(cacheKey, scored);

  const matches = scored.slice(0, 2).map((item) => item.product);
  const top = scored[0];

  return {
    matches,
    scoresMap: new Map(scored.map((item) => [item.product.id, item.score])),
    topMatch: top?.product ?? null,
    topScore: top?.score ?? 0,
  };
}
