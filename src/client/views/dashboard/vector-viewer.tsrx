import { createSignal, onMount, onCleanup, createEffect, For, Show } from "solid-js";
import { Icon } from "solid-heroicons";
import { map, play, pause, cpuChip, adjustmentsHorizontal, chartBar, documentText } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { TREE_OF_LIFE } from "./ai-flow.tsrx";

interface EventLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn';
}

interface ConstellationNode {
  x: number;
  y: number;
  id: string;
  label: string;
  color: string;
  depth: number;
}

interface ThoughtStream {
  id: string;
  loss: number;
  angle: number;
  label: string;
  status: 'learning' | 'converged' | 'diverged';
  history: Array<{loss: number, angle: number}>;
}

export component VectorViewer() {
  let canvasRef: HTMLCanvasElement | undefined;
  let animationId: number;
  let ws: WebSocket | undefined;
  let simInterval: any;
  
  const [isPlaying, setIsPlaying] = createSignal(true);
  const [isSimulated, setIsSimulated] = createSignal(false);
  const [streams, setStreams] = createSignal<Map<string, ThoughtStream>>(new Map());
  const [activeThoughts, setActiveThoughts] = createSignal(0);
  const [logs, setLogs] = createSignal<EventLog[]>([]);
  const [lossHistory, setLossHistory] = createSignal<number[]>([]);
  const [nodeStatus, setNodeStatus] = createSignal<Record<string, number>>({});

  const addLog = (msg: string, type: EventLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'});
    setLogs(prev => [{time, message: msg, type}, ...prev].slice(0, 20));
  };
  
  // Real 49-Node Constellation from Tree of Life
  let constellationNodes: ConstellationNode[] = [];

  const initConstellation = (width: number, height: number, maxRadius: number) => {
    constellationNodes = [];
    const cx = width / 2;
    const cy = height / 2;

    const layoutNode = (node: any, depth: number, angleStart: number, angleEnd: number) => {
      const angle = (angleStart + angleEnd) / 2;
      const radius = depth === 0 ? 0 : (depth === 1 ? maxRadius * 0.46 : maxRadius * 0.95);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      constellationNodes.push({ x, y, id: node.id, label: node.label, color: node.color, depth });

      if (node.children && node.children.length > 0) {
        const childCount = node.children.length;
        const angleStep = (angleEnd - angleStart) / childCount;
        node.children.forEach((child: any, i: number) => {
          const childAngleStart = angleStart + i * angleStep;
          const childAngleEnd = childAngleStart + angleStep;
          layoutNode(child, depth + 1, childAngleStart, childAngleEnd);
        });
      }
    };

    layoutNode(TREE_OF_LIFE, 0, 0, Math.PI * 2);
  };

  const handleVectorTracking = (data: any) => {
    setStreams(prev => {
      const next = new Map(prev);
      const existing = next.get(data.id);
      
      if (existing) {
        existing.history.push({ loss: existing.loss, angle: existing.angle });
        if (existing.history.length > 50) existing.history.shift();
        
        existing.loss = data.loss;
        existing.angle = data.angle;
        existing.label = data.label || existing.label;
        existing.status = data.status || existing.status;
        
        if (data.loss < 0.05 && existing.status !== 'converged') {
          addLog(`[CONVERGED] ${existing.label} -> Loss: ${data.loss.toFixed(4)}`, 'success');
          existing.status = 'converged';
        }

        if (existing.status === 'converged' || data.loss < 0.02) {
          setTimeout(() => {
            setStreams(curr => {
              const updated = new Map(curr);
              updated.delete(data.id);
              setActiveThoughts(updated.size);
              return updated;
            });
          }, 3000);
        }
      } else {
        addLog(`[INIT] Khởi tạo luồng: ${data.label || 'Reasoning'}`, 'info');
        next.set(data.id, {
          id: data.id,
          loss: data.loss,
          angle: data.angle,
          label: data.label || "Unknown Process",
          status: data.status || "learning",
          history: []
        });
      }
      setActiveThoughts(next.size);
      
      // Update global loss history chart data
      if (next.size > 0) {
        const minLoss = Math.min(...Array.from(next.values()).map(s => s.loss));
        if (minLoss < 1) {
          setLossHistory(prev => {
            const h = [...prev, minLoss];
            if (h.length > 40) h.shift();
            return h;
          });
        }
      }
      
      return next;
    });
  };

  // Trigger a REAL thought stream by invoking the backend chat pipeline
  const triggerRealThought = async () => {
    addLog("Đang gửi yêu cầu kích hoạt nơ-ron thật tới Backend...", "info");
    try {
      const res = await fetch("/api/agent/pipeline/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: "Kiểm tra hệ thống nơ-ron và bộ nhớ Hồi hải mã",
          sessionId: "telemetry-test-" + Math.random().toString(36).substring(2, 6)
        })
      });
      if (res.ok) {
        const data = await res.json();
        addLog(`[HỆ THỐNG THẬT] Phản hồi: ${data.reply.substring(0, 30)}...`, "success");
      } else {
        addLog("Backend trả về lỗi khi chạy luồng thật.", "warn");
      }
    } catch (err) {
      addLog("Không kết nối được API Backend để chạy luồng thật.", "warn");
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.44;

    if (constellationNodes.length === 0) initConstellation(width, height, maxRadius);
    
    // Smooth clear trail
    ctx.fillStyle = theme() === "dark" ? "rgba(10, 10, 10, 0.2)" : "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(0, 0, width, height);
    
    // 1. Draw Real Constellation Nodes & Edges (Nervous System Connections)
    const statusMap = nodeStatus();
    
    // Draw edges first
    ctx.strokeStyle = theme() === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i < constellationNodes.length; i++) {
      const n1 = constellationNodes[i];
      if (n1.depth !== 2) continue; // Only link leaf nodes to their branches or nearby
      
      const parent = constellationNodes.find(p => p.depth === 1 && p.color === n1.color);
      if (parent) {
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(n1.x, n1.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    constellationNodes.forEach(node => {
      if (node.depth === 0) return; // Skip root to not clash with global min
      
      let isActive = true;
      if (node.depth === 2) {
        const status = statusMap[node.id];
        isActive = status !== undefined ? status > 0 : true;
      }
      
      const nodeColor = isActive ? node.color : (theme() === "dark" ? "#1e293b" : "#e2e8f0");
      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.depth === 1 ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();

      // Pulse for active nodes
      if (isActive && node.depth === 2) {
        ctx.strokeStyle = nodeColor + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4 + Math.sin(time * 0.005 + node.x) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    
    // 2. Convergence Rings
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(r => {
      ctx.strokeStyle = theme() === "dark" 
        ? `rgba(255, 255, 255, ${0.08 - r * 0.04})` 
        : `rgba(0, 0, 0, ${0.08 - r * 0.04})`;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * r, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = theme() === "dark" ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.4)";
      ctx.font = "9px monospace";
      ctx.fillText(`L=${r.toFixed(1)}`, cx + maxRadius * r + 4, cy - 2);
    });
    
    // Global Minimum Core Glow
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    coreGlow.addColorStop(0, theme() === "dark" ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.15)");
    coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + Math.sin(time * 0.004) * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 3. Thought Streams Drawing
    const currentStreams = Array.from(streams().values());
    currentStreams.forEach(stream => {
      const getPos = (l: number, a: number) => ({
        x: cx + Math.cos(a) * (l * maxRadius),
        y: cy + Math.sin(a) * (l * maxRadius)
      });
      
      const currentPos = getPos(stream.loss, stream.angle);
      const isConverged = stream.status === 'converged';
      const color = isConverged ? "#10b981" : "#3b82f6"; // Green if converged, Blue if learning
      
      // Draw path line
      if (stream.history.length > 0) {
        ctx.beginPath();
        const start = getPos(stream.history[0].loss, stream.history[0].angle);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < stream.history.length; i++) {
          const pt = getPos(stream.history[i].loss, stream.history[i].angle);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = isConverged ? 2.5 : 2;
        ctx.stroke();
      }
      
      // Draw head node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(currentPos.x, currentPos.y, isConverged ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      ctx.fillStyle = color + "33";
      ctx.beginPath();
      ctx.arc(currentPos.x, currentPos.y, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Text
      ctx.fillStyle = theme() === "dark" ? "#f3f4f6" : "#1f2937";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.fillText(stream.label, currentPos.x + 12, currentPos.y - 2);
      
      ctx.fillStyle = color;
      ctx.font = "9px monospace";
      ctx.fillText(`L:${stream.loss.toFixed(4)}`, currentPos.x + 12, currentPos.y + 8);
    });
  };

  // Helper to compile SVG path string outside JSX to avoid acorn parser .map regex bugs
  const lossPath = () => {
    const data = lossHistory();
    if (data.length === 0) return "";
    return data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 200; 
      const y = 100 - (val * 100); 
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  onMount(async () => {
    if (!canvasRef) return;
    
    // Fetch real Tree of Life status for constellation mapping
    try {
      const res = await fetch("/api/agent/tree-of-life-status");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          setNodeStatus(data.status);
        }
      }
    } catch (e) {
      console.error("Failed to fetch tree status for vector constellation", e);
    }

    const resize = () => {
      const rect = canvasRef?.getBoundingClientRect();
      if (rect) {
        canvasRef!.width = rect.width;
        canvasRef!.height = rect.height;
        initConstellation(rect.width, rect.height, Math.min(rect.width, rect.height) * 0.44);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    
    let time = 0;
    const animate = () => {
      if (isPlaying() && canvasRef) {
        time += 16;
        const ctx = canvasRef.getContext("2d");
        if (ctx) draw(ctx, canvasRef.width, canvasRef.height, time);
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();
    
    // Connect to WebSocket Signaling Server
    ws = new WebSocket("ws://localhost:8080/?room=global");
    
    ws.onopen = () => {
      setIsSimulated(false);
      addLog("Đã kết nối với máy chủ thần kinh (WebSocket)", "success");
    };

    ws.onmessage = async (event) => {
      try {
        const rawText = event.data instanceof Blob ? await event.data.text() : event.data;
        const data = JSON.parse(rawText);
        if (data.type === "vector_tracking") {
          handleVectorTracking(data);
        }
      } catch (err) {
        // ignore
      }
    };

    // Auto check WebSocket status after 3 seconds
    setTimeout(() => {
      if (ws?.readyState !== WebSocket.OPEN) {
        setIsSimulated(false);
        addLog("Không tìm thấy kết nối WebSocket. Sếp hãy bấm nút Kích hoạt Luồng Thật để gửi request.", "warn");
      }
    }, 3000);

    onCleanup(() => {
      window.removeEventListener("resize", resize);
      if (animationId) cancelAnimationFrame(animationId);
      if (simInterval) clearInterval(simInterval);
      if (ws) ws.close();
    });
  });

  <tsx>
    <div class="p-6 h-full w-full flex flex-col lg:flex-row gap-6">
      {/* Left panel: Core visualizer */}
      <div class="flex-1 flex flex-col bg-white dark:bg-[#121214] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 relative min-h-[500px]">
        <div class="mb-4 flex justify-between items-center z-10 relative">
          <div>
            <h2 class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Icon path={map} class="w-6 h-6 text-blue-600" />
              AI Telemetry Tracker (Gradient Descent)
            </h2>
            <p class="text-gray-500 text-xs mt-1">Giám sát quỹ đạo hội tụ của luồng suy nghĩ học xuống điểm cực tiểu</p>
          </div>
          
          <div class="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying())} 
              class="p-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              title={isPlaying() ? "Pause" : "Play"}
            >
              <Icon path={isPlaying() ? pause : play} class="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button 
              onClick={triggerRealThought}
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Icon path={cpuChip} class="w-4 h-4" />
              Kích hoạt Luồng Thật
            </button>
          </div>
        </div>

        <div class="flex-1 bg-gray-50 dark:bg-[#0a0a0c] rounded-xl overflow-hidden relative border border-gray-100 dark:border-white/5">
          <canvas ref={canvasRef} class="w-full h-full absolute inset-0 dark:mix-blend-plus-lighter"></canvas>
          <div class="absolute bottom-4 left-4 text-[10px] font-mono opacity-50 select-none text-gray-800 dark:text-gray-400 z-10 bg-white/70 dark:bg-black/70 p-2 rounded-lg backdrop-blur-sm border border-gray-200 dark:border-gray-800">
            CENTER: GLOBAL MINIMUM (LOSS = 0)<br/>
            CONSTELLATION: 49 HỆ THỐNG AI THẬT<br/>
            MODE: {isSimulated() ? "MÔ PHỎNG HỌC MÁY" : "KẾT NỐI REAL-TIME"}
          </div>
        </div>
      </div>

      {/* Right panel: Live Stats, Loss Chart & Logs */}
      <div class="w-full lg:w-[350px] flex flex-col gap-6">
        {/* Real-time stats card */}
        <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5">
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Icon path={adjustmentsHorizontal} class="w-4 h-4 text-blue-600" />
            Thông số hệ thống
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <span class="text-xs text-gray-500 block">Luồng đang chạy</span>
              <span class="text-xl font-bold text-blue-600 dark:text-blue-400">{activeThoughts()}</span>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <span class="text-xs text-gray-500 block">Mức Loss thấp nhất</span>
              <span class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {Array.from(streams().values()).length > 0 
                  ? Math.min(...Array.from(streams().values()).map(s => s.loss)).toFixed(4)
                  : "0.0000"}
              </span>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <span class="text-xs text-gray-500 block">Số chiều Vector</span>
              <span class="text-xl font-bold text-purple-600 dark:text-purple-400">1024</span>
            </div>
            <div class="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <span class="text-xs text-gray-500 block">Nút Hệ thống thật</span>
              <span class="text-xl font-bold text-gray-900 dark:text-white">49</span>
            </div>
          </div>
        </div>

        {/* Real-time Loss convergence line chart */}
        <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex-1 min-h-[180px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon path={chartBar} class="w-4 h-4 text-emerald-500" />
            Đường cong hội tụ (Loss)
          </h3>
          <div class="flex-1 bg-gray-50 dark:bg-[#0a0a0c] rounded-xl p-3 relative min-h-[100px] border border-gray-100 dark:border-white/5 flex items-center justify-center">
            <Show when={lossHistory().length > 0} fallback={<div class="text-xs text-gray-400">Chưa có luồng dữ liệu...</div>}>
              <svg class="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                <path 
                  d={lossPath()} 
                  fill="none" 
                  stroke="#10b981" 
                  stroke-width="2" 
                />
              </svg>
            </Show>
            <div class="absolute top-1 right-2 text-[8px] font-mono text-gray-400">Max: 1.0</div>
            <div class="absolute bottom-1 right-2 text-[8px] font-mono text-emerald-500">Min: 0.0</div>
          </div>
        </div>

        {/* Real-time Event Log Panel */}
        <div class="bg-white dark:bg-[#121214] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 h-[220px] flex flex-col">
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon path={documentText} class="w-4 h-4 text-purple-500" />
            Nhật ký nơ-ron
          </h3>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            <Show when={logs().length > 0} fallback={<div class="text-xs text-gray-400 text-center py-8">Đang chờ sự kiện đầu tiên...</div>}>
              <For each={logs()}>
                {log => <div class="text-[11px] font-mono flex items-start gap-1.5 leading-relaxed">
                  <span class="text-gray-400 shrink-0">{log.time}</span>
                  <span class={(() => {
                    if (log.type === 'success') return "text-emerald-600 dark:text-emerald-400";
                    if (log.type === 'warn') return "text-amber-600 dark:text-amber-400";
                    return "text-gray-700 dark:text-gray-300";
                  })()}>{log.message}</span>
                </div>}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  </tsx>
}
