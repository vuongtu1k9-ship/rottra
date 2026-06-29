// =========================================================================
// ROTTRA HYBRID OFFLINE AI ENGINE
// Kết hợp Mạng Neural Nhân Tạo siêu nhẹ và Hệ Chuyên Gia Suy Luận Logic
// Không dùng model bên thứ 3, không dùng API Cloud, hoạt động offline 100%
// =========================================================================

import * as crypto from "crypto";

/**
 * 1. Mạng Neural phân loại ý định siêu nhẹ (Tiny Neural Intent Classifier)
 * Nhận diện đặc trưng của tin nhắn để phân loại thành: mặc cả, mua hàng, hoặc hội thoại chung.
 */
export class TinyNeuralClassifier {
  private weights: Record<string, number[]> = {
    BARGAIN: [0.3, 0.8, -0.2],
    BUY: [0.2, 0.7, 0.5],
    GENERAL: [-0.4, -0.6, 0.1],
  };
  private biases: Record<string, number> = {
    BARGAIN: -0.2,
    BUY: -0.3,
    GENERAL: 0.1,
  };

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .trim();
  }

  public predict(query: string): { intent: "BARGAIN" | "BUY" | "GENERAL"; confidence: number } {
    const clean = this.cleanText(query);
    const words = clean.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    const bargainKeywords = [
      "giam",
      "bot",
      "re",
      "mac",
      "ca",
      "chiet khau",
      "giam gia",
      "fix",
      "bot",
      "giam",
      "re",
      "mac",
      "thuong luong",
      "dam phan",
      "giam mot it",
    ];
    const buyKeywords = [
      "mua",
      "lay",
      "chot",
      "dat hang",
      "order",
      "ship",
      "giao",
      "lay hang",
      "lay",
      "chot",
      "dat",
      "thanhtoan",
      "thanhtoen",
      "chuyen khoan",
    ];

    let bargainCount = 0;
    let buyCount = 0;

    for (const word of words) {
      if (bargainKeywords.some((kw) => word.includes(kw))) bargainCount++;
      if (buyKeywords.some((kw) => word.includes(kw))) buyCount++;
    }

    const punctuationCount = (query.match(/[!?]/g) || []).length;
    const inputs = [wordCount, bargainCount * 2.0 + buyCount * -0.5, punctuationCount];

    const bargainLogit =
      inputs[0] * this.weights.BARGAIN[0] + inputs[1] * this.weights.BARGAIN[1] + inputs[2] * this.weights.BARGAIN[2] + this.biases.BARGAIN;
    const bargainProb = this.sigmoid(bargainLogit);

    const buyInputs = [wordCount, buyCount * 2.0 + bargainCount * -0.3, punctuationCount];
    const buyLogit =
      buyInputs[0] * this.weights.BUY[0] + buyInputs[1] * this.weights.BUY[1] + buyInputs[2] * this.weights.BUY[2] + this.biases.BUY;
    const buyProb = this.sigmoid(buyLogit);

    const genLogit =
      inputs[0] * this.weights.GENERAL[0] +
      (bargainCount + buyCount) * this.weights.GENERAL[1] +
      inputs[2] * this.weights.GENERAL[2] +
      this.biases.GENERAL;
    const genProb = this.sigmoid(genLogit);

    if (bargainProb > buyProb && bargainProb > genProb && bargainCount > 0) {
      return { intent: "BARGAIN", confidence: bargainProb };
    } else if (buyProb > bargainProb && buyProb > genProb && buyCount > 0) {
      return { intent: "BUY", confidence: buyProb };
    } else {
      return { intent: "GENERAL", confidence: Math.max(genProb, 0.5) };
    }
  }
}

