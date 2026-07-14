import { Hono } from "hono";
import { db } from "~/infra/database/db-pool";
import { product } from "~/infra/database/schema";
import { eq, sql } from "drizzle-orm";
import { getPreciseImageForProduct, isCloudflare } from "~/routes/api/[...paths]";
import fs from "node:fs";
import path from "node:path";

function getProceduralPoints(productName: string): { x: number; y: number; isStart?: boolean }[] {
  let hash = 0;
  for (let i = 0; i < productName.length; i++) {
    hash = productName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pts: { x: number; y: number; isStart?: boolean }[] = [];
  const shapeType = Math.abs(hash) % 3;
  if (shapeType === 0) {
    const numSides = 8 + (Math.abs(hash) % 5);
    for (let i = 0; i <= numSides; i++) {
      const angle = (i * 2 * Math.PI) / numSides;
      const r = 16 + Math.sin(angle * 3 + hash) * 3;
      pts.push({
        x: Math.round(r * Math.cos(angle)),
        y: Math.round(r * Math.sin(angle)),
        isStart: i === 0,
      });
    }
    pts.push({ x: 0, y: -15, isStart: true });
    pts.push({ x: 5, y: -22 });
    pts.push({ x: -2, y: -25 });
    pts.push({ x: 0, y: -15 });
  } else if (shapeType === 1) {
    pts.push({ x: -15, y: 15, isStart: true });
    pts.push({ x: 15, y: 15 });
    pts.push({ x: 10, y: -15 });
    pts.push({ x: -10, y: -15 });
    pts.push({ x: -15, y: 15 });
    pts.push({ x: -10, y: 0, isStart: true });
    pts.push({ x: 10, y: 0 });
  } else {
    const numPoints = 5 + (Math.abs(hash) % 4);
    for (let i = 0; i <= numPoints * 2; i++) {
      const angle = (i * Math.PI) / numPoints;
      const r = i % 2 === 0 ? 20 : 8;
      pts.push({
        x: Math.round(r * Math.cos(angle)),
        y: Math.round(r * Math.sin(angle)),
        isStart: i === 0,
      });
    }
  }
  return pts;
}

function colorizePoints(shape: string, points: any[]): any[] {
  const p = shape.toLowerCase();
  let getPtColor: (idx: number, isStart?: boolean) => string;

  if (p.includes("ngô") || p.includes("corn") || p.includes("bắp")) {
    getPtColor = (idx: number) => {
      if (idx < 12) return "#16a34a";
      if (idx < 24) return "#facc15";
      return "#d97706";
    };
  } else if (
    p.includes("thảo dược") ||
    p.includes("herb") ||
    p.includes("chè") ||
    p.includes("trà") ||
    p.includes("tea") ||
    p.includes("sâm") ||
    p.includes("ginseng") ||
    p.includes("măng") ||
    p.includes("bamboo")
  ) {
    getPtColor = (idx: number) => {
      if (idx < 2) return "#78350f";
      if (idx < 15) return "#22c55e";
      return "#ec4899";
    };
  } else if (p.includes("bơ") || p.includes("avocado")) {
    getPtColor = (idx: number) => {
      if (idx < 13) return "#14532d";
      if (idx < 22) return "#bef264";
      return "#78350f";
    };
  } else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#22c55e";
      return "#eab308";
    };
  } else if (p.includes("heo") || p.includes("pig") || p.includes("thịt")) {
    getPtColor = (idx: number) => {
      if (idx < 11) return "#f472b6";
      if (idx < 16) return "#ec4899";
      if (idx < 22) return "#111827";
      return "#f472b6";
    };
  } else if (p.includes("tỏi") || p.includes("garlic")) {
    getPtColor = (idx: number) => {
      if (idx < 25) return "#e2e8f0";
      if (idx < 35) return "#cbd5e1";
      if (idx < 40) return "#b45309";
      return "#94a3b8";
    };
  } else if (p.includes("cà phê") || p.includes("coffee")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#ef4444";
      if (idx < 10) return "#78350f";
      return "#38bdf8";
    };
  } else if (p.includes("mật") || p.includes("honey")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#b91c1c";
      if (idx < 15) return "#f59e0b";
      return "#d97706";
    };
  } else if (p.includes("cooler") || p.includes("làm mát")) {
    getPtColor = (idx: number) => {
      if (idx < 13) return "#64748b";
      return "#06b6d4";
    };
  } else if (p.includes("fertilizer") || p.includes("trùn")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#78350f";
      return "#22c55e";
    };
  } else if (p.includes("sensor") || p.includes("iot")) {
    getPtColor = (idx: number) => {
      if (idx < 8) return "#64748b";
      return "#ef4444";
    };
  } else if (
    p.includes("fruit") ||
    p.includes("mít") ||
    p.includes("khoai") ||
    p.includes("potato") ||
    p.includes("hạt điều") ||
    p.includes("cashew") ||
    p.includes("lạc") ||
    p.includes("peanut") ||
    p.includes("tiêu") ||
    p.includes("pepper")
  ) {
    getPtColor = (idx: number) => {
      if (idx < 6) return "#fb923c";
      return "#22c55e";
    };
  } else if (p.includes("valve") || p.includes("van")) {
    getPtColor = (idx: number) => {
      if (idx < 5) return "#475569";
      return "#ef4444";
    };
  } else if (p.includes("charcoal") || p.includes("than")) {
    getPtColor = (idx: number) => {
      if (idx < 4) return "#1f2937";
      return "#ef4444";
    };
  } else if (p.includes("greenhouse") || p.includes("màng")) {
    getPtColor = (idx: number) => {
      if (idx < 6) return "#64748b";
      return "#22d3ee";
    };
  } else if (p.includes("report") || p.includes("chỉ số") || p.includes("tin")) {
    getPtColor = (idx: number) => {
      if (idx < 4) return "#64748b";
      if (idx < 8) return "#3b82f6";
      return "#10b981";
    };
  } else {
    getPtColor = () => "#3b82f6";
  }

  return points.map((pt, idx) => ({
    ...pt,
    color: pt.color || getPtColor(idx, pt.isStart),
  }));
}

