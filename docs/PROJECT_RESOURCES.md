# 📊 BẢN KIỂM KÊ TÀI NGUYÊN DỰ ÁN (PROJECT RESOURCES INVENTORY)
*Dự án: **Rotta / Rottra** - Sàn Thương mại Nông sản Cao cấp & Hệ thống AI Agent thông minh*

Tài liệu này tổng hợp toàn bộ tài nguyên công nghệ, kiến trúc thư mục, cơ sở dữ liệu và các khả năng cốt lõi (capabilities) hiện có của dự án. 

---

## 🛠️ 1. CÔNG NGHỆ CỐT LÕI (TECH STACK & CORE SYSTEM)

### 💻 Môi trường & Runtime
- **Runtime Engine:** `Bun` (Blazing fast JavaScript runtime).
- **Bundler & Dev Server:** `Vite 7.3.2` + `@hono/vite-dev-server` (Hot Module Replacement siêu tốc).
- **Ngôn ngữ:** `TypeScript` (Strict-mode type-safety).

### 🖥️ Frontend Stack (SolidJS Reactive Ecosystem)
- **Framework:** `SolidJS 1.9.13` (Được cấu hình thông qua `@tsrx/solid` & `@tsrx/vite-plugin-solid`).
- **Routing:** `@solidjs/router` (Hỗ trợ định tuyến Single Page App).
- **Styling:** `TailwindCSS 4.0` (Biên dịch trực tiếp bằng `@tailwindcss/vite`).
- **Icons:** `solid-heroicons`.
- **Dynamic HTML State:** `hyperframes` (Công nghệ quản lý trạng thái động kiểu Livewire/Hotwire).

### 🗄️ Database & ORM Layer (Local-First Architecture)
- **Database Engine:** `PostgreSQL` (connected via standard connection string, managed by Drizzle ORM).
- **ORM Tool:** `drizzle-orm 0.45.2` (Type-safe SQL queries builder).
- **Migration & Kit:** `drizzle-kit 0.31.10` (Đẩy schema tự động thông qua `bunx drizzle-kit push`).
- **Authentication:** `better-auth 1.6.11` (Bảo mật tài khoản, quản lý session và phân quyền `role` tự động).

---

## 🤖 2. CÁC NĂNG LỰC ĐẶC BIỆT CỦA AI AGENT (AI & HEURISTICS CAPABILITIES)

Dự án sở hữu một hệ thống Agent cực kỳ mạnh mẽ tích hợp sẵn trong backend Hono:

1.  **Bộ máy NLP Engine (Natural Language Processing):**
    - Sử dụng `node-nlp` để nhận diện ý định (intent) và mẫu câu (utterance) tiếng Việt của người dùng.
    - Học động dữ liệu từ bảng CSDL `AgentTraining` giúp người dùng tự huấn luyện Agent tùy chỉnh.

2.  **Các lĩnh vực tri thức đã được huấn luyện sẵn (Pre-trained Domains):
    - 📊 **Thống kê chuyên sâu (STATISTICS):** Tích hợp công thức tính kỳ vọng, phương sai, covariance, moment, phân phối xác suất liên tục/rời rạc, lai giống lúa F1, thuật toán lọc Kalman khử nhiễu cảm biến, chỉ số Shannon đa dạng sinh học và mô hình cung cầu mạng nhện nông sản.
    - 🔮 **Dự báo chuỗi thời gian & Tối ưu (FORECAST):** Tích hợp mô hình ARIMA/AR/MA dự đoán sản lượng, chuỗi thời gian mùa vụ nông nghiệp và phát hiện lỗi sản phẩm.
    - 📋 **Quản lý nghiên cứu & Dự án khoa học (MANAGEMENT):** Tích hợp biểu đồ Gantt chart, bảng Trello, Jira, số tay điện tử ELN (Electronic Lab Notebook) và LabArchives.
    - 🎓 **Giải bài toán Học thuật & Giáo sư (ACADEMIC):** Tự động giải các bài toán toán rời rạc, lý thuyết đồ thị, tổ hợp, chỉnh hợp và các bài tập khoa học nông nghiệp kinh điển. Tích hợp phương pháp luận sư phạm Rottra (Rottra Case Method, Socratic Questioning, Active Learning) giúp tiểu thương chợ địa phương dễ dàng tiếp thu.
    - 🧪 **Nghiên cứu khoa học thực chứng (RESEARCH):** Tích hợp phương pháp thiết kế thực nghiệm khoa học, thiết lập và kiểm định giả thuyết thống kê ($H_0$), phân tích tương quan và hồi quy định lượng đánh giá tác động công nghệ đối với năng suất chợ truyền thống.
    - 🤖 **Vận hành tự chủ & Suy luận (REASONING):** Hỗ trợ lập luận logic (Reasoning) và quy trình làm việc tự động (Agentic Workflow).
    - 🔍 **Tra cứu Internet (WEB_SEARCH):** DuckDuckScrape để tìm kiếm thời gian thực trên mạng.
    - 📈 **Phân tích chiến lược & Doanh thu (ANALYZE_MARKET):** Tư vấn chiến lược kinh doanh, doanh thu và mặt hàng tối ưu.

