/**
 * AI Education — API Router
 */

import { Hono } from "hono";
import { ok, fail } from "~/shared/dtos/response";
import { Deterministic } from "~/shared/utils/rng";

export const aiEducationApp = new Hono();

// ── Vietnamese Educational Content ──────────────────────────

const educationalContent: Record<string, any> = {
  intent: {
    id: "intent",
    title: "Phân loại Ý định (Intent Classification)",
    subtitle: "Cách AI hiểu người dùng muốn gì",
    sections: [
      {
        heading: "Intent Classification là gì?",
        body: "Intent Classification là quá trình xác định mục đích/ý định của người dùng từ câu nói hoặc câu lệnh. Ví dụ: khi bạn nói 'Giá bao nhiêu?', AI sẽ phân loại đây là truy vấn giá (PRICE_QUERY).",
        interactiveHint: "Thử gõ một câu hỏi và xem AI phân loại như thế nào!",
      },
      {
        heading: "3 Tầng Phân loại",
        body: "Rottra sử dụng 3 tầng phân loại:\n1. REGEX —匹配 mẫu chính xác (nhanh nhất, ~0ms)\n2. KEYWORD — Từ khóa có trọng số (~0.5ms)\n3. FALLBACK — Khi không nhận diện được (~1ms)",
        codeExample: "Tầng 1: /giá|price|bao nhiêu/ → PRICE_QUERY\nTầng 2: 'bao nhiêu tiền' score=0.95\nTầng 3: UNKNOWN fallback",
      },
    ],
    keyTerms: [
      { vi: "Intent", en: "Intent", definition: "Ý định, mục đích của người dùng" },
      { vi: "Classification", en: "Classification", definition: "Phân loại" },
      { vi: "Confidence", en: "Confidence", definition: "Độ tin cậy của dự đoán (0-1)" },
    ],
  },
  ml: {
    id: "ml",
    title: "Học máy (Machine Learning)",
    subtitle: "Máy tính tự học từ dữ liệu",
    sections: [
      {
        heading: "Học máy là gì?",
        body: "Học máy (Machine Learning) là lĩnh vực của AI trong đó máy tính tự học từ dữ liệu mà không cần được lập trình chi tiết. Thay vì viết luật, chúng ta cho máy tính nhiều ví dụ và nó tự tìm ra quy luật.",
        interactiveHint: "Thử huấn luyện một mô hình phân loại và xem nó học như thế nào!",
      },
      {
        heading: "3 loại học máy chính",
        body: "1. Học có giám sát (Supervised Learning): Có dữ liệu gắn nhãn\n2. Học không giám sát (Unsupervised Learning): Tìm cấu trúc ẩn\n3. Học tăng cường (Reinforcement Learning): Học từ thử sai",
        codeExample:
          "Supervised: (câu hỏi, intent) → học phân loại\nUnsupervised: (dữ liệu) → tìm cụm (clustering)\nReinforcement: (hành động, phần thưởng) → tối ưu chiến lược",
      },
    ],
    keyTerms: [
      { vi: "Học máy", en: "Machine Learning", definition: "Máy tính tự học từ dữ liệu" },
      { vi: "Dữ liệu huấn luyện", en: "Training Data", definition: "Dữ liệu dùng để huấn luyện mô hình" },
      { vi: "Độ chính xác", en: "Accuracy", definition: "Tỷ lệ dự đoán đúng" },
    ],
  },
  turing: {
    id: "turing",
    title: "Phép thử Turing",
    subtitle: "Máy tính có thể suy nghĩ không?",
    sections: [
      {
        heading: "Phép thử Turing là gì?",
        body: "Phép thử Turing do Alan Turing đề xuất năm 1950. Một người đánh giá sẽ trò chuyện với hai bên (một người thật, một máy tính) qua text. Nếu người đánh giá không phân biệt được bên nào là máy — máy tính đã vượt qua phép thử.",
        interactiveHint: "Thử chơi Phép thử Turing và xem bạn có thể phân biệt được không!",
      },
      {
        heading: "Tại sao nó quan trọng?",
        body: "Phép thử Turing đặt ra câu hỏi nền tảng: Liệu máy móc có thể thể hiện hành vi thông minh tương đương con người? Mặc dù có nhiều tranh cãi, đây vẫn là tiêu chuẩn quan trọng nhất trong đánh giá AI.",
        codeExample:
          "Cấu trúc:\n[C] Người hỏi\n  ↕ văn bản\n[A] Máy tính (hoặc người)\n[B] Người (hoặc máy tính)\n→ C cố gắng phân biệt A và B",
      },
    ],
    keyTerms: [
      { vi: "Phép thử Turing", en: "Turing Test", definition: "Thử nghiệm đánh giá trí tuệ máy tính" },
      { vi: "Trò chơi bắt chước", en: "Imitation Game", definition: "Tên gốc của phép thử Turing" },
      { vi: "Trí tuệ nhân tạo tổng quát", en: "AGI", definition: "AI có khả năng suy nghĩ như người" },
    ],
  },
  neural: {
    id: "neural",
    title: "Mạng thần kinh nhân tạo",
    subtitle: "Bắt chước não người",
    sections: [
      {
        heading: "Mạng thần kinh là gì?",
        body: "Mạng thần kinh nhân tạo (ANN) là mô hình toán học lấy cảm hứng từ cách não người hoạt động. Nó gồm các lớp (layer) chứa nhiều nút (neuron), mỗi nút nhận dữ liệu, xử lý và truyền cho nút tiếp theo.",
        interactiveHint: "Xem một mạng thần kinh học XOR từng bước!",
      },
      {
        heading: "Các thành phần chính",
        body: "1. Neuron (Nút): Nhận input, nhân với trọng số, áp dụng hàm kích hoạt\n2. Layer (Lớp): Input → Hidden → Output\n3. Weight (Trọng số): Điều chỉnh khi học\n4. Backpropagation: Thuật toán học bằng cách lan truyền sai số ngược",
        codeExample: "Input: [x1, x2]\nHidden: h = sigmoid(w1*x1 + w2*x2 + b)\nOutput: y = sigmoid(wh*h + bh)\nLoss = (y_pred - y_true)²",
      },
    ],
    keyTerms: [
      { vi: "Neuron", en: "Neuron", definition: "Đơn vị xử lý cơ bản của mạng thần kinh" },
      { vi: "Hàm kích hoạt", en: "Activation Function", definition: "Hàm toán học biến đổi đầu ra neuron" },
      { vi: "Backpropagation", en: "Backpropagation", definition: "Thuật toán học bằng lan truyền sai số ngược" },
    ],
  },
  rag: {
    id: "rag",
    title: "RAG — Tăng cường tạo sinh bằng truy xuất",
    subtitle: "AI tìm kiếm kiến thức trước khi trả lời",
    sections: [
      {
        heading: "RAG là gì?",
        body: "RAG (Retrieval-Augmented Generation) là kỹ thuật kết hợp tìm kiếm (retrieval) với tạo sinh (generation). Thay vì chỉ dựa vào kiến thức đã học, AI trước tiên tìm kiếm thông tin liên quan từ cơ sở kiến thức, sau đó sử dụng thông tin đó để tạo câu trả lời chính xác hơn.",
        interactiveHint: "Thử gõ một câu hỏi và xem RAG tìm được những tài liệu nào!",
      },
    ],
    keyTerms: [
      { vi: "RAG", en: "RAG", definition: "Retrieval-Augmented Generation — Tăng cường tạo sinh bằng truy xuất" },
      { vi: "Vector Embedding", en: "Vector Embedding", definition: "Biểu diễn văn bản dưới dạng vectors số" },
      { vi: "Semantic Search", en: "Semantic Search", definition: "Tìm kiếm theo nghĩa, không chỉ từ khóa" },
    ],
  },
};

