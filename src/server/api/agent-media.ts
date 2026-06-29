import { Hono } from "hono";
import { generateProductSVG, generateMusicSequence, notesToWav, createWavFile, getLocalAgentMedia } from "~/server/api/local-media-engine";

export const mediaApp = new Hono();

// POST /api/media/image — Tạo ảnh SVG sản phẩm theo style agent
mediaApp.post("/image", async (c) => {
  try {
    const { agentId, productName, price } = await c.req.json();
    if (!agentId || !productName) {
      return c.json({ success: false, error: "Missing agentId or productName" }, 400);
    }

    const svg = generateProductSVG(agentId, productName, price || "Liên hệ");
    return c.json({ success: true, svg, contentType: "image/svg+xml" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/media/music — Tạo nhạc WAV algorithmic
mediaApp.post("/music", async (c) => {
  try {
    const { agentId, mood, bars } = await c.req.json();
    if (!agentId) {
      return c.json({ success: false, error: "Missing agentId" }, 400);
    }

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

// POST /api/media/both — Tạo cả ảnh + nhạc
mediaApp.post("/both", async (c) => {
  try {
    const { agentId, productName, price, replyText } = await c.req.json();
    if (!agentId) {
      return c.json({ success: false, error: "Missing agentId" }, 400);
    }

    const result = getLocalAgentMedia(agentId, productName || "Sản phẩm", price || "Liên hệ", replyText || "");
    const pcm = notesToWav(result.music.notes);
    const wav = createWavFile(pcm);

    return c.json({
      success: true,
      mood: result.mood,
      svg: result.svgImage,
      musicNotes: result.music.notes.length,
      bpm: result.music.bpm,
      key: result.music.key,
      wavBase64: wav.toString("base64"),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
