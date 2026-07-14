/**
 * ML Pipeline — Clustering Algorithms
 * KMeans, DBSCAN, Hierarchical (Agglomerative)
 */

import { Deterministic } from "~/shared/utils/rng";
import { silhouetteScore, type ClusteringMetrics } from "./evaluator";

export type ClustererType = "kmeans" | "dbscan" | "hierarchical";

export interface ClustererConfig {
  type: ClustererType;
  k?: number;
  eps?: number;
  minSamples?: number;
  linkage?: "single" | "complete" | "average";
  maxIterations?: number;
}

export interface ClusteringResult {
  labels: number[];
  centroids?: number[][];
  numClusters: number;
  metrics: ClusteringMetrics;
}

function dist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// ── KMeans (Lloyd's algorithm) ──────────────────────────────

function kmeans(data: number[][], k: number, maxIter: number = 100): ClusteringResult {
  const n = data.length;
  const d = data[0].length;
  if (n === 0) return { labels: [], numClusters: 0, metrics: { silhouetteScore: 0, inertia: 0, numClusters: 0 } };

  // K-Means++ initialization
  const centroids: number[][] = [];
  const firstIdx = Math.floor(Deterministic.random() * n);
  centroids.push([...data[firstIdx]]);

  for (let c = 1; c < k; c++) {
    const dists = data.map((p) => Math.min(...centroids.map((cent) => dist(p, cent))));
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = Deterministic.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push([...data[i]]);
        break;
      }
    }
    if (centroids.length === c) centroids.push([...data[Math.floor(Deterministic.random() * n)]]);
  }

  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d2 = dist(data[i], centroids[c]);
        if (d2 < bestD) {
          bestD = d2;
          best = c;
        }
      }
      if (labels[i] !== best) changed = true;
      labels[i] = best;
    }
    if (!changed) break;

    // Update centroids
    const counts = new Array(k).fill(0);
    for (let c = 0; c < k; c++) centroids[c] = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      counts[labels[i]]++;
      for (let j = 0; j < d; j++) centroids[labels[i]][j] += data[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < d; j++) centroids[c][j] /= counts[c];
      }
    }
  }

  // Inertia
  let inertia = 0;
  for (let i = 0; i < n; i++) inertia += dist(data[i], centroids[labels[i]]) ** 2;

  const sil = silhouetteScore(data, labels);
  return { labels, centroids, numClusters: k, metrics: { silhouetteScore: sil, inertia, numClusters: k } };
}

// ── DBSCAN ──────────────────────────────────────────────────

function dbscan(data: number[][], eps: number, minSamples: number): ClusteringResult {
  const n = data.length;
  const labels = new Array(n).fill(-1); // -1 = unvisited
  let clusterId = 0;

  const regionQuery = (p: number): number[] => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (dist(data[p], data[i]) <= eps) neighbors.push(i);
    }
    return neighbors;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minSamples) {
      labels[i] = -1; // noise
      continue;
    }
    labels[i] = clusterId;
    const queue = [...neighbors];
    const visited = new Set([i]);
    while (queue.length > 0) {
      const q = queue.shift()!;
      if (visited.has(q)) continue;
      visited.add(q);
      const qNeighbors = regionQuery(q);
      if (qNeighbors.length >= minSamples) {
        for (const nn of qNeighbors) {
          if (!visited.has(nn)) queue.push(nn);
        }
      }
      if (labels[q] === -1) labels[q] = clusterId;
      else if (labels[q] === undefined || labels[q] < 0) labels[q] = clusterId;
    }
    clusterId++;
  }

  const sil = labels.some((l) => l === -1) ? 0 : silhouetteScore(data, labels);
  return {
    labels: labels.map((l) => (l === -1 ? clusterId : l)),
    numClusters: clusterId,
    metrics: { silhouetteScore: sil, inertia: 0, numClusters: clusterId },
  };
}

// ── Hierarchical (Agglomerative) ────────────────────────────

function hierarchical(data: number[][], numClusters: number, linkage: string = "average"): ClusteringResult {
  const n = data.length;
  if (n === 0) return { labels: [], numClusters: 0, metrics: { silhouetteScore: 0, inertia: 0, numClusters: 0 } };

  // Distance matrix
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dist(data[i], data[j]);
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }
  }

  const clusters: Set<number>[] = Array.from({ length: n }, (_, i) => new Set([i]));
  let currentClusters = n;

  while (currentClusters > numClusters) {
    let minDist = Infinity;
    let mergeI = 0;
    let mergeJ = 1;

    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].size === 0) continue;
      for (let j = i + 1; j < clusters.length; j++) {
        if (clusters[j].size === 0) continue;
        let d = 0;
        let count = 0;
        for (const a of clusters[i]) {
          for (const b of clusters[j]) {
            d += distMatrix[a][b];
            count++;
          }
        }
        if (linkage === "single") d = Math.min(...[...clusters[i]].flatMap((a) => [...clusters[j]].map((b) => distMatrix[a][b])));
        else if (linkage === "complete") d = Math.max(...[...clusters[i]].flatMap((a) => [...clusters[j]].map((b) => distMatrix[a][b])));
        else d /= count || 1;

        if (d < minDist) {
          minDist = d;
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    // Merge
    for (const b of clusters[mergeJ]) clusters[mergeI].add(b);
    clusters[mergeJ] = new Set();
    currentClusters--;
  }

  // Assign labels
  const labels = new Array(n).fill(0);
  let label = 0;
  for (const cluster of clusters) {
    if (cluster.size === 0) continue;
    for (const idx of cluster) labels[idx] = label;
    label++;
  }

  const sil = silhouetteScore(data, labels);
  return { labels, numClusters: label, metrics: { silhouetteScore: sil, inertia: 0, numClusters: label } };
}

// ── Public API ──────────────────────────────────────────────

export function runClustering(data: number[][], config: ClustererConfig): ClusteringResult {
  switch (config.type) {
    case "kmeans":
      return kmeans(data, config.k || 3, config.maxIterations || 100);
    case "dbscan":
      return dbscan(data, config.eps || 0.5, config.minSamples || 3);
    case "hierarchical":
      return hierarchical(data, config.k || 3, config.linkage || "average");
  }
}
