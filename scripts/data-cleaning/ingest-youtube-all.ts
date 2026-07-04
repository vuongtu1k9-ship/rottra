#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer";
import crypto from "crypto";
import { extractYoutubeTranscript } from "../lib/youtube-transcript-helper";
import { YoutubeTranscript } from "@danielxceron/youtube-transcript";

async function main() {
  const channelHandle = process.argv[2] || "@trituenhansinh";
  const targetUrl = `https://www.youtube.com/${channelHandle}/videos`;

  console.log(`📡 [YOUTUBE ALL INGEST] Khởi chạy cào TOÀN BỘ video từ kênh: ${targetUrl}`);

  // Khởi tạo RAG Engine
  console.log("⚙️ Đang tải từ vựng RAG...");
  const { vocabulary } = await initRAGEngine();

  console.log("🚀 Khởi chạy trình duyệt Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  try {
    // Giả lập thiết bị thật để tránh bot detection
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 1000 });

    console.log(`🌐 Đang mở trang danh sách video...`);
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    console.log("📜 Đang cuộn trang liên tục để tải toàn bộ video (quá trình này có thể mất 1-2 phút)...");
    
    let lastHeight = await page.evaluate("document.documentElement.scrollHeight");
    let scrollAttempts = 0;
    const maxScrollAttempts = 80; // Tránh vòng lặp vô hạn

    while (scrollAttempts < maxScrollAttempts) {
      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      
      // Chờ nội dung mới tải xong
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      let newHeight = await page.evaluate("document.documentElement.scrollHeight");
      console.log(`[Cuộn #${scrollAttempts + 1}] Chiều cao trang: ${newHeight}px`);

      if (newHeight === lastHeight) {
        // Cuộn thêm một lần nữa để chắc chắn
        await page.evaluate("window.scrollBy(0, -300)");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        newHeight = await page.evaluate("document.documentElement.scrollHeight");
        
        if (newHeight === lastHeight) {
          console.log("🏁 Đã cuộn tới cuối trang danh sách video.");
          break;
        }
      }
      
      lastHeight = newHeight;
      scrollAttempts++;
    }

    // Trích xuất toàn bộ liên kết và tiêu đề video
    console.log("🔍 Đang trích xuất danh sách liên kết video...");
    const rawVideos = await page.evaluate(() => {
      const items: { title: string; url: string }[] = [];
      const links = Array.from(document.querySelectorAll("a"));
      
      links.forEach((link) => {
        const titleText = link.textContent?.trim() || "";
        const href = link.getAttribute("href") || "";
        const className = link.className || "";
        
        // Lọc theo cấu trúc mới nhất của YouTube (ytLockupMetadataViewModelTitle) hoặc dạng a#video-title
        const isVideoTitleLink = 
          className.includes("ytLockupMetadataViewModelTitle") || 
          link.id === "video-title" || 
          link.id === "video-title-link";

        if (href.includes("/watch") && isVideoTitleLink && titleText) {
          items.push({
            title: titleText,
            url: `https://www.youtube.com${href}`,
          });
        }
      });
      return items;
    });

    console.log(`📊 Tìm thấy tổng cộng ${rawVideos.length} video trên kênh.`);

    if (rawVideos.length === 0) {
      console.log("⚠️ Không tìm thấy video nào. YouTube có thể đã thay đổi cấu trúc trang.");
      return;
    }

    // We do NOT close the browser here anymore, as we will use it to extract transcripts
    console.log("📥 Đang đối chiếu cơ sở dữ liệu để lọc video mới...");
    const newVideos: typeof rawVideos = [];
    for (const vid of rawVideos) {
      const cleanTitle = vid.title.normalize("NFC");
      const existing = await db
        .select()
        .from(vectorDocument)
        .where(eq(vectorDocument.title, cleanTitle))
        .catch(() => []);

      if (existing.length === 0) {
        newVideos.push(vid);
      }
    }

    console.log(`🆕 Có ${newVideos.length}/${rawVideos.length} video mới cần nạp vào DB.`);

    let insertedCount = 0;

    for (let i = 0; i < newVideos.length; i++) {
      const vid = newVideos[i];
      const cleanTitle = vid.title.normalize("NFC");
      console.log(`[${i + 1}/${newVideos.length}] Đang xử lý video: "${cleanTitle}"`);

      // Try fast API transcript first (no browser needed)
      let transcript = "";
      let transcriptIngested = false;
      const videoIdMatch = vid.url.match(/[?&]v=([^&]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : "";
      
      if (videoId) {
        try {
          console.log(`⚡ Thử lấy transcript nhanh bằng API cho video ${videoId}...`);
          const transcriptItems = await (YoutubeTranscript as any).fetchTranscriptWithInnerTube(videoId);
          if (transcriptItems && transcriptItems.length > 0) {
            transcript = transcriptItems.map((t: any) => t.text).join(" ");
            transcriptIngested = true;
            console.log(`[FAST API] Lấy được ${transcriptItems.length} đoạn transcript, ${transcript.length} ký tự.`);
          }
        } catch (apiErr: any) {
          console.log(`[FAST API] Không thành công (${apiErr.message?.substring(0, 100)}), thử puppeteer...`);
        }
      }

      let content = "";
      if (transcriptIngested) {
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${transcript} Xem trực tiếp tại: ${vid.url}`;
      } else {
        // Fallback to video meta description if transcript is empty/disabled
        console.log(`📡 Đang tải mô tả chi tiết làm fallback cho ${vid.url}...`);
        let description = "";
        try {
          const watchRes = await fetch(vid.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          const html = await watchRes.text();
          const descMatch = html.match(/<meta name="description" content="([^"]*)"/) || html.match(/<meta itemprop="description" content="([^"]*)"/);
          if (descMatch) {
            description = descMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&#39;/g, "'")
              .normalize("NFC");
          }
        } catch (err: any) {
          console.error(`⚠️ Lỗi khi tải mô tả fallback cho ${vid.url}:`, err.message);
        }
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${description || "Không có mô tả chi tiết."} Xem trực tiếp tại: ${vid.url}`;
      }

      const flatText = cleanAndNormalize(`${cleanTitle} ${content}`);
      const embedding = generateEmbedding(flatText, vocabulary);

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
          transcriptIngested,
          transcriptLength: transcript.length,
        },
        embedding: embedding,
      });

      insertedCount++;
      
      // Giãn cách một chút để tránh kích hoạt cơ chế rate limit của YouTube
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`🎉 Thành công! Đã nạp thêm ${insertedCount} video mới vào RAG Vector Database.`);
  } catch (err: any) {
    console.error("❌ Lỗi hệ thống trong quá trình nạp dữ liệu:", err.message);
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
}

main();
