import { createSignal, onMount, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { theme } from "~/client/stores/theme-store";

export component DiagramView(props: any) {
  let containerRef: HTMLDivElement | undefined;
  const [mermaidHtml, setMermaidHtml] = createSignal<string>("");
  const [error, setError] = createSignal<string | null>(null);

  const DIAGRAMS: Record<string, { name: string; desc: string; code: string }> = {
    agent_coordination_groups: {
      name: "Bản đồ Phe Phái: Nguyệt Quang vs Quang Minh (Thế Nhân Thực Sự Tin Ta Là Đại Boss)",
      desc: "Sơ đồ thể hiện trận doanh và mối liên kết giữa các nhân vật thuộc phe Nguyệt Quang (đứng đầu bởi Nguyệt Chi Vương Tô Lượng) và phe Quang Minh / Đối địch trong thế giới Ngự Thú và tranh đoạt quyền lực.",
      code: `graph TD
    subgraph NguyetQuang["🎑 Phe Nguyệt Quang (Lực lượng Bóng Tối & Hỗ Trợ)"]
        ToLuong["👑 Tô Lượng<br/>[Nhân vật chính - Nắm giữ Nguyệt Chi Thư]"]
        ThuongNguyet["🌞 Thương Nguyệt Đại Đế<br/>[Tầm ảnh hưởng lớn Nguyệt Thần Cung - Cung Nguyệt Thần]"]
        TramTinh["🔮 Trầm Tinh Yển Nguyệt<br/>[Nữ chủ chốt - Đồng hành & Nghi thức]"]
        DaoTieuCuu["✨ Đào Tiểu Cửu<br/>[Ứng cử viên Thánh nữ - Thử thách Nguyệt Thần]"]
        HoaHuynh["🔥 Hỏa Huỳnh Vương<br/>[Sức mạnh vượt bậc - Chiến đấu hệ Nguyệt Quang]"]
        PhiNguyet["💎 Bạch Ti Phi Nguyệt Bảo<br/>[Hỗ trợ phục hồi cung Bảo Bình]"]
        NhuNguyet["🎴 Như Nguyệt<br/>[Quản lý & giám sát vùng thánh địa]"]
        SuGia["🛡️ Sứ giả Nguyệt Thần Cung<br/>[Đại diện ý chí của Nguyệt Thần]"]
    end

    subgraph QuangMinh["🌄 Phe Quang Minh (Lực lượng Ánh Sáng & Đối Địch)"]
        PhiAnh["🧚 Phi Anh Phấn Đồng<br/>[Quyền năng Nhật Hệ - Đối trọng Nguyệt Quang]"]
        BachDiHanh["⚔️ Bạch Di Hành<br/>[Đối thủ đáng gờm - Tranh chấp Thánh địa]"]
        UVuongMau["🕸️ U Vương Mẫu<br/>[Đại diện Tam Vương Tuyền - Địa lao cổ tộc]"]
        BachLoc["🦌 Bạch Lộc<br/>[Bạch Thánh Nhất Tộc - Phong ấn thế lực]"]
    end

    Target["⚔️ 3 Phút Tận Chiến: Giao Thương & bán hàng lực"]

    ToLuong -->|Nắm giữ quyền lực| NguyetQuang
    ToLuong -.->|Đối đầu trực tiếp| BachDiHanh
    ToLuong -.->|Kháng cự sức mạnh Nhật Hệ| PhiAnh

    TramTinh -->|Hỗ trợ chiến đấu & Nghi thức| ToLuong
    ThuongNguyet -->|Bảo hộ / Cập nhật tin tức| ToLuong
    DaoTieuCuu -->|Tham gia thử thách| ToLuong
    HoaHuynh -->|Hỗ trợ trận chiến hệ Nguyệt Quang| ToLuong
    PhiNguyet -->|Phục hồi năng lượng| ToLuong
    NhuNguyet -->|Tương tác trực tiếp| SuGia
    SuGia -->|Truyền đạt ý chí| ToLuong

    ThuongNguyet -->|Giao thương| Target
    NguyetQuang -->|Trao đổi Cây trồng & IoT| Target
    QuangMinh -->|Trao đổi Chăn nuôi & Thiết bị| Target

    BachDiHanh -->|Liên kết phong ấn| BachLoc
    UVuongMau -->|Trấn giữ địa lao| BachLoc

    classDef default fill:#11111b,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef center fill:#f38ba8,stroke:#ffffff,stroke-width:4px,color:#11111b,font-weight:bold;
    classDef group fill:#1e1e2e,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4;
    classDef sun fill:#fab387,stroke:#f9e2af,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef moon fill:#cba6f7,stroke:#89b4fa,stroke-width:2px,color:#11111b,font-weight:bold;

    class ToLuong,Target center;
    class NguyetQuang,QuangMinh group;
    class PhiAnh,BachDiHanh,UVuongMau,BachLoc sun;
    class ThuongNguyet,TramTinh,DaoTieuCuu,HoaHuynh,PhiNguyet,NhuNguyet,SuGia moon;`,
    },
    master_rottra: {
      name: "Toàn cảnh Kiến trúc Rottra (Master Architecture)",
      desc: "Kiến trúc hệ sinh thái Rottra AI Agent: TSRX Frontend, Bun Backend, và lõi Graph RAG.",
      code: `graph TD\n    Loading["Đang đếm số lượng Bảng và Endpoints..."]`,
    },
    tu_linh_infinite_meta: {
      name: "Phân hoạch Đồ thị Phẳng & Định lý 4 Màu (Four Color Theorem)",
      desc: "Mô hình phân hoạch vùng dữ liệu phẳng sử dụng Định lý 4 màu để tránh xung đột tài nguyên giữa các phân khu tiếp giáp.",
      code: `graph TD
    User["👑 Sếp (Strategic Directives)"]
    Infinite["🌀 InfiniteSieuMetaScale (Level N Meta)"]
    SieuSieuSieu["👑 SieuSieuSieuExecutiveController (Level 3 Meta)"]
    
    subgraph DataOrchestration["Phân Hệ Điều Phối Dữ Liệu Tích Hợp"]
        RawStreams["🎥 Raw Streams (ANPR Camera, Sensor Rung, Telemetry)"]
        Coordinator["🌀 ColorOrchestrator (Phễu Phân Màu Dữ Liệu)"]
    end

    Engine["🧠 ColorValidationEngine (OOP Graph Coloring Strategy)"]
    
    subgraph FourColorRegions["4 Phân Khu Định Lý 4 Màu (K4 Planar Adjacent Graph)"]
        R["🔴 Vùng Đỏ (Red Region - Collatz Node)"]
        G["🟢 Vùng Xanh Lá (Green Region - Kalman Node)"]
        B["🔵 Vùng Xanh Dương (Blue Region - Resilient Node)"]
        Y["🟡 Vùng Vàng (Yellow Region - Bayesian Node)"]
        
        R --- G
        G --- B
        B --- Y
        Y --- R
        R --- B
        G --- Y
    end
    
    User -->|Nhập số lượng 'siêu/s'| Infinite
    User -->|Đưa mục tiêu chiến lược| SieuSieuSieu
    Infinite -->|Hiệu chỉnh tham số siêu cấp| Coordinator
    SieuSieuSieu -->|Inject tham số vĩ mô| Coordinator
    
    RawStreams -->|Ingest luồng thô| Coordinator
    Coordinator -->|Orchestrate & Dispatch| Engine
    
    Engine -->|Kiểm tra biên tiếp giáp & Tô màu| R
    Engine -->|Kiểm tra biên tiếp giáp & Tô màu| G
    Engine -->|Kiểm tra biên tiếp giáp & Tô màu| B
    Engine -->|Kiểm tra biên tiếp giáp & Tô màu| Y
    
    classDef default fill:#11111b,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef meta fill:#f38ba8,stroke:#ffffff,stroke-width:3px,color:#11111b,font-weight:bold;
    classDef coord fill:#cba6f7,stroke:#cba6f7,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef engine fill:#89b4fa,stroke:#b4befe,stroke-width:2px,color:#11111b,font-weight:bold;
    
    classDef red fill:#f38ba8,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef green fill:#a6e3a1,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef blue fill:#89b4fa,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef yellow fill:#f9e2af,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;

    class User,Infinite,SieuSieuSieu meta;
    class Coordinator,RawStreams coord;
    class Engine engine;
    class R red; class G green; class B blue; class Y yellow;`,
    },
    tu_linh_traffic_logistics: {
      name: "Mạng lưới Giao thông Định lý 4 Màu",
      desc: "Luồng điều phối giao thông và Dijkstra Pathfinder thích ứng giữa các vùng màu phân biệt tiếp giáp nhau.",
      code: `graph TD
    subgraph TrafficNetwork["Bản đồ Phân khu Giao thông (Định lý 4 Màu)"]
        R["🔴 Red Zone (Vùng Đỏ - Hub Trung Chuyển)"]
        G["🟢 Green Zone (Vùng Xanh Lá - Kho Tổng)"]
        B["🔵 Blue Zone (Vùng Xanh Dương - Cảng Hàng Hải)"]
        Y["🟡 Yellow Zone (Vùng Vàng - Khu Thương Mại)"]
        
        R ---|15 km| B
        R ---|22 km| Y
        B ---|18 km| G
        G ---|12 km| Y
        R ---|"30 km"| G
        B ---|10 km| Y
    end
    
    Controller["👑 Executive Controller / TrafficRouter"] -->|1. Nhận chỉ thị Chế độ| Strategy{"Chế độ Chiến lược?"}
    Strategy -->|MAX_PROFIT| FastRoute["⚡ Dijkstra: Tuyến đường Siêu tốc<br/>(Tối thiểu thời gian di chuyển)"]
    Strategy -->|MAX_RESILIENCE| SecureRoute["🛡️ Dijkstra: Tuyến đường Kiên cố<br/>(Tránh phân khu kẹt xe/xung đột màu)"]
    
    FastRoute -->|Điều phối xe| TrafficNetwork
    SecureRoute -->|Điều phối xe| TrafficNetwork
 
    classDef default fill:#11111b,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef ctrl fill:#f38ba8,stroke:#ffffff,stroke-width:3px,color:#11111b,font-weight:bold;
    classDef path fill:#89b4fa,stroke:#b4befe,stroke-width:2px,color:#11111b,font-weight:bold;
    
    classDef red fill:#f38ba8,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef green fill:#a6e3a1,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef blue fill:#89b4fa,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef yellow fill:#f9e2af,stroke:#ffffff,stroke-width:2px,color:#11111b,font-weight:bold;

    class Controller,Strategy ctrl;
    class FastRoute,SecureRoute path;
    class R red; class G green; class B blue; class Y yellow;`,
    },
    graph_rag_edu: {
      name: "Hệ thống Giáo dục & Kiểm soát Động lực học",
      desc: "Luồng xử lý từ Dữ liệu Toán học đến Agent truy vấn qua Graph RAG, bao gồm các chỉ số Telemetry.",
      code: `graph TD
    User["Người dùng / Auto Pilot"]
    Dashboard["Bảng Điều khiển Toán học & Giáo dục"]
    Agent["Rottra Agent (Lõi RAG)"]
    DB[("PostgreSQL DB (Tri thức)")]
    
    subgraph ControlPanel["Telemetry & Động lực học"]
        Metrics["Telemetry Metrics (VRAM, ANPR, GPS)"]
        ProMax["Đào tạo ProMax (Task Queue)"]
    end
    
    User -->|Kích hoạt| Dashboard
    Dashboard --> ControlPanel
    ControlPanel -->|Gửi Context| Agent
    Agent <-->|Vector / Graph Traversal| DB
    Agent -->|Dữ liệu Giáo dục & Metrics| Dashboard
    
    style ControlPanel fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#fff`,
    },
    agent_mindmap_network: {
      name: "Sơ đồ Tư duy & Mạng lưới Agent (Mind Map & Network)",
      desc: "Sơ đồ mạng lưới kết hợp sơ đồ tư duy toàn diện biểu diễn các lõi nhận thức, tri thức, kênh tương tác và các công cụ hành động của Agent.",
      code: `graph TD
    Agent["🧠 Rottra ProMax Agent Core"]
    
    Agent --> Cognitive["🔮 Hệ Thống Nhận Thức"]
    Cognitive --> NLPEngine["📝 NLP Engine (Chuẩn hóa Toán học)"]
    Cognitive --> GGUF["⚡ Expert LLM GGUF (Suy luận Logic)"]
    
    Agent --> Knowledge["📚 Mạng Lưới Tri Thức"]
    Knowledge --> GraphRAG["🔗 Graph RAG (Truy vấn Đồ thị)"]
    Knowledge --> PostgreSQL["💾 DB PostgreSQL (Đồng bộ thời gian thực)"]
    Knowledge --> Lexicon["📖 Bilingual Lexicon (Từ vựng song ngữ)"]
    
    Agent --> Interaction["🗣️ Kênh Tương Tác"]
    Interaction --> VoiceSTT["🎙️ Voice STT / TTS (Giọng nói song hướng)"]
    Interaction --> Attach["📎 File Attachments (Đính kèm đa phương tiện)"]
    
    Agent --> Tools["🛠️ Công Cụ Hành Động (Tools Network)"]
    Tools --> GISMap["🗺️ GIS Real Map Tracker (TSP & Ranh giới xã)"]
    Tools --> Telemetry["📊 Scientific Control (Telemetry VRAM, ANPR)"]
    Tools --> Ledger["⛓️ Cryptographic Immutable Ledger (Blockchain SHA-256)"]

    classDef default fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef center fill:#f38ba8,stroke:#ffffff,stroke-width:4px,color:#11111b,font-weight:bold;
    classDef cognitive fill:#89b4fa,stroke:#b4befe,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef knowledge fill:#a6e3a1,stroke:#94e2d5,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef interaction fill:#f9e2af,stroke:#f8bd96,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef tools fill:#cba6f7,stroke:#f5c2e7,stroke-width:2px,color:#11111b,font-weight:bold;

    class Agent center;
    class Cognitive,NLPEngine,GGUF cognitive;
    class Knowledge,GraphRAG,PostgreSQL,Lexicon knowledge;
    class Interaction,VoiceSTT,Attach interaction;
    class Tools,GISMap,Telemetry,Ledger tools;`,
    },
    echopi_retrieval_pipeline: {
      name: "Quy Trình Truy Hồi Mật Độ Cao Echopi (Semantic Retrieval Pipeline)",
      desc: "Kiến trúc đường ống tìm kiếm semantic nhiều tầng của Echopi: Vector hóa R^384/R^256 [IT, NL, EN, VI], lượng hóa [Q4, Q5], chỉ mục HNSW [K-M, XL], Reranker float16 với trọng số [UD, IQ] và định tuyến MoE.",
      code: `graph TD
    subgraph Pipeline["🎯 Quy Trình Truy Hồi Mật Độ Cao Echopi (RAG Pipeline)"]
        Query["👤 User Query"]
        Embed["🧠 Embedding Layer<br/>[Dense vector R384 / R256 với 3 lực]<br/>[Fixed quantization: Q4 hoặc Q5 / BF16 optional]"]
        ANN["🕸️ ANN Retrieval<br/>[HNSW index: K-M / XL variant tùy dataset]<br/>[Chọn lọc Top-K candidates]"]
        Rerank["🔥 Reranker<br/>[float16 cross-encoder]<br/>[Trọng số domain tùy chỉnh: UD / IQ]"]
        MoE{"🌀 Optional MoE Routing<br/>[Chỉ query-level, domain-specific reranker]"}
        Output["🎯 Final Ranking / Output<br/>[Kết quả cuối cùng]"]
    end

    Query --> Embed
    Embed --> ANN
    ANN --> Rerank
    Rerank --> MoE
    MoE --> Output

    classDef default fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef center fill:#f38ba8,stroke:#ffffff,stroke-width:4px,color:#11111b,font-weight:bold;
    classDef step fill:#89b4fa,stroke:#b4befe,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef highlight fill:#a6e3a1,stroke:#94e2d5,stroke-width:2px,color:#11111b,font-weight:bold;
    classDef final fill:#fab387,stroke:#f9e2af,stroke-width:2px,color:#11111b,font-weight:bold;

    class Query,Output center;
    class Embed step;
    class ANN,Rerank highlight;
    class MoE final;`,
    },
  };

  const [activeTab, setActiveTab] = createSignal("agent_coordination_groups");
  const [code, setCode] = createSignal(DIAGRAMS.agent_coordination_groups.code);

  // When tab changes, update code
  createEffect(() => {
    const tab = activeTab();
    if (tab === "master_rottra") {
      setCode(DIAGRAMS.master_rottra.code); // Show loading
      if (!isServer) {
        fetch("/api/admin/diagram/architecture").then((res) => res.json()).then((data) => {
          if (data.success && data.architecture) {
            setCode(data.architecture);
          } else {
            setCode(`graph TD\n    Error["Lỗi trích xuất hệ thống: ${data.message || "Unknown"}"]`);
          }
        }).catch((err) => {
          setCode(`graph TD\n    Error["Lỗi kết nối tới Server"]`);
        });
      }
    } else {
      setCode(DIAGRAMS[tab].code);
    }
    resetZoom();
  });

  createEffect(() => {
    if (isServer) return;
    const currentCode = code();
    const currentTheme = theme(); // Listen to theme changes

    // We dynamically import mermaid to avoid SSR issues and heavy bundle load
    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: currentTheme === "dark" ? "dark" : "default",
        themeVariables: {
          background: currentTheme === "dark" ? "#11111b" : "#ffffff",
          primaryColor: "#cba6f7",
        },
      });

      const renderId = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;

      mermaid.render(renderId, currentCode).then((result) => {
        setMermaidHtml(result.svg);
        setError(null);
      }).catch((err) => {
        console.error("Mermaid error:", err);
        setError("Lỗi cú pháp Mermaid. Vui lòng kiểm tra lại mã.");
      });
    }).catch((err) => {
      console.error("Failed to load mermaid:", err);
      setError("Không thể tải thư viện Mermaid.");
    });
  });

  const [scale, setScale] = createSignal(1);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  let isDragging = false;
  let startPos = { x: 0, y: 0 };

  const [isLocked, setIsLocked] = createSignal(false);

  const handleWheel = (e: WheelEvent) => {
    if (isLocked()) return;
    e.preventDefault();
    const zoomSensitivity = 0.1;
    const delta =
      e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
    setScale((s) => Math.max(0.3, Math.min(s + delta, 4)));
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (isLocked()) return;
    isDragging = true;
    startPos = { x: e.clientX - position().x, y: e.clientY - position().y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || isLocked()) return;
    setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  const handleMouseLeave = () => {
    isDragging = false;
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleLock = () => {
    setIsLocked(!isLocked());
  };

  <div class="p-6 md:p-8 animate-in fade-in duration-500">
    <div
      class={`rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 ${
        theme() === "dark" ? "bg-[#11111b]/80 backdrop-blur-md border-white/10" : "bg-white/80 backdrop-blur-md border-gray-100"
      }`}>
      {/* Header Section */}
      <div
        class={`px-8 py-6 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r ${
          theme() === "dark"
            ? "from-indigo-950/40 via-purple-950/20 to-[#11111b] border-white/10"
            : "from-blue-50/50 via-purple-50/20 to-white border-gray-100"
        }`}>
        <div class="flex items-center gap-4">
          <div class="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h2 class={`text-2xl font-black tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>
              {"Kiến Trúc Nhận Thức & Động Lực Học Rottra"}
            </h2>
            <p class={`text-xs font-semibold tracking-wider uppercase mt-1 ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              {"Hệ Thống Đa Hình Tứ Linh & Bản Đồ Phản Xạ Đệ Quy Vô Hạn"}
            </p>
          </div>
        </div>

        {/* Module Tabs Selector */}
        <div class="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
          for (const [key, item] of Object.entries(DIAGRAMS)) {
            <button
              onClick={() => setActiveTab(key)}
              class={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all duration-300 transform active:scale-95 ${
                activeTab() === key
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                  : (theme() === "dark"
                    ? "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/60")
              }`}>
              {key === "tu_linh_infinite_meta"
                ? "🐉 Tứ Linh Đa Hình"
                : (key === "tu_linh_traffic_logistics"
                  ? "🚥 Giao Thông Tứ Linh"
                  : (key === "agent_coordination_groups"
                    ? "🕸️ Điều Phối Nhóm"
                    : (key === "echopi_retrieval_pipeline" ? "🌀 Đường Ống Echopi" : item.name.split(" ")[0])))}
            </button>
          }
        </div>
      </div>

      {/* Tab Description Banner */}
      <div
        class={`px-8 py-4 border-b text-sm transition-all duration-300 ${
          theme() === "dark" ? "bg-white/5 border-white/10 text-gray-300" : "bg-gray-50 border-gray-100 text-gray-600"
        }`}>
        <div class="flex items-center gap-3">
          <span class="flex h-2.5 w-2.5 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span class="font-semibold text-xs tracking-wider uppercase text-blue-500">{"Chi tiết cấu phần:"}</span>
          <span class="font-bold">{DIAGRAMS[activeTab()].name}</span>
          <span class="opacity-50">{"—"}</span>
          <span class="text-xs opacity-80">{DIAGRAMS[activeTab()].desc}</span>
        </div>
      </div>

      {/* Canvas Display Viewport */}
      <div class="flex flex-col gap-6 p-6 min-h-[600px] relative">
        <div class="flex flex-col gap-3 flex-1 h-full">
          <div class="flex justify-between items-center px-1">
            <label class={`text-xs font-extrabold uppercase tracking-widest ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              {"Vùng hiển thị Canvas (Kéo để di chuyển, Cuộn để Zoom)"}
            </label>

            <div class="flex items-center gap-2">
              <button
                onClick={toggleLock}
                class={`text-xs px-4 py-1.5 rounded-full font-bold transition-all duration-300 flex items-center gap-1.5 active:scale-95 shadow-sm ${
                  isLocked()
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    : "bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20"
                }`}>
                <span class={`h-1.5 w-1.5 rounded-full ${isLocked() ? "bg-red-400" : "bg-green-400"}`} />
                {isLocked() ? "Đã Khóa Zoom" : "Mở Khóa Zoom"}
              </button>

              <button
                onClick={resetZoom}
                class={`text-xs px-4 py-1.5 rounded-full font-bold transition-all duration-300 active:scale-95 border ${
                  theme() === "dark"
                    ? "bg-white/5 hover:bg-white/10 text-gray-300 border-white/5"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                }`}>
                {"Reset View"}
              </button>
            </div>
          </div>

          {/* Interactive Graph Box */}
          <div
            class={`flex-1 w-full border rounded-3xl p-6 flex items-center justify-center overflow-hidden relative min-h-[500px] transition-all duration-300 ${
              theme() === "dark"
                ? "bg-gradient-to-b from-[#161622] to-[#11111b] border-white/5 shadow-inner"
                : "bg-gradient-to-b from-gray-50 to-white border-gray-200/80 shadow-inner"
            }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}>
            if (error()) {
              <div
                class="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-md z-10 text-red-500 p-6 text-center animate-in fade-in duration-300">
                <div class="p-4 bg-red-500/10 rounded-full mb-3 border border-red-500/20">
                  <svg class="w-8 h-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <span class="font-extrabold text-sm tracking-wide">{error()}</span>
              </div>
            }

            <div
              ref={containerRef}
              class="w-full h-full flex items-center justify-center min-h-[450px] mermaid-container select-none transition-transform duration-75 ease-out"
              style={{
                opacity: error() ? "0.15" : "1",
                transform: `translate(${position().x}px, ${position().y}px) scale(${scale()})`,
                cursor: isDragging ? "grabbing" : "grab",
                "transform-origin": "center center",
              }}
              innerHTML={mermaidHtml()}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
}
