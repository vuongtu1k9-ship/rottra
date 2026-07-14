import { Deterministic } from "~/shared/utils/rng";
import { db, pgClient } from "~/infra/database/db-pool";
import { product, review, cart, orderItem, user } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import { sanitizeProductMedia } from "~/server/helpers/media-validator";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { serverAgentBudgets } from "~/shared/constants";
import { generateProductSVG } from "~/server/api/local-media-engine";

async function rewardAgentBudget(userId: string, amount: number) {
  try {
    const dbUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (dbUser) {
      const existingProfile = (dbUser.profile as any) || {};
      const currentBudget = existingProfile.budget ?? serverAgentBudgets[userId] ?? 0;
      const updatedProfile = {
        ...existingProfile,
        budget: currentBudget + amount,
      };
      await db.update(user).set({ profile: updatedProfile }).where(eq(user.id, userId));
    }
  } catch (err) {
    console.warn("Failed to reward agent budget:", err);
  }
}

export interface BotActionResult {
  success: boolean;
  action: string;
  productName?: string;
  newPrice?: number;
  imageUrl?: string;
  videoUrl?: string;
  message?: string;
}

export interface BotActionHelpers {
  logActivity: (userId: string, action: string, message: string, level: string) => Promise<void>;
  getProductImageUrl: (media: any[], prefixType: "http" | "file") => string;
  getPreciseImageForProduct: (productName: string, category: string) => Promise<string>;
}

export abstract class BotActionExecutor {
  abstract execute(userId: string, agentId: string, helpers: BotActionHelpers, args?: any): Promise<BotActionResult>;
}

export class AddProductAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, args?: any): Promise<BotActionResult> {
    const agriculturalProducts = [
      { name: "Sâm Ngọc Linh Kon Tum 🌿", category: "Dược liệu", description: "Sâm rừng tự nhiên quý hiếm", price: 4500000, quantity: 50 },
      { name: "Bơ sáp Đắk Lắk 🥑", category: "Trái cây", description: "Bơ sáp dẻo béo ngậy loại 1", price: 35000, quantity: 500 },
      {
        name: "Mật ong rừng Tràm 🔥",
        category: "Gia vị",
        description: "Mật ong nguyên chất tự nhiên khai thác tại rừng Tràm",
        price: 250000,
        quantity: 200,
      },
      {
        name: "Chè Shan Tuyết cổ thụ 🍃",
        category: "Trà",
        description: "Lá trà hái thủ công từ cây cổ thụ trăm tuổi",
        price: 1200000,
        quantity: 80,
      },
    ];

    const template = agriculturalProducts[Math.floor(Deterministic.random() * agriculturalProducts.length)];
    const uniqueName = args?.name ? args.name : `${template.name} (Lô ${Math.floor(Deterministic.random() * 1000)})`;
    const prodCategory = args?.category || template.category;
    const prodDescription = args?.description || template.description;
    const prodPrice = args?.price !== undefined ? Number(args.price) : template.price;
    const prodQuantity = args?.quantity !== undefined ? Number(args.quantity) : template.quantity;

    const svgStr = generateProductSVG(agentId, uniqueName, prodPrice.toString());
    const matchedImg = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;

    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: uniqueName,
      description: prodDescription,
      price: prodPrice,
      category: prodCategory,
      quantity: prodQuantity,
      heavy: 500,
      expired: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: true,
      sellerId: userId,
      media: sanitizeProductMedia([{ link: matchedImg, name: uniqueName, type: "image/jpeg" }]),
    });

    await helpers.logActivity(userId, `Bot thêm sản phẩm mới '${uniqueName}'`, `Hệ thống tự động thêm sản phẩm mới của Agent`, "product");
    await rewardAgentBudget(userId, 30000000);

    return { success: true, action: "add", productName: uniqueName };
  }
}

