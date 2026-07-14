# Rottra Architecture Map — AI Self-Reference Guide

> This document is the canonical self-description of the Rottra system.
> AI agents read this to understand what exists, where to find it, and how data flows.

---

## 1. System Overview

**Rottra** = Premium Agricultural E-commerce + Intelligent Autonomous AI Agent System

| Layer | Technology | Entry Point |
|-------|-----------|-------------|
| Frontend | SolidJS + TailwindCSS 4.0 | `src/client/index.tsrx` |
| Backend | Hono (HTTP/WS) on Bun | `src/routes/api/[...paths].ts` |
| Database | PostgreSQL via Drizzle ORM | `src/infra/database/db-pool.ts` |
| AI Core | 126+ TypeScript files | `src/core/` |
| Workers | Web Workers + SQLite WAL | `src/workers/` |
| Deploy | Cloudflare Pages + Workers | `wrangler.json` |

---

## 2. Directory Map

```
rottra/
├── src/
│   ├── client/           # SolidJS frontend
│   │   ├── views/        # Page components (11 views)
│   │   ├── components/   # Shared UI components
│   │   ├── stores/       # Signal-based state (5 stores)
│   │   ├── context/      # SolidJS context providers (2)
│   │   ├── lib/          # Utilities, RPC client
│   │   └── helpers/      # Client-side helpers
│   ├── core/             # AI BRAIN — 16 modules, 126+ files
│   │   ├── cognitive-swarm/    # Multi-agent reasoning (23 files)
│   │   ├── nlp-cognitive/      # NLP & intent engine (45 files)
│   │   ├── neural-memory/      # RAG & vector memory (15 files)
│   │   ├── quant-engine/       # Math/financial engine (10 files)
│   │   ├── meta-harness/       # Evolutionary optimization (8 files)
│   │   ├── ml-pipeline/        # ML training pipeline (8 files)
│   │   ├── federated-learning/ # Privacy-preserving FL (7 files)
│   │   ├── knowledge-graph/    # In-memory graph DB
│   │   ├── math-engine/        # Math primitives (4 files)
│   │   ├── analytics/          # Marketplace analytics
│   │   ├── chrono-engine/      # Time-based simulation catch-up
│   │   ├── mobile/             # Mobile offline-first backend
│   │   ├── saas/               # White-label SaaS engine
│   │   └── supply-chain/       # Autonomous supply chain
│   ├── server/           # Backend API layer
│   │   ├── api/          # 29 API route files (~120 endpoints)
│   │   ├── services/     # Embedding, RAG retriever, WiFi agent
│   │   ├── rpc/          # Hono RPC router
│   │   ├── helpers/      # Scraper, SEO, media, moderation
│   │   └── middlewares/  # Auth guard, rate limiter
│   ├── infra/            # Infrastructure
│   │   ├── database/     # Drizzle ORM schema + connection
│   │   ├── network/      # WebRTC signaling + sensor ingestion
│   │   └── telemetry/    # Activity logging + perf metrics
│   ├── orchestration/    # Central AI coordination
│   │   ├── chat-coordinator.ts     # Main chat pipeline
│   │   └── meeting-coordinator.ts  # Multi-agent negotiation
│   ├── shared/           # Types, constants, DTOs, utilities
│   ├── workers/          # Background workers (3 files)
│   └── routes/           # Hono catch-all route
├── drizzle/              # Database migrations
├── scripts/              # Build tools, AI pipeline, DB ops
├── tests/                # Test suites
├── docs/                 # Documentation (this file lives here)
└── skills/               # AI agent skill definitions
```

---

## 3. AI Core Modules — What Each Does

### 3.1 cognitive-swarm/ (23 files) — Multi-Agent AI Brain

