import { removeAccents, normalizeVietnameseShorthands } from "~/core/nlp-cognitive/tokenizer";
import { AgentKnowledgeBase, KnowledgeItem } from "~/core/neural-memory/knowledge-base";
import { db } from "~/infra/database/db-pool";
import { agentMemory, vectorDocument } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import { ALL_DOMAIN_TRAINING_PAIRS } from "~/core/nlp-cognitive/domain-training-data";
import * as crypto from "node:crypto";
import {
  initMultilingualEmbedding,
  isEmbeddingReady,
  embed,
  embedBatch,
  cosineSimilarityDense,
  getEmbeddingInfo,
} from "./multilingual-embedding";
import {
  smartChunking,
  agriculturalChunking,
  fixedChunking,
  slidingWindowChunking,
  paragraphChunking,
  getChunkingStats,
  type ChunkingConfig,
} from "./chunking-strategies";
import { SoAVectorPool } from "../quant-engine/soa-vector-pool";

// 1. Dựng kho từ vựng và chỉ mục phẳng cho RAG
export interface FlatDoc {
  id: number;
  category: string;
  item: KnowledgeItem;
  flatText: string;
  vectorId: number; // TỐI ƯU HÓA SOA KHÔ MÁU: Triệt tiêu hoàn toàn mảng Object
  pointers: number[]; // Mạng lưới Con trỏ Đồ thị Tri thức
  backPointers: number[]; // Con trỏ hồi quy (Back-Pointers)
}

let flatDocsCache: FlatDoc[] = (globalThis as any)._flatDocsCache || [];
export let soaPool: SoAVectorPool | null = (globalThis as any)._soaPool || null;
let vocabulary: string[] = (globalThis as any)._vocabulary || [];

