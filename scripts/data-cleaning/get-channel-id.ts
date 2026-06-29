async function main() {
  const url = "https://www.youtube.com/@trituenhansinh";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  const match = html.match(/"channelId":"([^"]+)"/) || html.match(/<meta itemprop="channelId" content="([^"]+)"/);
  if (match) {
    console.log("Channel ID found:", match[1]);
  } else {
    console.log("Channel ID not found in HTML. Trying other matches...");
    const urlMatch = html.match(/youtube\.com\/channel\/([^"]+)/);
    if (urlMatch) {
      console.log("Channel ID from URL:", urlMatch[1]);
    } else {
      console.log("Could not resolve Channel ID.");
    }
  }
}
main();
