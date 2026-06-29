import { createSignal, For, Show, createEffect, onCleanup, createMemo } from "solid-js";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import {
  beaker,
  clipboardDocumentList,
  lightBulb,
  checkCircle,
  plus,
  chatBubbleBottomCenterText,
  xMark,
  paperAirplane,
  chevronDown,
  sparkles,
} from "solid-heroicons/outline";

export component ScientificManagement() {
  const [vectorQuery, setVectorQuery] = createSignal("đệ quy tuyến tính");
  const [hoveredDim, setHoveredDim] = createSignal<{ index: number; weight: number } | null>(null);

  // Lõi Toán học RAG / Vector Space trong Trình duyệt của Sếp!
  const HIDDEN_DIM = 256;
  const encodeToken = (text: string): number[] => {
    const cleaned = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(
      /\s+/g,
      " ",
    ).trim();
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
    return words.map((w) => {
      let hash = 5381;
      for (let i = 0; i < w.length; i++) {
        hash = (hash << 5) + hash + w.charCodeAt(i);
      }
      return Math.abs(hash) % 50000;
    });
  };

  const getEmbedding = (text: string): number[] => {
    const tokens = encodeToken(text);
    const vector = new Array(HIDDEN_DIM).fill(0);
    const freqs: Record<number, number> = {};
    tokens.forEach((id) => {
      freqs[id] = (freqs[id] || 0) + 1;
    });
    for (const [idStr, freq] of Object.entries(freqs)) {
      const id = parseInt(idStr, 10);
      const dimIndex = id % HIDDEN_DIM;
      vector[dimIndex] += freq;
      vector[(dimIndex + 1) % HIDDEN_DIM] += freq * 0.1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map((val) => val / magnitude);
  };

  const cosineSim = (v1: number[], v2: number[]): number => {
    if (v1.length !== v2.length || v1.length === 0) return 0;
    return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  };

  const knowledgeNodes = [
    {
      title: "Giải thuật Đệ quy Tuyến tính (Thanh Long)",
      desc: "Tìm kiếm tối ưu đường đi và SLAM thông số định vị.",
      text: "de quy tuyen tinh azure dragon thanh long toi uu slam",
    },
    {
      title: "Kiểm tra Nội môi (Huyền Vũ)",
      desc: "Giữ homeostasis ổn định hệ thống phần cứng, nhiệt độ RAM, CPU.",
      text: "homeostasis noi moi huyen vu cpu ram nhiet do pin",
    },
    {
      title: "Quản lý Báo cáo Tương quan Sản lượng",
      desc: "Thống kê ARIMA, ước lượng sản lượng nông vụ Tuyên Quang.",
      text: "arima thong ke tuong quan san luong tuyen quang",
    },
    {
      title: "Thuật toán Mạng nhện Cung Cầu",
      desc: "Mô phỏng Cobweb dự báo giá cả thị trường sầu riêng và cà phê.",
      text: "cobweb mang nhen cung cau gia ca sau rieng ca phe",
    },
    {
      title: "Giải pháp Kháng Nhiễu Cảm Biến Kỳ Lân",
      desc: "Lọc nhiễu Kalman cho độ ẩm đất sinh thái và bức xạ Lux.",
      text: "loc nhieu kalman ky lan cam bien do am dat anh sang lux",
    },
    {
      title: "Ước lượng rủi ro Bayes (Chu Tước)",
      desc: "Phân phối xác suất hậu nghiệm nông sản vùng hạn mặn.",
      text: "bayes chu tuoc xac suat hau nghiem rui ro nong san",
    },
  ];

  // Khởi tạo vector tĩnh cho các nút tri thức
  const compiledNodes = knowledgeNodes.map(
    (node) => ({
      ...node,
      vector: getEmbedding(node.text),
    }),
  );

  const computedAttentionMap = () => {
    const qStr = vectorQuery().trim();
    if (!qStr) return [];

    const qVec = getEmbedding(qStr);
    const d_k = 256;

    // 1. Calculate raw similarity
    const raw = compiledNodes.map((node) => {
      const dot = cosineSim(qVec, node.vector);
      const scaled = dot / Math.sqrt(d_k);
      return { node, scaled };
    });

    // 2. Softmax
    const maxVal = Math.max(...raw.map((r) => r.scaled));
    const exps = raw.map((r) => Math.exp(r.scaled - maxVal));
    const sumExps = exps.reduce((s, v) => s + v, 0);
    const weights = exps.map((v) => (sumExps === 0 ? 0 : v / sumExps));

    return raw.map((r, i) => {
      const weight = weights[i];
      const isPruned = weight < 0.05;
      return {
        title: r.node.title,
        desc: r.node.desc,
        similarity: r.scaled * Math.sqrt(d_k),
        weight: weight,
        isPruned: isPruned,
      };
    }).sort((a, b) => b.weight - a.weight);
  };

  const getQueryVector = () => {
    return getEmbedding(vectorQuery());
  };

  // Mock Data cho Bảng Kanban
  const [tasks, setTasks] = createSignal([
    { id: 1, title: "Phân tích Tương quan Sản lượng", column: "todo", priority: "high", tags: ["Thống kê", "Toán học"] },
    { id: 2, title: "Thuật toán Mạng Nhện Cung Cầu", column: "in_progress", priority: "medium", tags: ["Giải thuật", "Kinh tế"] },
    { id: 3, title: "Dự báo Thời tiết Mùa vụ bằng ARIMA", column: "done", priority: "low", tags: ["Machine Learning", "Khí tượng"] },
  ]);

  const [elnText, setElnText] = createSignal(
    "Nhật ký 28/05/2026: Đã chạy thành công mô hình Hồi quy tuyến tính. Đang chờ AI tổng hợp kết quả R-squared...",
  );
  const [draggedId, setDraggedId] = createSignal(null);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Cho phép Drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, column) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/plain");
    if (idStr) {
      const id = parseInt(idStr);
      setTasks(tasks().map((t) => t.id === id ? { ...t, column } : t));
    }
    setDraggedId(null);
  };

  // AI Consultant Integration
  const [activeRightTab, setActiveRightTab] = createSignal("eln");
  const [aiQuery, setAiQuery] = createSignal("");
  const [aiResponse, setAiResponse] = createSignal("");
  const [isAiThinking, setIsAiThinking] = createSignal(false);

  const askAi = async (autoQuery?: string) => {
    const finalQuery =
      typeof autoQuery === "string" ? autoQuery : aiQuery();
    if (!finalQuery.trim()) return;
    setIsAiThinking(true);
    setAiResponse("");
    if (typeof autoQuery === "string") {
      setAiQuery(autoQuery);
    }

    // Thu thập dữ liệu dự án hiện tại để gửi cho Giáo sư
    const projectContext = `[THÔNG TIN DỰ ÁN HIỆN TẠI]:
- Sổ tay ELN: ${elnText()}
- Nhiệm vụ đang mở: ${tasks().filter(
      (t) => t.column !== "done",
    ).map((t) => t.title).join(", ")}`;

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Dựa trên dữ liệu dự án sau:\n${projectContext}\n\nHỏi: ${finalQuery}`,
          history: [],
          path: "/admin/research",
        }),
      });
      const data = await res.json();
      let responseText = data.text;

      // Auto-Action Execution Parsing
      try {
        const jsonMatch = responseText.match(/\[\s*\{.*?\}\s*\]/s);
        if (jsonMatch) {
          const actionTasks = JSON.parse(jsonMatch[0]);
          if (Array.isArray(actionTasks) && actionTasks.length > 0) {
            setTasks((prev) => {
              const currentMaxId = Math.max(...prev.map((t) => t.id), 0);
              const newTasks = actionTasks.map(
                (t: any, idx: number) => ({
                  id: currentMaxId + idx + 1,
                  title: t.title || "Công việc tự động",
                  column: t.column || "todo",
                  priority: t.priority || "medium",
                  tags: t.tags || ["AI-Generated"],
                }),
              );
              return [...prev, ...newTasks];
            });
            responseText = responseText.replace(jsonMatch[0], "").trim();
            responseText += "\n\n*(Tôi đã tự động thêm thẻ công việc mới vào bảng Kanban cho Sếp rồi nhé!)*";
          }
        }
      } catch (e) {
        console.error("Lỗi parse Agentic JSON:", e);
      }

      setAiResponse(responseText);
    } catch (err) {
      setAiResponse("Giáo sư đang bận chấm bài, vui lòng thử lại sau.");
    } finally {
      setIsAiThinking(false);
    }
  };

  // Tính năng TỰ ĐỘNG NGHIÊN CỨU (Auto-Trigger) khi có thay đổi dữ liệu
  createEffect(() => {
    const currentEln = elnText(); // Đăng ký theo dõi sổ tay
    const currentTasks = tasks(); // Đăng ký theo dõi thẻ Kanban

    // Nếu chưa bật công tắc bên Settings thì thôi
    const isAutoEnabled = typeof window !== "undefined" && localStorage.getItem("autoResearchEnabled") === "true";
    if (!isAutoEnabled) return;

    // Đặt bộ đếm 4 giây (Debounce). Nếu Sếp đang gõ phím liên tục thì khoan phân tích vội.
    // Dừng gõ 4 giây, Giáo sư sẽ tự động "nhảy ra" làm việc.
    const timer = setTimeout(() => {
      if (!isAiThinking()) {
        setActiveRightTab("ai");
        askAi(
          "Hệ thống phát hiện dữ liệu mới! Giáo sư hãy tự động phân tích sổ tay ELN và Bảng Kanban. QUAN TRỌNG: NẾU ĐỀ XUẤT CÔNG VIỆC MỚI, HÃY HÀNH ĐỘNG BẰNG CÁCH CHÈN MỘT MẢNG JSON CÓ ĐỊNH DẠNG: [{\"title\": \"Tên CV\", \"column\": \"todo\", \"priority\": \"high\", \"tags\": [\"AI\"]}] VÀO CUỐI CÂU TRẢ LỜI.",
        );
      }
    }, 4000);

    // Hủy bỏ hẹn giờ nếu có thay đổi dữ liệu mới trước khi 4 giây kết thúc
    onCleanup(() => clearTimeout(timer));
  });

  // --- TRÌNH CHIẾU SIÊU CÔNG THỨC S & MÔ HÌNH HỌC THUẬT ---
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(true);

  // 1. Siêu công thức S
  const [sFormulaHx, setSFormulaHx] = createSignal(2.4);
  const [sFormulaGc, setSFormulaGc] = createSignal(0.6);
  const sFormulaResult = createMemo(() => {
    const raw = 10 / (1 + Math.exp(-1.5 * (sFormulaHx() * (1 + sFormulaGc()) - 2.5)));
    const compressed = 3 + (raw / 10) * 4.5;
    return { raw: raw.toFixed(2), compressed: compressed.toFixed(2) };
  });

  // 2. Hargreaves Evapotranspiration
  const [hargreavesTemp, setHargreavesTemp] = createSignal(28);
  const [hargreavesLight, setHargreavesLight] = createSignal(600);
  const hargreavesResult = createMemo(() => {
    const et = 0.0023 * (hargreavesTemp() + 17.8) * Math.sqrt(hargreavesLight() / 150);
    return et.toFixed(3);
  });

  // 3. Shannon System Entropy
  const [entropyPin, setEntropyPin] = createSignal(85);
  const [entropyCpu, setEntropyCpu] = createSignal(45);
  const [entropyRam, setEntropyRam] = createSignal(60);
  const entropyResult = createMemo(() => {
    const pTemp = entropyCpu() / 100, pRam = entropyRam() / 100, pBat = (100 - entropyPin()) / 100;
    const sum = pTemp + pRam + pBat + 0.1;
    const nT = pTemp / sum, nR = pRam / sum, nB = pBat / sum;
    const ent = -(nT * Math.log2(nT) + nR * Math.log2(nR) + nB * Math.log2(nB));
    return ent.toFixed(3);
  });

  // 4. Kalman Noise Filter
  const [kalmanZ, setKalmanZ] = createSignal(65);
  const [kalmanR, setKalmanR] = createSignal(2);
  const kalmanResult = createMemo(() => {
    const Q = 1;
    const prevP = 5;
    const predP = prevP + Q;
    const gain = predP / (predP + kalmanR());
    const prevX = 50;
    const est = prevX + gain * (kalmanZ() - prevX);
    return { gain: gain.toFixed(3), est: est.toFixed(2) };
  });

  // Chuỗi công thức LaTeX động
  const sFormulaText = () => `$$\\mathcal{S} = \\frac{10}{1 + e^{-1.5 \\cdot (${sFormulaHx().toFixed(2)} \\cdot (1 + ${sFormulaGc().toFixed(
    2,
  )}) - 2.5)}} = ${sFormulaResult().raw} \\quad [\\mathcal{S}_{\\text{compressed}} = ${sFormulaResult().compressed}]$$`;
  const hargreavesText = () => `$$ET_0 = 0.0023 \\cdot (${hargreavesTemp()} + 17.8) \\cdot \\sqrt{\\frac{${hargreavesLight()}}{150}} = ${hargreavesResult()}\\text{ mm/ngày}$$`;
  const entropyText = () => `$$H_{\\text{sys}} = -\\sum p_i \\log_2 p_i = ${entropyResult()}\\text{ bits}$$`;
  const kalmanText = () => `$$\\hat{x}_{k} = 50.0 + ${kalmanResult().gain} \\cdot (${kalmanZ()} - 50.0) = ${kalmanResult().est}$$`;

  let mathContainerRef: HTMLDivElement | undefined;

  // Tự động xoay slide
  createEffect(() => {
    if (!isPlaying()) return;
    const interval = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % 4);
    }, 5000);
    onCleanup(() => clearInterval(interval));
  });

  // Trigger KaTeX renderMathInElement
  createEffect(() => {
    const slide = activeSlideIndex();
    sFormulaResult();
    hargreavesResult();
    entropyResult();
    kalmanResult();

    setTimeout(() => {
      if (mathContainerRef && typeof window !== "undefined" && (window as any).renderMathInElement) {
        try {
          (window as any).renderMathInElement(mathContainerRef, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
            strict: false,
          });
        } catch (e) {
          console.error("Error rendering math in slideshow:", e);
        }
      }
    }, 50);
  });

  <tsx>
    <div class="space-y-8 animate-in fade-in duration-500 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1
            class={`text-3xl font-black tracking-tight ${
              theme() === "dark" ? "text-white" : "text-gray-900"
            }`}>Quản lý Nghiên cứu & Dự án (ELN)</h1>
          <p
            class={`mt-2 text-sm ${
              theme() === "dark" ? "text-gray-400" : "text-gray-500"
            }`}>Ứng dụng phương pháp luận Harvard & Thực chứng khoa học vào vận hành Nông sản.</p>
        </div>
        <button
          class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
          <Icon path={plus} class="w-5 h-5" />
          Nhiệm vụ mới
        </button>
      </div>
      {}
      <div
        class={`p-6 rounded-3xl border shadow-lg transition-all duration-300 ${
          theme() === "dark" ? "bg-[#111625]/60 border-white/5 text-white" : "bg-white border-gray-100 text-gray-800"
        }`}>
        <div class="flex justify-between items-center border-b border-gray-500/10 pb-4 mb-5">
          <div class="flex items-center gap-2.5">
            <span class="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Icon path={sparkles} class="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h2 class="font-black text-sm tracking-tight uppercase">Hệ thống Siêu Công thức S & Mô hình Khoa học</h2>
              <p
                class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Dynamic Research Equations & Live Computation Sandbox</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span
              class="text-[9px] font-black uppercase text-emerald-500 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Live Sandbox</span>
          </div>
        </div>
        {}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {}
          <div class="md:col-span-1 space-y-4">
            <div class="space-y-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-indigo-500">
                Mô hình
                {activeSlideIndex() + 1}
                / 4
              </span>
              <h3 class="text-lg font-black tracking-tight">
                {activeSlideIndex() === 0 && "1. Siêu Công Thức S (Quality Evaluator)"}
                {activeSlideIndex() === 1 && "2. Bốc Thoát Hơi Nước Hargreaves"}
                {activeSlideIndex() === 2 && "3. Entropy Shannon Hệ Thống"}
                {activeSlideIndex() === 3 && "4. Lọc Nhiễu Kalman Tối Ưu"}
              </h3>
              <p class="text-xs text-gray-400 leading-relaxed">
                {activeSlideIndex() === 0 &&
                  "Đánh giá chất lượng phản hồi từ AI Agent dựa trên Entropy Shannon của chuỗi từ vựng H(X) kết hợp với độ phủ tri thức đồ thị G_c."}
                {activeSlideIndex() === 1 &&
                  "Tính lượng nước thoát ra từ đất và thực vật dựa trên nhiệt độ không khí và bức xạ năng lượng mặt trời để tối ưu hóa lượng nước tưới."}
                {activeSlideIndex() === 2 &&
                  "Đo lường mức độ hỗn loạn (Entropy) của hệ thống phần cứng dựa trên phân bổ tải CPU, RAM và dung lượng Pin hiện tại."}
                {activeSlideIndex() === 3 &&
                  "Loại bỏ sai số và nhiễu ngẫu nhiên từ cảm biến môi trường bằng cách tối ưu hóa trọng số tăng Kalman qua từng chu kỳ."}
              </p>
            </div>
            {}
            <div class="space-y-3 pt-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">Tinh chỉnh tham số:</span>
              <Show when={activeSlideIndex() === 0}>
                <div class="space-y-2">
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Entropy H(X):</span>
                      <span class="font-mono text-indigo-400">
                        {sFormulaHx().toFixed(2)}
                        bits
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={sFormulaHx()}
                      onInput={(e) => setSFormulaHx(parseFloat(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Độ bao phủ đồ thị G_c:</span>
                      <span class="font-mono text-indigo-400">
                        {(sFormulaGc() * 100).toFixed(0)}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={sFormulaGc()}
                      onInput={(e) => setSFormulaGc(parseFloat(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </Show>
              <Show when={activeSlideIndex() === 1}>
                <div class="space-y-2">
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Nhiệt độ T_ambient:</span>
                      <span class="font-mono text-indigo-400">
                        {hargreavesTemp()}
                        °C
                      </span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="45"
                      step="1"
                      value={hargreavesTemp()}
                      onInput={(e) => setHargreavesTemp(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Cường độ bức xạ Lux:</span>
                      <span class="font-mono text-indigo-400">
                        {hargreavesLight()}
                        Lux
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="1500"
                      step="50"
                      value={hargreavesLight()}
                      onInput={(e) => setHargreavesLight(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </Show>
              <Show when={activeSlideIndex() === 2}>
                <div class="space-y-2">
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Dung lượng Pin:</span>
                      <span class="font-mono text-indigo-400">
                        {entropyPin()}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={entropyPin()}
                      onInput={(e) => setEntropyPin(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Tải lượng CPU:</span>
                      <span class="font-mono text-indigo-400">
                        {entropyCpu()}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={entropyCpu()}
                      onInput={(e) => setEntropyCpu(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Tải lượng RAM:</span>
                      <span class="font-mono text-indigo-400">
                        {entropyRam()}
                        %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={entropyRam()}
                      onInput={(e) => setEntropyRam(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </Show>
              <Show when={activeSlideIndex() === 3}>
                <div class="space-y-2">
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Giá trị đo thực z_k:</span>
                      <span class="font-mono text-indigo-400">
                        {kalmanZ()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="2"
                      value={kalmanZ()}
                      onInput={(e) => setKalmanZ(parseInt(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] font-bold mb-1">
                      <span>Phương sai nhiễu R:</span>
                      <span class="font-mono text-indigo-400">
                        {kalmanR().toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.5"
                      value={kalmanR()}
                      onInput={(e) => setKalmanR(parseFloat(e.target.value))}
                      class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </Show>
            </div>
          </div>
          {}
          <div
            class="md:col-span-2 flex flex-col justify-center h-full min-h-[180px] p-6 rounded-2xl bg-black/10 dark:bg-black/30 border border-white/5">
            <div ref={mathContainerRef} class="w-full overflow-x-auto py-4 text-center font-mono">
              {activeSlideIndex() === 0 && sFormulaText()}
              {activeSlideIndex() === 1 && hargreavesText()}
              {activeSlideIndex() === 2 && entropyText()}
              {activeSlideIndex() === 3 && kalmanText()}
            </div>
            <div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-400">
              <div>
                <span class="font-semibold text-gray-300">Biến số đầu ra:</span>
                <Show when={activeSlideIndex() === 0}>
                  <span class="ml-2 font-mono text-indigo-400">
                    Chất lượng: S =
                    {sFormulaResult().raw}
                    | S_compressed =
                    {sFormulaResult().compressed}
                  </span>
                </Show>
                <Show when={activeSlideIndex() === 1}>
                  <span class="ml-2 font-mono text-indigo-400">
                    Nước bốc thoát: ET_0 =
                    {hargreavesResult()}
                    mm/ngày
                  </span>
                </Show>
                <Show when={activeSlideIndex() === 2}>
                  <span class="ml-2 font-mono text-indigo-400">
                    Entropy hệ thống: H_sys =
                    {entropyResult()}
                    bits
                  </span>
                </Show>
                <Show when={activeSlideIndex() === 3}>
                  <span class="ml-2 font-mono text-indigo-400">
                    Trạng thái ước lượng: x_est =
                    {kalmanResult().est}
                    | K_gain =
                    {kalmanResult().gain}
                  </span>
                </Show>
              </div>
              <span class="font-mono text-[9px]">Calculated: WebAssembly PostgreSQL Sandbox</span>
            </div>
          </div>
        </div>
        {}
        <div class="flex justify-between items-center mt-5 pt-3 border-t border-gray-500/10">
          <div class="flex gap-2">
            <button
              onClick={() => setActiveSlideIndex((prev) => (prev === 0 ? 3 : prev - 1))}
              class="p-2 rounded-xl bg-gray-500/5 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer border border-white/5"
              aria-label="Slide trước">
              <svg class="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying())}
              class={`p-2 rounded-xl transition-all cursor-pointer border border-white/5 flex items-center justify-center ${
                isPlaying()
                  ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                  : "bg-gray-500/5 hover:bg-indigo-500 hover:text-white"
              }`}
              aria-label={isPlaying() ? "Tạm dừng autoplay" : "Phát autoplay"}>
              {isPlaying()
                ? <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                : <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>}
            </button>
            <button
              onClick={() => setActiveSlideIndex((prev) => (prev + 1) % 4)}
              class="p-2 rounded-xl bg-gray-500/5 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer border border-white/5"
              aria-label="Slide tiếp">
              <svg class="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {}
          <div class="flex gap-2">
            <For each={[0, 1, 2, 3]}>
              {(index) => <button
                onClick={() => setActiveSlideIndex(index)}
                class={`w-2 h-2 rounded-full transition-all duration-300 ${
                  activeSlideIndex() === index ? "w-6 bg-indigo-500" : "bg-gray-500/30 hover:bg-indigo-500/50"
                }`}
                aria-label={`Đi tới slide ${index + 1}`}
              />}
            </For>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {}
        <div class="lg:col-span-3 flex flex-col gap-6">
          {}
          <div class="flex flex-col items-center justify-center pt-2 pb-6">
            <h2
              class={`text-2xl font-black mb-6 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${
                theme() === "dark" ? "text-white" : "text-gray-800"
              }`}>
              January 2023
              <Icon path={chevronDown} class="w-5 h-5 opacity-50" />
            </h2>
            <div class="flex gap-3 md:gap-6 items-center">
              <div
                class={`flex flex-col items-center justify-center w-14 h-20 rounded-[2rem] cursor-pointer hover:-translate-y-1 transition-transform ${
                  theme() === "dark" ? "bg-[#1e2638] text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>
                <span class="text-xl font-black">10</span>
                <span class="text-[10px] font-bold">Mon</span>
              </div>
              <div
                class={`flex flex-col items-center justify-center w-14 h-24 rounded-[2rem] cursor-pointer hover:-translate-y-1 transition-transform ${
                  theme() === "dark" ? "bg-[#1e2638] text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>
                <span class="text-xl font-black">11</span>
                <span class="text-[10px] font-bold">Tue</span>
              </div>
              <div
                class="flex flex-col items-center justify-center w-16 h-28 rounded-[2rem] bg-[#d4ed9e] text-[#1a2133] cursor-pointer hover:-translate-y-1 transition-transform shadow-lg shadow-[#d4ed9e]/20 scale-110 z-10">
                <span class="text-2xl font-black">12</span>
                <span class="text-xs font-bold text-[#1a2133]/70">Wed</span>
              </div>
              <div
                class={`flex flex-col items-center justify-center w-14 h-24 rounded-[2rem] cursor-pointer hover:-translate-y-1 transition-transform ${
                  theme() === "dark" ? "bg-[#1e2638] text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>
                <span class="text-xl font-black">13</span>
                <span class="text-[10px] font-bold">Thu</span>
              </div>
              <div
                class={`flex flex-col items-center justify-center w-14 h-20 rounded-[2rem] cursor-pointer hover:-translate-y-1 transition-transform ${
                  theme() === "dark" ? "bg-[#1e2638] text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>
                <span class="text-xl font-black">14</span>
                <span class="text-[10px] font-bold">Fri</span>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {}
            <div
              class={`rounded-3xl p-5 border flex flex-col ${
                theme() === "dark" ? "bg-[#141b2d] border-white/5" : "bg-slate-100 border-gray-200"
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "todo")}>
              <div class="flex items-center justify-between mb-8">
                <h3 class={`text-lg font-black tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>Giả thuyết</h3>
                <span
                  class={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                    theme() === "dark" ? "bg-white/10 text-white" : "bg-white shadow text-gray-800"
                  }`}>
                  {tasks().filter((t) => t.column === "todo").length}
                </span>
              </div>
              <div class="space-y-10 flex-1 pt-4">
                <For each={tasks().filter((t) => t.column === "todo")}>
                  {(task) => <div class="flex gap-4">
                    {}
                    <div
                      class={`w-10 flex flex-col items-center justify-between text-[11px] font-bold opacity-50 py-2 shrink-0 ${
                        theme() === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}>
                      <span>10 am</span>
                      <div class="w-px flex-1 border-l-2 border-dashed border-current my-2"></div>
                      <span>02 pm</span>
                    </div>
                    {}
                    <div
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      class="flex-1 relative rounded-[32px] p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-grab active:cursor-grabbing bg-[#e0ccdf] text-[#1a2133]">
                      {}
                      <div
                        class="absolute -top-6 left-0 bg-[#1a2133] text-white rounded-[24px] px-4 py-2.5 flex items-center gap-2 shadow-lg z-10 border-[5px] border-[#e0ccdf] border-l-0 border-t-0">
                        <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                          <Icon path={lightBulb} class="w-4 h-4 text-[#e0ccdf]" />
                        </div>
                        <span class="text-xs font-bold tracking-wide pr-2">To-do</span>
                      </div>
                      <div class="pt-5">
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex -space-x-3">
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#e0ccdf] object-cover"
                              src="https://i.pravatar.cc/100?img=1"
                            />
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#e0ccdf] object-cover"
                              src="https://i.pravatar.cc/100?img=2"
                            />
                            <div
                              class="w-8 h-8 rounded-full border-2 border-[#e0ccdf] bg-black/20 flex items-center justify-center text-[10px] font-bold text-[#1a2133]">+</div>
                          </div>
                          <div class="flex flex-col items-end gap-1">
                            <span class="text-[10px] font-black opacity-60">00%</span>
                            <div class="w-12 h-1.5 bg-black/10 rounded-full overflow-hidden">
                              <div class="h-full bg-[#1a2133] w-[0%] rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        <h4 class="text-base font-black mb-2 leading-tight pr-4">
                          {task.title}
                        </h4>
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          <For each={task.tags}>
                            {(tag) => <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/5 text-black/70">{tag}</span>}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>}
                </For>
              </div>
            </div>
            {}
            <div
              class={`rounded-3xl p-5 border flex flex-col ${
                theme() === "dark" ? "bg-[#141b2d] border-white/5" : "bg-slate-100 border-gray-200"
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "in_progress")}>
              <div class="flex items-center justify-between mb-8">
                <h3 class={`text-lg font-black tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>Thực chứng</h3>
                <span
                  class={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                    theme() === "dark" ? "bg-white/10 text-white" : "bg-white shadow text-gray-800"
                  }`}>
                  {tasks().filter((t) => t.column === "in_progress").length}
                </span>
              </div>
              <div class="space-y-10 flex-1 pt-4">
                <For each={tasks().filter((t) => t.column === "in_progress")}>
                  {(task) => <div class="flex gap-4">
                    {}
                    <div
                      class={`w-10 flex flex-col items-center justify-between text-[11px] font-bold opacity-50 py-2 shrink-0 ${
                        theme() === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}>
                      <span>03 pm</span>
                      <div class="w-px flex-1 border-l-2 border-dashed border-current my-2"></div>
                      <span>04 pm</span>
                    </div>
                    {}
                    <div
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      class="flex-1 relative rounded-[32px] p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-grab active:cursor-grabbing bg-[#30d5c8] text-[#1a2133]">
                      {}
                      <div
                        class="absolute -top-6 left-0 bg-[#1a2133] text-white rounded-[24px] px-4 py-2.5 flex items-center gap-2 shadow-lg z-10 border-[5px] border-[#30d5c8] border-l-0 border-t-0">
                        <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                          <Icon path={beaker} class="w-4 h-4 text-[#30d5c8]" />
                        </div>
                        <span class="text-xs font-bold tracking-wide pr-2">Running</span>
                      </div>
                      <div class="pt-5">
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex -space-x-3">
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#30d5c8] object-cover"
                              src="https://i.pravatar.cc/100?img=4"
                            />
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#30d5c8] object-cover"
                              src="https://i.pravatar.cc/100?img=5"
                            />
                            <div
                              class="w-8 h-8 rounded-full border-2 border-[#30d5c8] bg-black/20 flex items-center justify-center text-[10px] font-bold text-[#1a2133]">+</div>
                          </div>
                          <div class="flex flex-col items-end gap-1">
                            <span class="text-[10px] font-black opacity-60">72%</span>
                            <div class="w-12 h-1.5 bg-black/10 rounded-full overflow-hidden">
                              <div class="h-full bg-[#1a2133] w-[72%] rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        <h4 class="text-base font-black mb-2 leading-tight pr-4">
                          {task.title}
                        </h4>
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          <For each={task.tags}>
                            {(tag) => <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/5 text-black/70">{tag}</span>}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>}
                </For>
              </div>
            </div>
            {}
            <div
              class={`rounded-3xl p-5 border flex flex-col ${
                theme() === "dark" ? "bg-[#141b2d] border-white/5" : "bg-slate-100 border-gray-200"
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "done")}>
              <div class="flex items-center justify-between mb-8">
                <h3 class={`text-lg font-black tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>Báo cáo</h3>
                <span
                  class={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                    theme() === "dark" ? "bg-white/10 text-white" : "bg-white shadow text-gray-800"
                  }`}>
                  {tasks().filter((t) => t.column === "done").length}
                </span>
              </div>
              <div class="space-y-10 flex-1 pt-4">
                <For each={tasks().filter((t) => t.column === "done")}>
                  {(task) => <div class="flex gap-4">
                    {}
                    <div
                      class={`w-10 flex flex-col items-center justify-between text-[11px] font-bold opacity-50 py-2 shrink-0 ${
                        theme() === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}>
                      <span>06 pm</span>
                      <div class="w-px flex-1 border-l-2 border-dashed border-current my-2"></div>
                      <span>08 pm</span>
                    </div>
                    {}
                    <div
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      class="flex-1 relative rounded-[32px] p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 cursor-grab active:cursor-grabbing bg-[#d4ed9e] text-[#1a2133]">
                      {}
                      <div
                        class="absolute -top-6 left-0 bg-[#1a2133] text-white rounded-[24px] px-4 py-2.5 flex items-center gap-2 shadow-lg z-10 border-[5px] border-[#d4ed9e] border-l-0 border-t-0">
                        <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                          <Icon path={checkCircle} class="w-4 h-4 text-[#d4ed9e]" />
                        </div>
                        <span class="text-xs font-bold tracking-wide pr-2">Completed</span>
                      </div>
                      <div class="pt-5">
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex -space-x-3">
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#d4ed9e] object-cover"
                              src="https://i.pravatar.cc/100?img=6"
                            />
                            <img
                              class="w-8 h-8 rounded-full border-2 border-[#d4ed9e] object-cover"
                              src="https://i.pravatar.cc/100?img=7"
                            />
                            <div
                              class="w-8 h-8 rounded-full border-2 border-[#d4ed9e] bg-black/20 flex items-center justify-center text-[10px] font-bold text-[#1a2133]">+</div>
                          </div>
                          <div class="flex flex-col items-end gap-1">
                            <span class="text-[10px] font-black opacity-60">100%</span>
                            <div class="w-12 h-1.5 bg-black/10 rounded-full overflow-hidden">
                              <div class="h-full bg-[#1a2133] w-[100%] rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        <h4 class="text-base font-black mb-2 leading-tight pr-4">
                          {task.title}
                        </h4>
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          <For each={task.tags}>
                            {(tag) => <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/5 text-black/70">{tag}</span>}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>}
                </For>
              </div>
            </div>
          </div>
        </div>
        {}
        <div
          class={`rounded-3xl border shadow-sm flex flex-col h-full min-h-[500px] overflow-hidden ${
            theme() === "dark" ? "bg-[#181818] border-white/5" : "bg-white border-gray-100"
          }`}>
          {}
          <div class={`flex border-b ${theme() === "dark" ? "border-white/5" : "border-gray-100"}`}>
            <button
              onClick={() => setActiveRightTab("eln")}
              class={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition-all ${
                activeRightTab() === "eln"
                  ? (theme() === "dark"
                    ? "bg-white/5 text-white border-b-2 border-indigo-500"
                    : "bg-gray-50 text-indigo-700 border-b-2 border-indigo-500")
                  : (theme() === "dark"
                    ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")
              }`}>
              <Icon path={clipboardDocumentList} class="w-5 h-5" />
              Sổ tay ELN
            </button>
            <button
              onClick={() => setActiveRightTab("ai")}
              class={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition-all ${
                activeRightTab() === "ai"
                  ? (theme() === "dark"
                    ? "bg-indigo-900/20 text-indigo-300 border-b-2 border-indigo-500"
                    : "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500")
                  : (theme() === "dark"
                    ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")
              }`}>
              <Icon path={chatBubbleBottomCenterText} class="w-5 h-5" />
              Giáo sư AI
              <Show when={isAiThinking()}>
                <span class="relative flex h-2 w-2 ml-1">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </Show>
            </button>
            <button
              onClick={() => setActiveRightTab("vector")}
              class={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition-all ${
                activeRightTab() === "vector"
                  ? (theme() === "dark"
                    ? "bg-indigo-900/20 text-indigo-300 border-b-2 border-indigo-500"
                    : "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500")
                  : (theme() === "dark"
                    ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")
              }`}>
              <Icon path={sparkles} class="w-5 h-5" />
              Bản đồ Chú ý
            </button>
          </div>
          {}
          <Show when={activeRightTab() === "eln"}>
            <div class="flex-1 flex flex-col p-4 animate-in fade-in zoom-in-95 duration-300">
              <textarea
                value={elnText()}
                onInput={(e) => setElnText(e.target.value)}
                class={`w-full flex-1 resize-none p-4 rounded-2xl border text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                  theme() === "dark" ? "bg-black/50 border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
                placeholder="Ghi chép thuật toán, kết quả p-value, nhật ký nghiên cứu khoa học..."
              />
            </div>
            <div
              class={`px-4 py-3 border-t flex justify-between items-center bg-indigo-50/50 rounded-b-3xl ${
                theme() === "dark" ? "border-white/5 bg-indigo-900/10" : "border-gray-50"
              }`}>
              <div class="flex flex-col">
                <span
                  class={`text-[10px] font-bold uppercase tracking-wider ${
                    theme() === "dark" ? "text-indigo-400" : "text-indigo-600"
                  }`}>Tự động đồng bộ</span>
                <span class="text-xs text-gray-500">Hỗ trợ Phân tích Tự động</span>
              </div>
              <button
                onClick={() => {
                  setActiveRightTab("ai");
                  askAi(
                    "Xin chào Giáo sư, hãy tự động phân tích dữ liệu ELN và Kanban hiện tại. QUAN TRỌNG: NẾU ĐỀ XUẤT CÔNG VIỆC MỚI, HÃY HÀNH ĐỘNG BẰNG CÁCH CHÈN MỘT MẢNG JSON CÓ ĐỊNH DẠNG: [{\"title\": \"Tên CV\", \"column\": \"todo\", \"priority\": \"high\", \"tags\": [\"AI\"]}] VÀO CUỐI CÂU TRẢ LỜI.",
                  );
                }}
                class="bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                title="Phân tích Tự động">
                <Icon path={lightBulb} class="w-4 h-4" />
                <span>Nhờ Giáo sư (Tự động)</span>
              </button>
            </div>
          </Show>
          {}
          <Show when={activeRightTab() === "ai"}>
            <div
              class={`flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-300 ${theme() === "dark" ? "bg-[#181818]" : "bg-white"}`}>
              <div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
                <Show when={aiResponse()}>
                  <div
                    class={`p-4 rounded-2xl text-sm leading-relaxed border shadow-sm ${
                      theme() === "dark" ? "bg-[#1e1e1e] border-gray-800 text-gray-300" : "bg-indigo-50/50 border-indigo-100 text-gray-800"
                    }`}
                    innerHTML={aiResponse().replace(/\n/g, "<br/>")}
                  />
                </Show>
                <Show when={isAiThinking()}>
                  <div class="flex space-x-2 p-4 items-center h-12">
                    <div class="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div class="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                  </div>
                </Show>
                <Show when={!aiResponse() && !isAiThinking()}>
                  <div class="h-full flex flex-col items-center justify-center opacity-50 space-y-3">
                    <Icon path={chatBubbleBottomCenterText} class="w-12 h-12 text-indigo-500" />
                    <p
                      class={`text-sm text-center italic ${
                        theme() === "dark" ? "text-gray-500" : "text-gray-400"
                      }`}>"Tôi đã đọc Sổ tay ELN và Bảng Kanban. Sếp cần phân tích gì?"</p>
                  </div>
                </Show>
              </div>
              <div class={`p-3 border-t flex gap-2 ${theme() === "dark" ? "border-gray-800 bg-[#181818]" : "border-gray-200 bg-gray-50"}`}>
                <input
                  type="text"
                  value={aiQuery()}
                  onInput={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askAi()}
                  placeholder="Hỏi Giáo sư..."
                  class={`flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner ${
                    theme() === "dark" ? "bg-black/50 text-white border border-gray-700" : "bg-white text-gray-800 border border-gray-300"
                  }`}
                />
                <button
                  onClick={() => askAi()}
                  disabled={isAiThinking()}
                  class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center">
                  <Icon path={paperAirplane} class="w-5 h-5" />
                </button>
              </div>
            </div>
          </Show>
          {}
          <Show when={activeRightTab() === "vector"}>
            <div
              class={`flex-1 flex flex-col p-5 space-y-6 overflow-y-auto max-h-[600px] animate-in fade-in zoom-in-95 duration-300 ${
                theme() === "dark" ? "bg-[#181818]" : "bg-white"
              }`}>
              {}
              <div class="space-y-2">
                <label
                  class={`text-xs font-black uppercase tracking-wider ${
                    theme() === "dark" ? "text-indigo-400" : "text-indigo-600"
                  }`}>Truy vấn Không gian Nhúng</label>
                <input
                  type="text"
                  value={vectorQuery()}
                  onInput={(e) => setVectorQuery(e.target.value)}
                  class={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner ${
                    theme() === "dark" ? "bg-black/50 text-white border border-gray-700" : "bg-gray-50 text-gray-800 border border-gray-200"
                  }`}
                  placeholder="Gõ từ khóa để biến đổi vector..."
                />
              </div>
              {}
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span
                    class={`text-xs font-black uppercase tracking-wider ${
                      theme() === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}>Không gian Nhúng Dense Vector R²⁵⁶</span>
                  <Show when={hoveredDim()}>
                    <span class="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                      Chiều #
                      {hoveredDim()?.index}
                      :
                      {hoveredDim()?.weight.toFixed(4)}
                    </span>
                  </Show>
                </div>
                <div
                  class="grid gap-1 bg-black/25 p-3 rounded-2xl border border-white/5 shadow-inner"
                  style={{ "grid-template-columns": "repeat(16, minmax(0, 1fr))" }}>
                  <For each={getQueryVector()}>
                    {(val, idx) => {
                      const normalizedVal = val;
                      const getBgColor = () => {
                        if (normalizedVal > 0.4) return "bg-emerald-400 shadow-sm shadow-emerald-400/20";
                        if (normalizedVal > 0.2) return "bg-emerald-600/75";
                        if (normalizedVal > 0.05) return "bg-indigo-600/50";
                        if (normalizedVal > 0) return "bg-slate-700/60";
                        return "bg-slate-900";
                      };
                      return <div
                        onMouseEnter={() => setHoveredDim({ index: idx(), weight: val })}
                        onMouseLeave={() => setHoveredDim(null)}
                        class={`aspect-square rounded-sm transition-all duration-300 hover:scale-125 cursor-crosshair ${getBgColor()}`}
                      />;
                    }}
                  </For>
                </div>
                <div class="flex justify-between text-[9px] text-gray-500 px-1">
                  <span>Trái: Chiều #0</span>
                  <span>Màu sắc biểu thị Trọng số từ thấp đến cao (Slate → Indigo → Emerald)</span>
                  <span>Phải: Chiều #255</span>
                </div>
              </div>
              {}
              <div class="space-y-3">
                <span
                  class={`text-xs font-black uppercase tracking-wider ${
                    theme() === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}>Bản đồ Tự Chú Ý Phẳng (Flat Context Softmax)</span>
                <div class="space-y-3.5">
                  <For each={computedAttentionMap()}>
                    {(item) => <div
                      class={`p-3.5 rounded-2xl border transition-all ${
                        theme() === "dark"
                          ? "bg-black/20 border-white/5 hover:bg-black/35"
                          : "bg-gray-50 border-gray-100 hover:bg-gray-100/50"
                      }`}>
                      <div class="flex justify-between items-start mb-1.5">
                        <div>
                          <h5 class={`text-xs font-black ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                            {item.title}
                          </h5>
                          <p class="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                        <span
                          class={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            item.isPruned ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                          {item.isPruned ? "PRUNED (<5%)" : "ACTIVE (ĐÃ HỢP NHẤT)"}
                        </span>
                      </div>
                      <div class="flex items-center gap-3 mt-3">
                        <div class="flex-1 h-2 bg-black/10 rounded-full overflow-hidden">
                          <div
                            class={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                              item.isPruned ? "from-red-600 to-red-400" : "from-emerald-400 to-indigo-500"
                            }`}
                            style={{ width: `${Math.round(item.weight * 100)}%` }}
                          />
                        </div>
                        <div class="flex items-end gap-1.5 shrink-0">
                          <span class="text-[11px] font-black">
                            {Math.round(item.weight * 100)}
                            %
                          </span>
                          <span class="text-[9px] text-gray-500 font-mono">
                            cos=
                            {item.similarity.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    </div>}
                  </For>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  </tsx>
}
