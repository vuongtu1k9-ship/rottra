import { Secure } from "~/shared/utils/rng";
/**
 * Chain-of-Thought (CoT) Reasoning Engine
 * Hệ thống suy luận theo chuỗi tư duy
 *
 * Khả năng:
 * - Decompose câu hỏi phức tạp thành các bước nhỏ
 * - Thu thập evidence cho mỗi bước
 * - Đánh giá confidence từng bước
 * - Tổng hợp thành conclusion
 * - Multi-strategy: sequential, branching, recursive
 *
 * Ứng dụng:
 * - Phân tích giá nông sản (why giá tăng/giảm)
 * - Dự báo mùa vụ (nên trồng gì, khi nào)
 * - Tối ưu logistics (tuyến đường nào tốt nhất)
 * - Phân tích rủi ro (what could go wrong)
 */

import { detectDomain, getRelevantKnowledge } from "./cross-domain-learning";
import { analyzeEmotion, type EmotionResult } from "./emotion-recognition";
import { generateTextLocal } from "../nlp-cognitive/ai-sdk";

// ===== TELEMETRY =====
let telemetryWs: WebSocket | null = null;
function broadcastTelemetry(payload: any) {
  try {
    if (!telemetryWs || telemetryWs.readyState === WebSocket.CLOSED) {
      telemetryWs = new WebSocket("ws://localhost:8080/?room=global");
    }
    if (telemetryWs.readyState === WebSocket.OPEN) {
      telemetryWs.send(JSON.stringify(payload));
    } else if (telemetryWs.readyState === WebSocket.CONNECTING) {
      telemetryWs.addEventListener("open", () => {
        telemetryWs?.send(JSON.stringify(payload));
      }, { once: true });
    }
  } catch (e) {
    console.error("[Telemetry] Failed to broadcast:", e);
  }
}

// ===== TYPES =====

export interface ReasoningChain {
  id: string;
  question: string;
  strategy: ReasoningStrategy;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
  evidenceCount: number;
  alternatives: AlternativeConclusion[];
  metadata: ReasoningMetadata;
}

export interface ReasoningStep {
  id: string;
  step: number;
  thought: string;
  evidence: Evidence[];
  confidence: number;
  reasoning: string;
  dependencies: number[]; // Steps this depends on
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface Evidence {
  type: "data" | "rule" | "pattern" | "inference" | "external";
  source: string;
  content: string;
  confidence: number;
  timestamp?: number;
}

export interface AlternativeConclusion {
  conclusion: string;
  confidence: number;
  reasoning: string;
}

export interface ReasoningMetadata {
  domain: string;
  complexity: "simple" | "moderate" | "complex";
  startTime: number;
  endTime?: number;
  stepsCount: number;
  evidenceCount: number;
  rerunCount: number;
}

export type ReasoningStrategy =
  | "sequential" // Từng bước một
  | "branching" // Phân nhánh
  | "recursive" // Đệ quy
  | "analogical" // So sánh tương tự
  | "causal" // Nguyên nhân - kết quả
  | "deductive" // Suy diễn
  | "inductive" // Quy nạp
  | "abductive"; // Suy luận tốt nhất

export interface ReasoningContext {
  domain: string;
  history: ReasoningChain[];
  userProfile?: any;
  emotionalState?: EmotionResult;
  constraints: string[];
  availableData: Record<string, any>;
}

// ===== REASONING STRATEGIES =====

/**
 * Sequential Reasoning: Từng bước theo thứ tự
 */
function sequentialReasoning(question: string, context: ReasoningContext): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Step 1: Understand the question
  steps.push({
    id: `step_${Date.now()}_1`,
    step: 1,
    thought: `Phân tích câu hỏi: "${question}"`,
    evidence: [
      {
        type: "inference",
        source: "question_analysis",
        content: `Câu hỏi thuộc domain: ${context.domain}`,
        confidence: 0.9,
      },
    ],
    confidence: 0.9,
    reasoning: "Xác định cấu trúc và ý định của câu hỏi",
    dependencies: [],
    status: "pending",
  });

