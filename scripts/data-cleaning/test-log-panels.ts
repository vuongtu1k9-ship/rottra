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

  // Dump all divs and span tags under transcript containers
  const elements = await page.evaluate(() => {
    const results: any[] = [];
    // Search for elements containing "Nhân sinh tại thế"
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      if (el.textContent?.includes("Nhân sinh tại thế") && el.children.length === 0) {
        results.push({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          text: el.textContent.trim(),
          parentTagName: el.parentElement?.tagName,
          parentClassName: el.parentElement?.className,
          grandparentTagName: el.parentElement?.parentElement?.tagName,
          grandparentClassName: el.parentElement?.parentElement?.className
        });
      }
    }
    return results;
  });

  console.log("MATCHING ELEMENTS:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main().catch(console.error);
