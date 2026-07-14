/**
 * ML Pipeline — Barrel Exports
 */

export {
  type ClassifierType,
  type ClassifierConfig,
  type ClassificationResult,
  type TrainedClassifier,
  createClassifier,
  trainAndEvaluate,
} from "./classifier";

export { type RegressorType, type RegressorConfig, type TrainedRegressor, fitRegressor, trainAndEvaluateRegressor } from "./regressor";

export { type ClustererType, type ClustererConfig, type ClusteringResult, runClustering } from "./clusterer";

export {
  type EvaluationMetrics,
  type RegressionMetrics,
  type ClusteringMetrics,
  classificationMetrics,
  regressionMetrics,
  silhouetteScore,
  confusionMatrix,
} from "./evaluator";

export {
  type FeatureConfig,
  tokenize,
  buildVocabulary,
  bowVectorize,
  tfidfVectorize,
  normalizeFeatures,
  extractFeatures,
  extractNumericFeatures,
} from "./feature-engine";

export { type AutoTrainConfig, type AutoTrainResult, autoTrain, predictWithClassifier } from "./auto-trainer";

export { type StoredModel, modelStore } from "./model-store";
