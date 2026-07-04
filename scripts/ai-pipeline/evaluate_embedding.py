#!/usr/bin/env python3
"""
🧠 ROTTRA — EMBEDDING MODEL EVALUATION
Compare original bge-m3 vs fine-tuned bge-m3-rottra on domain-specific tasks.

Usage:
    python evaluate_embedding.py [--original BAAI/bge-m3] [--finetuned ./output/bge-m3-rottra/final]

Metrics:
    1. Domain Retrieval Accuracy — agriculture Q&A retrieval
    2. Cross-lingual Similarity — VI↔EN alignment
    3. Hard Negative Discrimination — similar but different intent separation
    4. Matryoshka Quality — performance at reduced dimensions
"""

import json
import argparse
import time
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate embedding models")
    parser.add_argument("--original", default="BAAI/bge-m3",
                        help="Original model name or path")
    parser.add_argument("--finetuned", default="scripts/ai-pipeline/output/bge-m3-rottra/final",
                        help="Fine-tuned model path")
    parser.add_argument("--data_dir", default="scripts/data-cleaning/output",
                        help="Directory with evaluation data")
    parser.add_argument("--dims", nargs="+", type=int, default=[128, 256, 512, 1024],
                        help="Dimensions to test for Matryoshka evaluation")
    return parser.parse_args()


# ── Metrics ───────────────────────────────────────────────────

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return dot / norm if norm > 0 else 0.0


def recall_at_k(sim_matrix: np.ndarray, k: int = 5) -> float:
    """Recall@K: fraction of queries where correct doc is in top-K."""
    hits = 0
    for i in range(len(sim_matrix)):
        top_k = np.argsort(sim_matrix[i])[-k:][::-1]
        if i in top_k:
            hits += 1
    return hits / len(sim_matrix)


def mrr(sim_matrix: np.ndarray) -> float:
    """Mean Reciprocal Rank."""
    total = 0.0
    for i in range(len(sim_matrix)):
        ranked = np.argsort(sim_matrix[i])[::-1]
        rank = np.where(ranked == i)[0][0] + 1
        total += 1.0 / rank
    return total / len(sim_matrix)


def ndcg_at_k(sim_matrix: np.ndarray, k: int = 10) -> float:
    """NDCG@K."""
    total = 0.0
    for i in range(len(sim_matrix)):
        ranked = np.argsort(sim_matrix[i])[-k:][::-1]
        rank_pos = np.where(ranked == i)[0]
        if len(rank_pos) > 0:
            rank = rank_pos[0] + 1
            total += 1.0 / np.log2(rank + 1)
    return total / len(sim_matrix)


# ── Evaluation Tasks ──────────────────────────────────────────

def load_eval_data(data_dir: str) -> List[Dict]:
    """Load evaluation triplets."""
    data_dir = Path(data_dir)
    triplets = []

    triplet_path = data_dir / "triplets.jsonl"
    if triplet_path.exists():
        with open(triplet_path) as f:
            for line in f:
                if line.strip():
                    triplets.append(json.loads(line))

    # Use last 100 for evaluation
    return triplets[-100:] if len(triplets) > 100 else triplets


def eval_domain_retrieval(model: SentenceTransformer, data: List[Dict], dims: List[int]) -> Dict:
    """Evaluate domain-specific retrieval accuracy."""
    queries = [d["query"] for d in data]
    corpus = [d["positive"] for d in data]

    all_results = {}

    for dim in dims:
        t0 = time.time()
        q_embs = model.encode(queries, normalize_embeddings=True)
        c_embs = model.encode(corpus, normalize_embeddings=True)
        encode_time = time.time() - t0

        # Truncate to target dim
        q_embs_d = q_embs[:, :dim]
        c_embs_d = c_embs[:, :dim]

        # Similarity matrix
        sim = q_embs_d @ c_embs_d.T

        results = {
            "recall@1": recall_at_k(sim, k=1),
            "recall@5": recall_at_k(sim, k=5),
            "mrr": mrr(sim),
            "ndcg@10": ndcg_at_k(sim, k=10),
            "encode_time_ms": encode_time * 1000,
            "dim": dim,
        }
        all_results[f"dim_{dim}"] = results

    return all_results


def eval_cross_lingual(model: SentenceTransformer) -> Dict:
    """Evaluate cross-lingual alignment (VI↔EN)."""
    vi_texts = [
        "công thức tính năng suất lúa",
        "giá cam sành hôm nay",
        "bón phân NPK cho cây trồng",
        "dự báo thời tiết mùa vụ",
        "quản lý chuỗi cung ứng nông sản",
    ]
    en_texts = [
        "rice yield calculation formula",
        "pomelo price today",
        "NPK fertilizer for crops",
        "seasonal weather forecast",
        "agricultural supply chain management",
    ]

    vi_embs = model.encode(vi_texts, normalize_embeddings=True)
    en_embs = model.encode(en_texts, normalize_embeddings=True)

    # Compute pairwise similarities
    sims = []
    for i in range(len(vi_texts)):
        sim = cosine_similarity(vi_embs[i], en_embs[i])
        sims.append(sim)

    # Also compute off-diagonal (should be lower)
    off_diag_sims = []
    for i in range(len(vi_texts)):
        for j in range(len(en_texts)):
            if i != j:
                sim = cosine_similarity(vi_embs[i], en_embs[j])
                off_diag_sims.append(sim)

    return {
        "vi_en_diagonal_mean": np.mean(sims),
        "vi_en_diagonal_std": np.std(sims),
        "off_diagonal_mean": np.mean(off_diag_sims),
        "alignment_gap": np.mean(sims) - np.mean(off_diag_sims),
    }


