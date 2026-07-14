import { Hono } from "hono";

export const chatApp = new Hono();

/**
 * SSE Event Types:
 * - thinking: AI reasoning/thought process
 * - token: Streamed text token
 * - suggestions: Follow-up suggestions
 * - products: Product search results
 * - proactive: Context-aware suggestions
 * - reply_b: Alternative reply
 * - error: Error message
 * - done: Stream complete
 */

interface SSEEvent {
  type: "thinking" | "token" | "suggestions" | "products" | "proactive" | "reply_b" | "error" | "done";
  data: string;
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

chatApp.post("/", async (c) => {
  try {
    let bodyData: any = {};
    try {
      bodyData = await c.req.json();
    } catch (e: any) {
      console.warn("Unable to parse JSON body of chat request:", e.message);
    }
    const messages = bodyData.messages || [];
    const MAX_HISTORY = 20;
    const trimmedMessages = messages.length > MAX_HISTORY ? messages.slice(-MAX_HISTORY) : messages;
    const lastMessage = trimmedMessages[trimmedMessages.length - 1]?.content || "";
    const selectedLang = bodyData.lang || "vi";

    const host = c.req.header("host") || "localhost:5173";
    const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";

    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SSEEvent) => {
          controller.enqueue(encoder.encode(formatSSE(event)));
        };

        try {
          // 1. Generate and stream thinking process
          const generateDynamicThought = (q: string) => {
            const qLower = q.toLowerCase();
            const thoughts: string[] = [];

            if (qLower.includes("thoi tiet") || qLower.includes("nhiet do") || qLower.includes("mua")) {
              thoughts.push("Dang thiet lap ket noi ve tinh khi tuong va tram cam bien moi truong...");
            }
            if (qLower.includes("gia") || qLower.includes("ty gia") || qLower.includes("tien")) {
              thoughts.push("Dang dong bo hoa du lieu tai chinh & thi truong thoi gian thuc...");
            }
            if (qLower.includes("san pham") || qLower.includes("mat ong") || qLower.includes("kho")) {
              thoughts.push("Kich hoat luong truy xuat truc tiep vao Co so du lieu Kho hang Rottra...");
            }
            if (qLower.includes("toan") || qLower.includes("xac xuat") || qLower.includes("giai")) {
              thoughts.push("Kich hoai lo nhan thuc Toan hoc & Suy luan Su dien (Deductive Reasoning)...");
            }
            if (qLower.includes("kien truc") || qLower.includes("cong nghe") || qLower.includes("code")) {
              thoughts.push("Phan tich cau truc he thong va doi chieu voi tai lieu ky thuat noi bo...");
            }

            if (thoughts.length === 0) {
              thoughts.push("Dang phan tich ngu nghia va trich xuat y dinh cot loi cau hoi...");
              thoughts.push("Ra soat mang luoi Tri thuc Da nguon & Ky uc He thong Rottra...");
            } else {
              thoughts.push("Dang tong hop du lieu va chuan bi cau truc phan hoi...");
            }

            return thoughts.join("\n");
          };

          const dynamicThought = generateDynamicThought(lastMessage);
          sendEvent({ type: "thinking", data: dynamicThought });

          // 2. Fetch response from pipeline (clean architecture)
          const pipelineRes = await fetch(`${protocol}://${host}/api/agent/pipeline/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: c.req.header("cookie") || "",
            },
            body: JSON.stringify({
              query: lastMessage,
              sessionId: "sse-session",
              lang: selectedLang,
            }),
            signal: AbortSignal.timeout(180_000),
          });

          if (!pipelineRes.ok) {
            throw new Error(`Pipeline returned HTTP ${pipelineRes.status}`);
          }

          const responseText = await pipelineRes.text();
          let data: any = {};
          try {
            data = JSON.parse(responseText);
          } catch (err: any) {
            throw new Error(`Unexpected non-JSON response from pipeline: "${responseText.substring(0, 200)}..." (${err.message})`);
          }

          let reply: string = data.reply || "Dạ hoan hoi thua Sep, he thong noi bo cua em chua xu ly duoc cau hoi nay.";
          // Remove any nested <think>...</think> block from the reply
          reply = reply.replace(/<think>[\s\S]*?<\/think>\s*/gi, "");

          // 3. Stream reply tokens (chunked for performance)
          const chars = Array.from(reply);
          const chunkSize = 4;
          for (let i = 0; i < chars.length; i += chunkSize) {
            const chunk = chars.slice(i, i + chunkSize).join("");
            sendEvent({ type: "token", data: chunk });
            await new Promise((r) => setTimeout(r, 2));
          }

          // 4. Stream structured data
          if (data.suggestions && data.suggestions.length > 0) {
            sendEvent({ type: "suggestions", data: JSON.stringify(data.suggestions) });
          }

          if (data.results && data.results.length > 0) {
            sendEvent({ type: "products", data: JSON.stringify(data.results) });
          }

          // 5. Proactive suggestions
          const proactiveSuggestions = generateProactiveSuggestions(lastMessage, data.intent || "UNKNOWN");
          if (proactiveSuggestions.length > 0) {
            sendEvent({ type: "proactive", data: JSON.stringify(proactiveSuggestions) });
          }

          if (data.replyB) {
            sendEvent({ type: "reply_b", data: JSON.stringify(data.replyB) });
          }

          // 6. Signal completion
          sendEvent({ type: "done", data: "" });
        } catch (error: any) {
          console.error("SSE Stream Error:", error.message);
          sendEvent({ type: "error", data: error.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("Offline AI Chat API Error:", error.message);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════
// PROACTIVE SUGGESTIONS: Context-aware follow-up suggestions
// ══════════════════════════════════════════════════════════════

function generateProactiveSuggestions(query: string, intent: string): string[] {
  const suggestions: string[] = [];
  const q = query.toLowerCase();

  // Time-based suggestions
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    suggestions.push("Cap nhat gia thi truong hom nay");
  } else if (hour >= 18 && hour < 22) {
    suggestions.push("Tom tat hoat dong hom nay");
  }

  // Intent-based suggestions
  if (intent === "WEATHER_SEASON" || /thoi tiet|weather|mua|nang/i.test(q)) {
    suggestions.push("Du bao thoi tiet 3 ngay toi");
    suggestions.push("Lich gieo trong phu hop");
  } else if (intent === "MARKET_PRICE" || /gia|bao nhieu|cost|price/i.test(q)) {
    suggestions.push("So sanh gia voi tuan truoc");
    suggestions.push("Du bao xu huong gia");
  } else if (intent === "SMART_AGRI" || /nong nghiep|trong|canh tac/i.test(q)) {
    suggestions.push("Ky thuat phong tru sau benh");
    suggestions.push("Lich bon phan theo mua");
  } else if (intent === "ORDER_PAYMENT" || /mua|order|dat hang/i.test(q)) {
    suggestions.push("Kiem tra trang thai don hang");
    suggestions.push("Chinh sach doi tra");
  } else if (intent === "FINANCE_COST" || /chi phi|loi nhuan|ROI/i.test(q)) {
    suggestions.push("Tinh toan chi phi san xuat");
    suggestions.push("Phan tich loi nhuan ho nong dan");
  }

  // Product mention suggestions
  if (/ca phe|coffee/i.test(q)) {
    suggestions.push("Gia ca phe hom nay");
    suggestions.push("Ky thuat trong ca phe");
  } else if (/lua|rice/i.test(q)) {
    suggestions.push("Gia lua gao thi truong");
    suggestions.push("Ky thuat trong lua");
  } else if (/tieu|pepper/i.test(q)) {
    suggestions.push("Gia ho tieu xuat khau");
    suggestions.push("Benh hai tren tieu");
  }

  // Deduplicate and limit
  const uniqueSuggestions = [...new Set(suggestions)];
  return uniqueSuggestions.slice(0, 3);
}
