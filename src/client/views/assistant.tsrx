import { createSignal, createEffect, onCleanup, onMount } from "solid-js";
import * as Diff from "diff";
import { syncUserPreferences } from "~/server/helpers/user-sync";
import { authClient } from "~/client/utils/auth-client";
import { useNavigate } from "@solidjs/router";
import { Icon } from "solid-heroicons";
import {
  barsArrowDown,
  paperClip,
  microphone,
  speakerXMark,
  speakerWave,
  paperAirplane,
  trash,
  videoCamera,
  pencil,
  arrowPath,
  xCircle,
  shoppingCart,
} from "solid-heroicons/outline";
import { theme } from "~/client/stores/theme-store";
import { formatMarkdown } from "~/server/helpers/markdown-parser";
import { currentLang, t } from "~/client/stores/i18n-store";
import { cartItems, updateCart } from "~/client/stores/cart-store";
import { getPrimaryImage } from "~/client/components/product-card.tsrx";

let isProductDataChecked = false;

let syncChatTimer: ReturnType<typeof setTimeout> | null = null;
function syncChatToServer(messages: { text: string; isUser: boolean }[]) {
  if (syncChatTimer) clearTimeout(syncChatTimer);
  syncChatTimer = setTimeout(() => {
    const session = (window as any).__rottra_session;
    if (!session) return;
    fetch("/api/agent/chat-history/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.map((m) => ({ role: m.isUser ? "user" : "assistant", content: m.text })) }),
    }).catch(() => {});
  }, 2000);
}

