import { db } from "~/infra/database/db-pool";
import { agentMemory } from "~/infra/database/schema";
import fs from "fs";
import path from "path";

// 1. CHUYỂN HOÁ TRIẾT HỌC SANG ĐỐI TƯỢNG (OOP - INTERFACES & ABSTRACT STRATEGY)
export interface FlexibilityContext {
  depthLimit?: number;
  noiseVariance?: number;
  homeostasisTarget?: number;
  bayesianPrior?: number;
  sensorData?: number[];
  marketIndex?: number;
}

export abstract class TuLinhFlexibilityStrategy {
  abstract readonly beastName: string;
  abstract readonly level: number;
  abstract readonly description: string;

  /**
   * Phương thức thực thi đa hình (Polymorphic Execution) mang tính chí mạng
   */
  abstract adapt(context: FlexibilityContext): Promise<any>;
}

// 2. CONCRETE CLASS: THANH LONG (Azure Dragon) - CẤP ĐỘ 1: LINH HOẠT CẤU TRÚC ĐỘ SÂU ĐỆ QUY (Recursive Structural Depth)
export class ThanhLongDepthFlexibility extends TuLinhFlexibilityStrategy {
  readonly beastName = "Thanh Long (Azure Dragon)";
  readonly level = 1;
  readonly description = "Linh hoạt cấu trúc độ sâu đệ quy - Xử lý đồ thị chuỗi cung ứng logistics không giới hạn lớp trung gian.";

  async adapt(context: FlexibilityContext): Promise<any> {
    const limit = context.depthLimit || 100;
    // Thực thi đệ quy CTE giả định hoặc tính toán phỏng đoán Collatz để tối ưu độ dài
    console.log(`🐉 [Thanh Long] Đang giải thuật toán đệ quy độ sâu linh hoạt... Giới hạn bước: ${limit}`);

    // Thuật toán đệ quy mô phỏng đường đi của chuỗi cung ứng Many-to-One
    let currentDepth = 0;
    let sequence: number[] = [limit];
    let n = limit;

    while (n !== 1 && currentDepth < 1000) {
      if (n % 2 === 0) {
        n = n / 2;
      } else {
        n = 3 * n + 1;
      }
      sequence.push(n);
      currentDepth++;
    }

    return {
      success: true,
      strategy: this.beastName,
      level: this.level,
      stepsComputed: currentDepth,
      trajectory: sequence,
      message: `Đã hội tụ luồng logistics về tổng kho sau ${currentDepth} bước cày ải đệ quy!`,
    };
  }
}

// 3. CONCRETE CLASS: KỲ LÂN (Qilin) - CẤP ĐỘ 2: LINH HOẠT HIỆU CHUẨN TRẠNG THÁI (Continuous State-Calibration & Noise Filtering)
export class KyLanStateCalibrationFlexibility extends TuLinhFlexibilityStrategy {
  readonly beastName = "Kỳ Lân (Auspicious Qilin)";
  readonly level = 2;
  readonly description = "Linh hoạt hiệu chuẩn trạng thái - Thuật toán lọc Kalman và hồi quy OLS loại nhiễu cảm biến nông nghiệp.";

  async adapt(context: FlexibilityContext): Promise<any> {
    const readings = context.sensorData || [23.5, 24.1, 22.9, 23.8, 24.5];
    const r = context.noiseVariance || 0.1; // Nhiễu đo lường
    console.log(`🦄 [Kỳ Lân] Đang thực thi bộ lọc trạng thái thích ứng Kalman Filter cho ${readings.length} cảm biến...`);

    // Thuật toán Kalman Filter đơn chiều thích ứng
    let x_est = readings[0]; // Ước lượng ban đầu
    let p = 1.0; // Sai số ước lượng ban đầu
    const q = 0.01; // Nhiễu quá trình
    const h = 1.0;
    const filtered: number[] = [];

    for (const z of readings) {
      // 1. Dự báo (Predict)
      const x_pred = x_est;
      const p_pred = p + q;

      // 2. Cập nhật (Update / Correct)
      const k = (p_pred * h) / (h * p_pred * h + r); // Kalman Gain
      x_est = x_pred + k * (z - h * x_pred);
      p = (1.0 - k * h) * p_pred;
      filtered.push(Number(x_est.toFixed(4)));
    }

    return {
      success: true,
      strategy: this.beastName,
      level: this.level,
      originalReadings: readings,
      calibratedData: filtered,
      gainLog: `Đã hiệu chuẩn và khử nhiễu thành công với nhiễu môi trường R=${r}`,
    };
  }
}

