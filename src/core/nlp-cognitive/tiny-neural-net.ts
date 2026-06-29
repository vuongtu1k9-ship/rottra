/**
 * Tiny Neural Network from scratch - ULTRA FAST CONVERGENCE
 * Built for active learning & self-correction in Rottra AI
 * Mathematics: ADAM Optimizer, Xavier Initialization, Sigmoid, Cross-Entropy
 */

// Ma trận ngẫu nhiên với Xavier Initialization
function xavierMatrix(rows: number, cols: number, inputs: number): number[][] {
  const limit = Math.sqrt(6 / (inputs + cols)); // Normalized Xavier Init
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() * 2 - 1) * limit));
}

// Ma trận Zero
function zeroMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

// Hàm Sigmoid "Cong xác suất lên 1"
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Đạo hàm Sigmoid "Hạ độ dốc về 0"
function sigmoidDerivative(x: number): number {
  return x * (1 - x); // Do x ở đây đã là output của sigmoid
}

// Nhân ma trận
function dotProduct(m1: number[][], m2: number[][]): number[][] {
  const result = Array.from({ length: m1.length }, () => new Array(m2[0].length).fill(0));
  for (let i = 0; i < m1.length; i++) {
    for (let j = 0; j < m2[0].length; j++) {
      for (let k = 0; k < m1[0].length; k++) {
        result[i][j] += m1[i][k] * m2[k][j];
      }
    }
  }
  return result;
}

export class TinyNeuralNet {
  private weights0: number[][]; // Input to Hidden
  private weights1: number[][]; // Hidden to Output

  // ADAM Optimizer moments
  private m0: number[][];
  private v0: number[][];
  private m1: number[][];
  private v1: number[][];
  private t: number = 0; // Time step

  constructor(inputNodes: number, hiddenNodes: number, outputNodes: number) {
    this.weights0 = xavierMatrix(inputNodes, hiddenNodes, inputNodes);
    this.weights1 = xavierMatrix(hiddenNodes, outputNodes, hiddenNodes);

    this.m0 = zeroMatrix(inputNodes, hiddenNodes);
    this.v0 = zeroMatrix(inputNodes, hiddenNodes);
    this.m1 = zeroMatrix(hiddenNodes, outputNodes);
    this.v1 = zeroMatrix(hiddenNodes, outputNodes);
  }

  // Chạy tiến (Forward propagation)
  public predict(inputs: number[][]): number[][] {
    const hiddenLayer = this.forwardLayer(inputs, this.weights0);
    const outputLayer = this.forwardLayer(hiddenLayer, this.weights1);
    return outputLayer;
  }

  private forwardLayer(inputs: number[][], weights: number[][]): number[][] {
    const dot = dotProduct(inputs, weights);
    return dot.map((row) => row.map((val) => sigmoid(val)));
  }

  // Huấn luyện bằng ADAM Optimizer siêu tốc
  public train(inputs: number[][], outputs: number[][], epochs: number = 100, lr: number = 0.01) {
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;

    for (let epoch = 0; epoch < epochs; epoch++) {
      this.t += 1; // Tăng time step

      // 1. Lan truyền tiến
      const hiddenLayer = this.forwardLayer(inputs, this.weights0);
      const outputLayer = this.forwardLayer(hiddenLayer, this.weights1);

      // 2. Tính sai số (Loss / Error) - Loss = Target - Output
      const outputError = Array.from({ length: outputs.length }, (_, i) => outputs[i].map((val, j) => val - outputLayer[i][j]));

      // 3. Tính Delta Output (Gradient)
      const outputDelta = outputLayer.map((row, i) => row.map((val, j) => outputError[i][j] * sigmoidDerivative(val)));

      // 4. Lỗi lây lan ngược về Hidden Layer
      const weights1T = this.weights1[0].map((_, colIndex) => this.weights1.map((row) => row[colIndex]));
      const hiddenError = dotProduct(outputDelta, weights1T);

      // 5. Delta Hidden Layer
      const hiddenDelta = hiddenLayer.map((row, i) => row.map((val, j) => hiddenError[i][j] * sigmoidDerivative(val)));

      // 6. Tính Gradient (Đạo hàm) cho Weights1
      const hiddenLayerT = hiddenLayer[0].map((_, colIndex) => hiddenLayer.map((row) => row[colIndex]));
      const gradW1 = dotProduct(hiddenLayerT, outputDelta);

      // Tính Gradient (Đạo hàm) cho Weights0
      const inputsT = inputs[0].map((_, colIndex) => inputs.map((row) => row[colIndex]));
      const gradW0 = dotProduct(inputsT, hiddenDelta);

      // 7. ADAM Optimizer Cập nhật Trọng số W1
      for (let i = 0; i < this.weights1.length; i++) {
        for (let j = 0; j < this.weights1[0].length; j++) {
          const g = -gradW1[i][j]; // Chuyển dấu vì bài toán cực tiểu hóa Loss
          this.m1[i][j] = beta1 * this.m1[i][j] + (1 - beta1) * g;
          this.v1[i][j] = beta2 * this.v1[i][j] + (1 - beta2) * g * g;

          const m_hat = this.m1[i][j] / (1 - Math.pow(beta1, this.t));
          const v_hat = this.v1[i][j] / (1 - Math.pow(beta2, this.t));

          this.weights1[i][j] -= (lr * m_hat) / (Math.sqrt(v_hat) + epsilon);
        }
      }

      // 8. ADAM Optimizer Cập nhật Trọng số W0
      for (let i = 0; i < this.weights0.length; i++) {
        for (let j = 0; j < this.weights0[0].length; j++) {
          const g = -gradW0[i][j];
          this.m0[i][j] = beta1 * this.m0[i][j] + (1 - beta1) * g;
          this.v0[i][j] = beta2 * this.v0[i][j] + (1 - beta2) * g * g;

          const m_hat = this.m0[i][j] / (1 - Math.pow(beta1, this.t));
          const v_hat = this.v0[i][j] / (1 - Math.pow(beta2, this.t));

          this.weights0[i][j] -= (lr * m_hat) / (Math.sqrt(v_hat) + epsilon);
        }
      }
    }
  }

  // Xuất cấu hình trọng số để lưu DB
  public exportWeights() {
    return { weights0: this.weights0, weights1: this.weights1, m0: this.m0, v0: this.v0, m1: this.m1, v1: this.v1, t: this.t };
  }

  // Tải cấu hình trọng số
  public importWeights(data: any) {
    if (data.weights0) this.weights0 = data.weights0;
    if (data.weights1) this.weights1 = data.weights1;
    if (data.m0) this.m0 = data.m0;
    if (data.v0) this.v0 = data.v0;
    if (data.m1) this.m1 = data.m1;
    if (data.v1) this.v1 = data.v1;
    if (data.t) this.t = data.t;
  }
}