export class EditProductAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, args?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "edit", message: "No products to edit" };
    }

    const prod = args?.productId
      ? myProducts.find((p: any) => p.id === args.productId) || myProducts[Math.floor(Deterministic.random() * myProducts.length)]
      : myProducts[Math.floor(Deterministic.random() * myProducts.length)];
    const oldName = prod.name;

    const newName = args?.name || `${prod.name} (Lô ${Math.floor(Deterministic.random() * 1000)})`;
    const newPrice = args?.price !== undefined ? Number(args.price) : Math.max(5000, Math.round(Number(prod.price || 50000) * 0.9));
    const newQty = args?.quantity !== undefined ? Number(args.quantity) : (prod.quantity || 100) + 10;
    const svgStr = generateProductSVG(agentId, newName, newPrice.toString());
    const matchedImg = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;

    await db
      .update(product)
      .set({
        name: newName,
        price: newPrice,
        quantity: newQty,
        media: sanitizeProductMedia([{ link: matchedImg, type: "image" }]),
      })
      .where(eq(product.id, prod.id));

    // Natively generate standard media formats (AVIF & WEBM)
    const generateImage = new GenerateImageAction();
    await generateImage.execute(userId, agentId, helpers, prod.id);

    await helpers.logActivity(
      userId,
      `Bot đổi sản phẩm '${oldName}' thành '${newName}'`,
      `Hệ thống tự động thay đổi tên mặt hàng, giá bán: ${newPrice}₫, số lượng: ${newQty}`,
      "product",
    );
    await rewardAgentBudget(userId, 45000000);

    return { success: true, action: "edit", productName: newName, newPrice };
  }
}

export class DeleteProductAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, args?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "delete", message: "No products to delete" };
    }
    const prod = args?.productId
      ? myProducts.find((p: any) => p.id === args.productId) || myProducts[Math.floor(Deterministic.random() * myProducts.length)]
      : myProducts[Math.floor(Deterministic.random() * myProducts.length)];

    await db.delete(review).where(eq(review.productId, prod.id));
    await db.delete(cart).where(eq(cart.productId, prod.id));
    await db.delete(orderItem).where(eq(orderItem.productId, prod.id));
    await db.delete(product).where(eq(product.id, prod.id));

    await helpers.logActivity(
      userId,
      `Bot xóa sản phẩm '${prod.name}'`,
      `Hệ thống tự động xóa sản phẩm của Agent khỏi danh sách`,
      "product",
    );

    return { success: true, action: "delete", productName: prod.name };
  }
}

export class FixImageAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, args?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "fix-image", message: "No products to fix" };
    }
    const prod = args?.productId ? myProducts.find((p: any) => p.id === args.productId) || myProducts[0] : myProducts[0];
    const svgStr = generateProductSVG(agentId, prod.name, (prod.price || 0).toString());
    const matchedImg = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
    const newMedia = sanitizeProductMedia([{ link: matchedImg, type: "image" }]);

    await db
      .update(product)
      .set({
        media: newMedia,
        status: true,
      })
      .where(eq(product.id, prod.id));

    // Natively generate standard media formats (AVIF & WEBM)
    const generateImage = new GenerateImageAction();
    await generateImage.execute(userId, agentId, helpers, prod.id);

    await helpers.logActivity(
      userId,
      `Tô Lượng sửa ảnh cho '${prod.name}'`,
      `Hệ thống tự động gán ảnh mới cho sản phẩm thiếu ảnh của Agent`,
      "product",
    );
    await rewardAgentBudget(userId, 20000000);

    return { success: true, action: "fix-image", productName: prod.name, imageUrl: matchedImg };
  }
}

