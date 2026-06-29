const videoId = "OW9ZLTcIUWQ";
const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=vi`;

async function main() {
  console.log("Fetching direct timedtext url:", url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body length:", text.length);
  console.log("Body preview:", text.substring(0, 300));
}
main().catch(console.error);
