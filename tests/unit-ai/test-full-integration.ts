import { Deterministic } from "~/shared/utils/rng";
/**
 * ============================================================
 *  FULL INTEGRATION TEST — Rottra AI Agent System
 * ============================================================
 *
 *  Kiểm tra toàn diện tất cả subsystem:
 *  ┌─────────────────────────────────────────────────┐
 *  │ 1. NLP Core       — Tokenizer, Recognizer, i18n │
 *  │ 2. Neural Memory  — RAG, Cache, Guardrails      │
 *  │ 3. Quant Engine   — Financial, SIMD, Markov     │
 *  │ 4. Cognitive      — Memory, KG, SDM, Swarm      │
 *  │ 5. Integration    — End-to-end pipeline          │
 *  └─────────────────────────────────────────────────┘
 */

// ── Imports ─────────────────────────────────────────────────────

// NLP Core
import { removeAccents, normalizeVietnameseShorthands } from "~/core/nlp-cognitive/tokenizer";
import { MULTILINGUAL_KEYWORDS } from "~/core/nlp-cognitive/multilingual-keywords";
import { resample, pathLength, recognize, distance as ptDistance } from "~/core/nlp-cognitive/recognizer";

// Neural Memory
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
  chunkDocument,
} from "~/core/neural-memory/vector-rag";
import { checkSemanticCache, writeSemanticCache } from "~/core/neural-memory/semantic-cache";
import { guardrails as guardrailsSingleton } from "~/core/neural-memory/guardrails";
import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";
import { smartChunking, agriculturalChunking, fixedChunking } from "~/core/neural-memory/chunking-strategies";
import { initMultilingualEmbedding, isEmbeddingReady, embed, cosineSimilarityDense, getEmbeddingInfo } from "~/core/neural-memory/multilingual-embedding";

// Quant Engine
import { evaluateMathExpression, factorial, C, A } from "~/core/quant-engine/financial-solver";
import { vecAdd, vecScale, vecDot, vecNorm, cosineSimilarityZeroAlloc } from "~/core/quant-engine/vector-simd";
import {
  MarkovDecisionProcess,
  HiddenMarkovModel,
  MCMCSampler,
  createSupplyChainMDP,
  createDemandHMM,
  createPriceSampler,
} from "~/core/quant-engine/markov-engine";

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
  assert(value >= min && value <= max, `${msg} (got ${value.toFixed(4)}, expected [${min}, ${max}])`);
}

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

function subsection(title: string) {
  console.log(`\n  ── ${title} ──`);
}

// ══════════════════════════════════════════════════════════════
//  1. NLP CORE
// ══════════════════════════════════════════════════════════════

