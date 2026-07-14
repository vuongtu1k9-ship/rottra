/**
 * 🧠 ROTTRA — EXTERNAL AGENT AUTHENTICATION
 * API key management, rate limiting, and permission control for external agents.
 * Runs on Bun runtime.
 */

import { randomUUID, createHash, createHmac } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────

export interface AgentAPIKey {
  id: string;
  agentName: string;
  agentId: string;
  key: string;
  keyHash: string;
  permissions: AgentPermission[];
  rateLimit: RateLimitConfig;
  createdAt: Date;
  expiresAt?: Date | undefined;
  lastUsedAt?: Date | undefined;
  isActive: boolean;
}

export type AgentPermission =
  | "read:knowledge"
  | "write:knowledge"
  | "read:sensors"
  | "write:sensors"
  | "execute:fl_round"
  | "execute:negotiation"
  | "read:market_data"
  | "admin:*";

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface AuthResult {
  authenticated: boolean;
  agentId?: string;
  permissions?: AgentPermission[];
  error?: string;
}

// ── API Key Store ─────────────────────────────────────────────

const apiKeys: Map<string, AgentAPIKey> = new Map();
const rateLimitCounters: Map<string, { minute: number; hour: number; day: number; lastReset: Date }> = new Map();

/**
 * Generate a new API key for an external agent
 */
export function generateAPIKey(
  agentName: string,
  permissions: AgentPermission[],
  rateLimit?: Partial<RateLimitConfig>,
  expiresAt?: Date,
): AgentAPIKey {
  const id = randomUUID();
  const key = `rottra_${id.replace(/-/g, "")}`;
  const keyHash = createHash("sha256").update(key).digest("hex");

  const apiKey: AgentAPIKey = {
    id,
    agentName,
    agentId: `ext_${agentName.toLowerCase().replace(/\s+/g, "_")}`,
    key,
    keyHash,
    permissions,
    rateLimit: {
      requestsPerMinute: rateLimit?.requestsPerMinute ?? 60,
      requestsPerHour: rateLimit?.requestsPerHour ?? 1000,
      requestsPerDay: rateLimit?.requestsPerDay ?? 10000,
    },
    createdAt: new Date(),
    expiresAt,
    isActive: true,
  };

  apiKeys.set(keyHash, apiKey);
  console.log(`[AUTH] API key generated for ${agentName} (ID: ${apiKey.agentId})`);
  return apiKey;
}

/**
 * Authenticate an incoming request using API key
 */
