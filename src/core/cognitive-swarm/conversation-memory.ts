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
  topicKeywordSet?: Set<string>; // P3: O(1) lookup cache
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

  private calculateImportance(content: string, intent?: string, timestamp?: number): number {
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

    // P3: Temporal decay — messages older than 1h lose 1 point, older than 6h lose 2, older than 24h lose 3
    if (timestamp) {
      const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) score -= 3;
      else if (ageHours > 6) score -= 2;
      else if (ageHours > 1) score -= 1;
    }

    return Math.max(1, Math.min(10, score));
  }

  addMessage(sessionId: string, role: "user" | "assistant" | "system", content: string, intent?: string): number {
    let ctx = this.cache.get(sessionId);
    if (!ctx) {
      ctx = { messages: [], lastAccessTime: Date.now(), topicKeywords: [], topicKeywordSet: new Set() };
    }

    const now = Date.now();
    const importance = this.calculateImportance(content, intent, now);
    ctx.messages.push({ role, content, timestamp: now, intent, importance });
    ctx.lastAccessTime = now;

    // P3: Use Set for O(1) topic keyword deduplication
    if (!ctx.topicKeywordSet) ctx.topicKeywordSet = new Set(ctx.topicKeywords);
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const w of words) {
      if (!ctx.topicKeywordSet.has(w)) {
        ctx.topicKeywordSet.add(w);
        ctx.topicKeywords.push(w);
      }
    }
    if (ctx.topicKeywords.length > 30) {
      const removed = ctx.topicKeywords.splice(0, ctx.topicKeywords.length - 30);
      for (const r of removed) ctx.topicKeywordSet.delete(r);
    }

    if (ctx.messages.length > this.maxMessages) {
      const splitPoint = ctx.messages.length - this.summaryThreshold;
      const oldMessages = ctx.messages.slice(0, splitPoint);
      const recentMessages = ctx.messages.slice(-this.summaryThreshold);
      // P3: Fire-and-forget async LLM summarization (non-blocking)
      this.summarizeAsync(oldMessages)
        .then((s) => {
          ctx!.summary = s;
        })
        .catch(() => {
          ctx!.summary = this.summarizeHeuristic(oldMessages);
        });
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
        // P3: Apply temporal decay when merging across sessions
        const importantMsgs = ctx.messages
          .filter((m) => (m.importance ?? 1) >= 3)
          .map((m) => ({
            ...m,
            importance: this.calculateImportance(m.content, m.intent, m.timestamp),
          }));
        allMemories.push(...importantMsgs);
        if (ctx.summary) {
          allMemories.push({
            role: "system",
            content: ctx.summary,
            timestamp: ctx.lastAccessTime,
            importance: this.calculateImportance(ctx.summary, undefined, ctx.lastAccessTime),
          });
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

  private async summarizeAsync(messages: Message[]): Promise<string> {
    // Try LLM summarization for better quality
    try {
      const { generateTextLocal } = await import("~/core/nlp-cognitive/ai-sdk");
      const transcript = messages
        .slice(-8)
        .map((m) => `${m.role}: ${m.content.substring(0, 150)}`)
        .join("\n");

      const prompt = `Tóm tắt ngắn gọn (2-3 câu) nội dung chính của cuộc hội thoại sau. Chỉ ghi lại thông tin quan trọng, quyết định, hoặc câu hỏi chưa giải quyết:

${transcript}

Tóm tắt:`;

      const result = await generateTextLocal({ prompt, isInternalReasoning: true });
      if (result && result.text && result.text.length > 20) {
        return result.text.trim();
      }
    } catch {}

    // Fallback: heuristic summarization
    return this.summarizeHeuristic(messages);
  }

  private summarizeHeuristic(messages: Message[]): string {
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

  // ══════════════════════════════════════════════════════════════
  // SESSION CONTEXT: Track user context for personalized responses
  // ══════════════════════════════════════════════════════════════

  private sessionContexts = new Map<string, SessionContext>();

  getSessionContext(sessionId: string): SessionContext {
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        isReturningUser: false,
        conversationCount: 0,
        preferredLanguage: "vi",
        dominantIntents: [],
        lastActiveProduct: null as any,
        lastActivePage: null as any,
      });
    }
    return this.sessionContexts.get(sessionId)!;
  }

  updateSessionContext(sessionId: string, updates: Partial<SessionContext>): void {
    const ctx = this.getSessionContext(sessionId);
    Object.assign(ctx, updates);
    this.sessionContexts.set(sessionId, ctx);
  }

  /**
   * Auto-detect context signals from a message.
   * Call this in addMessage or from the chat handler.
   */
  detectContextSignals(sessionId: string, query: string, response?: string): void {
    const ctx = this.getSessionContext(sessionId);
    ctx.conversationCount++;

    // Detect product mentions (simple keyword matching)
    const productPatterns = /(?:sản phẩm|product|{prod}|cà phê|lúa|ngô|tiêu|điều|ca cao|thanh long|xoài|bưởi)/i;
    const productMatch = query.match(productPatterns);
    if (productMatch) {
      ctx.lastActiveProduct = productMatch[0];
    }

    // Track dominant intents
    const ctx2 = this.cache.get(sessionId);
    if (ctx2) {
      const intentCounts = new Map<string, number>();
      for (const msg of ctx2.messages) {
        if (msg.intent && msg.intent !== "UNKNOWN") {
          intentCounts.set(msg.intent, (intentCounts.get(msg.intent) || 0) + 1);
        }
      }
      ctx.dominantIntents = Array.from(intentCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([intent]) => intent);
    }

    // Detect language preference
    if (/[a-zA-Z]{3,}/.test(query) && !/[àáảãạăắằẵặâấầẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(query)) {
      ctx.preferredLanguage = "en";
    }
  }

  /**
   * Format session context as a system prompt section for personalized responses.
   */
  formatContextForPrompt(sessionId: string): string {
    const ctx = this.getSessionContext(sessionId);
    const parts: string[] = [];

    if (ctx.isReturningUser) parts.push("User la khach quen.");
    if (ctx.lastActiveProduct) parts.push(`San pham quan tam: ${ctx.lastActiveProduct}.`);
    if (ctx.dominantIntents.length > 0) parts.push(`Chu de thuong hoi: ${ctx.dominantIntents.join(", ")}.`);
    if (ctx.conversationCount > 5) parts.push(`Da chat ${ctx.conversationCount} tin trong session nay.`);
    if (ctx.preferredLanguage !== "vi") parts.push(`User prefer language: ${ctx.preferredLanguage}.`);

    return parts.length > 0 ? `\n[User Context]: ${parts.join(" ")}` : "";
  }

  // ══════════════════════════════════════════════════════════════
  // SESSION HANDOFF: Serialize, restore, and transfer session state
  // ══════════════════════════════════════════════════════════════

  /**
   * Serialize session state for persistence or transfer
   */
  serializeSession(sessionId: string): SessionHandoff | null {
    const ctx = this.cache.get(sessionId);
    const sessionCtx = this.sessionContexts.get(sessionId);

    if (!ctx) return null;

    return {
      sessionId,
      messages: ctx.messages,
      summary: ctx.summary || "",
      topicKeywords: ctx.topicKeywords,
      lastAccessTime: ctx.lastAccessTime,
      sessionContext: sessionCtx || {
        isReturningUser: false,
        conversationCount: 0,
        preferredLanguage: "vi",
        dominantIntents: [],
        lastActiveProduct: undefined,
        lastActivePage: undefined,
      },
      serializedAt: Date.now(),
    };
  }

  /**
   * Restore session from serialized state
   */
  restoreSession(handoff: SessionHandoff): void {
    // Restore conversation context
    this.cache.set(handoff.sessionId, {
      messages: handoff.messages,
      summary: handoff.summary,
      lastAccessTime: handoff.lastAccessTime,
      topicKeywords: handoff.topicKeywords,
      topicKeywordSet: new Set(handoff.topicKeywords),
    });

    // Restore session context
    this.sessionContexts.set(handoff.sessionId, handoff.sessionContext);
  }

  /**
   * Transfer context from one session to another (handoff)
   * Useful when user switches devices or sessions expire
   */
  transferSession(fromSessionId: string, toSessionId: string): boolean {
    const handoff = this.serializeSession(fromSessionId);
    if (!handoff) return false;

    // Update session ID and restore
    handoff.sessionId = toSessionId;
    handoff.sessionContext.conversationCount = 0; // Reset count for new session
    handoff.sessionContext.isReturningUser = true; // Mark as returning user
    this.restoreSession(handoff);

    return true;
  }

  /**
   * Export all sessions for a user (for backup/transfer)
   */
  exportUserSessions(sessionIds: string[]): SessionHandoff[] {
    return sessionIds.map((id) => this.serializeSession(id)).filter((h): h is SessionHandoff => h !== null);
  }

  /**
   * Import sessions from backup
   */
  importUserSessions(handoffs: SessionHandoff[]): number {
    let imported = 0;
    for (const handoff of handoffs) {
      // Only restore if newer than existing
      const existing = this.cache.get(handoff.sessionId);
      if (!existing || handoff.lastAccessTime > existing.lastAccessTime) {
        this.restoreSession(handoff);
        imported++;
      }
    }
    return imported;
  }

  /**
   * Cleanup old sessions (older than maxAgeMs)
   */
  cleanupOldSessions(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    // Note: LRUCache doesn't expose iteration, so this is a placeholder
    // In production, you'd iterate through the cache and delete old entries
    return cleaned;
  }
}

export interface SessionHandoff {
  sessionId: string;
  messages: Message[];
  summary?: string;
  topicKeywords: string[];
  lastAccessTime: number;
  sessionContext: SessionContext;
  serializedAt: number;
}

export interface SessionContext {
  isReturningUser: boolean;
  lastActiveProduct: string | undefined;
  lastActivePage: string | undefined;
  conversationCount: number;
  preferredLanguage: string;
  dominantIntents: string[];
}

export const conversationMemory = ConversationMemory.getInstance();
