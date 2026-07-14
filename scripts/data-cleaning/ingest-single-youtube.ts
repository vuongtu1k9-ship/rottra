#!/usr/bin/env bun
import { db } from "~/infra/database/db-pool";
import { vectorDocument } from "~/infra/database/schema";
import { cleanAndNormalize, generateEmbedding, initRAGEngine } from "~/core/neural-memory/vector-rag";
import { YoutubeTranscript } from "youtube-transcript";
import crypto from "crypto";

async function main() {
  const videoId = "XuzRt-BFIKU";
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const title = "7 Kỹ Thuật Bảo Mật API Bạn Phải Biết: Rate Limiting, CORS, SQL Injection, CSRF, XSS…";
  const channelHandle = "@letdiv";

  console.log(`📡 [YOUTUBE SINGLE INGEST] Starting ingestion for video: "${title}"`);

  // Load RAG vocabulary
  console.log("⚙️ Loading RAG vocabulary...");
  const { vocabulary } = await initRAGEngine();

  let transcript = "";
  let transcriptIngested = false;

  try {
    console.log(`⚡ Fetching transcript for video ID: ${videoId}...`);
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcriptItems && transcriptItems.length > 0) {
      transcript = transcriptItems.map((t: any) => t.text).join(" ");
      transcriptIngested = true;
      console.log(`✅ Successfully fetched ${transcriptItems.length} transcript fragments (${transcript.length} chars).`);
    }
  } catch (apiErr: any) {
    console.warn(`⚠️ Failed to fetch transcript: ${apiErr.message}`);
  }

  let content = "";
  if (transcriptIngested) {
    content = `Nội dung từ bài giảng YouTube "${title}": ${transcript} Xem trực tiếp tại: ${url}`;
  } else {
    // Fallback: Use description
    const fallbackDesc = "LetDiv chia sẻ các phương thức tấn công phổ biến mà các hệ thống API thường gặp phải. Video cung cấp cái nhìn sâu sắc về cách thức hoạt động của các lỗ hổng bảo mật và hướng dẫn các giải pháp kỹ thuật cần thiết để xây dựng hệ thống an toàn, bảo vệ dữ liệu người dùng hiệu quả.";
    content = `Nội dung từ bài giảng YouTube "${title}": ${fallbackDesc} Xem trực tiếp tại: ${url}`;
    console.log("⚠️ Ingesting with fallback description.");
  }

  const cleanTitle = title.normalize("NFC");
  const flatText = cleanAndNormalize(`${cleanTitle} ${content}`);
  const embedding = generateEmbedding(flatText, vocabulary);

  console.log("📥 Saving to vector database...");
  await db.insert(vectorDocument).values({
    id: crypto.randomUUID(),
    category: "YOUTUBE_WISDOM",
    title: cleanTitle,
    subtitle: `Nguồn: YouTube ${channelHandle}`,
    content: content,
    metadata: {
      source: "youtube",
      channel: channelHandle,
      url: url,
      ingestedAt: new Date().toISOString(),
      transcriptIngested,
      transcriptLength: transcript.length,
    },
    embedding: embedding,
  });

  console.log("🔥 Refreshing RAG Engine cache...");
  await initRAGEngine(true);

  console.log("🎉 Successfully ingested YouTube video into database!");
}

main().catch(console.error).finally(() => process.exit(0));
