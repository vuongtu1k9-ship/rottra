/**
 * ML Pipeline — Classifiers
 * NaiveBayes, KNN, SVM, DecisionTree, RandomForest, NeuralNet
 * All implementations from scratch. Zero external deps.
 */

import { Deterministic } from "~/shared/utils/rng";
import { type EvaluationMetrics, classificationMetrics } from "./evaluator";
import { type FeatureConfig, tokenize, bowVectorize, buildVocabulary, tfidfVectorize } from "./feature-engine";

// ── Types ───────────────────────────────────────────────────

export type ClassifierType = "naive_bayes" | "knn" | "svm" | "decision_tree" | "random_forest" | "neural_net";

export interface ClassifierConfig {
  type: ClassifierType;
  k?: number;
  maxDepth?: number;
  minSamplesSplit?: number;
  numTrees?: number;
  hiddenLayers?: number[];
  learningRate?: number;
  epochs?: number;
}

export interface ClassificationResult {
  predictions: number[];
  probabilities: number[][];
  accuracy: number;
  metrics: EvaluationMetrics;
}

export interface TrainedClassifier {
  type: ClassifierType;
  config: ClassifierConfig;
  featureConfig: FeatureConfig;
  weights: any;
  numClasses: number;
  classNames: string[];
  fit?(X: number[][], y: number[]): void;
  predict(features: number[][]): number[];
  predictProbabilities(features: number[][]): number[][];
}

// ── Naive Bayes (Gaussian) ──────────────────────────────────

class NaiveBayesClassifier implements TrainedClassifier {
  type: ClassifierType = "naive_bayes";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;

  private means: number[][] = [];
  private variances: number[][] = [];
  private classPriors: number[] = [];

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  fit(X: number[][], y: number[]): void {
    const n = X.length;
    const features = X[0].length;
    this.means = Array.from({ length: this.numClasses }, () => new Array(features).fill(0));
    this.variances = Array.from({ length: this.numClasses }, () => new Array(features).fill(0));
    this.classPriors = new Array(this.numClasses).fill(0);

    const counts = new Array(this.numClasses).fill(0);
    for (let i = 0; i < n; i++) {
      const c = y[i];
      counts[c]++;
      for (let j = 0; j < features; j++) this.means[c][j] += X[i][j];
    }

    for (let c = 0; c < this.numClasses; c++) {
      this.classPriors[c] = counts[c] / n;
      for (let j = 0; j < features; j++) this.means[c][j] /= counts[c] || 1;
    }

    for (let i = 0; i < n; i++) {
      const c = y[i];
      for (let j = 0; j < features; j++) {
        const diff = X[i][j] - this.means[c][j];
        this.variances[c][j] += diff * diff;
      }
    }
    for (let c = 0; c < this.numClasses; c++) {
      for (let j = 0; j < features; j++) this.variances[c][j] = this.variances[c][j] / (counts[c] || 1) + 1e-9;
    }
    this.weights = { means: this.means, variances: this.variances, priors: this.classPriors };
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      let bestClass = 0;
      let bestLogProb = -Infinity;
      for (let c = 0; c < this.numClasses; c++) {
        let logProb = Math.log(this.classPriors[c] + 1e-9);
        for (let j = 0; j < x.length; j++) {
          const v = this.variances[c][j];
          logProb += -0.5 * Math.log(2 * Math.PI * v) - (x[j] - this.means[c][j]) ** 2 / (2 * v);
        }
        if (logProb > bestLogProb) {
          bestLogProb = logProb;
          bestClass = c;
        }
      }
      return bestClass;
    });
  }

  predictProbabilities(X: number[][]): number[][] {
    return X.map((x) => {
      const logProbs: number[] = [];
      for (let c = 0; c < this.numClasses; c++) {
        let logProb = Math.log(this.classPriors[c] + 1e-9);
        for (let j = 0; j < x.length; j++) {
          const v = this.variances[c][j];
          logProb += -0.5 * Math.log(2 * Math.PI * v) - (x[j] - this.means[c][j]) ** 2 / (2 * v);
        }
        logProbs.push(logProb);
      }
      const maxLog = Math.max(...logProbs);
      const probs = logProbs.map((lp) => Math.exp(lp - maxLog));
      const sum = probs.reduce((a, b) => a + b, 0);
      return probs.map((p) => p / sum);
    });
  }
}

// ── KNN ─────────────────────────────────────────────────────

