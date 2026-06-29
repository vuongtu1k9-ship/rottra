const videoUrl = "https://www.youtube.com/watch?v=OW9ZLTcIUWQ";

async function main() {
  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
  });
  const html = await res.text();
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/);
  if (!match) {
    console.log("Could not find ytInitialPlayerResponse");
    return;
  }
  const playerResponse = JSON.parse(match[1]);
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  console.log("Tracks:", JSON.stringify(captionTracks, null, 2));
}

main().catch(console.error);
