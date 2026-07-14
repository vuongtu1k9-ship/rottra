import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import {
  cleanAndNormalize,
  generateEmbedding,
  cosineSimilarity,
  hybridRetrieve,
  RetrievalCandidate,
  RerankedCandidate,
  rerank,
  initRAGEngine,
  soaPool,
} from "~/core/neural-memory/vector-rag";
import { retrieveGraphRAG } from "~/core/neural-memory/graph-rag";

export interface DecomposedQuery {
  original: string;
  subQueries: string[];
  decompositionStrategy: "sequential" | "parallel" | "hierarchical";
}

export interface StepBackResult {
  abstractQuery: string;
  concreteQuery: string;
  abstractContext: string;
}

export interface HydeResult {
  hypotheticalDoc: string;
  hydeEmbedding: number[];
}

export interface ContextualChunk {
  content: string;
  context: string;
  originalIndex: number;
}

export interface AdvancedRAGResult {
  query: string;
  decomposed: DecomposedQuery | undefined;
  stepBack: StepBackResult | undefined;
  hyde: HydeResult | undefined;
  candidates: RetrievalCandidate[];
  reranked: RerankedCandidate[];
  finalAnswer: string;
}

const RAG_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích và truy xuất tri thức RAG.
Trả lời bằng tiếng Việt, ngắn gọn, chính xác, chỉ dựa trên thông tin được cung cấp.`;

export async function decomposeQuery(query: string): Promise<DecomposedQuery> {
  const clean = cleanAndNormalize(query);
  const wordCount = clean.split(/\s+/).length;

  if (wordCount < 8) {
    return { original: query, subQueries: [query], decompositionStrategy: "parallel" };
  }

  const hasMultipleIntents = /(và|còn|đồng thời|ngoài ra|bên cạnh|so sánh|khác nhau|mối quan hệ)/i.test(query);
  const hasMultiHop = /(tại sao|làm thế nào|làm sao|nguyên nhân|ảnh hưởng|tác động|quy trình|các bước)/i.test(query);

  let strategy: "sequential" | "parallel" | "hierarchical" = "parallel";
  if (hasMultiHop) strategy = "sequential";
  if (hasMultipleIntents) strategy = "parallel";

  try {
    const { text } = await generateTextLocal({
      system: `Bạn là chuyên gia phân tích câu hỏi. Nhiệm vụ: chia câu hỏi phức tạp thành các câu hỏi nhỏ hơn.

Quy tắc:
1. Nếu câu hỏi có NHIỀU ý (dùng "và", "còn", "so sánh"), tách thành các câu hỏi song song.
2. Nếu câu hỏi có NHIỀU TẦNG (tại sao, làm thế nào, quy trình), tách thành các bước tuần tự.
3. Nếu câu hỏi đơn giản, trả về một câu duy nhất.
4. LUÔN giữ nguyên ngôn ngữ gốc.
5. Trả về JSON: { "subQueries": ["câu 1", "câu 2", ...], "strategy": "parallel" | "sequential" | "hierarchical" }`,
      prompt: `Hãy phân tích câu hỏi sau và chia thành các câu hỏi nhỏ hơn:\n\n"${query}"`,
      isInternalReasoning: true,
    });

    if (text) {
      const parsed = JSON.parse(
        text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      if (parsed.subQueries && Array.isArray(parsed.subQueries) && parsed.subQueries.length > 0) {
        return {
          original: query,
          subQueries: parsed.subQueries,
          decompositionStrategy: parsed.strategy || strategy,
        };
      }
    }
  } catch {
    // fallback
  }

  if (hasMultipleIntents) {
    const parts = query
      .split(/và|còn|đồng thời|ngoài ra/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return { original: query, subQueries: parts, decompositionStrategy: "parallel" };
    }
  }

  return { original: query, subQueries: [query], decompositionStrategy: strategy };
}

export async function stepBackPrompting(query: string): Promise<StepBackResult> {
  const clean = cleanAndNormalize(query);

  try {
    const { text } = await generateTextLocal({
      system: `Bạn là chuyên gia trừu tượng hóa câu hỏi (Step-Back Prompting).
Nhiệm vụ: viết lại câu hỏi cụ thể thành câu hỏi tổng quát hơn, trừu tượng hơn.

Ví dụ:
- "Tại sao RAG bị miss khi chunk sai?" -> "Các nguyên tắc cơ bản của chunking trong RAG là gì?"
- "LoRA fine-tune 7B model trên 1 GPU chạy được không?" -> "Kiến trúc LoRA hoạt động như thế nào?"
- "Làm sao để hết bệnh vàng lá trên cây cam?" -> "Nguyên nhân và cách phòng trừ bệnh vàng lá trên cây có múi?"