function getLocalShapePoints(shape: string): { x: number; y: number; isStart?: boolean; color?: string }[] {
  const pts: { x: number; y: number; isStart?: boolean; color?: string }[] = [];
  const cx = 0;
  const cy = 0;
  const size = 20;

  if (shape === "garlic") {
    for (let i = 0; i <= 12; i++) {
      const angle = -Math.PI + (i * Math.PI) / 12;
      pts.push({ x: cx + 18 * Math.cos(angle), y: cy + 8 + 18 * Math.sin(angle), isStart: i === 0 });
    }
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      pts.push({ x: cx + 18 * (1 - t), y: cy + 8 * (1 - t) - 22 * t });
    }
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      pts.push({ x: cx - 18 * t, y: cy - 22 * (1 - t) + 8 * t });
    }
    pts.push({ x: cx, y: cy - 22, isStart: true });
    pts.push({ x: cx, y: cy + 26 });
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx - 8, y: cy + 5 });
    pts.push({ x: cx - 4, y: cy + 24 });
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx + 8, y: cy + 5 });
    pts.push({ x: cx + 4, y: cy + 24 });
  } else if (shape === "rice") {
    pts.push({ x: cx - 10, y: cy + 25, isStart: true });
    pts.push({ x: cx - 5, y: cy + 10 });
    pts.push({ x: cx, y: cy });
    pts.push({ x: cx + 5, y: cy - 10 });
    pts.push({ x: cx + 10, y: cy - 25 });
    pts.push({ x: cx - 5, y: cy + 10, isStart: true });
    pts.push({ x: cx - 20, y: cy + 5 });
    pts.push({ x: cx - 5, y: cy + 10 });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx + 15, y: cy - 5 });
    pts.push({ x: cx, y: cy });
    pts.push({ x: cx + 5, y: cy - 10, isStart: true });
    pts.push({ x: cx - 10, y: cy - 15 });
    pts.push({ x: cx + 5, y: cy - 10 });
    pts.push({ x: cx + 10, y: cy - 25, isStart: true });
    pts.push({ x: cx + 20, y: cy - 30 });
    pts.push({ x: cx + 10, y: cy - 25 });
  } else if (shape === "cooler") {
    for (let i = 0; i <= 12; i++) {
      const angle = (i * 2 * Math.PI) / 12;
      pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
    }
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx, y: cy - size });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx + size, y: cy });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx, y: cy + size });
    pts.push({ x: cx, y: cy, isStart: true });
    pts.push({ x: cx - size, y: cy });
  } else if (shape === "fertilizer") {
    pts.push({ x: cx - 20, y: cy + 20, isStart: true });
    pts.push({ x: cx + 20, y: cy + 20 });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx - 20, y: cy + 20 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx - 8, y: cy - 25 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx + 8, y: cy - 25 });
  } else if (shape === "sensor") {
    pts.push({ x: cx, y: cy + 25, isStart: true });
    pts.push({ x: cx, y: cy - 5 });
    pts.push({ x: cx - 15, y: cy - 5, isStart: true });
    pts.push({ x: cx + 15, y: cy - 5 });
    pts.push({ x: cx + 15, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 5 });
    pts.push({ x: cx - 10, y: cy - 30, isStart: true });
    pts.push({ x: cx, y: cy - 35 });
    pts.push({ x: cx + 10, y: cy - 30 });
  } else if (shape === "pig") {
    for (let i = 0; i <= 10; i++) {
      const angle = (i * 2 * Math.PI) / 10;
      pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle), isStart: i === 0 });
    }
    pts.push({ x: cx - 10, y: cy + 5, isStart: true });
    pts.push({ x: cx + 10, y: cy + 5 });
    pts.push({ x: cx + 10, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 5 });
    pts.push({ x: cx - 4, y: cy + 10, isStart: true });
    pts.push({ x: cx - 4, y: cy + 11 });
    pts.push({ x: cx + 4, y: cy + 10, isStart: true });
    pts.push({ x: cx + 4, y: cy + 11 });
    pts.push({ x: cx - 6, y: cy - 5, isStart: true });
    pts.push({ x: cx - 6, y: cy - 4 });
    pts.push({ x: cx + 6, y: cy - 5, isStart: true });
    pts.push({ x: cx + 6, y: cy - 4 });
    pts.push({ x: cx - 15, y: cy - 15, isStart: true });
    pts.push({ x: cx - 25, y: cy - 25 });
    pts.push({ x: cx - 5, y: cy - 20 });
    pts.push({ x: cx + 15, y: cy - 15, isStart: true });
    pts.push({ x: cx + 25, y: cy - 25 });
    pts.push({ x: cx + 5, y: cy - 20 });
  } else if (shape === "fruit") {
    pts.push({ x: cx - 25, y: cy + 15, isStart: true });
    pts.push({ x: cx, y: cy - 20 });
    pts.push({ x: cx + 25, y: cy + 15 });
    pts.push({ x: cx - 25, y: cy + 15 });
    pts.push({ x: cx, y: cy + 5 });
    pts.push({ x: cx + 25, y: cy + 15 });
    pts.push({ x: cx - 10, y: cy + 8, isStart: true });
    pts.push({ x: cx - 10, y: cy + 9 });
    pts.push({ x: cx + 10, y: cy + 8, isStart: true });
    pts.push({ x: cx + 10, y: cy + 9 });
  } else if (shape === "valve") {
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx + 20, y: cy + 10 });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx - 20, y: cy + 10 });
    pts.push({ x: cx, y: cy - 25 });
    pts.push({ x: cx - 8, y: cy + 10, isStart: true });
    pts.push({ x: cx, y: cy + 15 });
    pts.push({ x: cx + 8, y: cy + 10 });
  } else if (shape === "charcoal") {
    pts.push({ x: cx - 20, y: cy - 10, isStart: true });
    pts.push({ x: cx + 20, y: cy + 10 });
    pts.push({ x: cx - 20, y: cy + 10, isStart: true });
    pts.push({ x: cx + 20, y: cy - 10 });
    pts.push({ x: cx - 10, y: cy - 5, isStart: true });
    pts.push({ x: cx + 10, y: cy - 5 });
  } else if (shape === "corn") {
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx - 15, y: cy });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx + 15, y: cy });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx, y: cy - 25, isStart: true });
    pts.push({ x: cx, y: cy + 25 });
    pts.push({ x: cx - 12, y: cy - 10, isStart: true });
    pts.push({ x: cx + 12, y: cy - 10 });
    pts.push({ x: cx - 15, y: cy, isStart: true });
    pts.push({ x: cx + 15, y: cy });
    pts.push({ x: cx - 12, y: cy + 10, isStart: true });
    pts.push({ x: cx + 12, y: cy + 10 });
  } else if (shape === "coffee") {
    pts.push({ x: cx - 20, y: cy - 10, isStart: true });
    pts.push({ x: cx + 20, y: cy - 10 });
    pts.push({ x: cx + 15, y: cy + 15 });
    pts.push({ x: cx - 15, y: cy + 15 });
    pts.push({ x: cx - 20, y: cy - 10 });
    pts.push({ x: cx + 15, y: cy - 5, isStart: true });
    pts.push({ x: cx + 25, y: cy - 5 });
    pts.push({ x: cx + 22, y: cy + 10 });
    pts.push({ x: cx + 15, y: cy + 10 });
    pts.push({ x: cx - 8, y: cy - 15, isStart: true });
    pts.push({ x: cx - 8, y: cy - 25 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx, y: cy - 25 });
    pts.push({ x: cx + 8, y: cy - 15, isStart: true });
    pts.push({ x: cx + 8, y: cy - 25 });
  } else if (shape === "greenhouse") {
    pts.push({ x: cx - 25, y: cy + 20, isStart: true });
    pts.push({ x: cx + 25, y: cy + 20 });
    pts.push({ x: cx + 25, y: cy + 5 });
    pts.push({ x: cx, y: cy - 20 });
    pts.push({ x: cx - 25, y: cy + 5 });
    pts.push({ x: cx - 25, y: cy + 20 });
    pts.push({ x: cx, y: cy - 20, isStart: true });
    pts.push({ x: cx, y: cy + 20 });
    pts.push({ x: cx - 12, y: cy - 7, isStart: true });
    pts.push({ x: cx - 12, y: cy + 20 });
    pts.push({ x: cx + 12, y: cy - 7, isStart: true });
    pts.push({ x: cx + 12, y: cy + 20 });
  } else if (shape === "report") {
    pts.push({ x: cx - 18, y: cy + 18, isStart: true });
    pts.push({ x: cx + 18, y: cy + 18 });
    pts.push({ x: cx - 18, y: cy - 18, isStart: true });
    pts.push({ x: cx - 18, y: cy + 18 });
    pts.push({ x: cx - 10, y: cy + 18, isStart: true });
    pts.push({ x: cx - 10, y: cy - 2 });
    pts.push({ x: cx - 2, y: cy - 2 });
    pts.push({ x: cx - 2, y: cy + 18 });
    pts.push({ x: cx + 4, y: cy + 18, isStart: true });
    pts.push({ x: cx + 4, y: cy - 10 });
    pts.push({ x: cx + 12, y: cy - 10 });
    pts.push({ x: cx + 12, y: cy + 18 });
  } else if (shape === "honey") {
    pts.push({ x: cx - 12, y: cy - 18, isStart: true });
    pts.push({ x: cx + 12, y: cy - 18 });
    pts.push({ x: cx + 12, y: cy - 14 });
    pts.push({ x: cx - 12, y: cy - 14 });
    pts.push({ x: cx - 12, y: cy - 18 });
    pts.push({ x: cx - 10, y: cy - 14, isStart: true });
    pts.push({ x: cx - 16, y: cy - 4 });
    pts.push({ x: cx - 16, y: cy + 12 });
    pts.push({ x: cx - 10, y: cy + 20 });
    pts.push({ x: cx + 10, y: cy + 20 });
    pts.push({ x: cx + 16, y: cy + 12 });
    pts.push({ x: cx + 16, y: cy - 4 });
    pts.push({ x: cx + 10, y: cy - 14 });
    pts.push({ x: cx, y: cy - 14, isStart: true });
    pts.push({ x: cx, y: cy + 2 });
    pts.push({ x: cx - 3, y: cy + 5, isStart: true });
    pts.push({ x: cx + 3, y: cy + 5 });
    pts.push({ x: cx, y: cy + 8 });
    pts.push({ x: cx - 3, y: cy + 5 });
  } else if (shape === "avocado") {
    for (let i = 0; i <= 12; i++) {
      const angle = (i * 2 * Math.PI) / 12;
      const radiusX = 14;
      const radiusY = 22;
      const factor = angle > 0 && angle < Math.PI ? 1.25 : 0.8;
      pts.push({
        x: cx + radiusX * Math.cos(angle),
        y: cy + radiusY * Math.sin(angle) * factor,
        isStart: i === 0,
      });
    }
    for (let i = 0; i <= 8; i++) {
      const angle = (i * 2 * Math.PI) / 8;
      const radius = 6;
      pts.push({
        x: cx + radius * Math.cos(angle),
        y: cy + 6 + radius * Math.sin(angle),
        isStart: i === 0,
      });
    }
    pts.push({ x: cx, y: cy - 18, isStart: true });
    pts.push({ x: cx + 3, y: cy - 23 });
  } else {
    pts.push({ x: cx, y: cy + 25, isStart: true });
    pts.push({ x: cx, y: cy - 15 });
    pts.push({ x: cx, y: cy - 5, isStart: true });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx - 20, y: cy - 25 });
    pts.push({ x: cx - 10, y: cy - 25 });
    pts.push({ x: cx - 15, y: cy - 15 });
    pts.push({ x: cx, y: cy - 5, isStart: true });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx + 20, y: cy - 25 });
    pts.push({ x: cx + 10, y: cy - 25 });
    pts.push({ x: cx + 15, y: cy - 15 });
    pts.push({ x: cx, y: cy - 15, isStart: true });
    pts.push({ x: cx - 6, y: cy - 30 });
    pts.push({ x: cx + 6, y: cy - 30 });
    pts.push({ x: cx, y: cy - 15 });
  }
  return pts;
}

