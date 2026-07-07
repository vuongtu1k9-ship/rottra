/**
 * Local Media Engine — Tạo ảnh + nhạc bằng code cục bộ, không cần API key
 * Ảnh: SVG renderer theo style agent
 * Nhạc: Web Audio API + MIDI algorithmic
 */

// ═══════════════════════════════════════════════
// SVG IMAGE GENERATOR — Tạo ảnh sản phẩm theo style agent
// ═══════════════════════════════════════════════

const AGENT_COLORS: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
  toLuong: { primary: "#D97706", secondary: "#92400E", accent: "#FCD34D", bg: "#FEF3C7" },
  thuongNguyet: { primary: "#7C3AED", secondary: "#5B21B6", accent: "#C4B5FD", bg: "#EDE9FE" },
  tramTinh: { primary: "#6366F1", secondary: "#4338CA", accent: "#A5B4FC", bg: "#E0E7FF" },
  daoTieuCuu: { primary: "#EC4899", secondary: "#BE185D", accent: "#F9A8D4", bg: "#FCE7F3" },
  hoaHuynh: { primary: "#DC2626", secondary: "#991B1B", accent: "#FCA5A5", bg: "#FEE2E2" },
  phiNguyet: { primary: "#8B5CF6", secondary: "#6D28D9", accent: "#DDD6FE", bg: "#F5F3FF" },
  nhuNguyet: { primary: "#F472B6", secondary: "#DB2777", accent: "#FBCFE8", bg: "#FDF2F8" },
  suGia: { primary: "#B45309", secondary: "#78350F", accent: "#FDE68A", bg: "#FFFBEB" },
  phiAnh: { primary: "#10B981", secondary: "#047857", accent: "#6EE7B7", bg: "#ECFDF5" },
  bachDiHanh: { primary: "#374151", secondary: "#111827", accent: "#9CA3AF", bg: "#F3F4F6" },
  uVuongMau: { primary: "#581C87", secondary: "#3B0764", accent: "#A855F7", bg: "#2E1065" },
  bachLoc: { primary: "#059669", secondary: "#065F46", accent: "#34D399", bg: "#D1FAE5" },
};

export function generateProductSVG(agentId: string, productName: string, price: string): string {
  const colors = AGENT_COLORS[agentId] || AGENT_COLORS.toLuong;
  const initial = productName.charAt(0).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg}"/>
      <stop offset="100%" style="stop-color:${colors.primary}20"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff"/>
      <stop offset="100%" style="stop-color:#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" rx="20"/>
  <rect x="40" y="40" width="320" height="320" fill="url(#card)" rx="16" stroke="${colors.primary}30" stroke-width="2"/>
  <circle cx="200" cy="150" r="60" fill="${colors.primary}15" stroke="${colors.primary}" stroke-width="3"/>
  <text x="200" y="165" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" font-weight="bold" fill="${colors.primary}">${initial}</text>
  <text x="200" y="240" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="600" fill="#1e293b">${productName.substring(0, 25)}</text>
  <text x="200" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="${colors.primary}">${price}</text>
  <rect x="120" y="300" width="160" height="40" rx="20" fill="${colors.primary}"/>
  <text x="200" y="326" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="white">Xem chi tiết</text>