  // Step 2: Gather relevant knowledge
  steps.push({
    id: `step_${Date.now()}_2`,
    step: 2,
    thought: "Thu thập kiến thức liên quan từ knowledge base",
    evidence: [
      {
        type: "data",
        source: "knowledge_graph",
        content: "Truy xuất kiến thức từ graph",
        confidence: 0.85,
      },
    ],
    confidence: 0.85,
    reasoning: "Tìm kiếm thông tin hỗ trợ trả lời",
    dependencies: [1],
    status: "pending",
  });

  // Step 3: Apply domain logic
  steps.push({
    id: `step_${Date.now()}_3`,
    step: 3,
    thought: "Áp dụng logic chuyên ngành",
    evidence: [
      {
        type: "rule",
        source: "domain_rules",
        content: "Sử dụng các quy tắc chuyên ngành",
        confidence: 0.8,
      },
    ],
    confidence: 0.8,
    reasoning: "Kết nối kiến thức với câu hỏi",
    dependencies: [2],
    status: "pending",
  });

  // Step 4: Draw conclusion
  steps.push({
    id: `step_${Date.now()}_4`,
    step: 4,
    thought: "Tổng hợp và đưa ra kết luận",
    evidence: steps.slice(0, 3).map((s) => ({
      type: "inference" as const,
      source: `step_${s.step}`,
      content: s.thought,
      confidence: s.confidence,
    })),
    confidence: 0.75,
    reasoning: "Kết hợp tất cả evidence để tạo conclusion",
    dependencies: [1, 2, 3],
    status: "pending",
  });

  return steps;
}

/**
 * Branching Reasoning: Phân nhánh tìm nhiều paths
 */
function branchingReasoning(question: string, context: ReasoningContext): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Root: Understand question
  steps.push({
    id: `step_${Date.now()}_root`,
    step: 1,
    thought: `Phân tích gốc: "${question}"`,
    evidence: [],
    confidence: 0.95,
    reasoning: "Xác định điểm xuất phát",
    dependencies: [],
    status: "pending",
  });

  // Branch A: Data-driven approach
  steps.push({
    id: `step_${Date.now()}_a`,
    step: 2,
    thought: "Phân nhánh A: Dựa trên dữ liệu lịch sử",
    evidence: [{ type: "data", source: "historical", content: "Dữ liệu quá khứ", confidence: 0.8 }],
    confidence: 0.8,
    reasoning: "Approach 1: Data analysis",
    dependencies: [1],
    status: "pending",
  });

  // Branch B: Rule-based approach
  steps.push({
    id: `step_${Date.now()}_b`,
    step: 3,
    thought: "Phân nhánh B: Dựa trên quy tắc chuyên gia",
    evidence: [{ type: "rule", source: "expert_rules", content: "Quy tắc chuyên gia", confidence: 0.75 }],
    confidence: 0.75,
    reasoning: "Approach 2: Expert rules",
    dependencies: [1],
    status: "pending",
  });

  // Branch C: Pattern-based approach
  steps.push({
    id: `step_${Date.now()}_c`,
    step: 4,
    thought: "Phân nhánh C: Dựa trên pattern recognition",
    evidence: [{ type: "pattern", source: "patterns", content: "Pattern matching", confidence: 0.7 }],
    confidence: 0.7,
    reasoning: "Approach 3: Pattern matching",
    dependencies: [1],
    status: "pending",
  });

  // Merge: Combine branches
  steps.push({
    id: `step_${Date.now()}_merge`,
    step: 5,
    thought: "Tổng hợp các nhánh",
    evidence: [
      { type: "inference", source: "branch_a", content: "Kết quả nhánh A", confidence: 0.8 },
      { type: "inference", source: "branch_b", content: "Kết quả nhánh B", confidence: 0.75 },
      { type: "inference", source: "branch_c", content: "Kết quả nhánh C", confidence: 0.7 },
    ],
    confidence: 0.85,
    reasoning: "Kết hợpweighted từ 3 nhánh",
    dependencies: [2, 3, 4],
    status: "pending",
  });

  return steps;
}

