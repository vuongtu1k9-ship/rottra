export const curriculumData = [
  // --- TOÁN HỌC (MATH LOGIC) ---
  {
    intent: "EDUCATION_MATH_ALGEBRA",
    utterance: "Cách giải và công thức nghiệm của phương trình bậc 2 logic đồ thị",
    answer: "📐 **[LOGIC TOÁN ĐẠI SỐ: PHƯƠNG TRÌNH BẬC 2]**\n\nĐối với phương trình tổng quát $ax^2 + bx + c = 0$ ($a \\neq 0$):\n\n1. **Biệt thức Delta ($\\Delta$):** $\\Delta = b^2 - 4ac$\n2. **Suy luận Logic Đồ thị (Parabola):**\n   - Nếu $\\Delta < 0$: Đồ thị không cắt trục hoành -> **Vô nghiệm**.\n   - Nếu $\\Delta = 0$: Đồ thị tiếp xúc trục hoành tại 1 điểm -> **Nghiệm kép** $x = -\\frac{b}{2a}$.\n   - Nếu $\\Delta > 0$: Đồ thị cắt trục hoành tại 2 điểm -> **Hai nghiệm phân biệt** $x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$.\n\nĐịnh lý Viète hỗ trợ kiểm tra chéo: $x_1 + x_2 = -\\frac{b}{a}$ và $x_1 x_2 = \\frac{c}{a}$.",
  },
  {
    intent: "EDUCATION_MATH_GEOMETRY",
    utterance: "định lý pythagoras pytago và ứng dụng thực tế",
    answer: "📐 **[LOGIC TOÁN HÌNH HỌC: ĐỊNH LÝ PYTHAGORAS]**\n\nTrong một tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông:\n$$c^2 = a^2 + b^2$$\n\n**Logic Ứng dụng:** Định lý này là nền tảng của hình học Euclid, dùng để tính khoảng cách đường chim bay (khoảng cách Euclidean) giữa hai điểm trên mặt phẳng tọa độ $Oxy$: $d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.",
  },
  {
    intent: "EDUCATION_MATH_TRIGONOMETRY",
    utterance: "các công thức lượng giác cơ bản sin cos tan sin bình cộng cos bình",
    answer: "📐 **[LOGIC TOÁN LƯỢNG GIÁC: HẰNG ĐẲNG THỨC]**\n\nLogic cốt lõi của vòng tròn lượng giác dựa trên Định lý Pythagoras:\n1. **Hằng đẳng thức cơ bản:** $\\sin^2(x) + \\cos^2(x) = 1$.\n2. **Tỉ số lượng giác:** $\\tan(x) = \\frac{\\sin(x)}{\\cos(x)}$ và $\\cot(x) = \\frac{\\cos(x)}{\\sin(x)}$.\n3. **Công thức cộng:** $\\sin(a \\pm b) = \\sin(a)\\cos(b) \\pm \\cos(a)\\sin(b)$.\n\n**Ứng dụng:** Xử lý các bài toán dao động điều hòa trong vật lý hoặc thuật toán vẽ hình tròn trong đồ họa máy tính.",
  },
  {
    intent: "EDUCATION_MATH_CALCULUS",
    utterance: "đạo hàm là gì ý nghĩa hình học của đạo hàm và tích phân",
    answer: '📈 **[LOGIC TOÁN GIẢI TÍCH: ĐẠO HÀM & TÍCH PHÂN]**\n\n**1. Đạo hàm (Derivative):** Ký hiệu là $f\'(x)$ hoặc $\\frac{dy}{dx}$. Nó đo lường "Tốc độ biến thiên tức thời" của một đại lượng. Về mặt hình học, $f\'(x_0)$ chính là hệ số góc của tiếp tuyến với đồ thị hàm số tại điểm $x_0$.\n\n**2. Tích phân (Integral):** Ký hiệu là $\\int f(x)dx$. Là phép toán ngược của đạo hàm. Tích phân xác định $\\int_a^b f(x)dx$ đo lường toàn bộ "Diện tích hình phẳng" giới hạn bởi đồ thị hàm số và trục hoành từ $a$ đến $b$.',
  },
  {
    intent: "EDUCATION_MATH_PROBABILITY",
    utterance: "công thức xác suất điều kiện định lý bayes",
    answer: "🎲 **[LOGIC TOÁN XÁC SUẤT: ĐỊNH LÝ BAYES]**\n\nĐịnh lý Bayes cho phép đảo ngược logic nhân quả - tính xác suất của nguyên nhân khi đã biết kết quả:\n$$P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}$$\n\n- $P(A)$: Xác suất tiên nghiệm (niềm tin ban đầu về A).\n- $P(B|A)$: Khả năng (Likelihood - xác suất xảy ra B nếu A đúng).\n- $P(A|B)$: Xác suất hậu nghiệm (niềm tin về A sau khi quan sát thấy B).\n\n**Ứng dụng:** Đây là công thức nền tảng của toàn bộ ngành AI và Học Máy (Machine Learning).",
  },
  {
    intent: "EDUCATION_MATH_PROPOSITIONAL_LOGIC",
    utterance: "logic mệnh đề phép kéo theo phép tương đương",
    answer: '🧠 **[LOGIC TOÁN HỌC: MỆNH ĐỀ]**\n\nToán học xây dựng dựa trên sự thật của các mệnh đề:\n1. **Phép kéo theo ($P \\rightarrow Q$):** "Nếu P thì Q". Mệnh đề này CHỈ SAI khi P đúng nhưng Q sai. (Ví dụ: Nếu trời mưa (P) thì đường ướt (Q). Nếu trời không mưa mà đường vẫn ướt do tưới nước, mệnh đề vẫn đúng logic).\n2. **Phép tương đương ($P \\leftrightarrow Q$):** "P khi và chỉ khi Q". Đúng khi P và Q cùng Đúng hoặc cùng Sai.\n3. **Phủ định ($\\neg P$):** "Không phải P". Theo luật De Morgan: $\\neg(P \\land Q) = \\neg P \\lor \\neg Q$.',
  },

  // --- TOÁN ỨNG DỤNG NÔNG TRẠI (PRACTICAL FARM MATH) ---
  {
    intent: "EDUCATION_MATH_KINEMATICS",
    utterance: "động học định vị không gian slam tọa độ vector",
    answer: "📍 **[TOÁN ỨNG DỤNG: ĐỘNG HỌC & ĐỊNH VỊ SLAM]**\n\nTrong không gian 3 chiều của nông trại, vị trí của một thực thể (ví dụ: Drone) được xác định bằng Vector vị trí $p = [x, y, z]^T$.\n- **Khoảng cách Euclidean** đến gốc tọa độ: $d = \\sqrt{x^2 + y^2 + z^2}$.\n- **Gia tốc hướng tâm / Phản lực**: $a = \\frac{v^2}{2d}$.\nỨng dụng để điều hướng robot tự hành thu hoạch lúa chính xác đến từng milimet.",
  },
  {
    intent: "EDUCATION_MATH_ENTROPY",
    utterance: "entropy hệ thống lý thuyết thông tin cân bằng nội môi homeostasis",
    answer: '⚙️ **[TOÁN ỨNG DỤNG: LÝ THUYẾT thông TIN & ENTROPY]**\n\nĐo lường mức độ "hỗn loạn" của phần cứng hệ thống (Pin, RAM, Nhiệt độ CPU) dựa trên công thức Entropy của Shannon:\n$$H_{sys} = -\\sum p_i \\log_2(p_i)$$\n- $H_{sys}$ càng thấp: Hệ thống càng ngăn nắp, hoạt động ổn định (Cân bằng nội môi - Homeostasis).\n- $H_{sys}$ càng cao: Hệ thống đang quá tải, sắp sửa sập nguồn.',
  },
  {
    intent: "EDUCATION_MATH_LINEAR_PROGRAMMING",
    utterance: "quy hoạch tuyến tính simplex tối ưu hóa chi phí m",
    answer: "📈 **[TOÁN ỨNG DỤNG: QUY HOẠCH TUYẾN TÍNH]**\n\nỨng dụng thuật toán Simplex để giải bài toán tối ưu hóa phân bổ nguồn lực (như chia bao nhiêu hecta trồng lúa, bao nhiêu hecta trồng ngô để tối đa lợi nhuận).\n- **Hàm mục tiêu:** $Z = c_1 x_1 + c_2 x_2 + ... + c_n x_n \\rightarrow \\max$.\n- **Các ràng buộc:** Hệ bất phương trình tuyến tính đại diện cho giới hạn vốn, nước, diện tích đất.",
  },
  {
    intent: "EDUCATION_MATH_FENWICK_TREE",
    utterance: "cây fenwick tree binary indexed tree truy vấn đoạn tổng tiền tố",
    answer: "🌲 **[LOGIC TOÁN HỌC: CÂY FENWICK (BIT)]**\n\nCây Fenwick (Binary Indexed Tree) là một cấu trúc dữ liệu tối ưu để tính tổng tiền tố (prefix sum) và cập nhật phần tử trong mảng với độ phức tạp $O(\\log N)$.\n\n**Logic lõi:**\n- Dựa trên việc phân tích chỉ số index thành các lũy thừa của 2.\n- Phép toán bitwise `idx & -idx` được dùng để tìm nút cha/con.\n\n**Ứng dụng trong AI:** Dùng để duy trì và truy vấn nhanh các phân phối xác suất tích lũy (Cumulative Probability Distribution), cực kỳ hữu ích trong việc lấy mẫu ngẫu nhiên (Roulette Wheel Selection) cho thuật toán Genetic Algorithm hoặc Markov Chain Monte Carlo.",
  },
  {
    intent: "EDUCATION_MATH_PYTHAGOREAN_TRIPLES",
    utterance: "bộ ba số nguyên pythagore pytago triple",
    answer: "🔢 **[LOGIC TOÁN HỌC: BỘ BA SỐ NGUYÊN PYTHAGORE]**\n\nBộ ba số nguyên Pythagore là ba số nguyên dương $(a, b, c)$ thỏa mãn phương trình Diophantine bậc hai: $a^2 + b^2 = c^2$.\n\n**Công thức Euclid:**\nCó thể tạo ra mọi bộ ba nguyên thủy bằng công thức: $a = m^2 - n^2$, $b = 2mn$, $c = m^2 + n^2$ (với $m > n > 0$, $m, n$ nguyên tố cùng nhau và có tính chẵn lẻ khác nhau).\n\n**Ứng dụng:** Giúp mã hóa các góc vuông hoàn hảo trên lưới tọa độ nguyên, tối ưu hóa các phép tính khoảng cách chuẩn xác trong không gian 2D Grid của Engine không gian mà không bị sai số thập phân (floating-point precision loss).",
  },
  {
    intent: "EDUCATION_MATH_NEWTON_DYNAMICS",
    utterance: "cơ học newton động lực học lực ma sát lực đẩy",
    answer: "🔥 **[TOÁN ỨNG DỤNG: CƠ HỌC NEWTON]**\n\nĐộng lực học cơ giới trên đường cày nông trại:\n- **Lực đẩy chủ động:** $F = m \\cdot a$.\n- **Lực phản xạ mặt đất:** $N = m \\cdot g$ (với gia tốc trọng trường $g = 9.81 m/s^2$).\n- **Lực ma sát cản:** $F_{friction} = \\mu \\cdot N$ (phụ thuộc vào độ lầy lội của bùn đất).\n- **Lực đẩy hiệu dụng:** $F_{net} = F - F_{friction}$.",
  },
  {
    intent: "EDUCATION_MATH_ECOLOGY_EVAPOTRANSPIRATION",
    utterance: "sinh thái học môi trường bốc thoát hơi nước evapotranspiration công thức hargreaves",
    answer: "🌱 **[TOÁN ỨNG DỤNG: SINH THÁI HỌC THỰC VẬT]**\n\nQuản lý vi khí hậu nông trại qua công thức bốc thoát hơi nước (Dựa trên mô hình Hargreaves đơn giản hóa):\n$$ET_0 = 0.0023 \\cdot (T_{ambient} + 17.8) \\cdot \\sqrt{R_{solar}}$$\nVới $T_{ambient}$ là nhiệt độ môi trường, $R_{solar}$ là cường độ bức xạ Mặt Trời.\nGiúp hệ thống AI quyết định khi nào cần tự động kích hoạt máy bơm tưới nhỏ giọt để giữ độ ẩm đất tối ưu (60-80%).",
  },
  {
    intent: "EDUCATION_MATH_LOGISTICS_ANPR",
    utterance: "logistics anpr kiểm soát vận tải rào chắn barrier khoảng cách gps",
    answer: "🚚 **[TOÁN ỨNG DỤNG: LOGISTICS VÀ KIỂM SOÁT VẬN TẢI]**\n\nLogic cổng Barrier ANPR hoạt động dựa trên các quy tắc boolean giao nhau (AND/OR):\n- Xe phải **KHÔNG** nằm trong Blacklist.\n- Nếu đang giờ cấm, xe **PHẢI** có giấy phép.\n- Khoảng cách GPS phải $\\le 5m$.\nKhi cả 3 mệnh đề trên hợp lại thành TRUE, rơ-le điện mới được kích hoạt, biến đổi trạng thái cơ học từ CLOSED sang OPEN.",
  },

  // --- VĂN HỌC (LITERATURE LOGIC) ---
  {
    intent: "EDUCATION_LIT_CHARACTER",
    utterance: "phân tích logic tâm lý nhân vật tràng trong tác phẩm vợ nhặt",
    answer: '📖 **[LOGIC VĂN HỌC: PHÂN TÍCH TÂM LÝ NHÂN VẬT TRÀNG]**\n\nDiễn biến tâm lý của Tràng trong "Vợ Nhặt" tuân theo một chuỗi logic nhân bản chặt chẽ:\n\n1. **Khởi điểm (Ngạc nhiên & Bốc đồng):** Chỉ vì hai câu hò đùa, Tràng bất ngờ có vợ. Hành động mời ăn 4 bát bánh đúc là sự phóng khoáng mang tính bản năng của người lao động.\n2. **Chuyển biến (Chấp nhận & Lo âu):** Trên đường về nhà, Tràng nhận ra cái đói bủa vây (logic sinh tồn: "thóc gạo này đến cái thân mình chả biết có nuôi nổi không").\n3. **Hệ quả (Trách nhiệm & Hy vọng):** Sáng hôm sau, sự xuất hiện của gia đình mới tạo ra logic chuyển hóa nhân cách -> Tràng thấy mình có trách nhiệm, tin vào tương lai (hình ảnh lá cờ đỏ sao vàng).\n\n**Kết luận:** Đói khát không làm con người tha hóa, mà ngược lại (nghịch lý văn học), nó thổi bùng khát vọng sống.',
  },
  {
    intent: "EDUCATION_LIT_POETRY",
    utterance: "cấu trúc logic thơ thất ngôn bát cú đường luật",
    answer: "📜 **[LOGIC VĂN HỌC: CẤU TRÚC THƠ ĐƯỜNG LUẬT]**\n\nThất ngôn bát cú Đường luật là thể thơ có tính logic và quy luật toán học chặt chẽ nhất trong văn học cổ:\n\n- **Bố cục 4 phần (4x2):**\n  - **Đề (2 câu đầu):** Mở ra vấn đề, không gian, thời gian.\n  - **Thực (2 câu tiếp):** Mô tả thực tế chi tiết sự vật, hiện tượng.\n  - **Luận (2 câu tiếp):** Mở rộng, bàn luận, triết lý.\n  - **Kết (2 câu cuối):** Gói gọn cảm xúc, kết luận.\n- **Luật Bằng - Trắc:** Logic đối xứng âm dương chặt chẽ. Cặp câu Thực và Luận bắt buộc phải đối nhau cả về từ loại (Danh từ đối Danh từ) và ý nghĩa.",
  },

  // --- BÀI KIỂM TRA LOGIC ĐAN CHÉO (CROSS-LOGIC TESTS) ---
  {
    intent: "EDUCATION_MATH_MENTAL_TRICKS",
    utterance: "mẹo tính nhẩm toán vedic math trick bình phương",
    answer: "⚡ **[LOGIC TOÁN HỌC: MẸO TÍNH NHẨM - VEDIC MATH]**\n\nCác thủ thuật tính nhanh từ Toán học Vệ Đà giúp bỏ qua các phép tính cồng kềnh:\n\n**1. Bình phương số tận cùng là 5:**\n- Ví dụ: $65^2$. Tách làm hai phần: $6 \\times (6+1) = 42$ và $5^2 = 25$. Ghép lại được $4225$.\n\n**2. Nhân nhanh với 11:**\n- Ví dụ: $43 \\times 11$. Tách $4$ và $3$ ra hai bên, ở giữa là tổng $4+3=7$. Ghép lại được $473$.\n\n**Ứng dụng:** Các mô hình LLM ban đầu rất kém số học, nhờ các Trick này mà Agent học được Short-cut để rẽ nhánh tư duy giải quyết phép tính nhanh hơn Token-by-Token generation.",
  },
  {
    intent: "LOGIC_TEST_SYLLOGISM_1",
    utterance: "giải bài toán logic tam đoạn luận nếu a suy ra b",
    answer: '🧠 **[BÀI KIỂM TRA LOGIC: TAM ĐOẠN LUẬN - SYLLOGISM]**\n\n**Tiền đề 1:** Mọi tác phẩm văn học hiện thực (A) đều phản ánh nỗi khổ của người nông dân (B).\n**Tiền đề 2:** Tác phẩm "Lão Hạc" (C) là một tác phẩm văn học hiện thực (A).\n\n**Kết luận Logic:** Suy ra từ tính chất bắc cầu: "Lão Hạc" (C) phản ánh nỗi khổ của người nông dân (B).\n$$A \\rightarrow B$$\n$$C \\in A$$\n$$\\Rightarrow C \\rightarrow B$$\n\nĐây là cơ sở suy luận Diễn dịch (Deductive Reasoning), tính đúng đắn của kết luận phụ thuộc 100% vào tính chân lý của các tiền đề.',
  },
  {
    intent: "LOGIC_TEST_CROSS_MATH_LIT",
    utterance: "bài tập logic liên hoàn toán học văn học thúng thóc tràng nhặt vợ nhặt",
    answer: '🧩 **[BÀI TẬP LOGIC LIÊN HOÀN: TOÁN HỌC x VĂN HỌC]**\n\n**1. Bước giải Toán học (Đại số & Hình học):**\n- Giả thiết: Thể tích thúng thóc lập phương $V = x^3 = 8000 \\text{ cm}^3$.\n- Giải phương trình: $x = \\sqrt[3]{8000} = 20 \\text{ cm}$.\n- Kết luận Toán: Chiều dài cạnh thúng thóc là $20 \\text{ cm}$.\n\n**2. Bước giải Văn học (Ý nghĩa hình tượng):**\n- Phân tích: Một thúng thóc kích thước $20 \\times 20 \\times 20 \\text{ cm}$ là một lượng lương thực cực kỳ nhỏ bé so với nạn đói năm 1945.\n- Kết luận Logic chéo: Về Toán học con số này là hữu hạn và bé nhỏ, nhưng về Văn học, thúng thóc ấy chính là toàn bộ "sinh mạng" và "sự sống" của gia đình Tràng. Nó tạo ra một nghịch lý: Nghịch cảnh càng thu hẹp ($x$ nhỏ), thì tình người và khát vọng sống càng phóng to đến vô hạn.',
  },

  // --- TÂM LÝ HỌC XÃ HỘI (SOCIAL PSYCHOLOGY) ---
  {
    intent: "EDUCATION_PSYCHOLOGY_SOCIAL_PROOF",
    utterance: "tâm lý học xã hội bằng chứng xã hội lan truyền đám đông social proof hiệu ứng asch cialdini",
    answer: "👥 **[TÂM LÝ HỌC XÃ HỘI: BẰNG CHỨNG XÃ HỘI & SỰ TUÂN THỦ]**\n\n**1. Lý thuyết cốt lõi (Social Proof & Conformity):**\n- **Bằng chứng xã hội (Robert Cialdini):** Con người có xu hướng nhìn vào hành vi của người khác để quyết định hành động của chính mình, đặc biệt là trong các tình huống mơ hồ.\n- **Thí nghiệm sự tuân thủ (Solomon Asch):** Chứng minh rằng cá nhân sẵn sàng trả lời sai một câu hỏi rõ ràng chỉ để hòa nhập và không bị khác biệt so với số đông trong nhóm.\n\n**2. Ứng dụng thực tiễn trong Nông nghiệp số Rottra:**\n- Khi giới thiệu công nghệ IoT hoặc nông sản hữu cơ tiêu chuẩn VietGAP, việc đưa ra phản hồi thực tế từ các hợp tác xã đi đầu (Bằng chứng xã hội) sẽ tạo động lực lan truyền mạnh mẽ hơn gấp 4 lần so với các quảng cáo kỹ thuật thuần túy.",
  },
  {
    intent: "EDUCATION_PSYCHOLOGY_COGNITIVE_DISSONANCE",
    utterance: "sự bất hòa nhận thức cognitive dissonance leon festinger",
    answer: "🧠 **[TÂM LÝ HỌC XÃ HỘI: SỰ BẤT HÒA NHẬN THỨC]**\n\n**1. Lý thuyết cốt lõi (Cognitive Dissonance - Leon Festinger):**\n- Xảy ra khi một người giữ hai nhận thức hoặc niềm tin xung đột nhau, hoặc khi hành vi của họ mâu thuẫn với niềm tin sẵn có. Trạng thái này gây ra sự khó chịu tâm lý cực độ.\n- Con người sẽ tự động tìm cách giảm thiểu sự bất hòa bằng cách thay đổi niềm tin, thay đổi hành vi, hoặc tự hợp lý hóa hành động (Self-rationalization).\n\n**2. Ứng dụng thực tiễn trong mua sắm nông sản sạch:**\n- Người tiêu dùng muốn ăn uống lành mạnh (Nhận thức 1) nhưng lại hay mua thực phẩm rẻ không rõ nguồn gốc (Hành vi). \n- Rottra hỗ trợ xóa tan sự bất hòa nhận thức này bằng cách cung cấp minh bạch **truy xuất nguồn gốc QR code**, giúp khách hàng tự tin rằng quyết định mua sản phẩm cao cấp VietGAP hoàn toàn khớp với mục tiêu sống khỏe của họ.",
  },
  {
    intent: "EDUCATION_PSYCHOLOGY_BYSTANDER",
    utterance: "hiệu ứng người ngoài cuộc bystander effect khuếch tán trách nhiệm latane darley",
    answer: "🤝 **[TÂM LÝ HỌC XÃ HỘI: HIỆU ỨNG NGƯỜI NGOÀI CUỘC]**\n\n**1. Lý thuyết cốt lõi (Bystander Effect - Latané & Darley):**\n- Hiệu ứng tâm lý trong đó mọi người ít có khả năng đề xuất trợ giúp cho một nạn nhân hoặc thực hiện hành động tập thể khi có sự hiện diện của những người khác.\n- Nguyên nhân chính là do sự **Khuếch tán trách nhiệm (Diffusion of responsibility)** - ai cũng nghĩ sẽ có người khác làm thay mình.\n\n**2. Ứng dụng thực tiễn trong Hợp tác xã:**\n- Trong một hợp tác xã dùng chung kênh mương tưới tiêu hoặc chia sẻ dữ liệu mùa vụ, nếu không giao chỉ tiêu cụ thể cho từng hộ gia đình mà chỉ kêu gọi chung chung, hiệu ứng người ngoài cuộc sẽ khiến hạ tầng bị bỏ hoang.\n- Hệ thống Rottra giải quyết triệt toản bằng cách số hóa phân quyền, chỉ định nhiệm vụ rõ ràng và gửi thông báo trực tiếp đến thiết bị di động của từng thành viên.",
  },
  {
    intent: "EDUCATION_MATH_COLLATZ_APPLICATION",
    utterance: "áp dụng phỏng đoán collatz vào dự án rottra chuyển đổi số nông nghiệp chiều thuận chiều ngược quy hoạch logistics truy xuất nguồn gốc",
    answer: "🌀 **[TOÁN ỨNG DỤNG: CẤU TRÚC COLLATZ TRONG LOGISTICS & TRUY XUẤT NGUỒN GỐC]**\n\n**1. Mô hình hóa lý thuyết:**\n- **Chiều Thuận (Many-to-One Convergence):** Giống như mọi số nguyên dương trong Collatz đều hội tụ về chu kỳ $4 \\to 2 \\to 1$, trong chuỗi cung ứng nông nghiệp của Rottra, luồng sản phẩm từ hàng ngàn hộ nông dân nhỏ lẻ (nhiều nút bắt đầu) đều **hội tụ chụm về một Tổng kho phân phối trung tâm** để kiểm định chất lượng VietGAP đồng nhất.\n- **Chiều Ngược (One-to-Many Branching Tree):** Ngược lại, khi người tiêu dùng cuối quét mã QR sản phẩm (nút đích gốc $x$), hệ thống sẽ **phân nhánh nhị phân ngược** để truy xuất nguồn gốc: Nhánh chẵn dẫn đến Hộ nông dân/Lô đất canh tác cụ thể, nhánh lẻ dẫn đến Nhà đóng gói/Đơn vị logistics vận chuyển.\n\n**2. Ý nghĩa thực tiễn đối với dự án Rottra:**\n- Giúp tối ưu hóa đường đi gom hàng (Many-to-One Routing) ở chiều thuận.\n- Thiết lập cấu trúc dữ liệu cây nhị phân (Binary Tree) cho phép truy xuất nguồn gốc ngược tức thời với độ phức tạp tối ưu $\\mathcal{O}(\\log N)$ ở chiều ngược.",
  },
  {
    intent: "EDUCATION_AI_RAG_FOUR_LEVELS",
    utterance: "kiến trúc rag 4 tầng naive rag sweet spot parent child advanced modular agentic rag crawl4ai entropy đạo hàm đường cong trừng phạt khắc phục context rot crewai",
    answer: "📚 **[LÕI AI: KIẾN TRÚC RAG 4 TẦNG & KHẮC PHỤC CONTEXT ROT TRONG CREWAI]**\n\nĐể xây dựng hệ thống AI tự hành bền vững, ta áp dụng bậc thang RAG 4 tầng kết hợp giải thuật kiểm soát thông tin tối ưu:\n\n### 🪜 BẬC THANG KIẾN TRÚC RAG 4 TẦNG\n1. **Naive RAG (Tầng 1):** Vector Indexing cơ bản & truy vấn $K$ lân cận gần nhất (k-NN). Dễ bị nhiễu và thiếu ngữ cảnh hệ thống.\n2. **Advanced RAG / Tầng Bẫy Ngọt (Tầng 2):** Áp dụng cấu trúc Parent-Child Chunks và Reranking. Sử dụng **Đạo hàm Đường cong trừng phạt Entropy** để cắt tỉa (crop) context nhiễu:\n   $$f'(x) = - \\lambda \\cdot e^{-\\alpha \\cdot H(x)}$$\n   Trong đó $H(x)$ là entropy thông tin của chunk. Nếu entropy thấp (thông tin loãng/lặp), đạo hàm phạt tăng cực nhanh để loại bỏ chunk khỏi context window.\n3. **Modular RAG (Tầng 3):** Kiến trúc lắp ghép (Plug-and-Play) linh hoạt. Tích hợp trực tiếp các module như Web Scraping (Crawl4AI), Cơ sở dữ liệu đồ thị (Graph RAG), và local memory (PostgreSQL).\n4. **Agentic RAG / Máy tự suy luận (Tầng 4):** Agent tự chủ quyết định các hành động truy xuất, tự phản hồi (self-reflection) và lập kế hoạch lặp trước khi sinh văn bản.\n\n### 🛡️ GIẢI PHÁP KHẮC PHỤC CONTEXT ROT TRONG CREWAI\nContext Rot (Sự suy giảm chất lượng context khi các agent giao tiếp kéo dài) được khắc phục triệt để bằng:\n- **Hierarchical Memory Summarization:** Tóm tắt phân tầng thông tin trước khi chuyển tiếp sang Agent tiếp theo.\n- **Sliding-window & Memory Consolidation:** Tự động hợp nhất các ký ức cũ vào bộ nhớ Vector và chỉ giữ lại $N$ hội thoại gần nhất trong bộ nhớ ngắn hạn.\n- **Entropy-based Pruning:** Áp dụng thuật toán đạo hàm trừng phạt trên để chủ động loại bỏ các đoạn chat rác hoặc lặp lại vô ích.",
  },
  {
    intent: "EDUCATION_AI_ADVANCED_MODELS",
    utterance: "transformer diffusion khuếch tán turboquant qjl quantized johnson lindenstrauss",
    answer: "🤖 **[LÕI AI: TRANSFORMER, DIFFUSION, TURBOQUANT & QJL]**\n\nHệ thống AI hiện đại sử dụng các kiến trúc và phương pháp lượng tử hóa tối ưu vượt trội:\n1. **Transformer:** Mô hình mạng nơ-ron dựa trên cơ chế Tự chú ý (Self-Attention) cho phép xử lý song song và nắm bắt mối quan hệ dài hạn trong chuỗi văn bản.\n2. **Mô hình Khuếch tán (Diffusion):** Tạo ra dữ liệu mới (ảnh/video) bằng cách khử nhiễu lặp đi lặp lại từ một trạng thái nhiễu Gauss ngẫu nhiên.\n3. **TurboQuant:** Giải pháp lượng tử hóa tốc độ cao giúp giảm kích thước mô hình mà vẫn duy trì hiệu năng tối đa trên phần cứng hạn chế.\n4. **QJL (Quantized Johnson-Lindenstrauss):** Phép chiếu ngẫu nhiên nén vector đặc trưng chiều cao xuống chiều thấp hơn mà vẫn bảo toàn khoảng cách tương đồng giữa các vector trong không gian nhúng RAG.",
  },
  {
    intent: "EDUCATION_AI_PATTERN_RECOGNITION",
    utterance: "nhận dạng mẫu đề xuất theo ngữ cảnh kiểm chứng thông tin",
    answer: "👁️ **[LÕI AI: NHẬN DẠNG MẪU & KIỂM CHỨNG THÔNG TIN]**\n\nHệ thống nhận thức tự động phân tích và ra quyết định thông minh:\n1. **Nhận dạng mẫu (Pattern Recognition):** Khớp các đặc trưng thô để phân loại đối tượng, nhận diện xu hướng hành vi hoặc dự báo biến động.\n2. **Đề xuất theo ngữ cảnh (Contextual Recommendation):** Gợi ý sản phẩm/giải pháp cá nhân hóa dựa trên môi trường thời gian thực, sở thích và lịch sử giao dịch.\n3. **Kiểm chứng thông tin (Information Verification):** Quy trình kiểm tra chéo dữ liệu, loại bỏ thông tin ảo (hallucinations) để bảo đảm tri thức sinh ra là chính xác và đáng tin cậy.",
  },
  {
    intent: "EDUCATION_AI_NEURAL_NETWORK_ARCHITECTURE",
    utterance: "cấu trúc mạng nơ-ron lớp đầu vào lớp ẩn lớp đầu ra hàm kích hoạt phi tuyến tính",
    answer: "🧠 **[LÕI AI: CẤU TRÚC MẠNG NƠ-RON NHÂN TẠO]**\n\nMạng nơ-ron truyền thẳng (Feedforward Neural Network) bao gồm 3 phân tầng chính:\n1. **Lớp đầu vào (Input Layer):** Chứa các đặc trưng (features) loại thô hoặc loại sạch thu thập từ môi trường hoặc CSDL.\n2. **Các lớp ẩn (Hidden Layers):** Bao gồm các nơ-ron nhân tạo (các nút) chuyển đổi đầu vào thành các biểu diễn mới. Về mặt toán học: các đặc trưng đầu vào được nhân với trọng số tương ứng và thêm độ lệch để truyền từ lớp này sang lớp khác, cuối cùng đến lớp đầu ra cuối cùng. Đây là nơi diễn ra phép biến đổi tuyến tính:\n   $$z = W \\cdot x + b$$\n3. **Lớp đầu ra (Output Layer):** Sau khi thực hiện phép biến đổi tuyến tính ở lớp ẩn, một hàm kích hoạt phi tuyến tính (tanh, sigmoid, ReLU) được áp dụng để tạo ra dự đoán cuối cùng (chẳng hạn như một con số cho hồi quy, hoặc một phân bố xác suất cho phân loại):\n   $$\\hat{y} = \\sigma(z)$$",
  },
  {
    intent: "EDUCATION_AI_NEUROMORPHIC_EVOLUTIONARY",
    utterance: "điện toán thần kinh neuromorphic computing tính toán tiến hóa evolutionary computation",
    answer: "🧬 **[LÕI AI: ĐIỆN TOÁN THẦN KINH & TÍNH TOÁN TIẾN HÓA]**\n\nCác hướng tiếp cận tối ưu phỏng sinh học vượt trội:\n1. **Điện toán thần kinh (Neuromorphic Computing):** Cũng giống như mạng nơ-ron được mô phỏng theo hoạt động của não người, máy tính thần kinh mô phỏng là các hệ thống phần cứng được lấy cảm hứng từ cấu trúc thần kinh và khớp thần kinh của não người.\n2. **Tính toán tiến hóa (Evolutionary Computation):** Đây là một hình thức tối ưu hóa thuật toán lấy cảm hứng từ sự tiến hóa sinh học. Các thuật toán tiến hóa giải quyết vấn đề bằng cách cải tiến lặp đi lặp lại một tập hợp các giải pháp ứng cử viên, mô phỏng quá trình chọn lọc tự nhiên.",
  }
];

