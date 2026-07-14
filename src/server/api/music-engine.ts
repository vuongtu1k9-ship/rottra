import { createLogger } from "~/shared/logger";

const log = createLogger("api/music-engine");
/**
 * ACE-Step Music Engine — Tích hợp AI Music cho 12 Agent bán hàng Rottra
 * Mỗi agent có style nhạc riêng, tự động tạo nền khi trả lời khách
 *
 * Backend: ACE-Step UI Server (Express.js + SQLite)
 * AI Engine: ACE-Step 1.5 (Gradio API)
 */
const ACESTEP_API_URL = process.env.ACESTEP_API_URL || "http://localhost:3001";
const ACESTEP_GRADIO_URL = process.env.ACESTEP_GRADIO_URL || "http://localhost:8001";

// Style nhạc cho từng agent persona
export const AGENT_MUSIC_PROFILES: Record<string, { style: string; bpm: number; key: string; duration: number }> = {
  toLuong: { style: "warm folk acoustic, gentle guitar, vietnamese countryside", bpm: 90, key: "C major", duration: 15 },
  thuongNguyet: { style: "elegant classical piano, soft strings, refined", bpm: 72, key: "G major", duration: 15 },
  tramTinh: { style: "mystical ambient, ethereal pads, crystal bells", bpm: 80, key: "D minor", duration: 15 },
  daoTieuCuu: { style: "playful cute kawaii, xylophone, bouncy rhythm", bpm: 110, key: "F major", duration: 12 },
  hoaHuynh: { style: "passionate flamenco guitar, fiery rhythm, warm", bpm: 100, key: "A minor", duration: 15 },
  phiNguyet: { style: "elegant harp, moonlight atmosphere, serene", bpm: 68, key: "Eb major", duration: 15 },
  nhuNguyet: { style: "gentle lullaby, music box, soft percussion", bpm: 75, key: "Bb major", duration: 12 },
  suGia: { style: "epic cinematic orchestral, drums, heroic", bpm: 95, key: "C minor", duration: 20 },
  phiAnh: { style: "fairy tale celesta, magical sparkles, light", bpm: 85, key: "A major", duration: 12 },
  bachDiHanh: { style: "warrior march, taiko drums, bold brass", bpm: 105, key: "E minor", duration: 18 },
  uVuongMau: { style: "dark gothic ambient, deep bass, mysterious", bpm: 70, key: "F minor", duration: 15 },
  bachLoc: { style: "forest nature sounds, birds, gentle flute", bpm: 82, key: "G major", duration: 15 },
};

// Tín hiệu mood từ nội dung trả lời
export function detectMoodFromReply(reply: string): "positive" | "neutral" | "urgent" | "calm" {
  const lower = reply.toLowerCase();
  if (lower.includes("cảm ơn") || lower.includes("tuyệt vời") || lower.includes("thành công") || lower.includes("chúc mừng"))
    return "positive";
  if (lower.includes("lỗi") || lower.includes("thất bại") || lower.includes("cảnh báo") || lower.includes("nguy cấp")) return "urgent";
  if (lower.includes("tư vấn") || lower.includes("phân tích") || lower.includes("giải thích") || lower.includes("chi tiết")) return "calm";
  return "neutral";
}