// Khởi tạo và lập chỉ mục Vector cho tài liệu
export const initRAGEngine = async (forceRefresh = false) => {
  if (!forceRefresh && flatDocsCache.length > 0) return { flatDocsCache, vocabulary };

  // Run runtime schema migration to ensure tenant_id column exists
  try {
    await db.execute(sql`ALTER TABLE "VectorDocument" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;`).catch(() => {});
  } catch (migErr) {
    // Ignore if column already exists
  }

  await initMultilingualEmbedding().catch(() => {});

  let dbDocs: any[] = [];
  try {
    dbDocs = await db.select().from(vectorDocument);
  } catch (err) {
    console.error("Failed to query vectorDocument, attempting to initialize offline fallback:", err);
  }

  const tempDocs: FlatDoc[] = [];
  const termFreqs: Record<string, number> = {};
  let tempId = 0;

  // Nếu DB trống, chúng ta tiến hành SEED tri thức mặc định vào Database
  if (dbDocs.length === 0) {
    console.log("[RAG DATABASE SEED] Khởi chạy nạp tri thức mặc định vào Postgres...");
    const rawSeedDocs: { category: string; item: KnowledgeItem; flatText: string }[] = [];

    // 1. Thu thập từ AgentKnowledgeBase
    for (const [category, items] of Object.entries(AgentKnowledgeBase)) {
      for (const item of items) {
        const parts = [item.title, item.subtitle || "", item.definition, item.explanation, item.application, ...(item.formulas || [])];
        const flatText = cleanAndNormalize(parts.join(" "));
        rawSeedDocs.push({ category, item, flatText });
      }
    }

    // 2. Nạp ký ức động từ AgentMemory cũ nếu có
    try {
      const memories = await db.select().from(agentMemory).where(eq(agentMemory.contextKey, "user_training"));
      for (const mem of memories) {
        const memText = (mem.contextValue as any)?.text;
        if (memText) {
          const flatText = cleanAndNormalize(memText);
          rawSeedDocs.push({
            category: "USER MEMORY",
            item: {
              id: mem.id,
              title: "Ký ức User Đào tạo",
              definition: memText,
              explanation: "",
              application: "",
              tags: ["memory", "dynamic"],
            },
            flatText,
          });
        }
      }
    } catch (e) {
      console.error("Failed to load agent memories into seed:", e);
    }

    // 3. Nạp giáo trình tĩnh
    const trainings = ALL_DOMAIN_TRAINING_PAIRS;
    for (const tr of trainings) {
      const trText = tr.utterance + " " + tr.answer;
      const flatText = cleanAndNormalize(trText);
      rawSeedDocs.push({
        category: "EDUCATION_CURRICULUM",
        item: {
          id: `local_${tr.intent}`,
          title: tr.intent,
          definition: tr.utterance,
          explanation: tr.answer,
          application: "",
          tags: ["education", "logic", "curriculum"],
        },
        flatText,
      });
    }

    // Xây dựng kho từ vựng ban đầu cho Seed Docs
    rawSeedDocs.forEach((doc) => {
      doc.flatText
        .split(/\s+/)
        .filter((w) => w.length >= 2)
        .forEach((w) => (termFreqs[w] = (termFreqs[w] || 0) + 1));
    });
    flatDocsCache = tempDocs;
    vocabulary = Object.keys(termFreqs);

    (globalThis as any)._flatDocsCache = flatDocsCache;
    (globalThis as any)._vocabulary = vocabulary;

    // Lưu vào database
    try {
      const docsToInsert = rawSeedDocs.map((doc) => {
        const embedding = generateEmbedding(doc.flatText, vocabulary);
        return {
          id: crypto.randomUUID(),
          category: doc.category,
          title: doc.item.title,
          subtitle: doc.item.subtitle || "",
          content: doc.item.definition || doc.flatText,
          metadata: doc.item,
          embedding,
        };
      });

      // Chia nhỏ ra insert để tránh quá tải query parameter nếu tập dữ liệu quá lớn
      const chunkSize = 100;
      for (let i = 0; i < docsToInsert.length; i += chunkSize) {
        const chunk = docsToInsert.slice(i, i + chunkSize);
        await db.insert(vectorDocument).values(chunk);
      }
      console.log(`[RAG DATABASE SEED SUCCESS] Đã nạp thành công ${docsToInsert.length} bản ghi tri thức vào VectorDocument.`);

      // Lấy lại danh sách sau khi seed
      dbDocs = await db.select().from(vectorDocument);
    } catch (seedErr) {
      console.error("[RAG DATABASE SEED ERROR] Seed thất bại:", seedErr);
    }
  }

  // Xây dựng kho từ vựng từ toàn bộ tài liệu trong database
  const finalFreqs: Record<string, number> = {};

  if (!soaPool) {
    const dim = 1024; // BGE-M3 Dense Dim
    soaPool = new SoAVectorPool(dim, dbDocs.length + 500);
    (globalThis as any)._soaPool = soaPool;
  }

  for (const doc of dbDocs) {
    const flatText = cleanAndNormalize(doc.title + " " + (doc.subtitle || "") + " " + doc.content);
    flatText
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .forEach((w) => (finalFreqs[w] = (finalFreqs[w] || 0) + 1));

    const meta = (doc.metadata as any) || {};
    tempDocs.push({
      id: tempId++,
      category: doc.category,
      item: {
        id: meta.id || doc.id,
        title: meta.title || doc.title,
        subtitle: meta.subtitle || doc.subtitle || "",
        definition: meta.definition || doc.content,
        explanation: meta.explanation || meta.Core_Concept || "",
        application: meta.application || meta.Application || "",
        tags: meta.tags || [],
        tenantId: doc.tenantId || null,
      },
      flatText,
      vectorId: soaPool.insert((doc.embedding as number[]) || generateEmbedding(flatText, vocabulary)),
      pointers: [],
      backPointers: [],
    });
  }
  vocabulary = Object.keys(finalFreqs).filter((w) => finalFreqs[w] > 0);

  // GRAPH DEDUPLICATION (Entity Merging)
  const docs: FlatDoc[] = [];
  let docId = 0;

  for (const tempDoc of tempDocs) {
    let merged = false;
    for (const coreDoc of docs) {
      const similarity = soaPool!.scorePair(tempDoc.vectorId, coreDoc.vectorId);
      const isTenantMismatch = (tempDoc.item as any).tenantId !== (coreDoc.item as any).tenantId;
      const isClashing =
        isTenantMismatch ||
        (tempDoc.category.startsWith("EDUCATION") && coreDoc.category.startsWith("EDUCATION") && tempDoc.category !== coreDoc.category);

      if (similarity > 0.85 && !isClashing) {
        coreDoc.flatText += " " + tempDoc.flatText;
        soaPool!.mergeAvg(coreDoc.vectorId, tempDoc.vectorId);
        merged = true;
        break;
      }
    }
    if (!merged) {
      tempDoc.id = docId++;
      docs.push(tempDoc);
    }
  }

  // Precompute coreTargetTitles once for each doc to avoid redundant regex operations in the double loop
  const docTitles = docs.map((doc) => {
    const targetTitleClean = cleanAndNormalize(doc.item.title);
    const coreTargetTitle = targetTitleClean.replace(/(mô hình|phân tích|định lý|giải thuật|công thức|phương pháp)/g, "").trim();
    return {
      id: doc.id,
      coreTargetTitle,
    };
  });

  const docsMap = new Map<number, FlatDoc>();
  docs.forEach((d) => docsMap.set(d.id, d));

  // Quét đệ quy xây dựng Graph Edges (Pointers & Back-Pointers)
  docs.forEach((doc) => {
    docTitles.forEach((targetInfo) => {
      if (doc.id !== targetInfo.id) {
        const coreTargetTitle = targetInfo.coreTargetTitle;

        if (coreTargetTitle.length > 3 && doc.flatText.includes(coreTargetTitle)) {
          if (!doc.pointers.includes(targetInfo.id)) {
            doc.pointers.push(targetInfo.id);
            const targetDoc = docsMap.get(targetInfo.id);
            if (targetDoc && !targetDoc.backPointers.includes(doc.id)) {
              targetDoc.backPointers.push(doc.id);
            }
          }
        }
      }
    });
  });

  console.log(`[SoA Pool] DB đã nạp ${soaPool!.getSize()} vectors vào RAM phẳng. Triệt tiêu Object 3D thành công!`);

  flatDocsCache = docs;
  return { flatDocsCache, vocabulary };
};

// Chuẩn hóa và làm sạch văn bản tiếng Việt để phân tích ngữ nghĩa
export const cleanAndNormalize = (text: string): string => {
  const normalized = normalizeVietnameseShorthands(text);
  return removeAccents(normalized)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// --- TRANSFORMER ARCHITECTURE UPGRADE ---
// 1. Lớp Tokenizer (Input -> Token IDs)
export const TinyTokenizer = {
  encode: (text: string): number[] => {
    const searchStopWords = new Set([
      "tai",
      "lieu",
      "dinh",
      "nghia",
      "cong",
      "thuc",
      "giai",
      "thich",
      "tra",
      "cuu",
      "bdf",
      "pdf",
      "cho",
      "cua",
      "ve",
      "cai",
      "gi",
      "the",
      "va",
      "la",
      "mot",
      "co",
      "de",
      "ban",
      "dich",
      "muon",
      "tim",
      "xem",
      "doc",
    ]);
    const cleaned = cleanAndNormalize(text);
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0 && !searchStopWords.has(w));

    // Nếu bị lọc hết thì lấy lại toàn bộ để tránh chuỗi rỗng
    const activeWords = words.length > 0 ? words : cleaned.split(/\s+/).filter((w) => w.length > 0);

    // Ánh xạ mỗi từ thành một Token ID nguyên thủy (djb2 hash algorithm)
    return activeWords.map((w) => {
      let hash = 5381;
      for (let i = 0; i < w.length; i++) {
        hash = (hash << 5) + hash + w.charCodeAt(i);
      }
      return Math.abs(hash) % 50000; // Vocab size ~ 50k tokens
    });
  },
};