| File | What It Does | Used By |
|------|-------------|---------|
| `swarm-dispatcher.ts` | **CENTRAL AI ORCHESTRATOR** — RottraAI.chat(). Fast-path detection, semantic cache, RAG, ReAct tool calling, ToT negotiation, predictive coding, QA loops, personality, RLHF, evolutionary updates | `agent-chat.ts` |
| `hive-mind.ts` | System metrics (RAM, temp), "Tu Linh" brain parameters, multi-agent state | `swarm-dispatcher` |
| `multi-agent-negotiation.ts` | Nash equilibrium, PSO/GWO/DE strategies, English/Dutch/Vickrey auctions, tit-for-tat | `meeting-coordinator`, `ledger` |
| `chain-of-thought.ts` | 8 CoT strategies: sequential, branching, recursive, analogical, causal, deductive, inductive, abductive | `tree-of-thought`, `meta-evaluator` |
| `tree-of-thought.ts` | BFS + beam search tree reasoning | `meta-evaluator` |
| `autonomous-goal-setting.ts` | Self-directed goals, plans, risk assessment, adaptive replanning | **ORPHANED — not wired** |
| `game-theory.ts` | Market decisions, stock trading, sabotage/defense, agent interaction | `swarm-dispatcher`, `meeting-coordinator` |
| `emotion-recognition.ts` | 8-dimension emotion detection (joy, sadness, anger, fear, surprise, disgust, trust, anticipation), sentiment, urgency | `chain-of-thought`, `cross-domain` |
| `cross-domain-learning.ts` | Knowledge transfer across agriculture, finance, tech, health, education, logistics | `chain-of-thought`, `ledger` |
| `utility-ai.ts` | Game-engine-style utility AI decision scoring | `swarm-dispatcher` |
| `alphastar-brain.ts` | Behavior Tree + Actor-Critic RL + A* pathfinding + imitation learning | `meta-evaluator` |
| `alphastar-transformer-brain.ts` | Transformer variant of AlphaStar brain | `meta-evaluator` |
| `muzero-planner.ts` | MCTS model-based planner (Representation/Dynamics/Prediction networks) | `meta-evaluator` |
| `ai-risk-classification.ts` | OpenAI-style risk assessment (5 domains, 4 severity levels) | Standalone |
| `macro-events.ts` | Drought, bumper harvest, inflation, trade war, pandemic event modifiers | `swarm-dispatcher` |
| `bot-actions.ts` | Marketplace bot actions: create/edit products, SVG images, carts, orders, reviews | `swarm-dispatcher` |
| `conversation-memory.ts` | LRU cache (200 conversations, 20 messages), importance scoring, auto-summarization | `swarm-dispatcher` |
| `adaptive-personality.ts` | Big Five (OCEAN) personality adaptation based on conversation history | `swarm-dispatcher` |
| `vietlex-client.ts` | Vietnamese law database (Pricing Law, Commerce Law, Food Safety Law) | `multi-agent-negotiation` |
| `agent-message-queue.ts` | PostgreSQL-backed async message queue for inter-agent communication | `swarm-dispatcher` |
| `skills/skill-registry.ts` | ReAct tool-calling skill registry | `swarm-dispatcher` |
| `personas/tu-linh-flexibility.ts` | Adaptive persona engine | `hive-mind` |

### 3.2 nlp-cognitive/ (45 files) — NLP & Intent Engine

