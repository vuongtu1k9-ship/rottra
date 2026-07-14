import { Point } from "./recognizer";

let ortInstance: any = null;
let session: any = null;
let labels: Record<string, string> = {};
let isInitializing = false;

async function getOrt(): Promise<any> {
  if (ortInstance) return ortInstance;

  if (typeof window !== "undefined") {
    if ((window as any).ort) {
      ortInstance = (window as any).ort;
      return ortInstance;
    }

    console.log("📥 Loading ONNX Runtime Web from CDN...");
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js";
      script.onload = () => {
        ortInstance = (window as any).ort;
        if (ortInstance) {
          ortInstance.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
          console.log("✅ ONNX Runtime Web loaded successfully from CDN.");
        }
        resolve();
      };
      script.onerror = (err) => {
        console.error("❌ Failed to load ONNX Runtime Web script:", err);
        reject(err);
      };
      document.head.appendChild(script);
    });

    return ortInstance;
  }

  return null;
}

// Initialize ONNX Session and fetch labels
export async function initTensorEngine() {
  if (session || isInitializing) return;
  isInitializing = true;
  try {
    console.log("🟢 [Tensor Engine] Initializing ONNX Runtime Web...");
    const ort = await getOrt();
    if (!ort) {
      console.warn("⚠️ [Tensor Engine] ONNX not available. Skipping initialization.");
      isInitializing = false;
      return;
    }

    // Fetch config for labels (Try local first, fallback to CDN)
    let config;
    try {
      const configRes = await fetch("/models/config.json");
      config = await configRes.json();
    } catch (localErr) {
      console.warn("⚠️ [Tensor Engine] Local config fetch failed, falling back to HuggingFace:", localErr);
      const configRes = await fetch("https://huggingface.co/Xenova/quickdraw-mobilevit-small/resolve/main/config.json");
      config = await configRes.json();
    }
    labels = config.id2label || {};

    // Load Model (Try local first, fallback to CDN)
    try {
      session = await ort.InferenceSession.create("/models/quickdraw.onnx", {
        executionProviders: ["webgpu", "wasm"],
      });
    } catch (localErr) {
      console.warn("⚠️ [Tensor Engine] Local model load failed, falling back to HuggingFace:", localErr);
      session = await ort.InferenceSession.create("https://huggingface.co/Xenova/quickdraw-mobilevit-small/resolve/main/onnx/model.onnx", {
        executionProviders: ["webgpu", "wasm"],
      });
    }

    console.log("✅ [Tensor Engine] Model and labels loaded successfully.");
  } catch (err) {
    console.error("❌ [Tensor Engine] Initialization failed:", err);
  } finally {
    isInitializing = false;
  }
}

export function isTensorEngineReady() {
  return session !== null;
}

// Preprocessor: Canvas to Float32Array Tensor [1, 1, 28, 28]
function preprocessToTensor(points: Point[], ort: any): any {
  const SIZE = 28;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context not supported");

  // Fill black background (0.0)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (points.length === 0) {
    const emptyFloat = new Float32Array(SIZE * SIZE);
    return new ort.Tensor("float32", emptyFloat, [1, 1, SIZE, SIZE]);
  }

  // Find bounding box to scale drawing into 28x28, leaving 2px padding
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  // Scale so max dimension fits in 24px (leaves 2px border)
  const maxDim = Math.max(width, height) || 1;
  const scale = 24.0 / maxDim;

  // Draw strokes in white (1.0)
  ctx.strokeStyle = "white";
  ctx.lineWidth = Math.max(1, 2.0 / scale); // roughly 2px thick in target space
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  let firstPoint = true;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Transform to 28x28 canvas coordinates
    const tx = (p.x - cx) * scale + SIZE / 2;
    const ty = (p.y - cy) * scale + SIZE / 2;

    if (p.isStart || firstPoint) {
      ctx.moveTo(tx, ty);
      firstPoint = false;
    } else {
      ctx.lineTo(tx, ty);
    }
  }
  ctx.stroke();

  // Extract pixels
  const imgData = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const float32Data = new Float32Array(SIZE * SIZE);

  // Convert to grayscale and normalize [0, 1]
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = imgData[i * 4];
    float32Data[i] = r / 255.0;
  }

  return new ort.Tensor("float32", float32Data, [1, 1, SIZE, SIZE]);
}

