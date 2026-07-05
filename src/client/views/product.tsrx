import { createSignal, createResource, onCleanup, onMount, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { Icon } from "solid-heroicons";
import {
  plusCircle,
  cube,
  user,
  pencilSquare,
  trash,
  play,
  documentText,
  chevronLeft,
  chevronRight,
  film,
  photo,
  exclamationTriangle,
  sparkles,
  xCircle,
  checkBadge,
  shieldCheck,
} from "solid-heroicons/outline";
import { magnifyingGlass } from "solid-heroicons/solid";
import { Form } from "./form.tsrx";
import { LedgerDashboard } from "./dashboard/ledger.tsrx";
import { UserAvatar } from "~/client/components/user-avatar.tsrx";

import { authClient } from "~/client/utils/auth-client";
import { theme } from "~/client/stores/theme-store";
import { t, currentLang, formatCurrency, currencySymbol } from "~/client/stores/i18n-store";

// Menus are defined inside the component to have access to navigate

const formatVN = (n: any) => n?.toLocaleString?.("vi-VN") ?? 0;

const fetchProducts = async (sourceUrl: string) => {
  if (isServer) return [];
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return data.product || data.products || [];
  } catch (err) {
    console.error(err);
    return [];
  }
};
component MediaCell(props: { p: any }) {
  const [idx, setIdx] = createSignal(0);
  const items = () => {
    let list: any[] = [];
    if (props.p?.media && Array.isArray(props.p.media)) {
      // Ưu tiên hiển thị video lên đầu
      const videos = props.p.media.filter((m: any) => m.type === "video");
      const images = props.p.media.filter((m: any) => m.type !== "video");

      videos.forEach((m: any) => list.push({ type: "video", src: m.link || m.src }));
      images.forEach((m: any) => list.push({ type: "image", src: m.link || m.src }));
    }

    if (list.length === 0) {
      list.push({
        type: "image",
        src: props.p?.imageUrl || props.p?.img?.link || "/no-image.avif",
      });
    }

    if (props.p?.videoUrl && !list.some((i) => i.type === "video")) {
      list.unshift({ type: "video", src: props.p.videoUrl });
    }
    return list;
  };

  const isVideo = () => items()[idx()]?.type === "video";

  <td class="px-8 py-4">
    <div class="w-16 h-16 rounded-2xl border border-gray-100 overflow-hidden shadow-sm relative group/media">
      if (isVideo()) {
        <>
          <video
            src={items()[idx()]!.src}
            class="w-full h-full object-cover"
            onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
            onMouseOut={(e) => {
              (e.target as HTMLVideoElement).pause();
              (e.target as HTMLVideoElement).currentTime = 0;
            }}
            onPlay={(e) => (e.target as HTMLVideoElement).nextElementSibling?.classList.add("hidden")}
            onPause={(e) => (e.target as HTMLVideoElement).nextElementSibling?.classList.remove("hidden")}
            muted
            loop
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <Icon path={play} class="w-6 h-6 text-white" />
          </div>
        </>
      } else {
        <img
          src={items()[idx()]?.src || "/no-image.avif"}
          class="w-full h-full object-cover"
          onError={(e) => {
            if (!e.currentTarget.src.includes("no-image.avif")) {
              e.currentTarget.src = "/no-image.avif";
            }
          }}
        />
      }

      if (items().length > 1) {
        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const len = items().length;
              if (len > 0) setIdx((prev) => (prev - 1 + len) % len);
            }}
            class="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm shadow-md cursor-pointer transition-transform active:scale-90">
            <Icon path={chevronLeft} class="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const len = items().length;
              if (len > 0) setIdx((prev) => (prev + 1) % len);
            }}
            class="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm shadow-md cursor-pointer transition-transform active:scale-90">
            <Icon path={chevronRight} class="w-4 h-4" />
          </button>
        </div>
      }
    </div>
  </td>
}