function resamplePoints(points: { x: number; y: number; isStart?: boolean }[], N: number): { x: number; y: number; isStart?: boolean }[] {
  const len = points.length;
  if (len === 0) return [];
  const resampled: { x: number; y: number; isStart?: boolean }[] = [];
  for (let i = 0; i < N; i++) {
    const index = (i * (len - 1)) / (N - 1);
    const low = Math.floor(index);
    const high = Math.ceil(index);
    const t = index - low;
    const p1 = points[low];
    const p2 = points[high];
    resampled.push({
      x: p1.x * (1 - t) + p2.x * t,
      y: p1.y * (1 - t) + p2.y * t,
      isStart: points[Math.round(index)].isStart ?? false,
    });
  }
  return resampled;
}

function dft(points: { x: number; y: number }[]): { re: number; im: number }[] {
  const N = points.length;
  const coeffs = [];
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += points[n].x * Math.cos(angle) + points[n].y * Math.sin(angle);
      im += -points[n].x * Math.sin(angle) + points[n].y * Math.cos(angle);
    }
    coeffs.push({ re, im });
  }
  return coeffs;
}

function idft(coeffs: { re: number; im: number }[]): { x: number; y: number }[] {
  const N = coeffs.length;
  const points = [];
  for (let n = 0; n < N; n++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      x += coeffs[k].re * Math.cos(angle) - coeffs[k].im * Math.sin(angle);
      y += coeffs[k].re * Math.sin(angle) + coeffs[k].im * Math.cos(angle);
    }
    points.push({ x: x / N, y: y / N });
  }
  return points;
}

