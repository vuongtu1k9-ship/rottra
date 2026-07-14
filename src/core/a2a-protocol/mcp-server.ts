/**
 * 🧠 ROTTRA — MODEL CONTEXT PROTOCOL (MCP) SERVER
 * MCP server implementation for external tool/resource access.
 * Enables AI assistants to interact with Rottra's agricultural data.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";

// ── Types ─────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (input: Record<string, any>) => Promise<any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: (uri: string) => Promise<any>;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments: { name: string; description: string; required: boolean }[];
  handler: (args: Record<string, string>) => Promise<string>;
}

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

// ── Tool Registry ─────────────────────────────────────────────

const tools: Map<string, MCPTool> = new Map();
const resources: Map<string, MCPResource> = new Map();
const prompts: Map<string, MCPPrompt> = new Map();

/**
 * Register an MCP tool
 */
export function registerTool(tool: MCPTool): void {
  tools.set(tool.name, tool);
  console.log(`[MCP] Tool registered: ${tool.name}`);
}

/**
 * Register an MCP resource
 */
export function registerResource(resource: MCPResource): void {
  resources.set(resource.uri, resource);
  console.log(`[MCP] Resource registered: ${resource.name}`);
}

/**
 * Register an MCP prompt template
 */
export function registerPrompt(prompt: MCPPrompt): void {
  prompts.set(prompt.name, prompt);
  console.log(`[MCP] Prompt registered: ${prompt.name}`);
}

// ── JSON-RPC Handler ──────────────────────────────────────────

/**
 * Handle MCP JSON-RPC request
 */