// 2. Lớp Dense Vector Embedding — bge-m3 (1024-dim) with TF-IDF fallback (256-dim)
const HIDDEN_DIM = 256;

export const generateEmbedding = (text: string, vocab?: string[]): number[] => {
  if (isEmbeddingReady()) {
    return generateEmbeddingAsync(text);
  }
  return generateEmbeddingTFIDF(text);
};

const generateEmbeddingAsync = (text: string): number[] => {
  const pending = (globalThis as any)._pendingEmbedding;
  if (pending && pending.length > 0) return pending;
  embed(text)
    .then((vec) => {
      (globalThis as any)._pendingEmbedding = vec;
    })
    .catch(() => {});
  return generateEmbeddingTFIDF(text);
};

export const generateEmbeddingAsyncAwait = async (text: string): Promise<number[]> => {
  if (isEmbeddingReady()) {
    try {
      return await embed(text);
    } catch {
      return generateEmbeddingTFIDF(text);
    }
  }
  return generateEmbeddingTFIDF(text);
};

const generateEmbeddingTFIDF = (text: string): number[] => {
  const tokenIds = TinyTokenizer.encode(text);
  const vector = new Array(HIDDEN_DIM).fill(0);

  tokenIds.forEach((id, index) => {
    const dimIndex = (id + index * 17) % HIDDEN_DIM;
    vector[dimIndex] += 1.0;

    const neighborDim = (dimIndex + 1) % HIDDEN_DIM;
    vector[neighborDim] += 0.1;

    if (index < tokenIds.length - 1) {
      const nextId = tokenIds[index + 1];
      const bigramHash = (id * 33 + nextId) % 50000;
      const bigramDim = bigramHash % HIDDEN_DIM;
      vector[bigramDim] += 0.5;
    }
  });

  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map((val) => val / magnitude);
};

// 3. COSINE SIMILARITY (cross-dimension safe)
export const cosineSimilarity = (v1: number[], v2: number[]): number => {
  if (v1.length !== v2.length || v1.length === 0) return 0;
  if (v1.length === 1024) return cosineSimilarityDense(v1, v2);
  let dotProduct = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
  }
  return dotProduct;
};

// --- COGNITIVE CACHE SYSTEM FOR RAG (LRU & Semantic Query Caching) ---
export interface RAGCacheEntry {
  query: string;
  embedding: number[];
  candidates: RetrievalCandidate[];
  timestamp: number;
  tenantId?: string | null;
  isStrict?: boolean;
  categoryPrefix?: string | string[];
  excludePrefix?: string | string[];
}

const RAG_CACHE_MAX_SIZE = 50;
const RAG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
let ragSemanticCache: RAGCacheEntry[] = [];

export function clearRAGCache() {
  ragSemanticCache = [];
  console.log("[RAG COGNITIVE CACHE] Cleared Short-term Cache.");
}

// 4. HYBRID RETRIEVAL (Sparse overlap + Dense Embedding Cosine Similarity)
export interface RetrievalCandidate {
  doc: FlatDoc;
  sparseScore: number;
  denseScore: number;
  hybridScore: number;
}

