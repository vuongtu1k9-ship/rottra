import { createSignal } from "solid-js";
import { Icon } from "solid-heroicons";
import { chevronLeft, chevronRight, speakerWave, speakerXMark } from "solid-heroicons/outline";
import { A } from "@solidjs/router";
import { UserAvatar } from "~/client/components/user-avatar.tsrx";
import { currencySymbol, formatCurrency } from "~/client/stores/i18n-store";

export function getPrimaryImage(item: any) {
  if (!item) return "/images/Rottra-logo.png";
  const media = item.media;
  const list: any[] = Array.isArray(media) ? [...media] : [];

  const legacyImg = item.imageUrl ?? item.img?.link;
  if (legacyImg && !list.find((m) => m?.link === legacyImg && m === legacyImg)) {
    list.unshift({ type: "image", link: legacyImg });
  }

  const validList = list.filter((m) => m?.link || typeof m === "string");
  const first = validList[0];

  if (first) {
    return typeof first === "string" ? first : first.link;
  }
  return "/images/Rottra-logo.png";
}

export function getPrimaryMediaType(item: any) {
  if (!item) return "image";
  const media = item.media;
  const list: any[] = Array.isArray(media) ? [...media] : [];

  if (item.videoUrl && !list.find((m) => m?.link === item.videoUrl)) {
    list.push({ type: "video", link: item.videoUrl });
  }

  const validList = list.filter((m) => m?.link || typeof m === "string");
  const first = validList[0];

  if (first) {
    return typeof first === "string" ? "image" : first.type || "image";
  }
  return "image";
}

export component ProductCard(props: any) {
  // Support both direct props and { item } prop
  const item = () => props.item ?? props;
  const { name, description, price, category, status, media } = item() ?? {};

  const [idx, setIdx] = createSignal(0);
  const [isMuted, setIsMuted] = createSignal(true);
  const mediaList = () => {
    const list: any[] = Array.isArray(media) ? [...media] : [];

    // Add legacy fields if not already in list
    const legacyImg = props.imageUrl ?? props.img?.link;
    if (legacyImg && !list.find((m) => m?.link === legacyImg)) {
      list.unshift({ type: "image", link: legacyImg });
    }

    if (props.videoUrl && !list.find((m) => m?.link === props.videoUrl)) {
      list.push({ type: "video", link: props.videoUrl });
    }

    return list.filter((m) => m?.link || typeof m === "string");
  };
  const currentMedia = () => mediaList()[idx()];

  const currentMediaUrl = () => {
    const m = currentMedia();
    return m ? (typeof m === "string" ? m : m.link) : "/no-image.avif";
  };

  const currentMediaType = () => {
    const m = currentMedia();
    return m ? (typeof m === "string" ? "image" : m.type || "image") : "image";
  };

  const formatVN = (n: any) => formatCurrency(Number(n));

  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
    <div class="aspect-square relative overflow-hidden bg-gray-100 group/media">
      if (currentMediaType() === "video") {
        <div class="w-full h-full relative group/video">
          <video src={currentMediaUrl()} class="w-full h-full object-cover" autoplay muted={isMuted()} loop playsinline />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted());
            }}
            class="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover/video:opacity-100 hover:bg-black/70 backdrop-blur-sm z-50 transition-all cursor-pointer"
            title={isMuted() ? "Bật âm thanh" : "Tắt âm thanh"}>
            <Icon path={isMuted() ? speakerXMark : speakerWave} class="w-4 h-4" />
          </button>
        </div>
      } else {
        <img
          src={currentMediaUrl()}
          alt={name}
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            if (!e.currentTarget.src.includes("no-image.avif") && !e.currentTarget.src.includes("placehold.co")) {
              e.currentTarget.src = "/no-image.avif";
            }
          }}
        />
      }

      <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 z-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIdx((prev) => (prev === 0 ? mediaList().length - 1 : prev - 1));
          }}
          class="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm cursor-pointer transition-all active:scale-90">
          <Icon path={chevronLeft} class="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIdx((prev) => (prev === mediaList().length - 1 ? 0 : prev + 1));
          }}
          class="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm cursor-pointer transition-all active:scale-90">
          <Icon path={chevronRight} class="w-4 h-4" />
        </button>
      </div>
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-50">
        {mediaList().map(
          (_, i) => <tsx><div class={`w-1.5 h-1.5 rounded-full transition-all ${i === idx() ? "bg-white w-4" : "bg-white/40"}`} /></tsx>,
        )}
      </div>
    </div>
    <div class="p-4 space-y-2">
      if (item()?.seller) {
        <A
          href={`/profile/${(item()?.seller?.id?.replace(/^user_?/, "") || "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(
            /_/g,
            "-",
          ).toLowerCase()}`}
          class="flex items-center gap-2 mb-1 hover:opacity-80 transition-opacity cursor-pointer group/seller">
          <UserAvatar
            name={(item()?.seller?.profile as any)?.fullName ?? item()?.seller?.name ?? "Người bán ẩn danh"}
            image={(item()?.seller?.profile as any)?.avatar?.link ?? item()?.seller?.image}
            class="w-5 h-5 text-[8px] border border-gray-200 group-hover/seller:ring-1 group-hover/seller:ring-blue-500"
          />
          <span
            class="text-[10px] font-bold text-gray-500 uppercase tracking-wider line-clamp-1 group-hover/seller:text-blue-600 transition-colors">
            {(item()?.seller?.profile as any)?.fullName ?? item()?.seller?.name ?? "Người bán ẩn danh"}
          </span>
        </A>
      }
      <h3 class="font-bold text-gray-800 line-clamp-1">
        {name ?? "Sản phẩm"}
      </h3>
      <p class="text-xs text-gray-400 line-clamp-2">{description ?? ""}</p>

      <div class="flex items-center justify-between">
        <p class="text-lg font-bold text-blue-600">
          {formatVN(price)}
          {currencySymbol()}
        </p>
        <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
          {category ?? "Chưa phân loại"}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class={status ? "text-green-600 text-xs" : "text-red-600 text-xs"}>
          {status ? "Còn hàng" : "Hết hàng"}
        </span>
      </div>
      {props.children}
    </div>
  </div>
}
