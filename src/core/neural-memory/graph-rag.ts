import { db } from "~/infra/database/db-pool";
import { agentMemory, vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding, cleanAndNormalize } from "~/core/neural-memory/vector-rag";
import { cosineSimilarityZeroAlloc } from "~/core/quant-engine/vector-simd";

export interface GraphNode {
  id: string; // Normalized unique ID
  label: string; // Display name
  type: string; // e.g., "Concept", "Entity", "Person", "Project", "Variable", "Metric"
  description: string;
  vector?: number[]; // Cached dense vector embedding
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface GraphRAGResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mermaidCode: string;
  contextText: string;
  confidence: number;
}

export interface CSRGraph {
  nodes: GraphNode[];
  nodeToIndex: Map<string, number>;
  rowOffsets: Uint32Array;
  columnIndices: Uint32Array;
  edgeWeights: Float32Array;
  edgeRelations: string[];
}

// Global static nodes matching initial system design
const globalNodes = new Map<string, GraphNode>();
const globalEdges: GraphEdge[] = [];
let cachedCSR: CSRGraph | null = (globalThis as any)._cachedCSR || null;

// Graph cache to prevent 300MB+ Postgres I/O on every request
let cachedGraphNodes: GraphNode[] | null = (globalThis as any)._cachedGraphNodes || null;
let cachedGraphEdges: GraphEdge[] | null = (globalThis as any)._cachedGraphEdges || null;
let lastGraphBuildTime = (globalThis as any)._lastGraphBuildTime || 0;
const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper to normalize concept IDs
const normalizeId = (text: string): string => {
  return cleanAndNormalize(text).replace(/\s+/g, "_").trim();
};

// Add a node safely
const addNode = (label: string, type: string, description: string) => {
  const id = normalizeId(label);
  if (!id) return;
  if (!globalNodes.has(id)) {
    globalNodes.set(id, { id, label, type, description });
  } else {
    // Update description if new one is more comprehensive
    const existing = globalNodes.get(id)!;
    if (description.length > existing.description.length) {
      existing.description = description;
    }
  }
};

// Add an edge safely
const addEdge = (sourceLabel: string, targetLabel: string, relation: string, weight = 1.0) => {
  const source = normalizeId(sourceLabel);
  const target = normalizeId(targetLabel);
  if (!source || !target || source === target) return;

  const exists = globalEdges.some((e) => e.source === source && e.target === target && e.relation === relation);
  if (!exists) {
    globalEdges.push({ source, target, relation, weight });
  }
};

