/**
 * 🧠 ROTTRA — KNOWLEDGE GRAPH VISUALIZER
 * Interactive graph data structure, node/edge filtering, search, and real-time updates.
 * Backend data layer for the dashboard graph UI.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────

export interface KGNode {
  id: string;
  label: string;
  type: "concept" | "product" | "region" | "technique" | "agent" | "sensor" | "event";
  properties: Record<string, any>;
  embedding?: number[] | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface KGEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: "related_to" | "produced_in" | "uses_technique" | "monitored_by" | "negotiates_with" | "causes" | "part_of";
  weight: number;
  properties: Record<string, any>;
  createdAt: Date;
}

export interface KGSubgraph {
  nodes: KGNode[];
  edges: KGEdge[];
}

export interface KGStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  avgDegree: number;
  density: number;
}

export interface KGFilter {
  nodeTypes?: string[];
  edgeTypes?: string[];
  nodeIds?: string[];
  searchTerm?: string;
  maxDepth?: number;
  centerNodeId?: string;
}

// ── Knowledge Graph Store ─────────────────────────────────────

const nodes: Map<string, KGNode> = new Map();
const edges: Map<string, KGEdge> = new Map();
const adjacencyList: Map<string, Set<string>> = new Map();
const reverseAdjacency: Map<string, Set<string>> = new Map();
const updateListeners: ((event: KGUpdateEvent) => void)[] = [];

export type KGUpdateEvent =
  | { type: "node_added"; node: KGNode }
  | { type: "node_updated"; node: KGNode }
  | { type: "node_removed"; nodeId: string }
  | { type: "edge_added"; edge: KGEdge }
  | { type: "edge_removed"; edgeId: string };

/**
 * Subscribe to graph updates
 */
export function onKGUpdate(listener: (event: KGUpdateEvent) => void): () => void {
  updateListeners.push(listener);
  return () => {
    const idx = updateListeners.indexOf(listener);
    if (idx !== -1) updateListeners.splice(idx, 1);
  };
}

function emitUpdate(event: KGUpdateEvent): void {
  for (const listener of updateListeners) {
    try {
      listener(event);
    } catch {
      /* ignore */
    }
  }
}

// ── Node Operations ───────────────────────────────────────────

/**
 * Add a node to the knowledge graph
 */
export function addNode(label: string, type: KGNode["type"], properties: Record<string, any> = {}, embedding?: number[]): KGNode {
  const node: KGNode = {
    id: randomUUID(),
    label,
    type,
    properties,
    embedding,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  nodes.set(node.id, node);
  adjacencyList.set(node.id, new Set());
  reverseAdjacency.set(node.id, new Set());
  emitUpdate({ type: "node_added", node });
  return node;
}

/**
 * Update a node
 */
export function updateNode(nodeId: string, updates: Partial<Pick<KGNode, "label" | "properties" | "embedding">>): KGNode | null {
  const node = nodes.get(nodeId);
  if (!node) return null;
  if (updates.label) node.label = updates.label;
  if (updates.properties) node.properties = { ...node.properties, ...updates.properties };
  if (updates.embedding) node.embedding = updates.embedding;
  node.updatedAt = new Date();
  emitUpdate({ type: "node_updated", node });
  return node;
}

/**
 * Remove a node and its edges
 */
export function removeNode(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node) return false;

  // Remove all connected edges
  const outgoing = adjacencyList.get(nodeId) || new Set();
  const incoming = reverseAdjacency.get(nodeId) || new Set();

  for (const edgeId of [...outgoing, ...incoming]) {
    const edge = edges.get(edgeId);
    if (edge) {
      adjacencyList.get(edge.sourceId)?.delete(edgeId);
      reverseAdjacency.get(edge.targetId)?.delete(edgeId);
      edges.delete(edgeId);
    }
  }

  nodes.delete(nodeId);
  adjacencyList.delete(nodeId);
  reverseAdjacency.delete(nodeId);
  emitUpdate({ type: "node_removed", nodeId });
  return true;
}

/**
 * Get a node by ID
 */
export function getNode(nodeId: string): KGNode | undefined {
  return nodes.get(nodeId);
}

// ── Edge Operations ───────────────────────────────────────────

/**
 * Add an edge to the knowledge graph
 */
