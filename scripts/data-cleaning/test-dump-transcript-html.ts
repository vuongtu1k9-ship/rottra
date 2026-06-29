import puppeteer from "puppeteer";
import fs from "fs";

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

  // Find the transcript container
  const html = await page.evaluate(() => {
    // Look for element containing "Nhân sinh tại thế, không tức giận"
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      if (el.textContent?.includes("Nhân sinh tại thế, không tức giận") && el.tagName === "YTD-ENGAGEMENT-PANEL-SECTION-LIST-RENDERER") {
        return el.outerHTML;
      }
    }
    // Fallback: search any element containing it
    for (const el of all) {
      if (el.textContent?.includes("Nhân sinh tại thế, không tức giận") && el.id && el.id.includes("transcript")) {
        return el.outerHTML;
      }
    }
    // Fallback 2: just search any div containing it
    for (const el of all) {
      if (el.textContent?.includes("Nhân sinh tại thế, không tức giận") && el.tagName === "DIV" && el.className.includes("content")) {
        return el.outerHTML;
      }
    }
    return "NOT FOUND ANY CONTAINER CONTAINS THE TRANSCRIPT TEXT";
  });

  fs.writeFileSync("transcript-panel.html", html.substring(0, 150000));
  console.log("DUMPED PANEL HTML (Length:", html.length, ")");
  await browser.close();
}

main().catch(console.error);
