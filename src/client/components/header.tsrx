import { A } from "@solidjs/router";
import { createSignal, createEffect, onMount } from "solid-js";
import { Icon } from "solid-heroicons";
import {
  language,
  cog_8Tooth,
  user,
  cube,
  square_3Stack_3d,
  tv,
  home,
  shoppingCart,
  arrowLeftOnRectangle,
  arrowRightOnRectangle,
  sun,
  moon,
  buildingStorefront,
  xCircle,
  trash,
  bell,
  bellAlert,
  bellSlash,
  bellSnooze,
} from "solid-heroicons/outline";
import { isServer } from "solid-js/web";
import { authClient } from "~/client/utils/auth-client";
import { theme, toggleTheme } from "~/client/stores/theme-store";
import { cartItems, initCart, fetchUserCart, updateCart, clearCart } from "~/client/stores/cart-store";
import { loadAndApplyUserPreferences, clearUserPreferencesLocally } from "~/server/helpers/user-sync";
import { showToast } from "~/client/stores/toast-store";
import { getPrimaryImage } from "~/client/components/product-card.tsrx";
import { currentLang, setLanguage, t, formatCurrency, currencySymbol } from "~/client/stores/i18n-store";
import { isTranslating, translateProgress, translatedLang, translatePage, restorePage } from "~/client/utils/page-translator";
import { preCacheTranslations } from "~/client/utils/pre-cache-translations";
import { UserAvatar, getInitials, getGradientForName } from "~/client/components/user-avatar";

