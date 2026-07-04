/**
 * 🧠 ROTTRA — FEDERATED LEARNING TEST
 * Basic test for the FL system.
 */

import { flCoordinator } from "~/core/federated-learning/coordinator";
import { LocalTrainer, createLocalTrainer } from "~/core/federated-learning/local-trainer";
import { GradientExchange, createGradientExchange } from "~/core/federated-learning/gradient-exchange";
import { flBlockchainAudit } from "~/core/federated-learning/blockchain-audit";

// ── Test Helpers ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

// ── Test Suite ───────────────────────────────────────────────

async function testFederatedLearning() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║    FEDERATED LEARNING SYSTEM TEST                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── 1. Coordinator Test ────────────────────────────────────

  section("1. FL Coordinator");

  try {
    const status = await flCoordinator.getStatus();
    assert(status.totalRounds >= 0, "Get FL status works");
    console.log(`  📊 Current status: ${status.totalRounds} rounds, ${status.totalModels} models`);
  } catch (err: any) {
    assert(false, `Get status failed: ${err.message}`);
  }

  // ── 2. Local Trainer Test ──────────────────────────────────

  section("2. Local Trainer");

  const trainer = createLocalTrainer("test-node-1");
  assert(trainer !== null, "Local trainer created");

  // Generate synthetic data
  const syntheticData = Array.from({ length: 100 }, (_, i) => ({
    features: Array.from({ length: 256 }, () => Math.random()),
    label: i % 20,
  }));

  trainer.setData(syntheticData);
  console.log(`  📊 Loaded ${syntheticData.length} synthetic samples`);

  try {
    const result = await trainer.trainLocal(null, {
      localEpochs: 2,
      learningRate: 0.01,
      minNodes: 3,
      timeoutMs: 60000,
      dpEpsilon: 1.0,
      dpDelta: 1e-5,
      modelType: "intent_classifier",
    });

    assert(result.gradients.length > 0, "Training produced gradients");
    assert(result.metrics.localLoss > 0, `Loss > 0 (got ${result.metrics.localLoss.toFixed(4)})`);
    assert(result.metrics.localAccuracy > 0, `Accuracy > 0 (got ${result.metrics.localAccuracy.toFixed(4)})`);
    console.log(`  📊 Gradients: ${result.gradients.length}, Loss: ${result.metrics.localLoss.toFixed(4)}, Accuracy: ${result.metrics.localAccuracy.toFixed(4)}`);
  } catch (err: any) {
    assert(false, `Local training failed: ${err.message}`);
  }

  // ── 3. Gradient Exchange Test ──────────────────────────────

  section("3. Gradient Exchange");

  const exchange = createGradientExchange("test-node-1", "Test Farm Node");
  assert(exchange !== null, "Gradient exchange created");

  try {
    const node = await exchange.registerNode("test-farm-1");
    assert(node.id === "test-node-1", "Node registered");
    console.log(`  📊 Node: ${node.nodeName} (${node.id})`);
  } catch (err: any) {
    assert(false, `Node registration failed: ${err.message}`);
  }

  try {
    const rounds = await exchange.getAvailableRounds();
    assert(Array.isArray(rounds), "Get available rounds works");
    console.log(`  📊 Available rounds: ${rounds.length}`);
  } catch (err: any) {
    assert(false, `Get rounds failed: ${err.message}`);
  }

  // ── 4. Privacy Engine Test ─────────────────────────────────

  section("4. Privacy Engine");

  try {
    const { privacyEngine } = await import("~/core/federated-learning/privacy-engine");

    const testGradients = Array.from({ length: 5 }, () => {
      const grad = new Float32Array(100);
      for (let i = 0; i < grad.length; i++) {
        grad[i] = (Math.random() - 0.5) * 0.1;
      }
      return grad;
    });

    const noisyGradients = await privacyEngine.addDPNoise(
      testGradients,
      { epsilon: 1.0, delta: 1e-5, clipNorm: 1.0, noiseMultiplier: 1.0 },
      "test-node-1"
    );

    assert(noisyGradients.length === testGradients.length, "DP noise preserves array count");

    // Check that noise was added
    let noiseDetected = false;
    for (let i = 0; i < testGradients.length; i++) {
      for (let j = 0; j < testGradients[i].length; j++) {
        if (testGradients[i][j] !== noisyGradients[i][j]) {
          noiseDetected = true;
          break;
        }
      }
      if (noiseDetected) break;
    }
    assert(noiseDetected, "DP noise was applied to gradients");

    const budget = await privacyEngine.getPrivacyBudget("test-node-1");
    assert(budget !== null, "Privacy budget tracked");
    if (budget) {
      console.log(`  📊 Privacy budget: ε=${budget.epsilonUsed?.toFixed(4) || 0}, rounds=${budget.roundCount || 0}`);
    }
  } catch (err: any) {
    assert(false, `Privacy engine test failed: ${err.message}`);
  }

  // ── 5. Blockchain Audit Test ───────────────────────────────

  section("5. Blockchain Audit");

  try {
    // Create a mock round
    const mockRound = {
      id: "test-round-1",
      roundNumber: 1,
      status: "completed" as const,
      globalModelId: "test-model-1",
      config: {
        localEpochs: 1,
        learningRate: 0.01,
        minNodes: 3,
        timeoutMs: 60000,
        dpEpsilon: 1.0,
        dpDelta: 1e-5,
        modelType: "intent_classifier" as const,
      },
      startedAt: new Date(),
      completedAt: new Date(),
      participantCount: 3,
      aggregationMethod: "fedavg",
    };

    const blockId = await flBlockchainAudit.logRound(
      mockRound,
      "test-model-hash-123",
      ["node-1", "node-2", "node-3"],
      { accuracy: 0.85, loss: 0.15, f1Score: 0.82, precision: 0.83, recall: 0.81 }
    );

    assert(blockId !== null, "Blockchain audit log created");
    console.log(`  📊 Block ID: ${blockId}`);
  } catch (err: any) {
    assert(false, `Blockchain audit test failed: ${err.message}`);
  }

  // ── Summary ────────────────────────────────────────────────

  console.log("\n" + "═".repeat(60));
  console.log("  FINAL RESULTS");
  console.log("═".repeat(60));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log("═".repeat(60));
  console.log(failed === 0 ? "  🎉 ALL TESTS PASSED!" : `  ⚠️  ${failed} test(s) failed`);
  console.log("═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

testFederatedLearning().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
