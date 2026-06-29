/**
 * 🕸️ KNOWLEDGE GRAPH ENGINE
 *
 * Knowledge Graph with Graph Attention Network (simplified):
 * - Nodes: entities, concepts, topics
 * - Edges: relationships with types and weights
 * - Graph Attention:-weighted traversal to gather context
 * - Embedding propagation: context-aware node representations
 *
 * Ưu điểm:
 * - Giải thích được (explainable AI)
 * - Dễ mở rộng (thêm node/edge = thêm kiến thức)
 * - Context-aware qua graph traversal
 */

interface KGNode {
  id: string;
  label: string;
  type: "entity" | "concept" | "topic" | "response" | "pattern";
  embedding: Float32Array;
  attributes: Record<string, any>;
  createdAt: number;
  accessCount: number;
}

interface KGEdge {
  source: string;
  target: string;
  type: string; // "is_a", "has_property", "related_to", "leads_to", "context_of"
  weight: number;
  metadata?: Record<string, any>;
}

interface GraphContext {
  nodes: KGNode[];
  edges: KGEdge[];
  attentionWeights: Map<string, number>;
  contextVector: Float32Array;
}

/**
 * Text → Simple embedding vector (consistent with SDM)
 */
function textEmbedding(text: string, dim: number = 256): Float32Array {
  const vec = new Float32Array(dim);
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) + hash + word.charCodeAt(j)) & 0x7fffffff;
      vec[hash % dim] += 1.0 / (1 + i * 0.1);
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) + 1e-10;
  for (let i = 0; i < dim; i++) vec[i] /= norm;

  return vec;
}

/**
 * Knowledge Graph Engine
 */
export class KnowledgeGraph {
  private nodes: Map<string, KGNode> = new Map();
  private edges: KGEdge[] = [];
  private adjacencyList: Map<string, KGEdge[]> = new Map();
  private reverseAdjacency: Map<string, KGEdge[]> = new Map();

  /**
   * Thêm node mới
   */
  addNode(label: string, type: KGNode["type"], attributes: Record<string, any> = {}): KGNode {
    const id = `kg_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now().toString(36)}`;
    const existing = this.findNodeByLabel(label);
    if (existing) {
      existing.accessCount++;
      return existing;
    }

    const node: KGNode = {
      id,
      label,
      type,
      embedding: textEmbedding(label),
      attributes,
      createdAt: Date.now(),
      accessCount: 1,
    };

    this.nodes.set(id, node);
    return node;
  }

  /**
   * Thêm edge (mối quan hệ)
   */
  addEdge(sourceId: string, targetId: string, type: string, weight: number = 1.0): void {
    const edge: KGEdge = { source: sourceId, target: targetId, type, weight };
    this.edges.push(edge);

    // Update adjacency lists
    if (!this.adjacencyList.has(sourceId)) this.adjacencyList.set(sourceId, []);
    if (!this.reverseAdjacency.has(targetId)) this.reverseAdjacency.set(targetId, []);
    this.adjacencyList.get(sourceId)!.push(edge);
    this.reverseAdjacency.get(targetId)!.push(edge);
  }

