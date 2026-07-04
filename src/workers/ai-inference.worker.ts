const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const { type, data, id } = e.data;

  try {
    if (type === "COMPUTE_SIMILARITY") {
      const { query, cacheKeys, topK = 3 } = data;
      if (!query || !Array.isArray(cacheKeys)) {
        ctx.postMessage({ id, type: "ERROR", data: "Missing query or cacheKeys" });
        return;
      }
      const results = cacheKeys.map((key: string) => {
        const sim = calculateJaccard(query, key);
        return { key, similarity: sim };
      });
      results.sort((a: any, b: any) => b.similarity - a.similarity);
      ctx.postMessage({ id, type: "SIMILARITY_RESULT", data: results.slice(0, topK) });
    } else if (type === "COMPUTE_TFIDF_SCORE") {
      const { queryWords, docWords, queryBigrams, docFlat } = data;
      if (!queryWords || !docWords) {
        ctx.postMessage({ id, type: "ERROR", data: "Missing queryWords or docWords" });
        return;
      }
      const score = computeTfIdfScore(queryWords, docWords, queryBigrams || [], docFlat || "");
      ctx.postMessage({ id, type: "TFIDF_RESULT", data: { score } });
    } else {
      ctx.postMessage({ id, type: "ERROR", data: `Unknown message type: ${type}` });
    }
  } catch (err) {
    ctx.postMessage({ id, type: "ERROR", data: String(err) });
  }
};

function calculateJaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function computeTfIdfScore(queryWords: string[], docWords: string[], queryBigrams: string[], docFlat: string): number {
  let sparseScore = 0;
  for (const qw of queryWords) {
    if (docFlat.includes(qw)) sparseScore += 1;
  }
  for (const bg of queryBigrams) {
    if (docFlat.includes(bg)) sparseScore += 0.8;
  }
  const maxPossible = queryWords.length + queryBigrams.length * 0.8;
  return maxPossible > 0 ? sparseScore / maxPossible : 0;
}
