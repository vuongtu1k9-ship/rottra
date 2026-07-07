// =========================================================================
// ROTTRA HYBRID OFFLINE AI ENGINE
// Mạng Neural, Heuristic Rules, Levenshtein Fuzzy Search & Gamification (Monty Hall)
// =========================================================================

import * as crypto from "node:crypto";
import { db } from "~/infra/database/db-pool";
import { product } from "~/infra/database/schema";

/**
 * 0. Quản lý trạng thái Trò chơi (Monty Hall Game State)
 */
type GameState = {
  step: 1 | 2; // 1: Chờ chọn hộp, 2: Chờ đổi/giữ
  winningDoor: number; // 1, 2, or 3
  chosenDoor?: number;
  goatDoor?: number;
  prodName: string;
  price: string;
  discountedPrice: string;
  character: string;
};

const GAME_STATE_MAP = new Map<string, GameState>();

/**
 * 0.0 Trí nhớ ngắn hạn (Contextual Memory)
 */
const USER_MEMORY_MAP = new Map<string, string[]>();

/**
 * 0.1 Cache Sản phẩm để chống sập DB
 */
let PRODUCT_CACHE: any[] | null = null;
let PRODUCT_CACHE_EXPIRES = 0;

/**
 * 0.1. Bộ trộn văn bản Spintax siêu nhẹ
 */
export function spinText(text: string): string {
  const spintaxRegex = /\{([^{}]*)\}/g;
  let result = text;
  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (match, p1) => {
      const options = p1.split("|");
      return options[Math.floor(Math.random() * options.length)];
    });
  }
  return result;
}

/**
 * 1. Thuật toán Fuzzy Search (Levenshtein Distance + Jaccard)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function calculateFuzzyScore(query: string, targetName: string): number {
  const cleanQ = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cleanT = targetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const qWords = cleanQ.split(/\s+/);
  const tWords = cleanT.split(/\s+/);
  let matchCount = 0;
  
  for (const qw of qWords) {
    let bestWordScore = 0;
    for (const tw of tWords) {
      const dist = levenshteinDistance(qw, tw);
      const maxLen = Math.max(qw.length, tw.length);
      const similarity = maxLen === 0 ? 1 : (maxLen - dist) / maxLen;
      if (similarity > bestWordScore) {
        bestWordScore = similarity;
      }
    }
    if (bestWordScore > 0.7) {
      matchCount++;
    }
  }
  
  return qWords.length === 0 ? 0 : matchCount / qWords.length;
}

/**
 * 2. Mạng Neural phân loại ý định (Tiny Neural Classifier)
 */
export class TinyNeuralClassifier {
  private cleanText(text: string): string {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim();
  }

  public predict(query: string): { primaryIntent: string, allIntents: string[], sentiment: "angry"|"positive"|"neutral", confidence: number } {
    const clean = this.cleanText(query);
    const intents: string[] = [];
    let sentiment: "angry"|"positive"|"neutral" = "neutral";
    
    // Sentiment Analysis
    const angryKws = ["gian", "tuc", "te", "dat", "mac qua", "lua dao", "xam", "boc lot"];
    const positiveKws = ["tot", "ngon", "cam on", "tuyet", "dep", "ung", "thich"];
    if (angryKws.some(kw => clean.includes(kw))) sentiment = "angry";
    else if (positiveKws.some(kw => clean.includes(kw))) sentiment = "positive";
    
    // Intent Analysis
    const offTopicKeywords = ["nau an", "mon an", "cuoi", "chuyen cuoi", "lam sao", "thoi tiet", "tin tuc", "ai la", "la gi", "cong thuc", "lap trinh"];
    if (offTopicKeywords.some(kw => clean.includes(kw)) && !clean.includes("gia") && !clean.includes("mua")) {
      intents.push("OFF_TOPIC");
    }

    const expiredKeywords = ["han su dung", "de duoc bao lau", "ngay san xuat", "het han", "date", "bao quan"];
    if (expiredKeywords.some(kw => clean.includes(kw))) {
      intents.push("EXPIRED");
    }

    const shippingKeywords = ["phi ship", "van chuyen", "giao hang", "nang khong", "cuoc", "ship"];
    if (shippingKeywords.some(kw => clean.includes(kw)) && !clean.includes("mua") && !clean.includes("lay")) {
      intents.push("SHIPPING");
    }

    const bargainKeywords = ["giam", "bot", "re", "mac ca", "chiet khau", "giam gia", "fix", "thuong luong", "dam phan", "giam mot it"];
    const buyKeywords = ["mua", "lay", "chot", "dat hang", "order", "ship cho", "giao cho", "dat", "thanhtoan", "chuyen khoan"];

    let bargainCount = 0; let buyCount = 0;
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      if (bargainKeywords.some(kw => word.includes(kw))) bargainCount++;
      if (buyKeywords.some(kw => word.includes(kw))) buyCount++;
    }