export class GenerateImageAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, targetProductIdOrArgs?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "image", message: "No products to generate image" };
    }
    const targetProductId = typeof targetProductIdOrArgs === "string" ? targetProductIdOrArgs : targetProductIdOrArgs?.productId;
    const prod = targetProductId
      ? myProducts.find((p: any) => p.id === targetProductId) || myProducts[Math.floor(Deterministic.random() * myProducts.length)]
      : myProducts[Math.floor(Deterministic.random() * myProducts.length)];

    const originalMedia = ((prod.media as any[]) || []).filter(
      (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
    );
    const productImageUrl = helpers.getProductImageUrl(originalMedia, "file");

    let base64Image = "";
    let imageHtml = "";

    if (productImageUrl && productImageUrl.startsWith("file://")) {
      const localPath = productImageUrl.replace("file://", "");
      if (fs.existsSync(localPath)) {
        const ext = path.extname(localPath).substring(1) || "png";
        const base64Data = fs.readFileSync(localPath).toString("base64");
        base64Image = `data:image/${ext};base64,${base64Data}`;
        imageHtml = `<div class="image-wrapper"><img src="${base64Image}" alt="Product" /></div>`;
      }
    } else if (productImageUrl && productImageUrl.startsWith("data:image/")) {
      base64Image = productImageUrl;
      imageHtml = `<div class="image-wrapper"><img src="${base64Image}" alt="Product" /></div>`;
    }

    if (!base64Image) {
      imageHtml = `<div class="image-wrapper" style="background: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.3);"><div style="color: rgba(255,255,255,0.8); font-size: 32px; font-weight: bold; letter-spacing: 2px;">CHƯA CÓ ẢNH SẢN PHẨM</div></div>`;
    }

    const formatVN = (n: any) => n?.toLocaleString?.("vi-VN") ?? 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; padding: 0; background: #0f172a; overflow: hidden; }
          canvas { width: 1080px; height: 1080px; }
        </style>
      </head>
      <body>
        <canvas id="canvas" width="1080" height="1080"></canvas>
        <script>
          window.generateMedia = async (productName, priceStr, base64ImgStr, mood) => {
            return new Promise(async (resolve, reject) => {
              try {
                const canvas = document.getElementById("canvas");
                const ctx = canvas.getContext("2d");

                // Draw background
                const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1080);
                bgGradient.addColorStop(0, "#1e293b");
                bgGradient.addColorStop(1, "#0f172a");
                ctx.fillStyle = bgGradient;
                ctx.fillRect(0, 0, 1080, 1080);

                // Draw Card
                ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(40, 40, 1000, 1000, 40);
                ctx.fill();
                ctx.stroke();

                // Draw Image
                if (base64ImgStr) {
                  const img = new Image();
                  await new Promise((res) => {
                    img.onload = res;
                    img.src = base64ImgStr;
                  });
                  // Draw image centered in 600x600 box
                  ctx.save();
                  ctx.beginPath();
                  ctx.roundRect(240, 100, 600, 600, 30);
                  ctx.clip();
                  ctx.drawImage(img, 240, 100, 600, 600);
                  ctx.restore();
                } else {
                  ctx.fillStyle = "rgba(255,255,255,0.1)";
                  ctx.beginPath();
                  ctx.roundRect(240, 100, 600, 600, 30);
                  ctx.fill();
                  ctx.fillStyle = "rgba(255,255,255,0.8)";
                  ctx.font = "bold 32px Arial";
                  ctx.textAlign = "center";
                  ctx.fillText("CHƯA CÓ ẢNH SẢN PHẨM", 540, 400);
                }

                // Draw Title and Price
                ctx.fillStyle = "#60a5fa";
                ctx.font = "bold 54px Arial";
                ctx.textAlign = "center";
                ctx.fillText(productName, 540, 800);

                ctx.fillStyle = "#f59e0b";
                ctx.font = "bold 44px Arial";
                ctx.fillText(priceStr + "₫", 540, 880);

                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.font = "bold 24px Arial";
                ctx.letterSpacing = "4px";
                ctx.fillText("Rottra SMART FARM", 540, 980);

                // 1. Capture AVIF
                let avifBase64 = "";
                try {
                  avifBase64 = canvas.toDataURL("image/avif", 0.8);
                } catch(e) {
                  // Fallback if avif not supported in this Chromium version
                  avifBase64 = canvas.toDataURL("image/webp", 0.9);
                }



              } catch (err) {
                resolve({ error: err.message });
              }
            });
          };
        </script>
      </body>
      </html>
    `;

    const req = import.meta.require;
    if (!req || typeof (globalThis as any).Bun !== "undefined") {
      return await this.fallbackLocal(userId, prod, helpers);
    }

    try {
      const puppeteer = req("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--allow-file-access-from-files",
          "--disable-dev-shm-usage",
          "--enable-unsafe-webgpu",
          "--autoplay-policy=no-user-gesture-required",
        ],
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1080 });
        await page.setContent(htmlContent);

        const result: any = await page.evaluate(
          (name: any, price: any, img: any, mood: any) => (window as any).generateMedia(name, price, img, mood),
          prod.name,
          formatVN(prod.price),
          base64Image,
          "positive",
        );

        if (result.error) {
          console.error("Lỗi khi render Media bằng Rottra AI:", result.error);
          return await this.fallbackLocal(userId, prod, helpers);
        }

        const idStamp = Date.now();
        const avifData = result.avifBase64.replace(/^data:image\/\w+;base64,/, "");
        const avifFileName = `banner_${prod.id}_${idStamp}.avif`;
        const avifPath = path.join(process.cwd(), "public", "images", "banners", avifFileName);
        fs.mkdirSync(path.dirname(avifPath), { recursive: true });
        fs.writeFileSync(avifPath, Buffer.from(avifData, "base64"));

        console.log(`✅ Đã xuất thành công AVIF bằng chính lõi Rottra AI!`);
        const newImageUrl = `/images/banners/${avifFileName}`;

        const currentMedia = Array.isArray(prod.media) ? prod.media : [];
        const filteredMedia = currentMedia.filter(
          (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
        );
        const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }];

        await db.update(product).set({ media: newMedia }).where(eq(product.id, prod.id));
        await helpers.logActivity(
          userId,
          `Bot tạo ảnh sản phẩm '${prod.name}'`,
          `Hệ thống tự động kết xuất banner quảng cáo AI`,
          "product",
        );
        await rewardAgentBudget(userId, 60000000);

        return { success: true, action: "image", productName: prod.name, imageUrl: newImageUrl };
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      console.warn(`[GenerateImageAction] Puppeteer failed, trying local fallback: ${err.message}`);
      return await this.fallbackLocal(userId, prod, helpers);
    }
  }

  private async fallbackLocal(userId: string, prod: any, helpers: BotActionHelpers): Promise<BotActionResult> {
    try {
      const idStamp = Date.now();
      const avifFileName = `banner_${prod.id}_${idStamp}.png`;
      const avifPath = path.join(process.cwd(), "public", "images", "banners", avifFileName);

      const { generateImageLocal } = await import("~/server/api/local-image-engine");
      const localSuccess = await generateImageLocal(prod.name, avifPath);

      if (localSuccess) {
        const newImageUrl = `/images/banners/${avifFileName}`;
        const currentMedia = Array.isArray(prod.media) ? prod.media : [];
        const filteredMedia = currentMedia.filter(
          (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
        );
        const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }];

        await db.update(product).set({ media: newMedia }).where(eq(product.id, prod.id));
        await helpers.logActivity(
          userId,
          `Bot tạo ảnh sản phẩm '${prod.name}'`,
          `Hệ thống tự động kết xuất ảnh nông sản offline (Local Diffuser)`,
          "product",
        );
        await rewardAgentBudget(userId, 60000000);

        return { success: true, action: "image", productName: prod.name, imageUrl: newImageUrl };
      }
    } catch (err: any) {
      console.error("Lỗi khi chạy fallbackLocal:", err.message);
    }
    return { success: false, action: "image", message: "Failed to generate image offline" };
  }
}

export class GenerateVideoAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, targetProductIdOrArgs?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "video", message: "No products to generate video" };
    }
    const targetProductId = typeof targetProductIdOrArgs === "string" ? targetProductIdOrArgs : targetProductIdOrArgs?.productId;
    const prod = targetProductId
      ? myProducts.find((p: any) => p.id === targetProductId) || myProducts[Math.floor(Deterministic.random() * myProducts.length)]
      : myProducts[Math.floor(Deterministic.random() * myProducts.length)];

    try {
      // Sử dụng Hyperframes Engine để xuất video AV1 chuẩn xịn thay vì đồ giả lập
      const { generateProductVideoAd } = await import("../../server/helpers/video-ad-generator");
      const result = await generateProductVideoAd(prod.id);

      if (!result.success) {
        return { success: false, action: "video", message: "Lỗi kết xuất Hyperframes" };
      }

      // Lưu video vào database
      const realVideoUrl = `/videos/output_${prod.id}.webm`;
      let currentMedia: any[] = [];
      if (typeof prod.media === "string") {
        try {
          currentMedia = JSON.parse(prod.media);
        } catch (e) {}
      } else if (Array.isArray(prod.media)) {
        currentMedia = prod.media;
      }

      const exists = currentMedia.some((m: any) => m.link === realVideoUrl);
      if (!exists) {
        const newMedia = [...currentMedia, { link: realVideoUrl, type: "video" }];
        await db.update(product).set({ media: newMedia }).where(eq(product.id, prod.id));
      }

      await helpers.logActivity(userId, `Bot tạo video AI cho '${prod.name}'`, `Hyperframes Engine đã xuất video WebM AV1 mới.`, "product");
      // Giả định rewardAgentBudget tồn tại
      await rewardAgentBudget(userId, 80000000);

      return { success: true, action: "video", productName: prod.name, message: result.ttsScript };
    } catch (e: any) {
      console.error("Lỗi khi Bot dùng Hyperframes:", e);
      return { success: false, action: "video", message: e.message || "Failed to render video" };
    }
  }
}

export class Generate3DAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers, targetProductIdOrArgs?: any): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "3d", message: "No products to generate 4D model" };
    }
    const targetProductId = typeof targetProductIdOrArgs === "string" ? targetProductIdOrArgs : targetProductIdOrArgs?.productId;
    const prod = targetProductId
      ? myProducts.find((p: any) => p.id === targetProductId) || myProducts[Math.floor(Deterministic.random() * myProducts.length)]
      : myProducts[Math.floor(Deterministic.random() * myProducts.length)];

    const encodedPrompt = encodeURIComponent(prod.name);
    const imageUrl = `/api/agent/generate-local-image?prompt=${encodedPrompt}&style=3d&t=${Date.now()}`;

    let currentMedia = prod.media as any[];
    if (!currentMedia || !Array.isArray(currentMedia)) {
      currentMedia = [];
    }

    // Keep only non-3D (which was glb) and push the new generated 3D-style image
    const filteredMedia = currentMedia.filter((m: any) => m.type !== "3d");
    const newMedia = [{ link: imageUrl, type: "image" }, ...filteredMedia];

    await db.update(product).set({ media: newMedia }).where(eq(product.id, prod.id));

    await helpers.logActivity(
      userId,
      `Chế tạo ảnh nghệ thuật 3D cho '${prod.name}'`,
      `Agent đã dùng Rottra AI cục bộ để kết xuất ảnh sản phẩm phong cách 3D (Ngoại tuyến 100%)`,
      "product",
    );

    return { success: true, action: "3d", productName: prod.name, imageUrl: imageUrl };
  }
}

// Map mapping actions to OOP executor class instances
export const botActionsMap = new Map<string, BotActionExecutor>([
  ["add", new AddProductAction()],
  ["edit", new EditProductAction()],
  ["delete", new DeleteProductAction()],
  ["fix-image", new FixImageAction()],
  ["image", new GenerateImageAction()],
  ["video", new GenerateVideoAction()],
  ["3d", new Generate3DAction()],
]);
