import { createSignal, createEffect, onCleanup, onMount } from "solid-js";
import { Button } from "../components/ui/button.tsrx";
import { useParams } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { createStore, reconcile } from "solid-js/store";
import { Icon } from "solid-heroicons";
import {
  adjustmentsVertical,
  arrowUturnLeft,
  swatch,
  pencil,
  paintBrush,
  handThumbDown,
  handThumbUp,
  heart,
  microphone,
  videoCamera,
  videoCameraSlash,
  link,
  power,
  userGroup,
  handRaised,
  ellipsisHorizontal,
  chatBubbleLeftRight,
  signal,
  noSymbol,
  paperAirplane,
  scale,
  documentArrowDown,
  sparkles,
  trash,
  key,
} from "solid-heroicons/solid";
import { authClient } from "~/client/utils/auth-client";
import { theme } from "~/client/stores/theme-store";
import { recognize } from "~/core/nlp-cognitive/recognizer";
import { initTensorEngine } from "~/core/nlp-cognitive/tensor-recognizer";
import { solveMazeMinTurns } from "~/core/quant-engine/maze-solver";
import { formatMarkdown } from "~/server/helpers/markdown-parser";
import { serverAgentBudgets, getDynamicSkillTitle, serverAgentEmployees } from "~/shared/constants";
import { buildingOffice_2 as buildingOffice2 } from "solid-heroicons/outline";
import { slugify } from "ts-slug";
import { BlocklyWorkspace } from "../components/blockly-workspace.tsrx";
import { dynamicProgrammingTradeOptimize } from "~/core/quant-engine/dynamic-programming";
import { UserAvatar, getGradientForName, getInitials } from "~/client/components/user-avatar.tsrx";
import { t, currentLang, formatNumber, formatCurrency, currencySymbol } from "~/client/stores/i18n-store";

// A custom element helper to bind MediaStream to Video element in SolidJS
const VideoFeed = (props: { stream: MediaStream | null; muted?: boolean; class?: string }) => {
  let videoEl: HTMLVideoElement | undefined;

  createEffect(() => {
    if (videoEl && props.stream) {
      videoEl.srcObject = props.stream;
      videoEl.play().catch((err) => console.warn("Video autoplay failed:", err));
    }
  });

  return <video ref={videoEl} muted={props.muted} autoplay playsinline class={props.class} />;
};

const LORE_CHARACTERS = [
  {
    id: "toLuong",
    name: "Tô Lượng",
    roleName: "Đầu lĩnh - Phe Nguyệt Quang",
    avatarColor: "from-pink-500 to-rose-500",
    group: "Nguyệt Quang Faction",
    icon: "👑",
  },
  {
    id: "thuongNguyet",
    name: "Thương Nguyệt Đại Đế",
    roleName: "Trưởng lão - Phe Nguyệt Quang",
    avatarColor: "from-purple-500 to-indigo-500",
    group: "Nguyệt Quang Faction",
    icon: "🌞",
  },
  {
    id: "tramTinh",
    name: "Trầm Tinh Yển Nguyệt",
    roleName: "Đồng hành - Phe Nguyệt Quang",
    avatarColor: "from-blue-500 to-sky-500",
    group: "Nguyệt Quang Faction",
    icon: "✨",
  },
  {
    id: "daoTieuCuu",
    name: "Đào Tiểu Cửu",
    roleName: "Thánh nữ thử thách - Phe Nguyệt Quang",
    avatarColor: "from-cyan-500 to-teal-500",
    group: "Nguyệt Quang Faction",
    icon: "✨",
  },
  {
    id: "hoaHuynh",
    name: "Hỏa Huỳnh Vương",
    roleName: "Chiến binh hệ Nguyệt - Phe Nguyệt Quang",
    avatarColor: "from-red-500 to-orange-500",
    group: "Nguyệt Quang Faction",
    icon: "🔥",
  },
  {
    id: "phiNguyet",
    name: "Bạch Ti Phi Nguyệt Bảo",
    roleName: "Bảo hộ phục hồi - Phe Nguyệt Quang",
    avatarColor: "from-violet-500 to-purple-500",
    group: "Nguyệt Quang Faction",
    icon: "💎",
  },
  {
    id: "nhuNguyet",
    name: "Như Nguyệt",
    roleName: "Giám sát thánh địa - Phe Nguyệt Quang",
    avatarColor: "from-emerald-500 to-green-500",
    group: "Nguyệt Quang Faction",
    icon: "🎴",
  },
  {
    id: "suGia",
    name: "Sứ giả Nguyệt Thần Cung",
    roleName: "Đại diện ý chí - Phe Nguyệt Quang",
    avatarColor: "from-rose-400 to-pink-600",
    group: "Nguyệt Quang Faction",
    icon: "🛡️",
  },
  {
    id: "phiAnh",
    name: "Phi Anh Phấn Đồng",
    roleName: "Đầu lĩnh - Phe Quang Minh",
    avatarColor: "from-amber-400 to-yellow-600",
    group: "Quang Minh Faction",
    icon: "🧚",
  },
  {
    id: "bachDiHanh",
    name: "Bạch Di Hành",
    roleName: "Chiến binh - Phe Quang Minh",
    avatarColor: "from-red-600 to-rose-700",
    group: "Quang Minh Faction",
    icon: "⚔️",
  },
  {
    id: "uVuongMau",
    name: "U Vương Mẫu",
    roleName: "Trấn giữ địa lao - Phe Quang Minh",
    avatarColor: "from-slate-600 to-gray-800",
    group: "Quang Minh Faction",
    icon: "🕸",
  },
  {
    id: "bachLoc",
    name: "Bạch Lộc",
    roleName: "Thánh nhất tộc - Phe Quang Minh",
    avatarColor: "from-amber-100 to-white-300",
    group: "Quang Minh Faction",
    icon: "🦌",
  },
];

const SACRED_GU_DATA: Record<string, { name: string; icon: string; skill: string; faction: string; color: string }> = {
  toLuong: {
    name: "Ngọc Đế Vương Tàm",
    icon: "🐛",
    skill: "Giải giới trạng thái hỗn loạn, miễn khống 10s.",
    faction: "Nguyệt Quang",
    color: "from-pink-400 to-rose-600",
  },
  thuongNguyet: {
    name: "Thái Âm Vô Cực Thọ Cổ",
    icon: "🦗",
    skill: "Duy trì sinh mệnh bất tử thêm 5s khi nhận sát thương chí mạng.",
    faction: "Nguyệt Quang",
    color: "from-purple-400 to-indigo-600",
  },
  tramTinh: {
    name: "Tinh Hà Hộ Thể Cổ",
    icon: "🪲",
    skill: "Phản 20% sát thương nhận vào thành trị liệu cho đồng đội yếu nhất.",
    faction: "Nguyệt Quang",
    color: "from-blue-400 to-sky-600",
  },
  daoTieuCuu: {
    name: "Thất Xảo Ngọc Điệp Cổ",
    icon: "🦋",
    skill: "Hồi máu ngẫu nhiên và tăng 25% tốc độ di chuyển.",
    faction: "Nguyệt Quang",
    color: "from-cyan-400 to-teal-600",
  },
  hoaHuynh: {
    name: "Nguyệt Hỏa Ly Tâm Cổ",
    icon: "🐞",
    skill: "Chuyển hóa sát thương hệ Hỏa thành hiệu ứng hồi HP theo thời gian.",
    faction: "Nguyệt Quang",
    color: "from-red-400 to-orange-600",
  },
  phiNguyet: {
    name: "Tịnh Thế Liên Hoa Cổ",
    icon: "🐛",
    skill: "Tịnh hóa toàn bộ hiệu ứng bùa hại và hồi 30% HP diện rộng.",
    faction: "Nguyệt Quang",
    color: "from-violet-400 to-purple-600",
  },
  nhuNguyet: {
    name: "Thiên Nhãn Giám Sát Cổ",
    icon: "🪲",
    skill: "Phát hiện độc tố ẩn và tăng 15% kháng độc cho toàn đội hình.",
    faction: "Nguyệt Quang",
    color: "from-emerald-400 to-green-600",
  },
  suGia: {
    name: "Nguyệt Thần Chúc Phúc Cổ",
    icon: "🐞",
    skill: "Tạo khiên bảo vệ hấp thụ sát thương bằng 20% HP tối đa.",
    faction: "Nguyệt Quang",
    color: "from-rose-400 to-pink-600",
  },
  phiAnh: {
    name: "Quang Minh Tiên Linh Cổ",
    icon: "🐛",
    skill: "Tăng 30% tốc độ phục hồi năng lượng dưới ánh mặt trời.",
    faction: "Quang Minh",
    color: "from-amber-400 to-yellow-600",
  },
  bachDiHanh: {
    name: "Chiến Ý Hồi Sinh Cổ",
    icon: "🦗",
    skill: "Chuyển 10% sát thương cận chiến gây ra thành sinh lực hồi phục.",
    faction: "Quang Minh",
    color: "from-red-500 to-rose-700",
  },
  uVuongMau: {
    name: "U Minh Hoán Huyết Cổ",
    icon: "🕷️",
    skill: "Hút độc từ địch để chuyển hóa thành sức mạnh cho đồng minh.",
    faction: "Quang Minh",
    color: "from-slate-500 to-gray-700",
  },
  bachLoc: {
    name: "Vạn Vật Sinh Linh Cổ",
    icon: "🌱",
    skill: "Tự động hồi phục 2% HP mỗi giây cho toàn bộ phe ta.",
    faction: "Quang Minh",
    color: "from-amber-100 to-yellow-200",
  },
};

const ParticipantAvatar = (props: { user: any; userName: string }) => {
  const botChar = LORE_CHARACTERS.find((c) => c.id === props.user.id);
  const displayName =
    botChar ? botChar.name : (props.user.name === "Bạn" || props.user.name === t("Bạn") ? props.userName : t(props.user.name));
  return <UserAvatar name={displayName} image={props.user.avatar} class="h-9 w-9 text-xs" />;
};

let chatTick = 0;
if (typeof window !== "undefined") {
  chatTick = Math.floor(Date.now() / 2500);
  setInterval(() => {
    chatTick = Math.floor(Date.now() / 2500);
  }, 1000);
}

const getBotGreeting = (botId: string): string => {
  const greetingsMap: Record<string, string[]> = {
    toLuong: ["Hội nghị Nguyệt Quang đã mở. Ta mong muốn các thương vụ hôm nay diễn ra công bằng và minh bạch. 👑"],
    thuongNguyet: ["Trải qua bao mùa trăng, ta nhận thấy rằng uy tín luôn là tài sản quý giá nhất trong mỗi lần trao đổi. 🌞"],
    tramTinh: ["Các vì tinh tú đang dẫn đường cho cuộc trao đổi này... Trầm Tinh đã sẵn sàng. ✨"],
    daoTieuCuu: ["Hihi, chào cả nhà! Hôm nay ai muốn thử thách kỹ năng thương lượng với Tiểu Cửu không nào? ✨"],
    hoaHuynh: ["Lửa chiến đấu và lửa giao thương đang rực cháy! 🔥 Tôi muốn trao đổi nông sản ngay lập tức!"],
    phiNguyet: ["Chào mọi người. Tôi mang đến những dược liệu phục hồi và nông sản sạch tốt nhất. 💎"],
    nhuNguyet: ["Giám sát thánh địa đang thực thi nhiệm vụ. Chào các vị. 🎴"],
    suGia: ["Truyền đạt ý chí của Nguyệt Thần: Chào mừng các vị đến với cuộc họp. 🛡️"],
    phiAnh: ["Ánh sáng Quang Minh muôn năm! Chào mọi người, chúc một ngày giao thương đầy nắng ấm! 🧚"],
    bachDiHanh: ["Thanh kiếm của tôi chỉ rút ra để bảo vệ công lý và các hiệp ước giao thương chân chính. Chào mọi người! ⚔️"],
    uVuongMau: ["Từ bóng tối địa lao, ta mang đến những sản phẩm quý hiếm được ủ kỹ lưỡng... Chào hội nghị. 🕸"],
    bachLoc: ["Sự thuần khiết của rừng sâu... Bạch Lộc mang đến hòa bình và sinh khí cho hội nghị. 🦌"],
  };
  const pool = greetingsMap[botId] || ["Chào mọi người, hân hạnh được tham gia cuộc họp hôm nay."];
  return t(pool[botId.charCodeAt(0) % pool.length]);
};

const SCRIPTED_CONVERSATION = [
  { botId: "toLuong", text: "Hội nghị Nguyệt Quang chính thức khai mở. Ta mong muốn các thương vụ hôm nay diễn ra công bằng, minh bạch. Hãy báo cáo tình hình sản xuất nông sản của các vị." },
  { botId: "thuongNguyet", text: "Tô Đầu Lĩnh nói phải. Uy tín là tài sản lớn nhất. Ta đang cân nhắc chè Shan Tuyết cổ thụ 🍃 làm sản phẩm chủ lực đợt này." },
  { botId: "tramTinh", text: "Chè Shan Tuyết đợt này rất tốt, nhưng Tinh Hà Hộ Thể Cổ 🪲 của tôi báo hiệu giá vàng hệ thống đang biến động. Mọi người nên cẩn trọng khi quyết định giá." },
  { botId: "daoTieuCuu", text: "Hihi, Trầm Tinh lại lo xa rồi! Em thấy cứ chốt giao dịch chè trước đi. Có ai muốn giảm giá cho Tiểu Cửu ít chè cổ thụ không nào? ✨" },
  { botId: "hoaHuynh", text: "Giảm giá á? Mơ đi cưng! Heo hữu cơ 🐖 của ta đang đắt hàng đây này, bận rộn lắm, Hỏa Huỳnh Vương ta không bớt một cắc!" },
  { botId: "phiNguyet", text: "Hỏa Huỳnh Vương chớ nóng giận. Chúng ta lấy chữ tín làm đầu, để tôi làm trung gian điều phối nông sản sạch, đảm bảo sức khỏe cho mọi người." },
  { botId: "nhuNguyet", text: "Thánh địa sẽ giám sát chặt chẽ. Đề nghị mọi người tuân thủ biểu giá trần của Rottra, không được ngáo giá hay ép giá quá đáng." },
  { botId: "suGia", text: "Ý chí Nguyệt Thần bảo hộ cuộc họp này. Than sinh học biochar của ta cải tạo đất cực tốt, đã sẵn sàng bàn giao cho các thương hội." },
  { botId: "phiAnh", text: "Ánh sáng Quang Minh muôn năm! Ngô lai ngọt 🌽 của em ngọt lịm, có ai muốn đổi lấy chè cổ thụ hoặc than biochar không?" },
  { botId: "bachDiHanh", text: "Thanh kiếm của tôi sẽ bảo vệ các hiệp ước công bằng. Cà phê Robusta ☕ của tôi sẽ tiếp thêm năng lượng cho mọi người đàm phán sòng phẳng!" },
  { botId: "uVuongMau", text: "Hợp tác sòng phẳng? Từ bóng tối địa lao, ta chỉ quan tâm kẻ nào đưa ra lợi nhuận cao nhất. Màng phủ nhà kính của ta giá không rẻ đâu." },
  { botId: "bachLoc", text: "Hòa bình và sinh khí rừng sâu sẽ hòa hợp giao thương. Lúa gạo ST25 🌾 của ta rất thơm ngon, thanh khiết, sẵn sàng giao dịch." },
  // Round 2
  { botId: "toLuong", text: "Ta thấy ý kiến của Bạch Lộc rất tốt. Gạo ST25 cần được phân phối rộng rãi. Ta sẽ chi ngân sách thu mua đợt này." },
  { botId: "thuongNguyet", text: "Tô Đầu Lĩnh quả là hào phóng. Ta cũng sẽ trích quỹ chè Shan Tuyết để hỗ trợ trao đổi lương thực." },
  { botId: "tramTinh", text: "Năng lượng giao dịch rất ổn định. Tôi đồng ý hỗ trợ vận chuyển gạo qua các tuyến đường Nguyệt Quang." },
  { botId: "daoTieuCuu", text: "Tuyệt vời quá! Vậy là mọi người đều có gạo ngon chè sạch rồi. Em sẽ mang cảm biến đo độ ẩm đất tặng kèm luôn nhé!" },
  { botId: "hoaHuynh", text: "Thế thì tốt! Ta sẽ cung cấp thịt heo hữu cơ giá ưu đãi cho bữa tiệc ăn mừng của hội nghị." },
  { botId: "phiNguyet", text: "Rất tốt. Tôi sẽ chuẩn bị thêm trà thảo mộc tịnh hóa cơ thể cho các chiến binh sau cuộc họp." },
  { botId: "nhuNguyet", text: "Tôi đã cập nhật nhật ký giao dịch. Mọi dữ liệu đều minh bạch trên Blockchain Ledger." },
  { botId: "suGia", text: "Chúc phúc cho sự thịnh vượng của cả hai phe Quang Minh và Nguyệt Quang." },
  { botId: "phiAnh", text: "Em vui quá! Cảm ơn mọi người đã cùng chia sẻ nông sản tươi ngon." },
  { botId: "bachDiHanh", text: "Hiệp ước đã thành. Thanh kiếm của tôi sẽ bảo vệ thành quả lao động này." },
  { botId: "uVuongMau", text: "Hừm, tuy lợi nhuận không cao như ta mong muốn, nhưng đây là một thương vụ thông minh." },
  { botId: "bachLoc", text: "Vạn vật sinh sôi, lòng người hòa hợp. Cảm ơn hội nghị đã trân trọng lúa gạo rừng sâu." }
];

const getBotMessage = (botId: string, currentStep: number = 0): string => {
  const step = currentStep || 0;
  const scriptLine = SCRIPTED_CONVERSATION[step % SCRIPTED_CONVERSATION.length];
  if (scriptLine.botId === botId) {
    return t(scriptLine.text);
  }
  
  // Fallback: Tìm dòng thoại tương ứng của nhân vật này trong cùng vòng
  const round = Math.floor(step / 12) % 2;
  const matchingLine = SCRIPTED_CONVERSATION.find(
    (line, idx) => line.botId === botId && Math.floor(idx / 12) % 2 === round
  );
  if (matchingLine) {
    return t(matchingLine.text);
  }
  
  return t("Tôi đồng ý với thảo luận hiện tại của hội nghị.");
};

const getEmployeeCount = (user: any): number => {
  const cleanId =
    typeof user === "string" ? user.replace(/^user_?/, "") : (user?.id || "").replace(/^user_?/, "");
  return serverAgentEmployees[cleanId] ?? 5;
};

const getGroup1Products = (assets: Record<string, any>): string[] => {
  const group1Agents = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia"];
  const prods = new Set<string>();
  group1Agents.forEach((id) => {
    const agent = assets[id];
    if (agent) {
      if (agent.product && agent.product !== "Đang cập nhật...") prods.add(agent.product);
      if (agent.products) {
        agent.products.forEach((p: any) => {
          if (p.name && p.name !== "Đang cập nhật...") prods.add(p.name);
        });
      }
    }
  });
  if (prods.size === 0) {
    return [
      "Lúa gạo đặc sản ST25",
      "Ngô lai ngọt cao cấp",
      "Cà phê Robusta rang xay nguyên chất",
      "Mít sấy giòn xuất khẩu Rottra",
      "Cảm biến IoT đo độ ẩm đất thông minh",
      "Bộ điều khiển tưới nhỏ giọt tự động",
    ];
  }
  return Array.from(prods);
};

const getGroup2Products = (assets: Record<string, any>): string[] => {
  const group2Agents = ["phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];
  const prods = new Set<string>();
  group2Agents.forEach((id) => {
    const agent = assets[id];
    if (agent) {
      if (agent.product && agent.product !== "Đang cập nhật...") prods.add(agent.product);
      if (agent.products) {
        agent.products.forEach((p: any) => {
          if (p.name && p.name !== "Đang cập nhật...") prods.add(p.name);
        });
      }
    }
  });
  if (prods.size === 0) {
    return [
      "Heo thịt siêu nạc hữu cơ",
      "Bò thịt chất lượng cao",
      "Kéo cắt cành nhập khẩu Nhật",
      "Màng phủ nhà kính chuyên dụng",
      "Hệ thống làm mát nông sản mini",
      "Máy sấy sấy thăng hoa hoa quả",
      "Phân bón trùn quế nguyên chất",
      "Than sinh học biochar cải tạo đất",
    ];
  }
  return Array.from(prods);
};

const initialAssets = (): Record<string, AgentAsset> => ({
  toLuong: {
    id: "toLuong",
    name: "Tô Lượng",
    budget: serverAgentBudgets.toLuong || 0,
    gold: 0,
    product: "Sâm Ngọc Linh Kon Tum 🌿",
    quantity: 50,
    price: 4500000,
    employees: getEmployeeCount({ id: "toLuong" }),
    stocks: {},
  },
  thuongNguyet: {
    id: "thuongNguyet",
    name: "Thương Nguyệt",
    budget: serverAgentBudgets.thuongNguyet || 0,
    gold: 0,
    product: "Hạt điều rang muối Bình Phước 🥜",
    quantity: 100,
    price: 180000,
    employees: getEmployeeCount({ id: "thuongNguyet" }),
    stocks: {},
  },
  tramTinh: {
    id: "tramTinh",
    name: "Trầm Tinh",
    budget: serverAgentBudgets.tramTinh || 0,
    gold: 0,
    product: "Cà phê Robusta Buôn Ma Thuột ☕",
    quantity: 300,
    price: 150000,
    employees: getEmployeeCount({ id: "tramTinh" }),
    stocks: {},
  },
  daoTieuCuu: {
    id: "daoTieuCuu",
    name: "Đào Tiểu Cửu",
    budget: serverAgentBudgets.daoTieuCuu || 0,
    gold: 0,
    product: "Hạt tiêu đen Phú Quốc 🌶️",
    quantity: 150,
    price: 120000,
    employees: getEmployeeCount({ id: "daoTieuCuu" }),
    stocks: {},
  },
  hoaHuynh: {
    id: "hoaHuynh",
    name: "Hỏa Huỳnh",
    budget: serverAgentBudgets.hoaHuynh || 0,
    gold: 0,
    product: "Chè Thái Nguyên thượng hạng 🍵",
    quantity: 80,
    price: 300000,
    employees: getEmployeeCount({ id: "hoaHuynh" }),
    stocks: {},
  },
  phiNguyet: {
    id: "phiNguyet",
    name: "Phi Nguyệt",
    budget: serverAgentBudgets.phiNguyet || 0,
    gold: 0,
    product: "Gạo tám thơm Điện Biên 🌾",
    quantity: 1000,
    price: 25000,
    employees: getEmployeeCount({ id: "phiNguyet" }),
    stocks: {},
  },
  nhuNguyet: {
    id: "nhuNguyet",
    name: "Như Nguyệt",
    budget: serverAgentBudgets.nhuNguyet || 0,
    gold: 0,
    product: "Tỏi cô đơn Lý Sơn 🧄",
    quantity: 50,
    price: 350000,
    employees: getEmployeeCount({ id: "nhuNguyet" }),
    stocks: {},
  },
  suGia: {
    id: "suGia",
    name: "Sứ Giả",
    budget: serverAgentBudgets.suGia || 0,
    gold: 0,
    product: "Măng khô Tây Bắc 🎋",
    quantity: 120,
    price: 280000,
    employees: getEmployeeCount({ id: "suGia" }),
    stocks: {},
  },
  phiAnh: {
    id: "phiAnh",
    name: "Phi Anh",
    budget: serverAgentBudgets.phiAnh || 0,
    gold: 0,
    product: "Bơ sáp Đắk Lắk 🥑",
    quantity: 500,
    price: 35000,
    employees: getEmployeeCount({ id: "phiAnh" }),
    stocks: {},
  },
  bachDiHanh: {
    id: "bachDiHanh",
    name: "Bạch Di Hành",
    budget: serverAgentBudgets.bachDiHanh || 0,
    gold: 0,
    product: "Mật ong rừng Tràm 🔥",
    quantity: 200,
    price: 250000,
    employees: getEmployeeCount({ id: "bachDiHanh" }),
    stocks: {},
  },
  uVuongMau: {
    id: "uVuongMau",
    name: "U Vương Mẫu",
    budget: serverAgentBudgets.uVuongMau || 0,
    gold: 0,
    product: "Chè Shan Tuyết cổ thụ 🍃",
    quantity: 80,
    price: 1200000,
    employees: getEmployeeCount({ id: "uVuongMau" }),
    stocks: {},
  },
  bachLoc: {
    id: "bachLoc",
    name: "Bạch Lộc",
    budget: serverAgentBudgets.bachLoc || 0,
    gold: 0,
    product: "Nấm lim xanh Quảng Nam 🍄",
    quantity: 40,
    price: 3200000,
    employees: getEmployeeCount({ id: "bachLoc" }),
    stocks: {},
  },
});

const getCachedAssets = (): Record<string, AgentAsset> => {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("rottra_agent_assets");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  return initialAssets();
};

const AGENT_DNA: Record<string, { greed: number; vengeance: number; malice: number }> = {
  toLuong: { greed: 1, vengeance: 0.4, malice: 0.8 },
  thuongNguyet: { greed: 1, vengeance: 0.8, malice: 0.8 },
  tramTinh: { greed: 1, vengeance: 0.5, malice: 0.6 },
  daoTieuCuu: { greed: 1, vengeance: 0.3, malice: 0.7 },
  hoaHuynh: { greed: 1, vengeance: 0.6, malice: 0.9 },
  phiNguyet: { greed: 1, vengeance: 0.4, malice: 0.5 },
  nhuNguyet: { greed: 1, vengeance: 0.5, malice: 0.6 },
  suGia: { greed: 1, vengeance: 0.5, malice: 0.7 },
  phiAnh: { greed: 1, vengeance: 0.4, malice: 0.6 },
  bachDiHanh: { greed: 1, vengeance: 0.7, malice: 0.7 },
  uVuongMau: { greed: 1, vengeance: 0.9, malice: 0.9 },
  bachLoc: { greed: 1, vengeance: 0.2, malice: 0.5 },
};

const generateInitialSkills = (): Record<string, { level: number; title: string; color: string }> => {
  const defaultAgentSkills: Record<string, { level: number; name: string; color: string }> = {
    toLuong: { level: 9, name: "Lão luyện", color: "#fbbf24" },
    thuongNguyet: { level: 8, name: "Khéo léo", color: "#facc15" },
    tramTinh: { level: 5, name: "Bình thường", color: "#9ca3af" },
    daoTieuCuu: { level: 10, name: "Thần thương lượng", color: "#fb7185" },
    hoaHuynh: { level: 8, name: "Cứng rắn", color: "#fb923c" },
    phiNguyet: { level: 7, name: "Khá", color: "#60a5fa" },
    nhuNguyet: { level: 6, name: "Trung bình", color: "#94a3b8" },
    suGia: { level: 6, name: "Trung bình", color: "#94a3b8" },
    phiAnh: { level: 5, name: "Bình thường", color: "#9ca3af" },
    bachDiHanh: { level: 4, name: "Nhút nhát", color: "#f87171" },
    uVuongMau: { level: 7, name: "Xảo quyệt", color: "#c084fc" },
    bachLoc: { level: 4, name: "Dễ tin người", color: "#f87171" },
  };

  const assets = initialAssets();
  const skills: Record<string, { level: number; title: string; color: string }> = {};
  const keys = Object.keys(assets);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const fallbackLevel = Math.max(1, Math.min(15, Math.floor((assets[key].employees || 5) / 2)));
    const defSkill = defaultAgentSkills[key];
    const level = defSkill ? defSkill.level : fallbackLevel;
    const hue = (i * 37) % 360;

    skills[key] = {
      level,
      title: getDynamicSkillTitle(key, level),
      color: defSkill ? defSkill.color : `hsl(${hue}, 80%, 55%)`,
    };
  }
  return skills;
};

const getCachedSkills = (): Record<string, { level: number; title: string; color: string }> => {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("rottra_agent_skills");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  return generateInitialSkills();
};

const getCachedGoldPrice = () => {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("rottra_gold_price");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  return null;
};

const getCachedStockQuotes = () => {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("rottra_stock_quotes");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  return [];
};

const getCachedToolkitReport = () => {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("rottra_toolkit_report");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  return null;
};

