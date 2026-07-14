import { search as ddgSearch, SafeSearchType } from "duck-duck-scrape";
import { createLogger } from "~/shared/logger";

const log = createLogger("helpers/web-search");

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  summary: string;
}

const JINA_READER_URL = "https://r.jina.ai/";

/**
 * Search the web using DuckDuckGo (free, no API key needed)
 * and optionally fetch full content from top results via Jina Reader.
 */
export async function searchWeb(
  query: string,
  options: { maxResults?: number; fetchContent?: boolean; timeoutMs?: number } = {},
): Promise<WebSearchResponse> {
  const { maxResults = 5, fetchContent = false, timeoutMs = 8000 } = options;

  try {
    const searchResults = await ddgSearch(query, {
      safeSearch: SafeSearchType.MODERATE,
    });

    const results: WebSearchResult[] = (searchResults.results || []).slice(0, maxResults).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
    }));

    let summary = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`).join("\n\n");

    if (fetchContent && results.length > 0) {
      const topUrl = results[0].url;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(`${JINA_READER_URL}${topUrl}`, {
          headers: { Accept: "text/plain" },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          const cleaned = text
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 3000);
          summary += `\n\n--- Nội dung chi tiết từ ${results[0].title} ---\n${cleaned}`;
        }
      } catch (fetchErr) {
        log.warn("[WebSearch] Failed to fetch content from", topUrl, fetchErr);
      }
    }

    return { query, results, summary };
  } catch (err) {
    log.error("[WebSearch] DuckDuckGo search failed:", err);
    return { query, results: [], summary: "" };
  }
}

/**
 * Build a web-search-augmented system prompt for the LLM.
 */
export function buildWebSearchPrompt(query: string, searchSummary: string): string {
  return `Bạn là Trợ lý Trí tuệ Nhân tạo cao cấp của Hệ sinh thái Nông Sản Rottra.
Dưới đây là kết quả tìm kiếm trên Internet liên quan đến câu hỏi của người dùng.
Hãy dựa vào thông tin này để trả lời câu hỏi một cách chính xác, mạch lạc.

NGUYÊN TẮC:
1. Chỉ dùng thông tin từ kết quả tìm kiếm, KHÔNG BỊA ĐẶT.
2. Nếu thông tin không đủ để trả lời, hãy nói rõ.
3. Trả lời bằng ngôn ngữ của người dùng.
4. Nhắc nguồn trích dẫn nếu có thể.

KẾT TÌM KIẾM TRÊN MẠNG:
${searchSummary}

CÂU HỎI CỦA NGƯỜI DÙNG: ${query}`;
}
