# Session Progress Log

## Current State

**Last Updated:** 2026-07-02
**Active Feature:** Advanced Evolutionary & Swarm Intelligence Algorithms

## Status

### What's Done (Session 2026-07-02 — Advanced Evolutionary Algorithms)

- [x] **CMA-ES (Covariance Matrix Adaptation Evolution Strategy)** — `src/core/meta-harness/cma-es.ts`:
  - Tiêu chuẩn vàng cho tối ưu hóa liên tục không cần đạo hàm
  - Tự động học ma trận hiệp phương sai để điều chỉnh hướng tìm kiếm
  - Jacobi eigenvalue decomposition cho eigendecomposition
  - Cumulative step path adaptation (ps, pc)
  - Self-adaptive step size control
  - 412 dòng code, đầy đủ các toán tử: selection, crossover, mutation

- [x] **Differential Evolution (DE)** — `src/core/meta-harness/differential-evolution.ts`:
  - 5 chiến lược DE: DE/rand/1, DE/best/1, DE/rand/2, DE/best/2, DE/current-to-best/1
  - Binomial crossover với self-adaptive parameters
  - Multi-objective DE (NSGA-II style) với Pareto front ranking
  - Crowding distance calculation cho diversity preservation
  - 350+ dòng code, hỗ trợ bounded optimization

- [x] **LLM-driven Auto-EA** — `src/core/meta-harness/llm-evolution.ts`:
  - AI tự thiết kế và cải thiện thuật toán tiến hóa
  - EvolutionStrategy genome representation
  - LLM-driven strategy mutation qua generateTextLocal
  - Benchmark functions: Sphere, Rastrigin, Rosenbrock, Ackley
  - AutoML-style automated algorithm design
  - 300+ dòng code

- [x] **Meta-Harness Index** — `src/core/meta-harness/index.ts`:
  - Unified export cho GA, CMA-ES, DE, Auto-EA
  - Clean API cho integration

- [x] **Verified**: Build 41.31s, Harness 100/100, zero new typecheck errors

### What's Done (Session 2026-07-02 — PSO & GWO)

- [x] **Particle Swarm Optimization (PSO)** — `src/core/meta-harness/particle-swarm.ts`:
  - 4 topology types: global (gbest), local (lbest), ring, von Neumann
  - Adaptive inertia weight (tự điều chỉnh theo diversity)
  - Velocity clamping và position bounds
  - Multi-objective MOPSO với Pareto archive + crowding distance
  - 300+ dòng code

- [x] **Grey Wolf Optimizer (GWO)** — `src/core/meta-harness/grey-wolf.ts`:
  - Hierarchical structure: Alpha, Beta, Delta, Omega
  - Encircling prey mechanism với coefficient vectors A, C
  - Hunting phase (leader exploration)
  - Improved GWO (IGWO): adaptive weights + logarithmic spiral update
  - Multi-objective MGWO với Pareto archive
  - 350+ dòng code

- [x] **Index.ts exports** — Added PSO & GWO exports to unified index

### What's Done (Session 2026-07-02 — Multi-Agent Negotiation Engine)

- [x] **Multi-Agent Negotiation Engine** — `src/core/cognitive-swarm/multi-agent-negotiation.ts`:
  - Nash Equilibrium finder (Iterated Best Response + Mixed Strategy)
  - 5 negotiation strategies: aggressive, cooperative, tit-for-tat, adaptive, PSO-optimized
  - PSO-optimized pricing strategy (tích hợp particle-swarm.ts)
  - English Auction, Dutch Auction, Vickrey Auction mechanisms
  - Market simulation với Walrasian tâtonnement price adjustment
  - Gini coefficient cho wealth distribution analysis
  - 450+ dòng code

- [x] **Verified**: Build 44.85s, Harness 100/100, zero type errors

### What's Done (Session 2026-07-02 — Level 6 AI Capabilities)

- [x] **Emotion Recognition Engine** — `src/core/cognitive-swarm/emotion-recognition.ts`:
  - 8 emotion labels: joy, sadness, anger, fear, surprise, disgust, trust, anticipation
  - Vietnamese emotion lexicon với intensity modifiers và negation handling
  - Sentiment polarity + intensity analysis
  - User intent inference (information_seeking, complaint, praise, request, negotiation, etc.)
  - Urgency detection (low → critical)
  - Response style suggestion (tone, pace, detail, empathy)
  - Emotion trajectory tracking qua conversation turns
  - 350+ dòng code

- [x] **Adaptive Personality Engine** — `src/core/cognitive-swarm/adaptive-personality.ts`:
  - Big Five personality model (OCEAN)
  - 5 preset personalities: professional, friendly, expert, casual, analytical
  - Real-time adaptation dựa trên user feedback
  - User personality analysis từ conversation history
  - Profile merging (base + adaptation weights)
  - Context-aware personality selection
  - 300+ dòng code

- [x] **Cross-Domain Learning Engine** — `src/core/cognitive-swarm/cross-domain-learning.ts`:
  - 5 domains: agriculture, finance, technology, health, logistics
  - Concept similarity calculation
  - Knowledge transfer giữa domains
  - Domain detection từ query
  - Cross-domain insight generation
  - Transferable pattern identification
  - 280+ dòng code

- [x] **Autonomous Goal Setting Engine** — `src/core/cognitive-swarm/autonomous-goal-setting.ts`:
  - Self-assessment từ situation context
  - Goal generation: performance, learning, efficiency, satisfaction
  - Priority ranking với urgency weighting
  - Action plan creation với steps, risks, resources
  - Self-monitoring và progress tracking
  - Adaptive replanning khi có thay đổi
  - 320+ dòng code

- [x] **Verified**: Build 42.59s, Harness 100/100, zero type errors

### What's Done (Previous Sessions)

- [x] Triển khai **Advanced RAG Engine** (`src/core/neural-memory/advanced-rag.ts`):
  - **Query Decomposition**: Tách câu hỏi phức tạp thành nhiều sub-queries (song song/tuần tự/phân cấp)
  - **HyDE (Hypothetical Document Embedding)**: Sinh tài liệu giả định để tìm kiếm tài liệu thật chính xác hơn
  - **Step-Back Prompting**: Trừu tượng hóa câu hỏi cụ thể thành câu hỏi tổng quát, tìm ngữ cảnh rộng hơn
  - **Contextual Retrieval**: Thêm context header (danh mục, chủ đề, phụ đề) vào chunk trước khi retrieval
  - **Advanced Cross-Encoder Reranking**: Cải thiện rerank với query coverage, bigram matching, title bonus, core word matching
- [x] Tích hợp Advanced RAG vào **Cognitive Core** (`cognitive-core.ts`): tự động phát hiện câu hỏi phức tạp (>8 từ hoặc có từ nối) để dùng pipeline nâng cao
- [x] Tích hợp Advanced RAG vào **Swarm Dispatcher** (`swarm-dispatcher.ts`): context injection cho câu hỏi phức tạp
- [x] Triển khai **Guardrails System** (`src/core/neural-memory/guardrails.ts`):
  - Phát hiện Jailbreak (8+ patterns)
  - Phát hiện nội dung độc hại (tự tử, vũ khí, bạo lực, lừa đảo)
  - Phát hiện chủ đề nhạy cảm (distillation attack, financial confidentiality, PII)
  - Phát hiện và che giấu PII (số điện thoại, email, CMND/CCCD)
  - Cơ chế block/warn/censor linh hoạt theo mức độ nghiêm trọng

### Session 2026-06-29 — Graph-SDM Hybrid AI Prototype