export function authenticateAPIKey(providedKey: string): AuthResult {
  if (!providedKey) {
    return { authenticated: false, error: "No API key provided" };
  }

  const keyHash = createHash("sha256").update(providedKey).digest("hex");
  const apiKey = apiKeys.get(keyHash);

  if (!apiKey) {
    return { authenticated: false, error: "Invalid API key" };
  }

  if (!apiKey.isActive) {
    return { authenticated: false, error: "API key is deactivated" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { authenticated: false, error: "API key has expired" };
  }

  // Update last used
  apiKey.lastUsedAt = new Date();

  return {
    authenticated: true,
    agentId: apiKey.agentId,
    permissions: apiKey.permissions,
  };
}

/**
 * Check if an agent has a specific permission
 */
export function hasPermission(agentId: string, permission: AgentPermission): boolean {
  for (const apiKey of apiKeys.values()) {
    if (apiKey.agentId === agentId && apiKey.isActive) {
      // Check for wildcard admin permission
      if (apiKey.permissions.includes("admin:*")) return true;
      return apiKey.permissions.includes(permission);
    }
  }
  return false;
}

/**
 * Rate limit check for an agent
 */
export function checkRateLimit(agentId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = new Date();
  let counter = rateLimitCounters.get(agentId);

  if (!counter) {
    counter = { minute: 0, hour: 0, day: 0, lastReset: now };
    rateLimitCounters.set(agentId, counter);
  }

  // Find the agent's rate limit config
  let limitConfig: RateLimitConfig = { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000 };
  for (const apiKey of apiKeys.values()) {
    if (apiKey.agentId === agentId) {
      limitConfig = apiKey.rateLimit;
      break;
    }
  }

  // Reset counters if window expired
  const minuteAgo = new Date(now.getTime() - 60000);
  const hourAgo = new Date(now.getTime() - 3600000);
  const dayAgo = new Date(now.getTime() - 86400000);

  if (counter.lastReset < minuteAgo) counter.minute = 0;
  if (counter.lastReset < hourAgo) counter.hour = 0;
  if (counter.lastReset < dayAgo) counter.day = 0;

  // Check limits
  if (counter.minute >= limitConfig.requestsPerMinute) {
    return { allowed: false, retryAfterMs: 60000 - (now.getTime() - counter.lastReset.getTime()) };
  }
  if (counter.hour >= limitConfig.requestsPerHour) {
    return { allowed: false, retryAfterMs: 3600000 - (now.getTime() - counter.lastReset.getTime()) };
  }
  if (counter.day >= limitConfig.requestsPerDay) {
    return { allowed: false, retryAfterMs: 86400000 - (now.getTime() - counter.lastReset.getTime()) };
  }

  // Increment counters
  counter.minute++;
  counter.hour++;
  counter.day++;
  counter.lastReset = now;

  return { allowed: true };
}

/**
 * Deactivate an API key
 */
export function deactivateAPIKey(keyHash: string): boolean {
  const apiKey = apiKeys.get(keyHash);
  if (!apiKey) return false;
  apiKey.isActive = false;
  console.log(`[AUTH] API key deactivated for ${apiKey.agentName}`);
  return true;
}

/**
 * List all API keys (masked)
 */
export function listAPIKeys(): { agentName: string; agentId: string; keyPrefix: string; permissions: string[]; isActive: boolean }[] {
  return Array.from(apiKeys.values()).map((k) => ({
    agentName: k.agentName,
    agentId: k.agentId,
    keyPrefix: k.key.slice(0, 12) + "...",
    permissions: k.permissions,
    isActive: k.isActive,
  }));
}

// ── Hono Middleware ───────────────────────────────────────────

/**
 * Create authentication middleware for Hono routes
 */
export function createAuthMiddleware(requiredPermissions: AgentPermission[] = []) {
  return async (c: any, next: any) => {
    const authHeader = c.req.header("Authorization");
    const apiKeyHeader = c.req.header("X-API-Key");

    // Try API key from header
    const providedKey = apiKeyHeader || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

    if (!providedKey) {
      return c.json({ success: false, error: "API key required. Provide via X-API-Key header or Authorization: Bearer <key>" }, 401);
    }

    const authResult = authenticateAPIKey(providedKey);
    if (!authResult.authenticated) {
      return c.json({ success: false, error: authResult.error }, 401);
    }

    // Check rate limit
    const rateLimitResult = checkRateLimit(authResult.agentId!);
    if (!rateLimitResult.allowed) {
      return c.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        429,
      );
    }

    // Check permissions
    for (const perm of requiredPermissions) {
      if (!hasPermission(authResult.agentId!, perm)) {
        return c.json({ success: false, error: `Missing permission: ${perm}` }, 403);
      }
    }

    // Attach agent info to context
    c.set("agentId", authResult.agentId);
    c.set("agentPermissions", authResult.permissions);

    await next();
  };
}

// ── Initialize Default Keys ───────────────────────────────────

/**
 * Create default API keys for known agents
 */
export function initDefaultKeys(): void {
  // Rottra internal agent key (full access)
  generateAPIKey("Rottra Internal", ["admin:*"], {
    requestsPerMinute: 1000,
    requestsPerHour: 100000,
    requestsPerDay: 1000000,
  });

  // Read-only key for external integrations
  generateAPIKey("External Integration", ["read:knowledge", "read:sensors", "read:market_data"], {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  });

  console.log("[AUTH] Default API keys generated");
}

export const agentAuth = {
  generateAPIKey,
  authenticateAPIKey,
  hasPermission,
  checkRateLimit,
  deactivateAPIKey,
  listAPIKeys,
  createAuthMiddleware,
  initDefaultKeys,
};