export function addEdge(
  sourceId: string,
  targetId: string,
  type: KGEdge["type"],
  weight: number = 1.0,
  properties: Record<string, any> = {},
): KGEdge | null {
  if (!nodes.has(sourceId) || !nodes.has(targetId)) return null;

  // Check for duplicate edge
  const existing = adjacencyList.get(sourceId) || new Set();
  for (const edgeId of existing) {
    const e = edges.get(edgeId);
    if (e && e.targetId === targetId && e.type === type) {
      // Update weight instead of creating duplicate
      e.weight = Math.max(e.weight, weight);
      return e;
    }
  }

  const edge: KGEdge = {
    id: randomUUID(),
    sourceId,
    targetId,
    type,
    weight,
    properties,
    createdAt: new Date(),
  };

  edges.set(edge.id, edge);
  adjacencyList.get(sourceId)!.add(edge.id);
  reverseAdjacency.get(targetId)!.add(edge.id);
  emitUpdate({ type: "edge_added", edge });
  return edge;
}

/**
 * Remove an edge
 */
export function removeEdge(edgeId: string): boolean {
  const edge = edges.get(edgeId);
  if (!edge) return false;
  adjacencyList.get(edge.sourceId)?.delete(edgeId);
  reverseAdjacency.get(edge.targetId)?.delete(edgeId);
  edges.delete(edgeId);
  emitUpdate({ type: "edge_removed", edgeId });
  return true;
}

// ── Query & Filter ────────────────────────────────────────────

/**
 * Get subgraph filtered by criteria
 */
export function filterGraph(filter: KGFilter): KGSubgraph {
  let filteredNodes = Array.from(nodes.values());

  // Filter by node types
  if (filter.nodeTypes && filter.nodeTypes.length > 0) {
    filteredNodes = filteredNodes.filter((n) => filter.nodeTypes!.includes(n.type));
  }

  // Filter by search term
  if (filter.searchTerm) {
    const term = filter.searchTerm.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (n) => n.label.toLowerCase().includes(term) || JSON.stringify(n.properties).toLowerCase().includes(term),
    );
  }

  // BFS from center node if specified
  if (filter.centerNodeId) {
    const reachable = bfsTraversal(filter.centerNodeId, filter.maxDepth || 2);
    filteredNodes = filteredNodes.filter((n) => reachable.has(n.id));
  }

  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  let filteredEdges = Array.from(edges.values()).filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

  if (filter.edgeTypes && filter.edgeTypes.length > 0) {
    filteredEdges = filteredEdges.filter((e) => filter.edgeTypes!.includes(e.type));
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * BFS traversal from a start node
 */
function bfsTraversal(startId: string, maxDepth: number): Set<string> {
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const neighbors = adjacencyList.get(id) || new Set();
    for (const edgeId of neighbors) {
      const edge = edges.get(edgeId);
      if (edge) {
        const nextId = edge.targetId === id ? edge.sourceId : edge.targetId;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, depth: depth + 1 });
        }
      }
    }
  }

  return visited;
}

/**
 * Search nodes by label similarity (fuzzy match)
 */
export function searchNodes(query: string, limit: number = 20): KGNode[] {
  const term = query.toLowerCase();
  const scored: { node: KGNode; score: number }[] = [];

  for (const node of nodes.values()) {
    let score = 0;
    const label = node.label.toLowerCase();
    if (label === term) score = 100;
    else if (label.startsWith(term)) score = 80;
    else if (label.includes(term)) score = 60;
    else {
      // Word overlap
      const words = term.split(/\s+/);
      for (const w of words) {
        if (label.includes(w)) score += 20;
      }
    }
    if (score > 0) scored.push({ node, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.node);
}

/**
 * Find shortest path between two nodes
 */
export function findPath(sourceId: string, targetId: string, maxDepth: number = 6): KGNode[] | null {
  if (sourceId === targetId) return [nodes.get(sourceId)!].filter(Boolean);

  const visited = new Map<string, string>(); // nodeId -> parent edgeId
  const queue: { nodeId: string; depth: number }[] = [{ nodeId: sourceId, depth: 0 }];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (depth > maxDepth) continue;

    const neighbors = adjacencyList.get(nodeId) || new Set();
    for (const edgeId of neighbors) {
      const edge = edges.get(edgeId);
      if (!edge) continue;
      const nextId = edge.targetId === nodeId ? edge.sourceId : edge.targetId;
      if (nextId === targetId) {
        // Reconstruct path
        const path: KGNode[] = [nodes.get(nextId)!];
        let current = nodeId;
        while (current !== sourceId) {
          const parentEdgeId = visited.get(current);
          if (!parentEdgeId) break;
          const parentEdge = edges.get(parentEdgeId);
          if (!parentEdge) break;
          const parent = parentEdge.sourceId === current ? parentEdge.targetId : parentEdge.sourceId;
          path.unshift(nodes.get(parent)!);
          current = parent;
        }
        path.unshift(nodes.get(sourceId)!);
        return path;
      }
      if (!visited.has(nextId)) {
        visited.set(nextId, edgeId);
        queue.push({ nodeId: nextId, depth: depth + 1 });
      }
    }
  }

  return null;
}

// ── Statistics ────────────────────────────────────────────────

/**
 * Get graph statistics
 */
export function getGraphStats(): KGStats {
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};
  let totalDegree = 0;

  for (const node of nodes.values()) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const edge of edges.values()) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }

  for (const adj of adjacencyList.values()) {
    totalDegree += adj.size;
  }

  const n = nodes.size;
  return {
    totalNodes: n,
    totalEdges: edges.size,
    nodesByType,
    edgesByType,
    avgDegree: n > 0 ? totalDegree / n : 0,
    density: n > 1 ? (2 * edges.size) / (n * (n - 1)) : 0,
  };
}

