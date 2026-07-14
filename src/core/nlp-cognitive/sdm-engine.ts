import { Deterministic, Secure } from "~/shared/utils/rng";
/**
 * 🧠 SPARSE DISTRIBUTED MEMORY (SDM) ENGINE
 *
 * Kiến trúc dựa trên mô hình SDM của Pentti Kanerva (1988):
 * - Mỗi input được mã hóa thành binary address vector
 * - Nhiều "hard locations" được kích hoạt đồng thời (sparse activation)
 * - Ghi nhớ (write) và gọi lại (recall) qua weighted sum
 * - Auto-associative recall: partial input → complete output
 *
 * Ưu điểm so với Transformer:
 * - O(n) thay vì O(n²) cho attention
 * - Nhỏ gọn (~10MB cho 100K patterns)
 * - Tự nhiên hỗ trợ partial match và generalization
 */

const VECTOR_DIM = 2048; // Chiều vector binary (phân phối tốt cho ~100K patterns)
const NUM_HARD_LOCATIONS = 128; // Số hard locations mỗi input kích hoạt
const WRITE_AMPLITUDE = 0.005; // Tốc độ học khi ghi nhớ (giảm để không blur)
const READ_THRESHOLD = 0.15; // Ngưỡng similarity khi recall

interface Pattern {
  id: string;
  address: Uint8Array; // Binary hash vector
  data: Float32Array; // Dense vector chứa thông tin
  metadata: {
    utterance: string;
    response: string;
    intent: string;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
  };
}

interface HardLocation {
  address: Uint8Array;
  weights: Float32Array; // Accumulated data from writes
  accessCount: number;
}

/**
 * Tạo binary hash từ text input
 * Dùng double hashing để tạo address vector
 */
function textToAddress(text: string): Uint8Array {
  const address = new Uint8Array(VECTOR_DIM);

  // Hash 1: DJB2 variant
  let hash1 = 5381;
  for (let i = 0; i < text.length; i++) {
    hash1 = ((hash1 << 5) + hash1 + text.charCodeAt(i)) & 0xffffffff;
  }

  // Hash 2: FNV-1a
  let hash2 = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash2 ^= text.charCodeAt(i);
    hash2 = (hash2 * 16777619) & 0xffffffff;
  }

  // Generate bits using linear congruential generator
  let seed = hash1 ^ (hash2 >>> 16);
  for (let i = 0; i < VECTOR_DIM; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    address[i] = seed & 0x80000000 ? 1 : 0; // MSB as random bit
  }

  return address;
}

/**
 * Tính Hamming distance giữa hai binary vectors
 */
function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    dist += a[i] !== b[i] ? 1 : 0;
  }
  return dist / a.length; // Normalized [0, 1]
}

/**
 * Tính cosine similarity giữa hai dense vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/**
 * Text → Dense vector (feature hashing với multiple hash functions)
 * Dùng feature hashing để tạo sparse, discriminative vectors
 */
function textToDenseVector(text: string): Float32Array {
  const vector = new Float32Array(VECTOR_DIM);
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Multiple hash seeds for better discrimination
  const HASH_SEEDS = [2654435761, 340573321, 2246822519, 3266489917, 668265263];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Hash 1: character-level
    let hash1 = 0;
    for (let j = 0; j < word.length; j++) {
      hash1 = ((hash1 << 5) + hash1 + word.charCodeAt(j)) & 0x7fffffff;
    }

    // Hash 2: word-level with seed
    let hash2 = HASH_SEEDS[i % HASH_SEEDS.length];
    for (let j = 0; j < word.length; j++) {
      hash2 = ((hash2 << 7) ^ (word.charCodeAt(j) * HASH_SEEDS[(i + j) % 5])) & 0x7fffffff;
    }

    // Hash 3: bigram-level
    let hash3 = 0;
    for (let j = 0; j < word.length - 1; j++) {
      hash3 = ((hash3 << 11) + (word.charCodeAt(j) << 8) + word.charCodeAt(j + 1)) & 0x7fffffff;
    }

    // Positional weight: earlier words less, later words more
    const posWeight = 0.5 + (i / Math.max(words.length, 1)) * 0.5;
    // Word length bonus
    const lenBonus = word.length > 4 ? 1.3 : word.length > 2 ? 1.0 : 0.7;

    const w = posWeight * lenBonus;

    // Set multiple positions per word for better discrimination
    vector[hash1 % VECTOR_DIM] += w;
    vector[(hash2 >> 3) % VECTOR_DIM] += w * 0.7;
    vector[(hash3 >> 5) % VECTOR_DIM] += w * 0.5;

    // Bigram features between consecutive words
    if (i > 0) {
      let biHash = 0;
      const prev = words[i - 1];
      const bigram = prev + "_" + word;
      for (let j = 0; j < bigram.length; j++) {
        biHash = ((biHash << 5) + biHash + bigram.charCodeAt(j)) & 0x7fffffff;
      }
      vector[biHash % VECTOR_DIM] += w * 0.8;
    }
  }

  // L1 normalize (preserves sparsity better than L2 for SDM)
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += Math.abs(vector[i]);
  }
  norm = norm + 1e-10;
  for (let i = 0; i < VECTOR_DIM; i++) {
    vector[i] /= norm;
  }

  return vector;
}

