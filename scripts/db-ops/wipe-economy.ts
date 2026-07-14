import { db } from "~/infra/database/db-pool";
import { 
  product, 
  order, 
  orderItem, 
  sensorData, 
  cropSeason,
  projectTask, 
  researchProject, 
  cart,
  negotiationLog
} from "~/infra/database/schema";

async function run() {
  console.log("🧹 Bắt đầu dọn dẹp toàn bộ dữ liệu nông sản, đơn hàng ảo...");
  try {
    await db.delete(orderItem);
    console.log("✅ Đã xóa chi tiết đơn hàng (orderItem)");
    
    await db.delete(order);
    console.log("✅ Đã xóa đơn hàng (order)");
    
    await db.delete(cart);
    console.log("✅ Đã xóa giỏ hàng (cart)");
    
    await db.delete(product);
    console.log("✅ Đã xóa sản phẩm (product)");
    
    await db.delete(sensorData);
    console.log("✅ Đã xóa dữ liệu cảm biến (sensorData)");
    
    await db.delete(cropSeason);
    console.log("✅ Đã xóa mùa vụ (cropSeason)");
    
    await db.delete(projectTask);
    console.log("✅ Đã xóa tác vụ (projectTask)");
    
    await db.delete(researchProject);
    console.log("✅ Đã xóa dự án nghiên cứu (researchProject)");

    await db.delete(negotiationLog);
    console.log("✅ Đã xóa lịch sử đàm phán (negotiationLog)");

    console.log("🎉 Hoàn tất! Database giờ đây đã sạch sẽ dữ liệu kinh tế (chỉ giữ lại danh tính 12 Agents). Các Agent sẽ tự khởi nghiệp từ 0!");
  } catch (error) {
    console.error("❌ Lỗi khi dọn dẹp:", error);
  }
  process.exit(0);
}

run();