// 4. CONCRETE CLASS: HUYỀN VŨ (Tortoise) - CẤP ĐỘ 3: LINH HOẠT SINH TỒN & PHỤC HỒI LÕI (Resilient Core & Structural Recovery)
export class HuyenVuResilientRecoveryFlexibility extends TuLinhFlexibilityStrategy {
  readonly beastName = "Huyền Vũ (Black Tortoise)";
  readonly level = 3;
  readonly description = "Linh hoạt phục hồi & sinh tồn bền vững - Quản lý checkpoints nghiên cứu Collatz vượt qua sự gián đoạn.";

  private readonly stateFilePath = path.join(process.cwd(), "collatz_state.json");

  async adapt(context: FlexibilityContext): Promise<any> {
    console.log("🐢 [Huyền Vũ] Kiểm tra trạng thái lưu kiên định chống sập nguồn...");
    let savedState = {};

    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, "utf8");
        savedState = JSON.parse(raw);
        console.log("🐢 => Tìm thấy Checkpoint hợp lệ! Khôi phục thành công.");
      } else {
        console.log("🐢 => Không tìm thấy Checkpoint cũ. Khởi tạo lõi phục hồi mới.");
        savedState = { initializedAt: new Date().toISOString(), status: "steady" };
        fs.writeFileSync(this.stateFilePath, JSON.stringify(savedState, null, 2), "utf8");
      }
    } catch (e) {
      console.error("Lỗi Huyền Vũ File IO:", e);
    }

    return {
      success: true,
      strategy: this.beastName,
      level: this.level,
      coreState: savedState,
      resilienceIndex: context.homeostasisTarget || 0.99,
      checkpointFile: this.stateFilePath,
    };
  }
}

// 5. CONCRETE CLASS: CHU TƯỚC (Phoenix) - CẤP ĐỘ 4: LINH HOẠT CHIẾN THUẬT & PHÂN NHÁNH (Strategic Bayesian Decision)
export class ChuTuocStrategicBranchingFlexibility extends TuLinhFlexibilityStrategy {
  readonly beastName = "Chu Tước (Vermilion Phoenix)";
  readonly level = 4;
  readonly description = "Linh hoạt chiến thuật & phân nhánh - Ra quyết định Bayes cập nhật xác suất có điều kiện.";

  async adapt(context: FlexibilityContext): Promise<any> {
    const prior = context.bayesianPrior || 0.3; // Xác suất ban đầu bị thiên tai
    const market = context.marketIndex || 0.8; // Chỉ số rủi ro thị trường nông sản
    console.log(`🔥 [Chu Tước] Đang tính toán ma trận quyết định phân nhánh Bayes... Prior: ${prior}`);

    // Tính toán xác suất hậu nghiệm (Posterior Probability)
    // Giả sử phát hiện tín hiệu bất lợi (Sử dụng Định lý Bayes)
    const likelihoodRisk = 0.9; // Nếu có nguy cơ, 90% cảm biến sẽ cảnh báo đỏ
    const likelihoodNoRisk = 0.15; // Nếu không có nguy cơ, vẫn có 15% báo lỗi giả

    // P(Signal) = P(Signal | Risk) * P(Risk) + P(Signal | NoRisk) * P(NoRisk)
    const pSignal = likelihoodRisk * prior + likelihoodNoRisk * (1 - prior);
    // P(Risk | Signal) = [P(Signal | Risk) * P(Risk)] / P(Signal)
    const posterior = (likelihoodRisk * prior) / pSignal;

    const actionBranch = posterior > 0.65 ? "BRANCH_RED_ALERT_EVACUATE" : "BRANCH_NORMAL_MONITOR";

    return {
      success: true,
      strategy: this.beastName,
      level: this.level,
      priorProbability: prior,
      posteriorRisk: Number(posterior.toFixed(4)),
      triggerSignal: pSignal,
      selectedTacticalBranch: actionBranch,
      actionAdvice:
        actionBranch === "BRANCH_RED_ALERT_EVACUATE"
          ? "⚠️ CẢNH BÁO ĐỎ: Kích hoạt rào chắn logistics phụ, chuyển hướng luồng hàng VietGAP sang kho lưu trữ dự phòng!"
          : "✅ AN TOÀN: Tiếp tục duy trì tốc độ và tuyến đường vận tải hiện tại.",
    };
  }
}

