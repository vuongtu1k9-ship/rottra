import { Secure } from "~/shared/utils/rng";
/**
 * Tree-of-Thought (ToT) Reasoning Engine
 * Mở rộng từ Chain-of-Thought với khả năng phân nhánh
 *
 * Khác với CoT:
 * - CoT: Linear chain (A → B → C)
 * - ToT: Tree structure (A → {B1, B2, B3} → {C1, C2, C3, C4, C5, C6})
 *
 * Ưu điểm:
 * - Khám phá nhiều paths cùng lúc
 * - So sánh và chọn path tốt nhất
 * - Backtrack khi path không hiệu quả
 * - Parallel evaluation
 */

import {
  createReasoningChain,
  executeReasoningChain,
  type ReasoningChain,
  type ReasoningStep,
  type ReasoningContext,
} from "./chain-of-thought";

// ===== TYPES =====

export interface ThoughtTree {
  id: string;
  root: ThoughtNode;
  bestPath: ThoughtNode[];
  allPaths: ThoughtNode[][];
  scores: Map<string, number>;
  metadata: TreeMetadata;
}

export interface ThoughtNode {
  id: string;
  thought: string;
  depth: number;
  score: number;
  confidence: number;
  children: ThoughtNode[];
  parent: ThoughtNode | null;
  evidence: string[];
  status: "active" | "expanded" | "pruned" | "completed";
}

export interface TreeMetadata {
  branchingFactor: number;
  maxDepth: number;
  totalNodes: number;
  expandedNodes: number;
  prunedNodes: number;
  evaluationCount: number;
  startTime: number;
  endTime?: number;
}

export interface ToTConfig {
  branchingFactor: number; // Số nhánh mỗi node
  maxDepth: number; // Chiều sâu tối đa
  beamWidth: number; // Số paths giữ lại mỗi level
  evaluationFn: (node: ThoughtNode) => number; // Hàm đánh giá
  pruningThreshold: number; // Cutoff score
}

// ===== DEFAULT CONFIG =====

const DEFAULT_CONFIG: ToTConfig = {
  branchingFactor: 3,
  maxDepth: 4,
  beamWidth: 2,
  evaluationFn: defaultEvaluation,
  pruningThreshold: 0.3,
};

// ===== CORE FUNCTIONS =====

/**
 * Tạo Thought Tree mới
 */
export function createThoughtTree(question: string, config?: Partial<ToTConfig>): ThoughtTree {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const root: ThoughtNode = {
    id: "root",
    thought: question,
    depth: 0,
    score: 0,
    confidence: 1.0,
    children: [],
    parent: null,
    evidence: [],
    status: "active",
  };

  return {
    id: `tot_${Date.now()}_${Secure.uuid().slice(2, 6)}`,
    root,
    bestPath: [],
    allPaths: [],
    scores: new Map(),
    metadata: {
      branchingFactor: fullConfig.branchingFactor,
      maxDepth: fullConfig.maxDepth,
      totalNodes: 1,
      expandedNodes: 0,
      prunedNodes: 0,
      evaluationCount: 0,
      startTime: Date.now(),
    },
  };
}

/**
 * Expand một node thành children
 */
function expandNode(node: ThoughtNode, config: ToTConfig, question: string): ThoughtNode[] {
  const children: ThoughtNode[] = [];

  for (let i = 0; i < config.branchingFactor; i++) {
    const child: ThoughtNode = {
      id: `${node.id}_${i}`,
      thought: generateAlternativeThought(node.thought, i, node.depth),
      depth: node.depth + 1,
      score: 0,
      confidence: node.confidence * 0.9, // Decrease with depth
      children: [],
      parent: node,
      evidence: [...node.evidence],
      status: "active",
    };

    children.push(child);
    node.children.push(child);
  }

  node.status = "expanded";
  return children;
}

/**
 * Generate alternative thought cho child node
 */
function generateAlternativeThought(parentThought: string, index: number, depth: number): string {
  const perspectives = [
    "Dựa trên dữ liệu: ",
    "Theo kinh nghiệm chuyên gia: ",
    "Từ phân tích xu hướng: ",
    "Với góc nhìn rủi ro: ",
    "Từ quan điểm tối ưu: ",
    "Dựa trên quy tắc: ",
    "Từ pattern lịch sử: ",
    "Với logic suy diễn: ",
    "Từ so sánh tương tự: ",
  ];

  const perspective = perspectives[index % perspectives.length];
  return `${perspective} ${parentThought}`;
}