// ── Content Endpoints ───────────────────────────────────────

aiEducationApp.get("/content/all", (c) => {
  const index = Object.values(educationalContent).map(({ id, title, subtitle }) => ({ id, title, subtitle }));
  return c.json(ok(index));
});

aiEducationApp.get("/content/:module", (c) => {
  const content = educationalContent[c.req.param("module")];
  if (!content) return c.json(fail("Module not found"), 404);
  return c.json(ok(content));
});

// ── Demo Endpoints ──────────────────────────────────────────

aiEducationApp.post("/demo/intent", async (c) => {
  const body = await c.req.json<{ text: string }>();
  const steps: any[] = [];

  // Step 1: Regex
  const regexMatch = body.text.match(/giá|price|bao nhiêu/i);
  steps.push({ layer: "REGEX", matched: !!regexMatch, intent: regexMatch ? "PRICE_QUERY" : null, timeMs: 0.1 });

  // Step 2: Keywords
  const keywords: Record<string, string[]> = {
    GREETING: ["xin chào", "hello", "chào"],
    FAREWELL: ["tạm biệt", "goodbye", "bye"],
    THANKS: ["cảm ơn", "thanks", "thank"],
    PRODUCT_INFO: ["sản phẩm", "mô tả", "product"],
    PRICE_QUERY: ["giá", "bao nhiêu", "price", "cost", "tiền"],
    SEARCH: ["tìm kiếm", "search", "find"],
    PSYCHOLOGY: ["buồn", "vui", "tâm lý", "stress"],
    FORECAST: ["dự báo", "forecast", "tương lai"],
  };
  const scores: Record<string, number> = {};
  for (const [intent, kws] of Object.entries(keywords)) {
    const matches = kws.filter((kw) => body.text.toLowerCase().includes(kw));
    scores[intent] = matches.length > 0 ? matches.length / kws.length + 0.1 : 0;
  }
  steps.push({ layer: "KEYWORD", scores, timeMs: 0.5 });

  // Step 3: Result
  const bestIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  steps.push({ layer: "RESULT", intent: bestIntent[0], confidence: bestIntent[1], timeMs: 0.8 });

  return c.json(ok({ text: body.text, steps, finalIntent: bestIntent[0], confidence: bestIntent[1] }));
});

