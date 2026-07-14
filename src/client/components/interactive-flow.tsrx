import { Deterministic, Secure } from "~/shared/utils/rng";
import { createSignal, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { getBezierPath, Position } from "@xyflow/system";

export component InteractiveFlow(props: any) {
  interface SwarmNode {
    id: string;
    type: "sensor" | "drone" | "controller" | "pump";
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    battery?: number;
    value?: string;
    status: "online" | "warning" | "offline";
  }

  interface SwarmEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
  }

  // --- Reactive States (Using SolidJS Stores for Fine-Grained Performance) ---
  const [nodes, setNodes] = createStore<SwarmNode[]>([
    {
      id: "weather-station",
      type: "sensor",
      label: "Trạm Khí tượng Cực bộ",
      x: 100,
      y: 150,
      width: 220,
      height: 120,
      value: "Ẩm độ: 78% | Temp: 28.5°C",
      status: "online",
    },
    {
      id: "swarm-dispatcher",
      type: "controller",
      label: "Bộ Điều phối Swarm ProMax",
      x: 450,
      y: 180,
      width: 240,
      height: 120,
      value: "CPU: 42% | Thread: 12",
      status: "online",
    },
    {
      id: "drone-leader",
      type: "drone",
      label: "Thiết bị Drone Dẫn đường",
      x: 800,
      y: 80,
      width: 220,
      height: 120,
      battery: 89,
      value: "GPS: 10.77, 106.68",
      status: "online",
    },
    {
      id: "drone-follower",
      type: "drone",
      label: "Thiết bị Drone Vệ tinh",
      x: 800,
      y: 280,
      width: 220,
      height: 120,
      battery: 74,
      value: "GPS: 10.78, 106.69",
      status: "online",
    },
    {
      id: "irrigation-pump",
      type: "pump",
      label: "Hệ thống Bơm Thông minh",
      x: 460,
      y: 400,
      width: 220,
      height: 120,
      value: "Lưu lượng: 12 L/m",
      status: "online",
    },
  ]);

  const [edges, setEdges] = createStore<SwarmEdge[]>([
    { id: "e1", source: "weather-station", target: "swarm-dispatcher" },
    { id: "e2", source: "swarm-dispatcher", target: "drone-leader" },
    { id: "e3", source: "swarm-dispatcher", target: "drone-follower" },
    { id: "e4", source: "swarm-dispatcher", target: "irrigation-pump" },
  ]);

  // Viewport navigation
  const [scale, setScale] = createSignal<number>(1);
  const [panX, setPanX] = createSignal<number>(0);
  const [panY, setPanY] = createSignal<number>(0);
  const [isLocked, setIsLocked] = createSignal<boolean>(false);

  // Drag states
  let isDraggingCanvas = false;
  let dragStart = { x: 0, y: 0 };
  let activeNodeId: string | null = null;
  let nodeDragOffset = { x: 0, y: 0 };

  // Port connection state
  const [activePortSource, setActivePortSource] = createSignal<string | null>(null);

  // Telemetry loop
  let telemetryInterval: any;

  onMount(() => {
    // Periodically update telemetry metrics to keep UI alive and ticking
    telemetryInterval = setInterval(() => {
      setNodes((node) => true, (node) => {
        if (node.type === "drone") {
          const nextBat = Math.max(5, (node.battery ?? 100) - (Deterministic.random() > 0.7 ? 1 : 0));
          return {
            battery: nextBat,
            status: nextBat < 15 ? "warning" : "online",
          };
        } else if (node.type === "sensor") {
          const rh = Math.floor(70 + Deterministic.random() * 15);
          const temp = (25 + Deterministic.random() * 6).toFixed(1);
          return { value: `Ẩm độ: ${rh}% | Temp: ${temp}°C` };
        } else if (node.type === "controller") {
          const cpu = Math.floor(30 + Deterministic.random() * 30);
          return { value: `CPU: ${cpu}% | Thread: 12` };
        } else if (node.type === "pump") {
          const flow = (10 + Deterministic.random() * 5).toFixed(1);
          return { value: `Lưu lượng: ${flow} L/m` };
        }
        return {};
      });
    }, 3000);
  });

  onCleanup(() => {
    if (telemetryInterval) clearInterval(telemetryInterval);
  });

  // --- Helper to add new node ---
  const addNode = (type: SwarmNode["type"]) => {
    const id = `${type}-${Secure.uuid().split("-")[0]}`;
    let label = "Thiết bị mới";
    let width = 220;
    let height = 120;
    let value = "Chưa kết nối";

    if (type === "sensor") {
      label = "Cảm biến Độ ẩm Đất";
      value = "Độ ẩm: 45%";
    } else if (type === "drone") {
      label = "Drone Swarm Mới";
      value = "Battery: 100%";
    } else if (type === "controller") {
      label = "Bộ xử lý Mạng lưới";
      value = "CPU: 0%";
    } else if (type === "pump") {
      label = "Van tưới tự động";
      value = "Trạng thái: Đóng";
    }

    // Spawn near center
    const newNode: SwarmNode = {
      id,
      type,
      label,
      x: 300 + Deterministic.random() * 100 - 50 - panX(),
      y: 200 + Deterministic.random() * 100 - 50 - panY(),
      width,
      height,
      battery: type === "drone" ? 100 : undefined,
      status: "online",
      value,
    };

    setNodes([...nodes, newNode]);
  };

  // --- Helper to delete node ---
  const deleteNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
    setEdges(edges.filter((e) => e.source !== id && e.target !== id));
    if (activePortSource() === id) setActivePortSource(null);
  };

  // --- Helper to delete edge ---
  const deleteEdge = (edgeId: string) => {
    setEdges(edges.filter((e) => e.id !== edgeId));
  };

  // --- Handle port clicks to connect ---
  const handlePortClick = (nodeId: string, isOutput: boolean) => {
    if (isOutput) {
      // Set source
      setActivePortSource(nodeId);
    } else {
      // Set target and connect
      const source = activePortSource();
      if (source && source !== nodeId) {
        // Prevent duplicate connection
        const exists = edges.some((e) => e.source === source && e.target === nodeId);
        if (!exists) {
          const newEdge: SwarmEdge = {
            id: `edge-${Secure.uuid().split("-")[0]}`,
            source,
            target: nodeId,
          };
          setEdges([...edges, newEdge]);
        }
      }
      setActivePortSource(null);
    }
  };

  // --- Wheel Zoom ---
  const handleWheel = (e: WheelEvent) => {
    if (isLocked()) return;
    e.preventDefault();
    const zoomFactor = 1.1;
    const newScale =
      e.deltaY < 0 ? scale() * zoomFactor : scale() / zoomFactor;
    setScale(Math.max(0.2, Math.min(3, newScale)));
  };

  // --- Canvas Panning & Node Dragging Mouse Handlers ---
  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const nodeEl = target.closest("[data-node-id]");

    if (nodeEl) {
      // Clicked on a Node -> Start Dragging Node
      const nodeId = nodeEl.getAttribute("data-node-id")!;
      activeNodeId = nodeId;
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        // Adjust for current scale
        nodeDragOffset = {
          x: e.clientX / scale() - node.x,
          y: e.clientY / scale() - node.y,
        };
      }
    } else if (target.closest(".flow-grid-bg") || target.closest(".flow-viewport")) {
      // Clicked on background canvas -> Start Panning
      isDraggingCanvas = true;
      dragStart = { x: e.clientX - panX(), y: e.clientY - panY() };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (activeNodeId) {
      const targetId = activeNodeId;
      setNodes((n) => n.id === targetId, {
        x: Math.round(e.clientX / scale() - nodeDragOffset.x),
        y: Math.round(e.clientY / scale() - nodeDragOffset.y),
      });
    } else if (isDraggingCanvas) {
      // Update canvas panning coordinates
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    activeNodeId = null;
    isDraggingCanvas = false;
  };

  // --- Edge Path Drawer (TSRX statement-based JSX) ---
  const renderEdge = (edge: SwarmEdge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) return;

    const sourceX = sourceNode.x + sourceNode.width;
    const sourceY = sourceNode.y + sourceNode.height / 2;

    const targetX = targetNode.x;
    const targetY = targetNode.y + targetNode.height / 2;

    // Call @xyflow/system bezier math utility
    const [path] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
      curvature: 0.25,
    });

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    <g class="group">
      <path
        d={path}
        fill="none"
        stroke="rgba(168, 85, 247, 0.15)"
        stroke-width="12"
        class="transition-opacity duration-300 opacity-0 group-hover:opacity-100"
      />
      <path
        d={path}
        fill="none"
        stroke="#a855f7"
        stroke-width="3"
        stroke-dasharray="6,4"
        class="animate-dash"
        style={{ "stroke-dashoffset": "0" }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        stroke-width="20"
        class="cursor-pointer"
        onClick={() => {
          if (confirm("Xóa dây nối này?")) deleteEdge(edge.id);
        }}
        title="Bấm để xóa liên kết"
      />
      <foreignObject
        x={midX - 10}
        y={midY - 10}
        width="20"
        height="20"
        class="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={() => deleteEdge(edge.id)}
          class="w-5 h-5 bg-purple-600 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md transform active:scale-90"
          title="Xóa dây nối">
          {"x"}
        </button>
      </foreignObject>
    </g>
  };

  {/* Main component markup block directly as a statement in TSRX */}
  <div
    class="flex flex-col w-full h-[650px] bg-slate-950 border border-purple-500/20 rounded-3xl overflow-hidden shadow-2xl relative select-none animate-in fade-in duration-300">
    {/* Top action toolbar */}
    <div
      class="flex flex-wrap justify-between items-center px-6 py-4 bg-slate-900/80 border-b border-purple-500/10 backdrop-blur-md z-10 gap-3">
      <div class="flex items-center gap-3">
        <span class="flex h-3 w-3 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
        </span>
        <span class="text-xs font-extrabold text-purple-200 tracking-wide uppercase">{"Bản đồ điều phối Swarm tương tác (SolidJS)"}</span>
      </div>

      {/* Toolbar Buttons */}
      <div class="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => addNode("sensor")}
          class="text-xs px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/60 text-purple-300 font-bold rounded-lg border border-purple-500/20 active:scale-95 transition-all duration-150">
          {"+ Cảm biến"}
        </button>
        <button
          onClick={() => addNode("drone")}
          class="text-xs px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/60 text-purple-300 font-bold rounded-lg border border-purple-500/20 active:scale-95 transition-all duration-150">
          {"+ Drone"}
        </button>
        <button
          onClick={() => addNode("controller")}
          class="text-xs px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/60 text-purple-300 font-bold rounded-lg border border-purple-500/20 active:scale-95 transition-all duration-150">
          {"+ Controller"}
        </button>
        <button
          onClick={() => addNode("pump")}
          class="text-xs px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/60 text-purple-300 font-bold rounded-lg border border-purple-500/20 active:scale-95 transition-all duration-150">
          {"+ Van/Bơm"}
        </button>
        <div class="h-4 w-px bg-white/10 mx-1" />
        <button
          onClick={() => setIsLocked(!isLocked())}
          class={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all active:scale-95 duration-150 ${
            isLocked()
              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
              : "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20"
          }`}>
          {isLocked() ? "🔒 Khóa Zoom" : "🔓 Mở Zoom"}
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPanX(0);
            setPanY(0);
          }}
          class="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-lg border border-white/5 active:scale-95 transition-all duration-150">
          {"Reset View"}
        </button>
      </div>
    </div>

    {/* Floating hints overlay */}
    if (activePortSource()) {
      <div
        class="absolute bottom-4 left-6 bg-purple-600/90 text-white text-xs px-4 py-2 rounded-full font-bold shadow-lg animate-bounce z-20">
        {"👉 Click vào cổng đầu vào (Input) của một Node khác để tạo đường kết nối..."}
      </div>
    }

    {/* Interactive viewport container */}
    <div
      class="flex-1 w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing flow-viewport"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}>
      {/* Dot pattern background */}
      <div
        class="absolute inset-0 flow-grid-bg"
        style={{
          "background-image": "radial-gradient(rgba(168, 85, 247, 0.12) 1px, transparent 1px)",
          "background-size": "24px 24px",
          transform: `translate(${panX()}px, ${panY()}px) scale(${scale()})`,
          "transform-origin": "0 0",
        }}
      />

      {/* Scaled Flow Content */}
      <div
        class="w-full h-full relative"
        style={{
          transform: `translate(${panX()}px, ${panY()}px) scale(${scale()})`,
          "transform-origin": "0 0",
        }}>
        {/* SVG Edges Layer */}
        <svg class="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
          for (const edge of edges) {
            {renderEdge(edge)}
          }
        </svg>

        {/* HTML Nodes Layer */}
        <div class="absolute inset-0 pointer-events-none z-10">
          for (const node of nodes) {
            <div
              data-node-id={node.id}
              class="absolute pointer-events-auto rounded-2xl border bg-slate-900/95 shadow-2xl flex flex-col p-4 transition-all duration-100 hover:shadow-purple-500/10"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                "border-color": activePortSource() === node.id
                  ? "#a855f7"
                  : node.status === "warning"
                    ? "#f59e0b"
                    : "rgba(168, 85, 247, 0.25)",
                cursor: "grab",
              }}>
              {/* Node Header */}
              <div class="flex justify-between items-center mb-2 border-b border-white/5 pb-1">
                <span
                  class={`text-[10px] uppercase font-bold tracking-widest ${
                    node.type === "sensor"
                      ? "text-blue-400"
                      : node.type === "drone"
                        ? "text-green-400"
                        : node.type === "pump"
                          ? "text-cyan-400"
                          : "text-amber-400"
                  }`}>
                  {node.type === "sensor"
                    ? "🛰️ Cảm biến"
                    : node.type === "drone"
                      ? "🛸 Swarm Drone"
                      : node.type === "pump"
                        ? "🚰 Van/Bơm"
                        : "⚙️ Bộ Điều phối"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(node.id);
                  }}
                  class="text-gray-500 hover:text-red-400 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                  title="Xóa thiết bị">
                  {"x"}
                </button>
              </div>

              {/* Node Body */}
              <div class="flex-1 flex flex-col justify-between">
                <div>
                  <div class="text-xs font-bold text-white leading-tight truncate">
                    {node.label}
                  </div>
                  <div class="text-[10px] text-gray-400 mt-1 font-mono break-all">
                    {node.value}
                  </div>
                </div>

                {/* Telemetry/Battery indicator */}
                if (node.battery !== undefined) {
                  <div class="flex items-center gap-1.5 mt-2">
                    <div class="w-8 h-3.5 border border-white/20 rounded-md p-0.5 relative overflow-hidden flex bg-black/40">
                      <div
                        class={`h-full rounded-sm ${
                          node.battery < 20
                            ? "bg-red-500 animate-pulse"
                            : node.battery < 50
                              ? "bg-amber-500"
                              : "bg-green-500"
                        }`}
                        style={{ width: `${node.battery}%` }}
                      />
                    </div>
                    <span class="text-[10px] font-bold text-gray-300">
                      {node.battery + "%"}
                    </span>
                  </div>
                }
              </div>

              {/* LEFT Anchor Input Port */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePortClick(node.id, false);
                }}
                class={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 rounded-full border border-purple-500 cursor-pointer transition-all hover:scale-125 z-20 ${
                  activePortSource() && activePortSource() !== node.id ? "bg-purple-500 animate-ping" : "bg-slate-950"
                }`}
                title="Cổng kết nối đầu vào (Input)"
              />

              {/* RIGHT Anchor Output Port */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePortClick(node.id, true);
                }}
                class={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 w-3 h-3 rounded-full border border-purple-500 cursor-pointer transition-all hover:scale-125 z-20 ${
                  activePortSource() === node.id ? "bg-purple-500 shadow-[0_0_8px_#a855f7]" : "bg-slate-950"
                }`}
                title="Cổng kết nối đầu ra (Output)"
              />
            </div>
          }
        </div>
      </div>
    </div>

    <style>
      @keyframes dash {
        to {
          stroke-dashoffset: -20;
        }
      }
      .animate-dash {
        animation: dash 1s linear infinite;
      }
    </style>
  </div>
}