// Rules-based entity extraction and graph building
export const buildKnowledgeGraph = async (forceBuild = false) => {
  if (!forceBuild && cachedGraphNodes && cachedGraphEdges && Date.now() - lastGraphBuildTime < GRAPH_CACHE_TTL_MS) {
    console.log("[GraphRAG] Cache HIT - Skipping DB Query");
    return { nodes: cachedGraphNodes, edges: cachedGraphEdges };
  }

  console.log("[GraphRAG] Cache MISS - Rebuilding from DB...");

  if (!forceBuild && globalNodes.size > 0) return { nodes: Array.from(globalNodes.values()), edges: globalEdges };

  const { AgentKnowledgeBase } = await import("~/core/neural-memory/knowledge-base");
  const { ALL_DOMAIN_TRAINING_PAIRS } = await import("~/core/nlp-cognitive/domain-training-data");

  globalNodes.clear();
  globalEdges.length = 0;

  // 1. Process Static Academic Knowledge Base
  for (const [category, items] of Object.entries(AgentKnowledgeBase)) {
    for (const item of items) {
      const parentLabel = item.title;
      addNode(parentLabel, "Concept", item.definition);

      // Extract formulas if any
      if (item.formulas && item.formulas.length > 0) {
        item.formulas.forEach((formula) => {
          const parts = formula.split(":");
          const formulaLabel = parts[0]?.trim() || "Công thức";
          const formulaText = parts[1]?.trim() || formula;
          addNode(formulaLabel, "Formula", formulaText);
          addEdge(parentLabel, formulaLabel, "DÙNG_CÔNG_THỨC");
        });
      }

      // Add related keyword relationships
      if (item.subtitle) {
        addNode(item.subtitle, "Subtitle/Sub-concept", item.explanation);
        addEdge(parentLabel, item.subtitle, "MÔ_TẢ_BỞI");
      }

      // Pre-defined academic semantic links
      const cleanTitle = cleanAndNormalize(item.title);
      if (cleanTitle.includes("descriptive") || cleanTitle.includes("mo ta")) {
        addNode("Phương sai mẫu", "Variable/Metric", "Đo lường mức độ biến động sản lượng.");
        addNode("Độ lệch chuẩn", "Variable/Metric", "Căn bậc hai của phương sai mẫu.");
        addEdge(parentLabel, "Phương sai mẫu", "TÍNH_TOÁN");
        addEdge("Phương sai mẫu", "Độ lệch chuẩn", "SUY_RA");
      }
      if (cleanTitle.includes("deltafosb") || cleanTitle.includes("nghien") || cleanTitle.includes("khen thuong")) {
        addNode("DeltaFosB", "Protein/Switch", "Công tắc phân tử cho hành vi dài hạn và thích nghi tích cực.");
        addNode("Hệ thống khen thưởng", "Neurobiology", "Hệ thống thúc đẩy động lực, thói quen và học tập.");
        addNode("Độ dẻo Synapse", "Neurobiology", "Khả năng thích ứng của hệ thần kinh trước các kích thích.");
        addEdge("Hệ thống khen thưởng", "DeltaFosB", "KÍCH_HOẠT");
        addEdge("DeltaFosB", "Độ dẻo Synapse", "THÚC_ĐẨY");
      }
      if (cleanTitle.includes("bertrand") || cleanTitle.includes("oligopoly") || cleanTitle.includes("doc quyen")) {
        addNode("Cạnh tranh Bertrand", "Theory/Model", "Mô hình cạnh tranh giá cả trong thị trường độc quyền nhóm.");
        addNode("Độc quyền nhóm", "Economics", "Thị trường có số lượng ít người bán chi phối.");
        addEdge("Cạnh tranh Bertrand", "Độc quyền nhóm", "MÔ_TẢ");
      }
      if (cleanTitle.includes("olbers") || cleanTitle.includes("nghich ly")) {
        addNode("Nghịch lý Olbers", "Paradox", "Nghịch lý vũ trụ về việc tại sao bầu trời ban đêm lại tối.");
        addNode("Vũ trụ giãn nở", "Theory/Cosmology", "Lý thuyết giải thích hiện đại cho bầu trời đêm tối.");
        addEdge("Nghịch lý Olbers", "Vũ trụ giãn nở", "GIẢI_THÍCH_BỞI");
      }
      if (cleanTitle.includes("kalman")) {
        addNode("Bộ lọc Kalman", "Algorithm", "Thuật toán ước lượng trạng thái từ dữ liệu nhiễu.");
        addNode("Cảm biến IoT", "Hardware", "Thiết bị thu thập thông số môi trường nông nghiệp.");
        addEdge("Bộ lọc Kalman", "Cảm biến IoT", "HIỆU_CHUẨN");
      }
    }
  }

  // 2. Process Static Curriculum
  for (const pair of ALL_DOMAIN_TRAINING_PAIRS) {
    const intent = pair.intent;
    const utterance = pair.utterance;

    const nodeLabel = utterance.length > 50 ? utterance.slice(0, 47) + "..." : utterance;
    addNode(nodeLabel, `Curriculum/${intent}`, utterance);

    // Contextual matches
    const utteranceClean = utterance.toLowerCase();
    if (utteranceClean.includes("collatz")) {
      addNode("Thanh Long", "Gate", "Cổng Phía Đông - Hub Logistics (Collatz Depth).");
      addEdge("Thanh Long", nodeLabel, "LIÊN_KẾT_VẬN_HÀNH");
    }
    if (utteranceClean.includes("kalman")) {
      addNode("Kỳ Lân", "Gate", "Cổng Phía Tây - Kho Nông Sản (Kalman Calibration).");
      addEdge("Kỳ Lân", nodeLabel, "LIÊN_KẾT_VẬN_HÀNH");
    }
    if (utteranceClean.includes("deltafosb") || utteranceClean.includes("nghien") || utteranceClean.includes("khen thuong")) {
      addNode("DeltaFosB", "Protein/Switch", "Công tắc phân tử cho hành vi dài hạn và thích nghi tích cực.");
      addNode("Hệ thống khen thưởng", "Neurobiology", "Hệ thống thúc đẩy động lực, thói quen và học tập.");
      addEdge("Hệ thống khen thưởng", "DeltaFosB", "KÍCH_HOẠT");
      addEdge("DeltaFosB", nodeLabel, "THÀNH_PHẦN_ĐÀO_TẠO");
    }
  }

  // 3. Process Dynamic User Memories from Database
  try {
    const memories = await db.select().from(agentMemory).where(eq(agentMemory.contextKey, "user_training"));
    for (const mem of memories) {
      const text = (mem.contextValue as any)?.text;
      if (text) {
        // Parse sentences for entities & relations using standard grammatical regex
        const matchOf = text.match(/(.+?)\s+là\s+(.+?)\s+của\s+(.+?)(?:\.|$)/i);
        if (matchOf && matchOf[1] && matchOf[2] && matchOf[3]) {
          const nodeA = matchOf[1].trim();
          const relation = matchOf[2].trim();
          const nodeC = matchOf[3].trim();
          addNode(nodeA, "Person/Entity", `Thành phần động: ${nodeA}`);
          addNode(nodeC, "Project/Entity", `Dự án/Hệ thống: ${nodeC}`);
          addEdge(nodeA, nodeC, relation.toUpperCase().replace(/\s+/g, "_"));
        } else {
          const matchIs = text.match(/(.+?)\s+là\s+(.+?)(?:\.|$)/i);
          if (matchIs && matchIs[1] && matchIs[2]) {
            const nodeA = matchIs[1].trim();
            const nodeB = matchIs[2].trim();
            addNode(nodeA, "Entity", `Thành phần động: ${nodeA}`);
            addNode(nodeB, "Attribute/Role", nodeB);
            addEdge(nodeA, nodeB, "LÀ");
          } else {
            addNode(text.slice(0, 30) + "...", "Dynamic Memory", text);
          }
        }
      }
    }
  } catch (e) {
    console.error("[GraphRAG] Failed to load dynamic database memories:", e);
  }

  // 4. Process Dynamic Vector Documents (LLM Wiki Cards) from Database
  try {
    const docs = await db.select().from(vectorDocument);
    for (const doc of docs) {
      const parentLabel = doc.title;
      addNode(parentLabel, doc.category || "WikiCard", doc.subtitle || doc.content.slice(0, 150) + "...");

      const meta = doc.metadata as any;
      if (meta && meta.relatedTopics) {
        const related = Array.isArray(meta.relatedTopics) ? meta.relatedTopics : [meta.relatedTopics];
        related.forEach((topic: string) => {
          addNode(topic, "Concept", `Chủ đề liên quan đến ${parentLabel}`);
          addEdge(parentLabel, topic, "LIÊN_KẾT_VỚI");
        });
      }
      if (meta && meta.references) {
        const refs = Array.isArray(meta.references) ? meta.references : [meta.references];
        refs.forEach((ref: string) => {
          addNode(ref, "Reference", `Nguồn tham chiếu của ${parentLabel}`);
          addEdge(parentLabel, ref, "THAM_CHIÊU_TỪ");
        });
      }
    }
  } catch (e) {
    console.error("[GraphRAG] Failed to load vectorDocument memories:", e);
  }

  cachedGraphNodes = Array.from(globalNodes.values());
  cachedGraphEdges = [...globalEdges];
  lastGraphBuildTime = Date.now();

  (globalThis as any)._cachedGraphNodes = cachedGraphNodes;
  (globalThis as any)._cachedGraphEdges = cachedGraphEdges;
  (globalThis as any)._lastGraphBuildTime = lastGraphBuildTime;

  return { nodes: cachedGraphNodes, edges: cachedGraphEdges };
};

