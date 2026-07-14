import { createLogger } from "~/shared/logger";
import fs from "node:fs";
import path from "node:path";

const log = createLogger("api/local-media-engine");

function getBase64ProductPhoto(productName: string): string {
  const name = productName.toLowerCase();
  let filename = "vegetable.jpg";
  if (name.includes("cà phê") || name.includes("coffee")) filename = "coffee.jpg";
  else if (name.includes("trà") || name.includes("chè") || name.includes("tea")) filename = "tea.jpg";
  else if (name.includes("sầu riêng") || name.includes("durian")) filename = "durian.jpg";
  else if (name.includes("xoài") || name.includes("mango")) filename = "mango.jpg";
  else if (name.includes("gạo") || name.includes("lúa") || name.includes("rice") || name.includes("st25")) filename = "rice.jpg";
  else if (name.includes("bơ") || name.includes("avocado")) filename = "mango.jpg";
  else if (name.includes("mật ong") || name.includes("honey")) filename = "tea.jpg";

  const imgPath = path.join(process.cwd(), "public", "images", filename);
  try {
    if (fs.existsSync(imgPath)) {
      const data = fs.readFileSync(imgPath);
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    }
  } catch (e) {
    log.error("Failed to read image for SVG embedding:", e);
  }
  return "";
}
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

