import { createSignal, createResource, createEffect } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { t } from "~/client/stores/ai-translator";
import { Icon } from "solid-heroicons";
import { arrowLeft, chartBar, documentText, link, currencyDollar } from "solid-heroicons/outline";

const SEO_PRODUCTS = [
  { slug: "ca-phe-robusta", name: "Cà phê Robusta" },
  { slug: "gao-st25", name: "Gạo ST25" },
  { slug: "tieu-den", name: "Tiêu đen" },
  { slug: "tra-xanh", name: "Trà xanh" },
  { slug: "hat-dieu", name: "Hạt điều" },
];

const SEO_LOCATIONS = [
  { slug: "lam-dong", name: "Lâm Đồng" },
  { slug: "dak-lak", name: "Đắk Lắk" },
  { slug: "gia-lai", name: "Gia Lai" },
  { slug: "soc-trang", name: "Sóc Trăng" },
  { slug: "dong-thap", name: "Đồng Tháp" },
  { slug: "binh-phuoc", name: "Bình Phước" },
  { slug: "thai-nguyen", name: "Thái Nguyên" },
];

function getProductName(slug: string): string {
  return SEO_PRODUCTS.find((p) => p.slug === slug)?.name || "Nông sản";
}

function getLocationName(slug: string): string {
  return SEO_LOCATIONS.find((l) => l.slug === slug)?.name || "Việt Nam";
}