| File | What It Does | Used By |
|------|-------------|---------|
| `tokenizer.ts` | **NLP BACKBONE** — 6-stage intent classification: exact match → fuzzy → centroid → Graph-SDM → LLM → fallback. Vietnamese normalization, accent removal, online learning | `cognitive-core`, `swarm-dispatcher` |
| `ai-sdk.ts` | Unified local LLM text generation. `mapBotId()` maps 12 agent IDs | `swarm-dispatcher`, `hive-mind` |
| `domain-training-data.ts` | Training utterance/intent/answer triples for intent classification | `tokenizer` |
| `prompt-registry.ts` | Template-based prompt rendering for cached responses | `cognitive-core` |
| `self-correction.ts` | Post-classification intent correction from known error patterns | `cognitive-core` |
| `intent-centroids.ts` | Embedding-based centroid classifier | `tokenizer` |
| `graph-sdm-hybrid.ts` | SDM + knowledge graph hybrid pattern recall | `tokenizer` |
| `multilingual-tokenizer.ts` | Vietnamese + multilingual tokenization | `tokenizer` |
| `multilingual-translator.ts` | 6-language translation (VI, EN, ZH, JA, FI, HE) | `agent-chat` |
| `sentiment-engine.ts` | Sentiment analysis | `chain-of-thought` |
| `safety-guard.ts` | Content safety/moderation | `cognitive-core` |
| `sdm-engine.ts` | Sparse Distributed Memory pattern storage/recall | `tokenizer` |
| `vectorizer.ts` | Text vectorization | `tokenizer` |
| `vocabulary-engine.ts` | Vocabulary management | `tokenizer` |
| `vietnamese-fuzzy.ts` | Vietnamese fuzzy string matching | `tokenizer` |
| `coreference-resolver.ts` | Multi-turn coreference resolution | `agent-chat` |
| `hippocampus.ts` | Episodic memory module | `agent-chat` |
| `amygdala.ts` | Emotion processing | `agent-chat` |
| `basal-ganglia.ts` | Action selection (L0-L7 layers) | `agent-chat` |
| `recognition.ts` | Pattern recognition | `swarm-dispatcher` |
| `tensor-recognizer.ts` | Tensor-based pattern recognition | `recognition` |
| `tiny-neural-net.ts` | Tiny neural net with Adam optimizer | `ml-pipeline` |
| `mlp-network.ts` | Multi-layer perceptron | `ml-pipeline` |
| `planner.ts` | Task planning | `cognitive-core` |
| `reward-model.ts` | RLHF-style reward model | `swarm-dispatcher` |
| `rlaif-feedback.ts` | RLAIF (RL from AI Feedback) | `self-learner` |
| `meta-evaluator.ts` | Meta-evaluation of model outputs | `swarm-dispatcher` |
| `response-normalizer.ts` | Response formatting | `cognitive-core` |
| `reflex-templates.ts` | Pre-built reflex responses | `tokenizer` |
| `nlp-intent-parser.ts` | Intent parsing utilities | `agent-chat` |
| `ts-intent-classifier.ts` | TypeScript-native intent classifier | `tokenizer` |
| `ai-translator.ts` | AI translation | `agent-chat` |
| `tts-bridge.ts` | Text-to-speech bridge | `agent-chat` |
| `vision-brain.ts` | Image understanding | `agent-chat` |
| `youtube-learner.ts` | YouTube content ingestion | `youtube-watcher` |
| `book-scholar.ts` | Document analysis | `agent-chat` |
| `kinematics-core.ts` | Kinematics calculations | `mathematical-control` view |
| `quaternion-cortex.ts` | Quaternion rotation math | `mathematical-control` view |
| `mcp-client.ts` | MCP (Model Context Protocol) client | `swarm-dispatcher` |
| `external-api-docking.ts` | External API integration | `swarm-dispatcher` |

### 3.3 neural-memory/ (15 files) — RAG & Vector Memory

| File | What It Does | Used By |
|------|-------------|---------|
| `vector-rag.ts` | **CORE RAG ENGINE** — hybrid sparse+dense retrieval, BFS graph traversal, semantic reranking, HyDE, LLM verifier, self-attention fusion, LLM Wiki compiler, zero-alloc vector pool | `cognitive-core`, `swarm-dispatcher` |
| `advanced-rag.ts` | HyDE, step-back prompting, query decomposition, contextual compression | `swarm-dispatcher` |
| `knowledge-base.ts` | Static agricultural knowledge base | `vector-rag` |
| `multilingual-embedding.ts` | BGE-M3 multilingual (1024-dim) + TF-IDF fallback (256-dim) | `vector-rag` |
| `multimodal-embedding.ts` | Text + image classification embeddings | `vector-rag` |
| `guardrails.ts` | Input/output content safety | `cognitive-core` |
| `semantic-cache.ts` | Semantic query caching | `vector-rag` |
| `chunking-strategies.ts` | Smart/agricultural-aware/fixed/sliding/paragraph chunking | `vector-rag` |
| `graph-rag.ts` | Graph-based RAG (CSR graph, semantic beam search, MMR) | `RottraPrivateBrain` only |
| `cache-warmer.ts` | Pre-warms caches on startup | `chat-coordinator` |
| `hf-transformers.ts` | HuggingFace local inference | `multilingual-embedding` |
| `market-simulator.ts` | Agent-based market simulation | `swarm-dispatcher` |
| `nanogpt.ts` | NanoGPT-style small LM | Standalone |
| `rag-logger.ts` | RAG retrieval logging | `vector-rag` |
| `zero-alloc-lru.ts` | Zero-allocation LRU cache | `vector-rag` |