/**
 * Causal Reasoning: Nguyên nhân - Kết quả
 */
function causalReasoning(question: string, context: ReasoningContext): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Identify the effect/observation
  steps.push({
    id: `step_${Date.now()}_effect`,
    step: 1,
    thought: "Xác định hiện tượng/quan sát",
    evidence: [{ type: "data", source: "observation", content: question, confidence: 0.9 }],
    confidence: 0.9,
    reasoning: "Định nghĩa vấn đề cần giải thích",
    dependencies: [],
    status: "pending",
  });

  // Find potential causes
  steps.push({
    id: `step_${Date.now()}_causes`,
    step: 2,
    thought: "Tìm các nguyên nhân tiềm ẩn",
    evidence: [{ type: "pattern", source: "causal_patterns", content: "Các pattern nguyên nhân thường gặp", confidence: 0.8 }],
    confidence: 0.8,
    reasoning: "Liệt kê các yếu tố có thể gây ra",
    dependencies: [1],
    status: "pending",
  });

  // Evaluate each cause
  steps.push({
    id: `step_${Date.now()}_evaluate`,
    step: 3,
    thought: "Đánh giá từng nguyên nhân",
    evidence: [{ type: "inference", source: "evaluation", content: "So sánh evidence", confidence: 0.75 }],
    confidence: 0.75,
    reasoning: "Xác định nguyên nhân có khả năng nhất",
    dependencies: [2],
    status: "pending",
  });

  // Establish causal chain
  steps.push({
    id: `step_${Date.now()}_chain`,
    step: 4,
    thought: "Xây dựng chuỗi nguyên nhân - kết quả",
    evidence: [{ type: "inference", source: "causal_chain", content: "Chuỗi A → B → C", confidence: 0.7 }],
    confidence: 0.7,
    reasoning: "Mô tả cơ chế cause-effect",
    dependencies: [3],
    status: "pending",
  });

  return steps;
}

// ===== CORE REASONING ENGINE =====

/**
 * Tạo reasoning chain mới
 */
export function createReasoningChain(
  question: string,
  strategy: ReasoningStrategy = "sequential",
  context?: Partial<ReasoningContext>,
): ReasoningChain {
  const domain = detectDomain(question);
  const fullContext: ReasoningContext = {
    domain: domain.domain,
    history: context?.history || [],
    constraints: context?.constraints || [],
    availableData: context?.availableData || {},
  };

  let steps: ReasoningStep[];

  switch (strategy) {
    case "branching":
      steps = branchingReasoning(question, fullContext);
      break;
    case "causal":
      steps = causalReasoning(question, fullContext);
      break;
    case "sequential":
    default:
      steps = sequentialReasoning(question, fullContext);
      break;
  }

  return {
    id: `chain_${Date.now()}_${Secure.uuid().slice(2, 6)}`,
    question,
    strategy,
    steps,
    conclusion: "",
    confidence: 0,
    evidenceCount: 0,
    alternatives: [],
    metadata: {
      domain: domain.domain,
      complexity: assessComplexity(question),
      startTime: Date.now(),
      stepsCount: steps.length,
      evidenceCount: 0,
      rerunCount: 0,
    },
  };
}

/**
 * Execute reasoning chain
 */
