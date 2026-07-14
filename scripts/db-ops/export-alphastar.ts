import fs from "fs";
import path from "path";
import { RottraAI } from "../../src/core/cognitive-swarm/swarm-dispatcher";
import { AgentState } from "../../src/core/cognitive-swarm/alphastar-brain";

const VAULT_DIR = path.join(process.cwd(), ".vault");
const WEIGHTS_FILE = path.join(VAULT_DIR, "alphastar-weights.json");

async function exportPretrainedWeights() {
  console.log("🚀 Khởi động giả lập League Training siêu tốc cho AlphaStar...");
  
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  // Giả lập 5000 vòng lặp đàm phán cực nhanh để mài giũa trọng số
  const dummyState: AgentState = {
    marketPrice: 150000,
    costPrice: 80000,
    greed: 0.7,
    vengeance: 0.2,
    malice: 0.1,
    inventoryCount: 100,
    currentGridX: 0,
    currentGridY: 0,
    lastDecisionPath: [],
    isImpossibleMode: true
  };

  const iterations = 5000;
  console.log(`🧠 Bắt đầu huấn luyện ${iterations} vòng...`);
  
  for (let i = 0; i < iterations; i++) {
    // Lấy action ngẫu nhiên
    const { actionIdx } = RottraAI.alphastarBrain.selectAction(dummyState, false);
    
    // Reward giả lập: Nếu mua rẻ / bán đắt thì thưởng, ngược lại phạt
    const reward = actionIdx === 2 /* DISCOUNT */ ? -0.5 : 1.0; 
    
    // Cập nhật mạng (Temporal Difference Learning)
    RottraAI.alphastarBrain.update(dummyState, actionIdx, reward, dummyState);
    
    if (i % 500 === 0) {
      console.log(`⏳ Đã hoàn thành ${i}/${iterations} vòng...`);
    }
  }

  console.log("💾 Đang trút trọng số ra tệp nhị phân...");
  // Lưu snapshot
  const snaps = RottraAI.alphastarBrain.exportWeights();
  fs.writeFileSync(WEIGHTS_FILE, snaps, "utf-8");
  
  console.log(`✅ Đã trút thành công file trọng số tĩnh tại: ${WEIGHTS_FILE}`);
  console.log("🤖 Bạn có thể copy file này sang dự án khác và dùng hàm loadSnapshotAll() để sử dụng ngay mà không cần huấn luyện lại từ đầu.");
}

exportPretrainedWeights().catch(console.error);