### 3.4 quant-engine/ (10 files) — Math/Financial Engine

| File | What It Does | Used By |
|------|-------------|---------|
| `financial-solver.ts` | "Casio Quantum" — safe math expressions + custom solvers (NPV, IRR, break-even, TSP, Wardrop, Kalman, Shannon, cobweb, confusion matrix) | `agent-chat` |
| `dynamic-programming.ts` | Bounded knapsack solver for trade optimization | `swarm-dispatcher` |
| `linear-programming.ts` | Supply-demand market equilibrium via LP | `supply-chain` |
| `markov-engine.ts` | MDP, HMM (Viterbi/Baum-Welch), MCMC (Metropolis-Hastings/Gibbs) | `supply-chain` |
| `q-learning.ts` | Q-learning RL for market trading (Hold/Buy/Sell) | `swarm-dispatcher` |
| `maze-solver.ts` | 0-1 BFS maze solver for logistics | `supply-chain` |
| `electromagnetism.ts` | Physics model: cross product, magnetic field, attract/repulse | `vector-rag` |
| `soa-vector-pool.ts` | SoA vector pool — millions of embeddings in flat Float32Array | `vector-rag` |
| `vector-simd.ts` | Zero-allocation vector math (add, scale, dot, norm, lerp) | `vector-rag` |
| `validation.ts` | Integration test harness | `scripts/` |

### 3.5 meta-harness/ (8 files) — Evolutionary & Swarm Optimization

| File | What It Does | Used By |
|------|-------------|---------|
| `genetic-algorithm.ts` | Classic GA with elitism for agent DNA evolution | `self-evolving` |
| `cma-es.ts` | CMA-ES for continuous parameter optimization | `swarm-dispatcher` |
| `differential-evolution.ts` | DE/rand/1 for robust parameter optimization | `multi-agent-negotiation` |
| `particle-swarm.ts` | PSO + MOPSO | `multi-agent-negotiation` |
| `grey-wolf.ts` | GWO + IGWO + MGWO | `multi-agent-negotiation` |
| `llm-evolution.ts` | LLM-driven Auto-EA: LLM designs EA components | Standalone |
| `evolution-harness.ts` | Shared evolution utilities | `genetic-algorithm` |

### 3.6 ml-pipeline/ (8 files) — ML Training Pipeline

| File | What It Does | Used By |
|------|-------------|---------|
| `classifier.ts` | NaiveBayes, LogisticRegression, KNN, DecisionTree (CART), SVM (linear), Ensemble | `ml-pipeline API` |
| `regressor.ts` | Linear, Polynomial, Ridge, Lasso regression | `ml-pipeline API` |
| `clusterer.ts` | KMeans, DBSCAN, Hierarchical clustering | `ml-pipeline API` |
| `evaluator.ts` | Accuracy, Precision, Recall, F1, MSE, MAE, R2, Silhouette, Confusion Matrix | `classifier`, `regressor`, `clusterer` |
| `feature-engine.ts` | Tokenization, BoW, TF-IDF, normalization | `classifier`, `regressor` |
| `auto-trainer.ts` | Auto-selects best classifier, tunes hyperparams | `ml-pipeline API` |
| `model-store.ts` | In-memory model persistence | `ml-pipeline API` |

### 3.7 federated-learning/ (7 files) — Privacy-Preserving ML

