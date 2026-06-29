import { isServer } from "solid-js/web";
import { authClient } from "~/client/utils/auth-client";

let syncTimeout: any = null;

export const syncUserPreferences = async (prefs: Record<string, any>) => {
  if (isServer) return;

  // Debounce the sync to avoid spamming the server
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    try {
      const session = await authClient.getSession();
      if (!session?.data?.session) return;

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch (e) {
      console.error("Failed to sync user preferences", e);
    }
  }, 1000);
};

export const fetchUserPreferences = async () => {
  if (isServer) return null;
  try {
    const session = await authClient.getSession();
    if (!session?.data?.session) return null;

    const res = await fetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profile) {
        return data.profile;
      }
    }
  } catch (e) {
    console.error("Failed to fetch user preferences", e);
  }
  return null;
};

export const loadAndApplyUserPreferences = async () => {
  const prefs = await fetchUserPreferences();
  if (prefs) {
    if (prefs.theme) {
      localStorage.setItem("theme", prefs.theme);
      window.dispatchEvent(new Event("theme_updated"));
    }
    if (prefs.chatHistory) {
      const localChatStr = localStorage.getItem("agent_bot_chat");
      let localChat: any[] = [];
      try {
        if (localChatStr) localChat = JSON.parse(localChatStr);
      } catch (e) {}

      let finalChat = prefs.chatHistory || [];
      if (localChat.length > finalChat.length) {
        // Local chat is more up-to-date or has unsynced messages, preserve it and update the server
        finalChat = localChat;
        syncUserPreferences({ chatHistory: finalChat });
      } else if (localChat.length > 1) {
        // If server has more messages but local chat has some unique guest messages, merge them safely
        const serverChatStrings = new Set(finalChat.map((m: any) => JSON.stringify({ text: m.text, isUser: m.isUser })));
        const guestMessages = localChat.slice(1).filter((m) => !serverChatStrings.has(JSON.stringify({ text: m.text, isUser: m.isUser })));

        if (guestMessages.length > 0) {
          finalChat = [...finalChat, ...guestMessages];
          if (finalChat.length > 200) {
            finalChat = finalChat.slice(finalChat.length - 200);
          }
          syncUserPreferences({ chatHistory: finalChat });
        }
      }

      try {
        localStorage.setItem("agent_bot_chat", JSON.stringify(finalChat));
        window.dispatchEvent(new Event("chat_history_updated"));
      } catch (e: any) {
        console.error("Lỗi khi lưu lịch sử chat vào trình duyệt:", e);
        if (e.name === "QuotaExceededError") {
          localStorage.removeItem("agent_bot_chat");
          localStorage.setItem("agent_bot_chat", JSON.stringify(finalChat.slice(-50))); // Lấy 50 tin nhắn mới nhất
        }
      }
    }
  }
};

export const clearUserPreferencesLocally = () => {
  // Clear chat history on logout to protect privacy
  localStorage.removeItem("agent_bot_chat");
  // We keep the theme so the screen doesn't suddenly flash white/dark, but if user wants we can clear it too.
  // localStorage.removeItem("theme");
  window.dispatchEvent(new Event("chat_history_updated"));
};
