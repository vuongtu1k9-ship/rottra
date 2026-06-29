import { Show, createSignal, createEffect } from "solid-js";

const AVATAR_GRADIENTS = [
  "from-red-500 to-rose-600",
  "from-orange-500 to-amber-600",
  "from-yellow-500 to-amber-500",
  "from-green-500 to-emerald-600",
  "from-teal-500 to-cyan-600",
  "from-blue-500 to-indigo-600",
  "from-indigo-500 to-purple-600",
  "from-purple-500 to-pink-600",
  "from-pink-500 to-rose-600",
  "from-fuchsia-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
];

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
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const lastWord = parts[parts.length - 1];
  return lastWord.charAt(0).toUpperCase();
}

export function getGradientForName(name: string): string {
  if (!name) return "from-gray-400 to-gray-500";
  const hash = getNameHash(name);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export component UserAvatar(props: {
  name: string;
  image?: string | null;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}) {
  const [imageError, setImageError] = createSignal(false);

  // Reset error state if image changes
  createEffect(() => {
    props.image;
    setImageError(false);
  });

  const initials = () => getInitials(props.name || "User");
  const gradient = () => getGradientForName(props.name || "User");
  const hasValidImage = () => {
    const img = props.image;
    return img && img !== "" && img !== "/default-avatar.png" && !img.includes("default-avatar.png") && !imageError();
  };

  <Show
    when={hasValidImage()}
    fallback={<tsx>
      <div
        class={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient()} text-white font-bold select-none border border-white/10 shadow-sm ${
          props.class || "w-10 h-10 text-sm"
        }`}
        onClick={props.onClick}>
        {initials()}
      </div>
    </tsx>}>
    <img
      src={props.image!}
      class={`rounded-full object-cover border border-white/10 shadow-sm ${props.class || "w-10 h-10"}`}
      alt={props.name}
      onClick={props.onClick}
      onError={() => setImageError(true)}
    />
  </Show>
}
