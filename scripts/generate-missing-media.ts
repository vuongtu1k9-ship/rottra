#!/usr/bin/env bun
import { config } from "dotenv";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

config();

const API_KEY = process.env.EVOLINK_API_KEY || process.env.COCOLINK_API_KEY || "";
const EVO_URL = "https://api.evolink.ai/v1/images/generations";
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";
const PUBLIC_DIR = resolve(import.meta.dir, "../public");

const TASKS: { file: string; prompt: string }[] = [
  {
    file: "rice.jpg",
    prompt:
      "Premium commercial studio product photography of Vietnamese rice grains in a wooden bowl, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "coffee.jpg",
    prompt:
      "Premium commercial studio product photography of Vietnamese coffee beans in a burlap sack, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "tea.jpg",
    prompt:
      "Premium commercial studio product photography of Vietnamese green tea leaves in a ceramic cup, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "durian.jpg",
    prompt:
      "Premium commercial studio product photography of a whole durian fruit with cross-section showing golden flesh, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "mango.jpg",
    prompt:
      "Premium commercial studio product photography of ripe Vietnamese mangoes, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "vegetable.jpg",
    prompt:
      "Premium commercial studio product photography of mixed fresh Vietnamese vegetables including cabbage carrot and herbs, isolated on solid light grey background, high detail, studio lighting, professional product shot, 8k resolution",
  },
  {
    file: "no-image.png",
    prompt:
      "Clean minimalist placeholder icon, a grey camera icon inside a light grey rounded rectangle with subtle dashed border, text No Image below, clean vector style illustration, white background, flat design",
  },
  {
    file: "default-avatar.png",
    prompt:
      "Clean minimalist user avatar placeholder, a light grey circle with a white person silhouette icon inside, simple flat vector style illustration, white background, profile icon",
  },
];

async function generateViaEvolink(prompt: string): Promise<Buffer | null> {
  if (!API_KEY) {
    console.log("  No API key found, skipping Evolink");
    return null;
  }
  try {
    const res = await fetch(EVO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-image-2", prompt }),
    });
    if (!res.ok) {
      console.log(`  Evolink HTTP ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const json = (await res.json()) as any;
    const url = json?.data?.[0]?.url;
    if (!url) {
      console.log("  Evolink returned no image URL");
      return null;
    }
    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (e: any) {
    console.log(`  Evolink error: ${e.message}`);
    return null;
  }
}

async function generateViaPollinations(prompt: string): Promise<Buffer | null> {
  try {
    const seed = Math.floor(Math.random() * 999999);
    const url = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    console.log(`  Pollinations error: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`Generating ${TASKS.length} missing media files...\n`);

  for (const task of TASKS) {
    const dest = resolve(PUBLIC_DIR, task.file);
    if (existsSync(dest)) {
      console.log(`[SKIP] ${task.file} already exists`);
      continue;
    }

    console.log(`[GEN]  ${task.file}...`);

    let buf = await generateViaEvolink(task.prompt);
    if (buf) {
      console.log(`  -> Evolink OK (${(buf.length / 1024).toFixed(1)} KB)`);
    } else {
      console.log("  -> Trying Pollinations fallback...");
      buf = await generateViaPollinations(task.prompt);
      if (buf) {
        console.log(`  -> Pollinations OK (${(buf.length / 1024).toFixed(1)} KB)`);
      }
    }

    if (buf && buf.length > 0) {
      writeFileSync(dest, buf);
      console.log(`  -> Saved: ${dest}\n`);
    } else {
      console.log(`  -> FAILED: ${task.file}\n`);
    }
  }

  console.log("Done.");
}

main();