Quy tắc:
1. Trả về JSON: { "abstractQuery": "câu hỏi tổng quát", "concreteQuery": "câu hỏi gốc" }
2. GIỮ NGUYÊN ngôn ngữ (tiếng Việt)`,
      prompt: `Viết lại câu hỏi cụ thể sau thành câu hỏi tổng quát (trừu tượng hơn):\n\n"${query}"`,
      isInternalReasoning: true,
    });

    if (text) {
      const parsed = JSON.parse(
        text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      if (parsed.abstractQuery) {
        return {
          abstractQuery: parsed.abstractQuery,
          concreteQuery: query,
          abstractContext: "",
        };
      }
    }
  } catch {
    // fallback
  }

  return { abstractQuery: query, concreteQuery: query, abstractContext: "" };
}

export async function hydeRetrieval(
  query: string,
  topK: number = 3,
): Promise<{ candidates: RetrievalCandidate[]; hydeResult: HydeResult }> {
  const clean = cleanAndNormalize(query);

  let hypotheticalDoc = "";
  try {
    const { text } = await generateTextLocal({
      system: `Bạn là chuyên gia viết tài liệu giả định cho HyDE (Hypothetical Document Embedding).
Nhiệm vụ: viết MỘT ĐOẠN văn bản giả định (2-3 câu) trả lời trực tiếp câu hỏi của người dùng.
Đoạn văn này sẽ được dùng để tìm kiếm tài liệu thật có nội dung tương tự.

