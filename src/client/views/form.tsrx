import { createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "solid-heroicons";
import {
  xCircle,
  photo,
  videoCamera,
  trash,
  plusCircle,
  calendarDays,
  sparkles,
  check,
  chevronDown,
  chevronLeft,
  chevronRight,
} from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { enhanceImage } from "~/client/utils/image-enhancer";

export const Form = (props: any) => {
  const [loading, setLoading] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  // Weight unit & value signals for dynamic metric SI (g/kg) conversions
  const initialHeavy = props.initialData?.heavy || 0;
  const isInitialKg = initialHeavy >= 1000;
  const [weightUnit, setWeightUnit] = createSignal(isInitialKg ? "kg" : "g");
  const [weightValue, setWeightValue] = createSignal(isInitialKg ? initialHeavy / 1000 : initialHeavy || "");

  const handleUnitChange = (newUnit: string) => {
    const currentVal = Number(weightValue());
    if (isNaN(currentVal) || !currentVal) {
      setWeightUnit(newUnit);
      return;
    }
    // Hạn chế tính toán tự động, luôn giữ nguyên kết quả số đã nhập
    setWeightUnit(newUnit);
  };

  // Price unit & value signals for currency
  const initialPrice = props.initialData?.price || 0;
  const [priceUnit, setPriceUnit] = createSignal("₫");
  const [priceValue, setPriceValue] = createSignal(initialPrice || "");

  onMount(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("form_drawer_toggled", { detail: { isOpen: true } }));
    }
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("form_drawer_toggled", { detail: { isOpen: false } }));
    }
  });

  // Initialize media from props if available
  const initialMedia = () => {
    if (!props.initialData) return null;
    return props.initialData.avatar || (Array.isArray(props.initialData.media) ? props.initialData.media[0] : props.initialData.media);
  };

  // Support multiple media carousel lists
  const [allMedia, setAllMedia] = createSignal<any[]>(
    props.id !== "modal-edit-profile" && Array.isArray(props.initialData?.media)
      ? props.initialData.media
      : initialMedia()
        ? [initialMedia()]
        : [],
  );
  const [mediaIdx, setMediaIdx] = createSignal(0);
  const [isDragOver, setIsDragOver] = createSignal(false);

  // Profile Specific Signals for Avatar & QR side-by-side uploads
  const [avatarMedia, setAvatarMedia] = createSignal<any>(
    props.id === "modal-edit-profile" ? props.initialData?.imgId || props.initialData?.avatar || null : null,
  );
  const [qrMedia, setQrMedia] = createSignal<any>(
    props.id === "modal-edit-profile" ? props.initialData?.qrId || props.initialData?.qrImage || null : null,
  );
  const [avatarDragOver, setAvatarDragOver] = createSignal(false);
  const [qrDragOver, setQrDragOver] = createSignal(false);
  const [activeEnhancerTarget, setActiveEnhancerTarget] = createSignal<"avatar" | "qr" | "generic">("generic");

  const currentMedia = () => {
    if (activeEnhancerTarget() === "avatar") return avatarMedia();
    if (activeEnhancerTarget() === "qr") return qrMedia();
    return allMedia()[mediaIdx()];
  };

  const setCurrentMedia = (val: any) => {
    if (activeEnhancerTarget() === "avatar") setAvatarMedia(val);
    else if (activeEnhancerTarget() === "qr") setQrMedia(val);
    else {
      const list = [...allMedia()];
      list[mediaIdx()] = val;
      setAllMedia(list);
    }
  };

  // AI Image Enhancer State & Utilities
  const [isEnhancerOpen, setIsEnhancerOpen] = createSignal(false);
  const [denoiseAmount, setDenoiseAmount] = createSignal(30);
  const [sharpenAmount, setSharpenAmount] = createSignal(25);
  const [isUpscaleEnabled, setIsUpscaleEnabled] = createSignal(true);
  const [isProcessingEnhancer, setIsProcessingEnhancer] = createSignal(false);
  const [enhancedPreview, setEnhancedPreview] = createSignal("");

  const [urlModalOpen, setUrlModalOpen] = createSignal(false);
  const [urlModalTitle, setUrlModalTitle] = createSignal("");
  const [urlModalInput, setUrlModalInput] = createSignal("");
  const [urlModalCallback, setUrlModalCallback] = createSignal<(url: string) => void>(() => {});

  const openUrlModal = (title: string, callback: (url: string) => void) => {
    setUrlModalTitle(title);
    setUrlModalInput("");
    setUrlModalCallback(() => callback);
    setUrlModalOpen(true);
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const triggerEnhance = async () => {
    if (!currentMedia()?.link) return;
    setIsProcessingEnhancer(true);
    try {
      const res = await enhanceImage(currentMedia().link, {
        denoise: denoiseAmount(),
        sharpen: sharpenAmount(),
        upscale: isUpscaleEnabled(),
      });
      setEnhancedPreview(res);
    } catch (e) {
      console.error("Enhancer error:", e);
    } finally {
      setIsProcessingEnhancer(false);
    }
  };

  createEffect(() => {
    if (isEnhancerOpen() && currentMedia()?.link) {
      triggerEnhance();
    }
  });

  const applyEnhancedImage = () => {
    if (!enhancedPreview()) return;
    const newFile = dataURLtoFile(enhancedPreview(), "enhanced_" + (currentMedia().name || "image.png"));
    setCurrentMedia({ link: enhancedPreview(), name: newFile.name, file: newFile });
    setIsEnhancerOpen(false);
  };

  const handleFileSelect = (e: any) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of files) {
        processFile(file);
      }
    }
  };

  const processFile = (file: File) => {
    if (props.mediaType === "image" && file.type.startsWith("video")) {
      setFormError("Chỉ hỗ trợ tải lên hình ảnh, không cho phép video ở đây.");
      return;
    }
    setFormError("");
    const fileType = file.type.startsWith("video") ? "video" : "image";
    const reader = new FileReader();
    reader.onload = (e) => {
      const newItem = { link: e.target?.result, name: file.name, type: fileType, file };
      setAllMedia([...allMedia(), newItem]);
      setMediaIdx(allMedia().length - 1);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (const file of files) {
        processFile(file);
      }
    }
  };

  const clearMedia = () => {
    const list = allMedia().filter((_, i) => i !== mediaIdx());
    setAllMedia(list);
    if (mediaIdx() >= list.length) {
      setMediaIdx(Math.max(0, list.length - 1));
    }
  };

  const handleAvatarFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFormError("Chỉ hỗ trợ tải lên hình ảnh làm ảnh đại diện.");
        return;
      }
      setFormError("");
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarMedia({ link: ev.target?.result, name: file.name, file });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrFileSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFormError("Chỉ hỗ trợ tải lên hình ảnh làm mã QR.");
        return;
      }
      setFormError("");
      const reader = new FileReader();
      reader.onload = (ev) => {
        setQrMedia({ link: ev.target?.result, name: file.name, file });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarDrop = (e: DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFormError("Chỉ hỗ trợ tải lên hình ảnh làm ảnh đại diện.");
        return;
      }
      setFormError("");
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarMedia({ link: ev.target?.result, name: file.name, file });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrDrop = (e: DragEvent) => {
    e.preventDefault();
    setQrDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFormError("Chỉ hỗ trợ tải lên hình ảnh làm mã QR.");
        return;
      }
      setFormError("");
      const reader = new FileReader();
      reader.onload = (ev) => {
        setQrMedia({ link: ev.target?.result, name: file.name, file });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);

      // Upload all files from allMedia list
      const finalMedia = [];
      for (const item of allMedia()) {
        if (item.file) {
          const uploadData = new FormData();
          uploadData.append("file", item.file);
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.success) {
              finalMedia.push({ link: data.url, type: item.type });
            } else {
              throw new Error(data.error);
            }
          }
        } else if (item.link) {
          finalMedia.push({ link: item.link, type: item.type });
        }
      }

      const submitData: any = Object.fromEntries(formData.entries());
      delete submitData.file_upload;

      if (submitData.heavy_temp !== undefined) {
        const val = Number(submitData.heavy_temp) || 0;
        submitData.heavy = weightUnit() === "kg";
        delete submitData.heavy_temp;
      }

      if (submitData.price_temp !== undefined) {
        const val = Number(submitData.price_temp) || 0;
        submitData.price = val;
        submitData.currency = priceUnit(); // Send the selected currency to the backend API
        delete submitData.price_temp;
      }

      // Default quantity to 1 if not entered or empty
      if (!submitData.quantity || String(submitData.quantity).trim() === "") {
        submitData.quantity = 1;
      } else {
        submitData.quantity = Number(submitData.quantity);
      }

      if (props.id === "modal-edit-profile") {
        // Upload Avatar (Ảnh đại diện)
        if (avatarMedia()?.file) {
          const uploadData = new FormData();
          uploadData.append("file", avatarMedia().file);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.success) {
              submitData.imgId = { id: data.id, link: data.url };
              submitData.avatar = { link: data.url, type: "image" };
            }
          }
        } else if (avatarMedia()?.link) {
          // Keep existing avatar/imgId structure
          submitData.imgId = avatarMedia();
          submitData.avatar = { link: avatarMedia().link, type: "image" };
        } else {
          submitData.imgId = null;
          submitData.avatar = null;
        }

        // Upload QR (Mã thanh toán VietQR)
        if (qrMedia()?.file) {
          const uploadData = new FormData();
          uploadData.append("file", qrMedia().file);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.success) {
              submitData.qrId = { id: data.id, link: data.url };
              submitData.qrImage = { link: data.url };
            }
          }
        } else if (qrMedia()?.link) {
          // Keep existing qrId/qrImage structure
          submitData.qrId = qrMedia();
          submitData.qrImage = { link: qrMedia().link };
        } else {
          submitData.qrId = null;
          submitData.qrImage = null;
        }
      }

      // Tự động upload các file nằm trong các trường type="image"
      for (const [key, value] of Object.entries(submitData)) {
        if (value instanceof File && value.size > 0) {
          const uploadData = new FormData();
          uploadData.append("file", value);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.success) {
              submitData[key] = { link: data.url, type: "image" };
            }
          }
        } else if (value instanceof File && value.size === 0) {
          delete submitData[key]; // Xóa trường file rỗng
        }
      }

      // Gom nhóm trường LWH (Kích thước)
      if (submitData.lwh_length !== undefined || submitData.lwh_width !== undefined || submitData.lwh_height !== undefined) {
        submitData.lwh = {
          length: Number(submitData.lwh_length) || 0,
          width: Number(submitData.lwh_width) || 0,
          height: Number(submitData.lwh_height) || 0,
        };
        delete submitData.lwh_length;
        delete submitData.lwh_width;
        delete submitData.lwh_height;
      }

      // Gom nhóm trường Tọa độ
      setFormError(""); // Reset error on new submit
      if (submitData.coordinates_lat !== undefined || submitData.coordinates_lng !== undefined) {
        submitData.coordinates = {
          lat: Number(submitData.coordinates_lat) || 0,
          lng: Number(submitData.coordinates_lng) || 0,
        };
        delete submitData.coordinates_lat;
        delete submitData.coordinates_lng;
      }

      if (props.showMedia) {
        const key = props.mediaKey || "avatar";
        if (key === "media") {
          submitData.media = finalMedia;
        } else {
          submitData[key] = finalMedia[0] || null;
        }
      }

      if (props.onSubmit) {
        await props.onSubmit(submitData);
      }
      props.onClose?.();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Có lỗi xảy ra khi gửi biểu mẫu.");
    } finally {
      setLoading(false);
    }
  };
  if (!["admin", "user", "ai"].includes(props.role)) return null;

  return <div
    id={props.id || "form-overlay"}
    class="fixed inset-0 z-[100] flex justify-end bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
    <div
      id="form-container"
      class={`shadow-2xl w-full max-w-xl h-full overflow-hidden relative animate-in slide-in-from-right duration-500 flex flex-col ${
        theme() === "dark" ? "bg-[#121212]" : "bg-white"
      }`}>
      {}
      <header
        class={`shrink-0 backdrop-blur-md px-8 py-6 flex justify-between items-center border-b ${
          theme() === "dark" ? "bg-[#1e1e1e]/80 border-white/10" : "bg-white/80 border-gray-50"
        }`}>
        <div>
          <h2 class={`text-2xl font-black tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
            {props.title}
          </h2>
          <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
            {"Thông tin chi tiết"}
          </p>
        </div>
        <button
          id="close-form-btn"
          type="button"
          onClick={() => props.onClose?.()}
          class={`p-3 rounded-2xl transition-all active:scale-90 shadow-sm border ${
            theme() === "dark"
              ? "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border-white/10"
              : "bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 border-gray-100"
          }`}>
          <Icon path={xCircle} class="w-6 h-6" />
        </button>
      </header>
      <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <form id="main-form-element" class="space-y-8" onSubmit={handleSubmit}>
          {props.id === "modal-edit-profile" &&
            <div class="space-y-4">
              <div
                class="flex items-center justify-center gap-16 py-8 px-6 bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/10">
                {}
                <div class="flex flex-col items-center gap-3">
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                    {"Ảnh đại diện"}
                  </span>
                  <div
                    id="avatar-drop-zone"
                    class={`relative w-36 h-36 border-2 border-dashed rounded-full text-center transition-all duration-500 group overflow-hidden flex items-center justify-center ${
                      avatarDragOver()
                        ? "border-blue-500 bg-blue-50/50 scale-105 shadow-md"
                        : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/30"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAvatarDragOver(true);
                    }}
                    onDragLeave={() => setAvatarDragOver(false)}
                    onDrop={handleAvatarDrop}>
                    {avatarMedia()
                      ? <div class="absolute inset-0 w-full h-full animate-in zoom-in duration-300 rounded-full overflow-hidden">
                          <img src={avatarMedia()?.link} alt="Avatar" class="w-full h-full object-cover rounded-full" />
                          <div
                            class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 z-30 pointer-events-none">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEnhancerTarget("avatar");
                                setIsEnhancerOpen(true);
                              }}
                              class="p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer pointer-events-auto"
                              title="Làm nét bằng AI">
                              <Icon path={sparkles} class="w-5 h-5 animate-pulse" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAvatarMedia(null);
                              }}
                              class="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer pointer-events-auto"
                              title="Gỡ bỏ">
                              <Icon path={trash} class="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      : <div class="flex flex-col items-center justify-center space-y-1.5 pointer-events-none p-4">
                          <div
                            class={`p-2.5 rounded-full transition-all duration-500 ${
                              avatarDragOver()
                                ? "bg-blue-500 text-white shadow-xl scale-110"
                                : "bg-gray-100 text-gray-400 dark:bg-white/5 group-hover:bg-blue-50 group-hover:text-blue-500"
                            }`}>
                            <Icon path={photo} class="w-6 h-6" />
                          </div>
                          <span
                            class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                            {"Tải ảnh đại diện"}
                          </span>
                        </div>}
                    <input
                      id="avatar-file-input"
                      type="file"
                      accept="image/*"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      onChange={handleAvatarFileSelect}
                    />
                  </div>
                  <div class="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        openUrlModal("Nhập đường dẫn ảnh đại diện (URL)", (url) => {
                          setAvatarMedia({ link: url, type: "image", name: url.split("/").pop() || "External Image" });
                        });
                      }}
                      class="text-[10px] font-black text-blue-500 hover:underline cursor-pointer uppercase tracking-widest">
                      {"+ Dán URL"}
                    </button>
                  </div>
                </div>
                {}
                <div class="flex flex-col items-center gap-3">
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                    {"QR Thanh Toán"}
                  </span>
                  <div
                    id="qr-drop-zone"
                    class={`relative w-36 h-36 border-2 border-dashed rounded-3xl text-center transition-all duration-500 group overflow-hidden flex items-center justify-center ${
                      qrDragOver()
                        ? "border-blue-500 bg-blue-50/50 scale-105 shadow-md"
                        : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/30"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setQrDragOver(true);
                    }}
                    onDragLeave={() => setQrDragOver(false)}
                    onDrop={handleQrDrop}>
                    {qrMedia()
                      ? <div class="absolute inset-0 w-full h-full animate-in zoom-in duration-300 rounded-3xl overflow-hidden">
                          <img src={qrMedia()?.link} alt="QR Image" class="w-full h-full object-cover rounded-3xl" />
                          <div
                            class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 z-30 pointer-events-none">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEnhancerTarget("qr");
                                setIsEnhancerOpen(true);
                              }}
                              class="p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer pointer-events-auto"
                              title="Làm nét bằng AI">
                              <Icon path={sparkles} class="w-5 h-5 animate-pulse" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrMedia(null);
                              }}
                              class="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg cursor-pointer pointer-events-auto"
                              title="Gỡ bỏ">
                              <Icon path={trash} class="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      : <div class="flex flex-col items-center justify-center space-y-1.5 pointer-events-none p-4">
                          <div
                            class={`p-2.5 rounded-3xl transition-all duration-500 ${
                              qrDragOver()
                                ? "bg-blue-500 text-white shadow-xl scale-110"
                                : "bg-gray-100 text-gray-400 dark:bg-white/5 group-hover:bg-blue-50 group-hover:text-blue-500"
                            }`}>
                            <Icon path={photo} class="w-6 h-6" />
                          </div>
                          <span
                            class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                            {"Tải mã QR"}
                          </span>
                        </div>}
                    <input
                      id="qr-file-input"
                      type="file"
                      accept="image/*"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      onChange={handleQrFileSelect}
                    />
                  </div>
                  <div class="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        openUrlModal("Nhập đường dẫn mã QR (URL)", (url) => {
                          setQrMedia({ link: url, type: "image", name: url.split("/").pop() || "External QR" });
                        });
                      }}
                      class="text-[10px] font-black text-blue-500 hover:underline cursor-pointer uppercase tracking-widest">
                      {"+ Dán URL"}
                    </button>
                  </div>
                </div>
              </div>
            </div>}
          {(props.fields || []).filter((f: any) => !(props.id === "modal-edit-profile" && f.name === "qrImage")).map(
            (field: any) => <>
              <fieldset id={"field-group-" + field.name} class="space-y-2">
                <label for={field.name} class="flex items-center justify-between px-1">
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    {field.name === "heavy"
                      ? "Trọng lượng"
                      : field.name === "price"
                        ? "Giá tiền"
                        : field.label}
                    {field.name === "heavy" &&
                      <select
                        value={weightUnit()}
                        onChange={(e) => handleUnitChange((e.target as HTMLSelectElement).value)}
                        class={`px-2 py-0.5 border rounded-lg text-[10px] font-black uppercase cursor-pointer outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${
                          theme() === "dark" ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>}
                    {field.name === "price" &&
                      <select
                        value={priceUnit()}
                        onChange={(e) => setPriceUnit((e.target as HTMLSelectElement).value)}
                        class={`px-2 py-0.5 border rounded-lg text-[10px] font-black uppercase cursor-pointer outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${
                          theme() === "dark" ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}>
                        <option value="₫">₫</option>
                        <option value="$">$</option>
                        <option value="¥">¥</option>
                        <option value="€">€</option>
                        <option value="₪">₪</option>
                      </select>}
                  </span>
                  {field.required
                    ? <span class="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase">
                        {"Bắt buộc"}
                      </span>
                    : null}
                </label>
                {field.name === "heavy"
                  ? <input
                      type="number"
                      id="heavy"
                      name="heavy_temp"
                      required={field.required}
                      step="any"
                      value={weightValue()}
                      onInput={(e) => setWeightValue(Number((e.target as HTMLInputElement).value) || 0)}
                      placeholder="Nhập trọng lượng..."
                      class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                        theme() === "dark"
                          ? "bg-[#1e1e1e] border-white/10 text-white placeholder-gray-600"
                          : "bg-gray-50/50 border-gray-200 text-gray-700 placeholder:text-gray-300"
                      }`}
                    />
                  : field.name === "price"
                    ? <input
                        type="number"
                        id="price"
                        name="price_temp"
                        required={field.required}
                        step="any"
                        value={priceValue()}
                        onInput={(e) => setPriceValue(Number((e.target as HTMLInputElement).value) || 0)}
                        placeholder="Nhập giá tiền..."
                        class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                          theme() === "dark"
                            ? "bg-[#1e1e1e] border-white/10 text-white placeholder-gray-600"
                            : "bg-gray-50/50 border-gray-200 text-gray-700 placeholder:text-gray-300"
                        }`}
                      />
                    : field.type === "textarea"
                      ? <textarea
                          id={field.name}
                          name={field.name}
                          required={field.required}
                          value={props.initialData?.[field.name] || ""}
                          placeholder={field.placeholder || "Nhập nội dung..."}
                          class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none min-h-[120px] font-medium shadow-inner ${
                            theme() === "dark"
                              ? "bg-[#1e1e1e] border-white/10 text-white placeholder-gray-600"
                              : "bg-gray-50/50 border-gray-200 text-gray-700 placeholder:text-gray-300"
                          }`}
                        />
                      : field.type === "image"
                        ? <div class="relative group">
                            <input
                              type="file"
                              accept="image/*"
                              id={field.name}
                              name={field.name}
                              required={field.required && !props.initialData?.[field.name]?.link}
                              class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${
                                theme() === "dark"
                                  ? "bg-[#1e1e1e] border-white/10 text-white"
                                  : "bg-gray-50/50 border-gray-200 text-gray-700"
                              }`}
                            />
                            {props.initialData?.[field.name]?.link &&
                              <div class="mt-2 text-xs font-bold flex items-center gap-2 px-1">
                                <span class="text-green-500">Đã tải lên:</span>
                                <a
                                  href={props.initialData[field.name].link}
                                  target="_blank"
                                  class="text-blue-500 hover:underline">Xem ảnh hiện tại</a>
                              </div>}
                          </div>
                        : field.type === "select"
                          ? <div class="relative group">
                              <select
                                id={field.name}
                                name={field.name}
                                required={field.required}
                                class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none font-medium cursor-pointer shadow-inner ${
                                  theme() === "dark"
                                    ? "bg-[#1e1e1e] border-white/10 text-white"
                                    : "bg-gray-50/50 border-gray-200 text-gray-700"
                                }`}>
                                {(field.options || []).map(
                                  (optItem: any) => <>
                                    <option value={optItem.value} selected={props.initialData?.[field.name] === optItem.value}>
                                      {optItem.label}
                                    </option>
                                  </>,
                                )}
                              </select>
                              <div
                                class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                                <Icon path={chevronDown} class="w-5 h-5" />
                              </div>
                            </div>
                          : field.type === "checkbox"
                            ? <div
                                class={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors group shadow-inner ${
                                  theme() === "dark"
                                    ? "bg-[#1e1e1e] border-white/10 hover:bg-white/5"
                                    : "bg-gray-50/50 border-gray-200 hover:bg-white"
                                }`}>
                                <div class="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    id={field.name}
                                    name={field.name}
                                    required={field.required}
                                    checked={props.initialData?.[field.name] || false}
                                    class="w-6 h-6 text-blue-600 border-gray-300 rounded-lg focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                                <label
                                  for={field.name}
                                  class={`text-sm font-bold select-none cursor-pointer transition-colors ${
                                    theme() === "dark" ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-gray-800"
                                  }`}>
                                  {field.placeholder || "Xác nhận và đồng ý"}
                                </label>
                              </div>
                            : field.type === "date"
                              ? <div class="relative group">
                                  <input
                                    type="date"
                                    id={field.name}
                                    name={field.name}
                                    required={field.required}
                                    value={props.initialData?.[field.name]
                                      ? new Date(props.initialData[field.name]).toISOString().split("T")[0]
                                      : ""}
                                    class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none font-medium shadow-inner ${
                                      theme() === "dark"
                                        ? "bg-[#1e1e1e] border-white/10 text-white"
                                        : "bg-gray-50/50 border-gray-200 text-gray-700"
                                    }`}
                                    style={{ "color-scheme": theme() === "dark" ? "dark" : "light" }}
                                  />
                                  <div
                                    class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                                    <Icon path={calendarDays} class="w-5 h-5" />
                                  </div>
                                </div>
                              : field.type === "lwh"
                                ? <div class="grid grid-cols-3 gap-2">
                                    <input
                                      type="number"
                                      name={`${field.name}_length`}
                                      required={field.required}
                                      placeholder="Dài (cm)"
                                      value={props.initialData?.[field.name]?.length || ""}
                                      class={`w-full px-4 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border-white/10 text-white"
                                          : "bg-gray-50/50 border-gray-200 text-gray-700"
                                      }`}
                                    />
                                    <input
                                      type="number"
                                      name={`${field.name}_width`}
                                      required={field.required}
                                      placeholder="Rộng (cm)"
                                      value={props.initialData?.[field.name]?.width || ""}
                                      class={`w-full px-4 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border-white/10 text-white"
                                          : "bg-gray-50/50 border-gray-200 text-gray-700"
                                      }`}
                                    />
                                    <input
                                      type="number"
                                      name={`${field.name}_height`}
                                      required={field.required}
                                      placeholder="Cao (cm)"
                                      value={props.initialData?.[field.name]?.height || ""}
                                      class={`w-full px-4 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border-white/10 text-white"
                                          : "bg-gray-50/50 border-gray-200 text-gray-700"
                                      }`}
                                    />
                                  </div>
                                : field.type === "coordinates"
                                  ? <div class="grid grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        name={`${field.name}_lat`}
                                        required={field.required}
                                        placeholder="Vĩ độ (Lat)"
                                        value={props.initialData?.[field.name]?.lat || ""}
                                        class={`w-full px-4 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                          theme() === "dark"
                                            ? "bg-[#1e1e1e] border-white/10 text-white"
                                            : "bg-gray-50/50 border-gray-200 text-gray-700"
                                        }`}
                                      />
                                      <input
                                        type="text"
                                        name={`${field.name}_lng`}
                                        required={field.required}
                                        placeholder="Kinh độ (Lng)"
                                        value={props.initialData?.[field.name]?.lng || ""}
                                        class={`w-full px-4 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                          theme() === "dark"
                                            ? "bg-[#1e1e1e] border-white/10 text-white"
                                            : "bg-gray-50/50 border-gray-200 text-gray-700"
                                        }`}
                                      />
                                    </div>
                                  : <input
                                      type={field.type || "text"}
                                      id={field.name}
                                      name={field.name}
                                      required={field.required}
                                      step={field.type === "number" ? "any" : undefined}
                                      value={props.initialData?.[field.name] || ""}
                                      placeholder={field.placeholder || "Nhập thông tin..."}
                                      class={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium shadow-inner ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border-white/10 text-white placeholder-gray-600"
                                          : "bg-gray-50/50 border-gray-200 text-gray-700 placeholder:text-gray-300"
                                      }`}
                                    />}
              </fieldset>
            </>,
          )}
          {props.showMedia && props.id !== "modal-edit-profile" &&
            <div id="media-upload-section" class="space-y-4 pt-4 border-t border-gray-50">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                {props.mediaType === "image" ? "Hình ảnh đính kèm" : "Hình ảnh / Video đính kèm"}
              </label>
              <div
                id="drop-zone"
                class={`relative border-2 border-dashed rounded-[2rem] text-center transition-all duration-500 group overflow-hidden aspect-video flex items-center justify-center ${
                  isDragOver() ? "border-blue-500 bg-blue-50/50 scale-[0.99]" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50/30"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}>
                {allMedia().length > 0
                  ? (() => {
                      const currentItem = () => allMedia()[mediaIdx()];
                      return <div class="absolute inset-0 w-full h-full animate-in zoom-in duration-300">
                        {currentItem()?.type === "image"
                          ? <img src={currentItem()?.link} alt="Preview" class="w-full h-full object-cover" />
                          : <video src={currentItem()?.link} controls class="w-full h-full object-cover" />}
                        {}
                        {allMedia().length > 1 &&
                          <div
                            class="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow z-40 border border-white/10">
                            {`${mediaIdx() + 1} / ${allMedia().length}`}
                          </div>}
                        {}
                        {allMedia().length > 1 &&
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMediaIdx((prev) => (prev - 1 + allMedia().length) % allMedia().length);
                              }}
                              class="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all hover:scale-110 active:scale-95 z-40 border border-white/10 cursor-pointer flex items-center justify-center">
                              <Icon path={chevronLeft} class="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMediaIdx((prev) => (prev + 1) % allMedia().length);
                              }}
                              class="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all hover:scale-110 active:scale-95 z-40 border border-white/10 cursor-pointer flex items-center justify-center">
                              <Icon path={chevronRight} class="w-5 h-5" />
                            </button>
                          </>}
                        {}
                        <div
                          class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-row items-center justify-center gap-4 p-4 z-30">
                          {currentItem()?.type === "image" &&
                            <button
                              type="button"
                              onClick={() => setIsEnhancerOpen(true)}
                              class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all active:scale-95 cursor-pointer">
                              <Icon path={sparkles} class="w-5 h-5 animate-pulse" />
                              {"Làm nét AI"}
                            </button>}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearMedia();
                            }}
                            class="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all active:scale-95 cursor-pointer">
                            <Icon path={trash} class="w-5 h-5" />
                            {"Gỡ bỏ"}
                          </button>
                        </div>
                      </div>;
                    })()
                  : <div class="flex flex-col items-center justify-center space-y-4 pointer-events-none p-10">
                      <div
                        class={`p-4 rounded-3xl transition-all duration-500 ${
                          isDragOver()
                            ? "bg-blue-500 text-white shadow-xl scale-110"
                            : "bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500"
                        }`}>
                        <Icon path={plusCircle} class="w-8 h-8" />
                      </div>
                      <div>
                        <p class="text-lg font-black text-gray-700 tracking-tight">
                          {"Kéo thả tệp vào đây"}
                        </p>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                          {"Dung lượng tối đa 10MB"}
                        </p>
                      </div>
                    </div>}
                {}
                <input
                  id="media-file-input"
                  type="file"
                  name="file_upload"
                  multiple
                  accept={props.mediaType === "image" ? "image/*" : "image/*,video/*"}
                  class={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${
                    allMedia().length > 0 ? "pointer-events-none z-0" : "z-20"
                  }`}
                  onChange={handleFileSelect}
                />
              </div>
              <div class="flex justify-end gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    openUrlModal("Nhập đường dẫn đính kèm (URL)", (url) => {
                      const newItem = { link: url, type: "image", name: url.split("/").pop() || "External Media" };
                      setAllMedia([...allMedia(), newItem]);
                      setMediaIdx(allMedia().length);
                    });
                  }}
                  class="text-[10px] font-black text-blue-500 hover:underline cursor-pointer uppercase tracking-widest">
                  {"+ Dán URL"}
                </button>
              </div>
            </div>}
          {formError() &&
            <div
              class="p-4 mx-8 mt-2 mb-4 bg-red-100/10 border-l-4 border-red-500 text-red-500 font-medium rounded-r-lg shadow-sm animate-in fade-in duration-300">
              {formError()}
            </div>}
        </form>
      </div>
      {}
      <footer
        class={`shrink-0 backdrop-blur-md px-8 py-6 flex gap-4 border-t ${
          theme() === "dark" ? "bg-[#1e1e1e]/80 border-white/10" : "bg-gray-50/80 border-gray-100"
        }`}>
        <button
          id="cancel-form-btn"
          type="button"
          onClick={() => props.onClose?.()}
          class={`px-8 font-bold py-4 rounded-2xl transition-all active:scale-95 border ${
            theme() === "dark"
              ? "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
              : "bg-white text-gray-500 hover:bg-gray-100 border-gray-200"
          }`}>
          {"Hủy"}
        </button>
        <button
          id="submit-form-btn"
          type="submit"
          form="main-form-element"
          disabled={loading()}
          class="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 transition-all active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-3">
          {loading()
            ? <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span>
                {"Lưu thay đổi"}
              </span>}
        </button>
      </footer>
    </div>
    {isEnhancerOpen() &&
      <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div
          class={`shadow-2xl rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border ${
            theme() === "dark" ? "bg-[#181818] border-white/10 text-white" : "bg-white border-gray-100 text-gray-800"
          }`}>
          {}
          <header class="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center shrink-0">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
                <Icon path={sparkles} class="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 class="text-xl font-black tracking-tight">
                  {"AI Super-Resolution & Enhancer"}
                </h3>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                  {"Khử nhiễu + Làm nét + Tăng độ phân giải"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEnhancerOpen(false)}
              class="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
              <Icon path={xCircle} class="w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-white" />
            </button>
          </header>
          {}
          <div class="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 custom-scrollbar">
            {}
            <div class="flex flex-col gap-4">
              <span class="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                {"So sánh trực quan trước / sau"}
              </span>
              <div
                class="relative flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-gray-100 dark:border-white/10 bg-gray-900/10 flex items-center justify-center group shadow-inner">
                {}
                {enhancedPreview()
                  ? <div class="relative w-full h-full flex flex-col sm:flex-row items-center justify-center gap-2 p-2">
                      {}
                      <div class="relative flex-1 h-full rounded-xl overflow-hidden border border-red-500/20 shadow-md">
                        <img src={currentMedia()?.link} class="w-full h-full object-contain" />
                        <div
                          class="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                          {"Gốc (Low-Res)"}
                        </div>
                      </div>
                      {}
                      <div class="relative flex-1 h-full rounded-xl overflow-hidden border border-green-500/20 shadow-md">
                        <img src={enhancedPreview()} class="w-full h-full object-contain" />
                        <div
                          class="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow font-bold">
                          {"AI Enhanced"}
                        </div>
                      </div>
                    </div>
                  : <div class="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <div class="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      <span class="text-sm font-bold animate-pulse">
                        {"Đang phân tích và tối ưu ảnh..."}
                      </span>
                    </div>}
                {isProcessingEnhancer() &&
                  <div class="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                    <div class="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <span class="text-sm font-bold text-white tracking-wide animate-pulse">
                      {"Đang làm nét bằng thuật toán AI..."}
                    </span>
                  </div>}
              </div>
            </div>
            {}
            <div class="flex flex-col gap-6 justify-between">
              <div class="space-y-6">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                  {"Cấu hình thuật toán AI"}
                </span>
                {}
                <div class="p-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 space-y-2">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUpscaleEnabled()}
                      onChange={(e) => {
                        setIsUpscaleEnabled(e.target.checked);
                        triggerEnhance();
                      }}
                      class="w-5 h-5 text-amber-500 rounded focus:ring-amber-500 cursor-pointer"
                    />
                    <span class="font-bold text-sm">
                      {"Nâng độ phân giải x2 (Super-Resolution)"}
                    </span>
                  </label>
                  <p class="text-xs text-gray-400 leading-relaxed pl-8">
                    {"Tăng gấp đôi kích thước pixel bằng bộ nội suy chất lượng cao giúp ảnh không bị vỡ hay nhòe cạnh."}
                  </p>
                </div>
                {}
                <div class="p-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-sm">
                      {"Khử nhiễu và Mịn hạt (Denoising)"}
                    </span>
                    <span class="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {`${denoiseAmount()}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={denoiseAmount()}
                    onInput={(e) => setDenoiseAmount(Number(e.target.value))}
                    onChange={triggerEnhance}
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p class="text-xs text-gray-400 leading-relaxed">
                    {"Thuật toán Bilateral chọn lọc làm mịn các hạt nhiễu, muỗi (grain) nhưng bảo vệ biên dạng vật thể không bị nhòe."}
                  </p>
                </div>
                <div class="p-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 space-y-3">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-sm">
                      {"Làm sắc nét và Khử mờ (Sharpening)"}
                    </span>
                    <span class="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {`${sharpenAmount()}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sharpenAmount()}
                    onInput={(e) => setSharpenAmount(Number(e.target.value))}
                    onChange={triggerEnhance}
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p class="text-xs text-gray-400 leading-relaxed">
                    {"Bộ lọc Unsharp Mask Laplacian tăng độ tương phản cục bộ tại các rìa cạnh giúp các chi tiết mờ trở nên rõ ràng, đanh và gọn gàng."}
                  </p>
                </div>
              </div>
              {}
              <div class="flex gap-3 pt-6 border-t border-gray-50 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEnhancerOpen(false)}
                  class="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-2xl font-bold text-sm transition-colors">
                  {"Hủy bỏ"}
                </button>
                <button
                  type="button"
                  onClick={applyEnhancedImage}
                  disabled={!enhancedPreview() || isProcessingEnhancer()}
                  class="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-orange-100 hover:shadow-orange-200 hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
                  <Icon path={check} class="w-5 h-5" />
                  {"Áp dụng ảnh nét"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>}
    {urlModalOpen() &&
      <div class="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div
          class={`shadow-2xl rounded-3xl p-8 max-w-md w-full border text-center space-y-6 transform animate-in scale-in duration-300 ${
            theme() === "dark" ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-800"
          }`}>
          <div class="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center">
            <Icon path={photo} class="w-8 h-8" />
          </div>
          <div class="space-y-2">
            <h3 class="text-xl font-bold">
              {urlModalTitle()}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {"Vui lòng nhập đường dẫn URL hình ảnh từ internet để đính kèm."}
            </p>
          </div>
          <div class="space-y-2 text-left">
            <label class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
              {"Đường dẫn URL hình ảnh"}
            </label>
            <input
              type="url"
              value={urlModalInput()}
              onInput={(e) => setUrlModalInput((e.target as HTMLInputElement).value)}
              placeholder="https://example.com/image.png"
              class={`w-full px-5 py-3.5 border rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold ${
                theme() === "dark"
                  ? "bg-white/5 border-white/10 text-white placeholder-gray-600"
                  : "bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-300"
              }`}
            />
          </div>
          <div class="flex gap-3 pt-2">
            <button
              onClick={() => setUrlModalOpen(false)}
              class={`flex-1 py-3.5 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                theme() === "dark" ? "bg-white/5 text-gray-300 hover:bg-white/10" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}>
              {"Hủy bỏ"}
            </button>
            <button
              onClick={() => {
                if (urlModalInput().trim()) {
                  urlModalCallback()(urlModalInput().trim());
                }
                setUrlModalOpen(false);
              }}
              class="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-blue-100 dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm uppercase tracking-wider cursor-pointer">
              {"Xác nhận"}
            </button>
          </div>
        </div>
      </div>}
  </div>;
};
