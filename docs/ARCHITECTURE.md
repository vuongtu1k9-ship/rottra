# Cấu trúc dự án (Architecture)

Dự án này sử dụng Vite SPA kết hợp với TSRX (Ripple-TS) và SolidJS ở Frontend, cùng với Hono trên nền tảng Bun ở Backend. Cấu trúc thư mục được thiết kế theo tiêu chuẩn để tối ưu hóa khả năng mở rộng, quản lý code và hỗ trợ các tính năng AI Agent tích hợp sẵn.

---

## 📊 Thống kê số lượng file (File Statistics)
*Tổng cộng có **509** file trong dự án (loại trừ thư mục cài đặt thư viện `node_modules`):*

- **`src/`** (Mã nguồn chính): **88** file
- **`dist/`** (Thư mục Build Production): **225** file
- **`public/`** (Tài nguyên tĩnh/Assets): **145** file
- **`video_ads/`** (Video quảng cáo AI sinh ra): **13** file
- **`drizzle/`** (Bản ghi Migration SQL): **5** file
- **`certs/`** (Chứng chỉ SSL HTTPS local): **2** file
- **`.codegraph/`** (Cơ sở dữ liệu chỉ mục mã nguồn): **2** file
- **Các file cấu hình & nhật ký ở thư mục gốc**: **29** file

---

## 📁 `src/` (Mã nguồn chính)
Đây là nơi chứa toàn bộ mã nguồn của ứng dụng.

- **`components/`**
  Chứa các component UI dùng chung (Reusable Components) và hoàn toàn độc lập với dữ liệu (Dumb components). 
  Ví dụ: `cart.tsrx`, `detail.tsrx` (Product Card), Button, Modal.
  Nguyên tắc: Component trong này không nên chứa logic gọi API hay truy xuất Database trực tiếp, mà chỉ nhận dữ liệu thông qua `props`.

- **`config/`**
  Chứa các cấu hình chung của toàn bộ ứng dụng như: cấu hình biến môi trường, thiết lập thông số mặc định, hằng số (constants), URL kết nối API.

- **`context/`**
  Chứa các Global State Management của SolidJS (như `createContext`, `useContext`) để chia sẻ trạng thái giữa các component mà không cần truyền props xuống quá sâu.
  Ví dụ: `AuthContext`, `ThemeContext`.

- **`db/`**
  Chứa schema định nghĩa cơ sở dữ liệu (Drizzle ORM), cấu hình kết nối database, các file migration và file seed dữ liệu mẫu (`seed-lexicon-advanced.ts`, `seed-moods.ts`).

- **`emails/`**
  Chứa các template email (HTML/CSS) để gửi thư tự động tới người dùng (ví dụ: OTP, Hóa đơn, Quên mật khẩu).

- **`hooks/`**
  Chứa các Custom Hooks của SolidJS (các hàm bắt đầu bằng chữ `create...` hoặc `use...`). Giúp đóng gói và tái sử dụng các logic phức tạp liên quan đến State, Lifecycle.

- **`layout/`**
  Chứa các Component dạng "Khung xương" bọc ngoài các trang để tạo thành giao diện thống nhất.
  Ví dụ: `header.tsrx`, `footer.tsrx`, `AdminLayout`, `UserLayout`.

- **`lib/`**
  Chứa các thư viện tự viết, helper chính của ứng dụng và core logic cho AI Agent:
  - `auth-client.ts`: Client cấu hình Better Auth.
  - `cart-store.ts`: Quản lý giỏ hàng của người dùng.
  - `agent/`: Thư mục lõi chứa logic AI Agent (RAG, Graph-RAG, NLP, NLP Trainer, Công cụ AI và mô hình cục bộ).

- **`middleware/`**
  Chứa các đoạn code trung gian chạy trước khi một route hay logic được thực thi (ví dụ: kiểm tra quyền truy cập admin, token authentication).

- **`routes/`**
  Chứa các trang chính (Pages) của ứng dụng. Cấu trúc thư mục này sẽ tương ứng với đường dẫn (URL) trên trình duyệt.
  - **`api/`**: Chứa toàn bộ các Hono API Endpoint ở Backend (`[...paths].ts`, `agent.ts`, `ledger.ts`, `rpc.ts`).
  - **`dashboard/`**: Các tab chức năng trong màn hình quản trị hệ thống (Quản lý User, Quản lý Sản phẩm, Bản đồ, Lịch sử Hoạt động, Cài đặt hệ thống, và các tab phân tích dữ liệu).
  - `profile.tsrx`: Trang thông tin cá nhân.
  - `product.tsrx`: Trang danh sách sản phẩm.
  - `order.tsrx`: Trang quản lý đơn hàng.

- **`service/`**
  Chứa các logic gọi API (Fetch, Axios), tương tác với bên thứ ba (Third-party integrations) hoặc các logic nghiệp vụ phức tạp.

- **`utils/`**
  Chứa các hàm tiện ích (Utility functions) dùng chung trong toàn bộ ứng dụng. 
  Ví dụ: Hàm format tiền tệ (VND), hàm xử lý ngày tháng (Date), validate form.

---

## ⚙️ Các file gốc quan trọng
- `root.tsrx`: Nơi khai báo Router (`<Router>`) và bao bọc toàn bộ App bằng các Layouts và Context Providers.
- `index.tsrx`: Điểm khởi chạy của ứng dụng, gắn Reactivity Root vào DOM (`index.html`).
- `global.d.ts`: Cấu hình kiểu dữ liệu TypeScript toàn cục (Vite Types, SolidJS).

---

## 🗺️ Sơ đồ Giao diện & Tính năng (Menu & Navigation)

### 📌 Header Menu (Menu chính phía trên)
- **Local Market** (`/` hoặc logo): Trang chủ hiển thị danh sách sản phẩm/chợ địa phương.
- **Quản lý web** (`/dashboard`): Trang quản trị hệ thống và kiểm soát.
- **Thông tin tài khoản** (`/profile`): Xem/Cập nhật thông tin cá nhân, thông tin thanh toán VietQR.
- **Đơn hàng** (`/order`): Quản lý đơn đặt hàng của người dùng.
- **Sản phẩm** (`/product`): Danh sách sản phẩm của người dùng và các thao tác thêm/sửa/xóa sản phẩm.
- **Giỏ hàng** (`/cart`): Xem giỏ hàng và tiến hành thanh toán.
- **Thoát**: Đăng xuất tài khoản.
- *Cuộc họp* (`/assembly`): (Tính năng dư thừa/Không thuộc phạm vi logistics nông nghiệp).

### 📊 Sidebar dashboard (Trang quản trị `/dashboard`)
- **Người dùng** (`?tab=manageUsers`): Quản lý tài khoản (cảnh báo, khóa, xóa, thay đổi nhóm người dùng).
- **Sản phẩm** (`?tab=manageProducts`): Quản lý sản phẩm toàn hệ thống.
- **Cài đặt** (`?tab=systemSetting`): Điều chỉnh các tham số hệ thống.
- **Bản đồ** (`?tab=local`): Bản đồ số hiển thị vị trí các vùng nông nghiệp / đại lý (khu vực Hồng Sơn).
- **Hoạt động** (`?tab=activity`): Nhật ký hoạt động chi tiết của hệ thống.
- *Biểu đồ đánh giá AI* (`?tab=heavyChart`), *Sơ đồ kiến trúc* (`?tab=diagram`), *Giáo dục AI* (`?tab=educateAi`): (Các module nghiên cứu AI dư thừa, không thuộc nghiệp vụ cốt lõi của nền tảng logistics nông nghiệp).