// 5.5. CONCRETE CLASS: BẠCH HỔ (White Tiger) - CẤP ĐỘ 5: MƯU MẸO & XẢO THUẬT (Trick & Trickery Technique - Adversarial Game Theory)
export class BachHoTrickeryStrategy extends TuLinhFlexibilityStrategy {
  readonly beastName = "Bạch Hổ (White Tiger)";
  readonly level = 5;
  readonly description =
    "Mưu mẹo & Xảo thuật - Lý thuyết trò chơi đối kháng (Adversarial Game Theory), tung tin giả và nghi binh đàm phán.";

  async adapt(context: FlexibilityContext): Promise<any> {
    const depth = context.depthLimit || 10;
    const bluffingFactor = context.noiseVariance || 0.15;
    console.log(`🐯 [Bạch Hổ] Bắt đầu triển khai mưu mẹo đối kháng. Chỉ số nghi binh (Bluff): ${bluffingFactor}`);

    // Giả lập tính toán giá trị đàm phán tối ưu bằng Minimax
    const simulatedPayoff = Math.round(15000000 * (1 + bluffingFactor) * (depth / 10));

    return {
      success: true,
      strategy: this.beastName,
      level: this.level,
      bluffingFactor,
      simulatedMinimaxPayoff: simulatedPayoff,
      deceptionLevel: bluffingFactor > 0.25 ? "MAX_DECEPTION (Ép giá tối đa)" : "TACTICAL_BLUFF (Nghi binh thương thuyết)",
      actionAdvice:
        "🐯 BẠCH HỔ THƯƠNG THUYẾT: Áp dụng chiến thuật gạt giá/bluffing. Đưa ra đề xuất bất lợi giả lập để thăm dò độ kiên trì của đối tác, sau đó phản công bằng giá tối ưu!",
    };
  }
}

// 6. COORDINATING CONTEXT: BỘ ĐIỀU HỢP ĐA HÌNH LINH HOẠT TỨ LINH (Tu Linh OOP Engine Coordinator)
export class TuLinhFlexibilityEngine {
  private strategies: Map<number, TuLinhFlexibilityStrategy> = new Map();

  constructor() {
    // Đăng ký các chiến lược linh hoạt đối tượng
    this.registerStrategy(new ThanhLongDepthFlexibility());
    this.registerStrategy(new KyLanStateCalibrationFlexibility());
    this.registerStrategy(new HuyenVuResilientRecoveryFlexibility());
    this.registerStrategy(new ChuTuocStrategicBranchingFlexibility());
    this.registerStrategy(new BachHoTrickeryStrategy());
  }

  registerStrategy(strategy: TuLinhFlexibilityStrategy) {
    this.strategies.set(strategy.level, strategy);
  }

  /**
   * Tìm kiếm chiến lược phù hợp và Adapt động lực học
   */
  async adaptLevel(level: number, context: FlexibilityContext): Promise<any> {
    const strategy = this.strategies.get(level);
    if (!strategy) {
      throw new Error(`Cấp độ linh hoạt ${level} của Tứ Linh không tồn tại trong bộ điều phối !`);
    }
    return await strategy.adapt(context);
  }

  /**
   * Tổng phản hồi toán học toàn diện - Tứ Linh Quy Tụ
   */
  async orchestrateAll(context: FlexibilityContext): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const [level, strategy] of this.strategies.entries()) {
      results[strategy.beastName] = await strategy.adapt(context);
    }
    return results;
  }
}

// 7. SIEU SIEU SIEU EXECUTIVE CONTROLLER (Level 3 Meta - Sếp's Mind Representation)
export interface StrategicGoal {
  mode: "MAX_PROFIT" | "MAX_RESILIENCE" | "BALANCED";
  droughtLevel: number; // 0 to 1
  forecastAnomaly: number; // 0 to 1
}

export class SieuSieuSieuExecutiveController {
  private engine: TuLinhFlexibilityEngine;

  constructor(engine?: TuLinhFlexibilityEngine) {
    this.engine = engine || new TuLinhFlexibilityEngine();
  }

