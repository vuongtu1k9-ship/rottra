#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  const channelHandle = process.argv[2] || "@trituenhansinh";
  console.log(`📡 [YOUTUBE INGEST] Khởi chạy nạp tri thức từ kênh YouTube: ${channelHandle}`);

  // Khởi tạo RAG Engine để nạp từ vựng
  console.log("⚙️ Đang tải từ vựng RAG...");
  const { vocabulary } = await initRAGEngine();

  try {
    // 1. Phân giải Handle thành Channel ID
    console.log(`🔍 Đang phân giải channel handle ${channelHandle}...`);
    const channelUrl = `https://www.youtube.com/${channelHandle}`;
    const channelRes = await fetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const htmlText = await channelRes.text();
    const channelIdMatch = htmlText.match(/"channelId":"(UC[^"]+)"/) || htmlText.match(/<meta itemprop="channelId" content="(UC[^"]+)"/) || htmlText.match(/"externalId":"(UC[^"]+)"/);

    if (!channelIdMatch) {
      throw new Error(`Không tìm thấy Channel ID cho handle: ${channelHandle}`);
    }

    const channelId = channelIdMatch[1];
    console.log(`✅ Tìm thấy Channel ID: ${channelId}`);

    // 2. Tải XML RSS Feed của kênh
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    console.log(`📡 Đang tải RSS Feed từ: ${feedUrl}`);
    const feedRes = await fetch(feedUrl);
    const xmlText = await feedRes.text();

    // 3. Phân tích cú pháp XML đơn giản để trích xuất các mục video
    console.log("🧩 Đang xử lý danh sách video và mô tả...");
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    const videos: { title: string; url: string; description: string }[] = [];

    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryContent = match[1];
      
      const titleMatch = entryContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entryContent.match(/<link[^>]*?rel="alternate"[^>]*?href="([^"]+)"/);
      const descMatch = entryContent.match(/<media:description>([\s\S]*?)<\/media:description>/);

      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
        const url = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
        videos.push({ title, url, description });
      }
    }

    console.log(`✅ Trích xuất thành công ${videos.length} video mới nhất.`);

    if (videos.length === 0) {
      console.log("⚠️ Không tìm thấy video nào trong RSS feed.");
      return;
    }

    let insertedCount = 0;

    for (const vid of videos) {
      // Chuẩn hóa Unicode NFC cho các nội dung
      const cleanTitle = vid.title.normalize("NFC");
      const cleanDesc = vid.description.normalize("NFC").substring(0, 1200); // Giới hạn 1200 ký tự mô tả để tối ưu hóa tokens
      
      const content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${cleanDesc || "Không có mô tả chi tiết."} Xem trực tiếp tại: ${vid.url}`;
      
      // Tạo vector nhúng RAG
      const flatText = cleanAndNormalize(`${cleanTitle} ${content}`);
      const embedding = generateEmbedding(flatText, vocabulary);

      // Check trùng lặp tiêu đề
      const existing = await db
        .select()
        .from(vectorDocument)
        .where(eq(vectorDocument.title, cleanTitle))
        .catch(() => []);

      if (existing.length === 0) {
        console.log(`📥 Đang nạp video: "${cleanTitle}"`);
        await db.insert(vectorDocument).values({
          id: crypto.randomUUID(),
          category: "YOUTUBE_WISDOM",
          title: cleanTitle,
          subtitle: `Nguồn: YouTube ${channelHandle}`,
          content: content,
          metadata: {
            source: "youtube",
            channel: channelHandle,
            url: vid.url,
            ingestedAt: new Date().toISOString(),
          },
          embedding: embedding,
        });
        insertedCount++;
      }
    }

    console.log(`🎉 Hoàn tất! Đã thêm mới thành công ${insertedCount}/${videos.length} video vào cơ sở dữ liệu tri thức.`);
  } catch (err: any) {
    console.error("❌ Lỗi trong quá trình nạp dữ liệu YouTube:", err.message);
  }
}

main();