export async function executeReasoningChain(chain: ReasoningChain, context: ReasoningContext): Promise<ReasoningChain> {
  const updated = { ...chain };

  for (const step of updated.steps) {
    step.status = "in_progress";

    try {
      // Check dependencies
      const depsCompleted = step.dependencies.every((depIdx) => updated.steps.find((s) => s.step === depIdx)?.status === "completed");

      if (!depsCompleted) {
        step.status = "failed";
        step.reasoning += " [Dependency not met]";
        continue;
      }

      // Execute step
      await executeStep(step, context);

      step.status = "completed";

      // LẤY DỮ LIỆU THỰC TẾ: Broadcast telemetry cho Vector Viewer
      const currentOverallConfidence = calculateOverallConfidence(updated);
      broadcastTelemetry({
        type: "vector_tracking",
        id: updated.id,
        loss: 1 - currentOverallConfidence, // Càng tự tin, Loss càng giảm về 0 (Tâm)
        angle: (step.step * Math.PI * 2) / updated.steps.length, // Xoay vòng theo số bước
        label: step.thought.length > 30 ? step.thought.slice(0, 30) + '...' : step.thought,
        status: "learning"
      });

    } catch (error) {
      step.status = "failed";
      step.reasoning += ` [Error: ${error}]`;
    }
  }

  // Generate conclusion
  updated.conclusion = generateConclusion(updated);
  updated.confidence = calculateOverallConfidence(updated);
  updated.evidenceCount = countEvidence(updated);
  updated.alternatives = generateAlternatives(updated);
  updated.metadata.endTime = Date.now();

  // Broadcast final converged state
  broadcastTelemetry({
    type: "vector_tracking",
    id: updated.id,
    loss: Math.max(0.01, 1 - updated.confidence), // Đảm bảo không đè hẳn lên 0 nếu confidence không phải 100%
    angle: Math.PI * 2,
    label: `Hội tụ (${(updated.confidence * 100).toFixed(0)}%)`,
    status: "converged"
  });

  return updated;
}

/**
 * Execute single step
 */
async function executeStep(step: ReasoningStep, context: ReasoningContext): Promise<void> {
  // Gather evidence based on step type
  const knowledge = getRelevantKnowledge(step.thought, 3);

  for (const k of knowledge) {
    for (const concept of k.concepts) {
      step.evidence.push({
        type: "data",
        source: `knowledge_${k.domain}`,
        content: `${concept.name}: ${concept.definition}`,
        confidence: concept.importance,
      });
    }
  }

  // Add context-specific evidence
  if (context.availableData) {
    for (const [key, value] of Object.entries(context.availableData)) {
      if (step.thought.toLowerCase().includes(key.toLowerCase())) {
        step.evidence.push({
          type: "data",
          source: "context_data",
          content: JSON.stringify(value).slice(0, 200),
          confidence: 0.8,
        });
      }
    }
  }

  // Update step confidence based on evidence
  if (step.evidence.length > 0) {
    const avgConfidence = step.evidence.reduce((sum, e) => sum + e.confidence, 0) / step.evidence.length;
    step.confidence = (step.confidence + avgConfidence) / 2;
  }
}

/**
 * Generate conclusion from steps
 */