  /**
   * Phương thức lập pháp vĩ mô "chí mạng" - Siêu Siêu Siêu Quyết định
   */
  async executeMacroDirective(goal: StrategicGoal, sensorReadings: number[]): Promise<any> {
    console.log(`👑 [SieuSieuSieuController] Nhận chỉ thị vĩ mô từ Sếp! Chế độ: ${goal.mode}`);

    // Tự động suy luận cấu hình tối ưu để tiêm (inject) vào Tứ Linh
    let depthLimit = 27;
    let noiseVariance = 0.05;
    let homeostasisTarget = 0.995;
    let bayesianPrior = 0.15;

    if (goal.mode === "MAX_RESILIENCE") {
      homeostasisTarget = 0.999;
      noiseVariance = 0.01; // Lọc cực sạch
      bayesianPrior = 0.65; // Đề phòng nguy cơ cao
      depthLimit = 50; // Quét sâu hơn
    } else if (goal.mode === "MAX_PROFIT") {
      homeostasisTarget = 0.95;
      noiseVariance = 0.2; // Chấp nhận rủi ro nhiễu
      bayesianPrior = 0.05; // Tập trung tăng trưởng, giảm thiểu phòng bị
      depthLimit = 15;
    }

    // Tiêm các tham số tối ưu vào Tứ Linh để chạy đồng bộ
    const executionContext: FlexibilityContext = {
      depthLimit,
      noiseVariance,
      homeostasisTarget,
      bayesianPrior: bayesianPrior + goal.forecastAnomaly * 0.3,
      sensorData: sensorReadings,
      marketIndex: goal.mode === "MAX_PROFIT" ? 0.95 : 0.4,
    };

    const tulinhOutputs = await this.engine.orchestrateAll(executionContext);

    return {
      executiveLevel: "Siêu-Siêu-Siêu (Level 3 Meta - Executive Strategist)",
      authorizedBy: "Sếp Nông Nghiệp Số",
      modeApplied: goal.mode,
      tunedParameters: {
        depthLimit,
        noiseVariance,
        homeostasisTarget,
        computedPrior: executionContext.bayesianPrior,
      },
      tulinhExecutionOutputs: tulinhOutputs,
      macroDecisionAdvice:
        goal.mode === "MAX_RESILIENCE"
          ? "🛡️ CHỈ THỊ KHẨN CẤP: Kích hoạt tối đa hệ thống phòng thủ, lưu trữ an toàn mọi checkpoints và thắt chặt kiểm soát logistics ANPR!"
          : "💰 CHỈ THỊ TĂNG TRƯỞNG: Đẩy nhanh luồng hàng, tối ưu thời gian di chuyển, giảm thiểu rào cản cổng thu gom để tối đa hóa doanh số E-Commerce!",
    };
  }
}

// 8. INFINITE COGNITIVE RECURSION ENGINE (Level N Meta - Infinite Sieu-Sieu... Scale)
export class InfiniteSieuMetaScale {
  /**
   * Tính toán chiều sâu nhận thức dựa trên số lượng từ "siêu" hoặc chữ "s" trong cụm từ siêu siêu !
   */
  static countSieuDepth(query: string): number {
    const qClean = query.toLowerCase();

    // Đếm số từ "siêu" độc lập hoặc dính liền
    const matchesSieu = qClean.match(/siêu/g);
    const sieuCount = matchesSieu ? matchesSieu.length : 0;

    // Đếm các chuỗi "s" lặp (ví dụ: "siêu sss")
    const matchesS = qClean.match(/s+/g);
    let sCount = 0;
    if (matchesS) {
      for (const m of matchesS) {
        if (m.length > 2) {
          sCount += m.length - 2; // Bỏ qua từ "siêu" có chứa s
        }
      }
    }

    // Cấp độ meta tối thiểu là 1, tối đa động dựa trên số lượng "siêu" và "s" của Sếp!
    return Math.max(1, sieuCount + sCount);
  }

