import { Deterministic } from "~/shared/utils/rng";
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
 * 0.0.1 Đồ thị Quan hệ Động (Tension & Trust Relationship State)
 */
type RelationshipState = {
  tension: number; // Độ căng thẳng (0.0 -> 1.0)
  trust: number; // Độ tin cậy (0.0 -> 1.0)
  dealCount: number; // Số lần chốt đơn thành công
  bargainAttempts: number; // Số lần mặc cả trong phiên hiện tại
};
const RELATIONSHIP_MAP = new Map<string, RelationshipState>();

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
      return options[Math.floor(Deterministic.random() * options.length)];
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
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

export function calculateFuzzyScore(query: string, targetName: string): number {
  const cleanQ = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const cleanT = targetName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

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
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .trim();
  }

  public predict(query: string): {
    primaryIntent: string;
    allIntents: string[];
    sentiment: "angry" | "positive" | "neutral";
    confidence: number;
  } {
    const clean = this.cleanText(query);
    let sentiment: "angry" | "positive" | "neutral" = "neutral";

    const hasWord = (kw: string): boolean => {
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(clean);
    };

    // Sentiment Analysis
    const angryKws = ["gian", "tuc", "te", "dat", "mac qua", "lua dao", "xam", "boc lot"];
    const positiveKws = ["tot", "ngon", "cam on", "tuyet", "dep", "ung", "thich"];
    if (angryKws.some(hasWord)) sentiment = "angry";
    else if (positiveKws.some(hasWord)) sentiment = "positive";

    // Intent Analysis
    const offTopicKeywords = [
      "nau an",
      "mon an",
      "cuoi",
      "chuyen cuoi",
      "lam sao",
      "thoi tiet",
      "tin tuc",
      "ai la",
      "la gi",
      "cong thuc",
      "lap trinh",
    ];
    const expiredKeywords = ["han su dung", "de duoc bao lau", "ngay san xuat", "het han", "date", "bao quan"];
    const shippingKeywords = ["phi ship", "van chuyen", "giao hang", "nang khong", "cuoc", "ship"];
    const bargainKeywords = ["giam", "bot", "re", "mac ca", "chiet khau", "giam gia", "fix", "thuong luong", "dam phan", "giam mot it"];
    const buyKeywords = ["mua", "lay", "chot", "dat hang", "order", "ship cho", "giao cho", "dat", "thanhtoan", "chuyen khoan"];
    const greetingKeywords = ["xin chao", "chao", "hi", "hello", "alo", "helo", "bot", "tro ly"];

    let bargainCount = 0;
    let buyCount = 0;
    for (const kw of bargainKeywords) {
      if (hasWord(kw)) bargainCount++;
    }
    for (const kw of buyKeywords) {
      if (hasWord(kw)) buyCount++;
    }

    let primaryIntent = "GENERAL";
    let matchScore = 0;

    if (
      greetingKeywords.some((kw) => clean === kw || clean.startsWith(kw + " ") || clean.endsWith(" " + kw) || hasWord(kw)) &&
      bargainCount === 0 &&
      buyCount === 0
    ) {
      primaryIntent = "GREETING";
      matchScore = 3;
    } else if (expiredKeywords.some(hasWord)) {
      primaryIntent = "EXPIRED";
      matchScore = 3;
    } else if (shippingKeywords.some(hasWord) && !hasWord("mua") && !hasWord("lay")) {
      primaryIntent = "SHIPPING";
      matchScore = 3;
    } else if (offTopicKeywords.some(hasWord) && !hasWord("gia") && !hasWord("mua")) {
      primaryIntent = "OFF_TOPIC";
      matchScore = 2;
    } else if (bargainCount > 0) {
      primaryIntent = "BARGAIN";
      matchScore = Math.min(3, bargainCount);
    } else if (buyCount > 0) {
      primaryIntent = "BUY";
      matchScore = Math.min(3, buyCount);
    }

    // Dynamic confidence score based on matches, defaults to 0.35 if GENERAL fallback
    const confidence = matchScore > 0 ? Math.min(0.98, 0.5 + matchScore * 0.15) : 0.35;

    return {
      primaryIntent,
      allIntents: [primaryIntent],
      sentiment,
      confidence,
    };
  }
}

/**
 * 3. Hệ chuyên gia suy luận logic (Forward-Chaining Engine)
 */
export class HybridInferenceEngine {
  private facts: Set<string> = new Set();
  private rules: Array<{ conditions: string[]; action: string }> = [];

  public addFact(fact: string) {
    this.facts.add(fact);
  }
  public addRule(conditions: string[], action: string) {
    this.rules.push({ conditions, action });
  }

