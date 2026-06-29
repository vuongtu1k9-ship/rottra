import { createSignal, createResource, onMount, onCleanup } from "solid-js";
import { ProductCard } from "~/client/components/product-card.tsrx";
import { authClient } from "~/client/utils/auth-client";
import { Icon } from "solid-heroicons";
import { truck, xCircle, creditCard, checkCircle } from "solid-heroicons/outline";
import { currencySymbol, formatCurrency } from "~/client/stores/i18n-store";

const fetchOrders = async () => {
  const res = await fetch("/api/orders");
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders || [];
};

component CountdownButton(props: { order: any; onPayClick: () => void; refetch: () => void }) {
  const [timeLeft, setTimeLeft] = createSignal(0);
  const [isExpired, setIsExpired] = createSignal(false);

  const calculateTimeLeft = () => {
    if (!props.order.paymentExpireAt) return 0;
    const diff = new Date(props.order.paymentExpireAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  };

  setTimeLeft(calculateTimeLeft());
  if (timeLeft() <= 0) {
    setIsExpired(true);
  }

  let timer: any;
  onMount(() => {
    timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
        clearInterval(timer);
        props.refetch();
      }
    }, 1000);
  });

  onCleanup(() => {
    clearInterval(timer);
  });

  <div>
    if (isExpired()) {
      <div class="bg-red-50 text-red-600 p-3 rounded-2xl border border-red-100 text-center font-bold text-xs mt-2">
        {"❌ Hết hạn thanh toán (Đã hủy)"}
      </div>
    } else {
      <button
        onClick={props.onPayClick}
        class="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3 px-4 rounded-2xl hover:shadow-lg hover:shadow-blue-100 transition-all active:scale-95 text-xs flex justify-between items-center mt-2 cursor-pointer">
        <span class="flex items-center gap-1">
          <Icon path={creditCard} class="w-4 h-4" />
          {"Thanh toán ngay"}
        </span>
        <span class="bg-white/20 px-2 py-0.5 rounded-lg text-[10px] font-mono animate-pulse">
          {timeLeft() + "s"}
        </span>
      </button>
    }
  </div>
}

