/**
 * ============================================================
 *  TEST: Semantic Vector Embeddings — Cảnh giới Tối thượng
 * ============================================================
 *
 *  Kiểm tra toàn diện hệ thống Embedding Vector-Nhạc-Ngữ nghĩa:
 *  1. Multilingual Embedding (bge-m3 1024-dim)
 *  2. TF-IDF Fallback (256-dim)
 *  3. TinyTokenizer (djb2 hash)
 *  4. Cosine Similarity (dense + sparse)
 *  5. Hybrid Retrieval (Sparse + Dense fusion)
 *  6. Semantic Reranker (Cross-Encoder style)
 *  7. Tiny LLM Verifier (Sigmoid confidence)
 *  8. Attention Fusion Layer (Softmax)
 *  9. Semantic Cache (Bigram Jaccard)
 * 10. Google Cross Entropy
 * 11. Graph Deduplication
 * 12. Multi-tenant Isolation
 */

import {
  TinyTokenizer,
  generateEmbedding,
  generateEmbeddingAsyncAwait,
  cosineSimilarity,
  cleanAndNormalize,
  hybridRetrieve,
  rerank,
  tinyLLMVerify,
  computeAttentionFusion,
  computeGoogleCrossEntropy,
  initRAGEngine,
  getEmbeddingStatus,
} from "~/core/neural-memory/vector-rag";

import {
  initMultilingualEmbedding,
  isEmbeddingReady,
  embed,
  embedBatch,
  cosineSimilarityDense,
  getEmbeddingInfo,
} from "~/core/neural-memory/multilingual-embedding";

import {
  checkSemanticCache,
  writeSemanticCache,
} from "~/core/neural-memory/semantic-cache";

// ── Test Framework ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    errors.push(msg);
    console.log(`  ❌ FAIL: ${msg}`);
  }
}

function assertRange(value: number, min: number, max: number, msg: string) {
  assert(value >= min && value <= max, `${msg} (got ${value}, expected [${min}, ${max}])`);
}

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

// ── TEST SUITE ──────────────────────────────────────────────────

async function testTinyTokenizer() {
  section("1. TinyTokenizer — djb2 Hash Tokenization");

  const tokens1 = TinyTokenizer.encode("công thức tính diện tích");
  assert(tokens1.length > 0, "Tokenize Vietnamese text produces tokens");
  assert(tokens1.every((t) => t >= 0 && t < 50000), "All token IDs in range [0, 50000)");

  const tokens2 = TinyTokenizer.encode("hello world");
  assert(tokens2.length > 0, "Tokenize English text produces tokens");

  // Stop words: code has fallback "nếu bị lọc hết thì lấy lại toàn bộ"
  const tokens3 = TinyTokenizer.encode("cho của về cái gì");
  assert(tokens3.length > 0, "Stop words text still produces tokens (fallback to all)");

  // Empty input
  const tokens4 = TinyTokenizer.encode("");
  assert(tokens4.length === 0, "Empty string produces no tokens");

  // Consistency: same input → same output
  const a = TinyTokenizer.encode("dijkstra shortest path");
  const b = TinyTokenizer.encode("dijkstra shortest path");
  assert(JSON.stringify(a) === JSON.stringify(b), "Deterministic: same input → same tokens");
}

async function testCleanAndNormalize() {
  section("2. cleanAndNormalize — Vietnamese Text Normalization");

  const n1 = cleanAndNormalize("Công Thức Tính Diện Tích");
  assert(n1 === "cong thuc tinh dien tich", "Lowercased + accent-stripped");

  const n2 = cleanAndNormalize("Bón phân cho cam VietGAP");
  assert(n2.includes("bon phan"), "Accents stripped from 'Bón'");
  assert(n2.includes("vietgap"), "VietGAP lowercased");

  const n3 = cleanAndNormalize("  spaces   everywhere  ");
  assert(!n3.startsWith(" ") && !n3.endsWith(" "), "Whitespace trimmed");

  const n4 = cleanAndNormalize("abc!@#def");
  assert(n4.includes("abc") && n4.includes("def"), "Special characters stripped, alphanumeric preserved");

  const n5 = cleanAndNormalize("");
  assert(n5 === "", "Empty string → empty string");
}

