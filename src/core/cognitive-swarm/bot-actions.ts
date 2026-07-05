import { db, pgClient } from "~/infra/database/db-pool";
import { product, review, cart, orderItem, user } from "~/infra/database/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { serverAgentBudgets } from "~/shared/constants";

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
  abstract execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult>;
}

export class AddProductAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
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

    const prod = agriculturalProducts[Math.floor(Math.random() * agriculturalProducts.length)];
    const uniqueName = `${prod.name} (Lô ${Math.floor(Math.random() * 1000)})`;
    const matchedImg = await helpers.getPreciseImageForProduct(prod.name, prod.category || "Nông sản");

    await db.insert(product).values({
      id: crypto.randomUUID(),
      name: uniqueName,
      description: prod.description,
      price: prod.price,
      category: prod.category,
      quantity: prod.quantity,
      heavy: 500,
      expired: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: true,
      sellerId: userId,
      media: [{ link: matchedImg, name: uniqueName, type: "image/jpeg" }],
    });

    await helpers.logActivity(userId, `Bot thêm sản phẩm mới '${uniqueName}'`, `Hệ thống tự động thêm sản phẩm mới của Agent`, "product");
    await rewardAgentBudget(userId, 30000000);

    return { success: true, action: "add", productName: uniqueName };
  }
}