3.  **Khung đào tạo Toán tối ưu & Giao thông Logistics (Định hướng mở rộng):**
    - 🚛 **Tối ưu hóa tuyến đường giao nhận (Routing / TSP):** Giải quyết bài toán Người giao hàng (Traveling Salesperson Problem) gom nông sản từ các nông trại (`Farm`) về kho.
    - 🚦 **Phân luồng dòng chảy giao thông (Max-Flow Min-Cut):** Tránh tắc nghẽn luồng vận tải nông sản khi vào mùa thu hoạch cao điểm.
    - 🗺️ **Mô hình hóa mạng lưới (Graph Network):** Tích hợp Leaflet Map để vẽ đồ thị vật lý thực tế các tuyến đường và nút giao thông.

5.  **Mô hình Toán học Chuyển đổi số cao (Level 5 - Autonomous Optimization):**
    *   **Vận trù học & Logistics (Harvard SEAS):**
        *   *Tối ưu tuyến đường thu gom (TSP MTZ Constraints):*
            $$\min \sum_{i=1}^n \sum_{j=1}^n d(i, j) x_{i, j}$$
            $$\text{s.t. } u_i - u_j + n x_{i, j} \le n - 1 \quad \forall 2 \le i \neq j \le n$$
        *   *Phân luồng dòng chảy giao thông đô thị (Wardrop User Equilibrium):*
            $$\min \sum_{a \in A} \int_{0}^{x_a} t_a(w) dw$$
    *   **Kinh tế lượng & Thống kê Thử nghiệm (Harvard Economics & Kennedy School):**
        *   *Mô hình tác động chính sách và công nghệ (Econometric Regression):*
            $$Y_{ijt} = \beta_0 + \beta_1 \text{SmartTech}_{ij} + \gamma X_{ijt} + \epsilon_{ijt}$$
        *   *Định giá trị ròng hạ tầng (NPV CBA):*
            $$NPV = \sum_{t=0}^N \frac{B_t - C_t}{(1 + r)^t}$$
        *   *Cân bằng giá thị trường nông sản động (Cobweb Supply-Demand Model):*
            $$P(t) = (P(0) - P^*) \left( -\frac{d}{b} \right)^t + P^*$$
    *   **Điều khiển ngẫu nhiên & Sinh thái Nông trại:**
        *   *Ước lượng cảm biến khử nhiễu (Kalman Filter):*
            $$\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k (z_k - H \hat{x}_{k|k-1})$$
        *   *Chỉ số đa dạng sinh học đất (Shannon Index):*
            $$H' = -\sum_{i=1}^S p_i \ln p_i$$