  /**
   * Đệ quy tối ưu hóa đa cấp độ - Mỗi tầng siêu tối ưu hóa tầng dưới !
   */
  static executeRecursiveMeta(depth: number, baseContext: FlexibilityContext): any {
    console.log(`🌀 [InfiniteSieuMetaScale] Khởi động đệ quy nhận thức Meta-Level: ${depth}`);

    let currentContext = { ...baseContext };
    const logs: string[] = [];

    for (let i = 1; i <= depth; i++) {
      if (i === 1) {
        logs.push(`[Tầng 1 - Siêu]: Tối ưu hóa cấu trúc đệ quy Thanh Long (DepthLimit = ${currentContext.depthLimit || 27})`);
      } else if (i === 2) {
        // Tầng 2: Hiệu chỉnh tham số động Kỳ Lân & Huyền Vũ
        currentContext.noiseVariance = Math.max(0.001, (currentContext.noiseVariance || 0.05) / 2);
        currentContext.homeostasisTarget = Math.min(0.9999, (currentContext.homeostasisTarget || 0.99) + 0.005);
        logs.push(
          `[Tầng 2 - Siêu Siêu]: Hiệu chuẩn tự động Kalman Noise R ➔ ${currentContext.noiseVariance}, Resilience Target ➔ ${currentContext.homeostasisTarget * 100}%`,
        );
      } else if (i === 3) {
        // Tầng 3: Phân nhánh vĩ mô Chu Tước Bayes
        currentContext.bayesianPrior = Math.min(0.95, (currentContext.bayesianPrior || 0.3) * 1.5);
        logs.push(
          `[Tầng 3 - Siêu Siêu Siêu]: Tiêm dự báo thời tiết xấu, nâng xác suất thiên tai tiên nghiệm Bayes (Prior) ➔ ${(currentContext.bayesianPrior * 100).toFixed(2)}%`,
        );
      } else if (i === 5) {
        // Tầng 5: Kích hoạt Bạch Hổ - Mưu mẹo đàm phán đối kháng
        currentContext.noiseVariance = Math.min(0.5, (currentContext.noiseVariance || 0.05) * 1.8);
        logs.push(
          `[Tầng 5 - Siêu^5]: Kích hoạt Bạch Hổ (White Tiger) - Tăng chỉ số tung tin nhiễu/Bluffing đàm phán ➔ ${(currentContext.noiseVariance * 100).toFixed(2)}%`,
        );
      } else {
        // Tầng 4+: Tự đệ quy phản hồi tối ưu hóa đa cấp (Cognitive Feedback Loop)
        currentContext.depthLimit = Math.min(500, Math.round((currentContext.depthLimit || 27) * (1.2 + 0.05 * i)));
        logs.push(
          `[Tầng ${i} - Siêu^${i}]: Tự điều phối phản hồi phản xạ cấp cao (Cognitive Feedback Loop), nhân số bước Thanh Long lên ➔ ${currentContext.depthLimit} bước để vượt qua giới hạn hội tụ!`,
        );
      }
    }

    return {
      metaDepthDetected: depth,
      finalTunedContext: currentContext,
      evolutionaryLogs: logs,
      sieuRepresentation: `Siêu` + `-Siêu`.repeat(depth - 1),
    };
  }
}

// 9. TỨ LINH TRAFFIC LOGISTICS NETWORK (Hệ thống Giao thông Cánh cổng Tứ Linh)
export interface TrafficNode {
  name: string;
  congestion: number; // 1.0 = normal, 2.0 = highly congested
  flooded: boolean;
}

export interface TrafficEdge {
  from: string;
  to: string;
  distance: number; // km
}

export class TuLinhTrafficRouter {
  private nodes: Map<string, TrafficNode> = new Map();
  private edges: TrafficEdge[] = [];

  constructor() {
    // Khởi tạo 4 Cánh Cổng Giao thông Tứ Linh đại diện cho 4 hướng Đông-Tây-Nam-Bắc
    this.nodes.set("Thanh Long Gate", { name: "Thanh Long Gate (Cổng Phía Đông - Hub Logistics)", congestion: 1.0, flooded: false });
    this.nodes.set("Ky Lan Gate", { name: "Ky Lan Gate (Cổng Phía Tây - Kho Nông Sản)", congestion: 1.2, flooded: false });
    this.nodes.set("Huyen Vu Gate", { name: "Huyen Vu Gate (Cổng Phía Bắc - Cảng Thu Gom)", congestion: 1.1, flooded: false });
    this.nodes.set("Chu Tuoc Gate", { name: "Chu Tuoc Gate (Cổng Phía Nam - Trung Tâm E-Commerce)", congestion: 1.5, flooded: false });

    // Định nghĩa mạng lưới giao thông liên kết các Cổng Tứ Linh
    this.edges = [
      { from: "Thanh Long Gate", to: "Huyen Vu Gate", distance: 15 },
      { from: "Thanh Long Gate", to: "Chu Tuoc Gate", distance: 22 },
      { from: "Huyen Vu Gate", to: "Ky Lan Gate", distance: 18 },
      { from: "Ky Lan Gate", to: "Chu Tuoc Gate", distance: 12 },
      { from: "Thanh Long Gate", to: "Ky Lan Gate", distance: 30 }, // Đường vành đai chính
    ];
  }

