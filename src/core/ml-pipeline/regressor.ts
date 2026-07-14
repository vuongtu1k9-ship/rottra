/**
 * ML Pipeline — Regressors
 * LinearRegression, PolynomialRegression, Ridge, Lasso
 */

import { type RegressionMetrics, regressionMetrics } from "./evaluator";

export type RegressorType = "linear" | "polynomial" | "ridge" | "lasso";

export interface RegressorConfig {
  type: RegressorType;
  degree?: number;
  alpha?: number;
  learningRate?: number;
  epochs?: number;
}

export interface TrainedRegressor {
  type: RegressorType;
  config: RegressorConfig;
  coefficients: number[];
  intercept: number;
  predict(X: number[][]): number[];
}

// ── Linear Regression (OLS with regularization) ─────────────

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const k = A[0].length;
  const result: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) for (let p = 0; p < k; p++) result[i][j] += A[i][p] * B[p][j];
  return result;
}

function matT(A: number[][]): number[][] {
  return A[0].map((_, i) => A.map((row) => row[i]));
}

function matInv(M: number[][]): number[][] {
  const n = M.length;
  const aug = M.map((row, i) => [
    ...row,
    ...Array(n)
      .fill(0)
      .map((_, j) => (i === j ? 1 : 0)),
  ]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-10) return M;
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

export function linearRegressionFit(X: number[][], y: number[], alpha: number = 0): { coefficients: number[]; intercept: number } {
  const n = X.length;
  const p = X[0].length;

  // Add bias column
  const Xb = X.map((row) => [1, ...row]);
  const Xt = matT(Xb);
  const XtX = matMul(Xt, Xb);

  // Ridge: add alpha * I
  for (let i = 0; i < XtX.length; i++) XtX[i][i] += alpha;

  const XtX_inv = matInv(XtX);
  const Xty = matMul(
    Xt,
    y.map((v) => [v]),
  );
  const beta = matMul(XtX_inv, Xty);

  return {
    intercept: beta[0][0],
    coefficients: beta.slice(1).map((row) => row[0]),
  };
}

export function linearRegressionPredict(X: number[][], coeffs: number[], intercept: number): number[] {
  return X.map((row) => row.reduce((s, v, j) => s + v * coeffs[j], intercept));
}

// ── Polynomial Regression ───────────────────────────────────

function expandPolynomial(X: number[][], degree: number): number[][] {
  return X.map((row) => {
    const expanded = [...row];
    for (let d = 2; d <= degree; d++) {
      for (let i = 0; i < row.length; i++) expanded.push(row[i] ** d);
    }
    return expanded;
  });
}

// ── Lasso (coordinate descent) ──────────────────────────────

function lassoFit(X: number[][], y: number[], alpha: number, maxIter: number = 1000): { coefficients: number[]; intercept: number } {
  const n = X.length;
  const p = X[0].length;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const coeffs = new Array(p).fill(0);
  let intercept = meanY;

  for (let iter = 0; iter < maxIter; iter++) {
    for (let j = 0; j < p; j++) {
      const residuals = y.map((yi, i) => {
        let pred = intercept;
        for (let k = 0; k < p; k++) if (k !== j) pred += X[i][k] * coeffs[k];
        return yi - pred;
      });
      const rj = residuals.reduce((s, r, i) => s + r * X[i][j], 0);
      const sj = X.reduce((s, xi) => s + xi[j] ** 2, 0) || 1e-9;

      // Soft thresholding
      const raw = rj / sj;
      coeffs[j] = Math.abs(raw) > alpha / sj ? Math.sign(raw) * (Math.abs(raw) - alpha / sj) : 0;
    }
    intercept =
      y.reduce((s, yi, i) => {
        let pred = 0;
        for (let j = 0; j < p; j++) pred += X[i][j] * coeffs[j];
        return s + (yi - pred);
      }, 0) / n;
  }

  return { coefficients: coeffs, intercept };
}

// ── Public API ──────────────────────────────────────────────

export function fitRegressor(X: number[][], y: number[], config: RegressorConfig): TrainedRegressor {
  let coeffs: number[];
  let intercept: number;

  switch (config.type) {
    case "linear":
      ({ coefficients: coeffs, intercept } = linearRegressionFit(X, y));
      break;
    case "polynomial":
      const expanded = expandPolynomial(X, config.degree || 2);
      ({ coefficients: coeffs, intercept } = linearRegressionFit(expanded, y));
      break;
    case "ridge":
      ({ coefficients: coeffs, intercept } = linearRegressionFit(X, y, config.alpha || 1.0));
      break;
    case "lasso":
      ({ coefficients: coeffs, intercept } = lassoFit(X, y, config.alpha || 0.1));
      break;
  }

  return {
    type: config.type,
    config,
    coefficients: coeffs,
    intercept,
    predict(X: number[][]): number[] {
      let data = X;
      if (config.type === "polynomial") data = expandPolynomial(X, config.degree || 2);
      return linearRegressionPredict(data, coeffs, intercept);
    },
  };
}

export function trainAndEvaluateRegressor(
  X: number[][],
  y: number[],
  config: RegressorConfig,
  testSplit: number = 0.2,
): { regressor: TrainedRegressor; trainMetrics: RegressionMetrics; testMetrics: RegressionMetrics } {
  const n = X.length;
  if (n === 0) throw new Error("No training data provided");
  const splitIdx = Math.max(1, Math.floor(n * (1 - testSplit)));

  const trainX = X.slice(0, splitIdx);
  const trainY = y.slice(0, splitIdx);
  const testX = X.slice(splitIdx);
  const testY = y.slice(splitIdx);

  const regressor = fitRegressor(trainX, trainY, config);

  return {
    regressor,
    trainMetrics: regressionMetrics(trainY, regressor.predict(trainX)),
    testMetrics: regressionMetrics(testY, regressor.predict(testX)),
  };
}
