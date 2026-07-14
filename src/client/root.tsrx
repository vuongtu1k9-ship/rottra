import { Router, Route, type RouteSectionProps, useNavigate, useLocation } from "@solidjs/router";
import { createEffect, onMount, lazy, Suspense, Show, createSignal, ErrorBoundary } from "solid-js";
import { Header } from "./components/header.tsrx";
import { Footer } from "./components/footer.tsrx";
import { theme, applyTheme } from "./stores/theme-store";
import { authClient } from "./utils/auth-client";
import { initTranslationCache } from "./stores/ai-translator";
import { preCacheTranslations } from "./utils/pre-cache-translations";

import { Home } from "./views/layout/home.tsrx";

const About = lazy(() => import("./components/about.tsrx").then((module) => ({ default: module.About })));
const Dashboard = lazy(() => import("./views/dashboard/dashboard.tsrx").then((module) => ({ default: module.Dashboard })));
const Profile = lazy(() => import("./views/profile.tsrx").then((module) => ({ default: module.Profile })));
const Auth = lazy(() => import("./views/layout/auth.tsrx").then((module) => ({ default: module.Auth })));
const Order = lazy(() => import("./views/order.tsrx").then((module) => ({ default: module.Order })));
const Product = lazy(() => import("./views/product.tsrx").then((module) => ({ default: module.Product })));
const Assembly = lazy(() => import("./views/assembly.tsrx").then((module) => ({ default: module.Assembly })));
const Cart = lazy(() => import("./views/layout/cart.tsrx").then((module) => ({ default: module.Cart })));
const Assistant = lazy(() => import("./views/assistant.tsrx").then((m) => ({ default: m.Assistant })));
const MarketSeoPage = lazy(() => import("./views/market-seo.tsrx").then((m) => ({ default: m.MarketSeoPage })));
const MotionDetector = lazy(() => import("./views/motion-detector.tsrx").then((m) => ({ default: m.MotionDetector })));
const MLTraining = lazy(() => import("./views/ai/ml-training.tsrx").then((m) => ({ default: m.MLTraining })));
const TuringTest = lazy(() => import("./views/ai/turing-test.tsrx").then((m) => ({ default: m.TuringTest })));
const AIEducation = lazy(() => import("./views/ai/ai-education.tsrx").then((m) => ({ default: m.AIEducation })));
import "../index.css";

import { toasts } from "./stores/toast-store";

const Protect = (props: { component: any; adminOnly?: boolean }) => {
  return () => {
    const navigate = useNavigate();
    const session = authClient.useSession();
    const Comp = props.component;

    createEffect(() => {
      if (!session().isPending) {
        const user = session()?.data?.user;
        if (!user) {
          navigate("/auth", { replace: true });
        } else if (props.adminOnly && (user as any).role !== "admin") {
          navigate("/auth", { replace: true });
        }
      }
    });

    return <Show
      when={!session().isPending && session()?.data?.user}
      fallback={<tsx>
        <div class="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-300">
          <div class="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
          <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">Đang xác thực tài khoản...</p>
        </div>
      </tsx>}>
      <Comp />
    </Show>;
  };
};
const fetchSettings = async () => {
  try {
    const res = await fetch("/api/admin/settings");
    if (res.ok) return await res.json();
  } catch (e) {}
  return null;
};

let safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
};

let lastErrorShown = "";
let lastErrorTime = 0;

const showRealtimeError = (msg: string) => {
  if (typeof document === "undefined") return;
  const now = Date.now();
  if (msg === lastErrorShown && now - lastErrorTime < 5000) return;
  lastErrorShown = msg;
  lastErrorTime = now;

  const div = document.createElement("div");
  div.className =
    "fixed top-20 right-4 bg-red-600 text-white p-4 rounded-xl shadow-2xl z-[9999] max-w-sm font-sans animate-in slide-in-from-right-10 transition-all duration-300";
  const strong = document.createElement("strong");
  strong.className = "block mb-1";
  strong.textContent = "🚨 Cảnh báo Lỗi API (Real-time)";
  const p = document.createElement("p");
  p.className = "text-xs break-all";
  p.textContent = msg;
  div.appendChild(strong);
  div.appendChild(p);
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateX(50px)";
    div.style.transition = "all 0.5s ease-in-out";
    setTimeout(() => div.remove(), 500);
    if (lastErrorShown === msg) {
      lastErrorShown = "";
    }
  }, 5000);
};