class KNNClassifier implements TrainedClassifier {
  type: ClassifierType = "knn";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;
  private trainX: number[][] = [];
  private trainY: number[] = [];

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  fit(X: number[][], y: number[]): void {
    this.trainX = X;
    this.trainY = y;
    this.weights = { trainX: this.trainX, trainY: this.trainY };
  }

  predict(X: number[][]): number[] {
    const k = this.config.k || 3;
    return X.map((x) => {
      const dists = this.trainX.map((tx, i) => ({
        dist: Math.sqrt(tx.reduce((s, v, j) => s + (v - x[j]) ** 2, 0)),
        label: this.trainY[i],
      }));
      dists.sort((a, b) => a.dist - b.dist);
      const neighbors = dists.slice(0, k);
      const votes = new Array(this.numClasses).fill(0);
      for (const n of neighbors) {
        const w = n.dist > 0 ? 1 / n.dist : 1000;
        votes[n.label] += w;
      }
      return votes.indexOf(Math.max(...votes));
    });
  }

  predictProbabilities(X: number[][]): number[][] {
    const k = this.config.k || 3;
    return X.map((x) => {
      const dists = this.trainX.map((tx, i) => ({
        dist: Math.sqrt(tx.reduce((s, v, j) => s + (v - x[j]) ** 2, 0)),
        label: this.trainY[i],
      }));
      dists.sort((a, b) => a.dist - b.dist);
      const neighbors = dists.slice(0, k);
      const votes = new Array(this.numClasses).fill(0);
      for (const n of neighbors) votes[n.label]++;
      const sum = votes.reduce((a, b) => a + b, 0) || 1;
      return votes.map((v) => v / sum);
    });
  }
}

// ── SVM (Linear, gradient descent) ──────────────────────────

class SVMClassifier implements TrainedClassifier {
  type: ClassifierType = "svm";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;
  private w: number[] = [];
  private b = 0;

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  fit(X: number[][], y: number[]): void {
    // One-vs-rest for multi-class
    const lr = this.config.learningRate || 0.01;
    const epochs = this.config.epochs || 200;
    const features = X[0].length;
    this.w = new Array(features).fill(0);
    this.b = 0;

    // Binary: class 0 vs rest
    const binaryY = y.map((v) => (v === 0 ? 1 : -1));

    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < X.length; i++) {
        const margin = binaryY[i] * (X[i].reduce((s, v, j) => s + v * this.w[j], 0) + this.b);
        if (margin < 1) {
          for (let j = 0; j < features; j++) {
            this.w[j] += lr * (binaryY[i] * X[i][j] - 0.001 * this.w[j]);
          }
          this.b += lr * binaryY[i];
        }
      }
    }
    this.weights = { w: this.w, b: this.b };
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const score = x.reduce((s, v, j) => s + v * this.w[j], 0) + this.b;
      return score >= 0 ? 0 : 1;
    });
  }

  predictProbabilities(X: number[][]): number[][] {
    return X.map((x) => {
      const score = x.reduce((s, v, j) => s + v * this.w[j], 0) + this.b;
      const p = 1 / (1 + Math.exp(-score));
      return this.numClasses === 2 ? [p, 1 - p] : [p];
    });
  }
}

// ── Decision Tree (CART, Gini impurity) ─────────────────────

interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  class?: number;
  gini?: number;
  samples?: number;
}

class DecisionTreeClassifier implements TrainedClassifier {
  type: ClassifierType = "decision_tree";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;
  private root: TreeNode = {};

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  private gini(labels: number[]): number {
    const counts = new Array(this.numClasses).fill(0);
    for (const l of labels) counts[l]++;
    let impurity = 1;
    for (const c of counts) {
      const p = c / labels.length;
      impurity -= p * p;
    }
    return impurity;
  }

