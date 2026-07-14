/**
 * 🧠 ROTTRA — AGENT-TO-AGENT (A2A) PROTOCOL
 * Standard A2A protocol implementation for inter-agent communication.
 * Enables Rottra agents to discover, communicate, and collaborate with external agents.
 * Runs on Bun runtime.
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { eq, sql, and, gte } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────

export interface A2AAgentCard {
  agentId: string;
  name: string;
  description: string;
  version: string;
  capabilities: A2ACapability[];
  endpoints: A2AEndpoint[];
  authentication: A2AAuthConfig;
  metadata: Record<string, any>;
}

export interface A2ACapability {
  type: "text_generation" | "image_classification" | "data_analysis" | "negotiation" | "translation" | "sensor_reading" | "custom";
  description: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface A2AEndpoint {
  url: string;
  protocol: "http" | "websocket" | "grpc";
  method: "POST" | "GET" | "PUT" | "DELETE";
  description: string;
}

export interface A2AAuthConfig {
  type: "api_key" | "oauth2" | "jwt" | "mtls" | "none";
  issuer?: string;
  tokenUrl?: string;
  scopes?: string[];
}

export interface A2ATask {
  id: string;
  type: string;
  input: Record<string, any>;
  status: A2ATaskStatus;
  output?: any;
  error?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | undefined;
}

export type A2ATaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface A2AMessage {
  id: string;
  role: "agent" | "external";
  content: string;
  type: "text" | "image" | "data" | "task_request" | "task_response";
  metadata?: Record<string, any> | undefined;
  timestamp: Date;
}

export interface A2AResult {
  success: boolean;
  data?: any;
  error?: string | undefined;
  latencyMs: number;
}

// ── Agent Registry ────────────────────────────────────────────

const registeredAgents: Map<string, A2AAgentCard> = new Map();
const taskQueue: Map<string, A2ATask> = new Map();

/**
 * Register a local agent in the A2A registry
 */
export function registerLocalAgent(card: Omit<A2AAgentCard, "agentId">): A2AAgentCard {
  const agentId = randomUUID();
  const fullCard: A2AAgentCard = { ...card, agentId };
  registeredAgents.set(agentId, fullCard);
  console.log(`[A2A] Agent registered: ${card.name} (${agentId})`);
  return fullCard;
}

/**
 * Discover available agents by capability
 */
export function discoverAgents(capabilityType?: string): A2AAgentCard[] {
  const agents = Array.from(registeredAgents.values());
  if (!capabilityType) return agents;
  return agents.filter((a) => a.capabilities.some((c) => c.type === capabilityType));
}

/**
 * Get agent card by ID
 */
export function getAgentCard(agentId: string): A2AAgentCard | undefined {
  return registeredAgents.get(agentId);
}

// ── Task Management ───────────────────────────────────────────

/**
 * Create a new A2A task
 */
