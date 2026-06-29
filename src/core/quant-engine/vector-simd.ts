/**
 * Zero-Allocation Vector Mathematics Library for Rottra
 * Tránh cấp phát Object mới trong các vòng lặp tần số cao để loại bỏ Garbage Collection latency.
 * Tất cả các phép toán viết đè trực tiếp vào tham số đầu ra "out".
 */

export function vecAdd(out: Float32Array, a: Float32Array, b: Float32Array): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    out[i] = a[i] + b[i];
  }
}

export function vecScale(out: Float32Array, a: Float32Array, scalar: number): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    out[i] = a[i] * scalar;
  }
}

export function vecDot(a: Float32Array, b: Float32Array): number {
  const len = a.length;
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function vecNorm(a: Float32Array): number {
  return Math.sqrt(vecDot(a, a));
}

export function cosineSimilarityZeroAlloc(a: Float32Array, b: Float32Array, isNormalized = true): number {
  if (isNormalized) {
    return vecDot(a, b);
  }
  const dot = vecDot(a, b);
  const normA = vecNorm(a);
  const normB = vecNorm(b);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}
