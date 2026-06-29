import { getPrimaryImage, getPrimaryMediaType } from "~/client/components/product-card.tsrx";
import { currencySymbol, formatCurrency } from "~/client/stores/i18n-store";

export component Detail(props: any) {
  // Support both direct props and { item } prop
  const item = () => props.item || props;
  const { name, description, price, category, status, media } = item();

  const formatVN = (n: any) => formatCurrency(Number(n));

  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
    <div class="aspect-square relative overflow-hidden bg-gray-100">
      if (getPrimaryMediaType(item()) === "video") {
        <video
          src={getPrimaryImage(item())}
          class="w-full h-full object-cover"
          onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
          onMouseOut={(e) => {
            (e.target as HTMLVideoElement).pause();
            (e.target as HTMLVideoElement).currentTime = 0;
          }}
          muted
          loop
          playsinline
        />
      } else {
        <img
          src={getPrimaryImage(item())}
          alt={name}
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      }
    </div>
    <div class="p-4 space-y-2">
      <h3 class="font-bold text-gray-800 line-clamp-1">
        {name || "Sản phẩm"}
      </h3>
      <p class="text-xs text-gray-400 line-clamp-2">{description || ""}</p>
      <div class="flex items-center justify-between">
        <p class="text-lg font-bold text-blue-600">
          {formatVN(price)}
          {currencySymbol()}
        </p>
        <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
          {category || "Chưa phân loại"}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class={status ? "text-green-600 text-xs" : "text-red-600 text-xs"}>
          {status ? "Còn hàng" : "Hết hàng"}
        </span>
      </div>

      {/* Container for injected actions/content */}
      {props.children}
    </div>
  </div>
}