async function testTFIDFEmbedding() {
  section("3. TF-IDF Embedding (256-dim Fallback)");

  const vec1 = generateEmbedding("công thức tính năng suất lúa");
  assert(vec1.length === 256, "TF-IDF produces 256-dim vector");

  const mag = Math.sqrt(vec1.reduce((s, v) => s + v * v, 0));
  assertRange(mag, 0.9, 1.1, "Vector is L2-normalized (magnitude ≈ 1.0)");

  const vec2 = generateEmbedding("công thức tính năng suất lúa");
  assert(JSON.stringify(vec1) === JSON.stringify(vec2), "Deterministic: same text → same vector");

  const vec3 = generateEmbedding("chuỗi ngày sinh trắc học");
  assert(JSON.stringify(vec1) !== JSON.stringify(vec3), "Different text → different vector");
}

async function testCosineSimilarity() {
  section("4. Cosine Similarity — Sparse & Dense");

  // Sparse (256-dim)
  const v1 = generateEmbedding("công thức tính diện tích hình tam giác");
  const v2 = generateEmbedding("công thức diện tích tam giác");
  const v3 = generateEmbedding("chuỗi cung ứng nông sản");

  const sim12 = cosineSimilarity(v1, v2);
  const sim13 = cosineSimilarity(v1, v3);

  assertRange(sim12, 0.0, 1.0, "Similar texts have positive cosine similarity");
  assertRange(sim13, -0.3, 0.8, "Different texts have lower similarity");
  assert(sim12 > sim13, "Similar texts score higher than dissimilar ones");

  // Edge cases
  assert(cosineSimilarity([], []) === 0, "Empty vectors → 0");
  assert(cosineSimilarity([1], [1, 2]) === 0, "Mismatched dimensions → 0");
}

async function testDenseEmbedding() {
  section("5. Dense Embedding (bge-m3 1024-dim)");

  const ready = isEmbeddingReady();
  const info = getEmbeddingInfo();

  if (ready) {
    console.log(`  📦 Model: ${info.model}, Dim: ${info.dim}`);

    const vec = await embed("công thức tính năng suất lúa");
    assert(vec.length === 1024, "bge-m3 produces 1024-dim vector");
    assertRange(Math.sqrt(vec.reduce((s, v) => s + v * v, 0)), 0.9, 1.1, "Dense vector L2-normalized");

    const vec2 = await embed("công thức tính năng suất lúa");
    const sim = cosineSimilarityDense(vec, vec2);
    assertRange(sim, 0.99, 1.01, "Same text → cosine ≈ 1.0");

    // Batch
    const batch = await embedBatch(["hello", "world", "test"]);
    assert(batch.length === 3, "Batch embed produces 3 vectors");
    assert(batch.every((v) => v.length === 1024), "All batch vectors are 1024-dim");
  } else {
    console.log("  ⏭️  bge-m3 not loaded (using TF-IDF fallback) — skipping dense tests");
  }
}

async function testSemanticCache() {
  section("6. Semantic Cache — Bigram Jaccard Similarity");

  const botId = "test-bot-embeddings";

  // Write
  writeSemanticCache(botId, "công thức tính diện tích", "Diện tích = chiều rộng × chiều dài");
  writeSemanticCache(botId, "giá cam sành hôm nay", "Giá cam sành: 25.000đ/kg");

  // Exact hit
  const hit1 = checkSemanticCache(botId, "công thức tính diện tích");
  assert(hit1 !== null, "Exact cache hit returns cached response");
  assert(hit1!.includes("chiều rộng"), "Cached response contains correct content");

  // Fuzzy hit (similar query)
  const hit2 = checkSemanticCache(botId, "công thức tính diện tích hình chữ nhật");
  // Bigram similarity may or may not exceed 0.88
  console.log(`  📊 Fuzzy match result: ${hit2 ? "HIT" : "MISS"} (threshold 0.88)`);

  // Miss (completely different)
  const hit3 = checkSemanticCache(botId, "weather forecast for tomorrow");
  assert(hit3 === null, "Different query → cache miss");

  // Bot isolation
  const hit4 = checkSemanticCache("other-bot", "công thức tính diện tích");
  assert(hit4 === null, "Different botId → cache miss (isolation)");

  // Cleanup
  writeSemanticCache(botId, "công thức tính diện tích", "");
}

