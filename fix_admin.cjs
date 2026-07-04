const fs = require("fs");
let content = fs.readFileSync("src/client/views/dashboard/admin-actions.tsrx", "utf-8");

content = content.replace('import { LedgerDashboard } from "./ledger.tsrx";', 'import { LedgerDashboard } from "./ledger.tsrx";\nimport { showToast } from "~/client/stores/toast-store";');

content = content.replace(
  '  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);',
  `  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);
  
  const [confirmModal, setConfirmModal] = createSignal({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    requireInput: false,
    inputPlaceholder: ""
  });
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
              onInput={(e) => setModalInput(e.target.value)}
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

// Replace confirm/prompt and alert calls for the first action (warn users)
content = content.replace(
  /if \(!confirm\(`Gửi cảnh báo cho \$\{users\.length\} tài khoản đã chọn\?`\)\) return;/g,
  `setConfirmModal({
                isOpen: true,
                title: "Gửi cảnh báo",
                message: \`Bạn có chắc chắn muốn gửi cảnh báo cho \${users.length} tài khoản đã chọn?\`,
                onConfirm: async () => {
                  try {
                    await Promise.all(
                      users.map((u) => fetch(\`/api/admin/users/\${u.email}/action\`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "warn" }),
                      })),
                    );
                    showToast("success", \`Đã gửi cảnh báo cho \${users.length} người dùng!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi thực hiện thao tác hàng loạt.");
                  }
                }
              });
              return;`
);

// Remove the old try-catch block for warn since we moved it inside onConfirm
content = content.replace(/try\s*\{\s*await Promise\.all\(\s*users\.map\(\s*\(u\) => fetch\(`\/api\/admin\/users\/\$\{u\.email\}\/action`, \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ action: "warn" \}\),\s*\}\),\s*\),\s*\);\s*alert\(`Đã gửi cảnh báo cho \$\{users\.length\} người dùng!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi thực hiện thao tác hàng loạt\."\);\s*\}/g, "");


// Next action: block product
content = content.replace(
  /if \(!confirm\(`Xác nhận chuyển trạng thái HẾT HÀNG hàng loạt cho \$\{items\.length\} sản phẩm đã chọn\?`\)\) return;/g,
  `setConfirmModal({
                isOpen: true,
                title: "Ẩn sản phẩm",
                message: \`Xác nhận chuyển trạng thái HẾT HÀNG hàng loạt cho \${items.length} sản phẩm đã chọn?\`,
                onConfirm: async () => {
                  try {
                    await Promise.all(
                      items.map((p) => fetch("/api/admin/product", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: p.id || p._id, status: false }),
                      })),
                    );
                    showToast("success", \`Đã chuyển trạng thái Hết hàng cho \${items.length} sản phẩm!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi ẩn sản phẩm hàng loạt.");
                  }
                }
              });
              return;`
);
content = content.replace(/try\s*\{\s*await Promise\.all\(\s*items\.map\(\s*\(p\) => fetch\("\/api\/admin\/product", \{\s*method: "PUT",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ id: p\.id || p\._id, status: false \}\),\s*\}\),\s*\),\s*\);\s*alert\(`Đã chuyển trạng thái Hết hàng cho \$\{items\.length\} sản phẩm!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi ẩn sản phẩm hàng loạt\."\);\s*\}/g, "");

// Action block users
content = content.replace(
  /if \(!confirm\(`Xác nhận chặn \$\{users\.length\} tài khoản đã chọn\?`\)\) return;/g,
  `setConfirmModal({
                isOpen: true,
                title: "Chặn tài khoản",
                message: \`Xác nhận chặn \${users.length} tài khoản đã chọn?\`,
                onConfirm: async () => {
                  try {
                    await Promise.all(
                      users.map((u) => fetch(\`/api/admin/users/\${u.email}/action\`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "ban" }),
                      })),
                    );
                    showToast("success", \`Đã chặn thành công \${users.length} người dùng!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi thực hiện thao tác hàng loạt.");
                  }
                }
              });
              return;`
);
content = content.replace(/try\s*\{\s*await Promise\.all\(\s*users\.map\(\s*\(u\) => fetch\(`\/api\/admin\/users\/\$\{u\.email\}\/action`, \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ action: "ban" \}\),\s*\}\),\s*\),\s*\);\s*alert\(`Đã chặn thành công \$\{users\.length\} người dùng!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi thực hiện thao tác hàng loạt\."\);\s*\}/g, "");

// Action delete products
content = content.replace(
  /if \(!confirm\(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN \$\{items\.length\} sản phẩm đã chọn\?`\)\) return;/g,
  `setConfirmModal({
                isOpen: true,
                title: "Xóa sản phẩm",
                message: \`Bạn có chắc chắn muốn XÓA VĨNH VIỄN \${items.length} sản phẩm đã chọn?\`,
                onConfirm: async () => {
                  try {
                    await Promise.all(items.map((p) => fetch(\`/api/admin/product/\${p.id || p._id}\`, { method: "DELETE" })));
                    showToast("success", \`Đã xóa thành công \${items.length} sản phẩm!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi xóa sản phẩm hàng loạt.");
                  }
                }
              });
              return;`
);
content = content.replace(/try\s*\{\s*await Promise\.all\(items\.map\(\(p\) => fetch\(`\/api\/admin\/product\/\$\{p\.id \|\| p\._id\}`, \{ method: "DELETE" \}\)\)\);\s*alert\(`Đã xóa thành công \$\{items\.length\} sản phẩm!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi xóa sản phẩm hàng loạt\."\);\s*\}/g, "");

// Action delete users
content = content.replace(
  /if \(!confirm\(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN \$\{users\.length\} mục này\?`\)\) return;/g,
  `setConfirmModal({
                isOpen: true,
                title: "Xóa tài khoản",
                message: \`Bạn có chắc chắn muốn XÓA VĨNH VIỄN \${users.length} mục này?\`,
                onConfirm: async () => {
                  try {
                    await Promise.all(users.map((u) => fetch(\`/api/admin/users/\${u.email}\`, { method: "DELETE" })));
                    showToast("success", \`Đã xóa thành công \${users.length} mục!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi thực hiện xóa hàng loạt.");
                  }
                }
              });
              return;`
);
content = content.replace(/try\s*\{\s*await Promise\.all\(users\.map\(\(u\) => fetch\(`\/api\/admin\/users\/\$\{u\.email\}`, \{ method: "DELETE" \}\)\)\);\s*alert\(`Đã xóa thành công \$\{users\.length\} mục!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi thực hiện xóa hàng loạt\."\);\s*\}/g, "");

// Action add group (uses prompt)
content = content.replace(
  /const groupName = prompt\("Nhập tên nhóm muốn thêm cho các tài khoản đã chọn:"\);\s*if \(!groupName \|\| groupName\.trim\(\) === ""\) return;\s*try\s*\{\s*await Promise\.all\(\s*users\.map\(\s*\(u\) => fetch\(`\/api\/admin\/users\/\$\{u\.email\}\/action`, \{\s*method: "POST",\s*headers: \{ "Content-Type": "application\/json" \},\s*body: JSON\.stringify\(\{ action: "add_group", groupName: groupName\.trim\(\) \}\),\s*\}\),\s*\),\s*\);\s*alert\(`Đã thêm nhóm "\$\{groupName\.trim\(\)\}" thành công cho \$\{users\.length\} mục!`\);\s*if \(props\.onActionComplete\) props\.onActionComplete\(\);\s*\}\s*catch\s*\(err\)\s*\{\s*alert\("Lỗi khi thêm nhóm hàng loạt\."\);\s*\}/g,
  `setModalInput("");
              setConfirmModal({
                isOpen: true,
                title: "Thêm nhóm",
                message: "Nhập tên nhóm muốn thêm cho các tài khoản đã chọn:",
                requireInput: true,
                inputPlaceholder: "Tên nhóm...",
                onConfirm: async () => {
                  const groupName = modalInput();
                  if (!groupName || groupName.trim() === "") {
                    showToast("warning", "Tên nhóm không được để trống!");
                    return;
                  }
                  try {
                    await Promise.all(
                      users.map((u) => fetch(\`/api/admin/users/\${u.email}/action\`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "add_group", groupName: groupName.trim() }),
                      })),
                    );
                    showToast("success", \`Đã thêm nhóm "\${groupName.trim()}" thành công cho \${users.length} mục!\`);
                    if (props.onActionComplete) props.onActionComplete();
                  } catch (err) {
                    showToast("error", "Lỗi khi thêm nhóm hàng loạt.");
                  }
                }
              });`
);

// Replace remaining alert with showToast
content = content.replace(/alert\("([^"]+)"\)/g, 'showToast("warning", "$1")');
content = content.replace(/alert\(`([^`]+)`\)/g, 'showToast("warning", `$1`)');

fs.writeFileSync("src/client/views/dashboard/admin-actions.tsrx", content);
