import { $ } from "bun";

const PORT = 5173;

console.log(`⚡ Starting Cloudflare Tunnel to http://127.0.0.1:${PORT}...`);

// Start the tunnel using Bun's native spawn
const cloudflared = Bun.spawn(["bun", "x", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${PORT}`], {
  stdout: "pipe",
  stderr: "pipe",
});

let tunnelUrl = "";

// Process stdout stream using Bun-native reader
(async () => {
  const reader = cloudflared.stdout.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    process.stdout.write(text);
    checkForUrl(text);
  }
})();

// Process stderr stream using Bun-native reader
(async () => {
  const reader = cloudflared.stderr.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    process.stderr.write(text);
    checkForUrl(text);
  }
})();

function checkForUrl(output: string) {
  if (tunnelUrl) return;
  const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    tunnelUrl = match[0];
    console.log(`\n🎉 Found Tunnel URL: ${tunnelUrl}`);
    publishUrl(tunnelUrl);
  }
}

async function publishUrl(url: string) {
  console.log("📤 Publishing Tunnel URL to Cloudflare KV (ROTTRA_KV)...");
  try {
    await $`bun x wrangler kv key put --binding=ROTTRA_KV --remote TUNNEL_URL "${url}"`;
    console.log("✅ Successfully published URL to Cloudflare KV!");
    console.log("🚀 Your live website rottra.pages.dev is now connected to your laptop database!");
  } catch (err: any) {
    console.error("❌ Failed to publish URL to KV:", err.message);
  }
}

async function cleanup() {
  if (tunnelUrl) {
    console.log("\n🧹 Cleaning up Cloudflare KV...");
    try {
      await $`bun x wrangler kv key delete --binding=ROTTRA_KV --remote TUNNEL_URL`;
    } catch {}
    console.log("👋 Offline mode activated. Goodbye!");
  }
  process.exit(0);
}

// Handle termination signals
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => {
  if (tunnelUrl) {
    // Run synchronous cleanup command using Bun-native spawnSync
    Bun.spawnSync(["bun", "x", "wrangler", "kv", "key", "delete", "--binding=ROTTRA_KV", "--remote", "TUNNEL_URL"]);
  }
});