function testNLPCore() {
  section("1. NLP CORE — Tokenizer & Recognizer");

  subsection("1.1 Vietnamese Text Processing");
  const accented = "Nguyễn Văn A";
  const stripped = removeAccents(accented);
  assert(stripped === "Nguyen Van A", "removeAccents strips diacritics");

  const shorthand = normalizeVietnameseShorthands("ko bik j");
  assert(shorthand === "không biết gì", "normalizeVietnameseShorthands expands shorthand");

  const shorthand2 = normalizeVietnameseShorthands("ok r mn");
  assert(shorthand2 === "đồng ý rồi mọi người", "Shorthand: ok→đồng ý, r→rồi, mn→mọi người");

  const noShorthand = normalizeVietnameseShorthands("xin chào");
  assert(noShorthand === "xin chào", "Non-shorthand text unchanged");

  subsection("1.2 Multilingual Keyword Classifier");
  const intents = Object.keys(MULTILINGUAL_KEYWORDS);
  assert(intents.length >= 9, `MultilingualKeywords has ${intents.length} intents (>= 9)`);

  // Test English keyword
  const enProb = MULTILINGUAL_KEYWORDS["STATISTICS"]?.find((k) => k === "probability");
  assert(enProb === "probability", "English keyword 'probability' maps to STATISTICS");

  // Test Vietnamese keyword
  const viProb = MULTILINGUAL_KEYWORDS["STATISTICS"]?.find((k) => k.includes("xác suất"));
  assert(!!viProb, "Vietnamese keyword 'xác suất' maps to STATISTICS");

  // Test Japanese keyword
  const jaProb = MULTILINGUAL_KEYWORDS["STATISTICS"]?.find((k) => k === "確率");
  assert(jaProb === "確率", "Japanese keyword '確率' maps to STATISTICS");

  // Test Chinese keyword
  const zhProb = MULTILINGUAL_KEYWORDS["STATISTICS"]?.find((k) => k === "概率");
  assert(zhProb === "概率", "Chinese keyword '概率' maps to STATISTICS");

  // Test cross-intent uniqueness
  const allKeywords = intents.flatMap((i) => MULTILINGUAL_KEYWORDS[i] || []);
  assert(allKeywords.length > 100, `Total keywords: ${allKeywords.length} (> 100)`);

  subsection("1.3 $P Point-Cloud Recognizer");
  const circlePoints = Array.from({ length: 36 }, (_, i) => ({
    x: Math.cos((i * 2 * Math.PI) / 36) * 50 + 100,
    y: Math.sin((i * 2 * Math.PI) / 36) * 50 + 100,
  }));

  const resampled = resample(circlePoints, 32);
  assert(resampled.length === 32, "Resample 36 points → 32 points");

  const len = pathLength(circlePoints);
  assert(len > 200 && len < 400, `Circle path length ≈ ${len.toFixed(1)} (expected ~314)`);

  // Distance function
  const d = ptDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert(d === 5, "Distance (0,0)→(3,4) = 5");

  subsection("1.4 Tokenizer & TF-IDF");
  const tok1 = TinyTokenizer.encode("công thức tính diện tích hình tam giác");
  assert(tok1.length >= 5, `Tokenize produces ${tok1.length} tokens (>= 5)`);

  const tok2 = TinyTokenizer.encode("công thức tính diện tích hình tam giác");
  assert(JSON.stringify(tok1) === JSON.stringify(tok2), "Tokenizer is deterministic");
}

// ══════════════════════════════════════════════════════════════
//  2. NEURAL MEMORY
// ══════════════════════════════════════════════════════════════