</svg>`;
}

// ═══════════════════════════════════════════════
// ALGORITHMIC MUSIC GENERATOR — Tạo nhạc nền MIDI
// ═══════════════════════════════════════════════

const SCALE_NOTES: Record<string, number[]> = {
  "C major": [60, 62, 64, 65, 67, 69, 71, 72],
  "G major": [55, 57, 59, 60, 62, 64, 66, 67],
  "D minor": [50, 52, 53, 55, 57, 58, 60, 62],
  "F major": [53, 55, 57, 58, 60, 62, 64, 65],
  "A minor": [57, 59, 60, 62, 64, 65, 67, 69],
  "Eb major": [51, 53, 55, 56, 58, 60, 62, 63],
  "Bb major": [46, 48, 50, 51, 53, 55, 57, 58],
  "C minor": [48, 50, 51, 53, 55, 56, 58, 60],
  "A major": [57, 59, 61, 62, 64, 66, 68, 69],
  "E minor": [52, 54, 55, 57, 59, 60, 62, 64],
  "F minor": [53, 55, 56, 58, 60, 61, 63, 65],
};

const AGENT_MUSIC: Record<string, { scale: string; pattern: number[]; velocity: number }> = {
  toLuong: { scale: "C major", pattern: [0, 2, 4, 5, 4, 2, 0, -1], velocity: 80 },
  thuongNguyet: { scale: "G major", pattern: [0, 4, 7, 4, 0, 4, 7, 4], velocity: 60 },
  tramTinh: { scale: "D minor", pattern: [0, 3, 5, 7, 5, 3, 0, -1], velocity: 50 },
  daoTieuCuu: { scale: "F major", pattern: [0, 2, 4, 5, 7, 5, 4, 2], velocity: 90 },
  hoaHuynh: { scale: "A minor", pattern: [0, 3, 7, 12, 7, 3, 0, -1], velocity: 85 },
  phiNguyet: { scale: "Eb major", pattern: [0, 4, 7, 11, 7, 4, 0, -1], velocity: 55 },
  nhuNguyet: { scale: "Bb major", pattern: [0, 2, 4, 5, 4, 2, 0, -1], velocity: 50 },
  suGia: { scale: "C minor", pattern: [0, 3, 5, 7, 12, 7, 5, 3], velocity: 90 },
  phiAnh: { scale: "A major", pattern: [0, 4, 7, 12, 7, 4, 0, -1], velocity: 65 },
  bachDiHanh: { scale: "E minor", pattern: [0, 3, 5, 7, 12, 7, 5, 3], velocity: 95 },
  uVuongMau: { scale: "F minor", pattern: [0, 3, 5, 8, 5, 3, 0, -1], velocity: 45 },
  bachLoc: { scale: "C major", pattern: [0, 2, 4, 7, 4, 2, 0, -1], velocity: 60 },
};

// Tạo MIDI-like note sequence
export function generateMusicSequence(
  agentId: string,
  mood: string,
  bars: number = 4,
): { notes: Array<{ pitch: number; duration: number; velocity: number; time: number }>; bpm: number; key: string } {
  const profile = AGENT_MUSIC[agentId] || AGENT_MUSIC.toLuong;
  const scale = SCALE_NOTES[profile.scale] || SCALE_NOTES["C major"];
  const pattern = profile.pattern;
  const notesPerBar = 8;
  const totalNotes = bars * notesPerBar;

  let bpm = 80;
  if (mood === "positive") bpm = 110;
  else if (mood === "urgent") bpm = 130;
  else if (mood === "calm") bpm = 65;

  const beatDuration = 60 / bpm;
  const notes: Array<{ pitch: number; duration: number; velocity: number; time: number }> = [];

  for (let i = 0; i < totalNotes; i++) {
    const patternIdx = i % pattern.length;
    const noteOffset = pattern[patternIdx];
    if (noteOffset === -1) continue; // rest

    const scaleIdx = Math.abs(noteOffset) % scale.length;
    const pitch = scale[scaleIdx] + (noteOffset >= 12 ? 12 : 0);
    const time = i * beatDuration * 0.5;
    const velocity = profile.velocity + (mood === "positive" ? 15 : mood === "urgent" ? 20 : 0);

    notes.push({
      pitch,
      duration: beatDuration * 0.5,
      velocity: Math.min(127, velocity),
      time,
    });
  }

  return { notes, bpm, key: profile.scale };
}

// Convert to simple audio buffer (PCM)
export function notesToWav(
  notes: Array<{ pitch: number; duration: number; velocity: number; time: number }>,
  sampleRate: number = 44100,
): Buffer {
  const maxTime = Math.max(...notes.map((n) => n.time + n.duration)) + 0.5;
  const totalSamples = Math.floor(maxTime * sampleRate);
  const buffer = new Float32Array(totalSamples);

  for (const note of notes) {
    const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
    const startSample = Math.floor(note.time * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((note.time + note.duration) * sampleRate));
    const amp = (note.velocity / 127) * 0.3;

    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / sampleRate;
      const envelope = Math.min(1, t * 20) * Math.exp(-t * 2);
      buffer[i] += Math.sin(2 * Math.PI * freq * t) * amp * envelope;
    }
  }

  // Convert to 16-bit PCM
  const pcm = Buffer.alloc(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    pcm.writeInt16LE(Math.floor(sample * 32767), i * 2);
  }

  return pcm;
}

// WAV header + PCM
export function createWavFile(pcmData: Buffer, sampleRate: number = 44100): Buffer {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// ═══════════════════════════════════════════════
// COMBINED API
// ═══════════════════════════════════════════════

export function getLocalAgentMedia(agentId: string, productName: string, price: string, replyText: string) {
  const mood =
    replyText.includes("cảm ơn") || replyText.includes("thành công")
      ? "positive"
      : replyText.includes("lỗi") || replyText.includes("cảnh báo")
        ? "urgent"
        : replyText.includes("tư vấn") || replyText.includes("phân tích")
          ? "calm"
          : "neutral";

  const svgImage = generateProductSVG(agentId, productName, price);
  const musicSeq = generateMusicSequence(agentId, mood);
  const pcm = generatePCM(musicSeq);
  const wav = createWavFile(pcm);
  const music = wav.toString("base64");

  return { mood, svgImage, music };
}

// ═══════════════════════════════════════════════
// OFFLINE NATIVE AI HUB (C++ BRIDGE)
// Kết nối với lõi C++ (ai_core.exe) để Sinh Ảnh, Video, Âm thanh
// ═══════════════════════════════════════════════

export async function callNativeAiHub(mode: 'image' | 'video' | 'text' | 'audio', prompt: string): Promise<any> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const execFileAsync = promisify(execFile);

  const coreExePath = path.join(process.cwd(), "bin", "ai_core.exe");
  
  try {
    await fs.access(coreExePath);
  } catch {
    console.warn(`⚠️ [C++ BRIDGE] Không tìm thấy lõi C++ tại: ${coreExePath}`);
    console.warn(`⚠️ Sếp cần biên dịch C++ bằng file build_ai_core.bat trước!`);
    throw new Error("Native AI Core not compiled.");
  }

  console.log(`🚀 [C++ BRIDGE] Đang kích hoạt lõi C++ chế độ [${mode.toUpperCase()}]...`);
  
  try {
    const { stdout } = await execFileAsync(coreExePath, [mode, prompt]);
    
    // C++ trả về JSON chuẩn
    const result = JSON.parse(stdout.trim());
    console.log(`✅ [C++ BRIDGE] Hoàn tất. Trạng thái: ${result.status}`);
    return result;
  } catch (err) {
    console.error(`❌ [C++ BRIDGE] Lỗi khi chạy lõi C++:`, err);
    throw err;
  }
}

// Sinh Ảnh Siêu Thực (AVIF) thông qua C++
export async function createPhotorealisticAVIF(productName: string): Promise<string> {
  try {
    const crypto = await import("node:crypto");
    const path = await import("node:path");
    const hash = crypto.createHash("md5").update(productName + Date.now()).digest("hex");
    const prompt = `A highly detailed, photorealistic macro shot of premium ${productName}. Resting elegantly on a minimalist dark stone slab. Soft, warm studio lighting highlights the texture. Dark, premium aesthetic. No text, no logos.`;
    
    // Gọi cầu nối C++ thay vì gọi sd.exe trực tiếp
    const aiResult = await callNativeAiHub('image', prompt);
    
    if (aiResult.status === "success") {
        // Trong thực tế, aiResult.file_path sẽ chứa ảnh do C++ sinh ra.
        // Tạm thời trả về mock url để Web không bị lỗi
        return `/images/mock-image-${hash}.avif`;
    }
    return "/images/no-image.avif";
  } catch (err) {
    return "/images/no-image.avif";
  }
}

// Sinh Video Quảng Cáo ngắn thông qua C++
export async function generateOfflineVideo(productName: string): Promise<string> {
  try {
    const prompt = `Cinematic slow panning shot of ${productName}, 4k resolution, highly detailed, professional commercial lighting.`;
    const aiResult = await callNativeAiHub('video', prompt);
    
    if (aiResult.status === "success") {
        return aiResult.file_path || `/videos/mock-video.mp4`;
    }
    return "/videos/no-video.mp4";
  } catch (err) {
    return "/videos/no-video.mp4";
  }
}

// Sinh Giọng Nói (TTS) thông qua C++
export async function generateOfflineAudio(textToSpeak: string): Promise<string> {
  try {
    const aiResult = await callNativeAiHub('audio', textToSpeak);
    
    if (aiResult.status === "success") {
        return aiResult.file_path || `/audio/mock-voice.wav`;
    }
    return "/audio/no-audio.wav";
  } catch (err) {
    return "/audio/no-audio.wav";
  }
}
