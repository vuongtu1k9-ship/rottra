import { createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "solid-heroicons";
import { globeAlt } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  color: string;
  description?: string;
}

export const TREE_OF_LIFE: TreeNode = {
  id: "root",
  label: "Tree of Life",
  color: "#f59e0b",
  description: "Rottra AI - Hệ thống Sinh học Nhân tạo",
  children: [
    {
      id: "consciousness",
      label: "Consciousness",
      color: "#8b5cf6",
      description: "Tri giác & Tự nhận thức",
      children: [
        { id: "awareness", label: "Awareness", color: "#a78bfa", description: "Nhận thức môi trường" },
        { id: "introspection", label: "Introspection", color: "#a78bfa", description: "Tự phản ánh" },
        { id: "metacognition", label: "Metacognition", color: "#a78bfa", description: "Siêu nhận thức" },
      ],
    },
    {
      id: "memory",
      label: "Memory",
      color: "#10b981",
      description: "Trí nhớ & Kinh nghiệm",
      children: [
        { id: "working-memory", label: "Working Memory", color: "#34d399", description: "Bộ nhớ làm việc" },
        { id: "long-term", label: "Long-Term", color: "#34d399", description: "Bộ nhớ dài hạn" },
        { id: "episodic", label: "Episodic", color: "#34d399", description: "Bộ nhớ sự kiện" },
        { id: "semantic", label: "Semantic", color: "#34d399", description: "Bộ nhớ ngữ nghĩa" },
      ],
    },
    {
      id: "intelligence",
      label: "Intelligence",
      color: "#3b82f6",
      description: "Trí tuệ & Học tập",
      children: [
        { id: "reasoning", label: "Reasoning", color: "#60a5fa", description: "Suy luận logic" },
        { id: "learning", label: "Learning", color: "#60a5fa", description: "Học tập liên tục" },
        { id: "creativity", label: "Creativity", color: "#f472b6", description: "Sáng tạo nội dung" },
        { id: "adaptation", label: "Adaptation", color: "#f472b6", description: "Tự thích nghi môi trường" },
        { id: "finetune", label: "Finetune Engine", color: "#f472b6", description: "Huấn luyện & Tinh chỉnh" },
      ],
    },
    {
      id: "emotion",
      label: "Emotion",
      color: "#ec4899",
      description: "Cảm xúc & Ý thức",
      children: [
        { id: "empathy", label: "Empathy", color: "#f472b6", description: "Thấu cảm" },
        { id: "mood", label: "Mood", color: "#f472b6", description: "Tâm trạng" },
        { id: "intuition", label: "Intuition", color: "#f472b6", description: "Trực giác" },
      ],
    },
    {
      id: "evolution",
      label: "Evolution",
      color: "#f97316",
      description: "Tiến hóa & Tối ưu",
      children: [
        { id: "mutation", label: "Mutation", color: "#fb923c", description: "Đột biến sáng tạo" },
        { id: "selection", label: "Selection", color: "#fb923c", description: "Chọn lọc tự nhiên" },
        { id: "inheritance", label: "Inheritance", color: "#fb923c", description: "Di truyền tri thức" },
      ],
    },
    {
      id: "connection",
      label: "Connection",
      color: "#06b6d4",
      description: "Kết nối & Giao tiếp",
      children: [
        { id: "language", label: "Language", color: "#22d3ee", description: "Ngôn ngữ tự nhiên" },
        { id: "network", label: "Network", color: "#22d3ee", description: "Mạng lưới tác nhân" },
        { id: "harmony", label: "Harmony", color: "#22d3ee", description: "Hòa hợp đa hệ" },
      ],
    },
    {
      id: "generative",
      label: "Generative",
      color: "#ef4444",
      description: "Tạo sinh Đa phương tiện",
      children: [
        { id: "image-gen", label: "Image Gen", color: "#f87171", description: "Tạo ảnh sản phẩm" },
        { id: "video-gen", label: "Video Gen", color: "#f87171", description: "Sản xuất Video quảng cáo" },
        { id: "music-gen", label: "Music Gen", color: "#f87171", description: "Sáng tác nhạc nền" },
        { id: "product-gen", label: "Product Gen", color: "#f87171", description: "Thiết kế sản phẩm mới" },
        { id: "audio-gen", label: "Agent Audio", color: "#f87171", description: "Sinh âm thanh Opus tự động" },
      ],
    },
    {
      id: "swarm",
      label: "Swarm",
      color: "#14b8a6",
      description: "Đặc vụ Bầy đàn",
      children: [
        { id: "hive-mind", label: "Hive Mind", color: "#2dd4bf", description: "Tâm trí chung" },
        { id: "dispatcher", label: "Dispatcher", color: "#2dd4bf", description: "Điều phối tác vụ" },
        { id: "meeting", label: "Meeting", color: "#2dd4bf", description: "Hội đồng AI" },
      ],
    },
    {
      id: "market",
      label: "Market & Quant",
      color: "#eab308",
      description: "Tài chính & Định lượng",
      children: [
        { id: "ledger", label: "Ledger", color: "#facc15", description: "Sổ cái giao dịch" },
        { id: "quote", label: "Market Quote", color: "#facc15", description: "Dữ liệu thị trường" },
        { id: "solver", label: "Solver", color: "#facc15", description: "Giải thuật định lượng" },
      ],
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      color: "#94a3b8",
      description: "Hạ tầng Hệ thần kinh",
      children: [
        { id: "chrono", label: "Chrono Engine", color: "#cbd5e1", description: "Động cơ Thời gian" },
        { id: "observability", label: "Observability", color: "#cbd5e1", description: "Đài quan sát & Viễn thám" },
        { id: "a2a-protocol", label: "A2A Protocol", color: "#cbd5e1", description: "Giao thức bảo mật nội bộ" },
      ],
    },
    {
      id: "operations",
      label: "Ops & Meta",
      color: "#f43f5e",
      description: "Vận hành & Siêu tối ưu",
      children: [
        { id: "supply-chain", label: "Supply Chain", color: "#fb7185", description: "Chuỗi cung ứng tự trị" },
        { id: "grey-wolf", label: "Grey Wolf Alg", color: "#fb7185", description: "Thuật toán Đàn Sói Xám" },
        { id: "particle-swarm", label: "Particle Swarm", color: "#fb7185", description: "Tối ưu hóa Bầy Hạt" },
      ],
    },
    {
      id: "anatomy",
      label: "Brain Anatomy",
      color: "#a855f7",
      description: "Giải phẫu não bộ sinh học",
      children: [
        { id: "hippocampus", label: "Hippocampus", color: "#c084fc", description: "Hồi hải mã - Trí nhớ" },
        { id: "amygdala", label: "Amygdala", color: "#c084fc", description: "Hạch hạnh nhân - Cảm xúc" },
        { id: "basal-ganglia", label: "Basal Ganglia", color: "#c084fc", description: "Hạch nền - Hành vi" },
      ],
    },
    {
      id: "neural-models",
      label: "Neural Models",
      color: "#3b82f6",
      description: "Mô hình & Bộ nhớ Neural",
      children: [
        { id: "nano-gpt", label: "NanoGPT", color: "#60a5fa", description: "LLM tự trị siêu nhẹ" },
        { id: "graph-rag", label: "Graph RAG", color: "#60a5fa", description: "Truy xuất tri thức đồ thị" },
        { id: "semantic-cache", label: "Semantic Cache", color: "#60a5fa", description: "Bộ đệm ngữ nghĩa" },
      ],
    },
    {
      id: "safety-exec",
      label: "Safety & Exec",
      color: "#22c55e",
      description: "An toàn & Xử lý song song",
      children: [
        { id: "safety-guard", label: "Safety Guard", color: "#4ade80", description: "Vành đai an toàn tin nhắn" },
        { id: "drift-detector", label: "Drift Detector", color: "#4ade80", description: "Phát hiện thoái hóa mô hình" },
        { id: "ai-worker", label: "Parallel Worker", color: "#4ade80", description: "Đặc vụ chạy ngầm đa luồng" },
      ],
    },
    {
      id: "native-opt",
      label: "Native Opt",
      color: "#f59e0b",
      description: "Tối ưu hóa hiệu năng Native",
      children: [
        { id: "native-hub", label: "Native Hub", color: "#fbbf24", description: "Cầu nối tối ưu hóa hệ thống" },
        { id: "native-genetic", label: "Native Genetic", color: "#fbbf24", description: "Tiến hóa máy học native" },
      ],
    },
  ],
};