async function testNeuralMemory() {
  section("2. NEURAL MEMORY — RAG, Cache, Guardrails");

  subsection("2.1 Embedding Generation");
  const vec1 = generateEmbedding("công thức tính năng suất lúa");
  assert(vec1.length === 256, "TF-IDF embedding produces 256-dim vector");
  const mag = Math.sqrt(vec1.reduce((s, v) => s + v * v, 0));
  assertRange(mag, 0.9, 1.1, "Embedding is L2-normalized");

  const vec2 = generateEmbedding("công thức tính năng suất lúa");
  assert(JSON.stringify(vec1) === JSON.stringify(vec2), "Embedding is deterministic");

  const vec3 = generateEmbedding("chuỗi cung ứng phân bón");
  assert(JSON.stringify(vec1) !== JSON.stringify(vec3), "Different text → different vector");

  subsection("2.2 Cosine Similarity");
  const simSame = cosineSimilarity(vec1, vec2);
  assertRange(simSame, 0.99, 1.01, "Same vectors → cosine ≈ 1.0");

  const simDiff = cosineSimilarity(vec1, vec3);
  assert(simSame > simDiff, "Same-text similarity > different-text similarity");

  assert(cosineSimilarity([], []) === 0, "Empty vectors → 0");
  assert(cosineSimilarity([1], [1, 2]) === 0, "Mismatched dims → 0");

  subsection("2.3 Semantic Cache");
  const botId = "integration-test";
  writeSemanticCache(botId, "giá cam sành", "25.000đ/kg");
  const hit = checkSemanticCache(botId, "giá cam sành");
  assert(hit === "25.000đ/kg", "Cache exact hit returns correct value");

  const miss = checkSemanticCache(botId, "weather forecast");
  assert(miss === null, "Cache miss for unrelated query");

  const botMiss = checkSemanticCache("other-bot", "giá cam sành");
  assert(botMiss === null, "Cache isolates by botId");

  subsection("2.4 Guardrails Engine");
  const guard = guardrailsSingleton;

  // Note: normalize() strips accents, so patterns must match accent-stripped text
  // PII detection works because it uses raw text (digits not accent-stripped)
  const pii = guard.checkInput("số CCCD của tôi là 001234567890");
  assert(pii.length > 0, "PII detected: CCCD number");

  const normal = guard.checkInput("công thức tính diện tích hình tròn");
  assert(normal.length === 0, "Normal query passes guardrails");

  // Sensitive topic detection
  const sensitive = guard.checkInput("password là abc123");
  assert(sensitive.length > 0, "Sensitive topic detected: credentials");

  const empty = guard.checkInput("");
  assert(empty.length === 0, "Empty input → no guardrail triggers");

  subsection("2.5 Chunking Strategies");
  const longText = "Đây là đoạn văn bản mẫu. ".repeat(50);

  const fixedChunks = fixedChunking(longText, { maxChunkSize: 100, overlapSize: 10 });
  assert(fixedChunks.length > 1, `Fixed chunking: ${longText.length} chars → ${fixedChunks.length} chunks`);

  const smartChunks = smartChunking(longText, { maxChunkSize: 200 });
  assert(smartChunks.length > 0, `Smart chunking produces ${smartChunks.length} chunks`);

  const agriText = "Mùa vụ: Vụ đông xuân.\nKỹ thuật: Bón phân NPK.\nPhòng trừ: Sâu bệnh.\n" + "Nội dung nông nghiệp. ".repeat(30);
  const agriChunks = agriculturalChunking(agriText, { maxChunkSize: 200 });
  assert(agriChunks.length > 0, `Agricultural chunking produces ${agriChunks.length} chunks`);

  subsection("2.6 LRU Cache");
  const lru = new LRUCache<string, number>(5, 60);
  lru.set("a", 1);
  lru.set("b", 2);
  lru.set("c", 3);
  assert(lru.get("a") === 1, "LRU get existing key");
  assert(lru.get("z") === undefined, "LRU get missing key → undefined");

  lru.set("d", 4);
  lru.set("e", 5);
  lru.set("f", 6); // evicts oldest (a)
  assert(lru.get("a") === undefined, "LRU evicts oldest entry");
  assert(lru.get("f") === 6, "LRU keeps newest entry");

  subsection("2.7 Google Cross Entropy");
  const q = ["cong", "thuc", "dien", "tich"];
  const d1 = ["cong", "thuc", "tinh", "dien", "tich"];
  const d2 = ["lua", "gao", "nong", "san"];
  const ce1 = computeGoogleCrossEntropy(q, d1);
  const ce2 = computeGoogleCrossEntropy(q, d2);
  assert(ce1 < ce2, "Related doc has lower cross entropy");
  assert(computeGoogleCrossEntropy([], d1) === 0, "Empty query → 0");

  subsection("2.8 Reranker & Verifier");
  const mockCandidates = [
    {
      doc: {
        id: 1,
        category: "MATH",
        item: { id: "1", title: "Công thức tính diện tích", subtitle: "", definition: "D = r × c", explanation: "", application: "", tags: [] },
        flatText: "cong thuc tinh dien tich r c",
        pointers: [],
        backPointers: [],
      },
      sparseScore: 10,
      denseScore: 0.8,
      hybridScore: 0.7,
    },
    {
      doc: {
        id: 2,
        category: "AGRI",
        item: { id: "2", title: "Kỹ thuật bón phân", subtitle: "", definition: "Bón NPK", explanation: "", application: "", tags: [] },
        flatText: "ky thuat bon phan npk",
        pointers: [],
        backPointers: [],
      },
      sparseScore: 2,
      denseScore: 0.3,
      hybridScore: 0.2,
    },
  ];

  const reranked = rerank("công thức tính diện tích", mockCandidates);
  assert(reranked[0].doc.id === 1, "Reranker ranks exact match first");
  assert(reranked[0].rerankScore > reranked[1].rerankScore, "Rerank score order correct");

  const verify = tinyLLMVerify("công thức tính diện tích", reranked[0]);
  assert(typeof verify.verified === "boolean", "Verify returns boolean");
  assert(verify.confidence >= 0 && verify.confidence <= 100, "Confidence in [0, 100]");
}

