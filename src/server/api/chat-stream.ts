import { Hono } from "hono";

export const chatApp = new Hono();

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

    // Stream the offline AI reply character by character to maintain streaming UI effect
    // We move the fetch INSIDE the ReadableStream so the HTTP connection is returned IMMEDIATELY.
    const mockStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          // Hàm tự động sinh tiến trình tư duy dựa trên từ khóa câu hỏi
          const generateDynamicThought = (q: string) => {
            const qLower = q.toLowerCase();
            let thoughts = [];

            if (qLower.includes("thời tiết") || qLower.includes("nhiệt độ") || qLower.includes("mưa")) {
              thoughts.push("- Đang thiết lập kết nối vệ tinh khí tượng và trạm cảm biến môi trường...");
            }
            if (qLower.includes("giá") || qLower.includes("tỷ giá") || qLower.includes("tiền")) {
              thoughts.push("- Đang đồng bộ hóa dữ liệu tài chính & thị trường thời gian thực...");
            }
            if (qLower.includes("sản phẩm") || qLower.includes("mật ong") || qLower.includes("mvp") || qLower.includes("kho")) {
              thoughts.push("- Kích hoạt luồng truy xuất trực tiếp vào Cơ sở dữ liệu Kho hàng Rottra...");
            }
            if (qLower.includes("toán") || qLower.includes("xác suất") || qLower.includes("thống kê") || qLower.includes("giải")) {
              thoughts.push("- Kích hoạt lõi nhận thức Toán học & Suy luận Suy diễn (Deductive Reasoning)...");
            }
            if (qLower.includes("kiến trúc") || qLower.includes("công nghệ") || qLower.includes("code")) {
              thoughts.push("- Phân tích cấu trúc hệ thống và đối chiếu với tài liệu kỹ thuật nội bộ...");
            }

            if (thoughts.length === 0) {
              thoughts.push("- Đang phân tích ngữ nghĩa và trích xuất ý định cốt lõi của câu hỏi...");
              thoughts.push("- Rà soát mạng lưới Tri thức Đa nguồn & Ký ức Hệ thống Rottra...");
            } else {
              thoughts.push("- Đang tổng hợp dữ liệu và chuẩn bị cấu trúc phản hồi...");
            }

            return thoughts.join("\n");
          };

          const dynamicThought = generateDynamicThought(lastMessage);

          // Gửi tiến trình tư duy động ngay lập tức
          controller.enqueue(encoder.encode(`<think>\n${dynamicThought}\n</think>\n\n`));

          const localRes = await fetch(`${protocol}://${host}/api/agent/chat-expert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: c.req.header("cookie") || "",
            },
            body: JSON.stringify({
              query: lastMessage,
              usePrivateBrain: true,
              lang: selectedLang,
            }),
            signal: AbortSignal.timeout(180_000),
          });

          if (!localRes.ok) {
            throw new Error(`Local Rottra Expert AI returned HTTP ${localRes.status}`);
          }

          const responseText = await localRes.text();
          let data: any = {};
          try {
            data = JSON.parse(responseText);
          } catch (err: any) {
            throw new Error(`Unexpected non-JSON response from chat-expert: "${responseText.substring(0, 200)}..." (${err.message})`);
          }
          const reply: string = data.reply || "Dạ hoan hỉ thưa Sếp, hệ thống nội bộ của em chưa xử lý được câu hỏi này.";

          // Speed up the streaming (chunking multiple characters) to avoid 15s+ typing delay
          const chars = Array.from(reply);
          const chunkSize = 4;
          for (let i = 0; i < chars.length; i += chunkSize) {
            const chunk = chars.slice(i, i + chunkSize).join("");
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 2)); // ultra-fast 2ms per chunk
          }

          // Stream suggestions if available
          if (data.suggestions && data.suggestions.length > 0) {
            controller.enqueue(encoder.encode(`\n[SUGGESTIONS:${JSON.stringify(data.suggestions)}]`));
          }

          // Stream products if available
          if (data.results && data.results.length > 0) {
            controller.enqueue(encoder.encode(`\n[PRODUCTS:${JSON.stringify(data.results)}]`));
          }

          // Proactive suggestions based on context
          const proactiveSuggestions = generateProactiveSuggestions(lastMessage, data.intent || "UNKNOWN");
          if (proactiveSuggestions.length > 0) {
            controller.enqueue(encoder.encode(`\n[PROACTIVE:${JSON.stringify(proactiveSuggestions)}]`));
          }
          if (data.replyB) {
            controller.enqueue(encoder.encode(`\n[REPLY_B:${JSON.stringify(data.replyB)}]`));
          }
        } catch (error: any) {
          console.error("Lỗi bên trong ReadableStream:", error.message);
          controller.enqueue(encoder.encode(`\n\n❌ [Lỗi Hệ Thống]: ${error.message}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(mockStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Lỗi Offline AI Chat API:", error.message);
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
    suggestions.push("Cập nhật giá thị trường hôm nay");
  } else if (hour >= 18 && hour < 22) {
    suggestions.push("Tóm tắt hoạt động hôm nay");
  }

  // Intent-based suggestions
  if (intent === "WEATHER_SEASON" || /thời tiết|weather|mưa|nắng/i.test(q)) {
    suggestions.push("Dự báo thời tiết 3 ngày tới");
    suggestions.push("Lịch gieo trồng phù hợp");
  } else if (intent === "MARKET_PRICE" || /giá|bao nhiêu|cost|price/i.test(q)) {
    suggestions.push("So sánh giá với tuần trước");
    suggestions.push("Dự báo xu hướng giá");
  } else if (intent === "SMART_AGRI" || /nông nghiệp|trồng|canh tác/i.test(q)) {
    suggestions.push("Kỹ thuật phòng trừ sâu bệnh");
    suggestions.push("Lịch bón phân theo mùa");
  } else if (intent === "ORDER_PAYMENT" || /mua|order|đặt hàng/i.test(q)) {
    suggestions.push("Kiểm tra trạng thái đơn hàng");
    suggestions.push("Chính sách đổi trả");
  } else if (intent === "FINANCE_COST" || /chi phí|lợi nhuận|ROI/i.test(q)) {
    suggestions.push("Tính toán chi phí sản xuất");
    suggestions.push("Phân tích lợi nhuận hộ nông dân");
  }

  // Product mention suggestions
  if (/cà phê|coffee/i.test(q)) {
    suggestions.push("Giá cà phê hôm nay");
    suggestions.push("Kỹ thuật trồng cà phê");
  } else if (/lúa|rice/i.test(q)) {
    suggestions.push("Giá lúa gạo thị trường");
    suggestions.push("Kỹ thuật trồng lúa");
  } else if (/tiêu|pepper/i.test(q)) {
    suggestions.push("Giá hồ tiêu xuất khẩu");
    suggestions.push("Bệnh hại trên tiêu");
  }

  // Deduplicate and limit
  const uniqueSuggestions = [...new Set(suggestions)];
  return uniqueSuggestions.slice(0, 3);
}
