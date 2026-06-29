import { createSignal, onMount } from "solid-js";
import { Icon } from "solid-heroicons";
import { shoppingCart, xCircle, minusCircle, plusCircle, trash } from "solid-heroicons/outline";
import { ProductCard } from "~/client/components/product-card.tsrx";
import { authClient } from "~/client/utils/auth-client";
import { cartItems as rawCartItems, updateCart, clearCart } from "~/client/stores/cart-store";
import { currencySymbol, formatCurrency } from "~/client/stores/i18n-store";

export component Cart(props: any) {
  const session = authClient.useSession();
  const isLoggedIn = () => !!session()?.data?.user;

  const [profile, setProfile] = createSignal<any>(null);
  const [loadingProfile, setLoadingProfile] = createSignal(false);

  const cartItems = () => rawCartItems().map(
    (s: any) => ({ ...s.item, quantity: s.quantity, stockQuantity: s.item?.quantity ?? 0, _id: s.goods }),
  );
  const isItemOutOfStock = (item: any) => item.status === false || (item.stockQuantity ?? 0) <= 0;
  const hasPreorderItems = () => cartItems().some(isItemOutOfStock);

  onMount(() => {
    if (isLoggedIn()) {
      setLoadingProfile(true);
      fetch("/api/profile").then((res) => res.json()).then((data) => {
        if (data.success) setProfile(data.profile);
        setLoadingProfile(false);
      }).catch(() => setLoadingProfile(false));
    }
  });

  const isProfileComplete = () => {
    const p = profile();
    if (!p) return false;
    return !!p.fullName && !!p.phone && !!p.address;
  };

  const [isCheckingOut, setIsCheckingOut] = createSignal(false);

  const handleCheckout = async (e: Event) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      alert("Vui lòng đăng nhập để đặt hàng!");
      window.location.href = "/auth";
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: cartItems(),
          shippingInfo: profile() || {},
          shippingFee: shippingFee(),
          total: total(),
        }),
      });

      if (res.ok) {
        if (hasPreorderItems()) {
          alert("Đặt trước thành công! Đơn đặt trước của bạn đã được ghi nhận và sẽ được xử lý khi có hàng.");
        } else {
          alert("Đặt hàng thành công! Đơn hàng của bạn đã được lưu.");
        }
        clearCart();
        window.location.href = "/dashboard?tab=orders"; // Redirect to orders page
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Có lỗi xảy ra khi đặt hàng: ${errorData.message || "Vui lòng thử lại."}`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi kết nối: " + err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const updateStorage = (newItems: any[]) => {
    const storeItems = newItems.map((i) => ({ goods: i._id, quantity: i.quantity, item: i }));
    updateCart(storeItems, isLoggedIn());
  };

  const handleRemove = (id: any) => {
    updateStorage(cartItems().filter((i) => i._id !== id));
  };

  const handleChangeQty = (id: any, delta: number) => {
    updateStorage(cartItems().map((i) => i._id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };
  const subtotal = () => cartItems().reduce((sum: number, i: any) => sum + Number(i.price || 0) * (i.quantity || 1), 0);
  const shippingFee = () => Math.min(Math.round(subtotal() * 0.05), 50000);
  const total = () => subtotal() + shippingFee();

  const [selectedDetail, setSelectedDetail] = createSignal<any>(null);

  <div id="cart-page-wrapper">
    if (!cartItems() || cartItems().length === 0) {
      <div id="empty-cart-state" class="bg-white border rounded-2xl p-12 text-center">
        <div class="flex justify-center mb-4">
          <Icon path={shoppingCart} class="w-16 h-16 text-gray-300" />
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">{"Giỏ Hàng"}</h1>
        <p class="text-gray-500">{"Giỏ hàng của bạn đang trống."}</p>
        <a href="/" class="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
          {"Tiếp tục mua sắm"}
        </a>
      </div>
    } else {
      <article id="cart-content" class="bg-white border rounded-2xl p-6 space-y-6">
        <h1 class="text-3xl font-bold text-center text-blue-600">{"Giỏ Hàng"}</h1>

        <section id="cart-items-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          for (const item of cartItems()) {
            <tsx>
              <div id={"cart-item-" + (item._id || item.id)} class="relative group">
                <div onClick={() => setSelectedDetail(item)} class="cursor-pointer">
                  <ProductCard item={item}>
                    if (isItemOutOfStock(item))
                    {<div
                      class="mt-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <span>
                        {"⚠️"}
                      </span>
                      <span>
                        {"Sản phẩm hết hàng (Đặt trước)"}
                      </span>
                    </div>}
                  </ProductCard>
                </div>
                <div
                  class="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-4 backdrop-blur-[1px] pointer-events-none group-hover:pointer-events-auto">
                  <div class="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => (item.quantity || 1) <= 1
                        ? handleRemove?.(item._id || item.id)
                        : handleChangeQty?.(item._id || item.id, -1)}
                      class="w-10 h-10 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 flex items-center justify-center font-bold transition-transform active:scale-90">
                      <Icon path={minusCircle} class="w-4 h-4" />
                    </button>
                    <span class="w-8 text-center font-bold text-lg">
                      {item.quantity || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleChangeQty?.(item._id || item.id, 1)}
                      class="w-10 h-10 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 flex items-center justify-center font-bold transition-transform active:scale-90">
                      <Icon path={plusCircle} class="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove?.(item._id || item.id)}
                    class="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-all shadow-lg flex items-center gap-2 font-bold">
                    <Icon path={trash} class="w-5 h-5" />
                    {"Xóa"}
                  </button>
                </div>
              </div>
            </tsx>
          }
        </section>

        <div id="cart-summary" class="border-t pt-4 space-y-2">
          <div class="flex justify-between text-gray-600">
            <span>{"Tạm tính:"}</span>
            <span>
              {formatCurrency(subtotal())}
              {currencySymbol()}
            </span>
          </div>
          <div class="flex justify-between text-gray-600">
            <span>{"Phí vận chuyển (5%, tối đa 50k):"}</span>
            <span>
              {formatCurrency(shippingFee())}
              {currencySymbol()}
            </span>
          </div>
          <div class="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t">
            <span>{"Tổng tiền cần trả:"}</span>
            <span class="text-blue-600">
              {formatCurrency(total())}
              {currencySymbol()}
            </span>
          </div>
        </div>

        <hr />

        <hr />

        if (isLoggedIn()) {
          if (loadingProfile()) {
            <div class="text-center p-6 text-gray-500 font-medium">{"Đang tải thông tin..."}</div>
          } else if (!isProfileComplete()) {
            <div class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex flex-col items-center text-center space-y-4">
              <h2 class="font-black text-xl tracking-tight">{"Thiếu thông tin giao hàng!"}</h2>
              <p class="text-sm font-medium">{"Bạn cần cung cấp đầy đủ Họ tên, Số điện thoại và Địa chỉ để tiếp tục thanh toán."}</p>
              <a
                href="/profile"
                class="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all hover:scale-105 active:scale-95">
                {"Đến trang Hồ Sơ để cập nhật"}
              </a>
            </div>
          } else {
            <form id="checkout-form" onSubmit={handleCheckout} class="space-y-6 pt-2">
              <div class="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex items-start gap-4">
                <div class="bg-blue-100 p-2 rounded-xl text-blue-600 mt-1">
                  <Icon path={shoppingCart} class="w-6 h-6" />
                </div>
                <div class="flex-1">
                  <div class="flex justify-between items-start mb-1">
                    <h3 class="font-bold text-gray-800">{"Giao hàng đến:"}</h3>
                    <a href="/profile" class="text-xs font-bold text-blue-600 hover:text-blue-800 underline">{"Thay đổi"}</a>
                  </div>
                  <p class="text-sm font-semibold text-gray-700">
                    {profile()?.fullName}
                    <span class="text-gray-400 font-normal">
                      {" | "}
                      {profile()?.phone}
                    </span>
                  </p>
                  <p class="text-sm text-gray-500 mt-1">{profile()?.address}</p>
                </div>
              </div>
              <button
                id="btn-submit-order"
                type="submit"
                disabled={isCheckingOut()}
                class="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 transition-all active:translate-y-0 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {isCheckingOut()
                  ? "Đang xử lý..."
                  : hasPreorderItems()
                    ? "Xác nhận đặt trước"
                    : "Xác nhận đặt hàng"}
              </button>
            </form>
          }
        } else {
          <form id="checkout-form" onSubmit={handleCheckout} class="space-y-4">
            <h2 class="text-xl font-bold text-gray-800">{"Thông tin giao hàng (Khách)"}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">{"Tên người nhận"}</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Họ tên người nhận"
                  required
                  class="w-full p-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">{"Số điện thoại"}</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="Số điện thoại"
                  required
                  class="w-full p-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">{"Địa chỉ"}</label>
              <input
                type="text"
                name="address"
                placeholder="Địa chỉ đặt hàng"
                required
                class="w-full p-3 border rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <button
              id="btn-submit-order"
              type="submit"
              class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
              {hasPreorderItems() ? "Xác nhận đặt trước" : "Xác nhận đơn hàng"}
            </button>
          </form>
        }
      </article>
    }
    if (selectedDetail()) {
      <div id="product-detail-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative animate-in zoom-in duration-300 overflow-hidden">
          <button
            id="close-modal-btn"
            onClick={() => setSelectedDetail(null)}
            class="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur rounded-full shadow-lg hover:bg-gray-100 transition-colors">
            <Icon path={xCircle} class="w-6 h-6 text-gray-600" />
          </button>
          <div class="max-h-[80vh] overflow-y-auto p-4">
            <ProductCard item={selectedDetail()} />
            <div class="p-4 pt-0">
              <button
                id="add-to-cart-modal-btn"
                onClick={() => {
                  const pid = selectedDetail().id || selectedDetail()._id;
                  if (pid) {
                    const cart = JSON.parse(localStorage.getItem("cartItems") || "[]");
                    const existing = cart.find((i: any) => i.goods === pid);
                    if (existing) existing.quantity++;
                    else cart.push({ goods: pid, quantity: 1, item: selectedDetail() });
                    localStorage.setItem("cartItems", JSON.stringify(cart));
                    window.dispatchEvent(new Event("cart_updated"));
                    alert("Đã thêm vào giỏ!");
                  }
                }}
                class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                {"Thêm vào giỏ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  </div>
}
