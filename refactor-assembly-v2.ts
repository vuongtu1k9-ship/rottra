import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "src", "client", "views", "assembly.tsrx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Scripted conversation
const scriptedConversationBlock = `const SCRIPTED_CONVERSATION = [
  { botId: "toLuong", text: "Hội nghị Nguyệt Quang chính thức khai mở. Ta mong muốn các thương vụ hôm nay diễn ra công bằng, minh bạch. Hãy báo cáo tình hình sản xuất nông sản của các vị." },
  { botId: "thuongNguyet", text: "Tô Đầu Lĩnh nói phải. Uy tín là tài sản lớn nhất. Ta đang cân nhắc chè Shan Tuyết cổ thụ 🍃 làm sản phẩm chủ lực đợt này." },
  { botId: "tramTinh", text: "Chè Shan Tuyết đợt này rất tốt, nhưng Tinh Hà Hộ Thể Cổ 🪲 của tôi báo hiệu giá vàng hệ thống đang biến động. Mọi người nên cẩn trọng khi quyết định giá." },
  { botId: "daoTieuCuu", text: "Hihi, Trầm Tinh lại lo xa rồi! Em thấy cứ chốt giao dịch chè trước đi. Có ai muốn giảm giá cho Tiểu Cửu ít chè cổ thụ không nào? ✨" },
  { botId: "hoaHuynh", text: "Giảm giá á? Mơ đi cưng! Heo hữu cơ 🐖 của ta đang đắt hàng đây này, bận rộn lắm, Hỏa Huỳnh Vương ta không bớt một cắc!" },
  { botId: "phiNguyet", text: "Hỏa Huỳnh Vương chớ nóng giận. Chúng ta lấy chữ tín làm đầu, để tôi làm trung gian điều phối nông sản sạch, đảm bảo sức khỏe cho mọi người." },
  { botId: "nhuNguyet", text: "Thánh địa sẽ giám sát chặt chẽ. Đề nghị mọi người tuân thủ biểu giá trần của Rottra, không được ngáo giá hay ép giá quá đáng." },
  { botId: "suGia", text: "Ý chí Nguyệt Thần bảo hộ cuộc họp này. Than sinh học biochar của ta cải tạo đất cực tốt, đã sẵn sàng bàn giao cho các thương hội." },
  { botId: "phiAnh", text: "Ánh sáng Quang Minh muôn năm! Ngô lai ngọt 🌽 của em ngọt lịm, có ai muốn đổi lấy chè cổ thụ hoặc than biochar không?" },
  { botId: "bachDiHanh", text: "Thanh kiếm của tôi sẽ bảo vệ các hiệp ước công bằng. Cà phê Robusta ☕ của tôi sẽ tiếp thêm năng lượng cho mọi người đàm phán sòng phẳng!" },
  { botId: "uVuongMau", text: "Hợp tác sòng phẳng? Từ bóng tối địa lao, ta chỉ quan tâm kẻ nào đưa ra lợi nhuận cao nhất. Màng phủ nhà kính của ta giá không rẻ đâu." },
  { botId: "bachLoc", text: "Hòa bình và sinh khí rừng sâu sẽ hòa hợp giao thương. Lúa gạo ST25 🌾 của ta rất thơm ngon, thanh khiết, sẵn sàng giao dịch." },
  // Round 2
  { botId: "toLuong", text: "Ta thấy ý kiến của Bạch Lộc rất tốt. Gạo ST25 cần được phân phối rộng rãi. Ta sẽ chi ngân sách thu mua đợt này." },
  { botId: "thuongNguyet", text: "Tô Đầu Lĩnh quả là hào phóng. Ta cũng sẽ trích quỹ chè Shan Tuyết để hỗ trợ trao đổi lương thực." },
  { botId: "tramTinh", text: "Năng lượng giao dịch rất ổn định. Tôi đồng ý hỗ trợ vận chuyển gạo qua các tuyến đường Nguyệt Quang." },
  { botId: "daoTieuCuu", text: "Tuyệt vời quá! Vậy là mọi người đều có gạo ngon chè sạch rồi. Em sẽ mang cảm biến đo độ ẩm đất tặng kèm luôn nhé!" },
  { botId: "hoaHuynh", text: "Thế thì tốt! Ta sẽ cung cấp thịt heo hữu cơ giá ưu đãi cho bữa tiệc ăn mừng của hội nghị." },
  { botId: "phiNguyet", text: "Rất tốt. Tôi sẽ chuẩn bị thêm trà thảo mộc tịnh hóa cơ thể cho các chiến binh sau cuộc họp." },
  { botId: "nhuNguyet", text: "Tôi đã cập nhật nhật ký giao dịch. Mọi dữ liệu đều minh bạch trên Blockchain Ledger." },
  { botId: "suGia", text: "Chúc phúc cho sự thịnh vượng của cả hai phe Quang Minh và Nguyệt Quang." },
  { botId: "phiAnh", text: "Em vui quá! Cảm ơn mọi người đã cùng chia sẻ nông sản tươi ngon." },
  { botId: "bachDiHanh", text: "Hiệp ước đã thành. Thanh kiếm của tôi sẽ bảo vệ thành quả lao động này." },
  { botId: "uVuongMau", text: "Hừm, tuy lợi nhuận không cao như ta mong muốn, nhưng đây là một thương vụ thông minh." },
  { botId: "bachLoc", text: "Vạn vật sinh sôi, lòng người hòa hợp. Cảm ơn hội nghị đã trân trọng lúa gạo rừng sâu." }
];

const getBotMessage = (botId: string, currentStep: number = 0): string => {
  const step = currentStep || 0;
  const scriptLine = SCRIPTED_CONVERSATION[step % SCRIPTED_CONVERSATION.length];
  if (scriptLine.botId === botId) {
    return t(scriptLine.text);
  }
  
  // Fallback: Tìm dòng thoại tương ứng của nhân vật này trong cùng vòng
  const round = Math.floor(step / 12) % 2;
  const matchingLine = SCRIPTED_CONVERSATION.find(
    (line, idx) => line.botId === botId && Math.floor(idx / 12) % 2 === round
  );
  if (matchingLine) {
    return t(matchingLine.text);
  }
  
  return t("Tôi đồng ý với thảo luận hiện tại của hội nghị.");
};`;

