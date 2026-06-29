# Rottra

Premium Agricultural E-commerce Platform with Intelligent Autonomous AI Agent System.

## Tech Stack

- **Runtime:** Bun 1.3.14
- **Frontend:** SolidJS + TailwindCSS 4.0 + Vite 7.3
- **Backend:** Hono (catch-all API proxy)
- **Database:** PostgreSQL (Drizzle ORM) with SQLite fallback
- **AI:** ONNX Runtime, Groq/CocoLink/Gemini LLM, Graph RAG, Vector RAG
- **Custom:** `.tsrx` extension via `@tsrx/vite-plugin-solid`

## Quick Start

```bash
bun install
bun run dev
```

Dev server: `http://127.0.0.1:5173`  
WebSocket signaling: `ws://127.0.0.1:8080`

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev environment (WS on 8080, Vite on 5173) |
| `bun run build` | Production build |
| `bun run format` | Format source files |
| `bun run sync-ai` | Sync AI symbols + run verification |
| `./init.sh` | Full project verification |

## Database

```bash
# Push schema to PostgreSQL
bun x drizzle-kit push

# Seed database
bun run src/db/master_seed.ts
```

## Project Structure

```
src/
├── client/          # SolidJS frontend (views, components, stores, utils)
├── core/            # AI engines (NLP, swarm, RAG, quant, neural-memory)
├── infra/           # Infrastructure (database, network, telemetry)
├── routes/          # Hono API catch-all route
├── server/          # Server logic (auth, API routers, helpers, RPC)
├── shared/          # Shared types, constants, DTOs
└── workers/         # Web Worker background tasks
```

## AI Agents

Rottra runs 12 autonomous AI agents with individual budgets, gold reserves, and employee counts. The agent system includes:

- **Cognitive Swarm** - Multi-agent dispatch with Tree-of-Thoughts reasoning
- **Vector RAG** - Hybrid retrieval with attention fusion
- **Graph RAG** - Knowledge graph with beam search
- **NLP Intent Classifier** - Vietnamese-focused intent classification with Knowledge Distillation
- **Tu Linh Engine** - Four Spirits (Dragon, Unicorn, Turtle, Phoenix) strategy orchestration

## License

Private - Rottra Platform
Đọc full dự án chuẩn trực quan tự nhiên hóa dự án chuẩn hóa logic từ sql đến đầu ra, giao diện
trực quan tự nhiên hóa dự án tận dụng hóa giải chuẩn hóa thanh lọc hóa tích cự hóa loại bỏ khuyết tật của dự án chuẩn logic từ sql đến đầu ra, giao diện từ a đến z
muốn biết chi tiết phải
Nhược điểm chính:
1. String có biến — t("Đã thêm ${item.name} vào giỏ!") không pre-translate được vì item.name là dynamic. JSON chỉ lưu template, không lưu câu hoàn chỉnh.
2. Build time tăng — extract + translate 200 strings × 6 ngôn ngữ = thêm ~2-3 phút mỗi lần build.
3. MarianMT translation quality — automated dịch UI strings có thể sai thuật ngữ, sai ngữ cảnh.
4. Bundle size — 6 JSON files ~50-100KB thêm vào bundle.
5. Stale — thêm string mới mà không rebuild → hiện tiếng Việt.
Kết luận: Phù hợp cho static UI labels (button, title, placeholder). Dynamic content (notification, AI response) vẫn cần t() + localStorage cache.
Bạn muốn implement hay giữ cách hiện tại (localStorage cache + dynamic translation)?
▣  Plan · MiMo Auto (MiMo-V2.5, limited-time free) · 18.5s
+ Thought: 73ms
# Questions
Bạn muốn怎么做?
Cách nào nhẹ nhất 2026
+ Thought: 130ms
Cách hiện tại đã là nhẹ nhất 2026:
- localStorage: ~200KB, instant, offline
- ONNX server-side: models load 1 lần vào RAM server
- Dynamic translation: batch + debounce 100ms
- Pre-cache script: download UI strings 1 lần khi online
Không cần thêm gì. JSON bundles thêm build step + bundle size.  Browser WASM models thêm 300MB download. Cả hai đều nặng hơn cách hiện tại.
# task abandon T1
+ Thought: 2.3s
T1 abandoned. Cách hiện tại đã optimal.
Tổng kết session:
- 13GB → 5.1GB (dọn rác)
- 10 ONNX models local (zero network cho 6 ngôn ngữ)
- Multilingual keyword classifier (6 ngôn ngữ, 9 intents)
- localStorage cache + pre-cache script (offline UI)
- ExchangeRate-API v6 cho 6 tiền
- Puppeteer fix (timeout + retry)
Dynamic Spintax
Domain	Số pairs	Đánh giá
. Thêm ~30 pairs hội thoại thực tế (hỏi giá, hỏi hàng, follow-up, cảm thán)
2. Mở rộng priorityPhrases với ~25 keyword mới
3. Fix fallback trong handleChatExpert
domain  fuzzy
Visual codes (QR, barcode)
Wireless (RFID, NFC, BLE)
Biometrics
AI recognition (OCR, face, object)
Cryptographic identity (token, signature)
Device identity (IMEI, MAC…)