export function getProductMathArt(productName: string, cx: number, cy: number, scale: number, strokeColor: string): string {
  let hash = 0;
  for (let i = 0; i < productName.length; i++) {
    hash = productName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const type = Math.abs(hash) % 5;

  if (type === 0) {
    // 1. Sacred Lotus Mandala (Overlapping Rose Curves)
    let linesStr = "";
    const steps = 180;
    const n = 5 + (Math.abs(hash) % 4); // Number of petals
    const d = 2 + (Math.abs(hash) % 3); // D parameter
    const k = n / d;

    // Draw 3 layers of rose curves with different scales, opacities, and offsets to create a 3D effect
    for (let layer = 0; layer < 3; layer++) {
      const currentScale = scale * (1 - layer * 0.22);
      const strokeOpacity = 0.85 - layer * 0.22;
      const strokeWidth = 1.8 - layer * 0.45;
      const angleOffset = (layer * Math.PI) / 12;

      let first = true;
      let pathPoints = "";
      for (let i = 0; i <= steps; i++) {
        const theta = (2 * Math.PI * d * i) / steps;
        const r = currentScale * Math.sin(k * theta);
        const x = cx + r * Math.cos(theta + angleOffset);
        const y = cy + r * Math.sin(theta + angleOffset);

        if (first) {
          pathPoints += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          first = false;
        } else {
          pathPoints += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      linesStr += `<path d="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(2)}" opacity="${strokeOpacity.toFixed(2)}"/>`;
    }
    // Add a glowing center circle
    linesStr += `<circle cx="${cx}" cy="${cy}" r="${(scale * 0.08).toFixed(1)}" fill="${strokeColor}" opacity="0.45"/>`;
    linesStr += `<circle cx="${cx}" cy="${cy}" r="${(scale * 0.04).toFixed(1)}" fill="#ffffff" opacity="0.8"/>`;
    return linesStr;
  } else if (type === 1) {
    // 2. Glowing Holographic Harmonograph (Complex Wave Interference)
    let linesStr = "";
    const steps = 300;
    const f1 = 2 + (Math.abs(hash) % 3);
    const f2 = 3 + ((Math.abs(hash) >> 2) % 3);
    const f3 = 1 + ((Math.abs(hash) >> 4) % 2);
    const f4 = 4 + ((Math.abs(hash) >> 6) % 3);
    const p1 = 0;
    const p2 = Math.PI / 2;
    const p3 = Math.PI / 3;
    const p4 = Math.PI / 4;

    let pathPoints = "";
    let first = true;
    for (let i = 0; i <= steps; i++) {
      const t = (2 * Math.PI * i) / steps;
      // Damped harmonic oscillators
      const d1 = Math.exp(-0.12 * t);
      const x = scale * d1 * (Math.sin(f1 * t + p1) + Math.sin(f2 * t + p2)) * 0.45;
      const y = scale * d1 * (Math.sin(f3 * t + p3) + Math.sin(f4 * t + p4)) * 0.45;

      const px = cx + x;
      const py = cy + y;

      if (first) {
        pathPoints += `M ${px.toFixed(1)} ${py.toFixed(1)}`;
        first = false;
      } else {
        pathPoints += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
    }
    // Add two overlapping harmonographs with different colors/opacities for a gorgeous silk look
    linesStr += `<path d="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="1.8" opacity="0.85"/>`;

    // Offset slightly for holographic effect
    let offsetPath = "";
    first = true;
    for (let i = 0; i <= steps; i++) {
      const t = (2 * Math.PI * i) / steps;
      const d1 = Math.exp(-0.12 * t);
      const x = scale * d1 * (Math.sin(f1 * t + p1 + 0.1) + Math.sin(f2 * t + p2)) * 0.43;
      const y = scale * d1 * (Math.sin(f3 * t + p3) + Math.sin(f4 * t + p4 + 0.1)) * 0.43;

      const px = cx + x + 2;
      const py = cy + y + 2;

      if (first) {
        offsetPath += `M ${px.toFixed(1)} ${py.toFixed(1)}`;
        first = false;
      } else {
        offsetPath += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
    }
    linesStr += `<path d="${offsetPath}" fill="none" stroke="${strokeColor}aa" stroke-width="1.0" opacity="0.5"/>`;
    return linesStr;
  } else if (type === 2) {
    // 3. Lorenz Chaotic Attractor with Stellar Particle Nodes
    let x = 0.1;
    let y = 0.0;
    let z = 0.0;
    const sigma = 10.0;
    const beta = 8.0 / 3.0;
    const rho = 28.0;
    const dt = 0.015;

    // Warm up
    for (let i = 0; i < 50; i++) {
      const dx = sigma * (y - x) * dt;
      const dy = (x * (rho - z) - y) * dt;
      const dz = (x * y - beta * z) * dt;
      x += dx;
      y += dy;
      z += dz;
    }

    let pathPoints = "";
    let first = true;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < 200; i++) {
      const dx = sigma * (y - x) * dt;
      const dy = (x * (rho - z) - y) * dt;
      const dz = (x * y - beta * z) * dt;
      x += dx;
      y += dy;
      z += dz;

      const px = cx + x * (scale / 16);
      const py = cy + (z - 25) * (scale / 16);

      points.push({ x: px, y: py });
      if (first) {
        pathPoints += `M ${px.toFixed(1)} ${py.toFixed(1)}`;
        first = false;
      } else {
        pathPoints += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
    }

    let linesStr = `<path d="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;

    // Draw some glowing nodes along the path
    for (let i = 0; i < points.length; i += 15) {
      const p = points[i];
      const r = 2.5 + (i % 2);
      linesStr += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${strokeColor}" opacity="0.85"/>`;
      linesStr += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(r * 2).toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="0.5" opacity="0.4"/>`;
    }
    return linesStr;
  } else if (type === 3) {
    // 4. Golden Ratio Phyllotaxis Sunflower Galaxy
    let linesStr = "";
    const goldenAngle = 137.5 * (Math.PI / 180);
    const numPoints = 120;

    for (let i = 1; i <= numPoints; i++) {
      const theta = i * goldenAngle;
      // Radius grows as square root of index
      const r = scale * 0.45 * Math.sqrt(i / numPoints);
      const px = cx + r * Math.cos(theta);
      const py = cy + r * Math.sin(theta);

      // Node size grows from center outwards
      const nodeRadius = 1.0 + 3.0 * (i / numPoints);
      const opacity = 0.35 + 0.55 * (i / numPoints);

      linesStr += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${nodeRadius.toFixed(1)}" fill="${strokeColor}" opacity="${opacity.toFixed(2)}"/>`;

      // Draw subtle connecting lines to the center to form a web
      if (i % 7 === 0) {
        linesStr += `<line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${strokeColor}" stroke-width="0.6" opacity="0.25"/>`;
      }
    }
    return linesStr;
  } else {
    // 5. Sacred Geometry - Metatron's Cube & Flower of Life Seed
    let linesStr = "";
    const radius = scale * 0.28;

    // Center circle
    linesStr += `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="1.2" opacity="0.6"/>`;

    // 6 surrounding circles
    const hexPoints: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      hexPoints.push({ x, y });

      linesStr += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="1.0" opacity="0.45"/>`;
    }

    // Draw interconnecting Star of David / Metatron lines
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        // Double lines for thick geometric feel
        linesStr += `<line x1="${hexPoints[i].x.toFixed(1)}" y1="${hexPoints[i].y.toFixed(1)}" x2="${hexPoints[j].x.toFixed(1)}" y2="${hexPoints[j].y.toFixed(1)}" stroke="${strokeColor}" stroke-width="0.8" opacity="0.4"/>`;
      }
      // Line from center to hex points
      linesStr += `<line x1="${cx}" y1="${cy}" x2="${hexPoints[i].x.toFixed(1)}" y2="${hexPoints[i].y.toFixed(1)}" stroke="${strokeColor}" stroke-width="1.2" opacity="0.5"/>`;
    }

    // Outer boundary circle
    linesStr += `<circle cx="${cx}" cy="${cy}" r="${(radius * 2).toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="1.6" opacity="0.75"/>`;

    return linesStr;
  }
}

const AGENT_NAMES: Record<string, string> = {
  toLuong: "Tô Lương",
  thuongNguyet: "Thương Nguyệt",
  tramTinh: "Trầm Tĩnh",
  daoTieuCuu: "Đào Tiểu Cửu",
  hoaHuynh: "Hoa Huỳnh",
  phiNguyet: "Phi Nguyệt",
  nhuNguyet: "Nhu Nguyệt",
  suGia: "Sư Gia",
  phiAnh: "Phi Ảnh",
  bachDiHanh: "Bạch Di Hành",
  uVuongMau: "U Vương Mẫu",
  bachLoc: "Bạch Lộc",
};

export function generateProductSVG(agentId: string, productName: string, price: string): string {
  const colors = AGENT_COLORS[agentId] || AGENT_COLORS.toLuong;
  const agentName = AGENT_NAMES[agentId] || "Thương Nhân Rottra";
  const artLines = getProductMathArt(productName, 200, 158, 80, colors.primary);
  const base64Image = getBase64ProductPhoto(productName);

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
    <clipPath id="clipCircle">
      <circle cx="200" cy="158" r="64" />
    </clipPath>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" rx="20"/>
  <rect x="40" y="40" width="320" height="320" fill="url(#card)" rx="16" stroke="${colors.primary}30" stroke-width="2"/>
  
  <!-- Real Product Photo Masked -->
  <image href="${base64Image}" x="136" y="94" width="128" height="128" clip-path="url(#clipCircle)" preserveAspectRatio="xMidYMid slice" />
  <circle cx="200" cy="158" r="64" fill="none" stroke="${colors.primary}" stroke-width="2.5" opacity="0.6"/>
  
  <!-- Math Art Watermark Overlay -->
  ${artLines}
  
  <text x="200" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="${colors.primary}" opacity="0.85">AGENTS: ${agentName.toUpperCase()}</text>
  <line x1="80" y1="82" x2="320" y2="82" stroke="${colors.primary}15" stroke-width="1"/>
  <text x="200" y="246" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="600" fill="#1e293b">${productName.substring(0, 25)}</text>
  <text x="200" y="284" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="bold" fill="${colors.primary}">${price}</text>
  <rect x="120" y="302" width="160" height="38" rx="19" fill="${colors.primary}"/>
  <text x="200" y="326" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="white">Xem chi tiết</text>
</svg>`;
}

// ═══════════════════════════════════════════════
// ALGORITHMIC MUSIC GENERATOR — Tạo nhạc nền MIDI
// ═══════════════════════════════════════════════

// ===== PRODUCT AVIF GENERATOR (replaces SVG) =====
const AGENT_AVIF_COLORS: Record<string, { primary: string; secondary: string; bg: string }> = {
  toLuong: { primary: "#D97706", secondary: "#92400E", bg: "#FEF3C7" },
  thuongNguyet: { primary: "#7C3AED", secondary: "#5B21B6", bg: "#EDE9FE" },
  tramTinh: { primary: "#6366F1", secondary: "#4338CA", bg: "#E0E7FF" },
  daoTieuCuu: { primary: "#EC4899", secondary: "#BE185D", bg: "#FCE7F3" },
  hoaHuynh: { primary: "#DC2626", secondary: "#991B1B", bg: "#FEE2E2" },
  phiNguyet: { primary: "#8B5CF6", secondary: "#6D28D9", bg: "#F5F3FF" },
  nhuNguyet: { primary: "#F472B6", secondary: "#DB2777", bg: "#FDF2F8" },
  suGia: { primary: "#B45309", secondary: "#78350F", bg: "#FFFBEB" },
  phiAnh: { primary: "#10B981", secondary: "#047857", bg: "#ECFDF5" },
  bachDiHanh: { primary: "#374151", secondary: "#111827", bg: "#F3F4F6" },
  uVuongMau: { primary: "#581C87", secondary: "#3B0764", bg: "#2E1065" },
  bachLoc: { primary: "#059669", secondary: "#065F46", bg: "#D1FAE5" },
};

export async function generateProductAVIF(agentId: string, productName: string, price: string): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const colors = AGENT_AVIF_COLORS[agentId] || AGENT_AVIF_COLORS.toLuong;
    const artLines = getProductMathArt(productName, 256, 180, 110, colors.primary);
    const base64Image = getBase64ProductPhoto(productName);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg}"/>
      <stop offset="100%" style="stop-color:${colors.primary}30"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff"/>
      <stop offset="100%" style="stop-color:#f8fafc"/>
    </linearGradient>
    <clipPath id="clipCircleAVIF">
      <circle cx="256" cy="180" r="72" />
    </clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="24"/>
  <rect x="48" y="48" width="416" height="416" fill="url(#card)" rx="20" stroke="${colors.primary}30" stroke-width="2"/>
  
  <!-- Real Product Photo Masked -->
  <image href="${base64Image}" x="184" y="108" width="144" height="144" clip-path="url(#clipCircleAVIF)" preserveAspectRatio="xMidYMid slice" />
  <circle cx="256" cy="180" r="72" fill="none" stroke="${colors.primary}" stroke-width="3" opacity="0.6"/>
  
  <!-- Math Art Watermark Overlay -->
  ${artLines}
  
  <text x="256" y="290" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="600" fill="#1e293b">${productName.substring(0, 30)}</text>
  <text x="256" y="330" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="${colors.primary}">${price}</text>
  <rect x="152" y="360" width="208" height="48" rx="24" fill="${colors.primary}"/>
  <text x="256" y="392" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="white">Xem chi tiet</text>
</svg>`;

    return await sharp(Buffer.from(svg)).avif({ quality: 70, effort: 4 }).toBuffer();
  } catch {
    return null;
  }
}

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
  const pcm = notesToWav(musicSeq.notes);
  const wav = createWavFile(pcm);
  const music = wav.toString("base64");

  return {
    mood,
    svg: svgImage,
    svgImage,
    music,
    musicSeq,
    wavBase64: music,
  };
}

// ═══════════════════════════════════════════════
// OFFLINE NATIVE AI HUB (C++ BRIDGE)
// Kết nối với lõi C++ (ai_core.exe) để Sinh Ảnh, Video, Âm thanh
// ═══════════════════════════════════════════════

export async function callNativeAiHub(mode: "image" | "video" | "text" | "audio", prompt: string): Promise<any> {
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const execFileAsync = promisify(execFile);

  const coreExePath = path.join(process.cwd(), "bin", "ai_core.exe");

  try {
    await fs.access(coreExePath);
  } catch {
    log.warn(`⚠️ [C++ BRIDGE] Không tìm thấy lõi C++ tại: ${coreExePath}`);
    log.warn(`⚠️ Sếp cần biên dịch C++ bằng file build_ai_core.bat trước!`);
    throw new Error("Native AI Core not compiled.");
  }

  log.info(`🚀 [C++ BRIDGE] Đang kích hoạt lõi C++ chế độ [${mode.toUpperCase()}]...`);

  try {
    const { stdout } = await execFileAsync(coreExePath, [mode, prompt]);

    // C++ trả về JSON chuẩn
    const result = JSON.parse(stdout.trim());
    log.info(`✅ [C++ BRIDGE] Hoàn tất. Trạng thái: ${result.status}`);
    return result;
  } catch (err) {
    log.error(`❌ [C++ BRIDGE] Lỗi khi chạy lõi C++:`, err);
    throw err;
  }
}

// Sinh Ảnh Siêu Thực (AVIF) thông qua C++
export async function createPhotorealisticAVIF(productName: string): Promise<string> {
  try {
    const crypto = require("node:crypto");
    const path = require("node:path");
    const hash = crypto
      .createHash("md5")
      .update(productName + Date.now())
      .digest("hex");
    const prompt = `A highly detailed, photorealistic macro shot of premium ${productName}. Resting elegantly on a minimalist dark stone slab. Soft, warm studio lighting highlights the texture. Dark, premium aesthetic. No text, no logos.`;

    // Gọi cầu nối C++ thay vì gọi sd.exe trực tiếp
    const aiResult = await callNativeAiHub("image", prompt);

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
    const aiResult = await callNativeAiHub("video", prompt);

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
    const aiResult = await callNativeAiHub("audio", textToSpeak);

    if (aiResult.status === "success") {
      return aiResult.file_path || `/audio/mock-voice.wav`;
    }
    return "/audio/no-audio.wav";
  } catch (err) {
    return "/audio/no-audio.wav";
  }
}
