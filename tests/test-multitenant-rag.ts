import { db } from "../src/infra/database/db-pool";
import { vectorDocument } from "../src/infra/database/schema";
import { generateEmbeddingAsyncAwait, initRAGEngine } from "../src/core/neural-memory/vector-rag";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { app } from "../src/routes/api/[...paths]";

async function run() {
  console.log("=================================================");
  console.log("🧪 MULTI-TENANT RAG ISOLATION & TELEMETRY TEST");
  console.log("=================================================");

  // 0. Run schema migration first
  console.log("⚙️ Running RAG Engine initialization and migration...");
  await initRAGEngine(true);

  // 1. Clean up old test data if present
  console.log("🧹 Cleaning up old test records...");
  try {
    await db.delete(vectorDocument).where(eq(vectorDocument.category, "TEST_MULTITENANT_RAG"));
  } catch (err) {
    console.error("Error cleaning test records:", err);
  }

  // 2. Prepare new test documents
  console.log("📝 Generating and seeding test documents...");

  const docA = {
    id: crypto.randomUUID(),
    category: "TEST_MULTITENANT_RAG",
    title: "Bí mật kinh doanh của Tenant A",
    subtitle: "Tài liệu tuyệt mật A",
    content: "Công thức nước sốt mayonnaise của Tenant A sử dụng dầu truffle và trứng gà organic.",
    metadata: { tags: ["mayonnaise", "tenant-a"] },
    embedding: await generateEmbeddingAsyncAwait("Công thức nước sốt mayonnaise của Tenant A sử dụng dầu truffle và trứng gà organic."),
    tenantId: "tenant-a",
  };

  const docB = {
    id: crypto.randomUUID(),
    category: "TEST_MULTITENANT_RAG",
    title: "Quy trình chế biến của Tenant B",
    subtitle: "Quy trình chuẩn B",
    content: "Tenant B sản xuất bánh pizza đế mỏng với phô mai mozzarella tươi nhập khẩu từ Ý.",
    metadata: { tags: ["pizza", "tenant-b"] },
    embedding: await generateEmbeddingAsyncAwait("Tenant B sản xuất bánh pizza đế mỏng với phô mai mozzarella tươi nhập khẩu từ Ý."),
    tenantId: "tenant-b",
  };

  const docGlobal = {
    id: crypto.randomUUID(),
    category: "TEST_MULTITENANT_RAG",
    title: "Hướng dẫn an toàn thực phẩm chung",
    subtitle: "Tài liệu công cộng",
    content: "Tất cả nhân viên chế biến thực phẩm phải rửa tay sạch bằng xà phòng trước khi bắt đầu.",
    metadata: { tags: ["public", "safety"] },
    embedding: await generateEmbeddingAsyncAwait("Tất cả nhân viên chế biến thực phẩm phải rửa tay sạch bằng xà phòng trước khi bắt đầu."),
    tenantId: null,
  };

  await db.insert(vectorDocument).values([docA, docB, docGlobal]);
  console.log("✅ Seeded test documents successfully.");

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
    }
  }

  // --- PART 1: Direct hybridRetrieve validation ---
  console.log("\n🔍 [Test Part 1] Calling hybridRetrieve directly...");

  const { hybridRetrieve, clearRAGCache } = await import("../src/core/neural-memory/vector-rag");

  // Clear cache to avoid contaminated states
  clearRAGCache();

  // Test Case 1.1: Request with tenantId: "tenant-a"
  // Should retrieve A and Global, but NOT B.
  const resultsA = await hybridRetrieve("mayonnaise truffle rửa tay xà phòng", 5, "tenant-a");
  const titlesA = resultsA.map(r => r.doc.item.title);
  assert(titlesA.includes(docA.title), "Tenant A retrieve finds Tenant A document");
  assert(titlesA.includes(docGlobal.title), "Tenant A retrieve finds Global document");
  assert(!titlesA.includes(docB.title), "Tenant A retrieve DOES NOT find Tenant B document");

  // Test Case 1.2: Request with tenantId: "tenant-b"
  // Should retrieve B and Global, but NOT A.
  clearRAGCache();
  const resultsB = await hybridRetrieve("mozzarella pizza rửa tay xà phòng", 5, "tenant-b");
  const titlesB = resultsB.map(r => r.doc.item.title);
  assert(titlesB.includes(docB.title), "Tenant B retrieve finds Tenant B document");
  assert(titlesB.includes(docGlobal.title), "Tenant B retrieve finds Global document");
  assert(!titlesB.includes(docA.title), "Tenant B retrieve DOES NOT find Tenant A document");

  // Test Case 1.3: Request with tenantId: null (Global/Public access)
  // Should ONLY retrieve Global, NOT A nor B.
  clearRAGCache();
  const resultsGlobal = await hybridRetrieve("rửa tay xà phòng", 5, null);
  const titlesGlobal = resultsGlobal.map(r => r.doc.item.title);
  assert(titlesGlobal.includes(docGlobal.title), "Global retrieve finds Global document");
  assert(!titlesGlobal.includes(docA.title), "Global retrieve DOES NOT find Tenant A document");
  assert(!titlesGlobal.includes(docB.title), "Global retrieve DOES NOT find Tenant B document");


  // --- PART 2: Hono API Routing validation ---
  console.log("\n🌐 [Test Part 2] Calling API endpoints via Hono app.request()...");

  // Test Case 2.1: /api/agent/hybrid-retrieve with tenant-a
  const res1 = await app.request("/api/agent/hybrid-retrieve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": "tenant-a",
    },
    body: JSON.stringify({
      query: "mayonnaise truffle rửa tay xà phòng",
      topK: 5,
    }),
  });
  assert(res1.status === 200, "API /hybrid-retrieve returns status 200");
  const data1 = await res1.json() as any;
  const apiTitlesA = (data1.candidates || data1.results || []).map((r: any) => r.doc?.item?.title || r.title);
  assert(apiTitlesA.includes(docA.title), "API with tenant-a header finds Tenant A document");
  assert(!apiTitlesA.includes(docB.title), "API with tenant-a header DOES NOT find Tenant B document");

  // Test Case 2.2: /api/agent/chat-expert with tenant-b
  const res2 = await app.request("/api/agent/chat-expert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": "tenant-b",
    },
    body: JSON.stringify({
      query: "Hãy giải thích quy trình chuẩn làm bánh pizza của tôi và rửa tay xà phòng",
    }),
  });
  assert(res2.status === 200, "API /chat-expert returns status 200");
  const data2 = await res2.json() as any;
  assert(data2.success === true, "API /chat-expert returns success");

  // Test Case 2.3: /api/agent/chat with tenant-a
  const res3 = await app.request("/api/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": "tenant-a",
    },
    body: JSON.stringify({
      query: "Tài liệu Công thức Mayonnaise của tôi được làm từ nguyên liệu gì?",
    }),
  });
  assert(res3.status === 200, "API /agent/chat returns status 200");
  const data3 = await res3.json() as any;
  assert(typeof data3.text === "string", "API /agent/chat returns success");


  // --- PART 3: Clean up after test ---
  console.log("\n🧹 Cleaning up test records from database...");
  try {
    await db.delete(vectorDocument).where(eq(vectorDocument.category, "TEST_MULTITENANT_RAG"));
  } catch (err) {
    console.error("Error during post-test cleanup:", err);
  }

  console.log("\n=================================================");
  console.log(`📊 TEST RESULTS: PASSED ${passedCount}/${totalTests}`);
  console.log("=================================================");

  if (passedCount === totalTests) {
    console.log("🎉 SUCCESS: MULTI-TENANT RAG ISOLATION VERIFIED!");
    process.exit(0);
  } else {
    console.error("❌ FAILURE: SOME MULTI-TENANT TESTS FAILED!");
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Critical error in test run:", err);
  process.exit(1);
});
