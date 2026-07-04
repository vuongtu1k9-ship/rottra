import { Show, createSignal, createEffect } from "solid-js";

function getNameHash(name: string): number {
  let hash = 0;
  const cleanName = name.trim();
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getInitials(name: string): string {
  if (!name) return "?";
  const cleanName = name.trim();
  if (cleanName.length === 0) return "?";
  return cleanName.charAt(0).toUpperCase();
}

export function getGradientForName(name: string): string {
  if (!name) return "linear-gradient(135deg, #9ca3af, #6b7280)";
  const hash = getNameHash(name);
  const hue = hash % 360;
  // OKLCH values: L (Lightness), C (Chroma), H (Hue)
  // L=0.62/0.48 ensures uniform perceived brightness across all hues, guaranteeing text legibility.
  const color1 = `oklch(0.62 0.18 ${hue})`;
  const color2 = `oklch(0.48 0.18 ${(hue + 35) % 360})`;
  return `linear-gradient(135deg, ${color1}, ${color2})`;
}

export component UserAvatar(props: {
  name: string;
  image?: string | null;
  loading?: boolean;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const [imageError, setImageError] = createSignal(false);
  const [imageLoaded, setImageLoaded] = createSignal(false);

  // Reset states if image changes
  createEffect(() => {
    props.image;
    setImageError(false);
    setImageLoaded(false);
  });

  const initials = () => getInitials(props.name || "User");
  const gradient = () => getGradientForName(props.name || "User");
  const finalImage = () => {
    if (props.name === "Rottra" || props.name === "RottraAI") {
      return "/assets/rontra-default-agri.png";
    }
    return props.image;
  };

  const hasValidImage = () => {
    const img = finalImage();
    if (!img || img === "" || img === "/default-avatar.png" || img.includes("default-avatar.png") || imageError()) {
      return false;
    }
    // Block Gravatar default avatar hash, but allow if it's a locally uploaded custom file
    if (img.includes("c14419f70af6aa5bf55e0163e939afac") && !img.startsWith("/uploads/")) {
      return false;
    }
    return true;
  };

  <Show
    when={!props.loading}
    fallback={<tsx>
      <div
        class={`animate-pulse bg-gray-200 dark:bg-white/10 rounded-full border border-white/10 shadow-sm ${props.class || "w-10 h-10"}`}
      />
    </tsx>}>
    <Show
      when={hasValidImage()}
      fallback={<tsx>
        <div
          class={`flex items-center justify-center rounded-full text-white font-bold select-none border border-white/10 shadow-sm ${
            props.class || "w-10 h-10 text-sm"
          }`}
          style={{ background: gradient() }}
          onClick={props.onClick}>
          {initials()}
        </div>
      </tsx>}>
      <Show when={!imageLoaded()}>
        <div
          class={`animate-pulse bg-gray-200 dark:bg-white/10 rounded-full border border-white/10 shadow-sm ${props.class || "w-10 h-10"}`}
        />
      </Show>
      <img
        src={finalImage()!}
        class={`rounded-full object-cover border border-white/10 shadow-sm ${props.class || "w-10 h-10"} ${
          imageLoaded() ? "" : "absolute w-0 h-0 opacity-0 pointer-events-none"
        }`}
        alt={props.name}
        onClick={props.onClick}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </Show>
  </Show>
}
