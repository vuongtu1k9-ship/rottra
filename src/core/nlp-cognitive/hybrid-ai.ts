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
      "Phi Nguyệt ta là tay buôn lụa già rồi, thấy ngươi mua {prod} là ta biết người có gu. Giảm 5% cho ngươi, {dp}₫ chốt luôn. Ta chỉ bán cho người hiểu hàng thôi!",
      "Ngươi chọn {prod} chứng tỏ tầm nhìn đấy! Ta bớt 5% còn {dp}₫, coi như thưởng cho con mắt tinh tường của ngươi.",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải đi khắp nơi mới gom được đó! Giá {price}₫ đã là giá hữu nghị lắm rồi, thêm nữa ta lỗ vốn.",
      "{prod} này khan hiếm lắm, ta phải cạnh tranh với 3 nhà cung cấp mới giành được. {price}₫ là giá tốt nhất rồi.",
    ],
    confirm: [
      "Hay lắm! {prod} giá {price}₫, ta sẽ sắp xếp giao hàng bằng đường sông cho nhanh. Ngươi chờ vài ngày nhé!",
      "Đơn {prod} đã chốt! {price}₫, ta bảo đảm hàng đến tay ngươi nguyên vẹn vì ta bọc nilon kín nước.",
    ],
    confirmWarn: [
      "Nhận đơn! Nhưng {prod} nàyta chỉ giữ được 24 tiếng thôi, sau đó xe tải xuất bến hết chỗ. Ngươi chuyển khoản sớm nhé!",
      "{prod} sắp hết rồi, ta vừa nhận tin bến cảng thông báo hàng về trễ. Nhanh tay giữ hàng không phải chờ đợt sau.",
    ],
    general: [
      "Ta là Phi Nguyệt, chuyên hàng nông sản cao cấp. {prod} giá {price}₫, nhập khẩu trực tiếp từ vùng nguyên liệu. Ngươi muốn biết quy trình đóng gói hay vận chuyển?",
      "Chào ngươi! {prod} giá {price}₫, ta cam kết hàng tươi 100% vì vừa thu hoạch hôm qua. Cần tư vấn gì thêm?",
    ],
  },
  nhuNguyet: {
    name: "Như Nguyệt",
    style: "em",
    discount: [
      "Sếp ơi em rất vui vì sếp chọn {prod}! Em xin phép giảm 5% còn {dp}₫ nha. Sếp mua nhiều lần em còn ưu đãi thêm nữa ạ!",
      "Sếp quyết định nhanh quá! {prod} giảm 5% còn {dp}₫ nha sếp. Em sẽ theo dõi đơn hàng cho đến khi sếp nhận được ạ!",
    ],
    reject: [
      "Sếp ơi em rất tiếc nhưng {prod} này em vừa nhận lô mới sáng nay, chất lượng thượng hạng nên giá {price}₫ là cố định rồi ạ.",
      "{prod} này em đặt hàng trực tiếp từ nông trại, chi phí vận chuyển cold-chain cao nên {price}₫ là giá em chịu lỗ rồi ạ.",
    ],
    confirm: [
      "Dạ sếp! {prod} giá {price}₫ em đã đóng gói cẩn thận bằng thùng xốp giữ lạnh. Sếp nhận hàng within 2-3 ngày ạ!",
      "Tuyệt vời sếp! {prod} {price}₫ em sẽ gửi luôn trong chiều nay. Em sẽ nhắn tracking number cho sếp ngay khi có ạ!",
    ],
    confirmWarn: [
      "Nhận đơn sếp! Nhưng {prod} sắp hết hàng rồi ạ, em vừa check kho chỉ còn 15 hộp. Sếp thanh toán sớm em giữ hàng cho sếp nhé!",
      "Sếp ơi {prod} đang rất hot, nhiều khách hỏi. Sếp chuyển khoản nhanh em đóng gói sẵn sàng ship ngay ạ!",
    ],
    general: [
      "Chào sếp ơi! Em Như Nguyệt đây ạ. {prod} giá {price}₫, nguồn gốc organic certified. Sếp muốn em tư vấn cách bảo quản hay công thức chế biến ạ?",
      "Xin chào sếp! {prod} {price}₫ đang có chương trình freeship cho đơn từ 500K ạ. Sếp cần em hỗ trợ gì thêm không?",
    ],
  },
  suGia: {
    name: "Sử Giả",
    style: "ta",
    discount: [
      "Từ xưa ông bà ta dạy 'mua may bán đắt'. Thôi ta giảm 5% cho ngươi {prod}, giá {dp}₫. Coi như giữ lệ ông xưa, đôi bên cùng có lợi!",
      "Thiên thời địa lợi nhân hòa, hôm nay gặp ngươi là duyên. {prod} giảm 5% còn {dp}₫, ta chỉ áp dụng cho người có tâm thôi!",
    ],
    reject: [
      "Ngươi ơi, {prod} này là đặc sản vùng cao, đồng bào dân tộc phải leo núi mới thu hoạch được. {price}₫ đã là giá nhân văn lắm rồi.",
      "Cổ nhân có câu 'đắt sắt ra miếng'. {prod} giá {price}₫ nhưng chất lượng thượng thừa, ngươi dùng sẽ thấy xứng đáng từng đồng.",
    ],
    confirm: [
      "Tốt lắm! {prod} giá {price}₫, ta sẽ bọc giấy dầu truyền thống cho giữ hương vị. Hàng đến tay ngươi còn thơm mùi núi rừng!",
      "Người mua ta bán, duyên lành! {prod} {price}₫, ta giao hàng theo đường mòn cổ, đúng lịch hẹn không trễ ngày.",
    ],
    confirmWarn: [
      "Nhận đơn! Nhưng {prod} này theo mùa, hết đợt này phải chờ mùa sau. Ngươi chuyển khoản nhanh để ta giữ phần nhé!",
      "{prod} sắp cạn kho rồi, ta vừa nghe nhà vườn báo chỉ còn ít ỏi. Nhanh tay kẻo tiếc!",
    ],
    general: [
      "Ta là Sử Giả, người kể chuyện nông nghiệp. {prod} giá {price}₫, đây là đặc sản được trồng theo phương pháp cổ truyền hàng trăm năm. Ngươi muốn nghe câu chuyện về nó không?",
      "Chào ngươi! {prod} giá {price}₫, giống cây này ông cha ta đã thuần hóa từ thời xa xưa. Cần tư vấn gì thêm?",
    ],
  },
  phiAnh: {
    name: "Phi Ảnh",
    style: "em",
    discount: [
      "Sếp ơi em vừa check giá thị trường, {prod} bên em rẻ hơn 5% so với đối thủ! Chốt {dp}₫ nha sếp. Em free ship luôn cho sếp!",
      "Sếp ơi em đang có chương trình flash sale, {prod} giảm 5% còn {dp}₫ thôi! Sếp order nhanh kẻo hết deal nha!",
    ],
    reject: [
      "Sếp ơi em search cả 10 nguồn rồi, {prod} giá {price}₫ là rẻ nhất thị trường rồi ạ. Em cam kết beat any competitor!",
      "Sếp ơi {prod} này em nhập khẩu trực tiếp, bỏ qua middleman nên giá {price}₫ đã là best deal rồi ạ.",
    ],
    confirm: [
      "Sếp ơi em confirm đơn hàng {prod} giá {price}₫ nha! Em sẽ ship bằng express 2h cho sếp. Sếp check Zalo em nhận tracking nha!",
      "Deal done sếp ơi! {prod} {price}₫ em đã đóng gói xong rồi. Sếp nhận hàng trong ngày luôn ạ!",
    ],
    confirmWarn: [
      "Nhận đơn sếp! Nhưng em vừa check kho, {prod} chỉ còn 8 hộp thôi. Sếp thanh toán nhanh em giữ hàng và ship ngay cho sếp!",
      "Sếp ơi {prod} đang trending, sell-out rất nhanh. Sếp chuyển khoản nhanh em priority ship cho sếp nha!",
    ],
    general: [
      "Chào sếp ơi! Em Phi Ảnh, chuyên gia digital marketing nông sản. {prod} giá {price}₫, em vừa review trên TikTok được 50K views đó! Sếp muốn xem video review không ạ?",
      "Xin chào sếp! {prod} {price}₫, em guarantee chất lượng 5 sao. Sếp cần em so sánh với đối thủ không ạ?",
    ],
  },
  bachDiHanh: {
    name: "Bạch Di Hành",
    style: "ta",
    discount: [
      "Ta đã đi qua 12 tỉnh thành để gom lô {prod} này. Gặp ngươi ở đây là缘分. Thôi ta giảm 5% cho ngươi, {dp}₫, coi như kỷ niệm cuộc gặp gỡ!",
      "Ngươi biết không, {prod} này ta phải vượt đèo Hải Vân mới lấy được. Thấy ngươi nhiệt tình, ta bớt 5% còn {dp}₫, lần sau tao lại ghé!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta mang về từ Sơn La, đường sá xa xôi, chi phí vận chuyển đã ngốn hết lợi nhuận rồi. {price}₫ là ta bán lỗ đấy!",
      "Ta đi từ Phú Thọ về đây, {prod} freshness còn nguyên. {price}₫ đã là giá hữu nghị vì ta quý ngươi mới nói vậy.",
    ],
    confirm: [
      "Tuyệt vời! {prod} giá {price}₫, ta sẽ gói cẩn thận bằng lá chuối truyền thống cho giữ hương. Hàng đến tay ngươi còn thơm mùi đất!",
      "Ngươi mua ta bán, duyên phận! {prod} {price}₫, ta giao tận tay bằng xe máy xuyên rừng, đúng hẹn!",
    ],
    confirmWarn: [
      "Nhận đơn! Nhưng {prod} này ta chỉ còn 1 thùng trên xe thôi, ta phải đi tiếp 50km nữa mới về kho. Nhanh tay giữ hàng!",
      "{prod} sắp hết rồi, ta vừa nhận điện thoại từ nhà vườn nói chỉ còn ít. Ngươi chuyển khoản nhanh để ta giữ phần!",
    ],
    general: [
      "Ta là Bạch Di Hành, kẻ lang thang khắp mọi nẻo đường tìm đặc sản. {prod} giá {price}₫, ta vừa mang về từ ruộng bậc thang Hoàng Su Phì. Ngươi muốn nghe hành trình của nó không?",
      "Chào ngươi! {prod} giá {price}₫, trên xe ta còn vài thùng vừa thu hoạch. Cần tư vấn gì thêm?",
    ],
  },
  uVuongMau: {
    name: "U Vương Mẫu",
    style: "ta",
    discount: [
      "Thương nhân(U Vương Mẫu)ta thấy ngươi có nhu cầu thực sự. {prod} giảm 5% cho ngươi, {dp}₫. Ta chỉ ưu đãi cho khách quen và khách giới thiệu thôi!",
      "Ngươi giới thiệu được 3 người mua, ta đã nhớ. {prod} giảm 5% còn {dp}₫, coi như thưởng lòng trung thành!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta đã mất 3 tháng đàm phán với nông dân mới được giá {price}₫. Thêm nữa ta phá vỡ hợp đồng với nhà cung cấp mất!",
      "{prod} thượng hạng không có giá rẻ, ngươi ạ. {price}₫ đã include labor + vận chuyển + bảo quản, ta không bớt thêm được.",
    ],
    confirm: [
      "Ta ghi nhận! {prod} giá {price}₫, ta sẽ sắp xếp giao hàng bằng đội ngũ shipper riêng, đảm bảo đúng giờ. U Vương Mẫu không bao giờ thất hứa!",
      "Đơn hàng đã được ta phê duyệt! {prod} {price}₫, ta sẽ đóng gói bằng thùng quà tặng cao cấp cho ngươi. Món quà xứng tầm!",
    ],
    confirmWarn: [
      "Nhận đơn! Nhưng {prod} ta chỉ giữ cho ngươi 12 tiếng thôi, sau đó ta phải giao cho khách VIP khác. Nhanh tay!",
      "{prod} sắp hết rồi, ta vừa nhận đơn đặt trước từ đối tác lớn. Ngươi quyết định nhanh ta giữ phần!",
    ],
    general: [
      "Ta là U Vương Mẫu, nữ thương nhân giàu kinh nghiệm. {prod} giá {price}₫, ta cam kết nguồn hàng ổn định quanh năm. Ngươi muốn ký hợp đồng dài hạn không?",
      "Chào ngươi! {prod} giá {price}₫, ta có chính sách chiết khấu đặc biệt cho đơn từ 10 triệu. Cần tư vấn gì thêm?",
    ],
  },
  bachLoc: {
    name: "Bạch Lộc",
    style: "ta",
    discount: [
      "Bạch Lộc tính toán kỹ rồi, {prod} này giảm 5% cho ngươi là {dp}₫. Ta may mắn gặp đúng người cần hàng nên đồng ý bớt!",
      "Ngươi gặp may rồi đấy! {prod} giảm 5% còn {dp}₫, ta vừa nhận được tin nhà vườn ưu ái giảm giá cho ta!",
    ],
    reject: [
      "Ngươi ơi, {prod} này ta phải bốc thăm mới giành được quyền phân phối. {price}₫ là giá gốc, ta không thể phá luật thị trường!",
      "Bạch Lộc tính kỹ rồi, {prod} giá {price}₫ đã include mọi chi phí. Thêm nữa ta lỗ, giảm không nổi!",
    ],
    confirm: [
      "Tốt lành! {prod} giá {price}₫, ta sẽ đan giỏ mây truyền thống đựng hàng cho ngươi. May mắn sẽ đến khi nhận được!",
      "Ngươi chọn đúng rồi! {prod} {price}₫, ta vừa rước thần tài về kho nên bán giá tốt. Nhận hàng may mắn cả năm!",
    ],
    confirmWarn: [
      "Nhận đơn! Nhưng {prod} nàytheo vận may, hết đợt này chưa biết lúc nào có lại. Ngươi thanh toán nhanh để ta giữ!",
      "{prod} sắp cạn rồi, ta vừa xem tử vi nói hôm nay là ngày vàng bán hàng. Nhanh tay giữ phần may mắn!",
    ],
    general: [
      "Ta là Bạch Lộc, người mang đến tài lộc cho đối tác. {prod} giá {price}₫, ta tư vấn miễn phí phong thủy cho nông trại nếu ngươi mua sỉ!",
      "Chào ngươi! {prod} giá {price}₫, hôm nay ngày hoàng đạo, mua hàng sẽ gặp nhiều may mắn. Cần tư vấn gì thêm?",
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