function applyDiffusionModelToPoints(
  basePoints: { x: number; y: number; isStart?: boolean }[],
): { x: number; y: number; isStart?: boolean }[] {
  if (basePoints.length === 0) return [];

  const N_coeffs = 16;
  const resampled = resamplePoints(basePoints, N_coeffs);
  const baseCoeffs = dft(resampled);

  const steps = 10;
  const beta = 0.1;

  let currentCoeffs = baseCoeffs.map((c) => {
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const noiseRe = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 12;
    const noiseIm = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2) * 12;
    return {
      re: c.re + noiseRe,
      im: c.im + noiseIm,
    };
  });

  for (let t = steps; t > 0; t--) {
    const alpha_t = 1 - beta * (t / steps);

    currentCoeffs = currentCoeffs.map((c, k) => {
      const target = baseCoeffs[k];
      const gradRe = target.re - c.re;
      const gradIm = target.im - c.im;

      const u1 = Math.random() || 0.0001;
      const u2 = Math.random() || 0.0001;
      const stepNoiseRe = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * 0.8;
      const stepNoiseIm = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2) * 0.8;

      return {
        re: c.re + 0.25 * gradRe + Math.sqrt(1 - alpha_t) * stepNoiseRe,
        im: c.im + 0.25 * gradIm + Math.sqrt(1 - alpha_t) * stepNoiseIm,
      };
    });
  }

  const denoisedPoints = idft(currentCoeffs);

  return denoisedPoints.map((p, idx) => ({
    x: Math.max(-30, Math.min(30, Math.round(p.x * 100) / 100)),
    y: Math.max(-30, Math.min(30, Math.round(p.y * 100) / 100)),
    isStart: resampled[idx]?.isStart ?? false,
  }));
}

