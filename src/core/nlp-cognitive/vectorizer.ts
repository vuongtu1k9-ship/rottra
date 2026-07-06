/**
 * Bộ xử lý ngôn ngữ tự nhiên (NLP Vectorizer) - Thuần TypeScript
 * Chuyển đổi văn bản thành các vector số học (Embeddings) để đưa vào mạng Nơ-ron.
 */

export class TextVectorizer {
  private vocabulary: Map<string, number>;
  private vocabSize: number;

  constructor() {
    this.vocabulary = new Map();
    this.vocabSize = 0;
  }

  /**
   * Chuẩn hóa văn bản: Chuyển chữ thường, xóa dấu câu
   */
  private normalize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9\s]/g, "") // Xóa ký tự đặc biệt
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Huấn luyện từ vựng (Vocabulary Builder)
   * Học các từ vựng mới từ tập dữ liệu huấn luyện
   */
  public fit(corpus: string[]) {
    const uniqueWords = new Set<string>();
    for (const doc of corpus) {
      const words = this.normalize(doc);
      for (const word of words) {
        uniqueWords.add(word);
      }
    }

    let index = 0;
    for (const word of uniqueWords) {
      if (!this.vocabulary.has(word)) {
        this.vocabulary.set(word, index++);
      }
    }
    this.vocabSize = this.vocabulary.size;
    console.log(`[Vectorizer] Đã học được ${this.vocabSize} từ vựng duy nhất.`);
  }

  /**
   * Chuyển văn bản thành Vector (Bag-of-Words - Tần suất xuất hiện)
   */
  public vectorize(text: string): number[] {
    if (this.vocabSize === 0) throw new Error("Vectorizer chưa được fit(corpus)!");

    const vector = new Array(this.vocabSize).fill(0);
    const words = this.normalize(text);

    for (const word of words) {
      const index = this.vocabulary.get(word);
      if (index !== undefined) {
        // Cộng 1 cho mỗi lần từ xuất hiện
        vector[index] += 1;
      }
    }

    // L2 Normalization (Chuẩn hóa độ dài vector về 1) để tránh tràn số học
    let sumSquares = vector.reduce((acc, val) => acc + val * val, 0);
    if (sumSquares > 0) {
      const magnitude = Math.sqrt(sumSquares);
      return vector.map((val) => val / magnitude);
    }

    return vector;
  }

  public getVocabSize(): number {
    return this.vocabSize;
  }
}
