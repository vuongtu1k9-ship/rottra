---
name: rottra-agent-skills
description: >-
  Master repository of skills for AI agents in the Rottra codebase.
  Includes CodeGraph querying, HeyGen HyperFrames rendering, Hybrid RAG memory management,
  and Harness Engineering rules.
license: MIT
---

# 🚀 Rottra Master AI Agent Skills

Tài liệu này là **Nguồn Tri Thức Hợp Nhất (Single Source of Truth)** về toàn bộ các quy chuẩn phát triển, công cụ hỗ trợ và kỹ năng vận hành dành cho AI Agent trong dự án **Rottra**. 

Trước khi thực hiện bất kỳ tác vụ nào, Agent **bắt buộc** phải đọc và tuân thủ các chỉ dẫn tương ứng dưới đây.

---

## 🔍 Skill 1: CodeGraph (Code Intelligence & Querying)

Kỹ năng này giúp Agent sử dụng **CodeGraph** để tra cứu mã nguồn, phân tích tác động và vẽ bản đồ phụ thuộc của dự án.

### Các lệnh khả dụng:
Chạy thông qua `bun x codegraph <lệnh>` từ thư mục gốc:
* **Tìm kiếm ký hiệu (Symbols):**
  ```bash
  bun x codegraph query <search_term>
  ```
* **Tìm hàm gọi tới (Callers):**
  ```bash
  bun x codegraph callers <symbol_name>
  ```
* **Tìm hàm bị gọi (Callees):**
  ```bash
  bun x codegraph callees <symbol_name>
  ```
* **Phân tích tác động (Impact Analysis):**
  ```bash
  bun x codegraph impact <symbol_name>
  ```
* **Xây dựng ngữ cảnh công việc (Context Building):**
  ```bash
  bun x codegraph context "<mô tả tác vụ>"
  ```
* **Đồng bộ hóa chỉ mục (Sync):**
  ```bash
  bun x codegraph sync
  ```

### Quy tắc quan trọng:
1. Luôn chạy `bun x codegraph sync` sau khi thay đổi code trước khi phân tích tác động.
2. Tránh sửa đổi các hàm dùng chung diện rộng khi chưa chạy `impact` để xem trước các tệp bị ảnh hưởng.

---

## 🎬 Skill 2: HyperFrames Video Ads Developer (HeyGen Compositions)

Định hướng thiết kế, phát triển và tối ưu hóa các bản dựng video quảng cáo tự động sử dụng **HeyGen HyperFrames** và **GSAP**.

### 1. Cấu trúc thư mục dựng hình:
```text
video_ads/
├── index.html                  # Bản dựng gốc (Root Timeline)
├── meta.json                   # Metadata dự án
├── assets/                     # Kho tài nguyên đa phương tiện
└── compositions/               # Thư mục chứa các phân cảnh (sub-compositions)
```

### 2. Các Quy tắc Thiết kế Bắt buộc (Design Rules):
* **Nhịp cắt (20 giây):** Scene 1 (Logo Intro, 0s-1.5s) -> Scene 2-4 (Showcase, 1.5s-14s) -> Scene 5 (Logo Outro, 14s-20s).
* **Hoạt ảnh Đàn hồi (GSAP Elastic Physics):**
  ```js
  gsap.to(target, { scale: 1, rotation: 0, duration: 1.5, ease: "elastic.out(1.1, 0.6)" });
  ```
* **KHÔNG dùng lặp vô hạn (Infinite Repeat):** Tránh lỗi render bằng cách dùng số vòng lặp hữu hạn:
  ```js
  repeat: Math.floor((totalDuration - startTime) / floatSpeed) - 1
  ```
* **Tính đơn trị (Deterministic Execution):** Không sử dụng `Math.random()`, `Date.now()`, hoặc các cuộc gọi mạng `fetch` bất đồng bộ trong lúc timeline đang chạy.

### 3. Cú pháp HTML HyperFrames:
Mọi phần tử timeline bắt buộc phải khai báo thuộc tính `data-start`, `data-duration`, `data-track-index` và `class="clip"`.

---

## 🧠 Skill 3: Rottra Hybrid Memory & RAG Engine

Quy chuẩn tương tác với hệ thống lưu trữ tri thức và cơ chế bộ nhớ lai của Rottra.

### 1. Cấu trúc Bộ nhớ:
* **Bộ nhớ ngắn hạn:** 10 lượt chat gần nhất được lọc qua sliding window.
* **Bộ nhớ tóm tắt:** `summaryContext` lưu lịch sử dài hạn.
* **Bộ nhớ dài hạn (VectorDB RAG):** Bảng `vectorDocument` sử dụng PostgreSQL và chỉ mục vector `halfvec(256)`.

### 2. Cú pháp Dạy học tương tác:
```text
/day [Giả thuyết / Câu hỏi] | [Luận chứng / Câu trả lời]
```

### 3. Quy tắc Biên soạn tri thức (LLM Wiki Compiler):
* Khi chèn hoặc cập nhật bản ghi trong bảng `vectorDocument` thông qua hàm `compileToLlmWiki`, bắt buộc phải điền trường `updatedAt` vào cột `metadata` JSONB dưới định dạng `new Date().toISOString()`.
* Chạy `initRAGEngine(true)` để làm mới bộ nhớ cache của Agent ngay sau khi thay đổi dữ liệu tri thức.

---

## 🛠️ Skill 4: Harness Engineering & Verification

Quy định cách thiết lập, kiểm thử và bàn giao môi trường làm việc để đảm bảo tính an toàn hệ thống.

### 1. Xác thực tự động:
Trước khi tuyên bố hoàn thành bất kỳ tác vụ nào, Agent bắt buộc phải chạy script xác thực:
```bash
./init.sh
```
*Script này sẽ chạy: `bun install` -> `bun run format` -> `npx tsc --noEmit` -> `bun run build`.*

### 2. Đánh giá chất lượng Harness:
Để kiểm định tính ổn định của các file ràng buộc, chạy công cụ:
```bash
node scripts/validate-harness.mjs --target .
```
Yêu cầu điểm chất lượng đạt 100/100 trước khi bàn giao.
