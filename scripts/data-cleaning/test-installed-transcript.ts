import { YoutubeTranscript } from "@danielxceron/youtube-transcript";

const videoId = "at_eY6NKZZY";

async function main() {
  console.log(`📡 Fetching transcript for video ID: ${videoId}...`);
  try {
    const transcript = await (YoutubeTranscript as any).fetchTranscriptWithInnerTube(videoId);
    console.log("SUCCESS! Transcript items count:", transcript.length);
    console.log("Transcript preview:");
    const fullText = transcript.map(t => t.text).join(" ");
    console.log(fullText.substring(0, 500) + "...");
  } catch (err: any) {
    console.error("FAILED to fetch transcript:", err.message);
  }
}

main();
