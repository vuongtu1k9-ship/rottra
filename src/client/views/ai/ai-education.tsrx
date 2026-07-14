/**
 * AI Education Page
 * Interactive demos for Intent Classification, ML, Turing Test, Neural Networks, RAG.
 */

import { createSignal, For, Show, onMount } from "solid-js";

const modules: { id: string; title: string; subtitle: string; icon: string }[] = [
  { id: "intent", title: "Phân loại Ý định", subtitle: "AI hiểu bạn muốn gì", icon: "🎯" },
  { id: "ml", title: "Học máy", subtitle: "Máy tính tự học từ dữ liệu", icon: "🤖" },
  { id: "turing", title: "Phép thử Turing", subtitle: "Máy tính có thể suy nghĩ?", icon: "🧪" },
  { id: "neural", title: "Mạng thần kinh", subtitle: "Bắt chước não người", icon: "🧠" },
  { id: "rag", title: "RAG", subtitle: "AI tìm kiếm trước khi trả lời", icon: "📚" },
];

export component AIEducation() {
  const [activeModule, setActiveModule] = createSignal<string | null>(null);
  const [content, setContent] = createSignal<any>(null);
  const [demoResult, setDemoResult] = createSignal<any>(null);
  const [demoInput, setDemoInput] = createSignal("");
  const [training, setTraining] = createSignal(false);
  const [neuralHistory, setNeuralHistory] = createSignal<{ epoch: number; loss: number; accuracy: number }[]>([]);

  onMount(loadContent);

  async function loadContent() {
    try {
      const res = await fetch("/api/ai-education/content/all");
      const data = await res.json();
      setContent(data.data);
    } catch {}
  }

  async function selectModule(mod: string) {
    setActiveModule(mod);
    setDemoResult(null);
    setNeuralHistory([]);
    try {
      const res = await fetch(`/api/ai-education/content/${mod}`);
      const data = await res.json();
      setContent(data.data);
    } catch {}
  }

  async function runIntentDemo() {
    if (!demoInput()) return;
    try {
      const res = await fetch("/api/ai-education/demo/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: demoInput() }),
      });
      const data = await res.json();
      setDemoResult(data.data);
    } catch {}
  }

  async function runNeuralDemo() {
    setTraining(true);
    try {
      const res = await fetch("/api/ai-education/demo/neural-net", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epochs: 50 }),
      });
      const data = await res.json();
      setNeuralHistory(data.data.history);
      setDemoResult(data.data);
    } catch {}
    setTraining(false);
  }

  async function runRagDemo() {
    if (!demoInput()) return;
    try {
      const res = await fetch("/api/ai-education/demo/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: demoInput() }),
      });
      const data = await res.json();
      setDemoResult(data.data);
    } catch {}
  }

  async function runMLDemo() {
    setTraining(true);
    try {
      const res = await fetch("/api/ai-education/demo/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "naive_bayes" }),
      });
      const data = await res.json();
      setDemoResult(data.data);
    } catch {}
    setTraining(false);
  }

  <tsx>
    <div class="p-6 max-w-5xl mx-auto text-white">
      <h1 class="text-3xl font-bold mb-2">🎓 AI Education</h1>
      <p class="text-gray-400 mb-8">Khám phá cách AI hoạt động qua các demo trực quan</p>

      {/* Module Grid */}
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <For each={modules}>
          {(mod) => (
            <button
              class={`p-4 rounded-xl text-left transition-all ${
                activeModule() === mod.id
                  ? "bg-blue-600 ring-2 ring-blue-400 scale-105"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
              onClick={() => selectModule(mod.id)}
            >
              <div class="text-2xl mb-2">{mod.icon}</div>
              <h3 class="font-bold text-sm">{mod.title}</h3>
              <p class="text-xs text-gray-300 mt-1 opacity-80">{mod.subtitle}</p>
            </button>
          )}
        </For>
      </div>

      <Show when={activeModule()}>
        {/* Intent Demo */}
        <Show when={activeModule() === "intent"}>
          <div class="bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 class="text-xl font-semibold">🎯 Phân loại Ý định (Intent Classification)</h2>
            <p class="text-gray-400 text-sm">Gõ một câu giao tiếp, AI sẽ dùng RAG Memory để xác định ý định</p>
            <div class="flex gap-2">
              <input
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm"
                placeholder="Ví dụ: Giá sâm ngọc linh bao nhiêu?"
                value={demoInput()}
                onInput={(e) => setDemoInput(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && runIntentDemo()}
              />
              <button class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm" onClick={runIntentDemo}>
                Phân tích
              </button>
            </div>
            
            <Show when={demoResult()}>
              <div class="space-y-4 mt-4">
                <h3 class="text-white font-medium">Pipeline Thực thi:</h3>
                <For each={demoResult().steps || []}>
                  {(step) => (
                    <div class="bg-gray-800 rounded-lg p-4">
                      <div class="flex items-center gap-2 mb-2">
                        <span class={`w-3 h-3 rounded-full ${step.matched || step.intent ? "bg-green-500" : "bg-gray-600"}`} />
                        <span class="text-white font-medium">{step.layer}</span>
                        <span class="text-gray-500 text-xs">{step.timeMs}ms</span>
                      </div>
                      <Show when={step.intent}>
                        <p class="text-green-400 text-sm">Intent: {step.intent}</p>
                      </Show>
                      <Show when={step.scores}>
                        <div class="flex gap-2 flex-wrap mt-1">
                          <For each={Object.entries(step.scores)}>
                            {([intent, score]) => (
                              <span class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">
                                {intent}: {(Number(score) * 100).toFixed(0)}%
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
                <div class="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                  <p class="text-green-400 text-lg font-semibold">→ {demoResult().finalIntent}</p>
                  <p class="text-gray-400 text-sm">Confidence: {(demoResult().confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Neural Network Demo */}
        <Show when={activeModule() === "neural"}>
          <div class="bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 class="text-xl font-semibold">🧠 Mạng thần kinh — Học XOR</h2>
            <p class="text-gray-400 text-sm">Xem mạng thần kinh 3 layer học hàm XOR qua 50 epochs</p>
            <button
              class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              onClick={runNeuralDemo}
              disabled={training()}
            >
              {training() ? "Đang huấn luyện..." : "Train XOR"}
            </button>
            <Show when={neuralHistory().length > 0}>
              <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-white font-medium mb-2">Training Progress</h3>
                <div class="space-y-1 max-h-60 overflow-y-auto">
                  <For each={neuralHistory()}>
                    {(h) => (
                      <div class="flex items-center gap-2 text-xs">
                        <span class="text-gray-500 w-12">#{h.epoch}</span>
                        <div class="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            class="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${h.accuracy * 100}%` }}
                          />
                        </div>
                        <span class="text-gray-400 w-20">Loss: {h.loss.toFixed(4)}</span>
                        <span class="text-green-400 w-16">{(h.accuracy * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
              <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-white font-medium mb-2">XOR Results</h3>
                <For each={demoResult()?.xorResults || []}>
                  {([x1, x2, y]) => (
                    <div class="flex gap-4 text-sm py-1">
                      <span class="text-gray-400">Input: [{x1}, {x2}]</span>
                      <span class={`font-mono ${y ? "text-green-400" : "text-red-400"}`}>Output: {y}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* RAG Demo */}
        <Show when={activeModule() === "rag"}>
          <div class="bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 class="text-xl font-semibold">📚 RAG Demo</h2>
            <p class="text-gray-400 text-sm">Gõ câu hỏi và xem RAG tìm được những tài liệu nào</p>
            <div class="flex gap-2">
              <input
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm"
                placeholder="Hỏi về trồng lúa, giá gạo..."
                value={demoInput()}
                onInput={(e) => setDemoInput(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && runRagDemo()}
              />
              <button class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm" onClick={runRagDemo}>
                Tìm kiếm
              </button>
            </div>
            <Show when={demoResult()}>
              <div class="space-y-2">
                <For each={demoResult().retrievedDocs || []}>
                  {(doc) => (
                    <div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p class="text-white font-medium">{doc.title}</p>
                        <p class="text-gray-400 text-sm">{doc.snippet}</p>
                      </div>
                      <span class="text-blue-400 text-sm font-mono">{(doc.score * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* ML Demo */}
        <Show when={activeModule() === "ml"}>
          <div class="bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 class="text-xl font-semibold">🤖 Học máy Demo</h2>
            <p class="text-gray-400 text-sm">Huấn luyện mô hình phân loại trên dữ liệu mẫu</p>
            <button
              class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              onClick={runMLDemo}
              disabled={training()}
            >
              {training() ? "Training..." : "Train Model"}
            </button>
            <Show when={demoResult()}>
              <div class="bg-gray-800 rounded-lg p-4">
                <p class="text-white">Algorithm: {demoResult().algorithm}</p>
                <p class="text-green-400 text-lg font-semibold mt-2">Accuracy: {(demoResult().accuracy * 100).toFixed(1)}%</p>
                <p class="text-gray-400 text-sm mt-1">{demoResult().dataPoints?.length || 0} data points</p>
              </div>
            </Show>
          </div>
        </Show>

        {/* Content Sections */}
        <Show when={content()?.sections}>
          <div class="mt-8 space-y-6">
            <For each={content().sections}>
              {(section) => (
                <div class="bg-gray-900 rounded-xl p-6">
                  <h3 class="text-lg font-semibold text-white mb-3">{section.heading}</h3>
                  <p class="text-gray-300 text-sm whitespace-pre-line">{section.body}</p>
                  <Show when={section.codeExample}>
                    <pre class="bg-gray-800 rounded-lg p-3 mt-3 text-sm text-green-400 overflow-x-auto">{section.codeExample}</pre>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Key Terms */}
        <Show when={content()?.keyTerms}>
          <div class="mt-6 bg-gray-900 rounded-xl p-6">
            <h3 class="text-lg font-semibold mb-3">Thuật ngữ quan trọng</h3>
            <div class="space-y-2">
              <For each={content().keyTerms}>
                {(term) => (
                  <div class="flex gap-4 py-2 border-b border-gray-800">
                    <span class="text-blue-400 font-medium min-w-[120px]">{term.vi}</span>
                    <span class="text-gray-500 text-sm min-w-[120px]">{term.en}</span>
                    <span class="text-gray-300 text-sm">{term.definition}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
    </tsx>
}
