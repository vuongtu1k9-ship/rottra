import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { authClient } from "~/client/utils/auth-client";
import { Form } from "./form.tsrx";
import { UserAvatar } from "~/client/components/user-avatar.tsrx";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import { qrCode, wallet } from "solid-heroicons/outline";
import { useSearchParams, useParams } from "@solidjs/router";
import { serverAgentBudgets, serverAgentGold, getDynamicSkillTitle, serverAgentEmployees } from "~/shared/constants";
import { t, currentLang, formatNumber, formatCurrency, currencySymbol } from "~/client/stores/i18n-store";

const agentBudgets: Record<string, number> = {
  toLuong: serverAgentBudgets.toLuong || 0,
  thuongNguyet: serverAgentBudgets.thuongNguyet || 0,
  tramTinh: serverAgentBudgets.tramTinh || 0,
  daoTieuCuu: serverAgentBudgets.daoTieuCuu || 0,
  hoaHuynh: serverAgentBudgets.hoaHuynh || 0,
  phiNguyet: serverAgentBudgets.phiNguyet || 0,
  nhuNguyet: serverAgentBudgets.nhuNguyet || 0,
  suGia: serverAgentBudgets.suGia || 0,
  phiAnh: serverAgentBudgets.phiAnh || 0,
  bachDiHanh: serverAgentBudgets.bachDiHanh || 0,
  uVuongMau: serverAgentBudgets.uVuongMau || 0,
  bachLoc: serverAgentBudgets.bachLoc || 0,
};

const agentGold: Record<string, number> = {
  toLuong: serverAgentGold.toLuong ?? 0,
  thuongNguyet: serverAgentGold.thuongNguyet ?? 0,
  tramTinh: serverAgentGold.tramTinh ?? 0,
  daoTieuCuu: serverAgentGold.daoTieuCuu ?? 0,
  hoaHuynh: serverAgentGold.hoaHuynh ?? 0,
  phiNguyet: serverAgentGold.phiNguyet ?? 0,
  nhuNguyet: serverAgentGold.nhuNguyet ?? 0,
  suGia: serverAgentGold.suGia ?? 0,
  phiAnh: serverAgentGold.phiAnh ?? 0,
  bachDiHanh: serverAgentGold.bachDiHanh ?? 0,
  uVuongMau: serverAgentGold.uVuongMau ?? 0,
  bachLoc: serverAgentGold.bachLoc ?? 0,
};

const defaultProducts: Record<string, { product: string; quantity: number; price: number }> = {
  toLuong: { product: "Sâm Ngọc Linh Kon Tum 🌿", quantity: 50, price: 4500000 },
  thuongNguyet: { product: "Hạt điều rang muối Bình Phước 🥜", quantity: 100, price: 180000 },
  tramTinh: { product: "Cà phê Robusta Buôn Ma Thuột ☕", quantity: 300, price: 150000 },
  daoTieuCuu: { product: "Hạt tiêu đen Phú Quốc 🌶️", quantity: 150, price: 120000 },
  hoaHuynh: { product: "Chè Thái Nguyên thượng hạng 🍵", quantity: 80, price: 300000 },
  phiNguyet: { product: "Gạo tám thơm Điện Biên 🌾", quantity: 1000, price: 25000 },
  nhuNguyet: { product: "Tỏi cô đơn Lý Sơn 🧄", quantity: 50, price: 350000 },
  suGia: { product: "Măng khô Tây Bắc 🎋", quantity: 120, price: 280000 },
  phiAnh: { product: "Bơ sáp Đắk Lắk 🥑", quantity: 500, price: 35000 },
  bachDiHanh: { product: "Mật ong rừng Tràm 🔥", quantity: 200, price: 250000 },
  uVuongMau: { product: "Chè Shan Tuyết cổ thụ 🍃", quantity: 80, price: 1200000 },
  bachLoc: { product: "Nấm lim xanh Quảng Nam 🍄", quantity: 40, price: 3200000 },
};

const agentSkills: Record<string, { level: number; name: string; color: string }> = {
  toLuong: { level: 9, name: "Lão luyện", color: "#fbbf24" },
  thuongNguyet: { level: 8, name: "Khéo léo", color: "#facc15" },
  tramTinh: { level: 5, name: "Bình thường", color: "#9ca3af" },
  daoTieuCuu: { level: 10, name: "Thần thương lượng", color: "#fb7185" },
  hoaHuynh: { level: 8, name: "Cứng rắn", color: "#fb923c" },
  phiNguyet: { level: 7, name: "Khá", color: "#60a5fa" },
  nhuNguyet: { level: 6, name: "Trung bình", color: "#94a3b8" },
  suGia: { level: 6, name: "Trung bình", color: "#94a3b8" },
  phiAnh: { level: 5, name: "Bình thường", color: "#9ca3af" },
  bachDiHanh: { level: 4, name: "Nhút nhát", color: "#f87171" },
  uVuongMau: { level: 7, name: "Xảo quyệt", color: "#c084fc" },
  bachLoc: { level: 4, name: "Dễ tin người", color: "#f87171" },
};

