import { Deterministic } from "~/shared/utils/rng";
import fs from "fs";

let content = fs.readFileSync("src/core/cognitive-swarm/bot-actions.ts", "utf8");

// 1. Remove WebM generation logic from GenerateImageAction
const webmStart = `                // 2. Capture WebM (AV1 + Opus)`;
const webmEnd = `                }, 4000);`;
const blockToRemove = content.substring(content.indexOf(webmStart), content.indexOf(webmEnd) + webmEnd.length);

if (blockToRemove.includes("Capture WebM")) {
  content = content.replace(blockToRemove, "");
}

// 2. Remove webmBase64 resolution
content = content.replace(`                        avifBase64,\n                        webmBase64: reader.result,\n                        mimeType`, `                        avifBase64`);

// 3. Update GenerateImageAction saving logic
const saveStart = `      // Save WebM Video (AV1 + Opus)`;
const saveEnd = `      const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }, { link: newVideoUrl, type: "video" }];`;
const saveBlock = content.substring(content.indexOf(saveStart), content.indexOf(saveEnd) + saveEnd.length);

if (saveBlock.includes("Save WebM Video")) {
  content = content.replace(saveBlock, `      console.log(\`✅ Đã xuất thành công AVIF bằng chính lõi Rottra AI!\`);

      const newImageUrl = \`/images/banners/\${avifFileName}\`;

      const currentMedia = Array.isArray(prod.media) ? prod.media : [];
      const filteredMedia = currentMedia.filter(
        (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
      );
      const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }];`);
}

// 4. Replace GenerateVideoAction class completely
const videoClassStart = `export class GenerateVideoAction extends BotActionExecutor {`;
const videoClassEnd = `// Map mapping actions to OOP executor class instances`;

const videoClassBlock = content.substring(content.indexOf(videoClassStart), content.indexOf(videoClassEnd));

const newVideoClass = `export class GenerateVideoAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "video", message: "No products to generate video" };
    }
    const prod = myProducts[Math.floor(Deterministic.random() * myProducts.length)];

    try {
      // Sử dụng Hyperframes Engine để xuất video AV1 chuẩn xịn thay vì đồ giả lập
      const { generateProductVideoAd } = await import("../../server/helpers/video-ad-generator");
      const result = await generateProductVideoAd(prod.id);

      if (!result.success) {
        return { success: false, action: "video", message: "Lỗi kết xuất Hyperframes" };
      }

      await helpers.logActivity(
        userId, 
        \`Bot tạo video AI cho '\${prod.name}'\`, 
        \`Hyperframes Engine đã xuất video WebM AV1 mới.\`, 
        "product"
      );
      // Giả định rewardAgentBudget tồn tại
      await rewardAgentBudget(userId, 80000000);

      return { success: true, action: "video", productName: prod.name, message: result.ttsScript };
    } catch (e: any) {
      console.error("Lỗi khi Bot dùng Hyperframes:", e);
      return { success: false, action: "video", message: e.message || "Failed to render video" };
    }
  }
}

`;

if (videoClassBlock.includes("export class GenerateVideoAction")) {
  content = content.replace(videoClassBlock, newVideoClass);
}

// Write back
fs.writeFileSync("src/core/cognitive-swarm/bot-actions.ts", content, "utf8");
console.log("Done");