function generateConclusion(chain: ReasoningChain): string {
  const completedSteps = chain.steps.filter((s) => s.status === "completed");

  if (completedSteps.length === 0) {
    return "Không thể đưa ra kết luận do thiếu dữ liệu.";
  }

  const evidenceSummary = completedSteps
    .flatMap((s) => s.evidence)
    .map((e) => e.content)
    .join("; ");

  const conclusionParts: string[] = [];

  conclusionParts.push(`**Phân tích:** ${chain.question}`);

  for (const step of completedSteps) {
    conclusionParts.push(`- Bước ${step.step}: ${step.thought}`);
  }

  conclusionParts.push(`\n**Kết luận:** Dựa trên ${chain.evidenceCount} evidence từ ${completedSteps.length} bước suy luận.`);

  // Add confidence assessment
  const confidence = calculateOverallConfidence(chain);
  if (confidence >= 0.8) {
    conclusionParts.push("Độ tin cậy: CAO");
  } else if (confidence >= 0.6) {
    conclusionParts.push("Độ tin cậy: TRUNG BÌNH");
  } else {
    conclusionParts.push("Độ tin cậy: THẤP - cần thêm dữ liệu");
  }

  return conclusionParts.join("\n");
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(chain: ReasoningChain): number {
  const completedSteps = chain.steps.filter((s) => s.status === "completed");
  if (completedSteps.length === 0) return 0;

  // Weighted average (later steps have more weight)
  let totalWeight = 0;
  let weightedSum = 0;

  for (const step of completedSteps) {
    const weight = step.step / chain.steps.length;
    weightedSum += step.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Count total evidence
 */
function countEvidence(chain: ReasoningChain): number {
  return chain.steps.reduce((count, step) => count + step.evidence.length, 0);
}

/**
 * Generate alternative conclusions
 */
function generateAlternatives(chain: ReasoningChain): AlternativeConclusion[] {
  const alternatives: AlternativeConclusion[] = [];

  // Alternative 1: Less confident path
  alternatives.push({
    conclusion: `Nếu giảm bớt dữ liệu, kết luận sẽ là: ${chain.conclusion.slice(0, 100)}...`,
    confidence: chain.confidence * 0.7,
    reasoning: "Ít evidence hơn",
  });

  // Alternative 2: Different perspective
  alternatives.push({
    conclusion: `Quan điểm khác: Câu hỏi có thể hiểu theo cách khác`,
    confidence: chain.confidence * 0.5,
    reasoning: "Perspective shift",
  });

  return alternatives;
}

/**
 * Assess question complexity
 */
function assessComplexity(question: string): ReasoningChain["metadata"]["complexity"] {
  const wordCount = question.split(/\s+/).length;
  const hasMultipleParts = question.includes("và") || question.includes("hay") || question.includes("hoặc");

  if (wordCount > 20 || hasMultipleParts) return "complex";
  if (wordCount > 10) return "moderate";
  return "simple";
}

/**
 * Format reasoning chain cho display
 */
export function formatReasoningChain(chain: ReasoningChain): string {
  const lines: string[] = [];

  lines.push(`# Chain-of-Thought Reasoning`);
  lines.push(`**Câu hỏi:** ${chain.question}`);
  lines.push(`**Strategy:** ${chain.strategy}`);
  lines.push(`**Domain:** ${chain.metadata.domain}`);
  lines.push("");

  lines.push("## Các bước suy luận:");
  for (const step of chain.steps) {
    const statusIcon = step.status === "completed" ? "✅" : step.status === "failed" ? "❌" : "⏳";
    lines.push(`${statusIcon} **Bước ${step.step}:** ${step.thought}`);
    lines.push(`   Confidence: ${(step.confidence * 100).toFixed(1)}%`);

    if (step.evidence.length > 0) {
      lines.push(`   Evidence:`);
      for (const evidence of step.evidence) {
        lines.push(`     - [${evidence.type}] ${evidence.content.slice(0, 80)}...`);
      }
    }
    lines.push("");
  }

  lines.push("## Kết luận:");
  lines.push(chain.conclusion);
  lines.push("");
  lines.push(`**Overall Confidence:** ${(chain.confidence * 100).toFixed(1)}%`);
  lines.push(`**Total Evidence:** ${chain.evidenceCount}`);

  if (chain.alternatives.length > 0) {
    lines.push("");
    lines.push("## Kết luận thay thế:");
    for (const alt of chain.alternatives) {
      lines.push(`- (${(alt.confidence * 100).toFixed(0)}%) ${alt.conclusion}`);
    }
  }

  return lines.join("\n");
}

/**
 * Quick reasoning cho simple queries
 */
export async function quickReason(question: string, data?: Record<string, any>): Promise<string> {
  const context: Partial<ReasoningContext> = data ? { availableData: data } : {};
  const chain = createReasoningChain(question, "sequential", context);
  const executed = await executeReasoningChain(chain, {
    domain: chain.metadata.domain,
    history: [],
    constraints: [],
    availableData: data || {},
  });

  return executed.conclusion;
}

/**
 * Deep reasoning cho complex queries
 */
export async function deepReason(question: string, context: ReasoningContext): Promise<ReasoningChain> {
  // Try multiple strategies
  const strategies: ReasoningStrategy[] = ["sequential", "branching", "causal"];
  const chains: ReasoningChain[] = [];

  for (const strategy of strategies) {
    const chain = createReasoningChain(question, strategy, context);
    const executed = await executeReasoningChain(chain, context);
    chains.push(executed);
  }

  // Select best chain
  chains.sort((a, b) => b.confidence - a.confidence);
  return chains[0];
}
