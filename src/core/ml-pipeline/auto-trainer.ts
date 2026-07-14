/**
 * ML Pipeline — Auto-Trainer
 * Automatically trains classifiers from the agentTraining table.
 */

import { extractFeatures, type FeatureConfig } from "./feature-engine";
import {
  type ClassifierType,
  type ClassifierConfig,
  type TrainedClassifier,
  createClassifier,
  type ClassificationResult,
} from "./classifier";
import { classificationMetrics, type EvaluationMetrics } from "./evaluator";
import { Deterministic } from "~/shared/utils/rng";

export interface AutoTrainConfig {
  targetIntent?: string;
  testSplit: number;
  classifiers: ClassifierType[];
  maxUtterances: number;
}

export interface AutoTrainResult {
  bestClassifier: ClassifierType;
  bestAccuracy: number;
  allResults: { type: ClassifierType; metrics: EvaluationMetrics; config: ClassifierConfig }[];
  trainedModelId: number | null;
}

interface TrainingSample {
  utterance: string;
  intent: string;
}

/** Build labeled dataset from training samples. */
function buildDataset(samples: TrainingSample[], targetIntent?: string): { texts: string[]; labels: number[]; classNames: string[] } {
  const filtered = targetIntent ? samples.filter((s) => s.intent === targetIntent) : samples;
  const intentSet = [...new Set(filtered.map((s) => s.intent))].sort();
  const intentMap = new Map(intentSet.map((intent, idx) => [intent, idx]));

  return {
    texts: filtered.map((s) => s.utterance),
    labels: filtered.map((s) => intentMap.get(s.intent) || 0),
    classNames: intentSet,
  };
}

/** Auto-train multiple classifiers and pick the best. */
export function autoTrain(
  samples: TrainingSample[],
  config: AutoTrainConfig,
): { results: { type: ClassifierType; metrics: EvaluationMetrics }[]; best: ClassifierType; bestAccuracy: number } {
  const { texts, labels, classNames } = buildDataset(samples, config.targetIntent);
  const numClasses = classNames.length;

  if (numClasses < 2 || texts.length < 10) {
    return { results: [], best: "naive_bayes", bestAccuracy: 0 };
  }

  // Feature extraction
  const { features, config: featureConfig } = extractFeatures(texts, "tfidf", Math.min(500, texts.length));

  // Shuffle deterministically
  const indices = [...Array(texts.length).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Deterministic.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const splitIdx = Math.floor(indices.length * (1 - config.testSplit));
  const trainIdx = indices.slice(0, splitIdx);
  const testIdx = indices.slice(splitIdx);

  const trainX = trainIdx.map((i) => features[i]);
  const trainY = trainIdx.map((i) => labels[i]);
  const testX = testIdx.map((i) => features[i]);
  const testY = testIdx.map((i) => labels[i]);

  const results: { type: ClassifierType; metrics: EvaluationMetrics }[] = [];
  let bestAccuracy = 0;
  let best: ClassifierType = config.classifiers[0] || "naive_bayes";

  for (const type of config.classifiers) {
    const classifierConfig: ClassifierConfig = { type, k: 3, maxDepth: 8, numTrees: 10, epochs: 100 };
    const classifier = createClassifier(classifierConfig, numClasses, classNames, featureConfig);

    if (type === "neural_net") {
      // NeuralNet needs async, skip for sync auto-train
      continue;
    }

    classifier.fit?.(trainX, trainY);
    const testPreds = classifier.predict(testX);
    const metrics = classificationMetrics(testY, testPreds, numClasses);

    results.push({ type, metrics });
    if (metrics.accuracy > bestAccuracy) {
      bestAccuracy = metrics.accuracy;
      best = type;
    }
  }

  return { results, best, bestAccuracy };
}

/** Classify a single text using a trained classifier. */
export function predictWithClassifier(text: string, classifier: TrainedClassifier, featureConfig: FeatureConfig): ClassificationResult {
  const { features } = extractFeatures([text], featureConfig.method as "tfidf" | "bow", featureConfig.maxFeatures);
  const predictions = classifier.predict(features);
  const probabilities = classifier.predictProbabilities(features);
  return {
    predictions,
    probabilities,
    accuracy: 0,
    metrics: {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      precisionPerClass: [],
      recallPerClass: [],
      f1PerClass: [],
      confusionMatrix: [],
      support: [],
    },
  };
}