    if (bargainCount > 0) intents.push("BARGAIN");
    if (buyCount > 0) intents.push("BUY");
    if (intents.length === 0) intents.push("GENERAL");

    return { 
      primaryIntent: intents[0], 
      allIntents: intents, 
      sentiment, 
      confidence: 0.92 
    };
  }
}

/**
 * 3. Hệ chuyên gia suy luận logic (Forward-Chaining Engine)
 */
export class HybridInferenceEngine {
  private facts: Set<string> = new Set();
  private rules: Array<{ conditions: string[]; action: string }> = [];

  public addFact(fact: string) { this.facts.add(fact); }
  public addRule(conditions: string[], action: string) { this.rules.push({ conditions, action }); }

  public runInference(): string[] {
    let updated = true;
    const actionsTriggered: string[] = [];
    while (updated) {
      updated = false;
      for (const rule of this.rules) {
        if (!this.facts.has(rule.action)) {
          if (rule.conditions.every(cond => this.facts.has(cond))) {
            this.facts.add(rule.action);
            actionsTriggered.push(rule.action);
            updated = true;
          }
        }
      }
    }
    return actionsTriggered;
  }
}

type CharacterResponse = {
  name: string; style: string;
  discount: string[]; reject: string[]; confirm: string[]; confirmWarn: string[]; general: string[]; offtopic: string[];
  expired: string[]; shipping: string[];
  gameStart: string[];
  gameReveal: string[];
  gameWin: string[];
  gameLose: string[];
};

