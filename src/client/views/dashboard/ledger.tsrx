import { createSignal, createResource, For, Show } from "solid-js";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import { shieldCheck, cubeTransparent, clock, serverStack, user as userIcon, plus, magnifyingGlass } from "solid-heroicons/outline";

export component LedgerDashboard(props: { initialBatchId?: string }) {
  const defaultBatch = () => props.initialBatchId || "BATCH_MOCK_001";
  const [batchId, setBatchId] = createSignal(defaultBatch());
  const [searchQuery, setSearchQuery] = createSignal(defaultBatch());
  const [newAction, setNewAction] = createSignal("QA_CHECK");
  const [newPayload, setNewPayload] = createSignal("{\"temperature\": 24, \"humidity\": 65}");

  const fetchLedger = async (id) => {
    if (!id) return null;
    const res = await fetch(`/api/ledger/trace/${id}`);
    if (!res.ok) return null;
    return await res.json();
  };

  const [ledgerData, { mutate, refetch }] = createResource(searchQuery, fetchLedger);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(batchId());
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    try {
      const parsedPayload = JSON.parse(newPayload());
      const res = await fetch("/api/ledger/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: searchQuery(),
          action: newAction(),
          dataPayload: parsedPayload,
          recordedBy: "Giáo sư AI_Admin",
        }),
      });
      if (res.ok) {
        refetch();
        setNewPayload("{\"status\": \"OK\"}");
      } else {
        alert("Lỗi khi ghi chuỗi khối!");
      }
    } catch (err) {
      alert("Payload phải là JSON hợp lệ!");
    }
  };

  <tsx>
    <div class={`h-full flex flex-col p-6 space-y-6 ${theme() === "dark" ? "text-gray-100" : "text-gray-800"}`}>
      {}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            class="text-3xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-600 flex items-center gap-3">
            <Icon path={cubeTransparent} class="w-8 h-8 text-teal-500" />
            Sổ Cái Truy Xuất Bất Biến (Ledger)
          </h1>
          <p
            class={`mt-2 ${
              theme() === "dark" ? "text-gray-400" : "text-gray-600"
            }`}>Hệ thống quản lý chuỗi cung ứng bằng mã băm SHA-256 nội bộ chống phân mảnh.</p>
        </div>
      </div>
      {}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div
          class={`col-span-1 lg:col-span-2 p-6 rounded-2xl border backdrop-blur-xl ${
            theme() === "dark" ? "bg-gray-900/60 border-gray-800" : "bg-white/80 border-gray-200"
          }`}>
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon path={magnifyingGlass} class="w-6 h-6 text-blue-500" />
            Tra Cứu Lô Hàng
          </h2>
          <form onSubmit={handleSearch} class="flex gap-4">
            <input
              type="text"
              value={batchId()}
              onInput={(e) => setBatchId(e.target.value)}
              placeholder="Nhập mã Lô hàng (VD: BATCH_MOCK_001)..."
              class={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-teal-500 transition-all ${
                theme() === "dark" ? "bg-gray-800 border-gray-700 focus:border-teal-500" : "bg-white border-gray-300 focus:border-teal-400"
              }`}
            />
            <button
              type="submit"
              class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-teal-500/30 transition-all active:scale-95">Truy Xuất</button>
          </form>
          {}
          <Show when={ledgerData() && ledgerData().isChainValid !== undefined}>
            <div
              class={`mt-6 p-4 rounded-xl border flex items-center gap-4 ${
                ledgerData().isChainValid
                  ? (theme() === "dark" ? "bg-emerald-900/30 border-emerald-800/50" : "bg-emerald-50 border-emerald-200")
                  : "bg-red-900/30 border-red-800/50"
              }`}>
              <Icon path={shieldCheck} class={`w-10 h-10 ${ledgerData().isChainValid ? "text-emerald-500" : "text-red-500"}`} />
              <div>
                <h3 class={`font-bold text-lg ${ledgerData().isChainValid ? "text-emerald-500" : "text-red-500"}`}>
                  {ledgerData().isChainValid ? "CHUỖI KHỐI TOÀN VẸN (100% VALID)" : "CẢNH BÁO: CHUỖI KHỐI BỊ CAN THIỆP"}
                </h3>
                <p class={`text-sm ${theme() === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  {ledgerData().isChainValid
                    ? `Mã băm của ${ledgerData().totalBlocks} khối đã được kiểm chứng bằng SHA-256.`
                    : `Phát hiện sai lệch mã băm tại Block ID: ${ledgerData().corruptedBlockId}`}
                </p>
              </div>
            </div>
          </Show>
        </div>
        {}
        <div
          class={`col-span-1 p-6 rounded-2xl border backdrop-blur-xl ${
            theme() === "dark" ? "bg-gray-900/60 border-gray-800" : "bg-white/80 border-gray-200"
          }`}>
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon path={plus} class="w-6 h-6 text-purple-500" />
            Thêm Khối Mới
          </h2>
          <form onSubmit={handleAddBlock} class="flex flex-col gap-4">
            <div>
              <label
                class={`block text-sm font-medium mb-1 ${
                  theme() === "dark" ? "text-gray-400" : "text-gray-600"
                }`}>Hành động (Action)</label>
              <select
                value={newAction()}
                onInput={(e) => setNewAction(e.target.value)}
                class={`w-full px-4 py-2 rounded-xl border focus:ring-2 transition-all ${
                  theme() === "dark"
                    ? "bg-gray-800 border-gray-700 focus:border-purple-500"
                    : "bg-white border-gray-300 focus:border-purple-400"
                }`}>
                <option value="HARVEST">HARVEST (Thu hoạch)</option>
                <option value="WAREHOUSE">WAREHOUSE (Nhập kho)</option>
                <option value="QA_CHECK">QA_CHECK (Kiểm định)</option>
                <option value="EXPORT">EXPORT (Xuất khẩu)</option>
              </select>
            </div>
            <div>
              <label
                class={`block text-sm font-medium mb-1 ${
                  theme() === "dark" ? "text-gray-400" : "text-gray-600"
                }`}>Dữ liệu (JSON Payload)</label>
              <textarea
                value={newPayload()}
                onInput={(e) => setNewPayload(e.target.value)}
                rows="3"
                class={`w-full px-4 py-2 font-mono text-sm rounded-xl border focus:ring-2 transition-all ${
                  theme() === "dark"
                    ? "bg-gray-800 border-gray-700 focus:border-purple-500"
                    : "bg-white border-gray-300 focus:border-purple-400"
                }`}></textarea>
            </div>
            <button
              type="submit"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/30 transition-all active:scale-95">Khắc Ghi Vào Sổ Cái</button>
          </form>
        </div>
      </div>
      {}
      <div class="flex-1 overflow-auto mt-6">
        <Show when={ledgerData.loading}>
          <div class="flex justify-center py-12">
            <div class="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full"></div>
          </div>
        </Show>
        <Show when={!ledgerData.loading && ledgerData() && ledgerData().chain}>
          <div class="flex flex-col gap-6 relative">
            {}
            <div class={`absolute left-8 top-0 bottom-0 w-1 ${theme() === "dark" ? "bg-gray-800" : "bg-gray-200"}`}></div>
            <For each={ledgerData().chain}>
              {(block, i) => <div class="relative pl-24 pr-4">
                {}
                <div
                  class={`absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 z-10 ${
                    theme() === "dark" ? "bg-gray-900 border-teal-500" : "bg-white border-teal-400"
                  }`}></div>
                {}
                <div
                  class={`p-5 rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 ${
                    theme() === "dark" ? "bg-gray-900/80 border-gray-700" : "bg-white border-gray-200 shadow-sm"
                  }`}>
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div class="flex items-center gap-3">
                      <span
                        class={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          block.action === "HARVEST"
                            ? "bg-green-500/20 text-green-500"
                            : block.action === "WAREHOUSE"
                              ? "bg-blue-500/20 text-blue-500"
                              : block.action === "QA_CHECK"
                                ? "bg-purple-500/20 text-purple-500"
                                : "bg-orange-500/20 text-orange-500"
                        }`}>
                        {block.action}
                      </span>
                      <span class={`text-sm flex items-center gap-1 ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                        <Icon path={clock} class="w-4 h-4" />
                        {new Date(block.timestamp).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div class={`text-xs flex items-center gap-1 ${theme() === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                      <Icon path={userIcon} class="w-4 h-4" />
                      {block.recordedBy}
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {}
                    <div
                      class={`p-3 rounded-xl text-xs font-mono break-all ${
                        theme() === "dark" ? "bg-gray-950 text-gray-400" : "bg-gray-50 text-gray-600"
                      }`}>
                      <div class="mb-2">
                        <span class="text-teal-500 font-bold">Cur Hash:</span>
                        {block.currentHash}
                      </div>
                      <div>
                        <span class="text-rose-400 font-bold">Prv Hash:</span>
                        {block.previousHash}
                      </div>
                    </div>
                    {}
                    <div
                      class={`p-3 rounded-xl text-xs font-mono overflow-auto ${
                        theme() === "dark" ? "bg-gray-950 text-emerald-400" : "bg-gray-800 text-emerald-300"
                      }`}>
                      {JSON.stringify(block.dataPayload, null, 2)}
                    </div>
                  </div>
                </div>
              </div>}
            </For>
          </div>
        </Show>
        <Show when={!ledgerData.loading && (!ledgerData() || !ledgerData().chain)}>
          <div class={`text-center py-20 ${theme() === "dark" ? "text-gray-500" : "text-gray-400"}`}>
            <Icon path={serverStack} class="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Không tìm thấy dữ liệu chuỗi khối cho Lô hàng này.</p>
          </div>
        </Show>
      </div>
    </div>
  </tsx>
}