/**
 * Đánh giá một ThoughtNode
 */
function evaluateNode(node: ThoughtNode, config: ToTConfig): number {
  // Simple heuristic evaluation
  let score = 0.5; // Base score

  // Depth penalty (prefer shorter paths)
  score -= node.depth * 0.05;

  // Evidence bonus
  score += node.evidence.length * 0.1;

  // Confidence factor
  score *= node.confidence;

  // Apply custom evaluation
  const customScore = config.evaluationFn(node);
  score = (score + customScore) / 2;

  // Clamp
  score = Math.max(0, Math.min(1, score));

  node.score = score;
  return score;
}

/**
 * Default evaluation function
 */
function defaultEvaluation(node: ThoughtNode): number {
  let score = 0.5;

  // Longer thoughts are slightly better (more detailed)
  if (node.thought.length > 50) score += 0.1;
  if (node.thought.length > 100) score += 0.1;

  // Evidence-based boost
  score += node.evidence.length * 0.05;

  return Math.min(1, score);
}

/**
 * Prune low-scoring branches
 */
function pruneBranches(tree: ThoughtTree, config: ToTConfig): void {
  function pruneNode(node: ThoughtNode) {
    if (node.children.length === 0) return;

    // Evaluate children
    for (const child of node.children) {
      evaluateNode(child, config);
      tree.metadata.evaluationCount++;
    }

    // Sort by score
    node.children.sort((a, b) => b.score - a.score);

    // Keep only beamWidth children
    if (node.children.length > config.beamWidth) {
      const pruned = node.children.splice(config.beamWidth);
      for (const p of pruned) {
        p.status = "pruned";
        tree.metadata.prunedNodes++;
      }
    }

    // Recurse
    for (const child of node.children) {
      if (child.status === "active") {
        pruneNode(child);
      }
    }
  }

  pruneNode(tree.root);
}

/**
 * Find best path through tree
 */
function findBestPath(tree: ThoughtTree): ThoughtNode[] {
  const path: ThoughtNode[] = [];
  let current = tree.root;

  while (current.children.length > 0) {
    path.push(current);

    // Find best child
    let bestChild = current.children[0];
    for (const child of current.children) {
      if (child.score > bestChild.score) {
        bestChild = child;
      }
    }

    current = bestChild;
  }

  // Add leaf
  path.push(current);

  return path;
}

/**
 * Collect all paths from root to leaves
 */
function collectAllPaths(node: ThoughtNode, currentPath: ThoughtNode[] = []): ThoughtNode[][] {
  const paths: ThoughtNode[][] = [];
  const newPath = [...currentPath, node];

  if (node.children.length === 0) {
    paths.push(newPath);
  } else {
    for (const child of node.children) {
      if (child.status !== "pruned") {
        paths.push(...collectAllPaths(child, newPath));
      }
    }
  }

  return paths;
}

// ===== MAIN EXECUTION =====

/**
 * Build và evaluate Thought Tree
 */
export function buildThoughtTree(question: string, config?: Partial<ToTConfig>): ThoughtTree {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const tree = createThoughtTree(question, fullConfig);

  // BFS expansion
  let currentLevel = [tree.root];

  for (let depth = 0; depth < fullConfig.maxDepth; depth++) {
    const nextLevel: ThoughtNode[] = [];

    for (const node of currentLevel) {
      if (node.status === "pruned") continue;

      // Expand node
      const children = expandNode(node, fullConfig, question);
      tree.metadata.totalNodes += children.length;
      tree.metadata.expandedNodes++;

      // Evaluate children
      for (const child of children) {
        evaluateNode(child, fullConfig);
        tree.metadata.evaluationCount++;
      }

      nextLevel.push(...children);
    }

    // Prune low-scoring branches
    tree.metadata.prunedNodes += Math.max(0, nextLevel.length - fullConfig.beamWidth * currentLevel.length);

    // Keep only top beams
    nextLevel.sort((a, b) => b.score - a.score);
    const kept = nextLevel.slice(0, fullConfig.beamWidth * currentLevel.length);
    currentLevel = kept;
  }

  // Find best path
  tree.bestPath = findBestPath(tree);

  // Collect all paths
  tree.allPaths = collectAllPaths(tree.root);

  // Store scores
  for (const path of tree.allPaths) {
    const pathId = path.map((n) => n.id).join("->");
    const avgScore = path.reduce((sum, n) => sum + n.score, 0) / path.length;
    tree.scores.set(pathId, avgScore);
  }

  tree.metadata.endTime = Date.now();
  return tree;
}

