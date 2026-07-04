#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";

async function main() {
  console.log("🧹 [RAG CLEANING] Khởi chạy dọn dẹp và đồng bộ chuẩn hóa Unicode NFC & Viết tắt...");

  // Khởi tạo RAG Engine để nạp từ vựng và cache
  console.log("📡 Đang khởi tạo bộ nhớ từ vựng RAG...");
  const { vocabulary } = await initRAGEngine();
  console.log(`✅ Từ vựng hiện tại có ${vocabulary.length} từ.`);

  // Truy vấn toàn bộ tài liệu RAG
  const allDocs = await db.select().from(vectorDocument);
  console.log(`📋 Đọc thành công ${allDocs.length} tài liệu từ bảng VectorDocument.`);

  let updatedCount = 0;

  for (const doc of allDocs) {
    // 1. Chuẩn hóa Unicode NFC cho các trường văn bản
    const normalizedTitle = (doc.title || "").normalize("NFC").trim();
    const normalizedSubtitle = (doc.subtitle || "").normalize("NFC").trim();
    const normalizedContent = (doc.content || "").normalize("NFC").trim();

    // 2. Chạy dọn dẹp bằng cleanAndNormalize (đã bao gồm giải nghĩa từ viết tắt tiếng Việt)
    const parts = [normalizedTitle, normalizedSubtitle, normalizedContent];
    const flatText = cleanAndNormalize(parts.join(" "));

    // 3. Tính toán lại Dense Embedding
    const newEmbedding = generateEmbedding(flatText, vocabulary);

    // Kiểm tra xem có sự thay đổi đáng kể nào cần cập nhật hay không
    let needsUpdate = false;
    if (
      normalizedTitle !== doc.title ||
      normalizedSubtitle !== doc.subtitle ||
      normalizedContent !== doc.content
    ) {
      needsUpdate = true;
    }

    // So sánh embedding (nếu độ sai số cosine < 0.999)
    if (doc.embedding) {
      let dot = 0;
      for (let i = 0; i < newEmbedding.length; i++) {
        dot += newEmbedding[i] * (doc.embedding as number[])[i];
      }
      if (dot < 0.999) {
        needsUpdate = true;
      }
    } else {
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`🔄 Cập nhật tài liệu ID: ${doc.id} - "${normalizedTitle}"`);
      await db
        .update(vectorDocument)
        .set({
          title: normalizedTitle,
          subtitle: normalizedSubtitle,
          content: normalizedContent,
          embedding: newEmbedding,
        })
        .where(eq(vectorDocument.id, doc.id));
      
      updatedCount++;
    }
  }

  console.log(`✨ Hoàn tất! Đã đồng bộ và làm sạch ${updatedCount}/${allDocs.length} tài liệu trong VectorDocument.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi trong quá trình dọn dẹp dữ liệu:", err);
  process.exit(1);
});
