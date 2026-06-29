import puppeteer from "puppeteer";

async function main() {
  const videoUrl = "https://www.youtube.com/watch?v=aFz1_Taa42Q";
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
  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait 4 seconds for page initial script loading
  await new Promise(r => setTimeout(r, 4000));

  // Dismiss premium modal if any
  await page.evaluate(() => {
    function queryAllShadow(root: any, filterFn: (node: any) => boolean): any[] {
      const matches: any[] = [];
      function traverse(node: any) {
        if (!node) return;
        try {
          if (filterFn(node)) {
            matches.push(node);
          }
        } catch (e) {}
        if (node.shadowRoot) traverse(node.shadowRoot);
        const children = node.children || [];
        for (const child of Array.from(children)) traverse(child);
      }
      traverse(root);
      return matches;
    }
    const buttons = queryAllShadow(document.body, (el) => {
      const text = el.textContent?.trim().toLowerCase() || "";
      const id = typeof el.id === "string" ? el.id : "";
      return id === "dismiss-button" || text === "no thanks" || text === "không, cảm ơn";
    });
    for (const btn of buttons) {
      btn.click();
      const inner = btn.querySelector("button");
      if (inner) inner.click();
    }
  });

  console.log("Expanding description...");
  await page.evaluate(() => {
    const desc = document.querySelector("#description-inline-expander") ||
                 document.querySelector("ytd-text-inline-expander") ||
                 document.querySelector("#description");
    if (desc) {
      const moreBtn = desc.querySelector("#expand") || desc.querySelector("tp-yt-paper-button#expand") || desc;
      (moreBtn as any).click();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log("Clicking 'Show transcript' button...");
  await page.evaluate(() => {
    const btn = document.querySelector("ytd-video-description-transcript-section-renderer button, ytd-button-renderer#transcript-loader-button button");
    if (btn) (btn as any).click();
  });

  console.log("Waiting 6 seconds for transcript panel to settle...");
  await new Promise(r => setTimeout(r, 6000));

  // Take screenshot
  await page.screenshot({ path: "panel-debug.png" });

  console.log("Inspecting panel DOM structure...");
  const panelDetails = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll("ytd-engagement-panel-section-renderer, #engagement-panel, [target-id='engagement-panel-searchable-transcript']"));
    
    return panels.map(panel => {
      // Find all elements that look like segments or have timestamp format
      const allElements = Array.from(panel.querySelectorAll("*"));
      const segmentsInfo = allElements.map(el => {
        const text = el.textContent?.trim() || "";
        const id = typeof el.id === "string" ? el.id : "";
        const className = typeof el.className === "string" ? el.className : "";
        const tagName = el.tagName;
        const isVisible = (el as any).offsetWidth > 0 && (el as any).offsetHeight > 0;
        return { tagName, id, className, text: text.substring(0, 100), isVisible };
      }).filter(item => 
        item.isVisible && (
          item.tagName.toLowerCase().includes("segment") ||
          item.className.toLowerCase().includes("segment") ||
          item.text.match(/^\d+:\d+/) // Starts with MM:SS
        )
      );
      
      return {
        panelId: panel.id,
        panelClass: panel.className,
        visibleTextSnippet: panel.textContent?.trim().substring(0, 500),
        segmentsFound: segmentsInfo.slice(0, 15)
      };
    });
  });

  console.log("Panel details:", JSON.stringify(panelDetails, null, 2));
  await browser.close();
}

main();