export component Product(props: any) {
  const navigate = useNavigate();
  const [search, setSearch] = createSignal("");
  const [showForm, setShowForm] = createSignal(false);
  const [localSelectedId, setLocalSelectedId] = createSignal(null);
  const [traceProductBatchId, setTraceProductBatchId] = createSignal<string | null>(null);
  const selectedId = () => props.selectedProducts && props.adminView
    ? (props.selectedProducts.length > 0 ? props.selectedProducts[0].id || props.selectedProducts[0]._id : null)
    : localSelectedId();
  const setSelectedId = (val: any) => {
    if (props.adminView && props.onToggleSelect) {
      const p = list().find((item: any) => (item.id || item._id) === val);
      if (p) props.onToggleSelect(p);
    } else {
      setLocalSelectedId(val);
    }
    // Reset thanh tiến trình video khi bấm sang sản phẩm khác
    setVideoProgress(0);
  };
  const [prefilledData, setPrefilledData] = createSignal(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = createSignal(false);
  const [isGeneratingImage, setIsGeneratingImage] = createSignal(false);
  const [videoProgress, setVideoProgress] = createSignal(0);
  const [videoLogs, setVideoLogs] = createSignal("");
  const [isLogWindowOpen, setIsLogWindowOpen] = createSignal(false);
  const [showWarningModal, setShowWarningModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [deleteQtyInput, setDeleteQtyInput] = createSignal("");
  const [deleteError, setDeleteError] = createSignal("");
  const [userProfile, setUserProfile] = createSignal<any>(null);

  const menus = [
    {
      title: t("Sản phẩm"),
      desc: t("Cá hộp, rau sạch, gạo ST25"),
      icon: cube,
      action: () => navigate("/product"),
    },
    {
      title: t("Tài khoản"),
      desc: t("Thông tin, bảo mật"),
      icon: user,
      action: () => navigate("/profile"),
    },
  ];

  const handleBotFill = (e: any) => {
    setPrefilledData(e.detail);
    setSelectedId(null);
    setShowForm(true);
  };

  onMount(() => {
    if (!isServer) {
      window.addEventListener("bot_fill_product_form", handleBotFill);
    }

    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (d.success) {
        setUserProfile(d.profile);
      }
    }).catch((err) => console.error("Error fetching profile:", err));
  });

  onCleanup(() => {
    if (!isServer) {
      window.removeEventListener("bot_fill_product_form", handleBotFill);
    }
  });

  const isProfileIncomplete = () => {
    const p = userProfile();
    if (!p) return false;
    return !p.address || !p.qrImage?.link;
  };

  const [products, { refetch }] = createResource(() => props.adminView ? "/api/product" : "/api/admin/product", fetchProducts);

  const list = () => products()?.filter?.((p: any) => {
    const name = p?.name || "";
    const matchesSearch = name.toLowerCase().includes(search().toLowerCase());
    if (props.adminView) {
      const isUpdating = name === "Đang cập nhật...";
      return matchesSearch && !isUpdating;
    }
    return matchesSearch;
  }) ?? [];

  const selectedProduct = () => list().find((p: any) => p.id === selectedId() || p._id === selectedId());

  const session = authClient.useSession();
  const role = () => (session()?.data?.user as any)?.role || "user";

  const productFields = [
    { name: "name", label: t("Tên hàng hóa"), type: "text", required: true },
    { name: "description", label: t("Mô tả chi tiết"), type: "textarea", required: true },
    { name: "price", label: t(`Giá hàng hóa (${currencySymbol()})`), type: "number", required: true, min: 0 },
    { name: "category", label: t("Loại hàng hóa"), type: "text", required: true },
    { name: "quantity", label: t("Số lượng"), type: "number", required: true, min: 0 },
    { name: "heavy", label: t("Trọng lượng"), type: "number", required: true, min: 0 },
    { name: "expired", label: t("Hạn sử dụng"), type: "date", required: true },
    { name: "lwh", label: t("Kích thước (Dài x Rộng x Cao)"), type: "lwh", required: false },
    { name: "coordinates", label: t("Tọa độ bản đồ (Lat, Lng)"), type: "coordinates", required: false },
    {
      name: "status",
      label: t("Trạng thái"),
      type: "select",
      options: [
        { label: t("Còn hàng"), value: "true" },
        { label: t("Hết hàng"), value: "false" },
      ],
    },
  ];

  const handleFormSubmit = async (data: any) => {
    const payload = {
      ...data,
      price: Number(data.price) || 0,
      quantity: Number(data.quantity) || 0,
      heavy: Number(data.heavy) || 0,
      expired: data.expired ? new Date(data.expired).toISOString() : null,
      lwh: data.lwh || null,
      coordinates: data.coordinates || null,
      status: data.status === "true" || data.status === true,
    };

    try {
      if (selectedId()) {
        const res = await fetch("/api/admin/product", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedId(), ...payload }),
        });
        if (res.ok) {
          alert(`${t("Đã cập nhật sản phẩm:")} ${data.name}`);
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || t("Không thể cập nhật sản phẩm"));
        }
      } else {
        const res = await fetch("/api/admin/product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert(`${t("Đã thêm sản phẩm mới:")} ${data.name}`);
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || t("Không thể thêm sản phẩm"));
        }
      }
      setShowForm(false);
      refetch();
    } catch (err: any) {
      throw err; // Ném lỗi ngược ra cho form.tsrx bắt để không bị tự đóng form
    }
  };

  const openDeleteModal = () => {
    if (!selectedId()) return alert(t("Vui lòng chọn sản phẩm để xóa"));
    setDeleteQtyInput("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const product = selectedProduct();
    const currentQty = product?.quantity ?? 0;

    let removeQty: any = deleteQtyInput().trim();
    if (removeQty === "") {
      removeQty = currentQty;
    } else {
      removeQty = parseInt(removeQty, 10);
      if (isNaN(removeQty) || removeQty <= 0) {
        setDeleteError(t("Số lượng nhập không hợp lệ."));
        return;
      }
      if (removeQty > currentQty) {
        setDeleteError(`${t("Số lượng xóa vượt quá tồn kho")} (${currentQty}).`);
        return;
      }
    }

    try {
      if (removeQty === currentQty) {
        // Delete completely
        await fetch(`/api/admin/product/${selectedId()}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: removeQty }),
        });
        alert(t("Đã xóa sản phẩm!"));
      } else {
        // Update quantity
        await fetch("/api/admin/product", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedId(), quantity: currentQty - removeQty }),
        });
        alert(`${t("Đã giảm")} ${removeQty} ${t("sản phẩm. Còn lại:")} ${currentQty - removeQty}`);
      }
      setShowDeleteModal(false);
      setSelectedId(null);
      refetch();
    } catch (err) {
      setDeleteError(t("Lỗi khi xóa sản phẩm"));
    }
  };

  const handleCreateImage = async () => {
    if (!selectedId()) return alert(t("Vui lòng chọn sản phẩm để tạo ảnh"));
    setIsGeneratingImage(true);
    try {
      const res = await fetch(`/api/admin/product/${selectedId()}/image`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(t("🎉 Đã tạo ảnh banner quảng cáo thành công!"));
        refetch(); // Tải lại bảng để xem ảnh mới
      } else {
        alert(data.message || t("Lỗi khi tạo ảnh."));
      }
    } catch (e) {
      alert(t("Lỗi kết nối khi gửi yêu cầu tạo ảnh."));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCreateVideo = async () => {
    if (!selectedId()) return alert(t("Vui lòng chọn sản phẩm để tạo video"));
    const product = selectedProduct();
    if (
      !confirm(
        `${t("Tạo video AI quảng cáo cho sản phẩm:")} ${product.name}?\n${t(
          "Quá trình kết xuất video chất lượng cao này có thể mất từ 1 đến 2 phút.",
        )}\n${t("Hệ thống sẽ hiển thị nhật ký tiến trình thời gian thực để bạn theo dõi.")}`,
      )
    ) return;

    setIsGeneratingVideo(true);
    setVideoProgress(0);
    setVideoLogs(t("Đang khởi tạo hệ thống kết xuất video...\nĐang chờ tiến trình bắt đầu..."));
    setIsLogWindowOpen(true);

    const pollInterval = setInterval(async () => {
      try {
        const logRes = await fetch(`/api/admin/product/${selectedId()}/video/logs`);
        if (logRes.ok) {
          const data = await logRes.json();
          const logs = data.logs || "";
          setVideoLogs(logs);

          // Trích xuất % tiến độ từ file log (Tìm số đứng trước dấu %)
          const match = logs.match(/(\d{1,3})%/g);
          if (match && match.length > 0) {
            const lastMatch = match[match.length - 1]; // Lấy % mới nhất
            setVideoProgress(parseInt(lastMatch.replace("%", "")));
          } else {
            // Fake progress mượt mà nếu hệ thống chưa in log %
            setVideoProgress((prev) => Math.min(prev + 5, 95));
          }

          if (logs.includes("=== KẾT XUẤT THÀNH CÔNG!")) {
            setVideoProgress(100);
            clearInterval(pollInterval);
            setIsGeneratingVideo(false);
            alert(t("🎉 Đã tạo video thành công! Bạn có thể xem trước trong bảng sản phẩm."));
            refetch(); // Tải lại danh sách để hiện video
          } else if (logs.includes("=== LỖI KẾT XUẤT:")) {
            clearInterval(pollInterval);
            setIsGeneratingVideo(false);
            alert(t("Lỗi khi kết xuất video. Vui lòng kiểm tra log để biết thêm chi tiết."));
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải log:", err);
      }
    }, 1500);

    try {
      const res = await fetch(`/api/admin/product/${selectedId()}/video`, {
        method: "POST",
      });

      if (!res.ok) {
        clearInterval(pollInterval);
        setIsGeneratingVideo(false);
        const err = await res.json().catch(() => ({}));
        alert(err.message || t("Lỗi khi bắt đầu tạo video."));
      }
    } catch (e) {
      clearInterval(pollInterval);
      setIsGeneratingVideo(false);
      alert(t("Lỗi kết nối khi gửi yêu cầu tạo video."));
    }
  };

  <div class="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
    <header class="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
      <div class="relative w-full sm:max-w-md">
        <Icon path={magnifyingGlass} class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Tìm kiếm sản phẩm..."
          class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400 font-medium"
          onInput={(e) => setSearch(e.target.value)}
        />
      </div>

      if (!props.adminView) {
        <div class="relative group self-end sm:self-center">
          <button class="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors shadow-sm">
            <Icon path={cube} class="w-6 h-6 text-gray-600" />
          </button>
          <div
            class="absolute right-0 top-full mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden translate-y-2 group-hover:translate-y-0">
            for (const m of menus) {
              <div class="flex items-center gap-4 px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer" onClick={m.action}>
                <div class="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Icon path={m.icon} class="w-4 h-4" />
                </div>
                <div>
                  <strong class="block text-sm text-gray-800">{m.title}</strong>
                  <p class="text-[10px] text-gray-400">{m.desc}</p>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </header>

    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
        <h2 class="text-xl font-bold text-gray-800 tracking-tight">{props.adminView ? "Tất cả sản phẩm" : "Sản phẩm của bạn"}</h2>
        <span class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          {list().length}
          {" sản phẩm"}
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <th rowspan="3" class="px-8 py-4">{"Đa phương tiện"}</th>
              <th rowspan="3" class="px-6 py-4">{"Tên sản phẩm"}</th>
              <th rowspan="3" class="px-6 py-4">{"Giá bán"}</th>
              <th rowspan="3" class="px-6 py-4">{"Loại"}</th>
              <th rowspan="3" class="px-6 py-4">{"Số lượng"}</th>
              <th rowspan="3" class="px-6 py-4">{"Trọng lượng"}</th>
              <th rowspan="3" class="px-6 py-4">{"Kích thước"}</th>
              <th rowspan="3" class="px-6 py-4">{"Tọa độ"}</th>
              <th class="px-6 py-4">{"Hạn sử dụng"}</th>
              if (props.adminView) {
                <th class="px-6 py-4">{"Người bán"}</th>
              }
              <th class="px-6 py-4">{"Trạng thái"}</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-50">
            if (list().length === 0) {
              <tr>
                <td colspan={props.adminView ? 12 : 11} class="px-8 py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div class="p-4 bg-gray-50 rounded-full">
                      <Icon path={cube} class="w-8 h-8 text-gray-300" />
                    </div>
                    <p class="text-gray-400 font-medium italic">
                      {products.loading ? "Đang tải dữ liệu..." : "Chưa có sản phẩm nào"}
                    </p>
                  </div>
                </td>
              </tr>
            }
            for (const p of list()) {
              const isSelected = () => props.adminView && props.selectedProducts
                ? props.selectedProducts.some((sp: any) => (sp.id || sp._id) === (p.id || p._id))
                : selectedId() === (p.id || p._id);
              <tr
                data-id={p.id || p._id}
                class={`group cursor-pointer transition-all ${
                  isSelected()
                    ? (props.adminView
                      ? "bg-blue-50/50 ring-1 ring-inset ring-blue-500/20"
                      : "bg-purple-50/50 ring-1 ring-inset ring-purple-500/20")
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedId(p.id || p._id)}>
                <MediaCell {p} />
                <td class="px-6 py-4">
                  <div class="max-w-[200px]">
                    <p class="text-sm font-bold text-gray-800 line-clamp-1 flex items-center gap-1.5">
                      {p?.name ?? "N/A"}
                      if (isSelected()) {
                        <Icon path={checkBadge} class={`w-4.5 h-4.5 shrink-0 ${props.adminView ? "text-blue-500" : "text-purple-500"}`} />
                      }
                    </p>
                    <p class="text-[10px] text-gray-400 line-clamp-2 mt-1">
                      {p?.description ?? ""}
                    </p>
                  </div>
                </td>
                <td class="px-6 py-4 font-bold text-gray-700 text-sm">
                  {formatCurrency(p?.price)}
                  {currencySymbol()}
                </td>
                <td class="px-6 py-4 text-xs font-medium text-gray-500 whitespace-nowrap">
                  {p?.category ?? ""}
                </td>
                <td class="px-6 py-4 font-semibold text-gray-600 text-sm">
                  {formatVN(p?.quantity)}
                </td>
                <td class="px-6 py-4 font-medium text-gray-600 text-sm">
                  {p?.heavy ? (p.heavy >= 1000 ? `${formatVN(p.heavy / 1000)} kg` : `${formatVN(p.heavy)} g`) : "N/A"}
                </td>
                <td class="px-6 py-4 font-medium text-gray-600 text-sm">
                  {p?.lwh ? `${p.lwh.length || 0}x${p.lwh.width || 0}x${p.lwh.height || 0}cm³` : "N/A"}
                </td>
                <td class="px-6 py-4 font-medium text-gray-600 text-sm">
                  {p?.coordinates ? `${p.coordinates.lat || 0}, ${p.coordinates.lng || 0}` : "N/A"}
                </td>
                <td class="px-6 py-4 font-medium text-gray-600 text-sm">
                  {p?.expired ? new Date(p.expired).toLocaleDateString("vi-VN") : "N/A"}
                </td>
                if (props.adminView) {
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <UserAvatar
                        name={p?.seller?.name || "Ẩn danh"}
                        image={p?.seller?.profile?.avatar?.link || p?.seller?.image}
                        class="w-8 h-8 text-xs border border-gray-100"
                      />
                      <div>
                        <p class="text-xs font-bold text-gray-800">
                          {p?.seller?.name || "Ẩn danh"}
                        </p>
                        <p class="text-[10px] text-gray-400">
                          {p?.seller?.profile?.phone || "Chưa có SĐT"}
                        </p>
                      </div>
                    </div>
                  </td>
                }
                <td class="px-6 py-4">
                  <span
                    class={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      p?.status ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                    }`}>
                    {p?.status ? "Còn hàng" : "Hết hàng"}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    {/* ======Actions====== */}
    if (!props.adminView) {
      <div
        class="flex justify-center sm:justify-end items-center gap-4 py-4 px-6 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl shadow-gray-200/50 sticky bottom-8 border border-gray-100 z-10 w-fit ml-auto">
        <button
          id="add-product-btn"
          onClick={() => {
            if (isProfileIncomplete()) {
              setShowWarningModal(true);
            } else {
              setPrefilledData(null);
              setSelectedId(null);
              setShowForm(true);
            }
          }}
          class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all shadow-lg shadow-blue-200">
          <Icon path={plusCircle} class="w-4 h-4" />
          {"Thêm mới"}
        </button>
        <button
          id="edit-product-btn"
          onClick={() => {
            if (!selectedId()) {
              alert("Vui lòng chọn sản phẩm để sửa");
            } else if (isProfileIncomplete()) {
              setShowWarningModal(true);
            } else {
              setShowForm(true);
            }
          }}
          class={`flex items-center gap-2 px-6 py-3 border rounded-2xl font-bold hover:-translate-y-1 active:translate-y-0 transition-all shadow-sm ${
            theme() === "dark"
              ? "bg-[#1e1e1e] border-gray-700 text-gray-300 hover:bg-gray-800"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}>
          <Icon path={pencilSquare} class="w-4 h-4" />
          {"Chỉnh sửa"}
        </button>
        <button
          disabled={isGeneratingImage()}
          onClick={() => {
            if (!selectedId()) {
              alert("Vui lòng chọn sản phẩm để tạo ảnh");
            } else if (isProfileIncomplete()) {
              setShowWarningModal(true);
            } else {
              handleCreateImage();
            }
          }}
          class={`flex items-center gap-2 px-6 py-3 border rounded-2xl font-bold transition-all shadow-sm ${
            isGeneratingImage()
              ? "cursor-wait bg-blue-100 text-blue-600 border-blue-200 animate-pulse"
              : theme() === "dark"
                ? "bg-[#1e1e1e] border-gray-700 text-gray-300 hover:bg-gray-800 hover:-translate-y-1"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:-translate-y-1"
          }`}>
          <Icon path={photo} class="w-4 h-4" />
          {isGeneratingImage() ? "Đang tạo..." : "Tạo ảnh"}
        </button>
        <button
          disabled={isGeneratingVideo()}
          onClick={() => selectedId() ? handleCreateVideo() : alert("Vui lòng chọn sản phẩm để tạo video")}
          class={`relative w-[230px] overflow-hidden flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
            isGeneratingVideo() || videoProgress() > 0
              ? "bg-purple-50 text-purple-700"
              : theme() === "dark"
                ? "bg-purple-900/40 text-purple-400 hover:bg-purple-900/60 border border-purple-900/50 hover:-translate-y-1 active:translate-y-0"
                : "bg-purple-50 text-purple-600 hover:bg-purple-100 hover:-translate-y-1 active:translate-y-0"
          }`}>
          <tsx>
            {(isGeneratingVideo() || videoProgress() > 0) &&
              <div class="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div
                  class="liquid-blob liquid-bg-1 opacity-70"
                  style={`animation: liquid-spin 3s infinite linear; animation-play-state: ${
                    videoProgress() === 100 ? "paused" : "running"
                  }; left: ${videoProgress() - 250}%; transition: left 1s linear;`}
                />
                <div
                  class="liquid-blob liquid-bg-2 opacity-70"
                  style={`animation: liquid-spin 4s infinite linear reverse; animation-play-state: ${
                    videoProgress() === 100 ? "paused" : "running"
                  }; left: ${videoProgress() - 250}%; transition: left 1s linear;`}
                />
              </div>}
          </tsx>
          <span class="relative z-10 flex items-center gap-2">
            <Icon path={film} class={`w-4 h-4 ${isGeneratingVideo() ? "animate-spin text-purple-600" : ""}`} />
            {videoProgress() === 100
              ? "Hoàn thành 100%"
              : isGeneratingVideo() || videoProgress() > 0
                ? `Đang tạo ${videoProgress()}%`
                : "Tạo video"}
          </span>
        </button>
        <button
          id="delete-product-btn"
          onClick={openDeleteModal}
          class={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold hover:-translate-y-1 active:translate-y-0 transition-all ${
            theme() === "dark"
              ? "bg-red-900/40 text-red-500 hover:bg-red-900/60 border border-red-900/50"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}>
          <Icon path={trash} class="w-4 h-4" />
          {"Xóa"}
        </button>
      </div>
    }

    if (showForm()) {
      <Form
        title={selectedId() ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}
        role={role()}
        fields={productFields}
        initialData={selectedProduct() || prefilledData()}
        showMedia={true}
        mediaKey="media"
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
      />
    }

    if (showDeleteModal()) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          class={`shadow-2xl rounded-3xl p-8 max-w-md w-full border text-center space-y-6 transform animate-in scale-in duration-300 ${
            theme() === "dark" ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-800"
          }`}>
          <div class="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center">
            <Icon path={trash} class="w-8 h-8" />
          </div>
          <div class="space-y-2">
            <h3 class="text-xl font-bold">{"Xác nhận xóa sản phẩm"}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {"Bạn đang thực hiện xóa sản phẩm "}
              <strong class="text-gray-700 dark:text-gray-200">{selectedProduct()?.name}</strong>
              {`. Tồn kho hiện tại: `}
              <span class="font-bold text-blue-600">{selectedProduct()?.quantity ?? 0}</span>
            </p>
          </div>

          <div class="space-y-2 text-left">
            <label class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">{"Số lượng muốn xóa"}</label>
            <input
              type="number"
              value={deleteQtyInput()}
              onInput={(e) => {
                setDeleteQtyInput((e.target as HTMLInputElement).value);
                setDeleteError("");
              }}
              placeholder={`Để trống để xóa tất cả (${selectedProduct()?.quantity ?? 0})`}
              class={`w-full px-5 py-3.5 border rounded-2xl outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all font-semibold ${
                theme() === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder-gray-600"
                  : "bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-300"
              }`}
            />
            if (deleteError()) {
              <p class="text-xs font-semibold text-red-500 px-1 animate-pulse">{deleteError()}</p>
            }
          </div>

          <div class="flex gap-3 pt-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              class={`flex-1 py-3.5 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                theme() === "dark" ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}>
              {"Hủy bỏ"}
            </button>
            <button
              onClick={confirmDelete}
              class="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm uppercase tracking-wider cursor-pointer">
              {"Xác nhận xóa"}
            </button>
          </div>
        </div>
      </div>
    }

    if (showWarningModal()) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center space-y-6 transform animate-in scale-in duration-300">
          <div class="mx-auto w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
            <Icon path={exclamationTriangle} class="w-8 h-8" />
          </div>
          <div class="space-y-2">
            <h3 class="text-xl font-bold text-gray-800">{"Cập nhật Hồ Sơ trước khi bán"}</h3>
            <p class="text-sm text-gray-500 leading-relaxed">
              {"Bạn cần bổ sung đầy đủ Địa chỉ và thông tin thanh toán VietQR / Ảnh QR trong Hồ Sơ của mình trước khi được phép đăng bán sản phẩm nhằm chống gian lận và bảo vệ người mua."}
            </p>
          </div>
          <div class="flex flex-col gap-3 pt-2">
            <a
              href="/profile"
              class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 active:translate-y-0 text-center">
              {"Đi đến trang Hồ Sơ cập nhật ngay"}
            </a>
            <button
              onClick={() => setShowWarningModal(false)}
              class="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-2xl transition-all">
              {"Đóng"}
            </button>
          </div>
        </div>
      </div>
    }

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

    if (isLogWindowOpen()) {
      <div
        class="fixed bottom-6 right-6 z-[250] w-full max-w-lg md:max-w-xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col font-mono text-xs text-gray-300">
        <div class="flex items-center justify-between px-5 py-4 bg-gray-950/80 border-b border-gray-800">
          <div class="flex items-center gap-2.5">
            <span class={`w-2.5 h-2.5 rounded-full ${isGeneratingVideo() ? "bg-amber-500 animate-ping" : "bg-green-500"}`} />
            <span class="font-bold text-gray-100 uppercase tracking-wider text-[10px]">
              {isGeneratingVideo() ? "Tiến trình kết xuất video AI..." : "Kết xuất video hoàn tất"}
            </span>
          </div>
          <div class="flex items-center gap-2">
            if (!isGeneratingVideo()) {
              <button
                onClick={() => setIsLogWindowOpen(false)}
                class="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-bold font-sans cursor-pointer transition-all active:scale-95">
                {"Đóng log"}
              </button>
            }
          </div>
        </div>

        <div
          ref={(el) => {
            if (el) {
              createEffect(() => {
                videoLogs();
                setTimeout(() => {
                  el.scrollTop = el.scrollHeight;
                }, 50);
              });
            }
          }}
          class="p-5 h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text bg-[#0b0f19] text-gray-300 border-t border-gray-800">
          {videoLogs()}
        </div>
      </div>
    }
  </div>
}
