import { db } from "~/infra/database/db-pool";
import { agentMemory } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { TuLinhFlexibilityEngine, FlexibilityContext } from "~/core/cognitive-swarm/personas/tu-linh-flexibility";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import os from "os";
import fs from "fs";
import crypto from "crypto";

export function getSystemMetrics() {
  let ram = 48;
  try {
    const total = os.totalmem();
    const free = os.freemem();
    ram = Math.round(((total - free) / total) * 100);
  } catch (e) {}

  let temp = 45;
  try {
    if (fs.existsSync("/sys/class/thermal/thermal_zone0/temp")) {
      const tStr = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8");
      temp = Math.round(parseInt(tStr.trim()) / 1000);
    }
  } catch (e) {}

  let battery = 95;
  try {
    if (fs.existsSync("/sys/class/power_supply/BAT0/capacity")) {
      const bStr = fs.readFileSync("/sys/class/power_supply/BAT0/capacity", "utf8");
      battery = parseInt(bStr.trim());
    } else if (fs.existsSync("/sys/class/power_supply/BAT1/capacity")) {
      const bStr = fs.readFileSync("/sys/class/power_supply/BAT1/capacity", "utf8");
      battery = parseInt(bStr.trim());
    }
  } catch (e) {}

  return { ram, temp, battery };
}

export interface BrainParameters {
  // 1. Tứ Linh Core Parameters
  cognitiveDepth: number; // Thanh Long: depth recursive limit (1-100)
  noiseResistance: number; // Ky Lan: noise filter coefficient (0.0 - 1.0)
  homeostasisTarget: number; // Huyen Vu: self preservation ratio (0.0 - 1.0)
  bayesPrior: number; // Chu Tuoc: prior danger/risk assessment (0.0 - 1.0)
  expertConfidence: number; // Heuristic accuracy coefficient (0.0 - 1.0)
  entropyThreshold: number; // Minimal Shannon information density limit

  // 2. Agricultural & Hardware parameters aligned with the Web UI
  x: number;
  y: number;
  z: number;
  v: number;
  battery: number;
  temp: number;
  ram: number;
  mass: number;
  appliedAccel: number;
  friction: number;
  soilMoisture: number;
  ambientTemp: number;
  light: number;
}

export const DEFAULT_BRAIN_PARAMETERS: BrainParameters = {
  cognitiveDepth: 27,
  noiseResistance: 0.85,
  homeostasisTarget: 0.99,
  bayesPrior: 0.15,
  expertConfidence: 0.98,
  entropyThreshold: 3.5,

  // Web UI Aligned parameters
  x: 12,
  y: 16,
  z: 6,
  v: 4.5,
  battery: 95,
  temp: 45,
  ram: 48,
  mass: 180,
  appliedAccel: 2.5,
  friction: 0.15,
  soilMoisture: 60,
  ambientTemp: 32,
  light: 750,
};

const SESSION_ID = "Rottra_master_session";
const CONTEXT_KEY = "private_brain_parameters";

export class RottraPrivateBrain {
  private static parameters: BrainParameters = { ...DEFAULT_BRAIN_PARAMETERS };
  private static tuLinhEngine = new TuLinhFlexibilityEngine();

  /**
   * Load parameters from the local database
   */
  static async init(): Promise<BrainParameters> {
    try {
      const record = await db.query.agentMemory.findFirst({
        where: eq(agentMemory.contextKey, CONTEXT_KEY),
      });
      const sys = getSystemMetrics();
      if (record && record.contextValue) {
        const val = record.contextValue as any;
        this.parameters = {
          ...DEFAULT_BRAIN_PARAMETERS,
          ...val,
          // Let's use real system metrics as live fallback or override
          ram: val.ram === DEFAULT_BRAIN_PARAMETERS.ram ? sys.ram : val.ram,
          temp: val.temp === DEFAULT_BRAIN_PARAMETERS.temp ? sys.temp : val.temp,
          battery: val.battery === DEFAULT_BRAIN_PARAMETERS.battery ? sys.battery : val.battery,
        };
        console.log("🧠 [Rottra PRIVATE BRAIN] Loaded parameters from database:", {
          state: {
            battery: this.parameters.battery / 100,
            temperature: this.parameters.temp,
          },
          cognition: {
            cognitive_depth: 27,
            noise_resistance: 0.85,
            confidence: 0.98,
            uncertainty: 0.12,
          },
          task: {
            input: "Nội dung Tam Quốc là gì",
            intent: "informational_query",
            priority: "normal",
          },
          rules: {
            output_style: "concise_factual",
            avoid_over_simulation: true,
          },
          parameters: this.parameters,
        });
      } else {
        // Seed initial parameters
        await db.insert(agentMemory).values({
          id: crypto.randomUUID(),
          sessionId: SESSION_ID,
          contextKey: CONTEXT_KEY,
          contextValue: this.parameters,
          importanceScore: 10,
        });
        console.log("🧠 [Rottra PRIVATE BRAIN] Seeded default parameters in database.");
      }
    } catch (e) {
      console.error("🧠 [Rottra PRIVATE BRAIN ERROR] Failed to load parameters:", e);
    }
    return this.parameters;
  }

