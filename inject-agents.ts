import { vectorDocument } from "./src/infra/database/schema";
import { db } from "./src/infra/database/db-pool";
import { generateEmbeddingAsyncAwait } from "./src/core/neural-memory/vector-rag";

const agentIds = [
  "toLuong",
  "thuongNguyet",
  "tramTinh",
  "daoTieuCuu",
  "hoaHuynh",
  "phiNguyet",
  "nhuNguyet",
  "suGia",
  "phiAnh",
  "bachDiHanh",
  "uVuongMau",
  "bachLoc",
];

const textContent = `Muốn giàu nhanh thật sự, thường phải có 1 trong 3 thứ: 1. Kiến thức cực giỏi trong một lĩnh vực kiếm tiền. 2. Vốn lớn sẵn. 3. Chấp nhận rủi ro cao. Không có 3 cái này thì "giàu nhanh" gần như = may mắn.`;

async function run() {
  console.log("Đang tạo Vector Embedding cho kiến thức mới...");
  // Pad array to 1024 dims to match halfvec
  let embedding = await generateEmbeddingAsyncAwait(textContent);
  if (embedding.length < 1024) {
    const padded = new Array(1024).fill(0);
    for(let i=0; i<embedding.length; i++) padded[i] = embedding[i];
    embedding = padded;
  } else if (embedding.length > 1024) {
    embedding = embedding.slice(0, 1024);
  }
  
  console.log("Đang tiêm kiến thức vào não bộ của 12 Agents...");
  for (const agentId of agentIds) {
    console.log(`- Nạp cho agent: ${agentId}`);
    await db.insert(vectorDocument).values({
      id: crypto.randomUUID(),
      category: "USER_MEMORY",
      title: "Triết lý làm giàu",
      subtitle: "Nguyên tắc cốt lõi về sự giàu có",
      content: textContent,
      embedding: embedding as any,
      tenantId: agentId,
      metadata: { source: "Master User", date: new Date().toISOString(), priority: "HIGH" }
    });
  }
  console.log("Nạp kiến thức thành công cho cả 12 Agents!");
  process.exit(0);
}

run();
