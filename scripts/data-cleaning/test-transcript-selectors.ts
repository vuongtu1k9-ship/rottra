import puppeteer from "puppeteer";

const videoUrl = "https://www.youtube.com/watch?v=OW9ZLTcIUWQ";

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(videoUrl, { waitUntil: "networkidle2" });

  // Expand description
  await page.evaluate(() => {
    const btn = document.querySelector("#expand") || document.querySelector(".ytd-text-inline-expander");
    if (btn) (btn as any).click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Show Transcript
  const transcriptButtonSelector = "ytd-video-description-transcript-section-renderer button, ytd-button-renderer#transcript-loader-button button";
  await page.evaluate((sel) => {
    const btn = document.querySelector(sel);
    if (btn) (btn as any).click();
  }, transcriptButtonSelector);
  await new Promise(r => setTimeout(r, 3000));

  // Count matches
  const counts = await page.evaluate(() => {
    return {
      "ytd-transcript-segment-renderer": document.querySelectorAll("ytd-transcript-segment-renderer").length,
      "ytd-transcript-segment-list-row-renderer": document.querySelectorAll("ytd-transcript-segment-list-row-renderer").length,
      ".segment-text": document.querySelectorAll(".segment-text").length,
      "yt-formatted-string.segment-text": document.querySelectorAll("yt-formatted-string.segment-text").length,
      ".yt-transcript-segment-renderer": document.querySelectorAll(".yt-transcript-segment-renderer").length,
      "ytd-transcript-segment-renderer yt-formatted-string": document.querySelectorAll("ytd-transcript-segment-renderer yt-formatted-string").length,
      "transcript-segments": document.querySelectorAll("[class*='transcript-segment']").length,
      "transcript-lines": document.querySelectorAll("[class*='segment-text']").length,
    };
  });

  console.log("SELECTOR COUNTS:", counts);
  await browser.close();
}

main().catch(console.error);
