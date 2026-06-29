import { createSignal, onMount } from "solid-js";
import { Icon } from "solid-heroicons";
import { magnifyingGlass, arrowPath, documentDuplicate } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";

export component ManageBilingual() {
  const [corpus, setCorpus] = createSignal<any[]>([]);
  const [search, setSearch] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [totalCount, setTotalCount] = createSignal(2000);
  const [page, setPage] = createSignal(1);
  const [sourceInfo, setSourceInfo] = createSignal("seeded_db");

  const fetchCorpus = async (searchTerm = "", pageNum = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rpc/bilingual-corpus/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: searchTerm, page: pageNum, limit: 30 }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setCorpus(data.corpus);
        setTotalCount(data.total);
        setSourceInfo(data.source);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchCorpus("", 1);
  });

  const handleSearchInput = (e: any) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);
    fetchCorpus(value, 1);
  };

  const handlePrevPage = () => {
    if (page() > 1) {
      const nextP = page() - 1;
      setPage(nextP);
      fetchCorpus(search(), nextP);
    }
  };

  const handleNextPage = () => {
    const nextP = page() + 1;
    setPage(nextP);
    fetchCorpus(search(), nextP);
  };

  <div class={`p-6 space-y-6 animate-in fade-in duration-500 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
    {/* Header */}
    <header
      class={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-3xl shadow-sm border ${
        theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
      }`}>
      <div class="flex items-center gap-4">
        <div class="p-3 bg-teal-500/10 text-teal-500 rounded-2xl">
          <Icon path={documentDuplicate} class="w-8 h-8" />
        </div>
        <div>
          <h2 class="text-2xl font-bold">{"Kho dữ liệu Đa ngữ (6 Ngôn ngữ)"}</h2>
          <p class={`text-sm ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            {"Đối khớp đa ngữ thực tế từ kho lưu trữ song ngữ và đa ngữ (VI, EN, ZH, JA, FI, HE) trên hệ thống."}
          </p>
        </div>
      </div>
      <div
        class={`px-4 py-2 text-xs font-semibold rounded-xl ${
          theme() === "dark" ? "bg-white/5 text-teal-400" : "bg-teal-50 text-teal-700"
        }`}>
        {sourceInfo() === "all_254k_parallel_corpus" ? "🔍 Đang Quét Trực Tiếp File 254K Câu" : "💾 CSDL Seeded (2,000 Câu)"}
      </div>
    </header>

    {/* Search Bar */}
    <div
      class={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between ${
        theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"
      }`}>
      <div class="relative w-full">
        <span class="absolute inset-y-0 left-4 flex items-center text-gray-400">
          <Icon path={magnifyingGlass} class="w-5 h-5" />
        </span>
        <input
          type="text"
          placeholder="Nhập từ khóa hoặc câu tiếng Anh / tiếng Việt để quét..."
          value={search()}
          onInput={handleSearchInput}
          class={`w-full pl-12 pr-4 py-3 rounded-2xl border outline-none font-medium transition-all ${
            theme() === "dark" ? "bg-white/5 border-white/10 focus:border-indigo-500" : "bg-gray-50 border-gray-200 focus:border-indigo-600"
          }`}
        />
      </div>
      <button
        onClick={() => fetchCorpus(search(), page())}
        class={`flex items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 ${
          theme() === "dark"
            ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
        }`}>
        <Icon path={arrowPath} class="w-5 h-5" />
      </button>
    </div>

    {/* Corpus Grid */}
    <div class="grid grid-cols-1 gap-4">
      if (loading()) {
        <div class="flex flex-col items-center justify-center py-20 space-y-4">
          <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
          <p class="text-sm font-semibold text-gray-400">{"Đang đối chiếu dữ liệu..."}</p>
        </div>
      } else if (corpus().length === 0) {
        <div
          class={`p-12 text-center rounded-3xl border ${theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"}`}>
          <p class="text-gray-400">{"Không tìm thấy cặp câu song ngữ nào khớp với từ khóa."}</p>
        </div>
      } else {
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            for (const item of corpus()) {
              <div
                class={`p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  theme() === "dark"
                    ? "bg-[#0f0f0f] border-white/5 hover:border-white/10"
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}>
                <div class="space-y-3">
                  <div class="flex items-start gap-2">
                    <span class="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-500 rounded font-bold uppercase mt-1">{"VI"}</span>
                    <p class="font-semibold text-base leading-relaxed text-teal-400">{item.vi}</p>
                  </div>
                  if (item.en) {
                    <div class="flex items-start gap-2 pt-2 border-t border-dashed border-gray-500/10">
                      <span class="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded font-bold uppercase mt-0.5">{"EN"}</span>
                      <p class={`text-sm leading-relaxed ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>{item.en}</p>
                    </div>
                  }
                  if (item.zh) {
                    <div class="flex items-start gap-2 pt-2 border-t border-dashed border-gray-500/10">
                      <span class="text-[10px] px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded font-bold uppercase mt-0.5">
                        {"ZH"}
                      </span>
                      <p class={`text-sm leading-relaxed ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>{item.zh}</p>
                    </div>
                  }
                  if (item.ja) {
                    <div class="flex items-start gap-2 pt-2 border-t border-dashed border-gray-500/10">
                      <span class="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded font-bold uppercase mt-0.5">
                        {"JA"}
                      </span>
                      <p class={`text-sm leading-relaxed ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>{item.ja}</p>
                    </div>
                  }
                  if (item.fi) {
                    <div class="flex items-start gap-2 pt-2 border-t border-dashed border-gray-500/10">
                      <span class="text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-500 rounded font-bold uppercase mt-0.5">{"FI"}</span>
                      <p class={`text-sm leading-relaxed ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>{item.fi}</p>
                    </div>
                  }
                  if (item.he) {
                    <div class="flex items-start gap-2 pt-2 border-t border-dashed border-gray-500/10">
                      <span class="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded font-bold uppercase mt-0.5">{"HE"}</span>
                      <p class={`text-sm leading-relaxed dir-rtl text-right ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                        {item.he}
                      </p>
                    </div>
                  }
                </div>
                <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-500/5 text-xs text-gray-400">
                  <span>{`ID: ${item.id}`}</span>
                  <span class="text-teal-400 font-medium">{"Đối khớp đa ngữ"}</span>
                </div>
              </div>
            }
          </div>

          {/* Pagination */}
          <div class="flex items-center justify-between pt-4">
            <span class="text-sm font-semibold text-gray-400">{`Hiển thị kết quả trang ${page()}`}</span>
            <div class="flex items-center gap-2">
              <button
                disabled={page() === 1}
                onClick={handlePrevPage}
                class={`px-4 py-2 font-bold rounded-xl transition-all disabled:opacity-50 ${
                  theme() === "dark" ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}>
                {"Trang trước"}
              </button>
              <button
                disabled={corpus().length < 30}
                onClick={handleNextPage}
                class={`px-4 py-2 font-bold rounded-xl transition-all disabled:opacity-50 ${
                  theme() === "dark" ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}>
                {"Trang sau"}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  </div>
}
