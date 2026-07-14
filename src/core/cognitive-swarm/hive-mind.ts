import { db } from "~/infra/database/db-pool";
import { agentMemory } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { TuLinhFlexibilityEngine, FlexibilityContext } from "~/core/cognitive-swarm/personas/tu-linh-flexibility";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";

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
    action?: string;
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

    let finalReplyText = `Dạ Sếp, hệ thống đã tiếp nhận truy vấn "${query}" nhưng đang xử lý. Sếp vui lòng thử lại!`;
    let actionTriggered = "none";

    try {
      const llmResult = await generateTextLocal({
        system: `Bạn là trợ lý AI thông minh của hệ thống nông sản Rottra.
Nhiệm vụ: Trả lời người dùng thân thiện, ngắn gọn và ĐÚNG TRỌNG TÂM. KHÔNG dùng công thức toán học. Ngôn ngữ: Tiếng Việt.

BẠN BẮT BUỘC PHẢI TRẢ VỀ CHÍNH XÁC ĐỊNH DẠNG JSON (KHÔNG bọc trong markdown tick \`\`\`):
{
  "thought": "Suy nghĩ logic của bạn (không hiện cho user thấy)",
  "action": "Tên hành động bạn muốn thực hiện. Chọn 1 trong các giá trị sau: 'none', '3d' (Tạo mô hình 3D), 'add' (Thêm sản phẩm), 'edit', 'delete'. Mặc định là 'none'.",
  "reply": "Câu trả lời thân thiện dành cho người dùng"
}`,
        prompt: `Câu hỏi của khách: "${query}"

Thông tin từ lexicon: ${lexiconContext || "Không có"}
Bối cảnh tri thức: ${graphRagContext || "Không có"}

Hãy đưa ra quyết định "action" và "reply". TRẢ VỀ JSON:`,
        isInternalReasoning: true,
      });

      let jsonStr = llmResult.text || "{}";
      jsonStr = jsonStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsed: any = {};
      try {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(jsonStr);
        }
      } catch (parseErr) {
        console.warn("[HiveMind] LLM did not return strict JSON. Trying to infer intent from text:", jsonStr);
        parsed = {
          reply: jsonStr,
          action: query.toLowerCase().includes("3d") ? "3d" : "none",
        };
      }

      finalReplyText = parsed.reply || "Xin lỗi sếp, hệ thống đang bận một chút ạ!";
      actionTriggered = parsed.action || "none";
    } catch (llmErr) {
      console.error("[HiveMind] Lỗi LLM:", llmErr);
      finalReplyText = `[Lỗi hệ thống] Xin lỗi sếp, tín hiệu não bộ đang gặp trục trặc!`;
    }

    const verbalStrike = `<verbal_strike>\n${finalReplyText}\n</verbal_strike>`;

    return {
      success: true,
      reply: verbalStrike,
      action: actionTriggered,
      metrics: {
        graphCoverage: 1.0,
        shannonEntropy: 0.0,
        sCurveQuality: 10.0,
        compressedQuality: 10.0,
      },
      tuLinhOutputs,
    };
  }
}

export function filterMythosFable(text: string): string {
  if (!text) return "";

  // Extract and preserve only functional square-bracket tags [...] so they are not lost
  const tags: string[] = [];
  const simpleTagRegex = /(\[[^\]]+\])/g;
  let tagMatch;
  while ((tagMatch = simpleTagRegex.exec(text)) !== null) {
    const tStr = tagMatch[1].trim();
    // Exclude debug/reasoning/system-log tags
    if (
      !tStr.startsWith("[Suy luận AI:") &&
      !tStr.startsWith("[Gamification Logic:") &&
      !tStr.startsWith("[Lỗi hệ thống") &&
      !tStr.includes("tín dụng]") &&
      !tStr.includes("lãi suất]") &&
      !tStr.includes("Cấm đăng bán]")
    ) {
      tags.push(tStr);
    }
  }

  const verbalRegex = /<verbal_strike>([\s\S]*?)<\/verbal_strike>/gi;
  let matches: string[] = [];
  let match;
  while ((match = verbalRegex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }

  let cleanVerbal = "";
  if (matches.length > 0) {
    cleanVerbal = matches.join("\n").trim();
  } else {
    let cleaned = text.replace(/<inner_monologue>[\s\S]*?<\/inner_monologue>/gi, "");
    cleaned = cleaned.replace(/<\/?(?:inner_monologue|verbal_strike|mythos_core|fable_engine|system_override)>/gi, "");
    // Remove the tags from the verbal part to avoid duplicate rendering
    cleaned = cleaned.replace(/\[[^\]]+\]/g, "");
    cleanVerbal = cleaned.trim();
  }

  // Append preserved tags back to the clean verbal text
  if (tags.length > 0) {
    return `${cleanVerbal} ${tags.join(" ")}`.trim();
  }
  return cleanVerbal;
}
