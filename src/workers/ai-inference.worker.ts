const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const { type, data, id } = e.data;

  if (type === "COMPUTE_SIMILARITY") {
    // Heavy string distance / similarity calculation matching
    const { query, cacheKeys } = data;
    const results = cacheKeys.map((key: string) => {
      // Simulate simple distance matching
      const sim = calculateJaccard(query, key);
      return { key, similarity: sim };
    });

    results.sort((a: any, b: any) => b.similarity - a.similarity);
    ctx.postMessage({ id, type: "SIMILARITY_RESULT", data: results[0] });
  }
};

function calculateJaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
