/**
 * Creative Engine — Unified pipeline cho 12 Agent Rottra
 * Tích hợp: Text (LLM) + Ảnh (Pollinations) + Video (HyperFrames) + Nhạc (ACE-Step)
 *
 * Mỗi agent có creative profile riêng: style ảnh, nhạc nền, video template.
 */

import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";

// ═══════════════════════════════════════════════
// AGENT CREATIVE PROFILES
// ═══════════════════════════════════════════════

export interface AgentCreativeProfile {
  id: string;
  name: string;
  imageStyle: string;
  musicStyle: string;
  musicBpm: number;
  musicKey: string;
  videoTheme: string;
  videoHook: string;
  personality: string;
}

export const AGENT_CREATIVE_PROFILES: Record<string, AgentCreativeProfile> = {
  toLuong: {
    id: "toLuong",
    name: "Tô Lương",
    imageStyle: "warm watercolor, vietnamese countryside, golden light, rice fields, gentle",
    musicStyle: "warm folk acoustic, gentle guitar, vietnamese countryside, peaceful",
    musicBpm: 90,
    musicKey: "C major",
    videoTheme: "countryside",
    videoHook: "Hương đồng cỏ nội, chất lượng từ tâm",
    personality: "Lạnh lùng nhưng ấm áp, đáng tin cậy",
  },
  thuongNguyet: {
    id: "thuongNguyet",
    name: "Thương Nguyệt",
    imageStyle: "elegant classical, soft moonlight, refined, silver and purple tones, luxurious",
    musicStyle: "elegant classical piano, soft strings, refined, moonlight",
    musicBpm: 72,
    musicKey: "G major",
    videoTheme: "moonlight",
    videoHook: "Sang trọng từ chi tiết, tinh tế trong từng sản phẩm",
    personality: "Đanh đá nhưng sang trọng, luôn đúng giá",
  },
  tramTinh: {
    id: "tramTinh",
    name: "Trầm Tĩnh",
    imageStyle: "mystical ambient, ethereal, deep blue tones, crystal, serene contemplation",
    musicStyle: "mystical ambient, ethereal pads, crystal bells, meditative",
    musicBpm: 80,
    musicKey: "D minor",
    videoTheme: "ethereal",
    videoHook: "Yên tĩnh tìm thấy giá trị đích thực",
    personality: "Trầm lặng, phân tích sâu, đáng tin",
  },
  daoTieuCuu: {
    id: "daoTieu Cuu",
    name: "Đào Tiểu Cửu",
    imageStyle: "playful cute kawaii, bright colors, bouncy, cheerful, cartoon-like, fun",
    musicStyle: "playful cute kawaii, xylophone, bouncy rhythm, cheerful",
    musicBpm: 110,
    musicKey: "F major",
    videoTheme: "playful",
    videoHook: "Vui tươi mua sắm, deals hot mỗi ngày!",
    personality: "Linh hoạt, vui tính, luôn có deal tốt",
  },
  hoaHuynh: {
    id: "hoaHuynh",
    name: "Hoa Huỳnh",
    imageStyle: "passionate warm tones, fiery red and orange, dramatic lighting, intense emotion",
    musicStyle: "passionate flamenco guitar, fiery rhythm, warm, intense",
    musicBpm: 100,
    musicKey: "A minor",
    videoTheme: "fiery",
    videoHook: "Nồng nàn như lửa, chất lượng đốt cháy đối thủ",
    personality: "Hung hăng, mãnh liệt, không khoan nhượng",
  },
  phiNguyet: {
    id: "phiNguyet",
    name: "Phi Nguyệt",
    imageStyle: "elegant harp, moonlight silver, ethereal night sky, serene, mystical",
    musicStyle: "elegant harp, moonlight atmosphere, serene, dreamy",
    musicBpm: 68,
    musicKey: "Eb major",
    videoTheme: "moonlit",
    videoHook: "Ánh trăng soi đường, sản phẩm dẫn lối",
    personality: "Yên bình, tinh tế, đầy quyền năng",
  },
  nhuNguyet: {
    id: "nhuNguyet",
    name: "Nhu Nguyệt",
    imageStyle: "gentle pastel colors, soft lullaby mood, music box, dreamy clouds, tender",
    musicStyle: "gentle lullaby, music box, soft percussion, tender",
    musicBpm: 75,
    musicKey: "Bb major",
    videoTheme: "dreamy",
    videoHook: "Nhẹ nhàng như gió, sản phẩm như mơ",
    personality: "Nhẹ nhàng, đáng yêu, luôn chiều lòng",
  },
  suGia: {
    id: "suGia",
    name: "Sư Gia",
    imageStyle: "epic cinematic, golden temple, heroic lighting, dramatic sky, ancient wisdom",
    musicStyle: "epic cinematic orchestral, drums, heroic, powerful",
    musicBpm: 95,
    musicKey: "C minor",
    videoTheme: "epic",
    videoHook: "Anh hùng chọn sản phẩm, sản phẩm chọn anh hùng",
    personality: "Hùng dũng, thông thái, dẫn dắt",
  },
  phiAnh: {
    id: "phiAnh",
    name: "Phi Ảnh",
    imageStyle: "fairy tale celesta, magical sparkles, light pastel, enchanted forest, whimsical",
    musicStyle: "fairy tale celesta, magical sparkles, light, whimsical",
    musicBpm: 85,
    musicKey: "A major",
    videoTheme: "magical",
    videoHook: "Phép thuật trong mỗi sản phẩm, phép màu cho cuộc sống",
    personality: "Linh hoạt, sáng tạo, đầy phép màu",
  },
  bachDiHanh: {
    id: "bachDiHanh",
    name: "Bạch Di Hành",
    imageStyle: "warrior march, bold brass, dark steel tones, military precision, determined",
    musicStyle: "warrior march, taiko drums, bold brass, determined",
    musicBpm: 105,
    musicKey: "E minor",
    videoTheme: "martial",
    videoHook: "Bách chiến bách thắng, sản phẩm đỉnh cao",
    personality: "Kiên quyết, kỷ luật, không bỏ cuộc",
  },
  uVuongMau: {
    id: "uVuongMau",
    name: "U Vương Mẫu",
    imageStyle: "dark gothic ambient, deep bass, mysterious purple, ancient power, regal darkness",
    musicStyle: "dark gothic ambient, deep bass, mysterious, regal",
    musicBpm: 70,
    musicKey: "F minor",
    videoTheme: "gothic",
    videoHook: "Quyền năng tối thượng, sản phẩm tối cao",
    personality: "Bí ẩn, quyền lực, đầy uy nghiêm",
  },
  bachLoc: {
    id: "bachLoc",
    name: "Bạch Lộc",
    imageStyle: "forest nature, fresh green, birds, gentle flute, spring morning, pure",
    musicStyle: "forest nature sounds, birds, gentle flute, fresh spring",
    musicBpm: 82,
    musicKey: "G major",
    videoTheme: "nature",
    videoHook: "Từ rừng xanh đến bàn ăn, tươi sạch mỗi ngày",
    personality: "Tự nhiên, trong sáng, đáng tin cậy",
  },
};