export function createTask(type: string, input: Record<string, any>, targetAgentId?: string): A2ATask {
  const task: A2ATask = {
    id: randomUUID(),
    type,
    input,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  taskQueue.set(task.id, task);
  console.log(`[A2A] Task created: ${task.id} (type: ${type})`);
  return task;
}

/**
 * Update task status
 */
export function updateTaskStatus(taskId: string, status: A2ATaskStatus, output?: any, error?: string): A2ATask | null {
  const task = taskQueue.get(taskId);
  if (!task) return null;
  task.status = status;
  task.output = output;
  task.error = error;
  task.updatedAt = new Date();
  return task;
}

/**
 * Get task by ID
 */
export function getTask(taskId: string): A2ATask | undefined {
  return taskQueue.get(taskId);
}

/**
 * List all tasks with optional status filter
 */
export function listTasks(status?: A2ATaskStatus): A2ATask[] {
  const tasks = Array.from(taskQueue.values());
  if (!status) return tasks;
  return tasks.filter((t) => t.status === status);
}

// ── Message Exchange ──────────────────────────────────────────

/**
 * Create a message for A2A communication
 */
export function createMessage(
  role: "agent" | "external",
  content: string,
  type: A2AMessage["type"] = "text",
  metadata?: Record<string, any>,
): A2AMessage {
  return {
    id: randomUUID(),
    role,
    content,
    type,
    metadata,
    timestamp: new Date(),
  };
}

/**
 * Validate incoming A2A request
 */
export function validateA2ARequest(request: any): { valid: boolean; error?: string } {
  if (!request) return { valid: false, error: "Empty request" };
  if (!request.type) return { valid: false, error: "Missing task type" };
  if (!request.input) return { valid: false, error: "Missing task input" };
  return { valid: true };
}

// ── Protocol Handler ──────────────────────────────────────────

/**
 * Handle incoming A2A task request from external agent
 */
export async function handleA2ATaskRequest(request: { type: string; input: Record<string, any>; agentId?: string }): Promise<A2AResult> {
  const startTime = Date.now();

  // Validate
  const validation = validateA2ARequest(request);
  if (!validation.valid) {
    return { success: false, error: validation.error, latencyMs: Date.now() - startTime };
  }

  // Create task
  const task = createTask(request.type, request.input, request.agentId);

  try {
    // Process based on task type
    const result = await processTask(task);

    updateTaskStatus(task.id, "completed", result);
    return { success: true, data: result, latencyMs: Date.now() - startTime };
  } catch (err: any) {
    updateTaskStatus(task.id, "failed", undefined, err.message);
    return { success: false, error: err.message, latencyMs: Date.now() - startTime };
  }
}

/**
 * Process an A2A task based on type
 */
async function processTask(task: A2ATask): Promise<any> {
  switch (task.type) {
    case "query":
      // Delegate to RAG system
      const { hybridRetrieve } = await import("~/core/neural-memory/vector-rag");
      const results = await hybridRetrieve(task.input.text || "", 5);
      return { results: results.slice(0, 5) };

    case "classify":
      // Delegate to intent classifier
      const { classifyIntent } = await import("~/core/neural-memory/multimodal-embedding");
      const intent = await classifyIntent(task.input.text || "");
      return intent;

    case "negotiate":
      // Delegate to negotiation engine
      return { status: "negotiation_task_queued", taskId: task.id };

    case "sensor_query":
      // Delegate to sensor system
      const { getSensorData } = await import("~/infra/network/sensor-ingestion");
      const data = await getSensorData(task.input.farmId, task.input.sensorType);
      return { readings: data };

    default:
      return { message: `Unknown task type: ${task.type}`, queued: true };
  }
}

// ── A2A Server (HTTP Endpoints) ───────────────────────────────

/**
 * Create A2A protocol HTTP endpoints for Hono
 */
export function createA2ARoutes() {
  const a2aApp = new Hono();

  // GET /.well-known/agent.json — Agent Card (A2A discovery endpoint)
  a2aApp.get("/.well-known/agent.json", (c: any) => {
    const localCard: A2AAgentCard = {
      agentId: "rottra-main",
      name: "Rottra AI Agent",
      description: "Premium Agricultural Intelligence Platform — AI-Native Autonomous Agent",
      version: "3.0.0",
      capabilities: [
        { type: "text_generation", description: "Agricultural Q&A and consultation" },
        { type: "data_analysis", description: "Market price analysis, demand forecasting" },
        { type: "negotiation", description: "Multi-agent negotiation with game theory" },
        { type: "sensor_reading", description: "IoT sensor data ingestion and analysis" },
        { type: "translation", description: "6-language translation (vi, en, zh, ja, fi, he)" },
      ],
      endpoints: [
        { url: "/api/a2a/tasks", protocol: "http", method: "POST", description: "Submit A2A task" },
        { url: "/api/a2a/tasks/{taskId}", protocol: "http", method: "GET", description: "Get task status" },
        { url: "/api/a2a/agents", protocol: "http", method: "GET", description: "Discover agents" },
      ],
      authentication: { type: "api_key" },
      metadata: { provider: "Rottra", domain: "agriculture" },
    };
    return c.json(localCard);
  });

  // POST /tasks/send — Submit task to agent
  a2aApp.post("/tasks/send", async (c: any) => {
    const body = await c.req.json();
    const result = await handleA2ATaskRequest(body);
    return c.json(result);
  });

  // GET /tasks/:taskId — Get task status
  a2aApp.get("/tasks/:taskId", (c: any) => {
    const task = getTask(c.req.param("taskId"));
    if (!task) return c.json({ error: "Task not found" }, 404);
    return c.json(task);
  });

  // GET /tasks — List tasks
  a2aApp.get("/tasks", (c: any) => {
    const status = c.req.query("status") as A2ATaskStatus | undefined;
    return c.json(listTasks(status));
  });

  // GET /agents — Discover agents
  a2aApp.get("/agents", (c: any) => {
    const capability = c.req.query("capability");
    return c.json(discoverAgents(capability));
  });

  return a2aApp;
}

// ── Export ────────────────────────────────────────────────────

export const a2aProtocol = {
  registerLocalAgent,
  discoverAgents,
  getAgentCard,
  createTask,
  updateTaskStatus,
  getTask,
  listTasks,
  createMessage,
  handleA2ATaskRequest,
  createA2ARoutes,
};
