import { Deterministic } from "~/shared/utils/rng";
/**
 * Rottra Vision AI Brain (Pure TypeScript)
 * Analyzes the 64-D OKLCH color/texture vector from Frontend to classify image validity.
 */
import fs from "node:fs";
import path from "node:path";

const WEIGHTS_PATH = path.join(process.cwd(), "storage", "vision-weights.json");

export class RottraVisionBrain {
  private inputSize = 64;
  private hiddenSize = 32;
  private outputSize = 1; // Number of learned categories (grows dynamically if we want, but let's start with a generic valid vs invalid, or output per category)

  // Weights & Biases
  public weights1: number[][]; // [inputSize][hiddenSize]
  public bias1: number[]; // [hiddenSize]
  public weights2: number[][]; // [hiddenSize][outputSize]
  public bias2: number[]; // [outputSize]
  public categoryMap: string[] = []; // Maps output index to Category Name

  constructor() {
    this.weights1 = Array(this.inputSize)
      .fill(0)
      .map(() =>
        Array(this.hiddenSize)
          .fill(0)
          .map(() => Deterministic.random() * 0.2 - 0.1),
      );
    this.bias1 = Array(this.hiddenSize).fill(0);
    this.weights2 = Array(this.hiddenSize)
      .fill(0)
      .map(() =>
        Array(this.outputSize)
          .fill(0)
          .map(() => Deterministic.random() * 0.2 - 0.1),
      );
    this.bias2 = Array(this.outputSize).fill(0);
    this.loadWeights();
  }

  private relu(x: number) {
    return Math.max(0, x);
  }
  private sigmoid(x: number) {
    return 1 / (1 + Math.exp(-x));
  }

  public expandCategories(categories: string[]) {
    for (const cat of categories) {
      if (!this.categoryMap.includes(cat)) {
        this.categoryMap.push(cat);
        // Expand output layer
        this.outputSize = this.categoryMap.length;
        for (let h = 0; h < this.hiddenSize; h++) {
          this.weights2[h].push(Deterministic.random() * 0.2 - 0.1);
        }
        this.bias2.push(0);
      }
    }
  }

  public predict(features: number[]): { category: string; confidence: number }[] {
    if (features.length !== this.inputSize) return [];
    if (this.categoryMap.length === 0) return [];

    // Layer 1
    const hidden = Array(this.hiddenSize).fill(0);
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.bias1[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += features[i] * this.weights1[i][h];
      }
      hidden[h] = this.relu(sum);
    }

    // Layer 2
    const output = Array(this.outputSize).fill(0);
    let expSum = 0;
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.bias2[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += hidden[h] * this.weights2[h][o];
      }
      output[o] = Math.exp(sum); // Softmax prep
      expSum += output[o];
    }

    // Softmax probabilities
    const probabilities = output.map((val, i) => ({
      category: this.categoryMap[i],
      confidence: val / expSum,
    }));

    // Sort by confidence
    return probabilities.sort((a, b) => b.confidence - a.confidence);
  }

  public trainSingle(features: number[], targetCategory: string, learningRate = 0.01) {
    if (!this.categoryMap.includes(targetCategory)) this.expandCategories([targetCategory]);

    // Forward pass
    const hidden = Array(this.hiddenSize).fill(0);
    const hiddenRaw = Array(this.hiddenSize).fill(0);
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.bias1[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += features[i] * this.weights1[i][h];
      }
      hiddenRaw[h] = sum;
      hidden[h] = this.relu(sum);
    }

    const output = Array(this.outputSize).fill(0);
    let expSum = 0;
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.bias2[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += hidden[h] * this.weights2[h][o];
      }
      output[o] = Math.exp(sum);
      expSum += output[o];
    }

    const targetIndex = this.categoryMap.indexOf(targetCategory);

    // Backpropagation (Cross-Entropy + Softmax gradient)
    const outputError = Array(this.outputSize).fill(0);
    for (let o = 0; o < this.outputSize; o++) {
      const prob = output[o] / expSum;
      const target = o === targetIndex ? 1 : 0;
      outputError[o] = prob - target; // Derivative of Softmax + CrossEntropy
    }

    const hiddenError = Array(this.hiddenSize).fill(0);
    for (let h = 0; h < this.hiddenSize; h++) {
      let err = 0;
      for (let o = 0; o < this.outputSize; o++) {
        err += outputError[o] * this.weights2[h][o];
        // Update W2
        this.weights2[h][o] -= learningRate * outputError[o] * hidden[h];
      }
      hiddenError[h] = hiddenRaw[h] > 0 ? err : 0; // ReLU derivative

      // Update B2
      for (let o = 0; o < this.outputSize; o++) {
        this.bias2[o] -= learningRate * outputError[o];
      }
    }

    // Update W1 and B1
    for (let i = 0; i < this.inputSize; i++) {
      for (let h = 0; h < this.hiddenSize; h++) {
        this.weights1[i][h] -= learningRate * hiddenError[h] * features[i];
      }
    }
    for (let h = 0; h < this.hiddenSize; h++) {
      this.bias1[h] -= learningRate * hiddenError[h];
    }
  }

  public saveWeights() {
    const data = {
      w1: this.weights1,
      b1: this.bias1,
      w2: this.weights2,
      b2: this.bias2,
      map: this.categoryMap,
    };
    if (!fs.existsSync(path.dirname(WEIGHTS_PATH))) {
      fs.mkdirSync(path.dirname(WEIGHTS_PATH), { recursive: true });
    }
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(data), "utf-8");
  }

  public loadWeights() {
    if (fs.existsSync(WEIGHTS_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(WEIGHTS_PATH, "utf-8"));
        this.weights1 = data.w1;
        this.bias1 = data.b1;
        this.weights2 = data.w2;
        this.bias2 = data.b2;
        this.categoryMap = data.map;
        this.outputSize = this.categoryMap.length;
      } catch (e) {}
    }
  }
}

export const visionBrain = new RottraVisionBrain();
