import puppeteer from "puppeteer";
import { extractYoutubeTranscript } from "../lib/youtube-transcript-helper";

async function main() {
  const videoUrl = "https://www.youtube.com/watch?v=aFz1_Taa42Q"; // Đắc Nhân Tâm Quỷ Cốc Tử
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

  console.log("Navigating to:", videoUrl);
  
  try {
    const transcript = await extractYoutubeTranscript(page, videoUrl);
    console.log("Extracted transcript length:", transcript.length);
    if (transcript.length > 0) {
      console.log("Snippet:", transcript.substring(0, 300));
    }
  } catch (err: any) {
    console.error("Error in extractYoutubeTranscript:", err.message);
  }

  // Dump the transcript panel DOM
  try {
    const panelHTML = await page.evaluate(() => {
      const panel = document.querySelector("ytd-engagement-panel-section-renderer, #engagement-panel, [target-id='engagement-panel-searchable-transcript']");
      return panel ? panel.outerHTML : "Panel not found";
    });
    const fs = require("fs");
    fs.writeFileSync("panel-html-dump.html", panelHTML);
    console.log("Saved panel HTML dump to panel-html-dump.html");
  } catch (e: any) {
    console.error("Failed to dump panel HTML:", e.message);
  }

  console.log("Taking final debug screenshot...");
  await page.screenshot({ path: "youtube-debug-final.png" });
  await browser.close();
}

main();