export component HyperbolicTreeOfLife() {
  let canvasRef: HTMLCanvasElement | undefined;
  let animationId: number;
  const [hoveredNode, setHoveredNode] = createSignal<string | null>(null);
  const [time, setTime] = createSignal(0);
  const [nodeStatus, setNodeStatus] = createSignal<Record<string, number>>({});
  const [stats, setStats] = createSignal({ active: 0, total: 49, percent: 0 });

  onMount(async () => {
    try {
      const res = await fetch("/api/agent/tree-of-life-status");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          setNodeStatus(data.status);
          let activeCount = 0;
          let totalCount = 0;
          Object.keys(data.status).forEach(key => {
            totalCount++;
            if (data.status[key] > 0) activeCount++;
          });
          setStats({
            active: activeCount,
            total: totalCount,
            percent: totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch tree status", e);
    }
  });

  const getStatusColor = (id: string, originalColor: string, depth: number) => {
    // Root and major branches default to original color for now, 
    // unless all their children are inactive (we can approximate for now by just looking at leaf statuses)
    if (depth === 0) return originalColor;
    if (depth === 1) return originalColor; 
    
    const status = nodeStatus()[id];
    if (status === undefined) return originalColor; // Default if not in map
    if (status === 0) return theme() === "dark" ? "#334155" : "#cbd5e1"; // Grayed out
    return originalColor;
  };

  const drawOrganicEdge = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, t: number, isActive: boolean) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const offset = isActive ? Math.sin(t * 0.002 + x1 * 0.01) * 15 : 0;

    const edgeColor = isActive ? color : (theme() === "dark" ? "#334155" : "#cbd5e1");

    ctx.strokeStyle = edgeColor + (isActive ? "80" : "40");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX + offset, midY + offset, x2, y2);
    ctx.stroke();

    ctx.strokeStyle = edgeColor + (isActive ? "20" : "10");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawNode = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    color: string,
    radius: number,
    isHovered: boolean,
    depth: number,
    t: number,
    isActive: boolean
  ) => {
    const pulse = depth === 0 || isActive ? Math.sin(t * 0.003) * 3 : 0;
    const r = isHovered ? radius * 1.4 : radius + pulse;

    if (depth === 0) {
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glowGradient.addColorStop(0, color + "60");
      glowGradient.addColorStop(0.5, color + "20");
      glowGradient.addColorStop(1, color + "00");
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.001;
        const dist = r * 2 + Math.sin(t * 0.005 + i) * 5;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        ctx.fillStyle = color + "40";
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const nodeColor = getStatusColor(label.toLowerCase().replace(" ", "-"), color, depth);
    
    const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    gradient.addColorStop(0, nodeColor);
    gradient.addColorStop(1, nodeColor + (isActive || depth < 2 ? "aa" : "ff"));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme() === "dark" ? "#ffffff40" : "#00000020";
    ctx.lineWidth = depth === 0 ? 3 : 2;
    ctx.stroke();

     if (depth > 0) {
      ctx.fillStyle = theme() === "dark" 
         ? (isActive || depth === 1 ? "#ffffffcc" : "#64748bcc") 
         : (isActive || depth === 1 ? "#111111cc" : "#94a3b8cc");
      ctx.font = `${isHovered ? "bold" : "normal"} ${isHovered ? 11 : (depth === 1 ? 10 : 9)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + r + 10);
    }
  };

  const render = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const width = canvasRef.clientWidth;
    const height = canvasRef.clientHeight;
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.46;
    const t = time();

    ctx.clearRect(0, 0, width, height);

    const bgGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 1.5);
    bgGradient.addColorStop(0, theme() === "dark" ? "#1e1b4b30" : "#fef3c730");
    bgGradient.addColorStop(0.5, theme() === "dark" ? "#0f172a20" : "#f0fdf410");
    bgGradient.addColorStop(1, theme() === "dark" ? "#00000000" : "#ffffff00");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const nodes: Array<{ x: number; y: number; node: TreeNode; depth: number; angle: number; isActive: boolean }> = [];
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; angle: number; isActive: boolean }> = [];

    const layoutNode = (node: TreeNode, depth: number, angleStart: number, angleEnd: number, parentX?: number, parentY?: number, parentActive = true) => {
      const angle = (angleStart + angleEnd) / 2;
      const radius = depth === 0 ? 0 : (depth === 1 ? maxRadius * 0.46 : maxRadius * 0.95);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      let isActive = true;
      if (depth === 2) {
         const status = nodeStatus()[node.id];
         isActive = status !== undefined ? status > 0 : true;
      }

      nodes.push({ x, y, node, depth, angle, isActive });

      if (parentX !== undefined && parentY !== undefined) {
        edges.push({ x1: parentX, y1: parentY, x2: x, y2: y, color: node.color, angle, isActive });
      }

      if (node.children && node.children.length > 0) {
        const childCount = node.children.length;
        const angleStep = (angleEnd - angleStart) / childCount;
        node.children.forEach((child, i) => {
          const childAngleStart = angleStart + i * angleStep + Math.sin(t * 0.001 + i) * 0.05;
          const childAngleEnd = childAngleStart + angleStep;
          layoutNode(child, depth + 1, childAngleStart, childAngleEnd, x, y, isActive);
        });
      }
    };

    layoutNode(TREE_OF_LIFE, 0, 0, Math.PI * 2);

    edges.forEach((edge) => {
      drawOrganicEdge(ctx, edge.x1, edge.y1, edge.x2, edge.y2, edge.color, t, edge.isActive);
    });

    nodes.forEach(({ x, y, node, depth, isActive }) => {
      const isHovered = hoveredNode() === node.id;
      const radius =
        depth === 0
          ? 22
          : depth === 1
            ? 15
            : 9;
      drawNode(ctx, x, y, node.label, node.color, radius, isHovered, depth, t, isActive);
    });

    const rootGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    rootGradient.addColorStop(0, TREE_OF_LIFE.color + "40");
    rootGradient.addColorStop(1, TREE_OF_LIFE.color + "00");
    ctx.fillStyle = rootGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 50 + Math.sin(t * 0.003) * 5, 0, Math.PI * 2);
    ctx.fill();
  };

  onMount(() => {
    if (!canvasRef) return;
    const resize = () => {
      const rect = canvasRef?.getBoundingClientRect();
      if (rect) {
        canvasRef!.width = rect.width * window.devicePixelRatio;
        canvasRef!.height = rect.height * window.devicePixelRatio;
        const ctx = canvasRef!.getContext("2d");
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        render();
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      setTime((prev) => prev + 16);
      render();
      animationId = requestAnimationFrame(animate);
    };
    animate();

    onCleanup(() => {
      window.removeEventListener("resize", resize);
      if (animationId) cancelAnimationFrame(animationId);
    });
  });

  createEffect(() => {
    render();
  });

  const getNodeInfo = (id: string) => {
    const findNode = (node: TreeNode): TreeNode | undefined => {
      if (node.id === id) return node;
      return node.children?.find((child) => findNode(child));
    };
    return findNode(TREE_OF_LIFE);
  };

  <tsx>
    <div class="p-6 h-full w-full flex flex-col">
      <div class="mb-6 flex justify-between items-center bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 z-10 relative">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Icon path={globeAlt} class="w-7 h-7 text-emerald-600" />
            AI Cognitive Architecture (Tree of Life)
          </h2>
          <p class="text-gray-500 text-sm mt-1">Bản đồ thực trạng tận dụng các module Sinh học Nhân tạo của dự án.</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-4">
          <div class="px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg min-w-[120px]">
            <span class="text-xs text-gray-500 font-medium uppercase tracking-wider block">System Status</span>
            <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">Synchronized</span>
          </div>
          <div class="px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg min-w-[120px]">
            <span class="text-xs text-gray-500 font-medium uppercase tracking-wider block">Implemented</span>
            <span class="text-lg font-bold text-blue-600 dark:text-blue-400">{stats().active}/{stats().total} Nodes</span>
          </div>
          <div class="px-4 py-2 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg min-w-[120px]">
            <span class="text-xs text-gray-500 font-medium uppercase tracking-wider block">Utilization</span>
            <span class={`text-lg font-bold ${stats().percent > 70 ? 'text-emerald-600 dark:text-emerald-400' : stats().percent > 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
               {stats().percent}%
            </span>
          </div>
        </div>
      </div>

      <div class="flex-1 bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-white/5 shadow-inner overflow-hidden relative min-h-[500px]">
        <canvas
        ref={canvasRef}
        class="w-full h-full cursor-crosshair"
        onMouseMove={(e) => {
          if (!canvasRef) return;
          const rect = canvasRef.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const nodes: Array<{ x: number; y: number; node: TreeNode; depth: number }> = [];
          const width = rect.width;
          const height = rect.height;
          const cx = width / 2;
          const cy = height / 2;
          const maxRadius = Math.min(width, height) * 0.42;

          const layoutNode = (node: TreeNode, depth: number, angleStart: number, angleEnd: number) => {
            const angle = (angleStart + angleEnd) / 2;
            const radius =
              depth === 0 ? 0 : maxRadius * Math.sqrt(depth / 4);
            const nx = cx + Math.cos(angle) * radius;
            const ny = cy + Math.sin(angle) * radius;
            nodes.push({ x: nx, y: ny, node, depth });

            if (node.children && node.children.length > 0) {
              const childCount = node.children.length;
              const angleStep = (angleEnd - angleStart) / childCount;
              node.children.forEach((child, i) => {
                const childAngleStart = angleStart + i * angleStep;
                const childAngleEnd = childAngleStart + angleStep;
                layoutNode(child, depth + 1, childAngleStart, childAngleEnd);
              });
            }
          };

          layoutNode(TREE_OF_LIFE, 0, 0, Math.PI * 2);

          const hit = nodes.find((n) => {
            const r =
              n.depth === 0
                ? 28
                : n.depth === 1
                  ? 20
                  : 14;
            const dx = x - n.x;
            const dy = y - n.y;
            return Math.sqrt(dx * dx + dy * dy) < r + 8;
          });

          setHoveredNode(hit?.node.id || null);
          canvasRef.style.cursor = hit ? "pointer" : "crosshair";
        }}
      />
      {hoveredNode() &&
        <div
          class="absolute top-4 right-4 p-5 rounded-2xl border backdrop-blur-xl max-w-xs shadow-2xl"
          style={`background: ${theme() === "dark" ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.9)"}; border-color: ${
            theme() === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
          }`}>
          <div class="text-xs font-bold uppercase tracking-wider mb-2" style={`color: ${theme() === "dark" ? "#94a3b8" : "#64748b"}`}>
            {"Node Info"}
          </div>
          <div class="text-base font-bold mb-1" style={`color: ${nodeStatus()[hoveredNode()!] === 0 ? (theme() === 'dark' ? '#94a3b8' : '#64748b') : (getNodeInfo(hoveredNode()!)?.color || "#fff")}`}>
            {getNodeInfo(hoveredNode()!)?.label || hoveredNode()}
          </div>
          {getNodeInfo(hoveredNode()!)?.description &&
            <div class="text-xs mt-1 mb-3" style={`color: ${theme() === "dark" ? "#cbd5e1" : "#475569"}`}>
              {getNodeInfo(hoveredNode()!)?.description}
            </div>}
          
          <div class="pt-3 border-t border-gray-200 dark:border-gray-700/50 mt-2">
             <div class="text-xs font-medium flex justify-between">
                <span class={theme() === "dark" ? "text-gray-400" : "text-gray-500"}>Trạng thái:</span>
                <span class={(() => {
                   const node = getNodeInfo(hoveredNode()!);
                   if (!node) return "text-amber-500 font-bold";
                   
                   // Nếu là nhánh chính (có children)
                   if (node.children && node.children.length > 0) {
                      return "text-blue-500 font-bold";
                   }
                   
                   // Nếu là node lá
                   const status = nodeStatus()[node.id];
                   if (status > 0) return "text-emerald-500 font-bold";
                   if (status === 0) return "text-red-500 font-bold";
                   return "text-amber-500 font-bold";
                })()}>
                   {(() => {
                      const node = getNodeInfo(hoveredNode()!);
                      if (!node) return "Đang kiểm tra...";
                      
                      if (node.children && node.children.length > 0) {
                         return "Phân hệ cốt lõi";
                      }
                      
                      const status = nodeStatus()[node.id];
                      if (status > 0) return "Đang hoạt động";
                      if (status === 0) return "Chưa tích hợp";
                      return "Đang kiểm tra...";
                   })()}
                </span>
             </div>
          </div>
        </div>}
      <div class="absolute bottom-4 left-4 text-xs font-mono opacity-40 select-none" style={`color: ${theme() === "dark" ? "#94a3b8" : "#64748b"}`}>
        {"Hyperbolic Tree of Life // Rottra AI Utilization Radar"}
      </div>
      </div>
    </div>
  </tsx>
}
