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

  console.log("Waiting 10 seconds for premium modal to appear...");
  await new Promise(r => setTimeout(r, 10000));

  console.log("Taking screenshot of the page...");
  await page.screenshot({ path: "modal-debug.png" });

  console.log("Analyzing elements...");
  const elements = await page.evaluate(() => {
    function queryAllShadow(root: any, filterFn: (node: any) => boolean): any[] {
      const matches: any[] = [];
      function traverse(node: any) {
        if (!node) return;
        try {
          if (filterFn(node)) {
            matches.push(node);
          }
        } catch (e) {}
        
        if (node.shadowRoot) {
          traverse(node.shadowRoot);
        }
        
        const children = node.children || [];
        for (const child of Array.from(children)) {
          traverse(child);
        }
      }
      traverse(root);
      return matches;
    }

    const matches = queryAllShadow(document.body, (el) => {
      const text = el.textContent?.trim() || "";
      const id = typeof el.id === "string" ? el.id : "";
      const className = typeof el.className === "string" ? el.className : "";
      
      const isDismissId = id.toLowerCase().includes("dismiss");
      const isNoThanksText = text.toLowerCase() === "no thanks" || text.toLowerCase() === "không, cảm ơn";
      
      return isDismissId || isNoThanksText;
    });

    return matches.map(el => {
      const text = el.textContent?.trim() || "";
      const id = typeof el.id === "string" ? el.id : "";
      const className = typeof el.className === "string" ? el.className : "";
      const tagName = el.tagName;
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return { tagName, id, className, text: text.substring(0, 100), isVisible };
    });
  });

  console.log("Matching elements:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main();
