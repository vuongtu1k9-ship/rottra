#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import puppeteer from "puppeteer";
import crypto from "crypto";
import { extractYoutubeTranscript } from "../lib/youtube-transcript-helper";

const CHANNEL_ID = "UCmQYoc5Z4l2aEBBVRXbEkwA";
const CHANNEL_HANDLE = "@trituenhansinh";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

// Simple parser for YouTube XML feed
function parseFeed(xmlText: string) {
  const entries: { title: string; url: string; videoId: string }[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryContent = match[1];
    
    const idMatch = entryContent.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entryContent.match(/<title>([^<]+)<\/title>/);
    const linkMatch = entryContent.match(/<link[^>]+href="([^"]+)"/);

    if (idMatch && titleMatch && linkMatch) {
      entries.push({
        videoId: idMatch[1].trim(),
        title: titleMatch[1].trim()
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'")
          .normalize("NFC"),
        url: `https://www.youtube.com/watch?v=${idMatch[1].trim()}`,
      });
    }
  }
  return entries;
}

async function checkAndIngestNewVideos() {
  console.log(`\n🔔 [${new Date().toISOString()}] Checking YouTube RSS feed for new videos...`);
  
  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch RSS feed: ${res.statusText}`);
    }
    const xml = await res.text();
    const entries = parseFeed(xml);

    if (entries.length === 0) {
      console.log("⚠️ No videos found in RSS feed.");
      return;
    }

    console.log(`📋 Found ${entries.length} recent videos in feed.`);

    // Check database for existence
    const newEntries: typeof entries = [];
    for (const entry of entries) {
      const cleanTitle = entry.title.normalize("NFC");
      const existing = await db
        .select()
        .from(vectorDocument)
        .where(eq(vectorDocument.title, cleanTitle))
        .catch(() => []);

      if (existing.length === 0) {
        newEntries.push(entry);
      }
    }

    if (newEntries.length === 0) {
      console.log("✅ All recent videos are already in the database.");
      return;
    }

    console.log(`🆕 Found ${newEntries.length} new videos to ingest!`);

    // Load RAG vocabulary
    const { vocabulary } = await initRAGEngine();

    // Launch browser
    console.log("🌐 Launching Puppeteer browser...");
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
    await new Promise(r => setTimeout(r, 2000));

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const cleanTitle = entry.title.normalize("NFC");
      console.log(`\n[${i + 1}/${newEntries.length}] Ingesting: "${cleanTitle}" (${entry.url})`);

      let transcript = "";
      let transcriptIngested = false;

      try {
        transcript = await extractYoutubeTranscript(page, entry.url);
        if (transcript && transcript.trim().length > 0) {
          transcriptIngested = true;
        }
      } catch (err: any) {
        console.error(`⚠️ Failed to extract transcript:`, err.message);
      }

      let content = "";
      if (transcriptIngested) {
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${transcript} Xem trực tiếp tại: ${entry.url}`;
      } else {
        // Fallback to description metadata if transcript failed
        console.log(`📡 Fetching fallback video metadata/description...`);
        let description = "";
        try {
          const watchRes = await fetch(entry.url, {
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
        content = `Nội dung từ bài giảng YouTube "${cleanTitle}": ${description || "Không có mô tả chi tiết."} Xem trực tiếp tại: ${entry.url}`;
      }

      const flatText = cleanAndNormalize(`${cleanTitle} ${content}`);
      const embedding = generateEmbedding(flatText, vocabulary);

      await db.insert(vectorDocument).values({
        id: crypto.randomUUID(),
        category: "YOUTUBE_WISDOM",
        title: cleanTitle,
        subtitle: `Nguồn: YouTube ${CHANNEL_HANDLE}`,
        content: content,
        metadata: {
          source: "youtube",
          channel: CHANNEL_HANDLE,
          url: entry.url,
          ingestedAt: new Date().toISOString(),
          transcriptIngested,
          transcriptLength: transcript.length,
        },
        embedding: embedding,
      });

      console.log(`✅ Successfully ingested: "${cleanTitle}" (Transcript: ${transcriptIngested ? `${transcript.length} chars` : "Failed, used description"})`);

      // Sleep to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();
    console.log("🎉 Ingestion complete!");
  } catch (error: any) {
    console.error("❌ Error checking RSS feed:", error.message);
  }
}

async function main() {
  const daemonMode = process.argv.includes("--daemon");
  
  if (daemonMode) {
    console.log("⏰ Running in DAEMON mode (checking every 15 minutes)...");
    // Run once immediately
    await checkAndIngestNewVideos();
    // Run every 15 minutes
    setInterval(checkAndIngestNewVideos, 15 * 60 * 1000);
  } else {
    console.log("🏃 Running in ONCE mode (checks and exits)...");
    await checkAndIngestNewVideos();
    process.exit(0);
  }
}

main().catch(console.error);
