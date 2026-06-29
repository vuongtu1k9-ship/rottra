import { createSignal, onMount } from "solid-js";
import { Icon } from "solid-heroicons";
import { plus, trash, pencil, check, xMark, magnifyingGlass, bookOpen, arrowPath } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { ManageBilingual } from "./manage-bilingual.tsrx";

export component ManageLexicon() {
  const [activeSubTab, setActiveSubTab] = createSignal<"lexicon" | "bilingual">("lexicon");
  const [lexicons, setLexicons] = createSignal<any[]>([]);
  const [search, setSearch] = createSignal("");
  const [filterType, setFilterType] = createSignal("all");
  const [loading, setLoading] = createSignal(true);
  const [sortBy, setSortBy] = createSignal<string>("word");
  const [sortOrder, setSortOrder] = createSignal<"asc" | "desc">("asc");

  const toggleSort = (field: string) => {
    if (sortBy() === field) {
      setSortOrder(sortOrder() === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Form State
  const [showModal, setShowModal] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [formWord, setFormWord] = createSignal("");
  const [formType, setFormType] = createSignal("compound");
  const [formSubType, setFormSubType] = createSignal("");
  const [formDefinition, setFormDefinition] = createSignal("");
  const [formRelationsText, setFormRelationsText] = createSignal("");

  const fetchLexicons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rpc/lexicons");
      const data = await res.json();
      if (data.status === "success") {
        setLexicons(data.lexicons);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchLexicons();
  });

  const openAddModal = () => {
    setEditingId(null);
    setFormWord("");
    setFormType("compound");
    setFormSubType("");
    setFormDefinition("");
    setFormRelationsText("");
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setFormWord(item.word);
    setFormType(item.type);
    setFormSubType(item.subType || "");
    setFormDefinition(item.definition || "");
    setFormRelationsText(Array.isArray(item.relations) ? item.relations.join(", ") : "");
    setShowModal(true);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    if (!formWord().trim() || !formType()) return;

    const relations = formRelationsText().split(",").map((r) => r.trim()).filter((r) => r.length > 0);

    try {
      const res = await fetch("/api/rpc/lexicons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId(),
          word: formWord(),
          type: formType(),
          subType: formSubType(),
          definition: formDefinition(),
          relations: relations,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setShowModal(false);
        fetchLexicons();
      } else {
        alert("Lỗi: " + data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa thực thể ngôn ngữ này khỏi CSDL?")) return;

    try {
      const res = await fetch(`/api/rpc/lexicons/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.status === "success") {
        fetchLexicons();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredList = () => {
    const list = lexicons().filter((item) => {
      const matchesSearch =
        item.word.toLowerCase().includes(search().toLowerCase()) ||
          item.definition && item.definition.toLowerCase().includes(search().toLowerCase()) ||
          item.subType && item.subType.toLowerCase().includes(search().toLowerCase());
      const matchesFilter = filterType() === "all" || item.type === filterType();
      return matchesSearch && matchesFilter;
    });

    return list.sort((a, b) => {
      const field = sortBy();
      const valA = (a[field] ?? "").toString().toLowerCase();
      const valB = (b[field] ?? "").toString().toLowerCase();
      if (valA < valB) return sortOrder() === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder() === "asc" ? 1 : -1;
      return 0;
    });
  };

  <div class={`p-6 space-y-6 animate-in fade-in duration-500 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
    {/* Header */}
    <header
      class={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-3xl shadow-sm border ${
        theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
      }`}>
      <div class="flex items-center gap-4">
        <div class="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
          <Icon path={bookOpen} class="w-8 h-8" />
        </div>
        <div>
          <h2 class="text-2xl font-bold">{"Cổng Dữ liệu Ngôn ngữ học"}</h2>
          <p class={`text-sm ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            {"Phân hệ quản lý cấu trúc Ngữ pháp tiếng Việt nâng cao và Kho song ngữ Anh - Việt Rottra."}
          </p>
        </div>
      </div>
      if (activeSubTab() === "lexicon") {
        <button
          onClick={openAddModal}
          class="flex items-center gap-2 px-5 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
          <Icon path={plus} class="w-5 h-5" />
          {"Thêm thực thể ngôn ngữ"}
        </button>
      }
    </header>

    {/* Inner Sub-switcher for Văn Sử */}
    <div
      class={`p-2 rounded-2xl border flex items-center gap-2 w-fit ${
        theme() === "dark" ? "bg-[#141414] border-white/5" : "bg-gray-50 border-gray-100"
      }`}>
      <button
        onClick={() => setActiveSubTab("lexicon")}
        class={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
          activeSubTab() === "lexicon"
            ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
            : (theme() === "dark" ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-800")
        }`}>
        {"Từ vựng / Ngôn ngữ"}
      </button>
    </div>

    <div class={activeSubTab() === "lexicon" ? "block space-y-6" : "hidden"}>
      {/* Filters and Search */}
      <div
        class={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between ${
          theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
        }`}>
        <div class="relative w-full md:w-96">
          <span class="absolute inset-y-0 left-4 flex items-center text-gray-400">
            <Icon path={magnifyingGlass} class="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa, định nghĩa..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class={`w-full pl-12 pr-4 py-3 rounded-2xl border transition-all text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              theme() === "dark"
                ? "bg-gray-900 border-white/10 focus:border-indigo-500 text-white"
                : "bg-gray-50 border-gray-200 focus:border-indigo-500"
            }`}
          />
        </div>

        <div class="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilterType("all")}
            class={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              filterType() === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : (theme() === "dark"
                  ? "bg-gray-900 text-gray-400 hover:bg-white/5 hover:text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }`}>
            {"Tất cả"}
          </button>
          <button
            onClick={() => setFilterType("compound")}
            class={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              filterType() === "compound"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                : (theme() === "dark"
                  ? "bg-gray-900 text-gray-400 hover:bg-white/5 hover:text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }`}>
            {"Từ ghép"}
          </button>
          <button
            onClick={() => setFilterType("reduplicative")}
            class={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              filterType() === "reduplicative"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/10"
                : (theme() === "dark"
                  ? "bg-gray-900 text-gray-400 hover:bg-white/5 hover:text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }`}>
            {"Từ láy"}
          </button>
          <button
            onClick={() => setFilterType("antonym")}
            class={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              filterType() === "antonym"
                ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                : (theme() === "dark"
                  ? "bg-gray-900 text-gray-400 hover:bg-white/5 hover:text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }`}>
            {"Từ đối (Trái nghĩa)"}
          </button>
          <button
            onClick={() => setFilterType("synonym")}
            class={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              filterType() === "synonym"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                : (theme() === "dark"
                  ? "bg-gray-900 text-gray-400 hover:bg-white/5 hover:text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }`}>
            {"Từ đồng nghĩa"}
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div
        class={`rounded-3xl border shadow-sm overflow-hidden ${
          theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
        }`}>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr
                class={`text-xs font-bold uppercase tracking-wider border-b ${
                  theme() === "dark" ? "bg-[#181818] border-white/10 text-gray-400" : "bg-gray-50/50 border-gray-100 text-gray-500"
                }`}>
                <th
                  class="px-6 py-4 cursor-pointer hover:text-indigo-500 transition-all duration-200 select-none"
                  onClick={() => toggleSort("word")}>
                  <div class="flex items-center gap-1.5">
                    {"Từ khóa"}
                    if (sortBy() === "word") {
                      <span class="text-indigo-500 font-bold text-[10px]">
                        if (sortOrder() === "asc") {
                          {"▲"}
                        } else {
                          {"▼"}
                        }
                      </span>
                    }
                  </div>
                </th>
                <th
                  class="px-6 py-4 cursor-pointer hover:text-indigo-500 transition-all duration-200 select-none"
                  onClick={() => toggleSort("type")}>
                  <div class="flex items-center gap-1.5">
                    {"Phân loại"}
                    if (sortBy() === "type") {
                      <span class="text-indigo-500 font-bold text-[10px]">
                        if (sortOrder() === "asc") {
                          {"▲"}
                        } else {
                          {"▼"}
                        }
                      </span>
                    }
                  </div>
                </th>
                <th
                  class="px-6 py-4 cursor-pointer hover:text-indigo-500 transition-all duration-200 select-none"
                  onClick={() => toggleSort("subType")}>
                  <div class="flex items-center gap-1.5">
                    {"Cấu trúc chi tiết"}
                    if (sortBy() === "subType") {
                      <span class="text-indigo-500 font-bold text-[10px]">
                        if (sortOrder() === "asc") {
                          {"▲"}
                        } else {
                          {"▼"}
                        }
                      </span>
                    }
                  </div>
                </th>
                <th class="px-6 py-4">{"Định nghĩa / Giải nghĩa"}</th>
                <th class="px-6 py-4">{"Liên kết CSDL"}</th>
                <th class="px-6 py-4 text-right">{"Thao tác"}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-white/10">
              if (loading()) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center space-y-3">
                      <Icon path={arrowPath} class="w-8 h-8 text-indigo-500 animate-spin" />
                      <p class="text-sm text-gray-500">{"Đang tải dữ liệu từ vựng..."}</p>
                    </div>
                  </td>
                </tr>
              } else if (filteredList().length === 0) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center text-gray-500 italic text-sm">
                    {"Chưa có dữ liệu từ vựng nào khớp với tìm kiếm."}
                  </td>
                </tr>
              } else {
                for (const item of filteredList()) {
                  <tr class={`transition-all ${theme() === "dark" ? "hover:bg-white/5" : "hover:bg-gray-50/50"}`}>
                    <td class="px-6 py-4 font-bold text-base text-indigo-600 dark:text-indigo-400">{item.word}</td>
                    <td class="px-6 py-4">
                      if (item.type === "compound") {
                        <span
                          class="px-3 py-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                          {"Từ ghép"}
                        </span>
                      }
                      if (item.type === "reduplicative") {
                        <span
                          class="px-3 py-1 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                          {"Từ láy"}
                        </span>
                      }
                      if (item.type === "antonym") {
                        <span
                          class="px-3 py-1 text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                          {"Từ đối (Trái nghĩa)"}
                        </span>
                      }
                      if (item.type === "synonym") {
                        <span
                          class="px-3 py-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                          {"Từ đồng nghĩa"}
                        </span>
                      }
                      if (item.type !== "compound" && item.type !== "reduplicative" && item.type !== "antonym" && item.type !== "synonym") {
                        <span
                          class="px-3 py-1 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">
                          {item.type}
                        </span>
                      }
                    </td>
                    <td class={`px-6 py-4 text-xs font-semibold ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {item.subType ?? "N/A"}
                    </td>
                    <td class="px-6 py-4 max-w-[300px]">
                      <p class={`text-sm line-clamp-2 ${theme() === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                        {item.definition ?? ""}
                      </p>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex flex-wrap gap-1">
                        for (const rel of item.relations || []) {
                          <span
                            class={`px-2 py-0.5 text-[10px] rounded-lg border font-medium ${
                              theme() === "dark" ? "bg-gray-800 border-white/5 text-gray-400" : "bg-gray-50 border-gray-100 text-gray-500"
                            }`}>
                            {rel}
                          </span>
                        }
                      </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          class={`p-2 rounded-xl border transition-all ${
                            theme() === "dark"
                              ? "bg-gray-900 border-white/10 hover:bg-gray-800 text-gray-400 hover:text-white"
                              : "bg-white border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-indigo-600"
                          }`}>
                          <Icon path={pencil} class="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          class={`p-2 rounded-xl border transition-all ${
                            theme() === "dark"
                              ? "bg-gray-900 border-white/10 hover:bg-red-950/20 text-gray-400 hover:text-red-400"
                              : "bg-white border-gray-200 hover:bg-red-50 text-gray-600 hover:text-red-600"
                          }`}>
                          <Icon path={trash} class="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  if (showModal()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
      <div
        class={`relative w-full max-w-lg p-6 rounded-3xl border shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-300 ${
          theme() === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
        }`}>
        <div class="flex justify-between items-center border-b border-gray-100 dark:border-white/10 pb-4">
          <h3 class="text-xl font-bold">
            {editingId() ? "Chỉnh sửa thực thể ngôn ngữ" : "Thêm thực thể ngôn ngữ mới"}
          </h3>
          <button onClick={() => setShowModal(false)} class="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all">
            <Icon path={xMark} class="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">{"Từ khóa / Cụm từ"}</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: nhanh - chậm, lung linh, học sinh..."
              value={formWord()}
              onInput={(e) => setFormWord(e.currentTarget.value)}
              class={`w-full px-4 py-3 rounded-2xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 ${
                theme() === "dark"
                  ? "bg-gray-800 border-white/10 focus:border-indigo-500 text-white"
                  : "bg-gray-50 border-gray-200 focus:border-indigo-500"
              }`}
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">{"Phân loại chính"}</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: compound, reduplicative, antonym, synonym..."
                value={formType()}
                onInput={(e) => setFormType(e.currentTarget.value)}
                class={`w-full px-4 py-3 rounded-2xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 ${
                  theme() === "dark"
                    ? "bg-gray-800 border-white/10 focus:border-indigo-500 text-white"
                    : "bg-gray-50 border-gray-200 focus:border-indigo-500"
                }`}
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">{"Cấu trúc chi tiết"}</label>
              <input
                type="text"
                placeholder="Ví dụ: láy âm đầu, đẳng lập..."
                value={formSubType()}
                onInput={(e) => setFormSubType(e.currentTarget.value)}
                class={`w-full px-4 py-3 rounded-2xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 ${
                  theme() === "dark"
                    ? "bg-gray-800 border-white/10 focus:border-indigo-500 text-white"
                    : "bg-gray-50 border-gray-200 focus:border-indigo-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">{"Giải nghĩa / Định nghĩa"}</label>
            <textarea
              rows="3"
              placeholder="Giải thích ngữ nghĩa hoặc sắc thái biểu cảm của từ..."
              value={formDefinition()}
              onInput={(e) => setFormDefinition(e.currentTarget.value)}
              class={`w-full px-4 py-3 rounded-2xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 ${
                theme() === "dark"
                  ? "bg-gray-800 border-white/10 focus:border-indigo-500 text-white"
                  : "bg-gray-50 border-gray-200 focus:border-indigo-500"
              }`}
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">
              {"Từ liên đới / Các từ trong cụm (cách nhau bằng dấu phẩy)"}
            </label>
            <input
              type="text"
              placeholder="Ví dụ: nhanh, chậm, tốc độ"
              value={formRelationsText()}
              onInput={(e) => setFormRelationsText(e.currentTarget.value)}
              class={`w-full px-4 py-3 rounded-2xl border outline-none text-sm focus:ring-2 focus:ring-indigo-500/20 ${
                theme() === "dark"
                  ? "bg-gray-800 border-white/10 focus:border-indigo-500 text-white"
                  : "bg-gray-50 border-gray-200 focus:border-indigo-500"
              }`}
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              class={`px-5 py-3 font-bold rounded-2xl text-sm transition-all border ${
                theme() === "dark"
                  ? "bg-gray-800 border-white/10 hover:bg-gray-750 text-gray-300"
                  : "bg-gray-100 border-gray-200 hover:bg-gray-150 text-gray-600"
              }`}>
              {"Hủy"}
            </button>
            <button
              type="submit"
              class="flex items-center gap-2 px-6 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm transition-all shadow-lg shadow-indigo-600/20">
              <Icon path={check} class="w-5 h-5" />
              {"Lưu lại"}
            </button>
          </div>
        </form>
      </div>
    </div>
  }
}