/**
 * SDM Engine chính
 */
export class SDMEngine {
  private hardLocations: HardLocation[];
  private patterns: Map<string, Pattern> = new Map();
  private initialized = false;

  constructor(numLocations: number = NUM_HARD_LOCATIONS) {
    // Khởi tạo hard locations với random addresses
    this.hardLocations = [];
    for (let i = 0; i < numLocations; i++) {
      const address = new Uint8Array(VECTOR_DIM);
      for (let j = 0; j < VECTOR_DIM; j++) {
        address[j] = Deterministic.random() < 0.5 ? 1 : 0;
      }
      this.hardLocations.push({
        address,
        weights: new Float32Array(VECTOR_DIM),
        accessCount: 0,
      });
    }
  }

  /**
   * Tìm K hard locations gần nhất với input address
   */
  private findNearbyLocations(address: Uint8Array, k: number): number[] {
    const distances: Array<{ index: number; dist: number }> = [];

    for (let i = 0; i < this.hardLocations.length; i++) {
      const dist = hammingDistance(address, this.hardLocations[i].address);
      distances.push({ index: i, dist });
    }

    // Sort by distance ascending, take top k
    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, k).map((d) => d.index);
  }

  /**
   * Ghi nhớ pattern mới vào SDM
   * Mỗi pattern được ghi vào K hard locations gần nhất
   */
  write(pattern: Pattern): void {
    const nearbyIndices = this.findNearbyLocations(pattern.address, NUM_HARD_LOCATIONS);

    for (const idx of nearbyIndices) {
      const hl = this.hardLocations[idx];
      hl.accessCount++;

      // Accumulate: w += amplitude * data (clamped to [-1, 1])
      for (let i = 0; i < VECTOR_DIM; i++) {
        hl.weights[i] += WRITE_AMPLITUDE * pattern.data[i];
        hl.weights[i] = Math.max(-1, Math.min(1, hl.weights[i]));
      }
    }

    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Recall: Gọi lại từ partial/noisy input
   * Returns top-k patterns gần nhất
   */
  recall(queryVector: Float32Array, k: number = 5): Array<{ pattern: Pattern; score: number }> {
    // Find nearby hard locations using address
    const queryAddress = new Uint8Array(VECTOR_DIM);
    for (let i = 0; i < VECTOR_DIM; i++) {
      queryAddress[i] = queryVector[i] > 0.1 ? 1 : 0;
    }

    const nearbyIndices = this.findNearbyLocations(queryAddress, Math.min(NUM_HARD_LOCATIONS, this.hardLocations.length));

    // Accumulate weights from nearby locations
    const outputVector = new Float32Array(VECTOR_DIM);
    let totalWeight = 0;

    for (const idx of nearbyIndices) {
      const hl = this.hardLocations[idx];
      const dist = hammingDistance(queryAddress, hl.address);
      const proximity = Math.max(0, 1.0 - dist * 2); // Linear decay instead of inverse
      if (proximity <= 0) continue;
      totalWeight += proximity;

      for (let i = 0; i < VECTOR_DIM; i++) {
        outputVector[i] += hl.weights[i] * proximity;
      }
    }

    if (totalWeight > 0) {
      for (let i = 0; i < VECTOR_DIM; i++) {
        outputVector[i] /= totalWeight;
      }
    }

    // Score against all patterns — but cap at reasonable limit for performance
    const results: Array<{ pattern: Pattern; score: number }> = [];
    let checked = 0;
    for (const [_, pattern] of this.patterns) {
      if (checked++ > 200) break; // Cap for speed
      const score = cosineSimilarity(queryVector, pattern.data);
      if (score >= READ_THRESHOLD) {
        results.push({ pattern, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Associate: Tạo liên kết giữa input pattern và output pattern
   * Tương tự auto-associative memory
   */
  associate(inputId: string, outputId: string): void {
    const input = this.patterns.get(inputId);
    const output = this.patterns.get(outputId);
    if (!input || !output) return;

    const nearbyIndices = this.findNearbyLocations(input.address, NUM_HARD_LOCATIONS);
    for (const idx of nearbyIndices) {
      const hl = this.hardLocations[idx];
      for (let i = 0; i < VECTOR_DIM; i++) {
        hl.weights[i] += WRITE_AMPLITUDE * output.data[i] * 0.5;
        hl.weights[i] = Math.max(-1, Math.min(1, hl.weights[i]));
      }
    }
  }

  /**
   * Generalize: Từ 2 patterns tương tự, tạo pattern mới
   */
  generalize(pattern1Id: string, pattern2Id: string): Float32Array | null {
    const p1 = this.patterns.get(pattern1Id);
    const p2 = this.patterns.get(pattern2Id);
    if (!p1 || !p2) return null;

    // Interpolation: average of two vectors
    const result = new Float32Array(VECTOR_DIM);
    for (let i = 0; i < VECTOR_DIM; i++) {
      result[i] = (p1.data[i] + p2.data[i]) / 2;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < VECTOR_DIM; i++) {
      norm += result[i] * result[i];
    }
    norm = Math.sqrt(norm) + 1e-10;
    for (let i = 0; i < VECTOR_DIM; i++) {
      result[i] /= norm;
    }

    return result;
  }

  /**
   * Thêm pattern mới từ text
   */
  addPattern(utterance: string, response: string, intent: string): Pattern {
    const id = `pat_${Date.now()}_${Secure.uuid().substr(2, 6)}`;
    const address = textToAddress(utterance);
    const data = textToDenseVector(utterance);

    const pattern: Pattern = {
      id,
      address,
      data,
      metadata: {
        utterance,
        response,
        intent,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
      },
    };

    this.write(pattern);
    return pattern;
  }

  /**
   * Tìm pattern tốt nhất cho query
   */
  findBestMatch(query: string): { pattern: Pattern; score: number } | null {
    const queryVector = textToDenseVector(query);
    const results = this.recall(queryVector, 1);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Thống kê
   */
  getStats() {
    return {
      totalPatterns: this.patterns.size,
      totalHardLocations: this.hardLocations.length,
      avgAccessCount: this.hardLocations.reduce((s, h) => s + h.accessCount, 0) / this.hardLocations.length,
    };
  }

  /**
   * Export/Import cho persistence
   */
  export(): object {
    return {
      hardLocations: this.hardLocations.map((hl) => ({
        address: Array.from(hl.address),
        weights: Array.from(hl.weights),
        accessCount: hl.accessCount,
      })),
      patterns: Array.from(this.patterns.values()).map((p) => ({
        ...p,
        address: Array.from(p.address),
        data: Array.from(p.data),
      })),
    };
  }

  import(data: any): void {
    if (data.hardLocations) {
      this.hardLocations = data.hardLocations.map((hl: any) => ({
        address: new Uint8Array(hl.address),
        weights: new Float32Array(hl.weights),
        accessCount: hl.accessCount,
      }));
    }
    if (data.patterns) {
      for (const p of data.patterns) {
        this.patterns.set(p.id, {
          ...p,
          address: new Uint8Array(p.address),
          data: new Float32Array(p.data),
        });
      }
    }
  }
}
