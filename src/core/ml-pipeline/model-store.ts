/**
 * ML Pipeline — Model Store
 * Persistence for trained models (in-memory + optional DB).
 */

import { type TrainedClassifier, type ClassifierConfig } from "./classifier";
import { type TrainedRegressor, type RegressorConfig } from "./regressor";
import { type FeatureConfig } from "./feature-engine";
import type { EvaluationMetrics, RegressionMetrics } from "./evaluator";

export interface StoredModel {
  id: number;
  name: string;
  type: "classifier" | "regressor" | "clusterer";
  algorithm: string;
  weights: any;
  hyperparams: any;
  metrics: any;
  featureConfig: FeatureConfig;
  intent: string | null;
  status: "active" | "archived";
  trainingSamples: number;
  createdAt: Date;
  updatedAt: Date;
}

class ModelStore {
  private models: Map<number, StoredModel> = new Map();
  private nextId = 1;

  save(model: Omit<StoredModel, "id" | "createdAt" | "updatedAt">): StoredModel {
    const id = this.nextId++;
    const now = new Date();
    const stored: StoredModel = { ...model, id, createdAt: now, updatedAt: now };
    this.models.set(id, stored);
    return stored;
  }

  get(id: number): StoredModel | undefined {
    return this.models.get(id);
  }

  list(type?: string): StoredModel[] {
    return [...this.models.values()].filter((m) => !type || m.type === type);
  }

  delete(id: number): boolean {
    return this.models.delete(id);
  }

  update(id: number, updates: Partial<StoredModel>): StoredModel | undefined {
    const model = this.models.get(id);
    if (!model) return undefined;
    Object.assign(model, updates, { updatedAt: new Date() });
    return model;
  }
}

export const modelStore = new ModelStore();