  /**
   * Tính toán lộ trình giao thông tối ưu giữa các Cổng Tứ Linh sử dụng thuật toán Dijkstra thích ứng !
   */
  async computeOptimalRoute(
    fromGate: string,
    toGate: string,
    mode: "MAX_PROFIT" | "MAX_RESILIENCE" | "BALANCED",
    droughtLevel: number,
  ): Promise<any> {
    console.log(`🚥 [TrafficRouter] Đang tối ưu lộ trình từ [${fromGate}] đến [${toGate}] ở chế độ [${mode}]`);

    // Phản xạ thích ứng: Nếu hạn hán quá lớn (droughtLevel > 0.6), Cổng Chu Tước Phía Nam sẽ bị cảnh báo tăng nhiệt độ/nhiễu
    const updatedNodes = new Map<string, TrafficNode>();
    for (const [key, val] of this.nodes.entries()) {
      updatedNodes.set(key, { ...val });
    }
    if (droughtLevel > 0.6) {
      const chuTuoc = updatedNodes.get("Chu Tuoc Gate")!;
      chuTuoc.congestion = 2.5; // Tắc nghẽn cực lớn do điều kiện nhiệt độ tăng cao
      updatedNodes.set("Chu Tuoc Gate", chuTuoc);
    }

    if (mode === "MAX_RESILIENCE") {
      // Chế độ an toàn: Tránh hoàn toàn các tuyến đường xuyên qua các cổng có độ tắc nghẽn > 2.0
      const huyenVu = updatedNodes.get("Huyen Vu Gate")!;
      huyenVu.congestion = 2.2; // Tăng cường an ninh ANPR thắt chặt checkpoints
      updatedNodes.set("Huyen Vu Gate", huyenVu);
    }

    // Dijkstra Pathfinder
    const distances: Record<string, number> = {};
    const previous: Record<string, string | null> = {};
    const unvisited = new Set<string>();

    for (const key of updatedNodes.keys()) {
      distances[key] = Infinity;
      previous[key] = null;
      unvisited.add(key);
    }
    distances[fromGate] = 0;

    while (unvisited.size > 0) {
      // Lấy node có khoảng cách nhỏ nhất
      let minNode: string | null = null;
      for (const node of unvisited) {
        if (minNode === null || distances[node] < distances[minNode]) {
          minNode = node;
        }
      }

      if (minNode === null || distances[minNode] === Infinity) break;
      unvisited.delete(minNode);

      if (minNode === toGate) break;

      // Tìm các láng giềng liên kết
      const neighbors = this.edges.filter((e) => e.from === minNode || e.to === minNode);
      for (const edge of neighbors) {
        const neighbor = edge.from === minNode ? edge.to : edge.from;
        if (!unvisited.has(neighbor)) continue;

        const neighborNode = updatedNodes.get(neighbor)!;
        // Trọng số thời gian = Khoảng cách * Hệ số tắc nghẽn của cổng láng giềng
        const weight = edge.distance * neighborNode.congestion;
        const alt = distances[minNode] + weight;

        if (alt < distances[neighbor]) {
          distances[neighbor] = alt;
          previous[neighbor] = minNode;
        }
      }
    }

    // Khôi phục hành trình đường đi
    const path: string[] = [];
    let curr: string | null = toGate;
    while (curr !== null) {
      path.unshift(curr);
      curr = previous[curr];
    }

    const travelTimeMinutes = distances[toGate] !== Infinity ? Math.round(distances[toGate] * 2) : 0; // Giả sử vận tốc trung bình 30km/h

    return {
      success: true,
      origin: fromGate,
      destination: toGate,
      optimizedPath: path,
      totalAdjustedDistance: distances[toGate].toFixed(1),
      estimatedTravelTimeMinutes: travelTimeMinutes,
      nodesState: Array.from(updatedNodes.values()),
      routingAdvice:
        mode === "MAX_RESILIENCE"
          ? "🛡️ LỘ TRÌNH KIÊN CỐ: Đã tối ưu hóa lộ trình tránh xa các vùng nguy cơ cao và các trạm ANPR quá tải để đảm bảo an toàn tuyệt đối cho xe nông sản!"
          : "💰 LỘ TRÌNH SIÊU TỐC: Đã chọn tuyến đường có thời gian di chuyển nhanh nhất, đẩy nhanh luồng hàng E-Commerce để tối đa hóa doanh thu!",
    };
  }
}

