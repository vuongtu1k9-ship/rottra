import { Deterministic } from "~/shared/utils/rng";
import { db } from "./db";
import { user, farm, cropSeason, sensorData, product, order, orderItem, researchProject, projectTask, agentMemory } from "./schema";
import { sql, eq, inArray } from "drizzle-orm";
import { serverAgentBudgets, serverAgentGold, serverAgentEmployees } from "../../../src/shared/constants";

async function main() {
  console.log("🌱 Bắt đầu nạp 10,000 dòng dữ liệu vào Hệ sinh thái Nông Sản Rottra...");

  // 1. Tạo User hệ thống nếu chưa có
  const systemUserId = "RottraAI";
  await db
    .insert(user)
    .values({
      id: systemUserId,
      name: "Trợ Lý Cao Cấp Rottra",
      email: "agent@Rottra.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "agent",
      username: "agent_Rottra",
    })
    .onConflictDoNothing();
  console.log("✅ Đã thiết lập User hệ thống.");

  const characters = [
    { id: "toLuong", name: "Tô Lượng", email: "toLuong@rottra.com", username: "Tô Lượng", image: "👑" },
    { id: "thuongNguyet", name: "Thương Nguyệt Đại Đế", email: "thuongNguyet@rottra.com", username: "Thương Nguyệt", image: "🌞" },
    { id: "tramTinh", name: "Trầm Tinh Yển Nguyệt", email: "tramTinh@rottra.com", username: "Trầm Tinh", image: "🔮" },
    { id: "daoTieuCuu", name: "Đào Tiểu Cửu", email: "daoTieuCuu@rottra.com", username: "Đào Tiểu Cửu", image: "✨" },
    { id: "hoaHuynh", name: "Hỏa Huỳnh Vương", email: "hoaHuynh@rottra.com", username: "Hỏa Huỳnh", image: "🔥" },
    { id: "phiNguyet", name: "Bạch Ti Phi Nguyệt Bảo", email: "phiNguyet@rottra.com", username: "Phi Nguyệt", image: "💎" },
    { id: "nhuNguyet", name: "Như Nguyệt", email: "nhuNguyet@rottra.com", username: "Như Nguyệt", image: "🎴" },
    { id: "suGia", name: "Sứ giả Nguyệt Thần Cung", email: "suGia@rottra.com", username: "Sứ Giả", image: "🛡️" },

    { id: "phiAnh", name: "Phi Anh Phấn Đồng", email: "phiAnh@rottra.com", username: "Phi Anh", image: "🧚" },
    { id: "bachDiHanh", name: "Bạch Di Hành", email: "bachDiHanh@rottra.com", username: "Bạch Di Hành", image: "⚔️" },
    { id: "uVuongMau", name: "U Vương Mẫu", email: "uVuongMau@rottra.com", username: "U Vương Mẫu", image: "🕸️" },
    { id: "bachLoc", name: "Bạch Lộc", email: "bachLoc@rottra.com", username: "Bạch Lộc", image: "🦌" },
  ];

  const usersToInsert = characters.map(char => ({
    id: char.id,
    name: char.name,
    email: char.email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: "user" as const,
    username: char.username,
    image: char.image,
    profile: {
      budget: serverAgentBudgets[char.id] || 0,
      gold: serverAgentGold[char.id] || 10,
      employees: serverAgentEmployees[char.id] || 5
    },
  }));

  if (usersToInsert.length > 0) {
    await db
      .insert(user)
      .values(usersToInsert)
      .onConflictDoUpdate({
        target: user.id,
        set: {
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          username: sql`excluded.username`,
          image: sql`excluded.image`,
          profile: sql`excluded.profile`,
        },
      });
  }
  console.log("✅ Đã thiết lập các nhân vật chiến dịch.");

  // 2. Tạo Farm hệ thống
  const systemFarmId = "system_agent_farm";
  await db
    .insert(farm)
    .values({
      id: systemFarmId,
      ownerId: systemUserId,
      name: "Nông Trại Lượng Tử Rottra",
      description: "Nhất nước, nhì phân, tam cần, tứ giống. Nông trại thực nghiệm công nghệ cao.",
      location: { province: "Tuyên Quang", district: "Hồng Sơn", commune: "Hồng Sơn" },
    })
    .onConflictDoNothing();
  console.log("✅ Đã thiết lập Nông trại thực nghiệm.");

  // Ca dao tục ngữ theo chủ đề nông nghiệp làm Metadata & Description
  const caDaoCrops = ["Nhất nước, nhì phân, tam cần, tứ giống. Lúa chiêm lấp ló đầu bờ, hễ nghe tiếng sấm phất cờ mà lên.", "Ai ơi bưng bát cơm đầy, dẻo thơm một hạt, đắng cay muôn phần.", "Được mùa lúa, úa mùa khoai. Mưa tháng ba hoa đất, mưa tháng tư hư đất.", "Mùa nào thức nấy. Nhất sỹ nhì nông, hết gạo chạy rông, nhất nông nhì sỹ.", "Cơm tẻ là mẹ ruột. Thớt đất hơn bát bùn."];

  const caDaoHusbandry = ["Muốn giàu nuôi cá, muốn khá nuôi heo. Nuôi tằm ăn cơm đứng.", "Lợn đói một bữa bằng người đói cả năm.", "Đầu gà hơn đuôi trâu. Chó giữ nhà, gà gáy sáng.", "Trâu ơi ta bảo trâu này, trâu ra ngoài ruộng trâu cày với ta.", "Con gà cục tác lá chanh, con lợn ủn ỉn mua hành cho tôi."];

  const caDaoTechniques = ["Công cấy là công bỏ, công làm cỏ là công ăn.", "Tỏ trăng mười bốn được tằm, tỏ trăng hôm rằm thì được lúa chiêm.", "Ăn kỹ no lâu, cày sâu tốt lúa.", "Đất thiếu chân sao tốt lúa, người thiếu của sao có lòng nhân.", "Không nước, không phân, cây sao tốt trái."];

  const caDaoHarvest = ["Gặt lúa phải gặt cả bông, chớ gặt nửa chừng bỏ phí ngoài đồng.", "Lúa chín vàng đồng, lòng người hớn hở. Kho chứa đầy ụ, mùa màng bội thu.", "Được mùa chớ phụ ngô khoai, đến năm thất bát lấy ai bạn cùng.", "Kho thóc đầy nhà, ấm no hạnh phúc."];

  const caDaoProcessing = ["Gạo đem vào giã bao đau đớn, giã xong trắng tựa bông.", "Trăm hay không bằng tay quen. Khéo tay hay làm.", "Hương vị quê hương, kết tinh giá trị nông sản việt.", "Ép dầu ép mỡ, ai nỡ ép duyên."];

  const caDaoMarket = ["Buôn có bạn, bán có phường. Trăm người bán, vạn người mua.", "Đắt ra quế, rẻ ra bùn. Mua bán phân minh, nghĩa tình trọn vẹn.", "Tiền nào của nấy. Đồng tiền đi liền khúc ruột."];

  const caDaoTech = ["Khoa học kỹ thuật đưa nông sản vươn xa. Thiết bị thông minh, mùa vàng gõ cửa.", "Thời đại số hóa, nông gia phát tài.", "Máy móc thay trâu, năng suất hàng đầu."];

  const caDaoEco = ["Đất lành chim đậu. Giữ lấy màu xanh, nuôi nguồn nhựa sống.", "Nước chảy đá mòn. Rừng vàng biển bạc, đất phì nhiêu.", "Môi trường xanh sạch, mùa màng bội thu."];

  const getRandomCaDao = (arr: string[]) => arr[Math.floor(Deterministic.random() * arr.length)];

  // Categories mapping
  const CATEGORIES = [
    { name: "Cây trồng", group: caDaoCrops },
    { name: "Chăn nuôi", group: caDaoHusbandry },
    { name: "Kỹ thuật", group: caDaoTechniques },
    { name: "Thu hoạch & bảo quản", group: caDaoHarvest },
    { name: "Chế biến & giá trị gia tăng", group: caDaoProcessing },
    { name: "Thị trường & kinh tế", group: caDaoMarket },
    { name: "Công nghệ nông nghiệp", group: caDaoTech },
    { name: "Môi trường & bền vững", group: caDaoEco },
  ];

  // 3. Nạp CROP SEASONS (50 dòng)
  console.log("🚜 Đang tạo CropSeasons...");
  const seasonIds: string[] = [];
  const cropSeasonsToInsert = [];
  for (let i = 1; i <= 50; i++) {
    const id = `season_${i}`;
    seasonIds.push(id);
    const year = 2024 + Math.floor(i / 15);
    const idx = i % 3;
    const sName = idx === 0 ? "Xuân Hè" : idx === 1 ? "Hè Thu" : "Thu Đông";
    const crop = idx === 0 ? "Lúa thơm ST25" : idx === 1 ? "Ngô lai cao sản" : "Khoai tây vàng";

    cropSeasonsToInsert.push({
      id,
      farmId: systemFarmId,
      name: `Vụ ${sName} ${year}`,
      cropType: crop,
      startDate: new Date(year, idx * 4, 1).toISOString(),
      expectedEndDate: new Date(year, idx * 4 + 3, 30).toISOString(),
      status: i === 50 ? "active" : "harvested",
      yieldEstimate: 4000 + i * 50, // kg/ha
    });
  }
  if (cropSeasonsToInsert.length > 0) {
    await db.insert(cropSeason).values(cropSeasonsToInsert).onConflictDoNothing();
  }
  console.log(`✅ Đã nạp 50 CropSeasons.`);

  // 4. Nạp PRODUCTS (1,000 dòng)
  console.log("📦 Đang nạp 1,000 Nông sản & Thiết bị vào CSDL...");
  const productIds: string[] = [];

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

  const getMatchScore = (prodName: string, category: string, price: number, dna: any) => {
    const greed = dna.greed ?? 0.5;
    const malice = dna.malice ?? 0.5;
    const catBonus = category.includes("Nông sản") || price > 500000 ? 0.3 : 0;
    // Agent có greed cao sẽ tranh giành những món hàng có basePrice đắt tiền
    return greed * 0.4 + malice * 0.1 + catBonus + Deterministic.random() * 0.5;
  };

  const allAgentIds = [
    "toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh",
    "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh",
    "uVuongMau", "bachLoc"
  ];

  const productTemplates = [
    { name: "Lúa gạo đặc sản ST25", basePrice: 28000, cat: "Cây trồng", heavy: 1000 },
    { name: "Ngô lai ngọt cao cấp", basePrice: 15000, cat: "Cây trồng", heavy: 500 },
    { name: "Heo thịt siêu nạc hữu cơ", basePrice: 65000, cat: "Chăn nuôi", heavy: 80000 },
    { name: "Bò thịt chất lượng cao", basePrice: 120000, cat: "Chăn nuôi", heavy: 250000 },
    { name: "Kéo cắt cành nhập khẩu Nhật", basePrice: 250000, cat: "Kỹ thuật", heavy: 300 },
    { name: "Màng phủ nhà kính chuyên dụng", basePrice: 4500000, cat: "Kỹ thuật", heavy: 20000 },
    { name: "Hệ thống làm mát nông sản mini", basePrice: 12000000, cat: "Thu hoạch & bảo quản", heavy: 50000 },
    { name: "Máy sấy sấy thăng hoa hoa quả", basePrice: 45000000, cat: "Thu hoạch & bảo quản", heavy: 120000 },
    { name: "Mít sấy giòn xuất khẩu Rottra", basePrice: 180000, cat: "Chế biến & giá trị gia tăng", heavy: 500 },
    { name: "Cà phê Robusta rang xay nguyên chất", basePrice: 220000, cat: "Chế biến & giá trị gia tăng", heavy: 1000 },
    { name: "Báo cáo phân tích giá cà phê tháng", basePrice: 50000, cat: "Thị trường & kinh tế", heavy: 0 },
    { name: "Báo cáo chỉ số cung cầu Nông sản", basePrice: 75000, cat: "Thị trường & kinh tế", heavy: 0 },
    { name: "Cảm biến IoT đo độ ẩm đất thông minh", basePrice: 1500000, cat: "Công nghệ nông nghiệp", heavy: 150 },
    { name: "Bộ điều khiển tưới nhỏ giọt tự động", basePrice: 3800000, cat: "Công nghệ nông nghiệp", heavy: 2000 },
    { name: "Phân bón trùn quế nguyên chất", basePrice: 12000, cat: "Môi trường & bền vững", heavy: 5000 },
    { name: "Than sinh học biochar cải tạo đất", basePrice: 18000, cat: "Môi trường & bền vững", heavy: 10000 },
  ];

  const productBatches = [];
  for (let i = 1; i <= 1000; i++) {
    const id = `prod_seed_${i}`;
    productIds.push(id);
    const tmpl = productTemplates[i % productTemplates.length];

    // Tìm mảng ca dao tương ứng với category
    const catConfig = CATEGORIES.find((c) => c.name === tmpl.cat) || CATEGORIES[0];
    const quote = getRandomCaDao(catConfig.group);

    const price = tmpl.basePrice + Math.floor(Math.sin(i) * 0.1 * tmpl.basePrice); // Biến thiên nhẹ

    // Các Agent sử dụng ý thức (DNA) để tranh giành quyền phân phối sản phẩm
    let sellerId = allAgentIds[0];
    let bestScore = -1;
    for (const ag of allAgentIds) {
      const dna = DEFAULT_AGENT_DNA[ag];
      const score = getMatchScore(tmpl.name, tmpl.cat, tmpl.basePrice, dna);
      if (score > bestScore) {
        bestScore = score;
        sellerId = ag;
      }
    }

    productBatches.push({
      id,
      sellerId,
      name: `${tmpl.name} #${i}`,
      price,
      category: tmpl.cat,
      description: `[CA DAO TỤC NGỮ]: "${quote}"\n\nDòng sản phẩm cao cấp giúp gia tăng năng suất chuỗi nông nghiệp Rottra. Đạt chuẩn chất lượng ISO 9001.`,
      quantity: 100 + (i % 50),
      heavy: tmpl.heavy,
      media: [{ link: (tmpl.name.toLowerCase().includes("coffee") ? "/coffee.jpg" :
          tmpl.name.toLowerCase().includes("tea") ? "/tea.jpg" :
          tmpl.name.toLowerCase().includes("durian") ? "/durian.jpg" :
          tmpl.name.toLowerCase().includes("mango") ? "/mango.jpg" :
          tmpl.name.toLowerCase().includes("rice") || tmpl.name.toLowerCase().includes("st25") ? "/rice.jpg" :
          "/vegetable.jpg") }],
      status: true,
      expired: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      coordinates: { lat: 21.6243 + Math.sin(i) * 0.005, lng: 105.2645 + Math.cos(i) * 0.005 },
      targetPrice: price,
      costPrice: Math.round(price * (0.6 + Deterministic.random() * 0.15)),
      velocity: parseFloat((1.0 + Deterministic.random() * 49.0).toFixed(2)),
      kalmanVariance: parseFloat((0.05 + Deterministic.random() * 1.95).toFixed(3)),
      storageCost: parseFloat((tmpl.heavy / 100.0).toFixed(2)),
    });

    if (productBatches.length >= 500) {
      await db.insert(product).values(productBatches).onConflictDoNothing();
      productBatches.length = 0;
    }
  }
  if (productBatches.length > 0) {
    await db.insert(product).values(productBatches).onConflictDoNothing();
  }
  console.log(`✅ Đã nạp 1,000 Nông sản/Thiết bị.`);

  // 4.5 Ensure agents only hold exact `precision` products, reassign excess to system
  const agentIds = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];

  // Note: we fetch dna directly from DB or just assume default precision logic here
  // For simplicity, we use default precision logic based on hardcoded DNA values or simple random fallback if not initialized.
  // Actually, we can just use the DB to query their assigned agentMemory or profile since they were created.
  const dnas =
    (await db.query.agentMemory?.findMany({
      where: eq(agentMemory.contextKey, "personality_dna"),
    })) || [];
  const dnaMap = new Map();
  for (const d of dnas) dnaMap.set(d.sessionId, d);

  for (const agentId of agentIds) {
    const dna = dnaMap.get(agentId) || {};
    let precision = 3;
    const greed = (dna as any).greed ?? 0.5;
    const malice = (dna as any).malice ?? 0.5;
    if (greed > 0.7 || malice > 0.7) precision = 5;
    else if (greed < 0.4) precision = 2;

    const agentProds = await db.query.product.findMany({
      where: eq(product.sellerId, agentId),
    });

    if (agentProds.length > precision) {
      const toKeep = agentProds.slice(0, precision).map((p: any) => p.id);
      const toReassign = agentProds.filter((p: any) => !toKeep.includes(p.id)).map((p: any) => p.id);

      if (toReassign.length > 0) {
        for (let j = 0; j < toReassign.length; j += 100) {
          const batch = toReassign.slice(j, j + 100);
          await db.update(product).set({ sellerId: systemUserId }).where(inArray(product.id, batch));
        }
      }
    }
  }
  console.log(`✅ Đã hiệu chỉnh kho hàng của Agent đúng tiêu chuẩn 2-3-5.`);

  // 5. Nạp SENSOR DATA (6,000 dòng)
  console.log("📡 Đang nạp 6,000 dòng dữ liệu cảm biến IoT để phục vụ phân tích ARIMA & KNN...");
  const sensorTypes = ["temperature", "humidity", "soil_moisture", "pH"];
  const sensorUnits: Record<string, string> = {
    temperature: "Celsius",
    humidity: "%",
    soil_moisture: "%",
    pH: "pH",
  };

  // Tạo các bản ghi SensorData trong khoảng 1 năm trở lại đây
  const batches = [];
  const now = new Date();
  for (let i = 1; i <= 6000; i++) {
    const sensorType = sensorTypes[i % sensorTypes.length];
    const unit = sensorUnits[sensorType];
    let value = 0;

    // Mô phỏng chuỗi thời gian có tính chu kỳ tuần hoàn (nhà kính nông nghiệp)
    const timeRatio = i / 6000;
    const dateOffset = new Date(now.getTime() - (6000 - i) * 60 * 60 * 1000); // lùi về quá khứ 1 giờ cho mỗi bản ghi

    if (sensorType === "temperature") {
      value = 24 + 5 * Math.sin(timeRatio * Math.PI * 40) + (Deterministic.random() * 2 - 1); // Biến thiên quanh 24°C
    } else if (sensorType === "humidity") {
      value = 75 + 10 * Math.cos(timeRatio * Math.PI * 40) + (Deterministic.random() * 4 - 2); // Biến thiên quanh 75%
    } else if (sensorType === "soil_moisture") {
      value = 60 + 8 * Math.sin(timeRatio * Math.PI * 20) + (Deterministic.random() * 2 - 1); // Biến thiên quanh 60%
    } else {
      value = 6.2 + 0.5 * Math.cos(timeRatio * Math.PI * 10) + (Deterministic.random() * 0.2 - 0.1); // pH quanh 6.2
    }

    batches.push({
      id: `sensor_seed_${i}`,
      farmId: systemFarmId,
      cropSeasonId: seasonIds[i % seasonIds.length],
      sensorType,
      value: parseFloat(value.toFixed(2)),
      unit,
      recordedAt: dateOffset.toISOString(),
    });

    if (batches.length >= 1000) {
      await db.insert(sensorData).values(batches).onConflictDoNothing();
      batches.length = 0;
    }
  }
  if (batches.length > 0) {
    await db.insert(sensorData).values(batches).onConflictDoNothing();
  }
  console.log(`✅ Đã nạp 6,000 dữ liệu cảm biến.`);

  // 6. Nạp ORDERS & ORDER ITEMS (2,500 dòng)
  console.log("🛒 Đang tạo 1,250 Đơn hàng và 1,250 Giao dịch chi tiết...");
  const orderBatches = [];
  const itemBatches = [];
  for (let i = 1; i <= 1250; i++) {
    const oId = `order_seed_${i}`;
    const pId = productIds[i % productIds.length];

    orderBatches.push({
      id: oId,
      userId: systemUserId,
      status: "completed",
      cart: [{ productId: pId, quantity: 1 }], // Không để trống cart
      shippingInfo: { address: "Hồng Sơn, Tuyên Quang", phone: "0900000000" },
      total: 200000 + i * 100,
      paid: true,
      paidAt: new Date(now.getTime() - (1250 - i) * 2 * 60 * 60 * 1000).toISOString(),
      addAt: new Date(now.getTime() - (1250 - i) * 2 * 60 * 60 * 1000).toISOString(),
    });

    itemBatches.push({
      id: `order_item_seed_${i}`,
      orderId: oId,
      productId: pId,
      quantity: 1 + (i % 5),
      unitPrice: 15000 + i * 50,
    });

    if (orderBatches.length >= 500) {
      await db.insert(order).values(orderBatches).onConflictDoNothing();
      await db.insert(orderItem).values(itemBatches).onConflictDoNothing();
      orderBatches.length = 0;
      itemBatches.length = 0;
    }
  }
  if (orderBatches.length > 0) {
    await db.insert(order).values(orderBatches).onConflictDoNothing();
    await db.insert(orderItem).values(itemBatches).onConflictDoNothing();
  }
  console.log(`✅ Đã nạp 2,500 dữ liệu thương mại giao dịch.`);

  // 7. Tạo RESEARCH PROJECTS & PROJECT TASKS (500 dòng)
  console.log("🔬 Đang nạp 50 Dự án nghiên cứu của Giáo sư và 450 Tác vụ Gantt/Jira...");
  const rProjectIds = [];
  const projectsToInsert = [];
  for (let i = 1; i <= 50; i++) {
    const rpId = `project_seed_${i}`;
    rProjectIds.push(rpId);

    projectsToInsert.push({
      id: rpId,
      name: `Nghiên cứu Nông sản tối ưu ${i}`,
      description: `Đề tài tối ưu hóa giá trị gia tăng cho nhóm nông sản vùng cao. Trọng điểm Hồng Sơn, Tuyên Quang.`,
      fundingSource: `Quỹ tài trợ Nông nghiệp Công nghệ ${100 + i}`,
      budget: 150000000 + i * 10000000, // 150Tr - 650Tr
      spent: 50000000 + i * 2000000,
      startDate: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active" as const,
    });
  }
  if (projectsToInsert.length > 0) {
    await db.insert(researchProject).values(projectsToInsert).onConflictDoNothing();
  }

  const pTaskBatches = [];
  for (let i = 1; i <= 450; i++) {
    const rpId = rProjectIds[i % rProjectIds.length];
    pTaskBatches.push({
      id: `task_seed_${i}`,
      projectId: rpId,
      title: `Tác vụ thu thập chỉ số mẫu sinh học #${i}`,
      description: `Quản lý tiến trình Gantt/Trello/Jira: Đo đạc độ ẩm và ghi ELN LabArchives.`,
      status: i % 3 === 0 ? "done" : i % 3 === 1 ? "in_progress" : "todo",
      assigneeId: systemUserId,
      startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      progress: i % 3 === 0 ? 100 : i % 3 === 1 ? 45 : 0,
    });

    if (pTaskBatches.length >= 150) {
      await db.insert(projectTask).values(pTaskBatches).onConflictDoNothing();
      pTaskBatches.length = 0;
    }
  }
  if (pTaskBatches.length > 0) {
    await db.insert(projectTask).values(pTaskBatches).onConflictDoNothing();
  }
  console.log(`✅ Đã nạp 500 dữ liệu quản lý thí nghiệm & Gantt.`);

  console.log("\n🚀 NẠP DỮ LIỆU THÀNH CÔNG RỰC RỠ!");
  console.log(`📊 Tổng số dòng được gieo sấy vào CSDL:
  - User: 1 dòng
  - Farm: 1 dòng
  - CropSeasons: 50 dòng
  - Products: 1,000 dòng
  - SensorData (IoT Chuỗi thời gian): 6,000 dòng
  - Orders: 1,250 dòng
  - OrderItems: 1,250 dòng
  - ResearchProjects (Giáo sư): 50 dòng
  - ProjectTasks (Gantt/Jira): 450 dòng
  -----------------------------------------
  🌟 TỔNG CỘNG: 10,052 bản ghi dữ liệu thực tế chất lượng cao!`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