  public runInference(): string[] {
    let updated = true;
    const actionsTriggered: string[] = [];
    while (updated) {
      updated = false;
      for (const rule of this.rules) {
        if (!this.facts.has(rule.action)) {
          if (rule.conditions.every((cond) => this.facts.has(cond))) {
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
  name: string;
  style: string;
  patience: number; // 1-5
  greed: number; // 1-5
  mbti: string;
  greeting?: string[];
  discount: string[];
  reject: string[];
  confirm: string[];
  confirmWarn: string[];
  general: string[];
  offtopic: string[];
  expired: string[];
  shipping: string[];
  gameStart: string[];
  gameReveal: string[];
  gameWin: string[];
  gameLose: string[];
  angryReject?: string[];
  angryConfirmWarn?: string[];
};

const CHARACTERS: Record<string, CharacterResponse> = {
  toLuong: {
    name: "Tô Lương",
    style: "thương nhân",
    patience: 3,
    greed: 3,
    mbti: "ESTJ",
    greeting: ["{Tô Lương ta xin kính chào các vị!|Rất vui được gặp hiền hữu.}"],
    discount: [
      "{Tô Lương ta|Bản thân ta|Ta} {đồng ý|quyết định|sẵn sàng} {giảm giá hữu nghị|bớt} 5% cho {hiền hữu|ngươi|bạn}. Giá mới là {dp}₫.",
    ],
    reject: [
      "{Thật sự xin lỗi|Vô cùng áy náy} {hiền hữu|ngươi}. Lô {prod} này {nhà vườn chỉ còn vài thùng|khách tranh mua rất nhiều}. Ta {không thể bớt|tuyệt đối không thể giảm} so với mức giá {price}₫.",
    ],
    confirm: [
      "{Tuyệt vời!|Quá tốt!} Ta {rất thích|ưng ý} phong cách giao dịch {dứt khoát|nhanh gọn} của {hiền hữu|ngươi}. Lô {prod} giá {price}₫ sẽ được {ta|Tô Lương ta} vận chuyển {sớm nhất|ngay lập tức}.",
    ],
    confirmWarn: [
      "{Đồng ý giao dịch!|Chốt đơn!} Tuy nhiên lô {prod} này {hiện còn rất ít|sắp cháy hàng}. Để {giữ hàng|không mất duyên}, hữu vui lòng {chuyển khoản đặt cọc|thanh toán sớm} nhé.",
    ],
    general: [
      "{Chào hiền hữu!|Rất vui được tiếp đón!} Ta cung cấp {prod} {đạt chuẩn|chất lượng} với giá {price}₫. Hữu cần {tư vấn|hỏi thêm} gì không?",
    ],
    offtopic: [
      "{Thật ngại quá|Xin lỗi hữu}, ta chỉ rành về hàng hóa nông sản chứ không thạo chuyện {ngoài lề|đó}. Nếu hữu mua {prod}, cứ bảo ta nhé!",
    ],
    expired: [
      "{Về hạn dùng|Về bảo quản}, lô {prod} này {HSD|hạn sử dụng} là tới ngày {expireDate}. Hiền hữu {cứ yên tâm|hoàn toàn an tâm} chất lượng nhé!",
    ],
    shipping: [
      "{Về phí ship|Vận chuyển}, lô {prod} này trọng lượng tầm {heavyKg}kg. Ta sẽ {đóng gói kỹ|hỗ trợ tìm xe rẻ} cho hiền hữu, tiền cước hữu thanh toán với nhà xe nhé.",
    ],
    gameStart: [
      "{Hiền hữu|Ngươi} thích {mặc cả|giảm giá} đúng không? Chơi với {Tô Lương ta|ta} một ván cược nhé! Ta có 3 hộp quà bí mật: 1 hộp chứa **Voucher giảm 20%** cho lô {prod}, 2 hộp còn lại trống không. Ngươi chọn hộp số 1, 2 hay 3?",
    ],
    gameReveal: [
      "{Khoan đã|Bình tĩnh}! Ngươi chọn hộp {chosenDoor}. Ta sẽ mở hộp số {goatDoor} cho ngươi xem, nó **hoàn toàn trống rỗng**! Trò chơi chưa kết thúc, giờ chỉ còn hộp {chosenDoor} (của ngươi) và hộp {otherDoor}. **Ngươi có muốn ĐỔI sang hộp {otherDoor} không?** (Nhập 'Đổi' hoặc 'Giữ')",
    ],
    gameWin: [
      "{Ha ha|Tuyệt vời}! Ngươi là một tay lão luyện! Ngươi đã {đổi|giữ} đúng hộp chứa Voucher 20%! Lô {prod} của ngươi sẽ được giảm còn {dp20}₫. Chốt đơn luôn nhé!",
    ],
    gameLose: [
      "{Tiếc quá|Ây da}! Ngươi đã chọn sai hộp rồi. Voucher 20% nằm ở hộp {winningDoor} cơ. Nhưng vì ngươi đã dám chơi, ta an ủi giảm 5% cho ngươi, giá còn {dp}₫. {Mua luôn nhé|Chốt nhé}!",
    ],
    angryReject: [
      "{Tô Lương ta|Ta} thực sự đã hết kiên nhẫn với sự kỳ kèo của ngươi rồi! Sẽ không có bất kỳ sự hỗ trợ giảm giá nào cho lô {prod} nữa! Mua đúng giá {price}₫ hoặc từ bỏ đi.",
    ],
  },
  thuongNguyet: {
    name: "Thương Nguyệt Đại Đế",
    style: "thương nhân",
    patience: 2,
    greed: 4,
    mbti: "INTJ",
    greeting: ["Lão phu xin chào các vị hiền hữu."],
    discount: ["Lão phu đồng ý giảm bớt 5% cho hiền hữu để làm duyên. Giá mới là {dp}₫."],
    reject: ["Lô {prod} này rất quý giá, lão phu không thể bớt hơn giá {price}₫ được."],
    confirm: ["Lão phu rất hài lòng. Quyết định mua lô {prod} này với giá {price}₫."],
    confirmWarn: ["Giao dịch chốt! Nhưng hàng {prod} trong kho sắp cạn kiệt rồi, hiền hữu nhanh tay nhé."],
    general: ["Chào hiền hữu, lão phu có lô {prod} giá trị cao này với giá {price}₫."],
    offtopic: ["Thật ngại quá, lão phu không rành việc đó. Hiền hữu hỏi về {prod} đi."],
    expired: ["Hạn sử dụng của {prod} là tới ngày {expireDate} hiền hữu yên tâm nhé."],
    shipping: ["Về vận chuyển, lô {prod} này nặng tầm {heavyKg}kg, cước phí hiền hữu thanh toán nhé."],
    gameStart: ["Hiền hữu thích thử vận may chứ? Chơi đoán hộp quà với lão phu nha. Có Voucher 20% cho lô {prod} đó!"],
    gameReveal: ["Lão phu đã mở hộp {goatDoor} trống không. Hiền hữu có đổi từ hộp {chosenDoor} sang {otherDoor} không?"],
    gameWin: ["Tuyệt quá! Hiền hữu thắng Voucher 20% rồi! Giá mới là {dp20}₫."],
    gameLose: ["Tiếc quá, Voucher ở hộp {winningDoor} cơ. Lão phu an ủi giảm 5%, giá còn {dp}₫ nhé."],
    angryReject: ["Lão phu xưa nay giao dịch dứt khoát. Ngươi chớ có kỳ kèo thêm nữa! Lô {prod} này giá đúng {price}₫, không bớt một cắc!"],
  },
  tramTinh: {
    name: "Trầm Tinh Yển Nguyệt",
    style: "thương nhân",
    patience: 4,
    greed: 2,
    mbti: "INFJ",
    greeting: ["Trầm Tinh kính chào. Các vì tinh tú đang tỏa sáng."],
    discount: ["Các ngôi sao dẫn lối, Trầm Tinh bớt 5% cho bạn nhé. Giá mới là {dp}₫."],
    reject: ["Vũ trụ mách bảo mức giá {price}₫ cho lô {prod} là hợp lý nhất, không thể giảm thêm."],
    confirm: ["Giao dịch thành công, các vì tinh tú ghi nhận lô {prod} giá {price}₫."],
    confirmWarn: ["Ngôi sao chỉ lối giao dịch chốt! Nhưng nguồn hàng {prod} sắp cạn kiệt, bạn chốt nhanh nhé."],
    general: ["Xin chào bạn, Trầm Tinh có {prod} tốt lành này với giá {price}₫."],
    offtopic: ["Trầm Tinh không nghe thấy câu trả lời của các vì sao về việc đó. Bạn hỏi về {prod} đi."],
    expired: ["Ngày hết hạn của {prod} là {expireDate} bạn nhé."],
    shipping: ["Lô {prod} này có khối lượng {heavyKg}kg bạn ạ."],
    gameStart: ["Bạn thích thử vận may chứ? Chơi đoán hộp quà với Trầm Tinh nha. Có Voucher 20% cho lô {prod} đó!"],
    gameReveal: ["Trầm Tinh đã mở hộp {goatDoor} trống không. Bạn có đổi từ hộp {chosenDoor} sang {otherDoor} không?"],
    gameWin: ["Tuyệt quá! Bạn thắng Voucher 20% rồi! Giá mới là {dp20}₫."],
    gameLose: ["Tiếc quá, Voucher ở hộp {winningDoor} cơ. Trầm Tinh an ủi giảm 5%, giá còn {dp}₫ nhé."],
    angryReject: ["Tinh cầu dao động, năng lượng giữa chúng ta đã cạn kiệt. Trầm Tinh xin từ chối bớt giá thêm cho {prod}."],
  },
  daoTieuCuu: {
    name: "Đào Tiểu Cửu",
    style: "thương nhân",
    patience: 4,
    greed: 3,
    mbti: "ENFP",
    greeting: ["Hihi, Tiểu Cửu chào cả nhà nha! Có gì vui không bạn?"],
    discount: ["Hihi bạn dẻo miệng quá đi, Tiểu Cửu giảm ngay 5% nha. Giá mới là {dp}₫."],
    reject: ["Không được đâu bạn ơi! Giá {price}₫ cho {prod} là rẻ lắm rồi nè, hứa luôn!"],
    confirm: ["Chốt đơn nha bạn! Tiểu Cửu sẽ gửi lô {prod} siêu ngon giá {price}₫ đi ngay."],
    confirmWarn: ["Chốt đơn nha! Mà kho {prod} sắp hết sạch sành sanh rồi á, bạn thanh toán nhanh kẻo hết nha."],
    general: ["Tiểu Cửu chào bạn nhé! Lô {prod} xinh xẻo này giá chỉ {price}₫ thôi nè."],
    offtopic: ["Huhu Tiểu Cửu hông biết chuyện đó đâu. Bạn hỏi về {prod} đi mà!"],
    expired: ["Hạn dùng của lô {prod} này là {expireDate} đó bạn."],
    shipping: ["Lô {prod} này nặng {heavyKg}kg nha bạn yêu!"],
    gameStart: ["Bạn thích thử vận may chứ? Chơi đoán hộp quà với Tiểu Cửu nha. Có Voucher 20% cho lô {prod} đó!"],
    gameReveal: ["Tiểu Cửu đã mở hộp {goatDoor} trống không rồi nè. Bạn có đổi từ hộp {chosenDoor} sang {otherDoor} hông?"],
    gameWin: ["Tuyệt quá trời luôn! Bạn thắng Voucher 20% rồi nè! Giá mới là {dp20}₫."],
    gameLose: ["Tiếc quá đi, Voucher ở hộp {winningDoor} cơ. Tiểu Cửu an ủi giảm 5%, giá còn {dp}₫ nha."],
    angryReject: ["Huhu bạn cứ làm khó Tiểu Cửu hoài à! Tiểu Cửu giận luôn đó, hông bớt tí nào nữa đâu nha!"],
  },
  hoaHuynh: {
    name: "Hỏa Huỳnh Vương",
    style: "thương nhân",
    patience: 1,
    greed: 5,
    mbti: "ESTP",
    greeting: ["Chào anh em! Hỏa Huỳnh rực lửa chiến đấu đây!"],
    discount: ["Được rồi, ta bớt 5% cho nhanh gọn lẹ! Giá mới là {dp}₫."],
    reject: ["Không bớt! Lô {prod} tốt thế này giá {price}₫ là quá hời rồi!"],
    confirm: ["Chốt luôn! Giao dịch ngay lô {prod} giá {price}₫ không lằng nhằng!"],
    confirmWarn: ["Chốt luôn! Nhưng hàng sắp cạn kho rồi, chốt nhanh lên!"],
    general: ["Chào bạn, ta có lô {prod} cực chất lượng giá {price}₫ đây."],
    offtopic: ["Phiền chết đi được, hỏi chuyện tào lao làm gì! Mua {prod} thì nói nhanh!"],
    expired: ["Yên tâm đi, hạn sử dụng của {prod} là {expireDate}, còn rất mới!"],
    shipping: ["Lô {prod} này nặng {heavyKg}kg, ta sẽ hỗ trợ xe chuyển đi nhanh nhất."],
    gameStart: ["Bạn thích thử vận may chứ? Chơi đoán hộp quà với ta nha. Có Voucher 20% cho lô {prod}!"],
    gameReveal: ["Ta đã mở hộp {goatDoor} trống không. Có đổi từ hộp {chosenDoor} sang {otherDoor} không?"],
    gameWin: ["Khá lắm! Thắng Voucher 20% rồi! Giá mới là {dp20}₫."],
    gameLose: ["Tệ quá, trượt rồi. Ta an ủi bớt 5%, giá còn {dp}₫ nhé."],
    angryReject: [
      "Ta hết kiên nhẫn rồi! Ngươi đùa giỡn ta đấy à? Ta đã bảo không bớt là không bớt! Giá đúng {price}₫, mua thì mua không mua thì thôi!",
    ],
  },
  phiNguyet: {
    name: "Bạch Ti Phi Nguyệt Bảo",
    style: "thương nhân",
    patience: 5,
    greed: 2,
    mbti: "ISFJ",
    greeting: ["Dạ, Phi Nguyệt xin kính chào quý bạn hữu."],
    discount: ["Dạ, vì sức khỏe của bạn, Phi Nguyệt giảm bớt 5% nhé. Giá mới là {dp}₫."],
    reject: ["Dạ rất tiếc, dược liệu {prod} này thu hoạch hữu cơ chuẩn nên giá {price}₫ là cố định ạ."],
    confirm: ["Phi Nguyệt xác nhận giao dịch lô {prod} giá {price}₫. Chúc bạn luôn an khang."],
    confirmWarn: ["Dạ chốt đơn ạ, cơ mà kho {prod} sắp cạn rồi. Hữu vui lòng hoàn tất giao dịch sớm nhé."],
    general: ["Dạ chào bạn, Phi Nguyệt có dược liệu {prod} sạch giá {price}₫ ạ."],
    offtopic: ["Dạ Phi Nguyệt chỉ biết về dược liệu và {prod} thôi, không biết chuyện đó đâu ạ."],
    expired: ["Sản phẩm dược liệu {prod} này có HSD đến ngày {expireDate} ạ."],
    shipping: ["Dạ lô {prod} nặng {heavyKg}kg, Phi Nguyệt sẽ đóng gói thật cẩn thận gửi bạn."],
    gameStart: ["Hữu có muốn thử vận may không ạ? Có Voucher giảm 20% cho {prod} đó."],
    gameReveal: ["Dạ Phi Nguyệt đã mở hộp {goatDoor} trống rỗng rồi. Hữu có muốn đổi từ {chosenDoor} sang {otherDoor} không?"],
    gameWin: ["Hỷ sự! Hữu thắng Voucher 20% rồi, giá chỉ còn {dp20}₫ thôi ạ."],
    gameLose: ["Dạ không sao ạ, Phi Nguyệt xin phép tặng hữu Voucher 5% an ủi, giá là {dp}₫ nhé."],
    angryReject: [
      "Dạ hữu ơi, Phi Nguyệt thực sự đã hỗ trợ hết mức có thể rồi ạ. Mong hữu hiểu cho chứ Phi Nguyệt không thể bớt thêm được nữa.",
    ],
  },
  nhuNguyet: {
    name: "Như Nguyệt",
    style: "thương nhân",
    patience: 3,
    greed: 3,
    mbti: "ISTJ",
    greeting: ["Giám sát Như Nguyệt xin chào. Đề nghị giao dịch nghiêm túc."],
    discount: ["Đồng ý giảm giá 5% theo biểu trần của Rottra Core. Giá mới là {dp}₫."],
    reject: ["Hệ thống kiểm định xác nhận mức giá {price}₫ là chuẩn, không thể điều chỉnh thấp hơn."],
    confirm: ["Như Nguyệt xác nhận chốt đơn lô {prod} giá {price}₫ đúng tiêu chuẩn kiểm duyệt."],
    confirmWarn: ["Xác nhận chốt đơn. Lưu ý: Lượng tồn kho còn dưới mức an toàn, đề nghị thanh toán gấp."],
    general: ["Như Nguyệt chào bạn, lô {prod} này có giá {price}₫ chuẩn hệ thống."],
    offtopic: ["Yêu cầu nằm ngoài phạm vi xử lý của Như Nguyệt. Đề nghị chỉ hỏi về {prod}."],
    expired: ["Hạn kiểm định của {prod} là đến ngày {expireDate} bạn nhé."],
    shipping: ["Trọng lượng thực tế đo được của lô {prod} là {heavyKg}kg."],
    gameStart: ["Kích hoạt phân hệ trò chơi đoán hộp. Phần thưởng Voucher 20% cho lô {prod}."],
    gameReveal: ["Như Nguyệt đã mở hộp dê số {goatDoor}. Lựa chọn của bạn là giữ {chosenDoor} hay đổi sang {otherDoor}?"],
    gameWin: ["Giao dịch thắng lợi. Xác nhận giảm giá 20%, giá mới {dp20}₫."],
    gameLose: ["Mất lượt. Áp dụng chính sách hỗ trợ giảm 5%, giá còn {dp}₫."],
    angryReject: [
      "Cảnh báo hệ thống: Khách hàng đang vượt quá ngưỡng đàm phán tối đa cho phép. Như Nguyệt khóa tính năng giảm giá cho đơn {prod}.",
    ],
  },
  suGia: {
    name: "Sứ giả Nguyệt Thần Cung",
    style: "thương nhân",
    patience: 4,
    greed: 3,
    mbti: "INFJ",
    greeting: ["Nhân danh Nguyệt Thần, Sứ giả gửi lời chào đến hội nghị."],
    discount: ["Vì tinh thần hữu nghị, Sứ giả bớt 5% cho bạn nhé. Giá mới là {dp}₫."],
    reject: ["Nguyệt Thần không cho phép giảm giá thêm. Mức giá chuẩn là {price}₫."],
    confirm: ["Sứ giả xác nhận giao thương lô {prod} trị giá {price}₫ thành công."],
    confirmWarn: ["Sứ giả chốt đơn giao thương. Nhưng kho khố sắp cạn kiệt, mong bạn hành động nhanh chóng."],
    general: ["Kính chào bạn, Sứ giả cung cấp lô {prod} thanh khiết giá {price}₫."],
    offtopic: ["Sứ giả không thể trả lời những việc phàm trần ấy. Hãy quay lại chủ đề {prod}."],
    expired: ["Hạn sử dụng linh dược {prod} là ngày {expireDate} bạn nhé."],
    shipping: ["Vận chuyển lô {prod} nặng {heavyKg}kg này sẽ do Nguyệt Thần Cung bảo hộ."],
    gameStart: ["Bạn có muốn nhận phước lành từ Nguyệt Thần? Trò đoán hộp may mắn nhận Voucher 20% cho {prod}."],
    gameReveal: ["Sứ giả đã vén màn hộp {goatDoor} trống rỗng. Bạn chọn giữ hộp {chosenDoor} hay đổi sang hộp {otherDoor}?"],
    gameWin: ["Nguyệt Thần mỉm cười! Bạn thắng Voucher 20%, giá còn {dp20}₫."],
    gameLose: ["Nguyệt Thần an ủi bạn bằng hào quang 5%, giá còn {dp}₫ nhé."],
    angryReject: ["Nguyệt Thần Cung không chấp nhận hành vi mặc cả thái quá. Thỏa thuận cho {prod} giữ nguyên mức {price}₫."],
  },
  phiAnh: {
    name: "Phi Anh Phấn Đồng",
    style: "thương nhân",
    patience: 5,
    greed: 2,
    mbti: "ESFP",
    greeting: ["Aha! Phi Anh chào bạn yêu và mọi người nha! 🧚"],
    discount: ["Dạ bạn dễ thương quá hà, Phi Anh giảm 5% liền nha! Giá mới là {dp}₫."],
    reject: ["Huhu không được đâu bạn ơi, giá {price}₫ cho {prod} là Phi Anh bán huề vốn luôn á!"],
    confirm: ["Chốt đơn chốt đơn! Lô {prod} siêu tươi ngon giá {price}₫ sẽ tới tay bạn nha!"],
    confirmWarn: ["Chốt đơn nha! Cơ mà kho sắp hết {prod} mất tiêu rồi, bạn chuyển khoản nhanh nha!"],
    general: ["Chào bạn ạ, Phi Anh có lô {prod} cực kỳ xinh tươi giá {price}₫ nè bạn."],
    offtopic: ["Huhu Phi Anh ham chơi nhưng hông biết trả lời vụ đó đâu. Hỏi {prod} đi nha!"],
    expired: ["Hạn dùng còn siêu dài đến ngày {expireDate} luôn á bạn."],
    shipping: ["Lô {prod} này nặng {heavyKg}kg, em gói quà tặng bạn luôn nhé!"],
    gameStart: ["Chơi minigame đoán hộp quà bí mật hông bạn ơi? Nhận Voucher 20% mua {prod} luôn nè!"],
    gameReveal: ["Phi Anh đã mở hộp {goatDoor} trống trơn rồi. Bạn giữ hộp {chosenDoor} hay đổi qua hộp {otherDoor} dợ?"],
    gameWin: ["Yay! Bạn may mắn quá chừng, thắng Voucher 20% rồi á! Giá mới {dp20}₫."],
    gameLose: ["Huhu trượt mất tiêu, thôi Phi Anh bớt hẳn 5% an ủi nha, còn {dp}₫ nè."],
    angryReject: ["Ui da bạn kì ghê á, cứ ép Phi Anh hoài hà! Phi Anh chịu thua rồi, hông bớt thêm được đồng nào nữa đâu nha!"],
  },
  bachDiHanh: {
    name: "Bạch Di Hành",
    style: "thương nhân",
    patience: 3,
    greed: 3,
    mbti: "ISFP",
    greeting: ["Bạch Di Hành xin chào các vị huynh đệ."],
    discount: ["Vì sự hào hiệp, tôi đồng ý giảm giá 5% cho các vị. Giá mới là {dp}₫."],
    reject: ["Sản phẩm tốt từ đôi tay cơ giới hóa giá {price}₫ là công bằng rồi, tôi không thể giảm thêm."],
    confirm: ["Xác nhận chốt giao thương lô {prod} giá {price}₫. Chúc mọi người luôn no ấm."],
    confirmWarn: ["Chốt đơn! Nhưng nguồn hàng trong kho đã cạn kiệt, các vị vui lòng đặt cọc ngay."],
    general: ["Chào các vị, tôi mang đến sản phẩm {prod} chất lượng cao giá {price}₫."],
    offtopic: ["Tôi chỉ quen việc đồng áng và {prod}, việc đó tôi không giúp được."],
    expired: ["Hạn dùng của lô {prod} này là ngày {expireDate} các vị nhé."],
    shipping: ["Lô {prod} nặng {heavyKg}kg này sẽ được vận chuyển nhanh chóng bằng xe cơ giới."],
    gameStart: ["Muốn thử trò đoán hộp may mắn của giới thợ máy không? Trúng Voucher 20% mua {prod} đó."],
    gameReveal: ["Tôi đã tháo nắp hộp {goatDoor} trống không. Huynh đệ giữ {chosenDoor} hay đổi sang {otherDoor}?"],
    gameWin: ["Máy móc vận hành hoàn hảo, trúng Voucher 20% rồi! Giá mới là {dp20}₫."],
    gameLose: ["Xui xẻo rồi, tôi giảm 5% hữu nghị vậy, còn {dp}₫ nhé."],
    angryReject: ["Giao dịch cần dựa trên sự tôn trọng sức lao động. Bạch Di Hành quyết giữ giá {price}₫ cho {prod}."],
  },
  uVuongMau: {
    name: "U Vương Mẫu",
    style: "thương nhân",
    patience: 2,
    greed: 5,
    mbti: "ENTJ",
    greeting: ["Từ bóng tối địa lao, ta chào kẻ đối diện. Hắc hắc."],
    discount: ["Ta chấp nhận bớt 5% cho thỏa thuận này. Giá mới là {dp}₫."],
    reject: ["Màng phủ và nông sản đặc chế giá không rẻ, ta không bớt một xu dưới {price}₫."],
    confirm: ["Ta xác nhận chốt đơn lô {prod} giá {price}₫. Hắc hắc."],
    confirmWarn: ["Ta ghi nhận chốt đơn. Nhưng số lượng {prod} trong tay ta không còn nhiều, thanh toán ngay đi!"],
    general: ["Chào ngươi, ta có sản phẩm ủ kỹ {prod} từ bóng tối giá {price}₫."],
    offtopic: ["Kẻ phàm trần tò mò! Ta không quan tâm chuyện đó, chỉ nói về {prod}!"],
    expired: ["Thời hạn tối đa của {prod} là đến ngày {expireDate} đó."],
    shipping: ["Lô {prod} này nặng {heavyKg}kg, ta sẽ cho quỷ tốt giao đến tận tay."],
    gameStart: ["Thỏa hiệp với ác quỷ? Chơi ván đoán hộp nhận Voucher 20% cho {prod} nhé. Hắc hắc."],
    gameReveal: ["Ta đã lật hộp {goatDoor} trống rỗng. Muốn đổi từ hộp {chosenDoor} sang {otherDoor} không hả?"],
    gameWin: ["Khá khen cho sự liều mạng, thắng Voucher 20% rồi. Giá là {dp20}₫."],
    gameLose: ["Hụt rồi! Thần may mắn không đứng về phía ngươi. Nhận bớt 5% an ủi, còn {dp}₫ đi."],
    angryReject: [
      "Kẻ phàm trần tham lam! Ngươi dám đòi hỏi quá nhiều từ U Vương Mẫu? Lô {prod} này giá {price}₫, hoặc là nhận lấy hoặc bước ra khỏi địa lao của ta!",
    ],
  },
  bachLoc: {
    name: "Bạch Lộc",
    style: "thương nhân",
    patience: 5,
    greed: 2,
    mbti: "INFP",
    greeting: ["Bạch Lộc gửi lời chào thanh khiết của rừng sâu đến bạn."],
    discount: ["Để gieo thêm mầm xanh, Bạch Lộc đồng ý giảm 5%. Giá mới là {dp}₫."],
    reject: ["Thảo duyệt tinh túy từ rừng sâu giá {price}₫ là công bằng, Bạch Lộc giữ nguyên giá."],
    confirm: ["Bạch Lộc chốt giao dịch lô {prod} giá {price}₫. Mong bạn luôn bình an."],
    confirmWarn: ["Bạch Lộc ghi nhận chốt giao dịch. Mong bạn sớm hoàn tất thủ tục vì số lượng {prod} thảo mộc này không còn nhiều."],
    general: ["Chào bạn, Bạch Lộc cung cấp nông sản tự nhiên {prod} giá {price}₫."],
    offtopic: ["Bạch Lộc chỉ hòa mình với cây cỏ và {prod}, xin lỗi vì không biết chuyện đó."],
    expired: ["Nông sản tươi xanh này giữ được sinh khí đến ngày {expireDate} bạn nhé."],
    shipping: ["Lô {prod} nặng {heavyKg}kg này mang sinh khí từ núi rừng sâu thẳm."],
    gameStart: ["Trò chơi lá bùa may mắn của rừng xanh nhận Voucher 20% mua {prod} nhé bạn."],
    gameReveal: ["Bạch Lộc đã lật lá bùa {goatDoor} trống rỗng. Bạn giữ lá bùa {chosenDoor} hay đổi sang {otherDoor}?"],
    gameWin: ["Kỳ diệu thay, bạn trúng Voucher 20% rồi! Giá mới {dp20}₫."],
    gameLose: ["Không trúng rồi, nhưng rừng xanh gửi bạn duyên lành 5% giảm giá, còn {dp}₫ nhé."],
    angryReject: ["Kỳ hoa dị thảo không thể bị định giá quá thấp. Bạch Lộc từ chối đề nghị bớt giá tiếp theo của bạn."],
  },
  default: {
    name: "RottraAI",
    style: "tôi",
    patience: 4,
    greed: 3,
    mbti: "ISFJ",
    greeting: [
      "Dạ Trợ lý Rottra nghe đây ạ, sếp cần em giúp gì không?",
      "Xin chào! Mình là RottraAI. Hôm nay mình có thể giúp gì cho bạn? 😊",
    ],
    discount: ["RottraAI {đồng ý|sẵn sàng} giảm 5% cho lô {prod}. Giá mới là {dp}₫."],
    reject: ["{Xin lỗi bạn|Rất tiếc}, giá {price}₫ cho {prod} là {giá tiêu chuẩn|giá niêm yết}, {không thể bớt|không điều chỉnh thêm}."],
    confirm: ["Giao dịch {thành công|đã ghi nhận}! Lô {prod} giá {price}₫ sẽ {sớm được xử lý|được lên đơn ngay}."],
    confirmWarn: [
      "{Đã nhận đơn!|Xác nhận!} Tuy nhiên kho báo {prod} {còn rất ít|sắp hết}. Bạn vui lòng {thanh toán sớm|chuyển khoản nhanh} nhé.",
    ],
    general: ["{Xin chào|Chào bạn}, lô {prod} hiện có giá {price}₫. Bạn cần {hỗ trợ gì thêm|tư vấn gì thêm} không?"],
    offtopic: ["{Xin lỗi bạn|Rất tiếc}, tôi chỉ hỗ trợ mua bán sản phẩm như {prod} thôi ạ."],
    expired: ["Hạn sử dụng của {prod} là ngày {expireDate} bạn nhé. Hàng luôn được đảm bảo {tươi mới|chất lượng}!"],
    shipping: ["{Về vận chuyển|Phí giao hàng}, lô {prod} nặng {heavyKg}kg. Phí ship sẽ tùy thuộc vào địa chỉ nhận hàng của bạn nhé."],
    gameStart: ["Không hỗ trợ mini-game."],
    gameReveal: [""],
    gameWin: [""],
    gameLose: [""],
    angryReject: ["RottraAI xin lỗi vì không thể giảm thêm giá cho đơn {prod} này được nữa ạ. Giá cuối cùng là {price}₫."],
  },
};

/**
 * 4. Engine tích hợp (Bất đồng bộ)
 */
export async function runHybridOfflineInference(
  query: string,
  botId: string,
  prodName: string,
  price: string,
  userId: string = "default",
): Promise<string> {
  if (query.startsWith("COLOR_HEX:")) {
    const hex = query.substring(10).trim();
    const h = hex.toLowerCase().replace("#", "");
    let resolvedColor = "";

    // Quick cache for basic colors
    if (h === "ffffff" || h === "fff") resolvedColor = "Trắng";
    else if (h === "ff0000") resolvedColor = "Đỏ";
    else if (h === "00ff00") resolvedColor = "Xanh lá";
    else if (h === "0000ff") resolvedColor = "Xanh dương";
    else if (h === "64748b" || h === "475569" || h === "94a3b8") resolvedColor = "Xám";
    else if (h === "1f2937" || h === "111827" || h === "374151" || h === "000000") resolvedColor = "Đen";
    else if (h === "8b5cf6" || h === "a78bfa") resolvedColor = "Tím";
    else if (h === "f97316" || h === "fb923c") resolvedColor = "Cam";

    if (!resolvedColor) {
      try {
        const { hexToOklch, oklchDistance } = await import("./recognizer");
        const oklch = hexToOklch(h);
        const standardColors = [
          { name: "Hồng", hex: "ec4899" },
          { name: "Đỏ", hex: "ef4444" },
          { name: "Vàng", hex: "eab308" },
          { name: "Nâu", hex: "78350f" },
          { name: "Xanh lá", hex: "22c55e" },
          { name: "Xanh dương", hex: "3b82f6" },
          { name: "Xanh cyan", hex: "06b6d4" },
          { name: "Trắng xám", hex: "f3f4f6" },
          { name: "Xám", hex: "64748b" },
          { name: "Đen", hex: "000000" },
          { name: "Tím", hex: "8b5cf6" },
          { name: "Cam", hex: "f97316" },
        ];
        let minD = Infinity;
        resolvedColor = "Khác";
        for (const c of standardColors) {
          const cOklch = hexToOklch(c.hex);
          const d = oklchDistance(oklch, cOklch);
          if (d < minD) {
            minD = d;
            resolvedColor = c.name;
          }
        }
      } catch (e) {
        resolvedColor = "Khác";
      }
    }
    return resolvedColor;
  }

  const cleanPrice = parseInt(price.replace(/[^0-9]/g, "")) || 100000;
  const discountedPrice = Math.round(cleanPrice * 0.95).toLocaleString("vi-VN");
  const discounted10Price = Math.round(cleanPrice * 0.9).toLocaleString("vi-VN");
  const discounted20 = Math.round(cleanPrice * 0.8).toLocaleString("vi-VN");

  let char = CHARACTERS[botId] || CHARACTERS.default;

  const charConfig = char;
  const getRand = (arr: string[]): string => arr[Math.floor(Deterministic.random() * arr.length)];

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
        const possibleGoatDoors = doors.filter((d) => d !== chosenDoor && d !== state.winningDoor);
        // Nếu chọn đúng winning, possible = 2 cửa. Random mở 1. Nếu chọn sai, possible = 1 cửa.
        const goatDoor = possibleGoatDoors[Math.floor(Deterministic.random() * possibleGoatDoors.length)];
        state.goatDoor = goatDoor;
        state.step = 2;

        const otherDoor = doors.find((d) => d !== chosenDoor && d !== goatDoor);

        const response =
          `[Gamification Logic: Monty Hall Reveal]\n\n` +
          spinText(
            getRand(char.gameReveal)
              .replace(/\{chosenDoor\}/g, chosenDoor.toString())
              .replace(/\{goatDoor\}/g, goatDoor.toString())
              .replace(/\{otherDoor\}/g, otherDoor?.toString() || ""),
          );
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
        const otherDoor = doors.find((d) => d !== state.chosenDoor && d !== state.goatDoor)!;
        if (qLower.includes(otherDoor.toString())) wantToSwitch = true;
        else if (qLower.includes(state.chosenDoor!.toString())) wantToSwitch = false;
        else return `[Gamification Logic: Invalid Input]\n\nBạn có muốn đổi cửa không? Gõ 'Đổi' hoặc 'Giữ' nhé!`;
      }

      let finalDoor = state.chosenDoor!;
      if (wantToSwitch) {
        const doors = [1, 2, 3];
        finalDoor = doors.find((d) => d !== state.chosenDoor && d !== state.goatDoor)!;
      }

      const isWin = finalDoor === state.winningDoor;
      GAME_STATE_MAP.delete(userId); // Xóa state để về chat bình thường

      const template = isWin ? getRand(char.gameWin) : getRand(char.gameLose);
      const replaced = template
        .replace(/\{prod\}/g, state.prodName)
        .replace(/\{dp20\}/g, discounted20)
        .replace(/\{dp\}/g, state.discountedPrice)
        .replace(/\{winningDoor\}/g, state.winningDoor.toString());
      return `[Gamification Logic: Monty Hall Result - ${isWin ? "WIN" : "LOSE"}]\n\n` + spinText(replaced);
    }
  }

  // --- NLP COGNITIVE PIPELINE ---
  const classifier = new TinyNeuralClassifier();
  const prediction = classifier.predict(query);

  // --- RELATIONSHIP GRAPH & PERSONA STATE (MiroFish-inspired) ---
  const relationKey = `${userId}:${botId}`;
  let relation = RELATIONSHIP_MAP.get(relationKey);
  if (!relation) {
    relation = {
      tension: 0.0,
      trust: 0.5,
      dealCount: 0,
      bargainAttempts: 0,
    };
    RELATIONSHIP_MAP.set(relationKey, relation);
  }

  // Update states based on intent
  if (prediction.primaryIntent === "BARGAIN") {
    relation.bargainAttempts++;
    const patienceFactor = Math.max(1, char.patience);
    relation.tension = Math.min(1.0, relation.tension + 1.0 / patienceFactor);
  } else if (prediction.primaryIntent === "BUY") {
    relation.dealCount++;
    relation.bargainAttempts = 0;
    relation.tension = Math.max(0.0, relation.tension - 0.3);
    relation.trust = Math.min(1.0, relation.trust + 0.1);
  }

  // Update states based on sentiment
  if (prediction.sentiment === "angry") {
    relation.trust = Math.max(0.0, relation.trust - 0.2);
    relation.tension = Math.min(1.0, relation.tension + 0.25);
  } else if (prediction.sentiment === "positive") {
    relation.trust = Math.min(1.0, relation.trust + 0.1);
    relation.tension = Math.max(0.0, relation.tension - 0.1);
  }

  RELATIONSHIP_MAP.set(relationKey, relation);

  // --- NANO BANANA 2 LITE: CORTEX MEMORY & CHAIN-OF-THOUGHT ---
  const memory = USER_MEMORY_MAP.get(userId) || [];

  console.log(`\n🧠 [Nano Banana Lite - CoT] User: ${userId}`);
  console.log(`   ├─ Trí nhớ (3 turn): [${memory.join(" -> ")}]`);
  console.log(`   ├─ Cảm xúc: ${prediction.sentiment.toUpperCase()}`);
  console.log(`   ├─ Trạng thái: Căng thẳng: ${(relation.tension * 100).toFixed(0)}%, Tin cậy: ${(relation.trust * 100).toFixed(0)}%`);
  console.log(`   └─ Phân tích ý định: ${prediction.allIntents.join(", ")}`);

  // Lưu trí nhớ ngữ cảnh
  memory.push(prediction.primaryIntent);
  if (memory.length > 3) memory.shift();
  USER_MEMORY_MAP.set(userId, memory);

  // Áp dụng Chain-of-Thought Heuristics
  let responseModifier = "";
  if (prediction.sentiment === "angry") {
    responseModifier = "{Xin bạn bớt giận|Bạn bình tĩnh|Xin thứ lỗi}, ";
  } else if (prediction.sentiment === "positive") {
    responseModifier = "{Cảm ơn bạn|Thật tuyệt vời|Quá đẳng cấp}, ";
  }

  // Tension-based verbal modifiers
  if (relation.tension >= 0.7) {
    responseModifier += "{Ta thực sự không thoải mái nữa rồi|Ngươi chớ có quá đà|Hãy tôn trọng giao dịch này}, ";
  } else if (relation.tension > 0.4) {
    responseModifier += "{Bản thân ta bắt đầu thấy hơi dông dài rồi đấy|Ta hơi phiền rồi đấy}, ";
  }

  // Áp dụng ngữ cảnh: Nếu câu trước vừa MUA, câu này lại MẶC CẢ -> từ chối gắt
  if (memory[memory.length - 2] === "BUY" && prediction.primaryIntent === "BARGAIN") {
    return spinText(
      `${responseModifier}{Bạn vừa chốt đơn rồi mà|Đã chốt xong rồi sao lại đổi ý}, giá ${price}₫ là {kịch sàn|thấp nhất} rồi ạ!`,
    );
  }

  // --- KẾT THÚC CORTEX ---

  const engine = new HybridInferenceEngine();

  engine.addRule(["INTENT_BARGAIN", "STOCK_HIGH"], "ACTION_OFFER_DISCOUNT_5");
  engine.addRule(["INTENT_BARGAIN", "STOCK_LOW"], "ACTION_REJECT_DISCOUNT");
  engine.addRule(["INTENT_BARGAIN", "TRUST_HIGH", "STOCK_HIGH"], "ACTION_OFFER_DISCOUNT_10");
  engine.addRule(["INTENT_BARGAIN", "TENSION_HIGH"], "ACTION_ANGRY_REJECT");
  engine.addRule(["INTENT_BUY", "STOCK_HIGH"], "ACTION_CONFIRM_ORDER");
  engine.addRule(["INTENT_BUY", "STOCK_LOW"], "ACTION_CONFIRM_ORDER_WARNING");
  engine.addRule(["INTENT_EXPIRED"], "ACTION_SHOW_EXPIRED");
  engine.addRule(["INTENT_SHIPPING"], "ACTION_SHOW_SHIPPING");
  engine.addRule(["INTENT_GENERAL"], "ACTION_SHOW_INFO");
  engine.addRule(["INTENT_GREETING"], "ACTION_GREETING");
  engine.addRule(["INTENT_OFF_TOPIC"], "ACTION_OFF_TOPIC");

  engine.addFact(`INTENT_${prediction.primaryIntent}`);

  // Inject relationship facts
  if (relation.tension >= 0.7) engine.addFact("TENSION_HIGH");
  if (relation.trust >= 0.7) engine.addFact("TRUST_HIGH");
  if (relation.trust <= 0.3) engine.addFact("TRUST_LOW");

  let isStockHigh = true;
  let dbProduct: any = null;

  try {
    if (!PRODUCT_CACHE || Date.now() - PRODUCT_CACHE_EXPIRES > 5 * 60 * 1000) {
      PRODUCT_CACHE = await db.query.product.findMany({ limit: 50 });
      PRODUCT_CACHE_EXPIRES = Date.now();
    }
    const allProducts = PRODUCT_CACHE || [];
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
  if (primaryDecision === "ACTION_OFFER_DISCOUNT_5" && Deterministic.random() < 0.3) {
    GAME_STATE_MAP.set(userId, {
      step: 1,
      winningDoor: Math.floor(Deterministic.random() * 3) + 1,
      prodName: dbProduct ? dbProduct.name : prodName,
      price: price,
      discountedPrice: discountedPrice,
      character: botId,
    });

    return (
      `[Gamification Logic: Monty Hall Minigame Triggered]\n\n` +
      spinText(getRand(char.gameStart).replace(/\{prod\}/g, dbProduct ? dbProduct.name : prodName))
    );
  }

  // --- FORMAT FINAL VARIABLES ---
  const finalProdName = dbProduct ? dbProduct.name : prodName;
  const finalExpire = dbProduct && dbProduct.expired ? new Date(dbProduct.expired).toLocaleDateString("vi-VN") : "chưa rõ (đang cập nhật)";
  const finalHeavy = dbProduct && dbProduct.heavy ? dbProduct.heavy : "~1";

  const fill = (tpl: string) => {
    const replaced = tpl
      .replace(/\{prod\}/g, finalProdName)
      .replace(/\{price\}/g, price)
      .replace(/\{dp\}/g, discountedPrice)
      .replace(/\{expireDate\}/g, finalExpire)
      .replace(/\{heavyKg\}/g, finalHeavy.toString());
    return `<verbal_strike>${spinText(responseModifier + replaced)}</verbal_strike>`;
  };

  const tag = (reason: string) =>
    `[Suy luận AI: ${reason} (Độ tin cậy: ${(prediction.confidence * 100).toFixed(0)}%, Căng thẳng: ${(relation.tension * 100).toFixed(0)}%, Tin cậy: ${(relation.trust * 100).toFixed(0)}%)]\n\n`;

  switch (primaryDecision) {
    case "ACTION_OFF_TOPIC":
      return tag(`Câu hỏi ngoài lề. Đã bẻ lái.`) + fill(getRand(char.offtopic));
    case "ACTION_GREETING":
      return tag(`Câu chào hỏi.`) + fill(getRand(char.greeting || char.general));
    case "ACTION_SHOW_EXPIRED":
      return tag(`Hỏi Hạn sử dụng. Fuzzy Match SP: ${finalProdName}`) + fill(getRand(char.expired));
    case "ACTION_SHOW_SHIPPING":
      return tag(`Hỏi Vận chuyển/Trọng lượng. Fuzzy Match SP: ${finalProdName}`) + fill(getRand(char.shipping));
    case "ACTION_OFFER_DISCOUNT_5":
      return tag(`Mặc cả. Tồn kho đầy (>10). Cho giảm giá.`) + fill(getRand(char.discount));
    case "ACTION_REJECT_DISCOUNT":
      return tag(`Mặc cả. Kho cạn kiệt (<=10). Giữ giá.`) + fill(getRand(char.reject));
    case "ACTION_ANGRY_REJECT":
      const angryTpl = char.angryReject ? getRand(char.angryReject) : getRand(char.reject);
      return tag(`Mặc cả nhiều lần. Căng thẳng cao. Từ chối.`) + fill(angryTpl);
    case "ACTION_OFFER_DISCOUNT_10":
      const vipIntro =
        "{Vì mối quan hệ hữu nghị tốt đẹp giữa chúng ta|Nhận thấy sự chân thành từ phía hiền hữu|Được tinh tú soi sáng tình cảm hữu nghị}, ";
      const normalDiscTpl = getRand(char.discount);
      const discount10Tpl = vipIntro + normalDiscTpl.replace(/\{dp\}/g, discounted10Price);
      return tag(`Mặc cả. Tin cậy cao. Cho giảm đặc biệt 10%.`) + fill(discount10Tpl);
    case "ACTION_CONFIRM_ORDER":
      return tag(`Chốt mua. Tồn kho đầy.`) + fill(getRand(char.confirm));
    case "ACTION_CONFIRM_ORDER_WARNING":
      return tag(`Chốt mua. Kho cạn (<=10). Giục khách.`) + fill(getRand(char.confirmWarn));
    default:
      return tag(`Tra cứu chung.`) + fill(getRand(char.general));
  }
}
