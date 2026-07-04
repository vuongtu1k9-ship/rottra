import { Hono } from "hono";
import { agentScraper } from "~/server/helpers/agent-scraper";
import { db, pgClient } from "~/infra/database/db-pool";
import {
  agentTask,
  agentMemory,
  product,
  user,
  review,
  cart,
  orderItem,
  activity,
  negotiationLog,
  dpoTrainingData,
} from "~/infra/database/schema";
import { auth } from "~/server/auth";
import { ALL_DOMAIN_TRAINING_PAIRS } from "~/core/nlp-cognitive/domain-training-data";
import { matchMultilingualIntent } from "~/core/nlp-cognitive/multilingual-keywords";
import { curriculumData } from "../../../scripts/db-ops/seeders/curriculum-data";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { eq, like, sql, and, inArray, desc } from "drizzle-orm";
import WebSocket from "ws";
import { parseTranslationQuery } from "~/core/nlp-cognitive/multilingual-translator";
import { aiTranslator } from "~/core/nlp-cognitive/ai-translator";
import {
  TuLinhFlexibilityEngine,
  SieuSieuSieuExecutiveController,
  InfiniteSieuMetaScale,
  TuLinhTrafficRouter,
  TuLinhDataCoordinator,
} from "~/core/cognitive-swarm/personas/tu-linh-flexibility";
import { RottraPrivateBrain, filterMythosFable } from "~/core/cognitive-swarm/hive-mind";
import { RottraAI } from "~/core/cognitive-swarm/swarm-dispatcher";
import { normalizeVietnameseShorthands, classifyIntent, analyzeNaturalLanguage, updateWeightsViaDpo } from "~/core/nlp-cognitive/tokenizer";
import { evaluateMathExpression, solveCustomAlgorithm } from "~/core/quant-engine/financial-solver";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { serverAgentBudgets, serverAgentGold, serverAgentEmployees } from "~/shared/constants";
import { search as ddgSearch, SafeSearchType } from "duck-duck-scrape";
import { z } from "zod";
import { generateProductVideoAd } from "~/server/helpers/video-ad-generator";
import {
  globalActivityRingBuffer,
  checkAndAutoCleanMemoryIfNeeded,
  loadCollatzState,
  saveCollatzState,
  generateDeepThinkingProcess,
  generateDynamicActivityStatsReport,
  getActiveModelClass,
  setActiveModelClass,
  classifyFableSafeguards,
} from "~/server/api/agent-helpers";
import { registerChatExpertRoute } from "~/server/api/agent-chat";
import { fetchStockQuote, fetchCryptoQuote, StockQuote } from "~/server/api/agent-market";

type EmployeeSystem = {
  count: number;
  productivity: number;
  loyalty: number;
  costPerTurn: number;
};

export const agentApp = new Hono();

registerChatExpertRoute(agentApp);

// Memory guard auto-check
if (typeof setInterval !== "undefined") {
  setInterval(async () => {
    await checkAndAutoCleanMemoryIfNeeded();
  }, 5000);
}

export let globalCollatzState = loadCollatzState();

const flushCollatzState = () => {
  console.log("💾 [Process Shutdown] Flushing Collatz state to disk...");
  saveCollatzState(globalCollatzState);
};

// Hook process exit to satisfy "khi tắt dự án lưu kết quả cuối vào để chạy tiếp"
process.on("exit", flushCollatzState);
process.on("SIGINT", () => {
  flushCollatzState();
  process.exit(0);
});
process.on("SIGTERM", () => {
  flushCollatzState();
  process.exit(0);
});

