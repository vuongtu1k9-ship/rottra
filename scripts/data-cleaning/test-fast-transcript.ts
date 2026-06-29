import puppeteer from "puppeteer";

const videoId = "OW9ZLTcIUWQ";
const url = `https://www.youtube.com/watch?v=${videoId}`;

async function main() {
  console.log("🚀 Launching Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  console.log("🌐 Navigating to watch page:", url);
  const startTime = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log(`⏱️ Navigated in ${Date.now() - startTime}ms`);

  const result = await page.evaluate(async () => {
    // 1. Find ytInitialPlayerResponse
    const playerResponse = (window as any).ytInitialPlayerResponse;
    if (!playerResponse) {
      return { error: "ytInitialPlayerResponse not found on window object" };
    }

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      return { error: "No caption tracks found" };
    }

    // Find Vietnamese or default track
    const track = captionTracks.find((t: any) => t.languageCode === "vi") || captionTracks[0];
    const baseUrl = track.baseUrl;

    try {
      const res = await fetch(baseUrl);
      const xml = await res.text();
      
      const resVtt = await fetch(baseUrl + "&fmt=vtt");
      const vtt = await resVtt.text();

      const resJson3 = await fetch(baseUrl + "&fmt=json3");
      const json3 = await resJson3.text();

      return { 
        xml, 
        vtt, 
        json3, 
        baseUrl, 
        status: res.status, 
        statusText: res.statusText,
        vttLength: vtt.length,
        json3Length: json3.length
      };
    } catch (err: any) {
      return { error: "Fetch failed in browser: " + err.message };
    }
  });

  await browser.close();

  if (result.error) {
    console.error("❌ ERROR:", result.error);
  } else {
    console.log("✅ SUCCESS!");
    console.log("Status:", result.status, result.statusText);
    console.log("Base URL:", result.baseUrl);
    console.log("XML length:", result.xml?.length);
    console.log("VTT length:", result.vttLength);
    console.log("JSON3 length:", result.json3Length);
    if (result.json3Length > 0) {
      console.log("JSON3 Preview:", result.json3.substring(0, 1000));
    }
  }
}

main().catch(console.error);
