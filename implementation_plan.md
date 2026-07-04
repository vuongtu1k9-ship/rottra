# [Goal Description]

Thực hiện tối ưu hóa hiệu năng "khô máu" (Extreme Performance Optimization) cho hệ thống tìm kiếm Vector (RAG) bằng triết lý **Structure of Arrays (SoA)** và **Đại số mảng phẳng (Flat Array Algebra)**.
Mục tiêu là loại bỏ hoàn toàn mảng Object 3D rời rạc, cấp phát trước một vùng nhớ liên tục duy nhất (`Float32Array`) để chứa hàng vạn Vector nhúng, giúp tăng tốc truy xuất Cosine Similarity lên gấp 8-10 lần nhờ tận dụng bộ nhớ đệm CPU (L1/L2 Cache) và JIT của V8.

> [!TIP]
> **Structure of Arrays (SoA)** lưu trữ tất cả các chiều vector liên tiếp nhau trong một bộ đệm nhớ phẳng duy nhất. Điều này giúp bộ xử lý (CPU) tải trước (prefetch) dữ liệu cực kỳ mượt mà mà không gặp tình trạng trượt bộ đệm (cache miss).

## User Review Required

> [!IMPORTANT]  
> Việc sử dụng SoA đồng nghĩa với việc chúng ta sẽ "bơm" trước một khối lượng RAM nhất định cho hệ thống RAG (ví dụ: cấp phát tĩnh 10MB RAM cho 10,000 vectors).

## Open Questions

> [!WARNING]
> Sếp muốn mình thiết kế **SoA Vector Pool** theo dạng:
> 1. **Fixed Size (Kích thước cố định tĩnh)**: Cấp phát cứng (ví dụ max 100,000 vectors). Nhanh tuyệt đối, không bao giờ phải cấp phát lại, nhưng tốn RAM ngay từ đầu.
> 2. **Dynamic Resize (Tự động nới rộng)**: Bắt đầu ở mức nhỏ (1,000 vectors), mỗi khi đầy sẽ nhân đôi mảng nhớ. Phức tạp hơn chút nhưng tối ưu RAM.

## Proposed Changes

---

### Tối ưu hóa lõi tính toán lượng tử (Quant Engine)

#### [NEW] `src/core/quant-engine/soa-vector-pool.ts`
- Xây dựng lớp `SoAVectorPool`.
- Cấp phát bộ nhớ nền: `new Float32Array(MAX_CAPACITY * VECTOR_DIM)`.
- Hàm `insert(vector)`: Lưu vector vào vùng nhớ phẳng dựa trên chỉ mục (stride math).
- Hàm `searchKnn(queryVector, k)`: Quét toàn bộ khối nhớ phẳng trong một vòng lặp tuyến tính cực gắt (tight loop), tính Cosine Similarity cực nhanh.

---

### Tích hợp vào Bộ nhớ thần kinh (Neural Memory)

#### [MODIFY] `src/core/neural-memory/vector-rag.ts`
- Xóa bỏ việc lưu mảng rời rạc `vector?: number[]` bên trong cấu trúc `FlatDoc`.
- Tích hợp `SoAVectorPool` vào quá trình khởi tạo (Seed / Load DB).
- Chuyển thao tác tìm kiếm Vector truyền thống sang gọi `pool.searchKnn(query, topK)`.

## Verification Plan

### Automated Tests
- Chạy thử một tập script đo Benchmark tốc độ tìm kiếm `test-soa.ts`. So sánh tốc độ tính `cosine similarity` cho 10,000 vectors giữa kiểu cũ (Array of Objects) và kiểu mới (SoA Flat Array).

### Manual Verification
- Sếp sẽ trực tiếp chat với Agent hoặc upload một tài liệu PDF vào hệ thống để kiểm chứng tốc độ truy xuất RAG xem có đạt mức "ngay lập tức" (micro-seconds) hay không.