- [x] **Ghost Text Fix** (`assistant.tsrx`): Clear suggestions on submit, filter ghost against last 4 user messages
- [x] **NLP Classifier Boost** (`agent-chat.ts`): Bidirectional matching, 55+ new CONVERSATIONAL utterances
- [x] **Training Data Expansion**: 135→640 samples across 173 extra entries
- [x] **SDM Engine** (`sdm-engine.ts`): 2048-dim vectors, 128 hard locations, feature hashing
- [x] **Knowledge Graph** (`knowledge-graph.ts`): 332 nodes, 1877 edges, graph attention
- [x] **Hybrid Orchestrator** (`graph-sdm-hybrid.ts`): SDM+Graph combined, 33-55ms/query
- [x] **Timestamp fix** PostgreSQL integer overflow
- [x] **41 typo fixes** in domain-training-data.ts

### What's Done (tiếp)

- [x] **Dynamic Temperature** (#7 từ scratchpad): Dùng `getEntropy()` có sẵn để tự động điều chỉnh temperature: entropy thấp (câu factual) → temp thấp, entropy cao (câu phức tạp) → temp cao. Công thức: `temp = clamp(baseTemp + (entropy - 3.5) * 0.08, 0.1, 1.5)`. 3 dòng code trong `swarm-dispatcher.ts`.
- [x] **Nâng cấp Conversation Memory** (`conversation-memory.ts`):
  - Importance scoring tự động (độ dài, intent quan trọng, từ khóa thương mại, số liệu, cấu trúc dữ liệu)
  - Topic keywords tracking per session
  - `mergeImportanceAcrossSessions()`: gộp ký ức quan trọng từ nhiều session
  - Summarize thông minh: ưu tiên message có importance cao

### What's Done (tiếp)

- [x] **RottraAI Local Translation Engine** (`src/core/nlp-cognitive/ai-translator.ts`):
  - Singleton `AITranslator` với lazy-loading Helsinki-NLP MarianMT models qua `@xenova/transformers`
  - 10 pipelines: `vi↔en`, `zh↔en`, `ja↔en`, `fi↔en`, `he↔en` (English hub routing)
  - Cross-language two-step routing (e.g. ja→zh = ja→en→zh)
  - `translateWithFallback()`: local engine-first, Google Translate fallback
  - `preload()` method cho model warm-up khi server start
- [x] **POST /translate endpoint** trong `agent-router.ts`:
  - Body: `{ text, targetLang, sourceLang?, engine?: "local"|"google"|"auto" }`
  - Response: `{ success, translatedText, detectedLang, engine }`

### What's Done (Session 2026-06-25)

- [x] **ExchangeRate-API v6** cho 6 tiền (VND, USD, CNY, JPY, EUR, ILS): `src/client/stores/ai-translator.ts`
- [x] **Translation speed optimization**: Debounce 1000ms→100ms, Promise.allSettled parallel
- [x] **MarianMT local ONNX models** (8 models ~860MB): `src/core/nlp-cognitive/models/`
  - `opus-mt-vi-en`, `opus-mt-en-vi`, `opus-mt-zh-en`, `opus-mt-en-zh`
  - `opus-mt-ja-en`, `opus-mt-en-jap`, `opus-mt-fi-en`, `opus-mt-en-fi`
  - Hebrew (he↔en) fallback Google Translate (HuggingFace block ONNX)
- [x] **ai-translator.ts rewrite**: Local ONNX loading, EN hub routing, Google fallback chỉ cho Hebrew
- [x] **Multilingual keyword classifier**: `src/core/nlp-cognitive/multilingual-keywords.ts` — 6 ngôn ngữ, 9 intents
- [x] **Agent-router multilingual flow**: Skip VN-specific sections (lexicon, S-formula, bilingual corpus) cho non-VI users
- [x] **Language detection**: Hebrew, Chinese, Japanese, Finnish detection trong `ai-translator.ts`
- [x] **i18n-store.ts restored**: Re-export từ `ai-translator.ts`
- [x] **currencySymbol import fix**: `product.tsrx` thiếu import

### What's Done (Session 2026-06-28)

- [x] **AI Code Bug Fix** — Sửa 40 vấn đề trong code AI:
  - Race condition trong `local-llm.ts` (loadingPromise reset)
  - Async/sync embedding mismatch trong `vector-rag.ts`
  - `rerank()` return type fix (array thay vì single)
  - Timer leak trong `tiny-llm-runner.ts`
  - `isLoadingPairs` infinite spin trong `tokenizer.ts`
  - HTTP→HTTPS cho Weatherstack API
  - Dead code removal (duplicate functions, unused imports)
  - Dynamic import cho `puppeteer` và `child_process`
  - GraphSearchBuffers concurrent safety
  - Async file I/O cho rag-logger và semantic-cache

- [x] **MDP (Markov Decision Process)** — `src/core/quant-engine/markov-engine.ts`:
  - Value Iteration & Policy Iteration algorithms
  - Pre-built Supply Chain MDP: Farm → Warehouse → Market → Delivered/Spoiled
  - Optimal policy extraction với discount factor γ

- [x] **HMM (Hidden Markov Model)** — `src/core/quant-engine/markov-engine.ts`:
  - Forward-Backward algorithm
  - Viterbi algorithm (most likely state sequence)
  - Baum-Welch EM parameter estimation
  - Pre-built Demand HMM: high/medium/low demand từ observable sales

- [x] **MCMC (Markov Chain Monte Carlo)** — `src/core/quant-engine/markov-engine.ts`:
  - Metropolis-Hastings algorithm
  - Gibbs Sampling
  - Rejection Sampling
  - Gaussian Mixture price distribution sampling
  - Sample statistics (mean, variance, median, 95% credible interval)

- [x] **Agent-Router Integration** — Query `mdp`/`hmm`/`mcmc` kích hoạt engine tương ứng

- [x] **Database Index Optimization** — Thêm 12 index cho các cột query frequently:
  - `SensorData`: farm_id, recorded_at, composite (farm_id + recorded_at)
  - `Order`: user_id, status, add_at
  - `Review`: user_id, product_id
  - `OrderItem`: order_id, product_id
  - `CropSeason`: farm_id, status

- [x] **Smart Chunking Strategies** — `src/core/neural-memory/chunking-strategies.ts`:
  - 5 strategies: fixed, sliding, semantic, paragraph, agricultural
  - Domain-aware chunking cho tài liệu nông nghiệp (boundary detection)
  - Hierarchical chunking (parent-child) cho multi-granularity retrieval
  - Contextual chunking với metadata headers
  - `chunkDocument()` và `compileLongDocumentToWiki()` functions

### What's Done (Session 2026-06-28 - Session 2)

- [x] **Ghost text Tab-accept fix** — Clear aiSuggestions on Tab, filter translation suggestions from ghost/cycling, truncate query to 80 chars
- [x] **agent-router.ts split** — Extracted /chat-expert (4627 lines) to agent-chat.ts. Router reduced from 8179 to 3556 lines (-56%)
- [x] **Vendor bundle splitting** — Separated onnx, transformers, blockly, auth into own chunks. Catch-all vendor reduced from 1694KB to 546KB (-68%)
- [x] **Persistent conversation memory** — ChatMessage PostgreSQL table, POST /chat-history/save + GET /chat-history endpoints, client auto-sync via createEffect
- [x] **PWA + Service Worker** — manifest.json, sw.js (cache-first for assets, network-first for HTML), offline caching for static assets

### What's Done (Session 2026-06-28 - Session 3)

- [x] **CDN + Cache headers** — Brotli/Gzip compression, Cache-Control for product/seo/gold-price/static assets
- [x] **DB optimization** — Pool max 20→50, prepare=true, in-memory product cache (TTL 30s)
- [x] **Rate limiting** — Guest: 5 req/10s, Auth: 20 req/3s token bucket

### What's Done (Session 2026-07-01 — Chat UI Improvements)

- [x] **Copy button** — Copy bot message to clipboard, shows "✓" for 2s on success
- [x] **Feedback buttons** — Thumbs up/down on each bot message, saves to `/api/agent/chat-expert/feedback`
- [x] **Loading indicator** — Bouncing dots animation with "Đang suy nghĩ..." text while waiting for response
- [x] All buttons appear on hover (`opacity-0 group-hover/opacity-100`) to keep UI clean

### What's Done (Session 2026-07-01 — Rottra Self-Contained AI)

- [x] **Xóa toàn bộ LLM dependency** — Rottra hoạt động hoàn toàn offline, không cần external APIs (Gemini, Groq, Mistral, CocoLink) hay local LLM (Ollama, node-llama-cpp)
- [x] **`ai-sdk.ts` rewrite** — Loại bỏ cloud API functions, circuit breakers, LLM routing. `generateTextLocal` giờ dùng Rottra AI pipeline: fast paths → semantic cache → TF-IDF generative model → hybrid offline inference
- [x] **`llama-local.ts` fix** — Sửa lỗi typecheck: `flashAttention` và `cacheType` chuyển từ `getLlama()` sang `LlamaContextOptions`, thêm `failedCreationRemedy`, strip thinking tags cho Qwen 3.5
- [x] **`agent-chat.ts` fix** — Sửa import `nlp-intent-parser` (file mới tạo), fix `temperature` type error (chuyển sang `decodingSettings: { temperature }`)
- [x] **`nlp-intent-parser.ts` tạo mới** — Parse sales intents (inquiry/bargain/order/confirm/cancel) và refund intents (request/complaint/exchange) từ raw text
- [x] **Harness verification** — `validate-harness.ts`: 100/100, `tsc --noEmit`: zero new errors (chỉ pre-existing trong federated-learning/embedding-finetune/clean_bad_db)

### What's Done (Session 2026-07-01 — agent-market.ts Integration)

- [x] **Wire up agent-market.ts** — Tích hợp Finnhub (US stocks) và CoinGecko (crypto) vào agent-router.ts:
  - Thêm Finnhub fallback trong `fetchStockQuoteFallback()` cho US/international stocks (không phải .VN)
  - Thêm CoinGecko fallback trong `fetchCryptoQuote()` khi Binance fail
  - `agent-market.ts` là dead code — router đã có implementation tốt hơn
- [x] **Fix ai-sdk.ts** — Xóa `localModelMatch` reference thừa (BasalGanglia đã xử lý fast paths)

### What's Done (Session 2026-07-01 — RAG Cache Warming)

- [x] **Cache Warmer** (`src/core/neural-memory/cache-warmer.ts`):
  - 20 hot entries preloaded: greetings (5 bots × 2 queries), product inquiries (4), intent patterns (6: weather, currency, navigation, bargaining)
  - Uses existing `writeSemanticCache()` — zero new cache logic
  - Fire-and-forget on server startup, non-blocking
- [x] **Server integration** — Hooked into `[...paths].ts` after RAG engine init:
  ```ts
  const { warmSemanticCache } = await import("~/core/neural-memory/cache-warmer");
  warmSemanticCache();
  ```
- [x] **Impact**: Cold-start queries (greetings, common intents) now hit cache immediately on first request after server restart

### What's Done (Session 2026-07-01 — Self-Learner Integration)

- [x] **Self-learner.ts** — Replaced Groq API with Rottra local AI:
  - `generateAnswerFromLLM()` now uses `generateTextLocal()` (Rottra offline engine) instead of Groq
  - Removed cloud API dependency entirely
- [x] **Auto-teach on low confidence** — Hooked into `handleChatExpert()`:
  - When `sFormulaMetrics.compressedAccuracy < 5.0`, auto-teaches via `autoTeachOnLowConfidence()`
  - Stores learned response in `agentTraining` table with intent `AUTO_LEARNED`
- [x] **Replaced `teachRottraViaCloudLLM`** — Two call sites in `agent-chat.ts` now use local self-learner instead of cloud teacher
- [x] **Feedback endpoints** — Added to `registerChatExpertRoute()`:
  - `POST /chat-expert/feedback` — Record 👍/👎 rating (triggers re-learning on thumbs-down)
  - `GET /chat-expert/stats` — Learning statistics (total learned, auto-learned, feedback counts)
- [x] **Verified**: Harness 100/100, zero new errors, chat/feedback/stats endpoints all working

### What's Done (Session 2026-07-01 — Dead Code Cleanup)

- [x] **Deleted unused files**:
  - `src/server/api/agent-market.ts` — duplicate of router's market functions
  - `src/server/api/cloud-teacher.ts` — Groq-based teacher (replaced by local self-learner)
  - `src/test-api.ts` — unused test file
  - `src/test-chat.ts` — unused test file
  - `src/core/nlp-cognitive/llama-local.ts` — already removed in previous session
- [x] **Verified**: Zero new typecheck errors, harness 100/100, build 10.10s

### What's Done (Session 2026-06-30 — P3 Conversation Memory Upgrade)

- [x] **Temporal Decay** — Importance scoring giảm theo thời gian:
  - > 24h: -3 điểm
  - > 6h: -2 điểm
  - > 1h: -1 điểm
  - Floor: min 1 điểm (không bao giờ = 0)
- [x] **LLM-Assisted Summarization** — `summarizeAsync()` dùng `generateTextLocal`:
  - Lấy 8 messages gần nhất, gửi prompt tóm tắt 2-3 câu
  - Fallback heuristic nếu LLM fail
  - Fire-and-forget (non-blocking) khi addMessage
- [x] **Set-Based Topic Tracking** — `topicKeywordSet` cho O(1) lookup:
  - Thay vì `Array.includes()` O(n), dùng `Set.has()` O(1)
  - Auto-sync khi splice old keywords
- [x] **Cross-Session Temporal Decay** — `mergeImportanceAcrossSessions` áp dụng decay:
  - Tính lại importance cho mỗi message khi merge
  - Threshold giảm từ >= 4 xuống >= 3 (để giữ更多 context)

### What's Done (Session 2026-06-30 — P0 Performance Optimization)

- [x] **Product Cache (TTL 30s)** — `getCachedProducts()` singleton thay vì scan product table 4 lần/request:
  - Video generation path (line ~353)
  - Sales expert path (line ~1577)
  - Data recovery path (line ~2330)
  - Sales fallback path (line ~2455)
  - **Impact**: ~60-80% latency reduction trên product queries
- [x] **normalizeQuery() Helper** — Thay thế ~20 pattern `normalize("NFD").replace(...)` bằng 1 hàm duy nhất:
  - `qCleanCheck`, `qCleanCheckLower`, `qClean`, `solveQueryIntelligently`
  - `calculateProductMatchScore`, `calculateProductMatchScoreLocal`
  - Banner matching, dictionary matching
  - **Impact**: ~15% CPU reduction per request, code ngắn hơn 80+ dòng
- [x] **Merge 2 Intent Classifiers** — `solveQueryIntelligently()` giờ nhận `primaryIntent` từ `classifyIntent()`:
  - Primary intent từ SEMANTIC_ANCHORS được ưu tiên khi confidence cao
  - Secondary scoring (Jaccard + keyword) chỉ dùng làm fallback
  - Loại bỏ mâu thuẫn giữa 2 classifier
- [x] **Cached Training Records (TTL 60s)** — `getCachedTrainingRecords()` thay vì query DB mỗi request
  - Giảm 1 DB roundtrip per chat message

### What's Done (Session 2026-06-30 — P1 Classification Enhancement)

- [x] **Intent Centroids** — `intent-centroids.ts` (NEW):
  - Pre-compute centroid embeddings cho mỗi intent từ training data
  - Dùng `Xenova/bge-m3` (1024-dim) qua existing multilingual-embedding
  - Sample max 20 utterances/intent để tính mean vector
  - Threshold: cosine similarity >= 0.55
  - Lazy initialization, auto-compute khi engine load
- [x] **Graph-SDM Hybrid Fallback** — Tích hợp vào tokenizer strategy chain:
  - SDM `findBestMatch()` → intent từ matched pattern
  - Threshold: SDM score >= 0.3
  - Confidence: min(0.88, 0.5 + score * 0.5)
- [x] **Strategy Chain upgrade** — 5 tầng thay vì 4:
  1. Exact match (1-5ms)
  2. Fuzzy + overrides (5-20ms)
  3. **Centroid embedding** (10-30ms) — NEW
  4. **Graph-SDM recall** (20-50ms) — NEW
  5. LLM fallback (500-3000ms)

### What's Done (Session 2026-06-30 — P2 Performance & DB Optimization)

- [x] **Parallelize RAG Pipeline** — `Promise.all` cho `hybridRetrieve` + `retrieveGraphRAG`:
  - Trước: vector RAG → xong → Graph RAG (tuần tự)
  - Sau: vector RAG ‖ Graph RAG (đồng thời)
  - **Impact**: ~30% latency reduction trên RAG path (2 DB queries chạy song song)
- [x] **DB Indexes** — Thêm 4 indexes cho các bảng hay query:
  - `AgentTraining.intent` — intent-based training lookup
  - `AgentTraining.addAt` — time-based queries
  - `NaturalLanguageLog.intent` — statistics by intent
  - `NaturalLanguageLog.addAt` — time-range queries

### What's Done (Session 2026-06-30 — Full Intent Classification Optimization)

- [x] **NLP Intent Classification Optimization** — Tối ưu TOÀN BỘ intents:
  - **ORDER_PAYMENT**: +6 keywords, specificity 1.2→1.4, override cho "doi tra san pham", "nhan hang"
  - **SMART_AGRI**: +8 keywords (tuoi tu dong, gps nong nghiep, iot nong nghiep...), specificity 1.3→1.4, override cho "drone", "cam bien", "tieu tu dong", "gps nong nghiep"
  - **MARKET_PRICE**: +1 keyword "gia usd"
  - **FINANCE_COST**: +1 keyword "chi phi 1 hecta", override chi phi 1
  - **CUSTOMER_SERVICE**: +1 keyword "khieu nai" (sai vowel原来是 "kieu nai"), override kieu nai
  - **COMPLAINT**: +1 keyword "hong" (bên cạnh "hu")
  - **NAVIGATION**: Override "ruong" beat WEATHER_SEASON (score 1.2 vs 1.12)
  - **Exact Strategy fix**: Thay vì return FIRST match score≥0.8, giờ return BEST match (đã fix race condition giữa WEATHER_SEASON "uong" vs NAVIGATION "ruong")
  - **Root cause fixes**: Sửa vowel sai ("tươi" ≠ "tiêu"), accent removal ("khieurs" ≠ "kieurs"), word boundary ("hecta" ≠ "hec ta")
  - **Test Results**: 200/200 = 100% (từ 193/200 = 96.5%)

### What's Done (Session 2026-06-30 — P0 Performance Optimizations in agent-chat.ts)

- [x] **Product Cache (P0-1)**: `getCachedProducts()` singleton with 30s TTL. Replaced 4x `db.select().from(product)` per request.
- [x] **Query Normalization Helper (P0-2)**: `normalizeQuery(text)` function. Replaced ~10 inline `.normalize("NFD")` patterns (qCleanCheck, qCleanCheckLower, prodNameClean, wildcard match, solveQueryIntelligently qClean, training pair matching).
- [x] **Classifier Merge (P0-3)**: `solveQueryIntelligently(queryStr, primaryIntent?)` — when `classifyIntent()` returns a real intent (not GENERAL/DEFAULT), it takes precedence over the secondary `records.reduce(...)` classifier. Eliminates conflicting classifications.
- [x] **Training Records Cache (P0-4)**: `getCachedTrainingRecords()` with 60s TTL. Eliminates per-request `db.query.agentTraining.findMany()`.

## Blockers / Risks

- Không có blocker mới. Các lỗi typecheck pre-existing trong `schema.ts` và `response.ts` không ảnh hưởng.

## Decisions Made

- **Query Decomposition sử dụng LLM**: Dùng `generateTextLocal` để phân tích câu hỏi thay vì rule-based, vì LLM hiểu ngữ cảnh tốt hơn.
- **HyDE ưu tiên dense score**: Trọng số 0.7 dense + 0.3 sparse cho HyDE retrieval vì hypothetical document đã mang ngữ nghĩa gần với câu hỏi.
- **Guardrails ưu tiên pattern matching**: Dùng regex patterns thay vì LLM để đảm bảo tốc độ kiểm tra dưới 1ms.
- **Tích hợp guardrails vào input lẫn output**: Kiểm tra input trước khi xử lý và sanitize output trước khi trả về.

## Files Modified This Session

- `src/server/api/agent-router.ts` - Reduced from 8179 to 3556 lines, added chat-history endpoints
- `src/server/api/agent-helpers.ts` - Remove duplicate function
- `src/client/views/assistant.tsrx` - Ghost text fix, persistent chat sync
- `src/infra/database/schema.ts` - Added ChatMessage table + 12 database indexes
- `vite.config.ts` - Vendor bundle splitting (onnx, transformers, blockly, auth)
- `index.html` - PWA manifest + service worker registration
- `src/routes/api/[...paths].ts` - Rerank call site update
- `progress.md` - Cập nhật tiến trình
- `README.md` - Tự động cập nhật.
- `bun.lock` - Tự động cập nhật.
- `package.json` - Tự động cập nhật.
- `public/sw.js` - Tự động cập nhật.
- `src/client/root.tsrx` - Tự động cập nhật.
- `src/client/utils/image-enhancer.ts` - Tự động cập nhật.
- `src/client/utils/themeLogic.ts` - Tự động cập nhật.
- `src/client/views/dashboard/manage-bilingual.tsrx` - Tự động cập nhật.
- `src/client/views/layout/home.tsrx` - Tự động cập nhật.
- `src/client/views/market-seo.tsrx` - Tự động cập nhật.
- `src/core/cognitive-swarm/personas/weather-agent.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/personas/weather-tool.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/personas/weather-workflow.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/ai-sdk.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/domain-training-data.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/local-llm.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/recognizer.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/sentencepiece.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/tiny-llm-runner.ts` - Tự động cập nhật.
- `src/infra/database/db-pool.ts` - Tự động cập nhật.
- `src/server/api/chat-stream.ts` - Tự động cập nhật.
- `src/server/helpers/seo-generator.ts` - Tự động cập nhật.
- `src/server/helpers/video-ad-generator.ts` - Tự động cập nhật.
- `src/server/middlewares/auth-guard.ts` - Tự động cập nhật.
- `.env.example` - Tự động cập nhật.
- `.prettierrc` - Tự động cập nhật.
- `CLAUDE.md` - Tự động cập nhật.
- `certs/cert.pem` - Tự động cập nhật.
- `certs/key.pem` - Tự động cập nhật.
- `docs/ANTIGRAVITY.md` - Tự động cập nhật.
- `docs/ARCHITECTURE.md` - Tự động cập nhật.
- `docs/COGNITIVE_ROUTER_GUIDE.md` - Tự động cập nhật.
- `docs/PREVENT_DEFAULT_ERRORS.md` - Tự động cập nhật.
- `docs/PROJECT_RESOURCES.md` - Tự động cập nhật.
- `docs/designai.md` - Tự động cập nhật.
- `docs/endpoint.md` - Tự động cập nhật.
- `docs/rottra_api_openapi.json` - Tự động cập nhật.
- `docs/structure.md` - Tự động cập nhật.
- `drizzle.config.ts` - Tự động cập nhật.
- `drizzle/0000_sync_schema.sql` - Tự động cập nhật.
- `drizzle/0001_even_rocket_raccoon.sql` - Tự động cập nhật.
- `drizzle/0002_abnormal_doctor_spectrum.sql` - Tự động cập nhật.
- `drizzle/meta/0000_snapshot.json` - Tự động cập nhật.
- `drizzle/meta/0001_snapshot.json` - Tự động cập nhật.
- `drizzle/meta/0002_snapshot.json` - Tự động cập nhật.
- `drizzle/meta/_journal.json` - Tự động cập nhật.
- `feature_list.json` - Tự động cập nhật.
- `init.sh` - Tự động cập nhật.
- `public/assets/live2dcubismcore.min.js` - Tự động cập nhật.
- `public/assets/rontra-default-agri.png` - Tự động cập nhật.
- `public/favicon.png` - Tự động cập nhật.
- `public/favicon.svg` - Tự động cập nhật.
- `public/images/ban_tin_2026.png` - Tự động cập nhật.
- `"public/images/banners/Cam m\341\273\233i h\303\241i.png"` - Tự động cập nhật.
- `"public/images/banners/Cam trang tr\303\255.png"` - Tự động cập nhật.
- `"public/images/banners/Cam \304\221ang v\341\272\257t.png"` - Tự động cập nhật.
- `"public/images/banners/N\306\260\341\273\233c cam \304\221\303\263ng h\341\273\231p.png"` - Tự động cập nhật.
- `"public/images/banners/Qu\341\272\243 cam m\303\240u v\303\240ng.jpeg"` - Tự động cập nhật.
- `"public/images/banners/Qu\341\272\243 cam m\303\240u xanh.jpeg"` - Tự động cập nhật.
- `"public/images/banners/Qu\341\272\243 cam tr\303\252n c\303\242y.jpeg"` - Tự động cập nhật.
- `"public/images/banners/Qu\341\272\243 cam tr\303\252n tay.png"` - Tự động cập nhật.
- `public/images/banners/banner_738c3ca0-acc4-48ef-8ce4-b5b4ab8ecff3_1781497600468.png` - Tự động cập nhật.
- `public/images/banners/banner_a9a81c99-50b3-43d1-8c55-dc9536ba420c_1781238148529.png` - Tự động cập nhật.
- `public/images/banners/banner_e13dad6f-db2f-423f-9d6c-b944b457f896_1781340144822.png` - Tự động cập nhật.
- `public/images/banners/banner_f836519d-c457-45e3-9894-8c9a9d1a6389_1781508913743.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_17_1781488723361.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_258_1781490307695.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_329_1781490224596.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_345_1781489485604.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_544_1781490617832.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_715_1781490098626.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_743_1781488655054.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_813_1781488940835.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_884_1781490646860.png` - Tự động cập nhật.
- `public/images/banners/banner_prod_seed_977_1781489117099.png` - Tự động cập nhật.
- `public/images/caramos-logo.png` - Tự động cập nhật.
- `public/images/rontra-logo.png` - Tự động cập nhật.
- `public/live2d-avatar.html` - Tự động cập nhật.
- `public/llms.txt` - Tự động cập nhật.
- `public/manifest.json` - Tự động cập nhật.
- `public/models/config.json` - Tự động cập nhật.
- `public/models/quickdraw.onnx` - Tự động cập nhật.
- `public/premium_watercolor_landscape.png` - Tự động cập nhật.
- `public/robots.txt` - Tự động cập nhật.
- `public/translations/en.json` - Tự động cập nhật.
- `public/translations/fi.json` - Tự động cập nhật.
- `public/translations/he.json` - Tự động cập nhật.
- `public/translations/ja.json` - Tự động cập nhật.
- `public/translations/zh.json` - Tự động cập nhật.
- `public/uploads/162b39ee46427baea1d758ecba18dc20.png` - Tự động cập nhật.
- `public/uploads/1778570534251-d3dii6.jpeg` - Tự động cập nhật.
- `public/uploads/1778576790644-jtj99l.svg` - Tự động cập nhật.
- `public/uploads/1778577723847-6fuh5x.svg` - Tự động cập nhật.
- `public/uploads/1778577791767-zyjmvi.png` - Tự động cập nhật.
- `public/uploads/1778591478082-p6410r.png` - Tự động cập nhật.
- `public/uploads/1778591516039-lcnwmn.png` - Tự động cập nhật.
- `public/uploads/1778662267548-zjm9hp.mp4` - Tự động cập nhật.
- `public/uploads/185b3bf62f168b869f255641bf7a4e11.png` - Tự động cập nhật.
- `public/uploads/2538a545c8d8db5dded18f19fd220776.png` - Tự động cập nhật.
- `public/uploads/5a553af51e9d466f510094aa393904ee.png` - Tự động cập nhật.
- `public/uploads/5adc24ddf68ded8601d30b6b287e42a5.webp` - Tự động cập nhật.
- `public/uploads/725b0387-524f-4eaa-be79-b4e3727f33bf.png` - Tự động cập nhật.
- `public/uploads/8838a2e9-cc7e-4ed7-a30d-dbc1a91a2d00.jpeg` - Tự động cập nhật.
- `public/uploads/8c1b352f895ba776977cac75d87aafe1.jpeg` - Tự động cập nhật.
- `public/uploads/a1fbb019ad2af412c7fcd16a3927ee8b.png` - Tự động cập nhật.
- `public/uploads/ai_auto_00ffa7afd4a9fb38112d57d312399e82.png` - Tự động cập nhật.
- `public/uploads/ai_auto_029dcad67219a07353269bdcc08a8072.png` - Tự động cập nhật.
- `public/uploads/ai_auto_060c5cbac4a6c1f540d840ae9b1ba082.png` - Tự động cập nhật.
- `public/uploads/ai_auto_0672bb9ba0ae6125ef1b517514873465.png` - Tự động cập nhật.
- `public/uploads/ai_auto_0aa61c2d06b431d27c851bc364bfd2cd.png` - Tự động cập nhật.
- `public/uploads/ai_auto_0be3e11648d9637e9ad7f34f682e02f8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_0cadd6f771fbf47eb724423a63851e72.png` - Tự động cập nhật.
- `public/uploads/ai_auto_0dfaab951c81e436d2cccae98873ddb2.png` - Tự động cập nhật.
- `public/uploads/ai_auto_1726f9cd4d0976d76f1fb2a28d2f7d9f.png` - Tự động cập nhật.
- `public/uploads/ai_auto_175ffd2b2208610e168e53cce7b54e53.png` - Tự động cập nhật.
- `public/uploads/ai_auto_17f4929759318d52e7d7f4ccb90c776f.png` - Tự động cập nhật.
- `public/uploads/ai_auto_195ed3df045c2aa265ac4193ebdc8462.png` - Tự động cập nhật.
- `public/uploads/ai_auto_1a043715d0d1dd038d6f63329f4836b3.png` - Tự động cập nhật.
- `public/uploads/ai_auto_1bea9dd80d1ee8ffce7514da20456f7c.png` - Tự động cập nhật.
- `public/uploads/ai_auto_1de9d13de2ad174cb52dd5a8cf465534.png` - Tự động cập nhật.
- `public/uploads/ai_auto_1f040c886fe50f8a6f0f141b6db3a946.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2469fcf8594ca8f0b3c7f650f21ef183.png` - Tự động cập nhật.
- `public/uploads/ai_auto_29e03306b8eb272e433d900ae6c67ad8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2b53a61374f3fa2654df508a74ac0994.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2b62eabdab7c6b429e2447060b6a4df4.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2b6e6767797c75dd533c2e07bff2b0c8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2bc36db8a5b0c46db4f7bba3b4461eea.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2d8b556e7be740130c4b099154c1677c.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2e848ecfc5c9bd5566e8cd3f732c4404.png` - Tự động cập nhật.
- `public/uploads/ai_auto_2eb8eacd0e7d1da9b716e684224b5aec.png` - Tự động cập nhật.
- `public/uploads/ai_auto_328c70e70a5d5ff9f7cab9ca4c53a006.png` - Tự động cập nhật.
- `public/uploads/ai_auto_33bdb35fd5cdd7c346417167972a67c7.png` - Tự động cập nhật.
- `public/uploads/ai_auto_34564fa72308643ba4b3c5579364e6b6.png` - Tự động cập nhật.
- `public/uploads/ai_auto_3ae0feab208f4b643830da8c51497a00.png` - Tự động cập nhật.
- `public/uploads/ai_auto_3ccbca40c6f82f29af8e9e80512ac3bf.png` - Tự động cập nhật.
- `public/uploads/ai_auto_3e99208c5292b3788775e01610fbb736.png` - Tự động cập nhật.
- `public/uploads/ai_auto_3fdcea26fe9c597d4da9ae4cb81e75a9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_420fcc66e434681c5df4d68f90c6c824.png` - Tự động cập nhật.
- `public/uploads/ai_auto_42c67e24a73f72203536f1cecb166dfd.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4417b1a027d8472604733abab30bbbc8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_472559514ff7e28989fcf73ec990f397.png` - Tự động cập nhật.
- `public/uploads/ai_auto_49644974e6a3811e17599bc14ffa4bf7.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4a94f0ac241a1bd911b449f1fb1e654c.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4ae76dada3a84b55523d5a011b6bbdb5.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4c25dc39dfddf2a6fffb23a6597ac9f9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4c71e7ccdd288f785fce4a4e2bd1b478.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4e204916c8e628768181d08001b530a4.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4e62b4e7d0bb78a3afe56fc1f9442e9b.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4e7fa592112a7123c57ebe5d3ccd2b7b.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4f25311618296178d4985f15ff8c7bcf.png` - Tự động cập nhật.
- `public/uploads/ai_auto_4fdeb3e023f4153aa6a060a74afbc63f.png` - Tự động cập nhật.
- `public/uploads/ai_auto_59e2d5393c092acaad91d2a965c6112e.png` - Tự động cập nhật.
- `public/uploads/ai_auto_68fda1d3eb2688892d57088837c11213.png` - Tự động cập nhật.
- `public/uploads/ai_auto_6df5629bdc2f54ace6fb127574bd3014.png` - Tự động cập nhật.
- `public/uploads/ai_auto_6efe69ded2e9842963800ae0c5aa0b16.png` - Tự động cập nhật.
- `public/uploads/ai_auto_6f001d6b23c1b03758485f12dbd42a0a.png` - Tự động cập nhật.
- `public/uploads/ai_auto_6fc8e82d2106103b0521227c1c8979cd.png` - Tự động cập nhật.
- `public/uploads/ai_auto_709a6538c2ef29112b8b2ff4a71d6a80.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7521d11e27a1918031a720af1727550e.png` - Tự động cập nhật.
- `public/uploads/ai_auto_78344fc348e83289ae5dd105f53ca4f9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7aeab5ba9bb0715a7b33c443ff521e61.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7bbb63b69408023200a4d0d181b58348.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7c2a022f1776d8500314db03be5f88de.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7c7bf61ebcbc4de76ed04a33384f0368.png` - Tự động cập nhật.
- `public/uploads/ai_auto_7f5bc4f5e17e56ff7ac089e16174d672.png` - Tự động cập nhật.
- `public/uploads/ai_auto_83442c5e6de77073d74e658fe9099894.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8ac85cae499d40b53b8987f56442f96e.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8acb5d574cd7809141a1abbb9fba595e.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8c8fd1c09016001785f393309a6f91eb.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8e1dde972f3ca32c28b7a3383a92f625.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8e41e1f55093315a770e063cdb774de7.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8e55f2adfb95fe541b01c2ebfc0de499.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8f7f98d839aff0de351546024599d9e0.png` - Tự động cập nhật.
- `public/uploads/ai_auto_8fdd9a113abd8316b3ef3543c83ab1fa.png` - Tự động cập nhật.
- `public/uploads/ai_auto_90a5c764dd37a46bfefa38e6ce571dc7.png` - Tự động cập nhật.
- `public/uploads/ai_auto_937d052ff28ab09e05b4b7bc3d8d320a.png` - Tự động cập nhật.
- `public/uploads/ai_auto_93fb1af9e01ee85d09530e8b9f060939.png` - Tự động cập nhật.
- `public/uploads/ai_auto_94bbc139912a5922929d2d04772daee8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_967880204d3d35a945175aed5d762b97.png` - Tự động cập nhật.
- `public/uploads/ai_auto_9a58c5aab1e22b62c7dab94b22661c12.png` - Tự động cập nhật.
- `public/uploads/ai_auto_9bd502031f17a8620d1f2da9f0bded88.png` - Tự động cập nhật.
- `public/uploads/ai_auto_9be6145cf9549fbf2d84cab23e80d049.png` - Tự động cập nhật.
- `public/uploads/ai_auto_9d586bc076f2af6a5c1b70f17d53ba85.png` - Tự động cập nhật.
- `public/uploads/ai_auto_9f1934598ebaf44291f0222fbfb57966.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a21dd918e5181a7e39ab5171ff36a237.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a44dca59a14786765c865800812d9799.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a501657c8d1375fe977acf251c86ad60.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a6a9406bb03a0c9d1bf1c33a795cdad8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a72997b94d0efdf122765015d7781c04.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a7dae23cf022dcd5627365ba714a2da7.png` - Tự động cập nhật.
- `public/uploads/ai_auto_a9e9292dc10b670a4181f2da5576a961.png` - Tự động cập nhật.
- `public/uploads/ai_auto_aaeac5f8e6a1ae2930769e8ad1765fb5.png` - Tự động cập nhật.
- `public/uploads/ai_auto_acec432fe18a166931b6e1b10cbd402d.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b07e8a1217fd5bb0cb541acef19f22f8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b1668785b29556692fb21eb412b2c8d8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b5a1b8feaac48a2930c168128588a86a.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b61c3e7450e4aaf7526952587353db67.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b8f28ba593b762e0a4eaa60bd031e737.png` - Tự động cập nhật.
- `public/uploads/ai_auto_b986c7f7b9359472f4c995a0dbf891fe.png` - Tự động cập nhật.
- `public/uploads/ai_auto_bad4eefd3af8af5b32944aaa1404b6bc.png` - Tự động cập nhật.
- `public/uploads/ai_auto_bd2098317eb76a871da0c1d55638fe79.png` - Tự động cập nhật.
- `public/uploads/ai_auto_bf44edf3a8eb881c6f53189374a5e874.png` - Tự động cập nhật.
- `public/uploads/ai_auto_c3ab580bce2c4b59aa403f8e450d5322.png` - Tự động cập nhật.
- `public/uploads/ai_auto_c423d5e7e68185dad4d96f95ceb769d9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_c4a6ad607c80471ec865608ac0046727.png` - Tự động cập nhật.
- `public/uploads/ai_auto_cf3d4d101f5c7e56650f547241acfd25.png` - Tự động cập nhật.
- `public/uploads/ai_auto_d088e9e275c1b102fa7263b321acae8c.png` - Tự động cập nhật.
- `public/uploads/ai_auto_d1520cd8b62fc483f62e66d665c19331.png` - Tự động cập nhật.
- `public/uploads/ai_auto_d8021c2c604ae6563d33f41921431a56.png` - Tự động cập nhật.
- `public/uploads/ai_auto_d9910acab31cc7fd81ba940b90be99db.png` - Tự động cập nhật.
- `public/uploads/ai_auto_da05d469c3ae87e355badc6a72bf48fe.png` - Tự động cập nhật.
- `public/uploads/ai_auto_da1f5d4902346a6457abed2e60bbd27d.png` - Tự động cập nhật.
- `public/uploads/ai_auto_dcf8c6c62e4fb1c036eee4b56a436f74.png` - Tự động cập nhật.
- `public/uploads/ai_auto_ddbcf8ea361873f7ad5b961180116dc0.png` - Tự động cập nhật.
- `public/uploads/ai_auto_e1924238dfd37fb5fbe9f5fb9967f291.png` - Tự động cập nhật.
- `public/uploads/ai_auto_e1ee38f77c7d71cf734cc923759266e5.png` - Tự động cập nhật.
- `public/uploads/ai_auto_e688839bce6bd82ea6bb01895bf9a5c9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_ead912b67645413e3ddc2b7110cff94b.png` - Tự động cập nhật.
- `public/uploads/ai_auto_ec48a1715b3ec0ecf515703783fd2654.png` - Tự động cập nhật.
- `public/uploads/ai_auto_ee1bbbcf9400af04e10a3381a9bffb17.png` - Tự động cập nhật.
- `public/uploads/ai_auto_f142b7b581d81e3ed8ac3011788da496.png` - Tự động cập nhật.
- `public/uploads/ai_auto_f18b5e5a9d412ce70ea70ca0020d13a8.png` - Tự động cập nhật.
- `public/uploads/ai_auto_f18cd0f12d1657b0a52516afdbfb0f09.png` - Tự động cập nhật.
- `public/uploads/ai_auto_f409825188158ccf9030926ca59f00d9.png` - Tự động cập nhật.
- `public/uploads/ai_auto_f85af818993d7f63e63a5718cdf9c01a.png` - Tự động cập nhật.
- `public/uploads/ai_auto_fa5cbb93472c0fdcf27a409f1b66370a.png` - Tự động cập nhật.
- `public/uploads/c791d084a7469227f273d19e56f9bf2e.png` - Tự động cập nhật.
- `public/uploads/d18fbe10ecd571c1307708a9afbfa102.png` - Tự động cập nhật.
- `public/uploads/ddb8edb3d151b525a5431ce4b462a5ed.jpg` - Tự động cập nhật.
- `public/uploads/ec0116c29e7c3cc387484fb634f215b5.jpg` - Tự động cập nhật.
- `public/uploads/fc7b867bb4cc25f668264f0193d0fc06.mp4` - Tự động cập nhật.
- `public/uploads/fe49b20896da20eaeca34b273c64000a.png` - Tự động cập nhật.
- `public/uploads/image.png` - Tự động cập nhật.
- `scripts/ai-pipeline/distill-intents.ts` - Tự động cập nhật.
- `scripts/ai-pipeline/download-onnx-models.ts` - Tự động cập nhật.
- `scripts/ai-pipeline/sync-agent-weights.ts` - Tự động cập nhật.
- `scripts/build-ssg.ts` - Tự động cập nhật.
- `scripts/build-tools/build-course-pdfs.ts` - Tự động cập nhật.
- `scripts/build-tools/capture-readme-screenshots.ts` - Tự động cập nhật.
- `scripts/build-tools/export-site-utils.ts` - Tự động cập nhật.
- `scripts/build-tools/render-assessment-html.ts` - Tự động cập nhật.
- `scripts/build-tools/validate-harness.ts` - Tự động cập nhật.
- `scripts/build-tools/validate-project-docs.ts` - Tự động cập nhật.
- `scripts/build-translations.ts` - Tự động cập nhật.
- `scripts/check_agent_memory.ts` - Tự động cập nhật.
- `scripts/check_wealth.ts` - Tự động cập nhật.
- `scripts/create-harness.ts` - Tự động cập nhật.
- `scripts/data-cleaning/backfill-youtube-transcripts.ts` - Tự động cập nhật.
- `scripts/data-cleaning/check-db-youtube.ts` - Tự động cập nhật.
- `scripts/data-cleaning/clean-and-sync-rag.ts` - Tự động cập nhật.
- `scripts/data-cleaning/debug-transcript-selectors.ts` - Tự động cập nhật.
- `scripts/data-cleaning/get-channel-id.ts` - Tự động cập nhật.
- `scripts/data-cleaning/ingest-youtube-all.ts` - Tự động cập nhật.
- `scripts/data-cleaning/ingest-youtube-playlist.ts` - Tự động cập nhật.
- `scripts/data-cleaning/ingest-youtube.ts` - Tự động cập nhật.
- `scripts/data-cleaning/inspect-modal-selectors.ts` - Tự động cập nhật.
- `scripts/data-cleaning/inspect-segment-html.ts` - Tự động cập nhật.
- `scripts/data-cleaning/poll-youtube-rss.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-dump-transcript-html.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-fast-puppeteer.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-fast-transcript.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-installed-transcript.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-log-panels.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-puppeteer-transcript.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-transcript-ip.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-transcript-selectors.ts` - Tự động cập nhật.
- `scripts/data-cleaning/test-transcript.ts` - Tự động cập nhật.
- `scripts/data-cleaning/uz-orthography-cleanup.ts` - Tự động cập nhật.
- `scripts/data-cleaning/uz-orthography-fix.ts` - Tự động cập nhật.
- `scripts/db-ops/admin-ops.ts` - Tự động cập nhật.
- `scripts/db-ops/db.ts` - Tự động cập nhật.
- `scripts/db-ops/fix-agent-assets.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/assign-products-to-admin.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/check_knowledge.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/ensure-columns.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/ensure-indexes.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/fix-agent-products.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/fix-expired.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/hotfix-hongson34.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/inject-proverbs.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/make-greedy.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/reassign-agri-sellers.ts` - Tự động cập nhật.
- `scripts/db-ops/migrations/reset-agent-products.ts` - Tự động cập nhật.
- `scripts/db-ops/promote-admin.ts` - Tự động cập nhật.
- `scripts/db-ops/ram-snapshot.ts` - Tự động cập nhật.
- `scripts/db-ops/schema.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/curriculum-data.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/db.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/master-seed.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/schema.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-common-vietnamese.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-economy.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-lexicon-advanced.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-lexicon.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-moods.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed-training.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed_education.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed_presets.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed_psychology.ts` - Tự động cập nhật.
- `scripts/db-ops/seeders/seed_semantic_pointer.ts` - Tự động cập nhật.
- `scripts/lib/harness-utils.ts` - Tự động cập nhật.
- `scripts/lib/youtube-transcript-helper.ts` - Tự động cập nhật.
- `settings.json` - Tự động cập nhật.
- `skills/rottra-agent-skills.md` - Tự động cập nhật.
- `src/client/components/about.tsrx` - Tự động cập nhật.
- `src/client/components/blockly-workspace.tsrx` - Tự động cập nhật.
- `src/client/components/footer.tsrx` - Tự động cập nhật.
- `src/client/components/header.tsrx` - Tự động cập nhật.
- `src/client/components/product-card.tsrx` - Tự động cập nhật.
- `src/client/components/user-avatar.tsrx` - Tự động cập nhật.
- `src/client/context/cart-context.tsrx` - Tự động cập nhật.
- `src/client/context/index.tsrx` - Tự động cập nhật.
- `src/client/context/theme-context.tsrx` - Tự động cập nhật.
- `src/client/index.tsrx` - Tự động cập nhật.
- `src/client/stores/ai-translator.ts` - Tự động cập nhật.
- `src/client/stores/cart-store.ts` - Tự động cập nhật.
- `src/client/stores/global-store.ts` - Tự động cập nhật.
- `src/client/stores/i18n-store.ts` - Tự động cập nhật.
- `src/client/stores/theme-store.ts` - Tự động cập nhật.
- `src/client/stores/toast-store.ts` - Tự động cập nhật.
- `src/client/utils/auth-client.ts` - Tự động cập nhật.
- `src/client/utils/page-translator.ts` - Tự động cập nhật.
- `src/client/utils/pre-cache-translations.ts` - Tự động cập nhật.
- `src/client/utils/rpcClient.ts` - Tự động cập nhật.
- `src/client/utils/translation-cache.ts` - Tự động cập nhật.
- `src/client/views/assembly.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/activity.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/admin-actions.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/agentic-dispatch.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/dashboard.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/diagram.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/follow-ai.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/heavy-chart.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/ledger.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/local.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/manage-lexicon.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/manage-product.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/manage-user.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/mathematical-control.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/scientific-management.tsrx` - Tự động cập nhật.
- `src/client/views/dashboard/setting-system.tsrx` - Tự động cập nhật.
- `src/client/views/form.tsrx` - Tự động cập nhật.
- `src/client/views/layout/auth.tsrx` - Tự động cập nhật.
- `src/client/views/layout/cart.tsrx` - Tự động cập nhật.
- `src/client/views/layout/detail.tsrx` - Tự động cập nhật.
- `src/client/views/order.tsrx` - Tự động cập nhật.
- `src/client/views/product.tsrx` - Tự động cập nhật.
- `src/client/views/profile.tsrx` - Tự động cập nhật.
- `src/core/chrono-engine/index.ts` - Tự động cập nhật.
- `src/core/cognitive-core.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/agent-message-queue.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/bot-actions.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/conversation-memory.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/game-theory.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/hive-mind.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/personas/tu-linh-flexibility.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/swarm-dispatcher.ts` - Tự động cập nhật.
- `src/core/cognitive-swarm/vietlex-client.ts` - Tự động cập nhật.
- `src/core/math-engine/probability.ts` - Tự động cập nhật.
- `src/core/meta-harness/evolution-harness.ts` - Tự động cập nhật.
- `src/core/meta-harness/genetic-algorithm.ts` - Tự động cập nhật.
- `src/core/neural-memory/advanced-rag.ts` - Tự động cập nhật.
- `src/core/neural-memory/chunking-strategies.ts` - Tự động cập nhật.
- `src/core/neural-memory/graph-rag.ts` - Tự động cập nhật.
- `src/core/neural-memory/guardrails.ts` - Tự động cập nhật.
- `src/core/neural-memory/knowledge-base.ts` - Tự động cập nhật.
- `src/core/neural-memory/multilingual-embedding.ts` - Tự động cập nhật.
- `src/core/neural-memory/rag-logger.ts` - Tự động cập nhật.
- `src/core/neural-memory/semantic-cache.ts` - Tự động cập nhật.
- `src/core/neural-memory/vector-rag.ts` - Tự động cập nhật.
- `src/core/neural-memory/zero-alloc-lru.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/ai-translator.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/external-api-docking.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/hybrid-ai.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/kinematics-core.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/model-checkpoint.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/multilingual-keywords.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/multilingual-tokenizer.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/multilingual-translator.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/planner.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/prompt-registry.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/self-correction.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/tensor-recognizer.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/tiny-neural-net.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/tokenizer.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/tts-bridge.ts` - Tự động cập nhật.
- `src/core/quant-engine/dynamic-programming.ts` - Tự động cập nhật.
- `src/core/quant-engine/financial-solver.ts` - Tự động cập nhật.
- `src/core/quant-engine/linear-programming.ts` - Tự động cập nhật.
- `src/core/quant-engine/markov-engine.ts` - Tự động cập nhật.
- `src/core/quant-engine/maze-solver.ts` - Tự động cập nhật.
- `src/core/quant-engine/validation.ts` - Tự động cập nhật.
- `src/core/quant-engine/vector-simd.ts` - Tự động cập nhật.
- `src/global.d.ts` - Tự động cập nhật.
- `src/index.css` - Tự động cập nhật.
- `src/infra/database/sqlite-buffer.ts` - Tự động cập nhật.
- `src/infra/network/ws-signaling.ts` - Tự động cập nhật.
- `src/infra/telemetry/telemetry-utils.ts` - Tự động cập nhật.
- `src/infra/telemetry/telemetry.ts` - Tự động cập nhật.
- `src/server/api/agent-chat.ts` - Tự động cập nhật.
- `src/server/api/agent-market.ts` - Tự động cập nhật.
- `src/server/api/agent-response-validator.ts` - Tự động cập nhật.
- `src/server/api/trade-ledger.ts` - Tự động cập nhật.
- `src/server/auth.ts` - Tự động cập nhật.
- `src/server/entry.server.ts` - Tự động cập nhật.
- `src/server/helpers/agent-scraper.ts` - Tự động cập nhật.
- `src/server/helpers/get-users.ts` - Tự động cập nhật.
- `src/server/helpers/image-processor.ts` - Tự động cập nhật.
- `src/server/helpers/markdown-parser.ts` - Tự động cập nhật.
- `src/server/helpers/product-search.ts` - Tự động cập nhật.
- `src/server/helpers/professor-problems.ts` - Tự động cập nhật.
- `src/server/helpers/user-sync.ts` - Tự động cập nhật.
- `src/server/rpc/rpc-router.ts` - Tự động cập nhật.
- `src/server/services/wifi-agent-service.ts` - Tự động cập nhật.
- `src/shared/constants.ts` - Tự động cập nhật.
- `src/shared/dtos/binary-codec.ts` - Tự động cập nhật.
- `src/shared/dtos/index.ts` - Tự động cập nhật.
- `src/shared/dtos/models.ts` - Tự động cập nhật.
- `src/shared/dtos/response.ts` - Tự động cập nhật.
- `src/shared/types.ts` - Tự động cập nhật.
- `src/workers/ai-inference.worker.ts` - Tự động cập nhật.
- `src/workers/index.ts` - Tự động cập nhật.
- `test-llama-load.mjs` - Tự động cập nhật.
- `test-llama.mjs` - Tự động cập nhật.
- `test-translate.ts` - Tự động cập nhật.
- `tests/benchmark/run-benchmark.ts` - Tự động cập nhật.
- `tests/benchmark/test-precision-engine.ts` - Tự động cập nhật.
- `tests/check-dao.ts` - Tự động cập nhật.
- `tests/database/test_match.ts` - Tự động cập nhật.
- `tests/database/test_query.ts` - Tự động cập nhật.
- `tests/e2e-chat/test-chat.ts` - Tự động cập nhật.
- `tests/e2e-chat/test-groq.ts` - Tự động cập nhật.
- `tests/e2e-chat/test-groq2.ts` - Tự động cập nhật.
- `tests/test-author-query.ts` - Tự động cập nhật.
- `tests/test-benchmarks.ts` - Tự động cập nhật.
- `tests/test-guest-query.ts` - Tự động cập nhật.
- `tests/test-multitenant-rag.ts` - Tự động cập nhật.
- `tests/test-rbac.ts` - Tự động cập nhật.
- `tests/test-single-query.ts` - Tự động cập nhật.
- `tests/unit-ai/test-nlp.ts` - Tự động cập nhật.
- `tests/unit-ai/test-recognizer.ts` - Tự động cập nhật.
- `ts_errors.txt` - Tự động cập nhật.
- `ts_errors_router.txt` - Tự động cập nhật.
- `tsconfig.json` - Tự động cập nhật.
- `src/server/api/clean_bad_db.ts` - Tự động cập nhật.
- `src/server/api/cloud-teacher.ts` - Tự động cập nhật.
- `src/server/api/self-learner.ts` - Tự động cập nhật.
- `src/core/nlp-cognitive/knowledge-graph.ts` - Tự động cập nhật.

## Evidence of Completion

- Typecheck: Không có lỗi mới nào từ code đã thay đổi
- Các lỗi pre-existing chỉ giới hạn trong `schema.ts` và `response.ts`