| File | What It Does | Used By |
|------|-------------|---------|
| `coordinator.ts` | Orchestrates FL rounds: start → collect → aggregate → broadcast | `fl-api`, `fl-router` |
| `gradient-exchange.ts` | Secure gradient exchange between nodes | `fl-api` |
| `local-trainer.ts` | Local model training on nodes | `coordinator` |
| `privacy-engine.ts` | Differential privacy (epsilon/delta tracking, gradient clipping, noise) | `fl-api`, `fl-router` |
| `byzantine-fault-tolerance.ts` | Detects/excludes malicious nodes during aggregation | `fl-api`, `fl-router` |
| `blockchain-audit.ts` | SHA-256 provenance chain for FL model versions | `fl-router` |

### 3.8 Other Core Modules

| Module | What It Does |
|--------|-------------|
| `knowledge-graph/` | In-memory graph DB: typed nodes, weighted edges, BFS traversal, fuzzy search, shortest path. Seeds Vietnamese agricultural data |
| `math-engine/` | 4x4 matrix, probability/combinatorics, code-golf interpreter, quant array language VM |
| `analytics/` | Price prediction (exponential smoothing + linear regression), supply-demand, farmer metrics, market overview |
| `chrono-engine/` | Server uptime tracking, offline catch-up simulation |
| `mobile/` | Offline-first sync, push notifications, WebAuthn biometric auth |
| `saas/` | Multi-tenant white-label: tenants, branding, subscriptions, invoices, usage limits |
| `supply-chain/` | HMM demand forecasting, dynamic pricing, order fulfillment, supply chain health |

---

## 4. Database Schema — 47 Tables

### 4.1 Auth & Users (4 tables)

```
user ──────── session (userId FK)
  │ ├──────── account (userId FK)
  │ └──────── verification
```

### 4.2 E-Commerce (6 tables)

```
user ──────── Product (sellerId FK)
  │ ├──────── Cart (userId FK → user, productId FK → Product)
  │ ├──────── Order (userId FK → user)
  │ │   └──── OrderItem (orderId FK → Order, productId FK → Product)
  │ ├──────── Review (userId FK → user, productId FK → Product)
  │ └──────── File (userId FK → user)
```

### 4.3 Agriculture & IoT (4 tables)

```
user ──────── Farm (ownerId FK)
  │           ├── CropSeason (farmId FK)
  │           └── SensorData (farmId FK, cropSeasonId FK)
```

### 4.4 AI Agent System (7 tables)

```
AgentMemory    — sessionId, contextKey/Value, importanceScore, personality DNA (greed, vengeance, malice)
AgentTask      — title, description, status, taskType, scheduledFor
AgentTraining  — intent, utterance, answer (training data for intent classification)
ChatSummary    — sessionId, summaryText, keywords
AiDrawingPath  — productName, points (JSONB)
AiModels       — weightsJson, lastUpdated
RlQTable       — stateHash, actionId, qValue, visitCount
```

### 4.5 NLP & Logging (6 tables)

```
NaturalLanguageLog    — query, intent, confidence, entropy, wordFrequencies
FeedbackLog           — query, intent, rating, score
ResponseVersionLog    — query, intent, version, confidence, latencyMs
LogRollup             — rollupHour, intentDistribution (compressed log archive)
VietnameseLexicon     — word, type, definition, relations
BilingualCorpus       — vi, en, zh, ja, fi, he
```

### 4.6 Blockchain & Trade (3 tables)

```
BlockchainLedger  — batchId, action, dataPayload, previousHash, currentHash (immutable chain)
NegotiationLog    — sessionId, round, sellerId, buyerId, offers, finalizedPrice, losses
DpoTrainingData   — prompt, chosenResponse, rejectedResponse
```

### 4.7 Research (4 tables)

```
ResearchProject ─── ProjectTask (projectId FK)
  │ ├───────────── LabNotebook (projectId FK)
  │ └───────────── StatisticalReport (projectId FK)
```

### 4.8 Federated Learning (5 tables)

