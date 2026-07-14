/**
 * ML Pipeline — Evaluation Metrics
 * Zero-dependency implementations of classification & regression metrics.
 */

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  precisionPerClass: number[];
  recallPerClass: number[];
  f1PerClass: number[];
  confusionMatrix: number[][];
  support: number[];
}

export interface RegressionMetrics {
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  mape: number;
}

export interface ClusteringMetrics {
  silhouetteScore: number;
  inertia: number;
  numClusters: number;
}

/** Build confusion matrix from true/predicted labels. */
export function confusionMatrix(trueLabels: number[], predLabels: number[], numClasses: number): number[][] {
  const matrix: number[][] = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));
  for (let i = 0; i < trueLabels.length; i++) {
    matrix[trueLabels[i]][predLabels[i]]++;
  }
  return matrix;
}

/** Compute precision, recall, F1 per class then macro-average. */
export function classificationMetrics(trueLabels: number[], predLabels: number[], numClasses: number): EvaluationMetrics {
  const cm = confusionMatrix(trueLabels, predLabels, numClasses);
  const support: number[] = [];
  const precisionPerClass: number[] = [];
  const recallPerClass: number[] = [];
  const f1PerClass: number[] = [];

  for (let c = 0; c < numClasses; c++) {
    let rowSum = 0;
    let colSum = 0;
    for (let j = 0; j < numClasses; j++) {
      rowSum += cm[c][j];
      colSum += cm[j][c];
    }
    support.push(rowSum);
    const prec = colSum > 0 ? cm[c][c] / colSum : 0;
    const rec = rowSum > 0 ? cm[c][c] / rowSum : 0;
    precisionPerClass.push(prec);
    recallPerClass.push(rec);
    f1PerClass.push(prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0);
  }

  const total = trueLabels.length;
  const accuracy = total > 0 ? cm.reduce((s, row, i) => s + row[i], 0) / total : 0;
  const macroP = precisionPerClass.reduce((a, b) => a + b, 0) / numClasses;
  const macroR = recallPerClass.reduce((a, b) => a + b, 0) / numClasses;
  const macroF1 = f1PerClass.reduce((a, b) => a + b, 0) / numClasses;

  return {
    accuracy,
    precision: macroP,
    recall: macroR,
    f1Score: macroF1,
    precisionPerClass,
    recallPerClass,
    f1PerClass,
    confusionMatrix: cm,
    support,
  };
}

/** Regression metrics: MAE, MSE, RMSE, R², MAPE. */
export function regressionMetrics(trueValues: number[], predValues: number[]): RegressionMetrics {
  const n = trueValues.length;
  if (n === 0) return { mae: 0, mse: 0, rmse: 0, r2: 0, mape: 0 };

  let sumAE = 0;
  let sumSE = 0;
  let sumAPE = 0;
  const mean = trueValues.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const err = predValues[i] - trueValues[i];
    sumAE += Math.abs(err);
    sumSE += err * err;
    ssTot += (trueValues[i] - mean) * (trueValues[i] - mean);
    if (trueValues[i] !== 0) sumAPE += Math.abs(err / trueValues[i]);
  }

  return {
    mae: sumAE / n,
    mse: sumSE / n,
    rmse: Math.sqrt(sumSE / n),
    r2: ssTot > 0 ? 1 - sumSE / ssTot : 1,
    mape: (sumAPE / n) * 100,
  };
}

/** Silhouette score for clustering evaluation. */
export function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  if (n <= 1) return 0;

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const c = labels[i];
    if (!clusters.has(c)) clusters.set(c, []);
    clusters.get(c)!.push(i);
  }

  const dist = (a: number[], b: number[]): number => {
    let s = 0;
    for (let k = 0; k < a.length; k++) s += (a[k] - b[k]) ** 2;
    return Math.sqrt(s);
  };

  let totalS = 0;
  for (let i = 0; i < n; i++) {
    const ci = labels[i];
    // a(i) = mean dist to same cluster
    const sameCluster = clusters.get(ci)!.filter((j) => j !== i);
    const a = sameCluster.length > 0 ? sameCluster.reduce((s, j) => s + dist(data[i], data[j]), 0) / sameCluster.length : 0;

    // b(i) = min mean dist to other clusters
    let b = Infinity;
    for (const [c, members] of clusters) {
      if (c === ci) continue;
      const meanDist = members.reduce((s, j) => s + dist(data[i], data[j]), 0) / members.length;
      if (meanDist < b) b = meanDist;
    }

    totalS += b !== Infinity && a + b > 0 ? (b - a) / Math.max(a, b) : 0;
  }
  return totalS / n;
}
