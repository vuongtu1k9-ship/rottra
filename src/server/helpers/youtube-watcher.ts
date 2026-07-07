import Parser from "rss-parser";
import { YoutubeTranscript } from "youtube-transcript";
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";

const CHANNEL_ID = "UCmQYoc5Z4l2aEBBVRXbEkwA"; // Trí tuệ Nhân sinh
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const parser = new Parser({
  requestOptions: {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  },
});

// Hàm cắt nhỏ văn bản (Semantic Chunking with Overlap) để RAG không bị mất ngữ cảnh
function chunkText(text: string, chunkSize: number = 800, overlapSize: number = 150): string[] {
  if (!text) return [];
  const chunks: string[] = [];

  // Tách theo dấu câu kết thúc câu, dấu chấm phẩy hoặc xuống dòng để giữ trọn vẹn ngữ nghĩa
  const sentences = text.split(/(?<=[.?!;\n])\s+/);

  let currentChunk = "";
  let i = 0;

  while (i < sentences.length) {
    const sentence = sentences[i];

    // Nếu 1 câu dài bất thường, buộc phải cắt nhỏ theo character
    if (sentence.length > chunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      let subStart = 0;
      while (subStart < sentence.length) {
        chunks.push(sentence.substring(subStart, subStart + chunkSize).trim());
        subStart += chunkSize - overlapSize;
      }
      i++;
      continue;
    }

    if (currentChunk.length + sentence.length <= chunkSize) {
      currentChunk += sentence + " ";
      i++;
    } else {
      chunks.push(currentChunk.trim());

      // Lùi lại để tạo overlap (lấy các câu cuối của chunk hiện tại làm mồi cho chunk mới)
      let overlapChunk = "";
      let backIndex = i - 1;

      while (backIndex >= 0 && overlapChunk.length + sentences[backIndex].length <= overlapSize) {
        overlapChunk = sentences[backIndex] + " " + overlapChunk;
        backIndex--;
      }

      currentChunk = overlapChunk + sentence + " ";
      i++;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function checkAndIngestYoutube() {
  console.log("📺 [YouTube Watcher] Đang kiểm tra video mới từ kênh Trí tuệ Nhân sinh...");
  try {
    const feed = await parser.parseURL(RSS_URL);
    if (!feed.items || feed.items.length === 0) {
      console.log("📺 [YouTube Watcher] Không tìm thấy video nào trong RSS feed.");
      return;
    }

    // Chỉ lấy 2 video mới nhất mỗi lần check để tránh Rate Limit
    const latestVideos = feed.items.slice(0, 2);

    for (const video of latestVideos) {
      const videoId = video.id?.replace("yt:video:", "");
      if (!videoId) continue;

      // Kiểm tra xem video đã được nạp chưa bằng cách query thử 1 chunk trong DB
      const existing = await db
        .select({ id: vectorDocument.id })
        .from(vectorDocument)
        .where(eq(vectorDocument.category, `YOUTUBE_${videoId}`))
        .limit(1);

      if (existing.length > 0) {
        continue; // Đã nạp rồi, bỏ qua
      }

      console.log(`📺 [YouTube Watcher] Phát hiện video mới: ${video.title}. Bắt đầu nạp...`);

      let fullText = "";
      try {
        // Cố gắng bóc tách Phụ đề tự động / thủ công từ YouTube
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        fullText = transcript
          .map((t) => t.text)
          .join(" ")
          .replace(/\n/g, " ")
          .replace(/\s+/g, " ");
      } catch (err) {
        // [PHẢN HỒI Ý KIẾN CỦA SẾP]: Nếu video KHÔNG CÓ transcript (bị tắt, hoặc lỗi), ta sẽ dùng Mô tả của video làm fallback!
        console.warn(`⚠️ [YouTube Watcher] Video không có Transcript (hoặc lỗi). Fallback sang đọc Description (Mô tả).`);
        fullText = video.contentSnippet || video.content || "";
      }

      if (!fullText || fullText.trim().length < 50) {
        console.log(`📺 [YouTube Watcher] Nội dung quá ngắn, bỏ qua video này.`);
        continue;
      }

      // Chunking và lưu vào Database RAG
      const chunks = chunkText(fullText);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // --- METADATA ENRICHMENT: Trích xuất tri thức triết học sâu ---
        let extractedMetadata = {};
        try {
          const llmPrompt = `Trích xuất triết lý cốt lõi và ứng dụng thực tế từ đoạn văn sau. 
Chỉ trả về một đối tượng JSON hợp lệ duy nhất, không giải thích thêm:
{
  "Core_Concept": "[Từ khóa triết lý cốt lõi, ví dụ: Buông xả, Nhân quả, Điềm đạm...]",
  "Application": "[Cách ứng dụng thực tế ngắn gọn]"
}
Đoạn văn: "${chunk}"`;

          const aiResponse = await generateTextLocal({
            system: "Bạn là một AI trích xuất tri thức, chỉ trả về JSON hợp lệ.",
            prompt: llmPrompt,
            decodingSettings: { temperature: 0.1, maxTokens: 200 },
            isInternalReasoning: true,
          });

          if (aiResponse && aiResponse.text) {
            const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              extractedMetadata = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (err) {
          console.error("⚠️ [YouTube Watcher] Lỗi khi trích xuất metadata cho RAG:", err);
        }

        await db.insert(vectorDocument).values({
          id: randomUUID(),
          category: `YOUTUBE_${videoId}`,
          title: `[Trí tuệ Nhân sinh] ${video.title} (Phần ${i + 1})`,
          subtitle: video.link,
          content: chunk,
          metadata: extractedMetadata,
        });
      }

      console.log(`✅ [YouTube Watcher] Đã nạp thành công video "${video.title}" vào Não bộ Rottra (${chunks.length} mảng ký ức).`);
    }
  } catch (error: any) {
    if (error.message?.includes("Status code 404") || error.message?.includes("Status code 500")) {
      console.warn("⚠️ [YouTube Watcher] YouTube RSS tạm thời từ chối kết nối (404/500). Hệ thống sẽ tự động thử lại ở chu kỳ sau.");
    } else {
      console.error("❌ [YouTube Watcher] Lỗi khi chạy nạp video:", error);
    }
  }
}

// Chạy lần đầu sau 10 giây
setTimeout(checkAndIngestYoutube, 10000);

// Lặp lại mỗi 6 tiếng
setInterval(checkAndIngestYoutube, 6 * 60 * 60 * 1000);