async function testGoogleCrossEntropy() {
  section("7. Google Cross Entropy — Vocabulary Distribution");

  const q1 = ["cong", "thuc", "dien", "tich"];
  const d1 = ["cong", "thuc", "tinh", "dien", "tich", "hinh", "tam", "giac"];
  const d2 = ["lua", "gao", "nong", "san", "xuat", "khau"];

  const ce1 = computeGoogleCrossEntropy(q1, d1);
  const ce2 = computeGoogleCrossEntropy(q1, d2);

  assert(ce1 > 0, "Cross entropy is positive");
  assert(ce2 > 0, "Cross entropy for unrelated doc is positive");
  assert(ce1 < ce2, "Related doc has lower cross entropy (better match)");

  // Empty edge case
  const ce3 = computeGoogleCrossEntropy([], d1);
  assert(ce3 === 0, "Empty query → 0 cross entropy");
}

async function testHybridRetrieval() {
  section("8. Hybrid Retrieval — Sparse + Dense Fusion");

  try {
    const results = await hybridRetrieve("công thức tính năng suất lúa", 3);
    assert(results.length > 0, "Hybrid retrieval returns candidates");
    assert(results.length <= 5, "Results bounded by topK + 2");

    // Check structure
    const first = results[0];
    assert(first.doc !== undefined, "Candidate has doc");
    assert(typeof first.sparseScore === "number", "Candidate has sparseScore");
    assert(typeof first.denseScore === "number", "Candidate has denseScore");
    assert(typeof first.hybridScore === "number", "Candidate has hybridScore");

    // Hybrid score should be in [0, 1] range approximately
    assertRange(first.hybridScore, -0.1, 1.5, "Hybrid score in reasonable range");

    // Results sorted by hybridScore descending
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i - 1].hybridScore >= results[i].hybridScore,
        `Results sorted: [${i - 1}] ${results[i - 1].hybridScore.toFixed(4)} >= [${i}] ${results[i].hybridScore.toFixed(4)}`,
      );
    }

    console.log(`  📊 Retrieved ${results.length} candidates`);
    results.forEach((r, i) => {
      console.log(`     #${i + 1} [${r.doc.item.title}] hybrid=${r.hybridScore.toFixed(4)} sparse=${r.sparseScore} dense=${r.denseScore.toFixed(4)}`);
    });
  } catch (err: any) {
    console.log(`  ⚠️  Hybrid retrieval error (DB may not be running): ${err.message}`);
  }
}

async function testReranker() {
  section("9. Semantic Reranker — Cross-Encoder Style");

  // Create mock candidates
  const mockCandidates = [
    {
      doc: {
        id: 1,
        category: "MATHEMATICS",
        item: { id: "1", title: "Công thức tính diện tích", subtitle: "Hình học", definition: "Diện tích = chiều rộng × chiều dài", explanation: "", application: "", tags: [] },
        flatText: "cong thuc tinh dien tich hinh hoc dien tich chieu rong chieu dai",
        pointers: [],
        backPointers: [],
      },
      sparseScore: 10,
      denseScore: 0.8,
      hybridScore: 0.6,
    },
    {
      doc: {
        id: 2,
        category: "AGRICULTURE",
        item: { id: "2", title: "Kỹ thuật bón phân cho cam", subtitle: "Nông nghiệp", definition: "Bón phân NPK theo giai đoạn sinh trưởng", explanation: "", application: "", tags: [] },
        flatText: "ky thuat bon phan cho cam nong nghiep bon phan npk theo giai doanh sinh truong",
        pointers: [],
        backPointers: [],
      },
      sparseScore: 2,
      denseScore: 0.3,
      hybridScore: 0.2,
    },
  ];

  const reranked = rerank("công thức tính diện tích", mockCandidates);
  assert(reranked.length === 2, "Reranker returns all candidates");

  // First candidate should be ranked higher (exact phrase match)
  assert(reranked[0].rerankScore > reranked[1].rerankScore, "Exact phrase match ranked higher");
  assert(typeof reranked[0].rerankScore === "number", "Rerank score is a number");

  console.log(`  📊 Reranked: #1=${reranked[0].rerankScore.toFixed(4)}, #2=${reranked[1].rerankScore.toFixed(4)}`);
}

