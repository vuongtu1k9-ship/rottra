export interface BenchmarkCase {
  query: string;
  expectedIntent: string;
  difficulty: "easy" | "medium" | "hard";
  domain: string;
  language: string;
}

export interface BenchmarkResult {
  query: string;
  expectedIntent: string;
  detectedIntent: string;
  domain: string;
  difficulty: string;
  confidence: number;
  method: string;
  latency: number;
  isSuccess: boolean;
  isHierarchicalSuccess: boolean;
}

export interface BenchmarkMetrics {
  accuracy: number;
  hierarchicalAccuracy: number;
  successCount: number;
  failureCount: number;
  totalCases: number;
  averageLatency: number;
  isDrifting: boolean;
  status: string;
}

export interface BenchmarkReport {
  metrics: BenchmarkMetrics;
  confusionMatrix: Record<string, Record<string, number>>;
  results: BenchmarkResult[];
}

const BENCHMARK_SUITE: BenchmarkCase[] = [
  { query: "chào bạn", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "vi" },
  { query: "hello", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "en" },
  { query: "xin chào trợ lý", expectedIntent: "GREETING", difficulty: "easy", domain: "CHAT", language: "vi" },
  { query: "tôi thấy buồn và stress", expectedIntent: "PSYCHOLOGY", difficulty: "medium", domain: "CHAT", language: "vi" },
  { query: "vận dụng kém quá", expectedIntent: "COMPLAINT", difficulty: "medium", domain: "CHAT", language: "vi" },
  { query: "được chứ", expectedIntent: "CONFIRMATION", difficulty: "medium", domain: "CHAT", language: "vi" },
  { query: "đi tới trang chủ", expectedIntent: "NAVIGATION", difficulty: "easy", domain: "SYSTEM", language: "vi" },
  { query: "giải bài toán tối ưu", expectedIntent: "ACADEMIC", difficulty: "hard", domain: "SCIENCE", language: "vi" },
  { query: "tính tích phân từ 0 đến 1", expectedIntent: "ACADEMIC", difficulty: "hard", domain: "SCIENCE", language: "vi" },
  { query: "tự nhận thức của agent", expectedIntent: "RUFLO", difficulty: "hard", domain: "SCIENCE", language: "vi" },
  { query: "chatgpt", expectedIntent: "OPENHUMAN", difficulty: "easy", domain: "CHAT", language: "en" },
  { query: "siêu năng lực", expectedIntent: "MEGAMIND", difficulty: "medium", domain: "CHAT", language: "vi" },
  { query: "glassmorphism design", expectedIntent: "OPENDESIGN", difficulty: "medium", domain: "SYSTEM", language: "en" },
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
    query: "tính toàn chỉ số đa dạng sinh thìi Shannon",
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

const getParentDomain = (intent: string): string => {
  for (const [domain, intents] of Object.entries(HIERARCHY)) {
    if (intents.includes(intent)) return domain;
  }
  return "UNKNOWN";
};

export async function runBenchmark(): Promise<BenchmarkReport> {
  const { classifyIntent } = await import("../nlp-cognitive/tokenizer");

  const results: BenchmarkResult[] = [];
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

  return {
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
  };
}
