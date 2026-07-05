import { db } from "./src/infra/database/db-pool.js";
import fs from "fs";
import path from "path";
import "dotenv/config";

const AGENT_LIST = [
  "toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", 
  "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", 
  "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"
];

async function generateAgentAudio() {
  console.log("🚀 Bắt đầu quá trình xuất nhạc Opus cho 12 Agent bằng lõi Rottra AI...");

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=AudioServiceOutOfProcess"
    ],
  });

  const page = await browser.newPage();

  // Inject a rendering page
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <body>
      <script>
        window.renderOpus = async (agentId) => {
          return new Promise((resolve) => {
            try {
              const audioCtx = new AudioContext();
              const dest = audioCtx.createMediaStreamDestination();
              
              let bpm = 80;
              let baseFreq = 440;
              if (agentId === "toLuong") { bpm = 60; baseFreq = 300; }
              else if (agentId === "thuongNguyet") { bpm = 110; baseFreq = 500; }
              else if (agentId === "daoTieuCuu") { bpm = 130; baseFreq = 600; }
              else if (agentId === "uVuongMau") { bpm = 65; baseFreq = 200; }
              else { bpm = 90 + (agentId.length * 2); baseFreq = 400 + (agentId.charCodeAt(0) * 2); }
              
              const beatInterval = 60 / bpm;
              
              for (let i = 0; i < 16; i++) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(dest);
                
                const waveTypes = ["sine", "square", "triangle", "sawtooth"];
                osc.type = waveTypes[i % 4];
                
                const intervalScale = [0, 2, 4, 5, 7, 9, 11, 12];
                const noteIndex = (i * agentId.length) % intervalScale.length;
                const freq = baseFreq * Math.pow(2, intervalScale[noteIndex] / 12);
                
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * beatInterval);
                
                gain.gain.setValueAtTime(0, audioCtx.currentTime + i * beatInterval);
                gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + i * beatInterval + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * beatInterval + beatInterval);
                
                osc.start(audioCtx.currentTime + i * beatInterval);
                osc.stop(audioCtx.currentTime + i * beatInterval + beatInterval);
              }
              
              const mimeType = "audio/webm; codecs=opus";
              const recorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 128000 });
              const chunks = [];
              recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
              recorder.onstop = () => {
                setTimeout(() => {
                  const blob = new Blob(chunks, { type: mimeType });
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                }, 500);
              };
              
              recorder.start(100);
              
              setTimeout(() => {
                recorder.stop();
              }, (16 * beatInterval * 1000) + 100);
              
            } catch (err) {
              resolve({ error: err.message });
            }
          });
        };
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);

  const audioDir = path.join(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

  for (const agentId of AGENT_LIST) {
    console.log(`🎵 Đang render nhạc Opus cho: [${agentId}]...`);
    const result: any = await page.evaluate((id) => (window as any).renderOpus(id), agentId);
    
    if (result.error) {
      console.log(`   ❌ Lỗi: ${result.error}`);
      continue;
    }

    const webmData = result.replace(/^data:audio\/\w+;base64,/, "").replace(/^data:video\/\w+;base64,/, "");
    const filePath = path.join(audioDir, `agent_${agentId}.opus`);
    fs.writeFileSync(filePath, Buffer.from(webmData, "base64"));
    console.log(`   ✅ Đã lưu thành công: /audio/agent_${agentId}.opus`);
  }

  await browser.close();
  console.log("🎉 Hoàn tất xuất nhạc chuẩn Opus cho 12 Agent!");
  process.exit(0);
}

generateAgentAudio();