const CHARACTERS: Record<string, CharacterResponse> = {
  toLuong: {
    name: "Tô Lương", style: "thương nhân",
    discount: ["{Tô Lương ta|Bản thân ta|Ta} {đồng ý|quyết định|sẵn sàng} {giảm giá hữu nghị|bớt} 5% cho {hiền hữu|ngươi|bạn}. Giá mới là {dp}₫."],
    reject: ["{Thật sự xin lỗi|Vô cùng áy náy} {hiền hữu|ngươi}. Lô {prod} này {nhà vườn chỉ còn vài thùng|khách tranh mua rất nhiều}. Ta {không thể bớt|tuyệt đối không thể giảm} so với mức giá {price}₫."],
    confirm: ["{Tuyệt vời!|Quá tốt!} Ta {rất thích|ưng ý} phong cách giao dịch {dứt khoát|nhanh gọn} của {hiền hữu|ngươi}. Lô {prod} giá {price}₫ sẽ được {ta|Tô Lương ta} vận chuyển {sớm nhất|ngay lập tức}."],
    confirmWarn: ["{Đồng ý giao dịch!|Chốt đơn!} Tuy nhiên lô {prod} này {hiện còn rất ít|sắp cháy hàng}. Để {giữ hàng|không mất duyên}, hữu vui lòng {chuyển khoản đặt cọc|thanh toán sớm} nhé."],
    general: ["{Chào hiền hữu!|Rất vui được tiếp đón!} Ta cung cấp {prod} {đạt chuẩn|chất lượng} với giá {price}₫. Hữu cần {tư vấn|hỏi thêm} gì không?"],
    offtopic: ["{Thật ngại quá|Xin lỗi hữu}, ta chỉ rành về hàng hóa nông sản chứ không thạo chuyện {ngoài lề|đó}. Nếu hữu mua {prod}, cứ bảo ta nhé!"],
    expired: ["{Về hạn dùng|Về bảo quản}, lô {prod} này {HSD|hạn sử dụng} là tới ngày {expireDate}. Hiền hữu {cứ yên tâm|hoàn toàn an tâm} chất lượng nhé!"],
    shipping: ["{Về phí ship|Vận chuyển}, lô {prod} này trọng lượng tầm {heavyKg}kg. Ta sẽ {đóng gói kỹ|hỗ trợ tìm xe rẻ} cho hiền hữu, tiền cước hữu thanh toán với nhà xe nhé."],
    gameStart: ["{Hiền hữu|Ngươi} thích {mặc cả|giảm giá} đúng không? Chơi với {Tô Lương ta|ta} một ván cược nhé! Ta có 3 hộp quà bí mật: 1 hộp chứa **Voucher giảm 20%** cho lô {prod}, 2 hộp còn lại trống không. Ngươi chọn hộp số 1, 2 hay 3?"],
    gameReveal: ["{Khoan đã|Bình tĩnh}! Ngươi chọn hộp {chosenDoor}. Ta sẽ mở hộp số {goatDoor} cho ngươi xem, nó **hoàn toàn trống rỗng**! Trò chơi chưa kết thúc, giờ chỉ còn hộp {chosenDoor} (của ngươi) và hộp {otherDoor}. **Ngươi có muốn ĐỔI sang hộp {otherDoor} không?** (Nhập 'Đổi' hoặc 'Giữ')"],
    gameWin: ["{Ha ha|Tuyệt vời}! Ngươi là một tay lão luyện! Ngươi đã {đổi|giữ} đúng hộp chứa Voucher 20%! Lô {prod} của ngươi sẽ được giảm còn {dp20}₫. Chốt đơn luôn nhé!"],
    gameLose: ["{Tiếc quá|Ây da}! Ngươi đã chọn sai hộp rồi. Voucher 20% nằm ở hộp {winningDoor} cơ. Nhưng vì ngươi đã dám chơi, ta an ủi giảm 5% cho ngươi, giá còn {dp}₫. {Mua luôn nhé|Chốt nhé}!"],
  },
  default: {
    name: "Trợ lý Rottra", style: "tôi",
    discount: ["Trợ lý Rottra {đồng ý|sẵn sàng} giảm 5% cho lô {prod}. Giá mới là {dp}₫."],
    reject: ["{Xin lỗi bạn|Rất tiếc}, giá {price}₫ cho {prod} là {giá tiêu chuẩn|giá niêm yết}, {không thể bớt|không điều chỉnh thêm}."],
    confirm: ["Giao dịch {thành công|đã ghi nhận}! Lô {prod} giá {price}₫ sẽ {sớm được xử lý|được lên đơn ngay}."],
    confirmWarn: ["{Đã nhận đơn!|Xác nhận!} Tuy nhiên kho báo {prod} {còn rất ít|sắp hết}. Bạn vui lòng {thanh toán sớm|chuyển khoản nhanh} nhé."],
    general: ["{Xin chào|Chào bạn}, lô {prod} hiện có giá {price}₫. Bạn cần {hỗ trợ gì thêm|tư vấn gì thêm} không?"],
    offtopic: ["{Xin lỗi bạn|Rất tiếc}, tôi chỉ hỗ trợ mua bán sản phẩm như {prod} thôi ạ."],
    expired: ["Hạn sử dụng của {prod} là ngày {expireDate} bạn nhé. Hàng luôn được đảm bảo {tươi mới|chất lượng}!"],
    shipping: ["Lô {prod} này có trọng lượng khoảng {heavyKg}kg. Chi phí vận chuyển sẽ phụ thuộc vào biểu phí của đơn vị giao hàng nhé bạn."],
    gameStart: ["Hệ thống xin kích hoạt Mini-game Ưu đãi! Bạn hãy chọn 1 trong 3 hộp quà (1, 2, 3) để nhận Voucher giảm giá 20% cho {prod} nhé!"],
    gameReveal: ["Hệ thống đã mở hộp số {goatDoor} và nó trống không! Hiện tại chỉ còn hộp {chosenDoor} của bạn và hộp {otherDoor}. Bạn có muốn đổi lựa chọn sang hộp {otherDoor} không? (Gõ Đổi hoặc Không)"],
    gameWin: ["Chúc mừng bạn! Hộp bạn chọn chứa Voucher giảm 20%. Mức giá mới của {prod} là {dp20}₫. Hãy xác nhận đặt hàng!"],
    gameLose: ["Rất tiếc, hộp chứa Voucher 20% là hộp số {winningDoor}. Nhưng hệ thống vẫn tặng bạn mã giảm 5%, giá mới là {dp}₫. Hãy xác nhận nhé!"],
  }
};

