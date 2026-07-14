// Stub implementation for vietnamese-fuzzy

export function fuzzyMatchScore(a: string, b: string): number {
  return a === b ? 1.0 : 0.5;
}

export function compressQueryByPerplexity(query: string): string {
  return query;
}

export function tokenizeAndFilter(query: string): string[] {
  return query.trim().split(/\s+/);
}