  private buildTree(X: number[][], y: number[], depth: number): TreeNode {
    const maxDepth = this.config.maxDepth || 10;
    const minSplit = this.config.minSamplesSplit || 2;
    const classes = [...new Set(y)];

    if (classes.length === 1 || depth >= maxDepth || y.length < minSplit) {
      const counts = new Array(this.numClasses).fill(0);
      for (const l of y) counts[l]++;
      return { class: counts.indexOf(Math.max(...counts)), gini: this.gini(y), samples: y.length };
    }

    let bestGini = Infinity;
    let bestFeature = 0;
    let bestThreshold = 0;
    let bestLeftIdx: number[] = [];
    let bestRightIdx: number[] = [];
    const features = X[0].length;

    for (let f = 0; f < features; f++) {
      const values = [...new Set(X.map((x) => x[f]))].sort((a, b) => a - b);
      for (let vi = 0; vi < values.length - 1; vi++) {
        const threshold = (values[vi] + values[vi + 1]) / 2;
        const leftIdx: number[] = [];
        const rightIdx: number[] = [];
        for (let i = 0; i < X.length; i++) {
          if (X[i][f] <= threshold) leftIdx.push(i);
          else rightIdx.push(i);
        }
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;
        const leftY = leftIdx.map((i) => y[i]);
        const rightY = rightIdx.map((i) => y[i]);
        const weightedGini = (leftY.length * this.gini(leftY) + rightY.length * this.gini(rightY)) / y.length;
        if (weightedGini < bestGini) {
          bestGini = weightedGini;
          bestFeature = f;
          bestThreshold = threshold;
          bestLeftIdx = leftIdx;
          bestRightIdx = rightIdx;
        }
      }
    }

    if (bestLeftIdx.length === 0 || bestRightIdx.length === 0) {
      const counts = new Array(this.numClasses).fill(0);
      for (const l of y) counts[l]++;
      return { class: counts.indexOf(Math.max(...counts)), gini: this.gini(y), samples: y.length };
    }

    return {
      feature: bestFeature,
      threshold: bestThreshold,
      gini: bestGini,
      samples: y.length,
      left: this.buildTree(
        bestLeftIdx.map((i) => X[i]),
        bestLeftIdx.map((i) => y[i]),
        depth + 1,
      ),
      right: this.buildTree(
        bestRightIdx.map((i) => X[i]),
        bestRightIdx.map((i) => y[i]),
        depth + 1,
      ),
    };
  }

  private traverse(x: number[], node: TreeNode): number {
    if (node.class !== undefined) return node.class;
    if (node.feature !== undefined && node.threshold !== undefined) {
      return x[node.feature] <= node.threshold ? this.traverse(x, node.left!) : this.traverse(x, node.right!);
    }
    return 0;
  }

  fit(X: number[][], y: number[]): void {
    this.root = this.buildTree(X, y, 0);
    this.weights = { root: this.root };
  }

  predict(X: number[][]): number[] {
    return X.map((x) => this.traverse(x, this.root));
  }

  predictProbabilities(X: number[][]): number[][] {
    return X.map((x) => {
      const pred = this.traverse(x, this.root);
      const probs = new Array(this.numClasses).fill(0);
      probs[pred] = 1;
      return probs;
    });
  }
}

// ── Random Forest ───────────────────────────────────────────

class RandomForestClassifier implements TrainedClassifier {
  type: ClassifierType = "random_forest";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;
  private trees: { tree: DecisionTreeClassifier; featureIndices: number[] }[] = [];

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  fit(X: number[][], y: number[]): void {
    const numTrees = this.config.numTrees || 10;
    const features = X[0].length;
    this.trees = [];

    for (let t = 0; t < numTrees; t++) {
      // Bootstrap sample
      const n = X.length;
      const indices: number[] = [];
      for (let i = 0; i < n; i++) indices.push(Math.floor(Deterministic.random() * n));

      // Random feature subset
      const featureIndices: number[] = [];
      const maxFeatures = Math.max(1, Math.floor(Math.sqrt(features)));
      const available = [...Array(features).keys()];
      for (let f = 0; f < maxFeatures; f++) {
        const idx = Math.floor(Deterministic.random() * available.length);
        featureIndices.push(available[idx]);
        available.splice(idx, 1);
      }

      const subX = indices.map((i) => featureIndices.map((f) => X[i][f]));
      const subY = indices.map((i) => y[i]);

      const tree = new DecisionTreeClassifier(this.numClasses, this.classNames, this.featureConfig, {
        type: "decision_tree",
        maxDepth: this.config.maxDepth || 8,
      });
      tree.fit(subX, subY);
      this.trees.push({ tree, featureIndices });
    }
    this.weights = { numTrees: this.trees.length };
  }

  predict(X: number[][]): number[] {
    return X.map((x) => {
      const votes = new Array(this.numClasses).fill(0);
      for (const { tree, featureIndices } of this.trees) {
        const subX = featureIndices.map((f) => x[f]);
        const pred = tree.predict([subX])[0];
        votes[pred]++;
      }
      return votes.indexOf(Math.max(...votes));
    });
  }

