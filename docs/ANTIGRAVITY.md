# Google Antigravity 2.0 - Hướng Dẫn Bắt Đầu (Getting Started)

## 1. Tải Xuống (Download)
Truy cập [antigravity.google/download](https://antigravity.google/download) để tải Google Antigravity 2.0.
* **macOS:** Các phiên bản macOS được Apple hỗ trợ cập nhật bảo mật (thường là phiên bản hiện tại và 2 bản trước đó). Yêu cầu tối thiểu: macOS 12 (Monterey). Kiến trúc X86 không được hỗ trợ.
* **Windows:** Windows 10 (64 bit) trở lên.
* **Linux:** Yêu cầu glibc >= 2.28, glibcxx >= 3.4.25 (ví dụ: Ubuntu 20, Debian 10, Fedora 36, RHEL 8).

## 2. Cài Đặt (Installation)
* Khi cài đặt, nếu hệ thống hỏi "Keep Both" (Giữ Cả Hai) hay "Replace" (Thay Thế) bản cũ, hãy chọn **"Replace"**.
* Hệ thống sẽ hỏi bạn có muốn cài đặt lại IDE trong quá trình này hay không. Nếu bạn bỏ qua, bạn vẫn có thể tải lại sau tại [antigravity.google/download](https://antigravity.google/download).

## 3. Khởi Tạo Dự Án (Creating a Project)
Các Đặc vụ (Agents) hoạt động trong phạm vi Dự án (Projects). Dự án sẽ giới hạn quyền truy cập thư mục và repository.
1. Nhấp vào biểu tượng thư mục có dấu **"+"** ở thanh công cụ bên trái.
2. Nhấp vào **"New Project"**.
3. Nhấp **"Add Folder"** để liên kết một hoặc nhiều thư mục / Git repositories cục bộ. Thêm nhiều thư mục sẽ giúp Agent có được ngữ cảnh chéo (cross-repository) toàn diện.
4. Nhấp **"Create"**.
5. *(Tùy chọn)* Cấu hình cài đặt Dự án. Mỗi Dự án duy trì cài đặt và chính sách bảo mật độc lập mà Agent phải tuân thủ.

## 4. Khởi Chạy Agent (Starting an Agent)
Sau khi Dự án được tạo, bạn có thể gọi Agent để bắt đầu làm việc.
1. Gõ mục tiêu hoặc hướng dẫn vào ô chat (ví dụ: *"Help me add a new feature"*) và nhấn **Enter**.
2. Chọn một **Chế độ (Mode)** trong bảng cài đặt để khởi động Agent:
   - **Local Mode (Chế độ Cục bộ):** Agent hoạt động và chỉnh sửa trực tiếp trên thư mục hiện tại của bạn.
   - **New Worktree Mode (Chế độ Worktree Mới):** Agent hoạt động trong một môi trường Git worktree hoàn toàn độc lập.

---

## 5. Phím Tắt Điều Hướng Cơ Bản (Basic Navigation)
| Hành Động | macOS | Windows / Linux |
| :--- | :--- | :--- |
| **Mở bộ chọn Hội thoại (Conversation Picker)** | `⌘K` | `Ctrl + K` |
| **Mở tìm kiếm Tệp (File Search)** | `⌘P` | `Ctrl + P` |
| **Đưa trỏ chuột vào ô Nhập (Focus Input)** | `⌘L` | `Ctrl + L` |
| **Hội thoại Mới (New Conversation)** | `⌘N` | `Ctrl + N` |
| **Hội thoại Tiếp/Trước (Next/Prev)** | `⌥ Lên / Xuống` | `Alt + Lên / Xuống` |

---

## 6. Lệnh Dấu Gạch Chéo (Slash Commands) & Mẹo
* **Hoàn thành đường dẫn tệp:** Gõ `@` sẽ kích hoạt gợi ý đường dẫn tệp.
* **Xóa hộp thoại nhắc nhở:** Nhấn `Esc` hai lần để đóng/xóa hộp thoại.
* **Chạy lệnh Terminal:** Thêm `!` ở đầu để chạy trực tiếp các lệnh terminal (ví dụ: `!npm install`).
* **Trợ giúp:** Nhập `?` để hiển thị trợ giúp và danh sách lệnh.
* **Giảm nhiễu:** Dùng `/config` để đặt mức độ chi tiết (verbosity) thành mức thấp để giảm bớt log gọi công cụ.
* **Quản lý quyền:** Dùng `/config` hoặc `/permissions` để kiểm soát quyền của Agent.
* `/rewind` hoặc `/undo`: Tua lại lịch sử cuộc trò chuyện.
* `/fork`: Tạo một nhánh (workspace) riêng biệt và tiếp tục cuộc trò chuyện từ một thời điểm trước đó.
* `/clear`: Xóa ngữ cảnh lời nhắc và bắt đầu phiên trò chuyện hoàn toàn mới.
* `/resume`: Liệt kê và tiếp tục các cuộc hội thoại đã đóng trước đó.
* `/goal`: Yêu cầu Agent chạy tự động cho đến khi hoàn thành triệt để tác vụ được giao mà không dừng lại hỏi ý kiến người dùng giữa chừng.
* `/grill-me`: Yêu cầu Agent đặt câu hỏi ngược lại cho bạn để thống nhất và làm rõ các chi tiết trước khi nó bắt tay vào làm việc.
* `/schedule`: Lên lịch chạy một lệnh/tác vụ một lần trong tương lai hoặc lặp lại định kỳ.
* `/browser`: Chỉ định rõ ràng cho phép Agent sử dụng và kiểm soát trình duyệt (dùng cho gỡ lỗi web). Yêu cầu Google Chrome và người dùng phải cấp quyền (permission) để bắt đầu phiên debugging.