export component Order(props: any) {
  const session = authClient.useSession();
  const role = () => (session()?.data?.user as any)?.role || "user";
  const [days, setDays] = createSignal(1);
  const [ordersData, { refetch }] = createResource(fetchOrders);
  const orders = () => ordersData() || [];

  const [payingOrder, setPayingOrder] = createSignal<any>(null);
  const [payingTimeLeft, setPayingTimeLeft] = createSignal(0);
  const [isPayExpired, setIsPayExpired] = createSignal(false);
  const [payingLoading, setPayingLoading] = createSignal(false);
  let payTimer: any;

  const startPayTimer = (expireTime: string) => {
    clearInterval(payTimer);
    setIsPayExpired(false);

    const updateTimer = () => {
      const diff = new Date(expireTime).getTime() - Date.now();
      const remaining = Math.max(0, Math.floor(diff / 1000));
      setPayingTimeLeft(remaining);
      if (remaining <= 0) {
        setIsPayExpired(true);
        clearInterval(payTimer);
        refetch();
      }
    };

    updateTimer();
    payTimer = setInterval(updateTimer, 1000);
  };

  const handlePayClick = (order: any) => {
    setPayingOrder(order);
    if (order.paymentExpireAt) {
      startPayTimer(order.paymentExpireAt);
    }
  };

  const closePayModal = () => {
    setPayingOrder(null);
    clearInterval(payTimer);
  };

  const handleSimulatePayment = async () => {
    const o = payingOrder();
    if (!o) return;

    setPayingLoading(true);
    try {
      const res = await fetch(`/api/orders/${o.id}/pay`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🎉 Thanh toán thành công! Hệ thống đã ghi nhận.");
        closePayModal();
        refetch();
      } else {
        alert(data.message || "Thanh toán thất bại, vui lòng thử lại!");
      }
    } catch (e: any) {
      alert("Lỗi hệ thống: " + e.message);
    } finally {
      setPayingLoading(false);
    }
  };

  const [approving, setApproving] = createSignal(false);

  const handleApprovePreorder = async (orderId: string) => {
    if (approving()) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/approve-preorder`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🎉 Phê duyệt đơn đặt trước thành công! Đã chuyển đơn hàng sang trạng thái Chờ thanh toán.");
        refetch();
      } else {
        alert(data.message || "Phê duyệt thất bại, vui lòng thử lại!");
      }
    } catch (e: any) {
      alert("Lỗi hệ thống: " + e.message);
    } finally {
      setApproving(false);
    }
  };

  onCleanup(() => {
    clearInterval(payTimer);
  });

  if (["admin", "user", "ai", "seller"].includes(role())) {
    <div id="orders-page-container" class="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
      <header id="orders-page-header">
        <h1 class="text-3xl font-extrabold text-gray-800 border-b border-gray-100 pb-4">
          {role() === "seller"
            ? "Đơn hàng nhận được (Đã bán)"
            : role() === "admin"
              ? "Tất cả đơn hàng (Hệ thống)"
              : "Đơn hàng của bạn"}
        </h1>
      </header>

      if (ordersData.loading && orders().length === 0) {
        <div id="loading-state" class="bg-white border rounded-3xl p-12 text-center text-gray-400 italic shadow-sm">
          {"Đang tải danh sách đơn hàng..."}
        </div>
      } else if (!ordersData.loading && !orders().length) {
        <div id="empty-state" class="bg-white border rounded-3xl p-12 text-center text-gray-400 italic shadow-sm">
          {"Hiện tại bạn không có đơn hàng nào."}
        </div>
      }

      <section id="orders-list" class="space-y-8">
        for (const order of orders()) {
          <tsx>
            <article
              id={"order-item-" + order.id}
              class="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              <div class="bg-gray-50/80 px-6 py-4 flex justify-between items-center border-b border-gray-100">
                <div class="flex items-center gap-4">
                  <span
                    class={`text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm ${
                      order.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : order.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : order.status === "preorder"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : "bg-blue-100 text-blue-700"
                    }`}>
                    {order.status === "completed"
                      ? "Hoàn thành"
                      : order.status === "cancelled"
                        ? "Đã hủy (Hết hạn)"
                        : order.status === "preorder"
                          ? "Đặt trước (Chờ hàng)"
                          : "Đang xử lý"}
                  </span>
                  <span class="text-xs text-gray-400 font-bold tracking-tight">
                    {order.createdAt}
                  </span>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    {"Mã đơn"}
                  </span>
                  <span
                    class="text-xs font-mono font-bold ml-1 text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase">
                    {(order.id || "").slice(-8)}
                  </span>
                </div>
              </div>
              <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-6">
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {"Danh sách sản phẩm"}
                  </h3>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {((Array.isArray(order.cart) ? order.cart : (order.cart && Array.isArray(order.cart.items) ? order.cart.items : [])) ||
                      []).map(
                      (item: any) => <tsx>
                        <div class="p-1 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition-colors">
                          <ProductCard item={item} />
                        </div>
                      </tsx>,
                    )}
                  </div>
                </div>
                <aside id={"order-summary-" + order.id} class="space-y-6 bg-blue-50/30 p-6 rounded-3xl border border-blue-50/50">
                  <section id={"recipient-info-" + order.id} class="space-y-4">
                    <h3 class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      {"Thông tin người nhận"}
                    </h3>
                    <div class="space-y-2">
                      <p class="font-bold text-gray-800 flex flex-wrap items-center gap-2">
                        <span>
                          {(order.shippingInfo || {}).fullName || "-"}
                        </span>
                        {order.buyer
                          ? <span class="text-[9px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                              {"Acc: " + (order.buyer.name || order.buyer.username || order.buyer.email)}
                            </span>
                          : null}
                      </p>
                      <p class="text-sm text-gray-600 font-medium">
                        {(order.shippingInfo || {}).phone || "-"}
                      </p>
                      <p class="text-sm text-gray-500 leading-relaxed italic">
                        {(order.shippingInfo || {}).address || "-"}
                      </p>
                    </div>
                  </section>
                  <hr class="border-blue-100/50" />
                  <section id={"payment-info-" + order.id} class="space-y-4">
                    <h3 class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      {"Trạng thái thanh toán"}
                    </h3>
                    {order.paid
                      ? <div
                          class="flex items-center gap-3 bg-green-50 p-3 rounded-2xl border border-green-100 animate-in zoom-in duration-300">
                          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <div class="text-xs">
                            <p class="font-bold text-green-700">
                              {"Đã thanh toán"}
                            </p>
                            <p class="text-[10px] text-green-600/70">
                              {order.paidAt}
                            </p>
                          </div>
                        </div>
                      : order.status === "cancelled"
                        ? <div class="flex items-center gap-3 bg-red-50 p-3 rounded-2xl border border-red-100">
                            <div class="w-2 h-2 bg-red-500 rounded-full" />
                            <p class="text-xs font-bold text-red-700">
                              {"Đã hủy (Hết hạn)"}
                            </p>
                          </div>
                        : order.status === "preorder"
                          ? <div class="space-y-2">
                              <div class="flex items-center gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                                <div class="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                <p class="text-xs font-bold text-amber-700 font-sans">
                                  {"Đơn đặt trước - Sẽ thanh toán khi có hàng"}
                                </p>
                              </div>
                              if (["admin", "seller"].includes(role()))
                              {<button
                                onClick={() => handleApprovePreorder(order.id)}
                                disabled={approving()}
                                class="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-2.5 px-4 rounded-2xl hover:shadow-lg transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2 disabled:opacity-50">
                                <Icon path={checkCircle} class="w-4 h-4" />
                                {approving() ? "Đang phê duyệt..." : "Phê duyệt & Yêu cầu thanh toán"}
                              </button>}
                            </div>
                          : <div class="space-y-2">
                              <div class="flex items-center gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                                <div class="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                <p class="text-xs font-bold text-amber-700">
                                  {"Chờ xử lý thanh toán"}
                                </p>
                              </div>
                              <CountdownButton order={order} onPayClick={() => handlePayClick(order)} refetch={refetch} />
                            </div>}
                  </section>
                  <div class="pt-4 border-t border-blue-100/50 flex justify-between items-end">
                    <span class="text-xs font-bold text-gray-400 uppercase">
                      {"Tổng cộng"}
                    </span>
                    <div class="text-right">
                      <p class="text-2xl font-black text-blue-600 tracking-tighter">
                        {formatCurrency(order.total || 0)}
                        <span class="text-sm ml-1 italic font-bold">
                          {currencySymbol()}
                        </span>
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </article>
          </tsx>
        }
      </section>
      <span
        id="order-batch-actions"
        class="bg-white/80 backdrop-blur-md border border-blue-50 p-6 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-6 sticky bottom-8 z-10 transition-all hover:shadow-blue-100/20">
        <div class="flex items-center gap-6 flex-1 min-w-[280px]">
          <div class="flex flex-col">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{"Gia hạn giao hàng"}</span>
            <div class="flex items-center gap-4 mt-1">
              <input
                id="delay-slider"
                type="range"
                min="1"
                max="7"
                value={days()}
                class="w-32 accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                onInput={(e) => setDays(Number(e.currentTarget.value))}
              />
              <span
                class="bg-blue-600 text-white font-black text-sm px-4 py-1 rounded-full shadow-lg shadow-blue-200 min-w-[80px] text-center">
                {days() === 7 ? "1 tuần" : days() + " ngày"}
              </span>
            </div>
          </div>
          <div class="h-10 w-px bg-gray-100" />
          <p class="text-[10px] text-gray-400 leading-tight max-w-[140px]">{"Áp dụng trì hoãn giao hàng cho tất cả các đơn đang xử lý."}</p>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 hover:text-gray-800 transition-all active:scale-95 shadow-sm">
            {"Tạm dừng tất cả"}
          </button>
          <button
            class="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 transition-all active:translate-y-0">
            <Icon path={truck} class="w-5 h-5 center" />
            {"Xác nhận vận chuyển"}
          </button>
        </div>
      </span>
    </div>
  }

  // EXPIRED & SCAN TO PAY MODAL
  if (payingOrder()) {
    <div
      id="payment-modal"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        class="bg-white rounded-[32px] shadow-2xl w-full max-w-md relative overflow-hidden animate-in zoom-in duration-300 p-6 flex flex-col items-center">
        <button
          onClick={closePayModal}
          class="absolute top-4 right-4 z-20 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors cursor-pointer active:scale-95">
          <Icon path={xCircle} class="w-6 h-6 text-gray-500" />
        </button>

        <div class="text-center w-full mt-4">
          <h2 class="text-xl font-extrabold text-gray-800 tracking-tight">{"Quét Mã VietQR Để Thanh Toán"}</h2>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">{"Hạn mức thanh toán: 1 phút"}</p>
        </div>

        if (isPayExpired()) {
          <div class="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div class="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
              <Icon path={xCircle} class="w-10 h-10" />
            </div>
            <h3 class="text-lg font-bold text-red-600">{"Liên kết thanh toán đã hết hạn!"}</h3>
            <p class="text-xs text-gray-400 max-w-[280px]">{"Đơn hàng đã tự động bị hủy do không hoàn tất giao dịch trong vòng 1 phút."}</p>
            <button
              onClick={closePayModal}
              class="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
              {"Đóng"}
            </button>
          </div>
        } else {
          <div class="w-full flex flex-col items-center space-y-6 pt-4">
            {/* Countdown Box */}
            <div
              class="bg-blue-50 text-blue-600 px-6 py-2 rounded-2xl border border-blue-100 flex items-center gap-2 font-bold text-sm animate-pulse">
              <div class="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              <span>{"Vui lòng thanh toán trong: "}</span>
              <span class="font-mono text-base">
                {payingTimeLeft()}
                {"s"}
              </span>
            </div>

            {/* QR Mock Image */}
            <div class="relative bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner group">
              <img
                src={`https://img.vietqr.io/image/MB-123456789-qr_only.png?amount=${payingOrder().total}&addInfo=THANH TOAN DON HANG ${((payingOrder().id)).slice(
                  -8,
                )}`}
                alt="VietQR Code"
                class="w-56 h-56 object-contain rounded-2xl"
              />
              <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
            </div>

            {/* Description details */}
            <div class="w-full bg-gray-50 p-4 rounded-2xl text-xs space-y-2 border border-gray-100">
              <div class="flex justify-between">
                <span class="text-gray-400">{"Ngân hàng:"}</span>
                <span class="font-bold text-gray-700">{"MBBank (Quân Đội)"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">{"Số tài khoản:"}</span>
                <span class="font-bold text-gray-700">{"123456789"}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">{"Số tiền:"}</span>
                <span class="font-bold text-blue-600 text-sm">
                  {formatCurrency(payingOrder().total)}
                  {currencySymbol()}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">{"Nội dung chuyển khoản:"}</span>
                <span class="font-mono font-bold text-gray-700 uppercase bg-white border px-2 py-0.5 rounded">
                  {"THANH TOAN DON HANG " + ((payingOrder().id)).slice(-8)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleSimulatePayment}
              disabled={payingLoading()}
              class="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-100 hover:shadow-green-200 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              <Icon path={checkCircle} class="w-5 h-5" />
              {payingLoading() ? "Đang ghi nhận..." : "Xác nhận Thanh toán Thành công"}
            </button>
          </div>
        }
      </div>
    </div>
  }
}
