import puppeteer from "puppeteer";

const videoUrl = "https://www.youtube.com/watch?v=OW9ZLTcIUWQ";

async function main() {
  console.log("🚀 Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  
  // Enable request interception to block unnecessary assets
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (["image", "font", "media"].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  console.log(`🌐 Navigating to video page: ${videoUrl}`);
  const startTime = Date.now();
  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log(`⏱️ Navigated in ${Date.now() - startTime}ms`);

  try {
    console.log("Clicking expand description...");
    await page.evaluate(() => {
      const btn = document.querySelector("#expand") || 
                  document.querySelector(".ytd-text-inline-expander") || 
                  document.querySelector("#description-inline-expander") || 
                  document.querySelector("tp-yt-paper-button#expand");
      if (btn) (btn as any).click();
    });
    
    await new Promise(r => setTimeout(r, 1000));

    console.log("🔍 Finding Show Transcript button...");
    const transcriptButtonSelector = "ytd-video-description-transcript-section-renderer button, ytd-button-renderer#transcript-loader-button button";
    
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) (btn as any).click();
    }, transcriptButtonSelector);

    console.log("⏳ Waiting for transcript segments...");
    const segmentsSelector = "transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer";
    await page.waitForSelector(segmentsSelector, { timeout: 10000 });

    console.log("✨ Extracting transcript...");
    const transcriptText = await page.evaluate(() => {
      const segments = document.querySelectorAll("transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer");
      return Array.from(segments)
        .map(el => {
          const textSpan = el.querySelector("span, .ytAttributedStringHost");
          return textSpan ? textSpan.textContent?.trim() : el.textContent?.trim();
        })
        .filter(t => t && t.length > 0)
        .join(" ");
    });

    console.log(`🎉 SUCCESS! Length: ${transcriptText.length}`);
    console.log("Preview:", transcriptText.substring(0, 300) + "...");
  } catch (err: any) {
    console.error("❌ FAILED:", err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