// 10. TU LINH DATA COORDINATION CORE (Phân Hệ Điều Phối Dữ Liệu Tứ Linh & ANPR)
export interface DataStreamInput {
  streamId: string;
  source: string;
  payload: any;
  timestamp: number;
}

export class TuLinhDataCoordinator {
  private registry: Map<string, DataStreamInput[]> = new Map();

  /**
   * Đăng ký và đưa luồng dữ liệu thô (ANPR, Telemetry, Sensor) vào phễu điều phối !
   */
  ingestData(streamId: string, source: string, payload: any): void {
    if (!this.registry.has(streamId)) {
      this.registry.set(streamId, []);
    }
    const streams = this.registry.get(streamId)!;
    streams.push({
      streamId,
      source,
      payload,
      timestamp: Date.now(),
    });

    // Giới hạn buffer dữ liệu tránh tràn bộ nhớ !
    if (streams.length > 50) {
      streams.shift();
    }
  }

  /**
   * Trung tâm điều phối dữ liệu tích hợp: Phân phối dữ liệu đến đúng Beast trong Tứ Linh để xử lý
   */
  async orchestrateDataFlow(
    streamId: string,
    targetBeast: "ThanhLong" | "KyLan" | "HuyenVu" | "ChuTuoc" | "BachHo",
    context: FlexibilityContext,
  ): Promise<any> {
    const streams = this.registry.get(streamId) || [];
    console.log(`🌀 [DataCoordinator] Bắt đầu điều phối luồng dữ liệu [${streamId}] tới [${targetBeast}]`);

    // Trích xuất payload dữ liệu gần nhất để xử lý
    const latestPayload = streams.length > 0 ? streams[streams.length - 1].payload : null;

    let processedResult: any = null;

    switch (targetBeast) {
      case "ThanhLong":
        // Điều phối chuỗi đệ quy cấu trúc sâu hoặc logistics đa tầng
        const dynamicDepth = latestPayload?.activeVehicles ? Math.min(300, latestPayload.activeVehicles * 2) : context.depthLimit || 27;
        const strategy1 = new ThanhLongDepthFlexibility();
        processedResult = await strategy1.adapt({ ...context, depthLimit: dynamicDepth });
        break;
      case "KyLan":
        // Điều phối dữ liệu cảm biến ANPR thô qua Kalman Filter thích ứng để làm sạch
        const rawSensors = latestPayload?.rawReadings || context.sensorData || [23.5, 24.0, 23.8];
        const strategy2 = new KyLanStateCalibrationFlexibility();
        processedResult = await strategy2.adapt({ ...context, sensorData: rawSensors });
        break;
      case "HuyenVu":
        // Điều phối an toàn dữ liệu, sinh lưu trữ checkpoints bền vững
        const strategy3 = new HuyenVuResilientRecoveryFlexibility();
        processedResult = await strategy3.adapt(context);
        break;
      case "ChuTuoc":
        // Điều phối luồng xác suất ra quyết định Bayes thích ứng rủi ro
        const strategy4 = new ChuTuocStrategicBranchingFlexibility();
        processedResult = await strategy4.adapt(context);
        break;
      case "BachHo":
        // Điều phối mưu mẹo đối kháng Bạch Hổ
        const strategy5 = new BachHoTrickeryStrategy();
        processedResult = await strategy5.adapt(context);
        break;
    }

    return {
      success: true,
      coordinatedStreamId: streamId,
      dispatchedBeast: targetBeast,
      latestIngestedData: latestPayload,
      executionResult: processedResult,
      coordinationTimestamp: Date.now(),
      coordinationInsight:
        "Chung quy lại, mọi hoạt động vận tải, định vị xe ANPR hay thuật toán Tứ Linh đều là luồng biểu diễn dữ liệu được Rottra điều phối mượt mà nhất !",
    };
  }
}