// Compile standard node/edge structures into CSR representation
export function compileCSRGraph(nodes: GraphNode[], edges: GraphEdge[]): CSRGraph {
  const V = nodes.length;
  const nodeToIndex = new Map<string, number>();
  nodes.forEach((node, idx) => {
    nodeToIndex.set(node.id, idx);
  });

  // Pre-allocate adjacency list arrays
  const adj: { targetIdx: number; weight: number; relation: string }[][] = Array.from({ length: V }, () => []);

  edges.forEach((edge) => {
    const uIdx = nodeToIndex.get(edge.source);
    const vIdx = nodeToIndex.get(edge.target);
    if (uIdx !== undefined && vIdx !== undefined) {
      // Direct edge
      adj[uIdx].push({ targetIdx: vIdx, weight: edge.weight, relation: edge.relation });
      // Reverse edge (undirected traversal behavior to support bidirectional hops)
      adj[vIdx].push({ targetIdx: uIdx, weight: edge.weight, relation: edge.relation + "_REV" });
    }
  });

  const totalEdgesCount = adj.reduce((acc, list) => acc + list.length, 0);

  const rowOffsets = new Uint32Array(V + 1);
  const columnIndices = new Uint32Array(totalEdgesCount);
  const edgeWeights = new Float32Array(totalEdgesCount);
  const edgeRelations: string[] = new Array(totalEdgesCount);

  let currentOffset = 0;
  for (let i = 0; i < V; i++) {
    rowOffsets[i] = currentOffset;
    const neighbors = adj[i];
    for (let j = 0; j < neighbors.length; j++) {
      const neighbor = neighbors[j];
      columnIndices[currentOffset] = neighbor.targetIdx;
      edgeWeights[currentOffset] = neighbor.weight;
      edgeRelations[currentOffset] = neighbor.relation;
      currentOffset++;
    }
  }
  rowOffsets[V] = currentOffset;

  return {
    nodes,
    nodeToIndex,
    rowOffsets,
    columnIndices,
    edgeWeights,
    edgeRelations,
  };
}

