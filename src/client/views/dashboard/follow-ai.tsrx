import { createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import { Icon } from "solid-heroicons";
import { server, userGroup, bolt, currencyDollar, globeAsiaAustralia } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { currencySymbol, formatCurrency } from "~/client/stores/i18n-store";

function CausalNegotiationTree(props: { log: any }) {
  const isSuccess = () => props.log && (props.log.success === true || props.log.success === 1 || props.log.success === "true");

  return <tsx>
    <div
      class={`p-6 rounded-3xl border ${
        theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
      } space-y-6 animate-in fade-in duration-300`}>
      <div class="flex justify-between items-center border-b border-gray-500/10 pb-4">
        <div>
          <h4 class="text-sm font-bold uppercase tracking-wider text-indigo-500">
            {"Cây Nhân Quả Đàm Phán (Causal Negotiation Tree)"}
          </h4>
          <p class="text-xs text-gray-400 mt-1 font-medium">
            {props.log
              ? `Mô phỏng đàm phán lượng tử - Vòng ${props.log.round || 1} | Session: ${
                  props.log.sessionId ? props.log.sessionId.substring(0, 8) : "N/A"
                }`
              : "Chọn một cuộc giao dịch ở bảng dưới để xem chi tiết cây quyết định nhân quả"}
          </p>
        </div>
        {props.log &&
          <span
            class={`px-3 py-1 rounded-full text-xs font-bold border ${
              isSuccess() ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}>
            {isSuccess() ? "ĐÀM PHÁN THÀNH CÔNG" : "ĐÀM PHÁN THẤT BẠI"}
          </span>}
      </div>
      {!props.log
        ? <div class="p-12 text-center text-gray-500 italic border border-dashed border-gray-500/20 rounded-2xl">
            {"Chọn một cuộc giao dịch từ bảng dưới để trực quan hóa cây nhân quả đàm phán."}
          </div>
        : <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {}
            <div
              class="lg:col-span-2 relative min-h-[420px] bg-black/15 dark:bg-black/35 rounded-2xl p-6 overflow-hidden border border-gray-500/5 flex flex-col justify-between">
              {}
              <svg class="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                {}
                <path d="M 260,65 Q 260,105 130,120" stroke="rgba(99, 102, 241, 0.2)" stroke-width="2" fill="none" />
                <path d="M 260,65 Q 260,105 390,120" stroke="rgba(99, 102, 241, 0.2)" stroke-width="2" fill="none" />
                {}
                <path d="M 130,165 Q 130,195 130,205" stroke="rgba(245, 158, 11, 0.2)" stroke-width="2" fill="none" />
                <path d="M 390,165 Q 390,195 390,205" stroke="rgba(59, 130, 246, 0.2)" stroke-width="2" fill="none" />
                {}
                <path d="M 130,245 Q 130,270 170,285" stroke="rgba(245, 158, 11, 0.3)" stroke-width="2" fill="none" />
                {}
                <path d="M 390,245 Q 390,270 350,285" stroke="rgba(59, 130, 246, 0.3)" stroke-width="2" fill="none" />
                {}
                <path
                  d="M 170,325 Q 260,345 260,360"
                  stroke={isSuccess() ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}
                  stroke-width="2"
                  fill="none"
                />
                <path
                  d="M 350,325 Q 260,345 260,360"
                  stroke={isSuccess() ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}
                  stroke-width="2"
                  fill="none"
                />
              </svg>
              {}
              <div class="flex justify-center z-10">
                <div
                  class={`px-5 py-3 rounded-2xl border text-center shadow-md ${
                    theme() === "dark" ? "bg-[#181824] border-indigo-500/20 text-white" : "bg-indigo-50 border-indigo-100 text-indigo-950"
                  }`}>
                  <div class="text-[9px] uppercase font-mono tracking-widest text-indigo-500 font-bold">
                    {"Sản phẩm giao dịch"}
                  </div>
                  <div class="text-sm font-black mt-0.5">
                    {props.log.productName}
                  </div>
                  <div class="text-[10px] font-mono mt-0.5 text-gray-500">
                    {`Giá thị trường: ${formatCurrency(Number(props.log.marketPrice))} ${currencySymbol()}`}
                  </div>
                </div>
              </div>
              {}
              <div class="flex justify-between items-center z-10 px-2 mt-2">
                {}
                <div class="p-3 rounded-xl border bg-black/40 border-amber-500/20 max-w-[190px] w-full shadow-sm">
                  <div class="text-[9px] uppercase tracking-wider text-amber-500 font-bold">
                    {"Người bán (Seller)"}
                  </div>
                  <div class="text-xs font-bold truncate mt-0.5 text-gray-250">
                    {props.log.sellerName || props.log.sellerId}
                  </div>
                </div>
                {}
                <div class="p-3 rounded-xl border bg-black/40 border-blue-500/20 max-w-[190px] w-full text-right shadow-sm">
                  <div class="text-[9px] uppercase tracking-wider text-blue-500 font-bold">
                    {"Người mua (Buyer)"}
                  </div>
                  <div class="text-xs font-bold truncate mt-0.5 text-gray-250">
                    {props.log.buyerName || props.log.buyerId}
                  </div>
                </div>
              </div>
              {}
              <div class="flex justify-between items-center z-10 px-2">
                {}
                <div class="p-2.5 rounded-xl border bg-[#1c120a] border-amber-500/10 text-center w-[130px]">
                  <div class="text-[9px] text-amber-500/70 font-mono">
                    {"Chào bán 1"}
                  </div>
                  <div class="text-xs font-mono font-bold text-amber-500 mt-0.5">
                    {`${formatCurrency(Number(props.log.sellerOffer1))} ${currencySymbol()}`}
                  </div>
                </div>
                <div class="text-[9px] text-gray-555 font-mono select-none font-semibold">
                  {"Đàm phán Vòng 1"}
                </div>
                {}
                <div class="p-2.5 rounded-xl border bg-[#0a1320] border-blue-500/10 text-center w-[130px]">
                  <div class="text-[9px] text-blue-500/70 font-mono">
                    {"Trả giá 1"}
                  </div>
                  <div class="text-xs font-mono font-bold text-blue-500 mt-0.5">
                    {`${formatCurrency(Number(props.log.buyerBid1))} ${currencySymbol()}`}
                  </div>
                </div>
              </div>
              {}
              <div class="flex justify-center gap-16 items-center z-10 px-2">
                {}
                <div class="p-2.5 rounded-xl border bg-[#231508] border-amber-500/20 text-center w-[130px]">
                  <div class="text-[9px] text-amber-500 font-mono">
                    {"Chào bán 2"}
                  </div>
                  <div class="text-xs font-mono font-bold text-amber-500 mt-0.5">
                    {`${formatCurrency(Number(props.log.sellerOffer2 || props.log.sellerOffer1))} ${currencySymbol()}`}
                  </div>
                </div>
                {}
                <div class="p-2.5 rounded-xl border bg-[#081829] border-blue-500/20 text-center w-[130px]">
                  <div class="text-[9px] text-blue-500 font-mono">
                    {"Trả giá 2"}
                  </div>
                  <div class="text-xs font-mono font-bold text-blue-500 mt-0.5">
                    {`${formatCurrency(Number(props.log.buyerBid2 || props.log.buyerBid1))} ${currencySymbol()}`}
                  </div>
                </div>
              </div>
              <div class="flex justify-center z-10 mt-2">
                <div
                  class={`px-6 py-3 rounded-2xl border text-center shadow-lg transition-all duration-500 ${
                    isSuccess()
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-450"
                      : "bg-red-950/20 border-red-500/30 text-red-405"
                  }`}>
                  <div class="text-[9px] uppercase tracking-wider font-mono font-bold opacity-80">
                    {"Kết quả chung cuộc"}
                  </div>
                  <div class="text-sm font-black mt-1">
                    {isSuccess() ? `CHỐT THÀNH CÔNG` : `ĐÀM PHÁN THẤT BẠI`}
                  </div>
                  {isSuccess() &&
                    <div class="text-xs font-mono font-bold mt-0.5">
                      {`${formatCurrency(Number(props.log.finalizedPrice))} ${currencySymbol()}`}
                    </div>}
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-6">
              <div class="p-5 rounded-2xl border bg-black/20 border-gray-500/10 flex-1 flex flex-col justify-between gap-4 min-h-[380px]">
                <h5 class="text-xs font-bold uppercase tracking-widest text-indigo-400">
                  {"Nhật ký hội thoại giao thương"}
                </h5>
                <div
                  class="flex-1 bg-black/30 rounded-xl p-3 border border-white/5 overflow-y-auto max-h-[320px] font-sans text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {props.log.dialogue ? props.log.dialogue : "Không có dữ liệu hội thoại."}
                </div>
                <div class="text-[9px] text-gray-500 font-mono text-center">
                  {"Nhật ký thời gian thực từ Swarm"}
                </div>
              </div>
            </div>
          </div>}
    </div>
  </tsx>;
}

export component EducateAi() {
  const [agentDnas, setAgentDnas] = createSignal<any[]>([]);
  const [negotiationLogs, setNegotiationLogs] = createSignal<any[]>([]);
  const [selectedLogId, setSelectedLogId] = createSignal<string | null>(null);
  const [activeVisualizerTab, setActiveVisualizerTab] = createSignal<"causal" | "relationship">("causal");
  const [ledgerSearchQuery, setLedgerSearchQuery] = createSignal("");

  const selectedLog = () => {
    const list = negotiationLogs();
    if (list.length === 0) return null;
    const selId = selectedLogId();
    if (!selId) return list[0];
    return list.find((log) => log.id === selId) || list[0];
  };

  const [isTriggeringShock, setIsTriggeringShock] = createSignal(false);
  const [shockLogs, setShockLogs] = createSignal<string[]>([]);
  const [selectedShockType, setSelectedShockType] = createSignal<string>("LOGISTICS_BLOCKADE");

  const [agentSearchQuery, setAgentSearchQuery] = createSignal("");
  const [agentStateFilter, setAgentStateFilter] = createSignal("ALL");
  const [agentSortKey, setAgentSortKey] = createSignal("NAME");

  // --- OCR Signals ---
  const [ocrUploadedFileId, setOcrUploadedFileId] = createSignal<string | null>(null);
  const [ocrUploadedFileUrl, setOcrUploadedFileUrl] = createSignal<string | null>(null);
  const [ocrUploadedFileName, setOcrUploadedFileName] = createSignal<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = createSignal(false);
  const [isOcrSaving, setIsOcrSaving] = createSignal(false);
  const [ocrResult, setOcrResult] = createSignal<any | null>(null);
  const [ocrError, setOcrError] = createSignal<string | null>(null);

  // OCR Form fields for user editing before saving
  const [ocrProductName, setOcrProductName] = createSignal("");
  const [ocrQuantity, setOcrQuantity] = createSignal(0);
  const [ocrUnitPrice, setOcrUnitPrice] = createSignal(0);
  const [ocrTotalPrice, setOcrTotalPrice] = createSignal(0);
  const [ocrSellerName, setOcrSellerName] = createSignal("");
  const [ocrBuyerName, setOcrBuyerName] = createSignal("");
  const [ocrDriverName, setOcrDriverName] = createSignal("");
  const [ocrDocumentDate, setOcrDocumentDate] = createSignal("");

  const handleOcrFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrResult(null);
    setOcrUploadedFileName(file.name);

    try {
      // 1. Upload file using /api/upload
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || "Tải tệp lên thất bại");
      }

      setOcrUploadedFileId(uploadData.id);
      setOcrUploadedFileUrl(uploadData.url);

      // 2. Request OCR parsing using /api/document/ocr
      const ocrRes = await fetch("/api/document/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: uploadData.id }),
      });

      const ocrData = await ocrRes.json();
      if (!ocrData.success) {
        throw new Error(ocrData.error || "Phân tích tài liệu thất bại");
      }

      const info = ocrData.data || {};
      setOcrResult(info);

      // Populate fields
      setOcrProductName(info.productName || "");
      setOcrQuantity(info.quantity || 0);
      setOcrUnitPrice(info.unitPrice || 0);
      setOcrTotalPrice(info.totalPrice || 0);
      setOcrSellerName(info.sellerName || "");
      setOcrBuyerName(info.buyerName || "");
      setOcrDriverName(info.driverName || "");
      setOcrDocumentDate(info.documentDate || new Date().toISOString().split("T")[0]);
    } catch (err: any) {
      console.error(err);
      setOcrError(err.message || "Đã xảy ra lỗi khi phân tích tài liệu");
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleSaveOcrTransaction = async () => {
    if (!ocrProductName()) {
      alert("Vui lòng nhập tên sản phẩm!");
      return;
    }

    setIsOcrSaving(true);
    try {
      const saveRes = await fetch("/api/document/ocr/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: ocrProductName(),
          quantity: ocrQuantity(),
          unitPrice: ocrUnitPrice(),
          totalPrice: ocrTotalPrice(),
          sellerName: ocrSellerName(),
          buyerName: ocrBuyerName(),
          driverName: ocrDriverName(),
          documentDate: ocrDocumentDate(),
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        alert("Đã ghi nhận giao dịch thành công từ tài liệu OCR!");
        // Reset state
        setOcrResult(null);
        setOcrUploadedFileId(null);
        setOcrUploadedFileUrl(null);
        setOcrUploadedFileName(null);
        // Refresh telemetry
        fetchSwarmTelemetry();
      } else {
        alert("Lỗi khi lưu giao dịch: " + saveData.error);
      }
    } catch (err: any) {
      alert("Lỗi kết nối: " + err.message);
    } finally {
      setIsOcrSaving(false);
    }
  };

  // Financial calculations
  const totalAssets = () => {
    return agentDnas().reduce((sum, dna) => sum + (dna.contextValue?.wealth || 0), 0);
  };

  const totalVolume = () => {
    return negotiationLogs().filter((log) => log.success === true || log.success === 1 || log.success === "true").reduce(
      (sum, log) => sum + Number(log.finalizedPrice || 0),
      0,
    );
  };

  const successRate = () => {
    const logs = negotiationLogs();
    if (logs.length === 0) return 0;
    const successCount = logs.filter((log) => log.success === true || log.success === 1 || log.success === "true").length;
    return Math.round((successCount / logs.length) * 100);
  };

  const avgDiscount = () => {
    const successLogs = negotiationLogs().filter(
      (log) => (log.success === true || log.success === 1 || log.success === "true") && Number(log.sellerOffer1) > 0,
    );
    if (successLogs.length === 0) return 0;
    const totalDisc = successLogs.reduce((sum, log) => {
      const init = Number(log.sellerOffer1);
      const fin = Number(log.finalizedPrice);
      return sum + (init - fin) / init;
    }, 0);
    return Math.round((totalDisc / successLogs.length) * 100);
  };

  // Relationship Graph using Mermaid
  const [relationMermaidHtml, setRelationMermaidHtml] = createSignal<string>("");

  const generateRelationGraphCode = () => {
    const logs = negotiationLogs();
    if (logs.length === 0) {
      return "graph TD\n  Empty[Chưa có dữ liệu giao dịch]";
    }

    // Take the last 6 logs to prevent clutter
    const recentLogs = logs.slice(0, 6);
    let code = "graph LR\n";
    code += "  classDef seller fill:#b45309,stroke:#d97706,stroke-width:2px,color:#fff;\n";
    code += "  classDef buyer fill:#1d4ed8,stroke:#2563eb,stroke-width:2px,color:#fff;\n";
    code += "  classDef product fill:#047857,stroke:#059669,stroke-width:2px,color:#fff;\n";

    const nodes = new Set<string>();

    recentLogs.forEach((log, index) => {
      const sName = log.sellerName || log.sellerId || `Seller_${index}`;
      const bName = log.buyerName || log.buyerId || `Buyer_${index}`;
      const pName = log.productName || "Sản phẩm";
      const sId = `S_${sName.replace(/[^a-zA-Z0-9]/g, "")}`;
      const bId = `B_${bName.replace(/[^a-zA-Z0-9]/g, "")}`;
      const pId = `P_${pName.replace(/[^a-zA-Z0-9]/g, "")}`;

      if (!nodes.has(sId)) {
        code += `  ${sId}["🧑‍🌾 ${sName}"]:::seller\n`;
        nodes.add(sId);
      }
      if (!nodes.has(pId)) {
        code += `  ${pId}["📦 ${pName}"]:::product\n`;
        nodes.add(pId);
      }
      if (!nodes.has(bId)) {
        code += `  ${bId}["🧑‍💼 ${bName}"]:::buyer\n`;
        nodes.add(bId);
      }

      const isSuccess = log.success === true || log.success === 1 || log.success === "true";
      const statusLabel = isSuccess ? `Chốt: ${formatCurrency(Number(log.finalizedPrice))}${currencySymbol()}` : "Thất bại";

      code += `  ${sId} -->|Chào: ${formatCurrency(Number(log.sellerOffer1))}${currencySymbol()}| ${pId}\n`;
      code += `  ${pId} -->|${statusLabel}| ${bId}\n`;
    });

    return code;
  };

  createEffect(() => {
    if (isServer) return;
    const logs = negotiationLogs();
    if (logs.length === 0) return;

    const currentCode = generateRelationGraphCode();
    const currentTheme = theme();

    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: currentTheme === "dark" ? "dark" : "default",
        themeVariables: {
          background: currentTheme === "dark" ? "#111115" : "#ffffff",
          primaryColor: "#cba6f7",
        },
      });

      const renderId = `relation-mermaid-${Math.random().toString(36).substr(2, 9)}`;
      mermaid.render(renderId, currentCode).then((result) => {
        setRelationMermaidHtml(result.svg);
      }).catch((err) => {
        console.error("Mermaid relation graph error:", err);
      });
    }).catch((err) => {
      console.error("Failed to load mermaid in follow-ai:", err);
    });
  });

  const filteredAgentDnas = () => {
    let list = agentDnas();
    const query = agentSearchQuery().toLowerCase().trim();
    const stateF = agentStateFilter();
    const sort = agentSortKey();

    if (query) {
      list = list.filter((dna) => {
        const name = (dna.contextValue?.agentName || dna.sessionId || "").toLowerCase();
        return name.includes(query);
      });
    }

    if (stateF !== "ALL") {
      list = list.filter((dna) => dna.state === stateF);
    }

    const sorted = [...list];
    if (sort === "NAME") {
      sorted.sort((a, b) => {
        const nameA = a.contextValue?.agentName || a.sessionId || "";
        const nameB = b.contextValue?.agentName || b.sessionId || "";
        return nameA.localeCompare(nameB);
      });
    } else if (sort === "GREED") {
      sorted.sort((a, b) => (b.contextValue?.greed || b.greed || 0) - (a.contextValue?.greed || a.greed || 0));
    }
    return sorted;
  };

  const filteredNegotiationLogs = () => {
    let list = negotiationLogs();
    const query = ledgerSearchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter((log) => {
        const prod = (log.productName || "").toLowerCase();
        const seller = (log.sellerName || log.sellerId || "").toLowerCase();
        const buyer = (log.buyerName || log.buyerId || "").toLowerCase();
        return prod.includes(query) || seller.includes(query) || buyer.includes(query);
      });
    }
    return list;
  };

  const fetchSwarmTelemetry = async () => {
    try {
      const resDna = await fetch("/api/agent/agent-dna");
      const dataDna = await resDna.json();
      if (dataDna.success) {
        setAgentDnas(dataDna.dnaList || []);
      }

      const resLogs = await fetch("/api/agent/negotiation-logs");
      const dataLogs = await resLogs.json();
      if (dataLogs.success) {
        setNegotiationLogs(dataLogs.logs || []);
      }
    } catch (e) {
      console.error("Lỗi khi tải telemetry của Swarm:", e);
    }
  };

  const triggerForcedShock = async (shockType: string) => {
    if (!confirm(`Bạn có chắc chắn muốn kích hoạt cú sốc thị trường "${shockType}"?`)) return;
    setIsTriggeringShock(true);
    setShockLogs([]);
    try {
      const res = await fetch(`/api/agent/heartbeat-tick?forceShock=${shockType}`);
      const data = await res.json();
      if (data.success) {
        setShockLogs(data.logs || []);
        alert(`Kích hoạt cú sốc ${shockType} thành công!`);
        fetchSwarmTelemetry();
      } else {
        alert("Lỗi kích hoạt cú sốc: " + data.message);
      }
    } catch (e: any) {
      alert("Lỗi kết nối API: " + e.message);
    } finally {
      setIsTriggeringShock(false);
    }
  };

  onMount(() => {
    fetchSwarmTelemetry();

    let ws: WebSocket | null = null;
    let wsReconnectTimer: any = null;

    const connectWs = () => {
      try {
        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname;
        ws = new WebSocket(`${protocol}//${host}:8080`);

        ws.onopen = () => {
          if (wsReconnectTimer) {
            clearInterval(wsReconnectTimer);
            wsReconnectTimer = null;
          }
        };

        ws.onmessage = async (event) => {
          try {
            const raw =
              event.data instanceof Blob ? await event.data.text() : event.data;
            const data = JSON.parse(raw);
            if (data.type === "swarm-telemetry-update") {
              if (data.dnaList) setAgentDnas(data.dnaList);
              if (data.logs) setNegotiationLogs(data.logs);
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          ws = null;
          scheduleReconnect();
        };
        ws.onerror = () => {
          ws = null;
          scheduleReconnect();
        };
      } catch (err) {
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (!wsReconnectTimer) {
        wsReconnectTimer = setInterval(() => {
          connectWs();
        }, 5000);
      }
    };

    connectWs();

    onCleanup(() => {
      if (ws) ws.close();
      if (wsReconnectTimer) clearInterval(wsReconnectTimer);
    });
  });

  <tsx>
    <div class={`p-6 space-y-6 animate-in fade-in duration-500 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
      <header
        class={`p-6 rounded-3xl shadow-sm border flex justify-between items-center ${
          theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
        }`}>
        <div class="flex items-center gap-4">
          <div class="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
            <Icon path={userGroup} class="w-8 h-8" />
          </div>
          <div>
            <h2 class="text-2xl font-bold">
              {"Mạng lưới 12 Agent (Swarm Telemetry)"}
            </h2>
            <p class={`text-sm mt-1 ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              {"Theo dõi hệ sinh thái Agent giao dịch thời gian thực"}
            </p>
          </div>
        </div>
      </header>
      {}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          class={`p-6 rounded-3xl border flex items-center gap-4 ${
            theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
          }`}>
          <div class="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl">
            <Icon path={currencyDollar} class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs text-gray-400 font-semibold">TỔNG TÀI SẢN SWARM</div>
            <div class="text-xl font-black mt-1 font-mono text-emerald-500">
              {formatCurrency(totalAssets())}
              {currencySymbol()}
            </div>
          </div>
        </div>
        <div
          class={`p-6 rounded-3xl border flex items-center gap-4 ${
            theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
          }`}>
          <div class="p-4 bg-blue-500/10 text-blue-500 rounded-2xl">
            <Icon path={server} class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs text-gray-400 font-semibold">KHỐI LƯỢNG GIAO DỊCH</div>
            <div class="text-xl font-black mt-1 font-mono text-blue-500">
              {formatCurrency(totalVolume())}
              {currencySymbol()}
            </div>
          </div>
        </div>
        <div
          class={`p-6 rounded-3xl border flex items-center gap-4 ${
            theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
          }`}>
          <div class="p-4 bg-purple-500/10 text-purple-500 rounded-2xl">
            <Icon path={globeAsiaAustralia} class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs text-gray-400 font-semibold">TỶ LỆ THÀNH CÔNG</div>
            <div class="text-xl font-black mt-1 font-mono text-purple-500">
              {successRate()}
              %
            </div>
          </div>
        </div>
        <div
          class={`p-6 rounded-3xl border flex items-center gap-4 ${
            theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
          }`}>
          <div class="p-4 bg-amber-500/10 text-amber-500 rounded-2xl">
            <Icon path={bolt} class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs text-gray-400 font-semibold">CHIẾT KHẤU TRUNG BÌNH</div>
            <div class="text-xl font-black mt-1 font-mono text-amber-500">
              -
              {avgDiscount()}
              %
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-6">
        <div class={`p-6 rounded-3xl border ${theme() === "dark" ? "bg-[#16161a] border-white/10" : "bg-white border-gray-100"}`}>
          <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h3 class="text-lg font-bold">Kích hoạt Biến động Thị trường (Force Shock)</h3>
              <p class="text-xs text-gray-500 mt-1">Ép thị trường thay đổi đột ngột để quan sát phản ứng của 12 Agent</p>
            </div>
            <div class="flex gap-2">
              <select
                value={selectedShockType()}
                onInput={(e) => setSelectedShockType(e.target.value)}
                class={`px-4 py-2 rounded-xl text-sm border font-medium outline-none ${
                  theme() === "dark" ? "bg-black/50 border-white/10 text-white" : "bg-gray-50 border-gray-200"
                }`}>
                <option value="LOGISTICS_BLOCKADE">Đứt gãy Chuỗi cung ứng</option>
                <option value="WEATHER_DISASTER">Thảm họa Thời tiết</option>
                <option value="SUDDEN_DEMAND_SPIKE">Tăng cầu đột biến</option>
              </select>
              <button
                onClick={() => triggerForcedShock(selectedShockType())}
                disabled={isTriggeringShock()}
                class="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                <Icon path={bolt} class="w-4 h-4" />
                {isTriggeringShock() ? "Đang kích hoạt..." : "Kích hoạt Sốc!"}
              </button>
            </div>
          </div>
        </div>
        {}
        <div class="flex justify-between items-center bg-black/10 p-1.5 rounded-2xl border border-gray-500/10">
          <div class="flex gap-1">
            <button
              onClick={() => setActiveVisualizerTab("causal")}
              class={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeVisualizerTab() === "causal"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-gray-400 hover:text-white"
              }`}>🌴 CÂY QUYẾT ĐỊNH NHÂN QUẢ (MICRO)</button>
            <button
              onClick={() => setActiveVisualizerTab("relationship")}
              class={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                activeVisualizerTab() === "relationship"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-gray-400 hover:text-white"
              }`}>🕸️ BẢN ĐỒ MẠNG LƯỚI SWARM (MACRO)</button>
          </div>
          <div class="text-[10px] text-gray-500 font-mono pr-2">
            {"Chế độ hiển thị tương tác"}
          </div>
        </div>
        {activeVisualizerTab() === "causal"
          ? <CausalNegotiationTree log={selectedLog()} />
          : <div
              class={`p-6 rounded-3xl border ${
                theme() === "dark" ? "bg-[#111115] border-indigo-500/10" : "bg-white border-gray-150"
              } space-y-6 animate-in fade-in duration-300`}>
              <div class="flex justify-between items-center border-b border-gray-500/10 pb-4">
                <div>
                  <h4 class="text-sm font-bold uppercase tracking-wider text-indigo-500">
                    {"Bản đồ mạng lưới quan hệ Swarm (Real-time Relationship Graph)"}
                  </h4>
                  <p class="text-xs text-gray-400 mt-1 font-medium">
                    {"Bản đồ dòng chảy tiền tệ và hàng hóa thời gian thực giữa các Agent"}
                  </p>
                </div>
              </div>
              <div
                class="w-full h-full flex items-center justify-center min-h-[420px] bg-black/15 dark:bg-black/35 rounded-2xl p-6 overflow-auto border border-gray-500/5">
                {relationMermaidHtml()
                  ? <div
                      class="w-full h-full flex items-center justify-center text-center mermaid-container"
                      innerHTML={relationMermaidHtml()}
                    />
                  : <div class="text-gray-500 italic text-sm">
                      {"Đang tải sơ đồ mạng lưới quan hệ..."}
                    </div>}
              </div>
            </div>}
        {}
        <div class={`p-6 rounded-3xl border ${theme() === "dark" ? "bg-[#16161a] border-white/10" : "bg-white border-gray-100"}`}>
          <div class="flex justify-between items-center mb-6">
            <div>
              <h3 class="text-lg font-bold">Lịch sử Giao dịch Tài chính (Financial Ledger)</h3>
              <p class="text-xs text-gray-500 mt-1">Sổ cái kế toán thời gian thực của hệ thống Swarm AI</p>
            </div>
            <input
              type="text"
              placeholder="Lọc sản phẩm, người bán, người mua..."
              value={ledgerSearchQuery()}
              onInput={(e) => setLedgerSearchQuery(e.target.value)}
              class={`px-4 py-2 text-sm rounded-xl border outline-none max-w-xs w-full ${
                theme() === "dark" ? "bg-black/50 border-white/10 text-white" : "bg-white border-gray-200"
              }`}
            />
          </div>
          <div class="overflow-x-auto rounded-2xl border border-gray-500/10">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr
                  class={`border-b border-gray-500/10 font-bold ${
                    theme() === "dark" ? "bg-black/40 text-gray-300" : "bg-gray-50 text-gray-600"
                  }`}>
                  <th class="p-4">MÃ GD</th>
                  <th class="p-4">SẢN PHẨM</th>
                  <th class="p-4">BÊN BÁN (SELLER)</th>
                  <th class="p-4">BÊN MUA (BUYER)</th>
                  <th class="p-4">GIÁ CHÀO</th>
                  <th class="p-4">GIÁ CHỐT</th>
                  <th class="p-4">CHIẾT KHẤU</th>
                  <th class="p-4">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {filteredNegotiationLogs().length === 0
                  ? <tr>
                      <td colspan="8" class="p-8 text-center text-gray-500 italic">Chưa có lịch sử giao dịch được ghi nhận.</td>
                    </tr>
                  : (filteredNegotiationLogs().map((log: any) => {
                      const isSuccess = log.success === true || log.success === 1 || log.success === "true";
                      const isSelected = selectedLogId() === log.id || !selectedLogId() && negotiationLogs()[0]?.id === log.id;
                      const initPrice = Number(log.sellerOffer1 || 0);
                      const finPrice = Number(log.finalizedPrice || 0);
                      const disc =
                        initPrice > 0 && isSuccess ? Math.round(((initPrice - finPrice) / initPrice) * 100) : 0;

                      return <tr
                        onClick={() => setSelectedLogId(log.id)}
                        class={`border-b border-gray-500/5 cursor-pointer transition-all hover:bg-indigo-500/5 ${
                          isSelected
                            ? (theme() === "dark" ? "bg-indigo-500/10 text-indigo-400 font-bold" : "bg-indigo-50 text-indigo-900 font-bold")
                            : ""
                        }`}>
                        <td class="p-4 font-mono text-xs">
                          {(log.id || "").substring(0, 8)}
                        </td>
                        <td class="p-4 font-bold">
                          {log.productName}
                        </td>
                        <td class="p-4 text-amber-500 font-semibold">
                          {log.sellerName || log.sellerId}
                        </td>
                        <td class="p-4 text-blue-500 font-semibold">
                          {log.buyerName || log.buyerId}
                        </td>
                        <td class="p-4 font-mono">
                          {formatCurrency(initPrice)}
                          {currencySymbol()}
                        </td>
                        <td class="p-4 font-mono">
                          {isSuccess ? `${formatCurrency(finPrice)} ${currencySymbol()}` : "-"}
                        </td>
                        <td class="p-4 font-mono text-amber-500">
                          {isSuccess && disc > 0 ? `-${disc}%` : "-"}
                        </td>
                        <td class="p-4">
                          <span
                            class={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              isSuccess
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                : "bg-red-500/10 border-red-500/20 text-red-500"
                            }`}>
                            {isSuccess ? "Thành công" : "Thất bại"}
                          </span>
                        </td>
                      </tr>;
                    }))}
              </tbody>
            </table>
          </div>
        </div>
        {}
        <div class={`p-6 rounded-3xl border ${theme() === "dark" ? "bg-[#16161a] border-white/10" : "bg-white border-gray-100"} space-y-6`}>
          <div>
            <h3 class="text-lg font-bold">📷 Số hóa hóa đơn & Chứng từ (AI OCR Engine)</h3>
            <p
              class="text-xs text-gray-500 mt-1">Sử dụng AI Multimodal Gemini để đọc phiếu cân, hóa đơn và tự động bóc tách dữ liệu thương mại</p>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {}
            <div
              class={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${
                theme() === "dark" ? "border-white/10 bg-black/20 hover:bg-black/35" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}>
              {ocrUploadedFileUrl()
                ? <div class="w-full flex flex-col items-center space-y-4">
                    <div class="relative max-h-64 rounded-xl overflow-hidden shadow-md border border-gray-500/10">
                      <img src={ocrUploadedFileUrl()!} alt="Document Preview" class="object-contain max-h-64" />
                    </div>
                    <div class="text-xs font-mono text-gray-400 break-all">
                      {ocrUploadedFileName()}
                    </div>
                    <button
                      onClick={() => {
                        setOcrUploadedFileUrl(null);
                        setOcrUploadedFileId(null);
                        setOcrUploadedFileName(null);
                        setOcrResult(null);
                      }}
                      class="px-4 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold transition-all">Xóa ảnh và Chọn lại</button>
                  </div>
                : <label class="cursor-pointer flex flex-col items-center space-y-3 py-6">
                    <div class="w-12 h-12 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-500">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                    </div>
                    <div class="text-center">
                      <span class="text-sm font-bold text-indigo-500">Nhấp để tải lên</span>
                      <span class="text-sm text-gray-500">hoặc kéo thả tập tin ảnh tại đây</span>
                    </div>
                    <span class="text-[10px] text-gray-400">Hỗ trợ PNG, JPG, JPEG</span>
                    <input type="file" accept="image/*" onChange={handleOcrFileChange} class="hidden" />
                  </label>}
              {isOcrProcessing() &&
                <div class="mt-4 flex items-center gap-3 text-sm text-indigo-500 font-medium">
                  <div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>AI đang phân tích tài liệu, xin chờ...</span>
                </div>}
              {ocrError() &&
                <div class="mt-4 text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
                  {ocrError()}
                </div>}
            </div>
            {}
            <div class="space-y-4">
              <h4 class="text-sm font-bold uppercase tracking-wider text-indigo-500">Thông tin trích xuất</h4>
              {!ocrResult()
                ? <div
                    class="flex items-center justify-center h-48 border border-dashed border-gray-500/10 rounded-2xl text-xs text-gray-500 italic">Chưa có dữ liệu. Vui lòng tải lên tài liệu để AI bóc tách thông tin.</div>
                : <div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div class="space-y-1.5 col-span-2">
                      <label class="text-xs font-bold text-gray-400">Tên Sản phẩm nông sản</label>
                      <input
                        type="text"
                        value={ocrProductName()}
                        onInput={(e) => setOcrProductName((e.target as HTMLInputElement).value)}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Số lượng (kg)</label>
                      <input
                        type="number"
                        value={ocrQuantity()}
                        onInput={(e) => setOcrQuantity(Number((e.target as HTMLInputElement).value))}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Đơn giá (đ/kg)</label>
                      <input
                        type="number"
                        value={ocrUnitPrice()}
                        onInput={(e) => {
                          const val = Number((e.target as HTMLInputElement).value);
                          setOcrUnitPrice(val);
                          setOcrTotalPrice(val * ocrQuantity());
                        }}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Tổng tiền (đ)</label>
                      <input
                        type="number"
                        value={ocrTotalPrice()}
                        onInput={(e) => setOcrTotalPrice(Number((e.target as HTMLInputElement).value))}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Ngày lập chứng từ</label>
                      <input
                        type="text"
                        value={ocrDocumentDate()}
                        onInput={(e) => setOcrDocumentDate((e.target as HTMLInputElement).value)}
                        placeholder="YYYY-MM-DD"
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Bên bán (Seller)</label>
                      <input
                        type="text"
                        value={ocrSellerName()}
                        onInput={(e) => setOcrSellerName((e.target as HTMLInputElement).value)}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="text-xs font-bold text-gray-400">Bên mua (Buyer)</label>
                      <input
                        type="text"
                        value={ocrBuyerName()}
                        onInput={(e) => setOcrBuyerName((e.target as HTMLInputElement).value)}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="space-y-1.5 col-span-2">
                      <label class="text-xs font-bold text-gray-400">Tài xế / Người vận chuyển</label>
                      <input
                        type="text"
                        value={ocrDriverName()}
                        onInput={(e) => setOcrDriverName((e.target as HTMLInputElement).value)}
                        class={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${
                          theme() === "dark" ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200"
                        }`}
                      />
                    </div>
                    <div class="col-span-2 pt-2">
                      <button
                        onClick={handleSaveOcrTransaction}
                        disabled={isOcrSaving()}
                        class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50">
                        {isOcrSaving() ? "Đang ghi nhận..." : "Ghi nhận giao dịch vào Sổ cái Swarm"}
                      </button>
                    </div>
                  </div>}
            </div>
          </div>
        </div>
        {}
        <div class={`p-6 rounded-3xl border ${theme() === "dark" ? "bg-[#16161a] border-white/10" : "bg-white border-gray-100"}`}>
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold">
              Danh sách Agent DNA (
              {filteredAgentDnas().length}
              )
            </h3>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Tìm tên Agent..."
                value={agentSearchQuery()}
                onInput={(e) => setAgentSearchQuery(e.target.value)}
                class={`px-3 py-1.5 text-sm rounded-lg border outline-none ${
                  theme() === "dark" ? "bg-black/50 border-white/10 text-white" : "bg-white border-gray-200"
                }`}
              />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAgentDnas().map(
              (dna: any) => <div
                class={`p-4 rounded-2xl border transition-all hover:-translate-y-1 ${
                  theme() === "dark" ? "bg-[#222222] border-white/5 hover:border-blue-500/30" : "bg-gray-50 border-gray-100 hover:shadow-md"
                }`}>
                <div class="flex justify-between items-start mb-2">
                  <div class="font-bold text-sm truncate">
                    {dna.contextValue?.agentName || dna.sessionId}
                  </div>
                  <div
                    class={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                      dna.state === "IDLE" ? "bg-gray-500/20 text-gray-500" : "bg-emerald-500/20 text-emerald-500"
                    }`}>
                    {dna.state || "IDLE"}
                  </div>
                </div>
                <div class="space-y-1 text-xs">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Lòng tham:</span>
                    <span class="font-mono text-amber-500">
                      {(dna.contextValue?.greed || 0).toFixed(2)}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Thù dai:</span>
                    <span class="font-mono text-red-500">
                      {(dna.contextValue?.vengeance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Tài sản:</span>
                    <span class="font-mono text-emerald-500">
                      {formatCurrency(dna.contextValue?.wealth || 0)}
                      {currencySymbol()}
                    </span>
                  </div>
                </div>
              </div>,
            )}
          </div>
        </div>
      </div>
    </div>
  </tsx>
}
