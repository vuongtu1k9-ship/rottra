/**
 * ML Pipeline — Feature Engineering
 * TF-IDF, Bag-of-Words, numeric normalization.
 * Zero external dependencies.
 */

export interface FeatureConfig {
  method: "tfidf" | "bow" | "normalized";
  maxFeatures: number;
  vocabulary: string[];
}

/** Tokenize text: lowercase, split on non-alphanumeric, remove short words. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Build vocabulary from corpus, sorted by frequency descending, capped at maxFeatures. */
export function buildVocabulary(corpus: string[], maxFeatures: number): string[] {
  const freq = new Map<string, number>();
  for (const doc of corpus) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures)
    .map(([w]) => w);
}

/** Bag-of-Words: binary or count vectorization. */
export function bowVectorize(tokens: string[], vocab: string[]): number[] {
  const vocabIndex = new Map(vocab.map((w, i) => [w, i]));
  const vec = new Array(vocab.length).fill(0);
  for (const t of tokens) {
    const idx = vocabIndex.get(t);
    if (idx !== undefined) vec[idx] = 1;
  }
  return vec;
}

/** TF-IDF vectorization. */
export function tfidfVectorize(corpus: string[], vocab: string[]): number[][] {
  const n = corpus.length;
  const df = new Array(vocab.length).fill(0);
  const tokenized = corpus.map(tokenize);

  // Document frequency
  for (const doc of tokenized) {
    const seen = new Set(doc);
    for (const t of seen) {
      const idx = vocab.indexOf(t);
      if (idx >= 0) df[idx]++;
    }
  }

  // TF-IDF vectors
  return tokenized.map((doc) => {
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) || 0) + 1);
    const maxTf = Math.max(1, ...tf.values());

    return vocab.map((w, i) => {
      const termFreq = (tf.get(w) || 0) / maxTf;
      const invDocFreq = Math.log((n + 1) / (df[i] + 1)) + 1;
      return termFreq * invDocFreq;
    });
  });
}

/** Normalize numeric features to [0, 1] range. */
export function normalizeFeatures(data: number[][]): { normalized: number[][]; mins: number[]; maxs: number[] } {
  const cols = data[0].length;
  const mins = new Array(cols).fill(Infinity);
  const maxs = new Array(cols).fill(-Infinity);

  for (const row of data) {
    for (let j = 0; j < cols; j++) {
      if (row[j] < mins[j]) mins[j] = row[j];
      if (row[j] > maxs[j]) maxs[j] = row[j];
    }
  }

  const normalized = data.map((row) =>
    row.map((v, j) => {
      const range = maxs[j] - mins[j];
      return range > 0 ? (v - mins[j]) / range : 0;
    }),
  );

  return { normalized, mins, maxs };
}

/** Apply saved normalization to new data. */
export function applyNormalization(data: number[][], mins: number[], maxs: number[]): number[][] {
  return data.map((row) =>
    row.map((v, j) => {
      const range = maxs[j] - mins[j];
      return range > 0 ? (v - mins[j]) / range : 0;
    }),
  );
}

/** Extract features from text corpus using specified method. */
export function extractFeatures(
  corpus: string[],
  method: "tfidf" | "bow",
  maxFeatures: number,
): { features: number[][]; config: FeatureConfig } {
  const vocab = buildVocabulary(corpus, maxFeatures);
  const features = method === "tfidf" ? tfidfVectorize(corpus, vocab) : corpus.map((doc) => bowVectorize(tokenize(doc), vocab));
  return { features, config: { method, maxFeatures, vocabulary: vocab } };
}

/** Extract features from raw numeric data. */
export function extractNumericFeatures(data: number[][]): { features: number[][]; config: FeatureConfig } {
  const { normalized } = normalizeFeatures(data);
  return { features: normalized, config: { method: "normalized", maxFeatures: data[0]?.length || 0, vocabulary: [] } };
}