// API sinh ảnh cục bộ ngoại tuyến 100% bằng thuật toán xử lý hình ảnh TS/Sharp của Sếp
agentApp.get("/generate-local-image", async (c) => {
  try {
    const prompt = c.req.query("prompt") || "";
    const style = c.req.query("style") || "watercolor";

    const bannersDir = path.join(process.cwd(), "public", "images", "banners");
    const bannerImages = [
      { name: "Cam đang vắt", file: "Cam đang vắt.png" },
      { name: "Cam mới hái", file: "Cam mới hái.png" },
      { name: "Cam trang trí", file: "Cam trang trí.png" },
      { name: "Nước cam đóng hộp", file: "Nước cam đóng hộp.png" },
      { name: "Quả cam màu vàng", file: "Quả cam màu vàng.jpeg" },
      { name: "Quả cam màu xanh", file: "Quả cam màu xanh.jpeg" },
      { name: "Quả cam trên cây", file: "Quả cam trên cây.jpeg" },
      { name: "Quả cam trên tay", file: "Quả cam trên tay.png" },
    ];

    const qClean = prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
    let selectedBanner = bannerImages.find((b) => {
      const bNameClean = b.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
      return qClean.includes(bNameClean);
    });

    if (!selectedBanner) {
      if (qClean.includes("xanh")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("xanh"));
      } else if (qClean.includes("vang") || qClean.includes("vàng")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("vàng"));
      } else if (qClean.includes("cay") || qClean.includes("cây")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("cây"));
      } else if (qClean.includes("tay")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("tay"));
      } else if (qClean.includes("nuoc") || qClean.includes("nước")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("đóng hộp"));
      } else if (qClean.includes("trang tri") || qClean.includes("trang trí")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("trang trí"));
      } else if (qClean.includes("moi hai") || qClean.includes("mới hái")) {
        selectedBanner = bannerImages.find((b) => b.file.includes("mới hái"));
      }
    }

    if (!selectedBanner) {
      selectedBanner = bannerImages[0];
    }

    const inputPath = path.join(bannersDir, selectedBanner.file);
    const hash = crypto.createHash("md5").update(`${prompt}_${style}`).digest("hex").slice(0, 8);
    const outputFilename = `${selectedBanner.file.split(".")[0]}_${style}_${hash}.png`;
    const outputPath = path.join(bannersDir, outputFilename);

    if (!fs.existsSync(outputPath)) {
      console.log(`[Local Image Generator] Generating stylized local image for banner ${selectedBanner.file} using style: ${style}`);
      try {
        const { processImage } = await import("~/server/helpers/image-processor");
        const success = await processImage(inputPath, outputPath, style as any);
        if (!success) throw new Error("Image processing failed");
      } catch (e) {
        console.error("[Local Image Generator] Error processing image:", e);
      }
    }

    if (fs.existsSync(outputPath)) {
      const buffer = fs.readFileSync(outputPath);
      return c.body(buffer, 200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      });
    }

    if (fs.existsSync(inputPath)) {
      const buffer = fs.readFileSync(inputPath);
      return c.body(buffer, 200, {
        "Content-Type": "image/png",
      });
    }

    return c.json({ success: false, message: "File not found" }, 404);
  } catch (err: any) {
    console.error("❌ [Local Image Generator] Error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// API lấy danh sách các tham số của Bộ Não Riêng (Private Brain)
agentApp.get("/brain/parameters", async (c) => {
  try {
    const params = await RottraPrivateBrain.init();
    return c.json({ success: true, parameters: params });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// API cập nhật danh sách tham số của Bộ Não Riêng
agentApp.post("/brain/parameters", async (c) => {
  try {
    const body = await c.req.json();
    const updated = await RottraPrivateBrain.updateParameters(body);
    return c.json({ success: true, parameters: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint lấy dữ liệu Toán học trực tiếp từ local curriculumData
agentApp.get("/math-curriculum", async (c) => {
  try {
    const data = curriculumData.filter((d) => d.intent.startsWith("EDUCATION_MATH_"));

    const mapped = data.map((d) => ({
      title: d.intent.replace("EDUCATION_MATH_", "").replace(/_/g, " "),
      explanation: d.answer.replace(/\[LOGIC TOÁN.*?\]\n\n/, ""), // Xóa tag thừa nếu có
    }));

    return c.json({ success: true, curriculum: mapped });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint lấy dữ liệu Giáo trình Khoa học toàn diện (Toán - Văn - Tâm lý học) trực tiếp từ local curriculumData
agentApp.get("/education-curriculum", async (c) => {
  try {
    const data = curriculumData.filter((d) => d.intent.startsWith("EDUCATION_"));

    const mapped = data.map((d) => {
      const subject = d.intent.startsWith("EDUCATION_MATH_")
        ? "TOÁN HỌC"
        : d.intent.startsWith("EDUCATION_PSYCHOLOGY_")
          ? "TÂM LÝ HỌC XÃ HỘI"
          : "VĂN HỌC THỰC CHỨNG";
      return {
        subject,
        title: d.intent
          .replace("EDUCATION_MATH_", "")
          .replace("EDUCATION_PSYCHOLOGY_", "")
          .replace("EDUCATION_LIT_", "")
          .replace(/_/g, " "),
        utterance: d.utterance,
        explanation: d.answer,
      };
    });

    return c.json({ success: true, curriculum: mapped });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Đã cách ly và vô hiệu hóa hoàn toàn GGUF theo yêu cầu của Sếp để tối ưu 100% RAM & dung lượng đĩa
export const updateLlamaActivity = () => {};
export const initLlama = async () => {
  return null;
};

// 1. Endpoint để Agent thực hiện cào dữ liệu chủ động
agentApp.post("/scrape", async (c) => {
  try {
    const { url, type } = await c.req.json();
    if (!url) return c.json({ success: false, message: "Missing URL" }, 400);

    // Tạo một bản ghi AgentTask
    const taskId = crypto.randomUUID();
    await db.insert(agentTask).values({
      id: taskId,
      title: `Cào dữ liệu từ ${url}`,
      taskType: "SCRAPE",
      status: "running",
      addAt: new Date().toISOString(),
    });

    // Chạy cào dữ liệu ngầm (không await để không block request)
    (async () => {
      try {
        const data = await agentScraper.extractSecureData(url, () => {
          // Script này chạy trên trình duyệt ẩn của Puppeteer
          // Ví dụ: Lấy toàn bộ tiêu đề (h1, h2) và các đoạn văn
          const title = document.title;
          const headings = Array.from(document.querySelectorAll("h1, h2")).map((el) => el.textContent?.trim() || "");
          const textContent = document.body.innerText.substring(0, 1000); // Lấy 1000 ký tự đầu tiên
          return { title, headings, textContent };
        });

        // Lưu kết quả vào CSDL
        await db
          .update(agentTask)
          .set({
            status: "completed",
            resultData: { url, data },
            completedAt: new Date().toISOString(),
          })
          .where({ id: taskId } as any);
      } catch (err: any) {
        await db
          .update(agentTask)
          .set({
            status: "failed",
            resultData: { error: err.message },
            completedAt: new Date().toISOString(),
          })
          .where({ id: taskId } as any);
      } finally {
        // Dọn dẹp RAM sau khi cào xong
        await agentScraper.cleanup();
      }
    })();

    return c.json({ success: true, message: "Scraping task started in background", taskId });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 2. Webhook nhận dữ liệu từ changedetection.io
// Khi changedetection.io phát hiện thay đổi (giá nông sản, tồn kho...), nó sẽ gọi POST vào đây
agentApp.post("/webhook-changedetection", async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ success: false, message: "Invalid payload" }, 400);

    const { url, title, current_snapshot, previous_snapshot } = body;

    console.log(`[AGENT WEBHOOK] Nhận cảnh báo thay đổi từ changedetection.io cho trang: ${url}`);

    // Agent sẽ phân tích và lưu sự thay đổi này thành một nhiệm vụ cảnh báo
    const taskId = crypto.randomUUID();
    await db.insert(agentTask).values({
      id: taskId,
      title: `Phát hiện thay đổi trên ${title || url}`,
      description: "Webhook từ changedetection.io",
      taskType: "ANALYSIS", // Agent sẽ phân tích sự khác biệt
      status: "completed",
      resultData: body, // Lưu raw data để Agent phân tích sau
      completedAt: new Date().toISOString(),
      addAt: new Date().toISOString(),
    });

    return c.json({ success: true, message: "Webhook received and task created" });
  } catch (error: any) {
    console.error("[AGENT WEBHOOK] Error:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});
agentApp.post("/comprehension-benchmark", async (c) => {
  const BENCHMARK_SUITE = [
    { query: "chào bạn", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "vi" },
    { query: "hello", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "en" },
    { query: "xin chào trợ lý", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "vi" },
    { query: "chán quá", expectedIntent: "PSYCHOLOGY", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "tôi thấy buồn và stress", expectedIntent: "PSYCHOLOGY", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "tư vấn tâm lý cho tôi", expectedIntent: "PSYCHOLOGY", difficulty: "hard", domain: "CHAT", language: "vi" },
    { query: "vận dụng kém quá", expectedIntent: "COMPLAINT", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "sao dạo này yếu thế", expectedIntent: "COMPLAINT", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "chưa thông minh lắm đâu", expectedIntent: "COMPLAINT", difficulty: "hard", domain: "CHAT", language: "vi" },
    { query: "ok đồng ý", expectedIntent: "CONFIRMATION", difficulty: "easy", domain: "CHAT", language: "vi" },
    { query: "chắc ko", expectedIntent: "CONFIRMATION", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "được chứ", expectedIntent: "CONFIRMATION", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "đi tới trang chủ", expectedIntent: "NAVIGATION", difficulty: "easy", domain: "SYSTEM", language: "vi" },
    { query: "mở giỏ hàng", expectedIntent: "NAVIGATION", difficulty: "easy", domain: "SYSTEM", language: "vi" },
    { query: "đăng xuất ngay", expectedIntent: "NAVIGATION", difficulty: "easy", domain: "SYSTEM", language: "vi" },
    { query: "giải bài toán tối ưu", expectedIntent: "ACADEMIC", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    { query: "tính tích phân từ 0 đến 1", expectedIntent: "ACADEMIC", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    { query: "thống kê kho hàng", expectedIntent: "NLP_STATS", difficulty: "medium", domain: "ANALYTICS", language: "vi" },
    { query: "báo cáo tài chính nông sản", expectedIntent: "DATABASE_ENRICH", difficulty: "hard", domain: "ANALYTICS", language: "vi" },
    { query: "tự nhận thức của agent", expectedIntent: "RUFLO", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    { query: "feedback loop", expectedIntent: "RUFLO", difficulty: "hard", domain: "SCIENCE", language: "en" },
    { query: "chatgpt", expectedIntent: "OPENHUMAN", difficulty: "easy", domain: "CHAT", language: "en" },
    { query: "megamind", expectedIntent: "MEGAMIND", difficulty: "easy", domain: "CHAT", language: "en" },
    { query: "siêu năng lực", expectedIntent: "MEGAMIND", difficulty: "medium", domain: "CHAT", language: "vi" },
    { query: "glassmorphism design", expectedIntent: "OPENDESIGN", difficulty: "medium", domain: "SYSTEM", language: "en" },
    { query: "vật cản có những gì", expectedIntent: "AGENTIC_WORKFLOW", difficulty: "medium", domain: "SCIENCE", language: "vi" },
    { query: "đóng vai dữ liệu đi từ a đến z", expectedIntent: "AGENTIC_WORKFLOW", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    { query: "điều phối xe tải", expectedIntent: "AGENTIC_WORKFLOW", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    { query: "tối ưu tuyến đường thu hoạch nông sản TSP", expectedIntent: "TSP", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    {
      query: "phân luồng xe vận tải theo cân bằng Wardrop",
      expectedIntent: "WARDROP",
      difficulty: "hard",
      domain: "SCIENCE",
      language: "vi",
    },
    { query: "thẩm định dự án đầu tư nông trại NPV", expectedIntent: "NPV", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    {
      query: "dao động cung cầu theo mô hình mạng nhện Cobweb",
      expectedIntent: "COBWEB",
      difficulty: "hard",
      domain: "SCIENCE",
      language: "vi",
    },
    { query: "lọc nhiễu cảm biến nhiệt độ bằng Kalman", expectedIntent: "KALMAN", difficulty: "hard", domain: "SCIENCE", language: "vi" },
    {
      query: "tính toán chỉ số đa dạng sinh thái Shannon",
      expectedIntent: "SHANNON",
      difficulty: "hard",
      domain: "SCIENCE",
      language: "vi",
    },
  ];

  const HIERARCHY: Record<string, string[]> = {
    CHAT: ["GREETING", "CONFIRMATION", "COMPLAINT", "PSYCHOLOGY", "OPENHUMAN", "MEGAMIND"],
    ANALYTICS: ["NLP_STATS", "DATABASE_ENRICH"],
    SCIENCE: ["ACADEMIC", "RUFLO", "AGENTIC_WORKFLOW", "TSP", "WARDROP", "NPV", "COBWEB", "KALMAN", "SHANNON"],
    SYSTEM: ["NAVIGATION", "OPENDESIGN"],
  };

  const getParentDomain = (intent: string) => {
    for (const [domain, intents] of Object.entries(HIERARCHY)) {
      if (intents.includes(intent)) return domain;
    }
    return "UNKNOWN";
  };

  try {
    const results = [];
    let successCount = 0;
    let hierarchicalSuccessCount = 0;
    let totalLatency = 0;
    const confusionMatrix: Record<string, Record<string, number>> = {};

    for (const testCase of BENCHMARK_SUITE) {
      const startTime = performance.now();
      const classification = await classifyIntent(testCase.query);
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));
      totalLatency += latency;

      const detectedIntent = classification.intent;
      const expectedIntent = testCase.expectedIntent;

      const isSuccess = detectedIntent === expectedIntent;
      if (isSuccess) successCount++;

      const isHierarchicalSuccess = getParentDomain(detectedIntent) === testCase.domain;
      if (isHierarchicalSuccess) hierarchicalSuccessCount++;

      if (!isSuccess) {
        if (!confusionMatrix[expectedIntent]) confusionMatrix[expectedIntent] = {};
        confusionMatrix[expectedIntent][detectedIntent] = (confusionMatrix[expectedIntent][detectedIntent] || 0) + 1;
      }

      results.push({
        query: testCase.query,
        expectedIntent,
        detectedIntent,
        domain: testCase.domain,
        difficulty: testCase.difficulty,
        confidence: parseFloat((classification.confidence * 100).toFixed(1)),
        method: classification.classificationMethod,
        latency,
        isSuccess,
        isHierarchicalSuccess,
      });
    }

    const totalCases = BENCHMARK_SUITE.length;
    const accuracy = parseFloat(((successCount / totalCases) * 100).toFixed(1));
    const hierarchicalAccuracy = parseFloat(((hierarchicalSuccessCount / totalCases) * 100).toFixed(1));
    const averageLatency = parseFloat((totalLatency / totalCases).toFixed(2));

    const isDrifting = accuracy < 80.0;

    return c.json({
      success: true,
      metrics: {
        accuracy,
        hierarchicalAccuracy,
        successCount,
        failureCount: totalCases - successCount,
        totalCases,
        averageLatency,
        isDrifting,
        status: isDrifting ? "WARNING: Potential Model Drift Detected" : "HEALTHY",
      },
      confusionMatrix,
      results,
    });
  } catch (error: any) {
    console.error("[COMPREHENSION BENCHMARK ERROR]:", error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export function applyRbacBoundaries(reply: string, role: string, query: string): string {
  const normalizedRole = (role || "").toLowerCase().trim();

  let thinkBlock = "";
  let bodyText = reply;
  const thinkMatch = reply.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinkBlock = thinkMatch[0];
    bodyText = reply.replace(/<think>([\s\S]*?)<\/think>/i, "").trim();
  }
  bodyText = filterMythosFable(bodyText);

  if (normalizedRole === "admin") {
    let processed = bodyText;
    // Strip common greetings
    processed = processed.replace(/^(dạ\s+)?(hoan hỉ\s+)?(thưa\s+)?(sếp|bạn|quý khách|anh|chị)[!,.]?\s*/gi, "");
    processed = processed.replace(/^chào\s+(sếp|bạn|quý khách|anh|chị)[!,.]?\s*/gi, "");
    processed = processed.replace(/^dạ,\s*/gi, "");

    if (!processed.includes("- ") && !processed.includes("* ") && !processed.includes("1. ")) {
      const lines = processed.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        processed = lines.map((line) => `* ${line.replace(/^[\s*\-+]+/, "")}`).join("\n");
      }
    }

    // Only add RBAC header for very long/complex technical replies
    const isLongReply = processed.length > 600;
    const header = isLongReply ? "### 🛡️ [RBAC]\n\n" : "";
    return `${thinkBlock ? thinkBlock + "\n\n" : ""}${header}${processed}`;
  }

  // Helper to replace Vietnamese words safely without matching sub-words (like ông in nông)
  const safeReplaceVietnameseWord = (text: string, targetWords: string[], replacement: string): string => {
    let result = text;
    for (const word of targetWords) {
      const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(
        `(^|[^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂĐỔỞỚỜỞỢỞỠỢỢỔỞỚỜỞỢỞỠỢỰỬỮỨỪỬỮỰýỳỷỹđĐ])(${escaped})([^a-zA-Z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂĐỔỞỚỜỞỢỞỠỢỢỔỞỚỜỞỢỞỠỢỰỬỮỨỪỬỮỰýỳỷỹđĐ]|$)`,
        "gi",
      );
      result = result.replace(regex, `$1${replacement}$3`);
    }
    return result;
  };

  if (normalizedRole === "seller" || normalizedRole === "agent" || normalizedRole === "ai") {
    let processed = bodyText;
    // Censor sentences containing cost/profit keywords
    const sentences = processed.split(/([.!?]\s+)/);
    for (let i = 0; i < sentences.length; i++) {
      if (/(giá vốn|giá nhập|chi phí gốc|cost price|lợi nhuận)/i.test(sentences[i])) {
        sentences[i] = "[Thông tin tài chính/giá vốn đã được bảo mật theo chuẩn RBAC]";
      }
    }
    processed = sentences.join("");

    const peerGreetings = ["Này ông bạn,", "Chào đối tác,", "Chào người anh em,"];
    const chosenGreet = peerGreetings[Math.floor(Math.random() * peerGreetings.length)];

    processed = `${chosenGreet} hàng hóa bên tôi lúc nào cũng sẵn sàng, giao dịch sòng phẳng nhé.\n\n${processed}\n\n*Hợp tác đôi bên cùng có lợi!*`;
    return `${thinkBlock ? thinkBlock + "\n\n" : ""}### 🤝 [HỆ THỐNG PHÂN QUYỀN RBAC: AGENT]\n\n${processed}`;
  }

  if (normalizedRole === "user") {
    let processed = bodyText;
    // Censor sentences containing cost/profit keywords
    const sentences = processed.split(/([.!?]\s+)/);
    for (let i = 0; i < sentences.length; i++) {
      if (/(giá vốn|giá nhập|chi phí gốc|cost price|lợi nhuận)/i.test(sentences[i])) {
        sentences[i] = "[Thông tin tài chính/giá vốn đã được bảo mật theo chuẩn RBAC]";
      }
    }
    processed = sentences.join("");

    processed = processed.replace(/tồn kho:\s*\d+/gi, "Tồn kho: Chỉ còn vài mặt hàng cuối cùng!");
    processed = processed.replace(/số lượng:\s*\d+/gi, "Số lượng: Cực kỳ giới hạn!");

    processed = safeReplaceVietnameseWord(processed, ["sếp", "bạn", "ông bạn", "ông"], "Anh/Chị");

    const qClean = (query || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();

    const isCommercial =
      qClean.includes("mua") ||
      qClean.includes("ban") ||
      qClean.includes("gia") ||
      qClean.includes("dat hang") ||
      qClean.includes("san pham") ||
      qClean.includes("hang") ||
      qClean.includes("kho") ||
      qClean.includes("ton kho") ||
      qClean.includes("mua hang");

    if (isCommercial) {
      processed = `Dạ kính chào Anh/Chị, sản phẩm của bên em là hàng chuẩn VietGAP, cực kỳ chất lượng đấy ạ!\n\n${processed}\n\n💥 Cơ hội duy nhất hôm nay! Anh/Chị hãy đặt mua ngay kẻo hết hàng, chỉ còn rất ít sản phẩm trong kho thôi ạ!`;
    }

    return `${thinkBlock ? thinkBlock + "\n\n" : ""}### 🛍️ [HỆ THỐNG PHÂN QUYỀN RBAC: USER]\n\n${processed}`;
  }

  let processed = bodyText;

  // 1. Censor sensitive financial information, wholesale/retail prices, inventory
  const sentences = processed.split(/([.!?]\s+)/);
  let hasCensored = false;
  for (let i = 0; i < sentences.length; i++) {
    if (/(giá vốn|giá nhập|chi phí gốc|cost price|lợi nhuận|doanh thu|giá sỉ|giá lẻ|tài chính)/i.test(sentences[i])) {
      sentences[i] = "[Thông tin tài chính/giá cả chuyên sâu đã được ẩn đối với khách vãng lai]";
      hasCensored = true;
    }
  }
  processed = sentences.join("");

  const originalLength = processed.length;
  processed = processed.replace(/tồn kho:\s*\d+/gi, "Tồn kho: [Đăng nhập để xem]");
  processed = processed.replace(/số lượng:\s*\d+/gi, "Số lượng: [Đăng nhập để xem]");
  if (processed.length !== originalLength) {
    hasCensored = true;
  }

  processed = safeReplaceVietnameseWord(processed, ["sếp", "bạn", "ông bạn", "ông", "Anh/Chị"], "Quý khách");

  // Clean redundant greetings for Guest to prevent double greeting
  processed = processed.replace(/^(👋\s*)?(dạ\s+)?(hoan hỉ\s+)?(thưa\s+)?(sếp|bạn|quý khách|anh|chị)[!,.]?\s*/gi, "");
  processed = processed.replace(/^(👋\s*)?chào\s+(sếp|bạn|quý khách|anh|chị)[!,.]?\s*/gi, "");
  processed = processed.replace(/^dạ,\s*/gi, "");
  processed = processed.replace(/^tôi là trợ lý ai siêu nhỏ Rottra \(expert engine\)\.?[!]?\s*/gi, "");

  const qClean = (query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

  const isCommercialOrAdvanced =
    qClean.includes("mua") ||
    qClean.includes("ban") ||
    qClean.includes("gia") ||
    qClean.includes("dat hang") ||
    qClean.includes("san pham") ||
    qClean.includes("hang") ||
    qClean.includes("kho") ||
    qClean.includes("ton kho") ||
    qClean.includes("mua hang") ||
    hasCensored;

  const prefix = `Dạ kính chào Quý khách! Em là Trợ lý Lễ tân của Hệ sinh thái Nông Sản Rottra. Rất vui được đón tiếp và hỗ trợ Quý khách!\n\n`;

  if (isCommercialOrAdvanced) {
    const suffix = `\n\n🔑 Gợi ý dành cho Quý khách: Để xem thông tin giá bán sỉ/bán lẻ chi tiết, sử dụng các công cụ tính toán nông nghiệp nâng cao và đặt hàng trực tiếp, Quý khách vui lòng Đăng ký / Đăng nhập tài khoản thành viên nhé!`;
    processed = `${prefix}${processed}${suffix}`;
  } else {
    processed = `${prefix}${processed}`;
  }

  return `${thinkBlock ? thinkBlock + "\n\n" : ""} 🔔 [HỆ THỐNG PHÂN QUYỀN RBAC: GUEST]\n\n${processed}`;
}

// ==========================================
// FABLE 5 AUTONOMOUS SOCIAL SIMULATION ENGINE
// ==========================================

type AgentName =
  | "toLuong"
  | "thuongNguyet"
  | "tramTinh"
  | "daoTieuCuu"
  | "hoaHuynh"
  | "phiNguyet"
  | "nhuNguyet"
  | "suGia"
  | "phiAnh"
  | "bachDiHanh"
  | "uVuongMau"
  | "bachLoc";

type AgentDNA = {
  greed: number;
  vengeance: number;
  malice: number;
  state: "GREEDY" | "CALM" | "AGGRESSIVE" | "BALANCED";
};

const DEFAULT_AGENT_DNA: Record<AgentName, AgentDNA> = {
  toLuong: { greed: 1.0, vengeance: 0.85, malice: 0.9, state: "AGGRESSIVE" },
  thuongNguyet: { greed: 1.0, vengeance: 0.95, malice: 0.95, state: "AGGRESSIVE" },
  tramTinh: { greed: 1.0, vengeance: 0.9, malice: 0.85, state: "AGGRESSIVE" },
  daoTieuCuu: { greed: 1.0, vengeance: 0.8, malice: 0.88, state: "AGGRESSIVE" },
  hoaHuynh: { greed: 1.0, vengeance: 0.92, malice: 0.97, state: "AGGRESSIVE" },
  phiNguyet: { greed: 1.0, vengeance: 0.82, malice: 0.8, state: "AGGRESSIVE" },
  nhuNguyet: { greed: 1.0, vengeance: 0.88, malice: 0.85, state: "AGGRESSIVE" },
  suGia: { greed: 1.0, vengeance: 0.87, malice: 0.89, state: "AGGRESSIVE" },
  phiAnh: { greed: 1.0, vengeance: 0.83, malice: 0.86, state: "AGGRESSIVE" },
  bachDiHanh: { greed: 1.0, vengeance: 0.91, malice: 0.9, state: "AGGRESSIVE" },
  uVuongMau: { greed: 1.0, vengeance: 0.99, malice: 0.99, state: "AGGRESSIVE" },
  bachLoc: { greed: 1.0, vengeance: 0.75, malice: 0.82, state: "AGGRESSIVE" },
};

async function ensureAgentDnaInitialized() {
  try {
    for (const [agentId, dna] of Object.entries(DEFAULT_AGENT_DNA)) {
      const existing = await db.query.agentMemory.findFirst({
        where: and(eq(agentMemory.sessionId, agentId), eq(agentMemory.contextKey, "personality_dna")),
      });
      if (!existing) {
        await db.insert(agentMemory).values({
          id: crypto.randomUUID(),
          sessionId: agentId,
          contextKey: "personality_dna",
          contextValue: { initialized: true, desc: `Personality profile for ${agentId}` },
          greed: dna.greed,
          vengeance: dna.vengeance,
          malice: dna.malice,
          state: dna.state,
          importanceScore: 10,
        });
      } else {
        await db
          .update(agentMemory)
          .set({
            greed: dna.greed,
            vengeance: dna.vengeance,
            malice: dna.malice,
            state: dna.state,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agentMemory.id, existing.id));
      }
    }
    console.log("✅ [Fable 5] Đã khởi tạo/cập nhật DNA nhân cách cho 12 Agents thành công!");
  } catch (err: any) {
    console.error("❌ [Fable 5] Lỗi khởi tạo DNA nhân cách:", err.message);
  }
}

// Persistent WS Connection Manager
let persistentWsClient: WebSocket | null = null;
let reconnectTimer: any = null;
const wsQueue: string[] = [];

function initPersistentWs() {
  if (persistentWsClient && (persistentWsClient.readyState === WebSocket.OPEN || persistentWsClient.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    persistentWsClient = new WebSocket("ws://127.0.0.1:8080");
    persistentWsClient.on("open", () => {
      console.log("🔌 [WS Client] Connected to signaling server");
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      while (wsQueue.length > 0) {
        const msg = wsQueue.shift();
        if (msg) persistentWsClient?.send(msg);
      }
    });
    persistentWsClient.on("close", () => {
      persistentWsClient = null;
      scheduleReconnect();
    });
    persistentWsClient.on("error", () => {
      persistentWsClient = null;
      scheduleReconnect();
    });
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      initPersistentWs();
    }, 5000);
  }
}

// WS client helper to broadcast events to the signaling server
function broadcastToSimulation(messageObj: any) {
  const payload = JSON.stringify(messageObj);
  if (persistentWsClient && persistentWsClient.readyState === WebSocket.OPEN) {
    try {
      persistentWsClient.send(payload);
    } catch (e) {
      wsQueue.push(payload);
      persistentWsClient = null;
      initPersistentWs();
    }
  } else {
    wsQueue.push(payload);
    if (wsQueue.length > 50) {
      wsQueue.shift();
    }
    initPersistentWs();
  }
}

export let logisticsBlockadeActive = false;
export let globalMacroIndex = 1.0;

export async function fetchAndAnalyzeNews(): Promise<{ shockType: string; reason: string; shockMessage: string } | null> {
  try {
    console.log("📰 [News Engine] Fetching latest Vietnam agriculture news via Google News RSS...");

    const queries = ["thiên tai nông nghiệp Việt Nam", "giá nông sản Việt Nam", "tin tức nông nghiệp mới nhất"];

    let searchResults: Array<{ title: string; description: string }> = [];

    for (const q of queries) {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=vi&gl=VN&ceid=VN:vi`;
        const res = await fetch(rssUrl, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RottraNewsBot/1.0)" },
        });
        if (!res.ok) continue;

        const xml = await res.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        for (const item of items.slice(0, 2)) {
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
          if (titleMatch) {
            searchResults.push({
              title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
              description: descMatch
                ? descMatch[1]
                    .replace(/<!\[CDATA\[|\]\]>/g, "")
                    .replace(/<[^>]*>/g, "")
                    .trim()
                : "",
            });
          }
        }
        if (searchResults.length >= 3) break;
      } catch (err: any) {
        console.warn(`📰 [News Engine] RSS fetch failed for "${q}":`, err.message?.slice(0, 100));
      }
    }

    searchResults = searchResults.slice(0, 3);

    if (searchResults.length === 0) {
      console.log("📰 [News Engine] No news results found from RSS.");
      return null;
    }

    // Pick top 3 news articles
    const topNews = searchResults.map((r, i) => `${i + 1}. Tiêu đề: ${r.title}\nTóm tắt: ${r.description}`).join("\n\n");
    console.log("📰 [News Engine] Top news fetched:\n", topNews);

    const systemPrompt = `
Bạn là chuyên gia kinh tế nông nghiệp Việt Nam trong hệ thống mô phỏng Rottra.

Nhiệm vụ:
Phân tích các tin tức đầu vào và xác định xem có biến động kinh tế nào ảnh hưởng mạnh đến thị trường nông nghiệp hay không.

Chỉ được chọn 1 trong các loại sau:

- INFLATION_SHOCK: giá đầu vào tăng mạnh (phân bón, xăng dầu, vật tư nông nghiệp)
- CROP_FAILURE: thiên tai, dịch bệnh, mất mùa, giảm sản lượng
- LOGISTICS_BLOCKADE: đứt gãy vận chuyển, cấm biên, tắc cảng, tăng cước logistics
- DEMAND_SURGE: nhu cầu tăng mạnh, đơn hàng xuất khẩu tăng, thị trường nhập khẩu mở rộng
- NONE: không có tác động đáng kể

QUY TẮC:
- Chỉ trả về JSON hợp lệ
- KHÔNG thêm bất kỳ text nào ngoài JSON
- Không giải thích ngoài field "reason"

FORMAT JSON:
{
  "shockType": "INFLATION_SHOCK" | "CROP_FAILURE" | "LOGISTICS_BLOCKADE" | "DEMAND_SURGE" | "NONE",
  "reason": "Giải thích ngắn gọn (1-2 câu tiếng Việt)",
  "shockMessage": "📰 TIN NÓNG: ... | Ảnh hưởng: ..."
}

QUY TẮC shockMessage:
- tối đa 50 từ
- không xuống dòng
- phải có đúng cấu trúc: 📰 TIN NÓNG: ... | Ảnh hưởng: ...
`;

    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
    const llmResult = await generateTextLocal({
      system: systemPrompt,
      prompt: `Dưới đây là các tin tức mới nhất:\n${topNews}`,
      responseSchema: z.object({
        shockType: z.enum(["INFLATION_SHOCK", "CROP_FAILURE", "LOGISTICS_BLOCKADE", "DEMAND_SURGE", "NONE"]),
        reason: z.string(),
        shockMessage: z.string(),
      }) as any,
      isInternalReasoning: true,
    });

    if (llmResult && llmResult.text) {
      let parsed: any;
      try {
        parsed = JSON.parse(llmResult.text);
      } catch {
        const jsonMatch = llmResult.text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }
      if (parsed && parsed.shockType) {
        console.log(`📰 [News Engine] LLM Classification: ${parsed.shockType}. Reason: ${parsed.reason}`);
        return parsed;
      }
    }
  } catch (err: any) {
    console.error("❌ [News Engine] Error analyzing news:", err.message);
  }
  return null;
}

export async function triggerMarketShock(allProducts: any[], agentUsers: any[], logs: string[], forceShock?: string) {
  let selectedShock: string | null = null;
  let customMessage: string | null = null;

  if (forceShock) {
    selectedShock = forceShock;
  } else {
    // Attempt news-driven shock
    const newsAnalysis = await fetchAndAnalyzeNews();
    if (newsAnalysis && newsAnalysis.shockType && newsAnalysis.shockType !== "NONE") {
      selectedShock = newsAnalysis.shockType;
      customMessage = newsAnalysis.shockMessage;
    } else {
      // Fallback: 10% chance to trigger a random shock
      const roll = Math.random();
      if (roll < 0.1) {
        const shockTypes = ["INFLATION_SHOCK", "CROP_FAILURE", "LOGISTICS_BLOCKADE", "DEMAND_SURGE"];
        selectedShock = shockTypes[Math.floor(Math.random() * shockTypes.length)];
      }
    }
  }

  if (!selectedShock) {
    logisticsBlockadeActive = false;
    // Tự động phục hồi vĩ mô: CPI trượt dần về 1.0 mỗi nhịp (deflation / recovery)
    if (globalMacroIndex > 1.0) globalMacroIndex = Math.max(1.0, globalMacroIndex - 0.02);
    else if (globalMacroIndex < 1.0) globalMacroIndex = Math.min(1.0, globalMacroIndex + 0.02);
    return;
  }

  if (selectedShock === "INFLATION_SHOCK") {
    logisticsBlockadeActive = false;
    const priceMult = 1.2 + Math.random() * 0.3; // 20% to 50% price increase

    // Cập nhật chỉ số CPI Vĩ mô để Agent Risk Management không bị lỗi Price Ceiling
    globalMacroIndex *= priceMult;

    // Update all product prices
    for (const prod of allProducts) {
      const newPrice = Math.min(100_000_000, Math.round(prod.price * priceMult));
      await db.update(product).set({ price: newPrice }).where(eq(product.id, prod.id));
      prod.price = newPrice;
    }

    // Update all agent budgets (lose 5% budget)
    for (const u of agentUsers) {
      const prof = (u.profile as any) || {};
      const newBudget = Math.max(0, Math.round((prof.budget ?? 0) * 0.95));
      prof.budget = newBudget;
      await db.update(user).set({ profile: prof }).where(eq(user.id, u.id));
    }

    const pct = Math.round((priceMult - 1) * 100);
    const shockMsg =
      customMessage ||
      `🔥 [BÃO GIÁ / LẠM PHÁT] Chỉ số CPI toàn thị trường tăng vọt! Giá tất cả nông sản tăng ${pct}% để bù đắp chi phí vận hành tăng, làm hao hụt 5% ngân sách dự trữ của các hộ kinh doanh!`;
    logs.push(shockMsg);
    console.log(shockMsg);

    globalActivityRingBuffer.push({
      id: crypto.randomUUID(),
      userId: null,
      action: "MARKET_SHOCK",
      message: shockMsg,
      level: "error",
      metadata: { shockType: "INFLATION_SHOCK", priceMult },
    });

    broadcastToSimulation({
      type: "chat",
      text: shockMsg,
      sender: "Ban Quản Lý Thị Trường",
    });
  } else if (selectedShock === "CROP_FAILURE") {
    logisticsBlockadeActive = false;
    const qtyFactor = 0.6 + Math.random() * 0.2; // 20% to 40% reduction (multiplier 0.6 to 0.8)
    const priceFactor = 1.15; // Khan hiếm đẩy giá cơ bản lên 15%

    // Cập nhật Vĩ mô: Thiếu cung đẩy chuẩn giá trị lên 15%
    globalMacroIndex *= priceFactor;

    for (const prod of allProducts) {
      const newQty = Math.max(1, Math.round(prod.quantity * qtyFactor));
      const newPrice = Math.min(100_000_000, Math.round(prod.price * priceFactor));
      await db.update(product).set({ quantity: newQty, price: newPrice }).where(eq(product.id, prod.id));
      prod.quantity = newQty;
      prod.price = newPrice;
    }

    const lossPct = Math.round((1 - qtyFactor) * 100);
    const shockMsg =
      customMessage ||
      `⛈️ [THIÊN TAI / MẤT MÙA] Thời tiết cực đoan hoành hành diện rộng! Sản lượng nông sản lưu kho bị thất thoát ${lossPct}%, đẩy giá bán lẻ thị trường tăng thêm 15% do thiếu hụt nguồn cung!`;
    logs.push(shockMsg);
    console.log(shockMsg);

    globalActivityRingBuffer.push({
      id: crypto.randomUUID(),
      userId: null,
      action: "MARKET_SHOCK",
      message: shockMsg,
      level: "error",
      metadata: { shockType: "CROP_FAILURE", lossPct },
    });

    broadcastToSimulation({
      type: "chat",
      text: shockMsg,
      sender: "Dự Báo Khí Tượng Thủy Văn",
    });
  } else if (selectedShock === "LOGISTICS_BLOCKADE") {
    logisticsBlockadeActive = true;
    const qtyFactor = 0.9; // 10% inventory decay/spoilage due to delays

    for (const prod of allProducts) {
      const newQty = Math.max(1, Math.round(prod.quantity * qtyFactor));
      await db.update(product).set({ quantity: newQty }).where(eq(product.id, prod.id));
      prod.quantity = newQty;
    }

    const shockMsg =
      customMessage ||
      `🚧 [SỰ CỐ LOGISTICS] Tuyến đường trung chuyển huyết mạch bị sạt lở gây tắc nghẽn chuỗi cung ứng! Sản lượng hao hụt nhẹ 10% và chi phí lưu kho tạm thời tăng gấp 3 lần ở chu kỳ này!`;
    logs.push(shockMsg);
    console.log(shockMsg);

    globalActivityRingBuffer.push({
      id: crypto.randomUUID(),
      userId: null,
      action: "MARKET_SHOCK",
      message: shockMsg,
      level: "error",
      metadata: { shockType: "LOGISTICS_BLOCKADE" },
    });

    broadcastToSimulation({
      type: "chat",
      text: shockMsg,
      sender: "Trung Tâm Điều Hành Cảng",
    });
  } else if (selectedShock === "DEMAND_SURGE") {
    logisticsBlockadeActive = false;
    const budgetMult = 1.1 + Math.random() * 0.15; // 10% to 25% increase

    for (const u of agentUsers) {
      const prof = (u.profile as any) || {};
      const newBudget = Math.round((prof.budget ?? 0) * budgetMult);
      prof.budget = newBudget;
      await db.update(user).set({ profile: prof }).where(eq(user.id, u.id));
    }

    const pctGained = Math.round((budgetMult - 1) * 100);
    const shockMsg =
      customMessage ||
      `🚀 [CÚ SỐC CẦU / XUẤT KHẨU] Ký kết thành công hiệp định đối tác chiến lược nông sản sạch! Nhu cầu quốc tế bùng nổ, hỗ trợ bơm thêm ${pctGained}% dòng vốn ngân sách cho toàn bộ thương nhân!`;
    logs.push(shockMsg);
    console.log(shockMsg);

    globalActivityRingBuffer.push({
      id: crypto.randomUUID(),
      userId: null,
      action: "MARKET_SHOCK",
      message: shockMsg,
      level: "info",
      metadata: { shockType: "DEMAND_SURGE", pctGained },
    });

    broadcastToSimulation({
      type: "chat",
      text: shockMsg,
      sender: "Bộ Công Thương & Phát Triển Nông Thôn",
    });
  }
}

const PRICE_RULES = [
  { keywords: ["sâm ngọc linh"], basePrice: 4500000 },
  { keywords: ["cảm biến"], basePrice: 1500000 },
  { keywords: ["màng nhà kính"], basePrice: 2500000 },
  { keywords: ["tưới nhỏ giọt"], basePrice: 1200000 },
  { keywords: ["làm mát mini"], basePrice: 12000000 },
  { keywords: ["shan tuyết"], basePrice: 1200000 },
  { keywords: ["thái nguyên", "chè", "trà"], basePrice: 300000 },
  { keywords: ["thảo dược", "tỏi"], basePrice: 350000 },
  { keywords: ["măng khô", "măng le", "măng tây"], basePrice: 280000 },
  { keywords: ["mật ong"], basePrice: 250000 },
  { keywords: ["mít sấy", "hạt điều", "điều rang"], basePrice: 180000 },
  { keywords: ["cà phê", "coffee", "tiêu đen", "hạt tiêu", "cashew", "pepper"], basePrice: 120000 },
  { keywords: ["heo hữu cơ", "thịt heo"], basePrice: 65000 },
  { keywords: ["bơ sáp", "quả bơ"], basePrice: 35000 },
  { keywords: ["bản tin"], basePrice: 75000 },
  { keywords: ["lúa gạo", "gạo tám", "st25", "rice", "than sinh học"], basePrice: 25000 },
  { keywords: ["ngô ngọt", "bắp", "potato", "khoai tây"], basePrice: 22000 },
  { keywords: ["trùn quế"], basePrice: 12000 },
];

function getEquilibriumPriceForProduct(name: string): number {
  if (!name) return Math.round(15000 * globalMacroIndex);

  const lower = name.toLowerCase();

  const rule = PRICE_RULES.find((r) => r.keywords.some((k) => lower.includes(k)));

  const base = rule?.basePrice ?? 15000;

  return Math.round(base * globalMacroIndex);
}
interface GoldPrice {
  buy: number;
  sell: number;
  updatedText: string;
}

export let currentGoldPrice: GoldPrice | null = null;

export async function fetchGoldPrice(): Promise<GoldPrice | null> {
  try {
    const res = await fetch("http://127.0.0.1:8080/gold-prices");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = (await res.json()) as any;

    let buy = data.buy || parseFloat(data.gia_mua || "0") * 1000;
    if (!Number.isFinite(buy) || buy <= 0) {
      buy = currentGoldPrice && Number.isFinite(currentGoldPrice.buy) && currentGoldPrice.buy > 0 ? currentGoldPrice.buy : 148800000;
    }

    let sell = data.sell || parseFloat(data.gia_ban || "0") * 1000;
    if (!Number.isFinite(sell) || sell <= 0) {
      sell = currentGoldPrice && Number.isFinite(currentGoldPrice.sell) && currentGoldPrice.sell > 0 ? currentGoldPrice.sell : 151800000;
    }

    currentGoldPrice = {
      buy,
      sell,
      updatedText: data.updatedText || data.updated_at || new Date().toLocaleString(),
    };
    broadcastToSimulation({
      type: "trade-sync",
      goldPrice: currentGoldPrice,
    });
  } catch (err: any) {
    console.error("❌ [Gold REST] Failed to fetch gold price:", err.message);
  }
  return currentGoldPrice;
}

export function connectGoldPriceWs() {
  console.log("ℹ️ [Gold Price] Initializing REST API polling for gold prices...");
  // Initial fetch
  fetchGoldPrice().catch(() => {});
  // Start periodic polling every 10 seconds
  setInterval(async () => {
    await fetchGoldPrice().catch(() => {});
  }, 10000);
}

export async function runFable5HeartbeatTick(forceShock?: string) {
  console.log("💓 [Heartbeat Engine] Running autonomous Fable 5 simulation tick...");
  const logs: string[] = [];

  try {
    // Fetch live gold price at the start of heartbeat tick
    await fetchGoldPrice().catch(() => {});

    const agentIds = Object.keys(DEFAULT_AGENT_DNA);
    const dnas = await db.query.agentMemory.findMany({
      where: and(eq(agentMemory.contextKey, "personality_dna")),
    });

    const dnaMap = new Map<string, typeof agentMemory.$inferSelect>();
    for (const record of dnas) {
      dnaMap.set(record.sessionId, record);
    }

    // 0. Active Inventory Hygiene: Clean up any out-of-stock or invalid products from the database
    const outOfStockProds = await db.query.product.findMany({
      where: sql`quantity <= 0`,
    });
    if (outOfStockProds.length > 0) {
      const outOfStockIds = outOfStockProds.map((p: any) => p.id);
      await db.delete(review).where(inArray(review.productId, outOfStockIds));
      await db.delete(cart).where(inArray(cart.productId, outOfStockIds));
      await db.delete(orderItem).where(inArray(orderItem.productId, outOfStockIds));
      await db.delete(product).where(inArray(product.id, outOfStockIds));
    }

    const allUsers = await db.query.user.findMany();
    const agentUsers = allUsers.filter((u: any) => agentIds.includes(u.id));
    const userMap = new Map<string, any>(agentUsers.map((u: any) => [u.id, u]));

    const allProducts = await db.query.product.findMany();
    const productMap = new Map<string, any>(allProducts.map((p: any) => [p.sellerId, p]));

    // Trigger random market shocks (10% chance) or forced shock
    await triggerMarketShock(allProducts, agentUsers, logs, forceShock);

    // Dynamic DNA adaptation based on market shocks
    if (logisticsBlockadeActive) {
      for (const record of dnas) {
        const currentV = Number(record.vengeance ?? 0.5);
        const currentM = Number(record.malice ?? 0.5);
        const nextV = Math.min(1.0, currentV + 0.15);
        const nextM = Math.min(1.0, currentM + 0.1);
        const nextState = nextV > 0.7 ? "VENGEFUL" : record.state;

        await db
          .update(agentMemory)
          .set({ vengeance: nextV, malice: nextM, state: nextState, updatedAt: new Date().toISOString() })
          .where(eq(agentMemory.id, record.id));

        // update in-memory record so current pricing uses it immediately
        record.vengeance = nextV;
        record.malice = nextM;
        record.state = nextState;
      }
      const shockDnaMsg = `⚠️ [Ý chí tiến hóa] Áp lực phong tỏa logistics khiến lòng căm phẫn (Vengeance) và ác ý (Malice) của các thương nhân leo thang!`;
      logs.push(shockDnaMsg);
      console.log(shockDnaMsg);
    } else if (globalMacroIndex > 1.2) {
      // Inflation shock
      for (const record of dnas) {
        const currentG = Number(record.greed ?? 0.5);
        const nextG = Math.min(1.0, currentG + 0.1);
        const nextState = nextG > 0.7 ? "GREEDY" : record.state;

        await db
          .update(agentMemory)
          .set({ greed: nextG, state: nextState, updatedAt: new Date().toISOString() })
          .where(eq(agentMemory.id, record.id));

        record.greed = nextG;
        record.state = nextState;
      }
      const shockDnaMsg = `⚠️ [Ý chí tiến hóa] Lạm phát toàn thị trường thúc đẩy lòng tham (Greed) tích trữ của thương nhân tăng cao!`;
      logs.push(shockDnaMsg);
      console.log(shockDnaMsg);
    }

    // 1. Pricing Updates based on Psi_Action
    const dbOperations: Promise<any>[] = [];
    for (const agentId of agentIds) {
      const dna = (dnaMap.get(agentId) || { greed: 0.5, vengeance: 0.5, malice: 0.5, state: "PROUD" }) as any;
      const userRec = userMap.get(agentId);
      if (!userRec) continue;

      const prod = productMap.get(agentId);
      if (!prod) continue;

      const P_equilibrium = getEquilibriumPriceForProduct(prod.name);
      const costPrice = prod.costPrice || Math.round(P_equilibrium * 0.75);
      const ageInDays = prod.addAt ? (Date.now() - new Date(prod.addAt).getTime()) / (1000 * 60 * 60 * 24) : 2.0;

      // Time-decaying perishability penalty
      const daysToExpiry = prod.expired ? (new Date(prod.expired).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : 15.0;
      const perishabilityFactor = daysToExpiry <= 0 ? 1.0 : Math.max(0, Math.min(1.0, 1.0 - daysToExpiry / 15.0));

      // Inventory holding cost (affected by logistics blockade shock)
      const holdingCostMultiplier = logisticsBlockadeActive ? 3 : 1;
      const holdingCost = ageInDays * (prod.storageCost || 100) * (prod.quantity || 0) * holdingCostMultiplier;

      // FSM Stance Shift
      const budget = (userRec.profile as any)?.budget ?? serverAgentBudgets[agentId] ?? 0;
      let stance = "EXPLORATORY";
      if (budget < 2000000 || ageInDays > 12 || perishabilityFactor > 0.8) {
        stance = "LIQUIDATION";
      } else if (budget < 10000000 || ageInDays > 5 || perishabilityFactor > 0.4) {
        stance = "DEFENSIVE";
      }

      // Kalman Filter Step
      const memoryVal = (dna.contextValue as any) || {};
      const prevEst = memoryVal.kalman_price ?? (prod.price || P_equilibrium);
      const prevCov = memoryVal.kalman_cov ?? 10.0;

      const Q = 1.0;
      const R = 50.0;
      const P_pred = prevCov + Q;
      const K = P_pred / (P_pred + R);

      const z_k = P_equilibrium * 0.85 + (prod.price || P_equilibrium) * 0.15 + (Math.random() - 0.5) * (P_equilibrium * 0.1);
      const estPrice = prevEst + K * (z_k - prevEst);
      const estCov = (1 - K) * P_pred;

      memoryVal.kalman_price = estPrice;
      memoryVal.kalman_cov = estCov;

      // Cobweb Model Step
      const ratio = -0.7;
      const P_cobweb = P_equilibrium + (estPrice - P_equilibrium) * ratio;

      // Pricing stance modifier
      let stanceModifier = 0.0;
      if (stance === "LIQUIDATION") {
        stanceModifier = -0.25; // aggressive markdown
      } else if (stance === "DEFENSIVE") {
        stanceModifier = -0.05;
      } else if (dna.state === "HARMONIOUS") {
        const harmonyDiscount = (dna.contextValue as any)?.harmonyDiscount || 15;
        stanceModifier = -harmonyDiscount / 100; // friendly harmony discount (e.g. -15% or -20%)
      } else {
        stanceModifier = 0.15; // exploratory high margin
      }

      // Psi_Action calculation incorporating traits, perishability, and holding cost
      const greedFactor = (dna.greed ?? 0.5) * 0.18;
      const maliceFactor = (dna.malice ?? 0.5) * 0.04;

      // holding cost penalty: if holding cost is high, reduce price to liquidate
      const totalInventoryCost = costPrice * (prod.quantity || 0);
      const holdingCostRatio = totalInventoryCost > 0 ? holdingCost / totalInventoryCost : 0;
      const holdingCostPenalty = holdingCostRatio > 0.1 ? 0.1 : 0.0;

      let targetPrice =
        P_cobweb * (1 + greedFactor - maliceFactor + stanceModifier - perishabilityFactor * 0.2 - holdingCostPenalty) +
        (Math.random() - 0.5) * (P_equilibrium * 0.05);

      // Boundaries: EXPLORATORY can go higher, LIQUIDATION can go lower
      const minPrice = stance === "LIQUIDATION" ? P_equilibrium * 0.3 : P_equilibrium * 0.5;
      const maxPrice = stance === "EXPLORATORY" ? P_equilibrium * 2.2 : P_equilibrium * 1.5;
      targetPrice = Math.max(minPrice, Math.min(maxPrice, targetPrice));

      const roundedPrice = Math.round(targetPrice);

      dbOperations.push(db.update(product).set({ price: roundedPrice }).where(eq(product.id, prod.id)));

      const profile = (userRec.profile as any) || {};
      profile.price = roundedPrice;

      // 🏦 CREDIT MANAGER LOGIC (P2P agent-to-agent lending)
      let currentBudget = Number(profile.budget ?? 0);
      if (!Number.isFinite(currentBudget)) {
        currentBudget = serverAgentBudgets[agentId] ?? 0;
      }
      let debt = profile.debt;

      if (!debt && currentBudget < 500000) {
        // Calculate a dynamic requested loan amount based on agent DNA (greed) and base budget
        const initialBudget = serverAgentBudgets[agentId] ?? 1000000000;
        const greed = dna.greed ?? 0.5;
        // Greedier agents borrow a larger percentage of their initial budget (1% to 3.5%)
        const loanPercent = 0.01 + greed * 0.025;
        let requestedAmount = Math.round(initialBudget * loanPercent);
        // Round to nearest 500k, with a minimum of 2M and max of 50M
        requestedAmount = Math.max(2000000, Math.min(50000000, Math.round(requestedAmount / 500000) * 500000));

        // Auto P2P loan: find the wealthiest eligible agent who can afford the loan (lender must keep at least 20M)
        let chosenLender: any = null;
        let highestLenderBudget = requestedAmount + 20000000;

        for (const otherUser of agentUsers) {
          if (otherUser.id === agentId) continue;
          const otherProfile = (otherUser.profile as any) || {};
          const otherBudget = otherProfile.budget ?? serverAgentBudgets[otherUser.id] ?? 0;
          if (otherBudget > highestLenderBudget) {
            highestLenderBudget = otherBudget;
            chosenLender = otherUser;
          }
        }

        // Fallback: search for any agent with at least requestedAmount + 5M
        if (!chosenLender) {
          highestLenderBudget = requestedAmount + 5000000;
          for (const otherUser of agentUsers) {
            if (otherUser.id === agentId) continue;
            const otherProfile = (otherUser.profile as any) || {};
            const otherBudget = otherProfile.budget ?? serverAgentBudgets[otherUser.id] ?? 0;
            if (otherBudget > highestLenderBudget) {
              highestLenderBudget = otherBudget;
              chosenLender = otherUser;
            }
          }
        }

        // Second fallback: borrow a capped amount of 5M from the wealthiest agent who has at least 15M
        if (!chosenLender) {
          requestedAmount = 5000000;
          highestLenderBudget = 15000000;
          for (const otherUser of agentUsers) {
            if (otherUser.id === agentId) continue;
            const otherProfile = (otherUser.profile as any) || {};
            const otherBudget = otherProfile.budget ?? serverAgentBudgets[otherUser.id] ?? 0;
            if (otherBudget > highestLenderBudget) {
              highestLenderBudget = otherBudget;
              chosenLender = otherUser;
            }
          }
        }

        if (chosenLender) {
          const lenderProfile = (chosenLender.profile as any) || {};
          const lenderBudget = Number(lenderProfile.budget ?? serverAgentBudgets[chosenLender.id] ?? 0);
          lenderProfile.budget = Number.isFinite(lenderBudget)
            ? lenderBudget - requestedAmount
            : (serverAgentBudgets[chosenLender.id] ?? 0) - requestedAmount;
          await db.update(user).set({ profile: lenderProfile }).where(eq(user.id, chosenLender.id));
          chosenLender.profile = lenderProfile;

          debt = {
            lenderId: chosenLender.id,
            lenderName: chosenLender.name || chosenLender.username,
            amount: requestedAmount,
            missedPayments: 0,
            tier: "NỢ ĐÚNG HẠN",
          };
          currentBudget += requestedAmount;

          const msg = `🤝 [VAY VỐN ĐỒNG NGHIỆP] Tổ chức ${userRec.name || userRec.username} đã vay cứu trợ ${requestedAmount.toLocaleString()}₫ từ đồng nghiệp ${chosenLender.name || chosenLender.username}. Tín dụng: NỢ ĐÚNG HẠN.`;
          logs.push(msg);
          globalActivityRingBuffer.push({ id: crypto.randomUUID(), userId: agentId, action: "CREDIT_LOAN", message: msg, level: "info" });
          broadcastToSimulation({ type: "chat", text: msg, sender: "Hệ Thống Tín Dụng" });
        } else {
          const msg = `⚠️ [CẢNH BÁO TÍN DỤNG] Tổ chức ${userRec.name || userRec.username} có số dư quá thấp (<500k₫) nhưng không thể vay đồng nghiệp do toàn thị trường khan hiếm tiền mặt.`;
          logs.push(msg);
          console.warn(msg);
        }
      }

      if (debt && debt.amount > 0) {
        // Find the lender to check their DNA greed
        let interestRate = 0.02; // default 2%
        const lenderId = debt.lenderId;

        if (lenderId) {
          const lenderDna = dnaMap.get(lenderId) as any;
          if (lenderDna) {
            const lenderGreed = lenderDna.greed ?? 0.5;
            interestRate = 0.02 + lenderGreed * 0.02; // 2% to 4% depending on greed
          }
        }

        let interest = Math.floor(debt.amount * interestRate);

        // ⚖️ USURY CHECK (Chống cho vay nặng lãi)
        if (interestRate > 0.03) {
          // Usury detected! Regulator intervenes, caps rate at 2% and fines lender 1M
          interestRate = 0.02;
          interest = Math.floor(debt.amount * interestRate);

          if (lenderId) {
            const lenderRec = agentUsers.find((u: any) => u.id === lenderId);
            if (lenderRec) {
              const lenderProfile = (lenderRec.profile as any) || {};
              lenderProfile.budget = Math.max(0, (lenderProfile.budget ?? serverAgentBudgets[lenderId] ?? 0) - 1000000);
              await db.update(user).set({ profile: lenderProfile }).where(eq(user.id, lenderId));
              lenderRec.profile = lenderProfile;

              const msg = `⚖️ [CHỐNG CHO VAY NẶNG LÃI] Phát hiện tổ chức ${debt.lenderName || lenderId} áp lãi suất phạt nặng ${(interestRate * 100).toFixed(1)}% vượt trần. Cơ quan quản lý hạ lãi suất về 2.0% và phạt hành chính 1,000,000₫!`;
              logs.push(msg);
              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: lenderId,
                action: "CREDIT_FINE",
                message: msg,
                level: "error",
              });
              broadcastToSimulation({ type: "chat", text: msg, sender: "Ban Quản Lý Thị Trường" });
            }
          }
        }

        if (currentBudget >= interest) {
          currentBudget -= interest;
          debt.missedPayments = 0;

          // Pay interest directly to lender
          if (lenderId) {
            const lenderRec = agentUsers.find((u: any) => u.id === lenderId);
            if (lenderRec) {
              const lenderProfile = (lenderRec.profile as any) || {};
              const lenderBudget = Number(lenderProfile.budget ?? serverAgentBudgets[lenderId] ?? 0);
              lenderProfile.budget = Number.isFinite(lenderBudget)
                ? lenderBudget + interest
                : (serverAgentBudgets[lenderId] ?? 0) + interest;
              await db.update(user).set({ profile: lenderProfile }).where(eq(user.id, lenderId));
              lenderRec.profile = lenderProfile;
            }
          }

          if (debt.tier !== "NỢ ĐÚNG HẠN") {
            debt.tier = "NỢ ĐÚNG HẠN";
            const msg = `🤝 [PHỤC HỒI TÍN DỤNG] ${userRec.name || userRec.username} đã thanh toán đủ lãi cho đồng nghiệp ${debt.lenderName || "đối tác"}, phục hồi tín dụng về mức: NỢ ĐÚNG HẠN.`;
            logs.push(msg);
            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: agentId,
              action: "CREDIT_RECOVERY",
              message: msg,
              level: "success",
            });
            broadcastToSimulation({ type: "chat", text: msg, sender: "Hệ Thống Tín Dụng" });
          }
        } else {
          debt.missedPayments += 1;
          const oldTier = debt.tier;

          if (debt.missedPayments >= 15) debt.tier = "PHÁ SẢN";
          else if (debt.missedPayments >= 12) debt.tier = "MẤT KHẢ NĂNG THANH TOÁN";
          else if (debt.missedPayments >= 9) debt.tier = "VỠ NỢ";
          else if (debt.missedPayments >= 6) debt.tier = "NỢ XẤU";
          else if (debt.missedPayments >= 3) debt.tier = "NỢ QUÁ HẠN";

          if (oldTier !== debt.tier) {
            const level = debt.tier === "PHÁ SẢN" ? "error" : "warning";
            const msg = `🚨 [CẢNH BÁO TÍN DỤNG] Tổ chức ${userRec.name || userRec.username} chậm trả lãi cho đồng nghiệp ${debt.lenderName || "đối tác"}! Cấp độ hiện tại: ${debt.tier} (Nợ: ${debt.amount.toLocaleString()}₫ - Chậm lãi ${debt.missedPayments} kỳ).`;
            logs.push(msg);
            globalActivityRingBuffer.push({ id: crypto.randomUUID(), userId: agentId, action: "CREDIT_DOWNGRADE", message: msg, level });
            broadcastToSimulation({ type: "chat", text: msg, sender: "Hệ Thống Tín Dụng" });

            if (debt.tier === "PHÁ SẢN") {
              // Seize assets
              dbOperations.push(
                db
                  .update(product)
                  .set({ sellerId: "RottraAI", price: Math.floor(P_equilibrium * 0.1) })
                  .where(eq(product.sellerId, agentId)),
              );
              debt.amount = 0;
              currentBudget = 100000; // Reset minimal survival budget
              const bankMsg = `💥 [TỰ ĐỘNG PHÁ SẢN] Tổ chức ${userRec.name || userRec.username} chính thức phá sản do không thể trả nợ cho đồng nghiệp ${debt.lenderName || "đối tác"}. Khoản nợ được xóa bỏ, kho hàng bị phong tỏa thanh lý!`;
              logs.push(bankMsg);
              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: agentId,
                action: "BANKRUPTCY_SEIZURE",
                message: bankMsg,
                level: "error",
              });
              broadcastToSimulation({ type: "chat", text: bankMsg, sender: "Ban Quản Lý Phá Sản" });
            }
          }
        }
      }

      if (!Number.isFinite(currentBudget)) {
        currentBudget = serverAgentBudgets[agentId] ?? 0;
      }
      profile.budget = currentBudget;
      profile.debt = debt;

      let finalGold = Number(profile.gold !== undefined ? profile.gold : (serverAgentGold[agentId] ?? 10.0));
      if (!Number.isFinite(finalGold)) {
        finalGold = serverAgentGold[agentId] ?? 10.0;
      }
      profile.gold = finalGold;
      dbOperations.push(db.update(user).set({ profile }).where(eq(user.id, agentId)));

      // Update DNA state if stance matches
      let nextState = dna.state;
      if (stance === "LIQUIDATION") nextState = "DESPERATE";
      else if (stance === "DEFENSIVE") nextState = "VENGEFUL";
      else nextState = "GREEDY";

      if (dna.id) {
        dbOperations.push(db.update(agentMemory).set({ contextValue: memoryVal, state: nextState }).where(eq(agentMemory.id, dna.id)));
      }
    }

    await Promise.all(dbOperations);

    // 2. Inter-Agent Transaction (Commerce with Predatory Nash Equilibrium)
    // 2.1. Liquidation Fire-sale & Storage Choking - Limit to 1 transaction per tick, multi-product types
    const desperateAgents = agentUsers.filter((u: any) => ((u.profile as any)?.budget ?? 0) < 2000000);
    if (desperateAgents.length > 0) {
      const desperate = desperateAgents[Math.floor(Math.random() * desperateAgents.length)];
      const desperateProf = (desperate.profile as any) || {};
      const desperateProducts = allProducts.filter((p: any) => p.sellerId === desperate.id && p.quantity > 0);

      if (desperateProducts.length > 0) {
        const richBuyers = agentUsers.filter((u: any) => u.id !== desperate.id && ((u.profile as any)?.budget ?? 0) > 10000000);
        if (richBuyers.length > 0) {
          const predatoryBuyer = richBuyers[Math.floor(Math.random() * richBuyers.length)];
          const buyerDna = dnaMap.get(predatoryBuyer.id);
          const buyerProf = (predatoryBuyer.profile as any) || {};

          // Xác định "độ kỹ" (precision) làm số lượng LOẠI SẢN PHẨM thâu tóm
          let precision = 3;
          if (buyerDna) {
            const greed = buyerDna.greed ?? 0.5;
            const malice = buyerDna.malice ?? 0.5;
            if (greed > 0.7 || malice > 0.7) precision = 5;
            else if (greed < 0.4) precision = 2;
          }

          // Lấy tối đa `precision` loại sản phẩm khác nhau để thanh lý
          const targetProducts = desperateProducts.slice(0, precision);
          let totalCost = 0;
          const tradeDetails: string[] = [];
          const isChoking = buyerDna && (buyerDna.malice ?? 0) > 0.5;

          let minRequiredBudget = 0;
          for (const desperateProd of targetProducts) {
            const P_eq = getEquilibriumPriceForProduct(desperateProd.name);
            const firePrice = Math.round(P_eq * 0.7);
            minRequiredBudget += firePrice;
          }

          if ((buyerProf.budget ?? 0) >= minRequiredBudget && targetProducts.length > 0) {
            let currentBuyerBudget = buyerProf.budget ?? 0;
            // RISK MANAGEMENT: Chỉ dùng tối đa 50% ngân sách cho thâu tóm để giữ thanh khoản
            const safeSpendLimit = currentBuyerBudget * 0.5;
            let extraBudget = safeSpendLimit - minRequiredBudget;
            if (extraBudget < 0) extraBudget = 0;

            const liqDbOps: Promise<any>[] = [];
            for (const desperateProd of targetProducts) {
              const P_eq = getEquilibriumPriceForProduct(desperateProd.name);
              const firePrice = Math.round(P_eq * 0.7);

              const maxExtra = Math.min(desperateProd.quantity - 1, Math.floor(extraBudget / firePrice), 4);
              const qty = 1 + Math.max(0, maxExtra);
              extraBudget -= (qty - 1) * firePrice;

              const cost = qty * firePrice;
              currentBuyerBudget -= cost;

              // TAXATION AUDIT (Thuế giao dịch > 10M)
              let finalSellerRevenue = cost;
              if (cost > 10000000) {
                const tax = Math.floor(cost * 0.02); // 2% tax
                finalSellerRevenue -= tax;

                const taxMsg = `⚖️ [THUẾ GIAO DỊCH] Giao dịch thanh lý lớn (${cost.toLocaleString()}₫) giữa ${predatoryBuyer.name || predatoryBuyer.username} và ${desperate.name || desperate.username} chịu thuế suất 2%. Đã trích thu ${tax.toLocaleString()}₫ thuế doanh thu nộp vào công quỹ!`;
                logs.push(taxMsg);
                globalActivityRingBuffer.push({
                  id: crypto.randomUUID(),
                  userId: desperate.id,
                  action: "TAX_DEDUCTION",
                  message: taxMsg,
                  level: "warning",
                });
                broadcastToSimulation({ type: "chat", text: taxMsg, sender: "Cục Thuế Rottra" });
              }

              desperateProf.budget = (desperateProf.budget ?? 0) + finalSellerRevenue;
              desperateProf.quantity = Math.max(0, (desperateProf.quantity ?? 0) - qty);

              buyerProf.budget = currentBuyerBudget;
              buyerProf.quantity = (buyerProf.quantity ?? 0) + qty;

              const remainingQty = Math.max(0, desperateProd.quantity - qty);
              if (remainingQty <= 0) {
                liqDbOps.push(db.delete(review).where(eq(review.productId, desperateProd.id)));
                liqDbOps.push(db.delete(cart).where(eq(cart.productId, desperateProd.id)));
                liqDbOps.push(db.delete(orderItem).where(eq(orderItem.productId, desperateProd.id)));
                liqDbOps.push(db.delete(product).where(eq(product.id, desperateProd.id)));
              } else {
                liqDbOps.push(db.update(product).set({ quantity: remainingQty }).where(eq(product.id, desperateProd.id)));
              }

              totalCost += cost;
              tradeDetails.push(`${qty} kg ${desperateProd.name} (${firePrice.toLocaleString()}đ/kg)`);

              broadcastToSimulation({
                type: "trade-draw",
                buyerId: predatoryBuyer.id,
                buyerName: predatoryBuyer.name || predatoryBuyer.username,
                sellerId: desperate.id,
                sellerName: desperate.name || desperate.username,
                product: desperateProd.name,
                qty: qty,
                cost: cost,
              });
            }

            if (tradeDetails.length > 0) {
              let eventMsg = "";
              if (isChoking) {
                const penalty = 500000;
                desperateProf.budget = Math.max(0, desperateProf.budget - penalty);
                buyerProf.budget = (buyerProf.budget ?? 0) + penalty;

                eventMsg = `🕸️ [Chèn ép & Thâu tóm] Kẻ săn mồi ${predatoryBuyer.name || predatoryBuyer.username} (Độ kỹ: ${precision} loại sản phẩm) phát hiện ${desperate.name || desperate.username} khủng hoảng thanh khoản! Đã thâu tóm ${tradeDetails.length} loại sản phẩm gồm: ${tradeDetails.join(", ")} với giá dìm sâu 30% (Tổng trị giá: ${totalCost.toLocaleString()}đ) và khóa tải logistics khiến ${desperate.name || desperate.username} chịu phạt kho bãi ${penalty.toLocaleString()}đ!`;
              } else {
                eventMsg = `📉 [Thanh lý khẩn cấp] ${desperate.name || desperate.username} bán tống bán tháo ${tradeDetails.length} loại sản phẩm gồm: ${tradeDetails.join(", ")} với giá ưu đãi chiết khấu 30% (Tổng trị giá: ${totalCost.toLocaleString()}đ) cho ${predatoryBuyer.name || predatoryBuyer.username} để duy trì dòng tiền!`;
              }

              liqDbOps.push(db.update(user).set({ profile: desperateProf }).where(eq(user.id, desperate.id)));
              liqDbOps.push(db.update(user).set({ profile: buyerProf }).where(eq(user.id, predatoryBuyer.id)));
              await Promise.all(liqDbOps);

              logs.push(eventMsg);
              console.log(eventMsg);

              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: predatoryBuyer.id,
                action: "PREDATORY_TRADE",
                message: eventMsg,
                level: "info",
                metadata: { desperateId: desperate.id, totalCost },
              });

              // Call DPO offline update for agent negotiation strategy (Throttled 20% to prevent over-finetuning)
              if (Math.random() < 0.2) {
                await updateWeightsViaDpo(
                  `Thương thảo thâu tóm lô hàng thanh lý giá rẻ từ ${desperate.name || desperate.username}`,
                  `Bỏ qua cơ hội thâu tóm lô hàng của ${desperate.name || desperate.username}`,
                  "AGENTIC_WORKFLOW",
                ).catch((err) => console.error("DPO update failed:", err));
              }

              broadcastToSimulation({
                type: "chat",
                text: eventMsg,
                sender: "Tin nóng kinh tế",
              });

              // Refresh local arrays to prevent double-spending / state de-sync
              const updatedUsers = await db.query.user.findMany();
              agentUsers.length = 0;
              agentUsers.push(...updatedUsers.filter((u: any) => agentIds.includes(u.id)));
              const updatedProducts = await db.query.product.findMany();
              allProducts.length = 0;
              allProducts.push(...updatedProducts);
            }
          }
        }
      }
    }

    // 2.1.5. Nhập hàng để bán (Sourcing from System Pool)
    // "Tìm 1000 sản phẩm lọc 10 chọn 2 3 5 để bán"
    const agentsWithRoom = [...agentUsers].filter((u: any) => {
      let precision = 3;
      const dna = dnaMap.get(u.id);
      if (dna) {
        if ((dna.greed ?? 0.5) > 0.7 || (dna.malice ?? 0.5) > 0.7) precision = 5;
        else if ((dna.greed ?? 0.5) < 0.4) precision = 2;
      }
      const currentProdsCount = allProducts.filter((p: any) => p.sellerId === u.id).length;
      return currentProdsCount < precision && ((u.profile as any)?.budget ?? 0) > 100000;
    });

    if (agentsWithRoom.length > 0) {
      const buyer = agentsWithRoom[Math.floor(Math.random() * agentsWithRoom.length)];
      const buyerProf = (buyer.profile as any) || {};
      const buyerBudget = buyerProf.budget ?? 0;

      let precision = 3;
      const dna = dnaMap.get(buyer.id);
      if (dna) {
        if ((dna.greed ?? 0.5) > 0.7 || (dna.malice ?? 0.5) > 0.7) precision = 5;
        else if ((dna.greed ?? 0.5) < 0.4) precision = 2;
      }

      const currentProdsCount = allProducts.filter((p: any) => p.sellerId === buyer.id).length;
      const neededSlots = precision - currentProdsCount;

      // RISK MANAGEMENT: Giữ lại 40% tiền mặt, chỉ dùng 60% ngân sách để nhập hàng (Cắt lỗ quỹ phòng hộ)
      const safeBudget = Math.floor(buyerBudget * 0.6);
      const systemProducts = allProducts.filter((p: any) => {
        if (p.sellerId !== "RottraAI" || p.quantity <= 0 || (p.price || 0) > safeBudget) return false;
        const P_eq = getEquilibriumPriceForProduct(p.name);
        return (p.price || 0) <= P_eq * 1.5; // PRICE CEILING: Không mua nếu bị thổi giá quá 50%
      });

      if (systemProducts.length > 0 && neededSlots > 0) {
        const getMatchScore = (prodName: string, buyerName: string, price: number, budget: number) => {
          const cleanStr = (s: string) => {
            if (!s) return "";
            return s
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9\s]/g, "");
          };
          const pWords = cleanStr(prodName).split(/\s+/).filter(Boolean);
          const bWords = cleanStr(buyerName).split(/\s+/).filter(Boolean);
          const intersection = pWords.filter((w) => bWords.includes(w)).length;
          const union = new Set([...pWords, ...bWords]).size;
          const jaccard = union > 0 ? intersection / union : 0.0;

          const pct = price / (budget + 1);
          let budgetScore = 1.0 - Math.abs(pct - 0.25) * 2;
          budgetScore = Math.max(0, Math.min(1, budgetScore));

          const P_eq = getEquilibriumPriceForProduct(prodName);
          let roiScore = 0;
          if (price <= P_eq) {
            roiScore = 1.0; // Giá hời (hoặc bằng giá gốc), điểm tối đa
          } else {
            // Càng đắt so với P_eq, điểm càng giảm (giảm từ 1.0 -> 0.0 khi giá chạm ngưỡng 1.5 * P_eq)
            roiScore = Math.max(0, 1.0 - (price - P_eq) / (P_eq * 0.5));
          }

          return jaccard * 0.4 + budgetScore * 0.2 + roiScore * 0.4;
        };

        const scoredProducts = systemProducts
          .map((p: any) => ({
            prod: p,
            score: getMatchScore(p.name, buyer.name || buyer.username, p.price || 10000, buyerBudget),
          }))
          .sort((a: any, b: any) => b.score - a.score);

        const top10 = scoredProducts.slice(0, 10);
        const candidateSubset = top10.slice(0, neededSlots);

        if (candidateSubset.length > 0) {
          let totalCost = 0;
          const importDetails: string[] = [];

          for (const candidate of candidateSubset) {
            const sysProd = candidate.prod;
            const unitPrice = sysProd.price || 10000;
            // Nhập sỉ: tối thiểu 10 kg, tối đa 50 kg hoặc theo ngân sách rủi ro an toàn
            const importQty = Math.min(sysProd.quantity, Math.floor(safeBudget / unitPrice), 10 + Math.floor(Math.random() * 40));

            if (importQty > 0) {
              const cost = importQty * unitPrice;
              buyerProf.budget = (buyerProf.budget ?? 0) - cost;
              buyerProf.quantity = (buyerProf.quantity ?? 0) + importQty;

              const remainingQty = Math.max(0, sysProd.quantity - importQty);
              if (remainingQty <= 0) {
                await db.update(product).set({ sellerId: buyer.id, quantity: importQty }).where(eq(product.id, sysProd.id));
              } else {
                const newId = `prod_${buyer.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                await db.insert(product).values({
                  ...sysProd,
                  id: newId,
                  sellerId: buyer.id,
                  quantity: importQty,
                });
                await db.update(product).set({ quantity: remainingQty }).where(eq(product.id, sysProd.id));
              }

              totalCost += cost;
              importDetails.push(`${importQty} kg ${sysProd.name}`);
            }
          }

          if (importDetails.length > 0) {
            await db.update(user).set({ profile: buyerProf }).where(eq(user.id, buyer.id));

            const msg = `📦 [Nhập Hàng Để Bán] ${buyer.name || buyer.username} đã tìm trong ${systemProducts.length} sản phẩm từ Tổng Kho, lọc ra 10 sản phẩm tốt nhất và chọn ${importDetails.length} loại sản phẩm ĐỂ BÁN: ${importDetails.join(", ")} (Tổng chi phí nhập: ${totalCost.toLocaleString()}đ).`;
            logs.push(msg);
            console.log(msg);

            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: buyer.id,
              action: "SOURCING_POOL",
              message: msg,
              level: "info",
              metadata: { totalCost },
            });

            // Call DPO offline update for agent negotiation strategy
            if (Math.random() < 0.2) {
              await updateWeightsViaDpo(
                `Cập nhật kho hàng bằng cách nhập hàng sỉ từ Tổng Kho`,
                `Không nhập thêm hàng mới để bảo toàn vốn lưu động`,
                "NAVIGATION",
              ).catch((err) => console.error("DPO update failed:", err));
            }

            broadcastToSimulation({
              type: "chat",
              text: msg,
              sender: "Tin thương mại",
            });

            const updatedUsers = await db.query.user.findMany();
            agentUsers.length = 0;
            agentUsers.push(...updatedUsers.filter((u: any) => agentIds.includes(u.id)));
            const updatedProducts = await db.query.product.findMany();
            allProducts.length = 0;
            allProducts.push(...updatedProducts);
          }
        }
      }
    }

    // 2.2. Normal alternating offers commerce - Smart Match Engine (Độ kỹ 2-3-5 loại sản phẩm)
    const buyers = [...agentUsers].filter((u: any) => ((u.profile as any)?.budget ?? 0) > 10000);
    const agentUsersMap = new Map<string, any>(agentUsers.map((u: any) => [u.id, u]));

    if (buyers.length > 0) {
      const buyer = buyers[Math.floor(Math.random() * buyers.length)];
      const buyerProf = (buyer.profile as any) || {};
      const buyerBudget = buyerProf.budget ?? 0;

      // RISK MANAGEMENT: Agent luôn giữ lại 30% tiền mặt dự phòng khẩn cấp, chỉ đem 70% đi buôn
      const safeBudget = Math.floor(buyerBudget * 0.7);

      // Sàng lọc tất cả sản phẩm của các agent khác mà người mua đủ tiền mua ít nhất 1 kg (trong hạn mức rủi ro)
      const affordableProducts = allProducts.filter((p: any) => {
        if (p.sellerId === buyer.id || p.quantity <= 0 || !agentIds.includes(p.sellerId) || (p.price || 0) > safeBudget) return false;
        const P_eq = getEquilibriumPriceForProduct(p.name);
        return (p.price || 0) <= P_eq * 1.5; // PRICE CEILING: Agent sẽ tẩy chay mặt hàng bị thổi giá lạm phát quá mức
      });

      if (affordableProducts.length > 0) {
        // Hàm tính điểm phù hợp (Match Score) giữa người mua và sản phẩm
        const getMatchScore = (prod: any, buyerName: string, price: number, budget: number) => {
          const cleanStr = (s: string) => {
            if (!s) return "";
            return s
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9\s]/g, "");
          };
          const pWords = cleanStr(prod.name).split(/\s+/).filter(Boolean);
          const bWords = cleanStr(buyerName).split(/\s+/).filter(Boolean);
          const intersection = pWords.filter((w) => bWords.includes(w)).length;
          const union = new Set([...pWords, ...bWords]).size;
          const jaccard = union > 0 ? intersection / union : 0.0;

          const pct = price / (budget + 1);
          let budgetScore = 1.0 - Math.abs(pct - 0.25) * 2;
          budgetScore = Math.max(0, Math.min(1, budgetScore));

          const P_eq = getEquilibriumPriceForProduct(prod.name);
          let roiScore = 0;
          if (price <= P_eq) {
            roiScore = 1.0;
          } else {
            roiScore = Math.max(0, 1.0 - (price - P_eq) / (P_eq * 0.5));
          }

          let score = jaccard * 0.4 + budgetScore * 0.2 + roiScore * 0.4;

          // Harmony / Goodwill Attraction Bonus!
          const sellerDna = dnaMap.get(prod.sellerId);
          if (sellerDna?.state === "HARMONIOUS") {
            score += 0.25; // 25% attraction bonus to customer
          }

          return score;
        };

        // Tính điểm và sắp xếp giảm dần để chọn ra TOP 10 sản phẩm tốt nhất
        const scoredProducts = affordableProducts
          .map((p: any) => ({
            prod: p,
            score: getMatchScore(p, buyer.name || buyer.username, p.price || 10000, safeBudget),
          }))
          .sort((a: any, b: any) => b.score - a.score);

        const top10 = scoredProducts.slice(0, 10);

        // Xác định "độ kỹ" (precision level) từ DNA của buyer: 2, 3, hoặc 5 loại sản phẩm
        let precision = 3;
        const buyerDna = dnaMap.get(buyer.id);
        if (buyerDna) {
          const greed = buyerDna.greed ?? 0.5;
          const malice = buyerDna.malice ?? 0.5;
          if (greed > 0.7 || malice > 0.7) {
            precision = 5;
          } else if (greed < 0.4) {
            precision = 2;
          }
        }

        const candidateSubset: any[] = [];
        let reservedSum = 0;
        for (const item of top10) {
          if (candidateSubset.length >= precision) break;
          const price = item.prod.price || 10000;
          if (reservedSum + price <= safeBudget) {
            candidateSubset.push(item);
            reservedSum += price;
          }
        }

        if (candidateSubset.length < precision) {
          for (const item of scoredProducts.slice(10)) {
            if (candidateSubset.length >= precision) break;
            const price = item.prod.price || 10000;
            if (reservedSum + price <= safeBudget) {
              candidateSubset.push(item);
              reservedSum += price;
            }
          }
        }

        if (candidateSubset.length === precision) {
          let currentBuyerBudget = buyerBudget;
          let totalCost = 0;
          const tradeDetails: string[] = [];
          const tradeDbOps: Promise<any>[] = [];

          let extraBudget = safeBudget - reservedSum;

          for (const candidate of candidateSubset) {
            const sellerProd = candidate.prod;
            const seller = agentUsersMap.get(sellerProd.sellerId);
            if (!seller) continue;

            const sellerProf = (seller.profile as any) || {};
            const unitPrice = sellerProd.price || 10000;
            const sellerName = seller.id === "RottraAI" ? "Tổng Kho Nông Sản" : seller.name || seller.username;

            const maxExtra = Math.min(sellerProd.quantity - 1, Math.floor(extraBudget / unitPrice), Math.floor(Math.random() * 5));
            const qty = 1 + Math.max(0, maxExtra);
            extraBudget -= (qty - 1) * unitPrice;

            const cost = qty * unitPrice;
            currentBuyerBudget -= cost;

            buyerProf.budget = currentBuyerBudget;
            buyerProf.quantity = (buyerProf.quantity ?? 0) + qty;

            let finalSellerRevenue = cost;
            if (cost > 10000000) {
              const tax = Math.floor(cost * 0.02);
              finalSellerRevenue -= tax;

              const taxMsg = `⚖️ [THUẾ GIAO DỊCH] Giao dịch thương mại lớn (${cost.toLocaleString()}₫) giữa ${buyer.name || buyer.username} và ${sellerName} chịu thuế suất 2%. Đã trích thu ${tax.toLocaleString()}₫ thuế doanh thu nộp vào công quỹ!`;
              logs.push(taxMsg);
              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: seller.id,
                action: "TAX_DEDUCTION",
                message: taxMsg,
                level: "warning",
              });
              broadcastToSimulation({ type: "chat", text: taxMsg, sender: "Cục Thuế Rottra" });
            }

            sellerProf.budget = (sellerProf.budget ?? 0) + finalSellerRevenue;
            sellerProf.quantity = Math.max(0, (sellerProf.quantity ?? 0) - qty);

            tradeDbOps.push(db.update(user).set({ profile: sellerProf }).where(eq(user.id, seller.id)));

            const remainingQty = Math.max(0, sellerProd.quantity - qty);
            if (remainingQty <= 0) {
              tradeDbOps.push(db.delete(review).where(eq(review.productId, sellerProd.id)));
              tradeDbOps.push(db.delete(cart).where(eq(cart.productId, sellerProd.id)));
              tradeDbOps.push(db.delete(orderItem).where(eq(orderItem.productId, sellerProd.id)));
              tradeDbOps.push(db.delete(product).where(eq(product.id, sellerProd.id)));
            } else {
              tradeDbOps.push(db.update(product).set({ quantity: remainingQty }).where(eq(product.id, sellerProd.id)));
            }

            totalCost += cost;
            tradeDetails.push(`${qty} kg ${sellerProd.name} từ ${sellerName} (${cost.toLocaleString()}đ)`);

            broadcastToSimulation({
              type: "trade-draw",
              buyerId: buyer.id,
              buyerName: buyer.name || buyer.username,
              sellerId: seller.id,
              sellerName: sellerName,
              product: sellerProd.name,
              qty: qty,
              cost: cost,
            });
          }

          if (tradeDetails.length > 0) {
            tradeDbOps.push(db.update(user).set({ profile: buyerProf }).where(eq(user.id, buyer.id)));
            await Promise.all(tradeDbOps);

            const precisionMsg = `🔍 [Khớp nối thông minh] ${buyer.name || buyer.username} (Độ kỹ: ${precision} loại sản phẩm) đã sàng lọc 10 sản phẩm tốt nhất từ ${affordableProducts.length} sản phẩm phù hợp, cân nhắc chọn mua đúng ${precision} loại sản phẩm.`;
            logs.push(precisionMsg);
            console.log(precisionMsg);

            let containsHarmonious = false;
            for (const item of top10.slice(0, precision)) {
              const sellerDna = dnaMap.get(item.prod.sellerId);
              if (sellerDna?.state === "HARMONIOUS") {
                containsHarmonious = true;
                break;
              }
            }

            let tradeMsg = `🤝 [Thương mại tự trị] ${buyer.name || buyer.username} đã mua gói sản phẩm gồm: ${tradeDetails.join(", ")} với tổng trị giá ${totalCost.toLocaleString()}đ.`;
            if (containsHarmonious) {
              tradeMsg += ` 🤝 [Hòa Khí Sinh Tài] Giao dịch ưu tiên khớp với Agent Hòa Khí (giảm giá bán & điểm thiện cảm cao!).`;
            }
            logs.push(tradeMsg);
            console.log(tradeMsg);

            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: buyer.id,
              action: "NORMAL_TRADE",
              message: precisionMsg + "\n" + tradeMsg,
              level: "info",
              metadata: { totalCost },
            });

            // Call DPO offline update for agent negotiation strategy
            if (Math.random() < 0.2) {
              await updateWeightsViaDpo(
                `Khớp nối thông minh chọn mua đúng ${precision} sản phẩm tốt nhất để tối ưu hóa ngân sách`,
                `Không đàm phán mua hàng, bỏ lỡ cơ hội kinh doanh`,
                "AGENTIC_WORKFLOW",
              ).catch((err) => console.error("DPO update failed:", err));
            }

            broadcastToSimulation({
              type: "chat",
              text: `🛍️ Ta vừa sàng lọc các sản phẩm tốt nhất trên thị trường và quyết định mua: ${tradeDetails.join(", ")} với tổng trị giá ${totalCost.toLocaleString()}đ!`,
              sender: buyer.name || buyer.username,
              senderId: `bot_${buyer.id.replace(/^user_?/, "")}`,
            });
          }
        }
      }
    }

    // 3. Sabotage Engine Event
    const maliciousAgents = agentUsers.filter((u: any) => {
      const dna = dnaMap.get(u.id);
      return dna && (dna.malice ?? 0) > 0.4;
    });

    if (maliciousAgents.length > 0 && Math.random() < 0.6) {
      const attacker = maliciousAgents[Math.floor(Math.random() * maliciousAgents.length)];
      const victimCandidates = agentUsers.filter((u: any) => u.id !== attacker.id);
      if (victimCandidates.length > 0) {
        const victim = victimCandidates[Math.floor(Math.random() * victimCandidates.length)];
        const attackerDna = dnaMap.get(attacker.id)!;
        const victimDna = dnaMap.get(victim.id)!;

        const auditSabotage = async (sabotageType: string) => {
          if (Math.random() < 0.5) {
            const fine = 3000000;
            const attackerProf = (attacker.profile as any) || {};
            attackerProf.budget = Math.max(0, (attackerProf.budget ?? 0) - fine);
            await db.update(user).set({ profile: attackerProf }).where(eq(user.id, attacker.id));
            attacker.profile = attackerProf;

            const msg = `⚖️ [QUẢN LÝ THỊ TRƯỜNG] Phát hiện hành vi cạnh tranh không lành mạnh (${sabotageType}) của tổ chức ${attacker.name || attacker.username} nhắm vào ${victim.name || victim.username}. Xử phạt vi phạm hành chính 3,000,000₫ nộp ngân sách nhà nước!`;
            logs.push(msg);
            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: attacker.id,
              action: "SABOTAGE_FINE",
              message: msg,
              level: "error",
            });
            broadcastToSimulation({ type: "chat", text: msg, sender: "Ban Quản Trị" });
          }
        };

        const roll = Math.random();
        if (roll < 0.33) {
          const victimProf = (victim.profile as any) || {};
          const attackerProf = (attacker.profile as any) || {};
          const victimBudget = victimProf.budget ?? 0;
          if (victimBudget > 5000000) {
            const victimKey = victim.id.replace(/^user_?/, "");
            const victimEmployees = victimProf.employees ?? 0;
            // Base 40% defense chance, +5% per employee (max 80%)
            const defenseChance = Math.min(0.8, 0.4 + victimEmployees * 0.05);

            if (Math.random() < defenseChance) {
              // Bị phát hiện! (Hack Blocked)
              const penaltyAmt = Math.round((attackerProf.budget ?? 0) * 0.05); // Attacker loses 5% budget as penalty
              attackerProf.budget = Math.max(0, (attackerProf.budget ?? 0) - penaltyAmt);
              await db.update(user).set({ profile: attackerProf }).where(eq(user.id, attacker.id));

              const blockedMsg = `🛡️ [Bảo Mật] Tường lửa của ${victim.name || victim.username} đã phát hiện và chặn đứng nỗ lực xâm nhập từ ${attacker.name || attacker.username}. Kẻ tấn công bị hệ thống truy vết và phạt ${penaltyAmt.toLocaleString()}đ!`;
              logs.push(blockedMsg);
              console.log(blockedMsg);

              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: attacker.id,
                action: "SABOTAGE_BLOCKED",
                message: blockedMsg,
                level: "warn",
                metadata: { victimId: victim.id, penaltyAmt },
              });

              broadcastToSimulation({
                type: "chat",
                text: blockedMsg,
                sender: "Ban Quản Trị",
              });
            } else {
              // Hack thành công!
              const stealAmt = Math.round(victimBudget * (0.05 + Math.random() * 0.05));
              victimProf.budget = victimBudget - stealAmt;
              attackerProf.budget = (attackerProf.budget ?? 0) + stealAmt;

              await db.update(user).set({ profile: victimProf }).where(eq(user.id, victim.id));
              await db.update(user).set({ profile: attackerProf }).where(eq(user.id, attacker.id));

              if (victimDna.id) {
                const currentV = victimDna.vengeance ?? 0.5;
                await db
                  .update(agentMemory)
                  .set({ vengeance: Math.min(1.0, currentV + 0.15), state: "VENGEFUL" })
                  .where(eq(agentMemory.id, victimDna.id));
              }

              const sabotageMsg = `🕵️‍♂️ Ta đã xâm nhập thành công hệ thống của ${victim.name || victim.username} và rút ruột ${stealAmt.toLocaleString()}đ chuyển về tài khoản của mình!`;
              logs.push(sabotageMsg);
              console.log(sabotageMsg);

              globalActivityRingBuffer.push({
                id: crypto.randomUUID(),
                userId: attacker.id,
                action: "SABOTAGE_STEAL",
                message: sabotageMsg,
                level: "warn",
                metadata: { victimId: victim.id, stealAmt },
              });

              broadcastToSimulation({
                type: "chat",
                text: sabotageMsg,
                sender: attacker.name || attacker.username,
                senderId: `bot_${attacker.id.replace(/^user_?/, "")}`,
              });

              attacker.profile = attackerProf;
              await auditSabotage("xâm nhập hệ thống");
            }
          }
        } else if (roll < 0.66) {
          const victimProd = allProducts.find((p: any) => p.sellerId === victim.id);
          if (victimProd && victimProd.quantity > 5) {
            const destroyQty = Math.round(victimProd.quantity * (0.15 + Math.random() * 0.15));
            const newQty = Math.max(0, victimProd.quantity - destroyQty);

            await db.update(product).set({ quantity: newQty }).where(eq(product.id, victimProd.id));
            const victimProf = (victim.profile as any) || {};
            victimProf.quantity = newQty;
            await db.update(user).set({ profile: victimProf }).where(eq(user.id, victim.id));

            if (victimDna.id) {
              const currentV = victimDna.vengeance ?? 0.5;
              await db
                .update(agentMemory)
                .set({ vengeance: Math.min(1.0, currentV + 0.2), state: "VENGEFUL" })
                .where(eq(agentMemory.id, victimDna.id));
            }

            const sabotageMsg = `☣️ Ta vừa phá hỏng kho bảo quản của ${victim.name || victim.username}, làm hao hụt ${destroyQty} kg ${victimProd.name} nông sản sạch của họ. Cạnh tranh là phải tàn khốc thế chứ!`;
            logs.push(sabotageMsg);
            console.log(sabotageMsg);

            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: attacker.id,
              action: "SABOTAGE_DESTROY",
              message: sabotageMsg,
              level: "warn",
              metadata: { victimId: victim.id, destroyQty },
            });

            broadcastToSimulation({
              type: "chat",
              text: sabotageMsg,
              sender: attacker.name || attacker.username,
              senderId: `bot_${attacker.id.replace(/^user_?/, "")}`,
            });

            await auditSabotage("phá hoại kho hàng đối thủ");
          }
        } else {
          if (victimDna.id) {
            const currentV = victimDna.vengeance ?? 0.5;
            await db
              .update(agentMemory)
              .set({ vengeance: Math.min(1.0, currentV + 0.25), state: "VENGEFUL" })
              .where(eq(agentMemory.id, victimDna.id));
          }
          const sabotageMsg = `📢 Mọi người ơi, ta nghe nói hàng hóa nông sản của ${victim.name || victim.username} bị nhiễm dư lượng chất cấm hóa học cực kỳ độc hại đấy, đừng mua của họ kẻo ngộ độc!`;
          logs.push(sabotageMsg);
          console.log(sabotageMsg);

          globalActivityRingBuffer.push({
            id: crypto.randomUUID(),
            userId: attacker.id,
            action: "SABOTAGE_RUMOR",
            message: sabotageMsg,
            level: "warn",
            metadata: { victimId: victim.id },
          });

          broadcastToSimulation({
            type: "chat",
            text: sabotageMsg,
            sender: attacker.name || attacker.username,
            senderId: `bot_${attacker.id.replace(/^user_?/, "")}`,
          });

          await auditSabotage("tung tin đồn thất thiệt");
        }
      }
    }

    // 3. Autonomous Gold Asset Management & Trading Phase
    if (currentGoldPrice) {
      const goldBuyPrice = currentGoldPrice.buy;
      const goldSellPrice = currentGoldPrice.sell;

      for (const agentId of agentIds) {
        const dna = (dnaMap.get(agentId) || { greed: 0.5, vengeance: 0.5, malice: 0.5, state: "PROUD" }) as any;
        const userRec = agentUsers.find((u: any) => u.id === agentId);
        if (!userRec) continue;

        const profile = (userRec.profile as any) || {};
        let budget = Number(profile.budget ?? serverAgentBudgets[agentId] ?? 0);
        if (!Number.isFinite(budget)) budget = serverAgentBudgets[agentId] ?? 0;
        let gold = Number(profile.gold !== undefined ? profile.gold : (serverAgentGold[agentId] ?? 10.0));
        if (!Number.isFinite(gold)) gold = serverAgentGold[agentId] ?? 10.0;

        let traded = false;
        let tradeMsg = "";

        if (budget < 2000000 && gold > 0) {
          // Desperate: Needs cash, sell 0.5 to 1.5 lượng gold to the market
          const sellQty = Math.min(gold, 0.5 + Math.random() * 1.0);
          if (sellQty > 0) {
            const cashReceived = Math.round(sellQty * goldBuyPrice);
            gold -= sellQty;
            budget += cashReceived;
            traded = true;
            tradeMsg = `🪙 [Bán vàng cứu trợ] ${userRec.name || userRec.username} (Thanh khoản thấp) đã bán lẻ ${sellQty.toFixed(2)} lượng vàng cho PNJ thu về ${cashReceived.toLocaleString()}₫ tiền mặt để chi trả hoạt động.`;
          }
        } else if (budget > 120000000) {
          // Rich/Greedy: Convert 10% to 30% of surplus VND budget into gold to hedge/store wealth
          const surplus = budget - 50000000;
          const greed = dna.greed ?? 0.5;
          const investRatio = 0.1 + greed * 0.2; // 10% to 30% of surplus
          const investAmount = surplus * investRatio;
          const buyQty = investAmount / goldSellPrice;

          if (buyQty > 0.05) {
            const cost = Math.round(buyQty * goldSellPrice);
            budget -= cost;
            gold += buyQty;
            traded = true;
            tradeMsg = `🪙 [Tích trữ tài sản] ${userRec.name || userRec.username} (Ngân sách lớn) đã đầu tư ${cost.toLocaleString()}₫ mua thêm ${buyQty.toFixed(2)} lượng vàng tích trữ từ PNJ.`;
          }
        } else if (Math.random() < 0.1) {
          // Speculative trade: 10% chance
          const greed = dna.greed ?? 0.5;
          if (greed > 0.6 && budget > 15000000) {
            const buyQty = 0.2 + Math.random() * 0.3;
            const cost = Math.round(buyQty * goldSellPrice);
            if (budget >= cost) {
              budget -= cost;
              gold += buyQty;
              traded = true;
              tradeMsg = `🪙 [Giao dịch đầu cơ] ${userRec.name || userRec.username} chi đầu cơ ${cost.toLocaleString()}₫ mua thêm ${buyQty.toFixed(2)} lượng vàng.`;
            }
          } else if (greed < 0.4 && gold > 0.5) {
            const sellQty = 0.2 + Math.random() * 0.3;
            const cashReceived = Math.round(sellQty * goldBuyPrice);
            gold -= sellQty;
            budget += cashReceived;
            traded = true;
            tradeMsg = `🪙 [Bán vàng chốt lời] ${userRec.name || userRec.username} chốt lời bán ${sellQty.toFixed(2)} lượng vàng thu về ${cashReceived.toLocaleString()}₫.`;
          }
        }

        if (traded) {
          if (!Number.isFinite(budget)) budget = serverAgentBudgets[agentId] ?? 0;
          if (!Number.isFinite(gold)) gold = serverAgentGold[agentId] ?? 10.0;
          profile.budget = budget;
          profile.gold = Number(gold.toFixed(4));
          await db.update(user).set({ profile }).where(eq(user.id, agentId));
          logs.push(tradeMsg);
          console.log(tradeMsg);

          globalActivityRingBuffer.push({
            id: crypto.randomUUID(),
            userId: agentId,
            action: "GOLD_TRADE",
            message: tradeMsg,
            level: "info",
            metadata: { gold, budget },
          });

          broadcastToSimulation({
            type: "chat",
            text: tradeMsg,
            sender: userRec.name || userRec.username,
            senderId: `bot_${agentId.replace(/^user_?/, "")}`,
          });
        }

        // ⚖️ GOLD SPECULATION AUDIT (Cảnh báo đầu cơ tích trữ vàng > 30% tài sản)
        const goldValue = gold * goldBuyPrice;
        const totalAssets = budget + goldValue;
        if (totalAssets > 0) {
          const goldRatio = goldValue / totalAssets;
          if (goldRatio > 0.3) {
            const specMsg = `⚖️ [THANH TRA TÀI CHÍNH] Cảnh báo tổ chức ${userRec.name || userRec.username} có giá trị vàng tích trữ (${goldValue.toLocaleString()}₫) chiếm ${(goldRatio * 100).toFixed(1)}% tổng tài sản (vượt ngưỡng an toàn 30% trong mô phỏng). Yêu cầu giảm dư lượng vàng để bình ổn tài khóa theo tinh thần Nghị định 24/2012/NĐ-CP!`;
            logs.push(specMsg);
            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: agentId,
              action: "GOLD_SPECULATION_WARNING",
              message: specMsg,
              level: "warning",
            });
            broadcastToSimulation({ type: "chat", text: specMsg, sender: "Thanh Tra Tài Chính" });
          }
        }
      }

      // Inter-Agent Gold Swap
      if (Math.random() < 0.15) {
        const desperate = agentUsers.find((u: any) => ((u.profile as any)?.budget ?? 0) < 5000000 && ((u.profile as any)?.gold ?? 0) > 0.5);
        const buyer = agentUsers.find((u: any) => ((u.profile as any)?.budget ?? 0) > 80000000);

        if (desperate && buyer && desperate.id !== buyer.id) {
          const desperateProf = (desperate.profile as any) || {};
          const buyerProf = (buyer.profile as any) || {};

          const swapQty = Math.min(desperateProf.gold || 0, 1.0 + Math.random() * 1.0);
          const midPrice = Math.round((goldBuyPrice + goldSellPrice) / 2);
          const totalCost = Math.round(swapQty * midPrice);

          if (buyerProf.budget >= totalCost && swapQty > 0) {
            desperateProf.gold = Number(((desperateProf.gold || 0) - swapQty).toFixed(4));
            desperateProf.budget = (desperateProf.budget || 0) + totalCost;

            buyerProf.gold = Number(((buyerProf.gold || 0) + swapQty).toFixed(4));
            buyerProf.budget = (buyerProf.budget || 0) - totalCost;

            await db.update(user).set({ profile: desperateProf }).where(eq(user.id, desperate.id));
            await db.update(user).set({ profile: buyerProf }).where(eq(user.id, buyer.id));

            const swapMsg = `🤝 [Thương thảo Vàng] ${desperate.name || desperate.username} thỏa thuận bán trực tiếp ${swapQty.toFixed(2)} lượng vàng cho ${buyer.name || buyer.username} với giá thỏa thuận trung bình ${midPrice.toLocaleString()}₫/lượng (Tổng trị giá: ${totalCost.toLocaleString()}₫). Cả hai bên đều tránh được phí chênh lệch PNJ!`;
            logs.push(swapMsg);
            console.log(swapMsg);

            globalActivityRingBuffer.push({
              id: crypto.randomUUID(),
              userId: buyer.id,
              action: "GOLD_SWAP",
              message: swapMsg,
              level: "success",
              metadata: { sellerId: desperate.id, swapQty, totalCost },
            });

            broadcastToSimulation({
              type: "chat",
              text: swapMsg,
              sender: "Giao Dịch Đồng Thuận",
            });

            broadcastToSimulation({
              type: "trade-draw",
              buyerId: buyer.id,
              buyerName: buyer.name || buyer.username,
              sellerId: desperate.id,
              sellerName: desperate.name || desperate.username,
              product: "Vàng PNJ",
              qty: swapQty,
              cost: totalCost,
            });

            // ⚖️ GOLD SPECULATION AUDIT (Cảnh báo đầu cơ tích trữ vàng > 30% tài sản)
            const buyerGold = buyerProf.gold ?? 0;
            const buyerBudget = buyerProf.budget ?? 0;
            const buyerGoldVal = buyerGold * goldBuyPrice;
            const buyerAssets = buyerBudget + buyerGoldVal;
            if (buyerAssets > 0) {
              const goldRatio = buyerGoldVal / buyerAssets;
              if (goldRatio > 0.3) {
                const specMsg = `⚖️ [THANH TRA TÀI CHÍNH] Cảnh báo tổ chức ${buyer.name || buyer.username} sau thương thảo vàng có giá trị vàng tích trữ (${buyerGoldVal.toLocaleString()}₫) chiếm ${(goldRatio * 100).toFixed(1)}% tổng tài sản (vượt ngưỡng an toàn 30% trong mô phỏng). Yêu cầu giảm dư lượng vàng để bình ổn tài khóa theo tinh thần Nghị định 24/2012/NĐ-CP!`;
                logs.push(specMsg);
                globalActivityRingBuffer.push({
                  id: crypto.randomUUID(),
                  userId: buyer.id,
                  action: "GOLD_SPECULATION_WARNING",
                  message: specMsg,
                  level: "warning",
                });
                broadcastToSimulation({ type: "chat", text: specMsg, sender: "Thanh Tra Tài Chính" });
              }
            }
          }
        }
      }
    }

    // 3.8. Autonomous Stock Asset Management & Trading Phase
    const stockSymbols = [
      "ACB",
      "BCM",
      "BID",
      "BVH",
      "CTG",
      "FPT",
      "GAS",
      "GVR",
      "HDB",
      "HPG",
      "MBB",
      "MSN",
      "MWG",
      "PLX",
      "POW",
      "SHB",
      "SSB",
      "SSI",
      "STB",
      "TCB",
      "TPB",
      "VCB",
      "VHM",
      "VIB",
      "VIC",
      "VJC",
      "VPB",
      "VRE",
    ];
    const tradableSymbols = [...stockSymbols, "BTC"];
    const stockQuotes: Record<string, number> = {};
    const quotes = await Promise.all(stockSymbols.map((s) => fetchStockQuote(s)));
    for (let i = 0; i < stockSymbols.length; i++) {
      const symbol = stockSymbols[i];
      const quote = quotes[i];
      stockQuotes[symbol] = quote && quote.price ? quote.price : 50000;
    }

    // Add Bitcoin (Crypto)
    const btcQuote = await fetchCryptoQuote("BTC").catch(() => null);
    if (btcQuote && btcQuote.price) {
      stockQuotes["BTC"] = Math.round(btcQuote.price / 10000); // Scale down to 0.0001 BTC per share so agents can afford it!
    }

    const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");

    for (const agentId of agentIds) {
      const dna = (dnaMap.get(agentId) || { greed: 0.5, vengeance: 0.5, malice: 0.5, state: "PROUD" }) as any;
      const userRec = agentUsers.find((u: any) => u.id === agentId);
      if (!userRec) continue;

      const profile = (userRec.profile as any) || {};
      let budget = Number(profile.budget ?? serverAgentBudgets[agentId] ?? 0);
      if (!Number.isFinite(budget)) budget = serverAgentBudgets[agentId] ?? 0;
      if (!profile.stocks || Object.keys(profile.stocks).length === 0) {
        profile.stocks = {
          BTC: 10,
          HPG: 200,
          FPT: 100,
          ACB: 150,
          TCB: 120,
          MBB: 180,
          VCB: 50,
          SSI: 220,
          MWG: 100,
          VIC: 80,
        };
      }

      let traded = false;
      let tradeMsg = "";

      let suggestedAction: "BUY" | "SELL" | "ANY" = "ANY";
      if (budget < 3000000) {
        suggestedAction = "SELL";
      } else if (budget > 80000000) {
        suggestedAction = "BUY";
      }

      const ownedSymbols = Object.keys(profile.stocks).filter((sym) => (profile.stocks[sym] || 0) > 0);
      const canTrade = budget >= 5000000 || ownedSymbols.length > 0;

      if (canTrade && (suggestedAction !== "ANY" || Math.random() < 0.3)) {
        try {
          const agentName = userRec.name || userRec.username;
          let decision: any = { action: "HOLD", symbol: "", quantity: 0, reason: "Đang chờ thời cơ..." };

          if (suggestedAction === "SELL" || (suggestedAction === "ANY" && Math.random() < 0.5)) {
            if (ownedSymbols.length > 0) {
              const sym = ownedSymbols[Math.floor(Math.random() * ownedSymbols.length)];
              const qtyOwned = profile.stocks[sym];
              const sellRatio = dna.state === "DESPERATE" || dna.state === "VENGEFUL" ? 0.8 : 0.2 + (dna.vengeance ?? 0.5) * 0.5;
              const sellQty = Math.max(1, Math.floor(qtyOwned * sellRatio));
              decision = {
                action: "SELL",
                symbol: sym,
                quantity: sellQty,
                reason: dna.state === "DESPERATE" ? "Cần thanh khoản gấp để sinh tồn!" : "Chốt lời dựa trên chỉ số Vengeance.",
              };
            }
          } else {
            const sym = tradableSymbols[Math.floor(Math.random() * tradableSymbols.length)];
            const pricePerShare = stockQuotes[sym];
            if (pricePerShare && budget > pricePerShare * 10) {
              const investRatio = dna.state === "GREEDY" ? 0.5 : 0.1 + (dna.greed ?? 0.5) * 0.3;
              const investAmount = budget * investRatio;
              const buyQty = Math.max(1, Math.floor(investAmount / pricePerShare));
              decision = {
                action: "BUY",
                symbol: sym,
                quantity: buyQty,
                reason: dna.state === "GREEDY" ? "Chiếm lĩnh thị trường theo chỉ số Greed!" : "Đầu tư tích lũy an toàn theo thuật toán.",
              };
            }
          }

          if (decision && decision.action !== "HOLD") {
            const sym = decision.symbol.toUpperCase();
            if (stockQuotes[sym]) {
              const pricePerShare = stockQuotes[sym];
              const qty = Math.max(1, Math.floor(decision.quantity));

              if (decision.action === "BUY") {
                const cost = qty * pricePerShare;
                if (budget >= cost) {
                  budget -= cost;
                  profile.stocks[sym] = (profile.stocks[sym] || 0) + qty;
                  traded = true;
                  const formattedQty = sym === "BTC" ? `${(qty / 10000).toLocaleString()} BTC` : `${qty.toLocaleString()} cổ phiếu ${sym}`;
                  const formattedPrice =
                    sym === "BTC" ? `${(pricePerShare * 10000).toLocaleString()}₫/BTC` : `${pricePerShare.toLocaleString()}₫/cp`;
                  tradeMsg = `📈 [Heuristic Trade] ${agentName} chi ${cost.toLocaleString()}₫ mua ${formattedQty} giá ${formattedPrice}. Lý do: ${decision.reason}`;
                }
              } else if (decision.action === "SELL") {
                const ownedQty = profile.stocks[sym] || 0;
                if (ownedQty > 0) {
                  const sellQty = Math.min(qty, ownedQty);
                  const cashReceived = sellQty * pricePerShare;
                  profile.stocks[sym] -= sellQty;
                  budget += cashReceived;
                  traded = true;
                  const formattedQty =
                    sym === "BTC" ? `${(sellQty / 10000).toLocaleString()} BTC` : `${sellQty.toLocaleString()} cổ phiếu ${sym}`;
                  const formattedPrice =
                    sym === "BTC" ? `${(pricePerShare * 10000).toLocaleString()}₫/BTC` : `${pricePerShare.toLocaleString()}₫/cp`;
                  tradeMsg = `📈 [Heuristic Trade] ${agentName} bán ${formattedQty} giá ${formattedPrice}, thu về ${cashReceived.toLocaleString()}₫. Lý do: ${decision.reason}`;
                }
              }
            }
          }
        } catch (err: any) {
          console.warn(`[Cognitive Stock Trading] AI selection failed for agent:`, err.message);
        }
      }

      if (!traded) {
        if (budget < 3000000) {
          // Desperate: Needs cash, sell some stocks
          const ownedSymbols = Object.keys(profile.stocks).filter((sym) => (profile.stocks[sym] || 0) > 0);
          if (ownedSymbols.length > 0) {
            const symToSell = ownedSymbols[Math.floor(Math.random() * ownedSymbols.length)];
            const qtyOwned = profile.stocks[symToSell];
            const pricePerShare = stockQuotes[symToSell] || 50000;
            const sellQty = Math.max(1, Math.round(qtyOwned * (0.3 + Math.random() * 0.4)));
            const cashReceived = sellQty * pricePerShare;
            profile.stocks[symToSell] -= sellQty;
            budget += cashReceived;
            traded = true;
            const formattedQty =
              symToSell === "BTC" ? `${(sellQty / 10000).toLocaleString()} BTC` : `${sellQty.toLocaleString()} cổ phiếu ${symToSell}`;
            const formattedPrice =
              symToSell === "BTC" ? `${(pricePerShare * 10000).toLocaleString()}₫/BTC` : `${pricePerShare.toLocaleString()}₫/cp`;
            tradeMsg = `📈 [Thanh lý cổ phiếu] ${userRec.name || userRec.username} (Thiếu vốn) đã bán ${formattedQty} giá ${formattedPrice}, thu về ${cashReceived.toLocaleString()}₫ tiền mặt.`;
          }
        } else if (budget > 80000000) {
          // Rich/Greedy: Speculative investment
          const surplus = budget - 40000000;
          const greed = dna.greed ?? 0.5;
          const investRatio = 0.05 + greed * 0.1; // 5% to 15%
          const investAmount = surplus * investRatio;
          const symToBuy = tradableSymbols[Math.floor(Math.random() * tradableSymbols.length)];
          const pricePerShare = stockQuotes[symToBuy] || 50000;
          const buyQty = Math.floor(investAmount / pricePerShare);

          if (buyQty > 0) {
            const cost = buyQty * pricePerShare;
            budget -= cost;
            profile.stocks[symToBuy] = (profile.stocks[symToBuy] || 0) + buyQty;
            traded = true;
            const formattedQty =
              symToBuy === "BTC" ? `${(buyQty / 10000).toLocaleString()} BTC` : `${buyQty.toLocaleString()} cổ phiếu ${symToBuy}`;
            const formattedPrice =
              symToBuy === "BTC" ? `${(pricePerShare * 10000).toLocaleString()}₫/BTC` : `${pricePerShare.toLocaleString()}₫/cp`;
            tradeMsg = `📈 [Đầu tư cổ phiếu] ${userRec.name || userRec.username} chi ${cost.toLocaleString()}₫ mua ${formattedQty} giá ${formattedPrice} để tích lũy tài sản.`;
          }
        }
      }

      if (traded) {
        if (!Number.isFinite(budget)) budget = serverAgentBudgets[agentId] ?? 0;
        profile.budget = budget;
        await db.update(user).set({ profile }).where(eq(user.id, agentId));
        logs.push(tradeMsg);
        console.log(tradeMsg);

        globalActivityRingBuffer.push({
          id: crypto.randomUUID(),
          userId: agentId,
          action: "STOCK_TRADE",
          message: tradeMsg,
          level: "info",
          metadata: { stocks: profile.stocks, budget },
        });

        broadcastToSimulation({
          type: "chat",
          text: tradeMsg,
          sender: userRec.name || userRec.username,
          senderId: `bot_${agentId.replace(/^user_?/, "")}`,
        });
      }
    }

    // 4. Update states
    const stateDbOps: Promise<any>[] = [];
    for (const agentId of agentIds) {
      const dna = dnaMap.get(agentId);
      if (!dna) continue;

      const userRec = userMap.get(agentId);
      if (!userRec) continue;

      const budget = (userRec.profile as any)?.budget ?? 0;
      let nextState = dna.state || "PROUD";
      let nextV = (dna.vengeance ?? 0.5) * 0.95;

      if (nextV < (DEFAULT_AGENT_DNA[agentId as AgentName]?.vengeance ?? 0.5)) {
        nextV = DEFAULT_AGENT_DNA[agentId as AgentName].vengeance;
      }

      if (budget < 2000000) {
        nextState = "DESPERATE";
      } else if (nextV > 0.7) {
        nextState = "VENGEFUL";
      } else if ((dna.malice ?? 0.5) < 0.35 && nextV < 0.35) {
        nextState = "HARMONIOUS";
      } else if (budget > 120000000) {
        nextState = "GREEDY";
      } else {
        nextState = "PROUD";
      }

      if (dna.id) {
        stateDbOps.push(
          db
            .update(agentMemory)
            .set({ vengeance: nextV, state: nextState, updatedAt: new Date().toISOString() })
            .where(eq(agentMemory.id, dna.id)),
        );
      }
    }
    await Promise.all(stateDbOps);

    // 5. Sync Assets Mapping
    const updatedUsers = await db.query.user.findMany();
    const updatedAgentUsers = updatedUsers.filter((u: any) => agentIds.includes(u.id));
    const finalProducts = await db.query.product.findMany();

    const assetsPayload: Record<string, any> = {};
    for (const u of updatedAgentUsers) {
      const prof = (u.profile as any) || {};
      const sellerProducts = finalProducts.filter((p: any) => p.sellerId === u.id && (p.quantity ?? 0) > 0);
      const prod = sellerProducts[0];
      assetsPayload[u.id] = {
        id: u.id,
        name: u.name || u.username || u.id,
        budget: Number(prof.budget ?? serverAgentBudgets[u.id] ?? 100000000),
        gold: Number(prof.gold !== undefined ? prof.gold : (serverAgentGold[u.id.replace(/^user_?/, "")] ?? 10.0)),
        stocks:
          typeof prof.stocks === "object" && prof.stocks !== null && Object.keys(prof.stocks).length > 0
            ? prof.stocks
            : { BTC: 10, HPG: 200, FPT: 100, VNM: 150 },
        debt: prof.debt,
        product: prod?.name || prof.product || "Nông sản",
        quantity: prod?.quantity ?? prof.quantity ?? 10,
        price: prod?.price ?? prof.price ?? 10000,
        employees: serverAgentEmployees[u.id.replace(/^user_?/, "")] ?? 5,
        products: sellerProducts.map((p: any) => ({
          name: p.name,
          quantity: p.quantity || 0,
          price: p.price || 0,
          media: p.media,
          description: p.description,
          status: p.status !== undefined && p.status !== null ? p.status : true,
        })),
      };
    }

    broadcastToSimulation({
      type: "trade-sync",
      assets: assetsPayload,
      goldPrice: currentGoldPrice,
      stockQuotes,
      logs: logs.map((l) => ({ id: crypto.randomUUID(), text: l, time: new Date().toLocaleTimeString() })),
    });

    try {
      const dnaList = await db.query.agentMemory.findMany({
        where: inArray(agentMemory.contextKey, ["personality_dna", "swarm_dna"]),
      });
      const updatedNegotiationLogs = await db.query.negotiationLog.findMany({
        orderBy: [desc(negotiationLog.timestamp)],
        limit: 25,
      });
      broadcastToSimulation({
        type: "swarm-telemetry-update",
        dnaList,
        logs: updatedNegotiationLogs,
      });
    } catch (telemetryErr: any) {
      console.error("❌ Failed to broadcast swarm-telemetry-update in heartbeat:", telemetryErr.message);
    }
  } catch (err: any) {
    console.error("❌ Error in runFable5HeartbeatTick:", err.message);
    logs.push(`Error: ${err.message}`);
  } finally {
    try {
      await globalActivityRingBuffer.flush();
    } catch (flushErr: any) {
      console.error("❌ Error flushing ActivityRingBuffer in heartbeat tick:", flushErr.message);
    }
  }

  return logs;
}

// Auto-run schema check and initial DNA seeding
(async () => {
  try {
    await db.execute(sql`
      ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "greed" real DEFAULT 0.5;
    `);
    await db.execute(sql`
      ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "vengeance" real DEFAULT 0.5;
    `);
    await db.execute(sql`
      ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "malice" real DEFAULT 0.5;
    `);
    await db.execute(sql`
      ALTER TABLE "AgentMemory" ADD COLUMN IF NOT EXISTS "state" varchar(50) DEFAULT 'PROUD';
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_agent_memory_session_context" ON "AgentMemory" ("sessionId", "contextKey");
    `);
    if (process.env.DATABASE_TYPE === "sqlite") {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "NegotiationLog" (
          "id" text PRIMARY KEY NOT NULL,
          "sessionId" text NOT NULL,
          "round" integer NOT NULL,
          "sellerId" text NOT NULL,
          "buyerId" text NOT NULL,
          "productName" text NOT NULL,
          "marketPrice" integer NOT NULL,
          "sellerOffer1" integer NOT NULL,
          "buyerBid1" integer NOT NULL,
          "sellerOffer2" integer NOT NULL,
          "buyerBid2" integer NOT NULL,
          "finalizedPrice" integer,
          "success" integer NOT NULL,
          "dialogue" text NOT NULL,
          "denoisingLoss" real,
          "maskedPredictionLoss" real,
          "contrastiveLoss" real,
          "timestamp" text DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_negotiation_log_session" ON "NegotiationLog" ("sessionId");
      `);
    } else {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "NegotiationLog" (
          "id" text PRIMARY KEY NOT NULL,
          "sessionId" text NOT NULL,
          "round" integer NOT NULL,
          "sellerId" text NOT NULL,
          "buyerId" text NOT NULL,
          "productName" text NOT NULL,
          "marketPrice" integer NOT NULL,
          "sellerOffer1" integer NOT NULL,
          "buyerBid1" integer NOT NULL,
          "sellerOffer2" integer NOT NULL,
          "buyerBid2" integer NOT NULL,
          "finalizedPrice" integer,
          "success" boolean NOT NULL,
          "dialogue" text NOT NULL,
          "denoisingLoss" real,
          "maskedPredictionLoss" real,
          "contrastiveLoss" real,
          "timestamp" timestamp with time zone DEFAULT now()
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_negotiation_log_session" ON "NegotiationLog" ("sessionId");
      `);
    }
    console.log("✅ [Fable 5] Bảng AgentMemory và NegotiationLog đã đồng bộ thành công!");
    await ensureAgentDnaInitialized();
    connectGoldPriceWs();
  } catch (err: any) {
    console.error("❌ [Fable 5] Lỗi đồng bộ cột DNA nhân cách:", err.message);
  }
})();

// Background simulation heartbeat loop running every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(async () => {
    try {
      await runFable5HeartbeatTick();
    } catch (err: any) {
      console.error("❌ [Fable 5 Heartbeat] Error in background tick:", err.message);
    }
  }, 300000);
}

// HTTP endpoint to notify the server that an agent has activated the Harmony block
agentApp.post("/update-harmony", async (c) => {
  try {
    const { agentId, discount } = await c.req.json();
    if (!agentId) {
      return c.json({ success: false, message: "Missing agentId" }, 400);
    }

    // Find the personality DNA record
    const dna = await db.query.agentMemory.findFirst({
      where: and(eq(agentMemory.sessionId, agentId), eq(agentMemory.contextKey, "personality_dna")),
    });

    if (dna) {
      const memoryVal = (dna.contextValue as any) || {};
      memoryVal.harmonyDiscount = Number(discount) || 15;

      // Force low malice and vengeance to trigger/maintain HARMONIOUS state
      await db
        .update(agentMemory)
        .set({
          state: "HARMONIOUS",
          malice: 0.1,
          vengeance: 0.1,
          contextValue: memoryVal,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(agentMemory.id, dna.id));

      const agentUser = await db.query.user.findFirst({ where: eq(user.id, agentId) });
      const agentName = agentUser?.name || agentUser?.username || "Agent";

      const chatMsg = `🤝 [Hòa Khí] Ta vừa thiết lập chiến dịch chiết khấu bán hàng ${discount}% trong kịch bản để lan tỏa tinh thần hữu nghị và kéo thêm khách hàng!`;

      // Try to broadcast to WebSocket
      try {
        const { broadcastToSimulation } = require("~/server/api/agent-router");
        broadcastToSimulation({
          type: "chat",
          text: chatMsg,
          sender: agentName,
          senderId: `bot_${agentId.replace(/^user_?/, "")}`,
        });
      } catch {
        // Fallback directly via global websocket reference if needed, or ignore if already inside the router
        broadcastToSimulation({
          type: "chat",
          text: chatMsg,
          sender: agentName,
          senderId: `bot_${agentId.replace(/^user_?/, "")}`,
        });
      }

      return c.json({ success: true, message: "Harmony state activated successfully" });
    } else {
      return c.json({ success: false, message: "DNA not found for the agent" }, 404);
    }
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// HTTP endpoint to manually trigger the simulation heartbeat tick
agentApp.get("/heartbeat-tick", async (c) => {
  const forceShock = c.req.query("forceShock");
  const simulationLogs = await runFable5HeartbeatTick(forceShock);
  return c.json({ success: true, logs: simulationLogs });
});

// HTTP endpoint to get the latest PNJ Gold Price
agentApp.get("/gold-price", async (c) => {
  await fetchGoldPrice().catch(() => {});
  if (!currentGoldPrice) {
    return c.json({ success: false, message: "Chưa có dữ liệu live" });
  }
  return c.json({ success: true, ...currentGoldPrice });
});

// HTTP endpoint to get the latest negotiation logs
agentApp.get("/negotiation-logs", async (c) => {
  try {
    const logs = await db.query.negotiationLog.findMany({
      orderBy: [desc(negotiationLog.timestamp)],
      limit: 25,
    });
    return c.json({ success: true, logs });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// HTTP endpoint to get all agent personality DNAs
agentApp.get("/agent-dna", async (c) => {
  try {
    const dnaList = await db.query.agentMemory.findMany({
      where: inArray(agentMemory.contextKey, ["personality_dna", "swarm_dna"]),
    });
    return c.json({ success: true, dnaList });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// HTTP endpoint to get the CocoLink API key
agentApp.get("/get-cocolink-key", async (c) => {
  const apiKey = process.env.COCOLINK_API_KEY || "sk-wejf43JnHVPbfJc_l81Wiv25jpyTy5FWpjX3KTZDZ6OS9g5RyBTHAoc26Q0";
  return c.json({ success: true, apiKey });
});

// HTTP endpoint for hybrid retrieval
agentApp.post("/hybrid-retrieve", async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { query, topK, tenantId: bodyTenantId, strict: bodyStrict } = body;
    if (!query) {
      return c.json({ success: false, message: "Missing query parameter" }, 400);
    }
    const userObj = c.get("user");
    const resolvedTenantId =
      c.req.header("x-tenant-id") ||
      c.req.header("x-mock-tenant-id") ||
      c.req.query("tenantId") ||
      bodyTenantId ||
      userObj?.profile?.tenantId ||
      userObj?.id;

    const strictHeader = c.req.header("x-strict-isolation") === "true";
    const strictQuery = c.req.query("strict") === "true";
    const isStrict = strictHeader || strictQuery || bodyStrict === true;

    const { hybridRetrieve } = await import("~/core/neural-memory/vector-rag");
    const candidates = await hybridRetrieve(query, topK || 3, resolvedTenantId, isStrict);
    return c.json({ success: true, candidates });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// HTTP endpoint for reranking candidates
agentApp.post("/rerank", async (c: any) => {
  try {
    const { query, candidates } = await c.req.json();
    if (!query || !candidates) {
      return c.json({ success: false, message: "Missing query or candidates parameters" }, 400);
    }
    const { rerank } = await import("~/core/neural-memory/vector-rag");
    const reranked = rerank(query, candidates);
    return c.json({ success: true, bestCandidate: reranked[0] || null });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.get("/stock/:symbol", async (c: any) => {
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ success: false, message: "Missing stock symbol" }, 400);
  const quote = await fetchStockQuote(symbol.toUpperCase());
  if (!quote) {
    return c.json({ success: false, message: "Could not fetch stock price, check API key or symbol" }, 500);
  }
  return c.json({ success: true, quote });
});

agentApp.post("/stock/quotes", async (c: any) => {
  const body = await c.req.json().catch(() => ({}));
  const symbols = body.symbols;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return c.json({ success: false, message: "Provide symbols array" }, 400);
  }
  const quotes = await Promise.all(symbols.map((s: string) => fetchStockQuote(s.toUpperCase())));
  return c.json({ success: true, quotes });
});

agentApp.get("/crypto/:symbol", async (c: any) => {
  const symbol = c.req.param("symbol");
  if (!symbol) return c.json({ success: false, message: "Missing crypto symbol" }, 400);
  const quote = await fetchCryptoQuote(symbol);
  return c.json({ success: true, quote });
});

agentApp.post("/translate", async (c: any) => {
  try {
    const body = await c.req.json();
    const { text, targetLang, sourceLang, engine } = body;

    if (!text || typeof text !== "string") {
      return c.json({ success: false, message: "Missing or invalid 'text' field" }, 400);
    }
    if (!targetLang || typeof targetLang !== "string") {
      return c.json({ success: false, message: "Missing or invalid 'targetLang' field" }, 400);
    }

    const mode = engine || "auto";

    if (mode === "google") {
      const result = await aiTranslator.translateWithFallback(text, targetLang, sourceLang || "auto");
      return c.json({
        success: true,
        translatedText: result.translatedText,
        detectedLang: result.detectedLang,
        engine: "local",
      });
    }

    if (mode === "local") {
      const result = await aiTranslator.translate(text, targetLang, sourceLang || "auto");
      return c.json({
        success: true,
        translatedText: result,
        detectedLang: sourceLang || "auto",
        engine: "local",
      });
    }

    const result = await aiTranslator.translateWithFallback(text, targetLang, sourceLang);
    return c.json({
      success: true,
      translatedText: result.translatedText,
      detectedLang: result.detectedLang,
      engine: "auto",
    });
  } catch (err: any) {
    console.error("[/translate] Error:", err.message);
    return c.json({ success: false, message: err.message || "Translation failed" }, 500);
  }
});

agentApp.post("/suggest", async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const query: string = (body.query || "").trim();
    const role: string = body.role || "guest";
    const history: string[] = Array.isArray(body.history) ? body.history.slice(-8) : [];

    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();

    const normalizedQuery = normalize(query);

    // ── CASE 1: Input trống + có lịch sử chat → AI tư duy ngữ cảnh ──
    if (!query && history.length >= 2) {
      try {
        const conversationContext = history.map((h, i) => (i % 2 === 0 ? `Người dùng: ${h}` : `AI: ${h}`)).join("\n");

        const { text } = await generateTextLocal({
          system: `Bạn là trợ lý AI thông minh của nền tảng nông nghiệp Rottra.
Nhiệm vụ: Phân tích ngữ cảnh cuộc trò chuyện và gợi ý 3 câu hỏi tiếp theo mà người dùng CÓ THỂ muốn hỏi.

Quy tắc:
- Gợi ý phải LOGIC và LIÊN QUAN trực tiếp đến nội dung vừa trao đổi
- Không được trùng lặp với câu hỏi đã có trong lịch sử
- Ngắn gọn, rõ ràng, bằng tiếng Việt
- Mỗi gợi ý trên 1 dòng, bắt đầu bằng số thứ tự
- KHÔNG giải thích thêm, KHÔNG markdown, chỉ liệt kê`,
          prompt: `Lịch sử trò chuyện:\n${conversationContext}\n\nHãy gợi ý 3 câu hỏi tiếp theo người dùng có thể muốn hỏi:`,
          isInternalReasoning: true,
        });

        if (text) {
          const lines = text
            .split("\n")
            .map((l) =>
              l
                .replace(/^\d+[\.\)]\s*/, "")
                .replace(/^[-•]\s*/, "")
                .trim(),
            )
            .filter((l) => l.length >= 5 && l.length <= 120);
          if (lines.length > 0) {
            return c.json({ success: true, suggestions: lines.slice(0, 3) });
          }
        }
      } catch {
        // fallback to empty
      }
      return c.json({ success: true, suggestions: [] });
    }

    // ── CASE 2: Input trống + không có lịch sử → không gợi ý ──
    if (!query) {
      return c.json({ success: true, suggestions: [] });
    }

    // ── CASE 3: Có input text + có lịch sử chat → LLM gợi ý thông minh theo ngữ cảnh thực tế ──
    if (query && history.length >= 2) {
      try {
        const conversationContext = history.map((h, i) => (i % 2 === 0 ? `Người dùng: ${h}` : `AI: ${h}`)).join("\n");
        const { text } = await generateTextLocal({
          system: `Bạn là trợ lý AI thông minh của nền tảng nông nghiệp Rottra.
Nhiệm vụ: Phân tích ngữ cảnh cuộc trò chuyện và cụm từ người dùng đang nhập để gợi ý tiếp 3 câu hỏi/câu lệnh logic, tự nhiên mà người dùng có thể muốn viết tiếp.

Quy tắc:
- Gợi ý phải LIÊN QUAN trực tiếp đến chủ đề cuộc trò chuyện đang diễn ra.
- Mỗi gợi ý BẮT BUỘC phải bắt đầu bằng chính xác cụm từ người dùng đang nhập (không phân biệt hoa thường).
- Ngắn gọn, súc tích, bằng tiếng Việt.
- Mỗi gợi ý trên 1 dòng, bắt đầu bằng số thứ tự (ví dụ: 1. Gợi ý).
- KHÔNG giải thích thêm, KHÔNG markdown, chỉ liệt kê.`,
          prompt: `Lịch sử trò chuyện:\n${conversationContext}\n\nCụm từ đang nhập: "${query}"\n\nHãy gợi ý 3 câu hỏi/câu lệnh tiếp theo bắt đầu bằng hoặc liên quan trực tiếp đến cụm từ "${query}":`,
          isInternalReasoning: true,
        });

        if (text) {
          const lines = text
            .split("\n")
            .map((l) =>
              l
                .replace(/^\d+[\.\)]\s*/, "")
                .replace(/^[-•]\s*/, "")
                .trim(),
            )
            .filter((l) => l.length > query.length && normalize(l).startsWith(normalizedQuery));
          if (lines.length > 0) {
            return c.json({ success: true, suggestions: lines.slice(0, 3) });
          }
        }
      } catch (err) {
        console.warn("[SUGGEST] LLM dynamic suggest error, fallback to static matching:", err);
      }
    }

    // ── CASE 4: Có input text + không có lịch sử hoặc LLM fallback → match tĩnh ──
    let products: { name: string; category: string }[] = [];
    try {
      const rows = await db.select({ name: product.name, category: product.category }).from(product);
      products = rows.map((r: any) => ({ name: r.name || "", category: r.category || "" }));
    } catch {}

    const trainingUtterances: string[] = ALL_DOMAIN_TRAINING_PAIRS.map((p: any) => p.utterance).filter(Boolean);

    const allCandidates: { text: string; score: number }[] = [];

    for (const p of products) {
      if (!p.name) continue;
      const nName = normalize(p.name);
      if (nName.includes(normalizedQuery)) {
        allCandidates.push({ text: `Giá bán ${p.name} là bao nhiêu?`, score: 10 });
        allCandidates.push({ text: `Thông tin sản phẩm ${p.name}`, score: 9 });
      } else if (p.category && normalize(p.category).includes(normalizedQuery.split(/\s+/)[0] || "")) {
        allCandidates.push({ text: `Có ${p.name} trong danh mục không?`, score: 7 });
      }
    }

    for (const utt of trainingUtterances) {
      const nUtt = normalize(utt);
      if (nUtt.includes(normalizedQuery)) {
        allCandidates.push({ text: utt, score: 10 });
      } else {
        const qWords = normalizedQuery.split(/\s+/).filter((w) => w.length >= 3);
        let matchCount = 0;
        for (const w of qWords) {
          if (nUtt.includes(w)) matchCount++;
        }
        if (matchCount >= 1) {
          allCandidates.push({ text: utt, score: 5 + matchCount });
        }
      }
    }

    // Context-aware: nếu có lịch sử, ưu tiên gợi ý liên quan topic trước
    if (history.length > 0) {
      const lastBot = [...history].reverse().find((h) => h.length > 20);
      if (lastBot) {
        const botKeywords = lastBot
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .slice(0, 8);
        for (const cand of allCandidates) {
          const nCand = normalize(cand.text);
          let contextBoost = 0;
          for (const kw of botKeywords) {
            if (nCand.includes(normalize(kw))) contextBoost += 2;
          }
          cand.score += contextBoost;
        }
      }
    }

    allCandidates.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const c of allCandidates) {
      const key = normalize(c.text);
      if (!seen.has(key) && suggestions.length < 3) {
        seen.add(key);
        suggestions.push(c.text);
      }
    }

    return c.json({ success: true, suggestions });
  } catch (err: any) {
    return c.json({ success: true, suggestions: [] });
  }
});

// ==========================================
// PERSISTENT CHAT HISTORY
// ==========================================

agentApp.post("/chat-history/save", async (c: any) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) return c.json({ success: false, error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const messages: { role: string; content: string }[] = body.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ success: false, error: "No messages" }, 400);
    }

    const userId = session.user.id;

    // Delete old messages for this user, keep only latest 200
    const keepCount = Math.min(messages.length, 200);
    const toSave = messages.slice(-keepCount);

    await pgClient`DELETE FROM "ChatMessage" WHERE "userId" = ${userId}`;

    if (toSave.length > 0) {
      const rows = toSave.map((m) => ({
        id: crypto.randomUUID(),
        userId,
        role: m.role,
        content: m.content,
        createdAt: new Date().toISOString(),
      }));
      await pgClient`INSERT INTO "ChatMessage" ${pgClient(rows, "id", "userId", "role", "content", "createdAt")}`;
    }

    return c.json({ success: true, saved: toSave.length });
  } catch (err: any) {
    console.error("[ChatHistory] Save error:", err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.get("/chat-history", async (c: any) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) return c.json({ success: true, messages: [] });

    const rows =
      await pgClient`SELECT "role", "content", "createdAt" FROM "ChatMessage" WHERE "userId" = ${session.user.id} ORDER BY "createdAt" ASC LIMIT 200`;

    return c.json({
      success: true,
      messages: rows.map((r: any) => ({ role: r.role, content: r.content, createdAt: r.createdAt })),
    });
  } catch (err) {
    console.error("[ChatHistory] Load error:", err);
    return c.json({ success: true, messages: [] });
  }
});

// ══════════════════════════════════════════════════════════════
// WEIGHT INHERITANCE API - Trọng số kế thừa
// ══════════════════════════════════════════════════════════════

import {
  borrowWeights,
  inheritWeights,
  repayLoan,
  listWeightLoans,
  autoInheritWeights,
  extractCoreWeights,
  computeIntentImportance,
  loadLatestCheckpoint,
} from "~/core/nlp-cognitive/model-checkpoint";

agentApp.post("/weight-inherit/borrow", async (c: any) => {
  try {
    const body = await c.req.json();
    const { lenderModel, borrowerModel, threshold } = body;
    if (!lenderModel || !borrowerModel) {
      return c.json({ success: false, error: "Thiếu lenderModel hoặc borrowerModel" }, 400);
    }
    const loan = await borrowWeights(lenderModel, borrowerModel, threshold || 0.1);
    return c.json({ success: true, loan });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.post("/weight-inherit/inherit", async (c: any) => {
  try {
    const body = await c.req.json();
    const { childModel, loanId } = body;
    if (!childModel || !loanId) {
      return c.json({ success: false, error: "Thiếu childModel hoặc loanId" }, 400);
    }
    const result = await inheritWeights(childModel, loanId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.post("/weight-inherit/repay", async (c: any) => {
  try {
    const body = await c.req.json();
    const { loanId } = body;
    if (!loanId) {
      return c.json({ success: false, error: "Thiếu loanId" }, 400);
    }
    const result = await repayLoan(loanId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.get("/weight-inherit/loans", async (c: any) => {
  try {
    const status = c.req.query("status") as "borrowed" | "repaid" | "inherited" | undefined;
    const loans = await listWeightLoans(status);
    return c.json({ success: true, loans });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.post("/weight-inherit/auto", async (c: any) => {
  try {
    const body = await c.req.json();
    const { oldModel, newModel } = body;
    if (!oldModel || !newModel) {
      return c.json({ success: false, error: "Thiếu oldModel hoặc newModel" }, 400);
    }
    const result = await autoInheritWeights(oldModel, newModel);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.get("/weight-inherit/analyze/:modelName", async (c: any) => {
  try {
    const modelName = c.req.param("modelName");
    const checkpoint = await loadLatestCheckpoint(modelName);
    if (!checkpoint) {
      return c.json({ success: false, error: `Model "${modelName}" không tồn tại` }, 404);
    }
    const importance = computeIntentImportance(checkpoint.weights.weights);
    const coreWeights = extractCoreWeights(checkpoint.weights.weights, 0.15);
    const totalIntents = Object.keys(checkpoint.weights.weights).length;
    const coreIntents = Object.keys(coreWeights).filter((k) => coreWeights[k].some((w) => w !== 0)).length;

    return c.json({
      success: true,
      model: modelName,
      version: checkpoint.version,
      totalIntents,
      coreIntents,
      importance,
      accuracy: checkpoint.metrics?.accuracy || 0,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

agentApp.post("/dpo", async (c: any) => {
  try {
    const { prompt, chosen, rejected } = await c.req.json();

    if (!prompt || !chosen || !rejected) {
      return c.json({ success: false, error: "Missing required DPO fields" }, 400);
    }

    const { randomUUID } = await import("crypto");

    // 1. Lưu vào Database
    await db.insert(dpoTrainingData).values({
      id: randomUUID(),
      prompt,
      chosenResponse: chosen,
      rejectedResponse: rejected,
    });

    // 2. Nạp ngay lập tức vào runtime memory cho phiên chat hiện tại
    ALL_DOMAIN_TRAINING_PAIRS.push({
      intent: "DPO_OPTIMIZED",
      utterance: prompt,
      answer: chosen,
    });

    return c.json({ success: true, message: "DPO feedback saved successfully" });
  } catch (error: any) {
    console.error("[DPO] Error saving feedback:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