export const hybridRetrieve = async (
  query: string,
  topK: number = 3,
  tenantId?: string | null,
  strict: boolean = false,
  categoryPrefix?: string | string[],
  excludePrefix?: string | string[],
): Promise<RetrievalCandidate[]> => {
  const { flatDocsCache, vocabulary } = await initRAGEngine(true);
  const queryClean = cleanAndNormalize(query);
  const now = Date.now();

  const privateKeywords = ["bi mat", "tuyet mat", "rieng tu", "noi bo", "cua toi", "private", "secret", "my", "own"];
  const requiresPrivate = privateKeywords.some((kw) => queryClean.includes(kw));
  const isStrict = strict || requiresPrivate;

  ragSemanticCache = ragSemanticCache.filter((entry) => now - entry.timestamp < RAG_CACHE_TTL_MS);

  // --- HyDE: Hypothetical Document Embeddings ---
  let hydeTextToEmbed = queryClean;
  if (queryClean.split(/\s+/).length >= 3) {
    try {
      const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
      const hydeResponse = await generateTextLocal({
        system:
          "Đóng vai thiền sư/chuyên gia uyên bác, viết đúng 1 câu trả lời ngắn (dưới 30 chữ) mang tính triết lý, thực tiễn để giải đáp trực tiếp truy vấn sau. Không giải thích.",
        prompt: `Truy vấn: "${query}"`,
        decodingSettings: { temperature: 0.6, maxTokens: 80 },
        isInternalReasoning: true,
      });
      if (hydeResponse && hydeResponse.text) {
        hydeTextToEmbed = queryClean + " " + cleanAndNormalize(hydeResponse.text);
        console.log(`[HyDE] Sinh nháp suy luận: "${hydeResponse.text.substring(0, 100).replace(/\n/g, "")}..."`);
      }
    } catch (err) {
      console.error("[HyDE] Bỏ qua do lỗi sinh nháp:", err);
    }
  }

  const queryVector = await generateEmbeddingAsyncAwait(hydeTextToEmbed);

  const cached = ragSemanticCache.find((entry) => {
    if (entry.tenantId !== tenantId) return false;
    if (!!entry.isStrict !== isStrict) return false;
    if (JSON.stringify(entry.categoryPrefix) !== JSON.stringify(categoryPrefix)) return false;
    if (JSON.stringify(entry.excludePrefix) !== JSON.stringify(excludePrefix)) return false;
    if (entry.query === queryClean) return true;
    const sim = cosineSimilarity(queryVector, entry.embedding);
    return sim > 0.96;
  });

  if (cached) {
    console.log(`[RAG COGNITIVE CACHE HIT] "${queryClean}" (Tenant: ${tenantId || "Global"}, Strict: ${isStrict})`);
    return cached.candidates.slice(0, topK + 2);
  }

  const queryWords = queryClean.split(/\s+/).filter((w) => w.length >= 2);

  // Multi-tenant isolation: filter cached flatDocsCache
  let isolatedDocs = flatDocsCache.filter((doc) => {
    const docTenantId = (doc.item as any).tenantId;
    if (tenantId) {
      if (isStrict) {
        return docTenantId === tenantId;
      }
      return docTenantId === tenantId || !docTenantId;
    }
    return !docTenantId;
  });

  if (categoryPrefix) {
    const prefixes = Array.isArray(categoryPrefix) ? categoryPrefix : [categoryPrefix];
    isolatedDocs = isolatedDocs.filter((doc) => prefixes.some((p) => doc.category.startsWith(p)));
  }
  if (excludePrefix) {
    const excludes = Array.isArray(excludePrefix) ? excludePrefix : [excludePrefix];
    isolatedDocs = isolatedDocs.filter((doc) => !excludes.some((e) => doc.category.startsWith(e)));
  }

  // SoA BQN-Style: Tính toán TẤT CẢ Dense Scores trên toàn bộ DB chỉ với 1 thao tác vòng lặp CPU phẳng siêu tốc!
  const allDenseScores = soaPool ? soaPool.getAllScores(queryVector) : new Float32Array(flatDocsCache.length);

  const candidates: RetrievalCandidate[] = isolatedDocs.map((doc) => {
    // A. SPARSE SCORE (TF-IDF keyword overlap + Bigram matching)
    let sparseScore = 0;
    const docWords = doc.flatText.split(/\s+/);
    const docWordSet = new Set(docWords);

    queryWords.forEach((qw) => {
      if (docWordSet.has(qw)) {
        // Tăng trọng số nếu khớp trong Title hoặc Subtitle
        const titleClean = cleanAndNormalize(doc.item.title);
        const subClean = cleanAndNormalize(doc.item.subtitle || "");

        if (titleClean.includes(qw)) sparseScore += 10;
        else if (subClean.includes(qw)) sparseScore += 5;
        else sparseScore += 1;
      }
    });

    // Bổ sung điểm số trùng khớp Bigram (Cặp từ kề nhau) để bảo toàn trật tự từ
    const queryBigrams: string[] = [];
    for (let i = 0; i < queryWords.length - 1; i++) {
      queryBigrams.push(`${queryWords[i]} ${queryWords[i + 1]}`);
    }
    const docFlatTextClean = cleanAndNormalize(doc.flatText);
    queryBigrams.forEach((qb) => {
      if (docFlatTextClean.includes(qb)) {
        sparseScore += 8; // Điểm thưởng lớn cho trật tự từ chính xác
      }
    });

    // B. DENSE SCORE (Cosine similarity của L2 Embedding)
    // Trích xuất trực tiếp từ bộ đệm mảng phẳng đã tính toán sẵn nhờ SoAVectorPool
    const denseScore = doc.vectorId !== undefined && soaPool ? allDenseScores[doc.vectorId] : 0;

    // C. HYBRID FUSION (Trọng số 0.4 Sparse + 0.6 Dense)
    const maxPossibleSparse = queryWords.length * 10 + queryBigrams.length * 8;
    const hybridScore = 0.4 * (sparseScore / (maxPossibleSparse || 1)) + 0.6 * denseScore;

    return {
      doc,
      sparseScore,
      denseScore,
      hybridScore,
    };
  });

  // Sắp xếp giảm dần theo Hybrid score
  const topCandidates = candidates.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK);

  // TRUY HỒI ĐỆ QUY ĐA TẦNG (BFS Graph Traversal)
  const recursiveResults: RetrievalCandidate[] = [];
  const visitedIds = new Set<number>();

  // Queue for BFS: [candidate, depth]
  const queue: { candidate: RetrievalCandidate; depth: number }[] = topCandidates.map((c) => ({ candidate: c, depth: 0 }));

  while (queue.length > 0) {
    const { candidate, depth } = queue.shift()!;
    if (visitedIds.has(candidate.doc.id)) continue;

    visitedIds.add(candidate.doc.id);
    recursiveResults.push(candidate);

    // Dừng đệ quy nếu quá sâu (Tối đa duyệt 2 tầng để tránh bùng nổ đồ thị)
    if (depth >= 2) continue;

    // Duyệt cả con trỏ xuôi (pointers) và con trỏ ngược (backPointers)
    const allLinkedIds = [...candidate.doc.pointers, ...candidate.doc.backPointers];

    for (const linkId of allLinkedIds) {
      if (!visitedIds.has(linkId)) {
        const linkedDoc = isolatedDocs.find((d) => d.id === linkId);
        if (linkedDoc) {
          // Tính điểm số qua mỗi tầng theo công thức: k^-n + 1 (với k = 2, n = depth + 1)
          const k_base = 2;
          const n_depth = depth + 1;
          const decayScore = candidate.hybridScore * (Math.pow(k_base, -n_depth) + 1);
          queue.push({
            candidate: {
              doc: linkedDoc,
              sparseScore: 0,
              denseScore: 0,
              hybridScore: decayScore,
            },
            depth: depth + 1,
          });
        }
      }
    }
  }

  // Sắp xếp lại toàn bộ cây đệ quy và mở rộng Context Window (trả về topK + 2)
  const finalResults = recursiveResults.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK + 2);

  // 3. Lưu kết quả mới vào Cache (LRU Eviction)
  if (ragSemanticCache.length >= RAG_CACHE_MAX_SIZE) {
    ragSemanticCache.shift();
  }
  ragSemanticCache.push({
    query: queryClean,
    embedding: queryVector,
    candidates: finalResults,
    timestamp: now,
    tenantId: tenantId ?? null,
    isStrict,
    ...(categoryPrefix ? { categoryPrefix } : {}),
    ...(excludePrefix ? { excludePrefix } : {}),
  });

  return finalResults;
};

