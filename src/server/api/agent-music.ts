import { Hono } from "hono";
import { generateAgentMusic, AGENT_MUSIC_PROFILES, detectMoodFromReply } from "~/server/api/music-engine";

export const musicApp = new Hono();

// POST /api/music/generate — Tạo nhạc cho agent
musicApp.post("/generate", async (c) => {
  try {
    const { agentId, mood } = await c.req.json();

    if (!agentId) {
      return c.json({ success: false, error: "Missing agentId" }, 400);
    }

    const result = await generateAgentMusic(agentId, mood || "neutral");

    return c.json({
      success: result.success,
      audioUrl: result.audioUrl || null,
      error: result.error || null,
      profile: AGENT_MUSIC_PROFILES[agentId] || null,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/music/profiles — Xem danh sách style nhạc các agent
musicApp.get("/profiles", (c) => {
  return c.json({ profiles: AGENT_MUSIC_PROFILES });
});

// POST /api/music/detect-mood — Phân tích mood từ text
musicApp.post("/detect-mood", async (c) => {
  const { text } = await c.req.json();
  if (!text) return c.json({ mood: "neutral" });
  return c.json({ mood: detectMoodFromReply(text) });
});