class GraphSearchBuffers {
  private static visitedBuffer = new Uint8Array(1024);
  private static similaritiesBuffer = new Float32Array(1024);
  private static degreesBuffer = new Float32Array(1024);
  private static lock = false;

  static getBuffers(size: number) {
    if (this.lock) {
      return {
        visited: new Uint8Array(size),
        similarities: new Float32Array(size),
        degrees: new Float32Array(size),
      };
    }
    this.lock = true;

    if (size > this.visitedBuffer.length) {
      const newSize = Math.max(size, this.visitedBuffer.length * 2);
      this.visitedBuffer = new Uint8Array(newSize);
      this.similaritiesBuffer = new Float32Array(newSize);
      this.degreesBuffer = new Float32Array(newSize);
    }

    const visited = this.visitedBuffer.subarray(0, size);
    const similarities = this.similaritiesBuffer.subarray(0, size);
    const degrees = this.degreesBuffer.subarray(0, size);

    visited.fill(0);
    similarities.fill(0);
    degrees.fill(0);

    this.lock = false;
    return { visited, similarities, degrees };
  }
}

// High-performance Semantic Beam Search using pre-allocated arrays
export function semanticBeamSearch(
  csr: CSRGraph,
  queryClean: string,
  queryVector: number[],
  K = 5,
  maxHops = 3,
): { nodeIdx: number; score: number }[] {
  const V = csr.nodes.length;
  if (V === 0) return [];

  const { visited, similarities, degrees } = GraphSearchBuffers.getBuffers(V);
  const queryVector32 = new Float32Array(queryVector);

  // Calculate degree centrality (normalized)
  let maxDegree = 1;
  for (let i = 0; i < V; i++) {
    degrees[i] = csr.rowOffsets[i + 1] - csr.rowOffsets[i];
    if (degrees[i] > maxDegree) {
      maxDegree = degrees[i];
    }
  }

  // Calculate similarity for all nodes
  for (let i = 0; i < V; i++) {
    const node = csr.nodes[i];
    if (!node.vector) {
      node.vector = generateEmbedding(cleanAndNormalize(node.label + " " + node.description));
    }
    similarities[i] = cosineSimilarityZeroAlloc(queryVector32, new Float32Array(node.vector));
  }

  // Find initial seed nodes (direct keyword match + high similarity)
  const seedCandidates: { idx: number; score: number }[] = [];
  const queryWords = queryClean.split(/\s+/).filter((w) => w.length >= 2);

  for (let i = 0; i < V; i++) {
    const node = csr.nodes[i];
    const nodeLabelClean = cleanAndNormalize(node.label);

    let keywordMatch = false;
    if (nodeLabelClean.length > 2 && queryClean.includes(nodeLabelClean)) {
      keywordMatch = true;
    } else {
      const matches = queryWords.filter((qw) => nodeLabelClean.includes(qw));
      if (matches.length >= 2 || (nodeLabelClean.length <= 5 && matches.length >= 1)) {
        keywordMatch = true;
      }
    }

    let initialScore = similarities[i];
    if (keywordMatch) {
      initialScore += 0.5; // Bonus for keyword match
    }

    if (initialScore > 0.35) {
      seedCandidates.push({ idx: i, score: initialScore });
    }
  }

  // Sort seeds and select top K
  seedCandidates.sort((a, b) => b.score - a.score);
  let beam = seedCandidates.slice(0, K).map((c) => ({ nodeIdx: c.idx, score: c.score }));

  beam.forEach((b) => (visited[b.nodeIdx] = 1));

  const resultSet = new Map<number, number>(); // nodeIdx -> bestScore
  beam.forEach((b) => resultSet.set(b.nodeIdx, b.score));

  // Beam Search loop
  for (let hop = 1; hop <= maxHops; hop++) {
    if (beam.length === 0) break;
    const candidates: { nodeIdx: number; score: number }[] = [];
    const decay = Math.pow(0.85, hop);

    for (let bIdx = 0; bIdx < beam.length; bIdx++) {
      const active = beam[bIdx];
      const u = active.nodeIdx;
      const start = csr.rowOffsets[u];
      const end = csr.rowOffsets[u + 1];

      for (let e = start; e < end; e++) {
        const v = csr.columnIndices[e];
        if (visited[v]) continue;

        // Heuristic score: (uScore * 0.4 + sim * 0.6) * decay
        const uScore = degrees[v] / maxDegree;
        const sim = similarities[v];
        const score = (uScore * 0.4 + sim * 0.6) * decay;

        candidates.push({ nodeIdx: v, score });
      }
    }

    if (candidates.length === 0) break;

    // Sort candidates and select top K
    candidates.sort((a, b) => b.score - a.score);
    const nextBeam = candidates.slice(0, K);

    beam = [];
    for (let nIdx = 0; nIdx < nextBeam.length; nIdx++) {
      const cand = nextBeam[nIdx];
      visited[cand.nodeIdx] = 1;
      resultSet.set(cand.nodeIdx, cand.score);
      beam.push(cand);
    }
  }

  return Array.from(resultSet.entries()).map(([nodeIdx, score]) => ({ nodeIdx, score }));
}

