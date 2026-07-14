/**
 * ML Pipeline — API Router
 */

import { Hono } from "hono";
import { ok, fail } from "~/shared/dtos/response";
import { type ClassifierType, trainAndEvaluate } from "~/core/ml-pipeline/classifier";
import { type RegressorType, trainAndEvaluateRegressor } from "~/core/ml-pipeline/regressor";
import { runClustering, type ClustererType } from "~/core/ml-pipeline/clusterer";
import { extractFeatures, extractNumericFeatures } from "~/core/ml-pipeline/feature-engine";
import { modelStore, type StoredModel } from "~/core/ml-pipeline/model-store";
import { autoTrain, type AutoTrainConfig } from "~/core/ml-pipeline/auto-trainer";
import { classificationMetrics } from "~/core/ml-pipeline/evaluator";

export const mlPipelineApp = new Hono();

// ── Classification ──────────────────────────────────────────

mlPipelineApp.post("/classify/train", async (c) => {
  try {
    const body = await c.req.json<{
      texts: string[];
      labels: number[];
      classNames: string[];
      config: { type: ClassifierType; k?: number; maxDepth?: number; numTrees?: number };
      testSplit?: number;
    }>();

    if (!body.texts?.length || !body.labels?.length) {
      return c.json(fail("texts and labels must be non-empty"), 400);
    }
    if (body.texts.length !== body.labels.length) {
      return c.json(fail("texts and labels must have the same length"), 400);
    }
    if (body.texts.length < 2) {
      return c.json(fail("at least 2 training samples are required"), 400);
    }

    const { features, config: featureConfig } = extractFeatures(body.texts, "tfidf", 500);
    const result = trainAndEvaluate(features, body.labels, body.config, body.classNames, featureConfig, body.testSplit || 0.2);

    const stored = modelStore.save({
      name: `classifier_${body.config.type}_${Date.now()}`,
      type: "classifier",
      algorithm: body.config.type,
      weights: (result.classifier as any).weights || {},
      hyperparams: body.config,
      metrics: result.testMetrics,
      featureConfig,
      intent: null,
      status: "active",
      trainingSamples: body.texts.length,
    });

    return c.json(ok({ modelId: stored.id, trainMetrics: result.trainMetrics, testMetrics: result.testMetrics }));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

mlPipelineApp.post("/classify/predict", async (c) => {
  try {
    const body = await c.req.json<{ modelId: number; text: string }>();
    const model = modelStore.get(body.modelId);
    if (!model) return c.json(fail("Model not found"), 404);

    const { features } = extractFeatures([body.text], model.featureConfig.method as "tfidf" | "bow", model.featureConfig.maxFeatures);
    // Reconstruct classifier from stored weights
    const classifier = await reconstructClassifier(model);
    const predictions = classifier.predict(features);
    const probabilities = classifier.predictProbabilities(features);

    return c.json(
      ok({
        prediction: predictions[0],
        probabilities: probabilities[0],
        className: model.featureConfig.vocabulary[predictions[0]] || `class_${predictions[0]}`,
      }),
    );
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

// ── Regression ──────────────────────────────────────────────

mlPipelineApp.post("/regress/train", async (c) => {
  try {
    const body = await c.req.json<{
      X: number[][];
      y: number[];
      config: { type: RegressorType; degree?: number; alpha?: number };
      testSplit?: number;
    }>();

    if (!body.X?.length || !body.y?.length) {
      return c.json(fail("X and y must be non-empty"), 400);
    }
    if (body.X.length !== body.y.length) {
      return c.json(fail("X and y must have the same length"), 400);
    }
    if (body.X.length < 2) {
      return c.json(fail("at least 2 training samples are required"), 400);
    }

    const { features } = extractNumericFeatures(body.X);
    const result = trainAndEvaluateRegressor(features, body.y, body.config, body.testSplit || 0.2);

    const stored = modelStore.save({
      name: `regressor_${body.config.type}_${Date.now()}`,
      type: "regressor",
      algorithm: body.config.type,
      weights: { coefficients: result.regressor.coefficients, intercept: result.regressor.intercept },
      hyperparams: body.config,
      metrics: result.testMetrics,
      featureConfig: { method: "normalized", maxFeatures: body.X[0]?.length || 0, vocabulary: [] },
      intent: null,
      status: "active",
      trainingSamples: body.X.length,
    });

    return c.json(ok({ modelId: stored.id, trainMetrics: result.trainMetrics, testMetrics: result.testMetrics }));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

mlPipelineApp.post("/regress/predict", async (c) => {
  try {
    const body = await c.req.json<{ modelId: number; X: number[][] }>();
    const model = modelStore.get(body.modelId);
    if (!model) return c.json(fail("Model not found"), 404);

    const { fitRegressor } = await import("~/core/ml-pipeline/regressor");
    const regressor = fitRegressor([], [], { type: model.algorithm as any, ...model.hyperparams });
    // Restore weights
    (regressor as any).coefficients = model.weights.coefficients;
    (regressor as any).intercept = model.weights.intercept;

    const predictions = regressor.predict(body.X);
    return c.json(ok({ predictions }));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

// ── Clustering ──────────────────────────────────────────────

mlPipelineApp.post("/cluster/run", async (c) => {
  try {
    const body = await c.req.json<{
      data: number[][];
      config: { type: ClustererType; k?: number; eps?: number; minSamples?: number; linkage?: "single" | "complete" | "average" };
    }>();

    if (!body.data?.length) {
      return c.json(fail("data must be non-empty"), 400);
    }

    const { features } = extractNumericFeatures(body.data);
    const result = runClustering(features, body.config);
    return c.json(ok(result));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

// ── Auto-Train ──────────────────────────────────────────────

mlPipelineApp.post("/auto-train", async (c) => {
  try {
    const body = await c.req.json<{ samples: { utterance: string; intent: string }[]; config: AutoTrainConfig }>();
    const result = autoTrain(body.samples, {
      testSplit: body.config.testSplit || 0.2,
      classifiers: body.config.classifiers || ["naive_bayes", "knn", "decision_tree", "random_forest"],
      maxUtterances: body.config.maxUtterances || 5000,
    });

    return c.json(ok(result));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

// ── Models CRUD ─────────────────────────────────────────────

mlPipelineApp.get("/models", (c) => {
  const type = c.req.query("type");
  const models = modelStore.list(type);
  return c.json(ok(models));
});

mlPipelineApp.get("/models/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const model = modelStore.get(id);
  if (!model) return c.json(fail("Model not found"), 404);
  return c.json(ok(model));
});

mlPipelineApp.delete("/models/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const deleted = modelStore.delete(id);
  if (!deleted) return c.json(fail("Model not found"), 404);
  return c.json(ok({ deleted: true }));
});

mlPipelineApp.post("/evaluate/:modelId", async (c) => {
  try {
    const id = parseInt(c.req.param("modelId"));
    const model = modelStore.get(id);
    if (!model) return c.json(fail("Model not found"), 404);
    return c.json(ok({ modelId: id, metrics: model.metrics }));
  } catch (err: any) {
    return c.json(fail(err.message), 500);
  }
});

// ── Helper ──────────────────────────────────────────────────

async function reconstructClassifier(model: StoredModel) {
  const { createClassifier } = await import("~/core/ml-pipeline/classifier");
  const config = { type: model.algorithm as ClassifierType, ...model.hyperparams };
  const classifier = createClassifier(config, 10, [], model.featureConfig);
  if ((classifier as any).weights !== undefined) {
    (classifier as any).weights = model.weights;
    if (model.weights.means) (classifier as any).means = model.weights.means;
    if (model.weights.variances) (classifier as any).variances = model.weights.variances;
    if (model.weights.priors) (classifier as any).classPriors = model.weights.priors;
    if (model.weights.trainX) {
      (classifier as any).trainX = model.weights.trainX;
      (classifier as any).trainY = model.weights.trainY;
    }
    if (model.weights.root) (classifier as any).root = model.weights.root;
    if (model.weights.w) (classifier as any).w = model.weights.w;
    if (model.weights.b !== undefined) (classifier as any).b = model.weights.b;
  }
  return classifier;
}
