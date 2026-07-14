import { Deterministic } from "~/shared/utils/rng";
import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import { play, stop, checkCircle, arrowPath, truck, mapPin, wifi, commandLine } from "solid-heroicons/outline";

export component AgenticDispatch() {
  // State: "IDLE" | "SCANNING" | "ROUTING" | "DISPATCHED"
  const [simState, setSimState] = createSignal("IDLE");
  const [logs, setLogs] = createSignal<string[]>([]);
  const [activeNode, setActiveNode] = createSignal<number | null>(null);
  const [activeEdge, setActiveEdge] = createSignal<string | null>(null);

  // Mạng lưới các trạm/kho hàng giả lập (Nodes)
  const nodes = [
    { id: 1, name: "Kho A (Thiếu hụt)", x: 20, y: 30, type: "target" },
    { id: 2, name: "Trạm Trung Chuyển", x: 50, y: 50, type: "transit" },
    { id: 3, name: "Kho B (Dự trữ)", x: 80, y: 20, type: "source" },
    { id: 4, name: "Siêu thị C", x: 70, y: 80, type: "market" },
    { id: 5, name: "Kho Cảng D", x: 30, y: 70, type: "source" },
  ];

  // Các tuyến đường giả lập (Edges)
  const edges = [
    { id: "e1", from: 1, to: 2, dist: 15 },
    { id: "e2", from: 2, to: 3, dist: 20 },
    { id: "e3", from: 2, to: 4, dist: 10 },
    { id: "e4", from: 2, to: 5, dist: 25 },
    { id: "e5", from: 3, to: 4, dist: 30 },
    { id: "e6", from: 1, to: 5, dist: 18 },
  ];

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startSimulation = () => {
    if (simState() !== "IDLE") return;

    setLogs([]);
    setSimState("SCANNING");
    addLog("PHÁT HIỆN SỰ CỐ: Kho A đang thiếu hụt 5 Tấn Cà chua.");
    addLog("KÍCH HOẠT HỆ THỐNG TỰ HÀNH: Bắt đầu quét mạng lưới PostgreSQL (Inventory Radar)...");

    // Giai đoạn 1: Quét Radar
    let scanIndex = 0;
    const scanInterval = setInterval(() => {
      if (scanIndex < nodes.length) {
        setActiveNode(nodes[scanIndex].id);
        scanIndex++;
      } else {
        clearInterval(scanInterval);
        setActiveNode(3); // Chốt Kho B
        addLog("TÌM THẤY NGUỒN CUNG: Kho B đang dư thừa 8 Tấn Cà chua.");

        // Giai đoạn 2: Tính toán đường đi (Routing)
        setSimState("ROUTING");
        addLog("CHẠY THUẬT TOÁN WARDROP & TSP: Tính toán lộ trình không tắc nghẽn...");

        setTimeout(() => setActiveEdge("e2"), 500); // Kho B -> Trạm Trung Chuyển
        setTimeout(() => setActiveEdge("e1"), 1500); // Trạm Trung Chuyển -> Kho A

        setTimeout(() => {
          // Giai đoạn 3: Phân lệnh
          setSimState("DISPATCHED");
          addLog("TỐI ƯU HOÀN TẤT: Chọn lộ trình Kho B -> Trạm -> Kho A (Tổng: 35km).");
          addLog(`SINH LỆNH ĐIỀU PHỐI: #ORD-AG-${Math.floor(Deterministic.random() * 10000)}`);
          addLog("HÀNH ĐỘNG: Đã gửi thông báo cho Tài xế Nguyễn Văn A. Xe tải đang di chuyển!");
        }, 3000);
      }
    }, 400);
  };

  const resetSimulation = () => {
    setSimState("IDLE");
    setLogs([]);
    setActiveNode(null);
    setActiveEdge(null);
  };

  <tsx>
    <div class={`h-full flex flex-col p-6 space-y-6 ${theme() === "dark" ? "text-gray-100" : "text-gray-800"}`}>
      {}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            class="text-3xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-500 flex items-center gap-3">
            <Icon path={wifi} class="w-8 h-8 text-indigo-500" />
            Điều Phối Tự Hành (Agentic Dispatch)
          </h1>
          <p
            class={`mt-2 ${
              theme() === "dark" ? "text-gray-400" : "text-gray-600"
            }`}>Hệ thống Tự trị (Autonomous Workflow) sử dụng thuật toán Wardrop và TSP để cân bằng chuỗi cung ứng thời gian thực.</p>
        </div>
        <div class="flex gap-3">
          <button
            onClick={resetSimulation}
            disabled={simState() === "IDLE" || simState() === "SCANNING" || simState() === "ROUTING"}
            class="px-4 py-2 rounded-xl border border-gray-500 flex items-center gap-2 hover:bg-gray-500/20 transition-all disabled:opacity-50">
            <Icon path={arrowPath} class="w-5 h-5" />
            Đặt lại
          </button>
          <button
            onClick={startSimulation}
            disabled={simState() !== "IDLE"}
            class="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {simState() === "IDLE"
              ? <>
                  <Icon path={play} class="w-5 h-5" />
                  Kích Hoạt Tự Hành
                </>
              : <>
                  <Icon path={arrowPath} class="w-5 h-5 animate-spin" />
                  Đang Xử Lý...
                </>}
          </button>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {}
        <div
          class={`col-span-1 lg:col-span-2 rounded-3xl border overflow-hidden relative flex flex-col ${
            theme() === "dark" ? "bg-[#0d1117] border-gray-800" : "bg-slate-50 border-gray-200"
          }`}>
          <div class="absolute top-4 left-4 z-10 flex gap-2">
            <span
              class={`px-3 py-1 text-xs font-bold rounded-full border backdrop-blur-md ${
                simState() === "SCANNING"
                  ? "bg-amber-500/20 text-amber-500 border-amber-500/50 animate-pulse"
                  : simState() === "ROUTING"
                    ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/50 animate-pulse"
                    : simState() === "DISPATCHED"
                      ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50"
                      : theme() === "dark"
                        ? "bg-gray-800/50 text-gray-400 border-gray-700"
                        : "bg-white/50 text-gray-500 border-gray-300"
              }`}>
              Trạng thái:
              {simState()}
            </span>
          </div>
          <div class="flex-1 relative w-full h-full p-4">
            {}
            <svg class="absolute inset-0 w-full h-full pointer-events-none" style="filter: drop-shadow(0 0 10px rgba(0,0,0,0.5))">
              {}
              <For each={edges}>
                {(edge) => {
                  const n1 = nodes.find((n) => n.id === edge.from);
                  const n2 = nodes.find((n) => n.id === edge.to);
                  if (!n1 || !n2) return null;

                  const isActive = activeEdge() === edge.id || simState() === "DISPATCHED" && (edge.id === "e1" || edge.id === "e2");

                  return <g>
                    {}
                    <line
                      x1={`${n1.x}%`}
                      y1={`${n1.y}%`}
                      x2={`${n2.x}%`}
                      y2={`${n2.y}%`}
                      stroke={theme() === "dark" ? "#1f2937" : "#e5e7eb"}
                      stroke-width="2"
                    />
                    {}
                    <line
                      x1={`${n1.x}%`}
                      y1={`${n1.y}%`}
                      x2={`${n2.x}%`}
                      y2={`${n2.y}%`}
                      stroke={isActive ? "#06b6d4" : "transparent"}
                      stroke-width="4"
                      class="transition-all duration-1000"
                      stroke-dasharray="100"
                      stroke-dashoffset={isActive ? "0" : "100"}
                      style={isActive ? "animation: dash 2s linear forwards;" : ""}
                    />
                  </g>;
                }}
              </For>
            </svg>
            {}
            <For each={nodes}>
              {(node) => {
                const isActiveScan = simState() === "SCANNING" && activeNode() === node.id;
                const isTarget = node.id === 1;
                const isSource = node.id === 3;

                let nodeColor =
                  theme() === "dark" ? "bg-gray-800 border-gray-600" : "bg-white border-gray-400";
                let textColor =
                  theme() === "dark" ? "text-gray-300" : "text-gray-600";

                if (isTarget && simState() !== "IDLE") {
                  nodeColor = "bg-rose-500/20 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]";
                  textColor = "text-rose-500";
                } else if (isSource && (simState() === "ROUTING" || simState() === "DISPATCHED" || activeNode() === 3)) {
                  nodeColor = "bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]";
                  textColor = "text-emerald-500";
                }

                return <div
                  class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-300"
                  style={`left: ${node.x}%; top: ${node.y}%;`}>
                  <div class={`relative w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 ${nodeColor}`}>
                    {isActiveScan && <div class="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-75"></div>}
                    {node.type === "transit"
                      ? <Icon path={arrowPath} class={`w-4 h-4 ${textColor}`} />
                      : <Icon path={mapPin} class={`w-4 h-4 ${textColor}`} />}
                  </div>
                  <span
                    class={`text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm border ${
                      theme() === "dark" ? "bg-black/50 border-white/10" : "bg-white/80 border-gray-200"
                    } ${textColor}`}>
                    {node.name}
                  </span>
                  {}
                  <Show when={simState() === "DISPATCHED" && node.id === 2}>
                    <div class="absolute -top-10 text-cyan-400 animate-bounce">
                      <Icon path={truck} class="w-8 h-8 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                    </div>
                  </Show>
                </div>;
              }}
            </For>
            {}
            <style>
              {`
                @keyframes dash {
                  to { stroke-dashoffset: 0; }
                }
              `}
            </style>
          </div>
        </div>
        {}
        <div
          class={`col-span-1 rounded-3xl border flex flex-col overflow-hidden ${
            theme() === "dark" ? "bg-[#0a0a0a] border-gray-800" : "bg-slate-900 border-slate-700"
          }`}>
          <div class="p-3 border-b border-white/10 flex items-center gap-2 bg-white/5">
            <Icon path={commandLine} class="w-5 h-5 text-gray-400" />
            <span class="text-sm font-mono font-bold text-gray-300">Agentic Terminal</span>
          </div>
          <div class="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-3">
            <Show when={logs().length === 0}>
              <div class="text-gray-600 italic">Waiting for simulation...</div>
            </Show>
            <For each={logs()}>
              {(log) => <div
                class={`leading-relaxed animate-in slide-in-from-left-2 ${
                  log.includes("PHÁT HIỆN")
                    ? "text-rose-400"
                    : log.includes("TÌM THẤY") || log.includes("TỐI ƯU HOÀN TẤT")
                      ? "text-emerald-400"
                      : log.includes("SINH LỆNH")
                        ? "text-amber-400 font-bold"
                        : "text-cyan-400"
                }`}>{log}</div>}
            </For>
            <Show when={simState() !== "IDLE" && simState() !== "DISPATCHED"}>
              <div class="flex items-center gap-2 text-gray-500 mt-4">
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-ping"></div>
                Agent is thinking...
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  </tsx>
}