export const Profile = (props: any) => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const targetUserId = () => {
    let slug = params.userId || searchParams.userId;
    if (slug) {
      if (slug.startsWith("user")) {
        slug = slug.replace(/^user[-_]?/, "");
      }
      if (slug === "agent-pro-max" || slug === "agent_pro_max" || slug === "RottraAI" || slug === "RottraAI") {
        return "RottraAI";
      }
      const agentMap: Record<string, string> = {
        "to-luong": "toLuong",
        "thuong-nguyet": "thuongNguyet",
        "tram-tinh": "tramTinh",
        "dao-tieu-cuu": "daoTieuCuu",
        "hoa-huynh": "hoaHuynh",
        "phi-nguyet": "phiNguyet",
        "nhu-nguyet": "nhuNguyet",
        "su-gia": "suGia",
        "phi-anh": "phiAnh",
        "bach-di-hanh": "bachDiHanh",
        "u-vuong-mau": "uVuongMau",
        "bach-loc": "bachLoc",
      };
      if (agentMap[slug]) {
        return agentMap[slug];
      }

      const camelCaseSlugs = Object.values(agentMap);
      if (camelCaseSlugs.includes(slug)) {
        return "INVALID_SLUG";
      }
    }
    return slug;
  };
  const session = authClient.useSession();
  const user = () => session()?.data?.user;
  const role = () => user() ? (user() as any)?.role || "user" : "guest";
  const activeUserId = () => props.user?.id || profile()?.id || targetUserId() || user()?.id;

  const [profile, setProfile] = createSignal<any>(
    props.user
      ? {
          ...props.user.profile || {},
          fullName: props.user.profile?.fullName || props.user.name,
          email: props.user.email,
        }
      : null,
  );
  const [profileNotFound, setProfileNotFound] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [showJournalForm, setShowJournalForm] = createSignal(false);
  const [showQrForm, setShowQrForm] = createSignal(false);

  const [editBudget, setEditBudget] = createSignal<number>(0);
  const [editPrice, setEditPrice] = createSignal<number>(0);
  const [editQty, setEditQty] = createSignal<number>(0);

  const isAgent = () => {
    const uid = activeUserId();
    return uid &&
      [
        "toLuong",
        "thuongNguyet",
        "tramTinh",
        "daoTieuCuu",
        "hoaHuynh",
        "phiNguyet",
        "nhuNguyet",
        "suGia",
        "phiAnh",
        "bachDiHanh",
        "uVuongMau",
        "bachLoc",
      ].includes(uid);
  };

  const [sharedQR, setSharedQR] = createSignal<any>(null);
  createEffect(() => {
    const fetchSharedQR = async () => {
      try {
        const res = await fetch("/api/profile/RottraAI");
        const data = await res.json();
        if (data.success && data.profile) {
          setSharedQR({
            qrImage: data.profile.qrImage,
          });
        }
      } catch (err) {
        console.error("Failed to fetch shared QR:", err);
      }
    };
    fetchSharedQR();
  });

  createEffect(() => {
    const targetId = activeUserId();
    if (targetId) {
      const defaultProd = defaultProducts[targetId];
      const p =
        profile()?.price !== undefined ? profile().price : defaultProd?.price || 0;
      const q =
        profile()?.quantity !== undefined ? profile().quantity : defaultProd?.quantity || 0;
      const b =
        profile()?.budget !== undefined ? profile().budget : agentBudgets[targetId] || 0;
      setEditPrice(p);
      setEditQty(q);
      setEditBudget(b);
    }
  });

  const handleSaveAgentConfig = async () => {
    const targetId = activeUserId();
    if (!targetId) return;

    const shortKey = targetId.replace(/^user_?/, "");
    const payload = {
      assets: {
        [shortKey]: {
          budget: editBudget(),
          quantity: editQty(),
          price: editPrice(),
        },
      },
    };

    try {
      const res = await fetch("/api/agent/sync-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setProfile((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            budget: editBudget(),
            quantity: editQty(),
            price: editPrice(),
          };
        });
        alert(t("Cấu hình Agent cập nhật thành công!"));
      } else {
        alert(t("Có lỗi khi cập nhật cấu hình Agent."));
      }
    } catch (err) {
      console.error(err);
      alert(t("Lỗi kết nối khi cập nhật cấu hình Agent."));
    }
  };
  // Use this for rendering user info so it doesn't accidentally fall back to the session user
  const displayRole = () => props.user ? props.user.role || "user" : profile()?.role || role();

  const chartData = () => {
    if (profile()?.activityStats) return profile().activityStats;
    const daysList = [];
    const baselines = [8, 12, 15, 18, 25, 30, 20];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      daysList.push({ label: dayStr, value: baselines[6 - i] });
    }
    return daysList;
  };
  const maxChartValue = () => Math.max(...chartData().map((d) => d.value));

  createEffect(() => {
    if (props.user || !user()) return;

    const loadProfile = async () => {
      try {
        const slug = params.userId || searchParams.userId;
        const id = targetUserId();
        if (id === "INVALID_SLUG") {
          setProfileNotFound(true);
          return;
        }
        const fetchId = slug || id;
        const url = fetchId ? `/api/profile/${fetchId}` : "/api/profile";
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.profile) {
          setProfile(data.profile);
        } else {
          setProfileNotFound(true);
        }
      } catch (err) {
        console.error(err);
        setProfileNotFound(true);
      }
    };

    loadProfile();
  });

  createEffect(() => {
    if (props.user) {
      setProfile({
        ...props.user.profile || {},
        fullName: props.user.profile?.fullName || props.user.name,
        email: props.user.email,
      });
    }
  });

  onMount(() => {
    let ws: WebSocket | null = null;
    let destroyed = false;
    const connect = () => {
      if (destroyed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const newWs = new WebSocket(`${protocol}//${host}/api/ws-signaling`);

      newWs.onmessage = async (event) => {
        try {
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }
          const msg = JSON.parse(rawData);
          if (msg.type === "trade-sync" && msg.assets) {
            const cleanId = activeUserId()?.replace(/^user_?/, "");
            if (cleanId && msg.assets[cleanId]) {
              const asset = msg.assets[cleanId];
              setProfile((prev: any) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  budget: asset.budget,
                  product: asset.product,
                  quantity: asset.quantity,
                  price: asset.price,
                  gold: asset.gold,
                };
              });
            }
          }
        } catch (e) {
          console.error("WS sync error on profile page:", e);
        }
      };

      newWs.onerror = (e) => {
        console.warn("[WS] Profile page connection error, will retry...");
      };

      newWs.onclose = () => {
        if (!destroyed) {
          setTimeout(() => {
            if (ws === newWs) {
              connect();
            }
          }, 5000);
        }
      };

      ws = newWs;
    };

    connect();

    onCleanup(() => {
      destroyed = true;
      if (ws) {
        ws.close();
      }
    });
  });

  const fields = () => {
    const base = [
      { label: t("Họ và tên"), key: "fullName", empty: t("Chưa cập nhật tên") },
      { label: t("Số điện thoại"), key: "phone", empty: t("Chưa cập nhật SĐT") },
      { label: t("Địa chỉ"), key: "address", empty: t("Chưa cập nhật địa chỉ") },
      { label: t("Tiểu sử"), key: "bio", empty: t("Chưa có giới thiệu") },
    ];
    if (!isAgent()) {
      // (vietqrId removed)
    }
    return base;
  };

  const formFields = () => {
    const base = [
      { name: "fullName", label: t("Họ và tên"), type: "text", required: true },
      { name: "phone", label: t("Số điện thoại"), type: "tel" },
      { name: "address", label: t("Địa chỉ"), type: "text" },
      { name: "bio", label: t("Tiểu sử"), type: "textarea" },
    ];
    if (!isAgent()) {
      base.splice(3, 0, { name: "qrImage", label: t("Ảnh Mã Thanh Toán VietQR"), type: "image" });
    }
    return base;
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated.profile);
        setShowForm(false);
        alert(t("Cập nhật hồ sơ thành công!"));
      }
    } catch (err) {
      console.error(err);
      alert(t("Có lỗi khi cập nhật hồ sơ."));
    }
  };

  const journalFormFields = () => [
    { name: "type", label: t("Loại sự kiện (Giao thương, Xung đột, Suy ngẫm...)"), type: "text" },
    { name: "content", label: t("Sự kiện cốt lõi"), type: "textarea", required: true },
  ];

  const handleJournalSubmit = async (data: any) => {
    try {
      const res = await fetch("/api/users/add-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUserId(), ...data }),
      });
      if (res.ok) {
        setShowJournalForm(false);
        // Refresh component or optimistic update might be needed, but a notification works.
        alert(t("Đã mớm sự kiện! AI đang tiến hành viết nhật ký ngầm."));
      } else {
        alert(t("Có lỗi khi tạo nhật ký."));
      }
    } catch (err) {
      console.error(err);
      alert(t("Có lỗi kết nối."));
    }
  };

  return <>
    <Show when={profileNotFound()}>
      <div class="w-full h-screen bg-transparent"></div>
    </Show>
    <Show when={!profileNotFound()}>
      <Show
        when={["admin", "user", "agent"].includes(role())}
        fallback={<>
          <div
            class="max-w-md mx-auto my-12 p-8 rounded-3xl border border-white/20 bg-white/80 backdrop-blur-md shadow-xl text-center space-y-6">
            <div class="w-16 h-16 mx-auto bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
              <Icon path={qrCode} class="w-8 h-8 opacity-75" />
            </div>
            <h2 class="text-xl font-bold text-gray-800">
              {t("Yêu Cầu Xác Thực")}
            </h2>
            <p class="text-xs text-gray-500 leading-relaxed">
              {t("Vui lòng đăng nhập tài khoản của bạn để truy cập và chỉnh sửa thông tin hồ sơ cá nhân.")}
            </p>
            <a
              href="/auth"
              class="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:shadow-blue-200 transition-all active:scale-95 text-sm cursor-pointer">
              {t("Đăng nhập ngay")}
            </a>
          </div>
        </>}>
        <div id="profile-page" class="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
          {props.isMini &&
            <article
              id={"profile-mini-" + (props.user?.id || user()?.id || "guest")}
              class={`p-6 rounded-3xl shadow-sm border flex flex-col items-center text-center hover:shadow-md transition-all relative ${
                props.user?.id === "RottraAI" || displayRole() === "agent"
                  ? "bg-gradient-to-b from-purple-950/20 via-transparent to-transparent border-purple-500/20 shadow-purple-500/5 ring-1 ring-purple-500/10"
                  : theme() === "dark"
                    ? "bg-[#1e1e1e] border-white/10"
                    : "bg-white border-gray-100"
              }`}>
              <span
                class={`absolute top-4 right-4 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                  displayRole() === "admin"
                    ? "bg-purple-100 text-purple-500"
                    : props.user?.id === "RottraAI" || displayRole() === "agent"
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-green-100 text-green-700"
                }`}>
                {props.user?.id === "RottraAI" || displayRole() === "agent" ? t("Rottra") : t(displayRole())}
              </span>
              <UserAvatar
                name={props.user?.name || profile()?.fullName || user()?.name || t("Người dùng")}
                image={
                  (props.user?.id === "RottraAI" || activeUserId() === "RottraAI") && !(profile()?.avatar?.link || props.user?.image)
                    ? "/assets/rontra-default-agri.png"
                    : profile()?.avatar?.link || profile()?.imgId?.link || props.user?.image
                }
                loading={!props.user && !profile() && !profileNotFound()}
                class={`w-20 h-20 text-2xl ring-4 ring-blue-50 mb-4 shadow-sm transition-transform ${
                  props.activeSubAgentId ? "cursor-pointer hover:scale-105" : ""
                }`}
                onClick={(e) => {
                  if (props.activeSubAgentId && props.setActiveSubAgentId) {
                    e.stopPropagation();
                    props.setActiveSubAgentId(null);
                  }
                }}
              />
              <h3
                class={`text-xl font-bold transition-colors ${theme() === "dark" ? "text-white" : "text-gray-800"} ${
                  props.activeSubAgentId ? "cursor-pointer hover:text-purple-500 dark:hover:text-purple-400" : ""
                }`}
                onClick={(e) => {
                  if (props.activeSubAgentId && props.setActiveSubAgentId) {
                    e.stopPropagation();
                    props.setActiveSubAgentId(null);
                  }
                }}>
                {props.user?.name || profile()?.fullName || user()?.name || t("Chưa cập nhật tên")}
              </h3>
              <p class="text-sm text-gray-500 mb-4">
                {props.user?.email || user()?.email}
              </p>
              <div
                class={`w-full text-left p-4 rounded-2xl text-sm border space-y-2 ${
                  theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                }`}>
                {(() => {
                  const isSystemAgent = activeUserId() === "RottraAI" || activeUserId() === "RottraAI";

                  const getSumBudget = () => {
                    let total = 30000000;
                    Object.values(agentBudgets).forEach((b) => (total += b));
                    return total;
                  };
                  const getSumGold = () => {
                    let total = 5;
                    Object.values(agentGold).forEach((g) => (total += g));
                    return total;
                  };
                  const getSumStocks = () => {
                    const aggregated: Record<string, number> = {};
                    const loreIds = [
                      "toLuong",
                      "thuongNguyet",
                      "tramTinh",
                      "daoTieuCuu",
                      "hoaHuynh",
                      "phiNguyet",
                      "nhuNguyet",
                      "suGia",
                      "phiAnh",
                      "bachDiHanh",
                      "uVuongMau",
                      "bachLoc",
                    ];
                    loreIds.forEach((id) => {
                      const sVal = { BTC: 10, HPG: 200, FPT: 100, VNM: 150 };
                      Object.entries(sVal).forEach(([symbol, qty]) => {
                        aggregated[symbol] = (aggregated[symbol] || 0) + qty;
                      });
                    });
                    return aggregated;
                  };

                  const budget =
                    displayRole() === "admin"
                      ? 0
                      : (profile()?.budget !== undefined && profile()?.budget !== null
                        ? profile().budget
                        : (isSystemAgent ? getSumBudget() : agentBudgets[activeUserId()] ?? 0));
                  const gold =
                    displayRole() === "admin"
                      ? 0
                      : (profile()?.gold !== undefined && profile()?.gold !== null
                        ? profile().gold
                        : (isSystemAgent ? getSumGold() : agentGold[activeUserId()] ?? 0));
                  const stocks =
                    displayRole() === "admin"
                      ? { BTC: 0, HPG: 0, FPT: 0, VNM: 0 }
                      : (profile()?.stocks && Object.keys(profile()?.stocks).length > 0
                        ? profile().stocks
                        : (isSystemAgent ? getSumStocks() : { BTC: 10, HPG: 200, FPT: 100, VNM: 150 }));

                  const btcQty = (stocks.BTC !== undefined ? Number(stocks.BTC) : 0) / 10000;
                  let totalStockQty = 0;
                  Object.entries(stocks).forEach(([symbol, qty]) => {
                    if (symbol !== "BTC") {
                      totalStockQty += Number(qty);
                    }
                  });

                  return <>
                    {budget !== undefined && budget !== 0 &&
                      <div
                        class="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl mb-1.5">
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                          {t("Số dư:")}
                        </span>
                        <span class="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                          {formatCurrency(budget)}
                          {currencySymbol()}
                        </span>
                      </div>}
                    {gold !== undefined && gold !== 0 &&
                      <div
                        class="flex justify-between items-center bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1.5 rounded-xl mb-1.5">
                        <span class="text-yellow-600 dark:text-yellow-400 font-bold text-[11px] flex items-center gap-1">
                          <span>
                            {"🪙"}
                          </span>
                          <span>
                            {t("Dự trữ vàng:")}
                          </span>
                        </span>
                        <span class="font-extrabold text-yellow-600 dark:text-yellow-400 text-xs">
                          {t("{amount} lượng").replace(
                            "{amount}",
                            formatNumber(gold, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                          )}
                        </span>
                      </div>}
                    {btcQty > 0 &&
                      <div
                        class="flex justify-between items-center bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5 rounded-xl mb-1.5">
                        <span class="text-orange-600 dark:text-orange-400 font-bold text-[11px] flex items-center gap-1">
                          <span>
                            {"₿"}
                          </span>
                          <span>
                            {t("Bitcoin:")}
                          </span>
                        </span>
                        <span class="font-extrabold text-orange-600 dark:text-orange-400 text-xs">
                          {t("{qty} BTC").replace("{qty}", formatNumber(btcQty, { maximumFractionDigits: 4 }))}
                        </span>
                      </div>}
                    {totalStockQty > 0 &&
                      <div class="flex justify-between items-center bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 rounded-xl mb-2">
                        <span class="text-blue-600 dark:text-blue-400 font-bold text-[11px] flex items-center gap-1">
                          <span>
                            {"📈"}
                          </span>
                          <span>
                            {t("Chứng khoán:")}
                          </span>
                        </span>
                        <span class="font-extrabold text-blue-600 dark:text-blue-400 text-xs">
                          {t("{qty} cổ").replace("{qty}", formatNumber(totalStockQty))}
                        </span>
                      </div>}
                    {profile()?.loanAmount !== undefined &&
                      <div class="mt-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-purple-600 dark:text-purple-400 font-bold text-[11px] flex items-center gap-1">
                            <span>
                              {"🏦"}
                            </span>
                            <span>
                              {t("Hạn mức vay AI:")}
                            </span>
                          </span>
                          <span class="font-extrabold text-purple-600 dark:text-purple-400 text-xs">
                            {formatCurrency(profile().loanAmount)}
                            {currencySymbol()}
                          </span>
                        </div>
                        {profile()?.loanParams &&
                          <div
                            class="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5 pt-1.5 border-t border-purple-500/10 text-[10px] text-gray-400">
                            <div>
                              {t("Thu nhập cơ bản:")}
                              <span class="font-semibold text-gray-300">
                                {formatCurrency(profile().loanParams.baseIncome)}
                                {currencySymbol()}
                              </span>
                            </div>
                            <div>
                              {t("P(Nợ xấu):")}
                              <span class="font-semibold text-gray-300">
                                {formatNumber(profile().loanParams.pDefault * 100, { maximumFractionDigits: 0 })}
                                %
                              </span>
                            </div>
                            <div>
                              {t("Điểm hành vi:")}
                              <span class="font-semibold text-gray-300">
                                x
                                {profile().loanParams.behaviorScore}
                              </span>
                            </div>
                            <div>
                              {t("Lịch sử tín dụng:")}
                              <span class="font-semibold text-gray-300">
                                x
                                {profile().loanParams.creditHistoryFactor}
                              </span>
                            </div>
                            <div>
                              {t("Duyệt chính sách:")}
                              <span class="font-semibold text-gray-300">
                                x
                                {profile().loanParams.policyApproval}
                              </span>
                            </div>
                            <div>
                              {t("Điều chỉnh vĩ mô:")}
                              <span class="font-semibold text-gray-300">
                                x
                                {profile().loanParams.macroAdjustment}
                              </span>
                            </div>
                          </div>}
                      </div>}
                  </>;
                })()}
                <div class="flex justify-between">
                  <span class="text-gray-400 font-medium">
                    {t("SĐT:")}
                  </span>
                  <span class={`font-semibold ${theme() === "dark" ? "text-gray-200" : "text-gray-700"}`}>
                    {profile()?.phone || t("Trống")}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 font-medium">
                    {t("Địa chỉ:")}
                  </span>
                  <span
                    class={`font-semibold truncate max-w-[150px] ${theme() === "dark" ? "text-gray-200" : "text-gray-700"}`}
                    title={profile()?.address || t("Trống")}>
                    {profile()?.address || t("Trống")}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400 font-medium">
                    {t("Tiểu sử:")}
                  </span>
                  <span
                    class={`font-semibold truncate max-w-[150px] ${theme() === "dark" ? "text-gray-200" : "text-gray-700"}`}
                    title={profile()?.bio || t("Trống")}>
                    {profile()?.bio || t("Trống")}
                  </span>
                </div>
                <div class="flex justify-between">
                  {(() => {
                    const uid = props.user?.id || user()?.id;
                    if (
                      uid === "toLuong" || uid === "thuongNguyet" || uid === "tramTinh" || uid === "daoTieuCuu" || uid === "hoaHuynh" ||
                        uid === "phiNguyet" ||
                        uid === "nhuNguyet" ||
                        uid === "suGia"
                    ) {
                      return <>
                        <span class="text-gray-400 font-medium">
                          {t("Thuộc nhóm:")}
                        </span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">
                          {t("Phe Nguyệt Quang")}
                        </span>
                      </>;
                    } else if (uid === "phiAnh" || uid === "bachDiHanh" || uid === "uVuongMau" || uid === "bachLoc") {
                      return <>
                        <span class="text-gray-400 font-medium">
                          {t("Thuộc nhóm:")}
                        </span>
                        <span class="font-semibold text-gray-700 dark:text-gray-200">
                          {t("Phe Quang Minh")}
                        </span>
                      </>;
                    } else if (uid === "RottraAI" || displayRole() === "agent") {
                      return <>
                        <span class="text-gray-400 font-medium">
                          {t("Vai trò:")}
                        </span>
                        <span class="font-bold text-purple-600 dark:text-purple-400">
                          {t("Rottra")}
                        </span>
                      </>;
                    } else {
                      return <>
                        <span class="text-gray-400 font-medium">
                          {t("Vai trò:")}
                        </span>
                        <span class="capitalize font-semibold text-gray-700 dark:text-gray-200">
                          {t(displayRole())}
                        </span>
                      </>;
                    }
                  })()}
                </div>
                {}
                {(() => {
                  const uid = props.user?.id || user()?.id;
                  const subAgentIds = [
                    "toLuong",
                    "thuongNguyet",
                    "tramTinh",
                    "daoTieuCuu",
                    "hoaHuynh",
                    "phiNguyet",
                    "nhuNguyet",
                    "suGia",
                    "phiAnh",
                    "bachDiHanh",
                    "uVuongMau",
                    "bachLoc",
                  ];
                  const isAgentOrSub = uid === "RottraAI" || displayRole() === "agent" || subAgentIds.includes(uid);

                  if (isAgentOrSub) {
                    const moonlightList = [
                      { id: "toLuong", name: "Tô Lượng", icon: "👑" },
                      { id: "thuongNguyet", name: "Thương Nguyệt", icon: "🌞" },
                      { id: "tramTinh", name: "Trầm Tinh", icon: "🔮" },
                      { id: "daoTieuCuu", name: "Đào Tiểu Cửu", icon: "✨" },
                      { id: "hoaHuynh", name: "Hỏa Huỳnh", icon: "🔥" },
                      { id: "phiNguyet", name: "Phi Nguyệt", icon: "💎" },
                      { id: "nhuNguyet", name: "Như Nguyệt", icon: "🎴" },
                      { id: "suGia", name: "Sứ giả", icon: "🛡️" },
                    ];

                    const quangMinhList = [
                      { id: "phiAnh", name: "Phi Anh", icon: "🧚" },
                      { id: "bachDiHanh", name: "Bạch Di Hành", icon: "⚔️" },
                      { id: "uVuongMau", name: "U Vương Mẫu", icon: "🕸️" },
                      { id: "bachLoc", name: "Bạch Lộc", icon: "🦌" },
                    ];

                    return <>
                      <div class="pt-2 mt-1 border-t border-gray-100 dark:border-white/5 text-left w-full space-y-3">
                        <div
                          class="text-[9px] font-black text-sky-500 dark:text-sky-400 uppercase tracking-widest text-center border-b border-gray-100 dark:border-white/5 pb-1.5 font-bold">
                          {t("Danh sách Agent Độc lập (Independent Agents)")}
                        </div>
                        <div class="space-y-1">
                          <span class="text-[9px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest block">
                            {t("Phe Nguyệt Quang (8):")}
                          </span>
                          <div class="grid grid-cols-2 gap-x-1 gap-y-1 text-[9px] font-semibold">
                            {moonlightList.map((item) => {
                              const isActive = props.activeSubAgentId === item.id || !props.activeSubAgentId && uid === item.id;
                              return <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (props.setActiveSubAgentId) {
                                    if (isActive) {
                                      props.setActiveSubAgentId(null);
                                    } else {
                                      props.setActiveSubAgentId(item.id);
                                    }
                                  }
                                }}
                                class={`flex items-center gap-1 px-1 py-0.5 rounded-md transition-all text-left w-full border ${
                                  isActive
                                    ? "bg-purple-600 border-purple-500 text-white font-bold shadow-sm"
                                    : "bg-white/50 dark:bg-black/30 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-200 dark:hover:border-purple-900/50"
                                }`}>
                                <span>
                                  {item.icon}
                                </span>
                                <span class="whitespace-normal leading-tight text-[8px] sm:text-[9px]">
                                  {t(item.name)}
                                </span>
                              </button>;
                            })}
                          </div>
                        </div>
                        {}
                        <div class="space-y-1">
                          <span class="text-[9px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest block">
                            {t("Phe Quang Minh (5):")}
                          </span>
                          <div class="grid grid-cols-2 gap-x-1 gap-y-1 text-[9px] font-semibold">
                            {quangMinhList.map((item) => {
                              const isActive = props.activeSubAgentId === item.id || !props.activeSubAgentId && uid === item.id;
                              return <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (props.setActiveSubAgentId) {
                                    if (isActive) {
                                      props.setActiveSubAgentId(null);
                                    } else {
                                      props.setActiveSubAgentId(item.id);
                                    }
                                  }
                                }}
                                class={`flex items-center gap-1 px-1 py-0.5 rounded-md transition-all text-left w-full border ${
                                  isActive
                                    ? "bg-amber-600 border-amber-500 text-white font-bold shadow-sm"
                                    : "bg-white/50 dark:bg-black/30 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-900/50"
                                }`}>
                                <span>
                                  {item.icon}
                                </span>
                                <span class="whitespace-normal leading-tight text-[8px] sm:text-[9px]">
                                  {t(item.name)}
                                </span>
                              </button>;
                            })}
                          </div>
                        </div>
                      </div>
                    </>;
                  }
                })()}
                {profile()?.banned &&
                  <div class="flex justify-between text-red-600 bg-red-50 p-1 rounded">
                    <span class="font-bold">
                      {t("Trạng thái:")}
                    </span>
                    <span class="font-bold uppercase">
                      {t("Đã bị chặn")}
                    </span>
                  </div>}
                {profile()?.warnings?.length > 0 &&
                  <div class="flex justify-between text-yellow-600 bg-yellow-50 p-1 rounded">
                    <span class="font-bold">
                      {t("Cảnh báo:")}
                    </span>
                    <span class="font-bold">
                      {t("{count} lần;").replace("{count}", formatNumber(profile()?.warnings?.length))}
                    </span>
                  </div>}
                {profile()?.groups?.length > 0 &&
                  <div class="flex flex-col text-blue-600 bg-blue-50 p-1 rounded gap-1">
                    <span class="font-bold">
                      {t("Thuộc nhóm:")}
                    </span>
                    <span class="font-bold text-xs">
                      {profile()?.groups?.map((g: any) => g.name).join(", ")}
                    </span>
                  </div>}
                {}
                <div class="pt-3 flex flex-col items-center justify-center border-t border-gray-200/20 mt-2">
                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("Mã QR Thanh Toán")}
                  </span>
                  {(isAgent() ? sharedQR()?.qrImage?.link : profile()?.qrImage?.link)
                    ? <img
                        src={isAgent() ? sharedQR()?.qrImage?.link : profile()?.qrImage?.link}
                        alt="Custom QR"
                        class="w-32 h-32 rounded-2xl shadow-md object-cover border border-gray-100 dark:border-white/10"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    : <div
                        class="w-32 h-32 bg-gray-50 dark:bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-white/10 text-gray-400 gap-1.5">
                        <Icon path={qrCode} class="w-8 h-8 opacity-25" />
                        <span class="text-[8px] font-bold uppercase tracking-widest">
                          {t("Chưa có")}
                        </span>
                      </div>}
                </div>
              </div>
            </article>}
          <Show when={!props.isMini}>
            <header
              id="profile-main-header"
              class="flex flex-col sm:flex-row justify-between items-center bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/20 gap-4">
              <div class="flex items-center gap-6">
                <div class="relative group">
                  <UserAvatar
                    name={profile()?.fullName || user()?.name || t("Người dùng")}
                    image={
                      (targetUserId() === "RottraAI" || activeUserId() === "RottraAI") && !(profile()?.avatar?.link || profile()?.imgId?.link)
                        ? "/assets/rontra-default-agri.png"
                        : profile()?.avatar?.link || profile()?.imgId?.link
                    }
                    loading={!props.user && !profile() && !profileNotFound()}
                    class="w-24 h-24 text-3xl ring-4 ring-blue-50 transition-transform group-hover:scale-105 shadow-md"
                  />
                  <div
                    class="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span class="text-white text-xs font-bold">
                      {t("Xem ảnh")}
                    </span>
                  </div>
                </div>
                <div>
                  <h1 class="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-500 bg-clip-text text-transparent">
                    {profile()?.fullName || user()?.name || t("Hồ sơ")}
                  </h1>
                  <p class="text-gray-500 font-medium">
                    {profile()?.email || user()?.email || ""}
                  </p>
                </div>
              </div>
              {!props.user && (!targetUserId() || targetUserId() === user()?.id) &&
                <button
                  id="btn-edit-profile"
                  type="button"
                  onClick={() => setShowForm(true)}
                  class="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center gap-2">
                  {t("Chỉnh sửa hồ sơ")}
                </button>}
            </header>
            <div
              id="vietqr-section"
              class="flex flex-col items-center justify-center bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/20 hover:shadow-md transition-all group relative overflow-hidden">
              <h3 class="text-sm font-bold text-gray-800 uppercase tracking-wider mb-6">
                {t("Mã Thanh Toán VietQR")}
              </h3>
              <div class="relative">
                {(isAgent() ? sharedQR()?.qrImage?.link : profile()?.qrImage?.link)
                  ? <img
                      src={isAgent() ? sharedQR()?.qrImage?.link : profile()?.qrImage?.link}
                      alt="Custom QR"
                      class="w-56 h-56 rounded-3xl shadow-xl object-cover ring-8 ring-white"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  : <div
                      class="w-56 h-56 bg-gray-50 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 gap-3">
                      <Icon path={qrCode} class="w-16 h-16 opacity-20" />
                      <span class="text-[10px] font-bold uppercase tracking-widest">
                        {t("Chưa có mã QR")}
                      </span>
                    </div>}
                {}
                {!isAgent() && (!targetUserId() || targetUserId() === user()?.id) &&
                  <button
                    onClick={() => setShowForm(true)}
                    class="absolute -bottom-3 -right-3 p-4 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 group/btn">
                    <Icon path={qrCode} class="w-6 h-6" />
                    <div
                      class="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
                      {t("Chỉnh sửa VietQR")}
                    </div>
                  </button>}
              </div>
              {!isAgent() && profile()?.qrLastUpdated &&
                <p class="text-[9px] text-gray-400 mt-4 font-bold uppercase tracking-tighter">
                  {t("Cập nhật lần cuối: ")}
                  {new Date(profile().qrLastUpdated).toLocaleString(currentLang() === "vi" ? "vi-VN" : "en-US")}
                </p>}
              {!isAgent() && !profile()?.qrImage?.link &&
                <p class="text-xs text-gray-400 mt-8 font-medium italic">
                  {t("Cập nhật hồ sơ hoặc tải ảnh QR trực tiếp để nhận thanh toán")}
                </p>}
              {isAgent() &&
                <p class="text-xs text-purple-500 mt-8 font-bold italic">
                  {t("Sử dụng chung mã QR thanh toán của RottraAI")}
                </p>}
            </div>
            {(() => {
              const isSystemAgent = activeUserId() === "RottraAI" || activeUserId() === "RottraAI";

              const getSumBudget = () => {
                let total = 30000000;
                Object.values(agentBudgets).forEach((b) => (total += b));
                return total;
              };
              const getSumGold = () => {
                let total = 5;
                Object.values(agentGold).forEach((g) => (total += g));
                return total;
              };
              const getSumStocks = () => {
                const aggregated: Record<string, number> = {};
                const loreIds = [
                  "toLuong",
                  "thuongNguyet",
                  "tramTinh",
                  "daoTieuCuu",
                  "hoaHuynh",
                  "phiNguyet",
                  "nhuNguyet",
                  "suGia",
                  "phiAnh",
                  "bachDiHanh",
                  "uVuongMau",
                  "bachLoc",
                ];
                loreIds.forEach((id) => {
                  const sVal = { BTC: 10, HPG: 200, FPT: 100, VNM: 150 };
                  Object.entries(sVal).forEach(([symbol, qty]) => {
                    aggregated[symbol] = (aggregated[symbol] || 0) + qty;
                  });
                });
                return aggregated;
              };

              const budget =
                displayRole() === "admin"
                  ? 0
                  : (profile()?.budget !== undefined && profile()?.budget !== null
                    ? profile().budget
                    : (isSystemAgent ? getSumBudget() : agentBudgets[activeUserId()] ?? 0));
              const gold =
                displayRole() === "admin"
                  ? 0
                  : (profile()?.gold !== undefined && profile()?.gold !== null
                    ? profile().gold
                    : (isSystemAgent ? getSumGold() : agentGold[activeUserId()] ?? 0));
              const stocks =
                displayRole() === "admin"
                  ? { BTC: 0, HPG: 0, FPT: 0, VNM: 0 }
                  : (profile()?.stocks && Object.keys(profile()?.stocks).length > 0
                    ? profile().stocks
                    : (isSystemAgent ? getSumStocks() : { BTC: 10, HPG: 200, FPT: 100, VNM: 150 }));

              const dbSkillLevel = profile()?.skillLevel;
              const dbSkillTitle = profile()?.skillTitle;
              const defaultSkill = agentSkills[activeUserId()?.replace(/^user_?/, "")];
              const skillLevel =
                dbSkillLevel !== undefined ? dbSkillLevel : defaultSkill?.level || 5;
              const skillTitle = getDynamicSkillTitle(activeUserId() || "", skillLevel);

              const getSkillColor = (lvl: number) => {
                if (lvl >= 13) return "#f43f5e";
                if (lvl >= 10) return "#fbbf24";
                if (lvl >= 8) return "#facc15";
                if (lvl >= 6) return "#60a5fa";
                return "#f87171";
              };
              const skillColor =
                profile()?.color || (skillLevel !== undefined ? getSkillColor(skillLevel) : defaultSkill?.color || "#9ca3af");

              if (budget !== undefined) {
                const defaultProd = defaultProducts[activeUserId()];
                const productName =
                  profile()?.product !== undefined ? profile().product : defaultProd?.product;
                const productQty =
                  profile()?.quantity !== undefined ? profile().quantity : defaultProd?.quantity;
                const productPrice =
                  profile()?.price !== undefined ? profile().price : defaultProd?.price;

                const cleanId = activeUserId()?.replace(/^user_?/, "");
                const isSwarmAgent = displayRole() === "agent" || (cleanId ? serverAgentEmployees[cleanId] !== undefined : false);
                const employees = isSwarmAgent ? serverAgentEmployees[cleanId] ?? 5 : 0;

                let agentS = 0;
                let agentEgo = 1;
                if ((skillLevel || 5) <= 4 && (productPrice || 0) >= 1000000) {
                  agentS = 4;
                  agentEgo = 1.5;
                } else if ((skillLevel || 5) >= 9 && (productPrice || 0) > 0 && (productPrice || 0) < 20000) {
                  agentS = 2;
                  agentEgo = 1.2;
                }
                const personalWinVal = ((skillLevel || 5) * employees) / (1 + agentS * agentEgo);
                const personalWin = formatNumber(personalWinVal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                const tp = 1 + ((skillLevel || 5) >= 8 ? 0.5 : 0);
                const sys = 1 + employees / 10;
                const personalRVal = 10 * Math.pow(tp, sys);
                const personalR = formatNumber(personalRVal, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

                const invValue = (productPrice || 0) * (productQty || 0);
                const cashRatio = Math.round((budget / (budget + invValue)) * 100);

                const T = Math.min(10, Math.max(1, skillLevel || 5));
                const isLeader = activeUserId() === "toLuong";
                const C =
                  isLeader ? 10 : Math.min(10, Math.max(2, Math.floor(employees / 2)));
                const H = Math.min(10, Math.max(2, 5 + Math.floor((productQty || 0) / 1000)));
                const K = 1 + (skillLevel || 5) / 10;
                const S_fear =
                  budget < 0 ? 1 : Math.max(1, 10 - (skillLevel || 5));
                const vkRaw = ((T + C) * Math.pow(H, K)) / S_fear;
                const vkPercent = Math.min(150, Math.round(vkRaw));

                return <>
                  <div class="space-y-4">
                    {}
                    {(() => {
                      const btcQty = (stocks.BTC !== undefined ? Number(stocks.BTC) : 0) / 10000;
                      let totalStockQty = 0;
                      Object.entries(stocks).forEach(([symbol, qty]) => {
                        if (symbol !== "BTC") {
                          totalStockQty += Number(qty);
                        }
                      });

                      return <div
                        class={`p-6 rounded-3xl border shadow-lg flex flex-col md:flex-row gap-6 items-center justify-between transition-all ${
                          theme() === "dark"
                            ? "bg-purple-950/20 border-purple-500/20 shadow-purple-950/10 text-white"
                            : "bg-gradient-to-r from-purple-50 via-white to-blue-50 border-purple-100 text-gray-800"
                        }`}>
                        <div class="flex flex-row flex-wrap gap-x-12 gap-y-6 w-full md:w-auto">
                          {budget !== 0 &&
                            <div class="space-y-1 text-left">
                              <span class="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                                {t("💵 Ngân sách thương mại")}
                              </span>
                              <div class="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {t(`{amount} ${currencySymbol()}`).replace("{amount}", formatCurrency(budget))}
                              </div>
                            </div>}
                          {gold !== undefined && gold !== 0 &&
                            <div class="space-y-1 text-left">
                              <span class="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-wider block">
                                {t("🪙 Dự trữ vàng")}
                              </span>
                              <div class="text-xl sm:text-2xl font-black text-yellow-600 dark:text-yellow-500 whitespace-nowrap">
                                {t("{amount} lượng").replace(
                                  "{amount}",
                                  formatNumber(gold, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                )}
                              </div>
                            </div>}
                          {btcQty > 0 &&
                            <div class="space-y-1 text-left">
                              <span class="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                                {t("₿ Bitcoin")}
                              </span>
                              <div class="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-500 whitespace-nowrap">
                                {t("{qty} BTC").replace("{qty}", formatNumber(btcQty, { maximumFractionDigits: 4 }))}
                              </div>
                            </div>}
                          {totalStockQty > 0 &&
                            <div class="space-y-1 text-left">
                              <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                                {t("📈 Chứng khoán")}
                              </span>
                              <div class="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-500 whitespace-nowrap">
                                {t("{qty} cổ").replace("{qty}", formatNumber(totalStockQty))}
                              </div>
                            </div>}
                        </div>
                        {skillTitle &&
                          <div class="space-y-1 text-center md:text-right">
                            <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
                              {t("Cấp Độ Đàm Phán")}
                            </span>
                            <div
                              class="text-lg font-bold"
                              style={skillColor.startsWith("text-") ? {} : { color: skillColor }}
                              classList={{
                                "font-extrabold animate-pulse": skillLevel >= 13 || activeUserId()?.replace(/^user_?/, "") === "daoTieuCuu",
                                [skillColor]: skillColor.startsWith("text-"),
                              }}>
                              {t(skillTitle)}
                            </div>
                          </div>}
                      </div>;
                    })()}
                  </div>
                  <div
                    class={`mt-8 p-8 rounded-3xl shadow-lg border transition-colors ${
                      theme() === "dark"
                        ? "bg-[#1e1e1e]/80 backdrop-blur-xl border-white/10"
                        : "bg-white/80 backdrop-blur-md border-white/20"
                    }`}>
                    <h3
                      class={`text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${
                        theme() === "dark" ? "text-gray-300" : "text-gray-800"
                      }`}>
                      <div class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      {t("NHẬT KÝ")}
                      <button
                        type="button"
                        onClick={() => setShowJournalForm(true)}
                        class="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                        title={t("Tạo nhật ký mới (Giao cho AI viết)")}>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </h3>
                    <div class="flex flex-col gap-6">
                      <Show when={isAgent()}>
                        <div class="pt-4">
                          <span class="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-4">
                            {t("BỘ CÔNG CỤ SIÊU CÔNG THỨC")}
                          </span>
                          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {}
                            <div
                              class={`p-4 rounded-2xl border flex flex-col justify-between ${
                                theme() === "dark" ? "bg-purple-950/25 border-purple-500/25" : "bg-purple-50/50 border-purple-100"
                              }`}>
                              <div>
                                <span class="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                                  {t("1. CHỐNG TỰ HỦY")}
                                </span>
                                <span class="text-[10px] text-gray-400 font-medium block mt-0.5">
                                  {"Win = (V * E) / (1 + S * Ego)"}
                                </span>
                              </div>
                              <div class="mt-3 flex items-baseline gap-2">
                                <span class="text-2xl font-black text-purple-700 dark:text-purple-400">{personalWin}</span>
                                <span class="text-[10px] text-gray-400">
                                  {t("Win (Cá nhân)")}
                                </span>
                              </div>
                              <div
                                class="mt-2 text-[10px] text-gray-400 border-t border-purple-500/10 pt-2 leading-relaxed whitespace-pre-line">
                                {`${t("Tầm nhìn (V)")}: ${skillLevel || 5}/10\n${t("Công sức (E)")}: ${employees}\n${t(
                                  "Hệ số tự hủy: S =",
                                )} ${agentS} (${t("Ego =")} ${formatNumber(agentEgo, {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })})`}
                              </div>
                            </div>
                            {}
                            <div
                              class={`p-4 rounded-2xl border flex flex-col justify-between ${
                                theme() === "dark" ? "bg-emerald-950/25 border-emerald-50/25" : "bg-emerald-50/50 border-emerald-100"
                              }`}>
                              <div>
                                <span class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                  {t("2. ĐÒN BẨY BÙNG NỔ")}
                                </span>
                                <span class="text-[10px] text-gray-400 font-medium block mt-0.5">
                                  {"R = I_core * (Tool + Prompt)^System"}
                                </span>
                              </div>
                              <div class="mt-3 flex items-baseline gap-2">
                                <span class="text-2xl font-black text-emerald-700 dark:text-emerald-400">{personalR}</span>
                                <span class="text-[10px] text-gray-400">
                                  {t("R (Cá nhân)")}
                                </span>
                              </div>
                              <div
                                class="mt-2 text-[10px] text-gray-400 border-t border-emerald-500/10 pt-2 leading-relaxed whitespace-pre-line">
                                {`${t("Đòn bẩy:")} Tool+Prompt = x${formatNumber(tp, {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })}\n${t("Quy mô System:")} ^${formatNumber(sys, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`}
                              </div>
                            </div>
                            {}
                            <div
                              class={`p-4 rounded-2xl border flex flex-col justify-between ${
                                theme() === "dark" ? "bg-orange-950/25 border-orange-500/25" : "bg-orange-50/50 border-orange-100"
                              }`}>
                              <div>
                                <span class="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                                  {t("3. TỐI GIẢN TÀN NHẪN")}
                                </span>
                                <span class="text-[10px] text-gray-400 font-medium block mt-0.5">
                                  {"CASH = Cash / Total Assets"}
                                </span>
                              </div>
                              <div class="mt-3 flex items-baseline gap-2">
                                <span class="text-2xl font-black text-orange-700 dark:text-orange-400">
                                  {cashRatio}
                                  %
                                </span>
                                <span class="text-[10px] text-gray-400">
                                  {t("Tỷ lệ dòng tiền")}
                                </span>
                              </div>
                              <div
                                class="mt-2 text-[10px] text-gray-400 border-t border-orange-500/10 pt-2 leading-relaxed whitespace-pre-line">
                                {`${t("Dòng tiền nhàn rỗi:")} ${formatCurrency(budget)} ${currencySymbol()}\n${t(
                                  "Tổng tài sản:",
                                )} ${formatCurrency(budget + invValue)} ${currencySymbol()}`}
                              </div>
                            </div>
                            {}
                            <div
                              class={`p-4 rounded-2xl border flex flex-col justify-between ${
                                theme() === "dark" ? "bg-red-950/25 border-red-500/25" : "bg-red-50/50 border-red-100"
                              }`}>
                              <div>
                                <span class="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider block">
                                  {t("4. CHỈ SỐ VƯỢT KHÓ (AQ)")}
                                </span>
                                <span class="text-[10px] text-gray-400 font-medium block mt-0.5">
                                  {"VK = ((T + C) * H^K) / S"}
                                </span>
                              </div>
                              <div class="mt-3 flex items-baseline gap-2">
                                <span class="text-2xl font-black text-red-700 dark:text-red-400">
                                  {vkPercent}
                                  %
                                </span>
                                <span class="text-[10px] text-gray-400">
                                  {t("Chỉ số AQ")}
                                </span>
                              </div>
                              <div
                                class="mt-2 text-[10px] text-gray-400 border-t border-red-500/10 pt-2 leading-relaxed whitespace-pre-line">
                                {`${t("Tâm thế (T)")}: ${T}/10\n${t("Chiến lược (C)")}: ${C}/10\n${t("Hành động (H)")}: ${H}/10\n${t(
                                  "Kỷ luật (K)",
                                )}: ^${formatNumber(K, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n${t(
                                  "Sợ hãi (S)",
                                )}: ${S_fear}/10`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Show>
                      <div class="pt-4 border-t border-gray-500/20">
                        <div class="flex flex-col gap-6 max-h-[800px] overflow-y-auto pr-4 scrollbar-thin">
                          {(() => {
                            const depthObj = (() => {
                              if (skillLevel >= 12) return {
                                text: t("Rất Sâu"),
                                desc: t("Tự sửa cách làm khi có vấn đề mới (Đào + lấp + xây lại để giỏi thật)"),
                                val: t("Cấp 4"),
                                percent: 95,
                                color: "text-rose-500 dark:text-rose-400",
                                bg: "bg-rose-500/10 border-rose-500/20",
                              };
                              if (skillLevel >= 8) return {
                                text: t("Sâu"),
                                desc: t("Hiểu bản chất và lý do vì sao hệ thống hoạt động"),
                                val: t("Cấp 3"),
                                percent: 75,
                                color: "text-amber-500 dark:text-amber-400",
                                bg: "bg-amber-500/10 border-amber-500/20",
                              };
                              if (skillLevel >= 4) return {
                                text: t("Trung bình"),
                                desc: t("Hiểu quy trình và cách làm việc (Kỹ xảo)"),
                                val: t("Cấp 2"),
                                percent: 50,
                                color: "text-blue-500 dark:text-blue-400",
                                bg: "bg-blue-500/10 border-blue-500/20",
                              };
                              return {
                                text: t("Nông"),
                                desc: t("Làm theo hướng dẫn / thủ thuật nhỏ (Mẹo)"),
                                val: t("Cấp 1"),
                                percent: 25,
                                color: "text-gray-400 dark:text-gray-500",
                                bg: "bg-gray-500/10 border-gray-500/10",
                              };
                            })();

                            const breadthObj = (() => {
                              if (skillLevel >= 9) return {
                                text: "Rộng",
                                desc: "Am hiểu sâu sắc nhiều mảng thị trường khác nhau",
                                val: "Nhiều mảng",
                                percent: 75,
                                color: "text-amber-500 dark:text-amber-400",
                                bg: "bg-amber-500/10 border-amber-500/20",
                              };
                              if (skillLevel >= 5) return {
                                text: t("Trung bình"),
                                desc: t("Biết 2-3 mảng liên quan mật thiết"),
                                val: t("Vài mảng"),
                                percent: 50,
                                color: "text-blue-500 dark:text-blue-400",
                                bg: "bg-blue-500/10 border-blue-500/20",
                              };
                              return {
                                text: t("Hẹp"),
                                desc: t("Tập trung chuyên biệt vào duy nhất 1 mảng"),
                                val: t("1 mảng"),
                                percent: 25,
                                color: "text-gray-400 dark:text-gray-500",
                                bg: "bg-gray-500/10 border-gray-500/10",
                              };
                            })();

                            const flexObj = (() => {
                              if (skillLevel >= 13) return {
                                text: t("Tự tạo chế độ mới"),
                                desc: t("Đột phá cách làm, tự tạo ra cơ chế tối ưu mới"),
                                val: t("Cấp 5"),
                                percent: 95,
                                color: "text-rose-500 dark:text-rose-400",
                                bg: "bg-rose-500/10 border-rose-500/20",
                              };
                              if (skillLevel >= 10) return {
                                text: t("Xoay Mạnh (Thích nghi cao)"),
                                desc: t("Kết hợp linh hoạt nhiều chế độ đàm phán tự do"),
                                val: t("Cấp 4"),
                                percent: 80,
                                color: "text-amber-500 dark:text-amber-400",
                                bg: "bg-amber-500/10 border-amber-500/20",
                              };
                              if (skillLevel >= 7) return {
                                text: t("Xoay Linh Hoạt"),
                                desc: t("Thay đổi chế độ đàm phán theo ngữ cảnh"),
                                val: t("Cấp 3"),
                                percent: 60,
                                color: "text-blue-500 dark:text-blue-400",
                                bg: "bg-blue-500/10 border-blue-500/20",
                              };
                              if (skillLevel >= 4) return {
                                text: t("Xoay Ít"),
                                desc: t("Cố định chế độ, đổi nhẹ mới thích ứng được"),
                                val: t("Cấp 2"),
                                percent: 40,
                                color: "text-yellow-600 dark:text-yellow-500",
                                bg: "bg-yellow-600/10 border-yellow-600/20",
                              };
                              return {
                                text: t("Không Xoay / Cứng nhắc"),
                                desc: t("Cách làm cố định, đổi cách là bị kẹt ngay"),
                                val: t("Cấp 1"),
                                percent: 20,
                                color: "text-gray-400 dark:text-gray-500",
                                bg: "bg-gray-500/10 border-gray-500/10",
                              };
                            })();

                            const archetypeObj = (() => {
                              if (skillLevel >= 12) {
                                return {
                                  title: t("Người cấp cao (T-shaped / Hệ thống)"),
                                  desc: t("Vừa cực giỏi chuyên môn sâu, vừa thích nghi tốt và am hiểu đa ngành."),
                                  rules: [t("Muốn giỏi: SÂU phải cao"), t("Muốn cơ hội: RỘNG vừa đủ"), t("Muốn sống tốt: XOAY phải cao")],
                                  color: "from-rose-500 via-amber-500 to-emerald-500",
                                  badge: t("T-Shaped Leader"),
                                  icon: "🧭",
                                };
                              }
                              if (skillLevel >= 8) {
                                return {
                                  title: t("Người đa năng (Generalist)"),
                                  desc: t("Linh hoạt tốt, biết nhiều mảng, có khả năng xử lý bài toán đa dạng."),
                                  rules: [t("Muốn cơ hội: RỘNG vừa đủ"), t("Muốn sống tốt: XOAY phải cao")],
                                  color: "from-amber-500 via-yellow-500 to-blue-500",
                                  badge: t("Generalist"),
                                  icon: "🌐",
                                };
                              }
                              if (skillLevel >= 4) {
                                return {
                                  title: t("Thợ kỹ thuật (Specialist)"),
                                  desc: t("Rất giỏi 1 nghề chuyên biệt, nhưng khó đổi việc hoặc thích nghi khi bài toán thay đổi."),
                                  rules: [t("Muốn giỏi: SÂU phải cao"), t("Cần nâng cấp thêm Độ rộng & Độ xoay")],
                                  color: "from-blue-500 via-cyan-500 to-indigo-500",
                                  badge: t("Specialist"),
                                  icon: "🔧",
                                };
                              }
                              return {
                                title: t("Giai đoạn nền tảng (Novice)"),
                                desc: t("Biết ít, dễ kẹt khi gặp vấn đề mới. Cần tích lũy thêm cả 3 chỉ số."),
                                rules: [t("Tập trung học hỏi kỹ năng nền"), t("Làm theo hướng dẫn & quy trình chuẩn")],
                                color: "from-gray-500 to-slate-500",
                                badge: t("Novice"),
                                icon: "🌱",
                              };
                            })();

                            return <div class="mt-2">
                              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {}
                                <div class="lg:col-span-2 space-y-4">
                                  {}
                                  <div
                                    class={`p-4 rounded-2xl border ${
                                      theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                                    }`}>
                                    <div class="flex justify-between items-center mb-1">
                                      <span class="text-xs font-bold flex items-center gap-1.5">
                                        <span>
                                          {"🧭"}
                                        </span>
                                        {t("Độ sâu (Depth) - Quy mô bản đồ")}
                                      </span>
                                      <span class={`text-xs font-black uppercase ${depthObj.color}`}>
                                        {depthObj.text}
                                        (
                                        {depthObj.val}
                                        )
                                      </span>
                                    </div>
                                    <p class="text-[10px] text-gray-400 mb-2">
                                      {depthObj.desc}
                                    </p>
                                    <div class="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        class={`h-full rounded-full transition-all duration-1000 ${
                                          skillLevel >= 12
                                            ? "bg-rose-500"
                                            : skillLevel >= 8
                                              ? "bg-amber-500"
                                              : "bg-blue-500"
                                        }`}
                                        style={{ width: `${depthObj.percent}%` }}
                                      />
                                    </div>
                                  </div>
                                  {}
                                  <div
                                    class={`p-4 rounded-2xl border ${
                                      theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                                    }`}>
                                    <div class="flex justify-between items-center mb-1">
                                      <span class="text-xs font-bold flex items-center gap-1.5">
                                        <span>
                                          {"🌐"}
                                        </span>
                                        {t("Độ rộng (Breadth) - Phạm vi tri thức")}
                                      </span>
                                      <span class={`text-xs font-black uppercase ${breadthObj.color}`}>
                                        {breadthObj.text}
                                        (
                                        {breadthObj.val}
                                        )
                                      </span>
                                    </div>
                                    <p class="text-[10px] text-gray-400 mb-2">
                                      {breadthObj.desc}
                                    </p>
                                    <div class="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        class={`h-full rounded-full transition-all duration-1000 ${
                                          skillLevel >= 13
                                            ? "bg-rose-500"
                                            : skillLevel >= 9
                                              ? "bg-amber-500"
                                              : "bg-blue-500"
                                        }`}
                                        style={{ width: `${breadthObj.percent}%` }}
                                      />
                                    </div>
                                  </div>
                                  {}
                                  <div
                                    class={`p-4 rounded-2xl border ${
                                      theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                                    }`}>
                                    <div class="flex justify-between items-center mb-1">
                                      <span class="text-xs font-bold flex items-center gap-1.5">
                                        <span>
                                          {"🔄"}
                                        </span>
                                        {t("Độ xoay (Flexibility) - Khả năng thích nghi")}
                                      </span>
                                      <span class={`text-xs font-black uppercase ${flexObj.color}`}>
                                        {flexObj.text}
                                        (
                                        {flexObj.val}
                                        )
                                      </span>
                                    </div>
                                    <p class="text-[10px] text-gray-400 mb-2">
                                      {flexObj.desc}
                                    </p>
                                    <div class="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        class={`h-full rounded-full transition-all duration-1000 ${
                                          skillLevel >= 13
                                            ? "bg-rose-500"
                                            : skillLevel >= 10
                                              ? "bg-amber-500"
                                              : "bg-blue-500"
                                        }`}
                                        style={{ width: `${flexObj.percent}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                {}
                                <div
                                  class={`p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${
                                    theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-100"
                                  }`}>
                                  <div
                                    class={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${archetypeObj.color} opacity-5 blur-2xl rounded-full`}
                                  />
                                  <div>
                                    <div class="flex items-center justify-between mb-3">
                                      <span
                                        class={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-400`}>
                                        {archetypeObj.badge}
                                      </span>
                                      <span class="text-lg">
                                        {archetypeObj.icon}
                                      </span>
                                    </div>
                                    <h4
                                      class={`text-base font-extrabold bg-gradient-to-r ${archetypeObj.color} bg-clip-text text-transparent mb-2`}>
                                      {archetypeObj.title}
                                    </h4>
                                    <p class="text-xs text-gray-400 leading-relaxed mb-4">
                                      {archetypeObj.desc}
                                    </p>
                                  </div>
                                  <div class="border-t border-gray-200/10 pt-3 mt-3 space-y-1">
                                    <span class="text-[9px] font-black uppercase tracking-widest text-sky-500 block mb-1">
                                      {t("NGUYÊN TẮC PHÁT TRIỂN:")}
                                    </span>
                                    {archetypeObj.rules.map(
                                      (rule) => <div class="text-[10px] font-medium text-gray-300 flex items-center gap-1.5">
                                        <span class="text-amber-500 font-bold">
                                          {"👉"}
                                        </span>
                                        {rule}
                                      </div>,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>;
                          })()}
                          {(profile()?.journal || []).slice().reverse().map((entry: any) => {
                            const typeColor =
                              entry.type === "strategy"
                                ? "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20"
                                : entry.type === "prediction"
                                  ? "bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20"
                                  : entry.type === "calculation"
                                    ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20"
                                    : entry.type === "outdated"
                                      ? "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20 border-dashed line-through"
                                      : "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20";
                            return <div
                              class={`p-6 rounded-2xl border flex flex-col gap-3 transition-all ${
                                entry.type === "outdated"
                                  ? "bg-black/10 border-white/5 opacity-60"
                                  : theme() === "dark"
                                    ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                    : "bg-gray-50 border-gray-100 hover:bg-gray-100/75 hover:border-gray-200"
                              }`}>
                              <div class="flex items-center justify-between border-b pb-3 border-opacity-10 border-current">
                                <span class={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${typeColor}`}>
                                  {entry.type === "strategy"
                                    ? t("Chiến lược 🎯")
                                    : entry.type === "prediction"
                                      ? t("Dự đoán 🔮")
                                      : entry.type === "calculation"
                                        ? t("Tính toán 📊")
                                        : t("Lỗi thời ⏳")}
                                </span>
                                <span class="text-[11px] text-gray-400 font-mono font-medium">
                                  {entry.timestamp}
                                </span>
                              </div>
                              <h4
                                class={`text-base font-bold tracking-tight ${
                                  entry.type === "outdated"
                                    ? "text-gray-500 line-through"
                                    : theme() === "dark"
                                      ? "text-white"
                                      : "text-gray-800"
                                }`}>
                                {entry.title}
                              </h4>
                              <div
                                class={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                                  entry.type === "outdated"
                                    ? "text-gray-500 italic"
                                    : theme() === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-600"
                                }`}>
                                {entry.content}
                              </div>
                            </div>;
                          })}
                        </div>
                      </div>
                      {productName && productName !== t("Đang cập nhật...") &&
                        <div class="pt-4 border-t border-gray-500/20">
                          <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-3">
                            {t("SẢN PHẨM GIAO THƯƠNG")}
                          </span>
                          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class={`p-3 rounded-2xl ${theme() === "dark" ? "bg-white/5" : "bg-gray-50"}`}>
                              <span class="text-[10px] text-gray-400 block mb-1">
                                {t("Tên sản phẩm")}
                              </span>
                              <span class="font-bold text-sm truncate block">
                                {t(productName).replace(/\s*\[CA DAO TỤC NGỮ\]/gi, "")}
                              </span>
                            </div>
                            <div class={`p-3 rounded-2xl ${theme() === "dark" ? "bg-white/5" : "bg-gray-50"}`}>
                              <span class="text-[10px] text-gray-400 block mb-1">
                                {t("Đơn giá niêm yết")}
                              </span>
                              <span class="font-extrabold text-sm text-amber-500">
                                {t(`{price} ${currencySymbol()}`).replace("{price}", formatCurrency(productPrice))}
                              </span>
                            </div>
                            <div class={`p-3 rounded-2xl ${theme() === "dark" ? "bg-white/5" : "bg-gray-50"}`}>
                              <span class="text-[10px] text-gray-400 block mb-1">
                                {t("Kho hàng còn lại")}
                              </span>
                              <span class="font-extrabold text-sm text-purple-500">
                                {t("{count} đơn vị").replace("{count}", formatNumber(productQty))}
                              </span>
                            </div>
                          </div>
                        </div>}
                    </div>
                  </div>
                  <section id="profile-info-grid" class="grid md:grid-cols-2 gap-6">
                    {fields().map(
                      (f: any) => <>
                        <div
                          class="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 hover:shadow-md transition-shadow">
                          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                            {t(f.label)}
                          </label>
                          <p class="text-lg font-semibold text-gray-700">
                            {profile()?.[f.key]
                              ? <span>
                                  {profile()?.[f.key]}
                                </span>
                              : <span class="text-gray-300 italic font-normal">
                                  {t(f.empty)}
                                </span>}
                          </p>
                        </div>
                      </>,
                    )}
                  </section>
                  <div class="pt-4 border-t border-gray-500/20">
                    <h3
                      class={`text-sm font-black uppercase tracking-wider mb-1 flex items-center gap-2 ${
                        theme() === "dark" ? "text-gray-300" : "text-gray-800"
                      }`}>
                      <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      {t("Hoạt động tài khoản")}
                    </h3>
                    <p class="text-[10px] text-gray-400 font-medium mb-6">
                      {t("Số lượt tương tác, cập nhật sản phẩm và giao dịch trong 7 ngày gần nhất")}
                    </p>
                    <div class="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-10 pb-2 px-2 relative">
                      {}
                      <div
                        class={`absolute inset-0 flex flex-col justify-between pointer-events-none py-8 ${
                          theme() === "dark" ? "opacity-10" : "opacity-20"
                        }`}>
                        <div class="w-full border-b border-dashed border-gray-500" />
                        <div class="w-full border-b border-dashed border-gray-500" />
                        <div class="w-full border-b border-dashed border-gray-500" />
                        <div class="w-full border-b border-solid border-gray-500" />
                      </div>
                      {chartData().map(
                        (item: any) => <div class="flex flex-col items-center justify-end h-full flex-1 gap-4 group relative z-10">
                          <div
                            class={`w-full relative flex justify-center items-end h-full rounded-2xl overflow-visible transition-colors ${
                              theme() === "dark" ? "bg-white/5 group-hover:bg-white/10" : "bg-blue-50/30 group-hover:bg-blue-50/60"
                            }`}>
                            {}
                            <div
                              class="w-full rounded-2xl transition-all duration-700 ease-out group-hover:scale-x-110 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-400 group-hover:from-blue-500 group-hover:to-cyan-300"
                              style={{ height: `${(item.value / maxChartValue()) * 100}%` }}>
                              {}
                              <div class="w-full h-full bg-gradient-to-b from-white/30 to-transparent rounded-2xl" />
                            </div>
                            {}
                            <span
                              class={`absolute top-0 -translate-y-full opacity-0 group-hover:opacity-100 group-hover:-translate-y-4 transition-all duration-300 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl z-20 whitespace-nowrap ${
                                theme() === "dark"
                                  ? "bg-gray-800 text-cyan-400 border border-gray-700"
                                  : "bg-gray-900 text-white border border-gray-800"
                              }`}>
                              {t("{count} lượt").replace("{count}", formatNumber(item.value))}
                              {}
                              <div
                                class={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                                  theme() === "dark" ? "bg-gray-800 border-r border-b border-gray-700" : "bg-gray-900"
                                }`}
                              />
                            </span>
                          </div>
                          <span
                            class={`text-xs font-bold uppercase tracking-widest transition-colors ${
                              theme() === "dark" ? "text-gray-400 group-hover:text-cyan-400" : "text-gray-400 group-hover:text-blue-600"
                            }`}>
                            {t(item.label)}
                          </span>
                        </div>,
                      )}
                    </div>
                  </div>
                </>;
              }
              return null;
            })()}
          </Show>
        </div>
        {showForm() &&
          <Form
            id="modal-edit-profile"
            title={t("Chỉnh sửa hồ sơ")}
            role={role()}
            fields={formFields()}
            initialData={profile()}
            showMedia={true}
            mediaType="image"
            mediaKey="avatar"
            onClose={() => setShowForm(false)}
            onSubmit={handleFormSubmit}
          />}
        {showJournalForm() &&
          <Form
            id="modal-add-journal"
            title={t("Mớm Sự Kiện Cho Nhật Ký")}
            role={role()}
            fields={journalFormFields()}
            showMedia={false}
            onClose={() => setShowJournalForm(false)}
            onSubmit={handleJournalSubmit}
          />}
      </Show>
    </Show>
  </>;
};