export component RootLayout(props: any) {
  const location = useLocation();
  const [isMeetingActiveGlobal, setIsMeetingActiveGlobal] = createSignal(
    typeof window !== "undefined" ? sessionStorage.getItem("meeting_active") === "true" : false,
  );

  onMount(() => {
    const handleMeetingState = (e: any) => {
      setIsMeetingActiveGlobal(e.detail?.isActive || false);
    };
    window.addEventListener("meeting_state_changed", handleMeetingState);
    return () => {
      window.removeEventListener("meeting_state_changed", handleMeetingState);
    };
  });

  onMount(() => {
    initTranslationCache().catch(() => {});
    // Defer pre-caching translations to avoid blocking initial API/auth requests
    setTimeout(() => {
      preCacheTranslations().catch(() => {});
    }, 1500);
  });

  <>
    <Header />
    <main class="min-h-screen p-4 sm:p-6 w-full">
      <ErrorBoundary
        fallback={(err, reset) => (
          <div
            class="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-red-950/20 border border-red-500/20 rounded-3xl backdrop-blur-md max-w-2xl mx-auto my-12 animate-in fade-in duration-300">
            <div
              class="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 text-3xl">🚨</div>
            <h2 class="text-2xl font-black text-white mb-2 uppercase tracking-tight">Cửa sổ Báo lỗi Hệ thống</h2>
            <p class="text-sm text-red-400 mb-6 font-medium">Đã xảy ra lỗi runtime không mong muốn trong ứng dụng.</p>
            <div
              class="w-full bg-black/40 text-left p-4 rounded-xl font-mono text-xs text-red-300 border border-white/5 overflow-x-auto max-h-60 mb-6 leading-relaxed select-all">
              {String(err?.stack || err?.message || err)}
            </div>
            <div class="flex gap-4">
              <button
                onClick={() => {
                  reset();
                  window.location.reload();
                }}
                class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-sm">Tải lại Trang</button>
              <button
                onClick={reset}
                class="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 text-sm">Thử lại (Reset)</button>
            </div>
          </div>
        )}>
        {props.children}
      </ErrorBoundary>
    </main>
    <Footer />
    {/* Global Toast Notifications Container */}
    <div class="fixed top-20 right-4 z-[9999] space-y-3 max-w-sm w-[calc(100vw-32px)] pointer-events-none">
      {toasts().map(
        (toast) => <div
          class={`p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 pointer-events-auto flex items-center gap-3 animate-in slide-in-from-right-10 ${
            toast.type === "success"
              ? (theme() === "dark" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-green-50 border-green-200 text-green-800")
              : toast.type === "error"
                ? (theme() === "dark" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-800")
                : toast.type === "warning"
                  ? (theme() === "dark"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-amber-50 border-amber-200 text-amber-800")
                  : (theme() === "dark" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-800")
          }`}>
          <span class="text-lg shrink-0">
            {toast.type === "success"
              ? "✅"
              : toast.type === "error"
                ? "❌"
                : toast.type === "warning"
                  ? "⚠️"
                  : "ℹ️"}
          </span>
          <span class="font-bold text-sm leading-snug">
            {toast.message}
          </span>
        </div>,
      )}
    </div>
  </>
}

export component Root(props: RouteSectionProps<unknown>) {
  const [settings, setSettings] = createSignal<any>(null);

  createEffect(() => {
    applyTheme(theme());
  });

  onMount(() => {
    fetchSettings().then((s) => {
      if (s) setSettings(s);
    }).catch(() => {});

    if (typeof window !== "undefined") {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          if (!response.ok && response.status >= 500) {
            const errorText = await response.clone().text().catch(() => "Lỗi không xác định");
            showRealtimeError(`HTTP ${response.status} khi gọi: ${args[0]}<br/><br/>${errorText.substring(0, 150)}...`);
          }
          return response;
        } catch (err: any) {
          window.dispatchEvent(new CustomEvent("api_connection_error", { detail: err }));
          throw err;
        }
      };
    }
  });

  <Router root={RootLayout}>
    <Route path="/dashboard" component={Protect({ component: Dashboard, adminOnly: true })} />
    <Route path="/motion-detector" component={Protect({ component: MotionDetector, adminOnly: true })} />
    <Route path="/" component={Home} />
    <Route path="/auth" component={Auth} />
    <Route path="/about" component={About} />
    <Route path="/profile" component={Protect({ component: Profile })} />
    <Route path="/profile/:userId" component={Protect({ component: Profile })} />
    <Route path="/order" component={Protect({ component: Order })} />
    <Route path="/product" component={Protect({ component: Product })} />
    <Route path="/assembly" component={Protect({ component: Assembly })} />
    <Route path="/assembly/:roomCode" component={Protect({ component: Assembly })} />
    <Route path="/cart" component={Cart} />
    <Route path="/assistant" component={Protect({ component: Assistant })} />
    <Route path="/market/:productSlug/at/:locationSlug" component={MarketSeoPage} />
    <Route path="/ai-education" component={AIEducation} />
    <Route path="/turing-test" component={Protect({ component: TuringTest })} />
    <Route path="/dashboard/ml-training" component={Protect({ component: MLTraining, adminOnly: true })} />
  </Router>
}
