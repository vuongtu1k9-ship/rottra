import { db } from "./db";
import { vectorDocument } from "./schema";
import { eq, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const ANCIENT_WISDOM_DATA = [
  {
    part: 4,
    concept: "Im lặng khi bị vu khống, hàm oan (Thanh giả tự thanh)",
    app: "Không đôi co tranh cãi với kẻ tiểu nhân, để thời gian chứng minh sự thật.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước sự vu khống, hàm oan. Cổ nhân có câu: 'Thanh giả tự thanh, trọc giả tự trọc'. Người thông tuệ hiểu rằng việc tranh cãi, thanh minh với kẻ có ý đồ xấu chỉ làm hao tổn năng lượng và làm hạ thấp giá trị bản thân. Sự im lặng lúc này chính là tấm khiên vững chắc nhất. Hãy để thời gian và sự thật tự lên tiếng chứng minh bản chất của bạn. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 5,
    concept: "Im lặng trước sự khoe khoang, tự mãn",
    app: "Nhìn thấu không nói thấu, mỉm cười nhẹ nhàng và giữ thể diện cho đối phương.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng khi người khác đang tự mãn, khoe khoang. Nhìn thấu nhưng không nói thấu chính là đỉnh cao của tu dưỡng. Khi đối diện với người nông cạn đang cố gắng thể hiện, sự im lặng bao dung, tôn trọng thể diện của họ chính là thái độ của một bậc hiền triết. Hãy mỉm cười nhẹ nhàng và im lặng lắng nghe. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 6,
    concept: "Im lặng khi nóng giận (Nhẫn nại giữ tâm)",
    app: "Hít thở sâu, không phát ngôn khi cảm xúc tiêu cực đang cao trào.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng khi đang nóng giận. Cổ nhân dạy: 'Nhất niệm sân tâm khởi, bách vạn chướng môn khai'. Một lời nói ra trong lúc tức giận có thể hủy hoại toàn bộ công đức tích lũy lâu nay. Hãy chọn cách im lặng, hít thở sâu để hạ hỏa, tránh làm tổn thương người khác và bản thân. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 7,
    concept: "Im lặng trước thị phi, đồn thổi",
    app: "Cắt đứt chuỗi lây lan tin đồn bằng cách không quan tâm và không truyền đi.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước những lời đồn thổi thị phi. Tin đồn dừng lại ở người thông thái. Người có trí tuệ sẽ không tiếp tay lan truyền, không phán xét và hoàn toàn giữ im lặng khi nghe thấy những chuyện vô căn cứ, bảo vệ tâm hồn thanh tịnh. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 8,
    concept: "Im lặng khi chưa rõ chân tướng",
    app: "Không phán xét vội vã, im lặng quan sát và thu thập thông tin xác thực.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng khi chưa hiểu rõ chân tướng sự việc. Không phán xét vội vã, không phỏng đoán mơ hồ. Im lặng lúc này là biểu hiện của sự cẩn trọng, tôn trọng sự thật và có trách nhiệm với lời nói của mình. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 9,
    concept: "Im lặng để tự soi rọi (Phản tỉnh nội tâm)",
    app: "Dành không gian tĩnh lặng định tâm, nhận ra khuyết điểm cá nhân.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng để tự soi rọi nội tâm. Trong thế giới ồn ào náo nhiệt, việc giữ cho tâm mình tĩnh lặng giúp ta lắng nghe tiếng nói sâu thẳm bên trong. Định sinh tuệ, phản tỉnh bản thân để nhận diện sai lầm và hoàn thiện nhân cách mỗi ngày. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 10,
    concept: "Im lặng trước sự chỉ trích, công kích",
    app: "Xem chỉ trích là gương soi bản thân, im lặng sửa đổi và bao dung tha thứ.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước sự chỉ trích, phán xét gay gắt. Người quân tử coi lời chỉ trích như một tấm gương soi. Im lặng tiếp thu, tự sửa đổi nếu mình sai, và bao dung tha thứ nếu đối phương hiểu nhầm, không cần ra sức biện minh. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 11,
    concept: "Im lặng khi thành công (Khiêm cung giữ mình)",
    app: "Bông lúa chín là bông lúa cúi đầu, không khoe khoang phú quý danh vọng.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng khi gặt hái thành công lớn. Bông lúa chín là bông lúa cúi đầu. Giữ thái độ khiêm cung, im lặng tận hưởng vinh quang, không kiêu ngạo khoe khoang chính là cách bảo toàn phúc đức và tránh khỏi lòng đố kỵ của người đời. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 12,
    concept: "Im lặng trước nỗi đau, nghịch cảnh",
    app: "Không than vãn oán trách trời đất, âm thầm tích lũy sức mạnh để vươn lên.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước những nỗi đau khổ và mất mát của cuộc đời. Không oán trời trách đất, không than vãn thở dài. Chấp nhận nghịch cảnh trong tĩnh lặng và bình thản tích lũy nội lực để vươn lên mạnh mẽ. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 13,
    concept: "Im lặng trước khuyết điểm của người khác",
    app: "Bao dung khuyết điểm của đồng nghiệp, nhắc nhở khéo léo chốn riêng tư.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước khuyết điểm, vụng về của người khác. Bao dung che chở lỗi lầm của người đời, tránh vạch trần hay chê bai trước đám đông. Im lặng tôn trọng và dùng hành động khéo léo để hỗ trợ họ cải thiện. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 14,
    concept: "Im lặng trước cám dỗ danh lợi",
    app: "Giữ vững nhân cách đạo đức, không bị lay động trước phồn hoa hư ảo.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước những cám dỗ danh lợi, sắc dục. Giữ vững định lực, tâm không dao động trước những phồn hoa hư ảo nhất thời chính là cốt cách thanh tao của bậc chí sĩ bản lĩnh. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 15,
    concept: "Im lặng khi làm việc thiện (Thi ân bất cầu báo)",
    app: "Giúp đỡ người khác một cách âm thầm, không phô trương kể công.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng khi làm việc thiện, giúp đỡ người khác (thi ân bất cầu báo). Thi ân không cần ghi nhớ, không cần phô trương kể công. Sự im lặng thiện tâm ấy tích tụ phúc báo sâu dày nhất cho bản thân và con cháu. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 16,
    concept: "Im lặng trước kẻ bướng bỉnh, ngu muội (Tránh lãng phí lời nói)",
    app: "Không tranh luận với người không chịu mở lòng tiếp thu bài học.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng trước kẻ ngu muội, ngang bướng không chịu tiếp thu. Cổ nhân dạy không thể đàm đạo về băng tuyết với côn trùng mùa hè. Im lặng để giữ hòa khí và không lãng phí lời nói, thời gian quý báu. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  },
  {
    part: 17,
    concept: "Im lặng khi đối diện ly biệt",
    app: "Bình thản đón nhận ly tan, tiễn biệt bằng sự tĩnh lặng trân trọng và bao dung.",
    content: "Nội dung từ bài giảng YouTube \"Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói\": Im lặng lúc chia ly hoặc khi đối diện tử biệt. Tĩnh lặng tôn nghiêm, trân quý mọi mối nhân duyên trong đời. Tiễn biệt người đi bằng tâm thái bình an, nhẹ nhàng buông xả để vạn sự tùy duyên. Xem trực tiếp tại: https://www.youtube.com/watch?v=F_fP45zQ9kU"
  }
];

async function seed() {
  console.log("🧹 Đang dọn dẹp các bản ghi cổ nhân dạy cũ trong VectorDocument...");
  await db.delete(vectorDocument).where(like(vectorDocument.category, "YOUTUBE_imlang_%"));

  console.log("🌱 Đang gieo mầm tri thức Cổ Nhân Dạy (Phần 4 - 17)...");
  
  const records = ANCIENT_WISDOM_DATA.map((item) => ({
    id: uuidv4(),
    category: `YOUTUBE_imlang_p${item.part}`,
    title: `[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần ${item.part})`,
    subtitle: "https://www.youtube.com/watch?v=F_fP45zQ9kU",
    content: item.content,
    metadata: {
      Core_Concept: item.concept,
      Application: item.app,
      id: `yt_imlang_p${item.part}`,
      title: `[Trí tuệ Nhân sinh] Cổ Nhân Dạy: 5 Lần Im Lặng Đúng Lúc Đáng Giá Hơn Ngàn Lời Nói (Phần ${item.part})`,
      definition: item.content,
      explanation: "",
      application: item.app,
      tags: ["co nhan day", "tri tue nhan sinh", "im lang", "philosophy"]
    }
  }));

  await db.insert(vectorDocument).values(records);
  console.log(`🎉 Hoàn tất gieo mầm thành công ${records.length} bài học Cổ Nhân Dạy vào Não bộ RAG!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Lỗi seeder:", err);
  process.exit(1);
});
