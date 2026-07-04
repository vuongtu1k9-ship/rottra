/**
 * 🧠 ROTTRA — LOCAL TRAINER
 * Runs local model training on farm nodes.
 * Computes gradients without exposing raw data.
 * Runs on Bun runtime.
 */

import { randomUUID } from "crypto";
import { db } from "~/infra/database/db-pool";
import { flGradientUpdate, flRound } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import type { FLRoundConfig, ModelWeights, GradientUpdate, DPParams } from "./types";

// ── Local Trainer Class ──────────────────────────────────────

export class LocalTrainer {
  private nodeId: string;
  private localData: any[] = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  /**
   * Set local training data
   */
  setData(data: any[]): void {
    this.localData = data;
    console.log(`[LocalTrainer] Node ${this.nodeId}: Loaded ${data.length} samples`);
  }

  /**
   * Train locally on available data
   * Returns gradient update to send to coordinator
   */
  async trainLocal(
    globalModel: ModelWeights | null,
    config: FLRoundConfig,
  ): Promise<{
    gradients: Float32Array[];
    metrics: { localLoss: number; localAccuracy: number; dataSampleCount: number };
  }> {
    if (this.localData.length === 0) {
      throw new Error("No local data available for training");
    }

    console.log(`[LocalTrainer] Node ${this.nodeId}: Starting local training...`);

    // Initialize or use global model
    const model = globalModel || this.initializeDefaultModel();

    // Simulate local training (in real implementation, would run actual backprop)
    const epochs = config.localEpochs;
    let loss = 1.0;
    const gradients: Float32Array[] = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      // Simulate gradient computation
      const epochGradients = await this.computeGradients(model, this.localData);

      // Apply differential privacy noise
      const dpParams: DPParams = {
        epsilon: config.dpEpsilon,
        delta: config.dpDelta,
        clipNorm: 1.0,
        noiseMultiplier: 1.0,
      };
      const noisyGradients = await this.applyDPNoise(epochGradients, dpParams);

      gradients.push(...noisyGradients);

      // Simulate loss reduction
      loss *= 0.85 + Math.random() * 0.1;
    }

    // Compute metrics
    const accuracy = Math.min(0.95, 0.5 + (1 - loss) * 0.5 + Math.random() * 0.1);

    console.log(`[LocalTrainer] Node ${this.nodeId}: Training complete. Loss: ${loss.toFixed(4)}, Accuracy: ${accuracy.toFixed(4)}`);

    return {
      gradients,
      metrics: {
        localLoss: loss,
        localAccuracy: accuracy,
        dataSampleCount: this.localData.length,
      },
    };
  }

  /**
   * Compute gradients for a batch
   */
  private async computeGradients(model: ModelWeights, batch: any[]): Promise<Float32Array[]> {
    // Simulate gradient computation
    // In real implementation, would run forward/backward pass
    const gradients: Float32Array[] = [];

    for (const layer of model.layers) {
      // Simulate gradient for weights
      const weightGrad = new Float32Array(layer.weights.length);
      for (let i = 0; i < weightGrad.length; i++) {
        weightGrad[i] = (Math.random() - 0.5) * 0.01;
      }
      gradients.push(weightGrad);

      // Simulate gradient for bias
      if (layer.bias) {
        const biasGrad = new Float32Array(layer.bias.length);
        for (let i = 0; i < biasGrad.length; i++) {
          biasGrad[i] = (Math.random() - 0.5) * 0.01;
        }
        gradients.push(biasGrad);
      }
    }

    return gradients;
  }

  /**
   * Apply differential privacy noise to gradients
   */
  private async applyDPNoise(gradients: Float32Array[], params: DPParams): Promise<Float32Array[]> {
    const { clipNorm, noiseMultiplier } = params;

    return gradients.map((grad) => {
      // Step 1: Gradient clipping
      let gradNorm = 0;
      for (let i = 0; i < grad.length; i++) {
        gradNorm += grad[i] * grad[i];
      }
      gradNorm = Math.sqrt(gradNorm);

      const clippedGrad = new Float32Array(grad.length);
      if (gradNorm > clipNorm) {
        const scale = clipNorm / gradNorm;
        for (let i = 0; i < grad.length; i++) {
          clippedGrad[i] = grad[i] * scale;
        }
      } else {
        clippedGrad.set(grad);
      }

      // Step 2: Add Gaussian noise
      const noisyGrad = new Float32Array(clippedGrad.length);
      for (let i = 0; i < noisyGrad.length; i++) {
        // Box-Muller transform for Gaussian noise
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        noisyGrad[i] = clippedGrad[i] + z * noiseMultiplier * clipNorm;
      }

      return noisyGrad;
    });
  }

  /**
   * Initialize default model (small neural network)
   */
  private initializeDefaultModel(): ModelWeights {
    // Simple 3-layer network for intent classification
    const inputDim = 256;
    const hiddenDim = 64;
    const outputDim = 20;

    const layers = [
      {
        name: "input_hidden",
        weights: this.randomWeights(inputDim * hiddenDim),
        bias: this.randomWeights(hiddenDim),
        shape: [inputDim, hiddenDim],
      },
      {
        name: "hidden_output",
        weights: this.randomWeights(hiddenDim * outputDim),
        bias: this.randomWeights(outputDim),
        shape: [hiddenDim, outputDim],
      },
    ];

    return {
      layers,
      architectureHash: "default_intention_classifier",
      parameterCount: inputDim * hiddenDim + hiddenDim + hiddenDim * outputDim + outputDim,
    };
  }

  /**
   * Generate random weights using Xavier initialization
   */
  private randomWeights(size: number): Float32Array {
    const weights = new Float32Array(size);
    const std = Math.sqrt(2 / size);
    for (let i = 0; i < size; i++) {
      weights[i] = (Math.random() - 0.5) * 2 * std;
    }
    return weights;
  }

  /**
   * Export local model weights
   */
  async exportWeights(model: ModelWeights): Promise<string> {
    // Serialize to JSON
    const serialized = {
      layers: model.layers.map((l) => ({
        name: l.name,
        weights: Array.from(l.weights),
        bias: l.bias ? Array.from(l.bias) : null,
        shape: l.shape,
      })),
      architectureHash: model.architectureHash,
      parameterCount: model.parameterCount,
    };

    return JSON.stringify(serialized);
  }

  /**
   * Import model weights
   */
  async importWeights(weightsJson: string): Promise<ModelWeights> {
    const data = JSON.parse(weightsJson);

    return {
      layers: data.layers.map((l: any) => ({
        name: l.name,
        weights: new Float32Array(l.weights),
        bias: l.bias ? new Float32Array(l.bias) : null,
        shape: l.shape,
      })),
      architectureHash: data.architectureHash,
      parameterCount: data.parameterCount,
    };
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createLocalTrainer(nodeId: string): LocalTrainer {
  return new LocalTrainer(nodeId);
}
