import puppeteer from "puppeteer";

async function testAudio() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on("console", msg => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err.message));
  await page.goto("https://rottra.pages.dev/profile/phi-nguyet", { waitUntil: "networkidle0" });
  
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log("HTML Length:", html.length);
  console.log("Contains phiNguyet:", html.includes("phiNguyet"));
  console.log("Contains Phi Nguyệt:", html.includes("Phi Nguyệt"));
  console.log("Contains audio:", html.includes("audio"));
  
  await browser.close();
}

testAudio();