// Maximal Marginal Relevance (MMR) for diverse result selection
export function selectDiverseNodesMMR(
  csr: CSRGraph,
  candidates: { nodeIdx: number; score: number }[],
  queryVector: number[],
  lambda = 0.5,
  limit = 7,
): GraphNode[] {
  if (candidates.length === 0) return [];

  const queryVector32 = new Float32Array(queryVector);

  // Generate embeddings for all candidates
  const candidateEmbeddings: Float32Array[] = candidates.map((c) => {
    const node = csr.nodes[c.nodeIdx];
    if (!node.vector) {
      node.vector = generateEmbedding(cleanAndNormalize(node.label + " " + node.description));
    }
    return new Float32Array(node.vector);
  });

  const selectedIdxs: number[] = [];
  const remaining = new Set<number>(candidates.keys());

  // Find the first node (highest score)
  let bestIdx = -1;
  let maxScore = -Infinity;
  for (const i of remaining) {
    if (candidates[i].score > maxScore) {
      maxScore = candidates[i].score;
      bestIdx = i;
    }
  }

  if (bestIdx !== -1) {
    selectedIdxs.push(bestIdx);
    remaining.delete(bestIdx);
  }

  while (selectedIdxs.length < limit && remaining.size > 0) {
    let bestCandIdx = -1;
    let maxMMR = -Infinity;

    for (const i of remaining) {
      const simToQuery = cosineSimilarityZeroAlloc(candidateEmbeddings[i], queryVector32);

      // Max similarity to already selected nodes
      let maxSimToSelected = -Infinity;
      for (let sIdx = 0; sIdx < selectedIdxs.length; sIdx++) {
        const sel = selectedIdxs[sIdx];
        const sim = cosineSimilarityZeroAlloc(candidateEmbeddings[i], candidateEmbeddings[sel]);
        if (sim > maxSimToSelected) {
          maxSimToSelected = sim;
        }
      }

      const mmr = lambda * simToQuery - (1 - lambda) * maxSimToSelected;
      if (mmr > maxMMR) {
        maxMMR = mmr;
        bestCandIdx = i;
      }
    }

    if (bestCandIdx === -1) break;
    selectedIdxs.push(bestCandIdx);
    remaining.delete(bestCandIdx);
  }

  return selectedIdxs.map((i) => csr.nodes[candidates[i].nodeIdx]);
}