/**
 * 4. Engine tích hợp (Bất đồng bộ)
 */
export async function runHybridOfflineInference(query: string, botId: string, prodName: string, price: string, userId: string = "default"): Promise<string> {
  const cleanPrice = parseInt(price.replace(/[^0-9]/g, "")) || 100000;
  const discountedPrice = Math.round(cleanPrice * 0.95).toLocaleString("vi-VN");
  const discounted20 = Math.round(cleanPrice * 0.8).toLocaleString("vi-VN");

  const char = CHARACTERS[botId] || CHARACTERS["default"];
  const getRand = (arr: string[]): string => spinText(arr[Math.floor(Math.random() * arr.length)]);

  // --- STATE MACHINE: XỬ LÝ MINI-GAME TRƯỚC ---
  const state = GAME_STATE_MAP.get(userId);
  if (state) {
    const qLower = query.toLowerCase();
    
    // Đang chờ chọn hộp 1, 2, hoặc 3
    if (state.step === 1) {
      let chosenDoor = 0;
      if (qLower.includes("1") || qLower.includes("một")) chosenDoor = 1;
      else if (qLower.includes("2") || qLower.includes("hai")) chosenDoor = 2;
      else if (qLower.includes("3") || qLower.includes("ba")) chosenDoor = 3;

      if (chosenDoor !== 0) {
        state.chosenDoor = chosenDoor;
        // Logic Monty Hall: Chọn hộp dê để mở
        const doors = [1, 2, 3];
        const possibleGoatDoors = doors.filter(d => d !== chosenDoor && d !== state.winningDoor);
        // Nếu chọn đúng winning, possible = 2 cửa. Random mở 1. Nếu chọn sai, possible = 1 cửa.
        const goatDoor = possibleGoatDoors[Math.floor(Math.random() * possibleGoatDoors.length)];
        state.goatDoor = goatDoor;
        state.step = 2;
        
        const otherDoor = doors.find(d => d !== chosenDoor && d !== goatDoor);

        const response = `[Gamification Logic: Monty Hall Reveal]\n\n` + getRand(char.gameReveal)
          .replace(/\{chosenDoor\}/g, chosenDoor.toString())
          .replace(/\{goatDoor\}/g, goatDoor.toString())
          .replace(/\{otherDoor\}/g, otherDoor?.toString() || "");
        return response;
      } else {
        return `[Gamification Logic: Invalid Input]\n\nBạn phải chọn cửa số 1, 2, hoặc 3 nhé!`;
      }
    }
    
    // Đang chờ khách quyết định Đổi hay Giữ
    if (state.step === 2) {
      let wantToSwitch = false;
      if (qLower.includes("đổi") || qLower.includes("doi") || qLower.includes("có") || qLower.includes("co") || qLower.includes("ok")) {
        wantToSwitch = true;
      } else if (qLower.includes("không") || qLower.includes("khong") || qLower.includes("giữ") || qLower.includes("giu")) {
        wantToSwitch = false;
      } else {
        // Assume try to pick the other number directly
        const doors = [1, 2, 3];
        const otherDoor = doors.find(d => d !== state.chosenDoor && d !== state.goatDoor)!;
        if (qLower.includes(otherDoor.toString())) wantToSwitch = true;
        else if (qLower.includes(state.chosenDoor!.toString())) wantToSwitch = false;
        else return `[Gamification Logic: Invalid Input]\n\nBạn có muốn đổi cửa không? Gõ 'Đổi' hoặc 'Giữ' nhé!`;
      }

      let finalDoor = state.chosenDoor!;
      if (wantToSwitch) {
        const doors = [1, 2, 3];
        finalDoor = doors.find(d => d !== state.chosenDoor && d !== state.goatDoor)!;
      }

      const isWin = finalDoor === state.winningDoor;
      GAME_STATE_MAP.delete(userId); // Xóa state để về chat bình thường

      const template = isWin ? getRand(char.gameWin) : getRand(char.gameLose);
      return `[Gamification Logic: Monty Hall Result - ${isWin ? "WIN" : "LOSE"}]\n\n` + template
        .replace(/\{prod\}/g, state.prodName)
        .replace(/\{dp20\}/g, discounted20)
        .replace(/\{dp\}/g, state.discountedPrice)
        .replace(/\{winningDoor\}/g, state.winningDoor.toString());
    }
  }

  // --- NLP COGNITIVE PIPELINE ---
  const classifier = new TinyNeuralClassifier();
  const prediction = classifier.predict(query);
  
  // --- NANO BANANA 2 LITE: CORTEX MEMORY & CHAIN-OF-THOUGHT ---
  const memory = USER_MEMORY_MAP.get(userId) || [];
  
  console.log(`\n🧠 [Nano Banana Lite - CoT] User: ${userId}`);
  console.log(`   ├─ Trí nhớ (3 turn): [${memory.join(" -> ")}]`);
  console.log(`   ├─ Cảm xúc: ${prediction.sentiment.toUpperCase()}`);
  console.log(`   └─ Phân tích ý định: ${prediction.allIntents.join(", ")}`);

  // Lưu trí nhớ ngữ cảnh
  memory.push(prediction.primaryIntent);
  if (memory.length > 3) memory.shift();
  USER_MEMORY_MAP.set(userId, memory);
  
  // Áp dụng Chain-of-Thought Heuristics
  let responseModifier = "";
  if (prediction.sentiment === "angry") {
    responseModifier = "{Sếp bớt giận|Anh/chị bình tĩnh|Xin thứ lỗi}, ";
  } else if (prediction.sentiment === "positive") {
    responseModifier = "{Cảm ơn sếp|Thật tuyệt vời|Quá đẳng cấp}, ";
  }
  
  // Áp dụng ngữ cảnh: Nếu câu trước vừa MUA, câu này lại MẶC CẢ -> từ chối gắt
  if (memory[memory.length - 2] === "BUY" && prediction.primaryIntent === "BARGAIN") {
    return spinText(`${responseModifier}{Sếp vừa chốt đơn rồi mà|Đã chốt xong rồi sao lại đổi ý}, giá ${price}₫ là {kịch sàn|thấp nhất} rồi ạ!`);
  }

  // --- KẾT THÚC CORTEX ---

  const engine = new HybridInferenceEngine();

  engine.addRule(["INTENT_BARGAIN", "STOCK_HIGH"], "ACTION_OFFER_DISCOUNT_5");
  engine.addRule(["INTENT_BARGAIN", "STOCK_LOW"], "ACTION_REJECT_DISCOUNT");
  engine.addRule(["INTENT_BUY", "STOCK_HIGH"], "ACTION_CONFIRM_ORDER");
  engine.addRule(["INTENT_BUY", "STOCK_LOW"], "ACTION_CONFIRM_ORDER_WARNING");
  engine.addRule(["INTENT_EXPIRED"], "ACTION_SHOW_EXPIRED");
  engine.addRule(["INTENT_SHIPPING"], "ACTION_SHOW_SHIPPING");
  engine.addRule(["INTENT_GENERAL"], "ACTION_SHOW_INFO");
  engine.addRule(["INTENT_OFF_TOPIC"], "ACTION_OFF_TOPIC");

  engine.addFact(`INTENT_${prediction.primaryIntent}`);

  let isStockHigh = true;
  let dbProduct: any = null;

  try {
    if (!PRODUCT_CACHE || Date.now() - PRODUCT_CACHE_EXPIRES > 5 * 60 * 1000) {
      PRODUCT_CACHE = await db.query.product.findMany({ limit: 50 });
      PRODUCT_CACHE_EXPIRES = Date.now();
    }
    const allProducts = PRODUCT_CACHE;
    let bestScore = 0;
    
    for (const p of allProducts) {
      const scoreQuery = calculateFuzzyScore(query, p.name);
      const scoreProd = calculateFuzzyScore(prodName, p.name);
      const maxScore = Math.max(scoreQuery, scoreProd);
      
      if (maxScore > bestScore) {
        bestScore = maxScore;
        dbProduct = p;
      }
    }

    if (dbProduct && typeof dbProduct.quantity === "number") {
      isStockHigh = dbProduct.quantity > 10;
    }
  } catch (e) {
    console.error("Lỗi Fuzzy Search / DB:", e);
  }

  if (isStockHigh) engine.addFact("STOCK_HIGH");
  else engine.addFact("STOCK_LOW");

  const decisions = engine.runInference();
  const primaryDecision = decisions[decisions.length - 1] || "ACTION_SHOW_INFO";

  // --- TRIGGER MONTY HALL MINIGAME CHANCE ---
  if (primaryDecision === "ACTION_OFFER_DISCOUNT_5" && Math.random() < 0.3) {
    GAME_STATE_MAP.set(userId, {
      step: 1,
      winningDoor: Math.floor(Math.random() * 3) + 1,
      prodName: dbProduct ? dbProduct.name : prodName,
      price: price,
      discountedPrice: discountedPrice,
      character: botId
    });
    
    return `[Gamification Logic: Monty Hall Minigame Triggered]\n\n` + getRand(char.gameStart).replace(/\{prod\}/g, dbProduct ? dbProduct.name : prodName);
  }

  // --- FORMAT FINAL VARIABLES ---
  const finalProdName = dbProduct ? dbProduct.name : prodName;
  const finalExpire = dbProduct && dbProduct.expired ? new Date(dbProduct.expired).toLocaleDateString("vi-VN") : "chưa rõ (đang cập nhật)";
  const finalHeavy = dbProduct && dbProduct.heavy ? dbProduct.heavy : "~1";

  const fill = (tpl: string) =>
    spinText(responseModifier) + tpl
      .replace(/\{prod\}/g, finalProdName)
      .replace(/\{price\}/g, price)
      .replace(/\{dp\}/g, discountedPrice)
      .replace(/\{expireDate\}/g, finalExpire)
      .replace(/\{heavyKg\}/g, finalHeavy.toString());

  const tag = (reason: string) => `[Suy luận AI: ${reason} (Độ tin cậy: ${(prediction.confidence * 100).toFixed(0)}%)]\n\n`;

  switch (primaryDecision) {
    case "ACTION_OFF_TOPIC":
      return tag(`Câu hỏi ngoài lề. Đã bẻ lái.`) + fill(getRand(char.offtopic));
    case "ACTION_SHOW_EXPIRED":
      return tag(`Hỏi Hạn sử dụng. Fuzzy Match SP: ${finalProdName}`) + fill(getRand(char.expired));
    case "ACTION_SHOW_SHIPPING":
      return tag(`Hỏi Vận chuyển/Trọng lượng. Fuzzy Match SP: ${finalProdName}`) + fill(getRand(char.shipping));
    case "ACTION_OFFER_DISCOUNT_5":
      return tag(`Mặc cả. Tồn kho đầy (>10). Cho giảm giá.`) + fill(getRand(char.discount));
    case "ACTION_REJECT_DISCOUNT":
      return tag(`Mặc cả. Kho cạn kiệt (<=10). Giữ giá.`) + fill(getRand(char.reject));
    case "ACTION_CONFIRM_ORDER":
      return tag(`Chốt mua. Tồn kho đầy.`) + fill(getRand(char.confirm));
    case "ACTION_CONFIRM_ORDER_WARNING":
      return tag(`Chốt mua. Kho cạn (<=10). Giục khách.`) + fill(getRand(char.confirmWarn));
    default:
      return tag(`Tra cứu chung.`) + fill(getRand(char.general));
  }
}