async function traceImageBuffer(buffer: Buffer): Promise<{ x: number; y: number; isStart?: boolean }[]> {
  try {
    if (isCloudflare) {
      console.warn("sharp is not supported on Cloudflare Pages");
      return [];
    }
    const sharpName = "sharp";
    const sharpModule = await import(sharpName);
    const sharp = sharpModule.default || sharpModule;

    const { data, info } = await sharp(buffer).resize(60, 60, { fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const threshold = sum / data.length;

    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
      binary[i] = data[i] < threshold ? 1 : 0;
    }

    const isEdge = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      if (binary[y * width + x] === 0) return false;
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
        if (binary[ny * width + nx] === 0) return true;
      }
      return false;
    };

    const edgePoints: { x: number; y: number; visited?: boolean }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isEdge(x, y)) {
          edgePoints.push({ x, y });
        }
      }
    }

    const paths: { x: number; y: number; isStart?: boolean }[] = [];
    const findNearestUnvisited = (pt: { x: number; y: number }) => {
      let bestDist = Infinity;
      let bestIdx = -1;
      for (let i = 0; i < edgePoints.length; i++) {
        const other = edgePoints[i];
        if (other.visited) continue;
        const d = Math.hypot(other.x - pt.x, other.y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestDist < 2.5) {
        return bestIdx;
      }
      return -1;
    };

    for (let i = 0; i < edgePoints.length; i++) {
      if (edgePoints[i].visited) continue;

      let currentIdx = i;
      edgePoints[currentIdx].visited = true;
      paths.push({ x: edgePoints[currentIdx].x, y: edgePoints[currentIdx].y, isStart: true });

      while (true) {
        const nextIdx = findNearestUnvisited(edgePoints[currentIdx]);
        if (nextIdx === -1) break;
        edgePoints[nextIdx].visited = true;
        paths.push({ x: edgePoints[nextIdx].x, y: edgePoints[nextIdx].y });
        currentIdx = nextIdx;
      }
    }

    if (paths.length === 0) return [];

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    for (const p of paths) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const maxDim = Math.max(w, h);
    const scaleFactor = 44 / maxDim;

    const cx = minX + w / 2;
    const cy = minY + h / 2;

    const normalized = paths.map((p) => ({
      x: Math.round((p.x - cx) * scaleFactor * 100) / 100,
      y: Math.round((p.y - cy) * scaleFactor * 100) / 100,
      isStart: !!p.isStart,
    }));

    const filtered: { x: number; y: number; isStart?: boolean }[] = [];
    let lastPt: { x: number; y: number } | null = null;

    for (const pt of normalized) {
      if (pt.isStart || !lastPt) {
        filtered.push(pt);
        lastPt = pt;
      } else {
        const d = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
        if (d >= 1.5) {
          filtered.push(pt);
          lastPt = pt;
        }
      }
    }

    return filtered;
  } catch (err) {
    console.error("Error tracing image buffer:", err);
    return [];
  }
}

