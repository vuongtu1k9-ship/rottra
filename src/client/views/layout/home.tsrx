import { A } from "@solidjs/router";
import { ProductCard } from "~/client/components/product-card.tsrx";
import { createSignal, onMount } from "solid-js";
import { authClient } from "~/client/utils/auth-client";
import { cartItems, updateCart } from "~/client/stores/cart-store";
import { Icon } from "solid-heroicons";
import { arrowLeftCircle, shoppingCart } from "solid-heroicons/outline";
import { magnifyingGlass } from "solid-heroicons/solid";
import { t } from "~/client/stores/ai-translator";

export component Home() {
  const session = authClient.useSession();
  const currentUserId = () => session()?.data?.user?.id;

  const [selectedProduct, setSelectedProduct] = createSignal<any>(null);
  const [search, setSearch] = createSignal("");
  const [products, setProducts] = createSignal<any[]>([]);
  const [seoLinks, setSeoLinks] = createSignal<any[]>([]);

  const isLoggedIn = () => !!session()?.data?.user;

  const addToCart = (item: any) => {
    const pid = item.id || item._id;
    if (!pid) return;
    const cart = [...cartItems()];
    const existing = cart.find((i: any) => i.goods === pid);
    if (existing) existing.quantity++;
    else cart.push({ goods: pid, quantity: 1, item: item });
    updateCart(cart, isLoggedIn());
    alert(`Đã thêm ${item.name} vào giỏ!`);
  };

  const filteredProducts = () => (products() || []).filter((p: any) => {
    const name = p?.name || "";
    const matchesSearch = name.toLowerCase().includes(search().toLowerCase());
    const isUpdating = name === "Đang cập nhật...";
    const hasImg = p.media && Array.isArray(p.media) && p.media.length > 0 && p.media[0]?.link;
    return matchesSearch && (p.quantity ?? 0) > 0 && !isUpdating && hasImg;
  });

  onMount(async () => {
    fetch("/api/product").then((r) => r.json()).then((data) => setProducts(data.product || data.products || [])).catch(() => {});

    fetch("/api/seo/market/links").then((r) => r.ok ? r.json() : null).then((data) => {
      if (data) setSeoLinks(data.links || []);
    }).catch(() => {});
  });

  if (selectedProduct()) {
    <div class="animate-fade-in">
      <button
        onClick={() => setSelectedProduct(null)}
        class="mb-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center gap-2">
        <Icon path={arrowLeftCircle} class="w-5 h-5 inline mr-1" />
        <span>{t("Quay lại")}</span>
      </button>
      <div class="relative max-w-xl">
        <ProductCard item={selectedProduct()} />
        if (selectedProduct()?.sellerId !== currentUserId()) {
          <button
            onClick={() => addToCart(selectedProduct())}
            class="absolute bottom-4 right-4 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all hover:-translate-y-1 active:translate-y-0 flex items-center gap-2">
            <Icon path={shoppingCart} class="w-5 h-5" />
            <span>{t("Thêm vào giỏ")}</span>
          </button>
        }
      </div>
    </div>
  } else {
    <div class="max-w-7xl mx-auto p-4 sm:p-8 space-y-12">
      <div class="text-center bg-blue-50 rounded-3xl p-12 border border-blue-100">
        <h1 class="text-4xl font-extrabold mb-4 text-gray-800">{t("Chào mừng đến với Rottra")}</h1>
        <p class="text-gray-600 mb-8 text-lg">{t("Nơi cung cấp các sản phẩm Rottra chất lượng cao.")}</p>
        <div class="relative max-w-2xl mx-auto">
          <Icon path={magnifyingGlass} class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            placeholder={t("Tìm kiếm sản phẩm...")}
            class="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400 font-medium shadow-sm text-lg"
            onInput={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <section class="space-y-6">
        <div class="flex justify-between items-end border-b pb-4">
          <h2 class="text-2xl font-bold text-gray-800">{t("Kệ sản phẩm nổi bật")}</h2>
          <A href="/product" class="text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-bold">
            {t("Xem tất cả")}
          </A>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          for (const p of filteredProducts()) {
            <div class="relative group">
              <div onClick={() => setSelectedProduct(p)} class="cursor-pointer">
                <ProductCard item={p} />
              </div>
              if (p.sellerId !== currentUserId()) {
                <button
                  onClick={() => addToCart(p)}
                  class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-full text-blue-600 font-bold opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all shadow-lg hover:scale-110 active:scale-95">
                  <Icon path={shoppingCart} class="w-5 h-5" />
                </button>
              }
            </div>
          }
        </div>
      </section>

      <section class="space-y-6 border-t pt-8 border-gray-500/10">
        <div class="flex justify-between items-end">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200">{t("🔍 Phân tích Thị trường Nông sản Địa phương")}</h2>
          <span class="text-xs text-gray-400 font-mono">{t("Báo cáo thời gian thực từ Swarm AI")}</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          for (const linkItem of seoLinks()) {
            <A
              href={linkItem.url}
              class="block p-3 rounded-2xl bg-gray-50 dark:bg-[#16161a] border border-gray-200/50 dark:border-white/5 text-xs text-center font-semibold text-gray-600 dark:text-gray-300 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-500/30 dark:hover:border-indigo-500/20 transition-all">
              {linkItem.label}
            </A>
          }
        </div>
      </section>
    </div>
  }
}