/**
 * 2. Hệ chuyên gia suy luận logic (Symbolic Forward-Chaining Inference Engine)
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

  public clearFacts() {
    this.facts.clear();
  }

  public runInference(): string[] {
    let updated = true;
    const actionsTriggered: string[] = [];

    while (updated) {
      updated = false;
      for (const rule of this.rules) {
        if (!this.facts.has(rule.action)) {
          const isSatisfied = rule.conditions.every((cond) => this.facts.has(cond));
          if (isSatisfied) {
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
  discount: string[];
  reject: string[];
  confirm: string[];
  confirmWarn: string[];
  general: string[];
};

const CHARACTERS: Record<string, CharacterResponse> = {
  toLuong: {
    name: "Tô Lương",
    style: "thương nhân",
    discount: [
      "Tô Lương ta đã cân nhắc kỹ lưỡng. Do lô {prod} này hiện tại trong kho đang dồi dào, ta đồng ý giảm giá hữu nghị 5% cho hiền hữu để đôi bên mau chóng chốt đơn kết duyên. Giá mới là {dp}₫.",
      "Hiền hữu quả có mắt nhìn hàng. Lô {prod} này kho đang nhiều, ta bớt 5% coi như quà kết nghĩa đôi bên. Giá mới chỉ {dp}₫ thôi!",
    ],
    reject: [
      "Thật sự xin lỗi hiền hữu. Lô {prod} thượng hạng này hiện tại nhà vườn chỉ còn vài thùng cuối cùng, khách xếp hàng tranh mua rất nhiều. Ta không thể bớt dù chỉ một đồng so với mức giá {price}₫.",
      "Hiền hữu thông cảm, lô {prod} này khan hiếm lắm rồi, khách đặt trước cả tuần. Mức giá {price}₫ đã là công bằng nhất cho bà con nông dân.",
    ],
    confirm: [
      "Tuyệt vời! Ta rất thích phong cách giao dịch dứt khoát của hiền hữu. Lô {prod} giá {price}₫ sẽ được Tô Lương ta trực tiếp phê duyệt xuất kho và vận chuyển sớm nhất.",
      "Đơn hàng đã được ghi nhận! {prod} giá {price}₫ sẽ lên xe vận chuyển ngay trong hôm nay. Hữu chờ nhận hàng nhé!",
    ],
    confirmWarn: [
      "Đồng ý giao dịch! Tuy nhiên ta cần lưu ý rằng lô {prod} này hiện còn rất ít. Để chắc chắn giữ được hàng, hữu vui lòng chuyển khoản đặt cọc trước để ta giữ lại đơn hàng.",
      "Nhận đơn! Nhưng {prod} sắp hết rồi, hữu chuyển khoản sớm để ta giữ hàng cho nhé. Chậm là mất duyên đó!",
    ],
    general: [
      "Chào hiền hữu! Ta đang cung cấp lô {prod} đạt chuẩn VietGAP với mức giá niêm yết {price}₫. Hữu cần tư vấn thêm về quy trình đóng gói hay chính sách giao nhận?",
      "Rất vui được tiếp đón hiền hữu! {prod} của ta đảm bảo nguồn gốc rõ ràng, giá {price}₫. Hữu muốn biết thêm gì?",
    ],
  },
  thuongNguyet: {
    name: "Thương Nguyệt",
    style: "lão phu",
    discount: [
      "Lão phu Thương Nguyệt kính chào hiền hữu. Lô {prod} này vốn là mồ hôi công sức của bà con nông dân. Nể tình hữu thiện chí và kho hàng cũng cần luân chuyển, lão phu bớt 5% coi như quà gặp mặt. Giá chốt là {dp}₫.",
      "Được rồi, lão phu nể lòng hiền hữu. Bớt 5% cho lô {prod}, giá {dp}₫. Mong hữu giữ vững quan hệ lâu dài nhé!",
    ],
    reject: [
      "Chào hữu, lô {prod} thu hoạch hữu cơ số lượng rất hạn chế, lão phu không thể bớt thêm nữa. Mức giá {price}₫ đã là công bằng nhất cho công sức bà con rồi.",
      "Lão phu rất tiếc, {prod} này vừa thu hoạch xong đã có người đặt hết. Giá {price}₫ là giá gốc nông dân, không thể hạ thêm.",
    ],
    confirm: [
      "Lão phu ghi nhận! {prod} chất lượng cao giá {price}₫ sẽ được bà con nông trại bọc lót kỹ càng và gửi đi ngay cho hữu. Chúc hữu vạn sự hanh thông!",
      "Đơn hàng đã được lão phu phê duyệt. {prod} giá {price}₫ sẽ đến tay hữu sớm nhất. Cảm ơn hữu đã tin tưởng!",
    ],
    confirmWarn: [
      "Đã ghi nhận tâm ý chốt mua của hữu. Nhưng {prod} chỉ còn vài cân cuối cùng. Hữu nên làm thủ tục sớm kẻo xe tải xuất phát mất thì phải chờ đợt sau.",
      "Nhận đơn từ hữu! Tuy nhiên {prod} sắp cạn kho, hữu chuyển khoản nhanh để giữ hàng nhé.",
    ],
    general: [
      "Lão phu Thương Nguyệt rất vui được tiếp đón. Hiện tại {prod} đang bán với giá {price}₫. Toàn bộ đều được trồng tự nhiên, đảm bảo tươi ngon tuyệt đối.",
      "Chào hữu! {prod} giá {price}₫, nguồn gốc rõ ràng từ nông trại. Hữu cần lão phu tư vấn gì thêm?",
    ],
  },
  tramTinh: {
    name: "Trầm Tinh",
    style: "em",
    discount: [
      "Tinh tú chỉ lối cho thấy chúng ta có duyên lành! Trầm Tinh đồng ý bớt cho sếp 5% để tạo năng lượng tích cực cho lô hàng {prod}. Giá ưu đãi là {dp}₫. Sếp chốt luôn cho may mắn nhé!",
      "Duyên phận đã dẫn sếp đến đây! {prod} giảm 5% còn {dp}₫ nha sếp. Em tin vũ trụ sẽ ban phước lành cho giao dịch này!",
    ],
    reject: [
      "Sếp ơi, tinh tú báo rằng lô {prod} này năng lượng rất mạnh và cực kỳ hiếm có. Trầm Tinh phải giữ nguyên giá {price}₫ để bảo toàn giá trị cốt lõi của nó ạ.",
      "Em rất tiếc sếp ơi, {prod} này số lượng có hạn mà demand cao lắm. Giá {price}₫ là cố định rồi sếp ạ.",
    ],
    confirm: [
      "Thật tuyệt vời! Vũ trụ đã nghe thấy lời chốt đơn của sếp. {prod} trị giá {price}₫ sẽ sớm được gửi tới sếp với đầy ắp lời chúc cát tường!",
      "Ngôi sao may mắn đang chiếu sáng giao dịch này! {prod} giá {price}₫ sẽ đến tay sếp trong thời gian sớm nhất!",
    ],
    confirmWarn: [
      "Trầm Tinh xin nhận đơn! Tuy nhiên tinh tú báo động {prod} sắp cạn nguồn cung. Sếp thanh toán sớm để vũ trụ khóa ngay lô hàng tuyệt vời này cho sếp!",
      "Nhận đơn sếp! {prod} sắp hết rồi, sếp chuyển khoản nhanh để giữ vận may nhé!",
    ],
    general: [
      "Chào sếp! Ánh trăng đang dẫn lối sếp đến với lô {prod} tuyệt diệu. Sản phẩm đang có giá là {price}₫. Sếp muốn tư vấn thêm gì không ạ?",
      "Xin chào sếp! {prod} giá {price}₫ đang chờ sếp rước về. Em sẵn sàng hỗ trợ sếp mọi lúc ạ!",
    ],
  },
  daoTieuCuu: {
    name: "Đào Tiểu Cửu",
    style: "tiểu thư",
    discount: [
      "Tiểu Cửu thấy sếp thật duyên dáng! Thôi thì tiểu thư bớt 5% cho sếp chơi {prod}, giá {dp}₫. Coi như quà kết duyên nha!",
      "Sếp giỏi đàm phán ghê! {prod} giảm 5% còn {dp}₫ nha. Tiểu thư chiều sếp một lần vậy!",
    ],
    reject: [
      "Sếp ơi, {prod} này tiểu thư phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu ạ.",
      "Tiểu thư rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi sếp ạ!",
    ],
    confirm: [
      "Dạ! Đơn hàng {prod} giá {price}₫ đã được tiểu thư ghi nhận. Sếp yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn ạ!",
      "Tuyệt vời sếp ơi! {prod} giá {price}₫ sẽ sớm đến tay sếp. Tiểu thư cam kết chất lượng ạ!",
    ],
    confirmWarn: [
      "Nhận đơn sếp! Nhưng {prod} sắp hết rồi, sếp chuyển khoản nhanh nha để tiểu thư giữ hàng cho sếp!",
      "Sếp ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Sếp thanh toán sớm để tiểu thư đóng gói giữ hàng cho sếp nhé!",
    ],
    general: [
      "Chào sếp! Tiểu thư giới thiệu cho sếp lô {prod} cực ngon luôn, giá {price}₫. Sếp muốn biết thêm gì ạ?",
      "Xin chào sếp! {prod} giá {price}₫ đang chờ sếp nè. Sếp cần tiểu thư tư vấn gì thêm không ạ?",
    ],
  },
  hoaHuynh: {
    name: "Hoa Huynh",
    style: "anh",
    discount: [
      "Anh thấy em có duyên quá! Thôi anh giảm 5% cho em chơi {prod}, giá {dp}₫. Coi như anh làm quen em vậy!",
      "Em đàm phán giỏi ghê! {prod} giảm 5% còn {dp}₫ nha. Anh chiều em một lần vậy!",
    ],
    reject: [
      "Em ơi, {prod} này anh phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Anh rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi em ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được anh ghi nhận. Em yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay quá! {prod} giá {price}₫ sẽ sớm đến tay em. Anh cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn em! Nhưng {prod} sắp hết rồi, em chuyển khoản nhanh nha để anh giữ hàng cho!",
      "Em ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Em thanh toán sớm để anh đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào em! Anh giới thiệu cho em lô {prod} cực ngon luôn, giá {price}₫. Em muốn biết thêm gì?",
      "Xin chào em! {prod} giá {price}₫ đang chờ em nè. Em cần anh tư vấn gì thêm không?",
    ],
  },
  phiNguyet: {
    name: "Phi Nguyệt",
    style: "ta",
    discount: [
      "Phi Nguyệt ta thấy ngươi có duyên lắm. Thôi ta giảm 5% cho ngươi chơi {prod}, giá {dp}₫. Coi như ta làm quen ngươi vậy!",
      "Ngươi đàm phán giỏi lắm! {prod} giảm 5% còn {dp}₫ nha. Ta chiều ngươi một lần vậy!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Ta rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi ngươi ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được ta ghi nhận. Ngươi yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay lắm! {prod} giá {price}₫ sẽ sớm đến tay ngươi. Ta cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn ngươi! Nhưng {prod} sắp hết rồi, ngươi chuyển khoản nhanh nha để ta giữ hàng cho!",
      "Ngươi ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Ngươi thanh toán sớm để ta đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào ngươi! Ta giới thiệu cho ngươi lô {prod} cực ngon luôn, giá {price}₫. Ngươi muốn biết thêm gì?",
      "Xin chào ngươi! {prod} giá {price}₫ đang chờ ngươi nè. Ngươi cần ta tư vấn gì thêm không?",
    ],
  },
  nhuNguyet: {
    name: "Như Nguyệt",
    style: "em",
    discount: [
      "Sếp nói hay quá! Em giảm 5% cho sếp chơi {prod}, giá {dp}₫ nha. Coi như em làm quen sếp vậy!",
      "Sếp đàm phán giỏi ghê! {prod} giảm 5% còn {dp}₫ nha. Em chiều sếp một lần vậy!",
    ],
    reject: [
      "Sếp ơi, {prod} này em phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu ạ.",
      "Em rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi sếp ạ!",
    ],
    confirm: [
      "Dạ! Đơn hàng {prod} giá {price}₫ đã được em ghi nhận. Sếp yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn ạ!",
      "Tuyệt vời sếp ơi! {prod} giá {price}₫ sẽ sớm đến tay sếp. Em cam kết chất lượng ạ!",
    ],
    confirmWarn: [
      "Nhận đơn sếp! Nhưng {prod} sắp hết rồi, sếp chuyển khoản nhanh nha để em giữ hàng cho sếp!",
      "Sếp ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Sếp thanh toán sớm để em đóng gói giữ hàng cho sếp nhé!",
    ],
    general: [
      "Chào sếp! Em giới thiệu cho sếp lô {prod} cực ngon luôn, giá {price}₫. Sếp muốn biết thêm gì ạ?",
      "Xin chào sếp! {prod} giá {price}₫ đang chờ sếp nè. Sếp cần em tư vấn gì thêm không ạ?",
    ],
  },
  suGia: {
    name: "Sử Giả",
    style: "ta",
    discount: [
      "Sử Giả ta thấy ngươi có duyên lắm. Thôi ta giảm 5% cho ngươi chơi {prod}, giá {dp}₫. Coi như ta làm quen ngươi vậy!",
      "Ngươi đàm phán giỏi lắm! {prod} giảm 5% còn {dp}₫ nha. Ta chiều ngươi một lần vậy!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Ta rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi ngươi ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được ta ghi nhận. Ngươi yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay lắm! {prod} giá {price}₫ sẽ sớm đến tay ngươi. Ta cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn ngươi! Nhưng {prod} sắp hết rồi, ngươi chuyển khoản nhanh nha để ta giữ hàng cho!",
      "Ngươi ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Ngươi thanh toán sớm để ta đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào ngươi! Ta giới thiệu cho ngươi lô {prod} cực ngon luôn, giá {price}₫. Ngươi muốn biết thêm gì?",
      "Xin chào ngươi! {prod} giá {price}₫ đang chờ ngươi nè. Ngươi cần ta tư vấn gì thêm không?",
    ],
  },
  phiAnh: {
    name: "Phi Anh",
    style: "em",
    discount: [
      "Sếp nói hay quá! Em giảm 5% cho sếp chơi {prod}, giá {dp}₫ nha. Coi như em làm quen sếp vậy!",
      "Sếp đàm phán giỏi ghê! {prod} giảm 5% còn {dp}₫ nha. Em chiều sếp một lần vậy!",
    ],
    reject: [
      "Sếp ơi, {prod} này em phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu ạ.",
      "Em rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi sếp ạ!",
    ],
    confirm: [
      "Dạ! Đơn hàng {prod} giá {price}₫ đã được em ghi nhận. Sếp yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn ạ!",
      "Tuyệt vời sếp ơi! {prod} giá {price}₫ sẽ sớm đến tay sếp. Em cam kết chất lượng ạ!",
    ],
    confirmWarn: [
      "Nhận đơn sếp! Nhưng {prod} sắp hết rồi, sếp chuyển khoản nhanh nha để em giữ hàng cho sếp!",
      "Sếp ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Sếp thanh toán sớm để em đóng gói giữ hàng cho sếp nhé!",
    ],
    general: [
      "Chào sếp! Em giới thiệu cho sếp lô {prod} cực ngon luôn, giá {price}₫. Sếp muốn biết thêm gì ạ?",
      "Xin chào sếp! {prod} giá {price}₫ đang chờ sếp nè. Sếp cần em tư vấn gì thêm không ạ?",
    ],
  },
  bachDiHanh: {
    name: "Bạch Di Hành",
    style: "ta",
    discount: [
      "Bạch Di Hành thấy ngươi có duyên lắm. Thôi ta giảm 5% cho ngươi chơi {prod}, giá {dp}₫. Coi như ta làm quen ngươi vậy!",
      "Ngươi đàm phán giỏi lắm! {prod} giảm 5% còn {dp}₫ nha. Ta chiều ngươi một lần vậy!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Ta rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi ngươi ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được ta ghi nhận. Ngươi yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay lắm! {prod} giá {price}₫ sẽ sớm đến tay ngươi. Ta cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn ngươi! Nhưng {prod} sắp hết rồi, ngươi chuyển khoản nhanh nha để ta giữ hàng cho!",
      "Ngươi ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Ngươi thanh toán sớm để ta đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào ngươi! Ta giới thiệu cho ngươi lô {prod} cực ngon luôn, giá {price}₫. Ngươi muốn biết thêm gì?",
      "Xin chào ngươi! {prod} giá {price}₫ đang chờ ngươi nè. Ngươi cần ta tư vấn gì thêm không?",
    ],
  },
  uVuongMau: {
    name: "U Vương Mẫu",
    style: "ta",
    discount: [
      "U Vương Mẫu thấy ngươi có duyên lắm. Thôi ta giảm 5% cho ngươi chơi {prod}, giá {dp}₫. Coi như ta làm quen ngươi vậy!",
      "Ngươi đàm phán giỏi lắm! {prod} giảm 5% còn {dp}₫ nha. Ta chiều ngươi một lần vậy!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Ta rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi ngươi ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được ta ghi nhận. Ngươi yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay lắm! {prod} giá {price}₫ sẽ sớm đến tay ngươi. Ta cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn ngươi! Nhưng {prod} sắp hết rồi, ngươi chuyển khoản nhanh nha để ta giữ hàng cho!",
      "Ngươi ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Ngươi thanh toán sớm để ta đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào ngươi! Ta giới thiệu cho ngươi lô {prod} cực ngon luôn, giá {price}₫. Ngươi muốn biết thêm gì?",
      "Xin chào ngươi! {prod} giá {price}₫ đang chờ ngươi nè. Ngươi cần ta tư vấn gì thêm không?",
    ],
  },
  bachLoc: {
    name: "Bạch Lộc",
    style: "ta",
    discount: [
      "Bạch Lộc thấy ngươi có duyên lắm. Thôi ta giảm 5% cho ngươi chơi {prod}, giá {dp}₫. Coi như ta làm quen ngươi vậy!",
      "Ngươi đàm phán giỏi lắm! {prod} giảm 5% còn {dp}₫ nha. Ta chiều ngươi một lần vậy!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải giành giật mới có được đó! Giá {price}₫ là giá gốc rồi, không bớt được nữa đâu.",
      "Ta rất tiếc, {prod} đang hot lắm, khách tranh nhau mua. Giá {price}₫ là fixed rồi ngươi ạ!",
    ],
    confirm: [
      "Đơn hàng {prod} giá {price}₫ đã được ta ghi nhận. Ngươi yên tâm, hàng sẽ được đóng gói cẩn thận và giao đúng hẹn!",
      "Hay lắm! {prod} giá {price}₫ sẽ sớm đến tay ngươi. Ta cam kết chất lượng!",
    ],
    confirmWarn: [
      "Nhận đơn ngươi! Nhưng {prod} sắp hết rồi, ngươi chuyển khoản nhanh nha để ta giữ hàng cho!",
      "Ngươi ơi, {prod} chỉ còn vài sản phẩm cuối thôi. Ngươi thanh toán sớm để ta đóng gói giữ hàng cho nhé!",
    ],
    general: [
      "Chào ngươi! Ta giới thiệu cho ngươi lô {prod} cực ngon luôn, giá {price}₫. Ngươi muốn biết thêm gì?",
      "Xin chào ngươi! {prod} giá {price}₫ đang chờ ngươi nè. Ngươi cần ta tư vấn gì thêm không?",
    ],
  },
};

/**
 * 3. Bộ điều phối đàm phán nông sản lai
 */