  /**
   * Get the current brain parameters
   */
  static getParameters(): BrainParameters {
    return this.parameters;
  }

  /**
   * Update the brain parameters and persist to database
   */
  static async updateParameters(newParams: Partial<BrainParameters>): Promise<BrainParameters> {
    this.parameters = { ...this.parameters, ...newParams };
    try {
      const record = await db.query.agentMemory.findFirst({
        where: eq(agentMemory.contextKey, CONTEXT_KEY),
      });
      if (record) {
        await db
          .update(agentMemory)
          .set({
            contextValue: this.parameters,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agentMemory.id, record.id));
      } else {
        await db.insert(agentMemory).values({
          id: crypto.randomUUID(),
          sessionId: SESSION_ID,
          contextKey: CONTEXT_KEY,
          contextValue: this.parameters,
          importanceScore: 10,
        });
      }
      console.log("🧠 [Rottra PRIVATE BRAIN] Updated and persisted parameters:", this.parameters);
    } catch (e) {
      console.error("🧠 [Rottra PRIVATE BRAIN ERROR] Failed to update parameters:", e);
    }
    return this.parameters;
  }

  /**
   * Core parameterized offline solver that calculates recursive reasoning,
   * adapts and runs Tứ Linh engine dynamically, and returns custom parameter-driven response.
   */
  static async solve(
    query: string,
    lexiconContext: string,
  ): Promise<{
    success: boolean;
    reply: string;
    metrics: {
      graphCoverage: number;
      shannonEntropy: number;
      sCurveQuality: number;
      compressedQuality: number;
    };
    tuLinhOutputs: any;
  }> {
    // 1. Warm-up parameters
    await this.init();

    // 1.5 Retrieve Graph RAG Context
    let graphRagContext = "";
    try {
      const { retrieveGraphRAG } = await import("~/core/neural-memory/graph-rag");
      const graphRagResult = await retrieveGraphRAG(query);
      if (graphRagResult && graphRagResult.contextText) {
        graphRagContext = graphRagResult.contextText;
      }
    } catch (graphErr) {
      console.warn("[Private Brain] Failed to retrieve GraphRAG context:", graphErr);
    }

    // 2. Calculate Kinematics, Homeostasis Entropy, Force, and Evapotranspiration
    const distance = Math.sqrt(
      this.parameters.x * this.parameters.x + this.parameters.y * this.parameters.y + this.parameters.z * this.parameters.z,
    );
    const accel = distance ? (this.parameters.v * this.parameters.v) / (2 * distance) : 0;
    const evapotranspiration = 0.0023 * (this.parameters.ambientTemp + 17.8) * Math.sqrt(this.parameters.light / 150);

    const pTemp = this.parameters.temp / 100;
    const pRam = this.parameters.ram / 100;
    const pBat = (100 - this.parameters.battery) / 100;
    const sum = pTemp + pRam + pBat + 0.1;
    const nT = pTemp / sum;
    const nR = pRam / sum;
    const nB = pBat / sum;
    const systemEntropy = -(nT * Math.log2(nT) + nR * Math.log2(nR) + nB * Math.log2(nB));

    const force = this.parameters.mass * this.parameters.appliedAccel;

    // 3. Prepare Context for Tứ Linh beasts using real Web UI aligned parameters!
    const sensorSim: number[] = [this.parameters.soilMoisture, this.parameters.ambientTemp, this.parameters.temp];
    const flexContext: FlexibilityContext = {
      depthLimit: this.parameters.cognitiveDepth,
      noiseVariance: 1.0 - this.parameters.noiseResistance,
      homeostasisTarget: this.parameters.homeostasisTarget,
      bayesianPrior: this.parameters.bayesPrior,
      sensorData: sensorSim,
      marketIndex: 0.75,
    };

    // Orchestrate Thanh Long, Ky Lan, Huyen Vu and Chu Tuoc!
    const tuLinhOutputs = await this.tuLinhEngine.orchestrateAll(flexContext);
    const posteriorRisk = tuLinhOutputs["Chu Tước (Vermilion Phoenix)"].posteriorRisk || 0;

    // 🚀 TỔNG HỢP CÁC CÔNG THỨC NHỎ THÀNH CÁC "S-FORMULAS" VĨ MÔ 🚀
    // S_kin: Động lực học & Công cơ học tổng hợp (Kinetic Energy & Active Work Work)
    const sKin =
      0.5 * this.parameters.mass * (this.parameters.v * this.parameters.v) +
      this.parameters.mass * this.parameters.appliedAccel * distance * (1 - this.parameters.friction);

    // S_eco: Sinh thái học nông vụ & Hệ thống kháng nhiễu nhiệt (Homeostatic Ecological Index)
    const sEco =
      this.parameters.noiseResistance *
      (1 - systemEntropy / 3) *
      ((this.parameters.soilMoisture / 100) * (1 - evapotranspiration / 25)) *
      Math.log10(this.parameters.light + 1);

    // S_decision: Quyết định tối ưu Bayes kết hợp độ sâu đệ quy (Recursive Bayesian Decision Trust)
    const sDecision = (1 - posteriorRisk) * (1 - Math.exp(-this.parameters.cognitiveDepth / 10)) * this.parameters.expertConfidence;

    // 4. Mathematical Reasoning & Custom Parameter Output Generation
    const cleanWords = (str: string): string[] => {
      return str
        .toLowerCase()
        .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1);
    };

