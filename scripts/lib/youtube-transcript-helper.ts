import { Page } from "puppeteer";

/**
 * Extracts the full transcript of a YouTube video using a Puppeteer Page instance.
 * @param page The Puppeteer Page instance to use.
 * @param videoUrl The YouTube watch URL.
 * @returns The full transcript string, or empty string if not found/disabled.
 */
async function dismissPopups(page: Page) {
  try {
    const dismissed = await page.evaluate(() => {
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

      function clickElement(el: any) {
        if (!el) return;
        try {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          });
          el.dispatchEvent(clickEvent);
        } catch (e) {}
        try {
          if (typeof el.click === "function") {
            el.click();
          }
        } catch (e) {}
      }

      const buttons = queryAllShadow(document.body, (el) => {
        const text = el.textContent?.trim().toLowerCase() || "";
        const id = typeof el.id === "string" ? el.id : "";
        const isDismissBtn = id === "dismiss-button" || id.includes("dismiss-button");
        const isNoThanks = text === "no thanks" || text === "không, cảm ơn";
        return isDismissBtn || isNoThanks;
      });

      let clicked = false;
      for (const btn of buttons) {
        clickElement(btn);
        const innerBtn = btn.querySelector("button, a, [role='button'], #button");
        if (innerBtn) {
          clickElement(innerBtn);
        }
        clicked = true;
      }
      return clicked;
    });

    if (dismissed) {
      console.log("[TRANSCRIPT EXTRACTOR] Clicked popup/dialog dismiss button inside shadow DOM.");
    }
  } catch (err: any) {
    // Ignore errors
  }
}

export async function extractYoutubeTranscript(page: Page, videoUrl: string): Promise<string> {
  try {
    await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Dismiss any immediate popups
    await dismissPopups(page);

    // 1. Expand the video description to make sure transcript button is accessible
    const expandSelector = "#expand, .ytd-text-inline-expander, #description-inline-expander, tp-yt-paper-button#expand";
    try {
      await page.waitForSelector(expandSelector, { timeout: 15000 });
      await dismissPopups(page);
      await page.evaluate(() => {
        const descContainer = document.querySelector("#description-inline-expander") ||
                              document.querySelector("ytd-text-inline-expander") ||
                              document.querySelector("#description");
        if (descContainer) {
          const moreBtn = descContainer.querySelector("#expand") || 
                          descContainer.querySelector("tp-yt-paper-button#expand") ||
                          descContainer;
          (moreBtn as any).click();
        } else {
          const fallbackBtn = document.querySelector("#expand");
          if (fallbackBtn) (fallbackBtn as any).click();
        }
      });
    } catch (e) {
      console.log(`[TRANSCRIPT EXTRACTOR] Warn: Expand button not found or timed out.`);
    }

    // Give a short moment for description layout shift
    await new Promise(r => setTimeout(r, 1000));

    // 2. Click the "Show transcript" button
    const transcriptButtonSelector = "ytd-video-description-transcript-section-renderer button, ytd-button-renderer#transcript-loader-button button";
    
    try {
      await page.waitForSelector(transcriptButtonSelector, { timeout: 10000 });
      await dismissPopups(page);
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) (btn as any).click();
      }, transcriptButtonSelector);
    } catch (e) {
      console.log(`[TRANSCRIPT EXTRACTOR] "Show transcript" button not found or timed out.`);
      return "";
    }

    // 3. Wait for the transcript segments container to load with a retry loop that dismisses popups
    const segmentsSelector = "transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost, ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer";
    let segmentsLoaded = false;
    for (let attempts = 0; attempts < 15; attempts++) {
      segmentsLoaded = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length > 0;
      }, segmentsSelector);
      
      if (segmentsLoaded) break;
      
      await dismissPopups(page);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!segmentsLoaded) {
      console.log(`[TRANSCRIPT EXTRACTOR] Timed out waiting for transcript segments. Disabled or failed to load.`);
      return "";
    }

    // 4. Extract and join the transcript segment texts
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

    console.log(`[TRANSCRIPT EXTRACTOR] Successfully extracted ${transcriptText.length} characters of transcript.`);
    return transcriptText;
  } catch (err: any) {
    console.error(`[TRANSCRIPT EXTRACTOR] Error extracting transcript for ${videoUrl}:`, err.message);
    return "";
  }
}