export function runHybridOfflineInference(query: string, botId: string, prodName: string, price: string): string {
  const classifier = new TinyNeuralClassifier();
  const engine = new HybridInferenceEngine();

  engine.addRule(["INTENT_BARGAIN", "STOCK_HIGH"], "ACTION_OFFER_DISCOUNT_5");
  engine.addRule(["INTENT_BARGAIN", "STOCK_LOW"], "ACTION_REJECT_DISCOUNT");
  engine.addRule(["INTENT_BUY", "STOCK_HIGH"], "ACTION_CONFIRM_ORDER");
  engine.addRule(["INTENT_BUY", "STOCK_LOW"], "ACTION_CONFIRM_ORDER_WARNING");
  engine.addRule(["INTENT_GENERAL"], "ACTION_SHOW_INFO");

  const prediction = classifier.predict(query);
  engine.addFact(`INTENT_${prediction.intent}`);

  const hash = crypto.createHash("md5").update(prodName).digest("hex");
  const isStockHigh = parseInt(hash.slice(0, 2), 16) % 2 === 0;

  if (isStockHigh) {
    engine.addFact("STOCK_HIGH");
  } else {
    engine.addFact("STOCK_LOW");
  }

  const decisions = engine.runInference();
  const primaryDecision = decisions[decisions.length - 1] || "ACTION_SHOW_INFO";

  const getRand = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];
  const cleanPrice = parseInt(price.replace(/[^0-9]/g, "")) || 100000;
  const discountedPrice = Math.round(cleanPrice * 0.95).toLocaleString("vi-VN");

  const conf = (prediction.confidence * 100).toFixed(0);

  const char = CHARACTERS[botId];
  if (!char) {
    return `[Suy luận logic: Không nhận diện được nhân vật. Sử dụng cấu hình cơ bản.] Chào bạn, tôi đã tiếp nhận thông tin về lô ${prodName} giá ${price}₫. Hãy cho tôi biết yêu cầu cụ thể!`;
  }

  const fill = (tpl: string) =>
    tpl
      .replace(/\{prod\}/g, prodName)
      .replace(/\{price\}/g, price)
      .replace(/\{dp\}/g, discountedPrice);

  const tag = (reason: string) => `[Suy luận logic: ${reason} (độ tin cậy ${conf}%)]\n\n`;

  switch (primaryDecision) {
    case "ACTION_OFFER_DISCOUNT_5":
      return tag(`Phát hiện mặc cả. Hàng tồn kho ${isStockHigh ? "đầy" : "sắp hết"}. Quyết định: Giảm 5%`) + fill(getRand(char.discount));
    case "ACTION_REJECT_DISCOUNT":
      return tag(`Phát hiện mặc cả. Kho hàng ${isStockHigh ? "còn nhiều" : "cạn kiệt"}. Quyết định: Giữ giá`) + fill(getRand(char.reject));
    case "ACTION_CONFIRM_ORDER":
      return tag(`Khách chốt mua. Kho sẵn sàng. Quyết định: Xác nhận đơn`) + fill(getRand(char.confirm));
    case "ACTION_CONFIRM_ORDER_WARNING":
      return tag(`Khách chốt mua. Kho sắp hết. Quyết định: Xác nhận + cảnh báo`) + fill(getRand(char.confirmWarn));
    default:
      return tag(`Yêu cầu thông tin chung. Quyết định: Giới thiệu sản phẩm`) + fill(getRand(char.general));
  }
}