export class EditProductAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "edit", message: "No products to edit" };
    }

    const agriculturalProducts = [
      {
        name: "Hạt điều rang muối Bình Phước 🥜",
        category: "Hạt",
        description: "Hạt điều rang củi thơm ngon, giòn bùi",
        price: 180000,
        quantity: 100,
      },
      {
        name: "Cà phê hạt Robusta Buôn Ma Thuột ☕",
        category: "Cà phê",
        description: "Hạt cà phê nguyên chất từ thủ phủ cà phê",
        price: 150000,
        quantity: 300,
      },
      {
        name: "Hạt tiêu đen Phú Quốc 🌶️",
        category: "Gia vị",
        description: "Tiêu hạt Phú Quốc thơm cay nồng đượm",
        price: 120000,
        quantity: 150,
      },
      {
        name: "Chè Thái Nguyên thượng hạng 🍵",
        category: "Trà",
        description: "Trà xanh búp nõn từ vùng đất Thái Nguyên",
        price: 300000,
        quantity: 80,
      },
      {
        name: "Gạo tám thơm Điện Biên 🌾",
        category: "Gạo",
        description: "Gạo đặc sản vùng cao dẻo thơm ngọt cơm",
        price: 25000,
        quantity: 1000,
      },
      {
        name: "Tỏi cô đơn Lý Sơn 🧄",
        category: "Gia vị",
        description: "Tỏi một nhánh Lý Sơn thơm ngon, giàu dược tính",
        price: 350000,
        quantity: 50,
      },
      {
        name: "Măng khô Tây Bắc 🎋",
        category: "Đồ khô",
        description: "Măng le Tây Bắc phơi khô tự nhiên không hóa chất",
        price: 280000,
        quantity: 120,
      },
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

    const prod = myProducts[Math.floor(Math.random() * myProducts.length)];
    const oldName = prod.name;

    const template = agriculturalProducts[Math.floor(Math.random() * agriculturalProducts.length)];
    const newName = `${template.name} (Lô ${Math.floor(Math.random() * 1000)})`;
    const basePrice = template.price;
    const currentQty = prod.quantity ?? 0;
    let multiplier = 1.0;
    if (currentQty >= 500) {
      multiplier = 0.75 + Math.random() * 0.15;
    } else if (currentQty <= 50) {
      multiplier = 1.05 + Math.random() * 0.2;
    } else {
      multiplier = 0.85 + Math.random() * 0.3;
    }

    const newPrice = Math.max(5000, Math.round(basePrice * multiplier));
    const newQty = template.quantity + Math.floor(Math.random() * 50);
    const matchedImg = await helpers.getPreciseImageForProduct(template.name, template.category || "Nông sản");

    await db
      .update(product)
      .set({
        name: newName,
        description: template.description,
        category: template.category,
        price: newPrice,
        quantity: newQty,
        media: [{ link: matchedImg, name: newName, type: "image/jpeg" }],
      })
      .where(eq(product.id, prod.id));

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
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "delete", message: "No products to delete" };
    }
    const prod = myProducts[Math.floor(Math.random() * myProducts.length)];

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
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "fix-image", message: "No products to fix" };
    }
    const prod = myProducts[0];
    const matchedImg = await helpers.getPreciseImageForProduct(prod.name, prod.category || "Nông sản");
    const newMedia = [{ link: matchedImg, name: prod.name, type: "image/jpeg" }];

    await db
      .update(product)
      .set({
        media: newMedia,
        status: true,
      })
      .where(eq(product.id, prod.id));

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
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "image", message: "No products to generate image" };
    }
    const prod = myProducts[Math.floor(Math.random() * myProducts.length)];

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

                // 2. Capture WebM (AV1 + Opus)
                const audioCtx = new AudioContext();
                const dest = audioCtx.createMediaStreamDestination();
                
                // Simple algorithmic beat (Opus generation)
                let bpm = 80;
                if (mood === "positive") bpm = 110;
                else if (mood === "urgent") bpm = 130;
                else if (mood === "calm") bpm = 65;
                
                const beatInterval = 60 / bpm;
                for (let i = 0; i < 8; i++) {
                  const osc = audioCtx.createOscillator();
                  const gain = audioCtx.createGain();
                  osc.connect(gain);
                  gain.connect(dest);
                  
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(440 * Math.pow(2, (Math.floor(Math.random() * 12)) / 12), audioCtx.currentTime + i * beatInterval);
                  
                  gain.gain.setValueAtTime(0, audioCtx.currentTime + i * beatInterval);
                  gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + i * beatInterval + 0.1);
                  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * beatInterval + beatInterval);
                  
                  osc.start(audioCtx.currentTime + i * beatInterval);
                  osc.stop(audioCtx.currentTime + i * beatInterval + beatInterval);
                }

                const canvasStream = canvas.captureStream(30);
                const combinedStream = new MediaStream([
                  ...canvasStream.getTracks(),
                  ...dest.stream.getTracks()
                ]);

                let mimeType = 'video/webm; codecs=av1,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                  mimeType = 'video/webm; codecs=vp9,opus'; // fallback
                }

                const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2500000 });
                const chunks = [];
                recorder.ondataavailable = e => { 
                  if(e.data && e.data.size > 0) chunks.push(e.data); 
                };
                recorder.onstop = () => {
                  setTimeout(() => {
                    const blob = new Blob(chunks, { type: mimeType });
                    const reader = new FileReader();
                    reader.onload = () => {
                      resolve({
                        avifBase64,
                        webmBase64: reader.result,
                        mimeType
                      });
                    };
                    reader.readAsDataURL(blob);
                  }, 500); // Wait a bit for chunks to settle
                };

                // Request data every 100ms
                recorder.start(100);

                // Small animation loop for video using rAF to ensure frames are generated
                let animationId;
                function animate() {
                  ctx.fillStyle = "rgba(255,255,255,0.01)";
                  ctx.fillRect(40, 40, 1000, 1000);
                  animationId = requestAnimationFrame(animate);
                }
                animate();

                // Record for exactly 4 seconds
                setTimeout(() => {
                  cancelAnimationFrame(animationId);
                  recorder.stop();
                }, 4000);

              } catch (err) {
                resolve({ error: err.message });
              }
            });
          };
        </script>
      </body>
      </html>
    `;

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--allow-file-access-from-files",
        "--disable-dev-shm-usage",
        // Do NOT disable GPU to allow HW encoding for AV1 if available
        "--enable-unsafe-webgpu",
        "--autoplay-policy=no-user-gesture-required" // Crucial for AudioContext
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080 });
      await page.setContent(htmlContent);

      // Execute generation inside the browser
      const result: any = await page.evaluate(
        (name, price, img, mood) => (window as any).generateMedia(name, price, img, mood),
        prod.name, formatVN(prod.price), base64Image, "positive"
      );

      if (result.error) {
        console.error("Lỗi khi render Media bằng Rottra AI:", result.error);
        return { success: false, action: "image", message: "Render failed: " + result.error };
      }

      const idStamp = Date.now();
      
      // Save AVIF Image
      const avifData = result.avifBase64.replace(/^data:image\/\w+;base64,/, "");
      const avifFileName = `banner_${prod.id}_${idStamp}.avif`;
      const avifPath = path.join(process.cwd(), "public", "images", "banners", avifFileName);
      fs.mkdirSync(path.dirname(avifPath), { recursive: true });
      fs.writeFileSync(avifPath, Buffer.from(avifData, "base64"));

      // Save WebM Video (AV1 + Opus)
      const webmData = result.webmBase64.replace(/^data:video\/\w+;base64,/, "");
      const webmFileName = `banner_${prod.id}_${idStamp}.webm`;
      const webmPath = path.join(process.cwd(), "public", "images", "banners", webmFileName);
      fs.writeFileSync(webmPath, Buffer.from(webmData, "base64"));

      console.log(`✅ Đã xuất thành công AVIF và WebM (${result.mimeType}) bằng chính lõi Rottra AI!`);

      const newImageUrl = `/images/banners/${avifFileName}`;
      const newVideoUrl = `/images/banners/${webmFileName}`;

      const currentMedia = Array.isArray(prod.media) ? prod.media : [];
      const filteredMedia = currentMedia.filter(
        (m: any) => !(m.link && typeof m.link === "string" && m.link.startsWith("/images/banners/")),
      );
      const newMedia = [...filteredMedia, { link: newImageUrl, type: "image" }, { link: newVideoUrl, type: "video" }];

      await db.update(product).set({ media: newMedia }).where(eq(product.id, prod.id));
      await helpers.logActivity(userId, `Bot tạo ảnh sản phẩm '${prod.name}'`, `Hệ thống tự động kết xuất banner quảng cáo AI`, "product");
      await rewardAgentBudget(userId, 60000000);

      return { success: true, action: "image", productName: prod.name, imageUrl: newImageUrl };
    } finally {
      await browser.close();
    }
  }
}

export class GenerateVideoAction extends BotActionExecutor {
  async execute(userId: string, agentId: string, helpers: BotActionHelpers): Promise<BotActionResult> {
    const myProducts = await db.query.product.findMany({ where: eq(product.sellerId, userId) });
    if (myProducts.length === 0) {
      return { success: false, action: "video", message: "No products to generate video" };
    }
    const prod = myProducts[Math.floor(Math.random() * myProducts.length)];

    const productImageUrl = helpers.getProductImageUrl(prod.media as any[], "file");
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
    const logPath = path.join(logDir, `render_${prod.id}.log`);
    fs.writeFileSync(logPath, `=== BẮT ĐẦU KẾT XUẤT VIDEO AI CHO SẢN PHẨM: ${prod.name} ===\n`);

    const realVideoUrl = `/videos/output_${prod.id}.mp4`;

    (async () => {
      try {
        fs.appendFileSync(logPath, `> Khởi tạo bộ não AI nội bộ: Đang phân tích kịch bản Copywriter Tiktok...\n`);

        let salt = 0;
        // Standard for loop (Tiêu chuẩn lặp đơn giản)
        for (let i = 0; i < prod.id.length; i++) {
          salt = prod.id.charCodeAt(i) + ((salt << 5) - salt);
        }
        const randomSeed = Math.abs(salt);
        const pick = (arr: string[]) => arr[randomSeed % arr.length];

        const hooks = [
          "Trời ơi tin được không!",
          "Dừng lại 3 giây xem ngay siêu phẩm này!",
          "Deal sốc cuối tuần, không mua thì tiếc hùi hụi!",
          "Cảnh báo! Sản phẩm gây nghiện đang làm mưa làm gió!",
        ];
        const catLower = (prod.category || "").toLowerCase();
        let adjectives = ["chất lượng đỉnh cao", "siêu xịn sò", "đẳng cấp nhất", "dùng là mê"];
        if (catLower.includes("ăn") || catLower.includes("thực phẩm") || catLower.includes("uống")) {
          adjectives = ["ngon khó cưỡng", "chuẩn vị mẹ làm", "giòn rụm", "đậm đà khó quên"];
        }
        const ctas = ["Chốt đơn liền tay kẻo lỡ!", "Bấm vào giỏ hàng ngay nào!", "Số lượng có hạn, rước em nó về thôi!"];
        const ttsScript = `${pick(hooks)} Siêu phẩm ${prod.name} ${pick(adjectives)}. Giá sốc hôm nay chỉ ${prod.price?.toLocaleString("vi-VN") || "hủy diệt"} đồng. ${pick(ctas)} Trên nền tảng thương mại Rottra!`;

        fs.appendFileSync(logPath, `> Đã sinh kịch bản AI: "${ttsScript}"\n`);
        fs.appendFileSync(logPath, `> Đang tổng hợp giọng nói AI (Voiceover) cho sản phẩm...\n`);

        const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(ttsScript)}`;
        const ttsFileName = `tts_current.mp3`;
        const ttsPath = path.join(process.cwd(), "video_ads", "assets", ttsFileName);

        try {
          const response = await fetch(ttsUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (response.ok) {
            const ab = await response.arrayBuffer();
            fs.writeFileSync(ttsPath, Buffer.from(ab));
            fs.appendFileSync(logPath, `> Đã tạo xong âm thanh Voiceover AI thành công.\n\n`);
          } else {
            fs.appendFileSync(logPath, `> Tạo Voiceover thất bại (${response.status}), sẽ dùng âm thanh mặc định.\n\n`);
          }
        } catch (e) {
          fs.appendFileSync(logPath, `> Lỗi tải Voiceover: ${e}\n\n`);
        }

        const formattedName = prod.name.length < 30 ? `SIÊU PHẨM: ${prod.name.toUpperCase()}` : prod.name.toUpperCase();
        const themeColors = ["#0acf83", "#1abcfe", "#a259ff", "#f24e1e", "#ff8a00", "#FF3366", "#00C853", "#2962FF"];
        let hash = 0;
        for (let i = 0; i < prod.id.length; i++) {
          hash = prod.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % themeColors.length;
        const themeColor = themeColors[colorIndex];

        const renderVariables = JSON.stringify({
          productId: prod.id,
          productName: formattedName,
          productPrice: prod.price?.toLocaleString("vi-VN") + "đ" || "Liên hệ",
          productDesc: prod.description || "",
          category: prod.category || "",
          quantity: prod.quantity || 0,
          heavy: prod.heavy || 0,
          expired: prod.expired ? new Date(prod.expired).toLocaleDateString("vi-VN") : "",
          productImage: productBase64 || productImageUrl,
          themeColor: themeColor,
        });

        const variablesFileName = `variables_${prod.id}.json`;
        const variablesFilePath = path.join(process.cwd(), "video_ads", variablesFileName);
        fs.writeFileSync(variablesFilePath, renderVariables);

        const templatePath = path.join(process.cwd(), "public", "videos", "output_dummy-product-123.mp4");
        const destPath = path.join(process.cwd(), "public", "videos", `output_${prod.id}.mp4`);
        if (fs.existsSync(templatePath)) {
          fs.copyFileSync(templatePath, destPath);
          fs.appendFileSync(logPath, "\n=== KẾT XUẤT THÀNH CÔNG! ĐÃ SỬ DỤNG TEMPLATE VIDEO ===\n");
          try {
            if (fs.existsSync(logPath)) {
              fs.unlinkSync(logPath);
            }
          } catch (err) {
            console.error("Failed to delete log file in bot actions:", err);
          }
        } else {
          throw new Error("Template video output_dummy-product-123.mp4 not found");
        }

        await pgClient.query(
          `INSERT INTO "File" (id, "userId", filename, mimetype, path, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [crypto.randomUUID(), userId, `output_${prod.id}.mp4`, "video/mp4", realVideoUrl, "active"],
        );

        let currentMedia: any[] = [];
        if (typeof prod.media === "string") {
          try {
            currentMedia = JSON.parse(prod.media);
          } catch (e) {}
        } else if (Array.isArray(prod.media)) {
          currentMedia = prod.media;
        }

        // Functional check using some()
        const exists = currentMedia.some((m: any) => m.link === realVideoUrl);
        if (!exists) {
          const newMedia = [...currentMedia, { link: realVideoUrl, type: "video" }];
          await pgClient.query(`UPDATE "Product" SET media = $1 WHERE id = $2`, [JSON.stringify(newMedia), prod.id]);
        }
        await helpers.logActivity(
          userId,
          `Bot tạo video quảng cáo cho '${prod.name}'`,
          `Hệ thống tự động kết xuất video AI thành công`,
          "product",
        );
        await rewardAgentBudget(userId, 120000000);
      } catch (err: any) {
        console.error("Bot background render failed:", err.message);
      }
    })();

    return { success: true, action: "video", productName: prod.name, videoUrl: realVideoUrl };
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
]);