async function traceImageFromUrlOrPath(urlOrPath: string): Promise<{ x: number; y: number; isStart?: boolean }[]> {
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    try {
      const response = await fetch(urlOrPath);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return await traceImageBuffer(buffer);
    } catch (err) {
      console.error("Failed to download image from URL for tracing:", err);
    }
  } else {
    let localPath = urlOrPath;
    if (urlOrPath.startsWith("file://")) {
      localPath = urlOrPath.replace("file://", "");
    } else if (urlOrPath.startsWith("/")) {
      localPath = path.join(process.cwd(), "public", urlOrPath);
    } else {
      localPath = path.join(process.cwd(), urlOrPath);
    }

    if (fs.existsSync(localPath)) {
      try {
        const buffer = fs.readFileSync(localPath);
        return await traceImageBuffer(buffer);
      } catch (err) {
        console.error("Failed to read local image for tracing:", err);
      }
    }
  }
  return [];
}

export function registerDrawingRoutes(app: Hono) {
  app.post("/agent/generate-drawing", async (c: any) => {
    try {
      let body: any;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ success: false, error: "Invalid JSON body." }, 400);
      }
      const { productName, skillLevel = 5 } = body;
      if (!productName) {
        return c.json({ success: false, error: "Missing productName." }, 400);
      }

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "AiDrawingPath" (
          "productName" TEXT PRIMARY KEY,
          "points" JSONB NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      try {
        const cached = await db.execute(sql`
          SELECT points FROM "AiDrawingPath" WHERE "productName" = ${productName}
        `);
        if (cached && cached.rows && cached.rows.length > 0) {
          const pts = cached.rows[0].points;
          const p = productName.toLowerCase();
          const isOldProcedural = (p.includes("tỏi") || p.includes("garlic")) && pts.length < 25;
          if (Array.isArray(pts) && pts.length > 0 && !isOldProcedural) {
            return c.json({ success: true, points: pts });
          }
        }
      } catch (cacheReadErr) {
        console.warn("Failed to read drawing cache from DB:", cacheReadErr);
      }

      let pts: { x: number; y: number; isStart?: boolean }[] = [];

      try {
        let imgUrl: string | undefined;
        const dbProduct = await db.query.product.findFirst({
          where: eq(product.name, productName),
        });
        if (dbProduct && dbProduct.media) {
          const mediaList = typeof dbProduct.media === "string" ? JSON.parse(dbProduct.media) : dbProduct.media;
          if (Array.isArray(mediaList) && mediaList.length > 0) {
            const firstMedia = mediaList[0];
            imgUrl = firstMedia.link || firstMedia.src || (typeof firstMedia === "string" ? firstMedia : undefined);
          }
        }

        if (!imgUrl || imgUrl.includes("placehold.co") || imgUrl.includes("default")) {
          const precise = await getPreciseImageForProduct(productName, "");
          if (precise) {
            imgUrl = precise;
          }
        }

        if (imgUrl) {
          console.log(`[AGENT OBSERVATION] Agent is observing image: ${imgUrl} for product: ${productName}`);
          const tracedPoints = await traceImageFromUrlOrPath(imgUrl);
          if (tracedPoints.length > 0) {
            console.log(`[AGENT DRAWING] Traced ${tracedPoints.length} points from observed image.`);
            pts = tracedPoints;
          }
        }
      } catch (err) {
        console.warn("Failed to trace product image, falling back:", err);
      }

      if (pts.length === 0) {
        const p = productName.toLowerCase();
        let shape = "herb";
        if (p.includes("bơ") || p.includes("avocado")) shape = "avocado";
        else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) shape = "rice";
        else if (p.includes("báo cáo") || p.includes("chỉ số") || p.includes("tin") || p.includes("bản tin") || p.includes("report"))
          shape = "report";
        else if (p.includes("phân") || p.includes("trùn") || p.includes("fertilizer")) shape = "fertilizer";
        else if (p.includes("cảm biến") || p.includes("iot") || p.includes("sensor")) shape = "sensor";
        else if (p.includes("heo") || p.includes("thịt") || p.includes("pig") || p.includes("bò")) shape = "pig";
        else if (
          p.includes("mít") ||
          p.includes("sấy") ||
          p.includes("fruit") ||
          p.includes("khoai") ||
          p.includes("potato") ||
          p.includes("hạt điều") ||
          p.includes("cashew") ||
          p.includes("lạc") ||
          p.includes("peanut") ||
          p.includes("tiêu") ||
          p.includes("pepper")
        )
          shape = "fruit";
        else if (p.includes("tưới") || p.includes("van") || p.includes("valve")) shape = "valve";
        else if (p.includes("than") || p.includes("charcoal") || p.includes("biochar")) shape = "charcoal";
        else if (p.includes("ngô") || p.includes("bắp") || p.includes("corn")) shape = "corn";
        else if (p.includes("cà phê") || p.includes("coffee")) shape = "coffee";
        else if (p.includes("màng") || p.includes("nhà kính") || p.includes("greenhouse") || p.includes("kéo")) shape = "greenhouse";
        else if (p.includes("làm mát") || p.includes("cooler") || p.includes("sấy thăng hoa")) shape = "cooler";
        else if (p.includes("mật") || p.includes("ong") || p.includes("honey")) shape = "honey";
        else if (p.includes("tỏi") || p.includes("garlic")) shape = "garlic";
        else if (
          p.includes("thảo dược") ||
          p.includes("dược") ||
          p.includes("herb") ||
          p.includes("chè") ||
          p.includes("trà") ||
          p.includes("tea") ||
          p.includes("sâm") ||
          p.includes("ginseng") ||
          p.includes("măng") ||
          p.includes("bamboo")
        )
          shape = "herb";
        else {
          pts = getProceduralPoints(productName);
        }

        if (pts.length === 0) {
          pts = getLocalShapePoints(shape);
        }
      }

      if (pts.length > 0) {
        const p = productName.toLowerCase();
        let shape = "herb";
        if (p.includes("bơ") || p.includes("avocado")) shape = "avocado";
        else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) shape = "rice";
        else if (p.includes("báo cáo") || p.includes("chỉ số") || p.includes("tin") || p.includes("bản tin") || p.includes("report"))
          shape = "report";
        else if (p.includes("phân") || p.includes("trùn") || p.includes("fertilizer")) shape = "fertilizer";
        else if (p.includes("cảm biến") || p.includes("iot") || p.includes("sensor")) shape = "sensor";
        else if (p.includes("heo") || p.includes("thịt") || p.includes("pig") || p.includes("bò")) shape = "pig";
        else if (
          p.includes("mít") ||
          p.includes("sấy") ||
          p.includes("fruit") ||
          p.includes("khoai") ||
          p.includes("potato") ||
          p.includes("hạt điều") ||
          p.includes("cashew") ||
          p.includes("lạc") ||
          p.includes("peanut") ||
          p.includes("tiêu") ||
          p.includes("pepper")
        )
          shape = "fruit";
        else if (p.includes("tưới") || p.includes("van") || p.includes("valve")) shape = "valve";
        else if (p.includes("than") || p.includes("charcoal") || p.includes("biochar")) shape = "charcoal";
        else if (p.includes("ngô") || p.includes("bắp") || p.includes("corn")) shape = "corn";
        else if (p.includes("cà phê") || p.includes("coffee")) shape = "coffee";
        else if (p.includes("màng") || p.includes("nhà kính") || p.includes("greenhouse") || p.includes("kéo")) shape = "greenhouse";
        else if (p.includes("làm mát") || p.includes("cooler") || p.includes("sấy thăng hoa")) shape = "cooler";
        else if (p.includes("mật") || p.includes("ong") || p.includes("honey")) shape = "honey";
        else if (p.includes("tỏi") || p.includes("garlic")) shape = "garlic";
        else if (
          p.includes("thảo dược") ||
          p.includes("dược") ||
          p.includes("herb") ||
          p.includes("chè") ||
          p.includes("trà") ||
          p.includes("tea") ||
          p.includes("sâm") ||
          p.includes("ginseng") ||
          p.includes("măng") ||
          p.includes("bamboo")
        )
          shape = "herb";

        console.log(`[VECTOR DIFFUSION MODEL] Denoising sinh nét vẽ ngẫu nhiên cho: ${productName}`);
        pts = applyDiffusionModelToPoints(pts);
        pts = colorizePoints(shape, pts);

        try {
          await db.execute(sql`
            INSERT INTO "AiDrawingPath" ("productName", "points")
            VALUES (${productName}, ${JSON.stringify(pts)})
            ON CONFLICT ("productName") DO UPDATE SET "points" = EXCLUDED."points"
          `);
        } catch (cacheWriteErr) {
          console.warn("Failed to write drawing cache to DB:", cacheWriteErr);
        }
      }

      return c.json({ success: true, points: pts });
    } catch (err: any) {
      console.error(err);
      return c.json({ success: false, error: err.message }, 500);
    }
  });
}
