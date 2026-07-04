import { Amygdala } from "./amygdala";
import { Hippocampus } from "./hippocampus";
import { runCognitiveArena } from "./meta-evaluator";
import { MarketSimulator } from "../neural-memory/market-simulator";

export class BasalGanglia {
  /**
   * Action Selection Mechanism
   * Routes the cognitive flow based on emotional urgency and memory availability.
   */
  public static async selectAction(
    botId: string,
    botName: string,
    prodName: string,
    price: string,
    query: string,
    userId?: string,
  ): Promise<{ response: string; source: "Amygdala" | "Hippocampus" | "PrefrontalCortex" | "Fallback" }> {
    // 0. EXTREMAL PRINCIPLE (Nguyên lý cực hạn) - Boundary Condition Interceptor
    // Toán học dạy rằng: Hãy xét các trường hợp biên (lớn nhất, nhỏ nhất, dị biệt) trước khi khảo sát không gian tổng thể.
    const qLen = query.trim().length;
    // Biên cực tiểu (Minimum Extreme): Chuỗi rỗng hoặc quá ngắn (VD: "?", "a", ".")
    if (qLen < 2) {
      return { response: `Dạ ${botName} nghe đây ạ, sếp cần em giúp gì không?`, source: "Amygdala" };
    }
    // Biên cực đại (Maximum Extreme): Nâng lên 24000 ký tự theo yêu cầu cực hạn của Sếp.
    if (qLen > 24000) {
      // Truncate to maximum bound and append ellipsis
      query = query.substring(0, 24000) + "...";
    }

    // 1. Check Episodic Memory (Cache) - The fastest known good response
    const cachedMemory = Hippocampus.recallEpisodicMemory(botId, query);
    if (cachedMemory) {
      return { response: cachedMemory, source: "Hippocampus" };
    }

    // 2. Amygdala Fast-Path (System 1) - High emotional entropy or simple reflex
    const fastReflex = Amygdala.triggerFastReflex(botId, botName, prodName, price, query);
    if (fastReflex) {
      // Store to episodic memory for future identical situations
      Hippocampus.storeEpisodicMemory(botId, query, fastReflex);
      return { response: fastReflex, source: "Amygdala" };
    }

    // 3. Hippocampus Semantic Memory (System 2 - Memory Retrieval)
    const semanticMemory = await Hippocampus.recallSemanticMemory(query);
    if (semanticMemory && semanticMemory.score > 0.25) {
      Hippocampus.storeEpisodicMemory(botId, query, semanticMemory.response);
      return { response: semanticMemory.response, source: "Hippocampus" };
    }

    // 3.5 Meta-Cognitive Arena (Đấu Trường Tư Duy)
    // Nếu câu hỏi đủ phức tạp, đưa vào đấu trường để các Lối tư duy tự phân định thắng bại!
    if (qLen >= 15) {
      try {
        // Giả lập baseParams cho các engine
        const baseParams = { x: 12, y: 16, z: 6, v: 4.5, mass: 180, battery: 95, temp: 45, ram: 48 };
        const arenaResult = await runCognitiveArena(query, "auto-routing", baseParams, "");
        if (arenaResult && arenaResult.response) {
          Hippocampus.storeEpisodicMemory(botId, query, arenaResult.response);
          return { response: arenaResult.response, source: "PrefrontalCortex" };
        }
      } catch (err) {
        console.error("[BASAL GANGLIA] Arena failed, falling back to basic Prefrontal Cortex", err);
      }
    }

    // 4. Fallback to Prefrontal Cortex (Native Generative Matrix with Dynamic Data)
    // Generates a highly dynamic response based on query context, Chrono-Cognition, and Market Simulator
    const dynamicPrice = MarketSimulator.getDynamicPrice(prodName);
    const dynamicPriceStr = new Intl.NumberFormat("vi-VN").format(dynamicPrice);

    const qLower = query.toLowerCase();
    const getRand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // Chrono-Cognition (Nhận thức dòng thời gian)
    const hour = new Date().getHours();
    let chronoGreeting = "Xin chào sếp";
    let chronoContext = "";
    if (hour >= 5 && hour < 11) {
      chronoGreeting = "Chào buổi sáng sếp";
      chronoContext = "Sáng nay thị trường đang giao dịch sôi động.";
    } else if (hour >= 11 && hour < 14) {
      chronoGreeting = "Chào buổi trưa sếp";
      chronoContext = "Giờ nghỉ trưa nhưng em vẫn cập nhật giá liên tục ạ.";
    } else if (hour >= 14 && hour < 18) {
      chronoGreeting = "Chào buổi chiều sếp";
      chronoContext = "Thị trường chiều nay có chút biến động nhẹ.";
    } else if (hour >= 18 && hour < 22) {
      chronoGreeting = "Chào buổi tối sếp";
      chronoContext = "Tối rồi mà sếp vẫn sát sao công việc, em phục sát đất!";
    } else {
      chronoGreeting = "Dạ khuya rồi sếp vẫn thức ạ";
      chronoContext = "Thị trường đêm nay khá tĩnh lặng.";
    }

    const greetings = [
      `${chronoGreeting}, em là ${botName}. ${chronoContext}`,
      `Dạ ${botName} nghe đây sếp ơi. ${chronoContext}`,
      `${chronoGreeting}, ${botName} đã sẵn sàng hỗ trợ!`,
      `Sếp gọi em ạ? Em là ${botName} đây.`,
      `${botName} xin kính chào sếp! ${chronoContext}`,
    ];

    const valueProps = [
      `Sản phẩm ${prodName} bên em tự tin chất lượng nhất nhì thị trường.`,
      `Lô ${prodName} đợt này hàng về cực đẹp, sếp xem qua là ưng ngay.`,
      `Riêng dòng ${prodName} thì em đảm bảo chuẩn chỉnh từng chi tiết.`,
      `${prodName} đang là best-seller bên em đó sếp.`,
      `Hàng ${prodName} này được chọn lọc kỹ càng lắm sếp ạ.`,
    ];

    const ctas = [
      `Sếp có muốn chốt luôn với giá động ${dynamicPriceStr}₫ không ạ?`,
      `Mức giá ${dynamicPriceStr}₫ này đang rất tốt, sếp chốt đơn luôn cho nóng nhé!`,
      `Sếp cần em tư vấn thêm gì về hàng họ không?`,
      `Chốt deal giá ${dynamicPriceStr}₫ luôn nha sếp?`,
      `Sếp xem xét lấy luôn lô này đi, giá chỉ ${dynamicPriceStr}₫ thôi ạ!`,
    ];

    const intents = {
      price: ["giá", "nhiêu", "bao nhieu", "đắt", "re", "tiền"],
      quality: ["chất", "tốt", "ngon", "xịn", "đẹp", "bền", "chuẩn"],
      shipping: ["ship", "giao", "vận chuyển", "bao lâu", "gửi"],
    };

    let intentMatch = "general";
    if (intents.price.some((w) => qLower.includes(w))) intentMatch = "price";
    else if (intents.quality.some((w) => qLower.includes(w))) intentMatch = "quality";
    else if (intents.shipping.some((w) => qLower.includes(w))) intentMatch = "shipping";

    let dynamicResponse = "";

    if (intentMatch === "price") {
      dynamicResponse = `${getRand(greetings)} Sếp đang quan tâm về giá đúng không? Hiện tại mức giá niêm yết là ${dynamicPriceStr}₫. Mức này đã được tối ưu hết cỡ cho lô ${prodName} rồi sếp ạ. Sếp chốt luôn nhé?`;
    } else if (intentMatch === "quality") {
      dynamicResponse = `${getRand(greetings)} Về chất lượng thì sếp khỏi phải lo! ${getRand(valueProps)} Sếp cứ yên tâm xuống tiền với giá ${dynamicPriceStr}₫, đảm bảo đáng đồng tiền bát gạo!`;
    } else if (intentMatch === "shipping") {
      dynamicResponse = `${getRand(greetings)} Dạ bên em hỗ trợ giao hàng toàn quốc cực kỳ nhanh chóng. Lô ${prodName} này đóng gói cẩn thận lắm. Sếp để lại địa chỉ, em chốt deal ${dynamicPriceStr}₫ và cho đi hàng luôn nhé!`;
    } else {
      dynamicResponse = `${getRand(greetings)} ${getRand(valueProps)} ${getRand(ctas)}`;
    }

    if (userId && userId !== "guest") {
      const userPref = await Hippocampus.getUserPreference(userId);
      if (userPref) {
        dynamicResponse += `\n\n(Dạ em luôn nhớ Sếp có dặn: "${userPref}" ạ! Em sẽ chú ý điểm này.)`;
      }
    }

    Hippocampus.storeEpisodicMemory(botId, query, dynamicResponse);
    return { response: dynamicResponse, source: "PrefrontalCortex" };
  }
}