// Retrieve sub-graph based on a query using CSR Beam Search and MMR
export const retrieveGraphRAG = async (query: string, maxHops = 2): Promise<GraphRAGResult> => {
  const { nodes, edges } = await buildKnowledgeGraph();

  // Lazily rebuild and cache the CSR structure
  if (!cachedCSR || cachedCSR.nodes.length !== nodes.length || edges.length * 2 !== cachedCSR.columnIndices.length) {
    cachedCSR = compileCSRGraph(nodes, edges);
    (globalThis as any)._cachedCSR = cachedCSR;
  }

  const queryClean = cleanAndNormalize(query);
  const queryVector = generateEmbedding(queryClean);

  // 1. Traverse using Semantic Beam Search
  const candidateScores = semanticBeamSearch(cachedCSR, queryClean, queryVector, 5, maxHops);

  // 2. Diversify results using Maximal Marginal Relevance (MMR)
  const retrievedNodes = selectDiverseNodesMMR(cachedCSR, candidateScores, queryVector, 0.5, 8);

  // 3. Extract relevant edges between retrieved nodes
  const retrievedNodeIds = new Set(retrievedNodes.map((n) => n.id));
  const retrievedEdges = edges.filter((e) => retrievedNodeIds.has(e.source) && retrievedNodeIds.has(e.target));

  // 4. Generate Mermaid diagram code block with premium styles
  let mermaidCode = "";
  if (retrievedNodes.length > 0) {
    mermaidCode = "graph TD\n";
    retrievedNodes.forEach((node) => {
      const label = node.label.replace(/"/g, "'");
      let typeIcon = "🔮";
      if (node.type === "Person/Entity" || node.type === "Entity") typeIcon = "👤";
      if (node.type === "Project/Entity") typeIcon = "💻";
      if (node.type === "Formula") typeIcon = "📐";
      if (node.type === "Neurobiology") typeIcon = "🧠";
      if (node.type === "Variable/Metric") typeIcon = "📊";

      mermaidCode += `  ${node.id}["${typeIcon} ${label} (${node.type})"]\n`;
    });

    retrievedEdges.forEach((edge) => {
      mermaidCode += `  ${edge.source} -->|${edge.relation}| ${edge.target}\n`;
    });

    // Color theme classes matching custom palette
    mermaidCode += `
  classDef default fill:#11111b,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
  classDef concept fill:#89b4fa,stroke:#b4befe,stroke-width:2px,color:#11111b,font-weight:bold;
  classDef entity fill:#a6e3a1,stroke:#94e2d5,stroke-width:2px,color:#11111b,font-weight:bold;
  classDef formula fill:#f9e2af,stroke:#f8bd96,stroke-width:2px,color:#11111b,font-weight:bold;
`;

    const concepts = retrievedNodes.filter((n) => n.type === "Concept").map((n) => n.id);
    if (concepts.length > 0) {
      mermaidCode += `  class ${concepts.join(",")} concept;\n`;
    }
    const entities = retrievedNodes
      .filter((n) => n.type === "Person/Entity" || n.type === "Entity" || n.type === "Project/Entity")
      .map((n) => n.id);
    if (entities.length > 0) {
      mermaidCode += `  class ${entities.join(",")} entity;\n`;
    }
    const formulas = retrievedNodes.filter((n) => n.type === "Formula").map((n) => n.id);
    if (formulas.length > 0) {
      mermaidCode += `  class ${formulas.join(",")} formula;\n`;
    }
  }

  // 5. Synthesize clean contextual text
  const contextParagraphs = retrievedNodes.map((node) => {
    return `- **[${node.type}]** ${node.label}: ${node.description}`;
  });

  const relationParagraphs = retrievedEdges.map((edge) => {
    const srcNode = nodes.find((n) => n.id === edge.source);
    const tgtNode = nodes.find((n) => n.id === edge.target);
    return `- (${srcNode?.label || edge.source}) --[${edge.relation}]--> (${tgtNode?.label || edge.target})`;
  });

  let contextText = "";
  if (contextParagraphs.length > 0) {
    contextText = `### 🌐 MẠNG LƯỚI TRI THỨC GRAPH RAG (Hop Context)
${contextParagraphs.join("\n")}

### 🔗 CÁC LIÊN KẾT QUAN HỆ (Semantic Triplets)
${relationParagraphs.join("\n")}`;
  }

  // 6. Compute Confidence based on candidate match score
  let confidence = 0;
  if (candidateScores.length > 0) {
    const topScore = Math.max(...candidateScores.map((c) => c.score));
    confidence = Math.min(99, Math.round(50 + topScore * 40));
  }

  return {
    nodes: retrievedNodes,
    edges: retrievedEdges,
    mermaidCode: mermaidCode.trim(),
    contextText,
    confidence,
  };
};
