# Hướng Dẫn Phòng Ngừa Lỗi Mặc Định Cứng & Mất Đồng Bộ Trạng Thái (Default Errors & State Out-of-Sync)

Tài liệu này ghi lại các lỗi mặc định cứng (hardcoded defaults) và mất đồng bộ trạng thái đã xảy ra trong dự án **Rottra** nhằm tránh lặp lại các lỗi tương tự trong tương lai.

---

## 1. Lỗi Nhấp Nháy Số Liệu Khi Khởi Tạo (Default Value Flickering)

### Triệu chứng
Khi tải trang lần đầu tiên (hoặc khi tải lại trang F5), các số liệu như Ngân sách (Budget) hiển thị là `0đ`, tên sản phẩm hiển thị là tên mặc định cũ (ví dụ: `Cảm biến IoT độ ẩm 📡` của Tô Lượng), nhưng chỉ một phần nhỏ giây sau, giao diện đột ngột nhảy sang số liệu đúng từ Database.

### Nguyên nhân
* **Client-side State Initialization:** Khởi tạo dữ liệu ban đầu trên frontend bằng các giá trị tĩnh cứng (như `budget: 0` hoặc các sản phẩm mock).
* **Đồng bộ chậm:** API gọi bất tuần tự (`onMount` fetch) cập nhật dữ liệu sau khi giao diện đã được dựng xong, gây ra trải nghiệm nhấp nháy UI (Flicker).

### Biện pháp Khắc phục & Phòng ngừa
1. **Sử dụng Hằng số Đồng bộ Ground-Truth:** Đối với ngân sách ban đầu, luôn dùng `serverAgentBudgets` từ `~/shared/constants` để làm giá trị khởi tạo trên cả Client (`initialAssets`) và Server.
2. **Sử dụng Dynamic Placeholders:** Nếu sản phẩm được thiết lập động bởi AI Agent, tuyệt đối không dùng sản phẩm cứng làm mặc định. Sử dụng các trạng thái chờ trung tính như `"Đang cập nhật..."`, `quantity: 0`, `price: 0` làm fallback. Điều này thông báo cho người dùng biết dữ liệu đang được đồng bộ thay vì hiển thị thông tin cũ sai lệch.
3. **Áp dụng đồng nhất:** Đồng bộ hóa cấu trúc này ở cả trang Hội nghị (`assembly.tsrx`), trang cá nhân (`profile.tsrx`) và các API endpoints (`[...paths].ts`).

---

## 2. Lỗi Mất Trạng Thái Cấu Hình Động Khi Reload (Dynamic Property Loss on Reload)

### Triệu chứng
Agent tự động đàm phán và thay đổi các thuộc tính động qua thẻ tag (ví dụ: thay đổi thuộc tính `MÀU` của kỹ năng đàm phán). Giao diện đổi màu thành công, nhưng khi F5 lại trang, màu đó bị biến mất và quay về màu mặc định (xám/đỏ/xanh) tương ứng với cấp độ kỹ năng.

### Nguyên nhân
* **Thiếu lưu trữ Database:** Endpoint POST `/api/agent/sync-assets` chỉ cập nhật `budget`, `product`, `quantity`, `price` mà bỏ sót trường động mới (như `color`).
* **Thiếu API trả về:** Endpoint GET `/api/agent/assets` không trả về trường `color` đã lưu trong cột `profile` của bảng `user`.
* **Hardcoded Styling:** Phần hiển thị UI trên client có những logic phân loại cứng theo cấp độ (như `lvl >= 13` thì gán class Rose...) đè lên màu sắc động do Agent lựa chọn.

### Biện pháp Khắc phục & Phòng ngừa
1. **Thiết kế API khép kín (Closed-Loop API Design):** Khi thêm bất kỳ thuộc tính động nào được parse từ LLM, phải kiểm tra 3 điểm đồng bộ:
   * **Parser (Client):** Trích xuất thuộc tính (ví dụ: `color`).
   * **Sync Endpoint (Server):** Lưu thuộc tính vào cột `profile` trong Database.
   * **Fetch Endpoint (Server):** Trả về thuộc tính đó trong payload của `/api/agent/assets` và `/api/profile`.
2. **Tương thích ngược giao diện (Fallback Styling):**
   * Nếu thuộc tính có định dạng CSS/Hex (như `#a259ff`), áp dụng qua `style={{ color: skillColor }}`.
   * Nếu thuộc tính là Tailwind class (như `text-rose-400`), áp dụng qua class/classList để đảm bảo hiển thị đúng ý đồ thiết kế.

---

## 3. Quy chuẩn viết Code bảo trì dài hạn (Coding Standards)

* **Parsing:** Luôn dùng **Declarative Regex with Named Capture Groups** (`(?<groupName>pattern)`) để bóc tách thông tin từ văn bản của LLM. Tránh dùng `split` hoặc `indexOf` thủ công.
* **State Updates:** Sử dụng SolidJS Store kết hợp với `reconcile` để cập nhật trạng thái mịn (fine-grained updates), tránh ghi đè làm mất tính phản ứng của UI.
* **Build Validation:** Luôn chạy lệnh `bun run build` trước khi hoàn tất công việc để chắc chắn các import và kiểu dữ liệu (TypeScript) tương thích 100%.