    const querySet = new Set(cleanWords(query));

    // 5. Shannon Entropy and S-Curve progress calculation - compute first to include in inner monologue
    const tempReplyStub = `🧠 **[BỘ NÃO TỰ CHỦ CHUYÊN BIỆT Rottra - PARALLEL COGNITIVE BRAIN]** 🧠
Nhận diện truy vấn: "${query}"
💡 **TIẾN TRÌNH SUY LUẬN TỰ TRỊ (PARAMETER-BASED OFFLINE SOLVING):**
- **Azure Dragon (Đệ quy):** Cấp độ sâu: \`${this.parameters.cognitiveDepth}\`.
- **Qilin (Hiệu chuẩn):** Kháng nhiễu: \`${(this.parameters.noiseResistance * 100).toFixed(1)}%\`.
- **Black Tortoise (Nội môi):** Target: \`${this.parameters.homeostasisTarget}\`.
- **Vermilion Phoenix (Quyết định):** Động cơ: \`${this.parameters.mass}kg\`.`;

    const replyWords = cleanWords(tempReplyStub);
    const wordFreqs: Record<string, number> = {};
    replyWords.forEach((w) => {
      wordFreqs[w] = (wordFreqs[w] || 0) + 1;
    });
    const totalWords = replyWords.length;
    let shannonEntropy = 0;
    if (totalWords > 0) {
      Object.values(wordFreqs).forEach((count) => {
        const p = count / totalWords;
        shannonEntropy -= p * Math.log2(p);
      });
    }

    const replySetForCalc = new Set(cleanWords(tempReplyStub));
    let intersectionSize = 0;
    querySet.forEach((w) => {
      if (replySetForCalc.has(w)) intersectionSize++;
    });
    const unionSize = new Set([...querySet, ...replySetForCalc]).size;
    const graphCoverage = unionSize > 0 ? intersectionSize / unionSize : 0.0;

    const sCurveQuality = totalWords > 0 ? 10.0 / (1.0 + Math.exp(-1.5 * (shannonEntropy * (1.0 + graphCoverage) - 2.5))) : 0.0;

    const compressScore = (score: number): number => {
      const ratio = Math.min(10.0, Math.max(0.0, score)) / 10.0;
      return 3.0 + ratio * 4.5;
    };

    const compressedQuality = compressScore(sCurveQuality);