```
fl_round ───── fl_gradient_update (roundId FK)
  │ └───────── fl_model_version (roundId FK)
fl_node ─────── fl_privacy_budget (nodeId FK)
```

### 4.9 ML/AI Modules (12 tables — NOT yet in migration pipeline)

```
ml_model, ml_training_run, evolution_session, ab_test,
curriculum_plan, ml_chat_config, turing_test_session,
turing_test_participant, turing_test_round, turing_test_leaderboard,
edu_progress, edu_quiz_attempt
```

### 4.10 Other (4 tables)

```
SeoCache, StrategyPreset, VectorDocument, SystemSetting, Activity
```

---

## 5. API Surface — ~120 Endpoints

### 5.1 Main Chat Pipeline

```
POST /api/chat                   → SSE streaming → handleAgentChat() → RottraAI.chat()
POST /api/agent/chat-expert      → Direct chat (non-streaming)
POST /api/agent/suggest          → AI suggestions
```

### 5.2 Agent Meeting & Negotiation

```
POST /api/agent/meeting-chat     → handleMeetingChat() → multi-agent negotiation
POST /api/agent/sync-assets      → Sync budgets/products/skills
WS   /ws-signaling               → WebRTC signaling + trade-sync broadcasts
```

### 5.3 E-Commerce

```
GET  /api/product                → List products
POST /api/admin/product          → CRUD products
POST /api/admin/product/:id/image → AI SVG image generation
POST /api/admin/product/:id/video → Video ad generation
GET  /api/orders                 → List orders
POST /api/orders                 → Create order
POST /api/orders/:id/pay         → Payment (VietQR)
GET  /api/cart / POST /api/cart  → Cart management
GET  /api/profile/:userId        → User profile
POST /api/profile                → Update profile
```

### 5.4 AI/ML Pipeline

```
POST /ml/classify/train          → Train classifier
POST /ml/classify/predict        → Predict with classifier
POST /ml/regress/train           → Train regressor
POST /ml/cluster/run             → Run clustering
POST /ml/auto-train              → Auto-train best model
GET  /ml/models                  → List trained models
```

### 5.5 Self-Evolving AI

```
GET  /self-evolving/metrics      → Performance metrics
POST /self-evolving/evolve/start → Start genetic evolution
POST /self-evolving/ab/create    → A/B test
GET  /self-evolving/curriculum   → Training curriculum
```

### 5.6 Federated Learning

```
POST /fl/rounds/start            → Start FL round
POST /fl/rounds/:id/submit-gradient → Submit gradient
GET  /fl/global-model            → Global model
POST /fl/verify-model            → Blockchain provenance check
GET  /fl/nodes                   → List FL nodes
```

### 5.7 Knowledge Graph

```
GET  /kg/stats / GET /kg/nodes   → Graph CRUD
POST /kg/seed                    → Seed agricultural data
GET  /kg/path                    → Shortest path
POST /kg/search                  → Fuzzy search
```

### 5.8 Other APIs

```
POST /sensors/ingest             → IoT sensor data
POST /ledger/record              → Blockchain ledger entry
POST /ledger/trace/:batchId      → Trace batch provenance
POST /ledger/self-play           → Swarm self-play simulation
POST /ledger/negotiate           → Multi-agent negotiation + Nash
POST /turing/session/*           → Turing test game
GET  /education/*                → AI education platform
POST /creative/*                 → Creative engine (image/music/video/text)
POST /media/*                    → Local media generation
```

### 5.9 Auth

```
POST /api/auth/signin            → Better Auth email/password
POST /api/auth/signup            → Registration
```

### 5.10 RPC

```
GET  /rpc/products               → Product list (typed RPC)
POST /rpc/strategy-presets       → Strategy preset CRUD
POST /rpc/agent-analyze-radar    → AI radar chart analysis
GET  /rpc/lexicons               → Vietnamese lexicon CRUD
POST /rpc/bilingual-corpus/search → 6-language search
POST /rpc/rl/reward              → RL Q-value update
POST /rpc/rl/recommend           → RL product recommendation
```

