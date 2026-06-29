import puppeteer, { Browser, Page } from "puppeteer";

export class AgentScraper {
  private browser: Browser | null = null;
  private static readonly NAVIGATION_TIMEOUT = 90_000;
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 2_000;

  async launchAgentBrowser() {
    if (!this.browser) {
      console.log("[AGENT SCRAPER] Launching headless browser...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920x1080",
        ],
      });
      this.browser.on("disconnected", () => {
        this.browser = null;
      });
    }
    return this.browser;
  }

  async extractSecureData<T>(url: string, extractScript: () => T | Promise<T>, auth?: { cookies?: any[] }): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= AgentScraper.MAX_RETRIES; attempt++) {
      let page: Page | null = null;
      try {
        const browser = await this.launchAgentBrowser();
        page = await browser.newPage();

        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );
        await page.setExtraHTTPHeaders({
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        });

        if (auth?.cookies) {
          await page.setCookie(...auth.cookies);
        }

        console.log(`[AGENT SCRAPER] Navigating to: ${url} (attempt ${attempt}/${AgentScraper.MAX_RETRIES})`);
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: AgentScraper.NAVIGATION_TIMEOUT,
        });

        const closed = page.isClosed();
        if (closed) throw new Error("Page closed before extraction");

        const data = await page.evaluate(extractScript);
        return data;
      } catch (error: any) {
        lastError = error;
        const isTimeout = error.message?.includes("Timeout") || error.message?.includes("timeout");
        const isClosed = error.message?.includes("Target closed") || error.message?.includes("detached");

        if (isTimeout) {
          console.warn(`[AGENT SCRAPER] Navigation timeout (attempt ${attempt}): ${url}`);
        } else if (isClosed) {
          console.warn(`[AGENT SCRAPER] Page closed during extraction (attempt ${attempt})`);
        } else {
          console.error(`[AGENT SCRAPER] Error (attempt ${attempt}):`, error.message?.slice(0, 200));
        }

        if (attempt < AgentScraper.MAX_RETRIES) {
          const delay = AgentScraper.BASE_DELAY_MS * attempt;
          console.log(`[AGENT SCRAPER] Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }

        try {
          if (page && !page.isClosed()) await page.close();
        } catch {}
      }
    }

    throw lastError ?? new Error(`[AGENT SCRAPER] All ${AgentScraper.MAX_RETRIES} attempts failed for ${url}`);
  }

  async cleanup() {
    if (this.browser) {
      console.log("[AGENT SCRAPER] Closing browser and cleaning up memory...");
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const agentScraper = new AgentScraper();
