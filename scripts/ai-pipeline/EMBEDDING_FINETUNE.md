# 🧠 Embedding Fine-Tune Pipeline

Fine-tune bge-m3 for Vietnamese Agriculture domain.

## Pipeline Overview

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. Data Export      │ ──▶ │  2. Fine-Tune    │ ──▶ │  3. Export ONNX │
│  (TypeScript)       │     │  (Python)        │     │  (Python)       │
│                     │     │                  │     │                 │
│  triplets.jsonl     │     │  bge-m3-rottra   │     │  model.onnx     │
│  pairs.jsonl        │     │  (fine-tuned)    │     │  (quantized)    │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────┐
                                                    │  4. Integrate   │
                                                    │  (TypeScript)   │
                                                    │                 │
                                                    │  public/models/ │
                                                    └─────────────────┘
```

## Quick Start

### Step 1: Export Training Data
```bash
bun scripts/data-cleaning/export-embedding-training-data.ts
```
Output: `scripts/data-cleaning/output/`

### Step 2: Fine-Tune
```bash
cd scripts/ai-pipeline
pip install -r requirements.txt
python fine_tune_embedding.py --epochs 3 --lr 2e-5 --batch 16
```
Output: `scripts/ai-pipeline/output/bge-m3-rottra/final/`

### Step 3: Evaluate
```bash
python evaluate_embedding.py --finetuned ./output/bge-m3-rottra/final
```
Output: `scripts/ai-pipeline/output/evaluation_results.json`

### Step 4: Export ONNX
```bash
python export_to_onnx.py --model ./output/bge-m3-rottra/final --output public/models/bge-m3-rottra
```
Output: `public/models/bge-m3-rottra/`

### Step 5: Update TypeScript
```typescript
// src/core/neural-memory/multilingual-embedding.ts
const EMBEDDING_MODEL = "bge-m3-rottra"; // or local path
```

## Data Sources

| Source | Count | Format |
|--------|-------|--------|
| Product catalog | 927 | (query, positive, negative) |
| Domain training pairs | 328 | (query, positive, negative) |
| Agent training Q&A | 35 | (query, positive, negative) |
| VectorDocument RAG | 18 | (query, positive, negative) |
| Bilingual corpus | 92 | (vi, en, zh, ja) |
| Knowledge base | 6 | (title, content) |
| Chat messages | 4 | (user, assistant) |

## Training Strategy

### MultipleNegativesRankingLoss
- Contrastive learning with hard negatives
- In-batch negatives + explicit negatives from export

### Matryoshka Representation Learning
- Flexible dimensions: 128, 256, 512, 1024
- Allows using smaller embeddings for faster inference
- Rottra fallback: TF-IDF 256-dim, Primary: bge-m3 1024-dim

### Hyperparameters
| Param | Default | Notes |
|-------|---------|-------|
| epochs | 3 | More epochs may overfit |
| lr | 2e-5 | Conservative for domain adaptation |
| batch | 16 | Scale with GPU memory |
| max_seq_length | 512 | Matches bge-m3 max |
| warmup_ratio | 0.1 | Linear warmup |
| weight_decay | 0.01 | Regularization |

## Evaluation Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Recall@1 | > 0.8 | Correct doc in top-1 |
| Recall@5 | > 0.95 | Correct doc in top-5 |
| MRR | > 0.85 | Mean reciprocal rank |
| NDCG@10 | > 0.9 | Normalized discounted cumulative gain |
| VI↔EN alignment | > 0.7 | Cross-lingual semantic similarity |
| Discrimination rate | > 0.9 | Hard negative separation |

## Hardware Requirements

- **Minimum**: 8GB RAM, CPU training (slow)
- **Recommended**: 16GB+ RAM, CUDA GPU (RTX 3060+)
- **Optimal**: 24GB+ VRAM, A100/H100

CPU training is possible but will take ~10x longer.
Use `--fp16` flag for GPU training acceleration.
