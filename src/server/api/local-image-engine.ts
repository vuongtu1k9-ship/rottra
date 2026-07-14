import { createLogger } from "~/shared/logger";
import path from "node:path";
import fs from "node:fs";

const log = createLogger("api/local-image-engine");

export async function generateImageLocal(prompt: string, outputPath: string): Promise<boolean> {
  try {
    const sharp = (await import("sharp")).default;
    log.info(`[LocalDiffuser] Generating AVIF: "${prompt}"`);

    // 1. Try SceneWorks API (Local AI generation)
    try {
      const scBaseUrl = process.env.SCENEWORKS_API_URL || "http://localhost:8000/api/v1";
      const scToken = process.env.SCENEWORKS_ACCESS_TOKEN || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (scToken) {
        headers["Authorization"] = `Bearer ${scToken}`;
      }

      log.info(`[LocalDiffuser] Submitting job to SceneWorks API at ${scBaseUrl}...`);
      const submitRes = await fetch(`${scBaseUrl}/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          job_type: "image_generate",
          params: {
            prompt: prompt + ", product photography, high quality, studio lighting",
            width: 512,
            height: 512,
            steps: 20,
          },
        }),
      });

      if (submitRes.ok) {
        const jobData = (await submitRes.json()) as any;
        const jobId = jobData.id || jobData.job_id;
        if (jobId) {
          log.info(`[LocalDiffuser] Job submitted successfully. ID: ${jobId}. Polling status...`);
          let completed = false;
          let fileUrlOrPath = "";

          // Poll up to 30 times (60 seconds)
          for (let i = 0; i < 30; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const statusRes = await fetch(`${scBaseUrl}/jobs/${jobId}`, { headers });
            if (statusRes.ok) {
              const statusData = (await statusRes.json()) as any;
              log.info(`[LocalDiffuser] Polling job ${jobId}: status = ${statusData.status}`);
              if (statusData.status === "completed" || statusData.status === "success") {
                completed = true;
                const files = statusData.result?.files || statusData.files || [];
                if (files.length > 0) {
                  fileUrlOrPath = files[0];
                }
                break;
              } else if (statusData.status === "failed") {
                log.error(`[LocalDiffuser] SceneWorks job failed:`, statusData.error || "Unknown error");
                break;
              }
            } else {
              log.error(`[LocalDiffuser] Failed to fetch job status for ${jobId}`);
            }
          }

          if (completed && fileUrlOrPath) {
            log.info(`[LocalDiffuser] SceneWorks generated image: ${fileUrlOrPath}`);
            let imageBuf: Buffer;
            if (fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://")) {
              const imgRes = await fetch(fileUrlOrPath);
              imageBuf = Buffer.from(await imgRes.arrayBuffer());
            } else {
              const absolutePath = path.isAbsolute(fileUrlOrPath) ? fileUrlOrPath : path.join(process.cwd(), fileUrlOrPath);
              imageBuf = fs.readFileSync(absolutePath);
            }

            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            await sharp(imageBuf).avif({ quality: 70, effort: 4 }).toFile(outputPath);
            log.info(`[LocalDiffuser] AVIF generated from SceneWorks: ${outputPath}`);
            return true;
          }
        }
      }
    } catch (e: any) {
      log.error(`[LocalDiffuser] SceneWorks API error:`, e);
    }

    // 2. Fallback: match product to local-3d asset, convert PNG -> AVIF
    const nameLower = prompt.toLowerCase().normalize("NFC");
    let assetName = "default.png";
    if (nameLower.includes("bo") || nameLower.includes("avocado")) assetName = "avocado.png";
    else if (nameLower.includes("mat ong") || nameLower.includes("honey")) assetName = "honey.png";
    else if (nameLower.includes("tra") || nameLower.includes("tea")) assetName = "tea.png";
    else if (nameLower.includes("ca phe") || nameLower.includes("coffee")) assetName = "coffee.png";
    else if (nameLower.includes("toi") || nameLower.includes("garlic")) assetName = "garlic.png";
    else if (nameLower.includes("sam") || nameLower.includes("ginseng")) assetName = "ginseng.png";
    else if (nameLower.includes("gao") || nameLower.includes("rice")) assetName = "rice.png";
    else if (nameLower.includes("ca") || nameLower.includes("tom") || nameLower.includes("hai san")) assetName = "fish.png";
    else if (nameLower.includes("nam") || nameLower.includes("mushroom")) assetName = "mushroom.png";

    const localAssetPath = path.join(process.cwd(), "public", "images", "local-3d", assetName);
    if (fs.existsSync(localAssetPath)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      await sharp(localAssetPath).avif({ quality: 70, effort: 4 }).toFile(outputPath);
      log.info(`[LocalDiffuser] AVIF from local-3d asset: ${assetName} -> ${outputPath}`);
      return true;
    }

    // 3. Last resort: generate colored AVIF from SVG
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#f0f0f0"/><text x="256" y="256" text-anchor="middle" font-size="24" fill="#666">${prompt.substring(0, 40)}</text></svg>`;
    await sharp(Buffer.from(svg)).avif({ quality: 70, effort: 4 }).toFile(outputPath);
    log.info(`[LocalDiffuser] AVIF fallback generated: ${outputPath}`);
    return true;
  } catch (error: any) {
    log.error(`[LocalDiffuser] Error:`, error);
    return false;
  }
}