aiEducationApp.post("/demo/rag", async (c) => {
  const body = await c.req.json<{ query: string }>();
  // Simulated RAG results
  const docs = [
    { id: 1, title: "Hướng dẫn trồng lúa", score: 0.92, snippet: "Kỹ thuật trồng lúa hiệu quả..." },
    { id: 2, title: "Giá gạo thị trường", score: 0.85, snippet: "Giá gạo hôm nay..." },
    { id: 3, title: "Bệnh thường gặp trên lúa", score: 0.78, snippet: "Bệnh đạo ôn, bệnh bạc lá..." },
  ];
  return c.json(ok({ query: body.query, retrievedDocs: docs, rerankedDocs: docs }));
});

aiEducationApp.post("/demo/neural-net", async (c) => {
  const body = await c.req.json<{ epochs?: number }>();
  const epochs = body.epochs || 50;
  const history: { epoch: number; loss: number; accuracy: number }[] = [];

  // Simulate XOR training
  let w1 = 0.5,
    w2 = 0.3,
    b = 0.1;
  for (let e = 0; e < epochs; e++) {
    const inputs = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const targets = [0, 1, 1, 0];
    let totalLoss = 0;
    let correct = 0;

    for (let i = 0; i < 4; i++) {
      const x1 = inputs[i][0],
        x2 = inputs[i][1];
      const h = 1 / (1 + Math.exp(-(w1 * x1 + w2 * x2 + b)));
      const pred = h > 0.5 ? 1 : 0;
      const err = targets[i] - h;
      totalLoss += err * err;
      if (pred === targets[i]) correct++;

      // Backprop
      const lr = 0.5;
      w1 += lr * err * x1;
      w2 += lr * err * x2;
      b += lr * err;
    }

    history.push({ epoch: e + 1, loss: totalLoss / 4, accuracy: correct / 4 });
  }

  return c.json(
    ok({
      history,
      finalWeights: { w1, w2, bias: b },
      xorResults: [
        [0, 0, 0],
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ],
    }),
  );
});

aiEducationApp.post("/demo/ml/train", async (c) => {
  const body = await c.req.json<{ type?: string }>();
  // Simulated ML training with decision boundary data
  const dataPoints: { x: number; y: number; label: number }[] = [];
  for (let i = 0; i < 100; i++) {
    const label = i < 50 ? 0 : 1;
    const x = label === 0 ? Deterministic.random() * 0.6 : 0.4 + Deterministic.random() * 0.6;
    const y = label === 0 ? Deterministic.random() * 0.6 : 0.4 + Deterministic.random() * 0.6;
    dataPoints.push({ x, y, label });
  }

  return c.json(ok({ dataPoints, accuracy: 0.85 + Deterministic.random() * 0.1, algorithm: body.type || "naive_bayes" }));
});

// ── Progress & Quiz ─────────────────────────────────────────

const userProgress = new Map<string, { completed: string[]; quizScores: Record<string, number>; xp: number }>();

aiEducationApp.get("/progress", (c) => {
  const userId = c.req.query("userId") || "default";
  const progress = userProgress.get(userId) || { completed: [], quizScores: {}, xp: 0 };
  return c.json(ok(progress));
});