  predictProbabilities(X: number[][]): number[][] {
    return X.map((x) => {
      const votes = new Array(this.numClasses).fill(0);
      for (const { tree, featureIndices } of this.trees) {
        const subX = featureIndices.map((f) => x[f]);
        const pred = tree.predict([subX])[0];
        votes[pred]++;
      }
      const total = votes.reduce((a, b) => a + b, 0) || 1;
      return votes.map((v) => v / total);
    });
  }
}

// ── Neural Net (wraps TinyNeuralNet) ────────────────────────

class NeuralNetClassifier implements TrainedClassifier {
  type: ClassifierType = "neural_net";
  numClasses: number;
  classNames: string[];
  featureConfig: FeatureConfig;
  config: ClassifierConfig;
  weights: any;
  private net: any = null;

  constructor(numClasses: number, classNames: string[], featureConfig: FeatureConfig, config: ClassifierConfig) {
    this.numClasses = numClasses;
    this.classNames = classNames;
    this.featureConfig = featureConfig;
    this.config = config;
    this.weights = {};
  }

  async fit(X: number[][], y: number[]): Promise<void> {
    const { TinyNeuralNet } = await import("~/core/nlp-cognitive/tiny-neural-net");
    const features = X[0].length;
    this.net = new TinyNeuralNet(features, this.config.hiddenLayers?.[0] || 8, this.numClasses);

    const epochs = this.config.epochs || 100;
    const lr = this.config.learningRate || 0.1;

    // One-hot encode targets
    const targets = y.map((c) => {
      const row = new Array(this.numClasses).fill(0);
      row[c] = 1;
      return row;
    });

    for (let epoch = 0; epoch < epochs; epoch++) {
      this.net.train(X, targets, lr);
    }
    this.weights = { epochs, features };
  }

  predict(X: number[][]): number[] {
    if (!this.net) return X.map(() => 0);
    const output = this.net.predict(X);
    return output.map((row: number[]) => row.indexOf(Math.max(...row)));
  }

  predictProbabilities(X: number[][]): number[][] {
    if (!this.net) return X.map(() => new Array(this.numClasses).fill(1 / this.numClasses));
    return this.net.predict(X);
  }
}

// ── Factory ─────────────────────────────────────────────────

export function createClassifier(
  config: ClassifierConfig,
  numClasses: number,
  classNames: string[],
  featureConfig: FeatureConfig,
): TrainedClassifier {
  switch (config.type) {
    case "naive_bayes":
      return new NaiveBayesClassifier(numClasses, classNames, featureConfig, config);
    case "knn":
      return new KNNClassifier(numClasses, classNames, featureConfig, config);
    case "svm":
      return new SVMClassifier(numClasses, classNames, featureConfig, config);
    case "decision_tree":
      return new DecisionTreeClassifier(numClasses, classNames, featureConfig, config);
    case "random_forest":
      return new RandomForestClassifier(numClasses, classNames, featureConfig, config);
    case "neural_net":
      return new NeuralNetClassifier(numClasses, classNames, featureConfig, config);
  }
}

/** Train a classifier and evaluate on train set. */
export function trainAndEvaluate(
  X: number[][],
  y: number[],
  config: ClassifierConfig,
  classNames: string[],
  featureConfig: FeatureConfig,
  testSplit: number = 0.2,
): { classifier: TrainedClassifier; trainMetrics: EvaluationMetrics; testMetrics: EvaluationMetrics } {
  const n = X.length;
  if (n === 0) throw new Error("No training data provided");
  const splitIdx = Math.max(1, Math.floor(n * (1 - testSplit)));

  // Shuffle indices deterministically
  const indices = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Deterministic.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const trainX = indices.slice(0, splitIdx).map((i) => X[i]);
  const trainY = indices.slice(0, splitIdx).map((i) => y[i]);
  const testX = indices.slice(splitIdx).map((i) => X[i]);
  const testY = indices.slice(splitIdx).map((i) => y[i]);

  const numClasses = y.length > 0 ? Math.max(...y) + 1 : 1;
  const classifier = createClassifier(config, numClasses, classNames, featureConfig);

  if (config.type === "neural_net") {
    (classifier as NeuralNetClassifier).fit(trainX, trainY);
  } else {
    classifier.fit?.(trainX, trainY);
  }

  const trainPreds = classifier.predict(trainX);
  const testPreds = classifier.predict(testX);

  return {
    classifier,
    trainMetrics: classificationMetrics(trainY, trainPreds, numClasses),
    testMetrics: classificationMetrics(testY, testPreds, numClasses),
  };
}
