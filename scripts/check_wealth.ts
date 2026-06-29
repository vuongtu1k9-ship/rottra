import { db } from "../src/infra/database/db-pool";
import { user } from "../src/infra/database/schema";
import { serverAgentBudgets, serverAgentGold } from "../src/shared/constants";

async function run() {
  try {
    const goldRes = await fetch("http://127.0.0.1:8080/gold-prices").catch(() => null);
    let goldBuyPrice = 10000000;
    if (goldRes && goldRes.ok) {
      const data = await goldRes.json();
      goldBuyPrice = data.buy || parseFloat(data.gia_mua || "0") * 1000 || 10000000;
    }
    
    console.log(`Giá vàng Mua Vào (để tính tổng tài sản): ${goldBuyPrice.toLocaleString()} đ/lượng\n`);

    const agentIds = ["toLuong", "thuongNguyet", "tramTinh", "daoTieuCuu", "hoaHuynh", "phiNguyet", "nhuNguyet", "suGia", "phiAnh", "bachDiHanh", "uVuongMau", "bachLoc"];
    const allUsers = await db.query.user.findMany();
    const agents = allUsers.filter(u => agentIds.includes(u.id));

    const rankings = agents.map(u => {
      const p = u.profile || {};
      const b = Number(p.budget ?? serverAgentBudgets[u.id.replace(/^user_?/, "")] ?? 0);
      const g = Number(p.gold ?? serverAgentGold[u.id.replace(/^user_?/, "")] ?? 10.0);
      const total = b + g * goldBuyPrice;
      return { name: u.name, id: u.id, budget: b, gold: g, total };
    });

    rankings.sort((a, b) => b.total - a.total);

    rankings.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name || r.id}`);
      console.log(`   - Ngân quỹ: ${r.budget.toLocaleString()} đ`);
      console.log(`   - Vàng: ${r.gold.toFixed(2)} lượng (Quy đổi: ${(r.gold * goldBuyPrice).toLocaleString()} đ)`);
      console.log(`   => TỔNG TÀI SẢN: ${r.total.toLocaleString()} đ\n`);
    });

    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