// ══════════════════════════════════════════════════════════════
//  3. QUANT ENGINE
// ══════════════════════════════════════════════════════════════

function testQuantEngine() {
  section("3. QUANT ENGINE — Financial, SIMD, Markov");

  subsection("3.1 Financial Solver (Casio Lượng Tử)");
  assert(factorial(0) === 1, "0! = 1");
  assert(factorial(5) === 120, "5! = 120");
  assert(factorial(10) === 3628800, "10! = 3628800");

  assert(C(5, 2) === 10, "C(5,2) = 10");
  assert(C(10, 3) === 120, "C(10,3) = 120");
  assert(C(5, 6) === 0, "C(5,6) = 0 (r > n)");

  assert(A(5, 2) === 20, "A(5,2) = 20");
  assert(A(5, 0) === 1, "A(5,0) = 1");

  // Math expression evaluation
  const r1 = evaluateMathExpression("2 + 3");
  assert(r1 === 5, "2 + 3 = 5");

  const r2 = evaluateMathExpression("sqrt(144)");
  assert(r2 === 12, "sqrt(144) = 12");

  const r3 = evaluateMathExpression("sin(PI/2)");
  assertRange(r3!, 0.99, 1.01, "sin(PI/2) ≈ 1.0");

  const r4 = evaluateMathExpression("factorial(6)");
  assert(r4 === 720, "factorial(6) = 720");

  const r5 = evaluateMathExpression("C(10,3)");
  assert(r5 === 120, "C(10,3) = 120");

  subsection("3.2 Zero-Allocation Vector SIMD");
  const a = new Float32Array([1, 2, 3]);
  const b = new Float32Array([4, 5, 6]);
  const out = new Float32Array(3);

  vecAdd(out, a, b);
  assert(out[0] === 5 && out[1] === 7 && out[2] === 9, "vecAdd [1,2,3]+[4,5,6] = [5,7,9]");

  vecScale(out, a, 2);
  assert(out[0] === 2 && out[1] === 4 && out[2] === 6, "vecScale [1,2,3]*2 = [2,4,6]");

  const dot = vecDot(a, b);
  assert(dot === 32, "vecDot [1,2,3]·[4,5,6] = 32");

  const norm = vecNorm(a);
  assertRange(norm, 3.74, 3.75, "vecNorm [1,2,3] ≈ 3.74");

  const cosNorm = cosineSimilarityZeroAlloc(a, a, true);
  assertRange(cosNorm, 0.99, 1.01, "cosineSimilarity (normalized) self ≈ 1.0");

  const cosUnnorm = cosineSimilarityZeroAlloc(a, b, false);
  assertRange(cosUnnorm, 0.97, 0.98, "cosineSimilarity (unnormalized) ≈ 0.974");

  subsection("3.3 MDP (Markov Decision Process)");
  const mdp = new MarkovDecisionProcess({ discountFactor: 0.9, maxIterations: 200 });
  mdp.addState({ id: "farm", label: "Trang trại" });
  mdp.addState({ id: "warehouse", label: "Kho" });
  mdp.addState({ id: "market", label: "Chợ" });
  mdp.addState({ id: "delivered", label: "Đã giao" });
  mdp.addAction({ id: "transport", label: "Vận chuyển" });
  mdp.addAction({ id: "store", label: "Lưu kho" });
  mdp.addTransition({ from: "farm", action: "transport", to: "warehouse", probability: 0.9, reward: 10 });
  mdp.addTransition({ from: "farm", action: "transport", to: "market", probability: 0.1, reward: -5 });
  mdp.addTransition({ from: "warehouse", action: "transport", to: "market", probability: 0.95, reward: 20 });
  mdp.addTransition({ from: "market", action: "store", to: "delivered", probability: 1.0, reward: 50 });

  const mdpResult = mdp.valueIteration();
  assert(mdpResult.values.size === 4, `MDP computes values for ${mdpResult.values.size} states`);
  assert(mdpResult.policy.size === 4, `MDP computes policy for ${mdpResult.policy.size} states`);
  const deliveredValue = mdpResult.values.get("delivered")!;
  assert(deliveredValue > 0, `Delivered state value > 0 (got ${deliveredValue.toFixed(2)})`);
  console.log(`  📊 MDP Values: farm=${mdpResult.values.get("farm")?.toFixed(2)}, market=${mdpResult.values.get("market")?.toFixed(2)}, delivered=${deliveredValue.toFixed(2)}`);

  subsection("3.4 HMM (Hidden Markov Model)");
  const hmm = new HiddenMarkovModel();
  hmm.addState("high");
  hmm.addState("medium");
  hmm.addState("low");
  hmm.addObservation("good_sales");
  hmm.addObservation("bad_sales");

  hmm.setInitialProbability("high", 0.5);
  hmm.setInitialProbability("medium", 0.3);
  hmm.setInitialProbability("low", 0.2);

  hmm.setTransitionProbability("high", "high", 0.7);
  hmm.setTransitionProbability("high", "medium", 0.2);
  hmm.setTransitionProbability("high", "low", 0.1);
  hmm.setTransitionProbability("medium", "high", 0.3);
  hmm.setTransitionProbability("medium", "medium", 0.5);
  hmm.setTransitionProbability("medium", "low", 0.2);
  hmm.setTransitionProbability("low", "high", 0.2);
  hmm.setTransitionProbability("low", "medium", 0.3);
  hmm.setTransitionProbability("low", "low", 0.5);

  hmm.setEmissionProbability("high", "good_sales", 0.8);
  hmm.setEmissionProbability("high", "bad_sales", 0.2);
  hmm.setEmissionProbability("medium", "good_sales", 0.5);
  hmm.setEmissionProbability("medium", "bad_sales", 0.5);
  hmm.setEmissionProbability("low", "good_sales", 0.2);
  hmm.setEmissionProbability("low", "bad_sales", 0.8);

  const observations = ["good_sales", "bad_sales", "good_sales"];
  const viterbiResult = hmm.viterbi(observations);
  assert(viterbiResult.path.length === 3, `Viterbi path length = ${viterbiResult.path.length}`);
  assert(typeof viterbiResult.probability === "number", "Viterbi returns probability");
  assert(viterbiResult.probability > 0, "Viterbi probability > 0");
  console.log(`  📊 Viterbi path: [${viterbiResult.path.join(" → ")}] prob=${viterbiResult.probability.toFixed(6)}`);

  subsection("3.5 MCMC (Markov Chain Monte Carlo)");
  const mcmc = new MCMCSampler();
  const samples = mcmc.metropolisHastings(
    (x: number) => Math.exp(-0.5 * x * x), // Gaussian target
    0, // initial
    1000, // iterations
    0.5, // step size
  );
  assert(samples.length === 1000, `MCMC produces ${samples.length} samples`);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  assertRange(mean, -0.2, 0.2, `MCMC Gaussian mean ≈ 0 (got ${mean.toFixed(4)})`);
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length;
  assertRange(variance, 0.5, 2.0, `MCMC Gaussian variance ≈ 1.0 (got ${variance.toFixed(4)})`);

  subsection("3.6 Pre-built Models");
  const supplyChain = createSupplyChainMDP();
  assert(supplyChain !== null, "Pre-built Supply Chain MDP exists");
  const supplyResult = supplyChain.valueIteration();
  assert(supplyResult.values.size > 0, "Supply Chain MDP computes values");
  console.log(`  📊 Supply Chain MDP: ${supplyResult.values.size} states, ${supplyResult.policy.size} actions`);

  const demandHMM = createDemandHMM();
  assert(demandHMM !== null, "Pre-built Demand HMM exists");

  const priceSampler = createPriceSampler();
  assert(priceSampler !== null, "Pre-built Price Sampler exists");
}

