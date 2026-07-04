const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedData() {
  console.log("🌱 BẮT ĐẦU DẠY AI (Chạy Auto-Augment để cấy Vector vào Não bộ)...\n");
  const seeds = [
    {
      intent: "HOI_GIA_SAU_RIENG",
      context: "Khách hàng muốn biết giá sầu riêng Ri6 hiện tại",
      baseAnswer: "Dạ, sầu riêng Ri6 loại 1 bao ăn hôm nay bên em đang sale sốc chỉ còn 85.000đ/ký thôi ạ.",
      count: 3
    },
    {
      intent: "HOI_CHINH_SACH_GIAO_HANG",
      context: "Khách hỏi có ship ra Hà Nội không và phí ship bao nhiêu",
      baseAnswer: "Dạ bên em giao hàng toàn quốc luôn ạ! Ship ra Hà Nội phí ship đồng giá 35k.",
      count: 3
    }
  ];

  for (const s of seeds) {
    try {
      const res = await fetch("http://localhost:5173/api/agent/auto-augment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s)
      });
      const data = await res.json();
      if (!data.success) {
        console.log(`❌ Lỗi cấy [${s.intent}]:`, data.message || data.error);
      } else {
        console.log(`✅ Cấy thành công: [${s.intent}] - Tạo ra ${data.count} biến thể Vector. Score: ${data.diversityScore}`);
      }
    } catch (e) {
      console.error(`Lỗi HTTP cấy [${s.intent}]:`, e.message);
    }
  }
}

const queries = [
  "sầu ri6 nay nhiêu 1 ký shop",
  "ship hn k bn",
  "cam sành rổ rá s z" // Câu này chưa được dạy -> Sẽ nhảy vào Log
];

async function runTest() {
  await seedData();
  
  console.log("\n🚀 BẮT ĐẦU ĐÓNG VAI KHÁCH HÀNG (Dùng từ lóng, viết tắt)\n");
  
  for (const q of queries) {
    console.log(`\n👤 Khách gõ: "${q}"`);
    try {
      const res = await fetch("http://localhost:5173/api/agent/chat-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          role: "user"
        })
      });
      const data = await res.json();
      
      console.log(`🤖 AI Trả lời: ${data.reply.replace(/\n/g, ' ')}`);
    } catch (e) {
      console.error("Lỗi gọi API:", e.message);
    }
    await delay(2100);
  }
}

runTest();
