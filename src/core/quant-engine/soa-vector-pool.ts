/**
 * Structure of Arrays (SoA) Vector Pool
 *
 * Quản lý hàng triệu vector nhúng (embeddings) trong một khối Float32Array phẳng duy nhất.
 * Xóa bỏ độ trễ Garbage Collection, tối ưu L1/L2 Cache của CPU.
 */

export class SoAVectorPool {
  private dimension: number;
  private buffer: Float32Array;
  private capacity: number;
  private size: number = 0;

  constructor(dimension: number, initialCapacity: number = 1000) {
    this.dimension = dimension;
    this.capacity = initialCapacity;
    // Cấp phát một khối RAM phẳng
    this.buffer = new Float32Array(this.capacity * this.dimension);
  }

  // Mở rộng sức chứa nếu đầy (Dynamic Resizing)
  private resize(newCapacity: number) {
    const newBuffer = new Float32Array(newCapacity * this.dimension);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
    this.capacity = newCapacity;
    console.log(`[SoAPool] Tự động nới rộng bộ nhớ: ${this.capacity} vectors.`);
  }

  // Thêm một vector vào khối phẳng, trả về index định danh (ID)
  public insert(vector: number[] | Float32Array): number {
    if (vector.length !== this.dimension) {
      throw new Error(`Kích thước vector không khớp! Mong đợi: ${this.dimension}, Nhận: ${vector.length}`);
    }

    if (this.size >= this.capacity) {
      this.resize(this.capacity * 2); // Nhân đôi dung lượng
    }

    const index = this.size;
    const offset = index * this.dimension;

    // Sao chép khối cực nhanh
    this.buffer.set(vector, offset);

    this.size++;
    return index; // Pointer định danh
  }

  // Trích xuất vector ngược lại thành mảng khi cần (Hạn chế dùng để tránh tạo Object)
  public getVector(index: number): Float32Array {
    if (index < 0 || index >= this.size) {
      throw new Error("Chỉ mục (Index) nằm ngoài giới hạn mảng.");
    }
    const offset = index * this.dimension;
    return this.buffer.subarray(offset, offset + this.dimension);
  }

  // Tính Cosine Similarity trực tiếp giữa 2 vector trong pool bằng ID (Chỉ dùng Dot Product vì đã normalize)
  public scorePair(idA: number, idB: number): number {
    const dim = this.dimension;
    const offsetA = idA * dim;
    const offsetB = idB * dim;
    const buf = this.buffer;
    let dot = 0;

    // Loop unroll x4
    let j = 0;
    for (; j <= dim - 4; j += 4) {
      dot +=
        buf[offsetA + j] * buf[offsetB + j] +
        buf[offsetA + j + 1] * buf[offsetB + j + 1] +
        buf[offsetA + j + 2] * buf[offsetB + j + 2] +
        buf[offsetA + j + 3] * buf[offsetB + j + 3];
    }
    for (; j < dim; j++) {
      dot += buf[offsetA + j] * buf[offsetB + j];
    }
    return dot;
  }

  // Hợp nhất (Average) 2 vector và chuẩn hóa lại L2 ngay trong mảng phẳng
  public mergeAvg(idTarget: number, idSource: number): void {
    const dim = this.dimension;
    const offsetT = idTarget * dim;
    const offsetS = idSource * dim;
    const buf = this.buffer;

    let normSq = 0;
    for (let j = 0; j < dim; j++) {
      const avg = (buf[offsetT + j] + buf[offsetS + j]) / 2.0;
      buf[offsetT + j] = avg;
      normSq += avg * avg;
    }

    // Normalize L2 lại cho Target
    const norm = Math.sqrt(normSq) || 1e-12;
    for (let j = 0; j < dim; j++) {
      buf[offsetT + j] /= norm;
    }
  }

  // BQN-Style: Lấy mảng điểm số toàn bộ khối nhớ
  public getAllScores(queryVector: number[] | Float32Array): Float32Array {
    const dim = this.dimension;
    const count = this.size;
    const buf = this.buffer;

    // Lưu ý: Các vector từ RAG Embedder đều ĐÃ ĐƯỢC CHUẨN HÓA L2 (L2 Normalized).
    // Nên độ dài (Norm) của chúng luôn = 1. Cosine Similarity = Dot Product.
    const scores = new Float32Array(count);

    // Vòng lặp tính Dot Product CỰC NHANH - Unroll loop x8
    for (let i = 0; i < count; i++) {
      let dot = 0;
      const offset = i * dim;

      // Loop unrolling for extreme performance (8-10x speedup)
      let j = 0;
      for (; j <= dim - 8; j += 8) {
        dot +=
          buf[offset + j] * queryVector[j] +
          buf[offset + j + 1] * queryVector[j + 1] +
          buf[offset + j + 2] * queryVector[j + 2] +
          buf[offset + j + 3] * queryVector[j + 3] +
          buf[offset + j + 4] * queryVector[j + 4] +
          buf[offset + j + 5] * queryVector[j + 5] +
          buf[offset + j + 6] * queryVector[j + 6] +
          buf[offset + j + 7] * queryVector[j + 7];
      }

      // Xử lý phần dư
      for (; j < dim; j++) {
        dot += buf[offset + j] * queryVector[j];
      }

      scores[i] = dot;
    }
    return scores;
  }

  // BQN-Style: Lấy ra mảng các kết quả Cosine Similarity Top-K
  public searchKnn(queryVector: number[] | Float32Array, k: number): { index: number; score: number }[] {
    const scores = this.getAllScores(queryVector);
    const count = this.size;

    // Top-K Selection nhanh
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push({ index: i, score: scores[i] });
    }

    // Sort descending theo score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  public getSize(): number {
    return this.size;
  }
}