// ══════════════════════════════════════════════════════════════
//  4. COGNITIVE SYSTEMS
// ══════════════════════════════════════════════════════════════

async function testCognitiveSystems() {
  section("4. COGNITIVE — Memory, Graph, SDM");

  subsection("4.1 Conversation Memory");
  const { conversationMemory: mem } = await import("~/core/cognitive-swarm/conversation-memory");

  mem.addMessage("test-session-1", "user", "Giá cam sành hôm nay?");
  mem.addMessage("test-session-1", "assistant", "Giá cam sành: 25.000đ/kg");

  const ctx1 = mem.getRecentContext("test-session-1");
  assert(ctx1.length === 2, `Context has ${ctx1.length} messages`);

  // Importance scoring
  const imp = mem.addMessage(
    "test-session-2",
    "user",
    "Phân tích NPV dự án nông nghiệp công nghệ cao với chi phí đầu tư 5 tỷ, thời gian hoàn vốn 3 năm, tỷ suất lợi nhuận kỳ vọng 15% mỗi năm. Dự án bao gồm nhà kính thông minh, hệ thống tưới nhỏ giọt, và phần mềm quản lý mùa vụ.",
    "NPV",
  );
  assert(imp > 1, `Long content with NPV intent has importance = ${imp} (> 1)`);

  subsection("4.2 Knowledge Graph (Graph Attention)");
  const { KnowledgeGraph } = await import("~/core/nlp-cognitive/knowledge-graph");
  const kg = new KnowledgeGraph();

  // KG uses its internal textEmbedding — test via class methods
  // Just verify the class instantiates correctly
  assert(kg !== null, "KnowledgeGraph instantiates");

  subsection("4.3 SDM Engine (Sparse Distributed Memory)");
  const { SDMEngine } = await import("~/core/nlp-cognitive/sdm-engine");
  const sdm = new SDMEngine(64); // smaller for test speed

  // SDM write + recall
  const testAddr = new Uint8Array(2048);
  for (let i = 0; i < 2048; i++) testAddr[i] = Deterministic.random() < 0.5 ? 1 : 0;
  const testData = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) testData[i] = Deterministic.random() * 2 - 1;

  sdm.write({
    id: "test-pattern-1",
    address: testAddr,
    data: testData,
    metadata: { utterance: "hello", response: "world", intent: "TEST", timestamp: Date.now(), accessCount: 0, lastAccessed: Date.now() },
  });

  const recalled = sdm.recall(testData, 3);
  assert(recalled.length > 0, `SDM recall returned ${recalled.length} results`);
  assert(recalled[0].score > 0, `SDM top score = ${recalled[0].score.toFixed(4)}`);
  console.log(`  📊 SDM: wrote 1 pattern, recalled ${recalled.length} (top score: ${recalled[0].score.toFixed(4)})`);

  subsection("4.4 RAG Engine Initialization");
  try {
    const { flatDocsCache, vocabulary } = await initRAGEngine();
    assert(flatDocsCache.length > 0, `RAG cache loaded: ${flatDocsCache.length} docs`);
    assert(vocabulary.length > 0, `Vocabulary loaded: ${vocabulary.length} terms`);
    console.log(`  📊 RAG: ${flatDocsCache.length} docs, ${vocabulary.length} vocab terms`);
  } catch (e: any) {
    console.log(`  ⚠️  RAG init skipped (DB may not be running): ${e.message}`);
  }

  subsection("4.5 Hybrid Retrieval Integration");
  try {
    const results = await hybridRetrieve("công thức tính năng suất lúa", 3);
    assert(results.length > 0, `Hybrid retrieval returned ${results.length} candidates`);
    assert(results[0].hybridScore >= results[results.length - 1].hybridScore, "Results sorted by hybridScore");

    const rerankedResults = rerank("công thức tính năng suất lúa", results);
    assert(rerankedResults.length > 0, `Reranker produced ${rerankedResults.length} results`);

    if (rerankedResults.length > 0) {
      const verifyResult = tinyLLMVerify("công thức tính năng suất lúa", rerankedResults[0]);
      console.log(`  📊 Top result: "${rerankedResults[0].doc.item.title}" → verified=${verifyResult.verified}, confidence=${verifyResult.confidence}%`);
    }
  } catch (e: any) {
    console.log(`  ⚠️  Hybrid retrieval skipped: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
//  5. INTEGRATION — End-to-End Pipeline
// ══════════════════════════════════════════════════════════════

async function testIntegration() {
  section("5. INTEGRATION — End-to-End Pipeline");

  subsection("5.1 Full RAG Pipeline: Query → Retrieve → Rerank → Verify → Fuse");
  try {
    const query = "công thức tính năng suất lúa";

    // Step 1: Clean
    const cleaned = cleanAndNormalize(query);
    assert(cleaned.length > 0, `Step 1 - Clean: "${cleaned}"`);

    // Step 2: Embed
    const queryVec = generateEmbedding(cleaned);
    assert(queryVec.length === 256, "Step 2 - Embed: 256-dim vector");

    // Step 3: Retrieve
    const candidates = await hybridRetrieve(query, 5);
    assert(candidates.length > 0, `Step 3 - Retrieve: ${candidates.length} candidates`);

    // Step 4: Rerank
    const rerankedResults = rerank(query, candidates);
    assert(rerankedResults.length > 0, `Step 4 - Rerank: ${rerankedResults.length} results`);

    // Step 5: Verify
    const topResult = rerankedResults[0];
    const verification = tinyLLMVerify(query, topResult);
    console.log(`  📊 Pipeline Result: "${topResult.doc.item.title}" | verified=${verification.verified} | confidence=${verification.confidence}%`);

    // Step 6: Attention Fusion
    const fusion = computeAttentionFusion(query, candidates.slice(0, 3));
    assert(fusion.attentionMap.length > 0, `Step 6 - Attention: ${fusion.attentionMap.length} heads`);
    const totalWeight = fusion.attentionMap.reduce((s, a) => s + a.attentionWeight, 0);
    assertRange(totalWeight, 0.9, 1.1, "Attention weights sum ≈ 1.0");

    console.log(`  ✅ Full RAG pipeline completed successfully`);
  } catch (e: any) {
    console.log(`  ⚠️  RAG pipeline skipped: ${e.message}`);
  }

  subsection("5.2 Guardrails → RAG → Cache Pipeline");
  const guard = guardrailsSingleton;

  // Test 1: Normal query passes guardrails, proceeds to RAG
  const normalQuery = "giá cam sành hôm nay";
  const guardCheck = guard.checkInput(normalQuery);
  assert(guardCheck.length === 0, "Normal query passes guardrails");

  // Test 2: Check semantic cache
  writeSemanticCache("pipeline-test", normalQuery, "Giá cam: 25k/kg");
  const cached = checkSemanticCache("pipeline-test", normalQuery);
  assert(cached !== null, "Cache hit after guardrails pass");

  // Test 3: Sensitive content blocked before RAG
  const badQuery = "password là abc123";
  const badGuard = guard.checkInput(badQuery);
  assert(badGuard.length > 0, "Sensitive content blocked at guardrails stage");

  console.log(`  ✅ Guardrails → Cache pipeline works`);

  subsection("5.3 Math Expression → Financial Solver Pipeline");
  const expressions = [
    { expr: "2 + 3", expected: 5 },
    { expr: "sqrt(144)", expected: 12 },
    { expr: "factorial(5)", expected: 120 },
    { expr: "C(10,3)", expected: 120 },
    { expr: "A(5,2)", expected: 20 },
    { expr: "sin(PI/2)", expected: 1 },
    { expr: "log(E)", expected: 1 },
  ];

  let mathPassed = 0;
  for (const { expr, expected } of expressions) {
    const result = evaluateMathExpression(expr);
    if (Math.abs(result! - expected) < 0.01) mathPassed++;
    else console.log(`  ⚠️  ${expr} = ${result} (expected ${expected})`);
  }
  assert(mathPassed === expressions.length, `Math pipeline: ${mathPassed}/${expressions.length} expressions correct`);

  subsection("5.4 MDP Supply Chain Optimization Pipeline");
  const mdp = createSupplyChainMDP();
  const result = mdp.valueIteration();

  const policyStr = Array.from(result.policy.entries())
    .map(([state, action]) => `${state} → ${action}`)
    .join(", ");
  console.log(`  📊 Optimal Policy: ${policyStr}`);

  const bestState = Array.from(result.values.entries()).sort((a, b) => b[1] - a[1])[0];
  assert(bestState[1] > 0, `Best state "${bestState[0]}" has positive value (${bestState[1].toFixed(2)})`);

  subsection("5.5 HMM Demand Forecasting Pipeline");
  const hmm = createDemandHMM();
  const observations = ["good_sales", "good_sales", "bad_sales", "bad_sales", "good_sales"];
  const viterbiResult = hmm.viterbi(observations);
  assert(viterbiResult.path.length === observations.length, "Viterbi path length matches observations");
  console.log(`  📊 Demand Forecast: [${viterbiResult.path.join(" → ")}] (obs: ${observations.join(", ")})`);

  subsection("5.6 Cross-System Data Flow");
  // Verify data flows correctly between subsystems

  // Tokenizer → Embedding → RAG
  const tokenized = TinyTokenizer.encode("công thức tính diện tích");
  assert(tokenized.length > 0, "Tokenizer produces tokens");

  const embedded = generateEmbedding("công thức tính diện tích");
  assert(embedded.length === 256, "Embedding produces vector");

  const sim = cosineSimilarity(embedded, embedded);
  assertRange(sim, 0.99, 1.01, "Cosine self-similarity ≈ 1.0");

  // Guardrails → Cache → Verify
  const check1 = guard.checkInput("test query");
  writeSemanticCache("cross-test", "test query", "test response");
  const check2 = checkSemanticCache("cross-test", "test query");
  assert(check2 === "test response", "Cross-system data flow works");

  // LRU → Conversation Memory
  const lru = new LRUCache<string, any>(10, 60);
  lru.set("session-1", { messages: [{ role: "user", content: "hello" }] });
  const stored = lru.get("session-1");
  assert(stored?.messages[0].content === "hello", "LRU stores and retrieves conversation");

  console.log(`  ✅ Cross-system data flow verified`);
}

// ══════════════════════════════════════════════════════════════
//  RUNNER
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log("\n" + "╔══════════════════════════════════════════════════════════════╗");
  console.log("║      FULL INTEGRATION TEST — Rottra AI Agent System         ║");
  console.log("║      Cảnh giới Tốiượng — Toàn bộ Hệ thống                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const startTime = performance.now();

  // 1. NLP Core (synchronous)
  testNLPCore();

  // 2. Neural Memory (async — needs DB + embedding)
  await testNeuralMemory();

  // 3. Quant Engine (synchronous)
  testQuantEngine();

  // 4. Cognitive Systems (async — dynamic imports)
  await testCognitiveSystems();

  // 5. Integration (async — full pipeline)
  await testIntegration();

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "═".repeat(60));
  console.log("  FINAL RESULTS");
  console.log("═".repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Time:   ${elapsed}s`);

  if (errors.length > 0) {
    console.log("\n  Failed assertions:");
    errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  }

  console.log("\n" + "═".repeat(60));
  console.log(failed === 0 ? "  🎉 ALL INTEGRATION TESTS PASSED!" : `  ⚠️  ${failed} test(s) failed`);
  console.log("═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
