/**
 * Creative Engine API Routes
 * POST /api/creative/image — Tạo ảnh theo style agent
 * POST /api/creative/music — Tạo nhạc ACE-Step theo agent
 * POST /api/creative/video — Tạo video theo agent
 * POST /api/creative/text — Tạo caption/script theo agent
 * POST /api/creative/bundle — Tạo bundle creative (ảnh + nhạc + video + text)
 * GET /api/creative/profiles — Liệt kê creative profiles của 12 agent
 */

import { Hono } from "hono";
import {
  generateAgentImage,
  generateAgentMusicFull,
  generateAgentVideo,
  generateAgentCreativeText,
  generateCreativeBundle,
  getAgentCreativeProfile,
  AGENT_CREATIVE_PROFILES,
} from "./creative-engine";

export const creativeApp = new Hono();

// GET /api/creative/profiles — Danh sách creative profiles
creativeApp.get("/profiles", (c) => {
  const profiles = Object.values(AGENT_CREATIVE_PROFILES).map((p) => ({
    id: p.id,
    name: p.name,
    personality: p.personality,
    imageStyle: p.imageStyle.split(",")[0],
    musicStyle: p.musicStyle.split(",")[0],
    videoHook: p.videoHook,
  }));
  return c.json({ success: true, profiles });
});

// POST /api/creative/image — Tạo ảnh theo style agent
creativeApp.post("/image", async (c) => {
  try {
    const { agentId, prompt, width, height, seed } = await c.req.json();
    if (!agentId || !prompt) return c.json({ success: false, error: "Missing agentId or prompt" }, 400);

    const result = await generateAgentImage(agentId, prompt, { width, height, seed });
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/creative/music — Tạo nhạc theo agent (ACE-Step)
creativeApp.post("/music", async (c) => {
  try {
    const { agentId, mood, lyrics, duration, instrumental } = await c.req.json();
    if (!agentId) return c.json({ success: false, error: "Missing agentId" }, 400);

    const result = await generateAgentMusicFull(agentId, mood || "neutral", { lyrics, duration, instrumental });
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/creative/video — Tạo video theo agent
creativeApp.post("/video", async (c) => {
  try {
    const { agentId, productId } = await c.req.json();
    if (!agentId || !productId) return c.json({ success: false, error: "Missing agentId or productId" }, 400);

    const result = await generateAgentVideo(agentId, productId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/creative/text — Tạo caption/script/social post
creativeApp.post("/text", async (c) => {
  try {
    const { agentId, productInfo, outputType } = await c.req.json();
    if (!agentId || !productInfo?.name) return c.json({ success: false, error: "Missing agentId or productInfo" }, 400);

    const result = await generateAgentCreativeText(agentId, productInfo, outputType || "caption");
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/creative/bundle — Tạo bundle creative đầy đủ
creativeApp.post("/bundle", async (c) => {
  try {
    const { agentId, productInfo, replyText, includeImage, includeMusic, includeVideo, productId } = await c.req.json();
    if (!agentId || !productInfo?.name) return c.json({ success: false, error: "Missing agentId or productInfo" }, 400);

    const result = await generateCreativeBundle(agentId, productInfo, replyText || "", {
      includeImage,
      includeMusic,
      includeVideo,
      productId,
    });
    return c.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/creative/health — Kiểm tra các service creative
creativeApp.get("/health", async (c) => {
  const { checkAceStepHealth } = await import("./music-engine");
  const aceHealth = await checkAceStepHealth();

  return c.json({
    success: true,
    services: {
      aceStep: aceHealth,
      pollinations: true, // Always available (free)
      hyperframes: true, // Always available (local)
    },
  });
});