/**
 * Tính toán Cross Entropy theo Google-style để so sánh phân phối từ vựng
 * giữa Query (phân phối thực tế P) và Document (phân phối dự báo Q).
 */
export const computeGoogleCrossEntropy = (queryWords: string[], docWords: string[]): number => {
  if (queryWords.length === 0) return 0;

  // 1. Tính phân phối xác suất P(w) của Query
  const pFreq: Record<string, number> = {};
  queryWords.forEach((w) => {
    pFreq[w] = (pFreq[w] || 0) + 1;
  });

  // 2. Tính tần suất từ vựng của Document
  const qFreq: Record<string, number> = {};
  docWords.forEach((w) => {
    qFreq[w] = (qFreq[w] || 0) + 1;
  });

  const docLen = docWords.length;
  const epsilon = 0.01; // Laplace smoothing factor
  const vocabSize = 10000; // Tập từ vựng giả định

  let crossEntropy = 0;

  for (const w of Object.keys(pFreq)) {
    const p_w = pFreq[w] / queryWords.length;
    // Phân phối dự đoán Q(w) có làm mịn Laplace
    const q_w = ((qFreq[w] || 0) + epsilon) / (docLen + epsilon * vocabSize);

    crossEntropy -= p_w * Math.log2(q_w);
  }

  return crossEntropy;
};

// 5. SEMANTIC RERANKER (Cross-Encoder style matching)
export interface RerankedCandidate extends RetrievalCandidate {
  rerankScore: number;
  sourceDocument?: {
    title: string;
    snippet: string;
    relevance: number;
  };
}

export const rerank = (query: string, candidates: RetrievalCandidate[]): RerankedCandidate[] => {
  const queryClean = cleanAndNormalize(query);
  const queryWords = queryClean.split(/\s+/).filter((w) => w.length >= 2);

  const searchStopWords = new Set([
    "tai",
    "lieu",
    "dinh",
    "nghia",
    "cong",
    "thuc",
    "giai",
    "thich",
    "tra",
    "cuu",
    "bdf",
    "pdf",
    "cho",
    "cua",
    "ve",
    "cai",
    "gi",
    "the",
    "va",
    "la",
    "mot",
    "co",
    "de",
    "ban",
    "dich",
    "muon",
    "tim",
    "xem",
    "doc",
  ]);
  const coreQueryWords = queryWords.filter((w) => !searchStopWords.has(w));
  const activeQueryWords = coreQueryWords.length > 0 ? coreQueryWords : queryWords;

  const reranked: RerankedCandidate[] = candidates.map((c) => {
    let bonus = 0;

    // B1: Khớp cụm từ chính xác (Exact Phrase Match Bonus)
    if (c.doc.flatText.includes(queryClean)) bonus += 2.0;

    // B2: Khớp trật tự từ ghép (Bigram / Trigram Match Bonus)
    for (let i = 0; i < queryWords.length - 1; i++) {
      const bigram = `${queryWords[i]} ${queryWords[i + 1]}`;
      if (c.doc.flatText.includes(bigram)) bonus += 0.5;
    }

    // B3: Hệ số bao phủ từ vựng (Query Coverage Ratio)
    let matchedWords = 0;
    activeQueryWords.forEach((w) => {
      if (c.doc.flatText.includes(w)) matchedWords++;
    });
    const coverageRatio = matchedWords / (activeQueryWords.length || 1);

    // B4: Tính Google-style Cross Entropy Bonus
    const docWords = c.doc.flatText.split(/\s+/).filter((w) => w.length >= 2);
    const crossEntropy = computeGoogleCrossEntropy(activeQueryWords, docWords);
    // Cross Entropy càng thấp, độ tương đồng phân phối càng cao -> cộng bonus tỉ lệ nghịch
    const entropyBonus = crossEntropy > 0 ? 3.0 / (crossEntropy + 1.0) : 0;

    // Điểm Rerank = Điểm Hybrid gốc + Các hệ số bổ trợ ngữ nghĩa chéo + Google-style Cross Entropy Bonus
    const rerankScore = c.hybridScore + bonus + coverageRatio * 1.5 + entropyBonus;

    // Source attribution for explainability
    const sourceDocument = {
      title: c.doc.item.title || "Untitled",
      snippet: c.doc.item.definition?.substring(0, 100) || c.doc.flatText.substring(0, 100),
      relevance: Math.round(rerankScore * 100),
    };

    return {
      ...c,
      rerankScore,
      sourceDocument,
    };
  });

  return reranked.sort((a, b) => b.rerankScore - a.rerankScore);
};

// 6. TINY LLM VERIFIER (Mô hình suy luận nhận thức siêu nhỏ)
export interface VerificationResult {
  verified: boolean;
  confidence: number;
  reason: string;
}