// Inference
export async function recognizeWithONNX(points: Point[]) {
  if (!session) {
    throw new Error("Tensor Engine is not ready");
  }

  try {
    const ort = await getOrt();
    const tensor = preprocessToTensor(points, ort);

    const inputName = session.inputNames[0];
    const feeds = { [inputName]: tensor };

    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const logits = results[outputName].data as Float32Array;

    // Apply Softmax
    let maxLogit = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxLogit) maxLogit = logits[i];
    }

    let sumExp = 0;
    const probs = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      probs[i] = Math.exp(logits[i] - maxLogit);
      sumExp += probs[i];
    }

    let bestIdx = -1;
    let maxProb = -Infinity;
    for (let i = 0; i < probs.length; i++) {
      probs[i] /= sumExp;
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        bestIdx = i;
      }
    }

    const labelEng = labels[bestIdx] || "Unknown";
    const viMap: Record<string, string> = {
      apple: "Quả Táo",
      airplane: "Máy Bay",
      car: "Ô tô",
      cat: "Con Mèo",
      dog: "Con Chó",
      fish: "Con Cá",
      bird: "Con Chim",
      house: "Ngôi Nhà",
      tree: "Cây Cối",
      star: "Ngôi Sao",
      circle: "Vòng Tròn",
      square: "Hình Vuông",
      triangle: "Hình Tam Giác",
      cup: "Cái Cốc",
      clock: "Đồng Hồ",
      bicycle: "Xe Đạp",
      book: "Quyển Sách",
      face: "Khuôn Mặt",
      sun: "Mặt Trời",
      cloud: "Đám Mây",
      flower: "Bông Hoa",
      laptop: "Máy Tính Bảng/Laptop",
      axe: "Cái Rìu",
      baseball: "Quả Bóng Chày",
      "baseball bat": "Gậy Bóng Chày",
      basketball: "Quả Bóng Rổ",
      bed: "Cái Giường",
      boat: "Cái Thuyền",
      camera: "Máy Ảnh",
      chair: "Cái Ghế",
      door: "Cái Cửa",
      envelope: "Phong Bì",
      eye: "Con Mắt",
      eyeglasses: "Cái Kính",
      guitar: "Đàn Guitar",
      hammer: "Cái Búa",
      hat: "Cái Mũ",
      headphones: "Tai Nghe",
      key: "Chìa Khóa",
      knife: "Con Dao",
      "light bulb": "Bóng Đèn",
      moon: "Mặt Trăng",
      mountain: "Ngọn Núi",
      pants: "Cái Quần",
      pencil: "Cái Bút Chì",
      pizza: "Bánh Pizza",
      scissors: "Cái Kéo",
      shoe: "Đôi Giày",
      "smiley face": "Mặt Cười",
      snake: "Con Rắn",
      spider: "Con Nhện",
      spoon: "Cái Thìa",
      sword: "Thanh Kiếm",
      "t-shirt": "Áo Phông",
      table: "Cái Bàn",
      telephone: "Điện Thoại",
      television: "Tivi",
      toothbrush: "Bàn Chải Đánh Răng",
      umbrella: "Cái Ô",
      wheel: "Bánh Xe",
      wristwatch: "Đồng Hồ Đeo Tay",
    };

    const labelVi = viMap[labelEng] || labelEng;

    return {
      name: labelVi,
      score: parseFloat(maxProb.toFixed(2)),
      originalLabel: labelEng,
    };
  } catch (err) {
    console.error("ONNX Inference Error:", err);
    throw err;
  }
}