async function testTinyLLMVerify() {
  section("10. Tiny LLM Verifier — Sigmoid Confidence");

  // High confidence case
  const highMatch = {
    doc: {
      id: 1,
      category: "MATHEMATICS",
      item: { id: "1", title: "Công thức tính diện tích", subtitle: "Hình học", definition: "Diện tích = chiều rộng × chiều dài", explanation: "", application: "", tags: [] },
      flatText: "cong thuc tinh dien tich hinh hoc dien tich chieu rong chieu dai",
      pointers: [],
      backPointers: [],
    },
    sparseScore: 10,
    denseScore: 0.85,
    hybridScore: 0.7,
    rerankScore: 1.2,
  };

  const result1 = tinyLLMVerify("công thức tính diện tích", highMatch);
  assert(typeof result1.verified === "boolean", "Verify returns boolean");
  assert(typeof result1.confidence === "number", "Verify returns confidence number");
  assert(result1.confidence >= 0 && result1.confidence <= 100, "Confidence in [0, 100]");
  console.log(`  📊 High match: verified=${result1.verified}, confidence=${result1.confidence}%, reason="${result1.reason.substring(0, 60)}..."`);

  // Low confidence case
  const lowMatch = {
    ...highMatch,
    denseScore: 0.2,
    rerankScore: 0.1,
  };

  const result2 = tinyLLMVerify("chuỗi cung ứng phân bón", lowMatch);
  assert(!result2.verified || result2.confidence < 60, "Low similarity → low confidence or unverified");
  console.log(`  📊 Low match: verified=${result2.verified}, confidence=${result2.confidence}%`);

  // Negation check
  const negationMatch = {
    ...highMatch,
    denseScore: 0.5,
    rerankScore: 0.3,
  };
  const result3 = tinyLLMVerify("không phải công thức tính diện tích", negationMatch);
  console.log(`  📊 Negation: verified=${result3.verified}, confidence=${result3.confidence}%`);
}

async function testAttentionFusion() {
  section("11. Attention Fusion — Multi-Document Softmax");

  const mockCandidates = [
    {
      doc: {
        id: 1,
        category: "MATHEMATICS",
        item: { id: "1", title: "Diện tích hình tam giác", subtitle: "Hình học", definition: "Diện tích = 1/2 × đáy × chiều cao", explanation: "", application: "", tags: [] },
        flatText: "dien tich hinh tam giac 1 2 day chieu cao",
        vector: generateEmbedding("dien tich hinh tam giac 1 2 day chieu cao"),
        pointers: [],
        backPointers: [],
      },
      sparseScore: 8,
      denseScore: 0.7,
      hybridScore: 0.65,
    },
    {
      doc: {
        id: 2,
        category: "MATHEMATICS",
        item: { id: "2", title: "Diện tích hình chữ nhật", subtitle: "Hình học", definition: "Diện tích = chiều rộng × chiều dài", explanation: "", application: "", tags: [] },
        flatText: "dien tich hinh chu nhat chieu rong chieu dai",
        vector: generateEmbedding("dien tich hinh chu nhat chieu rong chieu dai"),
        pointers: [],
        backPointers: [],
      },
      sparseScore: 6,
      denseScore: 0.6,
      hybridScore: 0.55,
    },
  ];

  const fusion = computeAttentionFusion("công thức tính diện tích hình tam giác", mockCandidates);

  assert(fusion.attentionMap.length === 2, "Attention map has 2 entries");
  assert(typeof fusion.fusedContextText === "string", "Fused context is a string");

  // Attention weights should sum to ~1.0
  const totalWeight = fusion.attentionMap.reduce((s, a) => s + a.attentionWeight, 0);
  assertRange(totalWeight, 0.9, 1.1, "Attention weights sum to ≈ 1.0");

  // First doc should have higher attention (more relevant)
  assert(fusion.attentionMap[0].attentionWeight >= fusion.attentionMap[1].attentionWeight, "More relevant doc gets higher attention");

  console.log(`  📊 Attention Weights:`);
  fusion.attentionMap.forEach((a) => {
    console.log(`     ${a.docTitle}: ${(a.attentionWeight * 100).toFixed(1)}% ${a.barIndicator}`);
  });
}