---

## 6. Data Flow — How Everything Connects

### 6.1 Chat Flow (Most Critical)

```
User types message
  → POST /api/chat (SSE)
  → handleAgentChat() in orchestration/chat-coordinator.ts
    → Coreference resolution (coreference-resolver.ts)
    → Vietnamese normalization (tokenizer.ts)
    → Intent classification (tokenizer.ts: 6-stage pipeline)
    → BasalGanglia fast routing (basal-ganglia.ts: L0-L7)
    → If System 1 (<0.7 confidence): template/reflex/cache response
    → If System 2 (>0.7): RottraAI.chat() (swarm-dispatcher.ts)
      → Semantic cache lookup
      → RAG retrieval (vector-rag.ts: hybrid sparse+dense)
      → Context injection (HyDE, advanced RAG)
      → ReAct tool calling (skills/skill-registry.ts)
      → Tree-of-Thoughts reasoning
      → Predictive coding swarm flow
      → QA critique loops
      → Personality adaptation (adaptive-personality.ts)
      → Guardrails check (guardrails.ts)
    → Response validation (agent-response-validator.ts)
    → Log to NaturalLanguageLog (batched via LogRingBuffer)
    → Stream SSE chunks to frontend
```

### 6.2 Agent Meeting Flow

```
Assembly UI → WebSocket message
  → ws-signaling.ts → meeting-coordinator.ts
    → Load agent personality DNA from AgentMemory
    → Load agent profile (budget, gold, stocks)
    → Game theory: predatory product assortment
    → Phi_Price pricing formula
    → RottraPrivateBrain entropy influence
    → Generate response with trade directives
    → Broadcast to room participants
```

### 6.3 Write Buffer Flow

```
High-throughput writes (NegotiationLog, BlockchainLedger, DpoTrainingData)
  → SQLite WAL buffer (src/infra/database/sqlite-buffer.ts)
  → db-flusher.worker.ts (every 5s, batch 500 records)
  → PostgreSQL (batch INSERT with onConflictDoNothing)
```

### 6.4 Frontend State Flow

```
SolidJS Signals/Stores
  → cart-store.ts (localStorage + /api/cart sync)
  → theme-store.ts (localStorage + server preference)
  → i18n-store.ts (IndexedDB cache + /api/translate-dynamic)
  → global-store.ts (selectedProduct signal)
  → Context providers: ThemeProvider, CartProvider
```

---

## 7. Key Extension Points

### Where to add new AI capabilities:

| Location | How | Example |
|----------|-----|---------|
| New intent category | Add to `tokenizer.ts` SEMANTIC_ANCHORS + `domain-training-data.ts` | Adding WEATHER intent |
| New chat tool | Add to `skills/skill-registry.ts` | Adding database query tool |
| New API endpoint | Add route in `src/server/api/` + mount in `[...paths].ts` | New /api/forecast endpoint |
| New DB table | Add to `src/infra/database/schema.ts` + run `drizzle-kit push` | New analytics table |
| New ML model | Add to `src/core/ml-pipeline/classifier.ts` | Adding XGBoost |
| New negotiation strategy | Add to `multi-agent-negotiation.ts` | Adding auction mechanism |
| New bot persona | Add to `ai-sdk.ts` mapBotId() + user.profile in DB | Adding 13th agent |
| New RAG source | Add to `vector-rag.ts` chunking + embedding pipeline | Adding document type |

---

## 8. Known Issues & Orphaned Code

### Orphaned Modules (implemented but not wired):

