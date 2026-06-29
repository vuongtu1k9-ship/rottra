import { db } from "./db";
import { user, product } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("👥 Khởi tạo các nhân vật chiến dịch trong Bảng User...");
  const characters = [
    { id: "toLuong", name: "Tô Lượng", email: "toLuong@rottra.com", username: "toLuong", image: "👑" },
    { id: "thuongNguyet", name: "Thương Nguyệt Đại Đế", email: "thuongNguyet@rottra.com", username: "thuongNguyet", image: "🌞" },
    { id: "tramTinh", name: "Trầm Tinh Yển Nguyệt", email: "tramTinh@rottra.com", username: "tramTinh", image: "🔮" },
    { id: "daoTieuCuu", name: "Đào Tiểu Cửu", email: "daoTieuCuu@rottra.com", username: "daoTieuCuu", image: "✨" },
    { id: "hoaHuynh", name: "Hỏa Huỳnh Vương", email: "hoaHuynh@rottra.com", username: "hoaHuynh", image: "🔥" },
    { id: "phiNguyet", name: "Bạch Ti Phi Nguyệt Bảo", email: "phiNguyet@rottra.com", username: "phiNguyet", image: "💎" },
    { id: "nhuNguyet", name: "Như Nguyệt", email: "nhuNguyet@rottra.com", username: "nhuNguyet", image: "🎴" },
    { id: "suGia", name: "Sứ giả Nguyệt Thần Cung", email: "suGia@rottra.com", username: "suGia", image: "🛡️" },

    { id: "phiAnh", name: "Phi Anh Phấn Đồng", email: "phiAnh@rottra.com", username: "phiAnh", image: "🧚" },
    { id: "bachDiHanh", name: "Bạch Di Hành", email: "bachDiHanh@rottra.com", username: "bachDiHanh", image: "⚔️" },
    { id: "uVuongMau", name: "U Vương Mẫu", email: "uVuongMau@rottra.com", username: "uVuongMau", image: "🕸️" },
    { id: "bachLoc", name: "Bạch Lộc", email: "bachLoc@rottra.com", username: "bachLoc", image: "🦌" },
  ];

  for (const char of characters) {
    await db
      .insert(user)
      .values({
        id: char.id,
        name: char.name,
        email: char.email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "user",
        username: char.username,
        image: char.image,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: { name: char.name, role: "user", image: char.image },
      });
    console.log(`- Đã thiết lập/kiểm tra User: ${char.name}`);
  }

  console.log("📦 Đang truy vấn tất cả sản phẩm...");
  const allProducts = await db.select().from(product);
  console.log(`- Tìm thấy ${allProducts.length} sản phẩm.`);

  const DEFAULT_AGENT_DNA: Record<string, any> = {
    toLuong: { greed: 1.0, vengeance: 0.4, malice: 0.8, state: "GREEDY" },
    thuongNguyet: { greed: 1.0, vengeance: 0.5, malice: 0.8, state: "GREEDY" },
    tramTinh: { greed: 1.0, vengeance: 0.3, malice: 0.6, state: "GREEDY" },
    daoTieuCuu: { greed: 1.0, vengeance: 0.6, malice: 0.7, state: "GREEDY" },
    hoaHuynh: { greed: 1.0, vengeance: 0.7, malice: 0.9, state: "GREEDY" },
    phiNguyet: { greed: 1.0, vengeance: 0.2, malice: 0.5, state: "GREEDY" },
    nhuNguyet: { greed: 1.0, vengeance: 0.4, malice: 0.6, state: "GREEDY" },
    suGia: { greed: 1.0, vengeance: 0.5, malice: 0.7, state: "GREEDY" },
    phiAnh: { greed: 1.0, vengeance: 0.6, malice: 0.6, state: "GREEDY" },
    bachDiHanh: { greed: 1.0, vengeance: 0.8, malice: 0.7, state: "GREEDY" },
    uVuongMau: { greed: 1.0, vengeance: 0.9, malice: 0.9, state: "GREEDY" },
    bachLoc: { greed: 1.0, vengeance: 0.1, malice: 0.5, state: "GREEDY" },
  };

  const getMatchScore = (prodName: string, category: string, dna: any) => {
    const greed = dna.greed ?? 0.5;
    const malice = dna.malice ?? 0.5;
    const cleanStr = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "");
    
    // Tùy biến sở thích ngầm định dựa trên tên Agent
    const pWords = cleanStr(prodName).split(/\s+/).filter(Boolean);
    const catBonus = category.includes("Nông sản") ? 0.2 : 0;
    
    // Match Score = greed (thích hàng giá trị/nhiều) + sự đa dạng + yếu tố ngẫu nhiên
    return greed * 0.4 + malice * 0.1 + catBonus + Math.random() * 0.5;
  };

  let updatedCount = 0;
  const agents = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];

  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    let bestAgent = agents[0];
    let bestScore = -1;

    // Các Agent sử dụng ý thức (DNA) để giành quyền bán sản phẩm phù hợp nhất
    for (const ag of agents) {
      const dna = DEFAULT_AGENT_DNA[ag];
      const score = getMatchScore(p.name || "", p.category || "", dna);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = ag;
      }
    }

    await db.update(product).set({ sellerId: bestAgent }).where(eq(product.id, p.id));
    updatedCount++;
  }

  console.log(`✅ Hoàn thành cập nhật quyền sở hữu cho ${updatedCount} sản phẩm!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi khi chạy cập nhật sản phẩm:", err);
  process.exit(1);
});