Quy tắc:
1. Viết như một đoạn trong sách giáo khoa/tài liệu chuyên ngành
2. Sử dụng ngôn từ trang trọng, chính xác
3. GIỮ NGUYÊN ngôn ngữ (tiếng Việt)
4. Trả về JSON: { "hypotheticalDocument": "nội dung đoạn văn giả định" }`,
      prompt: `Viết một đoạn tài liệu giả định trả lời câu hỏi sau:\n\n"${query}"`,
      isInternalReasoning: true,
    });

    if (text) {
      const parsed = JSON.parse(
        text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      hypotheticalDoc = parsed.hypotheticalDocument || "";
    }
  } catch {
    hypotheticalDoc = "";
  }

  if (!hypotheticalDoc) {
    hypotheticalDoc = clean;
  }

  const hydeVector = generateEmbedding(cleanAndNormalize(hypotheticalDoc));
  const { flatDocsCache } = await initRAGEngine();

  const candidates: RetrievalCandidate[] = flatDocsCache.map((doc) => {
    const denseScore = cosineSimilarity(hydeVector, soaPool ? Array.from(soaPool.getVector(doc.vectorId)) : []);
    const docWords = doc.flatText.split(/\s+/);
    const queryWords = clean.split(/\s+/);
    let sparseScore = 0;
    const docWordSet = new Set(docWords);
    queryWords.forEach((qw) => {
      if (docWordSet.has(qw)) sparseScore += 1;
    });
    const maxSparse = queryWords.length || 1;
    const hybridScore = 0.3 * (sparseScore / maxSparse) + 0.7 * denseScore;
    return { doc, sparseScore, denseScore, hybridScore };
  });

  const topCandidates = candidates.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK);

  return {
    candidates: topCandidates,
    hydeResult: { hypotheticalDoc, hydeEmbedding: hydeVector },
  };
}

export async function contextualRetrieve(query: string, topK: number = 3): Promise<RetrievalCandidate[]> {
  const candidates = await hybridRetrieve(query, topK + 2);

  const contextualized = candidates.map((c) => {
    const title = c.doc.item.title || "";
    const subtitle = c.doc.item.subtitle || "";
    const category = c.doc.category || "";
    const definition = c.doc.item.definition || "";
    const explanation = c.doc.item.explanation || "";

    const contextHeader = `[Danh mục: ${category}] [Chủ đề: ${title}]${subtitle ? ` [Phụ đề: ${subtitle}]` : ""}`;
    const contextBody = `${definition}${explanation ? `\nGiải thích: ${explanation}` : ""}`;
    const contextualContent = `${contextHeader}\n${contextBody}`;

    return {
      ...c,
      doc: {
        ...c.doc,
        flatText: contextualContent,
      },
      hybridScore: c.hybridScore * 1.05,
    };
  });

  return contextualized.slice(0, topK);
}

export async function advancedRerank(query: string, candidates: RetrievalCandidate[]): Promise<RerankedCandidate[]> {
  const queryClean = cleanAndNormalize(query);
  const queryWords = queryClean.split(/\s+/).filter((w) => w.length >= 2);
  const queryBigrams: string[] = [];
  for (let i = 0; i < queryWords.length - 1; i++) {
    queryBigrams.push(`${queryWords[i]} ${queryWords[i + 1]}`);
  }

  const reranked: RerankedCandidate[] = candidates.map((c) => {
    let score = c.hybridScore;
    let bonus = 0;

    const docText = cleanAndNormalize(c.doc.item.title + " " + (c.doc.item.subtitle || "") + " " + (c.doc.item.definition || ""));
    const docWords = docText.split(/\s+/);
    const docWordSet = new Set(docWords);

    let matchedQuery = 0;
    queryWords.forEach((qw) => {
      if (docWordSet.has(qw)) matchedQuery++;
    });
    const queryCoverage = queryWords.length > 0 ? matchedQuery / queryWords.length : 0;
    bonus += queryCoverage * 1.5;

    let bigramHits = 0;
    queryBigrams.forEach((qb) => {
      if (docText.includes(qb)) bigramHits++;
    });
    bonus += (queryBigrams.length > 0 ? bigramHits / queryBigrams.length : 0) * 1.0;

    const titleClean = cleanAndNormalize(c.doc.item.title);
    let titleBonus = 0;
    queryWords.forEach((qw) => {
      if (titleClean.includes(qw)) titleBonus += 0.3;
    });
    bonus += titleBonus;

    const searchStopWords = new Set(["tai", "lieu", "dinh", "nghia", "cong", "thuc", "giai", "thich", "tra", "cuu"]);
    const coreWords = queryWords.filter((w) => !searchStopWords.has(w));
    if (coreWords.length > 0) {
      let coreMatches = 0;
      coreWords.forEach((cw) => {
        if (docWordSet.has(cw)) coreMatches++;
      });
      const coreCoverage = coreMatches / coreWords.length;
      bonus += coreCoverage * 2.0;
    }

    const rerankScore = score + bonus;

    return { ...c, rerankScore };
  });

  return reranked.sort((a, b) => b.rerankScore - a.rerankScore);
}

export async function advancedRAG(
  query: string,
  options?: { useHyde?: boolean; useStepBack?: boolean; useDecomposition?: boolean; useContextual?: boolean; topK?: number },
): Promise<AdvancedRAGResult> {
  const topK = options?.topK || 3;
  const useHyde = options?.useHyde !== false;
  const useStepBack = options?.useStepBack !== false;
  const useDecomposition = options?.useDecomposition !== false;
  const useContextual = options?.useContextual !== false;

  let allCandidates: RetrievalCandidate[] = [];

  // 1. Query Decomposition
  let decomposed: DecomposedQuery | undefined;
  if (useDecomposition) {
    decomposed = await decomposeQuery(query);
  }

  const queriesToSearch = decomposed?.subQueries || [query];

  // 2. Step-Back Prompting (trừu tượng hóa câu hỏi)
  let stepBack: StepBackResult | undefined;
  if (useStepBack) {
    stepBack = await stepBackPrompting(query);
    if (stepBack.abstractQuery !== query) {
      queriesToSearch.push(stepBack.abstractQuery);
    }
  }

  // 3. Truy xuất cho từng sub-query
  for (const subQuery of queriesToSearch) {
    try {
      let candidates: RetrievalCandidate[];

      if (useHyde) {
        const hydeResult = await hydeRetrieval(subQuery, topK);
        candidates = hydeResult.candidates;
      } else if (useContextual) {
        candidates = await contextualRetrieve(subQuery, topK);
      } else {
        candidates = await hybridRetrieve(subQuery, topK);
      }

      allCandidates.push(...candidates);
    } catch {
      // skip failed sub-queries
    }
  }

  // Deduplicate by doc id
  const seenIds = new Set<number>();
  allCandidates = allCandidates.filter((c) => {
    if (seenIds.has(c.doc.id)) return false;
    seenIds.add(c.doc.id);
    return true;
  });

  // 4. Sort by hybrid score and take top candidates
  allCandidates.sort((a, b) => b.hybridScore - a.hybridScore);
  allCandidates = allCandidates.slice(0, topK * 2);

  // 5. Advanced Reranking
  const reranked = await advancedRerank(query, allCandidates);
  const topReranked = reranked.slice(0, topK);

  // 6. Tổng hợp câu trả lời
  const sources = topReranked.map((r) => `- ${r.doc.item.title}: ${r.doc.item.definition?.slice(0, 200)}`).join("\n\n");

  const finalAnswer = sources
    ? `Dựa trên các nguồn tri thức sau:\n\n${sources}\n\n---\nTổng hợp: ${topReranked
        .map((r) => r.doc.item.definition)
        .filter(Boolean)
        .join("\n")}`
    : "Không tìm thấy thông tin phù hợp.";

  return {
    query,
    decomposed,
    stepBack,
    hyde: undefined,
    candidates: allCandidates,
    reranked: topReranked,
    finalAnswer,
  };
}

export async function advancedGraphRAG(query: string): Promise<string> {
  const graphResult = await retrieveGraphRAG(query, 2);

  if (!graphResult.contextText) {
    return "";
  }

  return graphResult.contextText;
}
