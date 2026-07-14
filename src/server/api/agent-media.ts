import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { generateProductSVG, generateMusicSequence, notesToWav, createWavFile, getLocalAgentMedia } from "~/server/api/local-media-engine";

export const mediaApp = new Hono();

const imageSchema = z.object({
  agentId: z.string(),
  productName: z.string(),
  price: z.string().optional(),
});

// POST /api/media/image — Tạo ảnh SVG sản phẩm theo style agent
mediaApp.post("/image", zValidator("json", imageSchema), async (c) => {
  try {
    const { agentId, productName, price } = c.req.valid("json");

    const svg = generateProductSVG(agentId, productName, price || "Liên hệ");
    return c.json({ success: true, svg, contentType: "image/svg+xml" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

const musicSchema = z.object({
  agentId: z.string(),
  mood: z.string().optional(),
  bars: z.number().optional(),
});

// POST /api/media/music — Tạo nhạc WAV algorithmic
mediaApp.post("/music", zValidator("json", musicSchema), async (c) => {
  try {
    const { agentId, mood, bars } = c.req.valid("json");

    const sequence = generateMusicSequence(agentId, mood || "neutral", bars || 4);
    const pcm = notesToWav(sequence.notes);
    const wav = createWavFile(pcm);

    return c.body(new Uint8Array(wav), 200, {
      "Content-Type": "audio/wav",
      "Content-Length": wav.length.toString(),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

const bothSchema = z.object({
  agentId: z.string(),
  productName: z.string().optional(),
  price: z.string().optional(),
  replyText: z.string().optional(),
});

// POST /api/media/both — Tạo cả ảnh + nhạc
mediaApp.post("/both", zValidator("json", bothSchema), async (c) => {
  try {
    const { agentId, productName, price, replyText } = c.req.valid("json");

    const result = getLocalAgentMedia(agentId, productName || "Sản phẩm", price || "Liên hệ", replyText || "");

    return c.json({
      success: true,
      mood: result.mood,
      svg: result.svgImage,
      musicNotes: result.musicSeq.notes.length,
      bpm: result.musicSeq.bpm,
      key: result.musicSeq.key,
      wavBase64: result.wavBase64,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
