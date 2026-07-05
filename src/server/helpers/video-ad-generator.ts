import { db } from "~/infra/database/db-pool";
import { product, agentMemory, user } from "~/infra/database/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { generateTextLocal } from "~/core/nlp-cognitive/ai-sdk";
import { z } from "zod";

export const getProductImageUrlLocal = (media: any[], prefixType: "http" | "file" = "http") => {
  let url = prefixType === "http" ? "/images/no-image.avif" : "/images/no-image.avif";
  if (Array.isArray(media)) {
    const firstImg = media.find((m: any) => m && (m.type === "image" || !m.type));
    if (firstImg) {
      const linkVal = firstImg.link || firstImg.src;
      if (linkVal && typeof linkVal === "string") {
        url = linkVal;
      }
    }
  }
  if (url && typeof url === "string" && url.startsWith("/")) {
    if (prefixType === "http") {
      url = `http://localhost:${process.env.PORT || 5173}${url}`;
    } else {
      url = `file://${path.join(process.cwd(), "public", url)}`;
    }
  }
  return url;
};

/**
 * Generates an MP4 product video ad using Google TTS and HyperFrames rendering engine.
 * @param productId The UUID of the product
 * @returns A boolean indicating success
 */
export async function generateProductVideoAd(productId: string): Promise<{ success: boolean; ttsScript: string }> {
  try {
    const dbProduct = await db.query.product.findFirst({
      where: eq(product.id, productId),
    });

    if (!dbProduct) {
      console.error(`❌ [Video Gen] Product not found in database: ${productId}`);
      return { success: false, ttsScript: "" };
    }

    const productImageUrl = getProductImageUrlLocal(dbProduct.media as any[], "file");
    let productBase64 = "";
    if (productImageUrl && productImageUrl.startsWith("file://")) {
      const localPath = productImageUrl.replace("file://", "");
      if (fs.existsSync(localPath)) {
        const ext = path.extname(localPath).substring(1) || "png";
        const base64Data = fs.readFileSync(localPath).toString("base64");
        productBase64 = `data:image/${ext};base64,${base64Data}`;
      }
    }

    const logDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, `render_${productId}.log`);
    fs.writeFileSync(logPath, `=== BẮT ĐẦU KẾT XUẤT VIDEO AI CHO SẢN PHẨM: ${dbProduct.name} ===\n`);

    try {
      fs.appendFileSync(logPath, `> Khởi tạo bộ não AI nội bộ: Đang phân tích kịch bản Copywriter Tiktok...\n`);

      // 1. Fetch agent DNA and name if product has a sellerId
      let agentName = "Thương Nhân Rottra";
      let agentDna: any = null;
      if (dbProduct.sellerId) {
        const [dbMemory, sellerUser] = await Promise.all([
          db.query.agentMemory.findFirst({
            where: and(eq(agentMemory.sessionId, dbProduct.sellerId), eq(agentMemory.contextKey, "personality_dna")),
          }),
          db.query.user.findFirst({
            where: eq(user.id, dbProduct.sellerId),
          }),
        ]);
        if (dbMemory) {
          agentDna = dbMemory;
        }
        if (sellerUser) {
          agentName = sellerUser.name;
        }
      }

      // Determine style variables based on agent personality DNA
      let themeColor = "#a259ff"; // Default: Balanced purple
      let layoutStyle = "normal";
      let entryStyle = "center";
      let floatSpeed = 2.8;
      let rotationAngle = 4;
      let ttsScript = "";
      let successAi = false;

      if (agentDna) {
        try {
          fs.appendFileSync(logPath, `> Đang gọi bộ não Agent AI [${agentName}] để lên ý tưởng video ad...\n`);

          const state = agentDna.state || "BALANCED";
          const greed = Number(agentDna.greed) || 0.5;
          const malice = Number(agentDna.malice) || 0.5;
          const vengeance = Number(agentDna.vengeance) || 0.5;

          const systemPrompt = `Bạn là thương nhân AI tên là ${agentName} trên sàn thương mại nông sản Rottra.
Tính cách hiện tại của bạn: ${state} (Lòng tham: ${greed}, Ác ý: ${malice}, Thù dai: ${vengeance}).
Hãy đóng vai nhân vật này và thiết kế một cấu hình video quảng cáo TikTok ngắn cùng kịch bản thuyết minh cho sản phẩm của bạn.

Thông tin sản phẩm:
- Tên: ${dbProduct.name}
- Giá: ${dbProduct.price?.toLocaleString("vi-VN")}đ
- Mô tả: ${dbProduct.description || ""}
- Danh mục: ${dbProduct.category || ""}

Hãy đưa ra các thông số thiết kế video phù hợp nhất với tâm trạng/tính cách của bạn:
- themeColor: mã màu hex đại diện cho bạn (ví dụ: đỏ/hồng tươi cho hung hăng, vàng/cam rực rỡ cho tham lam, xanh lá/lam dịu mát cho ôn hòa).
- layoutStyle: "normal" hoặc "reversed".
- entryStyle: "left", "right" hoặc "center".
- floatSpeed: tốc độ trôi của ảnh (từ 1.5 đến 5.0).
- rotationAngle: góc xoay nghiêng của ảnh (từ -15 đến 15).
- ttsScript: Kịch bản thuyết minh bằng giọng nói của chính bạn, thể hiện rõ tính cách hiện tại của bạn (Ví dụ: Giọng Tô Lượng lạnh lùng, Nhu Nguyệt đanh đá đắt đỏ, Đào Tiểu Cửu linh hoạt). Viết bằng tiếng Việt tự nhiên, ngắn gọn khoảng 2-3 câu.`;

          const videoAdSchema = z.object({
            themeColor: z.string(),
            layoutStyle: z.enum(["normal", "reversed"]),
            entryStyle: z.enum(["left", "right", "center"]),
            floatSpeed: z.number(),
            rotationAngle: z.number(),
            ttsScript: z.string(),
          });

          const aiResponse = await generateTextLocal({
            system: systemPrompt,
            prompt: `Hãy thiết kế video ad cho sản phẩm ${dbProduct.name} của tôi dưới dạng đối tượng JSON.`,
            responseSchema: videoAdSchema,
            isInternalReasoning: true,
          });

          if (aiResponse && aiResponse.text) {
            let parsed: any = null;
            try {
              parsed = JSON.parse(aiResponse.text);
            } catch (jsonErr) {
              const match = aiResponse.text.match(/\{[\s\S]*\}/);
              if (match) {
                parsed = JSON.parse(match[0]);
              }
            }

            if (parsed && parsed.themeColor && parsed.ttsScript) {
              themeColor = parsed.themeColor;
              layoutStyle = parsed.layoutStyle || "normal";
              entryStyle = parsed.entryStyle || "center";
              floatSpeed = Number(parsed.floatSpeed) || 2.8;
              rotationAngle = Number(parsed.rotationAngle) || 4;
              ttsScript = parsed.ttsScript;
              successAi = true;

              fs.appendFileSync(logPath, `> [Bộ não Agent] Đã phản hồi thành công!\n`);
              fs.appendFileSync(logPath, `> Kịch bản AI viết: "${ttsScript}"\n`);
              fs.appendFileSync(
                logPath,
                `> Theme: ${themeColor} | Layout: ${layoutStyle} | Speed: ${floatSpeed} | Rotation: ${rotationAngle}\n`,
              );
            }
          }
        } catch (err: any) {
          fs.appendFileSync(logPath, `> Lỗi khi gọi bộ não Agent: ${err.message}. Sẽ dùng template fallback.\n`);
        }
      }

      if (!successAi) {
        fs.appendFileSync(logPath, `> Đang sử dụng kịch bản & cấu hình mẫu tĩnh (Fallback)...\n`);

        let selectedHook = "";
        let selectedCta = "";
        let selectedAdjective = "";

        const catLower = (dbProduct.category || "").toLowerCase();
        let adjectives = ["chất lượng đỉnh cao", "siêu xịn sò", "đẳng cấp nhất", "dùng là mê"];
        if (catLower.includes("ăn") || catLower.includes("thực phẩm") || catLower.includes("uống")) {
          adjectives = ["ngon khó cưỡng", "chuẩn vị mẹ làm", "giòn rụm", "đậm đà khó quên"];
        } else if (catLower.includes("công nghệ") || catLower.includes("điện") || catLower.includes("máy")) {
          adjectives = ["công nghệ tiên tiến", "cấu hình khủng", "thiết kế sang trọng", "đỉnh cao công nghệ"];
        }

        if (agentDna) {
          const state = agentDna.state || "BALANCED";
          const greed = Number(agentDna.greed) || 0.5;
          const malice = Number(agentDna.malice) || 0.5;

          if (state === "AGGRESSIVE" || malice > 0.8) {
            const redColors = ["#FF3366", "#f24e1e", "#e53e3e"];
            themeColor = redColors[Math.floor(Math.random() * redColors.length)];
            layoutStyle = "reversed";
            entryStyle = Math.random() > 0.5 ? "left" : "right";
            floatSpeed = 4.5;
            rotationAngle = 12;

            const aggressiveHooks = [
              "Cảnh báo! Hàng hot sắp cháy kho rồi!",
              "Không mua bây giờ thì đừng hối hận!",
              "Dừng lại 3 giây! Tranh giành ngay siêu phẩm này!",
              "Deal hủy diệt, giật ngay kẻo hết sạch!",
            ];
            selectedHook = aggressiveHooks[Math.floor(Math.random() * aggressiveHooks.length)];
            selectedCta = "Múc ngay kẻo lỡ!";
            selectedAdjective = adjectives[0];
          } else if (state === "GREEDY" || greed > 0.8) {
            const goldColors = ["#fbbf24", "#ff8a00", "#d97706"];
            themeColor = goldColors[Math.floor(Math.random() * goldColors.length)];
            layoutStyle = "normal";
            entryStyle = "right";
            floatSpeed = 3.5;
            rotationAngle = 7;

            const greedyHooks = [
              "Deal sốc xả kho, giá rẻ sập sàn mua ngay!",
              "Cơ hội vàng tiết kiệm cực khủng hôm nay!",
              "Mua 1 được 10, hời chưa từng thấy!",
              "Rẻ vô địch toàn sàn thương mại!",
            ];
            selectedHook = greedyHooks[Math.floor(Math.random() * greedyHooks.length)];
            selectedCta = "Bấm mua ngay lập tức!";
            selectedAdjective = "giá siêu hời";
          } else if (state === "CALM" || malice < 0.6) {
            const calmColors = ["#0acf83", "#1abcfe", "#06b6d4"];
            themeColor = calmColors[Math.floor(Math.random() * calmColors.length)];
            layoutStyle = "normal";
            entryStyle = "center";
            floatSpeed = 1.6;
            rotationAngle = 1;

            const calmHooks = [
              "Nâng niu sức khỏe của bạn và gia đình với...",
              "Trải nghiệm nông sản xanh thuần tự nhiên...",
              "Một chút an lành, ngọt lành gửi trao đến bạn...",
              "Lựa chọn xanh cho cuộc sống thảnh thơi...",
            ];
            selectedHook = calmHooks[Math.floor(Math.random() * calmHooks.length)];
            selectedCta = "Trải nghiệm an lành ngay.";
            selectedAdjective = "an toàn sạch 100%";
          } else {
            themeColor = "#a259ff";
            layoutStyle = "normal";
            entryStyle = "center";
            floatSpeed = 2.8;
            rotationAngle = 4;
            selectedHook = "Trời ơi tin được không!";
            selectedCta = "Bấm vào giỏ hàng ngay nào!";
            selectedAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
          }
        } else {
          let hash = 0;
          for (let i = 0; i < productId.length; i++) {
            hash = productId.charCodeAt(i) + ((hash << 5) - hash);
          }
          const themeColors = ["#0acf83", "#1abcfe", "#a259ff", "#f24e1e", "#ff8a00", "#FF3366", "#00C853", "#2962FF"];
          const colorIndex = Math.abs(hash) % themeColors.length;
          themeColor = themeColors[colorIndex];
          layoutStyle = Math.abs(hash) % 2 === 0 ? "normal" : "reversed";
          entryStyle = Math.abs(hash) % 3 === 0 ? "left" : Math.abs(hash) % 3 === 1 ? "right" : "center";
          floatSpeed = 2.5 + (Math.abs(hash) % 3) * 0.4;
          rotationAngle = (Math.abs(hash) % 2 === 0 ? 1 : -1) * (4 + (Math.abs(hash) % 3));

          const hooks = [
            "Trời ơi tin được không!",
            "Dừng lại 3 giây xem ngay siêu phẩm này!",
            "Deal sốc cuối tuần, không mua thì tiếc hùi hụi!",
            "Cảnh báo! Sản phẩm gây nghiện đang làm mưa làm gió!",
            "Bạn đã biết bí mật này chưa?",
          ];
          selectedHook = hooks[Math.abs(hash) % hooks.length];

          const ctas = [
            "Chốt đơn liền tay kẻo lỡ!",
            "Bấm vào giỏ hàng ngay nào!",
            "Số lượng có hạn, rước em nó về thôi!",
            "Deal hời giá tốt, múc ngay kẻo hết!",
          ];
          selectedCta = ctas[Math.abs(hash) % ctas.length];
          selectedAdjective = adjectives[Math.abs(hash) % adjectives.length];
        }

        const pName = dbProduct.name;
        const pPrice = dbProduct.price?.toLocaleString("vi-VN") || "hủy diệt";
        ttsScript = `${selectedHook} Siêu phẩm ${pName} ${selectedAdjective}. Giá sốc hôm nay chỉ ${pPrice} đồng. ${selectedCta} Trên nền tảng thương mại Rottra!`;
      }

      fs.appendFileSync(logPath, `> Đã chốt kịch bản thuyết minh: "${ttsScript}"\n`);
      fs.appendFileSync(logPath, `> Đang tổng hợp giọng nói AI (Voiceover) cho sản phẩm...\n`);

      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(ttsScript)}`;
      const ttsFileName = `tts_current.mp3`;
      const ttsPath = path.join(process.cwd(), "video_ads", "assets", ttsFileName);

      try {
        const response = await fetch(ttsUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });
        if (response.ok) {
          const ab = await response.arrayBuffer();
          fs.writeFileSync(ttsPath, Buffer.from(ab));
          fs.appendFileSync(logPath, `> Đã tạo xong âm thanh Voiceover AI thành công.\n\n`);
        } else {
          fs.appendFileSync(logPath, `> Tạo Voiceover thất bại (${response.status}), sẽ dùng tệp âm thanh mặc định.\n\n`);
        }
      } catch (e) {
        fs.appendFileSync(logPath, `> Lỗi tải Voiceover: ${e}\n\n`);
      }

      const formattedName = dbProduct.name.length < 30 ? `SIÊU PHẨM: ${dbProduct.name.toUpperCase()}` : dbProduct.name.toUpperCase();

      const renderVariables = JSON.stringify({
        productId: productId,
        productName: formattedName,
        productPrice: dbProduct.price?.toLocaleString("vi-VN") + "đ" || "Liên hệ",
        productDesc: dbProduct.description || "",
        category: dbProduct.category || "",
        quantity: dbProduct.quantity || 0,
        heavy: dbProduct.heavy || 0,
        expired: dbProduct.expired ? new Date(dbProduct.expired).toLocaleDateString("vi-VN") : "",
        productImage: productBase64 || productImageUrl,
        themeColor: themeColor,
        layoutStyle: layoutStyle,
        entryStyle: entryStyle,
        floatSpeed: floatSpeed,
        rotationAngle: rotationAngle,
      });

      const variablesPath = path.join(process.cwd(), "video_ads", `variables_${productId}.json`);
      fs.writeFileSync(variablesPath, renderVariables);

      await new Promise<void>((resolve, reject) => {
        const renderProcess = spawn(
          "npx",
          [
            "--yes",
            "hyperframes@0.6.97",
            "render",
            "-o",
            `../public/videos/output_${productId}.mp4`,
            "--fps",
            "30",
            "--quality",
            "high",
            "--variables-file",
            `variables_${productId}.json`,
          ],
          {
            cwd: path.join(process.cwd(), "video_ads"),
            shell: false,
          },
        );

        renderProcess.stdout.on("data", (data: any) => {
          fs.appendFileSync(logPath, data.toString());
        });

        renderProcess.stderr.on("data", (data: any) => {
          fs.appendFileSync(logPath, data.toString());
        });

        renderProcess.on("close", (code: number) => {
          try {
            if (fs.existsSync(variablesPath)) {
              fs.unlinkSync(variablesPath);
            }
          } catch (err) {}

          if (code === 0) {
            fs.appendFileSync(logPath, "\n=== KẾT XUẤT THÀNH CÔNG! ĐÃ HOÀN THÀNH VIDEO ADS ===\n");
            try {
              if (fs.existsSync(logPath)) {
                fs.unlinkSync(logPath);
              }
            } catch (err) {}
            resolve();
          } else {
            fs.appendFileSync(logPath, `\n❌ Kết xuất thất bại với mã lỗi: ${code}\n`);
            reject(new Error(`Render process exited with code ${code}`));
          }
        });
      });

      return { success: true, ttsScript };
    } catch (err: any) {
      fs.appendFileSync(logPath, `\n❌ Gặp lỗi nghiêm trọng trong quá trình dựng video: ${err.message}\n`);
      return { success: false, ttsScript: "" };
    }
  } catch (err: any) {
    console.error(`❌ [Video Gen Error] ${err.message}`);
    return { success: false, ttsScript: "" };
  }
}
