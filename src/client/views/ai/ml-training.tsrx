/**
 * ML Training Dashboard
 * Admin panel for training ML classifiers, regressors, and clustering.
 */

import { createSignal, For, Show, onMount } from "solid-js";

const classifierTypes = [
  { value: "naive_bayes", label: "Naive Bayes" },
  { value: "knn", label: "K-Nearest Neighbors" },
  { value: "svm", label: "Support Vector Machine" },
  { value: "decision_tree", label: "Decision Tree" },
  { value: "random_forest", label: "Random Forest" },
];

export component MLTraining() {
  const [activeTab, setActiveTab] = createSignal<"classify" | "regress" | "cluster" | "auto" | "models">("classify");
  const tabLabels: Record<string, string> = { classify: "Classification", regress: "Regression", cluster: "Clustering", auto: "Auto-Train", models: "Models" };
  const [training, setTraining] = createSignal(false);
  const [result, setResult] = createSignal<any>(null);
  const [models, setModels] = createSignal<any[]>([]);

  // Classification state
  const [textInput, setTextInput] = createSignal("");
  const [labelsInput, setLabelsInput] = createSignal("");
  const [classifierType, setClassifierType] = createSignal("naive_bayes");

  // Auto-train state
  const [autoTrainResult, setAutoTrainResult] = createSignal<any>(null);

  const canTrain = () => textInput().split("\n").filter((l) => l.trim()).length >= 2;

  onMount(() => loadModels());

  async function loadModels() {
    try {
      const res = await fetch("/api/ml-pipeline/models");
      const data = await res.json();
      setModels(data.data || []);
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  }

  async function trainClassifier() {
    setTraining(true);
    try {
      const texts = textInput().split("\n").filter((l) => l.trim());
      const labels = labelsInput().split("\n").filter((l) => l.trim()).map(Number);
      if (texts.length < 2 || texts.length !== labels.length) {
        setResult({ error: "Need at least 2 samples with matching text/label counts" });
        setTraining(false);
        return;
      }
      const classNames = [...new Set(labels)].sort().map((_, i) => `class_${i}`);

      const res = await fetch("/api/ml-pipeline/classify/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts,
          labels,
          classNames,
          config: { type: classifierType(), k: 3, maxDepth: 8, numTrees: 10 },
          testSplit: 0.2,
        }),
      });
      const data = await res.json();
      setResult(data.data);
      loadModels();
    } catch (err) {
      setResult({ error: String(err) });
    }
    setTraining(false);
  }

  async function runAutoTrain() {
    setTraining(true);
    try {
      const res = await fetch("/api/ml-pipeline/auto-train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samples: [
            { utterance: "xin chào", intent: "GREETING" },
            { utterance: "hello", intent: "GREETING" },
            { utterance: "chào bạn", intent: "GREETING" },
            { utterance: "giá bao nhiêu", intent: "PRICE_QUERY" },
            { utterance: "bao nhiêu tiền", intent: "PRICE_QUERY" },
            { utterance: "cost", intent: "PRICE_QUERY" },
            { utterance: "sản phẩm này", intent: "PRODUCT_INFO" },
            { utterance: "mô tả chi tiết", intent: "PRODUCT_INFO" },
            { utterance: "tìm kiếm", intent: "SEARCH" },
            { utterance: "search for", intent: "SEARCH" },
            { utterance: "tôi buồn", intent: "PSYCHOLOGY" },
            { utterance: "dự báo giá", intent: "FORECAST" },
          ],
          config: { testSplit: 0.2, classifiers: ["naive_bayes", "knn", "decision_tree", "random_forest"] },
        }),
      });
      const data = await res.json();
      setAutoTrainResult(data.data);
      loadModels();
    } catch (err) {
      setAutoTrainResult({ error: String(err) });
    }
    setTraining(false);
  }

  <tsx>
    <div class="p-6 max-w-7xl mx-auto text-white">
      <h1 class="text-3xl font-bold mb-6">ML Training Dashboard</h1>

      {/* Tabs */}
      <div class="flex gap-2 mb-6 flex-wrap">
        <For each={["classify", "regress", "cluster", "auto", "models"] as const}>
          {(tab) => (
            <button
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab() === tab ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
              onClick={() => { setActiveTab(tab); if (tab === "models") loadModels(); }}
            >
              {tabLabels[tab]}
            </button>
          )}
        </For>
      </div>

      {/* Classification Tab */}
      <Show when={activeTab() === "classify"}>
        <div class="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 class="text-xl font-semibold">Train Classifier</h2>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Training Texts (one per line)</label>
            <textarea
              class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white h-32"
              placeholder={"xin chào\nhello\nchào bạn"}
              value={textInput()}
              onInput={(e) => setTextInput(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Labels (one per line, numeric)</label>
            <textarea
              class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white h-20"
              placeholder={"0\n0\n0"}
              value={labelsInput()}
              onInput={(e) => setLabelsInput(e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Algorithm</label>
            <select
              class="bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white"
              value={classifierType()}
              onChange={(e) => setClassifierType(e.currentTarget.value)}
            >
              <For each={classifierTypes}>
                {(ct) => <option value={ct.value}>{ct.label}</option>}
              </For>
            </select>
          </div>
          <button
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            onClick={trainClassifier}
            disabled={training() || !canTrain()}
          >
            {training() ? "Training..." : "Train"}
          </button>
          <Show when={result()}>
            <div class="bg-gray-800 rounded-lg p-4 text-sm">
              <pre class="text-green-400 overflow-x-auto">{JSON.stringify(result(), null, 2)}</pre>
            </div>
          </Show>
        </div>
      </Show>

      {/* Auto-Train Tab */}
      <Show when={activeTab() === "auto"}>
        <div class="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 class="text-xl font-semibold">Auto-Train from Training Data</h2>
          <p class="text-gray-400 text-sm">Automatically trains multiple classifiers on sample data and picks the best one.</p>
          <button
            class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            onClick={runAutoTrain}
            disabled={training()}
          >
            {training() ? "Training..." : "Run Auto-Train"}
          </button>
          <Show when={autoTrainResult()}>
            <div class="bg-gray-800 rounded-lg p-4 text-sm">
              <h3 class="text-lg font-medium text-white mb-2">Best: {autoTrainResult().best} (Accuracy: {(autoTrainResult().bestAccuracy * 100).toFixed(1)}%)</h3>
              <For each={autoTrainResult().results || []}>
                {(r) => (
                  <div class="flex justify-between py-1 border-b border-gray-700">
                    <span class="text-gray-300">{r.type}</span>
                    <span class="text-green-400">{(r.metrics.accuracy * 100).toFixed(1)}% | F1: {(r.metrics.f1Score * 100).toFixed(1)}%</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Models Tab */}
      <Show when={activeTab() === "models"}>
        <div class="bg-gray-900 rounded-xl p-6">
          <h2 class="text-xl font-semibold mb-4">Saved Models</h2>
          <button class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm mb-4" onClick={loadModels}>Refresh</button>
          <Show when={models().length > 0} fallback={<p class="text-gray-500">No models trained yet. Train one in the Classification tab first.</p>}>
            <div class="space-y-2">
              <For each={models()}>
                {(m) => (
                  <div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p class="text-white font-medium">{m.name}</p>
                      <p class="text-gray-400 text-sm">{m.algorithm} | {m.trainingSamples} samples | {m.status}</p>
                    </div>
                    <button
                      class="text-red-400 hover:text-red-300 text-sm"
                      onClick={async () => {
                        await fetch(`/api/ml-pipeline/models/${m.id}`, { method: "DELETE" });
                        loadModels();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
    </tsx>
}