6.  **Local LLM & Web Scraping (Môi trường hỗ trợ):**
    - Tích hợp `node-llama-cpp 3.18.1` để chạy mô hình ngôn ngữ lớn (LLM) cục bộ không cần API Key bên ngoài.
    - **Mô hình Active:** `Rottra 1B Q4_K_M.gguf`tại thư mục `models/` với dung lượng 688.1 MB +22.4 MB ` tại thư mục models).
    - Tích hợp `puppeteer` để tự động hóa trình duyệt/Scraping.
    Trạm đạo tạo ai Kaggle : https://www.kaggle.com/code/tvng19/notebookc075e09077/edit?modelId=689368
---

## 📁 3. BẢN ĐỒ CẤU TRÚC THƯ MỤC DỰ ÁN (DIRECTORY GRAPH)

```text
rottra/
├── skills/                     # Bộ nhớ kỹ năng (skills) của các AI agent hỗ trợ phát triển
├── scripts/                    # Các kịch bản phụ trợ, tiện ích và công cụ kiểm định của dự án
├── certs/                      # Chứng chỉ bảo mật (cert.pem, key.pem) phục vụ giao thức HTTPS/WSS
├── drizzle/                    # File lịch sử schema và các bản di cư (migrations) của Drizzle
├── models/                     # Thư mục lưu trữ tệp tin mô hình AI cục bộ (.gguf) chạy offline
├── pg_data/                    # Thư mục lưu trữ tệp nhị phân của cơ sở dữ liệu PGLite (Active DB)
├── pg_data_corrupted_2/        # [Sao lưu an toàn] Bản lưu trữ cơ sở dữ liệu cũ bị hỏng
├── public/                     # Tài nguyên tĩnh công cộng (images, icons)
│   └── uploads/                # Nơi lưu trữ tệp tin người dùng tải lên (Deduplicated MD5)
├── rotta-marketing-studio/     # Phân hệ nhỏ: Bộ công cụ tạo chiến dịch tiếp thị (Marketing Studio)
├── video_ads/                  # Phân hệ nhỏ: Hệ thống kết xuất/hiển thị video quảng cáo nông sản
├── src/                        # THƯ MỤC MÃ NGUỒN CHÍNH
│   ├── components/             # Các linh kiện giao diện SolidJS tái sử dụng
│   ├── config/                 # Cấu hình máy chủ (Ví dụ: ws_server.ts chạy WebSocket Signaling)
│   ├── context/                # Quản lý trạng thái chia sẻ (Reactive Context Providers)
│   ├── db/                     # Khởi tạo kết nối PGLite và định nghĩa bảng CSDL (schema.ts)
│   ├── hooks/                  # Các Reactive Hooks tùy biến của SolidJS
│   ├── layout/                 # Khung giao diện toàn cục (Header, Sidebar, Sidebar hành chính)
│   ├── lib/                    # Cấu hình Better-Auth, lớp xử lý Logic và tri thức Agent
│   ├── middleware/             # Bộ lọc API (Auth middleware)
│   ├── routes/                 # Định tuyến trang UI và các đầu cuối API backend (Hono routes)
│   │   └── api/                # API Hono chính (rpc.ts, agent.ts, [...paths].ts)
│   ├── service/                # Lớp xử lý dịch vụ logic nghiệp vụ
│   ├── utils/                  # Hàm tiện ích dùng chung
│   ├── index.css               # Điểm khởi đầu của hệ thống TailwindCSS 4.0
│   └── root.tsrx               # Cấu trúc bố cục gốc và thiết lập định tuyến toàn ứng dụng
├── package.json                # Khai báo thư viện phụ thuộc và các câu lệnh chạy dự án
├── tsconfig.json               # Cấu hình trình biên dịch TypeScript
├── drizzle.config.ts           # Cấu hình Drizzle ORM kết nối tới hệ quản trị PostgreSQL
└── vite.config.ts              # Cấu hình đóng gói ứng dụng bằng Vite
```

---

## ⚡ 4. CÁC TIẾN TRÌNH VẬN HÀNH (RUNNING SCRIPTS)

Được cấu hình trong `package.json`:

*   **`bun run dev`:** Lệnh chạy môi trường phát triển chính. Tự động:
    1. Quét dọn cổng `8080` đang chạy dở.
    2. Dọn dẹp PID khóa của database cũ (`postmaster.pid`).
    3. Khởi chạy máy chủ truyền tin **WebRTC Signaling Server** tại cổng `8080` (chạy bảo mật WSS).
    4. Khởi chạy máy chủ phát triển **Vite dev** tại cổng `5173`.
*   **`bun run build`:** Đóng gói toàn bộ ứng dụng sang mã sản xuất tối ưu (Vite Production Build).
*   **`bun run format`:** Tự động định dạng mã nguồn trong `src` theo quy chuẩn Prettier.
*   **`bun run master_seed.ts`:** Khởi tạo tài khoản quản trị mặc định (`admin@test.com`/`password`) và tài khoản thử nghiệm.
*   **`bun run force-migrate.ts`:** Ép buộc tạo bảng tùy chỉnh `StrategyPreset` trong PGLite database.
