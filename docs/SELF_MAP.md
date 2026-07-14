# Rottra — AI Self-Documentation Map

> Bản đồ này giúp AI hiểu chính nó: các module, dữ liệu đến từ đâu, đi về đâu, và cách chúng kết nối.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Map](#2-module-map)
3. [Data Flow Map](#3-data-flow-map)
4. [Database Schema Map](#4-database-schema-map)
5. [API Surface Map](#5-api-surface-map)
6. [Frontend → Backend Flow](#6-frontend--backend-flow)
7. [AI Pipeline — How a Query Flows](#7-ai-pipeline--how-a-query-flows)
8. [Module Dependency Graph](#8-module-dependency-graph)
9. [Key Patterns](#9-key-patterns)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ROTTRA ARCHITECTURE                        │
├─────────────┬──────────────────┬────────────────────────────┤
│  Frontend   │     Backend      │        Infrastructure       │
│  SolidJS    │     Hono         │        PostgreSQL            │
│  Vite 7.x  │     Bun 1.3      │        SQLite WAL            │
│  Tailwind 4 │     Better Auth  │        WebSocket (8080)      │
│  Router     │     Drizzle ORM  │        WebRTC P2P            │
│  Kobalte    │     ~120 endpoints│        Cloudflare Workers    │
└─────────────┴──────────────────┴────────────────────────────┘
```

**Tech Stack:**
- **Runtime:** Bun 1.3.14
- **Backend:** Hono 4.x (HTTP framework)
- **Frontend:** SolidJS 1.9 (reactive UI)
- **Database:** PostgreSQL 15+ (primary), SQLite (WAL buffer)
- **Auth:** better-auth (email/password, JWT sessions)
- **ORM:** Drizzle ORM 0.45
- **Styling:** TailwindCSS 4.0 (OKLCH color space)
- **Build:** Vite 7.x
- **Deploy:** Cloudflare Workers / SST

---

## 2. Module Map

### 2.1 Core AI Modules (`src/core/`)

| Module | Path | Purpose | Data In → Data Out |
|--------|------|---------|-------------------|
| **cognitive-core** | `core/cognitive-core.ts` | Central orchestrator: intent → RAG → guardrails → response | User query → `CognitiveResponse` |
| **cognitive-swarm** | `core/cognitive-swarm/` | Multi-agent AI brain: chat pipeline, negotiation, reasoning | User query + DB state → AI response |
| **neural-memory** | `core/neural-memory/` | RAG system: vector retrieval, caching, chunking | Query + documents → Ranked context |
| **nlp-cognitive** | `core/nlp-cognitive/` | NLP engine: intent classification, tokenization, sentiment | Raw text → Intent + entities |
| **quant-engine** | `core/quant-engine/` | Math solver, RL, Markov, LP, DP | Math/logic queries → Solutions |
| **meta-harness** | `core/meta-harness/` | Optimization: GA, PSO, GWO, DE, CMA-ES | Parameters → Optimal values |
| **ml-pipeline** | `core/ml-pipeline/` | ML: classifier, regressor, clusterer, auto-trainer | Training data → Trained models |
| **knowledge-graph** | `core/knowledge-graph/` | In-memory graph with nodes/edges, BFS, shortest path | Concepts → Graph relationships |
| **federated-learning** | `core/federated-learning/` | Privacy-preserving distributed ML | Gradients → Global model |
| **math-engine** | `core/math-engine/` | Matrix, probability, code golf, quant array | Math expressions → Results |
| **analytics** | `core/analytics/` | Price prediction, supply-demand, farmer metrics | Market data → Insights |
| **chrono-engine** | `core/chrono-engine/` | Time-based simulation catch-up on restart | Server downtime → Missed events |
| **supply-chain** | `core/supply-chain/` | Demand forecasting, dynamic pricing, order fulfillment | Supply data → Forecasts |
| **saas** | `core/saas/` | Multi-tenant white-label SaaS engine | Tenant config → Branded app |
| **mobile** | `core/mobile/` | Offline-first mobile backend, push, WebAuthn | Mobile client ↔ Sync protocol |

### 2.2 Server Layer (`src/server/`)

| Module | Path | Purpose |
|--------|------|---------|
| **agent-router** | `server/api/agent-router.ts` | Main agent API: image gen, market forecast, scraping, brain params |
| **agent-chat** | `server/api/agent-chat.ts` | Chat expert: NLP → intent → routing → response |
| **chat-stream** | `server/api/chat-stream.ts` | SSE streaming chat proxy |
| **ml-pipeline** | `server/api/ml-pipeline.ts` | ML train/predict/evaluate endpoints |
| **kg-api** | `server/api/kg-api.ts` | Knowledge Graph CRUD + search |
| **sensor-api** | `server/api/sensor-api.ts` | IoT sensor ingestion + anomaly detection |
| **fl-api/fl-router** | `server/api/fl-*.ts` | Federated Learning round management |
| **trade-ledger** | `server/api/trade-ledger.ts` | Blockchain ledger, negotiation, auction, goals |
| **creative-routes** | `server/api/creative-routes.ts` | Image/music/video/text generation |
| **self-evolving** | `server/api/self-evolving.ts` | Self-evolving AI: metrics, A/B tests, curriculum |
| **turing-test** | `server/api/turing-test.ts` | Turing test game sessions |
| **ai-education** | `server/api/ai-education.ts` | AI education content + quizzes |
| **self-learner** | `server/api/self-learner.ts` | Auto-teach, feedback recording, retrain |
| **rl-engine** | `server/api/rl-engine.ts` | Q-learning for product recommendation |
| **rl-brain** | `server/api/rl-brain.ts` | Neural network (MLP) for RL |
| **auth** | `server/auth.ts` | better-auth config |
| **middlewares** | `server/middlewares/` | Auth guard, rate limiter |

### 2.3 Orchestration (`src/orchestration/`)

| Module | Path | Purpose |
|--------|------|---------|
| **chat-coordinator** | `orchestration/chat-coordinator.ts` | Central nervous system: boot, NLP pipeline, background jobs |
| **meeting-coordinator** | `orchestration/meeting-coordinator.ts` | Multi-agent negotiation chat |

### 2.4 Infrastructure (`src/infra/`)

| Module | Path | Purpose |
|--------|------|---------|
| **db-pool** | `infra/database/db-pool.ts` | PostgreSQL connection pool (singleton) |
| **schema** | `infra/database/schema.ts` | 30 active DB tables |
| **fl-schema** | `infra/database/fl-schema-additions.ts` | 5 FL tables |
| **ai-modules-schema** | `infra/database/ai-modules-schema.ts` | 12 AI tables (NOT in migration) |
| **sqlite-buffer** | `infra/database/sqlite-buffer.ts` | WAL write buffer |
| **ws-signaling** | `infra/network/ws-signaling.ts` | WebRTC P2P signaling (port 8080) |
| **sensor-ingestion** | `infra/network/sensor-ingestion.ts` | IoT sensor pipeline |
| **telemetry** | `infra/telemetry/telemetry.ts` | API activity logging |

### 2.5 Workers (`src/workers/`)

| Worker | Path | Purpose |
|--------|------|---------|
| **db-flusher** | `workers/db-flusher.worker.ts` | SQLite WAL → PostgreSQL flush (5s interval) |
| **ai-inference** | `workers/ai-inference.worker.ts` | Background Jaccard similarity + TF-IDF |
| **worker-pool** | `workers/index.ts` | Thread pool manager (2 workers) |

---

## 3. Data Flow Map

### 3.1 High-Level Data Flow

```
                         ┌──────────────────┐
                         │   USER/BROWSER    │
                         │   SolidJS App     │
                         └────────┬─────────┘
                                  │ HTTP/WebSocket
                                  ▼
                         ┌──────────────────┐
                         │   HONO SERVER     │
                         │   (Bun Runtime)   │
                         ├──────────────────┤
                         │  ┌──────────────┐ │
                         │  │ Auth Guard   │ │ ← better-auth JWT
                         │  │ Rate Limiter │ │
                         │  └──────┬───────┘ │
                         │         │         │
                         │  ┌──────▼───────┐ │
                         │  │ API Routers  │ │ ← 20+ routers, ~120 endpoints
                         │  └──────┬───────┘ │
                         │         │         │
                         │  ┌──────▼───────┐ │
                         │  │ Orchestrator │ │ ← chat-coordinator.ts
                         │  └──────┬───────┘ │
                         │         │         │
                         └─────────┼─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌──────────┐  ┌──────────┐  ┌──────────────┐
            │  NLP/Cognitive  │  │  ML/Quant   │  │  DB/Storage    │
            │  Engine        │  │  Engine     │  │  PostgreSQL    │
            └──────────┘  └──────────┘  └──────────────┘
```

### 3.2 Chat Request Flow (Detailed)

```
User types message
    │
    ▼
POST /api/chat (SSE stream)
    │
    ▼
┌─────────────────────────────────────────────┐
│ 1. Pre-processing                           │
│    - Vietnamese shorthand normalization      │
│    - Coreference resolution                  │
│    - Query reinterpretation (LLM)           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 2. Intent Classification                    │
│    tokenizer.ts → classifyIntent()          │
│    6-stage pipeline:                         │
│    1. Exact semantic anchor match            │
│    2. Fuzzy anchor (Jaccard bigram)          │
│    3. Centroid embedding classification      │
│    4. Graph-SDM hybrid pattern recall        │
│    5. LLM few-shot classification           │
│    6. Fallback → SEARCH                      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 3. Fast Path Check                          │
│    - Greetings → cached response             │
│    - Math → evaluateMathExpression()         │
│    - Semantic cache hit → return cached      │
└─────────────────┬───────────────────────────┘
                  │ (if no fast path)
                  ▼
┌─────────────────────────────────────────────┐
│ 4. RAG Retrieval                            │
│    - HyDE (hypothetical document)           │
│    - Advanced RAG strategies                │
│    - VectorDocument table search             │
│    - Knowledge graph traversal               │
│    - Semantic reranking                      │
│    - Self-attention fusion                   │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 5. Response Generation                      │
│    - BasalGanglia fast routing               │
│    - Chain-of-Thought / Tree-of-Thought     │
│    - Cognitive Swarm (multi-agent)          │
│    - Private Brain personality               │
│    - Guardrails (input/output safety)       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ 6. Post-processing                          │
│    - Response validation & sanitization     │
│    - Product image assignment                │
│    - LogRingBuffer → DB batching            │
│    - Agent memory save                      │
│    - SSE stream to frontend                 │
└─────────────────────────────────────────────┘
```

---

## 4. Database Schema Map

### 4.1 Table Overview (47 tables total, 35 active)

```
PostgreSQL Database: rottra
├── Auth & Users (4 tables)
│   ├── user              (root entity)
│   ├── session           (JWT sessions)
│   ├── account           (OAuth providers)
│   └── verification      (email verification)
│
├── E-Commerce (6 tables)
│   ├── Product           (center of commerce)
│   ├── Cart              (user → product)
│   ├── Order             (user orders)
│   ├── OrderItem         (order line items)
│   ├── Review            (user reviews)
│   └── File              (uploaded files)
│
├── Agriculture & IoT (4 tables)
│   ├── Farm              (farm owner)
│   ├── CropSeason         (season within farm)
│   ├── SensorData         (IoT readings)
│   └── SeoCache           (SEO content cache)
│
├── AI Agent System (7 tables)
│   ├── AgentMemory        (personality DNA, context)
│   ├── AgentTask          (scheduled tasks)
│   ├── AgentTraining      (intent/utterance/answer)
│   ├── ChatSummary        (conversation summaries)
│   ├── AiDrawingPath      (SVG drawing data)
│   ├── AiModels           (neural network weights)
│   └── RlQTable           (Q-learning values)
│
├── NLP & Logging (6 tables)
│   ├── NaturalLanguageLog  (intent classification logs)
│   ├── FeedbackLog         (user feedback)
│   ├── ResponseVersionLog  (response versioning)
│   ├── LogRollup           (hourly rollups)
│   ├── VietnameseLexicon   (vocabulary DB)
│   └── BilingualCorpus     (6-language translation)
│
├── Communication (3 tables)
│   ├── Assembly            (agent meeting rooms)
│   ├── Message             (chat messages)
│   └── ChatMessage         (AI chat history)
│
├── Research (4 tables)
│   ├── ResearchProject     (research projects)
│   ├── ProjectTask         (project tasks)
│   ├── LabNotebook         (lab entries)
│   └── StatisticalReport   (generated reports)
│
├── Blockchain & Trade (3 tables)
│   ├── BlockchainLedger     (immutable hash chain)
│   ├── NegotiationLog       (agent negotiation records)
│   └── DpoTrainingData      (RLHF/DPO pairs)
│
├── ML Models (2 tables)
│   ├── StrategyPreset      (agent strategy configs)
│   └── VectorDocument      (RAG document store)
│
├── Federated Learning (5 tables)
│   ├── fl_round             (FL training rounds)
│   ├── fl_gradient_update   (gradient submissions)
│   ├── fl_model_version     (model snapshots)
│   ├── fl_node              (participating nodes)
│   └── fl_privacy_budget    (differential privacy)
│
└── System (1 table)
    └── SystemSetting         (global config singleton)
```

### 4.2 Key Relationships

```
user ──┬── Product (sellerId)
       ├── Cart (userId)
       ├── Order (userId)
       ├── Review (userId)
       ├── Farm (ownerId)
       ├── Assembly (hostId)
       ├── StrategyPreset (userId)
       ├── ChatMessage (userId)
       └── Activity (userId)

Product ──┬── Cart (productId)
          ├── Review (productId)
          └── OrderItem (productId)

Order ──── OrderItem (orderId)

Farm ─────┬── CropSeason (farmId)
          └── SensorData (farmId)

fl_round ─┬── fl_gradient_update (roundId)
          └── fl_model_version (roundId)

fl_node ── fl_privacy_budget (nodeId)

ResearchProject ──┬── ProjectTask
                  ├── LabNotebook
                  └── StatisticalReport
```

---

## 5. API Surface Map

### 5.1 Endpoint Groups (~120 endpoints)

| Prefix | Router | Key Endpoints |
|--------|--------|---------------|
| `/api/auth/*` | better-auth | signIn, signUp, signOut, session |
| `/api/agent/*` | agentRouter | chat-expert, brain/parameters, scrape, generate-local-image |
| `/api/chat` | chatApp | POST (SSE streaming) |
| `/api/ml/*` | mlPipelineApp | classify/train, regress/train, cluster/run, auto-train |
| `/api/kg/*` | kgApi | nodes, edges, search, path, seed |
| `/api/sensors/*` | sensorApi | ingest, data, summary, anomalies |
| `/api/fl/*` | flApi + flApp | rounds, gradients, nodes, privacy, provenance |
| `/api/ledger/*` | ledgerApp | record, trace, self-play, negotiate, auction, goals |
| `/api/creative/*` | creativeApp | profiles, image, music, video, text, bundle |
| `/api/music/*` | musicApp | generate, profiles, detect-mood |
| `/api/media/*` | mediaApp | image, music, both |
| `/api/ml-chat/*` | mlChatApp | enhance, models, stats |
| `/api/turing/*` | turingTestApp | session, leaderboard, history |
| `/api/self-evolving/*` | selfEvolvingApp | metrics, evolve, ab, curriculum |
| `/api/education/*` | aiEducationApp | content, demo, progress, quiz |
| `/api/rag-debug/*` | ragDebugRouter | test-hit |
| `/api/rpc/*` | rpcApp | products, lexicons, bilingual-corpus, rl/* |
| `/api/product` | productRoutes | GET (list), admin CRUD |
| `/api/orders/*` | orderRoutes | create, pay, approve-preorder |
| `/api/cart` | cartRoutes | GET, POST |
| `/api/profile` | profileRoutes | GET, POST |
| `/api/admin/*` | adminRoutes | users, products, settings, activity |
| `/api/seo/*` | seoRoutes | market, market/links |
| `/api/upload` | uploadRoutes | File upload |

---

## 6. Frontend → Backend Flow

### 6.1 Views & Their API Connections

```
┌─────────────────────────────────────────────────────────┐
│                    SOLIDJS FRONTEND                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─── Layout Views ──────────────────────────────────┐  │
│  │ Home ──────→ GET /api/product, SEO links           │  │
│  │ Detail ────→ Product detail (props)                │  │
│  │ Cart ──────→ GET/POST /api/cart, POST /api/orders  │  │
│  │ Auth ──────→ POST /api/auth/signin|signup          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─── Core Views ────────────────────────────────────┐  │
│  │ Product ───→ CRUD /api/admin/product, AI image     │  │
│  │ Order ─────→ GET/POST /api/orders, VietQR          │  │
│  │ Profile ───→ GET/POST /api/profile, WS trade-sync  │  │
│  │ Assistant ─→ POST /api/chat (SSE), RLHF, DPO       │  │
│  │ Assembly ──→ WS signaling, meeting-chat            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─── AI Views ──────────────────────────────────────┐  │
│  │ ML Training ──→ POST /api/ml/classify|regress      │  │
│  │ AI Education ─→ GET /api/education/*               │  │
│  │ Turing Test ──→ POST /api/turing/*                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─── Dashboard Views ───────────────────────────────┐  │
│  │ Manage Users ──→ GET /api/admin/users              │  │
│  │ Manage Product→ GET /api/admin/product             │  │
│  │ Settings ─────→ GET/POST /api/admin/settings       │  │
│  │ Activity ─────→ GET /api/admin/activity            │  │
│  │ Ledger ───────→ GET /api/ledger/trace/:batchId     │  │
│  │ Follow AI ────→ GET /api/admin/follow-ai/logs      │  │
│  │ Heavy Chart ──→ RPC (Hono typed client)            │  │
│  │ Lexicon ──────→ RPC lexicons CRUD                  │  │
│  │ Bilingual ────→ RPC bilingual-corpus/search        │  │
│  │ Scientific ───→ POST /api/agent/rag-query          │  │
│  │ Math Control ─→ GET /api/agent/math-curriculum     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 6.2 State Management

| Store | Data | Sync |
|-------|------|------|
| `cart-store` | `cartItems` signal | localStorage + POST /api/cart |
| `theme-store` | `theme` signal | localStorage + server prefs |
| `i18n-store` | `translations` store | IndexedDB + POST /api/translate-dynamic |
| `global-store` | `selectedProduct` signal | Client-only |
| `toast-store` | `toasts` signal | Client-only |

---

## 7. AI Pipeline — How a Query Flows

### Entry Points

| Entry Point | File | Trigger |
|-------------|------|---------|
| `POST /api/chat` | `chat-stream.ts` → `chat-coordinator.ts` | User sends message in Assistant view |
| `POST /api/agent/chat-expert` | `agent-chat.ts` | Direct agent API call |
| `POST /api/ledger/self-play` | `trade-ledger.ts` | Agent self-play simulation |
| `POST /api/ledger/negotiate` | `trade-ledger.ts` | Multi-agent negotiation |

### Core Pipeline Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AI PIPELINE                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  INPUT: User Query                                            │
│  │                                                            │
│  ▼                                                            │
│  ┌──────────────────────────┐                                 │
│  │ 1. NLP PRE-PROCESSING   │                                 │
│  │    - Vietnamese normalize │ ← nlp-cognitive/tokenizer.ts  │
│  │    - Coreference resolve  │ ← nlp-cognitive/coreference    │
│  │    - Query reinterpret   │ ← nlp-cognitive/ai-sdk.ts      │
│  └────────────┬─────────────┘                                 │
│               ▼                                                │
│  ┌──────────────────────────┐                                 │
│  │ 2. INTENT CLASSIFICATION │                                 │
│  │    6-stage pipeline:      │ ← tokenizer.ts                 │
│  │    1. Exact match         │                                │
│  │    2. Fuzzy match         │                                │
│  │    3. Centroid classify   │ ← intent-centroids.ts          │
│  │    4. Graph-SDM hybrid    │ ← graph-sdm-hybrid.ts          │
│  │    5. LLM few-shot        │ ← ai-sdk.ts                   │
│  │    6. Fallback SEARCH     │                                │
│  └────────────┬─────────────┘                                 │
│               ▼                                                │
│  ┌──────────────────────────┐                                 │
│  │ 3. FAST PATH             │                                 │
│  │    - Greeting → cache     │ ← prompt-registry.ts           │
│  │    - Math → solver        │ ← quant-engine/financial-solver│
│  │    - Cache hit → return   │ ← neural-memory/semantic-cache  │
│  └────────────┬─────────────┘                                 │
│               ▼ (if no fast path)                              │
│  ┌──────────────────────────┐                                 │
│  │ 4. RAG RETRIEVAL         │                                 │
│  │    - HyDE generate        │ ← neural-memory/advanced-rag    │
│  │    - Vector search        │ ← neural-memory/vector-rag      │
│  │    - KG traversal         │ ← knowledge-graph/kg-core       │
│  │    - Semantic rerank      │ ← neural-memory/vector-rag      │
│  │    - Attention fusion     │ ← neural-memory/vector-rag      │
│  └────────────┬─────────────┘                                 │
│               ▼                                                │
│  ┌──────────────────────────┐                                 │
│  │ 5. REASONING             │                                 │
│  │    - Chain-of-Thought     │ ← cognitive-swarm/chain-of-thought│
│  │    - Tree-of-Thought      │ ← cognitive-swarm/tree-of-thought│
│  │    - Cognitive Swarm      │ ← cognitive-swarm/swarm-dispatcher│
│  │    - Private Brain        │ ← cognitive-swarm/hive-mind     │
│  └────────────┬─────────────┘                                 │
│               ▼                                                │
│  ┌──────────────────────────┐                                 │
│  │ 6. OUTPUT                │                                 │
│  │    - Guardrails           │ ← neural-memory/guardrails      │
│  │    - Validate & sanitize  │ ← server/api/agent-response-val │
│  │    - Log to DB            │ ← orchestration/chat-coordinator│
│  │    - Stream SSE           │                                 │
│  └──────────────────────────┘                                 │
│                                                               │
│  OUTPUT: Response (SSE stream to frontend)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Module Dependency Graph

### 8.1 Core Dependencies (what imports what)

```
cognitive-core
  ├── nlp-cognitive/tokenizer (intent classification)
  ├── nlp-cognitive/prompt-registry (cached responses)
  ├── nlp-cognitive/self-correction (intent correction)
  ├── neural-memory/vector-rag (retrieval)
  ├── neural-memory/advanced-rag (strategies)
  └── neural-memory/guardrails (safety)

cognitive-swarm/swarm-dispatcher (CENTRAL HUB)
  ├── nlp-cognitive/* (all NLP modules)
  ├── neural-memory/* (all RAG modules)
  ├── quant-engine/* (math solvers)
  ├── meta-harness/* (optimization algorithms)
  ├── cognitive-swarm/chain-of-thought
  ├── cognitive-swarm/tree-of-thought
  ├── cognitive-swarm/hive-mind
  ├── cognitive-swarm/multi-agent-negotiation
  ├── cognitive-swarm/game-theory
  ├── cognitive-swarm/emotion-recognition
  ├── cognitive-swarm/cross-domain-learning
  ├── cognitive-swarm/utility-ai
  ├── cognitive-swarm/alphastar-brain
  ├── cognitive-swarm/muzero-planner
  ├── cognitive-swarm/conversation-memory
  ├── cognitive-swarm/adaptive-personality
  ├── server/api/bot-actions
  └── infra/database/* (all DB queries)

neural-memory/vector-rag
  ├── nlp-cognitive/tokenizer
  ├── nlp-cognitive/multilingual-tokenizer
  ├── neural-memory/multilingual-embedding
  ├── neural-memory/chunking-strategies
  ├── neural-memory/semantic-cache
  ├── quant-engine/soa-vector-pool (vector storage)
  └── infra/database/* (VectorDocument table)

meta-harness/* (optimization algorithms)
  ├── No internal dependencies (pure algorithms)
  └── Used by: cognitive-swarm, supply-chain

ml-pipeline/* (ML models)
  ├── No internal dependencies (pure ML)
  └── Used by: ml-pipeline API routes
```

### 8.2 External Dependencies

| Package | Used By | Purpose |
|---------|---------|---------|
| `hono` | All server routes | HTTP framework |
| `drizzle-orm` | All DB operations | ORM |
| `postgres` / `pg` | db-pool.ts | PostgreSQL driver |
| `better-auth` | auth.ts | Authentication |
| `@huggingface/transformers` | neural-memory/hf-transformers | Local model inference |
| `@tensorflow/tfjs` | nlp-cognitive/tiny-neural-net | Neural network inference |
| `puppeteer` | server/helpers/agent-scraper | Web scraping |
| `sharp` | server/helpers/image-processor | Image processing |
| `zod` | Multiple routes | Schema validation |
| `mermaid` | Frontend diagram view | Diagram rendering |
| `leaflet` | Dashboard local view | Map rendering |
| `blockly` | Assembly view | Visual programming |
| `rss-parser` | YouTube watcher | Feed parsing |
| `youtube-transcript` | youtube-learner.ts | Transcript extraction |

---

## 9. Key Patterns

### 9.1 Two-Tier Write Buffering
```
High-frequency writes (NegotiationLog, BlockchainLedger, DpoTrainingData)
    │
    ▼ SQLite WAL Buffer (fast, local)
    │ (every 5 seconds)
    ▼ PostgreSQL (persistent, durable)
```

### 9.2 Streaming AI Responses
```
POST /api/chat → SSE stream
    │
    ├── [TEXT: Hello!]
    ├── [SUGGESTIONS: ["buy", "sell", "hold"]]
    ├── [PRODUCTS_START]...[PRODUCTS_END]
    ├── [VIDEO_URL: ...]
    └── [FALLBACK_MODE]
```

### 9.3 12 AI Agent Characters
```
Two factions:
├── Nguyet Quang (8 agents)
│   ├── Agent 1: Trader (greed=0.8, vengeance=0.3)
│   ├── Agent 2: Analyst
│   ├── ...
│   └── Agent 8: Specialist
│
└── Quang Minh (4 agents)
    ├── Agent 9: Leader
    ├── ...
    └── Agent 12: Strategist

Each agent has:
- Personality DNA (greed, vengeance, malice)
- Budget & gold reserves
- Skill level (15-tier hierarchy)
- Loan parameters
- Employee count
```

### 9.4 Intent Classification Pipeline
```
Input: "giá lúa hôm nay"
    │
    ├── Stage 1: Exact match → "PRICE_CHECK" (score=0.95)
    │   └── Matched semantic anchor: "giá", "lúa"
    │
    ├── Stage 2: If no exact → Fuzzy Jaccard bigram
    ├── Stage 3: If no fuzzy → Centroid embedding
    ├── Stage 4: If no centroid → Graph-SDM hybrid
    ├── Stage 5: If no graph → LLM few-shot
    └── Stage 6: Fallback → SEARCH intent
```

### 9.5 Federated Learning Round
```
1. Coordinator starts round
2. Nodes download global model
3. Nodes train locally on private data
4. Nodes submit encrypted gradients
5. Byzantine fault detection
6. Differential privacy noise added
7. Gradient aggregation (FedAvg)
8. New global model broadcast
9. Provenance chain recorded (blockchain-style)
```

### 9.6 Self-Evolution Loop
```
Performance metrics → Self-assessment
    │
    ├── Low confidence → Auto-teach (LLM)
    ├── User feedback → RLAIF reward model
    ├── A/B testing → Variant comparison
    ├── Genetic evolution → DNA crossover/mutation
    └── Curriculum learning → Structured improvement
```

---

## Appendix: File Quick Reference

### Critical Files (the brain)

| File | Role |
|------|------|
| `src/core/cognitive-core.ts` | Central AI orchestrator |
| `src/core/cognitive-swarm/swarm-dispatcher.ts` | Main chat pipeline (RottraAI) |
| `src/core/nlp-cognitive/tokenizer.ts` | Intent classification (6-stage) |
| `src/core/neural-memory/vector-rag.ts` | RAG retrieval engine |
| `src/orchestration/chat-coordinator.ts` | Server boot + chat handler |
| `src/server/api/agent-chat.ts` | Chat expert endpoint |
| `src/server/api/chat-stream.ts` | SSE streaming proxy |
| `src/infra/database/schema.ts` | Database schema (30 tables) |
| `src/infra/database/db-pool.ts` | PostgreSQL connection |
| `src/workers/db-flusher.worker.ts` | SQLite → PostgreSQL flush |