// ═══════════════════════════════════════════════
// IMAGE GENERATION (Pollinations.ai — free, no API key)
// ═══════════════════════════════════════════════

export async function generateAgentImage(
  agentId: string,
  productPrompt: string,
  options: { width?: number; height?: number; seed?: number } = {},
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Offline Mode: Không sử dụng API tạo ảnh ngoại lai (pollinations.ai).
  // Hệ thống trả về ảnh mặc định cục bộ thay vì gọi ra ngoài.
  return { success: true, url: "/default-avatar.avif" };
}

// ═══════════════════════════════════════════════
// MUSIC GENERATION (ACE-Step UI — free, local GPU)
// ═══════════════════════════════════════════════

const ACESTEP_API_URL = process.env.ACESTEP_API_URL || "http://localhost:3001";
const ACESTEP_GRADIO_URL = process.env.ACESTEP_GRADIO_URL || "http://localhost:8001";

export async function generateAgentMusicFull(
  agentId: string,
  mood: string,
  options: { lyrics?: string; duration?: number; instrumental?: boolean } = {},
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  const profile = AGENT_CREATIVE_PROFILES[agentId] || AGENT_CREATIVE_PROFILES.toLuong;
  const { lyrics = "[Instrumental]", duration = 15, instrumental = true } = options;

  let style = profile.musicStyle;
  if (mood === "positive") style += ", upbeat, cheerful";
  else if (mood === "urgent") style += ", intense, dramatic";
  else if (mood === "calm") style += ", slow, peaceful";

  // Try ACE-Step UI REST API first
  try {
    const res = await fetch(`${ACESTEP_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: style,
        lyrics,
        duration,
        bpm: profile.musicBpm,
        key: profile.musicKey,
        instrumental,
        batch_size: 1,
        ai_enhance: false,
        thinking_mode: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioUrl || data.audio_url) {
        const audioUrl = data.audioUrl || data.audio_url;
        return { success: true, audioUrl: audioUrl.startsWith("http") ? audioUrl : `${ACESTEP_API_URL}${audioUrl}` };
      }
      if (data.jobId || data.job_id) {
        return await pollAceStepJob(data.jobId || data.job_id);
      }
    }
  } catch {}

  // Fallback: Gradio direct API
  try {
    const res = await fetch(`${ACESTEP_GRADIO_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [style, lyrics, duration, profile.musicBpm, profile.musicKey, instrumental, 1, 27, 0.8, 42],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return { success: true, audioUrl: `${ACESTEP_GRADIO_URL}/file=${data.data[0]}` };
      }
    }
  } catch {}

  // Fallback: Algorithmic music generation (no GPU, no API needed)
  try {
    const { generateMusicSequence, notesToWav, createWavFile } = await import("~/server/api/local-media-engine");
    const sequence = generateMusicSequence(agentId, mood, Math.ceil(duration / 4));
    const pcm = notesToWav(sequence.notes);
    const wav = createWavFile(pcm);

    const fs = await import("node:fs");
    const path = await import("node:path");
    const musicDir = path.join(process.cwd(), "public", "music");
    if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

    const fileName = `agent_${agentId}_${Date.now()}.wav`;
    const filePath = path.join(musicDir, fileName);
    fs.writeFileSync(filePath, wav);

    return { success: true, audioUrl: `/music/${fileName}` };
  } catch (algoErr: any) {
    console.warn("[MusicEngine] Algorithmic fallback failed:", algoErr.message);
  }

  return { success: false, error: "No music engine available" };
}

