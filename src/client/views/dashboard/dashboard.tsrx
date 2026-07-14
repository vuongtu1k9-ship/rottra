import { createMemo, Suspense, createEffect, createSignal, lazy } from "solid-js";
import { Dynamic } from "solid-js/web";
import { A, useSearchParams } from "@solidjs/router";
import { authClient } from "~/client/utils/auth-client";
import { theme } from "~/client/stores/theme-store";
import { Icon } from "solid-heroicons";
import {
  userGroup,
  cog,
  cog_8Tooth,
  cube,
  globeAsiaAustralia,
  clock,
  chartPie,
  lockClosed,
  academicCap,
  chartBar,
  share,
  cpuChip,
} from "solid-heroicons/outline";

const ManageUsers = lazy(() => import("./manage-user.tsrx").then((m) => ({ default: m.ManageUsers })));
const ManageProduct = lazy(() => import("./manage-product.tsrx").then((m) => ({ default: m.ManageProduct })));
const SettingSystem = lazy(() => import("./setting-system.tsrx").then((m) => ({ default: m.SettingSystem })));
const Activity = lazy(() => import("./activity.tsrx").then((m) => ({ default: m.Activity })));
const Local = lazy(() => import("./local.tsrx").then((m) => ({ default: m.Local })));
const HeavyChart = lazy(() => import("./heavy-chart.tsrx").then((m) => ({ default: m.HeavyChart })));
const FollowAI = lazy(() => import("./follow-ai.tsrx").then((m) => ({ default: m.FollowAI })));
const EvaluationView = lazy(() => import("./evaluation.tsrx").then(m => ({ default: m.EvaluationView })));
const AIFlowView = lazy(() => import("./ai-flow.tsrx").then((m) => ({ default: m.HyperbolicTreeOfLife })));
const MLTrainingView = lazy(() => import("../ai/ml-training.tsrx").then((m) => ({ default: m.MLTraining })));
const VectorView = lazy(() => import("./vector-viewer.tsrx").then((m) => ({ default: m.VectorViewer })));
const LLMVisualizerView = lazy(() => import("./llm-visualizer.tsrx").then((m) => ({ default: m.LlmVisualizer })));

export component Dashboard(props: any) {
  const session = authClient.useSession();
  const [searchParams] = useSearchParams();

  const tabs = {
    "manage-users": ManageUsers,
    "manage-products": ManageProduct,
    "system-setting": SettingSystem,
    local: Local,
    activity: Activity,
    "follow-ai": FollowAI,
    "heavy-chart": HeavyChart,
    evaluation: EvaluationView,
    "ai-flow": AIFlowView,
    "ml-training": MLTrainingView,
    "vector-viewer": VectorView,
    "llm-visualizer": LLMVisualizerView,
  };

  const activeTab = createMemo(() => {
    const tab = searchParams.tab || "manage-users";
    return tab in tabs ? tab : "manage-users";
  });
  const Comp = () => (tabs as any)[activeTab()];

  const isAdmin = () => props?.role === "admin" || session()?.data?.user?.role === "admin";

  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);

  component Menu() {
    <aside
      class={`transition-all duration-300 border-r min-h-screen shadow-sm hidden md:block whitespace-nowrap overflow-hidden ${
        isSidebarOpen() ? "w-64 px-6 py-6 opacity-100" : "w-0 px-0 py-6 opacity-0"
      } ${theme() === "dark" ? "bg-[#0f0f0f] border-white/10" : "bg-white border-gray-100"}`}>
      <div class="w-[208px]">
        <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{"Quản trị hệ thống"}</h3>
        <ul class="space-y-2">
          <li>
            <A
              href="/dashboard?tab=manage-users"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "manage-users"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={userGroup} class="w-5 h-5 min-w-[20px]" />
              {"Người dùng"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=manage-products"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "manage-products"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={cube} class="w-5 h-5 min-w-[20px]" />
              {"Sản phẩm"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=system-setting"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "system-setting"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={cog_8Tooth} class="w-5 h-5 min-w-[20px]" />
              {"Cài đặt"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=local"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "local"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={globeAsiaAustralia} class="w-5 h-5 min-w-[20px]" />
              {"Bản đồ"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=activity"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "activity"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={clock} class="w-5 h-5 min-w-[20px]" />
              {"Hoạt động"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=follow-ai"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "follow-ai"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={academicCap} class="w-5 h-5 min-w-[20px]" />
              {"Follow AI & 12 Agent"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=heavy-chart"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "heavy-chart"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={chartBar} class="w-5 h-5 min-w-[20px]" />
              {"Biểu đồ"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=evaluation"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "evaluation"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={chartPie} class="w-5 h-5 min-w-[20px]" />
              {"AI Evaluation"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=ai-flow"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "ai-flow"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={share} class="w-5 h-5 min-w-[20px]" />
              {"AI Flow Tree"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=ml-training"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "ml-training"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={academicCap} class="w-5 h-5 min-w-[20px]" />
              {"ML Training"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=vector-viewer"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "vector-viewer"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600")
              }`}>
              <Icon path={globeAsiaAustralia} class="w-5 h-5 min-w-[20px]" />
              {"Semantic Storm"}
            </A>
          </li>
          <li>
            <A
              href="/dashboard?tab=llm-visualizer"
              class={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                activeTab() === "llm-visualizer"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : (theme() === "dark"
                    ? "text-gray-400 hover:bg-emerald-900/30 hover:text-emerald-400"
                    : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-600")
              }`}>
              <Icon path={cpuChip} class="w-5 h-5 min-w-[20px]" />
              {"LLM Engine"}
            </A>
          </li>
        </ul>
      </div>
    </aside>
  }
  <div class={`flex min-h-[calc(100vh-80px)] overflow-hidden relative ${theme() === "dark" ? "bg-[#0a0a0a]" : "bg-gray-50"}`}>
    <Menu />
    <main class="flex-1 w-full overflow-y-auto relative transition-all duration-300">
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen())}
        class={`absolute top-4 left-4 z-50 p-2.5 rounded-xl shadow-md border backdrop-blur-md transition-all ${
          theme() === "dark"
            ? "bg-gray-800/80 border-white/10 text-white hover:bg-gray-700"
            : "bg-white/90 border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-lg"
        }`}
        title={isSidebarOpen() ? "Thu gọn Sidebar" : "Mở rộng Sidebar"}>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          if (isSidebarOpen()) {
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          } else {
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      <div class="pt-16 pb-8">
        if (Comp()) {
          <Suspense
            fallback={<tsx>
              <div class="flex flex-col items-center justify-center h-64 w-full space-y-4 animate-in fade-in duration-500">
                <div
                  class="w-10 h-10 border-4 border-blue-100 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400 rounded-full animate-spin"></div>
                <p class="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
                  {"Đang nạp phân hệ..."}
                </p>
              </div>
            </tsx>}>
            <Dynamic component={Comp()} role={session()?.data?.user?.role} />
          </Suspense>
        } else {
          <div class="p-8 text-center text-gray-500 italic">{"Không có nội dung"}</div>
        }
      </div>
    </main>
  </div>
}
