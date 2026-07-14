/**
 * 🧠 ROTTRA — KNOWLEDGE GRAPH API ROUTES
 * Hono API endpoints for graph query, search, filtering, and real-time updates.
 * Runs on Bun runtime.
 */

import { Hono } from "hono";
import { knowledgeGraph, type KGFilter } from "~/core/knowledge-graph/kg-core";

const kgApi = new Hono();

/**
 * GET /kg/stats — Get graph statistics
 */
kgApi.get("/stats", (c) => {
  const stats = knowledgeGraph.getGraphStats();
  return c.json({ success: true, stats });
});

/**
 * GET /kg/nodes — List all nodes with optional filter
 */
kgApi.get("/nodes", (c) => {
  const type = c.req.query("type");
  const search = c.req.query("search");
  const limit = parseInt(c.req.query("limit") || "100", 10);

  const filter: KGFilter = {};
  if (type) filter.nodeTypes = [type];
  if (search) filter.searchTerm = search;

  const result = knowledgeGraph.filterGraph(filter);
  return c.json({ success: true, nodes: result.nodes.slice(0, limit) });
});

/**
 * GET /kg/nodes/:nodeId — Get a specific node
 */
kgApi.get("/nodes/:nodeId", (c) => {
  const node = knowledgeGraph.getNode(c.req.param("nodeId"));
  if (!node) return c.json({ success: false, error: "Node not found" }, 404);
  return c.json({ success: true, node });
});

/**
 * POST /kg/nodes — Add a new node
 */
kgApi.post("/nodes", async (c) => {
  const body = await c.req.json();
  const node = knowledgeGraph.addNode(body.label, body.type, body.properties, body.embedding);
  return c.json({ success: true, node });
});

/**
 * PUT /kg/nodes/:nodeId — Update a node
 */
kgApi.put("/nodes/:nodeId", async (c) => {
  const body = await c.req.json();
  const node = knowledgeGraph.updateNode(c.req.param("nodeId"), body);
  if (!node) return c.json({ success: false, error: "Node not found" }, 404);
  return c.json({ success: true, node });
});

/**
 * DELETE /kg/nodes/:nodeId — Remove a node
 */
kgApi.delete("/nodes/:nodeId", (c) => {
  const removed = knowledgeGraph.removeNode(c.req.param("nodeId"));
  if (!removed) return c.json({ success: false, error: "Node not found" }, 404);
  return c.json({ success: true, message: "Node removed" });
});

/**
 * POST /kg/edges — Add a new edge
 */
kgApi.post("/edges", async (c) => {
  const body = await c.req.json();
  const edge = knowledgeGraph.addEdge(body.sourceId, body.targetId, body.type, body.weight, body.properties);
  if (!edge) return c.json({ success: false, error: "Invalid source/target" }, 400);
  return c.json({ success: true, edge });
});

/**
 * DELETE /kg/edges/:edgeId — Remove an edge
 */
kgApi.delete("/edges/:edgeId", (c) => {
  const removed = knowledgeGraph.removeEdge(c.req.param("edgeId"));
  if (!removed) return c.json({ success: false, error: "Edge not found" }, 404);
  return c.json({ success: true, message: "Edge removed" });
});

/**
 * POST /kg/filter — Filter subgraph by criteria
 */
kgApi.post("/filter", async (c) => {
  const filter: KGFilter = await c.req.json();
  const subgraph = knowledgeGraph.filterGraph(filter);
  return c.json({ success: true, ...subgraph });
});

/**
 * GET /kg/search — Search nodes by label
 */
kgApi.get("/search", (c) => {
  const q = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "20", 10);
  if (!q) return c.json({ success: false, error: "Query parameter 'q' is required" }, 400);
  const results = knowledgeGraph.searchNodes(q, limit);
  return c.json({ success: true, results });
});

/**
 * GET /kg/path — Find shortest path between two nodes
 */
kgApi.get("/path", (c) => {
  const source = c.req.query("source");
  const target = c.req.query("target");
  if (!source || !target) return c.json({ success: false, error: "source and target are required" }, 400);
  const path = knowledgeGraph.findPath(source, target);
  return c.json({ success: true, path: path || [] });
});

/**
 * POST /kg/seed — Seed the graph with agricultural data
 */
kgApi.post("/seed", (c) => {
  knowledgeGraph.seedAgriculturalGraph();
  const stats = knowledgeGraph.getGraphStats();
  return c.json({ success: true, message: "Graph seeded", stats });
});

export default kgApi;