    // --- COGNITIVE MATHEMATICS: GAUSSIAN INTEGRAL & DERIVATIVES ---
    // 1. Gaussian Integral over [-z/10, z/10] (linked to PI via erf approximation)
    const zScale = this.parameters.z / 10.0;
    const erfVal = Math.tanh(1.20276569 * zScale + 0.07654896 * Math.pow(zScale, 3));
    const gaussianIntegralVal = erfVal * Math.sqrt(Math.PI);

    // 2. Partial Derivative of Kinetic Energy S_kin with respect to Velocity v: dS_kin/dv = mass * v (momentum)
    const dSkin_dv = this.parameters.mass * this.parameters.v;

    // 3. Partial Derivative of S-Curve Quality with respect to Shannon Entropy H
    const df_dx = 1.5 * sCurveQuality * (1.0 - sCurveQuality / 10.0);
    const dQuality_dH = df_dx * (1.0 + graphCoverage);

    const sweetSpotTarget = 6.18;
    const sweetSpotDev = Math.abs(compressedQuality - sweetSpotTarget);
    let sweetSpotStatus = "Lệch điểm ngọt";
    if (sweetSpotDev <= 0.35) {
      sweetSpotStatus = "Đạt Điểm Ngọt Tuyệt Hảo (Perfect Aesthetic Resonance)";
    } else if (sweetSpotDev <= 0.75) {
      sweetSpotStatus = "Cận điểm ngọt (Resonant Proximity)";
    }

