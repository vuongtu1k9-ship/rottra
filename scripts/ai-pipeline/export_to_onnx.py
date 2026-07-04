#!/usr/bin/env python3
"""
🧠 ROTTRA — EXPORT FINE-TUNED MODEL TO ONNX
Convert fine-tuned bge-m3 to ONNX for transformers.js (browser runtime).

Usage:
    python export_to_onnx.py [--model ./output/bge-m3-rottra/final] [--output ./onnx/bge-m3-rottra]

Output structure (matching Xenova/bge-m3 format):
    onnx/
    └── bge-m3-rottra/
        ├── config.json
        ├── tokenizer.json
        ├── tokenizer_config.json
        ├── special_tokens_map.json
        ├── onnx/
        │   ├── model.onnx
        │   └── model_quantized.onnx
        └── modules.json
"""

import argparse
import json
import shutil
from pathlib import Path

import torch
from sentence_transformers import SentenceTransformer


def parse_args():
    parser = argparse.ArgumentParser(description="Export fine-tuned model to ONNX")
    parser.add_argument("--model", default="scripts/ai-pipeline/output/bge-m3-rottra/final",
                        help="Path to fine-tuned SentenceTransformer model")
    parser.add_argument("--output", default="public/models/bge-m3-rottra",
                        help="Output directory for ONNX model")
    parser.add_argument("--quantize", action="store_true", default=True,
                        help="Export quantized (int8) ONNX model")
    parser.add_argument("--fp16", action="store_true",
                        help="Export FP16 ONNX model")
    return parser.parse_args()


def export_onnx(model_path: str, output_dir: str, quantize: bool = True, fp16: bool = False):
    """Export SentenceTransformer to ONNX."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n📦 Loading fine-tuned model: {model_path}")
    model = SentenceTransformer(model_path)

    # Export using optimum
    try:
        from optimum.onnxruntime import ORTModelForFeatureExtraction
        from transformers import AutoTokenizer

        print("  Using optimum for ONNX export...")

        tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

        # Export base ONNX
        ort_model = ORTModelForFeatureExtraction.from_pretrained(
            model_path,
            export=True,
            trust_remote_code=True,
        )

        onnx_dir = output_path / "onnx"
        onnx_dir.mkdir(exist_ok=True)

        # Save ONNX model
        ort_model.save_pretrained(onnx_dir)
        tokenizer.save_pretrained(onnx_dir)

        print(f"  ✅ ONNX model saved to {onnx_dir}")

        # Quantize if requested
        if quantize:
            print("  Quantizing to INT8...")
            from optimum.onnxruntime import ORTQuantizer
            from optimum.onnxruntime.configuration import AutoQuantizationConfig

            quantizer = ORTQuantizer.from_pretrained(ort_model)
            qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=True)
            quantizer.quantize(save_dir=str(onnx_dir / "quantized"), quantization_config=qconfig)
            print(f"  ✅ Quantized model saved to {onnx_dir / 'quantized'}")

    except ImportError:
        print("  ⚠️  optimum not available, using transformers.js compatible export...")

        # Fallback: export via torch and manual conversion
        export_torchscript(model, output_path)

    # Copy tokenizer and config files
    copy_tokenizer_files(model_path, output_path)

    # Create modules.json for transformers.js
    create_modules_json(output_path)

    print(f"\n✅ Export complete: {output_path}")
    return output_path


def export_torchscript(model: SentenceTransformer, output_path: Path):
    """Fallback export via TorchScript."""
    print("  Exporting via TorchScript...")

    onnx_dir = output_path / "onnx"
    onnx_dir.mkdir(exist_ok=True)

    # Get the first transformer module
    auto_model = model[0].auto_model

    # Dummy input for tracing
    dummy_input = model.tokenizer(
        "sample text",
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )

    # Export
    with torch.no_grad():
        torch.onnx.export(
            auto_model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            str(onnx_dir / "model.onnx"),
            input_names=["input_ids", "attention_mask"],
            output_names=["last_hidden_state"],
            dynamic_axes={
                "input_ids": {0: "batch", 1: "sequence"},
                "attention_mask": {0: "batch", 1: "sequence"},
                "last_hidden_state": {0: "batch", 1: "sequence"},
            },
            opset_version=14,
            do_constant_folding=True,
        )

    print(f"  ✅ TorchScript ONNX saved to {onnx_dir / 'model.onnx'}")


def copy_tokenizer_files(model_path: str, output_path: Path):
    """Copy tokenizer and config files to output."""
    model_path = Path(model_path)

    files_to_copy = [
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
        "vocab.txt",
        "sentence_bert_config.json",
        "modules.json",
        "prompts.json",
    ]

    for fname in files_to_copy:
        src = model_path / fname
        if src.exists():
            shutil.copy2(src, output_path / fname)
            print(f"  Copied {fname}")

    # Also copy from onnx subdirectory if exists
    onnx_src = model_path / "onnx"
    if onnx_src.exists():
        for fname in files_to_copy:
            src = onnx_src / fname
            if src.exists():
                shutil.copy2(src, output_path / fname)


def create_modules_json(output_path: Path):
    """Create modules.json for transformers.js compatibility."""
    modules = {
        "modules": [
            {
                "name": "text_model",
                "type": " sentence_transformers.models.Transformer",
                "options": {
                    "do_lower_case": False,
                    "max_seq_length": 512,
                },
            },
            {
                "name": "pooling",
                "type": "sentence_transformers.models.Pooling",
                "options": {
                    "pooling_mode_cls_token": True,
                    "pooling_mode_mean_tokens": False,
                    "pooling_mode_max_tokens": False,
                    "pooling_mode_mean_sqrt_len_tokens": False,
                },
            },
        ],
        "default_prompt_name": None,
        "prompt_names": [],
        "default_prompt": "",
        "prompts": {},
    }

    # Don't overwrite if exists
    modules_path = output_path / "modules.json"
    if not modules_path.exists():
        with open(modules_path, "w") as f:
            json.dump(modules, f, indent=2)
        print("  Created modules.json")


def update_multilingual_embedding(new_model_path: str):
    """Print instructions for updating the TypeScript import."""
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  NEXT STEPS: Update Rottra to use fine-tuned model          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Copy ONNX files to public/models/                        ║
║     cp -r {new_model_path}/* public/models/bge-m3-rottra/   ║
║                                                              ║
║  2. Update multilingual-embedding.ts:                        ║
║     Change EMBEDDING_MODEL to:                               ║
║     "Xenova/bge-m3-rottra" (if pushed to HF)                ║
║     or local path                                            ║
║                                                              ║
║  3. Test with:                                               ║
║     bun run tests/unit-ai/test-semantic-embeddings.ts        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
""")


def main():
    args = parse_args()

    print("═" * 60)
    print("  ROTTRA — ONNX EXPORT")
    print("  Fine-tuned bge-m3 → ONNX for transformers.js")
    print("═" * 60)

    output_path = export_onnx(
        args.model,
        args.output,
        quantize=args.quantize,
        fp16=args.fp16,
    )

    update_multilingual_embedding(args.output)


if __name__ == "__main__":
    main()
