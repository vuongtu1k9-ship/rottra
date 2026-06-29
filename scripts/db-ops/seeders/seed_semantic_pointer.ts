/**
 * 🇻🇳 ROTTRA SEMANTIC POINTER SEED — Nạp thực thể ngữ nghĩa "Con Trỏ & Đệ Quy Tuyến Tính" siêu chính xác
 * Chạy: bun src/db/seed_semantic_pointer.ts
 */
import { db } from "./db";
import { agentTraining, vietnameseLexicon } from "./schema";
import crypto from "crypto";
import { eq } from "drizzle-orm";

const POINTER_SEMANTIC_DATA = [
  {
    word: "con trỏ",
    type: "thuật ngữ kỹ thuật",
    subType: "định vị địa chỉ ô nhớ",
    definition: "Biến đặc biệt lưu trữ địa chỉ ô nhớ vật lý của một biến khác. Trong kiến trúc đệ quy hoặc định vị tuyến tính, con trỏ đóng vai trò là kim chỉ nam điều động luồng dữ liệu chạy thẳng tới mục tiêu tối ưu mà không qua trung gian.",
    relations: ["ô nhớ", "địa chỉ", "đệ quy tuyến tính", "tối ưu hóa"],
  },
  {
    word: "đệ quy tuyến tính",
    type: "thuật ngữ toán học",
    subType: "mô hình suy luận tuyến tính",
    definition: "Cấu trúc đệ quy trong đó mỗi bước gọi hàm chỉ sinh ra tối đa một lời gọi đệ quy tiếp theo trực tiếp (đường dẫn thẳng). Khi kết hợp với dự đoán tuyến tính (Linear Prediction), nó đảm bảo quỹ đạo hội tụ luôn đi thẳng, vừa chuẩn vừa khớp 100% không lệch một ly.",
    relations: ["con trỏ", "đệ quy", "dự đoán tuyến tính", "hội tụ"],
  },
];

async function main() {
  console.log("🇻🇳 [KHỞI CHẠY] Nạp Ngữ Nghĩa Vừa Chuẩn Vừa Khớp Cho Con Trỏ & Đệ Quy Tuyến Tính...");
  console.log("══════════════════════════════════════════════════════════════════════════════");

  let totalInserted = 0;

  for (const item of POINTER_SEMANTIC_DATA) {
    const id = `lex_${crypto.randomUUID().split("-")[0].toUpperCase()}`;

    try {
      // Xoá từ cũ nếu đã tồn tại để cập nhật bản mới nhất cực chuẩn
      await db.delete(vietnameseLexicon).where(eq(vietnameseLexicon.word, item.word));

      await db.insert(vietnameseLexicon).values({
        id,
        word: item.word,
        type: item.type,
        subType: item.subType,
        definition: item.definition,
        relations: item.relations,
        addAt: new Date().toISOString(),
      });

      console.log(`   ✅ Đã nạp thành công thuật ngữ: "${item.word}" (${item.type})`);
      totalInserted++;
    } catch (e: any) {
      console.error(`   ❌ Lỗi nạp từ [${item.word}]: ${e.message}`);
    }
  }

  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.log(`📊 Hoàn thành: Đã nạp thành công ${totalInserted} thuật ngữ ngữ nghĩa chí mạng vào CSDL.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
