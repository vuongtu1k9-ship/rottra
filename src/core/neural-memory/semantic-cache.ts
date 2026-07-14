import path from "node:path";
import * as fs from "node:fs";

interface CacheEntry {
  botId: string;
  query: string;
  cleanQuery: string;
  response: string;
  timestamp: number;
}

const CACHE_DIR = path.join(process.cwd(), "finetune", "data");
const CACHE_FILE = path.join(CACHE_DIR, "rottra_semantic_cache.json");
const MAX_CACHE_SIZE = 500;

// Lazy-loaded in-memory cache to eliminate disk I/O bottlenecks during user queries
let inMemoryCache: CacheEntry[] | null = null;

function calculateWordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (w1.length < 2 || w2.length < 2) return 0.0;

  const words1 = w1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = w2.split(/\s+/).filter((w) => w.length > 0);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersection = 0;
  for (const w of set1) {
    if (set2.has(w)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Local implementation of shorthand normalization to break circular import with tokenizer.ts
function normalizeVietnameseShorthands(text: string): string {
  if (!text) return text;
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const cleanWord = part
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      switch (cleanWord) {
        case "k":
        case "ko":
        case "khg":
        case "kh":
          return part.toUpperCase() === part ? "KHÔNG" : "không";
        case "dc":
          return part.toUpperCase() === part ? "ĐƯỢC" : "được";
        case "ok":
        case "oke":
        case "uok":
          return part.toUpperCase() === part ? "ĐỒNG Ý" : "đồng ý";
        case "r":
        case "roi":
          return part.toUpperCase() === part ? "RỒI" : "rồi";
        case "mn":
          return part.toUpperCase() === part ? "MỌI NGƯỜI" : "mọi người";
        case "vs":
          return part.toUpperCase() === part ? "VỚI" : "với";
        case "j":
          return part.toUpperCase() === part ? "GÌ" : "gì";
        case "ms":
          return part.toUpperCase() === part ? "MỚI" : "mới";
        case "b":
          return part.toUpperCase() === part ? "BẠN" : "bạn";
        case "ts":
          return part.toUpperCase() === part ? "TẠI SAO" : "tại sao";
        case "dt":
          return part.toUpperCase() === part ? "ĐIỆN THOẠI" : "điện thoại";
        case "sp":
          return part.toUpperCase() === part ? "SẢN PHẨM" : "sản phẩm";
        case "nv":
          return part.toUpperCase() === part ? "NHÂN VIÊN" : "nhân viên";
        case "gd":
          return part.toUpperCase() === part ? "GIA ĐÌNH" : "gia đình";
        case "nt":
          return part.toUpperCase() === part ? "NHẮN TIN" : "nhắn tin";
        case "ib":
          return part.toUpperCase() === part ? "INBOX" : "inbox";
        case "kb":
          return part.toUpperCase() === part ? "KẾT BẠN" : "kết bạn";
        case "tl":
          return part.toUpperCase() === part ? "TRẢ LỜI" : "trả lời";
        default:
          return part;
      }
    })
    .join("");
}

function getCache(): CacheEntry[] {
  if (inMemoryCache !== null) {
    return inMemoryCache;
  }
  if (!fs.existsSync(CACHE_FILE)) {
    inMemoryCache = [];
    return inMemoryCache;
  }
  try {
    const content = fs.readFileSync(CACHE_FILE, "utf-8");
    inMemoryCache = JSON.parse(content);
    return inMemoryCache!;
  } catch (err: any) {
    console.error("[SemanticCache] Failed to load cache file:", err.message);
    inMemoryCache = [];
    return inMemoryCache;
  }
}

function saveCache(cache: CacheEntry[]) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      } catch (mkdirErr: any) {
        console.error(`[SemanticCache] mkdirSync error for ${CACHE_DIR}:`, mkdirErr);
      }
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err: any) {
    console.error("[SemanticCache] Failed to save cache file:", err.message, "path:", CACHE_DIR);
  }
}

// Normalize Vietnamese string including shorthand expansion (e.g. ko -> khong) for superior cache hits
function normalizeText(text: string): string {
  const expanded = normalizeVietnameseShorthands(text);
  return expanded
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Checks if a response is cached for a specific bot and query.
 * Returns the cached response if a high-similarity match is found, otherwise null.
 */
export function checkSemanticCache(botId: string, query: string): string | null {
  const cache = getCache();
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return null;

  let bestMatch: CacheEntry | null = null;
  let highestSimilarity = 0;

  for (const entry of cache) {
    if (entry.botId !== botId) continue;

    // Exact match
    if (entry.cleanQuery === cleanQuery) {
      console.log(`[SemanticCache] Exact hit for bot ${botId}: "${query}"`);
      return entry.response;
    }

    // Fuzzy match
    const sim = calculateWordSimilarity(entry.cleanQuery, cleanQuery);
    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      bestMatch = entry;
    }
  }

  // If similarity is > 0.88, we consider it a hit
  if (bestMatch && highestSimilarity > 0.88) {
    console.log(
      `[SemanticCache] Fuzzy hit (Sim: ${highestSimilarity.toFixed(2)}) for bot ${botId}: "${query}" matched cached: "${bestMatch.query}"`,
    );
    return bestMatch.response;
  }

  return null;
}

/**
 * Saves a query and its response to the semantic cache.
 */
export function writeSemanticCache(botId: string, query: string, response: string): void {
  if (!query || !response) return;

  const cache = getCache();
  const cleanQuery = normalizeText(query);

  // Remove existing identical query to prevent duplicates and update timestamp
  const filtered = cache.filter((entry) => !(entry.botId === botId && entry.cleanQuery === cleanQuery));

  filtered.push({
    botId,
    query,
    cleanQuery,
    response,
    timestamp: Date.now(),
  });

  // Limit cache size (FIFO)
  if (filtered.length > MAX_CACHE_SIZE) {
    filtered.shift();
  }

  inMemoryCache = filtered;
  saveCache(filtered);
  console.log(`[SemanticCache] Cached response for bot ${botId}: "${query}"`);
}
