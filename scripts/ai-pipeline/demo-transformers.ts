/**
 * 🤗 ROTTRA — HF TRANSFORMERS.JS DEMO
 * Demo sử dụng @huggingface/transformers trong TypeScript
 */

import {
  initHFEmbedding,
  isHFEmbeddingReady,
  embedWithHF,
  embedBatchWithHF,
  cosineSimilarity,
  initHFImageClassifier,
  isHFImageClassifierReady,
  classifyImageWithHF,
} from "../../src/core/neural-memory/hf-transformers";

async function demoEmbedding() {
  console.log("\n" + "═".repeat(60));
  console.log("  🧠 HF EMBEDDING DEMO");
  console.log("═".repeat(60));

  const ready = await initHFEmbedding();
  if (!ready) {
    console.log("❌ Embedding pipeline failed to initialize.");
    return;
  }

  console.log("\n📝 Testing text embedding...");
  const texts = [
    "Xin chào, đây là Rottra AI",
    "Chào buổi sáng, bạn khỏe không?",
    "Rottra là nền tảng thương mại điện tử nông nghiệp",
    "Học máy và trí tuệ nhân tạo",
  ];

  const embeddings = await embedBatchWithHF(texts);
  console.log(`\n✅ Embedded ${embeddings.length} texts. Dimension: ${embeddings[0].length}`);

  console.log("\n📊 Cosine Similarities:");
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      console.log(`  "${texts[i].substring(0, 20)}..." ↔ "${texts[j].substring(0, 20)}..."`);
      console.log(`    Similarity: ${(sim * 100).toFixed(2)}%`);
    }
  }
}

async function demoImageClassification() {
  console.log("\n" + "═".repeat(60));
  console.log("  🖼️  HF IMAGE CLASSIFICATION DEMO");
  console.log("═".repeat(60));

  const ready = await initHFImageClassifier();
  if (!ready) {
    console.log("❌ Image classifier failed to initialize.");
    return;
  }

  console.log("\n📸 Testing image classification...");
  console.log("   Note: Provide a valid image path to test.");
  console.log("   Example: classifyImageWithHF('./test-image.jpg')");
}

async function main() {
  console.log("\n🚀 ROTTRA — @huggingface/transformers Demo");
  console.log("   Running in TypeScript (no Python required)\n");

  await demoEmbedding();
  await demoImageClassification();

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Demo completed!");
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Demo failed:", err);
  process.exit(1);
});