// Gọi ACE-Step UI API tạo nhạc (REST API)
export async function generateAgentMusic(
  agentId: string,
  mood: string,
): Promise<{ success: boolean; audioUrl?: string; jobId?: string; error?: string }> {
  const profile = AGENT_MUSIC_PROFILES[agentId] || AGENT_MUSIC_PROFILES.toLuong;

  // Điều chỉnh style theo mood
  let style = profile.style;
  if (mood === "positive") style += ", upbeat, cheerful";
  else if (mood === "urgent") style += ", intense, dramatic";
  else if (mood === "calm") style += ", slow, peaceful";

  try {
    // Gọi ACE-Step UI REST API (port 3001)
    const res = await fetch(`${ACESTEP_API_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: style,
        lyrics: "[Instrumental]",
        duration: profile.duration,
        bpm: profile.bpm,
        key: profile.key,
        instrumental: true,
        batch_size: 1,
        ai_enhance: false,
        thinking_mode: false,
      }),
      signal: AbortSignal.timeout(60_000), // 60s timeout cho generation
    });

    if (!res.ok) throw new Error(`ACE-Step UI returned ${res.status}`);

    const data = await res.json();

    // ACE-Step UI trả về job ID hoặc audio URL trực tiếp
    if (data.audioUrl || data.audio_url) {
      const audioUrl = data.audioUrl || data.audio_url;
      return { success: true, audioUrl: audioUrl.startsWith("http") ? audioUrl : `${ACESTEP_API_URL}${audioUrl}` };
    }

    if (data.jobId || data.job_id) {
      // Nếu trả về job ID, poll để lấy kết quả
      return await pollJobResult(data.jobId || data.job_id);
    }

    return { success: false, error: "No audio in response" };
  } catch (err: any) {
    log.error(`[MusicEngine] Failed for agent ${agentId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Poll job result (nếu ACE-Step UI trả về job ID)
async function pollJobResult(
  jobId: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${ACESTEP_API_URL}/api/jobs/${jobId}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`Job poll failed: ${res.status}`);

      const data = await res.json();

      if (data.status === "completed" || data.status === "done") {
        const audioUrl = data.audioUrl || data.audio_url || data.output?.[0]?.audio_path;
        if (audioUrl) {
          return { success: true, audioUrl: audioUrl.startsWith("http") ? audioUrl : `${ACESTEP_API_URL}${audioUrl}` };
        }
        return { success: false, error: "Job completed but no audio URL" };
      }

      if (data.status === "failed" || data.status === "error") {
        return { success: false, error: data.error || "Job failed" };
      }

      // Chờ và poll lại
      await new Promise((r) => setTimeout(r, intervalMs));
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "Job timeout" };
}

// Direct call to ACE-Step Gradio API (nếu không qua UI server)
export async function generateAgentMusicDirect(
  agentId: string,
  mood: string,
): Promise<{ success: boolean; audioUrl?: string; error?: string }> {
  const profile = AGENT_MUSIC_PROFILES[agentId] || AGENT_MUSIC_PROFILES.toLuong;

  let style = profile.style;
  if (mood === "positive") style += ", upbeat, cheerful";
  else if (mood === "urgent") style += ", intense, dramatic";
  else if (mood === "calm") style += ", slow, peaceful";

  try {
    const res = await fetch(`${ACESTEP_GRADIO_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          style, // tags
          "[Instrumental]", // lyrics
          profile.duration, // duration
          profile.bpm, // bpm
          profile.key, // key
          true, // instrumental
          1, // batch_size
          27, // inference_steps
          0.8, // guidance_scale
          42, // seed
        ],
      }),
      signal: AbortSignal.timeout(120_000), // 2 min for Gradio
    });

    if (!res.ok) throw new Error(`Gradio returned ${res.status}`);

    const data = await res.json();

    // Gradio API trả về array of audio paths
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const audioPath = data.data[0];
      return { success: true, audioUrl: `${ACESTEP_GRADIO_URL}/file=${audioPath}` };
    }

    return { success: false, error: "No audio in Gradio response" };
  } catch (err: any) {
    log.error(`[MusicEngine] Direct Gradio failed for agent ${agentId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Tạo nhạc nền cho agent trả lời (wrapper cho chat flow)
export async function getAgentBackgroundMusic(agentId: string, replyText: string): Promise<{ audioUrl: string | null }> {
  const mood = detectMoodFromReply(replyText);

  // Thử gọi ACE-Step UI REST API trước
  let result = await generateAgentMusic(agentId, mood);

  // Nếu UI server không khả dụng, fallback trực tiếp Gradio
  if (!result.success && result.error?.includes("fetch")) {
    log.info("[MusicEngine] UI server unreachable, falling back to Gradio direct");
    result = await generateAgentMusicDirect(agentId, mood);
  }

  if (result.success && result.audioUrl) {
    return { audioUrl: result.audioUrl };
  }
  return { audioUrl: null };
}

// Health check — kiểm tra ACE-Step server có đang chạy không
export async function checkAceStepHealth(): Promise<{
  uiServer: boolean;
  gradioServer: boolean;
  details?: string;
}> {
  const [uiCheck, gradioCheck] = await Promise.allSettled([
    fetch(`${ACESTEP_API_URL}/api/health`, { signal: AbortSignal.timeout(5000) }),
    fetch(`${ACESTEP_GRADIO_URL}/api/info`, { signal: AbortSignal.timeout(5000) }),
  ]);

  return {
    uiServer: uiCheck.status === "fulfilled" && uiCheck.value.ok,
    gradioServer: gradioCheck.status === "fulfilled" && gradioCheck.value.ok,
    details: `UI: ${ACESTEP_API_URL} | Gradio: ${ACESTEP_GRADIO_URL}`,
  };
}
