import { createSignal, createEffect, onMount, onCleanup, createMemo } from "solid-js";
import { rpc } from "~/client/utils/rpcClient";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import { plusCircle, minusCircle, pencil, trash, bookmarkSquare, bolt } from "solid-heroicons/outline";
import { DiagramView } from "./diagram.tsrx";

const DEFAULT_DIMENSIONS = [
  "SUY LUẬN & LOGIC",
  "TỐC ĐỘ PHẢN HỒI",
  "ĐỘ CHÍNH XÁC DỮ LIỆU",
  "THẤU HIỂU NGỮ CẢNH",
  "KHẢ NĂNG TỰ HỌC",
  "QUẢN LÝ ĐA NHIỆM",
  "TÍCH HỢP HỆ THỐNG",
  "AN TOÀN & BẢO MẬT",
  "SÁNG TẠO NỘI DUNG",
  "GIAO TIẾP TỰ NHIÊN",
];

export component HeavyChart() {
  const [activeSubTab, setActiveSubTab] = createSignal<"chart" | "diagram">("chart");
  const [allPresets, setAllPresets] = createSignal<Record<string, any>>({});

  // Custom interactive dialog state
  const [showSaveModal, setShowSaveModal] = createSignal(false);
  const [saveModalMode, setSaveModalMode] = createSignal<"create_chart" | "save_preset">("save_preset");
  const [saveModalName, setSaveModalName] = createSignal("");

  // Custom toast notification state
  const [toast, setToast] = createSignal<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  let toastTimeout: any = null;
  const showToast = (type: "success" | "error" | "warning", msg: string) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    setToast({ type, message: msg });
    toastTimeout = setTimeout(() => {
      setToast(null);
    }, 4000);
  };
  const [allGroups, setAllGroups] = createSignal<{ label: string; keys: string[] }[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [dimensions, setDimensions] = createSignal<string[]>([...DEFAULT_DIMENSIONS]);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [selectedPreset, setSelectedPreset] = createSignal("");
  const [scores, setScores] = createSignal<number[]>([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);

  const [comparePreset, setComparePreset] = createSignal("none");
  const compareScores = createMemo<number[]>(() => {
    const key = comparePreset();
    if (key === "none") return [];
    const compPreset = allPresets()[key];
    if (!compPreset) return [];
    const compDims = compPreset.dimensions || DEFAULT_DIMENSIONS;
    return dimensions().map((dim) => {
      const idx = compDims.indexOf(dim);
      if (idx !== -1 && compPreset.values[idx] !== undefined) {
        return compPreset.values[idx];
      }
      return 5;
    });
  });

  const [searchQuery, setSearchQuery] = createSignal("");
  const [isAgentAnalyzing, setIsAgentAnalyzing] = createSignal(false);
  const [agentResponse, setAgentResponse] = createSignal<string | null>(null);
  const [isOpen, setIsOpen] = createSignal(false);

  let searchContainerRef: HTMLDivElement | undefined;

  // Close search dropdown on click outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef && !searchContainerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
    });
  });

  // Filtered preset groups based on real-time typing
  const filteredGroups = () => {
    const q = searchQuery().toLowerCase().trim();
    const groups = allGroups();
    if (!q) return groups;

    return groups.map((g) => {
      const keys = g.keys.filter((k) => {
        const p = allPresets()[k];
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || k.toLowerCase().includes(q);
      });
      return { label: g.label, keys };
    }).filter((g) => g.keys.length > 0);
  };

  // SVG Geometry - Automatically adapts to ANY number of dimensions (N)
  const cx = 250;
  const cy = 250;
  const R = 150;
  const N = () => dimensions().length;

  // Reactive array of indexes for the slider loop
  const indexes = () => Array.from({ length: N() }).map((_, i) => i);

  const getCoordinates = (index: number, score: number) => {
    const angle = index * (2 * Math.PI / N()) - Math.PI / 2;
    const radius = R * (score / 10);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  // Handlers
  // Handlers
  const handlePresetSelect = (key: string) => {
    setSelectedPreset(key);

    const preset = allPresets()[key];
    if (preset.dimensions && preset.dimensions.length > 0) {
      setDimensions([...preset.dimensions]);
    } else {
      setDimensions([...DEFAULT_DIMENSIONS]);
    }

    const pVals = preset.values;
    const paddedScores = [...pVals];
    while (paddedScores.length < dimensions().length) {
      paddedScores.push(5);
    }
    setScores(paddedScores);

    setSearchQuery("");
    setIsOpen(false);
  };

  const handleCompareSelect = (key: string) => {
    setComparePreset(key);
  };

  const handleScoreChange = (index: number, val: number) => {
    const newScores = [...scores()];
    newScores[index] = val;
    setScores(newScores);
    if (selectedPreset() !== "custom" && !selectedPreset().startsWith("custom_")) {
      setSelectedPreset("custom");
    }
  };

  const handleUpdateDimensionName = (idx: number, newName: string) => {
    const trimmed = newName.trim();
    const updated = [...dimensions()];
    if (!trimmed) {
      updated[idx] = `ĐỈNH MỚI ${idx + 1}`;
    } else {
      updated[idx] = trimmed.toUpperCase();
    }
    setDimensions(updated);
    setSelectedPreset("custom");
  };

  const handleAddDimension = () => {
    const newDims = [...dimensions(), ""];
    setDimensions(newDims);
    setScores([...scores(), 5]);
    setSelectedPreset("custom");
    setEditingIndex(newDims.length - 1);
  };

  const handleRemoveDimension = (index: number) => {
    if (dimensions().length <= 3) {
      showToast("warning", "Đồ thị phải có ít nhất 3 chiều!");
      return;
    }
    const newDims = [...dimensions()];
    newDims.splice(index, 1);
    setDimensions(newDims);

    const newScores = [...scores()];
    newScores.splice(index, 1);
    setScores(newScores);

    setSelectedPreset("custom");
    if (editingIndex() === index) {
      setEditingIndex(null);
    } else if (editingIndex() !== null && editingIndex()! > index) {
      setEditingIndex(editingIndex()! - 1);
    }
  };

  const handleRemoveLastDimension = () => {
    if (dimensions().length <= 3) {
      showToast("warning", "Đồ thị phải có ít nhất 3 chiều!");
      return;
    }
    const newDims = [...dimensions()];
    newDims.pop();
    setDimensions(newDims);

    const newScores = [...scores()];
    newScores.pop();
    setScores(newScores);

    setSelectedPreset("custom");
    if (editingIndex() === dimensions().length) {
      setEditingIndex(null);
    }
  };

  const handleEditDimensionName = (index: number) => {
    setEditingIndex(index);
  };

  const handleAddNewRadarChart = () => {
    setSaveModalMode("create_chart");
    setSaveModalName("");
    setShowSaveModal(true);
  };

  const executeAddNewRadarChart = (name: string) => {
    setDimensions([...DEFAULT_DIMENSIONS]);
    setScores([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    setComparePreset("none");
    setSelectedPreset("custom");

    const key = "custom_" + Date.now();
    const newPreset: Preset = {
      name: name + " 🌟",
      description: "Radar Chart mới do bạn tự thiết kế.",
      values: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      dimensions: [...DEFAULT_DIMENSIONS],
    };

    setAllPresets({ ...allPresets(), [key]: newPreset });

    const currentGroups = [...allGroups()];
    const customGroupIdx = currentGroups.findIndex((g) => g.label === "Tùy chỉnh cá nhân ✍️");
    if (customGroupIdx !== -1) {
      currentGroups[customGroupIdx].keys.push(key);
    } else {
      currentGroups.unshift({ label: "Tùy chỉnh cá nhân ✍️", keys: [key] });
    }
    setAllGroups(currentGroups);
    setSelectedPreset(key);

    // Persist to PostgreSQL DB
    rpc["strategy-presets"].$post({
      json: {
        name: newPreset.name,
        description: newPreset.description,
        values: newPreset.values,
        dimensions: newPreset.dimensions,
      },
    }).then((res) => {
      if (res.ok) {
        res.json().then((data) => {
          if (data.id) {
            const updated = { ...allPresets() };
            delete updated[key];
            updated[data.id] = newPreset;
            setAllPresets(updated);

            const updatedGroups = allGroups().map((g) => {
              if (g.label === "Tùy chỉnh cá nhân ✍️") {
                return { ...g, keys: g.keys.map((k) => k === key ? data.id : k) };
              }
              return g;
            });
            setAllGroups(updatedGroups);
            setSelectedPreset(data.id);
          }
        });
      }
    }).catch(console.error);
  };

  // Fetch presets from DB on component mount
  onMount(async () => {
    try {
      const res = await rpc["strategy-presets"].$get();
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.presets) {
          const fetchedPresets: Record<string, Preset> = {};
          const groupsMap: Record<string, string[]> = {};

          data.presets.forEach((p: any) => {
            fetchedPresets[p.id] = {
              name: p.name,
              description: p.description,
              values: p.values,
              dimensions: p.dimensions,
            };
            const cat = p.category || "Tùy chỉnh cá nhân ✍️";
            if (!groupsMap[cat]) groupsMap[cat] = [];
            groupsMap[cat].push(p.id);
          });

          setAllPresets(fetchedPresets);

          const newGroups = Object.keys(groupsMap).map(
            (label) => ({
              label,
              keys: groupsMap[label],
            }),
          );
          setAllGroups(newGroups);

          // Select Antigravity ProMax as default if exists
          const antiId = Object.keys(fetchedPresets).find((k) => fetchedPresets[k].name.includes("Antigravity"));
          if (antiId) {
            setSelectedPreset(antiId);
            if (fetchedPresets[antiId].dimensions) {
              setDimensions([...fetchedPresets[antiId].dimensions]);
            }
            setScores([...fetchedPresets[antiId].values]);
          } else if (Object.keys(fetchedPresets).length > 0) {
            const firstId = Object.keys(fetchedPresets)[0];
            setSelectedPreset(firstId);
            if (fetchedPresets[firstId].dimensions) {
              setDimensions([...fetchedPresets[firstId].dimensions]);
            }
            setScores([...fetchedPresets[firstId].values]);
          }

          const claudeId = Object.keys(fetchedPresets).find((k) => fetchedPresets[k].name.includes("Claude"));
          if (claudeId) {
            setComparePreset(claudeId);
          }
        }
      }
    } catch (e) {
      console.error("Lỗi khi tải hình mẫu từ SQL:", e);
    } finally {
      setIsLoading(false);
    }
  });

  const handleAddPreset = () => {
    setSaveModalMode("save_preset");
    setSaveModalName("");
    setShowSaveModal(true);
  };

  const executeAddPreset = async (name: string) => {
    const key = "custom_" + Date.now();
    const currentValues = [...scores()];
    const currentDims = [...dimensions()];
    const newPreset: Preset = {
      name: name + " 🌟",
      description: "Hình mẫu chỉ số của biểu đồ mạng nhện.",
      values: currentValues,
    };

    // Optimistic UI Update
    setAllPresets({ ...allPresets(), [key]: newPreset });

    // Add to custom group
    const currentGroups = [...allGroups()];
    const customGroupIdx = currentGroups.findIndex((g) => g.label === "Tùy chỉnh cá nhân ✍️");
    if (customGroupIdx !== -1) {
      currentGroups[customGroupIdx].keys.push(key);
    } else {
      currentGroups.unshift({ label: "Tùy chỉnh cá nhân ✍️", keys: [key] });
    }
    setAllGroups(currentGroups);

    setSelectedPreset(key);

    // Persist to PostgreSQL DB via RPC
    try {
      const res = await rpc["strategy-presets"].$post({
        json: {
          name: newPreset.name,
          description: newPreset.description,
          values: currentValues,
          dimensions: currentDims,
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Optional: replace the local key with the actual DB UUID
        if (data.id) {
          const updated = { ...allPresets() };
          delete updated[key];
          updated[data.id] = newPreset;
          setAllPresets(updated);

          const updatedGroups = allGroups().map((g) => {
            if (g.label === "Tùy chỉnh cá nhân ✍️") {
              return { ...g, keys: g.keys.map((k) => k === key ? data.id : k) };
            }
            return g;
          });
          setAllGroups(updatedGroups);
          setSelectedPreset(data.id);
        }
        showToast("success", `Đã lưu thành công hình mẫu: ${name}`);
      } else {
        showToast("error", "Có lỗi khi lưu vào SQL. (Vẫn hiển thị offline)");
      }
    } catch (e) {
      console.error("Lỗi lưu SQL:", e);
      showToast("error", "Không thể kết nối Backend lưu SQL!");
    }
  };

  // Reactive SVG elements Optimized with createMemo
  const polygonPoints = createMemo(() => {
    return scores().map((score, index) => {
      const { x, y } = getCoordinates(index, score);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  });

  const comparePolygonPoints = createMemo(() => {
    if (comparePreset() === "none") return "";
    return compareScores().map((score, index) => {
      const { x, y } = getCoordinates(index, score);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  });

  const compareVertexMarkers = createMemo(() => {
    if (comparePreset() === "none") return [];
    return compareScores().map((score, idx) => {
      const angle = idx * (2 * Math.PI / N()) - Math.PI / 2;
      const radius = 150 * (score / 10);
      return { x: 250 + radius * Math.cos(angle), y: 250 + radius * Math.sin(angle), angle, score };
    });
  });

  const gridLevels = createMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
      const pts = Array.from({ length: N() }).map((_, idx) => {
        const angle = idx * (2 * Math.PI / N()) - Math.PI / 2;
        const radius = 150 * (level / 10);
        return `${(250 + radius * Math.cos(angle)).toFixed(1)},${(250 + radius * Math.sin(angle)).toFixed(1)}`;
      }).join(" ");
      return { level, points: pts, yText: 250 - 150 * (level / 10) };
    });
  });

  const gridLines = createMemo(() => {
    return Array.from({ length: N() }).map((_, idx) => {
      const angle = idx * (2 * Math.PI / N()) - Math.PI / 2;
      return { x2: 250 + 150 * Math.cos(angle), y2: 250 + 150 * Math.sin(angle) };
    });
  });

  const vertexMarkers = createMemo(() => {
    return scores().map((score, idx) => {
      const angle = idx * (2 * Math.PI / N()) - Math.PI / 2;
      const radius = 150 * (score / 10);
      return { x: 250 + radius * Math.cos(angle), y: 250 + radius * Math.sin(angle), angle, score };
    });
  });

  const outerLabels = createMemo(() => {
    return dimensions().map((dim, idx) => {
      const angle = idx * (2 * Math.PI / N()) - Math.PI / 2;
      let distance = 150 + 26;
      if (idx === 0) distance = 150 + 18;
      if (idx === Math.floor(N() / 2)) distance = 150 + 22;

      const x = 250 + distance * Math.cos(angle);
      const y = 250 + distance * Math.sin(angle);

      let anchor = "middle";
      if (Math.abs(x - 250) < 15) {
        anchor = "middle";
      } else if (x > 250) {
        anchor = "start";
      } else {
        anchor = "end";
      }

      const mainScore = scores()[idx];
      const compareScore =
        comparePreset() !== "none" ? compareScores()[idx] : null;

      return { x, y, dim, anchor, mainScore, compareScore };
    });
  });

  const currentPlaceholder = () => {
    return allPresets()[selectedPreset()]?.name || "Tìm kiếm AI Model...";
  };

  // Helper to extract a score by dimension name dynamically (safe against dim additions/reorders)
  const getValByDimName = (presetVals: number[], dimName: string, fallbackVal: number = 5) => {
    const currentDims = dimensions();
    const idx = currentDims.indexOf(dimName);
    if (idx !== -1 && presetVals[idx] !== undefined) {
      return presetVals[idx];
    }
    return fallbackVal;
  };

  // Find historical group containing a preset key
  const findGeneralEra = (key: string) => {
    const groups = allGroups();
    const group = groups.find((g) => g.keys.includes(key));
    return group ? group : groups[0];
  };

  const handleAgentAnalyze = async () => {
    if (isAgentAnalyzing()) return;
    setIsAgentAnalyzing(true);
    setAgentResponse(null);
    try {
      const isCustom = selectedPreset() === "custom" || selectedPreset() === "";
      const res = await rpc["agent-analyze-radar"].$post({
        json: {
          mainPresetId: isCustom ? "custom" : selectedPreset(),
          comparePresetId: comparePreset(),
          customData: isCustom
            ? {
                name: "Hình mẫu tùy chỉnh",
                values: scores(),
                dimensions: dimensions(),
              }
            : undefined,
        },
      });
      const data = await res.json();
      if (data.status === "success") {
        setAgentResponse(data.markdown);
      } else {
        setAgentResponse("❌ Rottra Agent gặp lỗi khi phân tích dữ liệu.");
      }
    } catch (error) {
      setAgentResponse("❌ Mất kết nối tới máy chủ Rottra Agent.");
    } finally {
      setIsAgentAnalyzing(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text.replace(
      /### (.*?)(?=\n|$)/g,
      "<h3 class=\"text-lg font-black mt-4 mb-2 text-violet-600 dark:text-violet-400\">$1</h3>",
    ).replace(
      /#### (.*?)(?=\n|$)/g,
      "<h4 class=\"text-sm font-bold mt-4 mb-1 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider\">$1</h4>",
    ).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(
      /- \*\*(.*?)\*\*(.*?)(?=\n|$)/g,
      "<li class=\"ml-4 list-disc\"><strong class=\"text-gray-900 dark:text-white\">$1</strong>$2</li>",
    ).replace(/\n/g, "<br/>");
  };

  <Show
    when={!isLoading()}
    fallback={<>
      <div class="w-full flex items-center justify-center p-20 text-violet-500 font-bold animate-pulse">
        {"Đang tải Dữ liệu từ SQL..."}
      </div>
    </>}>
    <div class="w-full max-w-5xl space-y-6">
      {/* Sub-tab switcher for Chart and Diagram */}
      <div
        class={`p-2 rounded-2xl border flex items-center gap-2 w-fit ${
          theme() === "dark" ? "bg-[#141414] border-white/5" : "bg-gray-50 border-gray-100"
        }`}>
        <button
          onClick={() => setActiveSubTab("chart")}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab() === "chart"
              ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
              : (theme() === "dark" ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-800")
          }`}>
          {"Biểu đồ Radar Năng lực AI"}
        </button>
        <button
          onClick={() => setActiveSubTab("diagram")}
          class={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab() === "diagram"
              ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
              : (theme() === "dark" ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-800")
          }`}>
          {"Sơ đồ Kiến trúc & Động lực học"}
        </button>
      </div>

      <div class={activeSubTab() === "chart" ? "block space-y-6 w-full" : "hidden"}>
        {/* First Section: Spider Chart & Sliders */}
        <div
          class={`p-6 md:p-8 rounded-3xl shadow-sm border w-full transition-all duration-300 animate-in fade-in zoom-in-95 ${
            theme() === "dark" ? "bg-[#1a1a1a] border-white/10 text-white" : "bg-white border-gray-100 text-gray-800"
          }`}>
          {/* Header section with Premium Autocomplete Search Bar */}
          <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-500/10 pb-6">
            <div>
              <h3 class={`font-black text-2xl tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>
                {"MÔ HÌNH ĐÁNH GIÁ NĂNG LỰC TRÍ TUỆ NHÂN TẠO (AI AGENT)"}
              </h3>
              <p class="text-xs font-bold text-violet-500 uppercase tracking-widest mt-1">
                {"Spider Radar Chart: "}
                {N()}
                {" Chiều Thông Số Đo Lường AI Toàn Diện"}
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-4 w-full xl:w-auto z-[100] items-stretch sm:items-center">
              {/* PRIMARY SEARCH */}
              <div ref={searchContainerRef} class="relative w-full sm:w-72">
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                      <path
                        fill-rule="evenodd"
                        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder={currentPlaceholder()}
                    value={searchQuery()}
                    onInput={(e) => {
                      setSearchQuery(e.currentTarget.value);
                      setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    class={`w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:border-violet-500 focus:ring-4 focus:ring-violet-100 outline-none transition-all placeholder:text-gray-500 font-bold text-xs ${
                      theme() === "dark"
                        ? "bg-zinc-900 border-white/10 text-white focus:bg-zinc-950 focus:ring-violet-950/40"
                        : "bg-gray-50 border-gray-200 text-gray-800 focus:bg-white"
                    }`}
                  />
                  <button
                    onClick={() => {
                      if (searchQuery()) {
                        setSearchQuery("");
                      } else {
                        setIsOpen(!isOpen());
                      }
                    }}
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-500 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      class={`w-5 h-5 transition-transform duration-200 ${isOpen() ? "rotate-180 text-violet-500" : ""}`}>
                      <path
                        fill-rule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                if (isOpen()) {
                  <div
                    class={`absolute right-0 top-full mt-2 w-full sm:w-96 rounded-2xl shadow-2xl border max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200 z-[150] ${
                      theme() === "dark" ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-gray-150 text-gray-800"
                    }`}>
                    if (filteredGroups().length === 0) {
                      <div class="px-5 py-8 text-center text-xs text-gray-400 italic">{"Không tìm thấy AI Model nào phù hợp..."}</div>
                    } else {
                      for (const group of filteredGroups()) {
                        <div class="border-b border-gray-500/10 last:border-b-0">
                          <div
                            class={`px-4 py-2 text-[10px] font-black uppercase tracking-wider ${
                              theme() === "dark" ? "bg-zinc-800/40 text-violet-400" : "bg-gray-50 text-violet-600"
                            }`}>
                            {group.label}
                          </div>
                          <div class="py-1">
                            for (const key of group.keys) {
                              <button
                                onClick={() => handlePresetSelect(key)}
                                class={`w-full text-left px-4 py-2.5 text-xs font-semibold flex flex-col transition-colors cursor-pointer ${
                                  selectedPreset() === key
                                    ? theme() === "dark"
                                      ? "bg-violet-950/40 text-violet-400"
                                      : "bg-violet-50 text-violet-600"
                                    : theme() === "dark"
                                      ? "hover:bg-zinc-800/50 text-gray-200"
                                      : "hover:bg-gray-50 text-gray-700"
                                }`}>
                                <div class="flex justify-between items-center w-full">
                                  <span class="font-bold">{allPresets()[key]?.name}</span>
                                  <span class="text-[10px] opacity-75 font-mono">{`[${allPresets()[key]?.values.join(",")}]`}</span>
                                </div>
                                <span class="text-[10px] opacity-75 font-normal mt-0.5 line-clamp-1">
                                  {allPresets()[key]?.description}
                                </span>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    }
                  </div>
                }
              </div>

              {/* DUAL COMPARISON TARGET SELECT */}
              <div class="flex items-center gap-2">
                <span class="text-xs font-black uppercase text-emerald-500 tracking-wider">{"ĐỐI CHIẾU:"}</span>
                <select
                  value={comparePreset()}
                  onChange={(e) => handleCompareSelect(e.target.value)}
                  class={`pl-3 pr-8 py-3 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-xs outline-none transition-all cursor-pointer ${
                    theme() === "dark"
                      ? "bg-zinc-900 border-white/10 text-white focus:bg-zinc-950 focus:border-emerald-500"
                      : "bg-gray-50 border-gray-200 text-gray-800 focus:bg-white focus:border-emerald-500"
                  }`}>
                  <option value="none">{"-- Không đối chiếu --"}</option>
                  for (const group of allGroups()) {
                    <optgroup label={group.label}>
                      for (const key of group.keys) {
                        <option value={key} selected={comparePreset() === key}>
                          {allPresets()[key]?.name}
                        </option>
                      }
                    </optgroup>
                  }
                </select>
              </div>
            </div>
          </div>

          {/* Preset description alert block */}
          <div
            class={`p-5 rounded-2xl border mb-8 transition-all duration-300 ${
              theme() === "dark"
                ? "bg-violet-950/20 border-violet-900/30 text-violet-200"
                : "bg-violet-50 border-violet-100 text-violet-900"
            }`}>
            <h4 class="font-bold text-sm flex items-center gap-2">
              <span>{"🎯"}</span>
              {allPresets()[selectedPreset()]?.name || "Tùy chỉnh của bạn"}
              if (comparePreset() !== "none") {
                <span class="text-xs font-normal opacity-60">{" so với "}</span>
                <span class="text-emerald-500 font-extrabold">{allPresets()[comparePreset()]?.name}</span>
              }
            </h4>
            <p class="text-xs mt-1.5 opacity-90 leading-relaxed">
              {allPresets()[selectedPreset()]?.description || "Nhấp vào các thanh kéo ở bảng điều khiển bên phải để thiết kế đồ thị."}
            </p>
          </div>

          {/* Main visualization grid */}
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* LEFT COLUMN: Dynamic SVG Radar Chart */}
            <div class="lg:col-span-7 flex justify-center items-center">
              <div
                class={`relative p-4 rounded-3xl border flex justify-center w-full ${
                  theme() === "dark" ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-100"
                }`}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="-120 -50 740 600"
                  class="w-full max-w-[600px] h-auto drop-shadow-lg overflow-visible">
                  <defs>
                    <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.1" />
                      <stop offset="70%" stop-color="#a78bfa" stop-opacity="0.35" />
                      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.55" />
                    </radialGradient>
                    <radialGradient id="radarGradCompare" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stop-color="#10b981" stop-opacity="0.05" />
                      <stop offset="70%" stop-color="#34d399" stop-opacity="0.2" />
                      <stop offset="100%" stop-color="#10b981" stop-opacity="0.35" />
                    </radialGradient>
                  </defs>

                  {/* 1. Dynamic Concentric Polygons */}
                  for (const item of gridLevels()) {
                    <polygon
                      points={item.points}
                      fill="none"
                      stroke={theme() === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}
                      stroke-dasharray="3,3"
                      stroke-width="1"
                    />
                    <text
                      x={250}
                      y={item.yText}
                      dy="4"
                      text-anchor="middle"
                      class="text-[9px] font-black pointer-events-none fill-gray-500/80">
                      {item.level}
                    </text>
                  }

                  {/* 2. Radial Axis Lines */}
                  for (const item of gridLines()) {
                    <line
                      x1={250}
                      y1={250}
                      x2={item.x2}
                      y2={item.y2}
                      stroke={theme() === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
                      stroke-width="1.2"
                    />
                  }

                  {/* 3. The Comparison Strategy Polygon (Overlay) */}
                  if (comparePreset() !== "none" && comparePolygonPoints()) {
                    <polygon
                      points={comparePolygonPoints()}
                      fill="url(#radarGradCompare)"
                      stroke="#10b981"
                      stroke-width="2.5"
                      stroke-dasharray="3,3"
                      stroke-linejoin="round"
                      class="transition-all duration-500 ease-out"
                    />
                  }

                  {/* 4. The Main User filled Strategy Polygon */}
                  <polygon
                    points={polygonPoints()}
                    fill="url(#radarGrad)"
                    stroke="#8b5cf6"
                    stroke-width="3"
                    stroke-linejoin="round"
                    class="transition-all duration-500 ease-out"
                  />

                  {/* 5. Tiny markers and score text on comparison vertices */}
                  if (comparePreset() !== "none") {
                    for (const item of compareVertexMarkers()) {
                      <circle
                        cx={item.x}
                        cy={item.y}
                        r="3.5"
                        fill="#10b981"
                        stroke="#ffffff"
                        stroke-width="1"
                        class="transition-all duration-500 ease-out shadow-sm"
                      />
                      <text
                        x={item.x}
                        y={item.y + 11}
                        text-anchor="middle"
                        class="text-[8px] font-black tracking-tighter"
                        fill="#34d399"
                        stroke={theme() === "dark" ? "#1a1a1a" : "#ffffff"}
                        stroke-width="2.5"
                        paint-order="stroke">
                        {item.score}
                      </text>
                    }
                  }

                  {/* 6. Tiny markers and score text on main vertices */}
                  for (const item of vertexMarkers()) {
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r="4.5"
                      fill="#8b5cf6"
                      stroke="#ffffff"
                      stroke-width="1.5"
                      class="transition-all duration-500 ease-out shadow-md"
                    />
                    <text
                      x={item.x}
                      y={item.y - 8}
                      text-anchor="middle"
                      class="text-[8px] font-black tracking-tighter"
                      fill="#c084fc"
                      stroke={theme() === "dark" ? "#1a1a1a" : "#ffffff"}
                      stroke-width="2.5"
                      paint-order="stroke">
                      {item.score}
                    </text>
                  }

                  {/* 7. Dynamic Labels on the outer circumference */}
                  for (const item of outerLabels()) {
                    <g class="transition-all duration-300">
                      <text
                        x={item.x}
                        y={item.y}
                        text-anchor={item.anchor}
                        class={`text-[9.5px] font-black tracking-tight ${theme() === "dark" ? "fill-gray-300" : "fill-gray-700"}`}>
                        {item.dim}
                      </text>
                      <text x={item.x} y={item.y + 11} text-anchor={item.anchor} class="text-[9px] font-bold tracking-tighter">
                        <tspan fill="#a78bfa">{item.mainScore}</tspan>
                        if (item.compareScore !== null) {
                          <tspan fill={theme() === "dark" ? "#4b5563" : "#d1d5db"}>{" | "}</tspan>
                          <tspan fill="#34d399">{item.compareScore}</tspan>
                        }
                      </text>
                    </g>
                  }

                  {/* 8. Legend Group */}
                  <g transform="translate(15, 20)" class="text-[9.5px] font-black">
                    <rect
                      x="0"
                      y="0"
                      width="180"
                      height="42"
                      rx="10"
                      fill={theme() === "dark" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)"}
                      stroke={theme() === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
                      stroke-width="1"
                    />

                    <circle cx="15" cy="14" r="5" fill="#8b5cf6" />
                    <text x="26" y="17" class={theme() === "dark" ? "fill-white" : "fill-gray-800"}>
                      {allPresets()[selectedPreset()]?.name ? allPresets()[selectedPreset()].name.split(" ")[0] : "Tùy chỉnh"}
                      {" (Chính)"}
                    </text>

                    if (comparePreset() !== "none") {
                      <line x1="10" y1="28" x2="20" y2="28" stroke="#10b981" stroke-width="2.5" stroke-dasharray="2,2" />
                      <circle cx="15" cy="28" r="4.2" fill="#10b981" />
                      <text x="26" y="31" class={theme() === "dark" ? "fill-white" : "fill-gray-800"}>
                        {allPresets()[comparePreset()]?.name ? allPresets()[comparePreset()].name.split(" ")[0] : "Model đối chiếu"}
                        {" (Đối chiếu)"}
                      </text>
                    } else {
                      <circle cx="15" cy="28" r="4.2" fill="gray" opacity="0.3" />
                      <text x="26" y="31" class="fill-gray-400 font-normal italic">{"Chưa chọn đối chiếu"}</text>
                    }
                  </g>
                </svg>
              </div>
            </div>
            <div class="lg:col-span-5 flex flex-col h-full justify-center">
              <div class="flex flex-col gap-2 border-b border-gray-500/10 pb-3 mb-4">
                <div class="flex justify-between items-center">
                  <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">{"Bảng điều chỉnh thông số chỉ số"}</h4>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    onClick={handleAddNewRadarChart}
                    class={`text-[10px] px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      theme() === "dark"
                        ? "bg-blue-900/40 text-blue-300 hover:bg-blue-800/60"
                        : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    }`}>
                    <Icon path={plusCircle} class="h-3.5 w-3.5" />
                    {"✨ THÊM RADAR CHART"}
                  </button>
                  <button
                    onClick={handleAddDimension}
                    class={`text-[10px] px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      theme() === "dark"
                        ? "bg-violet-900/40 text-violet-300 hover:bg-violet-800/60"
                        : "bg-violet-100 text-violet-600 hover:bg-violet-200"
                    }`}>
                    <Icon path={plusCircle} class="h-3.5 w-3.5" />
                    {"+ THÊM ĐỈNH"}
                  </button>
                  <button
                    onClick={handleRemoveLastDimension}
                    class={`text-[10px] px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      theme() === "dark" ? "bg-red-900/40 text-red-300 hover:bg-red-800/60" : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}>
                    <Icon path={minusCircle} class="h-3.5 w-3.5" />
                    {"- TRỪ ĐỈNH"}
                  </button>
                  <button
                    onClick={handleAddPreset}
                    class={`text-[10px] px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      theme() === "dark"
                        ? "bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/60"
                        : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                    }`}>
                    <Icon path={bookmarkSquare} class="h-3.5 w-3.5" />
                    {"LƯU & ĐẶT TÊN"}
                  </button>
                </div>
              </div>

              <div class="space-y-3.5 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                for (const idx of indexes()) {
                  <div class="flex flex-col gap-1">
                    <div class="flex justify-between items-center text-xs">
                      <div class="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveDimension(idx)}
                          class="text-red-400 hover:text-red-600 p-0.5 rounded transition-colors text-[10px] cursor-pointer"
                          title="Xóa đỉnh này">
                          <Icon path={trash} class="h-3.5 w-3.5" />
                        </button>

                        if (editingIndex() === idx) {
                          <div class="flex items-center gap-1">
                            <span class={`font-black ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>{`${idx + 1}. `}</span>
                            <input
                              type="text"
                              value={dimensions()[idx]}
                              onBlur={(e) => {
                                handleUpdateDimensionName(idx, e.currentTarget.value);
                                setEditingIndex(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateDimensionName(idx, e.currentTarget.value);
                                  setEditingIndex(null);
                                }
                              }}
                              class={`px-1.5 py-0.5 rounded text-[11px] font-black w-36 outline-none border focus:border-violet-500 ${
                                theme() === "dark" ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-gray-200 text-gray-800"
                              }`}
                              autofocus
                            />
                          </div>
                        } else {
                          <span
                            onClick={() => handleEditDimensionName(idx)}
                            class={`font-black cursor-pointer hover:text-violet-500 transition-colors flex items-center gap-1.5 ${
                              theme() === "dark" ? "text-gray-300" : "text-gray-700"
                            }`}
                            title="Nhấn để sửa tên">
                            {`${idx + 1}. ${dimensions()[idx]}`}
                            <span class="opacity-50 hover:opacity-100 transition-opacity">
                              <Icon path={pencil} class="h-3 w-3" />
                            </span>
                          </span>
                        }
                      </div>
                      <span class="font-bold text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded text-[11px] font-mono">
                        {`${scores()[idx]} / 10`}
                      </span>
                    </div>
                    <div class="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={scores()[idx]}
                        onInput={(e) => handleScoreChange(idx, parseInt(e.currentTarget.value))}
                        class="w-full accent-violet-500 h-1.5 bg-gray-500/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
          <div
            class={`mt-8 p-6 rounded-3xl border transition-all duration-500 ${
              theme() === "dark" ? "bg-[#141414] border-white/5" : "bg-gray-50/50 border-gray-100"
            }`}>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div
                  class={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    theme() === "dark" ? "bg-violet-900/40 text-violet-400" : "bg-violet-100 text-violet-600"
                  }`}>
                  {"🤖"}
                </div>
                <div>
                  <h3 class={`font-black text-lg ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>{"Rottra Agent"}</h3>
                  <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{"Heuristic AI Analyst"}</p>
                </div>
              </div>
              <button
                onClick={handleAgentAnalyze}
                disabled={isAgentAnalyzing()}
                class={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  isAgentAnalyzing()
                    ? "opacity-50 cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-violet-600 hover:bg-violet-700 text-white shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5"
                }`}>
                if (isAgentAnalyzing()) {
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {"Đang phân tích..."}
                } else {
                  <div class="flex items-center gap-2">
                    <Icon path={bolt} class="w-4 h-4" />
                    <span>{"Bắt đầu phân tích thông số"}</span>
                  </div>
                }
              </button>
            </div>

            <div
              class={`transition-all duration-500 overflow-hidden ${
                agentResponse() ? "max-h-[1000px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
              }`}>
              <div
                class={`p-5 rounded-2xl text-sm leading-relaxed ${
                  theme() === "dark" ? "bg-black/40 text-gray-300" : "bg-white border border-gray-100 text-gray-700 shadow-sm"
                }`}>
                if (agentResponse()) {
                  <div innerHTML={renderMarkdown(agentResponse()!)} class="markdown-content space-y-2" />
                }
              </div>
            </div>
          </div>
        </div>

        {/* Toast Notification overlay */}
        if (toast()) {
          <div class="fixed top-6 right-6 z-[999] animate-in fade-in slide-in-from-top-4 duration-300">
            <div
              class={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-black uppercase tracking-wider backdrop-blur-md ${
                toast()?.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : toast()?.type === "error"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}>
              if (toast()?.type === "success") {
                <span class="text-base">{"✅"}</span>
              } else if (toast()?.type === "error") {
                <span class="text-base">{"❌"}</span>
              } else {
                <span class="text-base">{"⚠️"}</span>
              }
              <span>{toast()?.message}</span>
            </div>
          </div>
        }

        {/* Custom Save Preset and Create Radar Chart Modal dialog */}
        if (showSaveModal()) {
          <div
            class="fixed inset-0 bg-black/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
              class={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 duration-300 ${
                theme() === "dark" ? "bg-[#161618] border-white/10 text-white" : "bg-white border-gray-150 text-gray-800"
              }`}>
              <h3 class="font-black text-lg tracking-tight uppercase mb-2">
                {saveModalMode() === "create_chart" ? "✨ Tạo Radar Chart Mới" : "Lưu hình mẫu biểu đồ mạng nhện"}
              </h3>
              <p class="text-xs text-gray-500 mb-6 font-semibold">
                {saveModalMode() === "create_chart"
                  ? "Nhập tên cho đồ thị Radar Chart mới để lưu trữ dữ liệu riêng biệt."
                  : "Lưu trữ hình mẫu biểu đồ mạng nhện vào cơ sở dữ liệu."}
              </p>

              <input
                type="text"
                placeholder="Nhập tên..."
                value={saveModalName()}
                onInput={(e) => setSaveModalName(e.currentTarget.value)}
                class={`w-full px-5 py-4 border rounded-2xl outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-500 transition-all font-black text-sm mb-6 ${
                  theme() === "dark"
                    ? "bg-zinc-900 border-white/10 text-white focus:ring-violet-950/40"
                    : "bg-gray-50 border-gray-200 text-gray-800"
                }`}
                autofocus
              />

              <div class="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveModalName("");
                  }}
                  class={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-colors ${
                    theme() === "dark" ? "border-white/10 hover:bg-zinc-800 text-white" : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}>
                  {"Hủy bỏ"}
                </button>
                <button
                  onClick={() => {
                    const name = saveModalName().trim();
                    if (!name) {
                      showToast("warning", "Tên không được để trống!");
                      return;
                    }
                    setShowSaveModal(false);
                    setSaveModalName("");
                    if (saveModalMode() === "create_chart") {
                      executeAddNewRadarChart(name);
                    } else {
                      executeAddPreset(name);
                    }
                  }}
                  class="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all active:scale-95 cursor-pointer">
                  {"Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        }
      </div>

      <div class={activeSubTab() === "diagram" ? "block w-full animate-in fade-in duration-500" : "hidden"}>
        <DiagramView />
      </div>
    </div>
  </Show>
}
