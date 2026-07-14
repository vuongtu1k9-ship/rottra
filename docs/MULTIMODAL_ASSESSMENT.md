# Đánh giá Khả năng Multimodal — Rottra Agricultural E-commerce AI Platform

> Tài liệu phân tích khả năng đa phương thức hiện tại, khoảng trống và định hướng triển khai.

<!-- TOC -->
- [Tổng quan](#tổng-quan)
  - [Nguyên tắc thiết kế cốt lõi](#nguyên-tắc-thiết-kế-cốt-lõi)
  - [Tóm tắt trạng thái hiện tại](#tóm-tắt-trạng-thái-hiện-tại)
- [Bắt buộc triển khai (High Priority)](#bắt-buộc-triển-khai-high-priority)
- [Nên có (Medium Priority)](#nên-có-medium-priority)
- [Không cần thiết (Not Needed)](#không-cần-thiết-not-needed)
- [Lộ trình triển khai đề xuất](#lộ-trình-triển-khai-đề-xuất)
  - [Giai đoạn 1 - Nền tảng Thị giác](#giai-đoạn-1--nền-tảng-thị-giac)
  - [Giai đoạn 2 - Đa phương thức Chatbot](#giai-đoạn-2--đa-phương-thức-chatbot)
  - [Giai đoạn 3 - Studio AI nâng cao](#giai-đoạn-3--studio-ai-nâng-cao)
- [Studio AI — Định hướng kiến trúc](#studio-ai--định-hướng-kiến-trúc)
- [So sánh Any-to-Any với Pipeline chuyên biệt](#so-sánh-any-to-any-với-pipeline-chuyên-biệt)
- [Ghi chú kỹ thuật](#ghi-chú-kỹ-thuật)
  - [Model khuyến nghị (Self-hosted / ONNX)](#model-khuyến-nghị-self-hosted--onnx)
  - [Định hướng CLI / API Studio](#định-hướng-cli--api-studio)

---

## Tổng quan

### Nguyên tắc thiết kế cốt lõi

Rottra tuân theo nguyên tắc **100% self-hosted / offline-first**. Tất cả model inference phải chạy local (ONNX / WebGPU / Bun worker), không gọi API cloud. Đây là ràng buộc đầu vào cho mọi tính năng Multimodal.

### Tóm tắt trạng thái hiện tại

| Hệ thống | Trạng thái | Vị trí |
|----------|------------|--------|
| **Xử lý ngôn ngữ tự nhiên (NLP)** | ✅ Hoàn toàn offline | `src/core/nlp-cognitive/` |
| **Hệ thống Đa Agent** | ✅ Hoàn toàn offline | `src/core/cognitive-swarm/` |
| **Vector RAG + Graph RAG** | ✅ Hoàn toàn offline | `src/core/neural-memory/` |
| **Meta-harness (RL / Evolution)** | ✅ Hoàn toàn offline | `src/core/meta-harness/` |
| **Chatbot thương mại** | ✅ Hoạt động | `src/core/hybrid-ai.ts` |
| **Hiển thị media (ảnh/video/3D)** | ✅ Hoạt động | `src/client/components/product-card.tsrx` |
| **Tải lên media sản phẩm** | ✅ Hoạt động | `src/client/components/form.tsrx` |
| **Handwriting / Vẽ tay recognition** | ⚠️ Stub/Toy | ONNX MobileViT (chỉ dùng cho AiDrawingPath) |
| **Vision classifier (MLP màu OKLCH)** | ⚠️ Stub/Toy | `src/core/nlp-cognitive/vision-brain.ts` |
| **TTS (synthesize speech)** | ⚠️ External (Google free TTS) | `src/core/nlp-cognitive/tts-bridge.ts` |
| **Image enhancement** | ⚠️ Có style transfer cơ bản | `sharp` + `pica` |
| **Image generation (Studio)** | ❌ Mocked | Trả về `default-avatar.avif` |
| **Video generation (Studio)** | ❌ Simulated | UI sample clips |
| **ASR (Speech-to-Text)** | ❌ Chưa có | — |
| **OCR / Document parsing** | ❌ Chưa có | — |
| **Visual search** | ❌ Chưa có | — |
| **Plant/pest/disease detection** | ❌ Chưa có | — |
| **VQA (Visual Question Answering)** | ❌ Chưa có | — |

---

## Bắt buộc triển khai (High Priority)

Các tính năng cốt lõi cần thiết cho nền tảng thương mại điện tử nông nghiệp thông minh:

| Khả năng | Áp dụng nghiệp vụ | Trạng thái hiện tại |
|-----------|-------------------|---------------------|
| **Image Classification** | Phân loại nông sản, đánh giá độ tươi, phát hiện dấu hiệu hư hỏng | ❌ Chỉ có MLP OKLCH đơn giản (64 features) |
| **Object Detection** | Phát hiện sâu bệnh, quả chín, lỗi sản phẩm trên ảnh | ❌ Chưa có |
| **Zero-Shot Object Detection** | Phát hiện bằng mô tả tiếng Việt — không cần huấn luyện riêng cho mỗi nhãn | ❌ Chưa có |
| **Image Segmentation** | Tách vùng bệnh trên lá, vùng hỏng trên quả, đếm trái cây | ❌ Chưa có |
| **Image-to-Text (OCR)** | Đọc hóa đơn, chứng chỉ xuất xứ, nhãn sản phẩm, mã QR | ❌ Chưa có |
| **Image-to-Text (Caption / Description)** | AI mô tả sản phẩm, đánh giá chất lượng ảnh tự động | ❌ Chưa có |
| **Visual Question Answering (VQA)** | Chatbot nhận ảnh lá/cây + câu hỏi → trả lời chẩn đoán | ❌ Chưa có |
| **Document Question Answering** | Trả lời câu hỏi từ hợp đồng, hóa đơn, chứng từ xuất khẩu | ❌ Chưa có |
| **Image Feature Extraction** | Visual search — tìm sản phẩm tương tự qua ảnh | ❌ Chưa có |
| **Zero-Shot Image Classification** | Phân loại sản phẩm mới mà không retrain, phù hợp đa dạng nông sản | ❌ Chưa có |

---

## Nên có (Medium Priority)

Cải thiện trải nghiệm người dùng và tăng doanh thu:

| Khả năng | Áp dụng nghiệp vụ | Trạng thái hiện tại |
|-----------|-------------------|---------------------|
| **Image-Text-to-Image** | Xóa nền, tăng độ sáng, khử nhiễu, đổi phong cách ảnh sản phẩm | ⚠️ Có style transfer cơ bản qua `sharp` |
| **Text-to-Image** | Studio AI tạo ảnh minh họa sản phẩm, nội dung marketing | ⚠️ Đang mock (`local-image-engine.ts`) |
| **Image-to-Video** | Studio AI tạo video quảng cáo từ ảnh sản phẩm | ⚠️ Có HyperFrames nhưng UI đang simulate |
| **Audio-Text-to-Text (ASR)** | Tìm kiếm bằng giọng nói, đặt hàng bằng thoại cho nông dân | ❌ Chỉ có TTS, chưa có ASR |
| **Visual Document Retrieval** | Tìm tài liệu/hợp đồng bằng ảnh chụp | ❌ Chưa có |

---

## Không cần thiết (Not Needed)

Không phù hợp với domain thương mại điện tử nông nghiệp:

| Loại hình | Lý do loại bỏ |
|-----------|---------------|
| **Text-to-Speech (TTS)** | Đã có (Google TTS fallback native) |
| **Text-to-3D / Image-to-3D** | Nền tảng không phải 3D modeling tool |
| **Text-to-Video** | Chỉ cần video từ ảnh sản phẩm, không cần video tự do từ mô tả |
| **Video-to-Video** | Không có ứng dụng trong e-commerce nông nghiệp |
| **Audio Classification / Music Generation** | Không liên quan đến sản phẩm nông nghiệp |
| **Depth Estimation / Keypoint Detection** | Không phù hợp domain |
| **Unconditional Image Generation** | Không có giá trị trong thương mại điện tử |
| **Robotics / Reinforcement Learning** | Không liên quan đến multimodal |
| **Graph ML** | Đã có Knowledge Graph offline, không phải multimodal |

---

## Lộ trình triển khai đề xuất

### Giai đoạn 1 - Nền tảng Thị giác (Vision Foundation)

1. **Tích hợp ONNX Runtime** — tích hợp các model nhận diện thực vật/bệnh (PlantVillage, ResNet, MobileNet/EdgeNeXt) chạy local trên Edge
2. **OCR Engine** — Tesseract.js hoặc PaddleOCR lightweight, xử lý hóa đơn, nhãn, chứng nhận, QR code
3. **Zero-shot Image Classification (CLIP)** — phân loại sản phẩm mới không cần retrain, phù hợp đa dạng nông sản
4. **Visual Search** — feature extraction với CLIP + Vector DB (`VectorDocument`, `halfvec`)

### Giai đoạn 2 - Đa phương thức Chatbot

5. **VQA Model** — L LaVA, Qwen-VL cho chat đa phương thức với ảnh
6. **ASR** — Whisper.cpp / VAD cho tìm kiếm và đặt hàng bằng giọng nói tiếng Việt
7. **Document Q&A** — Đọc và trả lời câu hỏi từ hợp đồng, hóa đơn, chứng từ

### Giai đoạn 3 - Studio AI nâng cao

8. **Text-to-Image** — Fine-tune hoặc adopt Stable Diffusion cho sản phẩm nông nghiệp
9. **Image-to-Video** — Tạo video quảng cáo từ ảnh sản phẩm (HyperFrames pipeline)
10. **Image-to-Image Enhancement** — Super-resolution, background removal, artifact removal hoàn chỉnh

> **Lưu ý:** Tất cả inference phải tuân thủ nguyên tắc **100% offline-first**. Sử dụng WebGPU / ONNX Runtime / Bun worker, tránh external API.

---

## Studio AI — Định hướng kiến trúc

Studio AI nên là **bộ công cụ đa phương thức có chủ đích (purpose-built)**, **KHÔNG phải** khung tổng quát Any-to-Any.

```
Studio AI gồm các pipeline CHUYÊN BIỆT:
├── 🖼️ Image Studio
│   ├── Text → Image        (tạo ảnh minh họa sản phẩm từ mô tả)
│   ├── Image → Image       (xóa nền, tăng sáng, tăng độ phân giải, đổi phong cách)
│   └── Image → Caption     (AI mô tả nông sản)
├── 🎬 Video Studio
│   ├── Image → Video       (ảnh sản phẩm → video quảng cáo ngắn)
│   └── Text → Video        (kịch bản marketing → video)
├── 🔊 Audio Studio
│   ├── Text → Speech       (mô tả sản phẩm → giọng nói)
│   └── Image + Text → Audio (ảnh + chú thích → voiceover mô tả)
└── 🌿 Agri Vision (MỚI)
    ├── Image → Diagnosis   (ảnh lá/cây → chẩn đoán bệnh/sâu bệnh)
    ├── Image → OCR         (hóa đơn/giấy chứng nhận → văn bản)
    └── Image Search        (ảnh sản phẩm → tìm sản phẩm tương tự)
```

---

## So sánh Any-to-Any với Pipeline chuyên biệt

| Tiêu chí | Any-to-Any | Pipeline chuyên biệt (Khuyến nghị) |
|-----------|------------|-------------------------------------|
| **Tính khả thi offline** | ❌ Thường dùng API cloud lớn | ✅ Có thể implement hoàn toàn local |
| **Tài nguyên tính toán** | Cao (xử lý mọi tổ hợp) | Thấp (chỉ xử lý use case cần thiết) |
| **UX Người dùng** | Kém — người dùng không biết workflow nào cần | ✅ Có — mỗi tool rõ ràng, có button, có kết quả cụ thể |
| **Triển khai kỹ thuật** | Phức tạp, khó maintain | ✅ Modular, dễ unit test, dễ mở rộng |
| **Domain fit** | ❌ Generic, không phù hợp nông nghiệp | ✅ Từng pipeline giải quyết 1 vấn đề nghiệp vụ |
| **Tính mở rộng** | ❌ Một model tổng quát khó fine-tune | ✅ Mỗi pipeline có thể swap model riêng (CLIP, OCR, ASR...) |

**Kết luận:** Studio AI không nên triển khai cơ chế Any-to-Any. Thay vào đó, xây dựng từng **module xử lý đa phương thức hướng mục tiêu** có giao diện rõ ràng, inference local, và tích hợp trực tiếp vào nghiệp vụ nông nghiệp.

---

## Ghi chú kỹ thuật

### Model khuyến nghị (Self-hosted / ONNX)

| Use case | Model đề xuất | Nền tảng |
|----------|---------------|----------|
| Plant / pest / disease detection | MobileNet-V2 / EdgeNeXt | ONNX Runtime (Edge/Browser) |
| Image classification / Zero-shot | CLIP (ViT-B/32) | ONNX Runtime + WebGPU |
| Object detection (cây/quả/bệnh) | YOLOv8 / YOLOv10-N | ONNX Runtime (Node.js worker) |
| OCR (chữ in, tay) | Tesseract.js hoặc PaddleOCR (light) | Web Worker / Bun worker |
| Visual Question Answering | LLaVA-Next / Qwen-VL (quantized) | ONNX Runtime + WebLLM |
| Image-to-Text (caption nông sản) | BLIP-2 / GIT (quantized) | ONNX Runtime + WebLLM |
| ASR (tiếng Việt) | Whisper.cpp (tiny/base) | Bun native addon |
| TTS (tiếng Việt) | Piper TTS / Coqui (local) | Bun native addon |
| Text-to-Image | Stable Diffusion XL / SD 1.5 LCM | Bun worker + ONNX + CUDA/ROCm |
| Image-to-Video | AnimateDiff / ModelScope | Bun worker + CUDA/ROCm |

### Định hướng CLI / API Studio

Tất cả tính năng Studio AI phải expose qua **RPC tương thích** với kiến trúc Rottra hiện tại:

```
GET  /api/studio/pipelines              — Danh sách pipeline đã deploy
POST /api/studio/analyze/plant          — Tải ảnh cây/trái → JSON diagnosis
POST /api/studio/ocr                    — Tải ảnh hóa đơn/chứng từ → JSON text + fields
POST /api/studio/visual-search          — Tải ảnh sản phẩm → [{ product, score }]
POST /api/studio/caption                — Tải ảnh sản phẩm → mô tả ngắn
POST /api/studio/text-to-image          — { prompt } → { image_url }
POST /api/studio/image-to-image         — { image, prompt } → { image_url }
POST /api/studio/image-to-video         — { image, prompt } → { video_url }
POST /api/studio/tts                    — { text, voice } → { audio_url }
POST /api/studio/asr                    — { audio } → { text }
```

**Ghi chú:** `stt` / `tts` / `vision` đã có trong kiến trúc kiến nghị thì nên **share model registry chung** (`AiModels` table) để quản lý phiên bản model, warm-up, và fallback strategy.

---

*Tài liệu được tạo: 2026-07-10*
*Phiên bản: 1.0*
*Liên quan: Rottra Project — CLAUDE.md, docs/ARCHITECTURE.md*