def eval_hard_negative_discrimination(model: SentenceTransformer, data: List[Dict]) -> Dict:
    """Evaluate ability to discriminate hard negatives."""
    queries = [d["query"] for d in data[:50]]
    positives = [d["positive"] for d in data[:50]]
    negatives = [d["negative"] for d in data[:50]]

    all_texts = queries + positives + negatives
    all_embs = model.encode(all_texts, normalize_embeddings=True)

    q_embs = all_embs[:len(queries)]
    p_embs = all_embs[len(queries):2*len(queries)]
    n_embs = all_embs[2*len(queries):]

    pos_sims = [cosine_similarity(q_embs[i], p_embs[i]) for i in range(len(queries))]
    neg_sims = [cosine_similarity(q_embs[i], n_embs[i]) for i in range(len(queries))]

    # Margin: how much more similar positive is vs negative
    margins = [pos_sims[i] - neg_sims[i] for i in range(len(queries))]

    return {
        "positive_mean_sim": np.mean(pos_sims),
        "negative_mean_sim": np.mean(neg_sims),
        "mean_margin": np.mean(margins),
        "margin_std": np.std(margins),
        "discrimination_rate": sum(1 for m in margins if m > 0) / len(margins),
    }


# ── Main ──────────────────────────────────────────────────────

def main():
    args = parse_args()

    print("═" * 60)
    print("  ROTTRA EMBEDDING EVALUATION")
    print("═" * 60)

    # Load data
    print("\n📦 Loading evaluation data...")
    data = load_eval_data(args.data_dir)
    print(f"  {len(data)} evaluation samples")

    # Load models
    print(f"\n📦 Loading original model: {args.original}")
    original = SentenceTransformer(args.original, trust_remote_code=True)
    original.max_seq_length = 512

    finetuned = None
    finetuned_path = Path(args.finetuned)
    if finetuned_path.exists():
        print(f"📦 Loading fine-tuned model: {args.finetuned}")
        finetuned = SentenceTransformer(str(finetuned_path), trust_remote_code=True)
        finetuned.max_seq_length = 512
    else:
        print(f"⚠️  Fine-tuned model not found at {args.finetuned}")
        print("  Running evaluation on original model only.")

    # Evaluate
    models = [("original", original)]
    if finetuned:
        models.append(("finetuned", finetuned))

    all_results = {}
    for name, model in models:
        print(f"\n{'─' * 40}")
        print(f"  Evaluating: {name}")
        print(f"{'─' * 40}")

        # Domain retrieval
        print("  Running domain retrieval...")
        retrieval = eval_domain_retrieval(model, data, args.dims)
        print(f"  Recall@1 (1024d): {retrieval['dim_1024']['recall@1']:.3f}")
        print(f"  Recall@5 (1024d): {retrieval['dim_1024']['recall@5']:.3f}")
        print(f"  MRR: {retrieval['dim_1024']['mrr']:.3f}")

        # Cross-lingual
        print("  Running cross-lingual eval...")
        cross_lingual = eval_cross_lingual(model)
        print(f"  VI↔EN alignment: {cross_lingual['vi_en_diagonal_mean']:.3f}")
        print(f"  Alignment gap: {cross_lingual['alignment_gap']:.3f}")

        # Hard negatives
        print("  Running hard negative discrimination...")
        hard_neg = eval_hard_negative_discrimination(model, data)
        print(f"  Discrimination rate: {hard_neg['discrimination_rate']:.3f}")
        print(f"  Mean margin: {hard_neg['mean_margin']:.3f}")

        all_results[name] = {
            "retrieval": retrieval,
            "cross_lingual": cross_lingual,
            "hard_negative": hard_neg,
        }

    # Comparison
    if finetuned:
        print(f"\n{'═' * 60}")
        print("  COMPARISON: original vs finetuned")
        print(f"{'═' * 60}")

        for metric in ["recall@1", "recall@5", "mrr", "ndcg@10"]:
            orig = all_results["original"]["retrieval"]["dim_1024"][metric]
            ft = all_results["finetuned"]["retrieval"]["dim_1024"][metric]
            delta = ft - orig
            symbol = "✅" if delta >= 0 else "❌"
            print(f"  {symbol} {metric}: {orig:.3f} → {ft:.3f} ({delta:+.3f})")

        for metric in ["vi_en_diagonal_mean", "alignment_gap"]:
            orig = all_results["original"]["cross_lingual"][metric]
            ft = all_results["finetuned"]["cross_lingual"][metric]
            delta = ft - orig
            symbol = "✅" if delta >= 0 else "❌"
            print(f"  {symbol} {metric}: {orig:.3f} → {ft:.3f} ({delta:+.3f})")

        for metric in ["discrimination_rate", "mean_margin"]:
            orig = all_results["original"]["hard_negative"][metric]
            ft = all_results["finetuned"]["hard_negative"][metric]
            delta = ft - orig
            symbol = "✅" if delta >= 0 else "❌"
            print(f"  {symbol} {metric}: {orig:.3f} → {ft:.3f} ({delta:+.3f})")

    # Save results
    output_path = Path(args.data_dir).parent / "evaluation_results.json"
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n📊 Results saved to {output_path}")

    print(f"\n{'═' * 60}")
    print("  EVALUATION COMPLETE")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
