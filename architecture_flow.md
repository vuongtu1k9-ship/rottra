# Kiến trúc Tổng thể Hệ thống Rottra AI
*(Mô hình Input - Processing - Output)*

Dự án Rottra AI được thiết kế theo kiến trúc **Mạng Nơ-ron Nhận thức (Cognitive Neural Network)** kết hợp với **Swarm Intelligence (Trí tuệ bầy đàn)**. Dưới đây là phân tích toàn diện về luồng dữ liệu của dự án từ lúc đi vào (Input), được xử lý (Middle) cho tới lúc trả về (Output).

---

## 1. ĐẦU VÀO (INPUT)
Đây là các cổng thu thập dữ liệu và tín hiệu từ thế giới bên ngoài vào hệ thống.

* **Tương tác Người dùng (User Inputs):**
  - Lệnh Chat bằng văn bản (Text).
  - Tệp tin tải lên (PDF, Text, Hình ảnh) để phân tích OCR.
  - Các thao tác mua bán, đặt hàng trên giao diện E-commerce.
* **Dữ liệu Thời gian thực (Real-time APIs):**
  - **Tỷ giá Ngoại tệ & Vàng:** Lấy liên tục từ Frankfurter v2 và Vang.today.
  - **Dữ liệu Chứng khoán/Crypto:** Lấy từ Binance, Yahoo Finance.
  - **Định vị Không gian (Geolocation):** Lấy IP và quốc gia qua GeoJS.
* **Bộ nhớ Dữ liệu (Knowledge Ingestion):**
  - Cào dữ liệu từ Website, PDF, hoặc YouTube đưa vào hệ thống RAG (Retrieval-Augmented Generation).

---

## 2. PHẦN GIỮA - XỬ LÝ LÕI (PROCESSING / MIDDLE)
Đây là "Bộ não" cốt lõi của Rottra AI (Nằm chủ yếu trong thư mục `src/core/`). Dữ liệu thô từ Input sẽ được băm nhỏ và xử lý qua các tầng nơ-ron:

### A. Tầng Nhận thức Ngôn ngữ (NLP Cognitive)
- `tokenizer.ts` / `multilingual-tokenizer.ts`: Băm nhỏ văn bản đầu vào thành các Token.
- `nlp-intent-parser.ts`: Phân tích ý định của người dùng (mua hàng, hỏi đáp, hay nhờ vẽ tranh).
- `tensor-recognizer.ts`: Nhận diện hình ảnh và đặc trưng của dữ liệu đa phương tiện.

### B. Tầng Trí nhớ (Neural Memory & RAG)
- `vector-rag.ts` / `semantic-cache.ts`: Biến văn bản thành Vector (Embeddings) để so sánh ngữ nghĩa và tìm kiếm siêu tốc.
- `graph-rag.ts`: Xây dựng Sơ đồ Tri thức (Knowledge Graph) để kết nối các khái niệm rời rạc (Ví dụ: kết nối thông tin "Khách hàng A" với "Sản phẩm B").

### C. Tầng Trí tuệ Bầy đàn (Cognitive Swarm)
Thay vì dùng 1 con AI, Rottra sử dụng một tổ hợp nhiều AI chuyên biệt.
- `swarm-dispatcher.ts`: Đóng vai trò làm "Tổng tư lệnh", chia việc cho các Đặc vụ (Agents) như *Tô Lượng, Thu Nguyệt...*
- `game-theory.ts`: Cân bằng quyết định của các Agent dựa trên Lý thuyết Trò chơi để đưa ra câu trả lời tối ưu nhất.
- `hybrid-ai.ts`: Kết hợp sức mạnh giữa AI Local (Rottra AI tự trồng) và AI Đám mây (Google Gemini) để fallback khi cần.

---

## 3. ĐẦU RA (OUTPUT)
Sau khi "Bộ não" tính toán xong, kết quả sẽ được xuất ra dưới nhiều định dạng khác nhau để phục vụ người dùng.

* **Văn bản & Tri thức (Text & Insights):**
  - Câu trả lời thông minh của Chatbot.
  - Sách ảnh, kịch bản, lời dịch thuật đa ngôn ngữ (chính xác đến từng ngữ cảnh).
* **Đa phương tiện (Media & Audio):**
  - **Hình ảnh:** Tự động gọi API `Evolink` hoặc `Pollinations` để vẽ tranh minh họa.
  - **Âm thanh (TTS):** Chuyển đổi văn bản thành giọng nói tiếng Việt qua Google TTS.
* **Giao dịch & Tự động hóa (Actions):**
  - Tự động thay đổi giá bán sản phẩm (VND sang Vàng/USD) theo thời gian thực mà không cần người can thiệp.
  - Tự động chốt đơn (Orders), cập nhật Giỏ hàng (Cart) và lưu vào Database.

---

> [!TIP]
> **Kết luận:**
> Rottra AI không chỉ là một ứng dụng Web thông thường mà là một **Hệ sinh thái Đa tác tử (Multi-Agent Ecosystem)**. Nó có thể tự thu thập thông tin (Input), tự suy nghĩ và chia việc (Processing), và cuối cùng tự hành động/sáng tạo nội dung (Output) y hệt như một công ty thu nhỏ.