  /**
   * Tìm node theo label (fuzzy match)
   */
  findNodeByLabel(label: string): KGNode | undefined {
    const normalized = label.toLowerCase().trim();
    for (const node of this.nodes.values()) {
      if (node.label.toLowerCase() === normalized) return node;
      // Partial match
      if (node.label.toLowerCase().includes(normalized) || normalized.includes(node.label.toLowerCase())) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Graph Attention: Traversal có trọng số
   * Từ một node, gather context từ K hop neighbors
   */
  graphAttention(seedNodeId: string, maxHops: number = 2, maxNeighbors: number = 10, attentionDecay: number = 0.6): GraphContext {
    const visited = new Set<string>();
    const contextNodes: KGNode[] = [];
    const contextEdges: KGEdge[] = [];
    const attentionWeights = new Map<string, number>();

    const queue: Array<{ nodeId: string; hop: number; attention: number }> = [{ nodeId: seedNodeId, hop: 0, attention: 1.0 }];

    while (queue.length > 0) {
      const { nodeId, hop, attention } = queue.shift()!;
      if (visited.has(nodeId) || hop > maxHops) continue;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) continue;

      contextNodes.push(node);
      attentionWeights.set(nodeId, attention);

      // Get outgoing edges
      const outEdges = this.adjacencyList.get(nodeId) || [];
      // Get incoming edges
      const inEdges = this.reverseAdjacency.get(nodeId) || [];
      const allEdges = [...outEdges, ...inEdges];

      // Sort by weight and take top neighbors
      allEdges.sort((a, b) => b.weight - a.weight);
      const neighbors = allEdges.slice(0, maxNeighbors);

      for (const edge of neighbors) {
        const neighborId = edge.source === nodeId ? edge.target : edge.source;
        if (!visited.has(neighborId)) {
          contextEdges.push(edge);
          queue.push({
            nodeId: neighborId,
            hop: hop + 1,
            attention: attention * attentionDecay * edge.weight,
          });
        }
      }
    }

    // Compute context vector from attended nodes
    const contextDim = 256;
    const contextVector = new Float32Array(contextDim);
    for (const node of contextNodes) {
      const att = attentionWeights.get(node.id) || 0;
      const nodeEmb = node.embedding;
      for (let i = 0; i < Math.min(nodeEmb.length, contextDim); i++) {
        contextVector[i] += nodeEmb[i] * att;
      }
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < contextDim; i++) norm += contextVector[i] * contextVector[i];
    norm = Math.sqrt(norm) + 1e-10;
    for (let i = 0; i < contextDim; i++) contextVector[i] /= norm;

    return { nodes: contextNodes, edges: contextEdges, attentionWeights, contextVector };
  }

  /**
   * Extract entities từ text và tự động tạo nodes + edges
   */
  extractAndConnect(text: string, intent: string = "UNKNOWN"): KGNode {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const mainNode = this.addNode(text.substring(0, 100), "pattern", { intent });

    // Tạo entity nodes cho mỗi từ quan trọng
    const importantWords = words.filter(
      (w) => !["cho", "của", "và", "là", "có", "được", "không", "này", "đó", "với", "trong", "từ", "để"].includes(w),
    );

    for (const word of importantWords.slice(0, 8)) {
      const entityNode = this.addNode(word, "entity");
      this.addEdge(mainNode.id, entityNode.id, "contains", 1.0);

      // Connect to existing related entities
      for (const [existingId, existingNode] of this.nodes) {
        if (existingId !== entityNode.id && existingNode.type === "entity") {
          const sim = this.cosineSim(entityNode.embedding, existingNode.embedding);
          if (sim > 0.3) {
            this.addEdge(entityNode.id, existingId, "related_to", sim);
          }
        }
      }
    }

    return mainNode;
  }

  /**
   * Tìm đường đi ngắn nhất giữa 2 nodes (BFS)
   */
  findPath(sourceId: string, targetId: string, maxHops: number = 5): KGNode[] | null {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: KGNode[] }> = [{ nodeId: sourceId, path: [] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      if (visited.has(nodeId) || path.length > maxHops) continue;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) continue;

      const newPath = [...path, node];
      if (nodeId === targetId) return newPath;

      const outEdges = this.adjacencyList.get(nodeId) || [];
      const inEdges = this.reverseAdjacency.get(nodeId) || [];
      const neighbors = [...outEdges, ...inEdges].map((e) => (e.source === nodeId ? e.target : e.source));

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push({ nodeId: neighborId, path: newPath });
        }
      }
    }

    return null;
  }

  /**
   * Tìm nodes liên quan nhất đến query
   */
  search(query: string, topK: number = 5): Array<{ node: KGNode; score: number }> {
    const queryEmb = textEmbedding(query);
    const results: Array<{ node: KGNode; score: number }> = [];

    for (const node of this.nodes.values()) {
      const score = this.cosineSim(queryEmb, node.embedding);
      if (score > 0.1) {
        results.push({ node, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Lấy context đầy đủ cho query (combine graph traversal + search)
   */
  getContextForQuery(query: string): GraphContext | null {
    // Tìm node seed gần nhất
    const matches = this.search(query, 1);
    if (matches.length === 0) return null;

    // Graph attention từ seed node
    return this.graphAttention(matches[0].node.id, 2, 10, 0.6);
  }

  /**
   * Thêm batch training data vào graph
   */
  ingestTrainingData(data: Array<{ utterance: string; response: string; intent: string }>): number {
    let count = 0;
    const entityCache = new Map<string, KGNode>();

    for (const item of data) {
      const mainNode = this.extractAndConnect(item.utterance, item.intent);

      // Tạo response node
      const respNode = this.addNode(item.response.substring(0, 100), "response", { fullResponse: item.response, intent: item.intent });
      this.addEdge(mainNode.id, respNode.id, "leads_to", 1.0);

      // Connect to intent node
      const intentNode = this.addNode(item.intent, "concept");
      this.addEdge(mainNode.id, intentNode.id, "has_intent", 0.8);

      count++;
    }

    return count;
  }

  private cosineSim(a: Float32Array, b: Float32Array): number {
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
  }

  getStats() {
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodeTypes: Array.from(this.nodes.values()).reduce(
        (acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      edgeTypes: this.edges.reduce(
        (acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  export(): object {
    return {
      nodes: Array.from(this.nodes.values()).map((n) => ({
        ...n,
        embedding: Array.from(n.embedding),
      })),
      edges: this.edges,
    };
  }

  import(data: any): void {
    if (data.nodes) {
      for (const n of data.nodes) {
        this.nodes.set(n.id, { ...n, embedding: new Float32Array(n.embedding) });
      }
    }
    if (data.edges) {
      this.edges = data.edges;
      for (const edge of data.edges) {
        if (!this.adjacencyList.has(edge.source)) this.adjacencyList.set(edge.source, []);
        if (!this.reverseAdjacency.has(edge.target)) this.reverseAdjacency.set(edge.target, []);
        this.adjacencyList.get(edge.source)!.push(edge);
        this.reverseAdjacency.get(edge.target)!.push(edge);
      }
    }
  }
}
