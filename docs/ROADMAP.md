# Rottra Development Roadmap

**Mục tiêu:** Trở thành AI-Native Agricultural Intelligence Platform

---

## Kiến trúc Phỏng sinh học (Biomimicry Architecture) của 12 Agent

Hệ thống Cognitive Swarm (12 Agent) được thiết kế dựa trên 6 giới hạn sinh học cực đại của con người, tạo thành một kiến trúc hoàn hảo:

1. **Daniel Green (Nhịp tim 26 bpm):** Idle Cost tối thiểu. Khi chờ, hệ thống tiêu thụ tài nguyên bằng không nhưng luôn sẵn sàng phản ứng.
2. **Stéphane Mifsud (Nín thở 11 phút 35 giây):** Khả năng Offline/Background. Agent có thể nín thở xử lý tác vụ ngầm liên tục mà không bị đứt kết nối (chống chịu timeout).
3. **Oskar Svendsen (VO2 Max 96.7):** Băng thông (Throughput) tối đa. Khi gặp tải nặng, hệ thống bung sức mạnh xử lý hàng triệu token mà không nghẽn.
4. **Rajveer Meena (Nhớ 70.000 chữ số Pi):** Context Window vô hạn. Nhờ Vector RAG và Semantic Cache, Agent không bao giờ quên sót dữ liệu (Lost in the middle).
5. **Timur Gareyev (Chơi cờ mù 48 ván):** Swarm Dispatcher đa luồng. Quản lý đồng thời hàng chục phiên đàm phán độc lập mà không lẫn lộn context.
6. **Angela Cavallo (Khuyếch đại Hysterical Strength):** Auto-scaling khẩn cấp. Phá vỡ giới hạn an toàn, scale-up tài nguyên đột biến (như nâng ô tô 1.5 tấn) để cứu hệ thống khi khủng hoảng traffic.

---

## Giai đoạn 1: Củng巩固 (1-2 tuần)

### 1.1 RAG Evaluation Pipeline
- [x] Automated metrics: precision@k, recall@k, MRR, faithfulness score
- [x] Test suite với golden dataset (100+ agricultural Q&A pairs)
- [x] Performance dashboard trong `/dashboard` tab

### 1.2 Streaming Response
- [x] SSE (Server-Sent Events) cho chat responses
- [x] Real-time typing indicator
- [x] Chunked response rendering trên client

### 1.3 Session Handoff
- [x] Implement `session-handoff.md` persistence
- [x] Cross-session context transfer
- [x] Agent state serialization/deserialization

---

## Giai đoạn 2: Mở rộng (2-4 tuần)

### 2.1 Multi-modal RAG
- [x] Image embedding (CLIP/OpenCLIP) cho hình ảnh sản phẩm
- [x] Audio transcription pipeline cho voice queries
- [x] Multi-modal retrieval: text + image + audio fusion

### 2.2 Real-time Sensor Integration
- [x] MQTT broker connection cho IoT sensors
- [x] WebSocket ingestion cho real-time data
- [x] Time-series aggregation và anomaly detection

### 2.3 Federated Learning Production
- [x] Multi-farm training orchestration
- [x] Differential privacy guarantees
- [x] Model aggregation với Byzantine fault tolerance

---

## Giai đoạn 3: Scale (1-2 tháng)

### 3.1 Agent-to-Agent Protocol
- [x] A2A (Agent-to-Agent) standard implementation
- [x] MCP (Model Context Protocol) server
- [x] External agent authentication + authorization

### 3.2 Knowledge Graph Visualizer
- [x] Interactive graph UI trong dashboard
- [x] Node/edge filtering và search
- [x] Real-time graph updates

### 3.3 Autonomous Supply Chain
- [x] Demand forecasting (MDP + HMM integration)
- [x] Dynamic pricing engine (game theory + negotiation)
- [x] Automated order fulfillment pipeline

---

## Giai đoạn 4: Product (3-6 tháng)

### 4.1 White-label SaaS
- [x] Multi-tenant isolation hoàn thiện
- [x] Billing/subscription management
- [x] Custom branding per tenant

### 4.2 Mobile App
- [x] Offline-first architecture
- [x] Push notifications
- [x] Biometric authentication

### 4.3 Marketplace Analytics
- [x] Price prediction dashboard
- [x] Supply-demand visualization
- [x] Farmer performance metrics

---

## Technical Stack (Current → Target)

| Component | Current | Target |
|-----------|---------|--------|
| RAG | Text-only hybrid | Multi-modal (text+image+audio) |
| Embedding | Custom Conv1D + HuggingFace | CLIP + BGE-M3 + Custom |
| Vector Store | PostgreSQL halfvec | pgvector + Qdrant fallback |
| Real-time | HTTP polling | SSE + WebSocket + MQTT |
| AI Protocol | Internal only | A2A + MCP standard |
| Deployment | Single server | Kubernetes + edge nodes |

---

## Success Metrics

- **RAG Accuracy**: >85% precision@3 on agricultural Q&A
- **Response Latency**: <200ms P95 for chat, <500ms P95 for complex queries
- **Uptime**: 99.9% availability
- **Multi-modal**: Support image + audio queries by end of Phase 2
- **Federated Learning**: 5+ farms participating by end of Phase 3

---

**Last Updated:** 2026-07-14
**Next Review:** Weekly sprint planning