export const tinyLLMVerify = (query: string, matched: RerankedCandidate): VerificationResult => {
  const queryClean = cleanAndNormalize(query);
  const queryWords = queryClean.split(/\s+/).filter((w) => w.length >= 2);

  if (!matched || matched.rerankScore < 0.25) {
    return {
      verified: false,
      confidence: 15,
      reason: "Độ tin cậy Reranker quá thấp. Không tìm thấy bất kỳ tri thức khoa học nào tương ứng trong cơ sở dữ liệu.",
    };
  }

  const searchStopWords = new Set([
    "tai",
    "lieu",
    "dinh",
    "nghia",
    "cong",
    "thuc",
    "giai",
    "thich",
    "tra",
    "cuu",
    "bdf",
    "pdf",
    "cho",
    "cua",
    "ve",
    "cai",
    "gi",
    "the",
    "va",
    "la",
    "mot",
    "co",
    "de",
    "ban",
    "dich",
    "muon",
    "tim",
    "xem",
    "doc",
  ]);
  const coreQueryWords = queryWords.filter((w) => !searchStopWords.has(w));
  const activeQueryWords = coreQueryWords.length > 0 ? coreQueryWords : queryWords;

  // Đếm số từ khóa cốt lõi khớp
  let matchedCoreTerms = 0;
  activeQueryWords.forEach((w) => {
    if (matched.doc.flatText.includes(w)) matchedCoreTerms++;
  });

  const coverage = matchedCoreTerms / (activeQueryWords.length || 1);

  // Cải tiến: Loại bỏ "Tự tin ảo" bằng hàm Sigmoid điều hòa (Harmonic Sigmoid)
  // Kết hợp Dense Score (Ý nghĩa câu) và Coverage (Từ khóa) một cách khắt khe hơn.
  const rawScore = matched.denseScore * 0.7 + coverage * 0.3;

  // Áp dụng hàm Sigmoid (S-Curve) để ép chuẩn phân phối.
  // Điểm ngoặt (Sweet spot) = 0.65 để trừng phạt mạnh các trường hợp Dense Score nhiễu.
  const sigmoidScore = 1 / (1 + Math.exp(-12 * (rawScore - 0.65)));
  let confidence = Math.round(sigmoidScore * 99);

  // Khóa an toàn (Strict Threshold): Chống False Positive tuyệt đối!
  // Nếu độ tương đồng ngữ nghĩa (Dense Score) thấp hơn 0.4, ép mức tự tin xuống vùng rác (< 40%).
  if (matched.denseScore < 0.4) {
    confidence = Math.min(confidence, 39);
  }

  // Kiểm tra mâu thuẫn phủ định (Contradiction Check)
  const hasNegation = queryClean.includes("khong") || queryClean.includes("chua") || queryClean.includes("ngược");
  const docHasNegation = matched.doc.flatText.includes("khong") || matched.doc.flatText.includes("chua");

  if (hasNegation && !docHasNegation && coverage < 0.4) {
    return {
      verified: false,
      confidence: 30,
      reason: "Phát hiện sắc thái phủ định hoặc đối nghịch trong câu hỏi nhưng tài liệu khớp không chứa phủ định tương đương.",
    };
  }

  if (confidence >= 55) {
    return {
      verified: true,
      confidence,
      reason: `Tri thức được kiểm chứng thành công. Tài liệu '${matched.doc.item.title}' có độ bao trùm từ vựng ${Math.round(coverage * 100)}% và độ tương đồng vector cosine đạt ${(matched.denseScore * 100).toFixed(1)}%.`,
    };
  }

  return {
    verified: false,
    confidence,
    reason: `Cần xác thực thêm. Độ khớp ngữ nghĩa chỉ đạt ${confidence}%, chưa đủ ngưỡng kiểm chứng an toàn (>55%).`,
  };
};

// 7. MULTI-DOCUMENT SELF-ATTENTION KNOWLEDGE FUSION LAYER (Lõi hợp nhất tri thức bằng Ma trận Attention)
export interface AttentionHeadResult {
  docTitle: string;
  attentionScore: number;
  attentionWeight: number;
  barIndicator: string;
}

export interface DynamicAttentionFusion {
  attentionMap: AttentionHeadResult[];
  fusedContextText: string;
}