export component Header(props: any) {
  const session = authClient.useSession();
  const role = () => (session()?.data?.user as any)?.role || "guest";
  const isAdmin = () => session()?.data?.user?.role === "admin" || props.isAdmin;
  const isUser = () => !!session()?.data?.user || props.isUser;
  const [redirecting, setRedirecting] = createSignal(false);
  const [isCartOpen, setIsCartOpen] = createSignal(false);
  const [agentAvatar, setAgentAvatar] = createSignal("");

  // Load initial notification state
  const getInitialNotifyState = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("notify_state") as any || "normal";
    }
    return "normal";
  };
  const [notifyState, setNotifyState] = createSignal<"normal" | "alert" | "snooze" | "slash">(getInitialNotifyState());
  const [isNotifyDropdownOpen, setIsNotifyDropdownOpen] = createSignal(false);
  let bellButtonRef: HTMLButtonElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  const [isLangDropdownOpen, setIsLangDropdownOpen] = createSignal(false);
  let langButtonRef: HTMLButtonElement | undefined;
  let langDropdownRef: HTMLDivElement | undefined;

  const languagesList = [
    { code: "vi", label: "Tiếng Việt", native: "Tiếng Việt", flag: "🇻🇳", desc: "Ngôn ngữ mặc định" },
    { code: "en", label: "Tiếng Anh", native: "English", flag: "🇬🇧", desc: "English language" },
    { code: "zh", label: "Tiếng Trung", native: "中文", flag: "🇨🇳", desc: "Chinese language" },
    { code: "ja", label: "Tiếng Nhật", native: "日本語", flag: "🇯🇵", desc: "Japanese language" },
    { code: "fi", label: "Tiếng Phần Lan", native: "Suomi", flag: "🇫🇮", desc: "Finnish language" },
    { code: "he", label: "Tiếng Hebrew", native: "עברית", flag: "🇮🇱", desc: "Hebrew language" },
  ];

  createEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cart_drawer_toggled", { detail: { isOpen: isCartOpen() } }));
    }
  });

  createEffect(() => {
    if (session()?.data?.user) {
      fetchUserCart();
      loadAndApplyUserPreferences();
    }
  });

  const [scrollSpeed, setScrollSpeed] = createSignal(0);
  const [isRinging, setIsRinging] = createSignal(false);
  const [dragDistance, setDragDistance] = createSignal(0);
  const [dragAngle, setDragAngle] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  let hasDragged = false;

  const ringBell = () => {
    setIsRinging(true);
    setTimeout(() => setIsRinging(false), 800);
  };

  const getTempNotifyState = () => {
    if (!isDragging() || dragDistance() < 15) return notifyState();

    const states: ("normal" | "alert" | "snooze" | "slash")[] = ["normal", "alert", "snooze", "slash"];
    const currentIndex = states.indexOf(notifyState());
    return states[(currentIndex + 1) % states.length];
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    hasDragged = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const MAX_BELL_DRAG = 50;

      const clampedDist = Math.min(MAX_BELL_DRAG, dist);
      setDragDistance(clampedDist);

      const angleRad = Math.atan2(deltaX, deltaY);
      let angleDeg = (angleRad * 180) / Math.PI;
      angleDeg = Math.max(-45, Math.min(45, angleDeg));
      setDragAngle(angleDeg);

      if (clampedDist > 5) {
        hasDragged = true;
      }
    };

    const handleMouseUp = () => {
      const finalState = getTempNotifyState();
      setIsDragging(false);

      if (hasDragged) {
        if (finalState !== notifyState()) {
          setNotifyState(finalState);
          localStorage.setItem("notify_state", finalState);

          const messages = {
            normal: "Chế độ thông báo: Bình thường. 🔔",
            alert: "Chế độ thông báo: Khẩn cấp! 🚨",
            snooze: "Chế độ thông báo: Tạm hoãn. 💤",
            slash: "Chế độ thông báo: Tắt tiếng. 🔕",
          };

          const toastTypes: Record<string, "success" | "warning" | "info" | "error"> = {
            normal: "success",
            alert: "warning",
            snooze: "info",
            slash: "error",
          };

          // Gửi log về server
          fetch("/api/notify-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: finalState,
              message: messages[finalState as keyof typeof messages],
              userId: session()?.data?.user?.id || "Guest",
            }),
          }).catch((err) => console.error("Lỗi gửi log notify:", err));

          showToast(toastTypes[finalState], messages[finalState]);
        }
        ringBell();
      } else {
        ringBell();
      }

      setDragDistance(0);
      setDragAngle(0);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true);
    hasDragged = false;
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const deltaX = moveEvent.touches[0].clientX - startX;
      const deltaY = moveEvent.touches[0].clientY - startY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const MAX_BELL_DRAG = 50;

      const clampedDist = Math.min(MAX_BELL_DRAG, dist);
      setDragDistance(clampedDist);

      const angleRad = Math.atan2(deltaX, deltaY);
      let angleDeg = (angleRad * 180) / Math.PI;
      angleDeg = Math.max(-45, Math.min(45, angleDeg));
      setDragAngle(angleDeg);

      if (clampedDist > 5) {
        hasDragged = true;
      }
    };

    const handleTouchEnd = () => {
      const finalState = getTempNotifyState();
      setIsDragging(false);

      if (hasDragged) {
        if (finalState !== notifyState()) {
          setNotifyState(finalState);
          localStorage.setItem("notify_state", finalState);

          const messages = {
            normal: "Chế độ thông báo: Bình thường. 🔔",
            alert: "Chế độ thông báo: Khẩn cấp! 🚨",
            snooze: "Chế độ thông báo: Tạm hoãn. 💤",
            slash: "Chế độ thông báo: Tắt tiếng. 🔕",
          };

          const toastTypes: Record<string, "success" | "warning" | "info" | "error"> = {
            normal: "success",
            alert: "warning",
            snooze: "info",
            slash: "error",
          };

          showToast(toastTypes[finalState], messages[finalState]);
        }
        ringBell();
      } else {
        ringBell();
      }

      setDragDistance(0);
      setDragAngle(0);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
  };

  onMount(() => {
    initCart();

    const fetchAgentProfile = async () => {
      try {
        const res = await fetch("/api/agent/system-profile");
        if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json();
          if (data.success && data.profile) {
            if (data.profile.name) {
              setAgentName(data.profile.name);
            }
            if (data.profile.avatar && data.profile.avatar.link) {
              let avatarUrl = data.profile.avatar.link;
              if (avatarUrl.includes("default-avatar.png") || avatarUrl === "/favicon.ico?v=3") {
                avatarUrl = "";
              }
              setAgentAvatar(avatarUrl);
              localStorage.setItem("rottra_agent_avatar", avatarUrl);
            }
            
            // Dynamically update favicon based on avatar or initials
            if (typeof window !== "undefined") {
              const favicon = document.getElementById("favicon") as HTMLLinkElement;
              if (favicon) {
                if (agentAvatar()) {
                  favicon.href = agentAvatar();
                } else {
                  const canvas = document.createElement("canvas");
                  canvas.width = 64;
                  canvas.height = 64;
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    ctx.beginPath();
                    ctx.arc(32, 32, 32, 0, 2 * Math.PI);
                    ctx.fillStyle = "#0d9488"; // Teal match
                    ctx.fill();
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 32px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(getInitials(agentName() || "Trợ Lý Cao Cấp Rottra"), 32, 34);
                    favicon.href = canvas.toDataURL("image/png");
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Lỗi khi tải profile agent trong Header:", e);
      }
    };
    fetchAgentProfile();

    const handleApiError = (e: any) => {
      setNotifyState("alert");
      localStorage.setItem("notify_state", "alert");
      const errMsg = e.detail?.message || "Failed to fetch";
      showToast("error", `Chế độ thông báo: Khẩn cấp! 🚨 (Lỗi kết nối Backend: ${errMsg})`);
      ringBell();
    };
    window.addEventListener("api_connection_error", handleApiError);

    const handleDocumentClick = (e: MouseEvent) => {
      if (isNotifyDropdownOpen()) {
        if (!(bellButtonRef && bellButtonRef.contains(e.target as Node)) && !(dropdownRef && dropdownRef.contains(e.target as Node))) {
          setIsNotifyDropdownOpen(false);
        }
      }
      if (isLangDropdownOpen()) {
        if (
          !(langButtonRef && langButtonRef.contains(e.target as Node)) && !(langDropdownRef && langDropdownRef.contains(e.target as Node))
        ) {
          setIsLangDropdownOpen(false);
        }
      }
    };
    document.addEventListener("click", handleDocumentClick);

    let lastScrollY =
      typeof window !== "undefined" ? window.scrollY : 0;
    let scrollTimeout: any;

    const handleScroll = () => {
      if (typeof window === "undefined") return;
      const currentScrollY = window.scrollY;
      const diff = Math.abs(currentScrollY - lastScrollY);

      const speed = Math.min(30, diff);
      setScrollSpeed(speed);
      lastScrollY = currentScrollY;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setScrollSpeed(0);
      }, 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("api_connection_error", handleApiError);
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("scroll", handleScroll);
    };
  });

  const updateItemQty = (id: string, delta: number) => {
    const newCart = cartItems().map((c) => {
      if (c.goods === id || c._id === id) {
        return { ...c, quantity: Math.max(1, c.quantity + delta) };
      }
      return c;
    });
    updateCart(newCart, isUser());
  };

  const removeItem = (id: string) => {
    const newCart = cartItems().filter((c) => c.goods !== id && c._id !== id);
    updateCart(newCart, isUser());
  };

  const handleLogout = async () => {
    try {
      clearCart();
      clearUserPreferencesLocally();
      await authClient.signOut();
      setRedirecting(true);
      window.location.href = "/auth";
    } catch (e) {
      console.error(e);
    }
  };

  const handleMenuClick = (e: Event, menu: any) => {
    if (menu.label === "Giỏ hàng") {
      e.preventDefault();
      setIsCartOpen(true);
    }
  };

  const adminMenus = [
    { label: "Quản lý web", href: "/dashboard", icon: cog_8Tooth },
  ];

  const userMenus = [
    { label: "Thông tin tài khoản", href: "/profile", icon: user },
    { label: "Cuộc họp", href: "/assembly", icon: tv },
    { label: "Sản phẩm", href: "/product", icon: square_3Stack_3d },
    { label: "Đơn hàng", href: "/order", icon: cube },
  ];

  const guestMenus = [
    { label: "Trang chủ", href: "/", icon: home },
    { label: "Giỏ hàng", href: "/cart", icon: shoppingCart },
  ];

  const logoutMenu = { label: "Thoát", href: "#", icon: arrowLeftOnRectangle };
  const loginMenu = { label: "Vào", href: "/auth", icon: arrowRightOnRectangle };

  const getMenus = () => {
    if (session().isPending) {
      return guestMenus;
    }
    const userRole = role();
    const isMeetingParticipant = ["admin", "ai", "user"].includes(userRole);
    const allowedUserMenus = userMenus.filter((m) => m.label !== "Cuộc họp" || isMeetingParticipant);

    let result: any[] = [];
    if (isAdmin()) result = [
      ...adminMenus,
      ...allowedUserMenus,
      ...guestMenus,
      logoutMenu,
    ];
    else if (isUser()) result = [...allowedUserMenus, ...guestMenus, logoutMenu];
    else result = [...guestMenus, loginMenu];
    return result;
  };

  const getIconSize = () => "w-6 h-6";

  <header class="shadow-sm transition-colors duration-300 z-50 sticky top-0 bg-transparent">
    <div
      class={`absolute inset-0 -z-10 backdrop-blur-md ${
        theme() === "dark" ? "bg-[#0f0f0f]/90 border-b border-white/10" : "bg-white/90 border-b border-gray-100/10"
      }`}
    />
    <div class="w-full px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
      <A
        href="/"
        aria-label={t("Trang chủ")}
        class={`text-xl font-extrabold tracking-tighter hover:text-blue-600 transition-colors flex items-center gap-2 shrink-0 ${
          theme() === "dark" ? "text-white" : "text-gray-900"
        }`}>
        <UserAvatar 
          name={agentName() || "Trợ Lý Cao Cấp Rottra"} 
          image={agentAvatar() || null} 
          class="w-8 h-8 text-sm shadow-sm shrink-0" 
        />
        <span class="hidden sm:inline">{t("Rottra")}</span>
      </A>
      <div class="flex items-center gap-2 md:gap-6 overflow-visible flex-1 justify-end">
        <ul class="flex gap-2 md:gap-6 items-center overflow-x-auto no-scrollbar pb-1">
          for (const menu of getMenus()) {
            <li class={menu.label === "Giỏ hàng" ? "relative group" : ""}>
              if (menu.href === "#") {
                <span
                  id="logout-btn"
                  class={`flex items-center gap-1.5 cursor-pointer font-medium transition-colors ${
                    theme() === "dark" ? "text-gray-300 hover:text-blue-400" : "text-gray-800 hover:text-blue-500"
                  }`}
                  onClick={handleLogout}
                  title={t(menu.label)}>
                  <Icon path={menu.icon} class="w-5 h-5 text-blue-500 shrink-0" />
                  <span class="hidden lg:inline whitespace-nowrap text-sm">
                    {t(menu.label)}
                  </span>
                </span>
              } else {
                <A
                  id={menu.label === "Giỏ hàng"
                    ? "cart-menu-btn"
                    : menu.label === "Thông tin tài khoản"
                      ? "profile-menu-btn"
                      : menu.label === "Đơn hàng"
                        ? "order-menu-btn"
                        : menu.label === "Sản phẩm"
                          ? "product-menu-btn"
                          : menu.label === "Cuộc họp"
                            ? "assembly-menu-btn"
                            : undefined}
                  href={menu.href}
                  onClick={(e: any) => handleMenuClick(e, menu)}
                  class={`flex items-center gap-1.5 font-medium transition-colors relative ${
                    theme() === "dark" ? "text-gray-300 hover:text-blue-400" : "text-gray-800 hover:text-blue-500"
                  }`}
                  title={t(menu.label)}>
                  <div class="relative flex items-center">
                    <Icon
                      path={menu.icon}
                      class={`${menu.label === "Giỏ hàng" ? "w-6 h-6" : "w-5 h-5"} text-blue-500 shrink-0 relative z-10`}
                    />
                    if (menu.label === "Giỏ hàng" && cartItems().length > 0) {
                      <span
                        class="absolute top-[38%] left-[50%] -translate-x-[45%] -translate-y-[55%] bg-transparent text-red-600 text-[14px] font-black z-0 flex items-center justify-center pointer-events-none opacity-80">
                        {cartItems().reduce((sum: number, item: any) => sum + item.quantity, 0)}
                      </span>
                    }
                  </div>
                  <span class="hidden lg:inline whitespace-nowrap text-sm">
                    {t(menu.label)}
                  </span>
                </A>
              }
            </li>
          }
          if (session().isPending) {
            <li class="flex items-center gap-1.5 font-medium text-gray-400">
              <div class="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
              <span class="hidden lg:inline text-xs">{t("Đang tải...")}</span>
            </li>
          }
        </ul>
        <div class="flex items-center pl-2 md:pl-4 border-l border-gray-100/20 shrink-0 gap-1.5 relative">
          <button
            ref={bellButtonRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            class={`p-2 rounded-full hover:bg-gray-100/10 transition-all relative select-none ${
              isDragging() ? "cursor-grabbing" : "cursor-grab"
            } ${theme() === "dark" ? "text-white" : "text-gray-800"}`}
            title={t("Kéo chuông xuống để đổi chế độ thông báo")}>
            <div
              class={`relative ${isRinging() ? "animate-bell-ring" : ""}`}
              style={{
                "transform-origin": "top center",
                transform: `rotate(${dragAngle()}deg)`,
                transition: isDragging() ? "none" : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}>
              if (getTempNotifyState() === "normal") {
                <Icon path={bell} class={getIconSize()} />
              }
              if (getTempNotifyState() === "alert") {
                <Icon path={bellAlert} class={getIconSize()} />
              }
              if (getTempNotifyState() === "snooze") {
                <Icon path={bellSnooze} class={getIconSize()} />
              }
              if (getTempNotifyState() === "slash") {
                <Icon path={bellSlash} class={getIconSize()} />
              }
            </div>
          </button>

          <button
            ref={langButtonRef}
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen())}
            class="p-2 rounded-full hover:bg-gray-100/10 transition-all cursor-pointer text-gray-800 dark:text-white relative"
            title={t("Ngôn ngữ")}>
            <Icon path={language} class={getIconSize()} />
            <span
              class="absolute -bottom-1 -right-1 text-[9px] font-black uppercase bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-gray-800 scale-90">
              {currentLang()}
            </span>
          </button>
          if (isLangDropdownOpen()) {
            <div
              ref={langDropdownRef}
              data-no-translate
              class={`absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl border p-2 z-[60] backdrop-blur-md transition-all ${
                theme() === "dark" ? "bg-[#121212]/95 border-white/10 text-white" : "bg-white/95 border-gray-100 text-gray-800"
              }`}>
              <h3 class="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">{t("Ngôn ngữ hệ thống")}</h3>
              <ul class="space-y-1">
                for (const item of languagesList) {
                  <li>
                    <button
                      onClick={() => {
                        setLanguage(item.code);
                        if (item.code === "vi") {
                          restorePage();
                        } else {
                          translatePage(item.code);
                        }
                        preCacheTranslations();
                        showToast("success", `${t("Đã chuyển sang")} ${item.label} (${item.native}) 🌐`);
                        setIsLangDropdownOpen(false);
                      }}
                      class={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors text-sm ${
                        currentLang() === item.code
                          ? (theme() === "dark" ? "bg-white/10 font-bold" : "bg-gray-100 font-bold")
                          : (theme() === "dark" ? "hover:bg-white/5" : "hover:bg-gray-50")
                      }`}>
                      <span class="text-base">{item.flag}</span>
                      <div class="flex-1">
                        <div class="flex items-center justify-between text-xs">
                          <span>{item.native}</span>
                          if (currentLang() === item.code) {
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          }
                        </div>
                        <div class="text-[9px] text-gray-400 leading-tight">{item.label}</div>
                      </div>
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
          <button
            onClick={toggleTheme}
            class="p-2 rounded-full hover:bg-gray-100/10 transition-all cursor-pointer text-gray-800 dark:text-white"
            title={theme() === "dark" ? t("Chuyển sang chế độ sáng") : t("Chuyển sang chế độ tối")}>
            <Icon path={theme() === "dark" ? sun : moon} class={getIconSize()} />
          </button>
        </div>
      </div>
    </div>

    <div class={`fixed inset-0 z-[100] transition-all duration-300 ${isCartOpen() ? "visible" : "invisible"}`}>
      <div
        class={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isCartOpen() ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setIsCartOpen(false)}
      />

      <div
        class={`absolute top-0 right-0 h-full w-full max-w-md shadow-2xl transition-transform duration-300 transform flex flex-col ${
          isCartOpen() ? "translate-x-0" : "translate-x-full"
        } ${theme() === "dark" ? "bg-[#121212] border-l border-white/10" : "bg-white"}`}>
        <div class={`p-5 border-b flex items-center justify-between ${theme() === "dark" ? "border-white/10" : "border-gray-200"}`}>
          <h2 class={`text-xl font-black flex items-center gap-2 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
            <Icon path={shoppingCart} class="w-6 h-6 text-blue-500" />
            {t("Giỏ hàng của bạn")}
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            class={`p-2 rounded-full transition-colors cursor-pointer ${
              theme() === "dark" ? "hover:bg-white/10 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500"
            }`}>
            <Icon path={xCircle} class="w-6 h-6" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          if (cartItems().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
              <div class={`p-6 rounded-full ${theme() === "dark" ? "bg-white/5" : "bg-gray-50"}`}>
                <Icon path={shoppingCart} class="w-12 h-12 text-gray-400" />
              </div>
              <p class={`font-bold text-base ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>{t("Giỏ hàng đang trống")}</p>
              <button
                onClick={() => setIsCartOpen(false)}
                class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/10">
                {t("Tiếp tục mua sắm")}
              </button>
            </div>
          }
          if (cartItems().length > 0) {
            for (const c of cartItems()) {
              <div class={`flex gap-4 border-b pb-4 last:border-0 ${theme() === "dark" ? "border-white/5" : "border-gray-100"}`}>
                <img
                  src={getPrimaryImage(c.item)}
                  class={`w-20 h-20 object-cover rounded-2xl border shadow-sm ${theme() === "dark" ? "border-white/5" : "border-gray-100"}`}
                  alt={c.item?.name || t("Sản phẩm")}
                />
                <div class="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <h3
                      class={`font-bold line-clamp-2 text-sm leading-snug mb-1 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}
                      title={c.item?.name || t("Sản phẩm")}>
                      {c.item?.name || t("Sản phẩm")}
                    </h3>
                    <p class="text-blue-500 dark:text-blue-400 font-extrabold text-sm">
                      {formatCurrency(c.item?.price || 0)}
                      {currencySymbol()}
                    </p>
                  </div>
                  <div class="flex items-center justify-between mt-1.5">
                    <div
                      class={`flex items-center rounded-xl border ${
                        theme() === "dark" ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"
                      }`}>
                      <button
                        onClick={() => updateItemQty(c.goods || c._id, -1)}
                        class={`w-8 h-8 flex items-center justify-center rounded-l-xl transition-colors font-black cursor-pointer active:scale-90 ${
                          theme() === "dark" ? "hover:bg-white/10 text-gray-400 hover:text-white" : "hover:bg-gray-200 text-gray-600"
                        }`}>
                        {"-"}
                      </button>
                      <span class={`w-8 text-center text-xs font-extrabold ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                        {c.quantity}
                      </span>
                      <button
                        onClick={() => updateItemQty(c.goods || c._id, 1)}
                        class={`w-8 h-8 flex items-center justify-center rounded-r-xl transition-colors font-black cursor-pointer active:scale-90 ${
                          theme() === "dark" ? "hover:bg-white/10 text-gray-400 hover:text-white" : "hover:bg-gray-200 text-gray-600"
                        }`}>
                        {"+"}
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(c.goods || c._id)}
                      class={`p-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                        theme() === "dark"
                          ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          : "text-red-500 hover:text-red-600 hover:bg-red-50"
                      }`}>
                      <Icon path={trash} class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        if (cartItems().length > 0) {
          <div
            class={`p-5 border-t shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] space-y-4 ${
              theme() === "dark" ? "bg-[#161616] border-white/10" : "bg-white border-gray-100"
            }`}>
            <div
              class={`flex justify-between items-center text-base font-extrabold mb-1 ${
                theme() === "dark" ? "text-white" : "text-gray-800"
              }`}>
              <span>{t("Tổng tạm tính:")}</span>
              <span class="text-blue-500 dark:text-blue-400 text-lg font-black">
                {formatCurrency(cartItems().reduce((sum: number, c: any) => sum + (c.item?.price || 0) * c.quantity, 0))}
                {currencySymbol()}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <A
                href="/cart"
                onClick={() => setIsCartOpen(false)}
                class={`text-center py-3 px-4 font-bold rounded-2xl transition-colors border text-sm ${
                  theme() === "dark"
                    ? "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    : "bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100"
                }`}>
                {t("Vào giỏ hàng")}
              </A>
              <A
                href="/cart"
                onClick={() => setIsCartOpen(false)}
                class="text-center py-3 px-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 text-sm">
                {t("Thanh toán")}
              </A>
            </div>
          </div>
        }
      </div>
    </div>

    if (isTranslating() || translatedLang()) {
      <div
        class={`fixed bottom-0 left-0 right-0 z-[200] flex items-center gap-3 px-4 py-3 shadow-2xl transition-all duration-300 ${
          theme() === "dark" ? "bg-[#1a1a2e]/95 border-t border-white/10 text-white" : "bg-white/95 border-t border-gray-200 text-gray-800"
        } backdrop-blur-md`}>
        <div class="flex items-center gap-3 flex-1">
          if (isTranslating()) {
            <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          }
          if (!isTranslating()) {
            <div class="w-2 h-2 rounded-full bg-green-500" />
          }
          <span class="text-sm font-bold whitespace-nowrap">
            if (isTranslating()) {
              {`${t("Đang dịch trang...")} ${translateProgress()}%`}
            }
            if (!isTranslating()) {
              {`${t("Đã dịch sang")} ${languagesList.find((l) => l.code === translatedLang())?.native || translatedLang()}`}
            }
          </span>
          if (isTranslating()) {
            <div class="flex-1 max-w-xs h-1.5 rounded-full bg-gray-200/20 overflow-hidden">
              <div class="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${translateProgress()}%` }} />
            </div>
          }
        </div>
        <div class="flex items-center gap-2">
          if (translatedLang() && translatedLang() !== "vi") {
            <button
              onClick={() => {
                restorePage();
                setLanguage("vi");
                showToast("success", `${t("Đã khôi phục")} Tiếng Việt 🌐`);
              }}
              class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                theme() === "dark" ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}>
              {t("Hoàn tác")}
            </button>
          }
          <button
            onClick={() => {
              restorePage();
              setLanguage("vi");
            }}
            class={`p-1.5 rounded-full transition-all ${
              theme() === "dark"
                ? "hover:bg-white/10 text-gray-400 hover:text-white"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            }`}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    }
  </header>
}
