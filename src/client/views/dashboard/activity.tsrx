import { createSignal, createResource } from "solid-js";
import { Icon } from "solid-heroicons";
import { userPlus, shieldExclamation, cube, shoppingCart, creditCard } from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";

const fetchActivities = async (level: string) => {
  const res = await fetch(`/api/admin/activity?level=${level}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.activities || [];
};

export component Activity(props: any) {
  const isAdmin = () => props?.role === "admin";
  const [level, setLevel] = createSignal("all");
  const [activities, { refetch }] = createResource(level, fetchActivities);

  const getIcon = (lvl: string) => {
    if (lvl.includes("7 - Tồn vong") || lvl.includes("6 - Thảm họa cực đại") || lvl.includes("5 - Thảm họa") || lvl.includes("security")) {
      return shieldExclamation;
    }
    if (lvl.includes("4 - Khủng hoảng")) {
      return shieldExclamation;
    }
    if (lvl.includes("3 - Nghiêm trọng")) {
      return shieldExclamation;
    }
    if (lvl.includes("2 - Vấn đề") || lvl.includes("product")) {
      return cube;
    }
    if (lvl.includes("order")) {
      return shoppingCart;
    }
    if (lvl.includes("payment")) {
      return creditCard;
    }
    return cube;
  };

  const getColorClass = (lvl: string) => {
    if (lvl.includes("7 - Tồn vong")) return "text-red-500 bg-red-500/10 border-red-500/20";
    if (lvl.includes("6 - Thảm họa cực đại")) return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    if (lvl.includes("5 - Thảm họa")) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    if (lvl.includes("4 - Khủng hoảng")) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    if (lvl.includes("3 - Nghiêm trọng")) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (lvl.includes("2 - Vấn đề")) return "text-purple-500 bg-purple-500/10 border-purple-500/20";
    if (lvl.includes("1 - Bất tiện")) return "text-gray-500 bg-gray-500/10 border-gray-500/20";

    switch (lvl) {
      case "user":
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "order":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "product":
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case "security":
        return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "payment":
        return "text-purple-500 bg-purple-500/10 border-purple-500/20";
      default:
        return "text-gray-500 bg-gray-500/10 border-gray-500/20";
    }
  };

  const getSeverityInfo = (lvl: string, action: string = "", message: string | null = "") => {
    // If the database item already has the mapped level, use it directly!
    const l = lvl || "";
    if (l.includes("7 - Tồn vong")) return { level: 7, name: "Tồn vong", color: "bg-red-950/50 text-red-400 border-red-800/50" };
    if (l.includes("6 - Thảm họa cực đại")) return {
      level: 6,
      name: "Thảm họa cực đại",
      color: "bg-rose-950/50 text-rose-400 border-rose-800/50",
    };
    if (l.includes("5 - Thảm họa")) return { level: 5, name: "Thảm họa", color: "bg-orange-950/50 text-orange-400 border-orange-800/50" };
    if (l.includes("4 - Khủng hoảng")) return {
      level: 4,
      name: "Khủng hoảng",
      color: "bg-yellow-950/50 text-yellow-400 border-yellow-800/50",
    };
    if (l.includes("3 - Nghiêm trọng")) return { level: 3, name: "Nghiêm trọng", color: "bg-blue-950/50 text-blue-400 border-blue-800/50" };
    if (l.includes("2 - Vấn đề")) return { level: 2, name: "Vấn đề", color: "bg-purple-950/50 text-purple-400 border-purple-800/50" };
    if (l.includes("1 - Bất tiện")) return { level: 1, name: "Bất tiện", color: "bg-gray-950/50 text-gray-400 border-gray-800/50" };

    // Otherwise, classify on the fly
    const act = action.toUpperCase();
    const msg = (message || "").toLowerCase();

    if (
      act === "BANKRUPTCY_WARNING" || msg.includes("tồn vong") || msg.includes("phá sản") || msg.includes("hết tiền") ||
        msg.includes("trả lương") ||
        msg.includes("từ chối gia hạn") ||
        msg.includes("chỉ còn tiền mặt")
    ) {
      return { level: 7, name: "Tồn vong", color: "bg-red-950/50 text-red-400 border-red-800/50" };
    }

    if (
      msg.includes("thảm họa cực đại") || msg.includes("khóa tài khoản") || msg.includes("ngừng hợp tác") || act === "INFLATION_SHOCK" ||
        msg.includes("lạm phát") ||
        msg.includes("bão giá")
    ) {
      return { level: 6, name: "Thảm họa cực đại", color: "bg-rose-950/50 text-rose-400 border-rose-800/50" };
    }

    if (
      msg.includes("cháy kho") || msg.includes("kho cháy") || msg.includes("mất 70%") || msg.includes("thất thoát 70%") ||
        act === "CROP_FAILURE" ||
        msg.includes("mất mùa") ||
        msg.includes("thiên tai")
    ) {
      return { level: 5, name: "Thảm họa", color: "bg-orange-950/50 text-orange-400 border-orange-800/50" };
    }

    if (
      msg.includes("giảm giá sâu") || msg.includes("đối thủ") || msg.includes("phá giá") || msg.includes("cạnh tranh") ||
        act.includes("SABOTAGE") ||
        act === "COMPETITION_SHOCK"
    ) {
      return { level: 4, name: "Khủng hoảng", color: "bg-yellow-950/50 text-yellow-400 border-yellow-800/50" };
    }

    if (
      msg.includes("giao trễ") || msg.includes("trễ hạn") || msg.includes("sự cố vận chuyển") || msg.includes("vận chuyển gặp sự cố") ||
        act === "LOGISTICS_BLOCKADE"
    ) {
      return { level: 3, name: "Nghiêm trọng", color: "bg-blue-950/50 text-blue-400 border-blue-800/50" };
    }

    if (msg.includes("hết hàng") || msg.includes("cháy hàng") || msg.includes("hết hàng trong 2 ngày") || act === "OUT_OF_STOCK") {
      return { level: 2, name: "Vấn đề", color: "bg-purple-950/50 text-purple-400 border-purple-800/50" };
    }

    return { level: 1, name: "Bất tiện", color: "bg-gray-950/50 text-gray-400 border-gray-800/50" };
  };

  if (!isAdmin()) {
    <div class="p-6 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 flex items-center justify-center min-h-[200px]">
      <div class="text-center space-y-2">
        <Icon path={shieldExclamation} class="w-12 h-12 mx-auto opacity-50" />
        <h3 class="font-bold text-lg">{"Khu vực hạn chế"}</h3>
        <p class="text-sm">{"Bạn cần quyền quản trị viên (Admin) để xem nhật ký hoạt động hệ thống."}</p>
      </div>
    </div>
  } else {
    <div class="p-6 space-y-6 animate-in fade-in duration-500">
      <header
        class={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 rounded-3xl shadow-sm border gap-4 ${
          theme() === "dark" ? "bg-[#1e1e1e] border-white/10" : "bg-white border-gray-100"
        }`}>
        <div>
          <h2 class={`text-2xl font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>{"Nhật ký hoạt động"}</h2>
          <p class="text-sm text-gray-500">{"Theo dõi mọi thao tác của người dùng và hệ thống theo thời gian thực."}</p>
        </div>
        <div class="flex gap-2">
          <button
            onClick={() => setLevel("all")}
            class={`px-4 py-2 font-medium rounded-xl border transition-colors text-sm ${
              level() === "all"
                ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}>
            {"Tất cả"}
          </button>
          <button
            onClick={() => setLevel("security")}
            class={`px-4 py-2 font-medium rounded-xl border transition-colors text-sm ${
              level() === "security"
                ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}>
            {"Cảnh báo"}
          </button>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div
          class={`lg:col-span-3 rounded-3xl border overflow-hidden shadow-sm flex flex-col ${
            theme() === "dark" ? "bg-[#1e1e1e] border-white/10" : "bg-white border-gray-100"
          }`}>
          <div class={`p-6 border-b ${theme() === "dark" ? "border-white/10" : "border-gray-50"}`}>
            <h3 class={`font-bold ${theme() === "dark" ? "text-gray-300" : "text-gray-700"}`}>{"Hoạt động gần đây"}</h3>
          </div>
          <div class={`divide-y flex-1 ${theme() === "dark" ? "divide-white/10" : "divide-gray-50"}`}>
            if (activities.loading) {
              <div class="p-8 text-center text-gray-400 italic">{"Đang tải dữ liệu..."}</div>
            } else if (!activities() || activities().length === 0) {
              <div class="p-8 text-center text-gray-400 italic">{"Chưa có dữ liệu nhật ký hoạt động."}</div>
            } else {
              for (const item of activities()) {
                <div
                  class={`p-6 transition-colors flex gap-4 sm:gap-6 items-start ${
                    theme() === "dark" ? "hover:bg-white/5" : "hover:bg-gray-50"
                  }`}>
                  <div class={`p-3 rounded-2xl border flex-shrink-0 ${getColorClass(item.level)}`}>
                    <Icon path={getIcon(item.level)} class="w-6 h-6" />
                  </div>
                  <div class="flex-1 min-w-0 pt-1">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-1">
                      <p class={`font-bold truncate ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                        {item.user || "Hệ thống"}
                      </p>
                      <span class="text-xs font-medium text-gray-400 whitespace-nowrap">
                        {getRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 font-medium">
                      {item.action}
                    </p>
                    if (item.message) {
                      <p class="text-xs text-gray-400 mt-1 leading-relaxed">
                        {item.message}
                      </p>
                    }
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span
                        class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                          theme() === "dark" ? "bg-[#0f0f0f] text-gray-400 border-white/10" : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}>
                        {"Thiết bị: " + (item.device || "Không xác định")}
                      </span>
                      <span
                        class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityInfo(
                          item.level,
                          item.action,
                          item.message,
                        ).color}`}>
                        {"Cấp " + getSeverityInfo(item.level, item.action, item.message).level + ": " +
                          getSeverityInfo(item.level, item.action, item.message).name}
                      </span>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
          <div class="p-4 bg-gray-50/50 border-t border-gray-100 text-center">
            <button onClick={() => refetch()} class="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
              {"Tải lại dữ liệu mới nhất ↻"}
            </button>
          </div>
        </div>

        {/* Severity levels reference guide */}
        <div
          class={`rounded-3xl border p-6 shadow-sm space-y-6 h-fit ${
            theme() === "dark" ? "bg-[#1e1e1e] border-white/10 text-gray-300" : "bg-white border-gray-100 text-gray-600"
          }`}>
          <div>
            <h3 class={`font-bold text-sm uppercase tracking-wider mb-1 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
              {"Phân loại Sự cố"}
            </h3>
            <p class="text-xs text-gray-500">{"Bảng tham chiếu cấp độ nghiêm trọng của sự kiện hệ thống."}</p>
          </div>
          <div class="space-y-4 text-xs">
            <div class="border-l-2 border-gray-500 pl-3 space-y-0.5">
              <div class="font-bold text-gray-400">{"Cấp 1 - Bất tiện"}</div>
              <div class="text-[11px] text-gray-500">{"Khách hỏi liên tục nhưng chatbot trả lời chậm 10 giây."}</div>
            </div>
            <div class="border-l-2 border-purple-500 pl-3 space-y-0.5">
              <div class="font-bold text-purple-400">{"Cấp 2 - Vấn đề"}</div>
              <div class="text-[11px] text-gray-500">{"Một sản phẩm bán chạy hết hàng trong 2 ngày."}</div>
            </div>
            <div class="border-l-2 border-blue-500 pl-3 space-y-0.5">
              <div class="font-bold text-blue-400">{"Cấp 3 - Nghiêm trọng"}</div>
              <div class="text-[11px] text-gray-500">{"30% đơn hàng tuần này bị giao trễ vì đơn vị vận chuyển gặp sự cố."}</div>
            </div>
            <div class="border-l-2 border-yellow-500 pl-3 space-y-0.5">
              <div class="font-bold text-yellow-400">{"Cấp 4 - Khủng hoảng"}</div>
              <div class="text-[11px] text-gray-500">{"Đối thủ giảm giá sâu làm doanh thu giảm 50% trong 1 tháng."}</div>
            </div>
            <div class="border-l-2 border-orange-500 pl-3 space-y-0.5">
              <div class="font-bold text-orange-400">{"Cấp 5 - Thảm họa"}</div>
              <div class="text-[11px] text-gray-500">{"Kho hàng chính bị cháy, mất 70% hàng tồn."}</div>
            </div>
            <div class="border-l-2 border-rose-500 pl-3 space-y-0.5">
              <div class="font-bold text-rose-400">{"Cấp 6 - Thảm họa cực đại"}</div>
              <div class="text-[11px] text-gray-500">{"Kho cháy, tài khoản quảng cáo khóa, nhà cung ứng ngừng hợp tác."}</div>
            </div>
            <div class="border-l-2 border-red-500 pl-3 space-y-0.5">
              <div class="font-bold text-red-500">{"Cấp 7 - Tồn vong"}</div>
              <div class="text-[11px] text-gray-500">{"Dòng tiền chỉ đủ trả lương 2 tuần, doanh thu giảm 95%, bị từ chối tín dụng."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  }
}