export async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: {
              name: "rottra-mcp-server",
              version: "3.0.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: Array.from(tools.values()).map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        };

      case "tools/call": {
        const toolName = params?.name;
        const tool = tools.get(toolName);
        if (!tool) {
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${toolName}` } };
        }
        const result = await tool.handler(params?.arguments || {});
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } };
      }

      case "resources/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: Array.from(resources.values()).map((r) => ({
              uri: r.uri,
              name: r.name,
              description: r.description,
              mimeType: r.mimeType,
            })),
          },
        };

      case "resources/read": {
        const uri = params?.uri;
        const resource = resources.get(uri);
        if (!resource) {
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `Resource not found: ${uri}` } };
        }
        const contents = await resource.handler(uri);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [{ uri, mimeType: resource.mimeType, text: typeof contents === "string" ? contents : JSON.stringify(contents) }],
          },
        };
      }

      case "prompts/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: Array.from(prompts.values()).map((p) => ({
              name: p.name,
              description: p.description,
              arguments: p.arguments,
            })),
          },
        };

      case "prompts/get": {
        const promptName = params?.name;
        const prompt = prompts.get(promptName);
        if (!prompt) {
          return { jsonrpc: "2.0", id, error: { code: -32601, message: `Prompt not found: ${promptName}` } };
        }
        const promptResult = await prompt.handler(params?.arguments || {});
        return { jsonrpc: "2.0", id, result: { messages: [{ role: "user", content: { type: "text", text: promptResult } }] } };
      }

      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err: any) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: err.message } };
  }
}

// ── Built-in Rottra Tools ─────────────────────────────────────

/**
 * Register all built-in Rottra MCP tools
 */
export function registerRottraTools(): void {
  // Tool: Query agricultural knowledge
  registerTool({
    name: "rottra_query",
    description: "Query Rottra's agricultural knowledge base (RAG)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Agricultural question in Vietnamese or English" },
        topK: { type: "number", description: "Number of results to return (default: 5)" },
      },
      required: ["query"],
    },
    handler: async (input) => {
      const { hybridRetrieve } = await import("~/core/neural-memory/vector-rag");
      const results = await hybridRetrieve(input.query, input.topK || 5);
      return { results: results.slice(0, input.topK || 5) };
    },
  });

  // Tool: Get sensor data
  registerTool({
    name: "rottra_sensor_data",
    description: "Get IoT sensor data from a farm",
    inputSchema: {
      type: "object",
      properties: {
        farmId: { type: "string", description: "Farm ID" },
        sensorType: { type: "string", description: "Sensor type (temperature, humidity, soil_moisture, etc.)" },
        hours: { type: "number", description: "Lookback hours (default: 24)" },
      },
      required: ["farmId"],
    },
    handler: async (input) => {
      const { getSensorData, getSensorSummary } = await import("~/infra/network/sensor-ingestion");
      if (input.sensorType) {
        const data = await getSensorData(input.farmId, input.sensorType as any);
        return { readings: data };
      }
      const summary = await getSensorSummary(input.farmId, input.hours || 24);
      return { summary };
    },
  });

  // Tool: Classify agricultural product image
  registerTool({
    name: "rottra_classify_product",
    description: "Classify an agricultural product from an image",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "URL or path to the product image" },
      },
      required: ["imageUrl"],
    },
    handler: async (input) => {
      const { classifyAgriculturalProduct } = await import("~/core/neural-memory/multimodal-embedding");
      const result = await classifyAgriculturalProduct(input.imageUrl);
      return result;
    },
  });

  // Tool: Get market prices
  registerTool({
    name: "rottra_market_prices",
    description: "Get current agricultural market prices and trends",
    inputSchema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Product name (e.g., coffee, rice, pepper)" },
      },
    },
    handler: async (input) => {
      return {
        product: input.product || "general",
        message: "Market price data available via exchange-rate endpoint",
        hint: "Use /api/exchange-rate for currency rates, or query product listings",
      };
    },
  });

  // Tool: Start FL training round
  registerTool({
    name: "rottra_fl_round",
    description: "Start a federated learning training round",
    inputSchema: {
      type: "object",
      properties: {
        localEpochs: { type: "number", description: "Local training epochs (default: 3)" },
        learningRate: { type: "number", description: "Learning rate (default: 0.01)" },
        minNodes: { type: "number", description: "Minimum nodes required (default: 3)" },
      },
    },
    handler: async (input) => {
      const { flCoordinator } = await import("~/core/federated-learning/coordinator");
      const round = await flCoordinator.startRound(input);
      return { round };
    },
  });

  console.log(`[MCP] ${tools.size} built-in tools registered`);
}

/**
 * Register built-in Rottra resources
 */
export function registerRottraResources(): void {
  // Resource: System status
  registerResource({
    uri: "rottra://status",
    name: "System Status",
    description: "Rottra system status and health",
    mimeType: "application/json",
    handler: async () => ({
      version: "3.0.0",
      modules: ["RAG", "Multi-modal", "Sensor", "FL", "A2A", "MCP"],
      uptime: process.uptime(),
    }),
  });

  // Resource: Knowledge graph stats
  registerResource({
    uri: "rottra://knowledge/stats",
    name: "Knowledge Graph Statistics",
    description: "Statistics about the agricultural knowledge base",
    mimeType: "application/json",
    handler: async () => ({
      description: "Agricultural knowledge base stats",
      domains: 15,
      totalDocuments: "query at runtime",
    }),
  });

  console.log(`[MCP] ${resources.size} built-in resources registered`);
}

/**
 * Register built-in Rottra prompts
 */
export function registerRottraPrompts(): void {
  registerPrompt({
    name: "agricultural_consultation",
    description: "Get agricultural consultation advice",
    arguments: [
      { name: "crop", description: "Crop type (rice, coffee, pepper, etc.)", required: true },
      { name: "issue", description: "Specific issue or question", required: true },
      { name: "region", description: "Geographic region in Vietnam", required: false },
    ],
    handler: async (args) => {
      return `You are an agricultural expert for ${args.crop} farming in ${args.region || "Vietnam"}. A farmer asks: "${args.issue}". Provide detailed, actionable advice based on best practices.`;
    },
  });

  registerPrompt({
    name: "market_analysis",
    description: "Analyze agricultural market conditions",
    arguments: [
      { name: "product", description: "Agricultural product to analyze", required: true },
      { name: "timeframe", description: "Analysis timeframe (1week, 1month, 1year)", required: false },
    ],
    handler: async (args) => {
      return `Analyze the ${args.product} market for ${args.timeframe || "the next month"}. Consider supply-demand dynamics, price trends, weather impacts, and export/import data.`;
    },
  });

  console.log(`[MCP] ${prompts.size} built-in prompts registered`);
}

/**
 * Initialize all built-in MCP components
 */
export function initMCPServer(): void {
  registerRottraTools();
  registerRottraResources();
  registerRottraPrompts();
  console.log("[MCP] Server initialized with all built-in components");
}

// ── HTTP Route Handler ────────────────────────────────────────

/**
 * Create MCP HTTP routes for Hono
 */
export function createMCPRoutes() {
  const mcpApp = new Hono();

  // POST /mcp — Main MCP endpoint (JSON-RPC)
  mcpApp.post("/", async (c: any) => {
    const body = await c.req.json();
    const response = await handleMCPRequest(body);
    return c.json(response);
  });

  // GET /mcp/tools — List tools
  mcpApp.get("/tools", (c: any) => {
    return c.json(
      Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    );
  });

  // GET /mcp/resources — List resources
  mcpApp.get("/resources", (c: any) => {
    return c.json(
      Array.from(resources.values()).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    );
  });

  return mcpApp;
}

export const mcpServer = {
  registerTool,
  registerResource,
  registerPrompt,
  handleMCPRequest,
  initMCPServer,
  createMCPRoutes,
};