export const computeAttentionFusion = (query: string, candidates: RetrievalCandidate[]): DynamicAttentionFusion => {
  const queryClean = cleanAndNormalize(query);
  const queryVector = generateEmbedding(queryClean); // Vector Q (Query)

  const d_k = 256; // Chiều không gian giả lập (HIDDEN_DIM)

  // A. Tính Attention Scores (Q x K^T / sqrt(d_k))
  // Trong đó: Q là vector truy vấn, K là vector của từng tài liệu ứng viên
  const rawScores = candidates.map((c) => {
    // Tích vô hướng (Q x K^T)
    const dotProd = cosineSimilarity(queryVector, c.doc.vector || []);
    // Chuẩn hóa tỷ lệ theo đúng công thức Transformer
    const scaledScore = dotProd / Math.sqrt(d_k);
    return {
      candidate: c,
      scaledScore,
    };
  });

  // B. Áp dụng SOFTMAX động trên các Attention Scores
  const maxScore = Math.max(...rawScores.map((s) => s.scaledScore));
  const expScores = rawScores.map((s) => Math.exp(s.scaledScore - maxScore)); // Stable Softmax
  const sumExp = expScores.reduce((sum, val) => sum + val, 0);
  const weights = expScores.map((val) => (sumExp === 0 ? 0 : val / sumExp));

  // C. Sinh bản đồ Attention Map trực quan hóa
  const attentionMap: AttentionHeadResult[] = rawScores.map((s, idx) => {
    const weight = weights[idx];
    const percentage = Math.round(weight * 100);
    const filledChars = Math.round(percentage / 10);
    const barIndicator = "█".repeat(filledChars) + "░".repeat(10 - filledChars);

    return {
      docTitle: s.candidate.doc.item.title,
      attentionScore: s.scaledScore,
      attentionWeight: weight,
      barIndicator: `[${barIndicator}] ${percentage}%`,
    };
  });

  // D. Generative Aggregation (Hợp nhất theo trọng số Attention Softmax x V)
  // Kết hợp Value (nội dung) của các tài liệu được chú ý nhiều nhất
  const fusedParagraphs = candidates
    .map((c, idx) => {
      const weight = weights[idx];
      if (weight < 0.05) return ""; // Trượt Threshold Attention

      let cleanContent = c.doc.item.definition;
      // Loại bỏ rườm rà: link youtube, giới thiệu youtube
      cleanContent = cleanContent.replace(/Nội dung từ bài giảng YouTube "[^"]+":\s*/gi, "");
      cleanContent = cleanContent.replace(/Xem trực tiếp tại:\s*https?:\/\/\S+/gi, "");

      // Chỉ trả về nội dung thuần túy, không kèm Attention Weight hay Title
      return `- ${cleanContent.trim()}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return {
    attentionMap,
    fusedContextText: fusedParagraphs,
  };
};

/**
 * Tự động phân tích hội thoại và biên soạn/cập nhật vào CSDL VectorDocument
 * theo nguyên lý LLM Wiki của Andrej Karpathy.
 */
export async function compileToLlmWiki(query: string, response: string): Promise<void> {
  try {
    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");

    const systemPrompt = `You are the Knowledge Compiler for Rottra's LLM Wiki (inspired by Andrej Karpathy's design pattern).
Your job is to read the conversation between the User and the Assistant and compile any new facts, formulas, settings, product details, or user preferences into structured wiki entries.

Rules:
1. If there is a new fact, instruction, formula, preference, or concept that should be remembered, extract it.
2. If there is an update to an existing concept, specify it.
3. Provide the output ONLY in JSON format:
{
  "hasUpdate": true,
  "title": "Short Topic Title (e.g., 'Công thức Dijkstra', 'Sở thích của Sếp', 'VietGAP Cam Vinh')",
  "category": "USER MEMORY" or "AGRICULTURE" or "LOGISTICS" or "MATHEMATICS",
  "content": "A detailed, structured Markdown text explaining the concept/fact/formula.",
  "subtitle": "Brief description"
}
4. If NO new knowledge or preference was introduced in this turn, return:
{ "hasUpdate": false }
Do not output anything other than the raw JSON object.`;

    const prompt = `User Query: "${query}"\nAssistant Response: "${response}"`;

    const { text: llmOutput } = await generateTextLocal({
      system: systemPrompt,
      prompt,
      isInternalReasoning: true,
    });

    if (!llmOutput || llmOutput.trim().length === 0) return;

    // Trích xuất chuỗi JSON chặt chẽ bằng Regex để tránh LLM "nói nhảm"
    let jsonStr = llmOutput
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let result: any;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn("[LLM WIKI COMPILER] Bỏ qua vì JSON lỗi cú pháp:", parseErr);
      return;
    }

    if (result.hasUpdate && result.title && result.content) {
      console.log(`[LLM WIKI COMPILER] Phát hiện cập nhật cho chủ đề: "${result.title}"`);
      const cleanText = cleanAndNormalize(result.title + " " + (result.subtitle || "") + " " + result.content);

      // Khởi động lại engine nếu từ vựng chưa được nạp
      if (vocabulary.length === 0) {
        await initRAGEngine();
      }
      const embedding = generateEmbedding(cleanText, vocabulary);

      // Tìm bản ghi trùng tên hoặc tương đồng ngữ nghĩa lớn trong DB để tránh phân mảnh tri thức
      const allDocs = await db.select().from(vectorDocument);
      const cleanNewTitle = cleanAndNormalize(result.title);
      let existingRecord = null;

      for (const doc of allDocs) {
        if (cleanAndNormalize(doc.title) === cleanNewTitle) {
          existingRecord = doc;
          break;
        }
      }

      if (!existingRecord) {
        for (const doc of allDocs) {
          if (doc.embedding) {
            const similarity = cosineSimilarity(embedding, doc.embedding as number[]);
            if (similarity > 0.88) {
              existingRecord = doc;
              console.log(
                `[LLM WIKI DE-DUPLICATE] Gộp bài viết "${result.title}" vào trang tương đồng "${doc.title}" (Cosine: ${(similarity * 100).toFixed(1)}%)`,
              );
              break;
            }
          }
        }
      }

      if (existingRecord) {
        // Cập nhật bản ghi hiện tại
        await db
          .update(vectorDocument)
          .set({
            content: result.content,
            subtitle: result.subtitle || "",
            category: result.category || "USER MEMORY",
            embedding,
            metadata: {
              id: existingRecord.id,
              title: existingRecord.title,
              subtitle: result.subtitle || "",
              definition: result.content,
              explanation: "",
              application: "",
              tags: ["wiki", "updated"],
              updatedAt: new Date().toISOString(),
            },
          })
          .where(eq(vectorDocument.id, existingRecord.id));
        console.log(`[LLM WIKI] Đã cập nhật thành công trang Wiki: "${existingRecord.title}"`);
      } else {
        // Tạo mới bản ghi
        const newId = crypto.randomUUID();
        await db.insert(vectorDocument).values({
          id: newId,
          title: result.title,
          subtitle: result.subtitle || "",
          category: result.category || "USER MEMORY",
          content: result.content,
          embedding,
          metadata: {
            id: newId,
            title: result.title,
            subtitle: result.subtitle || "",
            definition: result.content,
            explanation: "",
            application: "",
            tags: ["wiki", "compiled"],
            updatedAt: new Date().toISOString(),
          },
        });
        console.log(`[LLM WIKI] Đã biên soạn trang Wiki mới: "${result.title}"`);
      }

      // Làm mới cache bộ nhớ để sử dụng ngay lập tức ở câu chat tiếp theo
      await initRAGEngine(true);
    }
  } catch (err: any) {
    console.error("[LLM WIKI COMPILER ERROR] Không thể biên soạn cuộc đối thoại thành Wiki:", err.message);
  }
}

export function getEmbeddingStatus() {
  return {
    ...getEmbeddingInfo(),
    fallback: "TF-IDF 256-dim",
    primary: "bge-m3 1024-dim",
  };
}

// ============================================================================
// CHUNKING STRATEGIES FOR LONG AGRICULTURAL DOCUMENTS
// ============================================================================

/**
 * Chunk a long document into smaller pieces for better RAG retrieval
 */
export function chunkDocument(
  text: string,
  options?: {
    strategy?: "smart" | "agricultural" | "fixed" | "sliding" | "paragraph";
    maxChunkSize?: number;
    overlapSize?: number;
    metadata?: { title?: string; category?: string };
  },
): { chunks: string[]; stats: ReturnType<typeof getChunkingStats> } {
  const config: Partial<ChunkingConfig> = {
    maxChunkSize: options?.maxChunkSize || 512,
    overlapSize: options?.overlapSize || 64,
  };

  let chunks: string[];

  switch (options?.strategy) {
    case "agricultural":
      chunks = agriculturalChunking(text, config);
      break;
    case "fixed":
      chunks = fixedChunking(text, config);
      break;
    case "sliding":
      chunks = slidingWindowChunking(text, config);
      break;
    case "paragraph":
      chunks = paragraphChunking(text, config);
      break;
    case "smart":
    default:
      chunks = smartChunking(text, config);
      break;
  }

  return {
    chunks,
    stats: getChunkingStats(chunks),
  };
}

/**
 * Compile long documents into multiple wiki entries using chunking
 */
export async function compileLongDocumentToWiki(
  title: string,
  content: string,
  category: string = "AGRICULTURE",
): Promise<{ success: boolean; chunksProcessed: number }> {
  try {
    const { chunks, stats } = chunkDocument(content, {
      strategy: "smart",
      maxChunkSize: 512,
      overlapSize: 64,
    });

    console.log(`[LONG DOC COMPILER] Chunked "${title}" into ${stats.totalChunks} chunks (avg: ${stats.avgSize} chars)`);

    let chunksProcessed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkTitle = chunks.length > 1 ? `${title} (Phần ${i + 1}/${chunks.length})` : title;

      try {
        const cleanText = cleanAndNormalize(chunkTitle + " " + chunk);

        if (vocabulary.length === 0) {
          await initRAGEngine();
        }
        const embedding = generateEmbedding(cleanText, vocabulary);

        // Check for existing record
        const allDocs = await db.select().from(vectorDocument);
        const cleanNewTitle = cleanAndNormalize(chunkTitle);
        let existingRecord = null;

        for (const doc of allDocs) {
          if (cleanAndNormalize(doc.title) === cleanNewTitle) {
            existingRecord = doc;
            break;
          }
        }

        if (!existingRecord) {
          for (const doc of allDocs) {
            if (doc.embedding) {
              const similarity = cosineSimilarity(embedding, doc.embedding as number[]);
              if (similarity > 0.88) {
                existingRecord = doc;
                break;
              }
            }
          }
        }

        if (existingRecord) {
          await db
            .update(vectorDocument)
            .set({
              content: chunk,
              subtitle: `Chunk ${i + 1}/${chunks.length} của ${title}`,
              category,
              embedding,
              metadata: {
                id: existingRecord.id,
                title: chunkTitle,
                subtitle: `Chunk ${i + 1}/${chunks.length}`,
                definition: chunk,
                explanation: "",
                application: "",
                tags: ["wiki", "chunked", "long-doc"],
                updatedAt: new Date().toISOString(),
                chunkIndex: i,
                totalChunks: chunks.length,
              },
            })
            .where(eq(vectorDocument.id, existingRecord.id));
        } else {
          const newId = crypto.randomUUID();
          await db.insert(vectorDocument).values({
            id: newId,
            title: chunkTitle,
            subtitle: `Chunk ${i + 1}/${chunks.length} của ${title}`,
            category,
            content: chunk,
            embedding,
            metadata: {
              id: newId,
              title: chunkTitle,
              subtitle: `Chunk ${i + 1}/${chunks.length}`,
              definition: chunk,
              explanation: "",
              application: "",
              tags: ["wiki", "chunked", "long-doc"],
              updatedAt: new Date().toISOString(),
              chunkIndex: i,
              totalChunks: chunks.length,
            },
          });
        }

        chunksProcessed++;
      } catch (chunkErr: any) {
        console.error(`[LONG DOC COMPILER] Error processing chunk ${i + 1}:`, chunkErr.message);
      }
    }

    // Refresh RAG engine cache
    await initRAGEngine(true);

    console.log(`[LONG DOC COMPILER] Successfully compiled ${chunksProcessed}/${chunks.length} chunks for "${title}"`);

    return { success: true, chunksProcessed };
  } catch (err: any) {
    console.error("[LONG DOC COMPILER ERROR]", err.message);
    return { success: false, chunksProcessed: 0 };
  }
}
