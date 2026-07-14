import { Deterministic } from "~/shared/utils/rng";
/**
 * Multi-Layer Perceptron (MLP) Neural Network - Thuần TypeScript
 * Tự xây dựng từ đầu (From Scratch), lấy cảm hứng từ Microsoft AI-For-Beginners.
 * Hỗ trợ: ReLU, Softmax, Cross-Entropy Loss, Backpropagation, Gradient Descent.
 */

// --- HÀM TOÁN HỌC & MA TRẬN CƠ BẢN ---
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const sigmoidDerivative = (x: number) => x * (1 - x); // x là output của sigmoid

export const relu = (x: number) => Math.max(0, x);
export const reluDerivative = (x: number) => (x > 0 ? 1 : 0);

// Khởi tạo ma trận ngẫu nhiên (Xavier/Glorot Initialization)
export function randomMatrix(rows: number, cols: number): number[][] {
  const limit = Math.sqrt(6 / (rows + cols));
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Deterministic.random() * 2 - 1) * limit));
}

// Khởi tạo vector ngẫu nhiên
export function randomVector(size: number): number[] {
  const limit = Math.sqrt(6 / size);
  return Array.from({ length: size }, () => (Deterministic.random() * 2 - 1) * limit);
}

// Nhân ma trận với vector (Matrix-Vector dot product)
export function dotProduct(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, val, j) => sum + val * vector[j], 0));
}

// Softmax function để chuyển đổi vector output thành xác suất (probabilities)
export function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max)); // Trừ max để tránh tràn số (Numerical Stability)
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sumExps);
}

// --- KIẾN TRÚC MẠNG NƠ-RON (MLP) ---
export class MLPNetwork {
  private weightsIH: number[][]; // Weights Input -> Hidden
  private weightsHO: number[][]; // Weights Hidden -> Output
  private biasH: number[]; // Bias Hidden Layer
  private biasO: number[]; // Bias Output Layer
  private learningRate: number;

  constructor(
    public inputNodes: number,
    public hiddenNodes: number,
    public outputNodes: number,
    learningRate: number = 0.05,
  ) {
    this.weightsIH = randomMatrix(hiddenNodes, inputNodes);
    this.weightsHO = randomMatrix(outputNodes, hiddenNodes);
    this.biasH = randomVector(hiddenNodes);
    this.biasO = randomVector(outputNodes);
    this.learningRate = learningRate;
  }

  /**
   * Lan truyền tiến (Forward Propagation)
   * Trả về kết quả dự đoán (xác suất các class)
   */
  public predict(inputs: number[]): number[] {
    // 1. Input -> Hidden
    let hidden = dotProduct(this.weightsIH, inputs);
    hidden = hidden.map((val, i) => relu(val + this.biasH[i]));

    // 2. Hidden -> Output
    let outputs = dotProduct(this.weightsHO, hidden);
    outputs = outputs.map((val, i) => val + this.biasO[i]);

    // 3. Áp dụng Softmax để lấy xác suất
    return softmax(outputs);
  }

  /**
   * Huấn luyện 1 mẫu dữ liệu bằng Lan truyền ngược (Backpropagation)
   */
  public train(inputs: number[], targetOutputs: number[]) {
    // --- FORWARD PASS ---
    let hidden = dotProduct(this.weightsIH, inputs);
    let hiddenActivated = hidden.map((val, i) => relu(val + this.biasH[i]));

    let outputs = dotProduct(this.weightsHO, hiddenActivated);
    outputs = outputs.map((val, i) => val + this.biasO[i]);
    let finalOutputs = softmax(outputs);

    // --- BACKWARD PASS (Tính Lỗi) ---
    // Lỗi của Output (Sử dụng Cross-Entropy derivative phối hợp với Softmax: Output - Target)
    let outputErrors = finalOutputs.map((out, i) => out - targetOutputs[i]);

    // Lỗi của Hidden
    let hiddenErrors = new Array(this.hiddenNodes).fill(0);
    for (let i = 0; i < this.hiddenNodes; i++) {
      let error = 0;
      for (let j = 0; j < this.outputNodes; j++) {
        error += outputErrors[j] * this.weightsHO[j][i];
      }
      hiddenErrors[i] = error;
    }

    // --- GRADIENT DESCENT (Cập nhật Trọng số & Bias) ---
    // Cập nhật Weights & Bias cho Hidden -> Output
    for (let i = 0; i < this.outputNodes; i++) {
      const gradient = outputErrors[i] * this.learningRate;
      this.biasO[i] -= gradient;
      for (let j = 0; j < this.hiddenNodes; j++) {
        this.weightsHO[i][j] -= gradient * hiddenActivated[j];
      }
    }

    // Cập nhật Weights & Bias cho Input -> Hidden
    for (let i = 0; i < this.hiddenNodes; i++) {
      const gradient = hiddenErrors[i] * reluDerivative(hidden[i] + this.biasH[i]) * this.learningRate;
      this.biasH[i] -= gradient;
      for (let j = 0; j < this.inputNodes; j++) {
        this.weightsIH[i][j] -= gradient * inputs[j];
      }
    }
  }
}
