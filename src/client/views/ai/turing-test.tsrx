/**
 * Turing Test View
 * Interactive Turing Test game with chat, judging, and leaderboard.
 */

import { createSignal, For, Show, onMount, createEffect } from "solid-js";

export component TuringTest() {
  const [phase, setPhase] = createSignal<string>("lobby");
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [messages, setMessages] = createSignal<{ sender: string; content: string; isOwn: boolean }[]>([]);
  const [input, setInput] = createSignal("");
  const [round, setRound] = createSignal(1);
  const [maxRounds] = createSignal(3);
  const [scores, setScores] = createSignal<any[]>([]);
  const [judgeGuess, setJudgeGuess] = createSignal("");
  const [judgeConfidence, setJudgeConfidence] = createSignal(50);
  const [leaderboard, setLeaderboard] = createSignal<any[]>([]);

  onMount(loadLeaderboard);

  async function loadLeaderboard() {
    try {
      const res = await fetch("/api/turing-test/leaderboard");
      const data = await res.json();
      setLeaderboard(data.data || []);
    } catch {}
  }

  async function createSession() {
    try {
      const res = await fetch("/api/turing-test/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_" + Date.now(), displayName: "Player", maxRounds: maxRounds() }),
      });
      const data = await res.json();
      setSessionId(data.data.sessionId);

      // Auto-join and start
      await fetch(`/api/turing-test/session/${data.data.sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_" + Date.now(), displayName: "Player" }),
      });
      await fetch(`/api/turing-test/session/${data.data.sessionId}/start`, { method: "POST" });
      setPhase("playing");
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMessage() {
    if (!input().trim() || !sessionId()) return;
    const text = input();
    setInput("");

    setMessages((prev) => [...prev, { sender: "You", content: text, isOwn: true }]);

    try {
      const res = await fetch(`/api/turing-test/session/${sessionId()}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: "user", content: text }),
      });
      const data = await res.json();
      const msgs = data.data.messages || [];
      // Show bot reply
      const botMsgs = msgs.filter((m: any) => m.role === "ai");
      if (botMsgs.length > 0) {
        const lastBot = botMsgs[botMsgs.length - 1];
        setMessages((prev) => [...prev, { sender: "Opponent", content: lastBot.content, isOwn: false }]);
      }
    } catch {}
  }

  async function submitJudge() {
    if (!sessionId()) return;
    try {
      const res = await fetch(`/api/turing-test/session/${sessionId()}/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judgeId: "user",
          humanGuess: judgeGuess() || "bot_ai",
          confidence: judgeConfidence() / 100,
          reasoning: "Based on response patterns",
        }),
      });
      const data = await res.json();
      if (data.data.status === "completed") {
        setScores(data.data.scores || []);
        setPhase("results");
        loadLeaderboard();
      } else {
        setRound((r) => r + 1);
        setMessages([]);
        setPhase("playing");
      }
    } catch {}
  }

  <tsx>
    <div class="p-6 max-w-4xl mx-auto text-white">
      <h1 class="text-3xl font-bold mb-2">🧪 Phép thử Turing (Turing Test)</h1>
      <p class="text-gray-400 mb-8">Chat với một đối tượng. Bạn có thể đoán đó là Người hay AI?</p>

      {/* Lobby Phase */}
      <Show when={phase() === "lobby"}>
        <div class="bg-gray-900 rounded-xl p-8 text-center space-y-6">
          <div class="text-6xl mb-4">🤖 ↔️ 👤</div>
          <h2 class="text-2xl font-semibold">Sẵn sàng thử nghiệm?</h2>
          <p class="text-gray-400">Bạn sẽ tham gia một cuộc trò chuyện ẩn danh. Đối phương có thể là một người thật hoặc hệ thống Rottra AI. Nhiệm vụ của bạn là tìm ra sự thật.</p>
          <button
            class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg transition-all hover:scale-105"
            onClick={createSession}
          >
            Bắt đầu Session
          </button>
        </div>
      </Show>

      {/* Playing Phase */}
      <Show when={phase() === "playing"}>
        <div class="flex flex-col h-[600px] bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
          <div class="p-4 bg-gray-800 flex justify-between items-center border-b border-gray-700">
            <div>
              <span class="font-bold">Session: {sessionId()}</span>
              <span class="text-gray-400 text-sm ml-4">Vòng {round()}/{maxRounds()}</span>
            </div>
            <button
              class="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-1 rounded text-sm"
              onClick={() => setPhase("judging")}
            >
              Kết thúc Chat & Đánh giá
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <For each={messages()}>
              {(msg) => (
                <div class={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                  <div class={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.isOwn ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"}`}>
                    <p class="text-xs opacity-50 mb-1">{msg.sender}</p>
                    <p>{msg.content}</p>
                  </div>
                </div>
              )}
            </For>
            <Show when={messages().length === 0}>
              <div class="text-center text-gray-500 mt-20">
                Hãy bắt đầu cuộc trò chuyện. Gửi "Xin chào" để xem đối phương phản hồi ra sao.
              </div>
            </Show>
          </div>

          <div class="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
            <input
              class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="Nhập tin nhắn..."
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
              onClick={sendMessage}
            >
              Gửi
            </button>
          </div>
        </div>
      </Show>

      {/* Judging Phase */}
      <Show when={phase() === "judging"}>
        <div class="bg-gray-900 rounded-xl p-8 space-y-8 max-w-2xl mx-auto mt-10">
          <div class="text-center">
            <h2 class="text-2xl font-semibold text-white mb-2">Đến lúc quyết định</h2>
            <p class="text-gray-400">Dựa vào cuộc trò chuyện vừa rồi, bạn nghĩ đối phương là ai?</p>
          </div>

          <div class="flex gap-4 justify-center">
            <button
              class={`flex-1 py-8 rounded-xl border-2 transition-all ${judgeGuess() === "human" ? "border-blue-500 bg-blue-500/20" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}
              onClick={() => setJudgeGuess("human")}
            >
              <div class="text-4xl mb-2">👤</div>
              <div class="font-semibold text-white">Con người</div>
            </button>
            <button
              class={`flex-1 py-8 rounded-xl border-2 transition-all ${judgeGuess() === "bot_ai" ? "border-green-500 bg-green-500/20" : "border-gray-700 bg-gray-800 hover:border-gray-500"}`}
              onClick={() => setJudgeGuess("bot_ai")}
            >
              <div class="text-4xl mb-2">🤖</div>
              <div class="font-semibold text-white">Rottra AI</div>
            </button>
          </div>

          <div class="space-y-2">
            <label class="text-gray-300 text-sm">Mức độ tự tin: {judgeConfidence()}%</label>
            <input
              type="range"
              min="0"
              max="100"
              class="w-full"
              value={judgeConfidence()}
              onInput={(e) => setJudgeConfidence(Number(e.currentTarget.value))}
            />
          </div>

          <button
            class="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold disabled:opacity-50"
            onClick={submitJudge}
            disabled={!judgeGuess()}
          >
            Gửi Phán đoán
          </button>
        </div>
      </Show>

      {/* Results */}
      <Show when={phase() === "results"}>
        <div class="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 class="text-xl font-semibold">Kết quả</h2>
          <For each={scores()}>
            {(s) => (
              <div class="bg-gray-800 rounded-lg p-4 flex justify-between">
                <span class="text-white">{s.displayName}</span>
                <span class="text-green-400">{s.totalScore} điểm | {s.roundsWon} vòng thắng</span>
              </div>
            )}
          </For>
          <button
            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm"
            onClick={() => { setPhase("lobby"); setMessages([]); setRound(1); }}
          >
            Chơi lại
          </button>
        </div>
      </Show>

      {/* Leaderboard */}
      <div class="mt-8 bg-gray-900 rounded-xl p-6">
        <h2 class="text-xl font-semibold mb-4">Bảng xếp hạng</h2>
        <Show when={leaderboard().length > 0} fallback={<p class="text-gray-500">Chưa có dữ liệu.</p>}>
          <div class="space-y-2">
            <For each={leaderboard()}>
              {(entry, i) => (
                <div class="flex justify-between items-center py-2 border-b border-gray-800">
                  <div class="flex items-center gap-3">
                    <span class="text-gray-500 w-6">#{i() + 1}</span>
                    <span class="text-white">{entry.displayName || entry.userId}</span>
                  </div>
                  <span class="text-blue-400">{entry.totalScore} điểm</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
    </tsx>
}