aiEducationApp.post("/progress/update", async (c) => {
  const body = await c.req.json<{ userId: string; module: string; quizScore?: number; xp?: number }>();
  const progress = userProgress.get(body.userId) || { completed: [], quizScores: {}, xp: 0 };
  if (!progress.completed.includes(body.module)) progress.completed.push(body.module);
  if (body.quizScore !== undefined) progress.quizScores[body.module] = body.quizScore;
  progress.xp += body.xp || 0;
  userProgress.set(body.userId, progress);
  return c.json(ok(progress));
});

// ── Quiz ────────────────────────────────────────────────────

const quizQuestions: Record<string, any[]> = {
  intent: [
    {
      id: "q1",
      question: "Intent Classification phân loại dựa trên gì?",
      options: ["Màu sắc", "Ý định của người dùng", "Hình ảnh", "Âm thanh"],
      correctIndex: 1,
      explanation: "Intent Classification xác định mục đích/ý định của người dùng từ câu nói.",
      difficulty: "easy",
      xpReward: 10,
    },
    {
      id: "q2",
      question: "Tầng nào nhanh nhất trong 3 tầng phân loại?",
      options: ["Keyword", "REGEX", "Fallback", "Neural Net"],
      correctIndex: 1,
      explanation: "REGEX matching là nhanh nhất (~0ms) vì chỉ cần so sánh mẫu chữ.",
      difficulty: "easy",
      xpReward: 10,
    },
  ],
  ml: [
    {
      id: "q3",
      question: "Học máy có giám sát cần gì?",
      options: ["Dữ liệu không nhãn", "Dữ liệu có nhãn", "Internet", "GPU"],
      correctIndex: 1,
      explanation: "Học có giám sát cần dữ liệu đã được gắn nhãn (labeled data).",
      difficulty: "easy",
      xpReward: 10,
    },
    {
      id: "q4",
      question: "F1 Score là gì?",
      options: [
        "Tổng precision và recall",
        "Trung bình cộng precision và recall",
        "Trung bình harmonic của precision và recall",
        "Số liệu về kích thước",
      ],
      correctIndex: 2,
      explanation: "F1 = 2 * (Precision * Recall) / (Precision + Recall).",
      difficulty: "medium",
      xpReward: 20,
    },
  ],
  turing: [
    {
      id: "q5",
      question: "Ai đề xuất Phép thử Turing?",
      options: ["John Searle", "Alan Turing", "Turing Church", "Alan Turing"],
      correctIndex: 1,
      explanation: "Alan Turing đề xuất phép thử trong bài báo năm 1950.",
      difficulty: "easy",
      xpReward: 10,
    },
  ],
  neural: [
    {
      id: "q6",
      question: "Hàm kích hoạt phổ biến nhất trong mạng thần kinh?",
      options: ["ReLU", "Sigmoid", "Softmax", "Tanh"],
      correctIndex: 1,
      explanation: "Sigmoid phổ biến trong các mô hình cơ bản vì output nằm trong khoảng (0,1).",
      difficulty: "easy",
      xpReward: 10,
    },
  ],
  rag: [
    {
      id: "q7",
      question: "RAG kết hợp hai kỹ thuật nào?",
      options: ["Training + Inference", "Retrieval + Generation", "Classification + Regression", "Clustering + Ranking"],
      correctIndex: 1,
      explanation: "RAG = Retrieval-Augmented Generation: tìm kiếm + tạo sinh.",
      difficulty: "easy",
      xpReward: 10,
    },
  ],
};

aiEducationApp.get("/quiz/:module", (c) => {
  const questions = quizQuestions[c.req.param("module")];
  if (!questions) return c.json(fail("No quiz for this module"), 404);
  return c.json(ok(questions));
});

aiEducationApp.post("/quiz/submit", async (c) => {
  const body = await c.req.json<{ userId: string; module: string; answers: { questionId: string; selectedIndex: number }[] }>();
  const questions = quizQuestions[body.module] || [];
  let correct = 0;
  let xp = 0;

  for (const answer of body.answers) {
    const q = questions.find((q) => q.id === answer.questionId);
    if (q && q.correctIndex === answer.selectedIndex) {
      correct++;
      xp += q.xpReward;
    }
  }

  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  // Update progress
  const progress = userProgress.get(body.userId) || { completed: [], quizScores: {}, xp: 0 };
  progress.quizScores[body.module] = score;
  progress.xp += xp;
  if (score >= 70 && !progress.completed.includes(body.module)) progress.completed.push(body.module);
  userProgress.set(body.userId, progress);

  return c.json(ok({ score, correct, total: questions.length, xpEarned: xp }));
});
