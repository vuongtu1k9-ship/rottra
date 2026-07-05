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

// BQN-style Array Algebra Utilities
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const sigmoidDerivative = (x: number) => x * (1 - x); // Do x ở đây đã là output của sigmoid

const transpose = (m: number[][]) => m[0].map((_, i) => m.map((row) => row[i]));
const vecDot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

const zipWith = (a: number[], b: number[], f: (x: number, y: number) => number) => a.map((v, i) => f(v, b[i]));
const zipMat = (a: number[][], b: number[][], f: (x: number, y: number) => number) => a.map((row, i) => zipWith(row, b[i], f));
const mapMat = (m: number[][], f: (x: number) => number) => m.map((row) => row.map(f));

// Nhân ma trận (BQN-Style)
function dotProduct(m1: number[][], m2: number[][]): number[][] {
  const m2T = transpose(m2);
  return m1.map((row) => m2T.map((col) => vecDot(row, col)));
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
    const hiddenLayer = mapMat(dotProduct(inputs, this.weights0), sigmoid);
    const outputLayer = mapMat(dotProduct(hiddenLayer, this.weights1), sigmoid);
    return outputLayer;
  }

  // Huấn luyện bằng ADAM Optimizer siêu tốc kết hợp Neuromodulation (Dopamine)
  public train(inputs: number[][], outputs: number[][], epochs: number = 100, baseLr: number = 0.01, dopamineReward: number = 1.0) {
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    const lr = baseLr * dopamineReward;

    // Helper: BQN-style ADAM Update apply
    const applyAdam = (w: number[][], m: number[][], v: number[][], grad: number[][], t: number) => {
      const gNeg = mapMat(grad, (g) => -g); // Cực tiểu hóa Loss
      const mNew = zipMat(m, gNeg, (oldM, g) => beta1 * oldM + (1 - beta1) * g);
      const vNew = zipMat(v, gNeg, (oldV, g) => beta2 * oldV + (1 - beta2) * g * g);

      const wNew = zipMat(
        w,
        zipMat(mNew, vNew, (newM, newV) => {
          const m_hat = newM / (1 - Math.pow(beta1, t));
          const v_hat = newV / (1 - Math.pow(beta2, t));
          return (lr * m_hat) / (Math.sqrt(v_hat) + epsilon);
        }),
        (oldW, step) => oldW - step,
      );

      return { wNew, mNew, vNew };
    };

    for (let epoch = 0; epoch < epochs; epoch++) {
      this.t += 1; // Tăng time step

      // 1. Lan truyền tiến
      const hiddenLayer = mapMat(dotProduct(inputs, this.weights0), sigmoid);
      const outputLayer = mapMat(dotProduct(hiddenLayer, this.weights1), sigmoid);

      // 2. Tính sai số (Loss / Error) & Delta
      const outputError = zipMat(outputs, outputLayer, (tgt, out) => tgt - out);
      const outputDelta = zipMat(outputError, outputLayer, (err, out) => err * sigmoidDerivative(out));

      // 3. Lỗi lây lan ngược về Hidden Layer
      const hiddenError = dotProduct(outputDelta, transpose(this.weights1));
      const hiddenDelta = zipMat(hiddenError, hiddenLayer, (err, hid) => err * sigmoidDerivative(hid));

      // 4. Tính Gradient
      const gradW1 = dotProduct(transpose(hiddenLayer), outputDelta);
      const gradW0 = dotProduct(transpose(inputs), hiddenDelta);

      // 5. Cập nhật bằng ADAM
      const adamW1 = applyAdam(this.weights1, this.m1, this.v1, gradW1, this.t);
      this.weights1 = adamW1.wNew;
      this.m1 = adamW1.mNew;
      this.v1 = adamW1.vNew;

      const adamW0 = applyAdam(this.weights0, this.m0, this.v0, gradW0, this.t);
      this.weights0 = adamW0.wNew;
      this.m0 = adamW0.mNew;
      this.v0 = adamW0.vNew;
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
