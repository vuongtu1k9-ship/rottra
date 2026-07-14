import { isServer } from "solid-js/web";
import { createLogger } from "~/shared/logger";
import { authClient } from "~/client/utils/auth-client";

const log = createLogger("helpers/user-sync");

let syncTimeout: any = null;
// Profile sync is initially enabled and auto-disables on HTTP failure
let isProfileSyncAvailable = true;

export const syncUserPreferences = async (prefs: Record<string, any>) => {
  if (isServer || !isProfileSyncAvailable) return;

  // Debounce the sync to avoid spamming the server
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    try {
      const session = await authClient.getSession();
      if (!session?.data?.session) return;

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        log.warn("[UserSync] Profile API is not available (static host). Disabling sync.");
        isProfileSyncAvailable = false;
      }
    } catch (e) {
      log.error("Failed to sync user preferences", e);
      isProfileSyncAvailable = false;
    }
  }, 1000);
};

export const fetchUserPreferences = async () => {
  if (isServer || !isProfileSyncAvailable) return null;
  try {
    const session = await authClient.getSession();
    if (!session?.data?.session) return null;

    const res = await fetch("/api/profile");
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const data = await res.json();
      if (data.success && data.profile) {
        return data.profile;
      }
    } else {
      // If it's not JSON or ok, disable profile sync (static SPA fallback)
      isProfileSyncAvailable = false;
    }
  } catch (e) {
    log.error("Failed to fetch user preferences", e);
    isProfileSyncAvailable = false;
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
      } catch (_err) {
        /* non-critical */
      }

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
        log.error("Lỗi khi lưu lịch sử chat vào trình duyệt:", e);
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
