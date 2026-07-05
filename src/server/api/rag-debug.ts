import { Hono } from "hono";
import { hybridRetrieve } from "~/core/neural-memory/vector-rag";

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
    console.error("[RAG Debug Error]", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
