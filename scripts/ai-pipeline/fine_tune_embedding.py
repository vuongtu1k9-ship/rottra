#!/usr/bin/env python3
"""
🧠 ROTTRA — EMBEDDING FINE-TUNE SCRIPT
Fine-tune bge-m3 for Vietnamese Agriculture domain.

Usage:
    pip install -r requirements.txt
    python fine_tune_embedding.py [--epochs 3] [--lr 2e-5] [--batch 16] [--output ./output]

Training strategy:
    1. MultipleNegativesRankingLoss — contrastive learning with hard negatives
    2. MatryoshkaRepresentationLearning — flexible dims (128/256/512/1024)
    3. Domain-adaptive — Vietnamese agriculture corpus
"""

import json
import argparse
import os
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from sentence_transformers import (
    SentenceTransformer,
    SentenceTransformerTrainer,
    SentenceTransformerTrainingArguments,
    losses,
)
from sentence_transformers.evaluation import (
    InformationRetrievalEvaluator,
)
from datasets import Dataset, load_dataset

# ── Config ────────────────────────────────────────────────────

BASE_MODEL = "BAAI/bge-m3"
MATRYOSHKA_DIMS = [128, 256, 512, 1024]

DEFAULT_HYPERPARAMS = {
    "epochs": 3,
    "learning_rate": 2e-5,
    "batch_size": 16,
    "warmup_ratio": 0.1,
    "weight_decay": 0.01,
    "max_seq_length": 512,
    "gradient_accumulation_steps": 2,
    "eval_steps": 100,
    "save_steps": 200,
    "logging_steps": 10,
}


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune bge-m3 for Rottra")
    parser.add_argument("--data_dir", default="scripts/data-cleaning/output",
                        help="Directory containing training data")
    parser.add_argument("--output", default="scripts/ai-pipeline/output/bge-m3-rottra",
                        help="Output directory for fine-tuned model")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--matryoshka", action="store_true", default=True,
                        help="Enable Matryoshka loss for flexible dims")
    parser.add_argument("--no-matryoshka", dest="matryoshka", action="store_false")
    parser.add_argument("--wandb", action="store_true",
                        help="Enable W&B logging")
    parser.add_argument("--eval_only", action="store_true",
                        help="Only run evaluation, no training")
    return parser.parse_args()


# ── Data Loading ──────────────────────────────────────────────

def load_training_data(data_dir: str) -> dict:
    """Load triplets and pairs from exported data."""
    data_dir = Path(data_dir)

    triplets = []
    pairs = []

    # Load triplets
    triplet_path = data_dir / "triplets.jsonl"
    if triplet_path.exists():
        with open(triplet_path) as f:
            for line in f:
                if line.strip():
                    triplets.append(json.loads(line))
        print(f"  Loaded {len(triplets)} triplets from {triplet_path}")

    # Load pairs
    pair_path = data_dir / "pairs.jsonl"
    if pair_path.exists():
        with open(pair_path) as f:
            for line in f:
                if line.strip():
                    pairs.append(json.loads(line))
        print(f"  Loaded {len(pairs)} pairs from {pair_path}")

    return {"triplets": triplets, "pairs": pairs}


def prepare_datasets(data: dict) -> tuple:
    """
    Prepare HuggingFace datasets for training.

    Returns:
        train_dataset: Dataset with (anchor, positive, negative) columns
        eval_dataset: Small held-out set for evaluation
    """
    triplets = data["triplets"]

    # Split 90/10
    split_idx = int(len(triplets) * 0.9)
    train_triplets = triplets[:split_idx]
    eval_triplets = triplets[split_idx:]

    # Ensure minimum eval size
    if len(eval_triplets) < 20:
        eval_triplets = triplets[-20:]
        train_triplets = triplets[:-20]

    # Create datasets
    train_data = {
        "anchor": [t["query"] for t in train_triplets],
        "positive": [t["positive"] for t in train_triplets],
        "negative": [t["negative"] for t in train_triplets],
    }
    eval_data = {
        "anchor": [t["query"] for t in eval_triplets],
        "positive": [t["positive"] for t in eval_triplets],
        "negative": [t["negative"] for t in eval_triplets],
    }

    train_dataset = Dataset.from_dict(train_data)
    eval_dataset = Dataset.from_dict(eval_data)

    print(f"  Train: {len(train_dataset)} samples")
    print(f"  Eval:  {len(eval_dataset)} samples")

    return train_dataset, eval_dataset


# ── Model Setup ───────────────────────────────────────────────

def load_model(max_seq_length: int = 512) -> SentenceTransformer:
    """Load base bge-m3 model."""
    print(f"\n📦 Loading base model: {BASE_MODEL}")
    model = SentenceTransformer(
        BASE_MODEL,
        trust_remote_code=True,
    )
    model.max_seq_length = max_seq_length
    print(f"  Model loaded: {model.get_sentence_embedding_dimension()}d")
    return model