async function pollAceStepJob(
  jobId: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${ACESTEP_API_URL}/api/jobs/${jobId}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
      const data = await res.json();
      if (data.status === "completed" || data.status === "done") {
        const audioUrl = data.audioUrl || data.audio_url || data.output?.[0]?.audio_path;
        if (audioUrl) return { success: true, audioUrl: audioUrl.startsWith("http") ? audioUrl : `${ACESTEP_API_URL}${audioUrl}` };
        return { success: false, error: "Completed but no audio" };
      }
      if (data.status === "failed" || data.status === "error") return { success: false, error: data.error || "Failed" };
      await new Promise((r) => setTimeout(r, intervalMs));
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "Timeout" };
}

// ═══════════════════════════════════════════════
// VIDEO GENERATION (HyperFrames — existing)
// ═══════════════════════════════════════════════

export async function generateAgentVideo(
  agentId: string,
  productId: string,
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  try {
    const { generateProductVideoAd } = await import("~/server/helpers/video-ad-generator");
    const result = await generateProductVideoAd(productId);
    if (result.success) {
      return { success: true, videoUrl: `/videos/output_${productId}.mp4` };
    }
    return { success: false, error: "Video render failed" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════
// TEXT ENRICHMENT (LLM — persona-driven)
// ═══════════════════════════════════════════════

export async function generateAgentCreativeText(
  agentId: string,
  productInfo: { name: string; price?: string; category?: string; description?: string },
  outputType: "caption" | "script" | "social" = "caption",
): Promise<{ success: boolean; text?: string; error?: string }> {
  const profile = AGENT_CREATIVE_PROFILES[agentId] || AGENT_CREATIVE_PROFILES.toLuong;

  const prompts: Record<string, string> = {
    caption: `Viết 1 caption quảng cáo ngắn gọn (2-3 câu) cho sản phẩm "${productInfo.name}" với giá ${productInfo.price || "hợp lý"}. Phong cách: ${profile.personality}. Chủ đề: ${profile.videoHook}. Chỉ trả về caption, không giải thích.`,
    script: `Viết kịch bản video ngắn 15 giây cho sản phẩm "${productInfo.name}" (${productInfo.category || "nông sản"}). Tông giọng: ${profile.personality}. Bao gồm: hook 3s, showcase 7s, CTA 5s. Trả về JSON: { hook, showcase, cta }.`,
    social: `Viết 1 bài đăng mạng xã hội ngắn (3-5 câu) quảng bá sản phẩm "${productInfo.name}". Tính cách: ${profile.personality}. Thêm emoji phù hợp. Trả về bài đăng.`,
  };

  try {
    const result = await generateTextLocal({
      system: `Bạn là ${profile.name} — một thương nhân AI trên sàn Rottra. Tính cách: ${profile.personality}. Viết ngắn gọn, súc tích, hấp dẫn.`,
      prompt: prompts[outputType],
      isInternalReasoning: true,
    });

    if (result && result.text && result.text.trim().length > 0) {
      return { success: true, text: result.text.trim() };
    }
    return { success: false, error: "Empty LLM response" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════
// UNIFIED CREATIVE PIPELINE
// ═══════════════════════════════════════════════

export interface CreativeOutput {
  text?: string;
  imageUrl?: string;
  musicUrl?: string;
  videoUrl?: string;
  mood: string;
  agentId: string;
}

export async function generateCreativeBundle(
  agentId: string,
  productInfo: { name: string; price?: string; category?: string; description?: string },
  replyText: string,
  options: {
    includeImage?: boolean;
    includeMusic?: boolean;
    includeVideo?: boolean;
    productId?: string;
  } = {},
): Promise<CreativeOutput> {
  const mood = detectMoodFromReply(replyText);
  const { includeImage = true, includeMusic = true, includeVideo = false, productId } = options;

  const tasks: Promise<any>[] = [];

  // Generate caption text
  tasks.push(generateAgentCreativeText(agentId, productInfo, "caption").catch(() => ({ success: false })));

  // Generate image
  if (includeImage) {
    tasks.push(
      generateAgentImage(agentId, `${productInfo.name} ${productInfo.category || ""} ${productInfo.description || ""}`.trim()).catch(
        () => ({ success: false }),
      ),
    );
  }

  // Generate music via ACE-Step
  if (includeMusic) {
    tasks.push(generateAgentMusicFull(agentId, mood, { instrumental: true, duration: 15 }).catch(() => ({ success: false })));
  }

  // Generate video (only if productId provided)
  if (includeVideo && productId) {
    tasks.push(generateAgentVideo(agentId, productId).catch(() => ({ success: false })));
  }

  const results = await Promise.all(tasks);

  let idx = 0;
  const textResult = results[idx++];
  const imageUrl = includeImage ? results[idx++]?.url : undefined;
  const musicUrl = includeMusic ? results[idx++]?.audioUrl : undefined;
  const videoUrl = includeVideo && productId ? results[idx++]?.videoUrl : undefined;

  return {
    text: textResult?.text,
    imageUrl,
    musicUrl,
    videoUrl,
    mood,
    agentId,
  };
}

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

function detectMoodFromReply(reply: string): string {
  const lower = reply.toLowerCase();
  if (lower.includes("cảm ơn") || lower.includes("tuyệt vời") || lower.includes("thành công")) return "positive";
  if (lower.includes("lỗi") || lower.includes("thất bại") || lower.includes("cảnh báo")) return "urgent";
  if (lower.includes("tư vấn") || lower.includes("phân tích") || lower.includes("chi tiết")) return "calm";
  return "neutral";
}

export function getAgentCreativeProfile(agentId: string): AgentCreativeProfile {
  return AGENT_CREATIVE_PROFILES[agentId] || AGENT_CREATIVE_PROFILES.toLuong;
}
