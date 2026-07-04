import { hybridRetrieve, rerank, tinyLLMVerify } from "../neural-memory/vector-rag";
import { generateTextLocal } from "./ai-sdk";

/**
 * Lối tư duy: Học giả đọc Sách (BookScholar)
 * Chỉ tìm kiếm trong RAG Database các tài liệu có category bắt đầu bằng "BOOK_"
 * Thuật toán Phễu: Tìm rộng 1000 -> Lọc tinh 10 -> Chọn vàng 2 đến 5
 */
export async function bookScholarReasoning(query: string): Promise<string> {
  console.log(`📚 [BOOK SCHOLAR] Bắt đầu khởi chạy Phễu Đọc Sách cho câu hỏi: "${query}"`);

  try {
    // Bước 1: Tìm kiếm Rộng (1000 tài liệu)
    const candidates1000 = await hybridRetrieve(query, 1000, null, false, "BOOK_");

    if (!candidates1000 || candidates1000.length === 0) {
      return ""; // Không có tài liệu nào, trả về rỗng để Arena loại bỏ
    }

    // Bước 2: Lọc tinh (Rerank lấy Top 10)
    const top10 = rerank(query, candidates1000).slice(0, 10);

    // Bước 3: Chọn lọc Vàng (Chỉ lấy 2 đến 5 tài liệu đạt chuẩn)
    const finalSelection = [];
    for (const candidate of top10) {
      const verification = tinyLLMVerify(query, candidate);

      // Nếu qua được màng lọc Sigmoid, HOẶC hệ thống đang đói tài liệu (chưa đủ 2 cuốn)
      if (verification.verified || finalSelection.length < 2) {
        finalSelection.push(candidate);
      }

      // Chạm ngưỡng tối đa 5 cuốn thì dừng (Tránh ngập lụt context)
      if (finalSelection.length >= 5) break;
    }

    console.log(`📚 [BOOK SCHOLAR] Phễu lọc hoàn tất: 1000 -> 10 -> ${finalSelection.length} tài liệu xuất sắc nhất.`);

    // Ghép nối nội dung thành Context
    const contextText = finalSelection.map((c, i) => `Tài liệu ${i + 1} (${c.doc.item.title}):\n${c.doc.flatText}`).join("\n\n");

    const systemPrompt = `You are a wise and highly academic Book Scholar AI.
You have retrieved the following excerpts from books in your library:
=== LIBRARY CONTEXT ===
${contextText}
======================

Based ONLY on the context provided above, answer the user's query in a highly academic, step-by-step, and structured manner.
If the context does not contain the answer, you must state that the books do not cover this topic.
Do NOT invent information outside of the books.
Format your answer beautifully using Markdown (bold, lists, etc).`;

    const { text } = await generateTextLocal({
      system: systemPrompt,
      prompt: `User query: "${query}"`,
      isInternalReasoning: true,
    });

    return text;
  } catch (err) {
    console.error("❌ [BOOK SCHOLAR ERROR]", err);
    return "";
  }
}