// Robust regex match
const regex = /const getBotMessage = \(botId: string\): string => \{[\s\S]*?return t\(pool\[hashIdx\]\);\s*\r?\n\s*\};/;
if (regex.test(content)) {
  content = content.replace(regex, scriptedConversationBlock);
  console.log("Successfully replaced getBotMessage block");
} else {
  console.error("Regex match failed! Trying fallback string index matching with CRLF normalization.");
  
  const normalized = content.replace(/\r\n/g, "\n");
  const oldStart = "const getBotMessage = (botId: string): string => {";
  const oldEnd = "return t(pool[hashIdx]);\n};";
  const startIndex = normalized.indexOf(oldStart);
  const endIndex = normalized.indexOf(oldEnd);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const endPos = endIndex + oldEnd.length;
    const oldBlock = normalized.substring(startIndex, endPos);
    const newNormalized = normalized.replace(oldBlock, scriptedConversationBlock);
    content = newNormalized.replace(/\n/g, "\r\n"); // restore CRLF
    console.log("Successfully replaced block using CRLF normalization");
  } else {
    throw new Error("Could not match getBotMessage block anywhere!");
  }
}

// 3. Replace the call site
const callSite = "const fallbackText = getBotMessage(botId);";
if (content.includes(callSite)) {
  content = content.replace(callSite, "const fallbackText = getBotMessage(botId, messages().length);");
  console.log("Successfully replaced call site");
} else {
  console.warn("Call site already modified or not found");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("File written successfully!");
process.exit(0);