export component Assistant(props: any) {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const role = () => (session()?.data?.user as any)?.role || "guest";

  const getCommandsByRole = () => {
    const r = role();
    const baseCommands = [
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 4)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 5)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 6)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 7)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 8)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 9)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 10)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 11)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 12)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 13)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 14)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 15)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 16)",
      "[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần 17)",
    ];

    if (r === "admin") {
      return [
        "Cập nhật avatar của trợ lý",
        "/gan-anh",
        "/cap-ca-nhan",
        "/day",
        "/mode fable-5",
        "/mode mythos-5",
        "/mode sol-5",
        "/mode sol-normal",
        "/mode terra-5",
        "/mode luna-5",
        ...baseCommands,
        "Tính kỳ vọng, phương sai và độ lệch chuẩn",
        "Chỉ số Shannon đa dạng sinh học",
        "Lọc Kalman khử nhiễu cảm biến IoT",
        "Mô hình ARIMA dự báo sản lượng lúa",
        "KNN lân cận dự báo lượng mưa",
        "Phát hiện lỗi sản phẩm bằng Z-score",
        "Kiểm định ANOVA giống lúa",
        "Giải bài toán Gompertz lợn thịt",
        "Lai giống lúa F1 theo Mendel",
        "Thiết kế thí nghiệm phân bón",
        "Kiểm định giả thuyết H0 năng suất lúa",
        "Phân tích hồi quy tác động giá cả",
        "Viết báo cáo APA/IMRAD",
        "Phương pháp ReAct trong suy luận AI",
        "Tư duy logic Chain of Thought",
        "Agentic Workflow quản lý nông nghiệp",
        "Tìm thông tin giá lúa ST25 hôm nay",
        "Giải bài toán người bán hàng TSP",
        "Phân luồng Max-Flow Min-Cut",
        "Mạng lưới giao thông đồ thị",
        "Phân tích giá nông sản tối ưu",
        "Chiến lược kinh doanh mùa vụ",
        "Dọn dẹp bộ nhớ",
      ];
    }
    if (r === "user" || r === "ai") {
      return [
        ...baseCommands,
        "Tính kỳ vọng, phương sai và độ lệch chuẩn",
        "Chỉ số Shannon đa dạng sinh học",
        "Lọc Kalman khử nhiễu cảm biến IoT",
        "Tìm thông tin giá lúa ST25 hôm nay",
        "Chiến lược kinh doanh mùa vụ lúa gạo",
        "Dọn dẹp bộ nhớ",
      ];
    }
    return baseCommands;
  };

  const getShortCommandName = (cmd: string) => {
    if (cmd === "/mode fable-5") return "Claude Fable 5";
    if (cmd === "/mode mythos-5") return "Claude Mythos 5";
    if (cmd === "/mode sol-5") return "GPT-5.6 Sol Ultra";
    if (cmd === "/mode sol-normal") return "GPT-5.6 Sol";
    if (cmd === "/mode terra-5") return "GPT-5.6 Terra";
    if (cmd === "/mode luna-5") return "GPT-5.6 Luna";
    if (cmd.startsWith("/")) return cmd;
    if (cmd.startsWith("[Trí tuệ Nhân sinh]")) {
      const match = cmd.match(/Phần \d+/);
      return match ? `Cổ Nhân Dạy (${match[0]})` : "Cổ Nhân Dạy";
    }
    return cmd;
  };

  const displayAgentName = () => {
    const r = role();
    if (r === "admin") return agentName();
    if (r === "user" || r === "ai") return "Nâng cao ngôn ngữ tự nhiên";
    return "Ngôn ngữ tự nhiên";
  };

  const [isListening, setIsListening] = createSignal(false);
  const getInitialMuted = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("agent_bot_muted");
      if (stored !== null) return stored === "true";
    }
    return true;
  };
  const [isMuted, setIsMuted] = createSignal(getInitialMuted());
  const [attachedFile, setAttachedFile] = createSignal<any>(null);
  const [inputValue, setInputValue] = createSignal("");
  const [isUnloading, setIsUnloading] = createSignal(false);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [suggestionMap, setSuggestionMap] = createSignal<Record<number, string[]>>({});
  const [aiSuggestions, setAiSuggestions] = createSignal<string[]>([]);
  const [activeSugIndex, setActiveSugIndex] = createSignal(0);
  const [copiedIdx, setCopiedIdx] = createSignal<number | null>(null);
  const [feedbackMap, setFeedbackMap] = createSignal<Record<number, "up" | "down" | null>>({});
  const [isLoading, setIsLoading] = createSignal(false);
  let suggestTimer: ReturnType<typeof setTimeout> | null = null;
  let textareaRef: HTMLTextAreaElement | undefined;

  const copyToClipboard = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {}
  };

  const submitFeedback = async (idx: number, query: string, rating: "up" | "down") => {
    const current = feedbackMap()[idx];
    const newRating =
      current === rating ? null : rating;
    setFeedbackMap({ ...feedbackMap(), [idx]: newRating });
    if (newRating) {
      try {
        await fetch("/api/agent/chat-expert/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, rating: newRating }),
        });
      } catch {}
    }
  };

  createEffect(() => {
    aiSuggestions();
    inputValue();
    setActiveSugIndex(0);
  });

  const removeAccentsLocal = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  };

  const isTranslationSuggestion = (s: string) => {
    return s.startsWith("🌐") || s.includes("Bản Dịch") || s.includes("Đa Ngôn Ngữ") || s.includes("Dịch sang");
  };

  const getDynamicSuggestionsList = () => {
    const lastBotIdx = chat().map((msg, idx) => ({ msg, idx })).reverse().find((item) => !item.msg.isUser)?.idx;
    const activeSuggestions =
      lastBotIdx !== undefined && suggestionMap()[lastBotIdx] ? suggestionMap()[lastBotIdx] : [];

    const roleCommands = getCommandsByRole();

    const ai = aiSuggestions().filter((s) => !isTranslationSuggestion(s));
    if (ai.length > 0) {
      const staticList = Array.from(new Set([...activeSuggestions, ...roleCommands]));
      return [...ai, ...staticList.filter((s) => !ai.some((a) => a.toLowerCase() === s.toLowerCase()))];
    }

    return Array.from(new Set([...activeSuggestions, ...roleCommands]));
  };

  const getGhostText = () => {
    const val = inputValue();
    const list = getDynamicSuggestionsList();

    if (!val || val.trim().length === 0) {
      const recentUserTexts = chat().filter((m) => m.isUser).slice(-4).map((m) => removeAccentsLocal(m.text || ""));

      let ai = aiSuggestions().filter((s) => !isTranslationSuggestion(s) && !recentUserTexts.includes(removeAccentsLocal(s)));
      if (ai.length === 0) {
        const lastBotIdx = chat().map((msg, idx) => ({ msg, idx })).reverse().find((item) => !item.msg.isUser)?.idx;
        const activeSuggestions =
          lastBotIdx !== undefined && suggestionMap()[lastBotIdx] ? suggestionMap()[lastBotIdx] : [];
        if (activeSuggestions.length > 0) {
          ai = activeSuggestions.filter((s) => !isTranslationSuggestion(s) && !recentUserTexts.includes(removeAccentsLocal(s)));
        }
      }
      if (ai.length > 0) {
        const idx = activeSugIndex() % ai.length;
        return ai[idx] + " (Tab: Xem gợi ý khác | Enter/→: Chọn)";
      }
      return "";
    }

    const normalizedVal = removeAccentsLocal(val);
    const match = list.find((sug) => {
      const normalizedSug = removeAccentsLocal(sug);
      return normalizedSug.startsWith(normalizedVal) && sug.length > val.length;
    });

    if (match) {
      return match.slice(val.length) + " (Tab to accept)";
    }
    return "";
  };

  const handleInput = (e: any) => {
    setInputValue(e.currentTarget.value);
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
    }
    const val = e.currentTarget.value.trim();
    if (suggestTimer) clearTimeout(suggestTimer);
    if (val.length === 0) {
      return;
    }
    suggestTimer = setTimeout(async () => {
      try {
        const recentHistory = chat().slice(-6).map((m) => m.text || "");
        const res = await fetch("/api/agent/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: val, role: role(), history: recentHistory }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.suggestions)) {
            setAiSuggestions(data.suggestions);
          }
        }
      } catch {}
    }, 300);
  };

  const handleUnloadBrain = async (silent: boolean = false) => {
    if (isUnloading()) return;
    setIsUnloading(true);
    try {
      const res = await fetch("/api/agent/unload", { method: "POST" });
      const data = await res.json();
      if (data.success && !silent) {
        setChat(
          (prev) => [
            ...prev,
            {
              text: `✨ <b>Hệ thống RottraQA:</b> Đã quét sạch và giải phóng toàn bộ tài nguyên VRAM/RAM của mô hình chính & mô hình dự thảo thành công! Bộ nhớ máy Sếp đã mát mẻ trở lại! 🧹🍃`,
              isUser: false,
              silent: true,
            },
          ],
        );
      }
    } catch (err: any) {
      if (!silent) console.error("❌ Lỗi khi tự động giải phóng bộ nhớ: " + err.message);
    } finally {
      setIsUnloading(false);
    }
  };

  const isDarkMode = () => theme() === "dark";
  const [audioQueue, setAudioQueue] = createSignal([] as { url: string; text: string }[]);
  let audioRef: HTMLAudioElement | undefined;

  createEffect(() => {
    const queue = audioQueue();
    if (queue.length > 0 && audioRef && !isMuted()) {
      const currentUrl = queue[0].url;
      if (audioRef.src !== window.location.origin + currentUrl && audioRef.src !== currentUrl) {
        audioRef.src = currentUrl;
        audioRef.play().catch((e) => {});
      }
    }
  });

  const toggleMute = () => {
    const nextMuted = !isMuted();
    setIsMuted(nextMuted);
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_bot_muted", nextMuted.toString());
    }
    if (nextMuted) {
      setAudioQueue([]);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const playNextInQueue = () => {
    setAudioQueue((prev) => prev.slice(1));
  };

  const handleAttachment = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFile({ link: ev.target?.result, name: file.name, file, type: file.type.startsWith("video") ? "video" : "image" });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioError = () => {
    const current = audioQueue()[0];
    if (current && typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(current.text);
      utterance.lang = "vi-VN";
      window.speechSynthesis.speak(utterance);
    }
    playNextInQueue();
  };

  const speakText = (text: string) => {
    if (isMuted()) return;
    const cleanText = text.replace(/[\u{1F600}-\u{1F6FF}]/gu, "");
    const chunks = cleanText.match(/[^.,!?\n]+[.,!?\n]*/g) || [cleanText];
    const items = chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0).map(
      (chunk) => ({
        url: `/api/tts?text=${encodeURIComponent(chunk)}`,
        text: chunk,
      }),
    );
    setAudioQueue((prev) => [...prev, ...items]);
  };

  let recognition: any;
  if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      console.error("Speech recognition error:", event.error);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      handleSubmit(new Event("submit") as any);
    };
  }

  const toggleListen = () => {
    if (!recognition) return alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói!");
    if (isListening()) recognition.stop();
    else recognition.start();
  };

  const getInitialChat = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agent_bot_chat");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
      }
    }
    return [
      { text: "Xin chào! Mình là trợ lý Rottra. Hôm nay mình có thể giúp gì cho bạn? 😊", isUser: false },
    ];
  };

  const [agentName, setAgentName] = createSignal("RottraAI");
  const [agentAvatar, setAgentAvatar] = createSignal("");

  const fetchAgentProfile = async () => {
    try {
      const res = await fetch("/api/agent/system-profile");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        if (data.success && data.profile) {
          if (data.profile.fullName) setAgentName(data.profile.fullName);
          if (data.profile.avatar && data.profile.avatar.link) {
            let avatarUrl = data.profile.avatar.link;
            if (avatarUrl.includes("default-avatar.avif")) {
              avatarUrl = "/favicon.ico?v=3";
            }
            setAgentAvatar(avatarUrl);
          }
        }
      }
    } catch (e) {
      console.error("Lỗi khi tải profile agent:", e);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [chat, setChat] = createSignal<any[]>(getInitialChat());

  const submitQueryDirectly = (query: string) => {
    setInputValue(query);
    setTimeout(() => {
      handleSubmit(new Event("submit") as any);
    }, 50);
  };

  const renderMermaidDiagrams = () => {
    if (typeof window === "undefined") return;
    const currentTheme = theme();
    setTimeout(() => {
      const placeholders = document.querySelectorAll(".mermaid-diagram-placeholder");
      if (placeholders.length === 0) return;

      import("mermaid").then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: currentTheme === "dark" ? "dark" : "default",
          themeVariables: {
            background: currentTheme === "dark" ? "#1e1e2e" : "#ffffff",
            primaryColor: "#cba6f7",
          },
        });

        placeholders.forEach((el) => {
          const encodedCode = el.getAttribute("data-code");
          if (!encodedCode) return;

          const renderedTheme = el.getAttribute("data-rendered-theme");
          if (el.getAttribute("data-rendered") === "true" && renderedTheme === currentTheme) return;

          let code = decodeURIComponent(encodedCode);
          code = code.split("\n").map((line) => {
            let l = line.trim();
            if (l.startsWith("*") || l.startsWith("-")) {
              l = l.substring(1).trim();
            }
            return l;
          }).filter((line) => line.length > 0).join("\n");
          const renderId = `chat-mermaid-${Math.random().toString(36).substr(2, 9)}`;

          mermaid.render(renderId, code).then((result) => {
            el.innerHTML = result.svg;
            el.setAttribute("data-rendered", "true");
            el.setAttribute("data-rendered-theme", currentTheme);

            const svgEl = el.querySelector("svg");
            if (svgEl) {
              const nodes = svgEl.querySelectorAll(".node");
              nodes.forEach((nodeEl) => {
                nodeEl.setAttribute("style", "cursor: pointer !important;");
                nodeEl.addEventListener("click", (evt) => {
                  evt.stopPropagation();
                  let text = "";
                  const textEl = nodeEl.querySelector(".nodeLabel") || nodeEl.querySelector("text") || nodeEl;
                  if (textEl) {
                    text = textEl.textContent || "";
                  }
                  let cleanText = text.trim();
                  // Remove leading emojis/special characters
                  cleanText = cleanText.replace(/^[\p{Emoji}\s\uFE0F]+/gu, "").trim();
                  // Remove trailing type suffix like (Concept), (Entity), etc.
                  cleanText = cleanText.replace(/\s*\([^)]+\)$/, "").trim();
                  if (cleanText) {
                    submitQueryDirectly(cleanText);
                  }
                });
              });
            }
          }).catch((err) => {
            console.error("Failed to render chat mermaid:", err);
            const badSvg = document.getElementById(renderId);
            if (badSvg) badSvg.remove();
            el.innerHTML =
              `<div class="text-red-500 text-xs font-mono p-2 bg-red-500/10 border border-red-500/20 rounded-xl">Lỗi cú pháp Mermaid: ${
                err.message || err
              }</div>`;
            el.setAttribute("data-rendered", "true");
            el.setAttribute("data-rendered-theme", currentTheme);
          });
        });
      }).catch((err) => {
        console.error("Failed to load mermaid:", err);
      });
    }, 150);
  };

  const renderTypstDiagrams = () => {
    if (typeof window === "undefined") return;
    setTimeout(() => {
      const placeholders = document.querySelectorAll(".typst-diagram-placeholder");
      if (placeholders.length === 0) return;

      placeholders.forEach(async (el) => {
        if (el.getAttribute("data-rendered") === "true") return;

        const encodedCode = el.getAttribute("data-code");
        if (!encodedCode) return;

        const code = decodeURIComponent(encodedCode);
        el.innerHTML =
          `<div class="flex items-center gap-2 text-xs text-indigo-500 font-mono animate-pulse"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> Đang biên dịch Typst...</div>`;

        try {
          const res = await fetch("/api/agent/compile-typst", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (data.success && data.svg) {
            el.innerHTML = data.svg;
            el.setAttribute("data-rendered", "true");
          } else {
            el.innerHTML =
              `<div class="text-red-500 text-xs font-mono p-2 bg-red-500/10 border border-red-500/20 rounded-xl">Lỗi biên dịch Typst: ${
                data.error || "Không rõ lỗi"
              }</div>`;
            el.setAttribute("data-rendered", "true");
          }
        } catch (err: any) {
          el.innerHTML =
            `<div class="text-red-500 text-xs font-mono p-2 bg-red-500/10 border border-red-500/20 rounded-xl">Lỗi kết nối biên dịch Typst: ${err.message}</div>`;
          el.setAttribute("data-rendered", "true");
        }
      });
    }, 150);
  };

  createEffect(() => {
    chat();
    theme();
    renderMermaidDiagrams();
    renderTypstDiagrams();
  });

  const [lastSpokenIndex, setLastSpokenIndex] = createSignal(getInitialChat().length - 1);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editValue, setEditValue] = createSignal("");
  const [aiEditingIndex, setAiEditingIndex] = createSignal<number | null>(null);
  const [aiEditValue, setAiEditValue] = createSignal("");
  const [recalledMessage, setRecalledMessage] = createSignal<any | null>(null);

  const handleEditMessage = (idx: number, text: string) => {
    if (editingIndex() === idx) {
      setEditingIndex(null);
    } else {
      setEditingIndex(idx);
      setEditValue(text);
    }
  };

  const handleAiEditMessage = (idx: number, text: string) => {
    if (aiEditingIndex() === idx) {
      setAiEditingIndex(null);
    } else {
      setAiEditingIndex(idx);
      setAiEditValue(text);
    }
  };

  const handleRecallMessage = (msg: any) => {
    setRecalledMessage(msg);
    const inputEl = document.querySelector("input[placeholder=\"Hỏi tôi bất cứ điều gì...\"]") as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
    }
  };

  const submitRLHFFeedback = async (idx: number, newText: string) => {
    const aiMsg = chat()[idx];
    if (!aiMsg || aiMsg.isUser) return;

    // Find the original user query that led to this AI message
    let originalQuery = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (chat()[i].isUser) {
        originalQuery = chat()[i].text;
        break;
      }
    }

    const originalAnswer = aiMsg.text;

    // Optimistically update UI
    const updatedMsg = { ...aiMsg, text: newText };
    const nextChat = [...chat()];
    nextChat[idx] = updatedMsg;
    setChat(nextChat);
    setAiEditingIndex(null);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agent_bot_chat", JSON.stringify(nextChat));
      } catch (err) {}
    }

    // Submit to RLHF backend
    try {
      await fetch("/api/agent/rlhf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalQuery,
          originalAnswer,
          correctedAnswer: newText,
        }),
      });
    } catch (err) {
      console.error("Lỗi khi lưu RLHF:", err);
    }
  };

  const submitDpoSelection = async (idx: number, chosenText: string, rejectedText: string) => {
    let originalQuery = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (chat()[i].isUser) {
        originalQuery = chat()[i].text;
        break;
      }
    }

    // Optimistically update UI
    setChat((prev) => {
      const next = [...prev];
      next[idx].text = chosenText;
      delete next[idx].replyB;
      return next;
    });

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agent_bot_chat", JSON.stringify(chat()));
      } catch (err) {}
    }

    try {
      await fetch("/api/agent/dpo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: originalQuery,
          chosen: chosenText,
          rejected: rejectedText,
        }),
      });
    } catch (err) {
      console.error("Lỗi khi lưu DPO:", err);
    }
  };

  const submitEditedMessage = async (idx: number, newText: string) => {
    const historyBefore = chat().slice(0, idx);
    const historyList = historyBefore.map(
      (h) => ({
        role: h.isUser ? "user" : "assistant",
        text: h.text || "",
      }),
    );

    const updatedMsg = { ...chat()[idx], text: newText };
    const nextChat = [...historyBefore, updatedMsg];

    setChat(nextChat);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("agent_bot_chat", JSON.stringify(nextChat));
      } catch (err) {}
    }
    setEditingIndex(null);

    try {
      const endpoint = "/api/agent/chat";
      const aiRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: newText,
          path: window.location.pathname,
          history: historyList,
        }),
      });
      const aiData = await aiRes.json();

      if (aiData.agentName) setAgentName(aiData.agentName);
      if (aiData.agentAvatar) setAgentAvatar(aiData.agentAvatar);
      if (aiData.text && aiData.text.includes("cập nhật") && aiData.text.includes("thành công")) {
        fetchAgentProfile();
      }

      let responseText = aiData.text || aiData.reply || "Cảm ơn bạn! Nếu cần hỗ trợ thêm hãy báo mình nhé.";

      if (aiData.action === "CLEAR_HISTORY") {
        const resetChat = [
          { text: responseText, isUser: false },
        ];
        setChat(resetChat);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("agent_bot_chat", JSON.stringify(resetChat));
          } catch (err) {}
        }
        return;
      }

      const botMsg = { text: responseText, isUser: false, products: aiData.results || [] };
      setChat((prev) => {
        const next = [...prev, botMsg];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("agent_bot_chat", JSON.stringify(next));
          } catch (err) {}
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      const errMsg = { text: "Gặp sự cố kết nối AI, vui lòng thử lại sau.", isUser: false };
      setChat((prev) => [...prev, errMsg]);
    }
  };

  onMount(() => {
    fetchAgentProfile();
    if (typeof window !== "undefined") {
      window.addEventListener("chat_history_updated", () => {
        setChat(getInitialChat());
      });

      // Load persistent chat from server for logged-in users
      const s = session();
      if (s?.data?.user?.id) {
        (window as any).__rottra_session = s;
        fetch("/api/agent/chat-history", { credentials: "include" }).then((r) => r.json()).then((data) => {
          if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
            const serverChat = data.messages.map((m: any) => ({ text: m.content, isUser: m.role === "user" }));
            const localChat = getInitialChat();
            if (serverChat.length > localChat.length) {
              setChat(serverChat);
              localStorage.setItem("agent_bot_chat", JSON.stringify(serverChat));
            }
          }
        }).catch(() => {});
      }
    }
  });

  let messagesContainer: any;
  const [showScrollDown, setShowScrollDown] = createSignal(false);

  const handleScroll = () => {
    if (!messagesContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 50);
  };

  const scrollToBottom = () => {
    if (messagesContainer) {
      messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
    }
  };

  createEffect(() => {
    chat();
    setTimeout(scrollToBottom, 100);
  });

  // Auto-sync chat to server for logged-in users
  createEffect(() => {
    const c = chat();
    const s = session();
    if (s?.data?.user?.id && c.length > 0) {
      syncChatToServer(c);
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_bot_chat", JSON.stringify(chat()));
      syncUserPreferences({ chatHistory: chat() });
    }
  });

  createEffect(() => {
    const messages = chat();
    const currentLen = messages.length;
    if (currentLen > lastSpokenIndex() + 1) {
      const newMessages = messages.slice(lastSpokenIndex() + 1);
      newMessages.forEach((msg: any) => {
        if (!msg.isUser && !msg.silent && msg.text) speakText(msg.text);
      });
      setLastSpokenIndex(currentLen - 1);
    }
  });

  createEffect(() => {
    if (typeof window === "undefined" || isProductDataChecked) return;
    if (role() !== "admin") return;
    const checkMissingData = async () => {
      try {
        isProductDataChecked = true;
        const res = await fetch("/api/product");
        const data = await res.json();
        const products = data.product || data.products || [];
        if (products.length === 0) return;
        const hasMissing = products.some(
          (p: any) => !p.category || p.category === "N/A" || !p.brand || p.brand === "N/A" || !p.sku || p.sku === "N/A",
        );
        if (hasMissing) {
          const warnMsg = "⚠️ Mình phát hiện trong dữ liệu có sản phẩm đang bị thiếu thông tin (N/A). Bạn nhớ cập nhật đầy đủ danh mục, thuộc tính... để hệ thống hoàn thiện nhé! 🛠️";
          setChat((prev) => {
            if (!prev.some((m) => m.text === warnMsg)) {
              return [...prev, { text: warnMsg, isUser: false, silent: true }];
            }
            return prev;
          });
        }
      } catch (e) {}
    };
    setTimeout(checkMissingData, 3000);
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const query = inputValue().trim();
    const fileToUpload = attachedFile();
    if (!query && !fileToUpload) return;
    setIsLoading(true);

    const actualQuery = query || (fileToUpload ? `Gửi file: ${fileToUpload.name}` : "");
    const recalled = recalledMessage();
    const userMsg = {
      text: actualQuery,
      isUser: true,
      file: fileToUpload,
      recalledMsg: recalled ? { text: recalled.text } : null,
    };
    setChat((prev) => {
      const next = [...prev, userMsg];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("agent_bot_chat", JSON.stringify(next));
        } catch (err) {}
      }
      return next;
    });
    setInputValue("");
    setAttachedFile(null);
    setRecalledMessage(null);
    setAiSuggestions([]);
    setSuggestionMap({});
    setActiveSugIndex(0);

    setTimeout(async () => {
      let currentBotText = "";
      try {
        const historyList = chat().map(
          (h) => ({
            role: h.isUser ? "user" : "assistant",
            content: h.text || "",
          }),
        );

        const apiQuery = recalled ? `[Nhắc lại tin nhắn cũ: "${recalled.text}"] ${actualQuery}` : actualQuery;

        if (historyList.length > 0) {
          historyList[historyList.length - 1].content = apiQuery;
        }

        let fileUrl = "";
        if (fileToUpload && fileToUpload.file) {
          try {
            const formData = new FormData();
            formData.append("file", fileToUpload.file);
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.success) {
                fileUrl = uploadData.url;
              }
            }
          } catch (uploadErr) {
            console.error("Lỗi upload file đính kèm:", uploadErr);
          }
        }

        const endpoint = "/api/chat";
        const aiRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyList,
            lang: currentLang(),
          }),
        });

        if (!aiRes.ok) throw new Error("Network response was not ok");
        if (!aiRes.body) throw new Error("No response body");

        const reader = aiRes.body.getReader();
        const decoder = new TextDecoder();

        setChat((prev) => [...prev, { text: "", isUser: false }]);

        let foundVideoUrl = "";
        let foundSuggestions: string[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("agent_bot_chat", JSON.stringify(chat()));
              } catch (err) {}
            }
            renderMermaidDiagrams();
            renderTypstDiagrams();

            // AI tư duy ngữ cảnh: gợi ý câu hỏi tiếp theo dựa trên hội thoại
            const currentChat = chat();
            const recentHistory = currentChat.slice(-6).map((m) => m.text || "");
            fetch("/api/agent/suggest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: "", role: role(), history: recentHistory }),
            }).then((r) => r.json()).then((data) => {
              if (data.success && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                setAiSuggestions(data.suggestions);
              }
            }).catch(() => {});

            break;
          }

          currentBotText += decoder.decode(value, { stream: true });

          let cleanBotText = currentBotText;
          const match = currentBotText.match(/\[VIDEO_URL:([^\]]+)\]/);
          if (match) {
            foundVideoUrl = match[1];
            cleanBotText = currentBotText.replace(/\[VIDEO_URL:([^\]]+)\]/g, "").trim();
          }

          let foundSuggestions: string[] = [];
          const sugMatch = currentBotText.match(/\[SUGGESTIONS:([\s\S]*?)\]/);
          if (sugMatch) {
            try {
              foundSuggestions = JSON.parse(sugMatch[1]);
            } catch (e) {}
            cleanBotText = cleanBotText.replace(/\[SUGGESTIONS:[\s\S]*?\]/g, "").trim();
          }

          const proactiveMatch = currentBotText.match(/\[PROACTIVE:([\s\S]*?)\]/);
          if (proactiveMatch) {
            try {
              const parsedProactive = JSON.parse(proactiveMatch[1]);
              foundSuggestions = [...foundSuggestions, ...parsedProactive];
            } catch (e) {}
            cleanBotText = cleanBotText.replace(/\[PROACTIVE:[\s\S]*?\]/g, "").trim();
          }

          let foundReplyB = "";
          const replyBMatch = currentBotText.match(/\[REPLY_B:(.*?)\]/);
          if (replyBMatch) {
            try {
              foundReplyB = JSON.parse(replyBMatch[1]);
            } catch (e) {}
            cleanBotText = cleanBotText.replace(/\[REPLY_B:.*?\]/g, "").trim();
          }

          let foundProducts: any[] = [];
          const prodMatch = currentBotText.match(/\[PRODUCTS_START\]([\s\S]*?)\[PRODUCTS_END\]/);
          if (prodMatch) {
            try {
              foundProducts = JSON.parse(prodMatch[1]);
            } catch (e) {}
            cleanBotText = cleanBotText.replace(/\[PRODUCTS_START\][\s\S]*?\[PRODUCTS_END\]/g, "").trim();
          }

          let isFallbackMode = false;
          if (cleanBotText.includes("[FALLBACK_MODE]")) {
            isFallbackMode = true;
            cleanBotText = cleanBotText.replace(/\[FALLBACK_MODE\]/g, "").trim();
          }

          const finalIdx = chat().length - 1;
          setChat((prev) => {
            const next = [...prev];
            next[next.length - 1].text = cleanBotText;
            next[next.length - 1].isFallbackMode = isFallbackMode;
            if (foundVideoUrl) {
              next[next.length - 1].videoUrl = foundVideoUrl;
            }
            if (foundReplyB) {
              next[next.length - 1].replyB = foundReplyB;
            }
            if (foundProducts && foundProducts.length > 0) {
              next[next.length - 1].products = foundProducts;
            }
            return next;
          });

          if (foundSuggestions.length > 0) {
            setSuggestionMap((prev) => ({ ...prev, [finalIdx]: foundSuggestions }));
          }
        }
      } catch (e) {
        console.error("AI Error:", e);
        const hasPartialText = currentBotText.trim().length > 0;
        if (hasPartialText) {
          let cleanBotText = currentBotText;
          let isFallbackMode = false;
          let foundVideoUrl = "";
          let foundSuggestions: string[] = [];

          const match = currentBotText.match(/\[VIDEO_URL:([^\]]+)\]/);
          if (match) {
            foundVideoUrl = match[1];
            cleanBotText = currentBotText.replace(/\[VIDEO_URL:([^\]]+)\]/g, "").trim();
          }

          const sugMatch = currentBotText.match(/\[SUGGESTIONS:([^\]]+)\]/);
          if (sugMatch) {
            try {
              foundSuggestions = JSON.parse(sugMatch[1]);
            } catch (_) {}
            cleanBotText = cleanBotText.replace(/\[SUGGESTIONS:[^\]]+\]/g, "").trim();
          }

          if (cleanBotText.includes("[FALLBACK_MODE]")) {
            isFallbackMode = true;
            cleanBotText = cleanBotText.replace(/\[FALLBACK_MODE\]/g, "").trim();
          }

          const warnMsg = "\n\n⚠️ *[Chế độ Ngoại tuyến / Hạn chế]: Kết nối gián đoạn. Hiển thị phản hồi từ mô hình Offline/Heuristic cục bộ.*";
          setChat((prev) => {
            const next = [...prev];
            if (next.length > 0 && !next[next.length - 1].isUser) {
              next[next.length - 1].text = cleanBotText + warnMsg;
              next[next.length - 1].isFallbackMode = isFallbackMode;
              next[next.length - 1].isLimitedMode = true;
              if (foundVideoUrl) {
                next[next.length - 1].videoUrl = foundVideoUrl;
              }
            }
            return next;
          });
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("agent_bot_chat", JSON.stringify(chat()));
            } catch (err) {}
          }
        } else {
          const errMsg = { text: "Gặp sự cố kết nối AI, vui lòng thử lại sau.", isUser: false };
          setChat((prev) => {
            const next = [...prev, errMsg];
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("agent_bot_chat", JSON.stringify(next));
              } catch (err) {}
            }
            return next;
          });
        }
      }
      setIsLoading(false);
    }, 500);
  };

  const getAgentInitial = () => displayAgentName().charAt(0);

  const getMuteTitle = () => isMuted() ? "Bật âm thanh" : "Tắt âm thanh";

  const getUnloadBtnText = () => isUnloading() ? "Đang giải phóng..." : "Dọn dẹp RAM / Giải phóng VRAM";

  const triggerFileUpload = () => {
    const el = document.getElementById("bot-file-upload");
    if (el) el.click();
  };

  const handleEditClick = (idx: number, text: string | undefined) => {
    handleEditMessage(idx, text || "");
  };

  const renderProductCarousel = (msg: any) => {
    if (!msg.products || msg.products.length === 0) return null;

    const formatCurrency = (val: number) => {
      return val.toLocaleString("vi-VN") + " ₫";
    };

    const isLoggedIn = () => !!session()?.data?.user;

    const handleAddToCart = (p: any) => {
      const pid = p.id || p._id;
      if (!pid) return;
      const cart = [...cartItems()];
      const existing = cart.find((i: any) => i.goods === pid);
      if (existing) {
        existing.quantity++;
      } else {
        cart.push({ goods: pid, quantity: 1, item: p });
      }
      updateCart(cart, isLoggedIn());
      alert(`Đã thêm ${p.name} vào giỏ hàng! 🛒`);

      // GỬI PHẦN THƯỞNG CHO RL ENGINE (Q-Learning)
      fetch("/api/rpc/rl/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateHash: msg.stateHash || "global_user_context",
          actionId: pid,
          reward: 10, // Thưởng lớn cho chốt đơn
        }),
      }).catch(() => {});
    };

    return <tsx>
      <div class="flex flex-col gap-2 mt-4 w-full select-none">
        <div class="relative w-full flex items-center">
          <div
            class="w-full flex gap-4 overflow-x-auto scrollbar-hide py-2 px-1 scroll-smooth"
            style="scroll-snap-type: x mandatory; -ms-overflow-style: none; scrollbar-width: none;">
            {msg.products.map((p: any) => {
              const imgUrl = getPrimaryImage(p);
              return <div
                class="flex-shrink-0 w-[220px] bg-white dark:bg-zinc-900 rounded-2xl border border-gray-150 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                style="scroll-snap-align: start;">
                <div class="aspect-[4/3] w-full bg-gray-50 dark:bg-zinc-800 relative">
                  <img src={imgUrl} alt={p.name} class="w-full h-full object-cover" loading="lazy" />
                </div>
                <div class="p-3 flex flex-col gap-1 text-left flex-grow justify-between">
                  <div>
                    <h4 class="font-bold text-[12px] text-gray-800 dark:text-zinc-100 line-clamp-1">
                      {p.name}
                    </h4>
                    <div class="text-[10px] text-gray-500 dark:text-zinc-400 font-medium mt-0.5 line-clamp-2">
                      {p.description || "Nông sản chất lượng cao từ hệ sinh thái Rottra."}
                    </div>
                  </div>
                  <div class="mt-2.5">
                    <div class="text-blue-600 dark:text-blue-400 font-bold text-xs">
                      {formatCurrency(Number(p.price))}
                    </div>
                    <button
                      onClick={() => handleAddToCart(p)}
                      class="mt-2 w-full py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer">
                      <Icon path={shoppingCart} class="w-3 h-3 animate-pulse" />
                      <span>Mua ngay</span>
                    </button>
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </tsx>;
  };

  const renderMessageContent = (msg: any) => {
    const msgText = msg.text || "";
    if (msgText === "" && !msg.isUser) {
      return <tsx>
        <div class="flex gap-1.5 py-1 px-1 items-center h-[24px]">
          <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms" />
          <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms" />
          <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms" />
        </div>
      </tsx>;
    }
    if (msgText.includes("┌") || msgText.includes("┤") || msgText.includes("┼")) {
      return <tsx><pre class={getPreBlockClass()}>{msgText}</pre></tsx>;
    }

    // Parse Chain of Thought <think> blocks
    let thoughtProcess = "";
    let finalAnswer = msgText;

    if (msgText.includes("<think>")) {
      const parts = msgText.split("</think>");
      if (parts.length > 1) {
        thoughtProcess = parts[0].replace("<think>", "").trim();
        finalAnswer = parts.slice(1).join("</think>").trim();
      } else {
        thoughtProcess = msgText.replace("<think>", "").trim();
        finalAnswer = "";
      }
    }

    return <tsx>
      <div class="flex flex-col gap-3">
        {thoughtProcess
          ? <details
              class="group bg-black/5 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden text-sm mb-2">
              <summary
                class="px-4 py-2 cursor-pointer font-semibold text-gray-600 dark:text-gray-400 select-none hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center outline-none">
                <span class="mr-2 opacity-70">🧠</span>
                Quá trình suy luận (Chain of Thought)
              </summary>
              <div
                class="p-4 pt-3 text-gray-500 dark:text-gray-400 italic text-[13px] leading-relaxed border-t border-gray-200 dark:border-white/10 bg-black/5 dark:bg-black/20"
                innerHTML={formatMarkdown(thoughtProcess)}></div>
            </details>
          : null}
        {finalAnswer ? <div class="leading-relaxed text-left break-words" innerHTML={formatMarkdown(finalAnswer)}></div> : null}
        {renderProductCarousel(msg)}
      </div>
    </tsx>;
  };

  const handleMessageRef = (el: HTMLDivElement) => {
    if (!el) return;
    setTimeout(() => {
      if (typeof window !== "undefined" && (window as any).renderMathInElement) {
        const origWarn = console.warn;
        console.warn = (...args: any[]) => {
          if (args[0] && typeof args[0] === "string" && args[0].includes("No character metrics for")) return;
          origWarn(...args);
        };
        try {
          (window as any).renderMathInElement(el, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
            strict: false,
          });
        } finally {
          console.warn = origWarn;
        }
      }
    }, 50);
  };

  const handleQuickCmdClick = (cmd: string) => {
    let textToSet = cmd;
    if (cmd === "/gan-anh") textToSet = "/gan-anh ";
    else if (cmd === "/cap-ca-nhan") textToSet = "/cap-ca-nhan ";
    else if (cmd === "/day") textToSet = "/day ";
    else if (cmd === "Cập nhật avatar của trợ lý") textToSet = "Cập nhật avatar ";

    setInputValue(textToSet);
    if (textareaRef) {
      textareaRef.value = textToSet;
      textareaRef.focus();
      textareaRef.style.height = "auto";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
    }
  };

  const handleConfirmClearHistory = () => {
    setShowClearConfirm(false);
    const initial = [
      { text: "Đã dọn dẹp bộ nhớ! Mình có thể giúp gì tiếp cho Sếp? 😊", isUser: false },
    ];
    setChat(initial);
    setLastSpokenIndex(0);
    if (typeof window !== "undefined") {
      localStorage.setItem("agent_bot_chat", JSON.stringify(initial));
      syncUserPreferences({ chatHistory: initial });
    }
  };

  const handleEditInputKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitEditedMessage(idx, editValue());
    }
  };

  const getSidebarClass = () => `flex flex-col shrink-0 transition-all duration-300 overflow-hidden border h-full absolute lg:static z-[60] lg:z-auto left-4 ${
    isSidebarOpen() ? "w-[calc(100vw-32px)] md:w-80 p-5 shadow-2xl lg:shadow-sm" : "w-0 p-0 border-none opacity-0"
  } ${
    theme() === "dark"
      ? "bg-[#1f1f1d]/95 backdrop-blur-md lg:bg-[#1f1f1d] border-white/10 rounded-3xl"
      : "bg-white/95 backdrop-blur-md lg:bg-white border-gray-200 rounded-3xl shadow-sm"
  }`;

  const getAgentTitleClass = () => `text-lg font-black mt-3 ${theme() === "dark" ? "text-white" : "text-gray-900"}`;

  const getCmdLabelClass = () => `text-[10px] font-bold uppercase tracking-widest ${
    theme() === "dark" ? "text-gray-450" : "text-gray-500"
  }`;

  const getQuickCmdBtnClass = () => `w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer ${
    theme() === "dark"
      ? "bg-[#282826] border-white/5 text-gray-300 hover:bg-blue-600/10 hover:border-blue-500/30 hover:text-blue-400"
      : "bg-gray-50 border-gray-150 text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 shadow-sm"
  }`;

  const getUnloadBtnClass = () => `w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
    theme() === "dark"
      ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400"
      : "bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800 shadow-sm"
  }`;

  const getClearHistoryBtnClass = () => `w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
    theme() === "dark"
      ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
      : "bg-red-50 border-red-200 hover:bg-red-100 text-red-800 shadow-sm"
  }`;

  const getChatContainerClass = () => `flex-1 flex flex-col rounded-3xl border overflow-hidden h-full ${
    theme() === "dark" ? "bg-[#181816] border-white/5" : "bg-[#fbfbf9] border-gray-150 shadow-sm"
  }`;

  const getMessagesBodyClass = () => `flex-1 p-6 space-y-6 overflow-y-auto ${theme() === "dark" ? "bg-[#131313]/30" : "bg-[#f5f5f2]/20"}`;

  const getMsgRowClass = (isUser: boolean) => `flex group relative w-full ${isUser ? "justify-end" : "justify-start"}`;

  const getMsgBubbleClass = (
    isUser: boolean,
    isFallbackMode?: boolean,
    isLimitedMode?: boolean,
  ) => `transition-all leading-relaxed text-[15px] ${
    isUser
      ? "px-5 py-3.5 rounded-2xl max-w-[75%] shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-none shadow-blue-500/10"
      : (theme() === "dark"
        ? `text-gray-200 w-full py-4 border-b border-white/5 font-sans ${
            isLimitedMode
              ? "bg-red-500/5 px-4 rounded-xl border border-red-500/10"
              : isFallbackMode
                ? "bg-amber-500/5 px-4 rounded-xl border border-amber-500/10"
                : ""
          }`
        : `text-gray-800 w-full py-4 border-b border-gray-100 font-sans ${
            isLimitedMode
              ? "bg-red-50/50 px-4 rounded-xl border border-red-200"
              : isFallbackMode
                ? "bg-amber-50/50 px-4 rounded-xl border border-amber-200"
                : ""
          }`)
  }`;

  const getPreBlockClass = () => `whitespace-pre font-mono text-[10.5px] leading-relaxed text-left block w-full overflow-x-auto p-4 rounded-xl border ${
    theme() === "dark" ? "bg-black/40 border-white/5 text-gray-300" : "bg-gray-50 border-gray-150 text-gray-800 shadow-inner"
  }`;

  const getConfirmDialogClass = () => `p-6 rounded-2xl max-w-sm border shadow-2xl transition-all duration-300 transform scale-100 ${
    theme() === "dark" ? "bg-zinc-900 border-white/10 text-gray-200" : "bg-white border-gray-200 text-gray-800"
  }`;

  const getCancelBtnClass = () => `px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
    theme() === "dark" ? "border-white/10 hover:bg-white/5 text-gray-400" : "border-gray-200 hover:bg-gray-50 text-gray-600"
  }`;

  const getTextInputFieldClass = () => `w-full border-none outline-none resize-none text-[14.5px] placeholder-gray-450 bg-transparent py-2 px-1 focus:ring-0 ${
    theme() === "dark" ? "text-white" : "text-gray-900"
  }`;

  const getMuteBtnClass = () => `p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer ${
    isMuted() ? "text-red-500 hover:text-red-600" : ""
  }`;

  const getIconSize = () => "w-6 h-6";

  <tsx>
    <div
      class="w-full h-[calc(100dvh-80px)] lg:h-[calc(100vh-120px)] flex gap-0 lg:gap-6 font-sans py-2 px-2 lg:py-4 lg:px-4 overflow-hidden animate-in fade-in duration-500">
      {}
      <div class={getChatContainerClass()}>
        {}
        <div
          class={`px-6 py-3.5 flex justify-between items-center border-b select-none shrink-0 ${
            theme() === "dark" ? "bg-[#181816] border-white/5" : "bg-[#fbfbf9] border-gray-100"
          }`}>
          <span class={`text-xs font-bold uppercase tracking-wider ${theme() === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            {"Hội thoại"}
          </span>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen())}
            class={`p-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center ${
              theme() === "dark" ? "hover:bg-white/5 text-gray-400" : "hover:bg-gray-100 text-gray-600"
            }`}
            title={isSidebarOpen() ? "Thu gọn Sidebar" : "Mở rộng Sidebar"}>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <Show
                when={isSidebarOpen()}
                fallback={<tsx>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7" />
                </tsx>}>
                <tsx>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </tsx>
              </Show>
            </svg>
          </button>
        </div>
        {}
        <div class="relative flex-1 flex flex-col overflow-hidden">
          <div ref={messagesContainer} onScroll={handleScroll} class={getMessagesBodyClass()}>
            {}
            <Show when={chat().length <= 1}>
              <tsx>
                <div
                  class="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 select-none">
                  <div
                    class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/20 mb-6">
                    <span class="text-white font-black text-2xl tracking-tighter">
                      {"R"}
                    </span>
                  </div>
                  <h1 class="text-3xl font-normal font-serif tracking-tight text-gray-900 dark:text-zinc-50 mb-3 leading-tight">
                    {"Xin chào Sếp! Tôi là Trợ lý Rottra."}
                  </h1>
                  <p class="text-[14.5px] leading-relaxed text-gray-550 dark:text-zinc-455 mb-6 max-w-md">
                    {"Tôi có thể giúp Sếp phân tích thuật toán, tính toán khoa học, vẽ biểu đồ hay giải quyết các tác vụ phức tạp khác hôm nay?"}
                  </p>
                  <div class="flex flex-wrap gap-2 w-full">
                    {[
                      { text: "Tính xác suất chọn 3 hạt đậu khác loại từ hộp 10 hạt", icon: "📊" },
                      { text: "Lọc Kalman khử nhiễu cảm biến IoT", icon: "📡" },
                      { text: "Mô hình ARIMA dự báo sản lượng lúa", icon: "🌾" },
                      { text: "Giải bài toán người bán hàng TSP", icon: "🗺️" },
                      { text: "Tìm thông tin giá lúa ST25 hôm nay", icon: "💰" },
                      { text: "Chiến lược kinh doanh mùa vụ", icon: "📈" },
                    ].map(
                      (item) => <button
                        onClick={() => handleQuickCmdClick(item.text)}
                        class={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all duration-200 cursor-pointer ${
                          theme() === "dark"
                            ? "bg-[#282826] border-white/10 text-gray-300 hover:bg-blue-600/15 hover:border-blue-500/30 hover:text-blue-300"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                        }`}>
                        <span>
                          {item.icon}
                        </span>
                        <span class="truncate max-w-[200px]">
                          {item.text}
                        </span>
                      </button>,
                    )}
                  </div>
                  <Show when={chat().length > 0 && suggestionMap()[chat().length - 1]}>
                    <div class="flex flex-wrap gap-2 mt-3 ml-1">
                      {suggestionMap()[chat().length - 1].map(
                        (sug: string) => <button
                          onClick={() => {
                            setInputValue(sug);
                            if (textareaRef) {
                              textareaRef.value = sug;
                              textareaRef.focus();
                              textareaRef.style.height = "auto";
                              textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
                            }
                          }}
                          class={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer ${
                            theme() === "dark"
                              ? "bg-[#282826] border-white/10 text-gray-300 hover:bg-blue-600/15 hover:border-blue-500/30 hover:text-blue-300"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                          }`}>
                          <span class="text-blue-500">✦</span>
                          <span class="truncate max-w-[200px]">{sug}</span>
                        </button>,
                      )}
                    </div>
                  </Show>
                </div>
              </tsx>
            </Show>
            {chat().map(
              (msg, idx) => <tsx>
                <div class={getMsgRowClass(msg.isUser)}>
                  {!msg.isUser
                    ? <tsx>
                        <div class="flex flex-col w-full font-sans group/ai">
                          <div
                            class="text-[11px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5 uppercase select-none">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            {"Trợ lý Rottra"}
                            <button
                              onClick={() => handleAiEditMessage(idx, msg.text)}
                              class="opacity-0 group-hover/ai:opacity-100 ml-2 p-1 hover:bg-zinc-800/10 dark:hover:bg-white/10 rounded text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                              title="Chỉnh sửa AI (RLHF)">
                              <Icon path={pencil} class="w-3.5 h-3.5" />
                            </button>
                            <Show when={msg.isFallbackMode}>
                              <span
                                class="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold normal-case">
                                {"Ngoại tuyến"}
                              </span>
                            </Show>
                            <Show when={msg.isLimitedMode}>
                              <span
                                class="ml-2 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-bold normal-case animate-pulse">
                                {"Kết nối giới hạn"}
                              </span>
                            </Show>
                          </div>
                          <div ref={handleMessageRef} class={getMsgBubbleClass(msg.isUser, msg.isFallbackMode, msg.isLimitedMode)}>
                            <Show when={msg.recalledMsg}>
                              <div
                                class="mb-2.5 p-2.5 rounded-xl bg-black/15 dark:bg-white/5 border-l-2 border-blue-400 text-xs text-blue-100 dark:text-gray-300 max-w-full truncate italic select-none">
                                <span class="font-bold text-blue-300 dark:text-blue-400 not-italic block mb-0.5">
                                  {"Nhắc lại:"}
                                </span>
                                {msg.recalledMsg.text}
                              </div>
                            </Show>
                            {aiEditingIndex() === idx
                              ? <tsx>
                                  <div class="flex flex-col w-full min-w-[300px] gap-2">
                                    <textarea
                                      value={aiEditValue()}
                                      onInput={(e) => setAiEditValue(e.currentTarget.value)}
                                      class="w-full min-h-[100px] p-3 border border-blue-500/30 bg-black/25 text-white placeholder-white/40 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    />
                                    <Show when={aiEditValue() !== msg.text}>
                                      <div
                                        class="p-3 bg-white/5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-sans border border-white/10 mt-2">
                                        <div class="text-[10px] text-gray-400 font-bold mb-2 uppercase">
                                          {"Bản xem trước thay đổi (Diff)"}
                                        </div>
                                        {Diff.diffWordsWithSpace(msg.text, aiEditValue()).map((part) => {
                                          if (part.added) return <ins class="text-blue-400 no-underline bg-blue-500/10 rounded px-0.5">
                                            {part.value}
                                          </ins>;
                                          if (part.removed) return <del class="text-red-400 line-through bg-red-500/10 rounded px-0.5">
                                            {part.value}
                                          </del>;
                                          return <span>
                                            {part.value}
                                          </span>;
                                        })}
                                      </div>
                                    </Show>
                                    <div class="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={() => submitRLHFFeedback(idx, aiEditValue())}
                                        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer">
                                        {"Chấp nhận"}
                                      </button>
                                      <button
                                        onClick={() => setAiEditingIndex(null)}
                                        class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer">
                                        {"Hoàn tác"}
                                      </button>
                                    </div>
                                  </div>
                                </tsx>
                              : <tsx>
                                  <Show when={msg.replyB} fallback={renderMessageContent(msg)}>
                                    <div class="flex flex-col gap-4 mt-2 mb-2 w-full max-w-[800px]">
                                      <div
                                        class={`text-[10.5px] font-bold uppercase text-center tracking-widest py-1.5 rounded-lg border shadow-sm ${
                                          theme() === "dark"
                                            ? "text-white bg-white/10 border-white/20"
                                            : "text-blue-900 bg-blue-50 border-blue-200"
                                        }`}>DPO - Chọn phương án hiệu quả hơn</div>
                                      <div class="flex flex-col sm:flex-row gap-4">
                                        <div
                                          class={`flex-1 flex flex-col gap-3 p-4 rounded-2xl relative group/dpo transition-all border ${
                                            theme() === "dark"
                                              ? "bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20"
                                              : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                                          }`}>
                                          <div
                                            class="absolute -top-2.5 left-4 px-2 py-0.5 bg-blue-600 text-[9px] font-bold rounded text-white shadow-md">Phương án A</div>
                                          <div
                                            class={`text-sm pt-1 leading-relaxed whitespace-pre-wrap ${
                                              theme() === "dark" ? "text-gray-300" : "text-gray-800"
                                            }`}>
                                            {msg.text}
                                          </div>
                                          <button
                                            onClick={() => submitDpoSelection(idx, msg.text, msg.replyB)}
                                            class="mt-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all self-center w-full cursor-pointer">👍 Giữ câu này</button>
                                        </div>
                                        <div
                                          class={`flex-1 flex flex-col gap-3 p-4 rounded-2xl relative group/dpo transition-all border ${
                                            theme() === "dark"
                                              ? "bg-purple-900/10 border-purple-500/30 hover:bg-purple-900/20"
                                              : "bg-purple-50 border-purple-200 hover:bg-purple-100"
                                          }`}>
                                          <div
                                            class="absolute -top-2.5 left-4 px-2 py-0.5 bg-purple-600 text-[9px] font-bold rounded text-white shadow-md">Phương án B</div>
                                          <div
                                            class={`text-sm pt-1 leading-relaxed whitespace-pre-wrap ${
                                              theme() === "dark" ? "text-gray-300" : "text-gray-800"
                                            }`}>
                                            {msg.replyB}
                                          </div>
                                          <button
                                            onClick={() => submitDpoSelection(idx, msg.replyB, msg.text)}
                                            class="mt-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all self-center w-full cursor-pointer">👍 Giữ câu này</button>
                                        </div>
                                      </div>
                                    </div>
                                  </Show>
                                  <Show when={msg.file}>
                                    <div
                                      class="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-white/10 dark:border-black/20 shadow-md">
                                      <Show
                                        when={msg.file.type === "image"}
                                        fallback={<tsx>
                                          <video src={msg.file.link} controls class="w-full rounded-xl" />
                                        </tsx>}>
                                        <img src={msg.file.link} alt="Attached image" class="w-full object-cover rounded-xl" />
                                      </Show>
                                    </div>
                                  </Show>
                                  <Show when={msg.videoUrl}>
                                    <div class="mt-2 rounded-lg overflow-hidden border border-gray-100 shadow-sm relative">
                                      <video src={msg.videoUrl} controls class="w-full rounded-lg" />
                                      <a
                                        href={msg.videoUrl}
                                        download
                                        class="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-700 shadow-md">Tải về</a>
                                    </div>
                                  </Show>
                                </tsx>}
                          </div>
                          {}
                          <div class="flex items-center gap-1 mt-1 opacity-0 group-hover/ai:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => copyToClipboard(msg.text, idx)}
                              class={`p-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                copiedIdx() === idx
                                  ? "text-green-500 bg-green-500/10"
                                  : "text-gray-400 hover:text-blue-500 hover:bg-blue-500/10"
                              }`}
                              title={copiedIdx() === idx ? "Đã copy!" : "Copy tin nhắn"}>
                              {copiedIdx() === idx ? "✓" : "📋"}
                            </button>
                            <button
                              onClick={() => submitFeedback(idx, chat()[Math.max(0, idx - 1)]?.text || "", "up")}
                              class={`p-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                feedbackMap()[idx] === "up"
                                  ? "text-green-500 bg-green-500/10"
                                  : "text-gray-400 hover:text-green-500 hover:bg-green-500/10"
                              }`}
                              title="Tốt">👍</button>
                            <button
                              onClick={() => submitFeedback(idx, chat()[Math.max(0, idx - 1)]?.text || "", "down")}
                              class={`p-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                feedbackMap()[idx] === "down"
                                  ? "text-red-500 bg-red-500/10"
                                  : "text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                              }`}
                              title="Cần cải thiện">👎</button>
                          </div>
                          <Show when={suggestionMap()[idx]}>
                            <div class="flex flex-wrap gap-2 mt-3 ml-1 select-none">
                              {suggestionMap()[idx].map(
                                (sug: string) => <button
                                  onClick={() => {
                                    setInputValue(sug);
                                    if (textareaRef) {
                                      textareaRef.value = sug;
                                      textareaRef.focus();
                                      textareaRef.style.height = "auto";
                                      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
                                    }
                                  }}
                                  class={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer ${
                                    theme() === "dark"
                                      ? "bg-[#282826] border-white/10 text-gray-300 hover:bg-blue-600/15 hover:border-blue-500/30 hover:text-blue-300"
                                      : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                                  }`}>
                                  <span class="text-blue-500">✦</span>
                                  <span class="truncate max-w-[200px]">{sug}</span>
                                </button>,
                              )}
                            </div>
                          </Show>
                        </div>
                      </tsx>
                    : <tsx>
                        <div class="flex flex-col items-end w-full group font-sans">
                          <div class="flex items-center gap-1.5 mb-1">
                            <div
                              class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-2 self-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 select-none">
                              <button
                                onClick={() => handleEditClick(idx, msg.text)}
                                class="p-1 hover:bg-zinc-800/10 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                                title="Chỉnh sửa">
                                <Icon path={pencil} class="w-3.5 h-3.5" />
                              </button>
                              <span class="opacity-30">
                                {"|"}
                              </span>
                              <button onClick={() => handleRecallMessage(msg)} class="hover:text-blue-500 transition-colors cursor-pointer">
                                {"Nhắc lại"}
                              </button>
                            </div>
                          </div>
                          <div ref={handleMessageRef} class={getMsgBubbleClass(msg.isUser)}>
                            <Show when={msg.recalledMsg}>
                              <div
                                class="mb-2.5 p-2.5 rounded-xl bg-black/15 dark:bg-white/5 border-l-2 border-blue-400 text-xs text-blue-100 dark:text-gray-300 max-w-full truncate italic select-none">
                                <span class="font-bold text-blue-300 dark:text-blue-400 not-italic block mb-0.5">
                                  {"Nhắc lại:"}
                                </span>
                                {msg.recalledMsg.text}
                              </div>
                            </Show>
                            {editingIndex() === idx
                              ? <tsx>
                                  <div class="flex items-center gap-1.5 min-w-[200px] w-full">
                                    <input
                                      type="text"
                                      value={editValue()}
                                      onInput={(e) => setEditValue(e.currentTarget.value)}
                                      onKeyDown={(e) => handleEditInputKeyDown(e, idx)}
                                      class="flex-1 p-2 border border-white/20 bg-black/25 text-white placeholder-white/40 rounded-xl text-sm outline-none focus:ring-2 focus:ring-white/10 focus:border-white/40 transition-all"
                                    />
                                    <button
                                      onClick={() => submitEditedMessage(idx, editValue())}
                                      class="px-3.5 py-2 rounded-xl bg-white hover:bg-white/90 text-blue-600 font-bold text-xs shadow-md transition-colors cursor-pointer shrink-0">
                                      {"Lưu"}
                                    </button>
                                  </div>
                                </tsx>
                              : <tsx>
                                  {renderMessageContent(msg)}
                                  <Show when={msg.file}>
                                    <div
                                      class="mt-2 rounded-xl overflow-hidden max-w-[200px] border border-white/10 dark:border-black/20 shadow-md">
                                      <Show
                                        when={msg.file.type === "image"}
                                        fallback={<tsx>
                                          <video src={msg.file.link} controls class="w-full rounded-xl" />
                                        </tsx>}>
                                        <img src={msg.file.link} alt="Attached image" class="w-full object-cover rounded-xl" />
                                      </Show>
                                    </div>
                                  </Show>
                                  <Show when={msg.videoUrl}>
                                    <div class="mt-2 rounded-lg overflow-hidden border border-gray-100 shadow-sm relative">
                                      <video src={msg.videoUrl} controls class="w-full rounded-lg" />
                                      <a
                                        href={msg.videoUrl}
                                        download
                                        class="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold hover:bg-blue-700 shadow-md">Tải về</a>
                                    </div>
                                  </Show>
                                </tsx>}
                          </div>
                        </div>
                      </tsx>}
                </div>
              </tsx>,
            )}
            {}
            <Show when={isLoading()}>
              <div class="flex justify-start mb-3">
                <div class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20">
                  <div class="flex gap-1">
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ "animation-delay": "0ms" }} />
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ "animation-delay": "150ms" }} />
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ "animation-delay": "300ms" }} />
                  </div>
                  <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">Đang suy nghĩ...</span>
                </div>
              </div>
            </Show>
          </div>
          <Show when={showScrollDown()}>
            <button
              onClick={scrollToBottom}
              class="absolute bottom-4 right-4 p-2.5 bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-gray-100 dark:border-white/10 text-blue-600 dark:text-blue-400 animate-bounce cursor-pointer hover:scale-105 transition-transform">
              <Icon path={barsArrowDown} class="w-5 h-5" />
            </button>
          </Show>
          {}
          <Show when={showClearConfirm()}>
            <div class="absolute inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div class={getConfirmDialogClass()}>
                <h3 class="text-sm font-bold flex items-center gap-2 text-red-500 mb-2">
                  {"⚠️ Xác nhận xóa lịch sử"}
                </h3>
                <p class="text-xs leading-relaxed opacity-90 mb-4">
                  {"Sếp có chắc chắn muốn xóa sạch toàn bộ lịch sử cuộc trò chuyện không? Hành động này không thể hoàn tác."}
                </p>
                <div class="flex items-center justify-end gap-2.5">
                  <button onClick={() => setShowClearConfirm(false)} class={getCancelBtnClass()}>
                    {"Hủy bỏ"}
                  </button>
                  <button
                    onClick={handleConfirmClearHistory}
                    class="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-red-500/10 transition-transform active:scale-95">
                    {"Đồng ý xóa"}
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
        {}
        <div class="max-w-3xl mx-auto w-full px-4 lg:px-6 pb-6 pt-2 bg-transparent relative z-10 shrink-0">
          <div class="flex flex-wrap gap-2 items-center mb-2">
            <Show when={attachedFile()}>
              <div
                class="relative w-20 h-20 border border-blue-500/20 rounded-2xl overflow-hidden group shadow-md animate-in zoom-in duration-300">
                <Show
                  when={attachedFile().type === "image"}
                  fallback={<tsx>
                    <div class="w-full h-full bg-zinc-900 flex items-center justify-center text-blue-500">
                      <Icon path={videoCamera} class="w-8 h-8" />
                    </div>
                  </tsx>}>
                  <img src={attachedFile().link} alt="Preview" class="w-full h-full object-cover" />
                </Show>
                <button
                  onClick={() => setAttachedFile(null)}
                  class="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 transition-all"
                  title="Gỡ bỏ">
                  <Icon path={xCircle} class="w-3.5 h-3.5" />
                </button>
              </div>
            </Show>
            <Show when={recalledMessage()}>
              <div
                class="flex items-center gap-2 px-3 py-2 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs text-blue-800 dark:text-blue-200 w-fit animate-in slide-in-from-bottom duration-250 select-none shadow-sm max-w-full">
                <span class="font-bold flex items-center gap-1 shrink-0 text-blue-600 dark:text-blue-400">
                  {"Nhắc lại:"}
                </span>
                <span class="truncate max-w-[180px] italic">
                  "
                  {recalledMessage().text}
                  "
                </span>
                <button
                  type="button"
                  onClick={() => setRecalledMessage(null)}
                  class="hover:text-red-500 ml-1.5 cursor-pointer shrink-0 transition-colors">
                  <Icon path={xCircle} class="w-4 h-4" />
                </button>
              </div>
            </Show>
          </div>
          <form
            class={`relative flex flex-col border transition-all duration-300 rounded-2xl ${
              theme() === "dark"
                ? "bg-[#222220] border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50"
                : "bg-white border-gray-250 shadow-[0_8px_30px_rgb(0,0,0,0.03)] focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50"
            }`}
            onSubmit={handleSubmit}>
            {}
            <div class="w-full pt-3 pl-4 pr-32 relative">
              <div
                class="absolute left-4 right-32 top-3 pointer-events-none select-none whitespace-pre-wrap break-words py-2 px-1 text-[14.5px] font-sans"
                style={{
                  color: "transparent",
                  "font-family": "inherit",
                  "font-size": "14.5px",
                  "line-height": "inherit",
                  "white-space": "pre-wrap",
                  "word-wrap": "break-word",
                }}>
                <span class={theme() === "dark" ? "text-white" : "text-gray-900"}>
                  {inputValue()}
                </span>
                <span class="text-gray-400 dark:text-gray-500">
                  {getGhostText()}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                spellcheck={false}
                placeholder={getGhostText() ? "" : "Hỏi tôi bất cứ điều gì..."}
                class={getTextInputFieldClass() + " bg-transparent relative z-10"}
                style={{
                  color: "transparent",
                  "caret-color": theme() === "dark" ? "#fff" : "#000",
                }}
                value={inputValue()}
                onInput={handleInput}
                onKeyDown={(e) => {
                  const val = inputValue();
                  const ai = aiSuggestions();

                  if (e.key === "Tab") {
                    const ghost = getGhostText();
                    if (ghost) {
                      e.preventDefault();
                      setAiSuggestions([]);

                      const suffixMatch =
                        ghost.match(/\s*\(Tab[^)]*\)$/) || ghost.match(/\s*\(Enter[^)]*\)$/) || ghost.match(/\s*\(Tab:[^)]*\)$/);
                      const suffix =
                        suffixMatch ? ghost.slice(0, -suffixMatch[0].length) : ghost;
                      const newVal = inputValue() + suffix;
                      setInputValue(newVal);
                      if (textareaRef) {
                        textareaRef.value = newVal;
                        textareaRef.style.height = "auto";
                        textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
                      }

                      const shortQuery =
                        newVal.length > 80 ? newVal.slice(0, 80) : newVal;
                      const recentHistory = chat().slice(-6).map((m) => m.text || "");
                      fetch("/api/agent/suggest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: shortQuery, role: role(), history: recentHistory }),
                      }).then((r) => r.json()).then((data) => {
                        if (data.success && Array.isArray(data.suggestions)) {
                          setAiSuggestions(data.suggestions);
                        }
                      }).catch(() => {});
                    } else if ((!val || val.trim().length === 0) && ai.length > 1) {
                      e.preventDefault();
                      setActiveSugIndex((prev) => (prev + 1) % ai.length);
                    }
                  } else if (e.key === "ArrowRight") {
                    if ((!val || val.trim().length === 0) && ai.length > 0) {
                      e.preventDefault();
                      const activeSug = ai[activeSugIndex() % ai.length];
                      setInputValue(activeSug);
                      if (textareaRef) {
                        textareaRef.value = activeSug;
                        textareaRef.style.height = "auto";
                        textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
                      }
                    }
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    if ((!val || val.trim().length === 0) && ai.length > 0) {
                      e.preventDefault();
                      const activeSug = ai[activeSugIndex() % ai.length];
                      setInputValue(activeSug);
                      if (textareaRef) {
                        textareaRef.value = activeSug;
                        textareaRef.style.height = "auto";
                        textareaRef.style.height = Math.min(textareaRef.scrollHeight, 160) + "px";
                      }
                    } else {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }
                }}
                rows={1}
                style={{ "max-height": "160px" }}
              />
              <input type="file" id="bot-file-upload" class="hidden" onChange={handleAttachment} />
            </div>
            {}
            <div class="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-white/5 mt-1 select-none">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer"
                  title="Đính kèm tệp"
                  onClick={triggerFileUpload}>
                  <Icon path={paperClip} class="w-4.5 h-4.5" />
                </button>
                <button
                  type="button"
                  class={`p-2 rounded-xl transition-all cursor-pointer ${
                    isListening()
                      ? "text-red-500 bg-red-500/10 animate-pulse"
                      : "text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                  }`}
                  title={isListening() ? "Đang nghe..." : "Voice chat"}
                  aria-label="Bật mic nói chuyện"
                  onClick={toggleListen}>
                  <Icon path={microphone} class="w-4.5 h-4.5" />
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer"
                  title={getMuteTitle()}
                  aria-label={getMuteTitle()}>
                  <Icon path={isMuted() ? speakerXMark : speakerWave} class="w-4.5 h-4.5" />
                </button>
              </div>
              <button
                type="submit"
                class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-2 rounded-xl shadow-lg shadow-blue-500/10 transition-all active:scale-95 duration-200 hover:-translate-y-0.5 cursor-pointer flex items-center justify-center"
                aria-label="Gửi tin nhắn">
                <Icon path={paperAirplane} class="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
      {}
      <div class={getSidebarClass()}>
        {}
        <div class="mb-5 flex flex-col gap-1 select-none border-b border-gray-150 dark:border-white/5 pb-4 shrink-0">
          <h2 class="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {"Cổng giao tiếp Trợ lý AI"}
          </h2>
          <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">
            {"Chọn lệnh nhanh:"}
          </span>
        </div>
        {}
        <div class="flex-1 flex flex-col gap-2 overflow-hidden">
          <div class="flex-1 overflow-y-auto no-scrollbar flex flex-wrap gap-2 content-start max-h-[300px] lg:max-h-none">
            {getCommandsByRole().map(
              (cmd) => <tsx>
                <button
                  onClick={() => handleQuickCmdClick(cmd)}
                  class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer ${
                    theme() === "dark"
                      ? "bg-[#282826] border-white/10 text-gray-300 hover:bg-blue-600/15 hover:border-blue-500/30 hover:text-blue-300"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                  }`}>
                  <span class="text-blue-500">✦</span>
                  <span class="truncate max-w-[160px]">
                    {getShortCommandName(cmd)}
                  </span>
                </button>
              </tsx>,
            )}
          </div>
        </div>
        {}
        <div class="pt-4 border-t border-gray-200/20 flex flex-col gap-2">
          <Show when={role() === "admin"}>
            <button onClick={() => handleUnloadBrain()} disabled={isUnloading()} class={getUnloadBtnClass()}>
              <Icon path={arrowPath} class="w-4 h-4" />
              {getUnloadBtnText()}
            </button>
          </Show>
          <button onClick={() => setShowClearConfirm(true)} class={getClearHistoryBtnClass()}>
            <Icon path={trash} class="w-4 h-4" />
            {"Xóa lịch sử cuộc trò chuyện"}
          </button>
        </div>
      </div>
      <audio ref={audioRef} onEnded={playNextInQueue} onError={handleAudioError} class="hidden" />
    </div>
  </tsx>
}
