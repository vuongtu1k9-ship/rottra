import { db } from "./db";
import { product } from "./schema";
import { eq } from "drizzle-orm";

const caDaoCrops = ["Nhất nước, nhì phân, tam cần, tứ giống. Lúa chiêm lấp ló đầu bờ, hễ nghe tiếng sấm phất cờ mà lên.", "Ai ơi bưng bát cơm đầy, dẻo thơm một hạt, đắng cay muôn phần.", "Được mùa lúa, úa mùa khoai. Mưa tháng ba hoa đất, mưa tháng tư hư đất.", "Mùa nào thức nấy. Nhất sỹ nhì nông, hết gạo chạy rông, nhất nông nhì sỹ.", "Cơm tẻ là mẹ ruột. Thớt đất hơn bát bùn."];

const caDaoHusbandry = ["Muốn giàu nuôi cá, muốn khá nuôi heo. Nuôi tằm ăn cơm đứng.", "Lợn đói một bữa bằng người đói cả năm.", "Đầu gà hơn đuôi trâu. Chó giữ nhà, gà gáy sáng.", "Trâu ơi ta bảo trâu này, trâu ra ngoài ruộng trâu cày với ta.", "Con gà cục tác lá chanh, con lợn ủn ỉn mua hành cho tôi."];

const caDaoTechniques = ["Công cấy là công bỏ, công làm cỏ là công ăn.", "Tỏ trăng mười bốn được tằm, tỏ trăng hôm rằm thì được lúa chiêm.", "Ăn kỹ no lâu, cày sâu tốt lúa.", "Đất thiếu chân sao tốt lúa, người thiếu của sao có lòng nhân.", "Không nước, không phân, cây sao tốt trái."];

const caDaoHarvest = ["Gặt lúa phải gặt cả bông, chớ gặt nửa chừng bỏ phí ngoài đồng.", "Lúa chín vàng đồng, lòng người hớn hở. Kho chứa đầy ụ, mùa màng bội thu.", "Được mùa chớ phụ ngô khoai, đến năm thất bát lấy ai bạn cùng.", "Kho thóc đầy nhà, ấm no hạnh phúc."];

const caDaoProcessing = ["Gạo đem vào giã bao đau đớn, giã xong trắng tựa bông.", "Trăm hay không bằng tay quen. Khéo tay hay làm.", "Hương vị quê hương, kết tinh giá trị nông sản việt.", "Ép dầu ép mỡ, ai nỡ ép duyên."];

const caDaoMarket = ["Buôn có bạn, bán có phường. Trăm người bán, vạn người mua.", "Đắt ra quế, rẻ ra bùn. Mua bán phân minh, nghĩa tình trọn vẹn.", "Tiền nào của nấy. Đồng tiền đi liền khúc ruột."];

const caDaoTech = ["Khoa học kỹ thuật đưa nông sản vươn xa. Thiết bị thông minh, mùa vàng gõ cửa.", "Thời đại số hóa, nông gia phát tài.", "Máy móc thay trâu, năng suất hàng đầu."];

const caDaoEco = ["Đất lành chim đậu. Giữ lấy màu xanh, nuôi nguồn nhựa sống.", "Nước chảy đá mòn. Rừng vàng biển bạc, đất phì nhiêu.", "Môi trường xanh sạch, mùa màng bội thu."];

const getRandomCaDao = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

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

async function main() {
  console.log("📝 Đang cập nhật lại Ca Dao Tục Ngữ đúng chuẩn theo DANH MỤC sản phẩm...");

  const allProds = await db.query.product.findMany();
  let count = 0;

  for (const p of allProds) {
    const catConfig = CATEGORIES.find((c) => c.name === p.category) || CATEGORIES[0];
    const quote = getRandomCaDao(catConfig.group);

    const newDesc = `[CA DAO TỤC NGỮ]: "${quote}"\n\nDòng sản phẩm cao cấp giúp gia tăng năng suất chuỗi nông nghiệp Rottra. Đạt chuẩn chất lượng ISO 9001.`;
    await db.update(product).set({ description: newDesc }).where(eq(product.id, p.id));
    count++;
  }

  console.log(`✅ Đã hiệu chỉnh đúng mẫu Ca Dao Tục Ngữ theo ngành hàng cho ${count} sản phẩm!`);
  process.exit(0);
}

main();
