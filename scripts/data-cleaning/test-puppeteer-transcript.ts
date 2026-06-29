import puppeteer from "puppeteer";

const videoUrl = "https://www.youtube.com/watch?v=at_eY6NKZZY";

async function main() {
  console.log("🚀 Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  console.log(`🌐 Navigating to video page: ${videoUrl}`);
  await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 45000 });

  try {
    // Chờ selector nút mô tả hoặc nút chép lời
    console.log("🔍 Đang tìm nút Show Transcript...");
    
    // Đôi khi cần click nút "...more" để hiển thị phần transcript
    console.log("Clicking expand description...");
    await page.evaluate(() => {
      const btn = document.querySelector("#expand") || document.querySelector(".ytd-text-inline-expander") || document.querySelector("#description-inline-expander") || document.querySelector("tp-yt-paper-button#expand");
      if (btn) (btn as any).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const transcriptButtonSelector = "ytd-video-description-transcript-section-renderer button, ytd-button-renderer#transcript-loader-button button";
    await page.waitForSelector(transcriptButtonSelector, { timeout: 10000 });
    console.log("✅ Found Show Transcript button. Clicking...");
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) (btn as any).click();
    }, transcriptButtonSelector);

    // Chờ panel bản chép lời xuất hiện
    console.log("⏳ Chờ nội dung bản chép lời tải...");
    const segmentsSelector = "transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer";
    await page.waitForSelector(segmentsSelector, { timeout: 15000 });

    console.log("✨ Trích xuất văn bản từ bản chép lời...");
    const transcriptText = await page.evaluate(() => {
      const segments = document.querySelectorAll("transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer");
      return Array.from(segments)
        .map(el => {
          // Chỉ lấy văn bản thực sự, bỏ qua timestamp nếu có thể
          const textSpan = el.querySelector("span, .ytAttributedStringHost");
          return textSpan ? textSpan.textContent?.trim() : el.textContent?.trim();
        })
        .filter(t => t && t.length > 0)
        .join(" ");
    });

    console.log("🎉 TRÍCH XUẤT THÀNH CÔNG! Độ dài ký tự:", transcriptText.length);
    console.log("Đoạn trích đầu:");
    console.log(transcriptText.substring(0, 1000) + "...");
  } catch (err: any) {
    console.error("❌ Thất bại khi lấy transcript bằng Puppeteer:", err.message);
    // Lưu ảnh chụp màn hình để debug
    await page.screenshot({ path: "youtube-error.png" });
    console.log("Đã lưu ảnh chụp màn hình debug vào youtube-error.png");
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
