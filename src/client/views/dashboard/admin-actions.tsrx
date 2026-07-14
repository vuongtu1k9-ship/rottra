import { createSignal } from "solid-js";
import { Icon } from "solid-heroicons";
import { megaphone, noSymbol, trash, userGroup, checkBadge, xCircle, shieldCheck } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { LedgerDashboard } from "./ledger.tsrx";

export component AdminActions(props: any) {
  const isAdmin = () => props.role === "admin";
  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);

  if (!isAdmin()) {
    <div class="p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm font-medium">
      {"Vui lòng đăng nhập với quyền quản trị viên để thực hiện các thao tác này."}
    </div>
  } else {
    <div
      class={`p-6 border rounded-3xl shadow-sm space-y-4 ${
        theme() === "dark" ? "bg-[#1e1e1e] border-white/10" : "bg-white border-gray-100"
      }`}>
      <h3 class={`text-lg font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
        {props.isProduct ? "Thao tác quản trị viên với sản phẩm" : "Thao tác quản trị viên"}
      </h3>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Cảnh báo (Chỉ dùng cho người dùng) */}
        if (!props.isProduct) {
          <button
            class={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border group ${
              theme() === "dark"
                ? "bg-yellow-900/30 text-yellow-500 border-yellow-900/50 hover:bg-yellow-900/50"
                : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-100"
            }`}
            onClick={async () => {
              const users = props.selectedUsers || [];
              if (users.length === 0) return alert("Vui lòng chọn ít nhất một người dùng!");
              if (!confirm(`Gửi cảnh báo cho ${users.length} tài khoản đã chọn?`)) return;

              try {
                await Promise.all(
                  users.map(
                    (u) => fetch(`/api/admin/users/${u.email}/action`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "warn" }),
                    }),
                  ),
                );
                alert(`Đã gửi cảnh báo cho ${users.length} người dùng!`);
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi thực hiện thao tác hàng loạt.");
              }
            }}>
            <Icon path={megaphone} class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="text-xs font-bold">{"Cảnh báo"}</span>
          </button>
        }

        {/* Chặn / Ẩn sản phẩm */}
        <button
          class={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border group ${
            theme() === "dark"
              ? "bg-orange-900/30 text-orange-500 border-orange-900/50 hover:bg-orange-900/50"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100"
          }`}
          onClick={async () => {
            if (props.isProduct) {
              const items = props.selectedProducts || [];
              if (items.length === 0) return alert("Vui lòng chọn ít nhất một sản phẩm!");
              if (!confirm(`Xác nhận chuyển trạng thái HẾT HÀNG hàng loạt cho ${items.length} sản phẩm đã chọn?`)) return;

              try {
                await Promise.all(
                  items.map(
                    (p) => fetch("/api/admin/product", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: p.id || p._id, status: false }),
                    }),
                  ),
                );
                alert(`Đã chuyển trạng thái Hết hàng cho ${items.length} sản phẩm!`);
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi ẩn sản phẩm hàng loạt.");
              }
            } else {
              const users = props.selectedUsers || [];
              if (users.length === 0) return alert("Vui lòng chọn ít nhất một mục!");
              if (!confirm(`Xác nhận chặn ${users.length} tài khoản đã chọn?`)) return;

              try {
                await Promise.all(
                  users.map(
                    (u) => fetch(`/api/admin/users/${u.email}/action`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "ban" }),
                    }),
                  ),
                );
                alert(`Đã chặn thành công ${users.length} người dùng!`);
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi thực hiện thao tác hàng loạt.");
              }
            }
          }}>
          <Icon path={noSymbol} class="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span class="text-xs font-bold">{props.isProduct ? "Ẩn sản phẩm" : "Chặn (Ban)"}</span>
        </button>

        {/* Xóa */}
        <button
          class={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border group ${
            theme() === "dark"
              ? "bg-red-900/30 text-red-500 border-red-900/50 hover:bg-red-900/50"
              : "bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
          }`}
          onClick={async () => {
            if (props.isProduct) {
              const items = props.selectedProducts || [];
              if (items.length === 0) return alert("Vui lòng chọn ít nhất một sản phẩm!");
              if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${items.length} sản phẩm đã chọn?`)) return;

              try {
                const responses = await Promise.all(
                  items.map((p) => fetch(`/api/admin/product/delete/${p.id || p._id}`, { method: "POST" })),
                );
                const errors: string[] = [];
                for (const res of responses) {
                  if (!res.ok) {
                    try {
                      const data = await res.json();
                      if (data.error) errors.push(data.error);
                    } catch (e) {
                      errors.push(`Mã lỗi ${res.status}`);
                    }
                  }
                }
                if (errors.length > 0) {
                  alert(`Không thể xóa sản phẩm: ${errors.join(", ")}`);
                } else {
                  alert(`Đã xóa thành công ${items.length} sản phẩm!`);
                }
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi xóa sản phẩm hàng loạt.");
              }
            } else {
              const users = props.selectedUsers || [];
              if (users.length === 0) return alert("Vui lòng chọn ít nhất một mục!");

              const hasAdmin = users.some((u) => u.email === "admin@test.com");
              if (hasAdmin) return alert("Danh sách chọn có chứa Admin hệ thống, không thể xóa!");

              if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${users.length} mục này?`)) return;

              try {
                const responses = await Promise.all(users.map((u) => fetch(`/api/admin/users/${u.email}`, { method: "DELETE" })));
                const errors: string[] = [];
                for (const res of responses) {
                  if (!res.ok) {
                    try {
                      const data = await res.json();
                      if (data.error) errors.push(data.error);
                    } catch (e) {
                      errors.push(`Mã lỗi ${res.status}`);
                    }
                  }
                }
                if (errors.length > 0) {
                  alert(`Không thể xóa tài khoản: ${errors.join(", ")}`);
                } else {
                  alert(`Đã xóa thành công ${users.length} mục!`);
                }
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi thực hiện xóa hàng loạt.");
              }
            }
          }}>
          <Icon path={trash} class="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span class="text-xs font-bold">{"Xóa"}</span>
        </button>

        if (props.isProduct) {
          <button
            class={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border group ${
              theme() === "dark"
                ? "bg-teal-900/30 text-teal-400 border-teal-900/50 hover:bg-teal-900/50"
                : "bg-teal-50 text-teal-600 hover:bg-teal-100 border-teal-100"
            }`}
            onClick={async () => {
              const items = props.selectedProducts || [];
              if (items.length === 0) return alert("Vui lòng chọn một sản phẩm!");
              if (items.length > 1) return alert("Chỉ được chọn 1 sản phẩm để truy xuất chuỗi khối!");

              const p = items[0];
              setTraceProductBatchId(p.id || p._id || "BATCH_MOCK_001");
            }}>
            <Icon path={shieldCheck} class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="text-xs font-bold">{"Truy xuất"}</span>
          </button>
        }

        {/* Thêm nhóm (Chỉ dùng cho người dùng) */}
        if (!props.isProduct) {
          <button
            class={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border group ${
              theme() === "dark"
                ? "bg-blue-900/30 text-blue-400 border-blue-900/50 hover:bg-blue-900/50"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100"
            }`}
            onClick={async () => {
              const users = props.selectedUsers || [];
              if (users.length === 0) return alert("Vui lòng chọn ít nhất một mục!");

              const groupName = prompt("Nhập tên nhóm muốn thêm cho các tài khoản đã chọn:");
              if (!groupName || groupName.trim() === "") return;

              try {
                await Promise.all(
                  users.map(
                    (u) => fetch(`/api/admin/users/${u.email}/action`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "add_group", groupName: groupName.trim() }),
                    }),
                  ),
                );
                alert(`Đã thêm nhóm "${groupName.trim()}" thành công cho ${users.length} mục!`);
                if (props.onActionComplete) props.onActionComplete();
              } catch (err) {
                alert("Lỗi khi thêm nhóm hàng loạt.");
              }
            }}>
            <Icon path={userGroup} class="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span class="text-xs font-bold">{"Thêm nhóm"}</span>
          </button>
        }
      </div>
    </div>

    if (traceProductBatchId()) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          class="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-5xl w-full h-[85vh] shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col relative overflow-hidden transform animate-in scale-in duration-300">
          <button
            onClick={() => setTraceProductBatchId(null)}
            class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-[210]">
            <Icon path={xCircle} class="w-6 h-6" />
          </button>

          <div class="flex-1 overflow-y-auto">
            <LedgerDashboard initialBatchId={traceProductBatchId()!} />
          </div>
        </div>
      </div>
    }
  }
}