# ── Loss Functions ────────────────────────────────────────────

def get_loss_fn(model: SentenceTransformer, use_matryoshka: bool = True) -> losses.Loss:
    """Build training loss with optional Matryoshka wrapping."""

    # Primary loss: MultipleNegativesRankingLoss
    # Uses in-batch negatives + provided hard negatives
    base_loss = losses.MultipleNegativesRankingLoss(model)

    if use_matryoshka:
        # Wrap with Matryoshka for flexible embedding dimensions
        # This allows using subsets of the 1024-dim embedding
        loss = losses.MatryoshkaLoss(
            model=model,
            loss=base_loss,
            matryoshka_dims=MATRYOSHKA_DIMS,
        )
        print(f"  Loss: MatryoshkaLoss (dims={MATRYOSHKA_DIMS})")
    else:
        loss = base_loss
        print("  Loss: MultipleNegativesRankingLoss")

    return loss


# ── Evaluation ────────────────────────────────────────────────

def build_evaluator(eval_dataset: Dataset) -> InformationRetrievalEvaluator:
    """Build IR evaluator for monitoring during training."""
    queries = {}
    corpus = {}
    relevant_docs = {}

    for i, row in enumerate(eval_dataset):
        qid = f"q{i}"
        pos_id = f"pos{i}"
        neg_id = f"neg{i}"

        queries[qid] = row["anchor"]
        corpus[pos_id] = row["positive"]
        corpus[neg_id] = row["negative"]

        relevant_docs[qid] = {pos_id: 1}

    evaluator = InformationRetrievalEvaluator(
        queries=queries,
        corpus=corpus,
        relevant_docs=relevant_docs,
        name="rottra-eval",
        show_progress_bar=True,
        batch_size=32,
    )
    return evaluator


# ── Training ──────────────────────────────────────────────────

def train(args, model, train_dataset, eval_dataset):
    """Run fine-tuning."""
    print(f"\n🚀 Starting fine-tuning...")
    print(f"  Epochs: {args.epochs}")
    print(f"  LR: {args.learning_rate}")
    print(f"  Batch: {args.batch_size}")

    # Output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Training arguments
    training_args = SentenceTransformerTrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        warmup_ratio=DEFAULT_HYPERPARAMS["warmup_ratio"],
        weight_decay=DEFAULT_HYPERPARAMS["weight_decay"],
        gradient_accumulation_steps=DEFAULT_HYPERPARAMS["gradient_accumulation_steps"],
        eval_strategy="steps",
        eval_steps=DEFAULT_HYPERPARAMS["eval_steps"],
        save_steps=DEFAULT_HYPERPARAMS["save_steps"],
        logging_steps=DEFAULT_HYPERPARAMS["logging_steps"],
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_rottra-eval_cosine_ndcg@10",
        report_to="wandb" if args.wandb else "none",
        dataloader_num_workers=4,
        fp16=torch.cuda.is_available(),
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
    )

    # Loss function
    loss = get_loss_fn(model, use_matryoshka=args.matryoshka)

    # Evaluator
    evaluator = build_evaluator(eval_dataset)

    # Trainer
    trainer = SentenceTransformerTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        loss=loss,
        evaluator=evaluator,
    )

    # Train
    trainer.train()

    # Save final model
    final_path = output_dir / "final"
    model.save(str(final_path))
    print(f"\n✅ Model saved to {final_path}")

    return model


# ── Evaluation Only ───────────────────────────────────────────

def evaluate_only(args, model, eval_dataset):
    """Run evaluation without training."""
    print(f"\n📊 Running evaluation only...")
    evaluator = build_evaluator(eval_dataset)
    results = evaluator(model)
    print(f"\nEvaluation results:")
    for k, v in results.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
    return results


# ── Main ──────────────────────────────────────────────────────

def main():
    args = parse_args()

    print("═" * 60)
    print("  ROTTRA EMBEDDING FINE-TUNE")
    print("  Base: bge-m3 (1024-dim) → Domain-adapted")
    print("═" * 60)

    # Load data
    print("\n📦 Loading training data...")
    data = load_training_data(args.data_dir)

    if not data["triplets"]:
        print("❌ No training data found. Run export-embedding-training-data.ts first.")
        return

    # Prepare datasets
    print("\n🔧 Preparing datasets...")
    train_dataset, eval_dataset = prepare_datasets(data)

    # Load model
    model = load_model(DEFAULT_HYPERPARAMS["max_seq_length"])

    if args.eval_only:
        evaluate_only(args, model, eval_dataset)
    else:
        train(args, model, train_dataset, eval_dataset)

    print("\n" + "═" * 60)
    print("  DONE")
    print("═" * 60)


if __name__ == "__main__":
    main()
