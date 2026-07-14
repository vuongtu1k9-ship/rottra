/**
 * Turing Test — API Router
 */

import { Hono } from "hono";
import { ok, fail } from "~/shared/dtos/response";
import { Deterministic } from "~/shared/utils/rng";
import { Secure } from "~/shared/utils/rng";

export const turingTestApp = new Hono();

// ── In-memory session store ─────────────────────────────────

interface ChatMessage {
  senderId: string;
  content: string;
  timestamp: number;
  role: "human" | "ai" | "judge";
}
interface TuringRound {
  roundNumber: number;
  messages: ChatMessage[];
  verdict: any | null;
  startedAt: number;
  endedAt?: number;
}
interface TuringSession {
  id: string;
  status: string;
  roundNumber: number;
  maxRounds: number;
  participants: { userId: string; role: string; displayName: string }[];
  rounds: TuringRound[];
  createdAt: number;
}

const sessions = new Map<string, TuringSession>();
const leaderboard = new Map<
  string,
  { userId: string; displayName: string; totalScore: number; gamesPlayed: number; roundsWon: number; winStreak: number; bestStreak: number }
>();

// ── Bot Responses (simulated AI personality) ────────────────

const botResponses = [
  "Tôi nghĩ rằng vấn đề này cần được xem xét từ nhiều góc độ khác nhau.",
  "Đó là một câu hỏi hay. Để tôi suy nghĩ về điều này một chút.",
  "Theo kinh nghiệm của tôi, thường thì cách tiếp cận đơn giản nhất là tốt nhất.",
  "Bạn có thể cho tôi thêm chi tiết được không? Tôi muốn hiểu rõ hơn.",
  "Tôi đồng ý với quan điểm đó, nhưng cũng có một vài ngoại lệ đáng chú ý.",
  "Đây là chủ đề tôi rất quan tâm. Có nhiều điều thú vị để thảo luận.",
  "Câu trả lời không đơn giản như vẻ ngoài của nó đâu.",
  "Tôi đã đọc nhiều về vấn đề này và thấy rằng thực tế phức tạp hơn nhiều.",
  "Hãy thử nghĩ theo hướng khác. Có thể có giải pháp mà bạn chưa cân nhắc.",
  "Điều quan trọng là phải dựa trên dữ liệu thực tế, không phải giả định.",
  "Có道理. Tuy nhiên, mình cũng muốn nghe thêm ý kiến của bạn.",
  "Mình không chắc lắm về điều này, nhưng theo mình thì...",
  "Ồ, đây là một chủ đề phức tạp. Mình sẽ cố gắng giải thích đơn giản nhất có thể.",
  "Bạn nghĩ sao về việc áp dụng phương pháp này vào thực tế?",
  "Mình thấy có một số điểm đáng lưu ý ở đây.",
];

// ── Session Management ──────────────────────────────────────

turingTestApp.post("/session/create", async (c) => {
  const body = await c.req.json<{ userId: string; displayName?: string; maxRounds?: number }>();
  const sessionId = `tt_${Secure.uuid().slice(0, 8)}`;
  const session: TuringSession = {
    id: sessionId,
    status: "lobby",
    roundNumber: 0,
    maxRounds: body.maxRounds || 5,
    participants: [{ userId: body.userId, role: "pending", displayName: body.displayName || `Player-${body.userId.slice(0, 4)}` }],
    rounds: [],
    createdAt: Date.now(),
  };
  sessions.set(sessionId, session);
  return c.json(ok({ sessionId, session }));
});

turingTestApp.post("/session/join/:sessionId", async (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  const body = await c.req.json<{ userId: string; displayName?: string }>();

  // Auto-assign roles: first human, second AI judge
  if (session.participants.length === 1) {
    session.participants.push({ userId: body.userId, role: "ai", displayName: "Rottra-Bot" });
    // Add bot as second participant
    session.participants.push({ userId: "bot_ai", role: "ai", displayName: "Rottra-Bot" });
  }

  return c.json(ok({ session }));
});

turingTestApp.get("/session/:sessionId", (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  return c.json(ok(session));
});

turingTestApp.post("/session/:sessionId/start", (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  session.status = "round_active";
  session.roundNumber = 1;
  session.rounds.push({
    roundNumber: 1,
    messages: [],
    verdict: null,
    startedAt: Date.now(),
  });
  return c.json(ok({ roundNumber: 1 }));
});

// ── Chat ────────────────────────────────────────────────────

turingTestApp.post("/session/:sessionId/send", async (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  const body = await c.req.json<{ senderId: string; content: string }>();
  const currentRound = session.rounds[session.rounds.length - 1];
  if (!currentRound) return c.json(fail("No active round"), 400);

  // Add human message
  currentRound.messages.push({
    senderId: body.senderId,
    content: body.content,
    timestamp: Date.now(),
    role: "human",
  });

  // Bot auto-replies after a short delay
  const botReply = Deterministic.pick(botResponses);
  currentRound.messages.push({
    senderId: "bot_ai",
    content: botReply,
    timestamp: Date.now() + 100,
    role: "ai",
  });

  return c.json(ok({ messages: currentRound.messages }));
});

// ── Judging ─────────────────────────────────────────────────

turingTestApp.post("/session/:sessionId/judge", async (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  const body = await c.req.json<{ judgeId: string; humanGuess: string; confidence: number; reasoning: string }>();

  const currentRound = session.rounds[session.rounds.length - 1];
  if (!currentRound) return c.json(fail("No active round"), 400);

  currentRound.verdict = {
    judgeId: body.judgeId,
    humanGuess: body.humanGuess,
    confidence: body.confidence,
    reasoning: body.reasoning,
    roundScore: body.confidence > 0.5 ? 10 : 0,
  };
  currentRound.endedAt = Date.now();

  // Check if more rounds
  if (session.roundNumber < session.maxRounds) {
    session.roundNumber++;
    session.rounds.push({
      roundNumber: session.roundNumber,
      messages: [],
      verdict: null,
      startedAt: Date.now(),
    });
    session.status = "round_active";
  } else {
    session.status = "completed";
  }

  return c.json(ok({ verdict: currentRound.verdict, nextRound: session.roundNumber, status: session.status }));
});

// ── Scores ──────────────────────────────────────────────────

turingTestApp.get("/session/:sessionId/scores", (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);

  const scores = session.participants.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    role: p.role,
    roundsWon: session.rounds.filter((r) => r.verdict?.humanGuess !== p.userId).length,
    totalScore: session.rounds.reduce((s, r) => s + (r.verdict?.roundScore || 0), 0),
  }));

  return c.json(ok(scores));
});

// ── Leaderboard ─────────────────────────────────────────────

turingTestApp.get("/leaderboard", (c) => {
  const entries = [...leaderboard.values()].sort((a, b) => b.totalScore - a.totalScore).slice(0, 20);
  return c.json(ok(entries));
});

turingTestApp.get("/history", (c) => {
  const allSessions = [...sessions.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  return c.json(ok(allSessions.map((s) => ({ id: s.id, status: s.status, rounds: s.roundNumber, createdAt: s.createdAt }))));
});

turingTestApp.get("/history/:sessionId", (c) => {
  const session = sessions.get(c.req.param("sessionId"));
  if (!session) return c.json(fail("Session not found"), 404);
  return c.json(ok(session));
});