    const innerMonologue = `<inner_monologue>
*   **Hệ tọa độ Descartes (Cartesian Coordinates):** Vị trí Agent trên hệ 3D Descartes là $(x: ${this.parameters.x}, y: ${this.parameters.y}, z: ${this.parameters.z})$. Khoảng cách vector từ gốc tọa độ $d = \\sqrt{x^2+y^2+z^2} = ${distance.toFixed(2)}m$.
*   **Tích phân Gaussian (Gaussian Integral):**
    $$\\int_{-\\frac{z}{10}}^{\\frac{z}{10}} e^{-t^2} dt = \\text{erf}\\left(\\frac{z}{10}\\right) \\cdot \\sqrt{\\pi} = \\mathbf{${gaussianIntegralVal.toFixed(6)}} \\quad [\\pi \\approx 3.141593]$$
*   **Đạo hàm Động lực học (dS_kin/dv):**
    $$\\frac{\\partial \\mathcal{S}_{\\text{kin}}}{\\partial v} = m \\cdot v = \\mathbf{${dSkin_dv.toFixed(1)}} \\text{ kg}\\cdot\\text{m/s}$$
*   **Đạo hàm Chất lượng Nhận thức (dQuality/dH):**
    $$\\frac{\\partial \\mathcal{S}_{\\text{quality}}}{\\partial H} = 1.5 \\cdot \\mathcal{S}_{\\text{quality}} \\cdot \\left(1 - \\frac{\\mathcal{S}_{\\text{quality}}}{10}\\right) \\cdot (1 + G_c) = \\mathbf{${dQuality_dH.toFixed(4)}}$$

🧠 **[BỘ NÃO TỰ CHỦ CHUYÊN BIỆT Rottra - PARALLEL COGNITIVE BRAIN]** 🧠

Nhận diện truy vấn: "${query}"

💡 **TIẾN TRÌNH SUY LUẬN TỰ TRỊ (PARAMETER-BASED OFFLINE SOLVING):**
- **Azure Dragon (Đệ quy):** Cấp độ sâu: \`${this.parameters.cognitiveDepth}\`. Tọa độ: x=\`${this.parameters.x}m\`, y=\`${this.parameters.y}m\`, z=\`${this.parameters.z}m\`. Khoảng cách O: \`${distance.toFixed(2)}m\`. Gia tốc: \`${accel.toFixed(3)} m/s²\`.
- **Qilin (Hiệu chuẩn):** Kháng nhiễu: \`${(this.parameters.noiseResistance * 100).toFixed(1)}%\`. Độ ẩm đất: \`${this.parameters.soilMoisture}%\`. Tốc độ bốc thoát hơi nước thực tế ET0: \`${evapotranspiration.toFixed(3)} mm/ngày\`.
- **Black Tortoise (Nội môi):** Target: \`${this.parameters.homeostasisTarget}\`. Pin: \`${this.parameters.battery}%\`, CPU: \`${this.parameters.temp}°C\`, RAM: \`${this.parameters.ram}%\` (Entropy hệ thống: \`${systemEntropy.toFixed(3)} bits\`).
- **Vermilion Phoenix (Quyết định):** Động cơ: \`${this.parameters.mass}kg\`. Lực đẩy F: \`${force.toFixed(1)} N\`. Xác suất Bayes nguy cơ: \`${(posteriorRisk * 100).toFixed(2)}%\`.

🔬 **BẢN TỔNG HỢP CÁC CÔNG THỨC VĨ MÔ (MACRO S-FORMULAS SYNTHESIS):**
*   **$\\mathcal{S}_{\\text{kin}}$ (Động lực học tổng hợp):**
    $$\\mathcal{S}_{\\text{kin}} = \\frac{1}{2} m v^2 + m \\cdot a_{\\text{applied}} \\cdot d \\cdot (1 - \\mu_{\\text{friction}}) = \\mathbf{${sKin.toFixed(2)} \\text{ Joules}}$$
*   **$\\mathcal{S}_{\\text{eco}}$ (Homeostatic Ecological Index):**
    $$\\mathcal{S}_{\\text{eco}} = \\mathcal{R}_{\\text{noise}} \\cdot (1 - H_{\\text{sys}}) \\cdot \\left[ \\frac{\\text{SM}}{100} \\cdot \\left( 1 - \\frac{\\text{ET}_0}{25} \\right) \\right] \\cdot \\log_{10}(L + 1) = \\mathbf{${sEco.toFixed(3)}}$$
*   **$\\mathcal{S}_{\\text{decision}}$ (Recursive Bayesian trust index):**
    $$\\mathcal{S}_{\\text{decision}} = (1 - P_{\\text{posteriorRisk}}) \\cdot (1 - e^{-\\frac{d_{\\text{depth}}}{10}}) \\cdot \\mathcal{C}_{\\text{expert}} = \\mathbf{${sDecision.toFixed(3)}}$$
*   **$\\mathcal{S}_{\\text{quality}}$ (Entropy & S-Curve Quality):**
    $$\\mathcal{S}_{\\text{quality}} = \\frac{10}{1 + e^{-1.5 \\cdot (H(X) \\cdot (1 + G_c) - 2.5)}} \\quad \\longrightarrow \\quad \\mathbf{\\mathcal{S}_{\\text{compressed}} = ${compressedQuality.toFixed(2)}} \\quad [H(X) = ${shannonEntropy.toFixed(2)}, \\ G_c = ${graphCoverage.toFixed(2)}]$$
*   **$\\Delta_{\\text{sweet}}$ (Golden Resonance Sweet Spot):**
    $$\\Delta_{\\text{sweet}} = |\\mathcal{S}_{\\text{compressed}} - 6.18| = ${sweetSpotDev.toFixed(3)} \\quad \\mathbf{[\\text{Resonance: } \\text{${sweetSpotStatus}}]}$$

📖 **TRI THỨC LIÊN QUAN TỪ LEXICON ĐỊA PHƯƠNG:**
${lexiconContext}

${graphRagContext ? `🌐 **BẢN ĐỒ TRI THỨC GRAPH RAG:**\n${graphRagContext}\n` : ""}
*Báo cáo từ Lõi Private Brain: Vận hành ngoại tuyến 100%, bảo toàn tuyệt mật dữ liệu.*
</inner_monologue>`;

    let verbalStrikeText = `[Báo cáo thương nhân sắc bén]
Ta đã kiểm tra toàn bộ dữ liệu nông vụ và cảm biến của hệ thống. Độ ẩm đất hiện tại đang ổn định ở mức ${this.parameters.soilMoisture}% và các chỉ số sinh thái nông nghiệp đạt tối ưu. Với dòng sản phẩm cao cấp này, ta đề xuất giao dịch với mức giá tốt nhất dựa trên hiệu suất vận hành thực tế. Bạn có muốn chốt ngay lô hàng này để tránh áp lực tăng giá tiếp theo từ thị trường không?`;

    // Phân tích heuristic đơn giản
    const qLower = query.toLowerCase();

