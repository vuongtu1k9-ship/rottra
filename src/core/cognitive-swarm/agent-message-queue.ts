import { db } from "~/infra/database/db-pool";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: "task" | "result" | "heartbeat" | "broadcast";
  payload: any;
  status: "pending" | "processing" | "done" | "failed";
  createdAt: number;
  processedAt?: number;
}

const QUEUE_TABLE = "agent_message_queue";

async function ensureQueueTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(QUEUE_TABLE)} (
        id TEXT PRIMARY KEY,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'task',
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        processed_at INTEGER
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_queue_status ON ${sql.identifier(QUEUE_TABLE)}(status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_queue_to_agent ON ${sql.identifier(QUEUE_TABLE)}(to_agent, status)
    `);
  } catch (e) {
    console.error("[AgentQueue] Table init error:", e);
  }
}

let tableReady = false;

export async function initMessageQueue() {
  if (tableReady) return;
  await ensureQueueTable();
  tableReady = true;
  console.log("[AgentQueue] SQLite message queue ready");
}

export async function sendMessage(fromAgent: string, toAgent: string, type: AgentMessage["type"], payload: any): Promise<string> {
  await initMessageQueue();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute(sql`
    INSERT INTO ${sql.identifier(QUEUE_TABLE)} (id, from_agent, to_agent, type, payload, status, created_at)
    VALUES (${id}, ${fromAgent}, ${toAgent}, ${type}, ${JSON.stringify(payload)}, 'pending', ${now})
  `);

  return id;
}

export async function broadcastMessage(fromAgent: string, agents: string[], type: AgentMessage["type"], payload: any): Promise<string[]> {
  const ids: string[] = [];
  for (const agent of agents) {
    if (agent !== fromAgent) {
      const id = await sendMessage(fromAgent, agent, type, payload);
      ids.push(id);
    }
  }
  return ids;
}

export async function receiveMessages(agentId: string, limit: number = 10): Promise<AgentMessage[]> {
  await initMessageQueue();
  const now = Date.now();

  const rows = await db.execute(sql`
    SELECT * FROM ${sql.identifier(QUEUE_TABLE)}
    WHERE to_agent = ${agentId} AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);

  const messages: AgentMessage[] = [];
  for (const row of rows) {
    await db.execute(sql`
      UPDATE ${sql.identifier(QUEUE_TABLE)}
      SET status = 'processing', processed_at = ${now}
      WHERE id = ${row.id}
    `);

    messages.push({
      id: row.id,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      type: row.type,
      payload: JSON.parse(row.payload),
      status: "processing",
      createdAt: row.created_at,
      processedAt: now,
    });
  }

  return messages;
}

export async function completeMessage(messageId: string, result?: any) {
  const now = Date.now();
  if (result !== undefined) {
    await db.execute(sql`
      UPDATE ${sql.identifier(QUEUE_TABLE)}
      SET status = 'done', payload = ${JSON.stringify(result)},
          processed_at = ${now}
      WHERE id = ${messageId}
    `);
  } else {
    await db.execute(sql`
      UPDATE ${sql.identifier(QUEUE_TABLE)}
      SET status = 'done',
          processed_at = ${now}
      WHERE id = ${messageId}
    `);
  }
}

export async function failMessage(messageId: string, error?: string) {
  const now = Date.now();
  await db.execute(sql`
    UPDATE ${sql.identifier(QUEUE_TABLE)}
    SET status = 'failed', payload = ${JSON.stringify({ error: error || "unknown" })},
        processed_at = ${now}
    WHERE id = ${messageId}
  `);
}

export async function cleanupOldMessages(olderThanMs: number = 3600000) {
  const cutoff = Date.now() - olderThanMs;
  await db.execute(sql`
    DELETE FROM ${sql.identifier(QUEUE_TABLE)}
    WHERE status IN ('done', 'failed') AND processed_at < ${cutoff}
  `);
}

export async function getQueueStats() {
  const rows = await db.execute(sql`
    SELECT status, COUNT(*) as count FROM ${sql.identifier(QUEUE_TABLE)} GROUP BY status
  `);
  const stats: Record<string, number> = {};
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}