export component MarketSeoPage() {
  const params = useParams();

  const fetchMarketData = async () => {
    if (!params.productSlug || !params.locationSlug) return null;
    const res = await fetch(`/api/seo/market?productSlug=${params.productSlug}&locationSlug=${params.locationSlug}`);
    if (!res.ok) throw new Error("Failed to fetch market data");
    const json = await res.json();
    return json.data;
  };

  const [marketData, { refetch }] = createResource(fetchMarketData);

  // Pre-calculate title immediately for fast LCP painting
  const productName = () => getProductName(params.productSlug || "");
  const locationName = () => getLocationName(params.locationSlug || "");
  const immediateTitle = () => `Tình hình Thị trường ${productName()} tại ${locationName()} mới nhất`;

  createEffect(() => {
    const data = marketData();
    if (data) {
      document.title = `${data.title} | Rottra Market Tracker`;
      let metaDesc = document.querySelector("meta[name=\"description\"]");
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", data.metaDescription);
    } else {
      document.title = `${immediateTitle()} | Rottra Market Tracker`;
    }
  });

  const renderMarkdown = (text: string) => {
    if (!text) return "";
    return text.split("\n\n").map((paragraph) => {
      if (paragraph.startsWith("## ")) {
        return `<h2 class="text-xl font-bold text-indigo-500 mt-6 mb-3 border-b border-gray-500/10 pb-2">${paragraph.replace(
          "## ",
          "",
        )}</h2>`;
      }
      if (paragraph.startsWith("### ")) {
        return `<h3 class="text-lg font-bold text-gray-200 mt-4 mb-2">${paragraph.replace("### ", "")}</h3>`;
      }
      if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
        const listItems = paragraph.split("\n").map(
          (item) => `<li class="ml-4 list-disc text-gray-300 text-sm leading-relaxed">${item.replace(/^[-*]\s+/, "")}</li>`,
        ).join("");
        return `<ul class="space-y-1 my-3">${listItems}</ul>`;
      }
      let formatted = paragraph.replace(/\*\*(.*?)\*\*/g, "<strong class=\"text-indigo-400 font-semibold\">$1</strong>");
      return `<p class="text-gray-300 text-sm leading-relaxed mb-4">${formatted}</p>`;
    }).join("");
  };

  <div class="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-300">
    <div>
      <A
        href="/"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold border border-white/5 transition-all">
        <Icon path={arrowLeft} class="w-4.5 h-4.5" />
        <span>{"Quay lại trang chủ"}</span>
      </A>
    </div>

    {/* Main Title & Description Card rendered instantly to guarantee extremely low LCP */}
    <div
      class="p-8 rounded-3xl bg-gradient-to-br from-indigo-900/40 via-indigo-950/10 to-transparent border border-indigo-500/10 space-y-4">
      <div class="space-y-1.5">
        <span
          class="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
          {"Programmatic SEO & Real-time Metrics"}
        </span>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {immediateTitle()}
        </h1>
      </div>
      <p class="text-sm text-gray-400 leading-relaxed max-w-3xl">
        if (marketData()) {
          {marketData()!.metaDescription}
        } else {
          {"Cập nhật nhanh giá nông sản và tình hình giao thương tại địa phương từ sàn giao dịch Rottra Agent..."}
        }
      </p>
    </div>

    if (marketData.loading) {
      <div class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p class="text-sm text-gray-500 font-mono">{"AI đang phân tích thị trường & biên soạn báo cáo..."}</p>
      </div>
    }

    if (marketData.error) {
      <div class="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
        <p class="text-sm font-bold text-red-500">{"Đã xảy ra lỗi khi tạo báo cáo thị trường."}</p>
        <button onClick={refetch} class="px-4 py-1.5 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all">
          {"Thử lại"}
        </button>
      </div>
    }

    if (marketData() && !marketData.loading) {
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-6 rounded-2xl bg-[#16161a] border border-white/5 space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">{"Giá trung bình"}</span>
            <div class="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Icon path={currencyDollar} class="w-5 h-5" />
            </div>
          </div>
          <div>
            <div class="text-2xl font-black text-white">
              {marketData()!.averagePrice.toLocaleString()}
              <span class="text-xs text-gray-400">{"VNĐ/kg"}</span>
            </div>
            <p class="text-[10px] text-gray-500 mt-1 font-mono">{"Tính toán từ Sổ cái đàm phán Swarm"}</p>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#16161a] border border-white/5 space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">{"Sản lượng giao dịch"}</span>
            <div class="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Icon path={chartBar} class="w-5 h-5" />
            </div>
          </div>
          <div>
            <div class="text-2xl font-black text-white">
              {marketData()!.tradeVolume.toLocaleString()}
              <span class="text-xs text-gray-400">{"Tấn"}</span>
            </div>
            <p class="text-[10px] text-gray-500 mt-1 font-mono">{"Độ bao phủ thị trường của Rottra Agent"}</p>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-[#16161a] border border-white/5 space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">{"Khu vực kiểm định"}</span>
            <div class="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Icon path={documentText} class="w-5 h-5" />
            </div>
          </div>
          <div>
            <div class="text-xl font-bold text-white">
              {marketData()!.locationName}
            </div>
            <p class="text-[10px] text-gray-500 mt-1 font-mono">{"Đồng bộ vùng trồng & bến cảng"}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 p-8 rounded-3xl bg-[#111115] border border-white/5 prose max-w-none">
          <div innerHTML={renderMarkdown(marketData()!.content)} />
        </div>

        <div class="space-y-6">
          <div class="p-6 rounded-2xl bg-[#16161a] border border-white/5 space-y-4">
            <div class="flex items-center gap-2 text-indigo-400 border-b border-white/5 pb-2">
              <Icon path={link} class="w-4 h-4" />
              <h4 class="text-sm font-bold uppercase tracking-wider">{"Thị trường Liên kết (Silo)"}</h4>
            </div>
            <ul class="space-y-2">
              for (const linkItem of marketData()!.relatedLinks) {
                <li>
                  <A
                    href={linkItem.url}
                    class="block p-3 rounded-xl bg-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 text-xs font-semibold text-gray-300 transition-all border border-white/5 hover:border-indigo-500/20">
                    {linkItem.label}
                  </A>
                </li>
              }
            </ul>
          </div>

          <div class="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10 text-center space-y-2">
            <span class="text-lg">{"🛡️"}</span>
            <h5 class="text-xs font-bold text-white">{"Chứng thư Thống kê Độc quyền"}</h5>
            <p class="text-[10px] text-gray-500 leading-relaxed font-mono">
              {"Dữ liệu thị trường được cập nhật mỗi 5 phút dựa trên hoạt động đàm phán thương mại giữa 12 Agent thông minh của Rottra."}
            </p>
          </div>
        </div>
      </div>
    }
  </div>
}