/**
 * Convert ThoughtTree to ReasoningChain
 */
export function treeToReasoningChain(tree: ThoughtTree): ReasoningChain {
  const steps: ReasoningStep[] = tree.bestPath.map((node, idx) => ({
    id: node.id,
    step: idx + 1,
    thought: node.thought,
    evidence: node.evidence.map((e, i) => ({
      type: "inference" as const,
      source: `tree_node_${node.id}`,
      content: e,
      confidence: node.confidence,
    })),
    confidence: node.confidence,
    reasoning: `Tree path score: ${node.score.toFixed(3)}`,
    dependencies: idx > 0 ? [idx] : [],
    status: node.status === "completed" ? "completed" : "completed",
  }));

  const conclusion = tree.bestPath.map((n) => n.thought).join(" → ");

  return {
    id: tree.id,
    question: tree.root.thought,
    strategy: "branching",
    steps,
    conclusion,
    confidence: tree.bestPath[tree.bestPath.length - 1]?.score || 0,
    evidenceCount: steps.reduce((sum, s) => sum + s.evidence.length, 0),
    alternatives: tree.allPaths.slice(1, 4).map((path) => ({
      conclusion: path.map((n) => n.thought).join(" → "),
      confidence: path[path.length - 1]?.score || 0,
      reasoning: "Alternative tree path",
    })),
    metadata: {
      domain: "general",
      complexity: tree.metadata.maxDepth > 3 ? "complex" : "moderate",
      startTime: tree.metadata.startTime,
      ...(tree.metadata.endTime !== undefined && { endTime: tree.metadata.endTime }),
      stepsCount: steps.length,
      evidenceCount: steps.reduce((sum, s) => sum + s.evidence.length, 0),
      rerunCount: 0,
    },
  };
}

/**
 * Format Thought Tree cho display
 */
export function formatThoughtTree(tree: ThoughtTree): string {
  const lines: string[] = [];

  lines.push("# Tree-of-Thought Analysis");
  lines.push(`**Question:** ${tree.root.thought}`);
  lines.push(`**Branching Factor:** ${tree.metadata.branchingFactor}`);
  lines.push(`**Max Depth:** ${tree.metadata.maxDepth}`);
  lines.push("");

  // Best path
  lines.push("## Best Path:");
  for (let i = 0; i < tree.bestPath.length; i++) {
    const node = tree.bestPath[i];
    const indent = "  ".repeat(i);
    lines.push(`${indent}${i === 0 ? "●" : "└─"} [${node.score.toFixed(2)}] ${node.thought.slice(0, 80)}...`);
  }
  lines.push("");

  // Statistics
  lines.push("## Statistics:");
  lines.push(`- Total Nodes: ${tree.metadata.totalNodes}`);
  lines.push(`- Expanded: ${tree.metadata.expandedNodes}`);
  lines.push(`- Pruned: ${tree.metadata.prunedNodes}`);
  lines.push(`- Evaluations: ${tree.metadata.evaluationCount}`);
  lines.push(`- Total Paths: ${tree.allPaths.length}`);
  lines.push("");

  // Top paths
  lines.push("## Top 3 Paths:");
  const sortedPaths = Array.from(tree.scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [pathId, score] of sortedPaths) {
    lines.push(`- Score ${score.toFixed(3)}: ${pathId}`);
  }

  return lines.join("\n");
}

/**
 * Quick ToT cho simple queries
 */
export async function quickToT(question: string, config?: Partial<ToTConfig>): Promise<string> {
  const tree = buildThoughtTree(question, config);
  return tree.bestPath.map((n) => n.thought).join(" → ");
}

/**
 * Deep ToT với ReasoningChain integration
 */
export async function deepToT(question: string, context: ReasoningContext, config?: Partial<ToTConfig>): Promise<ReasoningChain> {
  const tree = buildThoughtTree(question, config);
  return treeToReasoningChain(tree);
}