// ── Seed Agricultural Graph ───────────────────────────────────

/**
 * Seed the knowledge graph with initial agricultural data
 */
export function seedAgriculturalGraph(): void {
  // Products
  const rice = addNode("Gạo Việt Nam", "product", { category: "cereal", exportVolume: "6.5M tons/year" });
  const coffee = addNode("Cà phê Robusta", "product", { category: "beverage", exportVolume: "1.8M tons/year" });
  const pepper = addNode("Hạt tiêu", "product", { category: "spice", exportVolume: "250K tons/year" });
  const cashew = addNode("Hạt điều", "product", { category: "nut", exportVolume: "450K tons/year" });
  const dragonfruit = addNode("Thanh long", "product", { category: "fruit", exportVolume: "300K tons/year" });

  // Regions
  const mekong = addNode("Đồng bằng sông Cửu Long", "region", { area: "40,000 km²", mainCrops: "lúa, trái cây" });
  const central = addNode("Tây Nguyên", "region", { area: "54,000 km²", mainCrops: "cà phê, tiêu, điều" });
  const redRiver = addNode("Đồng bằng sông Hồng", "region", { area: "15,000 km²", mainCrops: "lúa, rau" });

  // Techniques
  const vgap = addNode("VietGAP", "technique", { type: "quality_standard", description: "Vietnamese Good Agricultural Practices" });
  const irrigation = addNode("Tưới nhỏ giọt", "technique", { type: "irrigation", waterSaving: "40-60%" });
  const rotation = addNode("Luân canh", "technique", { type: "crop_management" });

  // Concepts
  const sustainability = addNode("Phát triển bền vững", "concept", { description: "Sustainable agriculture" });
  const climate = addNode("Biến đổi khí hậu", "concept", { description: "Climate change adaptation" });

  // Agents
  const rottraAgent = addNode("Rottra AI", "agent", { role: "coordinator", capability: "multi-agent negotiation" });

  // Sensors
  const tempSensor = addNode("Cảm biến nhiệt độ", "sensor", { type: "temperature", range: "-40 to 80°C" });

  // Edges
  addEdge(rice.id, mekong.id, "produced_in", 0.9);
  addEdge(coffee.id, central.id, "produced_in", 0.95);
  addEdge(pepper.id, central.id, "produced_in", 0.8);
  addEdge(cashew.id, central.id, "produced_in", 0.7);
  addEdge(dragonfruit.id, mekong.id, "produced_in", 0.85);

  addEdge(rice.id, vgap.id, "uses_technique", 0.6);
  addEdge(coffee.id, irrigation.id, "uses_technique", 0.5);
  addEdge(rice.id, rotation.id, "uses_technique", 0.7);

  addEdge(vgap.id, sustainability.id, "related_to", 0.8);
  addEdge(climate.id, irrigation.id, "causes", 0.7);

  addEdge(rottraAgent.id, coffee.id, "monitored_by", 0.9);
  addEdge(rottraAgent.id, tempSensor.id, "monitored_by", 0.8);
  addEdge(tempSensor.id, central.id, "part_of", 0.6);

  console.log(`[KG] Seeded ${nodes.size} nodes and ${edges.size} edges`);
}

export const knowledgeGraph = {
  addNode,
  updateNode,
  removeNode,
  getNode,
  addEdge,
  removeEdge,
  filterGraph,
  searchNodes,
  findPath,
  getGraphStats,
  onKGUpdate,
  seedAgriculturalGraph,
};