async function testEmbeddingStatus() {
  section("12. Embedding Status & Integration");

  const status = getEmbeddingStatus();
  assert(typeof status.model === "string", "Status has model name");
  assert(typeof status.dim === "number", "Status has dimension");
  assert(typeof status.ready === "boolean", "Status has ready flag");
  assert(typeof status.fallback === "string", "Status has fallback info");
  assert(typeof status.primary === "string", "Status has primary info");

  console.log(`  📊 Primary: ${status.primary}, Fallback: ${status.fallback}, Ready: ${status.ready}`);
}

async function testVectorMathEdgeCases() {
  section("13. Vector Math Edge Cases");

  // Orthogonal vectors → cosine ≈ 0
  const v1 = [1, 0, 0, 0];
  const v2 = [0, 1, 0, 0];
  const simOrth = cosineSimilarity(v1, v2);
  assertRange(simOrth, -0.01, 0.01, "Orthogonal vectors → cosine ≈ 0");

  // Identical vectors → cosine = 1
  const v3 = [0.6, 0.8, 0, 0];
  const simSame = cosineSimilarity(v3, v3);
  assertRange(simSame, 0.99, 1.01, "Identical vectors → cosine ≈ 1.0");

  // Opposite vectors → cosine ≈ -1
  const v4 = [0.6, 0.8, 0, 0];
  const v5 = [-0.6, -0.8, 0, 0];
  const simOpp = cosineSimilarity(v4, v5);
  assertRange(simOpp, -1.01, -0.99, "Opposite vectors → cosine ≈ -1.0");

  // Zero vector
  const v6 = [0, 0, 0, 0];
  const v7 = [1, 0, 0, 0];
  const simZero = cosineSimilarity(v6, v7);
  assert(simZero === 0, "Zero vector → cosine = 0");
}

async function testMultilingualEmbedding() {
  section("14. Multilingual Embedding Module");

  const info = getEmbeddingInfo();
  assert(info.model === "Xenova/bge-m3", "Model is bge-m3");
  assert(info.dim === 1024, "Dimension is 1024");
  assert(typeof info.ready === "boolean", "Ready flag exists");

  if (info.ready) {
    // Test Vietnamese
    const vecVI = await embed("công thức tính diện tích");
    assert(vecVI.length === 1024, "Vietnamese → 1024-dim");

    // Test English
    const vecEN = await embed("area calculation formula");
    assert(vecEN.length === 1024, "English → 1024-dim");

    // Cross-lingual similarity (semantic equivalence)
    const crossSim = cosineSimilarityDense(vecVI, vecEN);
    console.log(`  📊 Cross-lingual similarity (VI↔EN): ${crossSim.toFixed(4)}`);
    assert(crossSim > 0.3, "Cross-lingual similarity > 0.3 (semantic match)");
  } else {
    console.log("  ⏭️  bge-m3 not loaded — skipping multilingual tests");
  }
}

// ── Runner ──────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "╔══════════════════════════════════════════════════════════════╗");
  console.log("║   TEST: Semantic Vector Embeddings — Cảnh giới Tối thượng  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const startTime = performance.now();

  await testTinyTokenizer();
  await testCleanAndNormalize();
  await testTFIDFEmbedding();
  await testCosineSimilarity();
  await testDenseEmbedding();
  await testSemanticCache();
  await testGoogleCrossEntropy();
  await testHybridRetrieval();
  await testReranker();
  await testTinyLLMVerify();
  await testAttentionFusion();
  await testEmbeddingStatus();
  await testVectorMathEdgeCases();
  await testMultilingualEmbedding();

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "═".repeat(60));
  console.log("  RESULTS SUMMARY");
  console.log("═".repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Time:   ${elapsed}s`);

  if (errors.length > 0) {
    console.log("\n  Failed assertions:");
    errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  }

  console.log("\n" + "═".repeat(60));
  console.log(failed === 0 ? "  🎉 ALL TESTS PASSED — Cảnh giới Tối thượng đã được chinh phục!" : `  ⚠️  ${failed} test(s) failed`);
  console.log("═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
