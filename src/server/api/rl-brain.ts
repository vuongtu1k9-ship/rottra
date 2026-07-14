import { Deterministic } from "~/shared/utils/rng";
// Pure TypeScript Multi-Layer Perceptron (MLP) for Q-Learning
// Designed to be extremely lightweight and run anywhere (Cloudflare Pages/Workers)
// without native C++ dependencies or WebAssembly.

export class NeuralNetwork {
  private inputSize: number;
  private hiddenSize: number;
  private outputSize: number;
  private learningRate: number;

  private weightsInputHidden: number[][];
  private weightsHiddenOutput: number[][];
  private biasHidden: number[];
  private biasOutput: number[];

  constructor(inputSize: number, hiddenSize: number, outputSize: number, learningRate = 0.1) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.learningRate = learningRate;

    this.weightsInputHidden = this.initMatrix(this.inputSize, this.hiddenSize);
    this.weightsHiddenOutput = this.initMatrix(this.hiddenSize, this.outputSize);
    this.biasHidden = this.initArray(this.hiddenSize);
    this.biasOutput = this.initArray(this.outputSize);
  }

  private initMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => Deterministic.random() * 2 - 1));
  }

  private initArray(size: number): number[] {
    return Array.from({ length: size }, () => Deterministic.random() * 2 - 1);
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private dSigmoid(y: number): number {
    return y * (1 - y);
  }

  // Forward Pass
  public predict(inputArray: number[]): number[] {
    if (inputArray.length !== this.inputSize) {
      throw new Error(`Input size mismatch. Expected ${this.inputSize}, got ${inputArray.length}`);
    }

    // Hidden layer
    const hidden = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.inputSize; j++) {
        sum += inputArray[j] * this.weightsInputHidden[j][i];
      }
      hidden[i] = this.sigmoid(sum + this.biasHidden[i]);
    }

    // Output layer
    const output = new Array(this.outputSize).fill(0);
    for (let i = 0; i < this.outputSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weightsHiddenOutput[j][i];
      }
      // For Q-Values, we use linear activation instead of sigmoid for output,
      // but if rewards are scaled [0,1], sigmoid works. Let's use linear for Q-values.
      output[i] = sum + this.biasOutput[i];
    }

    return output;
  }

  // Backpropagation for Q-Learning
  public train(inputArray: number[], targetArray: number[]): void {
    // 1. Forward Pass to get intermediate outputs
    const hidden = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.inputSize; j++) {
        sum += inputArray[j] * this.weightsInputHidden[j][i];
      }
      hidden[i] = this.sigmoid(sum + this.biasHidden[i]);
    }

    const output = new Array(this.outputSize).fill(0);
    for (let i = 0; i < this.outputSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hidden[j] * this.weightsHiddenOutput[j][i];
      }
      output[i] = sum + this.biasOutput[i];
    }

    // 2. Calculate Output Errors
    const outputErrors = new Array(this.outputSize).fill(0);
    for (let i = 0; i < this.outputSize; i++) {
      outputErrors[i] = targetArray[i] - output[i];
    }

    // 3. Calculate Hidden Errors
    const hiddenErrors = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      let error = 0;
      for (let j = 0; j < this.outputSize; j++) {
        error += outputErrors[j] * this.weightsHiddenOutput[i][j];
      }
      hiddenErrors[i] = error;
    }

    // 4. Update Weights (Hidden -> Output)
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        const delta = outputErrors[j] * 1; // Linear derivative is 1
        this.weightsHiddenOutput[i][j] += this.learningRate * delta * hidden[i];
      }
    }
    for (let j = 0; j < this.outputSize; j++) {
      this.biasOutput[j] += this.learningRate * outputErrors[j];
    }

    // 5. Update Weights (Input -> Hidden)
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        const delta = hiddenErrors[j] * this.dSigmoid(hidden[j]);
        this.weightsInputHidden[i][j] += this.learningRate * delta * inputArray[i];
      }
    }
    for (let j = 0; j < this.hiddenSize; j++) {
      this.biasHidden[j] += this.learningRate * hiddenErrors[j] * this.dSigmoid(hidden[j]);
    }
  }

  // Serialization
  public toJSON(): string {
    return JSON.stringify({
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      learningRate: this.learningRate,
      weightsInputHidden: this.weightsInputHidden,
      weightsHiddenOutput: this.weightsHiddenOutput,
      biasHidden: this.biasHidden,
      biasOutput: this.biasOutput,
    });
  }

  public fromJSON(jsonStr: string): void {
    const data = JSON.parse(jsonStr);
    this.inputSize = data.inputSize;
    this.hiddenSize = data.hiddenSize;
    this.outputSize = data.outputSize;
    this.learningRate = data.learningRate;
    this.weightsInputHidden = data.weightsInputHidden;
    this.weightsHiddenOutput = data.weightsHiddenOutput;
    this.biasHidden = data.biasHidden;
    this.biasOutput = data.biasOutput;
  }
}
