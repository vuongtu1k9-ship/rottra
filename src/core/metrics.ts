import { SEMANTIC_ANCHORS } from "~/core/nlp-cognitive/tokenizer";

// ── Text Normalization ────────────────────────────────────────

export const removeAccentsLower = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
};

export const sanitizeString = (str: string): string => {
  if (!str) return "";
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeObject(obj[key]);
    }
    return result;
  }
  return obj;
};

// ── Entropy & Confidence ──────────────────────────────────────

export const calculateEntropy = (str: string): number => {
  if (!str) return 0;
  const cleanText = str.replace(/[#*`>📊[\]]/g, "").trim();
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  const freqs: Record<string, number> = {};
  words.forEach((w) => (freqs[w] = (freqs[w] || 0) + 1));
  let entropy = 0;
  const len = words.length;
  Object.values(freqs).forEach((count) => {
    const p = count / len;
    entropy -= p * Math.log2(p);
  });
  return parseFloat(entropy.toFixed(2));
};

export const calculateConfidence = (intentKey: string, queryText: string): number => {
  const anchors = SEMANTIC_ANCHORS[intentKey] || [];
  if (anchors.length === 0) return 92.5; // Default high confidence if no anchors
  const matched = anchors.filter((kw: string) => {
    const removeAccentsLocal = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();
    return removeAccentsLocal(queryText).includes(removeAccentsLocal(kw));
  }).length;
  const base = 88.5 + (matched > 0 ? Math.min(matched * 3.5, 10) : 0);
  return parseFloat((base + (queryText.length % 10) / 10).toFixed(1));
};

export const cleanWordsLocal = (str: string): string[] => {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
};

export const compressScore = (score: number): number => {
  if (score > 9.9) return 9.9;
  return parseFloat(score.toFixed(2));
};
