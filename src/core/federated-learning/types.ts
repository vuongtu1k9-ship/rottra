/**
 * 🧠 ROTTRA — FEDERATED LEARNING TYPES
 * Type definitions for the FL system.
 */

// ── FL Round ─────────────────────────────────────────────────

export interface FLRoundConfig {
  /** Number of local epochs per node */
  localEpochs: number;
  /** Learning rate for local training */
  learningRate: number;
  /** Minimum nodes required to start aggregation */
  minNodes: number;
  /** Maximum time (ms) to wait for gradient submissions */
  timeoutMs: number;
  /** Differential privacy epsilon */
  dpEpsilon: number;
  /** Differential privacy delta */
  dpDelta: number;
  /** Target model type */
  modelType: "intent_classifier" | "embedding" | "pricing" | "forecast";
}

export interface FLRound {
  id: string;
  roundNumber: number;
  status: FLRoundStatus;
  globalModelId: string | null;
  config: FLRoundConfig;
  startedAt: Date | null;
  completedAt: Date | null;
  participantCount: number;
  aggregationMethod: string;
}

export type FLRoundStatus = "pending" | "collecting" | "aggregating" | "broadcasting" | "completed" | "failed";

// ── Gradient Updates ─────────────────────────────────────────

export interface GradientUpdate {
  id: string;
  roundId: string;
  nodeId: string;
  modelVersion: string;
  gradientHash: string;
  dataSampleCount: number;
  localLoss: number;
  localAccuracy: number;
  encryptedGradients: EncryptedPayload;
  submittedAt: Date;
  status: GradientStatus;
}

export type GradientStatus = "pending" | "verified" | "aggregated" | "rejected";

export interface EncryptedPayload {
  /** Encrypted gradient data (base64) */
  data: string;
  /** Encryption algorithm used */
  algorithm: string;
  /** Initialization vector */
  iv: string;
  /** Key identifier */
  keyId: string;
}

// ── Model Versioning ─────────────────────────────────────────

export interface ModelVersion {
  id: string;
  versionNumber: number;
  roundId: string;
  modelWeights: ModelWeights;
  modelHash: string;
  parentVersionId: string | null;
  metrics: ModelMetrics;
  createdAt: Date;
}

export interface ModelWeights {
  /** Serialized weight tensors */
  layers: LayerWeights[];
  /** Model architecture hash */
  architectureHash: string;
  /** Total parameters count */
  parameterCount: number;
}

export interface LayerWeights {
  name: string;
  weights: Float32Array;
  bias: Float32Array | null;
  shape: number[];
}

export interface ModelMetrics {
  accuracy: number;
  loss: number;
  f1Score: number;
  precision: number;
  recall: number;
  /** Per-class metrics */
  classMetrics?: Record<string, { precision: number; recall: number; f1: number }>;
}

// ── Node Management ──────────────────────────────────────────

export interface FLNode {
  id: string;
  nodeName: string;
  farmId: string | null;
  publicKey: string;
  lastSeen: Date;
  totalRoundsParticipated: number;
  reputationScore: number;
}

export interface NodeCapabilities {
  /** Supported model types */
  supportedModels: string[];
  /** Available compute resources */
  computePower: "low" | "medium" | "high";
  /** Network bandwidth estimate */
  bandwidthKbps: number;
  /** Storage available for models */
  storageMB: number;
}

// ── Privacy ──────────────────────────────────────────────────

export interface DPParams {
  epsilon: number;
  delta: number;
  /** Clip norm for gradient clipping */
  clipNorm: number;
  /** Noise multiplier */
  noiseMultiplier: number;
}

export interface PrivacyBudget {
  id: string;
  nodeId: string;
  epsilonUsed: number;
  epsilonLimit: number;
  deltaUsed: number;
  roundCount: number;
  updatedAt: Date;
}

// ── Blockchain Audit ─────────────────────────────────────────

export interface FLProvenanceRecord {
  id: string;
  roundId: string;
  modelId: string;
  modelHash: string;
  /** SHA-256 chain */
  previousHash: string;
  currentHash: string;
  /** Participating node IDs */
  participantNodes: string[];
  /** Aggregation method used */
  aggregationMethod: string;
  /** DP parameters used */
  dpParams: DPParams;
  /** Model metrics */
  metrics: ModelMetrics;
  timestamp: Date;
}

// ── Aggregation ──────────────────────────────────────────────

export interface AggregationResult {
  roundId: string;
  aggregatedWeights: ModelWeights;
  participantCount: number;
  totalSamples: number;
  /** Weighted average loss */
  avgLoss: number;
  /** Weighted average accuracy */
  avgAccuracy: number;
  /** Per-node contribution weights */
  nodeWeights: Map<string, number>;
  /** Aggregation duration (ms) */
  durationMs: number;
}

// ── API Types ────────────────────────────────────────────────

export interface StartRoundRequest {
  config: Partial<FLRoundConfig>;
}

export interface StartRoundResponse {
  roundId: string;
  status: FLRoundStatus;
  globalModelId: string | null;
}

export interface SubmitGradientRequest {
  roundId: string;
  nodeId: string;
  encryptedGradients: EncryptedPayload;
  metrics: {
    localLoss: number;
    localAccuracy: number;
    dataSampleCount: number;
  };
}

export interface SubmitGradientResponse {
  accepted: boolean;
  message: string;
}

export interface GetModelResponse {
  modelId: string;
  weights: ModelWeights;
  metrics: ModelMetrics;
  roundId: string;
}

export interface FLStatusResponse {
  activeRounds: FLRound[];
  nodes: FLNode[];
  totalModels: number;
  latestRound: FLRound | null;
}

// ── Events ───────────────────────────────────────────────────

export type FLEvent =
  | { type: "round_started"; roundId: string; config: FLRoundConfig }
  | { type: "gradient_received"; roundId: string; nodeId: string }
  | { type: "aggregation_started"; roundId: string }
  | { type: "aggregation_completed"; roundId: string; modelId: string }
  | { type: "model_broadcast"; roundId: string; modelId: string }
  | { type: "round_completed"; roundId: string; metrics: ModelMetrics }
  | { type: "round_failed"; roundId: string; error: string }
  | { type: "node_joined"; nodeId: string; nodeName: string }
  | { type: "node_left"; nodeId: string };