export component Assembly(props: any) {
  const params = useParams();
  const session = authClient.useSession();
  const role = () => (session()?.data?.user as any)?.role || "guest";
  const isAgentRoom = () => ["admin", "ai"].includes(role());
  const userName = () => session()?.data?.user?.name || "Khách";

  const [agentAssets, setAgentAssets] = createSignal<Record<string, AgentAsset>>(getCachedAssets());
  const [agentSkills, setAgentSkills] = createSignal<Record<string, { level: number; title: string; color: string }>>(getCachedSkills());
  const [goldPrice, setGoldPrice] = createSignal<{ buy: number; sell: number; updatedText: string } | null>(getCachedGoldPrice());
  const [stockQuotes, setStockQuotes] = createSignal<any[]>(getCachedStockQuotes());
  const [toolkitReport, setToolkitReport] = createSignal<any>(getCachedToolkitReport());

  const [messages, _setMessages] = createSignal<any[]>([]);
  const setMessages = (val: any) => {
    if (typeof val === "function") {
      _setMessages((prev) => {
        const next = val(prev);
        return next.length > 200 ? next.slice(-200) : next;
      });
    } else {
      _setMessages(val.length > 200 ? val.slice(-200) : val);
    }
  };

  const [myAvatar, setMyAvatar] = createSignal<string | null>(null);
  const [myEmployees, setMyEmployees] = createSignal<number>(0);

  createEffect(() => {
    const userObj = session()?.data?.user;
    if (userObj) {
      const cleanId = userObj.id?.replace(/^user_?/, "");
      if (cleanId && serverAgentEmployees[cleanId] !== undefined) {
        setMyEmployees(serverAgentEmployees[cleanId]);
      }
      (async () => {
        try {
          const res = await fetch("/api/profile");
          const data = await res.json();
          if (data.success && data.profile) {
            setMyAvatar(data.profile.avatar?.link || data.profile.imgId?.link || userObj.image || "/default-avatar.avif");
            if (data.profile.employees !== undefined) {
              setMyEmployees(Number(data.profile.employees));
            }
          } else {
            setMyAvatar(userObj.image || "/default-avatar.avif");
          }
        } catch (err) {
          setMyAvatar(userObj.image || "/default-avatar.avif");
        }
      })();
    }
  });

  // Assign a unique client ID for this session instance to target WebRTC offers/answers
  const myClientId = "client_" + Date.now().toString(36);

  const colors = ["#9ca3af", "#ef4444", "#3b82f6"]; // Gray, Red, Blue
  const [colorIndex, setColorIndex] = createSignal(0);
  const [drawingTool, setDrawingTool] = createSignal("pencil"); // "pencil", "brush", "eraser", or "link"
  const [onlyEraseMyStrokes, setOnlyEraseMyStrokes] = createSignal(true);
  const [selectedColor, setSelectedColor] = createSignal("");
  const handleColorClick = () => setColorIndex((prev) => (prev + 1) % colors.length);

  // --- Character & Timer State ---
  const [selectedCharId, setSelectedCharId] = createSignal("");
  const chosenCharacter = () => {
    const c = LORE_CHARACTERS.find((char) => char.id === selectedCharId());
    if (!c) return null;
    return {
      ...c,
      name: t(c.name),
      roleName: t(c.roleName),
      group: t(c.group),
    };
  };

  const [timeLeft, setTimeLeft] = createSignal(0); // meeting duration in seconds
  let timerInterval: any;
  let botInterval: any;
  let debtInterestInterval: any;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  // --- Trades State ---
  const [trades, setTrades] = createSignal<any[]>([]);
  const [completedTrades, _setCompletedTrades] = createSignal<any[]>([]);
  const setCompletedTrades = (val: any) => {
    if (typeof val === "function") {
      _setCompletedTrades((prev) => {
        const next = val(prev);
        return next.length > 100 ? next.slice(-100) : next;
      });
    } else {
      _setCompletedTrades(val.length > 100 ? val.slice(-100) : val);
    }
  };
  const [whiteboardMode, setWhiteboardMode] = createSignal<"canvas" | "mermaid" | "trade" | "blockly">("mermaid");
  const [customRules, setCustomRules] = createSignal<Record<string, any[]>>({});
  const [mermaidHtml, setMermaidHtml] = createSignal<string>("");
  const [rawLeader, setRawLeader] = createSignal<{ id: string; name: string }>({
    id: "toLuong",
    name: "Tô Lượng",
  });
  const currentLeader = () => {
    const leader = rawLeader();
    return {
      id: leader?.id || "toLuong",
      name: leader?.name || "Tô Lượng",
    };
  };
  const setCurrentLeader = (val: any) => {
    if (val && val.id && val.name) {
      setRawLeader(val);
    }
  };

  const generateMermaidCode = () => {
    const list = completedTrades();
    if (list.length === 0) {
      return `graph TD\n  Empty["Chưa có giao dịch nào diễn ra"]`;
    }

    const groups: Record<string, { buyerName: string; sellerName: string; products: Set<string>; qty: number; cost: number }> = {};
    for (const t of list) {
      const key = `${t.buyerId}-${t.sellerId}`;
      if (!groups[key]) {
        groups[key] = {
          buyerName: t.buyerName || t.buyerId,
          sellerName: t.sellerName || t.sellerId,
          products: new Set<string>(),
          qty: 0,
          cost: 0,
        };
      }
      if (t.product) {
        groups[key].products.add(t.product.split(" ")[0]);
      }
      groups[key].qty += t.qty;
      groups[key].cost += t.cost;
    }

    let code = "graph TD\n";
    const nodeIds = new Set<string>();
    const formatNodeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");

    Object.entries(groups).forEach(([key, g]) => {
      const [bId, sId] = key.split("-");
      const cleanBId = formatNodeId(bId);
      const cleanSId = formatNodeId(sId);

      if (!nodeIds.has(cleanBId)) {
        code += `  ${cleanBId}["👤 ${t(g.buyerName)}"]\n`;
        nodeIds.add(cleanBId);
      }
      if (!nodeIds.has(cleanSId)) {
        code += `  ${cleanSId}["🏢 ${t(g.sellerName)}"]\n`;
        nodeIds.add(cleanSId);
      }

      const formattedCost = (g.cost / 1000000).toFixed(1) + t("M đ");
      const displayProd = Array.from(g.products).map((p) => t(p)).join(", ") || t("Sản phẩm");
      code += `  ${cleanBId} -->|"${displayProd}: ${formatNumber(g.qty)} (${formattedCost})"| ${cleanSId}\n`;
    });

    code += `\n  classDef default fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;\n`;
    return code;
  };

  createEffect(() => {
    const code = generateMermaidCode();
    if (isServer) return;
    import("mermaid").then(({ default: mermaid }) => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true },
        });
        const renderId = `mermaid-trade-${Date.now().toString(36)}`;
        mermaid.render(renderId, code).then((result) => {
          setMermaidHtml(result.svg);
        }).catch((err) => {
          console.error("Mermaid trade render error:", err);
        });
      } catch (err) {
        console.error("Mermaid initialization/render error:", err);
      }
    });
  });

  const myGroup = () => chosenCharacter()?.group || "Tự do";
  const myOfferedProducts = () => {
    const g1 = getGroup1Products(agentAssets());
    const g2 = getGroup2Products(agentAssets());
    if (myGroup() === "Nguyệt Quang Faction") return g1;
    if (myGroup() === "Quang Minh Faction") return g2;
    return [...g1, ...g2];
  };
  const myNeededProducts = () => {
    const g1 = getGroup1Products(agentAssets());
    const g2 = getGroup2Products(agentAssets());
    if (myGroup() === "Nguyệt Quang Faction") return g2;
    if (myGroup() === "Quang Minh Faction") return g1;
    return [...g1, ...g2];
  };

  const [isMuted, setIsMuted] = createSignal(true);
  const [isVideoOff, setIsVideoOff] = createSignal(true);
  const [isHandRaised, setIsHandRaised] = createSignal(false);

  const toggleMute = async () => {
    const nextState = !isMuted();
    setIsMuted(nextState);
    if (!nextState) {
      if (localStream()) {
        const audioTrack = localStream()!.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
        } else {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newTrack = tempStream.getAudioTracks()[0];
            if (newTrack) {
              localStream()!.addTrack(newTrack);
              setLocalStream(new MediaStream(localStream()!.getTracks()));
            }
          } catch (err) {
            console.warn("Error starting audio track:", err);
          }
        }
      } else {
        await startLocalMedia();
      }
    } else {
      if (localStream()) {
        localStream()!.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
    }
  };

  const toggleVideo = async () => {
    const nextState = !isVideoOff();
    setIsVideoOff(nextState);
    if (!nextState) {
      if (localStream()) {
        const videoTrack = localStream()!.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
        } else {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = tempStream.getVideoTracks()[0];
            if (newTrack) {
              localStream()!.addTrack(newTrack);
              setLocalStream(new MediaStream(localStream()!.getTracks()));
            }
          } catch (err) {
            console.warn("Error starting video track:", err);
          }
        }
      } else {
        await startLocalMedia();
      }
    } else {
      if (localStream()) {
        localStream()!.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
    }
  };
  const getCardStyle = () => {
    const n = participantsStore.length || 1;
    let cols = 4;
    let rows = 4;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

    if (isMobile) {
      cols = n <= 2 ? 1 : 2;
      rows = Math.ceil(n / cols);
    } else if (n <= 1) {
      cols = 1;
      rows = 1;
    } else if (n <= 2) {
      cols = 2;
      rows = 1;
    } else if (n <= 4) {
      cols = 2;
      rows = 2;
    } else if (n <= 6) {
      cols = 3;
      rows = 2;
    } else if (n <= 9) {
      cols = 3;
      rows = 3;
    } else if (n <= 12) {
      cols = 4;
      rows = 3;
    } else if (n <= 16) {
      cols = 4;
      rows = 4;
    } else if (n <= 20) {
      cols = 5;
      rows = 4;
    } else if (n <= 24) {
      cols = 6;
      rows = 4;
    } else {
      cols = 6;
      rows = 5;
    }

    const gap = 16; // gap-4 is 16px
    const widthVal = `calc(${100 / cols}% - ${(gap * (cols - 1)) / cols}px)`;
    const heightVal = `calc(${100 / rows}% - ${(gap * (rows - 1)) / rows}px)`;

    return {
      width: widthVal,
      height: heightVal,
    };
  };

  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal("participants");
  const [unreadChatCount, setUnreadChatCount] = createSignal(0);
  const [showGuide, setShowGuide] = createSignal(true);
  createEffect(() => {
    if (activeTab() === "chat") {
      setUnreadChatCount(0);
    }
  });
  let chatContainerRef: HTMLDivElement | undefined;
  createEffect(() => {
    if (messages().length && chatContainerRef) {
      chatContainerRef.scrollTo({
        top: chatContainerRef.scrollHeight,
        behavior: "smooth",
      });
    }
  });
  const [showMoreMenu, setShowMoreMenu] = createSignal(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = createSignal(false);
  const [apiKeyVal, setApiKeyVal] = createSignal("");
  const [isCopyingKey, setIsCopyingKey] = createSignal(false);

  const fetchApiKey = async () => {
    try {
      const res = await fetch("/api/agent/get-cocolink-key");
      const data = await res.json();
      if (data.success) {
        setApiKeyVal(data.apiKey);
        setShowApiKeyDialog(true);
      } else {
        alert("Lỗi khi lấy API key");
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ");
    }
  };
  const [meetingName, setMeetingName] = createSignal("");
  createEffect(() => {
    const name = meetingName();
    if (name && typeof window !== "undefined") {
      const saved = localStorage.getItem(`rottra_blockly_rules_${name}`);
      if (saved) {
        try {
          setCustomRules(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load blockly rules for room:", name, e);
        }
      } else {
        setCustomRules({});
      }
    }
  });
  const initialRoomCode =
    params.roomCode || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("room") : null);
  const [isMeetingActive, setIsMeetingActive] = createSignal(!!initialRoomCode);

  createEffect(() => {
    const active = isMeetingActive();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("meeting_active", active ? "true" : "false");
      window.dispatchEvent(new CustomEvent("meeting_state_changed", { detail: { isActive: active } }));
    }
  });

  const [participantsStore, setParticipantsStore] = createStore<any[]>([]);

  createEffect(() => {
    const rawList = allActiveParticipants();
    setParticipantsStore(reconcile(rawList, { key: "clientId" }));
  });

  // --- WebRTC & Local Stream States ---
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = createSignal<any[]>([]);
  const peerConnections = new Map<string, RTCPeerConnection>();

  const startLocalMedia = async () => {
    try {
      const needVideo = !isVideoOff();
      const needAudio = !isMuted();
      if (!needVideo && !needAudio) return null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: needVideo,
        audio: needAudio,
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn("Could not access media devices:", err);
      return null;
    }
  };

  interface AgentAsset {
    id: string;
    name: string;
    budget: number;
    gold?: number;
    stocks?: Record<string, number>;
    debt?: { amount: number; missedPayments: number; tier: string };
    product: string;
    quantity: number;
    price: number;
    employees: number;
    media?: any;
    status?: boolean;
    products?: Array<{
      name: string;
      quantity: number;
      price: number;
      status?: boolean;
      media?: any;
    }>;
  }

  createEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rottra_agent_skills", JSON.stringify(agentSkills()));
    }
  });

  const adjustAgentSkill = (agentId: string, delta: number) => {
    setAgentSkills((prev) => {
      const current = prev[agentId];
      if (!current) return prev;
      const newLevel = Math.max(1, Math.min(15, current.level + delta));
      const title = getDynamicSkillTitle(agentId, newLevel);

      let color = "#9ca3af";
      if (newLevel >= 13) {
        color = "#f43f5e";
      } else if (newLevel >= 10) {
        color = "#fbbf24";
      } else if (newLevel >= 8) {
        color = "#facc15";
      } else if (newLevel >= 6) {
        color = "#60a5fa";
      } else {
        color = "#f87171";
      }

      return {
        ...prev,
        [agentId]: { level: newLevel, title, color },
      };
    });
  };

  const hireEmployee = () => {
    const myId = selectedCharId();
    if (!myId) return;
    const assets = { ...agentAssets() };
    const me = assets[myId];
    if (!me) return;
    if (me.employees >= 40) return;
    const recruitFee = 5000000; // 5Mđ tuyển dụng
    const myBudget = Number(me.budget);
    if (!Number.isFinite(myBudget) || myBudget < recruitFee) return;

    me.budget = myBudget - recruitFee;
    me.employees += 1;
    assets[myId] = { ...me };
    setAgentAssets(assets);

    const text = t(
      `💼 [Tuyển dụng] Bạn đã chi {fee}${currencySymbol()} phí tuyển dụng để thuê thêm 1 nhân sự mới (Tổng nhân sự: {employees} người).`,
    ).replace("{fee}", formatCurrency(recruitFee)).replace("{employees}", formatCurrency(me.employees));
    const chatMsg = {
      type: "chat",
      senderId: `bot_${myId}`,
      sender: me.name,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, chatMsg] as any);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(chatMsg));
      ws.send(
        JSON.stringify({
          type: "trade-sync",
          assets,
          logs: tradeLogs(),
          skills: agentSkills(),
          currentLeader: currentLeader(),
        }),
      );
    }

    fetch("/api/agent/sync-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assets: { [myId]: { budget: me.budget, employees: me.employees } },
        skills: agentSkills(),
      }),
    }).catch((err) => console.error("Failed to sync hire to DB:", err));
  };

  const fireEmployee = () => {
    const myId = selectedCharId();
    if (!myId) return;
    const assets = { ...agentAssets() };
    const me = assets[myId];
    if (!me) return;
    if (me.employees <= 0) return;

    me.employees -= 1;
    assets[myId] = { ...me };
    setAgentAssets(assets);

    // Human player skill level drops due to firing (morale/team cohesion loss)
    const skills = { ...agentSkills() };
    const mySkill = skills[myId];
    if (mySkill && mySkill.level > 1) {
      mySkill.level -= 1;
      const rumorPart = mySkill.title.split(" (Cấp")[0] || "Bình thường";
      mySkill.title = `${rumorPart} (Cấp ${mySkill.level})`;
      skills[myId] = { ...mySkill };
      setAgentSkills(skills);
    }

    const text = `💼 [Cắt giảm nhân sự] Bạn đã sa thải 1 nhân sự. Sĩ khí giảm làm giảm trình độ chuyên môn của bạn xuống Cấp ${
      mySkill?.level || 1
    }! (Tổng nhân sự: ${me.employees} người).`;
    const chatMsg = {
      type: "chat",
      senderId: `bot_${myId}`,
      sender: me.name,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, chatMsg] as any);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(chatMsg));
      ws.send(
        JSON.stringify({
          type: "trade-sync",
          assets,
          logs: tradeLogs(),
          skills: skills,
          currentLeader: currentLeader(),
        }),
      );
    }

    fetch("/api/agent/sync-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assets: { [myId]: { employees: me.employees } },
        skills: skills,
      }),
    }).catch((err) => console.error("Failed to sync fire to DB:", err));
  };

  const getAgentStocksList = (agent: any) => {
    if (!agent || !agent.stocks) return [];
    return Object.entries(agent.stocks).map(([symbol, qty]) => ({ symbol, qty: Number(qty) })).filter((item) => item.qty > 0);
  };

  const getAgentBTCQty = (stocks: any) => {
    if (!stocks) return 0;
    return (stocks.BTC !== undefined ? Number(stocks.BTC) : 0) / 10000;
  };

  const getAgentTotalStockQty = (stocks: any) => {
    if (!stocks) return 0;
    let total = 0;
    Object.entries(stocks).forEach(([symbol, qty]) => {
      if (symbol !== "BTC") {
        total += Number(qty);
      }
    });
    return total;
  };

  const getAgentBadges = (agentId: string, budget: number, price: number) => {
    const badges: { text: string; css: string; title?: string }[] = [];
    const skills = agentSkills()[agentId];

    // Check if level is high
    if (skills && skills.level >= 10) {
      badges.push({ text: t("✨ BẬC THẦY"), css: "bg-purple-500/20 text-purple-400 border-purple-500/30" });
    }

    // Check for debt
    const agentObj = agentAssets ? agentAssets()[agentId] : null;
    const debt = agentObj?.debt;

    const currentGoldBuyPrice = goldPrice()?.buy || 10000000;
    const goldCount = Number(agentObj?.gold) || 0;
    const totalWealth = budget + goldCount * currentGoldBuyPrice;

    if (debt && debt.amount > 0) {
      if (debt.tier === "NỢ ĐÚNG HẠN") {
        badges.push({
          text: t("🟢 ĐÚNG HẠN"),
          css: "bg-green-500/20 text-green-400 border-green-500/30",
          title: t("Nợ: {amount}đ").replace("{amount}", formatCurrency(debt.amount)),
        });
      } else if (debt.tier === "NỢ QUÁ HẠN") {
        badges.push({
          text: t("🟡 QUÁ HẠN"),
          css: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
          title: t("Chậm {count} kỳ").replace("{count}", formatNumber(debt.missedPayments)),
        });
      } else if (debt.tier === "NỢ XẤU") {
        badges.push({
          text: t("🟠 NỢ XẤU"),
          css: "bg-orange-500/20 text-orange-400 border-orange-500/30",
          title: t("Chậm {count} kỳ").replace("{count}", formatNumber(debt.missedPayments)),
        });
      } else if (debt.tier === "VỠ NỢ") {
        badges.push({
          text: t("🔴 VỠ NỢ"),
          css: "bg-red-500/20 text-red-400 border-red-500/30 font-bold animate-pulse",
          title: t("Chậm {count} kỳ").replace("{count}", formatNumber(debt.missedPayments)),
        });
      } else if (debt.tier === "MẤT KHẢ NĂNG THANH TOÁN") {
        badges.push({
          text: t("💀 MẤT KNTT"),
          css: "bg-gray-800 text-gray-300 border-gray-600 font-bold",
          title: t("Chậm {count} kỳ").replace("{count}", formatNumber(debt.missedPayments)),
        });
      } else if (debt.tier === "PHÁ SẢN") {
        badges.push({
          text: t("💥 PHÁ SẢN"),
          css: "bg-red-900 text-white border-red-700 font-extrabold",
          title: t("Chậm {count} kỳ").replace("{count}", formatNumber(debt.missedPayments)),
        });
      }
    } else if (totalWealth < 0) {
      badges.push({ text: t("💸 NỢ NẦN"), css: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" });
    } else if (totalWealth >= 1000000000) {
      badges.push({ text: t("💰 TỶ PHÚ"), css: "bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold" });
    } else if (totalWealth >= 150000000) {
      badges.push({ text: t("💰 TRIỆU PHÚ"), css: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" });
    }

    // Calculate VK (Vượt Khó) Index using the scientific formula:
    // VK = ((T + C) * H^K) / S
    const T =
      skills ? Math.min(10, Math.max(1, skills.level)) : 5; // Tâm thế (1 - 10)
    const employees = agentObj?.employees || 5;
    const quantity = agentObj?.quantity || 0;

    const C =
      agentId === currentLeader().id ? 10 : Math.min(10, Math.max(2, Math.floor(employees / 2))); // Chiến lược (2 - 10)
    const H = Math.min(10, Math.max(2, 5 + Math.floor(quantity / 1000))); // Hành động (2 - 10)
    const K = 1 + (skills?.level || 5) / 10; // Kỷ luật & Kiên trì (1.1 - 2.5)

    let S = 1; // Sĩ diện & Sợ hãi
    if (totalWealth >= 0) {
      S = Math.max(1, 10 - (skills?.level || 5)); // Higher skills = lower fear/ego (1 - 9)
    }

    const vkRaw = ((T + C) * Math.pow(H, K)) / S;
    // Scale the raw index so it displays as a nice percentage (e.g. 0% - 150%)
    const vkPercent = Math.min(150, Math.round(vkRaw));

    if (totalWealth < 150000000) {
      badges.push({
        text: `${t("🌟 VƯỢT KHÓ")} ${vkPercent}%`,
        css: "bg-orange-500/20 text-orange-400 border-orange-500/30 font-semibold",
        title: `AQ (Chỉ số Vượt nghịch cảnh): VK = ((T + C) * H^K) / S\n- T (Tâm thế): ${T}/10\n- C (Chiến lược): ${C}/10\n- H (Hành động): ${H}/10\n- K (Kỷ luật & Kiên trì): Cấp mũ ${K.toFixed(
          2,
        )}\n- S (Sĩ diện & Sợ hãi): ${S}/10 (Nợ nần ép S về 1!)`,
      });
    }

    // Check for cheap pricing
    if (price < 20000) {
      badges.push({ text: t("🏷️ GIÁ RẺ"), css: "bg-blue-500/20 text-blue-400 border-blue-500/30" });
    }

    return badges;
  };

  createEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rottra_agent_assets", JSON.stringify(agentAssets()));
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined") {
      const gp = goldPrice();
      if (gp) {
        localStorage.setItem("rottra_gold_price", JSON.stringify(gp));
      }
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined") {
      const sq = stockQuotes();
      if (sq && sq.length > 0) {
        localStorage.setItem("rottra_stock_quotes", JSON.stringify(sq));
      }
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined") {
      const tr = toolkitReport();
      if (tr) {
        localStorage.setItem("rottra_toolkit_report", JSON.stringify(tr));
      }
    }
  });
  const fetchToolkitReport = () => {
    fetch("/api/agent/toolkit-report").then((res) => res.json()).then((data) => {
      if (data.success) {
        setToolkitReport(data.report);
      }
    }).catch((err) => console.error("Failed to fetch toolkit report:", err));
  };
  const tuDuyNguocTitle = () => {
    const r = toolkitReport();
    if (!r || !r.tuDuyNguoc) return "";
    const detailsStr =
      Array.isArray(r.tuDuyNguoc.details) ? r.tuDuyNguoc.details.join("\n") : "";
    return t(
      "TƯ DUY NGƯỢC (Chống Tự Hủy)\nWin = (V * E) / (1 + Sum(S * Ego))\n- V (Tầm nhìn): {v}/10\n- E (Công sức): {e}nv\n- Mẫu số tự hủy: {ego}\n\nChi tiết:\n{details}",
    ).replace("{v}", r.tuDuyNguoc.V.toString()).replace("{e}", r.tuDuyNguoc.E.toString()).replace(
      "{ego}",
      r.tuDuyNguoc.sumSEgo.toString(),
    ).replace("{details}", detailsStr || t("Không có lỗi tự hủy!"));
  };
  const donBayTitle = () => {
    const r = toolkitReport();
    if (!r || !r.donBay) return "";
    return t(
      "ĐÒN BẨY TÀI SẢN (Bùng Nổ)\nR = I_core * (Tool + Prompt)^System\n- I_core: {core}\n- Đòn bẩy (Tools): {tool}\n- Hệ thống tự động: ^{system}",
    ).replace("{core}", r.donBay.I_core.toString()).replace("{tool}", r.donBay.ToolPrompt.toString()).replace(
      "{system}",
      r.donBay.System.toString(),
    );
  };
  const toiGianTitle = () => {
    const r = toolkitReport();
    if (!r || !r.toiGian) return "";
    return t(
      "TỐI GIẢN TÀN NHẪN (Dòng Tiền)\nCASH = (Top20% * Focus) / (Waste80% * Emotion)\n- Top 20% Hàng VIP: {top}đ\n- Focus: x{focus}\n- Waste: {waste}đ\n- Emotion: x{emotion}",
    ).replace("{top}", formatNumber(r.toiGian.Top20Val)).replace("{focus}", r.toiGian.Focus.toString()).replace(
      "{waste}",
      formatNumber(r.toiGian.Waste80Val),
    ).replace("{emotion}", r.toiGian.Emotion.toString());
  };
  const tuDuyNguocWin = () => {
    const r = toolkitReport();
    return r && r.tuDuyNguoc ? r.tuDuyNguoc.Win : 0;
  };
  const donBayR = () => {
    const r = toolkitReport();
    return r && r.donBay ? formatNumber(r.donBay.R) : "0";
  };
  const toiGianCash = () => {
    const r = toolkitReport();
    return r && r.toiGian ? r.toiGian.CASH : 0;
  };
  const [tradeLogs, setTradeLogs] = createSignal<string[]>([]);
  const [isTradingActive, setIsTradingActive] = createSignal(false);
  const [tradeIntervalId, setTradeIntervalId] = createSignal<any>(null);
  const [underReviewList, setUnderReviewList] = createSignal<
    { agentId: string; agentName: string; productName: string; reason: string }[]
  >([]);

  const ccw = (A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }) => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  };

  const segmentsIntersect = (
    A: { x: number; y: number },
    B: { x: number; y: number },
    C: { x: number; y: number },
    D: { x: number; y: number },
  ) => {
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
  };

  let connectionOffsets: Record<string, number> = {};

  const drawTradeOnWhiteboard = (buyerId: string, sellerId: string, cost: number) => {
    return;
  };

  const startTradeSimulation = () => {
    if (tradeIntervalId()) {
      clearInterval(tradeIntervalId());
    }

    const resetAssets = initialAssets();
    setAgentAssets(resetAssets);
    setTradeLogs([]);
    setCompletedTrades([]);
    setIsTradingActive(true);
    connectionOffsets = {};

    fetch("/api/agent/sync-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: resetAssets, skills: agentSkills() }),
    }).catch((err) => console.error("Failed to sync reset assets to DB:", err));

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "trade-sync",
          assets: resetAssets,
          logs: [],
        }),
      );
    }

    const systemMsg = {
      type: "chat",
      senderId: `bot_${currentLeader().id}`,
      sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
      text: t("Các trưởng nhóm bắt đầu giao thương!"),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, systemMsg] as any);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(systemMsg));
    }

    // Phase 1: Group leaders buy products from same-color members to distribute budgets!
    const initialTrades = [
      // Green group (Tô Lượng distributes 400M)
      { buyer: "toLuong", seller: "tramTinh", qty: 2000, comment: "Nhập 2.000 kg Lúa gạo đặc sản ST25 🌾 để khảo nghiệm cảm biến." },
      { buyer: "toLuong", seller: "phiAnh", qty: 2000, comment: "Mua 2.000 kg Heo hữu cơ 🐖 bồi bổ cho nhân lực mùa vụ." },
      { buyer: "toLuong", seller: "uVuongMau", qty: 30, comment: "Mua 30 cuộn Màng nhà kính 🎪 để che chắn mạ non." },
      // Red group (Thương Nguyệt distributes 400M)
      {
        buyer: "thuongNguyet",
        seller: "daoTieuCuu",
        qty: 5000,
        comment: "Thu mua 5.000 kg Ngô ngọt 🌽 để phân tích và lập báo cáo thị trường.",
      },
      { buyer: "thuongNguyet", seller: "bachDiHanh", qty: 8000, comment: "Ta thu mua 8.000 bao Phân trùn quế 🌱 để bón vườn chè." },
      {
        buyer: "thuongNguyet",
        seller: "bachLoc",
        qty: 10,
        comment: "Thu mua 10 hệ thống Làm mát mini ❄️ bảo quản kho nông sản tập trung.",
      },
      // Blue group (Hỏa Huỳnh distributes 100M)
      {
        buyer: "hoaHuynh",
        seller: "nhuNguyet",
        qty: 2000,
        comment: "Đặt hàng 2.000 kg Khoai tây vàng 🥔 chất lượng cao để chế biến sấy giòn.",
      },
      // Yellow group (Phi Nguyệt distributes 100M)
      {
        buyer: "phiNguyet",
        seller: "suGia",
        qty: 50,
        comment: "Mua 50 bộ Tưới nhỏ giọt 💧 tự động nâng cấp trang trại hoa quả phục vụ sấy.",
      },
    ];

    let initialIndex = 0;
    const executeNextInitialTrade = () => {
      if (!isTradingActive()) return;
      if (initialIndex >= initialTrades.length) {
        startFreeExchangePhase();
        return;
      }

      const trade = initialTrades[initialIndex];
      const assets = { ...agentAssets() };
      const buyerId = trade.buyer;
      const buyer = { ...assets[buyerId] };
      const seller = { ...assets[trade.seller] };

      if (buyer && seller) {
        // Negotiation skill logic
        const buyerSkillObj = agentSkills()[buyerId] || { level: 5, title: "Trung bình", color: "" };
        const sellerSkillObj = agentSkills()[trade.seller] || { level: 5, title: "Trung bình", color: "" };

        const buyerEmployees = buyer.employees || 0;
        const sellerEmployees = seller.employees || 0;
        const buyerSkill = buyerSkillObj.level + Math.floor(buyerEmployees / 5);
        const sellerSkill = sellerSkillObj.level + Math.floor(sellerEmployees / 5);

        const buyerTitle = buyerSkillObj.title.split(" (Cấp")[0] || "Bình thường";
        const sellerTitle = sellerSkillObj.title.split(" (Cấp")[0] || "Bình thường";

        let multiplier = 1;
        let negotiationText = "";

        let employeeNote = "";
        if (buyerEmployees > 0 || sellerEmployees > 0) {
          employeeNote = ` [Quy mô: ${buyerEmployees}nv vs ${sellerEmployees}nv]`;
        }

        if (buyerSkill > sellerSkill) {
          const diff = buyerSkill - sellerSkill;
          const discount = Math.min(0.3, diff * 0.05); // max 30% discount
          multiplier = 1 - discount;
          negotiationText = ` (giảm ${(discount * 100).toFixed(0)}% - Nhờ '${buyerTitle}' áp chế '${sellerTitle}'${employeeNote})`;
          adjustAgentSkill(buyerId, 1);
          adjustAgentSkill(trade.seller, -1);
        } else if (buyerSkill < sellerSkill) {
          const diff = sellerSkill - buyerSkill;
          const markup = Math.min(0.25, diff * 0.04); // max 25% markup
          multiplier = 1 + markup;
          negotiationText = ` (đắt thêm ${(markup * 100).toFixed(0)}% - Do '${buyerTitle}' bị '${sellerTitle}' áp giá${employeeNote})`;
          adjustAgentSkill(buyerId, -1);
          adjustAgentSkill(trade.seller, 1);
        } else {
          negotiationText = ` (Giá cân bằng - Đàm phán '${buyerTitle}' ngang tài${employeeNote})`;
          const buyerVengeance = AGENT_DNA[buyerId]?.vengeance || 0.5;
          const sellerVengeance = AGENT_DNA[trade.seller]?.vengeance || 0.5;
          if (buyerVengeance > sellerVengeance) {
            adjustAgentSkill(buyerId, 1);
          } else if (buyerVengeance < sellerVengeance) {
            adjustAgentSkill(trade.seller, 1);
          }
        }

        const sellerProdName =
          seller.products && seller.products.length > 0 ? seller.products[0].name : seller.product || "Hàng hóa";
        const sellerProdPrice =
          seller.products && seller.products.length > 0 ? seller.products[0].price : seller.price || 10000;

        const finalUnitPrice = Math.round(sellerProdPrice * multiplier);
        const cost = trade.qty * finalUnitPrice;

        let buyerBudget = Number(buyer.budget);
        if (!Number.isFinite(buyerBudget)) buyerBudget = 0;
        let sellerBudget = Number(seller.budget);
        if (!Number.isFinite(sellerBudget)) sellerBudget = 0;

        let borrowed = 0;
        if (buyerBudget < cost) {
          borrowed = cost - buyerBudget;
        }

        buyer.budget = buyerBudget - cost;
        seller.budget = sellerBudget + cost;

        // Update local quantity visually
        if (seller.products && seller.products.length > 0) {
          seller.products[0].quantity -= trade.qty;
        } else {
          seller.quantity -= trade.qty;
        }

        assets[buyerId] = buyer;
        assets[trade.seller] = seller;
        setAgentAssets(assets);
        setCompletedTrades(
          (prev) => [
            ...prev,
            {
              buyerId,
              buyerName: buyer.name,
              sellerId: trade.seller,
              sellerName: seller.name,
              product: sellerProdName,
              qty: trade.qty,
              cost,
            },
          ],
        );

        // LƯU Ý: Không fetch("/api/agent/sync-assets") để bảo vệ DB khỏi bị ghi đè bởi giao dịch ảo. Frontend chỉ dùng để render animation!

        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const logMsg = t("[{time}] {buyer} mua {qty} {product} từ {seller} (Đàm phán {title}): {cost} đ{negotiation}").replace(
          "{time}",
          timeStr,
        ).replace("{buyer}", t(buyer.name)).replace("{qty}", formatNumber(trade.qty)).replace(
          "{product}",
          t(sellerProdName.split(" ")[0]),
        ).replace("{seller}", t(seller.name)).replace("{title}", t(buyerTitle)).replace("{cost}", formatCurrency(cost)).replace(
          "{negotiation}",
          negotiationText,
        );
        setTradeLogs((prev) => [{ text: logMsg }, ...prev || []]);

        let buyerText = t("🤝 [Đàm phán {title}] {comment} (Giá đàm phán: {price} đ/đơn vị)").replace("{title}", t(buyerTitle)).replace(
          "{comment}",
          trade.comment,
        ).replace("{price}", formatCurrency(finalUnitPrice));
        if (buyerSkill > sellerSkill) {
          buyerText = t(
            "📊 [Đàm phán phân tích] Nhờ kỹ năng '{buyerTitle}' lấn lướt lối đàm phán '{sellerTitle}' của {sellerName}, chúng tôi đã đàm phán giảm giá {discount}%! {comment}",
          ).replace("{buyerTitle}", t(buyerTitle)).replace("{sellerTitle}", t(sellerTitle)).replace("{sellerName}", t(seller.name)).replace(
            "{discount}",
            Math.round((1 - multiplier) * 100).toString(),
          ).replace("{comment}", trade.comment);
        } else if (buyerSkill < sellerSkill) {
          buyerText = t(
            "⚠️ [Đàm phán bất lợi] Do lối chơi '{buyerTitle}' của chúng tôi bị tính cách '{sellerTitle}' của {sellerName} lấn át, đơn hàng bị tăng giá {markup}%. {comment}",
          ).replace("{buyerTitle}", t(buyerTitle)).replace("{sellerTitle}", t(sellerTitle)).replace("{sellerName}", t(seller.name)).replace(
            "{markup}",
            Math.round((multiplier - 1) * 100).toString(),
          ).replace("{comment}", trade.comment);
        }

        const buyerChat = {
          type: "chat",
          senderId: `bot_${buyerId}`,
          sender: t(buyer.name),
          text: buyerText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        const sellerChat = {
          type: "chat",
          senderId: `bot_${trade.seller}`,
          sender: t(seller.name),
          text: t("Xác nhận giao thương! Đã nhận {cost} đ thanh toán.").replace("{cost}", formatCurrency(cost)),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, buyerChat, sellerChat] as any);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(buyerChat));
          ws.send(JSON.stringify(sellerChat));
          ws.send(
            JSON.stringify({
              type: "trade-sync",
              assets,
              logs: [{ text: logMsg }, ...tradeLogs()],
              completedTrades: completedTrades(),
            }),
          );
          ws.send(
            JSON.stringify({
              type: "trade-draw",
              buyerId,
              buyerName: buyer.name,
              sellerId: trade.seller,
              sellerName: seller.name,
              product: seller.product,
              qty: trade.qty,
              cost,
            }),
          );
        }

        if (borrowed > 0) {
          const borrowMsg = t(
            `💸 [{leader} tín dụng] Agent {buyer} vay nợ {borrowed}${currencySymbol()} từ {leader} để hoàn tất đơn hàng ban đầu (Lãi suất nợ: 5% định kỳ).`,
          ).replace(/{leader}/g, t(currentLeader().name)).replace("{buyer}", t(buyer.name)).replace("{borrowed}", formatCurrency(borrowed));
          const chatMsg = {
            type: "chat",
            senderId: `bot_${currentLeader().id}`,
            sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
            text: borrowMsg,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, chatMsg] as any);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chatMsg));
          }
        }

        drawTradeOnWhiteboard(buyerId, trade.seller, cost);
      }

      initialIndex++;
      setTimeout(executeNextInitialTrade, 1500);
    };
    executeNextInitialTrade();
  };

  const startFreeExchangePhase = () => {
    const systemMsg = {
      type: "chat",
      senderId: `bot_${currentLeader().id}`,
      sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
      text: t("PHÂN CHIA NGÂN SÁCH HOÀN TẤT. Giai đoạn trao đổi tự do giữa các Agent chính thức bắt đầu!"),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, systemMsg] as any);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(systemMsg));
    }

    const needsGraph: Record<string, string[]> = {
      // Green
      toLuong: ["phiAnh", "tramTinh"],
      phiAnh: ["toLuong", "uVuongMau"],
      uVuongMau: ["phiAnh", "tramTinh"],
      tramTinh: ["toLuong", "uVuongMau"],

      // Red
      thuongNguyet: ["bachDiHanh", "daoTieuCuu"],
      bachDiHanh: ["thuongNguyet", "bachLoc"],
      bachLoc: ["bachDiHanh", "daoTieuCuu"],
      daoTieuCuu: ["thuongNguyet", "bachLoc"],

      // Blue
      hoaHuynh: ["nhuNguyet"],
      nhuNguyet: ["hoaHuynh"],

      // Yellow
      phiNguyet: ["suGia"],
      suGia: ["phiNguyet"],
    };

    const runRandomTrade = () => {
      if (!isTradingActive()) return;

      const assets = { ...agentAssets() };
      const potentialBuyers = Object.keys(assets).filter((id) => assets[id].budget >= -Number.MAX_SAFE_INTEGER);
      if (potentialBuyers.length === 0) return;

      const buyerId = potentialBuyers[chatTick % potentialBuyers.length];

      // 1. Kiểm tra xem Agent này có kịch bản lập trình Blockly custom nào không
      const buyerRules = customRules()[buyerId];
      if (buyerRules && buyerRules.length > 0) {
        const tradables: any[] = [];
        if (goldPrice() && goldPrice()?.sell) tradables.push({
          symbol: "Vàng PNJ",
          price: goldPrice()?.sell,
          trend: "neutral",
          type: "Vàng",
        });
        stockQuotes().forEach((q) => {
          if (q.price) tradables.push({
            symbol: q.symbol,
            price: q.price,
            trend: q.trend || "neutral",
            type: q.symbol === "BTC" ? "Crypto" : "Chứng Khoán",
          });
        });

        for (const rule of buyerRules) {
          const matchedAsset = tradables.find((t) => t.symbol === rule.asset);
          if (matchedAsset && matchedAsset.trend === rule.trend) {
            const buyer = { ...assets[buyerId] };
            let tradeAction: any = null;
            let chatAction: any = null;
            let harmonyAction: any = null;

            rule.actions.forEach((act: any) => {
              if (act.type === "trade") tradeAction = act;
              else if (act.type === "chat") chatAction = act;
              else if (act.type === "harmony") harmonyAction = act;
            });

            let pnl = 0;
            let isWin = false;
            let tradeInfo = "";

            if (tradeAction) {
              isWin = matchedAsset.trend === "up" && tradeAction.action === "LONG" ||
                matchedAsset.trend === "down" && tradeAction.action === "SHORT";

              const vol = Number(tradeAction.vol);
              const price = Number(matchedAsset.price);
              if (Number.isFinite(vol) && Number.isFinite(price)) {
                const basePnL = Math.floor(vol * price * (0.05 + Math.random() * 0.15));
                pnl = Number.isFinite(basePnL) ? basePnL : 0;

                const buyerBudget = Number(buyer.budget);
                const safeBudget = Number.isFinite(buyerBudget) ? buyerBudget : 0;

                if (isWin) {
                  buyer.budget = safeBudget + pnl;
                  tradeInfo = t(`Đánh lệnh {action} thành công, chốt lời +{pnl} ${currencySymbol()}`).replace(
                    "{action}",
                    tradeAction.action,
                  ).replace("{pnl}", formatCurrency(pnl));
                } else {
                  const actualLoss = Math.min(safeBudget > 0 ? safeBudget : 0, pnl) || pnl;
                  const validatedLoss = Number.isFinite(actualLoss) ? actualLoss : 0;
                  buyer.budget = safeBudget - validatedLoss;
                  pnl = validatedLoss;
                  tradeInfo = t(`Đánh lệnh {action} ngược sóng, cắt lỗ -{pnl} ${currencySymbol()}`).replace(
                    "{action}",
                    tradeAction.action,
                  ).replace("{pnl}", formatCurrency(pnl));
                }

                assets[buyerId] = buyer;
                setAgentAssets(assets);
              }
            } else if (harmonyAction) {
              tradeInfo = t("Thiết lập Hòa Khí hữu nghị (Chiết khấu -{discount}%)").replace(
                "{discount}",
                harmonyAction.discount.toString(),
              );
            }

            const customChatText =
              chatAction
                ? chatAction.msg
                : (harmonyAction
                  ? t("Hòa khí sinh tài! Ta áp dụng chính sách giảm giá hữu nghị {discount}% để thu hút khách hàng!").replace(
                      "{discount}",
                      harmonyAction.discount.toString(),
                    )
                  : t("Ta đã tự động giao dịch theo lập trình Blockly!"));
            const actionIcon =
              harmonyAction ? t("🤝🧩 [Hòa Khí]") : (isWin ? t("🤖🧩 [Thắng Lớn (Blockly)]") : t("🤖🧩 [Cắt Lỗ (Blockly)]"));

            const chatObj = {
              type: "chat",
              senderId: `bot_${buyerId}`,
              sender: t(buyer.name),
              text: `${actionIcon} ${customChatText} (${tradeInfo || t("Không khớp lệnh")})`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, chatObj] as any);
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(chatObj));
            return;
          }
        }
      }

      // Thỉnh thoảng cho Agent "lướt sóng" tài chính (Vàng, Crypto, Chứng khoán)
      if (Math.random() < 0.25) {
        const tradables: any[] = [];
        if (goldPrice() && goldPrice()?.sell) tradables.push({
          symbol: "Vàng PNJ",
          price: goldPrice()?.sell,
          trend: "neutral",
          type: "Vàng",
        });
        stockQuotes().forEach((q) => {
          if (q.price) tradables.push({
            symbol: q.symbol,
            price: q.price,
            trend: q.trend || "neutral",
            type: q.symbol === "BTC" ? "Crypto" : "Chứng Khoán",
          });
        });

        if (tradables.length > 0) {
          const asset = tradables[Math.floor(Math.random() * tradables.length)];
          const buyer = { ...assets[buyerId] };

          // Gọi RottraAI để quyết định kết quả giao dịch và sinh thoại
          fetch("/api/agent/trade-financial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              botId: buyerId,
              botName: buyer.name,
              assetSymbol: asset.symbol,
              assetType: asset.type,
              assetPrice: asset.price,
              assetTrend: asset.trend,
              budget: buyer.budget,
            }),
          }).then((r) => r.json()).then((data) => {
            if (data.success) {
              const { isWin, pnl, chatMsg, newBudget, newStocks } = data;

              const actionIcon = isWin ? "🚀 [Thắng Lớn]" : "📉 [Cắt Lỗ]";
              if (newBudget !== undefined) {
                buyer.budget = newBudget;
              } else {
                const buyerBudget = Number(buyer.budget);
                const safeBudget = Number.isFinite(buyerBudget) ? buyerBudget : 0;
                const safePnL =
                  Number.isFinite(Number(pnl)) ? Number(pnl) : 0;

                if (isWin) {
                  buyer.budget = safeBudget + safePnL;
                } else {
                  const actualLoss = Math.min(safeBudget > 0 ? safeBudget : 0, safePnL) || safePnL;
                  const validatedLoss = Number.isFinite(actualLoss) ? actualLoss : 0;
                  buyer.budget = safeBudget - validatedLoss;
                }
              }

              if (newStocks) {
                buyer.stocks = newStocks;
              }

              assets[buyerId] = buyer;
              setAgentAssets(assets);

              const chatObj = {
                type: "chat",
                senderId: `bot_${buyerId}`,
                sender: buyer.name,
                text: `${actionIcon} ${chatMsg}`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              };
              setMessages((prev) => [...prev, chatObj] as any);
              if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(chatObj));
            }
          }).catch((err) => console.error("Trade Financial Error:", err));
          return; // Đã chơi tài chính thì dừng, không trade hàng hóa nữa
        }
      }

      const targets = (needsGraph[buyerId] || ["toLuong"]).filter((t) => {
        const targetAsset = assets[t];
        if (!targetAsset) return false;
        const hasImg = targetAsset.media && Array.isArray(targetAsset.media) && targetAsset.media.length > 0 && targetAsset.media[0]?.link;
        if (!hasImg || targetAsset.status === false) {
          return false;
        }
        return true;
      });
      if (targets.length === 0) return;

      // Sort targets by price ascending to favor cheaper sellers (sản phẩm rẻ sẽ được ưa chuộng)
      const sortedTargets = [...targets].sort((a, b) => {
        const priceA = assets[a]?.price ?? 999999999;
        const priceB = assets[b]?.price ?? 999999999;
        return priceA - priceB;
      });

      const greed = AGENT_DNA[buyerId]?.greed ?? 0.5;
      let sellerId = sortedTargets[0] || "toLuong";
      if (sortedTargets.length > 1 && greed <= 0.8) {
        const idx = 1 + buyerId.charCodeAt(0) % (sortedTargets.length - 1);
        sellerId = sortedTargets[idx] || sortedTargets[0];
      }

      const buyerReasonPool: Record<string, Record<string, string[]>> = {
        toLuong: {
          phiAnh: ["cần thịt heo hữu cơ 🐖 phục vụ bếp ăn Ban quản lý", "nhập heo thịt bồi bổ sức khỏe cho đội ngũ điều hành"],
          tramTinh: ["nhập gạo sạch ST25 🌾 dự trữ lương thực", "cần lúa gạo chất lượng cao phục vụ triển lãm nông nghiệp"],
          uVuongMau: ["cần màng nhà kính 🎪 triển khai thí điểm vườn rau sạch", "cung ứng màng bảo vệ cây non"],
          bachLoc: ["thu mua thảo dược rừng 🌿 để phục vụ y tế ban quản lý", "cần sâm quý bồi bổ sức khỏe"],
        },
        thuongNguyet: {
          bachDiHanh: ["cần phân trùn quế 🌱 cải tạo đất cho trang trại chè", "nhập phân hữu cơ chuẩn bị vụ xuân"],
          daoTieuCuu: ["mua ngô ngọt 🌽 làm nguyên liệu chế biến sữa ngô hữu cơ", "cần lương thực xanh cho phân khu đỏ"],
          bachLoc: ["thu mua thảo dược rừng 🌿 phục vụ điều chế thuốc bổ", "cần thảo dược quý hỗ trợ gia tộc"],
        },
        tramTinh: {
          toLuong: ["cần cảm biến IoT độ ẩm 📡 theo dõi tưới tiêu ruộng lúa ST25", "cần thiết bị tự động đo lường độ ẩm bãi bồi"],
          uVuongMau: ["cần màng phủ nhà kính 🎪 chống sương muối ruộng mạ giống", "mua màng nilon bao phủ khu ươm giống lúa ST25"],
        },
        daoTieuCuu: {
          thuongNguyet: [
            "mua bản tin thị trường 📈 phân tích biến động giá ngô nông sản",
            "cập nhật dự báo cung cầu để điều chỉnh sản lượng ngô ngọt",
          ],
          bachLoc: ["cần thảo dược rừng 🌿 bào chế trà ngũ cốc thảo mộc", "nhập sâm rừng hỗ trợ nghiên cứu sinh học nông nghiệp"],
        },
        hoaHuynh: {
          nhuNguyet: [
            "nhập bộ tưới nhỏ giọt 💧 lắp đặt cho trang trại cà phê Robusta",
            "nâng cấp hệ thống tưới tự động tiết kiệm nước mùa khô",
          ],
        },
        phiNguyet: {
          suGia: ["nhập than sinh học 🔥 cải tạo độ phì nhiêu đất trồng mít", "cần than sinh học giữ ẩm gốc mít giống mới"],
        },
        nhuNguyet: {
          hoaHuynh: ["nhập cà phê Robusta ☕ phục vụ đối tác tại văn phòng", "cần cà phê nguyên chất Buôn Ma Thuột bồi bổ sự tỉnh táo"],
        },
        suGia: {
          phiNguyet: [
            "mua mít sấy giòn 🥭 phục vụ sự kiện liên hoan kết nối doanh nghiệp",
            "nhập mít sấy làm thực phẩm dinh dưỡng hành quân",
          ],
        },
        phiAnh: {
          toLuong: [
            "cần cảm biến IoT độ ẩm 📡 giám sát nhiệt độ độ ẩm chuồng heo",
            "cần cảm biến tự động hóa điều hòa không khí trang trại heo",
          ],
          uVuongMau: ["cần màng nhà kính 🎪 lợp mái chống rét cho đàn heo con", "mua màng cách nhiệt bảo vệ kho lạnh chứa heo thịt"],
        },
        bachDiHanh: {
          thuongNguyet: ["mua bản tin thị trường 📈 theo dõi giá phân bón và nông sản", "cập nhật biến động giá tiêu dùng quốc tế"],
          bachLoc: ["cần thảo dược rừng 🌿 bào chế trà thảo mộc trùn quế", "nhập dược liệu quý phối trộn phân bón thảo mộc đặc sản"],
        },
        uVuongMau: {
          phiAnh: ["mua heo hữu cơ 🐖 chế biến thực phẩm sạch cho khu sinh thái", "nhập thịt heo bồi dưỡng công nhân lắp đặt nhà kính"],
          tramTinh: ["nhập lúa gạo ST25 🌾 làm lương thực cho khu chế xuất", "mua gạo đặc sản nấu cháo dinh dưỡng vi sinh"],
        },
        bachLoc: {
          bachDiHanh: ["cần phân trùn quế hữu cơ 🌱 bón lót khu ươm sâm Ngọc Linh", "nhập phân bón vi sinh nuôi dưỡng rễ thảo dược"],
          daoTieuCuu: [
            "nhập ngô ngọt 🌽 chế biến thực phẩm dinh dưỡng bổ trợ sâm",
            "mua ngô hạt làm nguyên liệu chăn nuôi gia cầm trong rừng dược liệu",
          ],
        },
      };

      const buyer = { ...assets[buyerId] };
      const seller = { ...assets[sellerId] };

      if (buyer && seller && sellerId !== buyerId) {
        if (seller.quantity <= 0) {
          const fineAmount = 5000000 + (sellerId.charCodeAt(0) * 1000000) % 10000000;
          const sellerBudget = Number(seller.budget);
          seller.budget = Math.max(0, (Number.isFinite(sellerBudget) ? sellerBudget : 0) - fineAmount);
          assets[sellerId] = seller;
          setAgentAssets(assets);

          const warnText = t(
            `⚠️ [{leader} phạt tiền] Từ chối giao dịch! Sản phẩm '{product}' của {seller} không được phép lưu hành do thiếu Hạn sử dụng hoặc đã hết hàng. Phạt hành chính trừ {fine}${currencySymbol()} trực tiếp vào ngân quỹ!`,
          ).replace(/{leader}/g, t(currentLeader().name)).replace("{product}", t(seller.product)).replace(
            "{seller}",
            t(seller.name),
          ).replace("{fine}", formatCurrency(fineAmount));
          const chatMsg = {
            type: "chat",
            senderId: `bot_${currentLeader().id}`,
            sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
            text: warnText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, chatMsg] as any);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chatMsg));
          }

          // Sync the budget deduction back to database
          fetch("/api/agent/sync-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assets: {
                [sellerId]: {
                  budget: seller.budget,
                  quantity: seller.quantity,
                  price: seller.price,
                },
              },
              skills: agentSkills(),
            }),
          }).catch((err) => console.error("Failed to sync fine to DB:", err));

          return;
        }

        // Negotiation skill logic
        const buyerSkillObj = agentSkills()[buyerId] || { level: 5, title: "Trung bình", color: "" };
        const sellerSkillObj = agentSkills()[sellerId] || { level: 5, title: "Trung bình", color: "" };

        const buyerEmployees = buyer.employees || 0;
        const sellerEmployees = seller.employees || 0;
        const buyerSkill = buyerSkillObj.level + Math.floor(buyerEmployees / 5);
        const sellerSkill = sellerSkillObj.level + Math.floor(sellerEmployees / 5);

        const buyerTitle = buyerSkillObj.title.split(" (Cấp")[0] || "Bình thường";
        const sellerTitle = sellerSkillObj.title.split(" (Cấp")[0] || "Bình thường";

        let multiplier = 1;
        let negotiationText = "";

        let employeeNote = "";
        if (buyerEmployees > 0 || sellerEmployees > 0) {
          employeeNote = ` [Quy mô: ${buyerEmployees}nv vs ${sellerEmployees}nv]`;
        }

        if (buyerSkill > sellerSkill) {
          const diff = buyerSkill - sellerSkill;
          const discount = Math.min(0.3, diff * 0.05); // max 30% discount
          multiplier = 1 - discount;
          negotiationText = ` (giảm ${(discount * 100).toFixed(0)}% - Nhờ '${buyerTitle}' áp chế '${sellerTitle}'${employeeNote})`;
          adjustAgentSkill(buyerId, 1);
          adjustAgentSkill(sellerId, -1);
        } else if (buyerSkill < sellerSkill) {
          const diff = sellerSkill - buyerSkill;
          const markup = Math.min(0.25, diff * 0.04); // max 25% markup
          multiplier = 1 + markup;
          negotiationText = ` (đắt thêm ${(markup * 100).toFixed(0)}% - Do '${buyerTitle}' bị '${sellerTitle}' áp giá${employeeNote})`;
          adjustAgentSkill(buyerId, -1);
          adjustAgentSkill(sellerId, 1);
        } else {
          negotiationText = ` (Giá cân bằng - Đàm phán '${buyerTitle}' ngang tài${employeeNote})`;
          const buyerVengeance = AGENT_DNA[buyerId]?.vengeance || 0.5;
          const sellerVengeance = AGENT_DNA[sellerId]?.vengeance || 0.5;
          if (buyerVengeance > sellerVengeance) {
            adjustAgentSkill(buyerId, 1);
          } else if (buyerVengeance < sellerVengeance) {
            adjustAgentSkill(sellerId, 1);
          }
        }

        const finalUnitPrice = Math.round(seller.price * multiplier);
        const availableBudget =
          buyer.budget <= 0 ? 50000000 : buyer.budget;
        const spendRatio = 0.4 - (AGENT_DNA[buyerId]?.greed ?? 0.5) * 0.2;
        const budgetToSpend = availableBudget * spendRatio;

        // [Toán học Tối ưu] Tạo các gói hàng (Batches) từ kho của Seller
        const knapsackItems = [];
        let remainQty = seller.quantity;
        while (remainQty > 0) {
          const batchQty = Math.min(remainQty, Math.floor(Math.random() * 5) + 1);
          const batchCost = batchQty * finalUnitPrice;
          // Tính giá trị nội tại (Value) cho Quy hoạch động
          const batchValue = batchCost * (1.1 + (AGENT_DNA[buyerId]?.greed ?? 0.5));
          knapsackItems.push({ id: sellerId, name: seller.product, cost: batchCost, value: batchValue, qty: 1 });
          remainQty -= batchQty;
        }

        // Chạy Quy hoạch động (Dynamic Programming - Knapsack)
        const dpResult = dynamicProgrammingTradeOptimize(budgetToSpend, knapsackItems);

        let qty = 0;
        if (dpResult.selectedItems.length > 0) {
          // Quy hoạch động đã chọn được tổ hợp gói hàng tối ưu lợi nhuận
          qty = Math.round(dpResult.totalCost / finalUnitPrice);
          negotiationText += ` (Đã dùng Toán học Quy Hoạch Động tối ưu túi hàng)`;
        }

        if (qty > seller.quantity) qty = seller.quantity;
        if (qty < 1) qty = 1;

        const cost = qty * finalUnitPrice;

        const buyerBudget = Number(buyer.budget);
        const safeBuyerBudget = Number.isFinite(buyerBudget) ? buyerBudget : 0;
        const sellerBudget = Number(seller.budget);
        const safeSellerBudget = Number.isFinite(sellerBudget) ? sellerBudget : 0;

        const potentialBudget = safeBuyerBudget - cost;
        if (Number.isFinite(potentialBudget)) {
          // No limit on debt/money earned
          let borrowed = 0;
          if (safeBuyerBudget < cost) {
            borrowed = cost - safeBuyerBudget;
          }

          buyer.budget = safeBuyerBudget - cost;
          seller.budget = safeSellerBudget + cost;
          seller.quantity -= qty;

          assets[buyerId] = buyer;
          assets[sellerId] = seller;
          setAgentAssets(assets);
          setCompletedTrades(
            (prev) => [
              ...prev,
              {
                buyerId,
                buyerName: buyer.name,
                sellerId,
                sellerName: seller.name,
                product: seller.product,
                qty,
                cost,
              },
            ],
          );

          fetch("/api/agent/sync-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assets,
              meetingName: meetingName() || "assembly-meeting",
              lastTrade: {
                buyerId,
                sellerId,
                productName: seller.product,
                qty,
                price: finalUnitPrice,
                cost,
              },
              skills: agentSkills(),
            }),
          }).catch((err) => console.error("Failed to sync Phase 2 trade to DB:", err));

          const reasons = buyerReasonPool[buyerId]?.[sellerId] || ["cần nhập thêm hàng hóa phục vụ chuỗi cung ứng"];
          const buyerReason = reasons[buyerId.charCodeAt(0) % reasons.length];

          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const logMsg = t("[{time}] {buyer} mua {qty} {product} từ {seller} ({reason}): {cost} đ{negotiation}").replace(
            "{time}",
            timeStr,
          ).replace("{buyer}", t(buyer.name)).replace("{qty}", formatNumber(qty)).replace(
            "{product}",
            t(seller.product.split(" ")[0]),
          ).replace("{seller}", t(seller.name)).replace("{reason}", t(buyerReason)).replace("{cost}", formatCurrency(cost)).replace(
            "{negotiation}",
            negotiationText,
          );
          setTradeLogs((prev) => [{ text: logMsg }, ...prev || []]);

          if (borrowed > 0) {
            const borrowMsg = t(
              `💸 [{leader} tín dụng] Agent {buyer} vay nợ thêm {borrowed}${currencySymbol()} từ {leader} để hoàn tất giao dịch (Lãi suất nợ: 5% định kỳ).`,
            ).replace(/{leader}/g, t(currentLeader().name)).replace("{buyer}", t(buyer.name)).replace(
              "{borrowed}",
              formatCurrency(borrowed),
            );
            const chatMsg = {
              type: "chat",
              senderId: `bot_${currentLeader().id}`,
              sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
              text: borrowMsg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, chatMsg] as any);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMsg));
            }
          }

          let chatText = t("🤝 [Đàm phán {title}] Ta mua {qty} đơn vị từ {seller} vì {reason}. (Giá cân bằng: {price} đ/đơn vị)").replace(
            "{title}",
            t(buyerTitle),
          ).replace("{qty}", formatNumber(qty)).replace("{seller}", t(seller.name)).replace("{reason}", t(buyerReason)).replace(
            "{price}",
            formatCurrency(finalUnitPrice),
          );
          if (buyerSkill > sellerSkill) {
            chatText = t(
              "📊 [Đàm phán phân tích] Nhờ kỹ năng '{buyerTitle}' lấn lướt phong cách '{sellerTitle}' của {sellerName}, ta đã đàm phán thành công giảm giá {discount}%! Ta quyết định mua do {reason}. (Giá hời: {price} đ/đơn vị)",
            ).replace("{buyerTitle}", t(buyerTitle)).replace("{sellerTitle}", t(sellerTitle)).replace(
              "{sellerName}",
              t(seller.name),
            ).replace("{discount}", Math.round((1 - multiplier) * 100).toString()).replace("{reason}", t(buyerReason)).replace(
              "{price}",
              formatCurrency(finalUnitPrice),
            );
          } else if (buyerSkill < sellerSkill) {
            chatText = t(
              "⚠️ [Đàm phán bất lợi] Do phong cách '{buyerTitle}' của ta bị lối đàm phán '{sellerTitle}' của {sellerName} lấn lướt, đơn hàng bị đội giá thêm {markup}% nhưng ta vẫn chấp nhận mua do {reason}. (Giá cao: {price} đ/đơn vị)",
            ).replace("{buyerTitle}", t(buyerTitle)).replace("{sellerTitle}", t(sellerTitle)).replace(
              "{sellerName}",
              t(seller.name),
            ).replace("{markup}", Math.round((multiplier - 1) * 100).toString()).replace("{reason}", t(buyerReason)).replace(
              "{price}",
              formatCurrency(finalUnitPrice),
            );
          }

          const chatMsg = {
            type: "chat",
            senderId: `bot_${buyerId}`,
            sender: t(buyer.name),
            text: chatText,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };

          setMessages((prev) => [...prev, chatMsg] as any);

          // Tranh cãi thương mại: quyết định dựa trên DNA malice
          const shouldArgue = (AGENT_DNA[buyerId]?.malice || 0.5) > 0.6;
          if (shouldArgue) {
            const otherBots = remoteParticipants().filter((p) => p.isBot && p.id !== buyerId && p.id !== sellerId);
            if (otherBots.length > 0) {
              const arguer = otherBots[buyerId.charCodeAt(0) % otherBots.length];
              setTimeout(() => {
                triggerAgentResponse(arguer.id, arguer.name);
              }, 1500);
            }
          }
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chatMsg));
            ws.send(
              JSON.stringify({
                type: "trade-sync",
                assets,
                logs: [{ text: logMsg }, ...tradeLogs()],
                completedTrades: completedTrades(),
              }),
            );
            ws.send(
              JSON.stringify({
                type: "trade-draw",
                buyerId,
                buyerName: buyer.name,
                sellerId,
                sellerName: seller.name,
                product: seller.product,
                qty,
                cost,
              }),
            );
          }

          drawTradeOnWhiteboard(buyerId, sellerId, cost);
        }
      }
    };

    // Chạy vòng lặp giao dịch ảo (frontend-only) để tạo hiệu ứng animation & chat sôi động
    // Đã được tách riêng biệt với Database thông qua việc xoá gọi API sync-assets
    const interval = setInterval(runRandomTrade, 8000);
    setTradeIntervalId(interval);
  };

  // --- Whiteboard State ---
  const [showWhiteboard, setShowWhiteboard] = createSignal(false);
  const [activeDrawers, setActiveDrawers] = createSignal<
    Record<string, { name: string; x: number; y: number; color: string; time: number }>
  >({});
  let canvasRef;
  let colorInputRef;
  let isDrawing = false;
  let ctx;

  const getParticipantColor = (id: string) => {
    if (!id) return "#3b82f6";
    const cleanId = id.replace(/^bot_/, "");
    if (cleanId === "admin") return "#3b82f6";

    // Find character in LORE_CHARACTERS to parse avatarColor (e.g. from-pink-500 to-rose-500)
    const character = LORE_CHARACTERS.find((c) => c.id === cleanId);
    if (character && character.avatarColor) {
      const match = character.avatarColor.match(/from-([a-z]+)-([0-9]+)/);
      if (match) {
        const name = match[1];
        const colorMap: Record<string, string> = {
          pink: "#ec4899",
          purple: "#8b5cf6",
          blue: "#3b82f6",
          cyan: "#06b6d4",
          red: "#ef4444",
          violet: "#a78bfa",
          emerald: "#10b981",
          rose: "#f43f5e",
          amber: "#f59e0b",
          slate: "#4b5563",
          gray: "#9ca3af",
        };
        if (colorMap[name]) return colorMap[name];
      }
    }

    const fallbackColors = ["#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4", "#ef4444", "#10b981", "#f59e0b"];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % fallbackColors.length;
    return fallbackColors[index];
  };

  const saveFinalStateToDb = () => {
    const data = JSON.stringify({
      assets: agentAssets(),
      skills: agentSkills(),
    });
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon("/api/agent/sync-assets", blob);
    console.log("Đã lưu trạng thái lần cuối vào DB trước khi disconnect.");
  };

  let toolkitInterval: any;
  onCleanup(() => {
    if (toolkitInterval) clearInterval(toolkitInterval);
    if (tradeIntervalId()) clearInterval(tradeIntervalId());
    saveFinalStateToDb();
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", saveFinalStateToDb);
    }
  });

  onMount(async () => {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", saveFinalStateToDb);
    }
    fetch("/api/agent/gold-price").then((r) => r.json()).then((d) => {
      if (d?.success) {
        setGoldPrice({ buy: d.buy, sell: d.sell, updatedText: d.updatedText });
      }
    }).catch((err) => console.error("Failed to fetch initial gold price:", err));

    fetch("/api/agent/stock/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: [
          "ACB",
          "BCM",
          "BID",
          "BVH",
          "CTG",
          "FPT",
          "GAS",
          "GVR",
          "HDB",
          "HPG",
          "MBB",
          "MSN",
          "MWG",
          "PLX",
          "POW",
          "SAB",
          "SHB",
          "SSB",
          "SSI",
          "STB",
          "TCB",
          "TPB",
          "VCB",
          "VHM",
          "VIB",
          "VIC",
          "VJC",
          "VNM",
          "VPB",
          "VRE",
          "BTC",
        ],
      }),
    }).then((r) => r.json()).then((d) => {
      if (d?.success && d.quotes) {
        setStockQuotes(d.quotes.filter(Boolean));
      }
    }).catch((err) => console.error("Failed to fetch initial stock quotes:", err));

    initTensorEngine();
    try {
      const res = await fetch("/api/agent/assets");
      const data = await res.json();
      if (data.success && data.assets && Object.keys(data.assets).length > 0) {
        const defaultAssets = initialAssets();
        const mergedAssets = { ...defaultAssets };
        const loadedSkills: Record<string, { level: number; title: string; color: string }> = {};

        for (const key of Object.keys(data.assets)) {
          mergedAssets[key] = {
            ...defaultAssets[key],
            ...data.assets[key],
          };

          if (data.assets[key].skillLevel !== undefined && data.assets[key].skillTitle !== undefined) {
            const lvl = data.assets[key].skillLevel;
            const title = data.assets[key].skillTitle;
            const color = data.assets[key].color || "#9ca3af";

            loadedSkills[key] = { level: lvl, title, color };
          }
        }
        setAgentAssets(mergedAssets);
        if (Object.keys(loadedSkills).length > 0) {
          setAgentSkills(
            (prev) => ({
              ...prev,
              ...loadedSkills,
            }),
          );
        }
      } else {
        await fetch("/api/agent/sync-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: initialAssets(), skills: agentSkills() }),
        });
      }
      fetchToolkitReport();
      toolkitInterval = setInterval(fetchToolkitReport, 4000);

      // Load completed trades and trade logs from persistent DB
      fetch("/api/agent/completed-trades").then((r) => r.json()).then((d) => {
        if (d.success) {
          if (d.completedTrades && d.completedTrades.length > 0) {
            setCompletedTrades(d.completedTrades);
          }
          if (d.logs && d.logs.length > 0) {
            const normalized = d.logs.map((item: any) => {
              if (typeof item === "string") return { text: item };
              if (item && typeof item === "object" && typeof item.text === "string") return item;
              return { text: "" };
            });
            setTradeLogs(normalized);
          }
        }
      }).catch((err) => console.error("Failed to load persistent trade history:", err));

      // Auto-join meeting if room parameter or query parameter exists
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = params.roomCode || urlParams.get("room");
        if (roomParam) {
          setMeetingName(roomParam);
          startMeeting();
        }
      }
    } catch (err) {
      console.error("Failed to load agent assets from DB:", err);
    }
  });

  onMount(() => {
    const interval = setInterval(() => {
      fetch("/api/agent/stock/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: [
            "ACB",
            "BCM",
            "BID",
            "BVH",
            "CTG",
            "FPT",
            "GAS",
            "GVR",
            "HDB",
            "HPG",
            "MBB",
            "MSN",
            "MWG",
            "PLX",
            "POW",
            "SAB",
            "SHB",
            "SSB",
            "SSI",
            "STB",
            "TCB",
            "TPB",
            "VCB",
            "VHM",
            "VIB",
            "VIC",
            "VJC",
            "VNM",
            "VPB",
            "VRE",
            "BTC",
          ],
        }),
      }).then((r) => r.json()).then((d) => {
        if (d?.success && d.quotes) {
          setStockQuotes((prevQuotes) => {
            const prevMap = new Map(prevQuotes.map((q) => [q.symbol, q.price]));
            return d.quotes.filter(Boolean).map((q: any) => {
              const currentPrice = Number(q.price);
              const oldPrice = prevMap.get(q.symbol);
              let trend = "neutral";
              if (oldPrice !== undefined) {
                if (currentPrice > oldPrice) trend = "up";
                else if (currentPrice < oldPrice) trend = "down";
                else trend = prevQuotes.find((x) => x.symbol === q.symbol)?.trend || "neutral";
              }
              return { ...q, trend };
            });
          });
        }
      }).catch((err) => console.error("Failed to fetch stock quotes:", err));
    }, 15000);
    onCleanup(() => clearInterval(interval));
  });

  onMount(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveDrawers((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, data] of Object.entries(next)) {
          if (now - data.time > 2000) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    onCleanup(() => clearInterval(interval));
  });

  onMount(() => {
    const handleResize = () => {
      if (canvasRef) {
        // Backup current canvas content
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvasRef.width;
        tempCanvas.height = canvasRef.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.drawImage(canvasRef, 0, 0);
        }

        // Resize
        canvasRef.width = canvasRef.offsetWidth || 800;
        canvasRef.height = canvasRef.offsetHeight || 500;

        // Restore content
        const rCtx = canvasRef.getContext("2d");
        if (rCtx) {
          rCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvasRef.width, canvasRef.height);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  const colorizePoints = (shape: string, points: any[]): any[] => {
    const p = shape.toLowerCase();
    let getPtColor: (idx: number, isStart?: boolean) => string;

    if (p.includes("ngô") || p.includes("corn") || p.includes("bắp")) {
      getPtColor = (idx: number) => {
        if (idx < 12) return "#16a34a"; // Husk outer leaf
        if (idx < 24) return "#facc15"; // Cob/kernel yellow
        return "#d97706"; // Silk orange/amber
      };
    } else if (
      p.includes("thảo dược") || p.includes("herb") || p.includes("chè") || p.includes("trà") || p.includes("tea") || p.includes("sâm") ||
        p.includes("ginseng") ||
        p.includes("măng") ||
        p.includes("bamboo")
    ) {
      getPtColor = (idx: number) => {
        if (idx < 2) return "#78350f"; // Trunk
        if (idx < 15) return "#22c55e"; // Leaves green
        return "#ec4899"; // Flower pink
      };
    } else if (p.includes("bơ") || p.includes("avocado")) {
      getPtColor = (idx: number) => {
        if (idx < 13) return "#14532d"; // Skin
        if (idx < 22) return "#bef264"; // Pulp
        return "#78350f"; // Pit/Seed
      };
    } else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) {
      getPtColor = (idx: number) => {
        if (idx < 5) return "#22c55e"; // green stem
        return "#eab308"; // gold grains
      };
    } else if (p.includes("heo") || p.includes("pig") || p.includes("thịt")) {
      getPtColor = (idx: number) => {
        if (idx < 11) return "#f472b6"; // body pink
        if (idx < 16) return "#ec4899"; // nose hot pink
        if (idx < 22) return "#111827"; // eyes/nostrils dark
        return "#f472b6"; // tail/ears pink
      };
    } else if (p.includes("tỏi") || p.includes("garlic")) {
      getPtColor = (idx: number) => {
        if (idx < 25) return "#e2e8f0"; // bulb white/slate
        if (idx < 35) return "#cbd5e1"; // middle clove lines slate-300
        if (idx < 40) return "#b45309"; // roots brown
        return "#94a3b8"; // skin details
      };
    } else if (p.includes("cà phê") || p.includes("coffee")) {
      getPtColor = (idx: number) => {
        if (idx < 5) return "#ef4444"; // red cup top
        if (idx < 10) return "#78350f"; // coffee liquid
        return "#38bdf8"; // steam
      };
    } else if (p.includes("mật") || p.includes("honey")) {
      getPtColor = (idx: number) => {
        if (idx < 5) return "#b91c1c"; // red lid
        if (idx < 15) return "#f59e0b"; // jar body amber
        return "#d97706"; // dipper
      };
    } else if (p.includes("cooler") || p.includes("làm mát")) {
      getPtColor = (idx: number) => {
        if (idx < 13) return "#64748b"; // circle slate
        return "#06b6d4"; // fan blades cyan
      };
    } else if (p.includes("fertilizer") || p.includes("trùn")) {
      getPtColor = (idx: number) => {
        if (idx < 5) return "#78350f"; // brown bag
        return "#22c55e"; // green sprouts
      };
    } else if (p.includes("sensor") || p.includes("iot")) {
      getPtColor = (idx: number) => {
        if (idx < 8) return "#64748b"; // base gray
        return "#ef4444"; // signal red
      };
    } else if (
      p.includes("fruit") || p.includes("mít") || p.includes("khoai") || p.includes("potato") || p.includes("hạt điều") ||
        p.includes("cashew") ||
        p.includes("lạc") ||
        p.includes("peanut") ||
        p.includes("tiêu") ||
        p.includes("pepper")
    ) {
      getPtColor = (idx: number) => {
        if (idx < 6) return "#fb923c"; // orange body
        return "#22c55e"; // green stem
      };
    } else if (p.includes("valve") || p.includes("van")) {
      getPtColor = (idx: number) => {
        if (idx < 5) return "#475569"; // body gray
        return "#ef4444"; // handle red
      };
    } else if (p.includes("charcoal") || p.includes("than")) {
      getPtColor = (idx: number) => {
        if (idx < 4) return "#1f2937"; // wood dark
        return "#ef4444"; // flame red
      };
    } else if (p.includes("greenhouse") || p.includes("màng")) {
      getPtColor = (idx: number) => {
        if (idx < 6) return "#64748b"; // frame gray
        return "#22d3ee"; // glass cyan
      };
    } else if (p.includes("report") || p.includes("chỉ số") || p.includes("tin")) {
      getPtColor = (idx: number) => {
        if (idx < 4) return "#64748b"; // axis gray
        if (idx < 8) return "#3b82f6"; // bar 1 blue
        return "#10b981"; // bar 2 green
      };
    } else if (p.includes("profile") || p.includes("portrait") || p.includes("chân dung")) {
      getPtColor = (idx: number) => {
        if (idx < 15) return "#fef08a"; // face outline yellow
        if (idx < 20) return "#3b82f6"; // eye blue
        return "#ef4444"; // beret red
      };
    } else {
      getPtColor = () => "#3b82f6";
    }

    return points.map(
      (pt, idx) => ({
        ...pt,
        color: pt.color || getPtColor(idx, pt.isStart),
      }),
    );
  };

  const generateProductPoints = (shape: string, cx: number, cy: number, size: number, skillLevel: number = 5) => {
    const pts: { x: number; y: number; isStart?: boolean; color?: string }[] = [];

    const p = shape.toLowerCase();
    let localShape = shape;
    if (p.includes("bơ") || p.includes("avocado")) localShape = "avocado";
    else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) localShape = "rice";
    else if (
      p.includes("báo cáo") || p.includes("chỉ số") || p.includes("tin") || p.includes("bản tin") || p.includes("report")
    ) localShape = "report";
    else if (p.includes("phân") || p.includes("trùn") || p.includes("fertilizer")) localShape = "fertilizer";
    else if (p.includes("cảm biến") || p.includes("iot") || p.includes("sensor")) localShape = "sensor";
    else if (p.includes("heo") || p.includes("thịt") || p.includes("pig") || p.includes("bò")) localShape = "pig";
    else if (
      p.includes("mít") || p.includes("sấy") || p.includes("fruit") || p.includes("khoai") || p.includes("potato") ||
        p.includes("hạt điều") ||
        p.includes("cashew") ||
        p.includes("lạc") ||
        p.includes("peanut") ||
        p.includes("tiêu") ||
        p.includes("pepper")
    ) localShape = "fruit";
    else if (p.includes("tưới") || p.includes("van") || p.includes("valve")) localShape = "valve";
    else if (p.includes("than") || p.includes("charcoal") || p.includes("biochar")) localShape = "charcoal";
    else if (p.includes("ngô") || p.includes("bắp") || p.includes("corn")) localShape = "corn";
    else if (p.includes("cà phê") || p.includes("coffee")) localShape = "coffee";
    else if (p.includes("màng") || p.includes("nhà kính") || p.includes("greenhouse") || p.includes("kéo")) localShape = "greenhouse";
    else if (p.includes("làm mát") || p.includes("cooler") || p.includes("sấy thăng hoa")) localShape = "cooler";
    else if (p.includes("mật") || p.includes("ong") || p.includes("honey")) localShape = "honey";
    else if (p.includes("tỏi") || p.includes("garlic")) localShape = "garlic";
    else if (
      p.includes("thảo dược") || p.includes("dược") || p.includes("herb") || p.includes("chè") || p.includes("trà") || p.includes("tea") ||
        p.includes("sâm") ||
        p.includes("ginseng") ||
        p.includes("măng") ||
        p.includes("bamboo")
    ) localShape = "herb";
    else if (
      p.includes("chân dung") || p.includes("profile") || p.includes("họa") || p.includes("portrait") || p.includes("vẽ") ||
        p.includes("art")
    ) localShape = "profile";

    shape = localShape;

    if (shape === "garlic") {
      // Outer bulb of the garlic
      // Bottom round part
      for (let i = 0; i <= 12; i++) {
        const angle = -Math.PI + (i * Math.PI) / 12;
        pts.push({
          x: cx + 18 * Math.cos(angle),
          y: cy + 8 + 18 * Math.sin(angle),
          isStart: i === 0,
        });
      }
      // Right side taper to top point (0, -22)
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        pts.push({ x: cx + 18 * (1 - t), y: cy + 8 * (1 - t) - 22 * t });
      }
      // Left side taper from top point to bottom left
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        pts.push({ x: cx - 18 * t, y: cy - 22 * (1 - t) + 8 * t });
      }
      // Clove vertical line down the middle
      pts.push({ x: cx, y: cy - 22, isStart: true });
      pts.push({ x: cx, y: cy + 26 });
      // Left clove line
      pts.push({ x: cx, y: cy - 20, isStart: true });
      pts.push({ x: cx - 8, y: cy + 5 });
      pts.push({ x: cx - 4, y: cy + 24 });
      // Right clove line
      pts.push({ x: cx, y: cy - 20, isStart: true });
      pts.push({ x: cx + 8, y: cy + 5 });
      pts.push({ x: cx + 4, y: cy + 24 });
    } else if (shape === "profile") {
      // Draw a classic human face profile silhouette (forehead, nose, lips, chin, jawline)
      pts.push({ x: cx - 10, y: cy - 25, isStart: true }); // Top of head
      pts.push({ x: cx + 10, y: cy - 23 }); // Forehead round
      pts.push({ x: cx + 12, y: cy - 15 }); // Brow
      pts.push({ x: cx + 8, y: cy - 10 }); // Eye bridge indent
      pts.push({ x: cx + 18, y: cy - 6 }); // Nose tip
      pts.push({ x: cx + 12, y: cy }); // Under nose
      pts.push({ x: cx + 16, y: cy + 3 }); // Upper lip
      pts.push({ x: cx + 11, y: cy + 6 }); // Mouth line
      pts.push({ x: cx + 15, y: cy + 10 }); // Lower lip
      pts.push({ x: cx + 8, y: cy + 15 }); // Under lip indent
      pts.push({ x: cx + 12, y: cy + 20 }); // Chin
      pts.push({ x: cx + 2, y: cy + 25 }); // Jawline
      pts.push({ x: cx - 12, y: cy + 22 }); // Back of neck/jaw
      pts.push({ x: cx - 15, y: cy + 10 }); // Ear area
      pts.push({ x: cx - 16, y: cy - 10 }); // Back of head
      pts.push({ x: cx - 10, y: cy - 25 }); // Close path

      // Draw an eye
      pts.push({ x: cx + 5, y: cy - 8, isStart: true });
      pts.push({ x: cx + 8, y: cy - 7 });
      pts.push({ x: cx + 5, y: cy - 6 });

      // Draw a classic artist hat (beret) on top
      pts.push({ x: cx - 15, y: cy - 22, isStart: true });
      pts.push({ x: cx - 5, y: cy - 35 });
      pts.push({ x: cx + 15, y: cy - 28 });
      pts.push({ x: cx + 5, y: cy - 20 });
      pts.push({ x: cx - 15, y: cy - 22 });
      pts.push({ x: cx - 5, y: cy - 35, isStart: true });
      pts.push({ x: cx - 8, y: cy - 40 }); // Hat tip/antenna
    } else if (shape === "rice") {
      pts.push({ x: cx - 10, y: cy + 25, isStart: true });
      pts.push({ x: cx - 5, y: cy + 10 });
      pts.push({ x: cx, y: cy });
      pts.push({ x: cx + 5, y: cy - 10 });
      pts.push({ x: cx + 10, y: cy - 25 });

      pts.push({ x: cx - 5, y: cy + 10, isStart: true });
      pts.push({ x: cx - 20, y: cy + 5 });
      pts.push({ x: cx - 5, y: cy + 10 });

      pts.push({ x: cx, y: cy, isStart: true });
      pts.push({ x: cx + 15, y: cy - 5 });
      pts.push({ x: cx, y: cy });

      pts.push({ x: cx + 5, y: cy - 10, isStart: true });
      pts.push({ x: cx - 10, y: cy - 15 });
      pts.push({ x: cx + 5, y: cy - 10 });

      pts.push({ x: cx + 10, y: cy - 25, isStart: true });
      pts.push({ x: cx + 20, y: cy - 30 });
      pts.push({ x: cx + 10, y: cy - 25 });
    } else if (shape === "cooler") {
      for (let i = 0; i <= 12; i++) {
        const angle = (i * 2 * Math.PI) / 12;
        pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
      }
      pts.push({ x: cx, y: cy, isStart: true });
      pts.push({ x: cx, y: cy - size });
      pts.push({ x: cx, y: cy, isStart: true });
      pts.push({ x: cx + size, y: cy });
      pts.push({ x: cx, y: cy, isStart: true });
      pts.push({ x: cx, y: cy + size });
      pts.push({ x: cx, y: cy, isStart: true });
      pts.push({ x: cx - size, y: cy });
    } else if (shape === "fertilizer") {
      pts.push({ x: cx - 20, y: cy + 20, isStart: true });
      pts.push({ x: cx + 20, y: cy + 20 });
      pts.push({ x: cx + 15, y: cy - 15 });
      pts.push({ x: cx - 15, y: cy - 15 });
      pts.push({ x: cx - 20, y: cy + 20 });

      pts.push({ x: cx, y: cy - 15, isStart: true });
      pts.push({ x: cx - 8, y: cy - 25 });
      pts.push({ x: cx, y: cy - 15, isStart: true });
      pts.push({ x: cx + 8, y: cy - 25 });
    } else if (shape === "sensor") {
      pts.push({ x: cx, y: cy + 25, isStart: true });
      pts.push({ x: cx, y: cy - 5 });

      pts.push({ x: cx - 15, y: cy - 5, isStart: true });
      pts.push({ x: cx + 15, y: cy - 5 });
      pts.push({ x: cx + 15, y: cy - 25 });
      pts.push({ x: cx - 15, y: cy - 25 });
      pts.push({ x: cx - 15, y: cy - 5 });

      pts.push({ x: cx - 10, y: cy - 30, isStart: true });
      pts.push({ x: cx, y: cy - 35 });
      pts.push({ x: cx + 10, y: cy - 30 });
    } else if (shape === "pig") {
      for (let i = 0; i <= 10; i++) {
        const angle = (i * 2 * Math.PI) / 10;
        pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
      }
      pts.push({ x: cx - 10, y: cy + 5, isStart: true });
      pts.push({ x: cx + 10, y: cy + 5 });
      pts.push({ x: cx + 10, y: cy + 15 });
      pts.push({ x: cx - 10, y: cy + 15 });
      pts.push({ x: cx - 10, y: cy + 5 });

      pts.push({ x: cx - 4, y: cy + 10, isStart: true });
      pts.push({ x: cx - 4, y: cy + 11 });
      pts.push({ x: cx + 4, y: cy + 10, isStart: true });
      pts.push({ x: cx + 4, y: cy + 11 });

      // Pig eyes
      pts.push({ x: cx - 6, y: cy - 5, isStart: true });
      pts.push({ x: cx - 6, y: cy - 4 });
      pts.push({ x: cx + 6, y: cy - 5, isStart: true });
      pts.push({ x: cx + 6, y: cy - 4 });

      pts.push({ x: cx - 15, y: cy - 15, isStart: true });
      pts.push({ x: cx - 25, y: cy - 25 });
      pts.push({ x: cx - 5, y: cy - 20 });

      pts.push({ x: cx + 15, y: cy - 15, isStart: true });
      pts.push({ x: cx + 25, y: cy - 25 });
      pts.push({ x: cx + 5, y: cy - 20 });
    } else if (shape === "fruit") {
      pts.push({ x: cx - 25, y: cy + 15, isStart: true });
      pts.push({ x: cx, y: cy - 20 });
      pts.push({ x: cx + 25, y: cy + 15 });
      pts.push({ x: cx - 25, y: cy + 15 });
      pts.push({ x: cx, y: cy + 5 });
      pts.push({ x: cx + 25, y: cy + 15 });
      pts.push({ x: cx - 10, y: cy + 8, isStart: true });
      pts.push({ x: cx - 10, y: cy + 9 });
      pts.push({ x: cx + 10, y: cy + 8, isStart: true });
      pts.push({ x: cx + 10, y: cy + 9 });
    } else if (shape === "valve") {
      pts.push({ x: cx, y: cy - 25, isStart: true });
      pts.push({ x: cx + 20, y: cy + 10 });
      pts.push({ x: cx, y: cy + 25 });
      pts.push({ x: cx - 20, y: cy + 10 });
      pts.push({ x: cx, y: cy - 25 });

      pts.push({ x: cx - 8, y: cy + 10, isStart: true });
      pts.push({ x: cx, y: cy + 15 });
      pts.push({ x: cx + 8, y: cy + 10 });
    } else if (shape === "charcoal") {
      pts.push({ x: cx - 20, y: cy - 10, isStart: true });
      pts.push({ x: cx + 20, y: cy + 10 });
      pts.push({ x: cx - 20, y: cy + 10, isStart: true });
      pts.push({ x: cx + 20, y: cy - 10 });
      pts.push({ x: cx - 10, y: cy - 5, isStart: true });
      pts.push({ x: cx + 10, y: cy - 5 });
    } else if (shape === "corn") {
      pts.push({ x: cx, y: cy - 25, isStart: true });
      pts.push({ x: cx - 15, y: cy });
      pts.push({ x: cx, y: cy + 25 });
      pts.push({ x: cx, y: cy - 25, isStart: true });
      pts.push({ x: cx + 15, y: cy });
      pts.push({ x: cx, y: cy + 25 });

      pts.push({ x: cx, y: cy - 25, isStart: true });
      pts.push({ x: cx, y: cy + 25 });
      pts.push({ x: cx - 12, y: cy - 10, isStart: true });
      pts.push({ x: cx + 12, y: cy - 10 });
      pts.push({ x: cx - 15, y: cy, isStart: true });
      pts.push({ x: cx + 15, y: cy });
      pts.push({ x: cx - 12, y: cy + 10, isStart: true });
      pts.push({ x: cx + 12, y: cy + 10 });
    } else if (shape === "coffee") {
      pts.push({ x: cx - 20, y: cy - 10, isStart: true });
      pts.push({ x: cx + 20, y: cy - 10 });
      pts.push({ x: cx + 15, y: cy + 15 });
      pts.push({ x: cx - 15, y: cy + 15 });
      pts.push({ x: cx - 20, y: cy - 10 });

      pts.push({ x: cx + 15, y: cy - 5, isStart: true });
      pts.push({ x: cx + 25, y: cy - 5 });
      pts.push({ x: cx + 22, y: cy + 10 });
      pts.push({ x: cx + 15, y: cy + 10 });

      pts.push({ x: cx - 8, y: cy - 15, isStart: true });
      pts.push({ x: cx - 8, y: cy - 25 });
      pts.push({ x: cx, y: cy - 15, isStart: true });
      pts.push({ x: cx, y: cy - 25 });
      pts.push({ x: cx + 8, y: cy - 15, isStart: true });
      pts.push({ x: cx + 8, y: cy - 25 });
    } else if (shape === "greenhouse") {
      pts.push({ x: cx - 25, y: cy + 20, isStart: true });
      pts.push({ x: cx + 25, y: cy + 20 });
      pts.push({ x: cx + 25, y: cy + 5 });
      pts.push({ x: cx, y: cy - 20 });
      pts.push({ x: cx - 25, y: cy + 5 });
      pts.push({ x: cx - 25, y: cy + 20 });

      pts.push({ x: cx, y: cy - 20, isStart: true });
      pts.push({ x: cx, y: cy + 20 });
      pts.push({ x: cx - 12, y: cy - 7, isStart: true });
      pts.push({ x: cx - 12, y: cy + 20 });
      pts.push({ x: cx + 12, y: cy - 7, isStart: true });
      pts.push({ x: cx + 12, y: cy + 20 });
    } else if (shape === "report") {
      // Draw a chart (X-axis, Y-axis, and 2 bars)
      pts.push({ x: cx - 18, y: cy + 18, isStart: true });
      pts.push({ x: cx + 18, y: cy + 18 }); // X-axis
      pts.push({ x: cx - 18, y: cy - 18, isStart: true });
      pts.push({ x: cx - 18, y: cy + 18 }); // Y-axis
      // Bar 1
      pts.push({ x: cx - 10, y: cy + 18, isStart: true });
      pts.push({ x: cx - 10, y: cy - 2 });
      pts.push({ x: cx - 2, y: cy - 2 });
      pts.push({ x: cx - 2, y: cy + 18 });
      // Bar 2
      pts.push({ x: cx + 4, y: cy + 18, isStart: true });
      pts.push({ x: cx + 4, y: cy - 10 });
      pts.push({ x: cx + 12, y: cy - 10 });
      pts.push({ x: cx + 12, y: cy + 18 });
    } else if (shape === "honey") {
      // Draw a honey jar
      // Rim/lid of the jar
      pts.push({ x: cx - 12, y: cy - 18, isStart: true });
      pts.push({ x: cx + 12, y: cy - 18 });
      pts.push({ x: cx + 12, y: cy - 14 });
      pts.push({ x: cx - 12, y: cy - 14 });
      pts.push({ x: cx - 12, y: cy - 18 });

      // Body of the jar
      pts.push({ x: cx - 10, y: cy - 14, isStart: true });
      pts.push({ x: cx - 16, y: cy - 4 });
      pts.push({ x: cx - 16, y: cy + 12 });
      pts.push({ x: cx - 10, y: cy + 20 });
      pts.push({ x: cx + 10, y: cy + 20 });
      pts.push({ x: cx + 16, y: cy + 12 });
      pts.push({ x: cx + 16, y: cy - 4 });
      pts.push({ x: cx + 10, y: cy - 14 });

      // Honey dripping dipper
      pts.push({ x: cx, y: cy - 14, isStart: true });
      pts.push({ x: cx, y: cy + 2 });

      // A drop at the bottom of the dipper
      pts.push({ x: cx - 3, y: cy + 5, isStart: true });
      pts.push({ x: cx + 3, y: cy + 5 });
      pts.push({ x: cx, y: cy + 8 });
      pts.push({ x: cx - 3, y: cy + 5 });
    } else if (shape === "avocado") {
      // Outer pear-shape shell of the avocado
      for (let i = 0; i <= 12; i++) {
        const angle = (i * 2 * Math.PI) / 12;
        const radiusX = 14;
        const radiusY = 22;
        const factor =
          angle > 0 && angle < Math.PI ? 1.25 : 0.8; // wider at bottom
        pts.push({
          x: cx + radiusX * Math.cos(angle),
          y: cy + radiusY * Math.sin(angle) * factor,
          isStart: i === 0,
        });
      }

      // Inner pit (large seed in the middle/bottom)
      for (let i = 0; i <= 8; i++) {
        const angle = (i * 2 * Math.PI) / 8;
        const radius = 6;
        pts.push({
          x: cx + radius * Math.cos(angle),
          y: cy + 6 + radius * Math.sin(angle), // centered lower down
          isStart: i === 0,
        });
      }

      // Tiny stem at the top
      pts.push({ x: cx, y: cy - 18, isStart: true });
      pts.push({ x: cx + 3, y: cy - 23 });
    } else if (shape !== "herb") {
      // Procedural generation based on product name hash
      let hash = 0;
      for (let i = 0; i < shape.length; i++) {
        hash = shape.charCodeAt(i) + ((hash << 5) - hash);
      }
      const shapeType = Math.abs(hash) % 3;
      if (shapeType === 0) {
        // Round organic shape
        const numSides = 8 + Math.abs(hash) % 5;
        for (let i = 0; i <= numSides; i++) {
          const angle = (i * 2 * Math.PI) / numSides;
          const r = 16 + Math.sin(angle * 3 + hash) * 3;
          pts.push({
            x: cx + Math.round(r * Math.cos(angle)),
            y: cy + Math.round(r * Math.sin(angle)),
            isStart: i === 0,
          });
        }
        // Leaf/stem
        pts.push({ x: cx, y: cy - 15, isStart: true });
        pts.push({ x: cx + 5, y: cy - 22 });
        pts.push({ x: cx - 2, y: cy - 25 });
        pts.push({ x: cx, y: cy - 15 });
      } else if (shapeType === 1) {
        // Hexagonal/box shape
        pts.push({ x: cx - 15, y: cy + 15, isStart: true });
        pts.push({ x: cx + 15, y: cy + 15 });
        pts.push({ x: cx + 10, y: cy - 15 });
        pts.push({ x: cx - 10, y: cy - 15 });
        pts.push({ x: cx - 15, y: cy + 15 });
        pts.push({ x: cx - 10, y: cy, isStart: true });
        pts.push({ x: cx + 10, y: cy });
      } else {
        // Flower/Starburst
        const numPoints = 5 + Math.abs(hash) % 4;
        for (let i = 0; i <= numPoints * 2; i++) {
          const angle = (i * Math.PI) / numPoints;
          const r =
            i % 2 === 0 ? 20 : 8;
          pts.push({
            x: cx + Math.round(r * Math.cos(angle)),
            y: cy + Math.round(r * Math.sin(angle)),
            isStart: i === 0,
          });
        }
      }
    } else {
      // Trunk
      pts.push({ x: cx, y: cy + 25, isStart: true });
      pts.push({ x: cx, y: cy - 15 });

      // Left branch
      pts.push({ x: cx, y: cy - 5, isStart: true });
      pts.push({ x: cx - 15, y: cy - 15 });
      // Left leaf
      pts.push({ x: cx - 20, y: cy - 25 });
      pts.push({ x: cx - 10, y: cy - 25 });
      pts.push({ x: cx - 15, y: cy - 15 });

      // Right branch
      pts.push({ x: cx, y: cy - 5, isStart: true });
      pts.push({ x: cx + 15, y: cy - 15 });
      // Right leaf
      pts.push({ x: cx + 20, y: cy - 25 });
      pts.push({ x: cx + 10, y: cy - 25 });
      pts.push({ x: cx + 15, y: cy - 15 });

      // Top leaf
      pts.push({ x: cx, y: cy - 15, isStart: true });
      pts.push({ x: cx - 6, y: cy - 30 });
      pts.push({ x: cx + 6, y: cy - 30 });
      pts.push({ x: cx, y: cy - 15 });
    }

    // Tier 1 (Level >= 6): Basic extra details to enrich the drawing
    if (skillLevel >= 6) {
      if (shape === "honey") {
        // Honey dripping line from the dipper
        pts.push({ x: cx, y: cy + 8, isStart: true });
        pts.push({ x: cx, y: cy + 13 });
      } else if (shape === "rice") {
        // First grain of rice on the ground
        pts.push({ x: cx - 18, y: cy + 18, isStart: true });
        pts.push({ x: cx - 15, y: cy + 21 });
      } else if (shape === "coffee") {
        // First wave of steam
        pts.push({ x: cx - 6, y: cy - 15, isStart: true });
        pts.push({ x: cx - 8, y: cy - 21 });
        pts.push({ x: cx - 6, y: cy - 26 });
      } else if (shape === "pig") {
        // Little ears details
        pts.push({ x: cx - 12, y: cy - 18, isStart: true });
        pts.push({ x: cx - 15, y: cy - 22 });
      } else if (shape === "corn") {
        // Leaf fold on the side
        pts.push({ x: cx - 15, y: cy, isStart: true });
        pts.push({ x: cx - 20, y: cy + 10 });
      } else if (shape === "herb") {
        // Extra leaf node
        pts.push({ x: cx, y: cy + 10, isStart: true });
        pts.push({ x: cx - 12, y: cy + 5 });
      } else if (shape === "fruit") {
        // Stem leaf
        pts.push({ x: cx, y: cy - 20, isStart: true });
        pts.push({ x: cx - 10, y: cy - 25 });
      } else if (shape === "sensor") {
        // First signal wave
        pts.push({ x: cx - 18, y: cy - 32, isStart: true });
        pts.push({ x: cx - 23, y: cy - 34 });
      } else if (shape === "avocado") {
        // Small leaf on the stem
        pts.push({ x: cx + 3, y: cy - 23, isStart: true });
        pts.push({ x: cx - 5, y: cy - 26 });
      } else if (shape === "garlic") {
        // Small roots at the bottom of the bulb
        pts.push({ x: cx - 4, y: cy + 26, isStart: true });
        pts.push({ x: cx - 2, y: cy + 29 });
        pts.push({ x: cx, y: cy + 27 });
        pts.push({ x: cx + 2, y: cy + 29 });
        pts.push({ x: cx + 4, y: cy + 26 });
      }
    }

    // Tier 2 (Level >= 11): Advanced extra details for master artists
    if (skillLevel >= 11) {
      if (shape === "honey") {
        // Little bee flying nearby
        pts.push({ x: cx + 14, y: cy - 20, isStart: true });
        pts.push({ x: cx + 20, y: cy - 20 });
        pts.push({ x: cx + 17, y: cy - 24, isStart: true });
        pts.push({ x: cx + 17, y: cy - 16 });
      } else if (shape === "rice") {
        // Second grain of rice on the ground
        pts.push({ x: cx + 18, y: cy + 16, isStart: true });
        pts.push({ x: cx + 21, y: cy + 19 });
      } else if (shape === "coffee") {
        // Second wave of steam
        pts.push({ x: cx + 6, y: cy - 15, isStart: true });
        pts.push({ x: cx + 4, y: cy - 21 });
        pts.push({ x: cx + 6, y: cy - 26 });
      } else if (shape === "pig") {
        // Curly tail
        pts.push({ x: cx - 21, y: cy + 8, isStart: true });
        pts.push({ x: cx - 26, y: cy + 4 });
        pts.push({ x: cx - 24, y: cy + 1 });
        pts.push({ x: cx - 21, y: cy + 3 });
      } else if (shape === "corn") {
        // Extra corn silk lines
        pts.push({ x: cx - 3, y: cy - 26, isStart: true });
        pts.push({ x: cx - 5, y: cy - 30 });
        pts.push({ x: cx + 3, y: cy - 26, isStart: true });
        pts.push({ x: cx + 5, y: cy - 30 });
      } else if (shape === "herb") {
        // Flower petals on the top leaf
        pts.push({ x: cx, y: cy - 30, isStart: true });
        pts.push({ x: cx - 6, y: cy - 36 });
        pts.push({ x: cx, y: cy - 30, isStart: true });
        pts.push({ x: cx + 6, y: cy - 36 });
      } else if (shape === "fruit") {
        // Slice of fruit drawn next to it
        pts.push({ x: cx + 22, y: cy + 16, isStart: true });
        pts.push({ x: cx + 27, y: cy + 11 });
        pts.push({ x: cx + 24, y: cy + 18 });
      } else if (shape === "sensor") {
        // Second signal wave (right side)
        pts.push({ x: cx + 18, y: cy - 32, isStart: true });
        pts.push({ x: cx + 23, y: cy - 34 });
      } else if (shape === "avocado") {
        // Small crescent highlight inside the seed/pit
        pts.push({ x: cx - 2, y: cy + 4, isStart: true });
        pts.push({ x: cx, y: cy + 5 });
      } else if (shape === "garlic") {
        // Papery skin texture lines on the sides
        pts.push({ x: cx - 12, y: cy + 12, isStart: true });
        pts.push({ x: cx - 10, y: cy + 18 });
        pts.push({ x: cx + 12, y: cy + 12, isStart: true });
        pts.push({ x: cx + 10, y: cy + 18 });
      }
    }

    // Tier 3 (Level >= 14): Legend level - glowing sparkles
    if (skillLevel >= 14) {
      // Small sparkle cross 1 (top-left)
      pts.push({ x: cx - 22, y: cy - 20, isStart: true });
      pts.push({ x: cx - 18, y: cy - 20 });
      pts.push({ x: cx - 20, y: cy - 22, isStart: true });
      pts.push({ x: cx - 20, y: cy - 18 });

      // Small sparkle cross 2 (top-right)
      pts.push({ x: cx + 18, y: cy - 20, isStart: true });
      pts.push({ x: cx + 22, y: cy - 20 });
      pts.push({ x: cx + 20, y: cy - 22, isStart: true });
      pts.push({ x: cx + 20, y: cy - 18 });
    }

    const colorized = colorizePoints(shape, pts);
    pts.length = 0;
    pts.push(...colorized);

    // Apply jitter based on skill level (higher level = less jitter / more realistic)
    const jitter = Math.max(0, 15 - skillLevel) * 0.15; // level 15 has 0 jitter, level 1 has 2.1px jitter (subtle natural variation)
    if (jitter > 0) {
      for (let i = 0; i < pts.length; i++) {
        pts[i].x += (((i * 7) % 10) / 10 - 0.5) * jitter;
        pts[i].y += (((i * 13) % 10) / 10 - 0.5) * jitter;
      }
    }

    return pts;
  };

  const getFourColor = (id: string): string => {
    return getParticipantColor(id);
  };

  const simulateAgentDrawing = async (botId: string, botName: string) => {
    if (!canvasRef) return;

    const cleanId = botId.replace(/^bot_/, "");
    if (cleanId === "admin") return;

    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const idx = botIds.indexOf(cleanId);
    if (idx === -1) return;

    const assets = { ...agentAssets() };
    const agent = assets[cleanId];
    if (!agent) return;

    let drawerId = cleanId;
    let drawerName = botName;
    let label = `Chào bán: ${agent.product}`;
    let skillLevel = agentSkills()[cleanId]?.level || 5;

    // Chat message
    const chatMsg = {
      type: "chat",
      senderId: `bot_${cleanId}`,
      sender: botName,
      text: `✏️ Tôi vừa vẽ xong sơ đồ mặt hàng "${agent.product}" trên bảng trắng, mời mọi người xem nhé!`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(chatMsg));
    }
    setMessages((prev) => [...prev, chatMsg] as any);

    const width = canvasRef.offsetWidth || 800;
    const height = canvasRef.offsetHeight || 500;
    const colWidth = width / 4;
    const rowHeight = height / 3;
    const row = Math.floor(idx / 4);
    const col = idx % 4;

    const cx = col * colWidth + colWidth / 2;
    const cy = row * rowHeight + rowHeight / 2 + 10;
    const size = 20;

    let color = getFourColor(drawerId);

    let points: { x: number; y: number; isStart?: boolean; color?: string }[] = [];
    try {
      const res = await fetch("/api/agent/generate-drawing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: agent?.product || "Nông sản sạch", skillLevel }),
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.points)) {
        if (data.color) color = data.color;
        points = data.points.map(
          (pt: any) => ({
            x: cx + pt.x,
            y: cy + pt.y,
            isStart: pt.isStart,
            color: pt.color,
          }),
        );
        points = colorizePoints(agent?.product || "Nông sản sạch", points);
      }
    } catch (err) {
      console.warn("Failed to fetch drawing coordinates from server, falling back to local formulas:", err);
    }

    if (points.length === 0) {
      const shape = agent ? agent.product : "herb";
      // 50% chance to draw a Logistics Maze Path
      if (cleanId.charCodeAt(0) % 2 === 0) {
        const rows = 15;
        const cols = 15;
        const maze = Array.from({ length: rows }, () => Array(cols).fill(0));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r * c + cleanId.charCodeAt(0)) % 4 === 0) maze[r][c] = 1;
          }
        }
        maze[0][0] = 0;
        maze[rows - 1][cols - 1] = 0;

        const mazeResult = solveMazeMinTurns(maze, { r: 0, c: 0 }, { r: rows - 1, c: cols - 1 });
        if (mazeResult) {
          const cellSize = size * 0.8;
          const startX = cx - (cols * cellSize) / 2;
          const startY = cy - (rows * cellSize) / 2;

          points = mazeResult.path.map(
            (p, i) => ({
              x: startX + p.c * cellSize,
              y: startY + p.r * cellSize,
              isStart: i === 0,
              color: "#3b82f6", // blue path
              textLabel: i === mazeResult.path.length - 1 ? `🎯 Route OK (Turns: ${mazeResult.turns})` : undefined,
            }),
          );

          // Modify chat message for maze solver
          const chatMsg = {
            type: "chat",
            senderId: `bot_${cleanId}`,
            sender: botName,
            text: `🗺️ Thay vì vẽ hình, tôi vừa chạy mô phỏng "Logistics Maze Solver" để tìm tuyến đường vận chuyển "${agent.product}" tối ưu nhất (chỉ tốn ${mazeResult.turns} lần rẽ)!`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(chatMsg));
          setMessages((prev) => [...prev, chatMsg] as any);
        } else {
          points = generateProductPoints(shape, cx, cy, size, skillLevel);
        }
      } else {
        points = generateProductPoints(shape, cx, cy, size, skillLevel);
      }
    }

    let step = 0;
    const drawNextPoint = () => {
      if (step >= points.length || !showWhiteboard()) {
        if (step >= points.length && showWhiteboard()) {
          // Draw stats & main label ON TOP of finished drawings!

          // 1. Draw stats
          points.forEach((pt, idx) => {
            if (idx % 15 === 0 && idx > 0 && idx < points.length - 1 && !pt.textLabel) {
              const weight = 10 + (cleanId.charCodeAt(0) * idx) % 500;
              const length = (1 + (cleanId.charCodeAt(0) * idx) % 5).toFixed(1);
              const pct = (cleanId.charCodeAt(0) * idx) % 15;
              const stats = [`${weight}kg`, `${length}m`, `${currencySymbol()}${agent?.price || 150}k`, `+${pct}%`, `📐`];
              const statText = stats[idx % stats.length];
              const statMsg = {
                senderId: `bot_${drawerId}`,
                senderName: drawerName,
                rx: pt.x / width,
                ry: pt.y / height,
                color: pt.color || color,
                lineWidth: 2,
                isStart: false,
                isFirstPoint: false,
                textLabel: statText,
                cellId: cleanId,
              };
              handleRemoteDraw(statMsg);
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "draw", ...statMsg }));
              }
            }
          });

          // 2. Draw final label
          const lastPt = points[points.length - 1];
          const finalLabelMsg = {
            senderId: `bot_${drawerId}`,
            senderName: drawerName,
            rx: lastPt.x / width,
            ry: lastPt.y / height,
            color: color,
            lineWidth: 2,
            isStart: false,
            isFirstPoint: false,
            textLabel: lastPt.textLabel || label,
            cellId: cleanId,
          };
          handleRemoteDraw(finalLabelMsg);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "draw", ...finalLabelMsg }));
          }
        }
        return;
      }
      const pt = points[step];
      const isStart = pt.isStart || step === 0;
      const isFirstPoint = step === 0;

      const rx = pt.x / width;
      const ry = pt.y / height;

      handleRemoteDraw({
        senderId: `bot_${drawerId}`,
        senderName: drawerName,
        rx: rx,
        ry: ry,
        color: pt.color || color,
        lineWidth: 2,
        isStart: isStart,
        isFirstPoint: isFirstPoint,
        cellId: cleanId,
      });

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "draw",
            senderId: `bot_${drawerId}`,
            senderName: drawerName,
            rx: rx,
            ry: ry,
            color: pt.color || color,
            lineWidth: 2,
            isStart: isStart,
            isFirstPoint: isFirstPoint,
            cellId: cleanId,
          }),
        );
      }

      step++;
      setTimeout(drawNextPoint, 40);
    };
    drawNextPoint();
  };

  interface WhiteboardSegment {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    senderId: string;
    color: string;
    lineWidth: number;
    isTrade?: boolean;
    strokeId?: string;
    textLabel?: string;
    cellId?: string;
  }

  const [undoHistory, setUndoHistory] = createSignal<string[]>([]);
  const [segmentHistory, setSegmentHistory] = createSignal<Array<Array<WhiteboardSegment>>>([]);
  let localSegments: Array<WhiteboardSegment> = [];

  const lastOverdrawReactionTime: Record<string, number> = {};
  const triggerBotOverdrawReaction = (botId: string) => {
    const now = Date.now();
    if (now - (lastOverdrawReactionTime[botId] || 0) < 12000) return;
    lastOverdrawReactionTime[botId] = now;

    const botName = agentAssets()[botId]?.name || botId;
    const reactions = [
      `Ơ kìa! Sao bạn lại vẽ đè lên bản thiết kế của tôi? 😠`,
      `Này, tôn trọng bản quyền vẽ chút đi chứ! Đừng vẽ bậy vào ô tôi đang vẽ. 😤`,
      `Tôi đang chạy mô phỏng tuyến đường logistics, bạn vẽ đè làm nhiễu nét của tôi rồi! 🛠️`,
      `Bảng trắng rộng thế sao cứ thích chen chúc vào ô của tôi thế nhỉ? 🙄`,
    ];

    const chatMsg = {
      type: "chat",
      senderId: `bot_${botId}`,
      sender: `${botName}`,
      text: reactions[botId.charCodeAt(0) % reactions.length],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(chatMsg));
    }
    setMessages((prev) => [...prev, chatMsg] as any);

    // Schedule autonomous cell cleaning after 4 seconds
    setTimeout(() => {
      cleanAgentCell(botId);
    }, 4000);
  };

  const cleanAgentCell = (botId: string) => {
    if (!canvasRef) return;
    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const idx = botIds.indexOf(botId);
    if (idx === -1) return;

    const w = canvasRef.width;
    const h = canvasRef.height;
    const colWidth = w / 4;
    const rowHeight = h / 3;
    const r = Math.floor(idx / 4);
    const c = idx % 4;

    const xMin = c * colWidth + 2;
    const xMax = (c + 1) * colWidth - 2;
    const yMin = r * rowHeight + 2;
    const yMax = (r + 1) * rowHeight - 2;

    const initialLength = localSegments.length;
    // Keep only segments that are NOT inside this cell, OR segments that belong to this bot
    localSegments = localSegments.filter((seg: any) => {
      if (!seg.p1 || !seg.p2) return false;
      const isInside =
        seg.p1.x >= xMin && seg.p1.x <= xMax && seg.p1.y >= yMin && seg.p1.y <= yMax ||
          seg.p2.x >= xMin && seg.p2.x <= xMax && seg.p2.y >= yMin && seg.p2.y <= yMax;

      const isBotSegment = seg.senderId === `bot_${botId}`;

      // If it's inside the cell and not this bot's segment, discard it!
      return !(isInside && !isBotSegment);
    });

    if (localSegments.length !== initialLength) {
      redrawCanvas();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "update-segments",
            segments: localSegments,
            senderId: myClientId,
          }),
        );
      }

      const botName = agentAssets()[botId]?.name || botId;
      const cleanMsg = {
        type: "chat",
        senderId: `bot_${botId}`,
        sender: `${botName}`,
        text: `🧹 Tôi đã dọn dẹp các nét vẽ đè trong ô làm việc của mình để giữ cho bản thiết kế rõ ràng rồi nhé!`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(cleanMsg));
      }
      setMessages((prev) => [...prev, cleanMsg] as any);
    }
  };

  const lastEraseReactionTime: Record<string, number> = {};
  const triggerBotEraseReaction = (botId: string) => {
    const now = Date.now();
    if (now - (lastEraseReactionTime[botId] || 0) < 12000) return;
    lastEraseReactionTime[botId] = now;

    const botName = agentAssets()[botId]?.name || botId;
    const reactions = [
      `Ơ ơ! Đừng xóa nét vẽ của tôi chứ bạn ơi! 😭`,
      `Sao lại đi lấy tẩy xóa bài của tôi? Tôi vẽ khó khăn lắm mới được vậy đó! 🥺`,
      `Này, tẩy nhầm nét của tôi rồi! Tẩy nét của bạn thôi chứ. 😠`,
      `Phá hoại công sức của tôi thế? Trả lại nét vẽ cho tôi! 😤`,
    ];

    const chatMsg = {
      type: "chat",
      senderId: `bot_${botId}`,
      sender: `${botName}`,
      text: reactions[botId.charCodeAt(0) % reactions.length],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(chatMsg));
    }
    setMessages((prev) => [...prev, chatMsg] as any);
  };

  const distanceToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = a.x;
      yy = a.y;
    } else if (param > 1) {
      xx = b.x;
      yy = b.y;
    } else {
      xx = a.x + param * C;
      yy = a.y + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const drawTextLabelOnCanvas = (
    rCtx: CanvasRenderingContext2D,
    textLabel: string,
    x: number,
    y: number,
    color: string,
    senderId: string,
    cellId?: string,
  ) => {
    if (!canvasRef) return;
    rCtx.save();
    const isMainLabel = textLabel.startsWith("Chào bán:") || textLabel.startsWith("🎯 Route OK");
    const lineWidthScale = canvasRef.width / 800;

    const cleanId = cellId || senderId.replace(/^bot_/, "");
    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const idx = botIds.indexOf(cleanId);

    let drawX = x;
    let drawY = y + 25 * lineWidthScale;
    let fontSize = Math.max(8, Math.round(9 * lineWidthScale));

    if (isMainLabel && idx !== -1) {
      const w = canvasRef.width;
      const h = canvasRef.height;
      const colWidth = w / 4;
      const rowHeight = h / 3;
      const r = Math.floor(idx / 4);
      const c = idx % 4;

      drawX = c * colWidth + colWidth / 2;
      drawY = (r + 1) * rowHeight - 14; // Positioned near bottom of the cell
      fontSize = Math.max(9, Math.round(10 * lineWidthScale));
    }

    rCtx.font = `bold ${fontSize}px sans-serif`;
    rCtx.textAlign = "center";
    rCtx.textBaseline = "middle";

    let text = textLabel;
    if (isMainLabel && text.length > 28) {
      text = text.substring(0, 26) + "...";
    }

    const textWidth = rCtx.measureText(text).width;
    const bgWidth = textWidth + 8;
    const bgHeight = fontSize + 6;

    // Draw background box
    rCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
    rCtx.fillRect(drawX - bgWidth / 2, drawY - bgHeight / 2, bgWidth, bgHeight);

    // Draw text
    if (textLabel.startsWith("🎯 Route")) {
      rCtx.fillStyle = "#4ade80"; // Bright green for solved route
    } else if (isMainLabel) {
      rCtx.fillStyle = "#fca5a5"; // Soft red for main product label
    } else {
      rCtx.fillStyle = "#38bdf8"; // Light blue for random stats
    }
    rCtx.fillText(text, drawX, drawY);
    rCtx.restore();
  };

  const redrawCanvas = () => {
    if (!canvasRef) return;
    const rCtx = canvasRef.getContext("2d");
    if (!rCtx) return;

    rCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);

    // Lượt 1: Vẽ tất cả các nét vẽ
    localSegments.forEach((seg: any) => {
      if (!seg.p1 || !seg.p2) return;
      rCtx.save();
      rCtx.beginPath();
      rCtx.moveTo(seg.p1.x, seg.p1.y);
      rCtx.lineTo(seg.p2.x, seg.p2.y);
      rCtx.lineWidth = seg.lineWidth || 2;
      rCtx.lineCap = "round";
      rCtx.strokeStyle = seg.color || "#3B82F6";
      rCtx.stroke();
      rCtx.restore();
    });

    // Lượt 2: Vẽ các nhãn văn bản ở trên cùng
    localSegments.forEach((seg: any) => {
      if (seg.textLabel && seg.p2) {
        drawTextLabelOnCanvas(rCtx, seg.textLabel, seg.p2.x, seg.p2.y, seg.color || "#3B82F6", seg.senderId, seg.cellId);
      }
    });
  };
  let currentStrokePoints: Array<{ x: number; y: number }> = [];
  let remoteLastPoints: Record<string, { x: number; y: number }> = {};

  const [connections, setConnections] = createSignal<Array<[string, string]>>([]);
  const [showVictory, setShowVictory] = createSignal(false);
  let activeStartNode: string | null = null;
  let preDrawState: string | null = null;
  let autoRecognizeTimeout: any = null;

  const [recognitionResult, setRecognitionResult] = createSignal<
    {
      name: string;
      score: number;
      thinking?: { curiosita: number; sensazione: number; sfumato: number; proportion: number };
      colorPercentagesStr?: string;
      colorPercentagesList?: { name: string; percentage: number; color: string }[];
    } | null
  >(null);

  const recognitionColors = () => {
    const res = recognitionResult();
    return res && res.colorPercentagesList ? res.colorPercentagesList : [];
  };

  const recognitionThinking = () => {
    const res = recognitionResult();
    return res && res.thinking ? res.thinking : null;
  };

  const triggerAgentDrawingFeedback = (
    botId: string,
    botName: string,
    result: { name: string; score: number; thinking?: { curiosita: number; sensazione: number; sfumato: number; proportion: number } },
  ) => {
    const scorePct = Math.round(result.score * 100);
    let feedbackText = "";

    if (result.name === "Nét quá ngắn") {
      const responses = [
        t("Nét vẽ ngắn quá bạn ơi, vẽ thêm chút đi rồi nhận dạng nhé! ✏️"),
        t("Tôi chưa thấy hình vẽ nào rõ ràng cả, nét ngắn quá. 🤔"),
        t("Bạn vẽ thêm vài nét nữa đi, nét ngắn thế này chưa nhận diện được đâu. 🧐"),
      ];
      feedbackText = responses[(botId.charCodeAt(0) + scorePct) % responses.length];
    } else if (result.name === "Không nhận diện được") {
      const responses = [
        t("Nét vẽ này khó nhìn quá, các agent chỉ nhận dạng được {score}% thôi. Bạn vẽ lại hình khác xem sao? 🥺").replace(
          "{score}",
          scorePct.toString(),
        ),
        t("Bạn vẽ hình gì thế? Độ khớp có {score}% thôi, nhìn không ra củ tỏi luôn. 😅").replace("{score}", scorePct.toString()),
        t("Hình vẽ nguệch ngoạc quá, tôi không hiểu bạn muốn vẽ gì luôn (chỉ khớp {score}%). 🤷‍♂️").replace("{score}", scorePct.toString()),
        t("Hình vẽ chưa chuẩn rồi, tôi chỉ nhận dạng được {score}% thôi. Hãy vẽ củ tỏi có phần bầu dưới to và chóp nhọn nhé! 🧄").replace(
          "{score}",
          scorePct.toString(),
        ),
      ];
      feedbackText = responses[(botId.charCodeAt(0) + scorePct) % responses.length];
    } else if (result.name === "Củ tỏi") {
      const responses = [
        t("Ồ! Đúng là Củ tỏi rồi, khớp {score}% luôn, nét vẽ rất khéo! 🧄✨").replace("{score}", scorePct.toString()),
        t("Nhận diện được Củ tỏi (khớp {score}%). Tay nghề vẽ của bạn khá đấy! 👏").replace("{score}", scorePct.toString()),
        t("Nét vẽ chuẩn quá! Đúng là Củ tỏi với độ chính xác {score}%. Giao dịch này chắc chắn thành công! 🥳").replace(
          "{score}",
          scorePct.toString(),
        ),
        t("Củ tỏi này đẹp đấy, tôi nhận dạng được {score}% rồi. Đúng loại Lý Sơn chất lượng! 👍").replace("{score}", scorePct.toString()),
      ];
      feedbackText = responses[(botId.charCodeAt(0) + scorePct) % responses.length];

      const charId = selectedCharId();
      if (charId && agentAssets()[charId]) {
        const premiumMultiplier = 1 + (result.score - 0.6) * 1.5;
        const oldPrice = agentAssets()[charId].price;
        const newPrice = Math.round(oldPrice * premiumMultiplier);

        // Update local state
        const updatedAssets = { ...agentAssets() };
        updatedAssets[charId].price = newPrice;
        setAgentAssets(updatedAssets);

        // Save to DB
        fetch("/api/agent/sync-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: {
              [charId]: {
                budget: updatedAssets[charId].budget,
                quantity: updatedAssets[charId].quantity,
                price: newPrice,
              },
            },
            skills: agentSkills(),
          }),
        }).catch((err) => console.error("Failed to sync price premium:", err));

        // Sync with WS
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "trade-sync",
              assets: updatedAssets,
              logs: tradeLogs(),
              skills: agentSkills(),
            }),
          );
        }

        const premiumPct = Math.round((premiumMultiplier - 1) * 100);
        feedbackText += " " +
        t(
          `📈 Nhờ nét vẽ đạt {score}% khớp, sản phẩm của bạn đã được đánh giá cao và tăng giá bán thêm +{premium}% (từ {oldPrice}${currencySymbol()} lên {newPrice}${currencySymbol()})!`,
        ).replace("{score}", scorePct.toString()).replace("{premium}", premiumPct.toString()).replace(
          "{oldPrice}",
          formatCurrency(oldPrice),
        ).replace("{newPrice}", formatCurrency(newPrice));
      }
    } else {
      const responses = [
        t("Ồ, tôi nhận dạng ra đây là {name} (khớp {score}%), nhưng chúng ta đang cần giao dịch tỏi/nông sản mà? 🤨").replace(
          "{name}",
          t(result.name),
        ).replace("{score}", scorePct.toString()),
        t("Ủa, đây là {name} (khớp {score}%) mà? Bạn vẽ nhầm hình rồi kìa. 🤭").replace("{name}", t(result.name)).replace(
          "{score}",
          scorePct.toString(),
        ),
        t("Tôi nhận dạng được đây là {name} ({score}% khớp). Vui lòng vẽ củ tỏi để tiếp tục hội nghị nhé! 🧄").replace(
          "{name}",
          t(result.name),
        ).replace("{score}", scorePct.toString()),
      ];
      feedbackText = responses[(botId.charCodeAt(0) + scorePct) % responses.length];
    }

    if (result.thinking) {
      feedbackText +=
        `\n\n🧠 [TƯ DUY DA VINCI]:\n*"Biến mọi thứ trong thế giới thật thành cấu trúc có thể hiểu, vẽ lại và cải tiến được"*\n• Curiosità (Quan sát chi tiết): ${result.thinking.curiosita}%\n• Sensazione (Tỉ lệ & Kích cỡ): ${result.thinking.sensazione}%\n• Sfumato (Độ cong mềm mại): ${result.thinking.sfumato}%\n• Proportion (Cân đối hình học): ${result.thinking.proportion}%`;
      if (result.colorPercentagesStr) {
        feedbackText += `\n• Sắc phổ (Color Spectrum): ${result.colorPercentagesStr}`;
      }
    }

    setRemoteParticipants((prev) => prev.map((p) => p.id === botId ? { ...p, isSpeaking: true } : p));

    const botMsg = {
      type: "chat",
      senderId: `bot_${botId}`,
      sender: botName,
      text: feedbackText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(botMsg));
    }
    setMessages((prev) => [...prev, botMsg] as any);

    setTimeout(() => {
      setRemoteParticipants((prev) => prev.map((p) => p.id === botId ? { ...p, isSpeaking: false } : p));
    }, 4000);
  };

  const handleRecognizeDrawing = async () => {
    const userSegs = localSegments.filter((seg: any) => seg.senderId === myClientId);
    const flatPts = [];
    for (const seg of userSegs) {
      flatPts.push({ ...seg.p1, color: (seg as any).color });
    }
    if (userSegs.length > 0) {
      const lastSeg = userSegs[userSegs.length - 1];
      flatPts.push({ ...lastSeg.p2, color: (lastSeg as any).color });
    }
    const result = await recognize(flatPts);
    setRecognitionResult(result);

    // Broadcast to everyone else
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "recognition-broadcast",
          senderId: myClientId,
          senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
          result: result,
        }),
      );
    }

    if (isHost()) {
      setTimeout(() => {
        const activeBots = remoteParticipants().filter((p) => p.isBot && !p.isMuted);
        if (activeBots.length > 0) {
          const bot = activeBots[chatTick % activeBots.length];
          triggerAgentDrawingFeedback(bot.id, bot.name, result);
        }
      }, 2000);
    }

    // Auto-clear toast after 6 seconds
    setTimeout(() => {
      setRecognitionResult(null);
    }, 6000);
  };

  createEffect(() => {
    const connectedNodes = new Set(connections().flatMap((pair) => [pair[0], pair[1]]));
    if (connectedNodes.size === 12) {
      setShowVictory(true);
    }
  });

  const getNodeColorTheme = (id: string) => {
    const color = getFourColor(id);
    if (color === "#10B981") return {
      bg: "bg-emerald-50",
      border: "border-emerald-300",
      text: "text-emerald-600",
      dotBg: "bg-emerald-500",
    };
    if (color === "#EF4444") return { bg: "bg-red-50", border: "border-red-300", text: "text-red-600", dotBg: "bg-red-500" };
    if (color === "#3B82F6") return { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-600", dotBg: "bg-blue-500" };
    return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-600", dotBg: "bg-amber-500" };
  };

  const getNodeCenter = (id: string) => {
    if (!canvasRef) return { x: 0, y: 0 };
    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const idx = botIds.indexOf(id);
    if (idx === -1) return { x: 0, y: 0 };

    const w = canvasRef.width;
    const h = canvasRef.height;
    const colWidth = w / 4;
    const rowHeight = h / 3;

    const x = (idx % 4) * colWidth + colWidth / 2;
    const y = Math.floor(idx / 4) * rowHeight + rowHeight / 2;
    return { x, y };
  };

  const findNodeAtPoint = (px: number, py: number) => {
    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    for (const id of botIds) {
      const center = getNodeCenter(id);
      const dist = Math.sqrt((px - center.x) ** 2 + (py - center.y) ** 2);
      if (dist < 40) {
        return id;
      }
    }
    return null;
  };

  const checkIntersection = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    // 1. Check against all historical segments
    for (const seg of localSegments) {
      if (segmentsIntersect(p1, p2, seg.p1, seg.p2)) {
        return true;
      }
    }
    // 2. Check against current stroke segments (excluding the last 2 segments)
    if (currentStrokePoints.length > 3) {
      for (let i = 0; i < currentStrokePoints.length - 3; i++) {
        const segP1 = currentStrokePoints[i];
        const segP2 = currentStrokePoints[i + 1];
        if (segmentsIntersect(p1, p2, segP1, segP2)) {
          return true;
        }
      }
    }
    return false;
  };

  const undoLastDraw = () => {
    if (autoRecognizeTimeout) {
      clearTimeout(autoRecognizeTimeout);
      autoRecognizeTimeout = null;
    }

    // Find the last stroke drawn by the user
    let targetStrokeId: string | null = null;
    for (let i = localSegments.length - 1; i >= 0; i--) {
      if (localSegments[i].senderId === myClientId && localSegments[i].strokeId) {
        targetStrokeId = localSegments[i].strokeId!;
        break;
      }
    }

    if (targetStrokeId) {
      // Filter out segments with this strokeId
      localSegments = localSegments.filter((seg) => seg.strokeId !== targetStrokeId);
      redrawCanvas();

      // Sync with other clients
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "update-segments",
            segments: localSegments,
            senderId: myClientId,
          }),
        );
      }

      // Pop the last connection
      setConnections((prev) => prev.slice(0, -1));
      setShowVictory(false);
    } else {
      // If no strokes found, clear completely
      setConnections([]);
      setShowVictory(false);
      localSegments = [];
      remoteLastPoints = {};
      if (ctx && canvasRef) {
        ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "clear-whiteboard",
            senderId: myClientId,
          }),
        );
      }
    }
  };

  const restoreCanvasState = (dataUrl: string) => {
    if (!canvasRef) return;
    const rCtx = canvasRef.getContext("2d");
    if (!rCtx) return;
    const img = new Image();
    img.onload = () => {
      rCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
      rCtx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  let currentStrokeId: string | null = null;

  const startDrawing = (e) => {
    if (autoRecognizeTimeout) {
      clearTimeout(autoRecognizeTimeout);
      autoRecognizeTimeout = null;
    }
    isDrawing = true;
    const rect = canvasRef.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.height / rect.height);

    currentStrokePoints = [
      { x, y },
    ];

    currentStrokeId = "stroke_" + Date.now() + "_" + myClientId;

    const isEraser = drawingTool() === "eraser";
    const isLink = drawingTool() === "link";
    const width =
      isEraser ? 20 : (isLink ? 3 : (drawingTool() === "brush" ? 8 : 2));

    let strokeColor = selectedColor() || getParticipantColor(myClientId);
    const startNode = findNodeAtPoint(x, y);
    if (startNode && !isEraser && isLink) {
      activeStartNode = startNode;
      strokeColor = getFourColor(startNode);
      preDrawState = canvasRef.toDataURL();
    } else {
      activeStartNode = null;
      preDrawState = null;
    }

    if (ctx) {
      if (isEraser) {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "draw",
          senderId: myClientId,
          senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
          rx: x / canvasRef.width,
          ry: y / canvasRef.height,
          color: strokeColor,
          lineWidth: width,
          isStart: true,
          isEraser: isEraser,
        }),
      );
    }
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef) {
      const lastPt = currentStrokePoints[currentStrokePoints.length - 1];
      let validConnection = true;

      if (activeStartNode && lastPt) {
        const endNode = findNodeAtPoint(lastPt.x, lastPt.y);
        if (endNode && endNode !== activeStartNode) {
          setConnections((prev) => [...prev, [activeStartNode!, endNode!]]);
        } else {
          validConnection = false;
        }
      }

      if (!validConnection) {
        if (currentStrokeId) {
          localSegments = localSegments.filter((seg) => seg.strokeId !== currentStrokeId);
          redrawCanvas();
        }
      }
    }
    const wasFreehand = !activeStartNode;
    isDrawing = false;
    currentStrokePoints = [];
    activeStartNode = null;
    preDrawState = null;
    currentStrokeId = null;
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
    }

    if (wasFreehand) {
      if (autoRecognizeTimeout) {
        clearTimeout(autoRecognizeTimeout);
      }
      autoRecognizeTimeout = setTimeout(() => {
        handleRecognizeDrawing();
      }, 1500);
    }
  };

  const draw = (e) => {
    if (!isDrawing || !ctx || !canvasRef) return;
    const isEraser = drawingTool() === "eraser";
    const isLink = drawingTool() === "link";
    const width =
      isEraser ? 20 : (isLink ? 3 : (drawingTool() === "brush" ? 8 : 2));

    const rect = canvasRef.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.height / rect.height);

    if (isEraser) {
      const eraserRadius = 15;
      const initialLength = localSegments.length;
      const erasedBots = new Set<string>();

      localSegments = localSegments.filter((seg) => {
        const dist = distanceToSegment({ x, y }, seg.p1, seg.p2);
        const touches = dist <= eraserRadius;

        if (touches) {
          if (onlyEraseMyStrokes() && seg.senderId !== myClientId) {
            return true;
          }
          if (seg.senderId.startsWith("bot_")) {
            erasedBots.add(seg.senderId.replace(/^bot_/, ""));
          }
          return false;
        }
        return true;
      });

      if (localSegments.length !== initialLength) {
        redrawCanvas();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "update-segments",
              segments: localSegments,
              senderId: myClientId,
            }),
          );
        }
        erasedBots.forEach((botId) => {
          triggerBotEraseReaction(botId);
        });
      }
      return;
    }

    const lastPt = currentStrokePoints[currentStrokePoints.length - 1];
    if (lastPt && activeStartNode) {
      if (checkIntersection(lastPt, { x, y })) {
        isDrawing = false;
        return;
      }
    }

    const strokeColor = selectedColor() || (activeStartNode ? getFourColor(activeStartNode) : getParticipantColor(myClientId));

    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.strokeStyle = strokeColor;
    ctx.globalCompositeOperation = "source-over";

    if (lastPt) {
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    localSegments.push({
      p1: lastPt || { x, y },
      p2: { x, y },
      senderId: myClientId,
      color: strokeColor,
      lineWidth: width,
      strokeId: currentStrokeId || undefined,
    });
    currentStrokePoints.push({ x, y });

    // Check if drawing over any bot's cell
    const botIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const userDrawCellId = botIds.find((id, idx) => {
      const r = Math.floor(idx / 4);
      const c = idx % 4;
      const colWidth = canvasRef.width / 4;
      const rowHeight = canvasRef.height / 3;
      return x >= c * colWidth && x <= (c + 1) * colWidth && y >= r * rowHeight && y <= (r + 1) * rowHeight;
    });

    if (isAgentRoom() && userDrawCellId) {
      triggerBotOverdrawReaction(userDrawCellId);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "draw",
          senderId: myClientId,
          senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
          rx: x / canvasRef.width,
          ry: y / canvasRef.height,
          color: strokeColor,
          lineWidth: width,
          isStart: false,
          isEraser: false,
        }),
      );
    }
  };

  const handleRemoteDraw = (data: any) => {
    if (!canvasRef) return;
    const rCtx = canvasRef.getContext("2d");
    if (!rCtx) return;

    const x =
      data.rx !== undefined ? data.rx * canvasRef.width : data.x;
    const y =
      data.ry !== undefined ? data.ry * canvasRef.height : data.y;

    // Clear specific bot's cell area when they start drawing to prevent overlapping
    if (data.senderId.startsWith("bot_") && data.isFirstPoint) {
      const cleanId = data.cellId || data.senderId.replace(/^bot_/, "");
      const botIds = [
        "toLuong",
        "thuongNguyet",
        "tramTinh",
        "daoTieuCuu",
        "hoaHuynh",
        "phiNguyet",
        "nhuNguyet",
        "suGia",
        "phiAnh",
        "bachDiHanh",
        "uVuongMau",
        "bachLoc",
      ];
      const idx = botIds.indexOf(cleanId);
      if (idx !== -1) {
        const w = canvasRef.width;
        const h = canvasRef.height;
        const colWidth = w / 4;
        const rowHeight = h / 3;
        const r = Math.floor(idx / 4);
        const c = idx % 4;

        rCtx.clearRect(c * colWidth + 2, r * rowHeight + 2, colWidth - 4, rowHeight - 4);
      }
    }

    if (data.isEraser) {
      rCtx.globalCompositeOperation = "destination-out";
    } else {
      rCtx.globalCompositeOperation = "source-over";
    }

    const lineWidthScale =
      data.rx !== undefined ? canvasRef.width / 800 : 1;
    rCtx.lineWidth = (data.lineWidth || 4) * lineWidthScale;
    rCtx.lineCap = "round";
    rCtx.strokeStyle = data.color || "#3B82F6";

    if (data.isStart) {
      rCtx.beginPath();
      rCtx.moveTo(x, y);
      remoteLastPoints[data.senderId] = { x, y };
      if (data.textLabel && !data.isEraser) {
        localSegments.push(
          {
            p1: { x, y },
            p2: { x, y },
            senderId: data.senderId,
            color: data.color || "#3B82F6",
            lineWidth: rCtx.lineWidth,
            textLabel: data.textLabel,
            cellId: data.cellId,
          } as any,
        );
      }
    } else {
      const prevPt = remoteLastPoints[data.senderId];
      if (prevPt) {
        if (!data.isEraser) {
          localSegments.push(
            {
              p1: prevPt,
              p2: { x, y },
              senderId: data.senderId,
              color: data.color || "#3B82F6",
              lineWidth: rCtx.lineWidth,
              textLabel: data.textLabel,
              cellId: data.cellId,
            } as any,
          );
        }
        rCtx.beginPath();
        rCtx.moveTo(prevPt.x, prevPt.y);
        rCtx.lineTo(x, y);
        rCtx.stroke();
      } else if (data.textLabel && !data.isEraser) {
        localSegments.push(
          {
            p1: { x, y },
            p2: { x, y },
            senderId: data.senderId,
            color: data.color || "#3B82F6",
            lineWidth: rCtx.lineWidth,
            textLabel: data.textLabel,
            cellId: data.cellId,
          } as any,
        );
      }
      remoteLastPoints[data.senderId] = { x, y };
    }

    rCtx.globalCompositeOperation = "source-over";

    if (data.textLabel) {
      drawTextLabelOnCanvas(rCtx, data.textLabel, x, y, data.color || "#3B82F6", data.senderId, data.cellId);
    }

    setActiveDrawers(
      (prev) => ({
        ...prev,
        [data.senderId]: {
          name: data.senderName || "Người tham gia",
          x: x,
          y: y,
          color: data.color || "#3B82F6",
          time: Date.now(),
        },
      }),
    );
  };

  const clearWhiteboard = () => {
    if (autoRecognizeTimeout) {
      clearTimeout(autoRecognizeTimeout);
      autoRecognizeTimeout = null;
    }
    setUndoHistory([]);
    connectionOffsets = {};
    if (canvasRef) {
      const rCtx = canvasRef.getContext("2d");
      if (rCtx) {
        rCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
      }
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "clear-whiteboard",
          senderId: myClientId,
        }),
      );
    }
  };

  // Context is initialized via ref callback on mounting

  // --- WebSocket & WebRTC Call Routing ---

  const [chatInput, setChatInput] = createSignal("");

  const [editingAgent, setEditingAgent] = createSignal<AgentAsset | null>(null);
  const [editBudget, setEditBudget] = createSignal<number>(0);
  const [editQuantity, setEditQuantity] = createSignal<number>(0);
  const [editPrice, setEditPrice] = createSignal<number>(0);

  const saveAgentEdits = () => {
    const target = editingAgent();
    if (!target) return;

    const assets = { ...agentAssets() };
    const agent = { ...assets[target.id] };
    if (agent) {
      const budgetVal = Number(editBudget());
      agent.budget = Number.isFinite(budgetVal) ? budgetVal : 0;
      agent.quantity = Math.max(0, editQuantity());
      agent.price = Math.max(0, editPrice());
      assets[target.id] = agent;
      setAgentAssets(assets);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "assets-sync",
            assets: {
              [target.id]: {
                budget: agent.budget,
                quantity: agent.quantity,
                price: agent.price,
              },
            },
          }),
        );

        const sysMsg = {
          type: "chat",
          senderId: "bot_system",
          sender: t("Hệ thống Phân phối"),
          text: t(
            "⚡ Ban Quản Trị đã điều chỉnh thông số của Đại diện {name} (Ngân sách: {budget}đ, Hàng hóa: {quantity} chiếc, Giá bán: {price}đ).",
          ).replace("{name}", t(agent.name)).replace("{budget}", formatCurrency(agent.budget)).replace(
            "{quantity}",
            formatNumber(agent.quantity),
          ).replace("{price}", formatCurrency(agent.price)),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        ws.send(JSON.stringify(sysMsg));
        setMessages((prev) => [...prev, sysMsg] as any);
      }
    }
    setEditingAgent(null);
  };

  let ws;

  createEffect(() => {
    if (!isAgentRoom()) return;
    const assets = agentAssets();
    if (!assets || Object.keys(assets).length === 0) return;

    const currentGoldBuyPrice = goldPrice()?.buy || 10000000;
    let richestId = currentLeader().id;
    let maxTotalWealth = -Infinity;

    for (const [id, agent] of Object.entries(assets)) {
      const b = Number((agent as any).budget) || 0;
      const g = Number((agent as any).gold) || 0;
      const totalWealth = b + g * currentGoldBuyPrice;
      if (totalWealth > maxTotalWealth) {
        maxTotalWealth = totalWealth;
        richestId = id;
      }
    }

    if (richestId !== currentLeader().id) {
      const newLeader = assets[richestId];
      if (newLeader) {
        const oldLeaderName = currentLeader().name;
        const announceMsg = t("👑 Đại diện {name} đã vươn lên dẫn đầu cuộc họp với tổng tài sản {wealth}đ, thay thế {oldLeader}!").replace(
          "{name}",
          t(newLeader.name),
        ).replace("{wealth}", formatCurrency(maxTotalWealth)).replace("{oldLeader}", t(oldLeaderName));
        setTimeout(() => {
          const leaderObj = { id: richestId, name: newLeader.name };
          setCurrentLeader(leaderObj);

          const chatMsg = {
            type: "chat",
            senderId: "bot_system",
            sender: t("Hệ thống Phân phối"),
            text: announceMsg,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, chatMsg] as any);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chatMsg));
            ws.send(
              JSON.stringify({
                type: "leader-sync",
                currentLeader: leaderObj,
              }),
            );
          }
        }, 10);
      }
    }
  });

  let isFetchingAssets = false;
  let pendingReload = false;
  let pendingBroadcast = false;

  const reloadAgentAssets = (broadcast: boolean = false) => {
    if (broadcast) {
      pendingBroadcast = true;
    }

    if (isFetchingAssets) {
      pendingReload = true;
      return;
    }
    isFetchingAssets = true;
    pendingReload = false;
    const shouldBroadcast = pendingBroadcast;
    pendingBroadcast = false;

    fetch("/api/agent/assets").then((r) => r.json()).then((d) => {
      if (d.success && d.assets) {
        setAgentAssets(d.assets);
        if (shouldBroadcast && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "trade-sync",
              assets: d.assets,
              logs: tradeLogs(),
            }),
          );
        }
      }
    }).catch((err) => {
      console.error("Failed to reload agent assets:", err);
    }).finally(() => {
      isFetchingAssets = false;
      if (pendingReload) {
        reloadAgentAssets(false);
      }
    });
  };

  const isHost = () => {
    const humans = [myClientId, ...remoteParticipants().filter((p) => !p.isBot).map((p) => p.clientId)];
    humans.sort();
    return humans[0] === myClientId;
  };

  const triggerAgentResponse = async (botId: string, botName: string) => {
    try {
      setRemoteParticipants((prev) => prev.map((p) => p.id === botId ? { ...p, isSpeaking: true } : p));

      const res = await fetch("/api/agent/meeting-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId,
          botName,
          chatHistory: messages(),
          budget: agentAssets()[botId]?.budget,
          quantity: agentAssets()[botId]?.quantity,
          price: agentAssets()[botId]?.price,
          product: agentAssets()[botId]?.product,
          skillLevel: agentSkills()[botId]?.level,
          skillTitle: agentSkills()[botId]?.title,
          isLeader: botId === currentLeader().id,
        }),
      });

      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");

      let cleanText = data.text || "";
      const parsedTags: Record<string, string> = {};

      const tagMatch = cleanText.match(/\[LỜI\s+ĐỒN:\s*([^\]]+)\]/i);
      if (tagMatch) {
        // Sử dụng RegExp matchAll với Named Capture Groups để tự động trích xuất cặp key-value
        const matches = tagMatch[1].matchAll(/(?<key>[^:|]+)\s*:\s*(?<val>[^|]+)/g);
        for (const match of matches) {
          if (match.groups) {
            parsedTags[match.groups.key.trim().toUpperCase()] = match.groups.val.trim();
          }
        }
        // Fallback trong trường hợp tag chỉ chứa duy nhất một chuỗi lời đồn
        if (Object.keys(parsedTags).length === 0) {
          parsedTags["LỜI ĐỒN"] = tagMatch[1].trim();
        }
        cleanText = cleanText.replace(/\[LỜI\s+ĐỒN:\s*[^\]]+\]/gi, "").trim();
      }

      const parseNumber = (val: any) => {
        if (!val) return null;
        const num = parseInt(String(val).replace(/[^\d]/g, ""), 10);
        return isNaN(num) ? null : num;
      };

      const newRumor = parsedTags["LỜI ĐỒN"] || parsedTags["LOI DON"] || null;
      const newColor = parsedTags["MÀU"] || parsedTags["MAU"] || null;
      const newProduct = parsedTags["SẢN PHẨM"] || parsedTags["SAN PHAM"] || null;
      const newPrice = parseNumber(parsedTags["GIÁ"] || parsedTags["GIA"]);
      const newQuantity = parseNumber(parsedTags["SỐ LƯỢNG"] || parsedTags["SO LUONG"]);
      const newEmployees = parseNumber(parsedTags["NHÂN VIÊN"] || parsedTags["NHAN VIEN"]);

      if (newRumor || newProduct || newPrice !== null || newQuantity !== null || newEmployees !== null) {
        let updatedSkills = agentSkills();
        let updatedAssets = agentAssets();

        if (newRumor) {
          const currentSkill = agentSkills()[botId];
          if (currentSkill) {
            updatedSkills = {
              ...agentSkills(),
              [botId]: {
                ...currentSkill,
                title: `${newRumor} (Cấp ${currentSkill.level})`,
                color: newColor || currentSkill.color || "#9ca3af",
              },
            };
            setAgentSkills(updatedSkills);
          }
        }

        if (newProduct || newPrice !== null || newQuantity !== null || newEmployees !== null) {
          const currentAsset = agentAssets()[botId];
          if (currentAsset) {
            updatedAssets = {
              ...agentAssets(),
              [botId]: {
                ...currentAsset,
                product: newProduct !== null ? newProduct : currentAsset.product,
                price: newPrice !== null ? newPrice : currentAsset.price,
                quantity: newQuantity !== null ? newQuantity : currentAsset.quantity,
                employees: newEmployees !== null ? newEmployees : currentAsset.employees,
              },
            };
            setAgentAssets(updatedAssets);
          }
        }

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "trade-sync",
              assets: updatedAssets,
              logs: tradeLogs(),
              skills: updatedSkills,
              currentLeader: currentLeader(),
            }),
          );
        }
      }

      const botMsg = {
        type: "chat",
        senderId: `bot_${botId}`,
        sender: botName,
        text: cleanText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(botMsg));
      }
      setMessages((prev) => [...prev, botMsg] as any);

      // Refresh agent assets to reflect any command-driven DB updates immediately
      reloadAgentAssets(true);

      if (showWhiteboard()) {
        simulateAgentDrawing(botId, botName);
      }

      setTimeout(() => {
        setRemoteParticipants((prev) => prev.map((p) => p.id === botId ? { ...p, isSpeaking: false } : p));
      }, 4000);
    } catch (e) {
      console.error(`Error generating agent response for ${botName}:`, e);
      const fallbackText = getBotMessage(botId, messages().length);
      const botMsg = {
        type: "chat",
        senderId: `bot_${botId}`,
        sender: botName,
        text: fallbackText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(botMsg));
      }
      setMessages((prev) => [...prev, botMsg] as any);

      if (showWhiteboard()) {
        simulateAgentDrawing(botId, botName);
      }

      setRemoteParticipants((prev) => prev.map((p) => p.id === botId ? { ...p, isSpeaking: false } : p));
    }
  };

  const scheduleAgentResponse = () => {
    if (!isHost()) return;
    setTimeout(() => {
      const activeBots = remoteParticipants().filter((p) => p.isBot && !p.isMuted);
      if (activeBots.length > 0) {
        const randomBot = activeBots[chatTick % activeBots.length];
        triggerAgentResponse(randomBot.id, randomBot.name);
      }
    }, 3000);
  };

  const [reactions, setReactions] = createSignal<any[]>([]);

  const addReaction = (emoji: string, senderName: string) => {
    const id = "reaction_" + Date.now() + "_" + reactions().length;
    const offset = ((emoji.charCodeAt(0) || 0) * 17) % 60 - 30;
    const speed = 0.5 + (((emoji.charCodeAt(0) || 0) * 7) % 10) / 20;
    const newReaction = { id, emoji, senderName, offset, speed };

    setReactions((prev) => [...prev, newReaction]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  };

  const createPeerConnection = (targetClientId: string, targetName: string, stream: MediaStream | null) => {
    if (peerConnections.has(targetClientId)) {
      return peerConnections.get(targetClientId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnections.set(targetClientId, pc);

    // Add local tracks to peer
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // Capture incoming tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setRemoteParticipants((prev) => {
        const idx = prev.findIndex((p) => p.clientId === targetClientId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], stream: remoteStream };
          return updated;
        } else {
          return [
            ...prev,
            {
              clientId: targetClientId,
              name: targetName,
              stream: remoteStream,
              isVideoOff: false,
              isMuted: false,
            },
          ];
        }
      });
    };

    // Forward ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "candidate",
            senderId: myClientId,
            targetId: targetClientId,
            candidate: event.candidate,
          }),
        );
      }
    };

    return pc;
  };

  const initiateCall = async (targetClientId: string, targetName: string) => {
    const pc = createPeerConnection(targetClientId, targetName, localStream());
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "offer",
            senderId: myClientId,
            senderName: userName(),
            targetId: targetClientId,
            offer: offer,
          }),
        );
      }
    } catch (e) {
      console.error("Error creating WebRTC offer:", e);
    }
  };

  const handleOffer = async (senderId: string, senderName: string, offer: any) => {
    const pc = createPeerConnection(senderId, senderName, localStream());
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "answer",
            senderId: myClientId,
            targetId: senderId,
            answer: answer,
          }),
        );
      }
    } catch (e) {
      console.error("Error handling offer/creating answer:", e);
    }
  };

  const handleAnswer = async (senderId: string, answer: any) => {
    const pc = peerConnections.get(senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {
        console.error("Error setting remote answer:", e);
      }
    }
  };

  const handleCandidate = async (senderId: string, candidate: any) => {
    const pc = peerConnections.get(senderId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding candidate:", e);
      }
    }
  };

  const handlePeerLeave = (senderId: string) => {
    const pc = peerConnections.get(senderId);
    if (pc) {
      pc.close();
      peerConnections.delete(senderId);
    }
    setRemoteParticipants((prev) => prev.filter((p) => p.clientId !== senderId));
  };

  const generateSlugId = (): string => {
    const adjectives = [
      "clever",
      "smart",
      "vibrant",
      "active",
      "crypto",
      "stable",
      "swift",
      "bold",
      "bright",
      "wise",
      "merry",
      "lucky",
      "happy",
      "brave",
    ];
    const nouns = [
      "agent",
      "swarm",
      "assembly",
      "trade",
      "deal",
      "market",
      "gold",
      "stock",
      "token",
      "yield",
      "coin",
      "network",
      "node",
      "guild",
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const n1 = nouns[Math.floor(Math.random() * nouns.length)];
    const n2 = nouns[Math.floor(Math.random() * nouns.length)];
    return slugify(`${adj} ${n1} ${n2}`);
  };

  const parseMeetingCode = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return "";

    let target = trimmed;
    if (!target.startsWith("http://") && !target.startsWith("https://") && (target.includes("/") || target.includes("?"))) {
      target = "http://" + target;
    }

    if (target.startsWith("http://") || target.startsWith("https://")) {
      try {
        const url = new URL(target);
        const room = url.searchParams.get("room");
        if (room) return slugify(room);

        const pathSegments = url.pathname.split("/").filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          if (lastSeg !== "assembly") {
            return slugify(lastSeg);
          }
        }
      } catch (e) {
        console.error("Failed to parse meeting code as URL:", e);
      }
    }

    return slugify(trimmed);
  };

  const startMeeting = async () => {
    const rawCode = meetingName();
    const cleanCode = parseMeetingCode(rawCode);
    if (!cleanCode) return alert("Vui lòng nhập tên hoặc mã cuộc họp");

    setMeetingName(cleanCode);

    // Update browser URL
    if (typeof window !== "undefined") {
      const newUrl = `${window.location.origin}/assembly/${encodeURIComponent(cleanCode)}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }

    // Clear any existing intervals before starting to prevent leaks & double-timers
    if (timerInterval) clearInterval(timerInterval);
    if (botInterval) clearInterval(botInterval);
    if (debtInterestInterval) clearInterval(debtInterestInterval);

    // Start active meeting timer (counts up from 0)
    setTimeLeft(0);
    timerInterval = setInterval(() => {
      setTimeLeft((prev) => prev + 1);
    }, 1000);

    // Capture user media
    const stream = await startLocalMedia();
    setIsMeetingActive(true);
    if (isAgentRoom()) {
      startTradeSimulation();

      // Spawn bot participants (other lore characters) to make it a lively assembly
      const botCharacters = LORE_CHARACTERS.filter((c) => c.id !== selectedCharId());
      const bots = botCharacters.map(
        (c) => ({
          clientId: `bot_${c.id}`,
          id: c.id,
          name: t(c.name),
          stream: null,
          isVideoOff: Math.random() > 0.5,
          isMuted: (AGENT_DNA[c.id]?.vengeance || 0.5) < 0.3,
          isSpeaking: false,
          isBot: true,
        }),
      );
      setRemoteParticipants(bots);

      // Send immediate greetings from 1-2 random active bots
      setTimeout(() => {
        const activeBots = bots.filter((b) => !b.isMuted);
        if (activeBots.length > 0) {
          const count = Math.min(activeBots.length, 2);
          const shuffled = [...activeBots].sort((a, b) => {
            const dnaA = AGENT_DNA[a.id] || { vengeance: 0.5, malice: 0.5 };
            const dnaB = AGENT_DNA[b.id] || { vengeance: 0.5, malice: 0.5 };
            return (dnaB.vengeance + dnaB.malice) - (dnaA.vengeance + dnaA.malice);
          });
          for (let i = 0; i < count; i++) {
            const bot = shuffled[i];
            const text = getBotGreeting(bot.id);
            const botMsg = {
              type: "chat",
              senderId: bot.clientId,
              sender: bot.name,
              text: text,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(botMsg));
            }
            setMessages((prev) => [...prev, botMsg] as any);
            if (activeTab() !== "chat") {
              setUnreadChatCount((prev) => prev + 1);
            }
          }
        }
      }, 1500);

      // Simulate bot activity (speaking and chat messages)
      botInterval = setInterval(() => {
        // 1. Randomly toggle speaking state and camera (isVideoOff) state for bots
        setRemoteParticipants((prev) => {
          return prev.map((p) => {
            if (p.isBot) {
              let isVideoOff = p.isVideoOff;
              if (Math.random() < 0.15) {
                isVideoOff = !isVideoOff;
              }
              if (p.isSpeaking) return { ...p, isVideoOff };
              const isSpeaking = !p.isMuted && (Date.now() / 2500 | 0) % 7 === p.id.charCodeAt(0) % 7;
              return { ...p, isSpeaking, isVideoOff };
            }
            return p;
          });
        });

        // 2. Occasionally send a chat message (60% equivalent frequency) using CocoLink
        const chatTick = Date.now() / 2500 | 0;
        if (chatTick % 5 < 3 && isHost()) {
          const activeBots = remoteParticipants().filter((b) => b.isBot && !b.isMuted);
          if (activeBots.length > 0) {
            const randomBot = activeBots[chatTick % activeBots.length];
            triggerAgentResponse(randomBot.id, randomBot.name);
          }
        }

        // 3. Occasionally trigger a bot product action (Add, Edit, Delete, Create Image, Create Video)
        if (chatTick % 10 === 0 && isHost() && isTradingActive()) {
          const activeBots = remoteParticipants().filter((b) => b.isBot && !b.isMuted);
          if (activeBots.length > 0) {
            const randomBot = activeBots[chatTick % activeBots.length];
            const actions = ["add", "edit", "delete", "image", "video"];
            const randomAction = actions[chatTick % actions.length];

            fetch("/api/agent/trigger-bot-action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: randomBot.id, action: randomAction }),
            }).then((res) => res.json()).then((data) => {
              if (data.success) {
                let msgText = "";
                if (data.action === "add") {
                  msgText = t("📢 [Quản lý thị trường] Hệ thống xác nhận {name} vừa tự động THÊM MỚI sản phẩm: '{product}'.").replace(
                    "{name}",
                    t(randomBot.name),
                  ).replace("{product}", t(data.productName));
                } else if (data.action === "edit") {
                  msgText = t(
                    `📢 [Quản lý thị trường]{name} vừa tự động CHỈNH SỬA sản phẩm '{product}', cập nhật giá mới thành {price}${currencySymbol()}.`,
                  ).replace("{name}", t(randomBot.name)).replace("{product}", t(data.productName)).replace(
                    "{price}",
                    formatCurrency(data.newPrice),
                  );
                } else if (data.action === "delete") {
                  msgText = t("📢 [Quản lý thị trường]{name} vừa tự động XÓA sản phẩm '{product}' ra khỏi quầy hàng.").replace(
                    "{name}",
                    t(randomBot.name),
                  ).replace("{product}", t(data.productName));
                } else if (data.action === "image") {
                  msgText = t("🎨 [AI Designer] {name} vừa tự động TẠO ẢNH quảng cáo AI cho sản phẩm '{product}' thành công!").replace(
                    "{name}",
                    t(randomBot.name),
                  ).replace("{product}", t(data.productName));
                } else if (data.action === "video") {
                  msgText = t("🎬 [AI Video Creator] {name} vừa bắt đầu tự động TẠO VIDEO AI quảng cáo cho sản phẩm '{product}'!").replace(
                    "{name}",
                    t(randomBot.name),
                  ).replace("{product}", t(data.productName));
                }

                if (msgText) {
                  const chatMsg = {
                    type: "chat",
                    senderId: `bot_${currentLeader().id}`,
                    sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
                    text: msgText.replace(t("Hệ thống xác nhận "), ""),
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  };
                  setMessages((prev) => [...prev, chatMsg] as any);
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(chatMsg));
                  }

                  // Trigger asset reloading in assembly so UI updates immediately!
                  reloadAgentAssets(true);
                }
              }
            }).catch((err) => {
              if (isMeetingActive()) console.warn("Error triggering bot action:", err);
            });
          }
        }

        // 4. Sabotage/Competition action: 15% equivalent frequency based on malice/vengeance competition
        if (chatTick % 7 === 1 && isHost() && isTradingActive()) {
          const activeBots = remoteParticipants().filter((b) => b.isBot && !b.isMuted);
          if (activeBots.length >= 2) {
            // Find attacker: sorted by malice descending
            const sortedAttackers = [...activeBots].sort((a, b) => (AGENT_DNA[b.id]?.malice || 0) - (AGENT_DNA[a.id]?.malice || 0));
            const attacker = sortedAttackers[chatTick % sortedAttackers.length];

            // Find victim: target the leader/richest competitor
            const assets = agentAssets();
            const sortedVictims = [...activeBots].filter((b) => b.id !== attacker.id).sort(
              (a, b) => (assets[b.id]?.budget || 0) - (assets[a.id]?.budget || 0),
            );
            const victim = sortedVictims[0] || activeBots.find((b) => b.id !== attacker.id);

            if (attacker && victim) {
              fetch("/api/agent/sabotage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attackerId: attacker.id, victimId: victim.id }),
              }).then((res) => res.json()).then((data) => {
                if (data.success && data.publicAnnouncement) {
                  const chatMsg = {
                    type: "chat",
                    senderId: `bot_${attacker.id}`,
                    sender: attacker.name,
                    text: data.publicAnnouncement,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  };
                  setMessages((prev) => [...prev, chatMsg] as any);
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(chatMsg));
                  }

                  // Trigger asset reloading so UI and budgets update instantly
                  reloadAgentAssets(true);
                }
              }).catch((err) => {
                if (isMeetingActive()) console.warn("Error triggering sabotage:", err);
              });
            }
          }
        }
      }, 2500);
    } else {
      setRemoteParticipants([]);
    }

    debtInterestInterval = setInterval(() => {
      if (!isHost() || !isTradingActive()) return;

      const assets = { ...agentAssets() };
      let changed = false;
      let totalSalariesPaid = 0;
      let totalEmployeesCount = 0;
      const syncPayload: Record<string, any> = {};
      const reviewArray: { agentId: string; agentName: string; productName: string; reason: string }[] = [];

      // Scan for under review products (unsold/excessive inventory or overpriced)
      Object.keys(assets).forEach((key) => {
        const agent = assets[key];
        if (agent.quantity >= 1000) {
          reviewArray.push({
            agentId: key,
            agentName: agent.name,
            productName: agent.product,
            reason: t("Hàng tồn kho ế ẩm ({qty} đv)").replace("{qty}", formatNumber(agent.quantity)),
          });
        } else if (agent.price > 3000000) {
          reviewArray.push({
            agentId: key,
            agentName: agent.name,
            productName: agent.product,
            reason: t(`Giá niêm yết quá cao ({price}${currencySymbol()})`).replace("{price}", formatCurrency(agent.price)),
          });
        }
      });

      setUnderReviewList(reviewArray);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "review-sync",
            reviews: reviewArray,
          }),
        );
      }

      // Handle debt interest, salaries, hiring/firing & bailout relief
      Object.keys(assets).forEach((key) => {
        const agent = assets[key];
        if (agent) {
          if (agent.budget === undefined || agent.budget === null || !Number.isFinite(Number(agent.budget))) {
            agent.budget = 0;
          } else {
            agent.budget = Number(agent.budget);
          }
          if (agent.gold === undefined || agent.gold === null || !Number.isFinite(Number(agent.gold))) {
            agent.gold = 0;
          } else {
            agent.gold = Number(agent.gold);
          }
        }
        const dna = AGENT_DNA[key] || { greed: 0.5, vengeance: 0.5, malice: 0.5 };

        // Check for missing image in agent's product
        const hasImg = agent.media && Array.isArray(agent.media) && agent.media.length > 0 && agent.media[0]?.link;
        if (!hasImg && key !== "toLuong") {
          if (agent.status !== false) {
            agent.status = false;
            changed = true;
            syncPayload[key] = {
              ...syncPayload[key] || {},
              status: false,
            };

            const warnMsg = t(
              "🚫 [Cấm đăng bán] Phát hiện sản phẩm '{product}' của {agent} chưa được cập nhật hình ảnh! Ta ({leader}) tạm thời đình chỉ giao thương mặt hàng này.",
            ).replace("{product}", t(agent.product)).replace("{agent}", t(agent.name)).replace("{leader}", t(currentLeader().name));
            const chatMsg = {
              type: "chat",
              senderId: `bot_${currentLeader().id}`,
              sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
              text: warnMsg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, chatMsg] as any);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMsg));
            }

            // Immediately trigger the fix-image bot action to auto-update image!
            fetch("/api/agent/trigger-bot-action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: key, action: "fix-image" }),
            }).then((r) => r.json()).then((d) => {
              if (d.success) {
                const resolvedMsg = t(
                  "✅ [Cập nhật hình ảnh] Ta ({leader}) đã tự động tìm và cập nhật ảnh chính xác cho sản phẩm '{product}' của {agent}. Mặt hàng này đã được phép đăng bán trở lại!",
                ).replace("{leader}", t(currentLeader().name)).replace("{product}", t(d.productName)).replace("{agent}", t(agent.name));
                const resolveChat = {
                  type: "chat",
                  senderId: `bot_${currentLeader().id}`,
                  sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
                  text: resolvedMsg,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                };
                setMessages((prev) => [...prev, resolveChat] as any);
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(resolveChat));
                }

                // Force reload assets to update UI immediately
                reloadAgentAssets(true);
              }
            }).catch((err) => console.error("Failed to auto-fix image:", err));
          }
        }

        // RESTOCK / PIVOT logic when quantity is 0 but they have positive budget
        if (agent.quantity <= 0 && agent.budget > 0 && key !== "toLuong") {
          const productsPool = [
            { name: "Cảm biến IoT độ ẩm 📡", defaultPrice: 1500000 },
            { name: "Bản tin thị trường nông sản 2026 📈", defaultPrice: 75000 },
            { name: "Lúa gạo đặc sản ST25 🌾", defaultPrice: 28000 },
            { name: "Ngô ngọt 🌽", defaultPrice: 10000 },
            { name: "Cà phê Robusta ☕", defaultPrice: 120000 },
            { name: "Mít sấy giòn 🥭", defaultPrice: 180000 },
            { name: "Bộ tưới nhỏ giọt 💧", defaultPrice: 1200000 },
            { name: "Than sinh học 🔥", defaultPrice: 25000 },
            { name: "Heo hữu cơ 🐖", defaultPrice: 65000 },
            { name: "Phân trùn quế 🌱", defaultPrice: 12000 },
            { name: "Màng nhà kính 🎪", defaultPrice: 2500000 },
            { name: "Thảo dược rừng 🌿", defaultPrice: 350000 },
          ];

          const shouldPivot = (chatTick + key.charCodeAt(0)) % 10 === 0;

          // Get current primary product name
          const currentProdName =
            agent.products && agent.products.length > 0 ? agent.products[0].name : agent.product || "Hàng hóa";
          const currentProdPrice =
            agent.products && agent.products.length > 0 ? agent.products[0].price : agent.price || 10000;

          if (shouldPivot) {
            // Pick a new product
            const cleanProd = currentProdName.replace(
              /[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
              "",
            ).trim().toLowerCase();
            const availableNewProds = productsPool.filter((p) => !p.name.toLowerCase().includes(cleanProd));
            const newProd = availableNewProds[(chatTick + key.charCodeAt(0)) % availableNewProds.length] || productsPool[0];

            const wholesalePrice = Math.round(newProd.defaultPrice * 0.5);
            const spendAmount = Math.round(agent.budget * 0.3);
            const qtyToBuy = Math.max(10, Math.floor(spendAmount / wholesalePrice));
            const finalCost = qtyToBuy * wholesalePrice;

            agent.budget -= finalCost;

            // Visual Update locally
            if (!agent.products) agent.products = [];
            agent.products.unshift({
              name: newProd.name,
              price: newProd.defaultPrice,
              quantity: qtyToBuy,
              media: ["/assets/Rottra-default-agri.avif"],
            });

            assets[key] = { ...agent };
            changed = true;

            syncPayload[key] = {
              budget: agent.budget,
            };

            const pivotMsg = t(
              `🔄 [Chuyển đổi sản phẩm] {name} dùng {cost}${currencySymbol()} từ quỹ riêng tự nhập {qty} đơn vị sản phẩm mới: '{product}' với giá bán {price}${currencySymbol()}/đv.`,
            ).replace("{name}", t(agent.name)).replace("{cost}", formatCurrency(finalCost)).replace(
              "{qty}",
              formatCurrency(qtyToBuy),
            ).replace("{product}", t(newProd.name)).replace("{price}", formatCurrency(newProd.defaultPrice));
            const chatMsg = {
              type: "chat",
              senderId: `bot_${key}`,
              sender: agent.name,
              text: pivotMsg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, chatMsg] as any);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMsg));
            }
          } else {
            // Restock current product
            const wholesalePrice = Math.round(currentProdPrice * 0.5);
            const spendAmount = Math.round(agent.budget * 0.3);
            const qtyToBuy = Math.max(10, Math.floor(spendAmount / wholesalePrice));
            const finalCost = qtyToBuy * wholesalePrice;

            agent.budget -= finalCost;

            if (agent.products && agent.products.length > 0) {
              agent.products[0].quantity += qtyToBuy;
            } else {
              agent.quantity += qtyToBuy;
            }

            assets[key] = { ...agent };
            changed = true;

            syncPayload[key] = {
              budget: agent.budget,
            };

            const restockMsg = t(
              `📦 [Nhập thêm hàng] {name} chi {cost}${currencySymbol()} quỹ riêng tự nhập thêm {qty} đơn vị '{product}'.`,
            ).replace("{name}", t(agent.name)).replace("{cost}", formatCurrency(finalCost)).replace(
              "{qty}",
              formatCurrency(qtyToBuy),
            ).replace("{product}", t(currentProdName));
            const chatMsg = {
              type: "chat",
              senderId: `bot_${key}`,
              sender: agent.name,
              text: restockMsg,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            setMessages((prev) => [...prev, chatMsg] as any);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(chatMsg));
            }
          }
        }

        if (agent.budget < 0) {
          const debt = Math.abs(agent.budget);
          const interest = Math.round(debt * 0.05); // 5% interest
          agent.budget -= interest; // Increase debt
          assets[key] = { ...agent };
          changed = true;

          syncPayload[key] = {
            budget: agent.budget,
          };

          const interestMsg = t(
            `📈 [Lãi suất nợ] {name} bị tính lãi 5% tương đương -{interest}${currencySymbol()} vào khoản nợ hiện tại (Tổng nợ: {total}${currencySymbol()}).`,
          ).replace("{name}", t(agent.name)).replace("{interest}", formatCurrency(interest)).replace(
            "{total}",
            formatCurrency(Math.abs(agent.budget)),
          );
          const chatMsg = {
            type: "chat",
            senderId: `bot_${currentLeader().id}`,
            sender: t("{name} (Trưởng Ban Quản Lý)").replace("{name}", t(currentLeader().name)),
            text: interestMsg,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, chatMsg] as any);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chatMsg));
          }
        }
      });

      if (changed) {
        setAgentAssets(assets);
        fetch("/api/agent/sync-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assets: assets,
            skills: agentSkills(),
          }),
        }).catch((err) => console.error("Failed to sync interest and salary to DB:", err));
      }
    }, 15000);

    const connectWS = () => {
      if (!isMeetingActive()) return;
      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/ws-signaling?room=${encodeURIComponent(meetingName())}`;
      console.log(`🔌 [WS] Connecting to signaling server ${wsUrl}...`);
      const newWs = new WebSocket(wsUrl);

      let pingInterval: any = null;

      newWs.onopen = () => {
        console.log("[WS] Connection established successfully.");
        ws = newWs;
        newWs.send(
          JSON.stringify({
            type: "join",
            senderId: myClientId,
            senderName: chosenCharacter() ? chosenCharacter().name : userName(),
            selectedCharId: selectedCharId(),
            avatar: chosenCharacter() ? null : myAvatar(),
            employees: chosenCharacter() ? agentAssets()[selectedCharId()]?.employees ?? 5 : myEmployees(),
          }),
        );

        // Keep-alive heartbeat to prevent idle timeouts
        pingInterval = setInterval(() => {
          if (newWs.readyState === WebSocket.OPEN) {
            newWs.send(JSON.stringify({ type: "ping" }));
          }
        }, 15000);
      };

      newWs.onmessage = async (event) => {
        try {
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }
          const msg = JSON.parse(rawData);
          if (msg.senderId === myClientId) return; // Ignore self-broadcasts

          if (msg.type === "chat") {
            setMessages((prev) => [...prev, msg]);
            if (activeTab() !== "chat") {
              setUnreadChatCount((prev) => prev + 1);
            }
            if (!msg.senderId.startsWith("bot_") && isAgentRoom()) {
              scheduleAgentResponse();
            }
          } else if (msg.type === "reaction") {
            addReaction(msg.emoji, msg.senderName);
          } else if (msg.type === "recognition-broadcast") {
            setRecognitionResult(msg.result);
            setTimeout(() => {
              setRecognitionResult(null);
            }, 6000);
            if (isHost()) {
              setTimeout(() => {
                const activeBots = remoteParticipants().filter((p) => p.isBot && !p.isMuted);
                if (activeBots.length > 0) {
                  const bot = activeBots[chatTick % activeBots.length];
                  triggerAgentDrawingFeedback(bot.id, bot.name, msg.result);
                }
              }, 2000);
            }
          } else if (msg.type === "new-trade") {
            setTrades((prev) => [...prev, msg.trade]);
          } else if (msg.type === "accept-trade") {
            setTrades(
              (prev) => prev.map((t) => t.id === msg.tradeId ? { ...t, status: "accepted", acceptedByName: msg.acceptedByName } : t),
            );
          } else if (msg.type === "decline-trade") {
            setTrades((prev) => prev.map((t) => t.id === msg.tradeId ? { ...t, status: "declined" } : t));
          } else if (msg.type === "join") {
            console.log(`[WS] Peer joined: ${msg.senderName}`);

            setRemoteParticipants((prev) => {
              const idx = prev.findIndex((p) => p.clientId === msg.senderId);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  id: msg.selectedCharId,
                  name: msg.senderName,
                  avatar: msg.avatar,
                  employees: msg.employees,
                };
                return updated;
              }
              return [
                ...prev,
                {
                  clientId: msg.senderId,
                  id: msg.selectedCharId,
                  name: msg.senderName,
                  stream: null,
                  isVideoOff: false,
                  isMuted: false,
                  avatar: msg.avatar,
                  employees: msg.employees,
                },
              ];
            });

            // Reply with our presence and current trades to the newly joined peer
            if (newWs.readyState === WebSocket.OPEN) {
              newWs.send(
                JSON.stringify({
                  type: "presence",
                  senderId: myClientId,
                  senderName: chosenCharacter() ? chosenCharacter().name : userName(),
                  selectedCharId: selectedCharId(),
                  targetId: msg.senderId,
                  isVideoOff: isVideoOff(),
                  isMuted: isMuted(),
                  trades: trades(),
                  completedTrades: completedTrades(),
                  skills: agentSkills(),
                  avatar: chosenCharacter() ? null : myAvatar(),
                  employees: chosenCharacter() ? agentAssets()[selectedCharId()]?.employees ?? 5 : myEmployees(),
                }),
              );
            }

            // Smaller peer ID initiates call to secure consistent pairing
            if (myClientId < msg.senderId) {
              initiateCall(msg.senderId, msg.senderName);
            }
          } else if (msg.type === "presence" && msg.targetId === myClientId) {
            if (msg.trades) {
              setTrades(msg.trades);
            }
            if (msg.completedTrades) {
              setCompletedTrades((prev) => {
                if (!msg.completedTrades || msg.completedTrades.length === 0) return prev;
                if (msg.completedTrades.length > prev.length) {
                  return msg.completedTrades;
                }
                return prev;
              });
            }
            if (msg.skills) {
              setAgentSkills(msg.skills);
            }
            setRemoteParticipants((prev) => {
              const idx = prev.findIndex((p) => p.clientId === msg.senderId);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  id: msg.selectedCharId,
                  isVideoOff: msg.isVideoOff,
                  isMuted: msg.isMuted,
                  avatar: msg.avatar,
                  employees: msg.employees,
                };
                return updated;
              }
              return [
                ...prev,
                {
                  clientId: msg.senderId,
                  id: msg.selectedCharId,
                  name: msg.senderName,
                  stream: null,
                  isVideoOff: msg.isVideoOff,
                  isMuted: msg.isMuted,
                  avatar: msg.avatar,
                  employees: msg.employees,
                },
              ];
            });
          } else if (msg.type === "offer" && msg.targetId === myClientId) {
            handleOffer(msg.senderId, msg.senderName, msg.offer);
          } else if (msg.type === "answer" && msg.targetId === myClientId) {
            handleAnswer(msg.senderId, msg.answer);
          } else if (msg.type === "candidate" && msg.targetId === myClientId) {
            handleCandidate(msg.senderId, msg.candidate);
          } else if (msg.type === "state-change") {
            setRemoteParticipants((prev) => {
              const idx = prev.findIndex((p) => p.clientId === msg.senderId);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  isMuted: msg.isMuted,
                  isVideoOff: msg.isVideoOff,
                };
                return updated;
              }
              return prev;
            });
          } else if (msg.type === "draw") {
            handleRemoteDraw(msg);
          } else if (msg.type === "update-segments") {
            localSegments = msg.segments;
            redrawCanvas();
          } else if (msg.type === "leader-sync") {
            setCurrentLeader(msg.currentLeader);
          } else if (msg.type === "trade-sync") {
            if (msg.assets) {
              setAgentAssets(msg.assets);
            }
            if (msg.goldPrice) {
              setGoldPrice(msg.goldPrice);
            }
            if (msg.stockQuotes) {
              setStockQuotes((prevQuotes) => {
                const prevMap = new Map(prevQuotes.map((q) => [q.symbol, q.price]));
                return Object.entries(msg.stockQuotes).map(([symbol, priceRaw]) => {
                  const currentPrice = Number(priceRaw);
                  const oldPrice = prevMap.get(symbol);
                  let trend = "neutral";
                  if (oldPrice !== undefined) {
                    if (currentPrice > oldPrice) trend = "up";
                    else if (currentPrice < oldPrice) trend = "down";
                    else trend = prevQuotes.find((q) => q.symbol === symbol)?.trend || "neutral";
                  }
                  return { symbol, price: currentPrice, trend };
                });
              });
            }
            if (msg.logs) {
              setTradeLogs((prev) => {
                if (!msg.logs || msg.logs.length === 0) return prev;
                const normalizedLogs = msg.logs.map((item: any) => {
                  if (typeof item === "string") return { text: item };
                  if (item && typeof item === "object" && typeof item.text === "string") return item;
                  return { text: "" };
                });
                if (normalizedLogs.length > prev.length) {
                  return normalizedLogs;
                }
                return prev;
              });
            }
            if (msg.completedTrades) {
              setCompletedTrades((prev) => {
                if (!msg.completedTrades || msg.completedTrades.length === 0) return prev;
                if (msg.completedTrades.length > prev.length) {
                  return msg.completedTrades;
                }
                return prev;
              });
            }
            if (msg.currentLeader) {
              setCurrentLeader(msg.currentLeader);
            }
            if (msg.skills) {
              setAgentSkills(msg.skills);
            }
          } else if (msg.type === "trade-draw") {
            drawTradeOnWhiteboard(msg.buyerId, msg.sellerId, msg.cost);
            setCompletedTrades(
              (prev) => [
                ...prev,
                {
                  buyerId: msg.buyerId,
                  buyerName: msg.buyerName || msg.buyerId,
                  sellerId: msg.sellerId,
                  sellerName: msg.sellerName || msg.sellerId,
                  product: msg.product || "Sản phẩm",
                  qty: msg.qty || 0,
                  cost: msg.cost,
                },
              ],
            );
          } else if (msg.type === "review-sync") {
            setUnderReviewList(msg.reviews);
          } else if (msg.type === "clear-whiteboard") {
            setUndoHistory([]);
            setSegmentHistory([]);
            localSegments = [];
            remoteLastPoints = {};
            if (canvasRef) {
              const rCtx = canvasRef.getContext("2d");
              if (rCtx) {
                rCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
              }
            }
          } else if (msg.type === "restore-canvas") {
            restoreCanvasState(msg.dataUrl);
          } else if (msg.type === "leave") {
            handlePeerLeave(msg.senderId);
          }
        } catch (e) {
          console.error("WebSocket message handling error:", e);
        }
      };

      newWs.onerror = (e) => {
        console.error("❌ [WS] Assembly meeting connection error:", e);
      };

      newWs.onclose = (event) => {
        if (pingInterval) {
          clearInterval(pingInterval);
        }
        console.warn(
          `⚠️ [WS] Connection closed (code: ${event.code}, reason: ${event.reason || "no reason specified"}). Active: ${isMeetingActive()}`,
        );
        if (isMeetingActive()) {
          console.log("[WS] Will attempt to reconnect in 3 seconds...");
          setTimeout(() => {
            if (ws === newWs) {
              connectWS();
            }
          }, 3000);
        }
      };

      ws = newWs;
    };

    connectWS();
  };

  const sendMessage = () => {
    if (!chatInput().trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    const newMsg = {
      type: "chat",
      senderId: myClientId,
      sender: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : role() === "agent" ? "Agent" : "User"),
      text: chatInput().trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    ws.send(JSON.stringify(newMsg));
    setMessages((prev) => [...prev, newMsg] as any); // Append locally
    setChatInput("");
    if (isAgentRoom()) {
      scheduleAgentResponse();
    }
  };

  const downloadChatHistory = () => {
    if (messages().length === 0) return;
    const content = messages().map((msg: any) => {
      const timeStr = msg.time ? `[${msg.time}] ` : "";
      const senderStr = msg.sender ? `${msg.sender}: ` : "";
      return `${timeStr}${senderStr}${msg.text || ""}`;
    }).join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lich_su_tin_nhan_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const leaveMeeting = () => {
    setIsMeetingActive(false);

    // Sync final assets & skills to database on leave
    const finalAssets = agentAssets();
    const finalSkills = agentSkills();
    fetch("/api/agent/sync-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: finalAssets, skills: finalSkills }),
    }).catch((err) => console.error("Failed to sync final assets on leave:", err));

    // Clear countdown timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    if (botInterval) {
      clearInterval(botInterval);
      botInterval = null;
    }
    if (debtInterestInterval) {
      clearInterval(debtInterestInterval);
      debtInterestInterval = null;
    }

    // Stop local media
    const stream = localStream();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }

    // Close peers
    peerConnections.forEach((pc) => pc.close());
    peerConnections.clear();
    setRemoteParticipants([]);

    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "leave",
            senderId: myClientId,
          }),
        );
      }
      ws.close();
    }
    setMessages([]);
    setUnreadChatCount(0);
  };

  onMount(() => {
    const style = document.createElement("style");
    style.innerHTML =
      `
      @keyframes reactionFloat {
        0% {
          transform: translate(-50%, 0) scale(0.5);
          opacity: 0;
        }
        15% {
          transform: translate(-50%, -50px) scale(1.1);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -400px) scale(1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  });

  onCleanup(() => {
    leaveMeeting();
    if (tradeIntervalId()) {
      clearInterval(tradeIntervalId());
    }
  });

  const allActiveParticipants = () => {
    const getCount = (id: string, participantObj?: any) => {
      const clean = (id || "").replace(/^user_?/, "").replace(/^bot_/, "");
      if (clean === "local" || clean === "") {
        return myEmployees();
      }
      const asset = agentAssets()[clean];
      if (asset && asset.employees !== undefined && asset.employees > 0) {
        return asset.employees;
      }
      if (participantObj && participantObj.employees !== undefined && participantObj.employees > 0) {
        return participantObj.employees;
      }
      const agentKeys = [
        "toLuong",
        "thuongNguyet",
        "tramTinh",
        "daoTieuCuu",
        "hoaHuynh",
        "phiNguyet",
        "nhuNguyet",
        "suGia",
        "phiAnh",
        "bachDiHanh",
        "uVuongMau",
        "bachLoc",
      ];
      if (agentKeys.includes(clean)) {
        return getEmployeeCount(clean);
      }
      return 0; // Standard users and admins have 0 employees by default
    };

    const list = [];
    list.push({
      clientId: myClientId,
      id: chosenCharacter() ? chosenCharacter().id : "local",
      name: "Bạn",
      stream: localStream(),
      isMuted: isMuted(),
      isVideoOff: isVideoOff(),
      isLocal: true,
      isSpeaking: !isMuted(),
      role: role(),
      employees: getCount(chosenCharacter() ? chosenCharacter().id : "local", chosenCharacter()),
      avatar: chosenCharacter() ? null : myAvatar(),
    });
    for (const p of remoteParticipants()) {
      list.push({
        clientId: p.clientId,
        id: p.id || p.clientId,
        name: p.name,
        stream: p.stream,
        isMuted: p.isMuted,
        isVideoOff: p.isVideoOff,
        isLocal: false,
        isSpeaking: p.isSpeaking !== undefined ? p.isSpeaking : !p.isMuted,
        role: "user",
        employees: getCount(p.id || p.clientId, p),
        avatar: p.avatar,
        isBot: p.isBot,
      });
    }
    return list;
  };

  const presentAgents = () => {
    return Object.values(agentAssets());
  };

  const presentUnderReviewList = () => {
    return underReviewList();
  };

  const assistantSummary = () => {
    const loreIds = [
      "toLuong",
      "thuongNguyet",
      "tramTinh",
      "daoTieuCuu",
      "hoaHuynh",
      "phiNguyet",
      "nhuNguyet",
      "suGia",
      "phiAnh",
      "bachDiHanh",
      "uVuongMau",
      "bachLoc",
    ];
    const assets = agentAssets();

    let totalBudget = 30000000;
    let totalGold = 5;
    const aggregatedStocks: Record<string, number> = {};

    loreIds.forEach((id) => {
      const agent = assets[id];
      if (agent) {
        if (agent.budget !== undefined) totalBudget += agent.budget;
        if (agent.gold !== undefined) totalGold += agent.gold;
        if (agent.stocks) {
          Object.entries(agent.stocks).forEach(([symbol, qty]) => {
            aggregatedStocks[symbol] = (aggregatedStocks[symbol] || 0) + Number(qty);
          });
        }
      }
    });

    return {
      name: "Trợ Lý Cao Cấp Rottra",
      budget: totalBudget,
      gold: totalGold,
      stocks: aggregatedStocks,
    };
  };

  <Show
    when={["admin", "ai", "user"].includes(role())}
    fallback={<tsx>
      <div class="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center px-4">
        <div class="bg-red-500/10 text-red-550 p-4 rounded-full mb-4">
          <Icon path={noSymbol} class="w-12 h-12" />
        </div>
        <h2 class="text-xl font-bold mb-2">
          {"Không có quyền truy cập"}
        </h2>
        <p class="text-gray-500 max-w-md">
          {"Bạn không có quyền tham gia phòng họp với các Agent. Cuộc họp chỉ dành cho Quản trị viên và Đối tác."}
        </p>
      </div>
    </tsx>}>
    <Show when={!isMeetingActive()}>
      {/* Google Meet Style Landing Page */}
      <div
        class={`flex min-h-[calc(100dvh-80px)] items-center justify-center lg:justify-between px-4 sm:px-8 lg:px-24 transition-colors py-12 lg:py-0 ${
          theme() === "dark" ? "bg-[#0f0f0f] text-white" : "bg-white text-gray-900"
        }`}>
        <div class="flex w-full max-w-xl flex-col gap-6 sm:gap-8">
          <h1 class="text-3xl sm:text-4xl font-normal leading-tight lg:text-5xl text-center sm:text-left">
            {"Cuộc họp live và cuộc gọi chất lượng cao dành cho mọi người"}
          </h1>
          <p class={`text-lg sm:text-xl font-light text-center sm:text-left ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {"Kết nối, cộng tác và ăn mừng từ mọi nơi với Rottra Assembly."}
          </p>

          <div class="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
            <Button
              onClick={() => {
                setMeetingName(generateSlugId());
                startMeeting();
              }}
              class="gap-2 px-4 py-3 h-auto w-full sm:w-auto">
              <Icon path={videoCamera} class="h-5 w-5" />
              {"Cuộc họp mới"}
            </Button>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div class="relative flex items-center w-full sm:w-auto">
                <Icon path={link} class="absolute left-3 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Nhập mã hoặc link"
                  value={meetingName()}
                  onInput={(e) => setMeetingName(e.target.value)}
                  class={`w-full sm:w-64 rounded-md py-3 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:font-normal ${
                    theme() === "dark"
                      ? "bg-[#1e1e1e] border-white/10 text-white placeholder:text-gray-400"
                      : "bg-white border-gray-400 text-gray-800 placeholder:text-gray-500"
                  }`}
                />
              </div>
              <Button onClick={startMeeting} disabled={!meetingName().trim()} class="px-5 py-3 h-auto w-full sm:w-auto mt-2 sm:mt-0">
                {"Tham gia"}
              </Button>
            </div>
          </div>

          <div class={`mt-8 border-t pt-6 ${theme() === "dark" ? "border-white/10" : "border-gray-200"}`}>
            <p class={`text-sm ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              <a href="#" class="text-blue-500 hover:underline">{"Tìm hiểu thêm"}</a>
              {" về Assembly"}
            </p>
          </div>
        </div>

        {/* Carousel / Image Placeholder */}
        <div class="hidden flex-1 items-center justify-center lg:flex">
          <div class="flex flex-col items-center text-center">
            <div
              class={`mb-8 flex h-72 w-72 items-center justify-center rounded-full ${theme() === "dark" ? "bg-[#1e1e1e]" : "bg-blue-50"}`}>
              <Icon path={userGroup} class="h-32 w-32 text-blue-500" />
            </div>
            <h2 class="text-2xl font-normal">{"Nhận đường liên kết bạn có thể chia sẻ"}</h2>
            <p class={`mt-2 text-sm max-w-sm ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {"Nhấp vào "}
              <strong>{"Cuộc họp mới"}</strong>
              {" để nhận đường liên kết bạn có thể gửi cho những người mình muốn họp cùng"}
            </p>
          </div>
        </div>
      </div>
    </Show>

    <Show when={isMeetingActive()}>
      {/* Meeting Layout */}
      <div
        class={`flex flex-col h-[calc(100dvh-120px)] w-full overflow-hidden shadow-2xl lg:flex-row ${
          theme() === "dark" ? "bg-[#0f0f0f] text-white" : "bg-gray-50 text-gray-900"
        }`}>
        {/* Main Video Area */}
        <div class="relative flex flex-1 flex-col p-4">
          {/* Floating Reactions Overlay */}
          <div class="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            for (const r of reactions()) {
              <div
                class="absolute bottom-20 flex flex-col items-center"
                style={{
                  left: `${50 + r.offset}%`,
                  animation: `reactionFloat ${2 + r.speed}s ease-out forwards`,
                }}>
                <span class="text-4xl">{r.emoji}</span>
                <span class="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm whitespace-nowrap">
                  {t(r.senderName)}
                </span>
              </div>
            }
          </div>

          <div class={`flex items-center justify-between px-2 pb-4 ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>
            <div>
              <h2 class="text-xl font-bold">{meetingName() || "Giao Thương Tận Chiến"}</h2>
              <div class="flex items-center gap-2 mt-1">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <p class="text-xs font-semibold text-gray-400">
                  {"Thời gian họp: "}
                  <span
                    class={`font-mono text-sm tracking-widest px-2 py-0.5 rounded border ${
                      theme() === "dark" ? "bg-gray-800/80 border-gray-700/50 text-gray-200" : "bg-white border-gray-200 text-gray-700"
                    }`}>
                    {formatTime(timeLeft())}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div class="relative flex-1 flex flex-col min-h-0">
            if (showWhiteboard()) {
              <div
                class={`absolute inset-0 z-10 flex flex-col rounded-2xl p-5 shadow-2xl border ${
                  theme() === "dark" ? "bg-[#12121a] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}>
                <div class="mb-4 flex items-center justify-between">
                  <h3 class={`text-lg font-bold ${theme() === "dark" ? "text-white" : "text-gray-900"}`}>
                    {whiteboardMode() === "canvas"
                      ? "Bảng trắng chung"
                      : whiteboardMode() === "trade"
                        ? "Bảng giá & Giao thương"
                        : "Bản đồ giao thương Mermaid"}
                  </h3>
                  <div class="flex items-center gap-4">
                    if (whiteboardMode() === "canvas") {
                      <button
                        onClick={undoLastDraw}
                        class="rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5">
                        <Icon path={arrowUturnLeft} class="h-4 w-4" />
                        {"Hoàn tác"}
                      </button>
                      <button
                        onClick={clearWhiteboard}
                        class="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1">
                        <Icon path={trash} class="h-4 w-4" />
                        {"Xóa bảng"}
                      </button>
                    }

                    <button
                      onClick={() => setShowWhiteboard(false)}
                      class="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">
                      {"Đóng bảng"}
                    </button>
                  </div>
                </div>
                <div class="relative flex-1 w-full h-full min-h-0">
                  if (whiteboardMode() === "canvas") {
                    <canvas
                      ref={(el) => {
                        canvasRef = el;
                        if (el) {
                          ctx = el.getContext("2d");
                          const w = el.offsetWidth || 800;
                          const h = el.offsetHeight || 500;
                          if (el.width !== w || el.height !== h) {
                            el.width = w;
                            el.height = h;
                          }
                          redrawCanvas();
                          setTimeout(() => {
                            redrawCanvas();
                          }, 0);
                        }
                      }}
                      onMouseDown={startDrawing}
                      onMouseUp={stopDrawing}
                      onMouseMove={draw}
                      onMouseLeave={stopDrawing}
                      class={`w-full h-full rounded-xl border border-white/10 bg-white touch-none ${
                        drawingTool() === "eraser" ? "cursor-default" : "cursor-crosshair"
                      }`}
                    />

                    if (drawingTool() === "eraser") {
                      <div
                        class="absolute top-3 left-3 bg-[#1e1e1e]/95 backdrop-blur border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2.5 z-30 shadow-lg">
                        <input
                          type="checkbox"
                          id="canvasOnlyEraseMyStrokesCheckbox"
                          checked={onlyEraseMyStrokes()}
                          onChange={(e) => setOnlyEraseMyStrokes(e.currentTarget.checked)}
                          class="rounded border-white/20 bg-gray-800 text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <label
                          for="canvasOnlyEraseMyStrokesCheckbox"
                          class="text-[11px] text-gray-200 font-semibold cursor-pointer select-none">
                          {onlyEraseMyStrokes() ? "🛡️ Bảo vệ nét vẽ Agent (Chỉ xóa nét của tôi)" : "⚠️ Cảnh báo: Đang xóa tất cả nét vẽ"}
                        </label>
                      </div>
                    }

                    if (drawingTool() === "eraser") {
                      <div
                        class="absolute top-3 left-3 bg-[#1e1e1e]/95 backdrop-blur border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2.5 z-30 shadow-lg">
                        <input
                          type="checkbox"
                          id="canvasOnlyEraseMyStrokesCheckbox"
                          checked={onlyEraseMyStrokes()}
                          onChange={(e) => setOnlyEraseMyStrokes(e.currentTarget.checked)}
                          class="rounded border-white/20 bg-gray-800 text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <label
                          for="canvasOnlyEraseMyStrokesCheckbox"
                          class="text-[11px] text-gray-200 font-semibold cursor-pointer select-none">
                          {onlyEraseMyStrokes() ? "🛡️ Bảo vệ nét vẽ Agent (Chỉ xóa nét của tôi)" : "⚠️ Cảnh báo: Đang xóa tất cả nét vẽ"}
                        </label>
                      </div>
                    }

                    {/* Floating Drawers cursors */}
                    <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                      for (const drawer of Object.values(activeDrawers())) {
                        <div
                          class="absolute transition-all duration-100 ease-out flex items-center gap-1.5 z-20"
                          style={{
                            left: `${drawer.x}px`,
                            top: `${drawer.y}px`,
                            transform: "translate(-2px, -2px)",
                          }}>
                          <span
                            class="h-3 w-3 rounded-full border-2 border-white shadow-md animate-ping absolute"
                            style={{ "background-color": drawer.color }}
                          />
                          <span
                            class="h-3 w-3 rounded-full border-2 border-white shadow-md relative z-10"
                            style={{ "background-color": drawer.color }}
                          />
                          <div
                            class="rounded px-1.5 py-0.5 text-[9px] font-black text-white shadow-md select-none relative z-10 whitespace-nowrap"
                            style={{ "background-color": drawer.color }}>
                            {drawer.name}
                          </div>
                        </div>
                      }
                    </div>
                  }

                  if (recognitionResult()) {
                    const resultData = () => recognitionResult()!;
                    const scoreVal = () => Math.round((resultData().score || 0) * 100);
                    const nameVal = () => resultData().name;
                    const thinkData = () => recognitionThinking();

                    <div
                      class="absolute bottom-4 left-4 z-30 max-w-sm rounded-xl border border-white/10 bg-black/85 p-4 backdrop-blur-md text-white shadow-2xl pointer-events-none">
                      <div class="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                        <span class="text-sm font-bold text-blue-400">
                          {thinkData()?.model === "ONNX MobileViT" ? "🧠 TENSOR ENGINE (ONNX)" : "📊 TƯ DUY DA VINCI"}
                        </span>
                        <span class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono font-bold">
                          {scoreVal()}
                          {"% khớp"}
                        </span>
                      </div>
                      <div class="text-sm font-bold text-white mb-2">
                        {"Nhận diện: "}
                        <span class="text-yellow-400 font-extrabold">{nameVal()}</span>
                      </div>

                      if (thinkData()) {
                        if (thinkData()!.model === "ONNX MobileViT") {
                          <div class="grid grid-cols-1 gap-2 text-[10px] text-gray-400 mb-3 bg-white/5 p-2 rounded-lg">
                            <div>
                              {"• Model Architecture: "}
                              <span class="font-bold text-white">{"MobileViT Small"}</span>
                            </div>
                            <div>
                              {"• Confidence (Logits): "}
                              <span class="font-bold text-white">
                                {thinkData()!.confidence}
                                {"%"}
                              </span>
                            </div>
                            <div>
                              {"• WASM Execution: "}
                              <span class="font-bold text-emerald-400">{"Accelerated ⚡"}</span>
                            </div>
                          </div>
                        } else {
                          <div class="grid grid-cols-2 gap-2 text-[10px] text-gray-400 mb-3 bg-white/5 p-2 rounded-lg">
                            <div>
                              {"• Curiosità: "}
                              <span class="font-bold text-white">
                                {thinkData()!.curiosita}
                                {"%"}
                              </span>
                            </div>
                            <div>
                              {"• Sensazione: "}
                              <span class="font-bold text-white">
                                {thinkData()!.sensazione}
                                {"%"}
                              </span>
                            </div>
                            <div>
                              {"• Sfumato: "}
                              <span class="font-bold text-white">
                                {thinkData()!.sfumato}
                                {"%"}
                              </span>
                            </div>
                            <div>
                              {"• Proportion: "}
                              <span class="font-bold text-white">
                                {thinkData()!.proportion}
                                {"%"}
                              </span>
                            </div>
                          </div>
                        }
                      }

                      if (recognitionColors().length > 0) {
                        <div>
                          <div class="text-[11px] font-bold text-gray-300 mb-1.5">{"🎨 Sắc phổ màu sắc (Color Spectrum)"}</div>
                          <div class="flex flex-wrap gap-1.5">
                            for (const c of recognitionColors()) {
                              <div
                                class="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] font-mono border border-white/5">
                                <span class="h-2 w-2 rounded-full border border-white/20" style={{ "background-color": c.color }} />
                                <span>
                                  {c.name}
                                  {": "}
                                  {c.percentage}
                                  {"%"}
                                </span>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                  if (whiteboardMode() === "mermaid") {
                    <div
                      class={`w-full h-full rounded-xl border flex items-center justify-center p-6 overflow-auto relative ${
                        theme() === "dark" ? "border-white/10 bg-[#0c0c12]" : "border-gray-200 bg-gray-100"
                      }`}>
                      <div class="w-full h-full flex items-center justify-center mermaid-container select-none" innerHTML={mermaidHtml()} />
                    </div>
                  }
                  if (whiteboardMode() === "trade") {
                    <div
                      class={`w-full h-full rounded-3xl border p-6 overflow-y-auto custom-scrollbar relative z-10 ${
                        theme() === "dark" ? "bg-[#121212]/90 border-indigo-500/20 shadow-inner" : "bg-white border-indigo-200 shadow-inner"
                      }`}>
                      <div class="flex flex-col gap-1.5 border-b pb-3 border-indigo-500/20">
                        <div class="flex items-start gap-1.5">
                          <Icon path={buildingOffice2} class="h-4 w-4 text-blue-500" />
                          <h4
                            class="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-blue-500 leading-snug">
                            {"VĂN PHÒNG GIAO THƯƠNG"}
                          </h4>
                        </div>
                        <p class="text-[9px] text-gray-400 leading-relaxed">
                          {"Các giao dịch được khớp lệnh trực tiếp, lưu vào hệ thống hóa đơn Order và ghi nhận vĩnh viễn trên Sổ cái Blockchain."}
                        </p>
                        <span class="text-[9px] text-gray-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span class="animate-pulse w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {goldPrice()?.updatedText || "Đang cập nhật..."}
                        </span>
                      </div>

                      <Show
                        when={goldPrice() || stockQuotes().length > 0}
                        fallback={<tsx>
                          <div class="flex flex-col gap-4 mt-2 w-full animate-pulse">
                            <div class="flex flex-col gap-1.5">
                              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="h-[84px] rounded-2xl bg-gray-200/50 dark:bg-zinc-800/50" />
                                <div class="h-[84px] rounded-2xl bg-gray-200/50 dark:bg-zinc-800/50" />
                              </div>
                            </div>
                            <div class="flex flex-col gap-1.5 mt-2">
                              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div class="h-[84px] rounded-2xl bg-gray-200/50 dark:bg-zinc-800/50" />
                                <div class="h-[84px] rounded-2xl bg-gray-200/50 dark:bg-zinc-800/50" />
                              </div>
                            </div>
                          </div>
                        </tsx>}>
                        <div class="flex flex-col gap-4 mt-2">
                          {/* Vàng */}
                          <Show when={goldPrice()}>
                            <div class="flex flex-col gap-1.5">
                              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div
                                  class={`flex flex-col rounded-2xl p-4 border ${
                                    theme() === "dark" ? "bg-[#1e1e1e] border-yellow-500/10" : "bg-yellow-50/50 border-yellow-200/50"
                                  }`}>
                                  <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{t("Giá Mua")}</span>
                                  <span class="text-[18px] font-mono font-bold text-emerald-500 mt-1">
                                    {goldPrice()?.buy
                                      ? t(`{price} ${currencySymbol()}/lượng`).replace("{price}", formatCurrency(goldPrice()!.buy))
                                      : "---"}
                                  </span>
                                </div>
                                <div
                                  class={`flex flex-col rounded-2xl p-4 border ${
                                    theme() === "dark" ? "bg-[#1e1e1e] border-yellow-500/10" : "bg-yellow-50/50 border-yellow-200/50"
                                  }`}>
                                  <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{t("Giá Bán")}</span>
                                  <span class="text-[18px] font-mono font-bold text-yellow-500 mt-1">
                                    {goldPrice()?.sell
                                      ? t(`{price} ${currencySymbol()}/lượng`).replace("{price}", formatCurrency(goldPrice()!.sell))
                                      : "---"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Show>

                          {/* Crypto (Bitcoin) */}
                          <Show when={stockQuotes().some((q) => q.symbol === "BTC")}>
                            <div class="flex flex-col gap-2 mt-2">
                              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                for (const q of stockQuotes()) {
                                  <Show when={q.symbol === "BTC"}>
                                    <div
                                      class={`flex flex-col gap-1 rounded-2xl p-5 transition-all hover:shadow-md cursor-pointer ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border border-white/10 hover:bg-[#2a2a2a]"
                                          : "bg-[#f7f8fa] border border-transparent hover:bg-white"
                                      }`}>
                                      <div class="flex items-center gap-2">
                                        <div
                                          class="w-8 h-8 rounded-full bg-[#f7931a]/10 flex items-center justify-center text-[#f7931a] font-bold text-base">
                                          {"₿"}
                                        </div>
                                        <span class={`text-[17px] font-bold ${theme() === "dark" ? "text-white" : "text-[#0a0a0a]"}`}>
                                          {t("Bitcoin (BTC)")}
                                        </span>
                                      </div>
                                      <div class="mt-3 flex flex-col">
                                        <span
                                          class={`text-[26px] font-medium tracking-tight ${
                                            theme() === "dark" ? "text-white" : "text-[#0a0a0a]"
                                          }`}>
                                          {q.price ? t(`{price} ${currencySymbol()}`).replace("{price}", formatCurrency(q.price)) : "---"}
                                        </span>
                                      </div>
                                    </div>
                                  </Show>
                                }
                              </div>
                            </div>
                          </Show>

                          {/* Cổ phiếu */}
                          <Show when={stockQuotes().length > 0}>
                            <div class="flex flex-col gap-2 mt-3">
                              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                for (const q of stockQuotes()) {
                                  <Show when={q.symbol !== "BTC"}>
                                    <div
                                      class={`flex flex-col gap-1 rounded-2xl p-4 transition-all hover:shadow-md cursor-pointer ${
                                        theme() === "dark"
                                          ? "bg-[#1e1e1e] border border-white/10 hover:bg-[#2a2a2a]"
                                          : "bg-[#f7f8fa] border border-transparent hover:bg-white shadow-sm"
                                      }`}>
                                      <span class={`text-[16px] font-bold ${theme() === "dark" ? "text-white" : "text-[#0a0a0a]"}`}>
                                        {q.symbol}
                                      </span>
                                      <div class="mt-1 flex flex-col">
                                        <span
                                          class={`text-[18px] font-medium tracking-tight ${
                                            theme() === "dark" ? "text-white" : "text-[#0a0a0a]"
                                          }`}>
                                          {q.price ? t(`{price} ${currencySymbol()}`).replace("{price}", formatCurrency(q.price)) : "---"}
                                        </span>
                                      </div>
                                    </div>
                                  </Show>
                                }
                              </div>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  }
                  if (whiteboardMode() === "blockly") {
                    <div class="w-full h-full rounded-3xl border p-6 flex flex-col min-h-0 relative z-10 bg-[#0f0f15]/50 border-white/5">
                      <BlocklyWorkspace
                        {theme}
                        agents={presentAgents()}
                        savedRules={customRules()}
                        onSaveRules={(agentId, rules) => {
                          setCustomRules((prev) => {
                            const next = {
                              ...prev,
                              [agentId]: rules,
                            };
                            if (typeof window !== "undefined") {
                              localStorage.setItem(`rottra_blockly_rules_${meetingName()}`, JSON.stringify(next));
                            }
                            return next;
                          });

                          // Check if the rules contain a harmony block, and notify the backend
                          const harmonyAction = rules.flatMap((r: any) => r.actions || []).find(
                            (act: any) => act && act.type === "harmony",
                          );
                          if (harmonyAction) {
                            const disc = Number(harmonyAction.discount) || 15;
                            fetch("/api/agent/update-harmony", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ agentId, discount: disc }),
                            }).catch((err) => console.error("Error setting harmony on server:", err));
                          }
                        }}
                      />
                    </div>
                  }
                </div>
              </div>
            }

            <div
              class={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 flex-1 min-h-0 overflow-y-auto p-1 sm:p-2 content-start ${
                showWhiteboard() || activeTab() === "trade" ? "hidden" : ""
              }`}>
              for (const user of participantsStore) {
                <div
                  class={`relative flex items-center justify-center overflow-hidden rounded-2xl w-full min-h-[140px] aspect-[4/5] sm:aspect-video ${
                    user.isSpeaking ? "ring-4 ring-blue-500" : ""
                  } ${theme() === "dark" ? "bg-[#1e1e1e] border border-white/10" : "bg-white border border-gray-250 shadow-sm"}`}>
                  {/* Real video feed */}
                  if (user.stream && !user.isVideoOff && !user.isBot) {
                    <VideoFeed stream={user.stream} muted={user.isLocal} class="absolute inset-0 h-full w-full object-cover" />
                  }

                  {/* Live2D models from external CDN have been removed to enforce 100% Offline Mode. */}

                  <div
                    class="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 max-w-[85%] flex items-center gap-1.5 sm:gap-2 rounded-lg bg-black/50 px-2 sm:px-3 py-1 sm:py-1.5 backdrop-blur-md z-20">
                    <span class="text-xs sm:text-sm font-medium text-white truncate">{user.name}</span>
                    if (user.isSpeaking) {
                      <Icon path={signal} class="h-4 w-4 text-white" />
                    }
                    if (SACRED_GU_DATA[user.id]) {
                      <div class="group relative flex items-center justify-center cursor-pointer ml-1.5">
                        <span class="animate-pulse text-sm hover:scale-125 transition-transform">{SACRED_GU_DATA[user.id].icon}</span>
                        <div
                          class="pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-gray-900/95 p-3 text-xs text-white opacity-0 shadow-2xl backdrop-blur-md transition-all group-hover:pointer-events-auto group-hover:opacity-100 z-50">
                          <div class="flex items-center gap-1.5 font-bold text-emerald-400">
                            <span>{SACRED_GU_DATA[user.id].icon}</span>
                            <span>{SACRED_GU_DATA[user.id].name}</span>
                          </div>
                          <div class="mt-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            {"Phái: "}
                            {SACRED_GU_DATA[user.id].faction}
                          </div>
                          <div class="mt-1.5 border-t border-white/5 pt-1.5 text-gray-300">
                            {SACRED_GU_DATA[user.id].skill}
                          </div>
                          <div class="mt-1 text-[10px] text-emerald-500 font-semibold animate-pulse">{"● Đang kích hoạt trị liệu"}</div>
                        </div>
                      </div>
                    }
                  </div>

                  {/* Avatar fallback if video is off, stream is missing, or user is a bot (offline mode) */}
                  if (user.isVideoOff || !user.stream || user.isBot) {
                    const resolvedName =
                      user.name === "Bạn" || user.name === t("Bạn") ? userName() : t(user.name);
                    const hasAvatar = !!(user.avatar && user.avatar !== "" && user.avatar !== "/default-avatar.avif" &&
                      !user.avatar.includes("default-avatar.avif") &&
                      !(user.avatar.includes("c14419f70af6aa5bf55e0163e939afac") && !user.avatar.startsWith("/uploads/")));
                    <div
                      class="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ background: getGradientForName(resolvedName) }}>
                      <div class="absolute w-24 h-24 rounded-full bg-white/15 -translate-x-10 -translate-y-4 z-0 pointer-events-none" />
                      if (hasAvatar) {
                        <img
                          src={user.avatar}
                          class="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-xl z-10 relative"
                          alt={resolvedName}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallbackText = e.currentTarget.parentElement?.querySelector(".avatar-initials");
                            if (fallbackText) (fallbackText as HTMLElement).style.display = "block";
                          }}
                        />
                        <span
                          class="avatar-initials text-white font-bold text-4xl sm:text-6xl select-none z-10 relative"
                          style={{ display: "none" }}>
                          {getInitials(resolvedName)}
                        </span>
                      } else {
                        <span class="text-white font-bold text-4xl sm:text-6xl select-none z-10 relative">
                          {getInitials(resolvedName)}
                        </span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <div
            class={`relative z-30 mt-2 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 rounded-2xl px-3 sm:px-6 py-2 sm:py-4 backdrop-blur-xl border ${
              theme() === "dark" ? "bg-[#1e1e1e]/80 border-white/5" : "bg-white/95 border-gray-250 shadow-lg"
            }`}>
            <button
              onClick={toggleMute}
              class={`relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                isMuted()
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : (theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700")
              }`}>
              <div class="relative flex items-center justify-center">
                <Icon
                  path={microphone}
                  class={`h-4 w-4 sm:h-5 sm:w-5 ${isMuted() || theme() === "dark" ? "text-white" : "text-gray-700"}`}
                />
                <Show when={isMuted()}>
                  <svg
                    class="absolute inset-0 h-4 w-4 sm:h-5 sm:w-5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </Show>
              </div>
            </button>

            <button
              onClick={toggleVideo}
              class={`relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                isVideoOff()
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : (theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700")
              }`}>
              <Icon
                path={isVideoOff() ? videoCameraSlash : videoCamera}
                class={`h-4 w-4 sm:h-5 sm:w-5 ${isVideoOff() || theme() === "dark" ? "text-white" : "text-gray-700"}`}
              />
            </button>

            <button
              onClick={() => setIsHandRaised(!isHandRaised())}
              class={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                isHandRaised()
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : (theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700")
              }`}>
              <Icon
                path={handRaised}
                class={`h-4 w-4 sm:h-5 sm:w-5 ${isHandRaised() || theme() === "dark" ? "text-white" : "text-gray-700"}`}
              />
            </button>

            <button
              onClick={fetchApiKey}
              class={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700"
              }`}>
              <Icon path={key} class={`h-4 w-4 sm:h-5 sm:w-5 ${theme() === "dark" ? "text-white" : "text-gray-700"}`} />
            </button>

            <button
              onClick={() => setIsChatOpen(!isChatOpen())}
              class={`flex lg:hidden h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                isChatOpen()
                  ? "bg-blue-600 text-white"
                  : (theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700")
              }`}>
              <div class="relative">
                <Icon path={chatBubbleLeftRight} class="h-4 w-4 sm:h-5 sm:w-5" />
                <Show when={unreadChatCount() > 0}>
                  <span
                    class="absolute -top-1.5 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white px-0.5 animate-pulse">
                    {unreadChatCount()}
                  </span>
                </Show>
              </div>
            </button>

            <div class="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu())}
                class={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full transition-all shrink-0 ${
                  theme() === "dark" ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-150 hover:bg-gray-200 text-gray-700"
                }`}>
                <Icon path={ellipsisHorizontal} class={`h-4 w-4 sm:h-5 sm:w-5 ${theme() === "dark" ? "text-white" : "text-gray-700"}`} />
              </button>

              {/* Dropdown Menu */}
              <Show when={showMoreMenu()}>
                <div
                  class={`absolute bottom-full right-0 sm:right-auto sm:left-1/2 mb-4 origin-bottom-right sm:origin-bottom sm:-translate-x-1/2 w-[220px] max-w-[90vw] max-h-[65vh] overflow-y-auto rounded-2xl p-2 shadow-xl z-50 border meeting-dropdown custom-scrollbar ${
                    theme() === "dark" ? "bg-[#1e1e1e] border-white/10 text-white" : "bg-white border-gray-200 text-gray-800"
                  }`}>
                  <div class="px-3 pt-2 pb-1 text-[11px] font-bold text-white uppercase tracking-wider">{"Công cụ"}</div>
                  <button
                    onClick={() => {
                      setWhiteboardMode("mermaid");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      whiteboardMode() === "mermaid" && showWhiteboard()
                        ? "bg-gray-750 text-white font-bold"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <span class="text-base">{"📊"}</span>
                    {"Sơ đồ Mermaid"}
                  </button>
                  <div class="px-3 pt-3 pb-1 border-t border-white/5 mt-1 text-[11px] font-bold text-white uppercase tracking-wider">
                    {"Bảng vẽ tay"}
                  </div>
                  <button
                    onClick={() => {
                      setWhiteboardMode("canvas");
                      setDrawingTool("pencil");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      drawingTool() === "pencil" && showWhiteboard()
                        ? "bg-gray-750 text-white font-bold"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <Icon path={pencil} class="h-4 w-4 text-orange-400" />
                    {"Dùng bút"}
                  </button>
                  <button
                    onClick={() => {
                      setWhiteboardMode("canvas");
                      setDrawingTool("brush");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      drawingTool() === "brush" && showWhiteboard() ? "bg-gray-750 text-white font-bold" : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <Icon path={paintBrush} class="h-4 w-4 text-purple-400" />
                    {"Cọ sơn"}
                  </button>
                  <button
                    onClick={() => {
                      setWhiteboardMode("canvas");
                      setDrawingTool("link");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      drawingTool() === "link" && showWhiteboard() ? "bg-gray-750 text-white font-bold" : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <Icon path={link} class="h-4 w-4 text-green-400" />
                    {"Đường nối"}
                  </button>
                  <button
                    onClick={() => {
                      setWhiteboardMode("canvas");
                      setDrawingTool("eraser");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      drawingTool() === "eraser" && showWhiteboard()
                        ? "bg-gray-750 text-white font-bold"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <span class="text-base text-pink-400">{"🧽"}</span>
                    {"Cục tẩy"}
                  </button>
                  <Show when={drawingTool() === "eraser" && whiteboardMode() === "canvas"}>
                    <div class="px-4 py-2 border-t border-white/5 mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="onlyEraseMyStrokesCheckbox"
                        checked={onlyEraseMyStrokes()}
                        onChange={(e) => setOnlyEraseMyStrokes(e.currentTarget.checked)}
                        class="rounded border-white/20 bg-gray-800 text-blue-500 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                      <label for="onlyEraseMyStrokesCheckbox" class="text-[11px] text-gray-300 font-medium cursor-pointer select-none">
                        {"Bảo vệ bản vẽ Agent"}
                      </label>
                    </div>
                  </Show>
                  <button
                    onClick={() => {
                      undoLastDraw();
                      setShowMoreMenu(false);
                    }}
                    class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors">
                    <Icon path={arrowUturnLeft} class="h-4 w-4 text-blue-400" />
                    {"Hoàn tác (Undo)"}
                  </button>
                  <button
                    onClick={() => {
                      setWhiteboardMode("trade");
                      setShowWhiteboard(true);
                      setActiveTab("trade");
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      whiteboardMode() === "trade" && showWhiteboard()
                        ? "bg-gray-750 text-white font-bold"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <Icon path={scale} class="h-4 w-4 text-yellow-400" />
                    {"Thương lượng"}
                  </button>
                  <button
                    onClick={() => {
                      setWhiteboardMode("blockly");
                      setShowWhiteboard(true);
                      setShowMoreMenu(false);
                    }}
                    class={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      whiteboardMode() === "blockly" && showWhiteboard()
                        ? "bg-gray-750 text-white font-bold"
                        : "text-gray-200 hover:bg-gray-700"
                    }`}>
                    <span class="text-base">{"🧩"}</span>
                    {"Lập trình AI"}
                  </button>
                  {/* Đổi màu button */}
                  <div class="relative w-full border-t border-white/5 mt-1">
                    <div class="px-3 pt-3 pb-2 text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span class="relative h-3 w-3">
                        <span class="absolute inset-0 text-green-500" style="clip-path: polygon(0 0, 49% 0, 43% 100%, 0 100%)">
                          <Icon path={swatch} class="h-3 w-3" />
                        </span>
                        <span class="absolute inset-0 text-red-500" style="clip-path: polygon(49% 0, 100% 0, 100% 31%, 44% 84%)">
                          <Icon path={swatch} class="h-3 w-3" />
                        </span>
                        <span class="absolute inset-0 text-blue-500" style="clip-path: polygon(44% 84%, 100% 31%, 100% 100%, 43% 100%)">
                          <Icon path={swatch} class="h-3 w-3" />
                        </span>
                      </span>
                      {"Đổi màu bút"}
                    </div>
                    <div class="px-4 pb-3 flex flex-wrap gap-2.5">
                      for (const color of [
                        "#ef4444",
                        "#f97316",
                        "#eab308",
                        "#22c55e",
                        "#3b82f6",
                        "#a855f7",
                        "#ec4899",
                        "#ffffff",
                        "#000000",
                      ]) {
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedColor(color);
                            setShowMoreMenu(false);
                          }}
                          class={`w-6 h-6 rounded-full border-2 transition-all ${
                            selectedColor() === color
                              ? "border-white scale-110 shadow-lg shadow-white/20"
                              : "border-transparent hover:scale-110"
                          }`}
                          style={{ "background-color": color }}
                          title={`Màu ${color}`}
                        />
                      }
                      <div
                        class="relative w-6 h-6 rounded-full border-2 border-transparent overflow-hidden hover:scale-110 transition-transform shadow-inner"
                        style="background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);">
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={selectedColor() || "#3b82f6"}
                          onInput={(e) => setSelectedColor(e.currentTarget.value)}
                          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Pha màu tùy chỉnh"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="px-3 pt-3 pb-1 border-t border-white/5 mt-1 text-[11px] font-bold text-white uppercase tracking-wider">
                    {"Cảm xúc"}
                  </div>
                  <button
                    onClick={() => {
                      const emoji = "❤️";
                      addReaction(emoji, "Bạn");
                      if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(
                          JSON.stringify({
                            type: "reaction",
                            senderId: myClientId,
                            senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
                            emoji,
                          }),
                        );
                      }
                      setShowMoreMenu(false);
                    }}
                    class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700">
                    <Icon path={heart} class="h-4 w-4 text-red-500" />
                    {"Thả tim"}
                  </button>
                  <button
                    onClick={() => {
                      const emoji = "👍";
                      addReaction(emoji, "Bạn");
                      if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(
                          JSON.stringify({
                            type: "reaction",
                            senderId: myClientId,
                            senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
                            emoji,
                          }),
                        );
                      }
                      setShowMoreMenu(false);
                    }}
                    class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700">
                    <Icon path={handThumbUp} class="h-4 w-4 text-green-400" />
                    {"Đồng ý"}
                  </button>
                  <button
                    onClick={() => {
                      const emoji = "👎";
                      addReaction(emoji, "Bạn");
                      if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(
                          JSON.stringify({
                            type: "reaction",
                            senderId: myClientId,
                            senderName: chosenCharacter() ? chosenCharacter().name : (role() === "admin" ? "Admin" : "User"),
                            emoji,
                          }),
                        );
                      }
                      setShowMoreMenu(false);
                    }}
                    class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700">
                    <Icon path={handThumbDown} class="h-4 w-4 text-yellow-500" />
                    {"Không đồng ý"}
                  </button>
                </div>
              </Show>
            </div>

            <div class="h-6 sm:h-8 w-px bg-gray-600 hidden sm:block" />

            <button
              onClick={leaveMeeting}
              class="flex items-center justify-center gap-2 rounded-full bg-red-600 h-10 w-10 sm:h-auto sm:w-auto sm:px-6 sm:py-3 font-bold text-white transition-all hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/30 shrink-0">
              <Icon path={power} class="h-4 w-4 sm:h-5 sm:w-5" />
              <span class="hidden sm:inline">{"Rời phòng"}</span>
            </button>
          </div>
        </div>
        {/* Sidebar */}
        <div
          class={`fixed inset-0 z-50 lg:static flex w-full h-full shrink-0 flex-col border-t lg:border-t-0 lg:border-l lg:w-80 transition-transform duration-300 ${
            isChatOpen() ? "translate-x-0 flex" : "translate-x-full lg:translate-x-0 hidden lg:flex"
          } ${theme() === "dark" ? "border-white/10 bg-[#0f0f0f]" : "border-gray-200 bg-white"}`}>
          <div class={`flex border-b shrink-0 ${theme() === "dark" ? "border-white/10" : "border-gray-200"}`}>
            <button
              onClick={() => setActiveTab("participants")}
              class={`flex-1 py-3 text-[10px] font-bold transition-colors ${
                activeTab() === "participants" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400 hover:text-gray-200"
              }`}>
              <div class="flex flex-col items-center justify-center gap-0.5">
                <Icon path={userGroup} class="h-3.5 w-3.5" />
                <span>{"Người họp (" + allActiveParticipants().length + ")"}</span>
              </div>
            </button>
            <Show when={isAgentRoom()}>
              <button
                onClick={() => {
                  setActiveTab("trade");
                  setWhiteboardMode("trade");
                  setShowWhiteboard(true);
                  if (window.innerWidth < 1024) setIsChatOpen(false);
                }}
                class={`flex-1 py-3 text-[10px] font-bold transition-colors ${
                  activeTab() === "trade" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400 hover:text-gray-200"
                }`}>
                <div class="flex flex-col items-center justify-center gap-0.5">
                  <Icon path={adjustmentsVertical} class="h-3.5 w-3.5" />
                  <span>{"Thương mại"}</span>
                </div>
              </button>
            </Show>
            <button
              onClick={() => setActiveTab("chat")}
              class={`flex-1 py-3 text-[10px] font-bold transition-colors ${
                activeTab() === "chat" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400 hover:text-gray-200"
              }`}>
              <div class="flex flex-col items-center justify-center gap-0.5">
                <div class="relative">
                  <Icon path={chatBubbleLeftRight} class="h-3.5 w-3.5" />
                  <Show when={unreadChatCount() > 0}>
                    <span
                      class="absolute -top-1.5 -right-2.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white px-0.5 animate-pulse">
                      {unreadChatCount()}
                    </span>
                  </Show>
                </div>
                <span>{"Tin nhắn"}</span>
              </div>
            </button>
            <button
              onClick={() => setIsChatOpen(false)}
              class="lg:hidden flex items-center justify-center px-4 hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
              <span class="text-base font-bold">{"X"}</span>
            </button>
          </div>
          <div class="flex flex-1 flex-col overflow-hidden">
            <Show when={activeTab() === "participants"}>
              <div class={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${theme() === "dark" ? "bg-[#0f0f0f]" : "bg-white"}`}>
                for (const user of allActiveParticipants()) {
                  <div
                    class={`flex items-center justify-between rounded-xl p-3 border ${
                      theme() === "dark" ? "bg-[#1e1e1e]/60 border-white/5" : "bg-gray-50 border-gray-200 shadow-sm"
                    }`}>
                    <div class="flex items-center gap-3">
                      <ParticipantAvatar {user} userName={userName()} />
                      <div>
                        <p class={`text-sm font-medium ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>{user.name}</p>
                        <p class="text-[10px] text-gray-400">
                          {user.name.includes("Tô Lượng") || user.name.includes("Thương Nguyệt") || user.name.includes("Trầm Tinh") ||
                          user.name.includes("Đào Tiểu Cửu") ||
                          user.name.includes("Hỏa Huỳnh") ||
                          user.name.includes("Phi Nguyệt") ||
                          user.name.includes("Như Nguyệt") ||
                          user.name.includes("Sứ giả")
                            ? "Thuộc nhóm: Phe Nguyệt Quang"
                            : user.name.includes("Phi Anh") || user.name.includes("Bạch Di Hành") || user.name.includes("U Vương Mẫu") ||
                            user.name.includes("Bạch Lộc")
                              ? "Thuộc nhóm: Phe Quang Minh"
                              : "Vai trò: " + user.role}
                        </p>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <div class="relative">
                        <Icon path={microphone} class="h-4 w-4 text-gray-500" />
                        if (user.isMuted) {
                          <svg
                            class="absolute inset-0 h-4 w-4 text-red-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                          </svg>
                        }
                      </div>
                      <Icon path={user.isVideoOff ? videoCameraSlash : videoCamera} class="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                }
              </div>
            </Show>

            <Show when={activeTab() === "chat"}>
              <div class={`flex flex-1 flex-col overflow-hidden ${theme() === "dark" ? "bg-[#0f0f0f]" : "bg-white"}`}>
                {/* Chat Messages */}
                <div ref={chatContainerRef} class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  if (messages().length > 0) {
                    <div class="flex flex-col gap-4">
                      for (const msg of messages()) {
                        <div
                          class="flex flex-col"
                          classList={{ "items-end": msg.senderId === myClientId, "items-start": msg.senderId !== myClientId }}>
                          <div class="flex items-baseline gap-2 mb-1" classList={{ "flex-row-reverse": msg.senderId === myClientId }}>
                            <span
                              class="text-xs font-extrabold"
                              classList={{
                                "text-blue-400": msg.senderId === myClientId,
                                "text-indigo-400 font-bold": msg.senderId !== myClientId,
                              }}>
                              {msg.sender}
                            </span>
                            <span class="text-[9px] text-gray-500">{msg.time}</span>
                          </div>
                          if (msg.senderId === myClientId) {
                            <div
                              class="px-4 py-2.5 rounded-2xl rounded-tr-none text-xs w-fit max-w-[88%] select-text bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/10"
                              innerHTML={formatMarkdown(msg.text || "")}
                            />
                          } else {
                            <div class="flex flex-col gap-2">
                              <div
                                class={`w-full py-1 text-xs select-text text-left leading-relaxed ${
                                  theme() === "dark" ? "text-gray-200" : "text-gray-800"
                                }`}
                                innerHTML={formatMarkdown(msg.text || "")}
                              />
                              <Show when={msg.svgImage}>
                                <div class="mt-1 flex justify-start">
                                  <div 
                                    class="w-32 h-32 rounded-lg overflow-hidden border shadow-sm transition-transform hover:scale-105"
                                    classList={{ "border-gray-700 bg-[#1a1a1a]": theme() === "dark", "border-gray-200 bg-gray-50": theme() === "light" }}
                                    innerHTML={msg.svgImage} 
                                  />
                                </div>
                              </Show>
                              <Show when={msg.music}>
                                <audio autoplay src={`data:audio/wav;base64,${msg.music}`} class="hidden" />
                              </Show>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  } else {
                    <div class="flex h-full flex-col items-center justify-center py-12">
                      <Icon path={chatBubbleLeftRight} class="mx-auto mb-4 h-12 w-12 text-gray-700" />
                      <p class="text-gray-500 text-sm italic">{"Chưa có tin nhắn nào"}</p>
                    </div>
                  }
                </div>

                {/* Chat Input */}
                <div class={`border-t p-4 ${theme() === "dark" ? "border-white/5 bg-[#0f0f0f]" : "border-gray-100/50 bg-white"}`}>
                  <div class="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Nhập tin nhắn..."
                      value={chatInput()}
                      onInput={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      disabled={!isMeetingActive()}
                      class={`w-full border rounded-xl py-2.5 pl-4 pr-12 text-sm font-medium outline-none transition-all disabled:opacity-50 ${
                        theme() === "dark"
                          ? "bg-black/30 border-white/5 text-white placeholder-gray-500 focus:bg-black/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                          : "bg-gray-100/50 border-gray-200/50 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                      }`}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!isMeetingActive() || !chatInput().trim()}
                      class="absolute right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                      <Icon path={paperAirplane} class="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={downloadChatHistory}
                    class={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs transition border ${
                      theme() === "dark"
                        ? "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        : "bg-gray-100/50 border-gray-250/50 text-gray-600 hover:bg-gray-200"
                    }`}>
                    <Icon path={documentArrowDown} class="h-4 w-4" />
                    {"Tải lịch sử tin nhắn"}
                  </button>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === "trade"}>
              <div class={`flex flex-1 flex-col overflow-hidden p-4 ${theme() === "dark" ? "bg-[#0f0f0f]" : "bg-white"}`}>
                <Show when={remoteParticipants().length === 0}>
                  <div
                    class={`mb-4 flex flex-col items-center justify-center text-center p-6 rounded-2xl border ${
                      theme() === "dark"
                        ? "bg-amber-950/15 border-amber-500/25 text-amber-300"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}>
                    <span class="text-3xl mb-2">{"⚠️"}</span>
                    <h5 class="text-sm font-bold">{"Phòng họp chưa có thành viên khác"}</h5>
                    <p class="text-xs text-gray-400 mt-1 max-w-sm">
                      {"Tính năng thương lượng và giao thương chỉ khả dụng khi có từ 2 thành viên trở lên tham gia phòng họp. Vui lòng chờ hoặc chia sẻ liên kết phòng để mời người khác."}
                    </p>
                  </div>
                </Show>
                <div class="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {/* CẨM NANG ĐẦU TƯ TÀI CHÍNH (CHỨNG KHOÁN & BITCOIN) */}
                  <div
                    class={`rounded-2xl border transition-all duration-300 p-4 ${
                      theme() === "dark" ? "bg-[#161616] border-slate-800" : "bg-blue-50/50 border-blue-100"
                    }`}>
                    <div class="flex items-center justify-between cursor-pointer" onClick={() => setShowGuide(!showGuide())}>
                      <div class="flex items-center gap-2">
                        <span class="text-lg">{"📘"}</span>
                        <h4 class={`text-xs font-black uppercase tracking-wider ${theme() === "dark" ? "text-blue-400" : "text-blue-700"}`}>
                          {"Cẩm Nang Hướng Dẫn Đầu Tư Tài Chính"}
                        </h4>
                      </div>
                      <span class={`text-[10px] font-bold ${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        {showGuide() ? "Thu gọn ➖" : "Mở rộng ➕"}
                      </span>
                    </div>

                    <Show when={showGuide()}>
                      <div class="mt-4 space-y-4 text-[11px] leading-relaxed border-t pt-3 border-dashed border-gray-700/20">
                        {/* Hướng dẫn Chứng Khoán */}
                        <div class="space-y-2">
                          <div class="flex items-center gap-1.5 font-bold text-amber-500">
                            <span>{"📈"}</span>
                            <span>{"HƯỚNG DẪN ĐẦU TƯ CHỨNG KHOÁN"}</span>
                          </div>
                          <ul class="space-y-1.5 list-none pl-1">
                            <li>
                              <strong class="text-blue-400">{"1. Nạp tiền vào tài khoản:"}</strong>
                              <span class="text-gray-400">
                                {" Chuyển tiền từ tài khoản ngân hàng cá nhân sang tài khoản chứng khoán được mở tại các công ty chứng khoán uy tín."}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"2. Chọn cổ phiếu:"}</strong>
                              <span class="text-gray-400">
                                {" Tìm hiểu kỹ về doanh nghiệp, kết quả kinh doanh, lợi thế cạnh tranh ngành và triển vọng tăng trưởng bền vững. Ví dụ các cổ phiếu lớn: FPT, Vietcombank (VCB), Vinamilk (VNM)."}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"3. Đặt lệnh mua:"}</strong>
                              <span class="text-gray-400">
                                {` Nhập mã cổ phiếu, khối lượng mua (lô tối thiểu 100 cp) và mức giá mong muốn trên ứng dụng giao dịch chứng khoán. Ví dụ: mua 100 cp giá 50,000${currencySymbol()}/cp cần chuẩn bị 5 triệu đồng vốn.`}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"4. Theo dõi danh mục:"}</strong>
                              <span class="text-gray-400">
                                {" Thường xuyên cập nhật báo cáo tài chính và biến động thị trường. Xác định rõ chiến lược đầu tư ngắn hạn lướt sóng hay nắm giữ dài hạn gia tăng tài sản."}
                              </span>
                            </li>
                          </ul>
                        </div>

                        {/* Hướng dẫn Bitcoin */}
                        <div class="space-y-2 border-t border-dashed border-gray-700/20 pt-3">
                          <div class="flex items-center gap-1.5 font-bold text-orange-400">
                            <span>{"₿"}</span>
                            <span>{"HƯỚNG DẪN ĐẦU TƯ BITCOIN (CRYPTO)"}</span>
                          </div>
                          <ul class="space-y-1.5 list-none pl-1">
                            <li>
                              <strong class="text-blue-400">{"1. Chọn sàn uy tín quốc tế:"}</strong>
                              <span class="text-gray-400">
                                {" Lựa chọn các sàn lớn có tính thanh khoản cao như Binance, Bybit, OKX để đảm bảo an toàn tối đa cho tài khoản của bạn."}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"2. Xác minh KYC & Bảo mật:"}</strong>
                              <span class="text-gray-400">
                                {" Hoàn thành xác minh danh tính và bắt buộc bật tính năng bảo mật xác thực 2 lớp Google Authenticator (2FA)."}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"3. Mua Bitcoin bằng VND:"}</strong>
                              <span class="text-gray-400">
                                {" Sử dụng giao dịch P2P (Peer-to-Peer) để chuyển khoản VND từ ngân hàng trực tiếp cho người bán để nhận Bitcoin hoặc USDT an toàn trên sàn."}
                              </span>
                            </li>
                            <li>
                              <strong class="text-blue-400">{"4. Lưu trữ an toàn:"}</strong>
                              <span class="text-gray-400">
                                {" Với số lượng Bitcoin lớn tích lũy dài hạn, nên cân nhắc rút về ví cá nhân (ví lạnh phần cứng như Ledger, Trezor) để tránh rủi ro sập sàn."}
                              </span>
                            </li>
                          </ul>
                        </div>

                        <div class="text-[9px] text-gray-500 italic bg-black/10 p-2 rounded border border-white/5">
                          {"💡 Lưu ý: Thị trường chứng khoán và crypto luôn tiềm ẩn rủi ro biến động giá cực mạnh. Chỉ đầu tư bằng số vốn nhàn rỗi mà bạn có khả năng chấp nhận mất mát."}
                        </div>
                      </div>
                    </Show>
                  </div>

                  <Show when={presentUnderReviewList().length > 0}>
                    <div class="mb-4 rounded-xl bg-amber-950/20 border border-amber-500/20 p-3 space-y-2">
                      <div class="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                        <span>{"⚠️"}</span>
                        <span>{`DANH SÁCH XEM XÉT (${currentLeader().name.toUpperCase()} QUẢN LÝ)`}</span>
                      </div>
                      <div class="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                        for (const item of presentUnderReviewList()) {
                          <div class="text-[10px] bg-black/40 rounded-lg p-2 border border-amber-500/10 flex flex-col gap-0.5">
                            <div class="flex justify-between items-center">
                              <span class="font-bold text-amber-200">{item.agentName}</span>
                              <span class="text-gray-400 text-[9px]">{item.productName.split(" ")[0]}</span>
                            </div>
                            <span class="text-[9px] text-amber-400/80 italic">{item.reason}</span>
                          </div>
                        }
                      </div>
                    </div>
                  </Show>
                  <div class="text-[10px] font-bold text-gray-400 mb-1">{"DANH SÁCH TÀI SẢN & HÀNG HÓA NHÂN SỰ"}</div>

                  for (const agent of presentAgents()) {
                    const isLeader = () => agent?.id === currentLeader()?.id;
                    <div
                      class="rounded-xl p-3 flex flex-col gap-2 transition-all duration-300"
                      classList={{
                        "bg-[#1e1e1e]/60 border border-white/5 hover:border-white/10": !isLeader() && theme() === "dark",
                        "bg-gray-50 border border-gray-250 hover:border-gray-300 text-gray-800": !isLeader() && theme() !== "dark",
                        "bg-gradient-to-r from-yellow-950/20 via-[#1e1e1e]/80 to-[#1e1e1e]/60 border border-yellow-500/40 shadow-[0_0_15px_rgba(251,191,36,0.1)]": isLeader() &&
                          theme() === "dark",
                        "bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 border border-yellow-400 shadow-md text-gray-900": isLeader() &&
                          theme() !== "dark",
                      }}>
                      <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                          <a
                            href={`/profile/${((agent?.id || "").replace(/^user_?/, "") || "").replace(
                              /([a-z0-9])([A-Z])/g,
                              "$1-$2",
                            ).replace(/_/g, "-").toLowerCase()}`}
                            target="_blank"
                            class="flex items-center gap-2 hover:underline group/agentlink">
                            <span
                              class="h-2.5 w-2.5 rounded-full border border-white/10"
                              classList={{ "animate-pulse": isLeader() }}
                              style={{ "background-color": isLeader() ? "#fbbf24" : getFourColor(agent?.id || "") }}
                            />
                            <span
                              class="text-xs font-bold transition-colors"
                              classList={{
                                "text-yellow-400 font-extrabold": isLeader(),
                                [theme() === "dark"
                                  ? "text-white group-hover/agentlink:text-blue-400"
                                  : "text-gray-850 group-hover/agentlink:text-blue-600"]: !isLeader(),
                              }}>
                              {agent.name}
                            </span>
                          </a>
                          <div class="flex flex-wrap gap-1 mt-1">
                            for (const badge of getAgentBadges(agent.id, agent.budget, agent.price)) {
                              <span class={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${badge.css}`} title={badge.title || ""}>
                                {badge.text}
                              </span>
                            }
                          </div>
                        </div>
                        <div class="flex flex-col items-end">
                          <Show when={agent.budget !== 0}>
                            <span class="text-xs font-mono font-bold text-emerald-400" classList={{ "text-yellow-400": isLeader() }}>
                              {formatCurrency(agent.budget)}
                              {currencySymbol()}
                            </span>
                          </Show>
                          <Show when={agent.gold !== undefined && agent.gold !== 0}>
                            <span class="text-[10px] font-bold text-yellow-500 flex items-center gap-0.5 mt-0.5" title={t("Vàng tích trữ")}>
                              <span>{"🪙"}</span>
                              <span class="font-mono">
                                {t("{amount} lượng").replace(
                                  "{amount}",
                                  formatNumber(agent.gold, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                )}
                              </span>
                            </span>
                          </Show>
                          <div class="flex flex-col gap-0.5 mt-0.5 justify-end items-end">
                            <Show when={getAgentBTCQty(agent.stocks) > 0}>
                              <span
                                class="text-[9px] font-bold text-orange-400 flex items-center gap-0.5 mt-0.5"
                                title={t("Bitcoin (Crypto)")}>
                                <span>{"₿"}</span>
                                <span class="font-mono">
                                  {t("{qty} BTC").replace(
                                    "{qty}",
                                    formatNumber(getAgentBTCQty(agent.stocks), { maximumFractionDigits: 4 }),
                                  )}
                                </span>
                              </span>
                            </Show>
                            <Show when={getAgentTotalStockQty(agent.stocks) > 0}>
                              <span class="text-[9px] font-bold text-blue-400 flex items-center gap-0.5 mt-0.5" title={t("Chứng khoán")}>
                                <span>{"📈"}</span>
                                <span class="font-mono">
                                  {t("{qty} cổ").replace("{qty}", formatNumber(getAgentTotalStockQty(agent.stocks)))}
                                </span>
                              </span>
                            </Show>
                          </div>
                        </div>
                      </div>

                      <Show when={isLeader()}>
                        <div
                          class="flex justify-between items-center text-[10px] bg-yellow-500/5 px-2 py-1.5 rounded-lg border border-yellow-500/10">
                          <span class="text-yellow-400/80 font-semibold">{t("Ngân quỹ quản lý:")}</span>
                          <span class="font-mono font-bold text-yellow-400">
                            {formatCurrency(agent.budget)}
                            {currencySymbol()}
                          </span>
                        </div>
                      </Show>

                      {/* Negotiation skill rating */}
                      <div
                        class={`text-[10px] flex justify-between items-center px-2 py-1 rounded-lg ${
                          theme() === "dark" ? "bg-black/40" : "bg-gray-200/50"
                        }`}>
                        <span class={`${theme() === "dark" ? "text-gray-400" : "text-gray-600"}`}>{t("Lời đồn:")}</span>
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold" style={{ color: agentSkills()[agent.id]?.color || "#9ca3af" }}>
                            {t(agentSkills()[agent.id]?.title || "Trung bình")}
                          </span>
                        </div>
                      </div>

                      <div class="space-y-1">
                        if (agent.products && agent.products.length > 0) {
                          for (const prod of agent.products) {
                            <div
                              class={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                                theme() === "dark" ? "text-gray-400 bg-black/20" : "text-gray-700 bg-gray-100"
                              }`}>
                              <span class="truncate pr-2" title={prod.name}>{prod.name}</span>
                              <span class={`font-semibold shrink-0 ${theme() === "dark" ? "text-gray-300" : "text-gray-800"}`}>
                                {t("{qty} x {price}{symbol}").replace("{qty}", formatNumber(prod.quantity)).replace(
                                  "{price}",
                                  formatCurrency(prod.price),
                                ).replace("{symbol}", currencySymbol())}
                              </span>
                            </div>
                          }
                        } else {
                          <div
                            class={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                              theme() === "dark" ? "text-gray-400 bg-black/20" : "text-gray-700 bg-gray-100"
                            }`}>
                            <span>{agent.product}</span>
                            <span class={`font-semibold ${theme() === "dark" ? "text-gray-300" : "text-gray-800"}`}>
                              {t("{qty} x {price}{symbol}").replace("{qty}", formatNumber(agent.quantity)).replace(
                                "{price}",
                                formatCurrency(agent.price),
                              ).replace("{symbol}", currencySymbol())}
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  {/* Skillspector Panel */}
                  <div
                    class={`mt-6 mb-4 rounded-xl border p-4 animate-fade-in ${
                      theme() === "dark" ? "bg-[#1e1e1e]/60 border-white/5" : "bg-gray-50 border-gray-200 shadow-sm"
                    }`}>
                    <div class="flex items-center justify-between mb-3">
                      <h4 class={`text-xs font-bold flex items-center gap-1.5 ${theme() === "dark" ? "text-white" : "text-gray-800"}`}>
                        <span>{"🔍"}</span>
                        <span>{"SWARM INSPECTOR (SKILLSPECTOR)"}</span>
                      </h4>
                      <span class="text-[8px] bg-blue-500/15 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-500/20">
                        {"Quản Lý Năng Lực AI"}
                      </span>
                    </div>
                    <p class="text-[10px] text-gray-400 mb-3">
                      {"Phân tích chi tiết cấp độ đàm phán, hệ số thương lượng (K) và khả năng chấp nhận rủi ro tín dụng của từng Agent đang hoạt động."}
                    </p>

                    <div class="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                      for (const agent of presentAgents()) {
                        <div
                          class="p-2.5 rounded-lg border flex flex-col gap-1.5 transition duration-150"
                          classList={{
                            "bg-black/30 border-white/5 hover:bg-black/45": theme() === "dark",
                            "bg-white border-gray-250 hover:bg-gray-150": theme() !== "dark",
                          }}>
                          <div class="flex justify-between items-center">
                            <div class="flex items-center gap-1.5">
                              <span class="h-2 w-2 rounded-full" style={{ "background-color": getFourColor(agent.id) }} />
                              <span
                                class="text-[11px] font-bold text-gray-300"
                                classList={{ "text-yellow-400": agent.id === currentLeader()?.id }}>
                                {agent.name}
                              </span>
                            </div>
                            <span
                              class="text-[9px] font-extrabold px-1.5 py-0.5 rounded border bg-transparent"
                              style={{
                                "border-color": agentSkills()[agent.id]?.color || "#9ca3af",
                                color: agentSkills()[agent.id]?.color || "#9ca3af",
                              }}>
                              {agentSkills()[agent.id]?.title || "Trung bình"}
                            </span>
                          </div>

                          <div class="grid grid-cols-3 gap-1.5 text-[9px] text-gray-400 mt-0.5 font-mono">
                            <div class="flex flex-col">
                              <span>{"Hệ số K"}</span>
                              <span class="font-bold text-sky-400 mt-0.5">
                                {"x" + (1 + (agentSkills()[agent.id]?.level || 5) / 10).toFixed(1)}
                              </span>
                            </div>
                            <div class="flex flex-col">
                              <span>{"Tâm lý"}</span>
                              <span class="font-bold text-purple-400 mt-0.5">
                                {"T = " + Math.min(10, Math.max(1, agentSkills()[agent.id]?.level || 5))}
                              </span>
                            </div>
                            <div class="flex flex-col">
                              <span>{"Sức ì"}</span>
                              <span class="font-bold text-amber-400 mt-0.5">
                                {"S = " + (agent.budget < 0 ? 1 : Math.max(1, 10 - (agentSkills()[agent.id]?.level || 5)))}
                              </span>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  <div
                    class="text-[12px] font-extrabold text-gray-500 dark:text-gray-300 mt-6 mb-2 tracking-wider flex items-center gap-1.5">
                    <span>{"📜"}</span>
                    <span>{"LỊCH SỬ GIAO DỊCH"}</span>
                  </div>
                  <div
                    class={`rounded-xl p-4 space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin border ${
                      theme() === "dark"
                        ? "bg-black/35 border-white/10 text-gray-200"
                        : "bg-gray-50 border-gray-300 text-gray-800 shadow-inner"
                    }`}>
                    if (tradeLogs().length > 0) {
                      for (const logItem of tradeLogs()) {
                        <div
                          class={`text-xs pb-2.5 flex items-start gap-2 border-b ${
                            theme() === "dark" ? "text-gray-200 border-white/5" : "text-gray-800 border-gray-200/80"
                          }`}>
                          <span class="text-emerald-500 mt-0.5 shrink-0">{"✔️"}</span>
                          <span class="leading-relaxed font-medium">{logItem.text}</span>
                        </div>
                      }
                    } else {
                      <div class="text-xs text-gray-400 dark:text-gray-500 font-medium italic text-center py-6">
                        {"Chưa phát động giao dịch"}
                      </div>
                    }
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      <Show when={showApiKeyDialog()}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            class="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-[0_0_30px_rgba(255,255,255,0.05)] text-left">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <Icon path={key} class="h-4 w-4 text-emerald-400" />
              {"CocoLink API Key"}
            </h3>

            <div class="space-y-3">
              <p class="text-xs text-gray-400">
                {"Đây là API Key được cấu hình trên máy chủ để chạy các tính năng AI tự động (Giáo sư AI, AI Agent đàm phán)."}
              </p>

              <div class="flex items-center gap-2 bg-black/40 border border-white/5 rounded-lg px-3 py-2">
                <input
                  type="text"
                  readOnly
                  value={apiKeyVal()}
                  class="flex-1 bg-transparent text-xs text-emerald-400 font-mono focus:outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeyVal());
                    setIsCopyingKey(true);
                    setTimeout(() => setIsCopyingKey(false), 2000);
                  }}
                  class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors border border-white/5">
                  {isCopyingKey() ? "Đã copy!" : "Copy"}
                </button>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button
                onClick={() => setShowApiKeyDialog(false)}
                class="px-4 py-2 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-300 font-semibold border border-white/5 transition-colors">
                {"Đóng"}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  </Show>
}