📊 Có mấy loại thông tin?
🧠 1) Theo dạng dữ liệu (data type)

👉 Cách phổ biến nhất trong CNTT

Thông tin văn bản (Text): chữ, email, tin nhắn
Thông tin số (Numeric): số, tiền, thống kê
Thông tin hình ảnh (Image): ảnh, QR, biểu đồ
Thông tin âm thanh (Audio): giọng nói, nhạc
Thông tin video: phim, camera
Thông tin nhị phân (Binary): file, dữ liệu máy
🧾 2) Theo mức độ xử lý
Dữ liệu thô (Raw data): chưa xử lý
Dữ liệu thông minh (Smart data): dữ liệu có khả năng tự học hỏi và cải thiện
Dữ liệu đa phương tiện (Multimedia data): dữ liệu kết hợp nhiều phương tiện khác nhau
Dữ liệu lai ghép (Hybrid data): dữ liệu kết hợp nhiều phương tiện khác nhau nhưng có cấu trúc
Dữ liệu phân tán (Distributed data): dữ liệu được lưu trữ ở nhiều nơi khác nhau
Dữ liệu đa luồng (Multithread data): dữ liệu được xử lý đồng thời bởi nhiều luồng
Dữ liệu sạch (Clean data): dữ liệu đã được làm sạch và xử lý
Dữ liệu bẩn (Dirty data): dữ liệu loại bỏ
Thông tin đã xử lý (Processed information): có ý nghĩa
Tri thức (Knowledge): hiểu và phân tích
Trí tuệ (Wisdom): áp dụng ra quyết định

👉 Mô hình này gọi là DIKW pyramid

🔐 3) Theo tính chất bảo mật
Công khai (Public)
Nội bộ (Internal)
Bí mật (Confidential)
Tuyệt mật (Secret / Top secret)
🧭 4) Theo nguồn gốc
Thông tin sơ cấp: tự thu thập (camera, cảm biến)
Thông tin thứ cấp: từ người khác (báo cáo, internet)
💻 5) Theo cấu trúc dữ liệu
Structured data: bảng SQL, Excel
Semi-structured: JSON, XML
Unstructured data: video, ảnh, text tự do
📌 Kết luận dễ hiểu

👉 Không có “mấy loại cố định”, nhưng thường dùng 5 nhóm lớn:

Theo dạng (text, số, ảnh, video…)
Theo mức xử lý (data → information → knowledge)
Theo bảo mật
Theo nguồn gốc
Theo cấu trúc dữ liệu

📊 Data = số liệu thô
📈 Information = số liệu có nghĩa
🧠 Knowledge = hiểu nguyên nhân
👑 Wisdom = quyết định đúng
1a1a2e
Text Generation
