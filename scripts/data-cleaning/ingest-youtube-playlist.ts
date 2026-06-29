#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import puppeteer from "puppeteer";
import crypto from "crypto";
import { extractYoutubeTranscript } from "../lib/youtube-transcript-helper";

async function main() {
  const playlistUrl = process.argv[2];
  if (!playlistUrl) {
    console.error("❌ Please provide a YouTube playlist URL.");
    console.log("Usage: bun scripts/data-cleaning/ingest-youtube-playlist.ts <PLAYLIST_URL>");
    process.exit(1);
  }

  // Parse playlist ID to standard playlist page if watch URL was passed
  let targetUrl = playlistUrl;
  const listMatch = playlistUrl.match(/[&?]list=([a-zA-Z0-9_-]+)/);
  if (listMatch) {
    targetUrl = `https://www.youtube.com/playlist?list=${listMatch[1]}`;
  }

  console.log(`📡 [PLAYLIST INGEST] Target playlist URL: ${targetUrl}`);

  // Initialize RAG Engine
  console.log("⚙️ Loading RAG vocabulary...");
  const { vocabulary } = await initRAGEngine();

  console.log("🚀 Launching Puppeteer browser...");
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
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    console.log(`🌐 Navigating to playlist page...`);
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Save initial debug screenshot
    await page.screenshot({ path: "playlist-debug-initial.png" });
    console.log("Saved initial debug screenshot: playlist-debug-initial.png");

    // Print all links containing watch?v= to inspect selectors
    const testLinks = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll("a"));
      return allLinks
        .map(a => ({
          text: a.textContent?.trim() || "",
          href: a.getAttribute("href") || "",
          id: a.id,
          className: a.className
        }))
        .filter(item => item.href.includes("watch?v="))
        .slice(0, 15);
    });
    console.log("Sample watch links on page:", JSON.stringify(testLinks, null, 2));

    console.log("📜 Scrolling to load all videos in the playlist...");
    let lastHeight = await page.evaluate("document.documentElement.scrollHeight");
    let scrollAttempts = 0;
    const maxScrollAttempts = 40;

    while (scrollAttempts < maxScrollAttempts) {
      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      let newHeight = await page.evaluate("document.documentElement.scrollHeight");
      console.log(`[Scroll #${scrollAttempts + 1}] Height: ${newHeight}px`);

      if (newHeight === lastHeight) {
        // Scroll back slightly and scroll down again
        await page.evaluate("window.scrollBy(0, -200)");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        newHeight = await page.evaluate("document.documentElement.scrollHeight");
        
        if (newHeight === lastHeight) {
          console.log("🏁 Reached end of playlist.");
          break;
        }
      }
      lastHeight = newHeight;
      scrollAttempts++;
    }

    // Extract video links and titles
    console.log("🔍 Extracting video URLs...");
    const rawVideos = await page.evaluate(() => {
      const items: { title: string; url: string }[] = [];
      const links = Array.from(document.querySelectorAll("a"));
      
      links.forEach((link) => {
        const titleText = link.textContent?.trim() || "";
        const href = link.getAttribute("href") || "";
        const className = link.className || "";
        const id = link.id || "";
        
        const isVideoLink = 
          className.includes("ytLockupMetadataViewModelTitle") ||
          id === "video-title" ||
          className.includes("ytd-playlist-video-renderer");

        if (href.includes("/watch") && isVideoLink && titleText) {
          const watchMatch = href.match(/\/watch\?v=([a-zA-Z0-9_-]+)/);
          if (watchMatch) {
            items.push({
              title: titleText,
              url: `https://www.youtube.com/watch?v=${watchMatch[1]}`,
            });
          }
        }
      });
      return items;
    });

    // Remove duplicates from rawVideos
    const uniqueVideos = Array.from(new Map(rawVideos.map(item => [item.url, item])).values());
    console.log(`📊 Found ${uniqueVideos.length} unique videos in playlist.`);

    if (uniqueVideos.length === 0) {
      console.log("⚠️ No videos found. Check if the playlist is public or if selectors need updating.");
      return;
    }

    console.log("📥 Comparing with database to filter new videos...");
    const newVideos: typeof uniqueVideos = [];
    for (const vid of uniqueVideos) {
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

    console.log(`🆕 ${newVideos.length}/${uniqueVideos.length} videos are new and will be ingested.`);

    let insertedCount = 0;
    for (let i = 0; i < newVideos.length; i++) {
      const vid = newVideos[i];
      const cleanTitle = vid.title.normalize("NFC");
      console.log(`\n[${i + 1}/${newVideos.length}] Processing: "${cleanTitle}" (${vid.url})`);

      let transcript = "";
      let transcriptIngested = false;
      try {
        transcript = await extractYoutubeTranscript(page, vid.url);
        if (transcript && transcript.trim().length > 0) {
          transcriptIngested = true;
        }
      } catch (err: any) {
        console.error(`⚠️ Failed to extract transcript:`, err.message);
      }

      let content = "";
      if (transcriptIngested) {
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${transcript} Xem trực tiếp tại: ${vid.url}`;
      } else {
        console.log(`📡 Fetching fallback video description...`);
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
          console.error(`⚠️ Failed to fetch fallback description:`, err.message);
        }
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${description || "Không có mô tả chi tiết."} Xem trực tiếp tại: ${vid.url}`;
      }

      const flatText = cleanAndNormalize(`${cleanTitle} ${content}`);
      const embedding = generateEmbedding(flatText, vocabulary);

      await db.insert(vectorDocument).values({
        id: crypto.randomUUID(),
        category: "YOUTUBE_WISDOM",
        title: cleanTitle,
        subtitle: "Nguồn: YouTube Playlist",
        content: content,
        metadata: {
          source: "youtube",
          playlistUrl: targetUrl,
          url: vid.url,
          ingestedAt: new Date().toISOString(),
          transcriptIngested,
          transcriptLength: transcript.length,
        },
        embedding: embedding,
      });

      console.log(`✅ Successfully ingested: "${cleanTitle}" (Transcript: ${transcriptIngested ? `${transcript.length} chars` : "Failed, used description"})`);
      insertedCount++;
      
      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`\n🎉 Completed! Ingested ${insertedCount} new videos from playlist.`);
  } catch (err: any) {
    console.error("❌ System error during playlist ingestion:", err.message);
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
}

main().catch(console.error);