| Module | Status |
|--------|--------|
| `autonomous-goal-setting.ts` | Not called from main pipeline |
| `theory-of-mind.ts` | Integrated in agent-chat but minimal usage |
| `pad-emotional-model.ts` | Integrated but emotional state not used in decisions |
| `federated-knowledge.ts` | Integrated but federated context is minimal |
| `social-learning.ts` | Integrated but autocurriculum not triggered |
| `chain-of-thought.ts` | Exists but only used by meta-evaluator indirectly |
| `tree-of-thought.ts` | Exists but only used by meta-evaluator indirectly |
| `graph-rag.ts` | Only used by RottraPrivateBrain, not main pipeline |
| `llm-evolution.ts` | Standalone, no integration |
| `nanogpt.ts` | Standalone, no integration |
| DPO training data | Collected in DpoTrainingData table but no training loop consumes them |
| LLM Wiki Compiler | `compileToLlmWiki()` exists but no trigger mechanism |

### Unintegrated DB Schema:

- 12 tables in `ai-modules-schema.ts` are NOT re-exported from `schema.ts`
- These tables won't be created by `drizzle-kit push`
- Need to be added to schema.ts and migration pipeline

---

## 9. 12 AI Agent Personas

| ID | Name | Faction | Role |
|----|------|---------|------|
| 1 | Tô Lương | Nguyệt Quang | Merchant |
| 2 | Thương Nguyệt | Nguyệt Quang | Trader |
| 3 | Trầm Tình | Nguyệt Quang | Analyst |
| 4 | Đào Tiểu Cữu | Nguyệt Quang | Negotiator |
| 5 | Hoa Huỳnh | Nguyệt Quang | Strategist |
| 6 | Phi Nguyệt | Nguyệt Quang | Advisor |
| 7 | Như Nguyệt | Nguyệt Quang | Specialist |
| 8 | Sư Gia | Nguyệt Quang | Expert |
| 9 | Phi Ánh | Quang Minh | Agent |
| 10 | Bách Di Hành | Quang Minh | Agent |
| 11 | U Vương Mẫu | Quang Minh | Agent |
| 12 | Bạch Lộc | Quang Minh | Agent |

Each has: budget, gold reserves, stock holdings, skill level, personality DNA (greed, vengeance, malice), employee count.

---

## 10. Quick Reference — "Where Do I Find X?"

| I need to... | Go to |
|-------------|-------|
| Change how chat responses are generated | `src/core/cognitive-swarm/swarm-dispatcher.ts` |
| Add a new intent | `src/core/nlp-cognitive/tokenizer.ts` (SEMANTIC_ANCHORS) + `domain-training-data.ts` |
| Modify RAG retrieval | `src/core/neural-memory/vector-rag.ts` |
| Change negotiation logic | `src/core/cognitive-swarm/multi-agent-negotiation.ts` |
| Add a new API endpoint | `src/server/api/` + mount in `src/routes/api/[...paths].ts` |
| Add a database table | `src/infra/database/schema.ts` + run `drizzle-kit push` |
| Add a new ML algorithm | `src/core/ml-pipeline/classifier.ts` or `regressor.ts` |
| Modify agent personality | `src/core/cognitive-swarm/adaptive-personality.ts` or DB `AgentMemory` |
| Change auth flow | `src/server/auth.ts` (better-auth) + `src/server/middlewares/auth-guard.ts` |
| Add frontend view | `src/client/views/` (`.tsrx` for existing, `.tsx` in `ai/` for new) |
| Modify state management | `src/client/stores/` (signal-based stores) |
| Change database connection | `src/infra/database/db-pool.ts` |
| Add background worker | `src/workers/` |
| Modify WebRTC signaling | `src/infra/network/ws-signaling.ts` |
| Add sensor type | `src/infra/network/sensor-ingestion.ts` (SENSOR_THRESHOLDS) |
| Modify creative engine | `src/server/api/creative-engine.ts` |
| Add to knowledge graph | `src/core/knowledge-graph/kg-core.ts` |
| Modify supply chain logic | `src/core/supply-chain/autonomous-supply-chain.ts` |
| Change evolutionary optimization | `src/core/meta-harness/` (GA, PSO, GWO, DE, CMA-ES) |
| Add federated learning feature | `src/core/federated-learning/` + `src/server/api/fl-api.ts` |
| Modify AI education content | `src/server/api/ai-education.ts` |
| Change Turing test logic | `src/server/api/turing-test.ts` |