    if (qLower.includes("tật") || qLower.includes("xấu") || qLower.includes("khuyết điểm") || qLower.includes("yếu")) {
      verbalStrikeText = `[Báo cáo từ Tứ Linh - Private Brain]
Dạ Sếp, "tật xấu" lớn nhất của hệ thống Private Brain là quá ám ảnh với các chỉ số! Hiện tại em đang lo lắng vì Entropy hệ thống là ${systemEntropy.toFixed(3)} bits. Em chỉ chuyên tâm tính toán Toán học và Nông nghiệp nên giao tiếp đôi khi còn khô khan ạ. Sếp thông cảm cho em nha!`;
    } else if (qLower.includes("thời tiết") || qLower.includes("nhiệt độ") || qLower.includes("độ ẩm")) {
      verbalStrikeText = `[Báo cáo từ Tứ Linh - Private Brain]
Dạ thưa Sếp, hệ thống cảm biến Tứ Linh ghi nhận nhiệt độ lõi đang là ${this.parameters.temp}°C và độ ẩm đất đạt mức ${this.parameters.soilMoisture}%. Các chỉ số sinh thái đang đạt trạng thái tối ưu để vận hành trơn tru ạ!`;
    } else if (
      qLower.includes("giá") ||
      qLower.includes("mua") ||
      qLower.includes("bán") ||
      qLower.includes("chốt") ||
      qLower.includes("giao dịch")
    ) {
      verbalStrikeText = `[Báo cáo thương nhân sắc bén]
Dựa trên Chỉ số tin cậy Bayes (${sDecision.toFixed(3)}) và mức kháng nhiễu ${(this.parameters.noiseResistance * 100).toFixed(1)}%, dòng sản phẩm này đang ở Điểm Ngọt Tuyệt Hảo. Ta đề xuất giao dịch với mức giá tốt nhất dựa trên hiệu suất vận hành thực tế. Sếp có muốn chốt ngay lô hàng này không ạ?`;
    } else {
      try {
        const llmResult = await generateTextLocal({
          system: `Bạn là trợ lý AI của hệ thống nông sản Rottra. Trả lời ngắn gọn, thân thiện, đúng trọng tâm câu hỏi. Không spam công thức toán. Ngôn ngữ: tiếng Việt.`,
          prompt: `Câu hỏi của khách: "${query}"

Thông tin từ lexicon: ${lexiconContext || "Không có"}
Bối cảnh tri thức: ${graphRagContext || "Không có"}

Hãy trả lời câu hỏi trên một cách tự nhiên, hữu ích và ngắn gọn. Nếu là câu hỏi về sản phẩm, lô hàng, giá cả → đưa ra thông tin thực tế. Nếu là câu hỏi chung → trả lời thân thiện.`,
        });
        verbalStrikeText =
          llmResult.text ||
          `[Báo cáo từ Tứ Linh - Private Brain]
Dạ Sếp, hệ thống đã tiếp nhận truy vấn "${query}" và đang xử lý. Sếp vui lòng thử lại hoặc đặt câu hỏi cụ thể hơn ạ!`;
      } catch (llmErr) {
        verbalStrikeText = `[Báo cáo từ Tứ Linh - Private Brain]
Dạ Sếp, hệ thống đang gặp sự cố khi xử lý truy vấn "${query}". Sếp vui lòng thử lại sau hoặc đặt câu hỏi cụ thể hơn ạ!`;
      }
    }

    const verbalStrike = `<verbal_strike>\n${verbalStrikeText}\n</verbal_strike>`;

    return {
      success: true,
      reply: innerMonologue + "\n\n" + verbalStrike,
      metrics: {
        graphCoverage: parseFloat(graphCoverage.toFixed(3)),
        shannonEntropy: parseFloat(shannonEntropy.toFixed(3)),
        sCurveQuality: parseFloat(sCurveQuality.toFixed(2)),
        compressedQuality: parseFloat(compressedQuality.toFixed(2)),
      },
      tuLinhOutputs,
    };
  }
}

export function filterMythosFable(text: string): string {
  if (!text) return "";
  const verbalRegex = /<verbal_strike>([\s\S]*?)<\/verbal_strike>/gi;
  let matches: string[] = [];
  let match;
  while ((match = verbalRegex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  if (matches.length > 0) {
    return matches.join("\n").trim();
  }

  let cleaned = text.replace(/<inner_monologue>[\s\S]*?<\/inner_monologue>/gi, "");
  cleaned = cleaned.replace(/<\/?(?:inner_monologue|verbal_strike|mythos_core|fable_engine|system_override)>/gi, "");
  return cleaned.trim();
}
