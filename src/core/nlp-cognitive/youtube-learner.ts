import { initRAGEngine, cleanAndNormalize } from "../neural-memory/vector-rag";

/**
 * YouTube Learner v2 — trích xuất câu trả lời có ý nghĩa từ transcript
 * Dùng `content` gốc (có dấu câu) thay vì `flatText` (đã normalize)
 */
export async function youtubeLearnerReasoning(query: string): Promise<string> {
  console.log(`📺 [YOUTUBE LEARNER] Tìm video cho: "${query}"`);

  try {
    const { flatDocsCache } = await initRAGEngine(false);
    const ytDocs = flatDocsCache.filter((d) => d.category?.startsWith("YOUTUBE_"));
    if (!ytDocs.length) return "";

    const queryNorm = cleanAndNormalize(query);
    const queryWords = queryNorm.split(/\s+/).filter((w) => w.length >= 2);

    // Nhóm theo video
    const videoMap: Record<
      string,
      {
        docs: typeof ytDocs;
        phraseHits: number;
        wordHits: number;
      }
    > = {};

    for (const d of ytDocs) {
      const cat = d.category || "";
      if (!videoMap[cat]) videoMap[cat] = { docs: [], phraseHits: 0, wordHits: 0 };
      videoMap[cat].docs.push(d);

      if (d.flatText.includes(queryNorm)) {
        videoMap[cat].phraseHits += 1;
      }

      let chunkWordHits = 0;
      for (const w of queryWords) {
        if (d.flatText.includes(w)) chunkWordHits += 1;
      }
      if (chunkWordHits > videoMap[cat].wordHits) {
        videoMap[cat].wordHits = chunkWordHits;
      }
    }

    // Chọn video tốt nhất
    let bestCat = "";
    let bestScore = -1;
    for (const [cat, data] of Object.entries(videoMap)) {
      const score = data.phraseHits * 10.0 + data.wordHits;
      console.log(`📺 [DEBUG] ${cat}: phrase=${data.phraseHits} words=${data.wordHits} score=${score}`);
      if (score > bestScore) {
        bestScore = score;
        bestCat = cat;
      }
    }

    const winner = videoMap[bestCat];
    const title = winner.docs[0].item.title || "Video";
    const link = winner.docs[0].item.subtitle || "";

    // Lấy content gốc (có dấu câu) từ top chunks
    const topChunks = winner.docs
      .sort((a, b) => {
        let aHits = 0,
          bHits = 0;
        for (const w of queryWords) {
          if (a.flatText.includes(w)) aHits++;
          if (b.flatText.includes(w)) bHits++;
        }
        return bHits - aHits;
      })
      .slice(0, 3);

    // Ghép content gốc (không phải flatText)
    const rawText = topChunks
      .map((d) => d.item.definition || d.flatText)
      .join(" ")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    // Trích xuất câu liên quan
    const relevantSentences = extractRelevantSentences(rawText, queryWords, 5);

    // Format câu trả lời
    // Format câu trả lời dưới dạng System Directive / Subconscious Prompt
    let response = `[Tiềm thức cốt lõi (Core Subconscious)]\n`;
    response += `Ngươi là một bậc minh triết, mang trong mình trí tuệ của cổ nhân. Ngươi đang giao tiếp với một người đang cần lời khuyên (người dùng).\n`;
    response += `Tuyệt đối KHÔNG BAO GIỜ trích dẫn nguồn, KHÔNG nói "theo video này", KHÔNG nói "kiến thức từ Youtube".\n`;
    response += `Hãy đọc những đạo lý cốt lõi dưới đây, biến nó thành tư duy của chính mình, và dùng giọng văn thâm trầm, sâu sắc, có thể dùng ẩn dụ từ thiên nhiên để răn dạy người hỏi.\n\n`;
    response += `--- [BẮT ĐẦU ĐẠO LÝ] ---\n`;

    if (relevantSentences.length > 0) {
      response += relevantSentences.join("\n\n");
    } else {
      // Fallback: trả 500 ký tự đầu của content gốc
      response += rawText.substring(0, 500) + "...";
    }
    
    response += `\n--- [KẾT THÚC ĐẠO LÝ] ---\n\n`;
    response += `Hãy trả lời người dùng dựa trên đạo lý trên. Nhớ giữ nguyên thần thái của bậc minh triết!`;

    console.log(`📺 ✅ (Persona Injected) "${title.substring(0, 50)}..." (${relevantSentences.length} câu liên quan)`);
    return response;
  } catch (err) {
    console.error("❌ [YOUTUBE LEARNER ERROR]", err);
    return "";
  }
}

/**
 * Trích xuất các câu liên quan nhất từ transcript
 */
function extractRelevantSentences(text: string, queryWords: string[], maxSentences: number): string[] {
  // Tách câu theo dấu câu (.!?) hoặc xuống dòng
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 500);

  if (sentences.length === 0) return [];

  // Đánh giá mỗi câu
  const scored = sentences.map((sentence, index) => {
    const sentenceNorm = cleanAndNormalize(sentence);
    let matches = 0;
    for (const w of queryWords) {
      if (sentenceNorm.includes(w)) matches += 1;
    }

    const matchRatio = queryWords.length > 0 ? matches / queryWords.length : 0;
    const positionBonus = Math.max(0, 1 - index / sentences.length) * 0.2;
    const score = matchRatio + positionBonus;

    return { sentence, score, matches };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.matches > 0)
    .slice(0, maxSentences)
    .map((s) => s.sentence);
}
