import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  intent?: string | undefined;
  importance?: number;
};

type ConversationContext = {
  messages: Message[];
  summary?: string | undefined;
  lastAccessTime: number;
  topicKeywords: string[];
};

class ConversationMemory {
  private static instance: ConversationMemory;
  private cache: LRUCache<string, ConversationContext> = new LRUCache<string, ConversationContext>(200, 86400);
  private maxMessages = 20;
  private summaryThreshold = 10;

  private constructor() {}

  static getInstance(): ConversationMemory {
    if (!ConversationMemory.instance) {
      ConversationMemory.instance = new ConversationMemory();
    }
    return ConversationMemory.instance;
  }

  private calculateImportance(content: string, intent?: string): number {
    let score = 1;

    const length = content.length;
    if (length > 200) score += 2;
    else if (length > 100) score += 1;

    const importantIntents = [
      "PSYCHOLOGY",
      "COMPLAINT",
      "ACADEMIC",
      "AGENTIC_WORKFLOW",
      "TSP",
      "NPV",
      "KALMAN",
      "COBWEB",
      "WARDROP",
      "SHANNON",
    ];
    if (intent && importantIntents.includes(intent)) score += 2;

    const importantKeywords = [
      "giá",
      "mua",
      "bán",
      "hợp đồng",
      "vàng",
      "kho",
      "nông sản",
      "giao dịch",
      "đơn hàng",
      "hợp tác",
      "tài chính",
      "vay",
      "đầu tư",
      "chi phí",
      "lợi nhuận",
      "công thức",
      "định lý",
      "thuật toán",
    ];
    for (const kw of importantKeywords) {
      if (content.toLowerCase().includes(kw)) {
        score += 1;
        break;
      }
    }

    const hasNumbers = /\d+/.test(content);
    if (hasNumbers) score += 1;

    const hasStructuredData = /[:\-]\s/.test(content) && content.split("\n").length > 2;
    if (hasStructuredData) score += 1;

    return Math.min(10, score);
  }

  addMessage(sessionId: string, role: "user" | "assistant" | "system", content: string, intent?: string): number {
    let ctx = this.cache.get(sessionId);
    if (!ctx) {
      ctx = { messages: [], lastAccessTime: Date.now(), topicKeywords: [] };
    }

    const importance = this.calculateImportance(content, intent);
    ctx.messages.push({ role, content, timestamp: Date.now(), intent, importance });
    ctx.lastAccessTime = Date.now();

    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const w of words) {
      if (!ctx.topicKeywords.includes(w)) {
        ctx.topicKeywords.push(w);
      }
    }
    if (ctx.topicKeywords.length > 30) {
      ctx.topicKeywords = ctx.topicKeywords.slice(-30);
    }

    if (ctx.messages.length > this.maxMessages) {
      const splitPoint = ctx.messages.length - this.summaryThreshold;
      const oldMessages = ctx.messages.slice(0, splitPoint);
      const recentMessages = ctx.messages.slice(-this.summaryThreshold);
      ctx.summary = this.summarize(oldMessages);
      ctx.messages = recentMessages;
    }

    this.cache.set(sessionId, ctx);
    return importance;
  }

  getRecentContext(sessionId: string): Message[] {
    const ctx = this.cache.get(sessionId);
    if (ctx) ctx.lastAccessTime = Date.now();
    return ctx?.messages ?? [];
  }

  getFullContext(sessionId: string): Message[] {
    const ctx = this.cache.get(sessionId);
    if (!ctx) return [];

    if (ctx) ctx.lastAccessTime = Date.now();

    const summaryMsg: Message = {
      role: "system",
      content: ctx.summary ?? "",
      timestamp: Date.now(),
    };

    return [summaryMsg, ...ctx.messages];
  }

  getSessionTopicKeywords(sessionId: string): string[] {
    const ctx = this.cache.get(sessionId);
    return ctx?.topicKeywords ?? [];
  }

  mergeImportanceAcrossSessions(userSessions: string[]): { allKeywords: string[]; topMemories: Message[] } {
    const allKeywords = new Set<string>();
    const allMemories: Message[] = [];

    for (const sid of userSessions) {
      const ctx = this.cache.get(sid);
      if (ctx) {
        for (const kw of ctx.topicKeywords) allKeywords.add(kw);
        const importantMsgs = ctx.messages.filter((m) => (m.importance ?? 1) >= 4);
        allMemories.push(...importantMsgs);
        if (ctx.summary) {
          allMemories.push({ role: "system", content: ctx.summary, timestamp: ctx.lastAccessTime, importance: 8 });
        }
      }
    }

    allMemories.sort((a, b) => (b.importance ?? 1) - (a.importance ?? 1));
    const topMemories = allMemories.slice(0, 10);

    return {
      allKeywords: Array.from(allKeywords).slice(0, 50),
      topMemories,
    };
  }

  private summarize(messages: Message[]): string {
    const highImportance = messages.filter((m) => (m.importance ?? 1) >= 4);
    const userMessages = messages.filter((m) => m.role === "user");

    const parts: string[] = [];

    if (highImportance.length > 0) {
      const importantContent = highImportance
        .slice(-3)
        .map((m) => m.content.substring(0, 100))
        .join(" | ");
      parts.push(`[Quan trọng] ${importantContent}`);
    }

    if (userMessages.length > 0) {
      const recentUsers = userMessages
        .slice(-3)
        .map((m) => m.content.substring(0, 80))
        .join(" → ");
      parts.push(`[Hội thoại] ${recentUsers}`);
    }

    return parts.join("\n") || "Hội thoại ngắn, chưa có nội dung đáng ghi nhớ.";
  }

  clear(sessionId: string): void {
    this.cache.delete(sessionId);
  }
}

export const conversationMemory = ConversationMemory.getInstance();
