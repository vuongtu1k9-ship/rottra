import { createSignal, createResource, createEffect, onMount, onCleanup } from "solid-js";
import { cog_8Tooth, rocketLaunch, cpuChip, wifi } from "solid-heroicons/outline";
import { Icon } from "solid-heroicons";
import { theme } from "~/client/stores/theme-store";

const fetchSettings = async () => {
  const res = await fetch("/api/admin/settings");
  if (res.ok) {
    return res.json();
  }
  return null;
};

export component SettingSystem(props: any) {
  const [settingsData] = createResource(fetchSettings);

  const [webName, setWebName] = createSignal("");
  const [adminEmail, setAdminEmail] = createSignal("");
  const [adminPhone, setAdminPhone] = createSignal("");
  const [colors, setColors] = createSignal({
    primary: "#3b82f6",
    background: "#ffffff",
    text: "#1f2937",
  });

  const [autoBot, setAutoBot] = createSignal(false);
  const [autoBoost, setAutoBoost] = createSignal(false);
  const [wifiPerf, setWifiPerf] = createSignal(false);
  const [autoPilot, setAutoPilot] = createSignal(
    typeof window !== "undefined" ? localStorage.getItem("autoPilotEnabled") === "true" : false,
  );
  const [autoBalance, setAutoBalance] = createSignal(
    typeof window !== "undefined" ? localStorage.getItem("autoBalanceEnabled") === "true" : false,
  );
  const [autoLive, setAutoLive] = createSignal(typeof window !== "undefined" ? localStorage.getItem("autoLiveEnabled") === "true" : false);
  const [autoResearch, setAutoResearch] = createSignal(
    typeof window !== "undefined" ? localStorage.getItem("autoResearchEnabled") === "true" : false,
  );

  const toggleAutoPilot = () => {
    const newVal = !autoPilot();
    setAutoPilot(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("autoPilotEnabled", newVal ? "true" : "false");
    }
  };

  const toggleAutoBalance = () => {
    const newVal = !autoBalance();
    setAutoBalance(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("autoBalanceEnabled", newVal ? "true" : "false");
    }
  };

  const toggleWifiPerf = () => {
    const newVal = !wifiPerf();
    setWifiPerf(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("wifiPerfEnabled", newVal ? "true" : "false");
    }
  };

  const toggleAutoLive = () => {
    const newVal = !autoLive();
    setAutoLive(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("autoLiveEnabled", newVal ? "true" : "false");
    }
  };

  const toggleAutoResearch = () => {
    const newVal = !autoResearch();
    setAutoResearch(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("autoResearchEnabled", newVal ? "true" : "false");
    }
  };

  const [isSaving, setIsSaving] = createSignal(false);
  const [deviceType, setDeviceType] = createSignal("Đang phân tích thiết bị...");
  const [rawUA, setRawUA] = createSignal("");
  const [networkInfo, setNetworkInfo] = createSignal({ ip: "Đang tải...", geo: "Đang tải..." });
  const [clientEnv, setClientEnv] = createSignal({
    resolution: "Đang tải...",
    language: "Đang tải...",
    timezone: "Đang tải...",
    cookie: "Đang tải...",
  });
  const [activity, setActivity] = createSignal({ clicks: 0, views: 1, scrolls: 0 });
  const [advancedInfo, setAdvancedInfo] = createSignal({
    currentUrl: "Đang tải...",
    timeSpent: 0,
    visitFrequency: 1,
    gpu: "Không xác định",
    pixelDensity: "Không xác định",
    isFishy: false,
  });

  onMount(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      setRawUA(ua);

      // Rút trích trực tiếp khối thông tin phần cứng nằm trong dấu ngoặc đơn (...) của User-Agent
      let deviceInfo = "Thiết bị không xác định";
      const match = ua.match(/\(([^)]+)\)/);
      if (match) {
        deviceInfo = match[1]; // Ví dụ: "X11; Linux x86_64" hoặc "Linux; Android 13; SM-S918B"
      }

      // Nhận diện Trình duyệt (Browser)
      let browser = "Trình duyệt Web";
      if (ua.match(/Edg/i)) browser = "Microsoft Edge";
      else if (ua.match(/OPR|Opera/i)) browser = "Opera";
      else if (ua.match(/Chrome/i)) browser = "Google Chrome";
      else if (ua.match(/Firefox/i)) browser = "Mozilla Firefox";
      else if (ua.match(/Safari/i) && !ua.match(/Chrome/i)) browser = "Apple Safari";

      // Đọc cấu hình phần cứng thật (Hardware Specs) bổ sung
      const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : "";
      const ram = (navigator as any).deviceMemory ? `~${(navigator as any).deviceMemory}GB RAM` : "";
      const hwSpecs = [cores, ram].filter(Boolean).join(" • ");

      // Ghép lại thành chuỗi trung thực 100% từ UA
      setDeviceType(`[${deviceInfo}] - ${browser} ${hwSpecs ? `(${hwSpecs})` : ""}`);

      // Lấy Client Env
      const resolution =
        typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "Không xác định";
      const language = navigator?.language ?? "Không xác định";
      const timezone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone ?? "Không xác định";

      // Cookie/Session
      let cookieStr = "Không có Cookie";
      if (typeof document !== "undefined" && document?.cookie) {
        const sessionMatch = document.cookie.match(/(?:better-auth\.session_token)=([^;]+)/);
        cookieStr = sessionMatch
          ? `Session: ${sessionMatch[1].substring(0, 10)}...`
          : `${document.cookie.split(";").length} Cookies lưu trữ`;
      }
      setClientEnv({ resolution, language, timezone, cookie: cookieStr });

      // Lấy IP & Geo qua API (vì không lấy trực tiếp JS chuẩn được)
      fetch("https://get.geojs.io/v1/ip/geo.json").then((res) => res.json()).then((data) => {
        setNetworkInfo({ ip: data.ip || "Không xác định", geo: `${data.city ? data.city + ", " : ""}${data.country || "Không xác định"}` });
      }).catch(() => setNetworkInfo({ ip: "Lỗi kết nối", geo: "Không xác định" }));

      // Dữ liệu cơ bản cho Agent Bot học
      const currentUrl =
        typeof window !== "undefined" ? window.location.href : "Không xác định";
      const pixelDensity =
        typeof window !== "undefined" ? `${window.devicePixelRatio}x` : "Không xác định";

      // Khám xét độ khả nghi (Bot/Headless)
      let isFishy = false;
      if (typeof navigator !== "undefined") {
        if (
          navigator.webdriver || !navigator?.languages?.length || (window as any)?.callPhantom || (window as any)?._phantom ||
            (window as any)?.__nightmare
        ) isFishy = true;
      }

      let gpu = "Không xác định";
      if (typeof document !== "undefined") {
        try {
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
          const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
          if (debugInfo) {
            gpu = gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "Không xác định";
            if (gpu?.includes("SwiftShader") || gpu?.includes("llvmpipe")) isFishy = true;
          }
        } catch (e) {}
      }

      const freqStr =
        typeof window !== "undefined" ? localStorage.getItem("visitFrequency") : null;
      const visitFrequency = (parseInt(freqStr ?? "0") || 0) + 1;
      if (typeof window !== "undefined") localStorage.setItem("visitFrequency", visitFrequency.toString());

      setAdvancedInfo((prev) => ({ ...prev, currentUrl, pixelDensity, gpu, visitFrequency, isFishy }));

      let timer: any;
      if (typeof window !== "undefined") {
        const startTime = Date.now();
        timer = setInterval(() => {
          setAdvancedInfo((prev) => ({ ...prev, timeSpent: Math.floor((Date.now() - startTime) / 1000) }));
        }, 1000);
      }

      // Theo dõi tương tác cơ bản
      const trackClick = () => setActivity((prev) => ({ ...prev, clicks: prev.clicks + 1 }));
      let scrollTimeout: any;
      const trackScroll = () => {
        if (!scrollTimeout) {
          scrollTimeout = setTimeout(() => {
            setActivity((prev) => ({ ...prev, scrolls: prev.scrolls + 1 }));
            scrollTimeout = null;
          }, 100);
        }
      };

      if (typeof window !== "undefined") {
        window.addEventListener("click", trackClick);
        window.addEventListener("scroll", trackScroll, { passive: true });
        onCleanup(() => {
          clearInterval(timer);
          clearTimeout(scrollTimeout);
          window.removeEventListener("click", trackClick);
          window.removeEventListener("scroll", trackScroll);
        });
      }
    }
  });

  createEffect(() => {
    const data = settingsData();
    if (data) {
      setWebName(data.webName ?? "");
      setAdminEmail(data.adminEmail ?? "");
      setAdminPhone(data.adminPhone ?? "");
      setColors(data.colors ?? { primary: "#3b82f6", background: "#ffffff", text: "#1f2937" });
      setAutoBot(data.autoBot ?? false);
      setAutoBoost(data.autoBoost ?? false);
      setWifiPerf(data.wifiPerf ?? false);
    }
  });

  const isAdmin = () => props?.role === "admin";

  const updateColor = (key: string, value: string) => {
    setColors({ ...colors(), [key]: value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("autoPilotEnabled", autoPilot() ? "true" : "false");
        localStorage.setItem("autoBalanceEnabled", autoBalance() ? "true" : "false");
        localStorage.setItem("autoLiveEnabled", autoLive() ? "true" : "false");
        localStorage.setItem("autoResearchEnabled", autoResearch() ? "true" : "false");
        localStorage.setItem("wifiPerfEnabled", wifiPerf() ? "true" : "false");
      }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webName: webName(),
          adminEmail: adminEmail(),
          adminPhone: adminPhone(),
          colors: colors(),
          autoBot: autoBot(),
          autoBoost: autoBoost(),
        }),
      });
      if (res.ok) {
        alert("Đã cập nhật cấu hình hệ thống thành công!");
        window.location.reload(); // Reload to apply theme globally immediately
      } else {
        alert("Có lỗi xảy ra khi lưu cấu hình.");
      }
    } catch (error) {
      alert("Không thể kết nối đến máy chủ.");
    } finally {
      setIsSaving(false);
    }
  };

  <tsx>
    <div class="max-w-5xl mx-auto p-4 sm:p-8 animate-in fade-in duration-500">
      <div
        class={`rounded-3xl shadow-sm border overflow-hidden ${
          theme() === "dark" ? "bg-[#1e1e1e] border-white/10" : "bg-white border-gray-100"
        }`}>
        <div class={`px-8 py-6 border-b flex items-center gap-4 ${theme() === "dark" ? "border-white/10" : "border-gray-50"}`}>
          <div class={`p-3 rounded-2xl ${theme() === "dark" ? "bg-blue-900/40 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
            <Icon path={cog_8Tooth} class="w-6 h-6" />
          </div>
          <div>
            <h2 class={`text-xl font-bold tracking-tight ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
              {"Cấu hình hệ thống & Giao diện"}
            </h2>
            <p class="text-xs text-gray-500 mt-1">
              {"Tùy chỉnh toàn bộ hệ thống màu sắc và nhận diện thương hiệu"}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} class="p-8 space-y-8">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2 md:col-span-2">
              <label for="webName" class={`text-sm font-bold ${theme() === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                {"Tên website"}
              </label>
              <input
                type="text"
                id="webName"
                value={webName()}
                onInput={(e) => setWebName(e.target.value)}
                class={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-500 font-medium ${
                  theme() === "dark" ? "bg-[#0f0f0f] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                }`}
                placeholder="Nhập tên website"
                required
              />
            </div>
            <div class="space-y-2">
              <label for="adminEmail" class={`text-sm font-bold ${theme() === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                {"Email quản trị viên"}
              </label>
              <input
                type="email"
                id="adminEmail"
                value={adminEmail()}
                onInput={(e) => setAdminEmail(e.target.value)}
                class={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-500 font-medium ${
                  theme() === "dark" ? "bg-[#0f0f0f] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                }`}
                placeholder="Nhập email quản trị viên"
                required
              />
            </div>
            <div class="space-y-2">
              <label for="adminPhone" class={`text-sm font-bold ${theme() === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                {"Số điện thoại quản trị viên"}
              </label>
              <input
                type="text"
                id="adminPhone"
                value={adminPhone()}
                onInput={(e) => setAdminPhone(e.target.value)}
                class={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-500 font-medium ${
                  theme() === "dark" ? "bg-[#0f0f0f] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                }`}
                placeholder="Nhập số điện thoại quản trị viên"
              />
            </div>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div>
              <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                {"Trợ lý ảo (Browser Bot)"}
              </span>
              <span class="text-xs text-gray-500">
                {"Robot tự động di chuyển quanh web để tăng tương tác"}
              </span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoBot()} onChange={() => setAutoBot(!autoBot())} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2 rounded-xl ${theme() === "dark" ? "bg-orange-900/40 text-orange-500" : "bg-orange-50 text-orange-600"}`}>
                <Icon path={rocketLaunch} class="w-5 h-5" />
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Tăng tốc web (Giờ cao điểm)"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Tự động tối ưu cache và dọn dẹp bộ nhớ khi có lượng truy cập lớn"}
                </span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoBoost()} onChange={() => setAutoBoost(!autoBoost())} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2.5 rounded-xl ${theme() === "dark" ? "bg-green-900/40 text-green-400" : "bg-green-50 text-green-600"}`}>
                <span class="text-base font-bold">⚙️</span>
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Tự động hóa Toán học (Auto Pilot)"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Tự động dịch chuyển tọa độ GPS, sensor ảo và xe ANPR trong nông trại"}
                </span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoPilot()} onChange={() => toggleAutoPilot()} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2.5 rounded-xl ${theme() === "dark" ? "bg-blue-900/40 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <span class="text-base font-bold">⚖️</span>
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Cân bằng Nội môi (Auto Balance)"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Tự động điều tiết độ ẩm, nhiệt độ và các chỉ số sinh thái về mức tối ưu"}
                </span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoBalance()} onChange={() => toggleAutoBalance()} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2.5 rounded-xl ${theme() === "dark" ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                <span class="text-base font-bold">📊</span>
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Biến động Biểu đồ (Auto Live Chart)"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Tự động làm biến động chỉ số hoạt động nghiên cứu của các lĩnh vực"}
                </span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoLive()} onChange={() => toggleAutoLive()} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2.5 rounded-xl ${theme() === "dark" ? "bg-rose-900/40 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
                <span class="text-base font-bold">🔬</span>
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Tự động Nghiên cứu (Auto Research)"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Cho phép Giáo sư AI tự động theo dõi, phân tích Sổ tay ELN và dự án ngầm"}
                </span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={autoResearch()} onChange={() => toggleAutoResearch()} class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"
              />
            </label>
          </div>
          <div class={`pt-6 border-t flex flex-col gap-4 ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <div class="flex items-center gap-3">
              <div class={`p-2 rounded-xl ${theme() === "dark" ? "bg-purple-900/40 text-purple-400" : "bg-purple-50 text-purple-600"}`}>
                <Icon path={cpuChip} class="w-5 h-5" />
              </div>
              <div>
                <span class={`block text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {"Thông tin máy khách & Phiên làm việc"}
                </span>
                <span class="text-xs text-gray-500">
                  {"Hệ thống tự động thu thập thông tin thiết bị và mạng của quản trị viên"}
                </span>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                class={`col-span-1 md:col-span-2 lg:col-span-3 rounded-2xl p-5 border flex flex-col md:flex-row gap-6 items-start md:items-center justify-between ${
                  theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-50/50 border-gray-100"
                }`}>
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      {"Hệ thống & Trình duyệt"}
                    </span>
                    {advancedInfo().isFishy
                      ? <span
                          class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            theme() === "dark" ? "bg-red-900/40 text-red-500" : "bg-red-100 text-red-600"
                          }`}>
                          {"Khả nghi (Fishy)"}
                        </span>
                      : <span
                          class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            theme() === "dark" ? "bg-green-900/40 text-green-500" : "bg-green-100 text-green-600"
                          }`}>
                          {"An toàn"}
                        </span>}
                  </div>
                  <span class={`text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                    {deviceType()}
                  </span>
                  <span class="text-xs text-gray-500 block mt-1">
                    {"GPU: "}
                    {advancedInfo().gpu}
                  </span>
                </div>
                <div class="md:text-right">
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                    {"Trang đang xem"}
                  </span>
                  <span class="text-sm font-semibold text-blue-600 break-all max-w-md inline-block">
                    {advancedInfo().currentUrl}
                  </span>
                </div>
              </div>
              <div
                class={`p-4 rounded-xl border flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow ${
                  theme() === "dark" ? "bg-[#111] border-white/10" : "bg-white border-gray-100"
                }`}>
                <span class="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                  {"🌍 Kết nối & Mạng"}
                </span>
                <span class={`text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {networkInfo().ip}
                </span>
                <span class="text-xs text-gray-500">
                  {networkInfo().geo}
                </span>
              </div>
              <div
                class={`p-4 rounded-xl border flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow ${
                  theme() === "dark" ? "bg-[#111] border-white/10" : "bg-white border-gray-100"
                }`}>
                <span class="text-xs font-bold text-purple-500 uppercase tracking-wider flex items-center gap-1">
                  {"🖥️ Hiển thị"}
                </span>
                <span class={`text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {clientEnv().resolution}
                </span>
                <span class="text-xs text-gray-500">
                  {"Mật độ điểm ảnh: "}
                  {advancedInfo().pixelDensity}
                </span>
              </div>
              <div
                class={`p-4 rounded-xl border flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow ${
                  theme() === "dark" ? "bg-[#111] border-white/10" : "bg-white border-gray-100"
                }`}>
                <span class="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                  {"⏱️ Môi trường"}
                </span>
                <span class={`text-sm font-bold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                  {clientEnv().language}
                  {" • "}
                  {clientEnv().timezone}
                </span>
                <span class="text-xs text-gray-500 truncate" title={clientEnv().cookie}>
                  {clientEnv().cookie}
                </span>
              </div>
              <div class="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div
                  class={`p-4 rounded-xl border text-center shadow-sm hover:-translate-y-0.5 transition-transform ${
                    theme() === "dark"
                      ? "bg-green-900/10 border-green-900/30"
                      : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100"
                  }`}>
                  <span class={`text-2xl font-black block ${theme() === "dark" ? "text-green-400" : "text-green-600"}`}>
                    {advancedInfo().timeSpent >= 60
                      ? `${Math.floor(advancedInfo().timeSpent / 60)}m ${advancedInfo().timeSpent % 60}s`
                      : `${advancedInfo().timeSpent}s`}
                  </span>
                  <span class={`text-xs font-bold uppercase mt-1 block ${theme() === "dark" ? "text-green-500" : "text-green-700"}`}>
                    {"Thời gian truy cập"}
                  </span>
                </div>
                <div
                  class={`p-4 rounded-xl border text-center shadow-sm hover:-translate-y-0.5 transition-transform ${
                    theme() === "dark" ? "bg-blue-900/10 border-blue-900/30" : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100"
                  }`}>
                  <span class={`text-2xl font-black block ${theme() === "dark" ? "text-blue-400" : "text-blue-600"}`}>
                    {advancedInfo().visitFrequency}
                  </span>
                  <span class={`text-xs font-bold uppercase mt-1 block ${theme() === "dark" ? "text-blue-500" : "text-blue-700"}`}>
                    {"Lượt truy cập"}
                  </span>
                </div>
                <div
                  class={`p-4 rounded-xl border text-center shadow-sm hover:-translate-y-0.5 transition-transform ${
                    theme() === "dark"
                      ? "bg-purple-900/10 border-purple-900/30"
                      : "bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-100"
                  }`}>
                  <span class={`text-2xl font-black block ${theme() === "dark" ? "text-purple-400" : "text-purple-600"}`}>
                    {activity().clicks}
                  </span>
                  <span class={`text-xs font-bold uppercase mt-1 block ${theme() === "dark" ? "text-purple-500" : "text-purple-700"}`}>
                    {"Lượt Click"}
                  </span>
                </div>
                <div
                  class={`p-4 rounded-xl border text-center shadow-sm hover:-translate-y-0.5 transition-transform ${
                    theme() === "dark"
                      ? "bg-orange-900/10 border-orange-900/30"
                      : "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100"
                  }`}>
                  <span class={`text-2xl font-black block ${theme() === "dark" ? "text-orange-400" : "text-orange-600"}`}>
                    {activity().scrolls}
                  </span>
                  <span class={`text-xs font-bold uppercase mt-1 block ${theme() === "dark" ? "text-orange-500" : "text-orange-700"}`}>
                    {"Lượt Scroll"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class={`pt-6 border-t flex justify-end ${theme() === "dark" ? "border-white/10" : "border-gray-100"}`}>
            <button
              type="submit"
              disabled={isSaving()}
              class={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg ${
                isSaving()
                  ? "bg-blue-400 text-white cursor-not-allowed shadow-none"
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 shadow-blue-200"
              }`}>
              {isSaving() ? "Đang lưu..." : "Cập nhật cấu hình"}
            </button>
          </div>
        </form>
      </div>
    </div>
  </tsx>
}
