import { Hono } from "hono";
import { createLogger } from "~/shared/logger";
import { hybridRetrieve } from "~/core/neural-memory/vector-rag";

const log = createLogger("api/rag-debug");

export const ragDebugRouter = new Hono();

ragDebugRouter.post("/test-hit", async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query || "";
    const topK = parseInt(body.topK) || 5;

    if (!query) {
      return c.json({ success: false, error: "Missing query" }, 400);
    }

    const candidates = await hybridRetrieve(query, topK, null, false);
    return c.json({ success: true, candidates });
  } catch (error: any) {
    log.error("[RAG Debug Error]", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});
