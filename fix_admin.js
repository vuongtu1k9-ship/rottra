const fs = require("fs");
let content = fs.readFileSync("src/client/views/dashboard/admin-actions.tsrx", "utf-8");

content = content.replace('import { LedgerDashboard } from "./ledger.tsrx";', 'import { LedgerDashboard } from "./ledger.tsrx";\nimport { showToast } from "~/client/stores/toast-store";');

content = content.replace(
  '  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);',
  `  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);
  
  const [confirmModal, setConfirmModal] = createSignal<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    requireInput?: boolean;
    inputPlaceholder?: string;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  const [modalInput, setModalInput] = createSignal("");
  const closeConfirm = () => setConfirmModal({ ...confirmModal(), isOpen: false });`
);

content = content.replace(
  '    if (traceProductBatchId()) {',
  `    if (confirmModal().isOpen) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div class={\`shadow-2xl rounded-3xl p-8 max-w-md w-full border text-center space-y-6 transform animate-in scale-in duration-300 \${
          theme() === "dark" ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-800"
        }\`}>
          <div class="space-y-2">
            <h3 class="text-xl font-bold">{confirmModal().title}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{confirmModal().message}</p>
          </div>
          
          {confirmModal().requireInput && (
            <input
              type="text"
              value={modalInput()}
              onInput={(e) => setModalInput((e.target as HTMLInputElement).value)}
              placeholder={confirmModal().inputPlaceholder}
              class={\`w-full px-5 py-3 border rounded-xl outline-none focus:ring-4 transition-all \${
                theme() === "dark" ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-700"
              }\`}
            />
          )}

          <div class="flex gap-3 pt-2">
            <button
              onClick={closeConfirm}
              class={\`flex-1 py-3 rounded-xl font-bold transition-all text-sm cursor-pointer \${
                theme() === "dark" ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }\`}>
              Hủy bỏ
            </button>
            <button
              onClick={() => {
                confirmModal().onConfirm();
                closeConfirm();
              }}
              class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all text-sm cursor-pointer">
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    }

    if (traceProductBatchId()) {`
);

content = content.replace(/alert\("([^"]+)"\)/g, 'showToast("info", "$1")');
content = content.replace(/alert\(`([^`]+)`\)/g, 'showToast("info", `$1`)');
// Let's manually replace the buttons for confirm since they have logic.
fs.writeFileSync("src/client/views/dashboard/admin-actions.tsrx.tmp", content);
