/**
 * PAULI MATRICES — QUANTUM COGNITIVE BASIS
 * -------------------------------------------------------------------------
 * σx, σy, σz, σ0 tạo thành cơ sở không gian Liouville cho
 * suy luận agent lượng tử / quantum-classical hybrid reasoning.
 *
 * Ứng dụng:
 * - Measurement operators cho quantum attention
 * - Superposition state encoding cho ambiguous queries
 * - Entanglement correlation giữa agent pairs
 * -------------------------------------------------------------------------
 */

import type { Q8Element } from "./quaternion-group";

export type PauliMatrix = [[Complex, Complex], [Complex, Complex]];

export interface Complex {
  re: number;
  im: number;
}

export const PAULI_X: PauliMatrix = [
  [
    { re: 0, im: 0 },
    { re: 1, im: 0 },
  ],
  [
    { re: 1, im: 0 },
    { re: 0, im: 0 },
  ],
];

export const PAULI_Y: PauliMatrix = [
  [
    { re: 0, im: 0 },
    { re: 0, im: -1 },
  ],
  [
    { re: 0, im: 1 },
    { re: 0, im: 0 },
  ],
];

export const PAULI_Z: PauliMatrix = [
  [
    { re: 1, im: 0 },
    { re: 0, im: 0 },
  ],
  [
    { re: 0, im: 0 },
    { re: -1, im: 0 },
  ],
];

export const PAULI_I: PauliMatrix = [
  [
    { re: 1, im: 0 },
    { re: 0, im: 0 },
  ],
  [
    { re: 0, im: 0 },
    { re: 1, im: 0 },
  ],
];

export const PAULI_SET = { PAULI_X, PAULI_Y, PAULI_Z, PAULI_I };

export function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function complexScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

export function matMul(a: PauliMatrix, b: PauliMatrix): PauliMatrix {
  const result: PauliMatrix = [
    [
      { re: 0, im: 0 },
      { re: 0, im: 0 },
    ],
    [
      { re: 0, im: 0 },
      { re: 0, im: 0 },
    ],
  ];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      let sum: Complex = { re: 0, im: 0 };
      for (let k = 0; k < 2; k++) {
        sum = complexAdd(sum, complexMul(a[i][k], b[k][j]));
      }
      result[i][j] = sum;
    }
  }
  return result;
}

export function matTensor(a: PauliMatrix, b: PauliMatrix): PauliMatrix {
  const result: PauliMatrix = [
    [
      { re: 0, im: 0 },
      { re: 0, im: 0 },
    ],
    [
      { re: 0, im: 0 },
      { re: 0, im: 0 },
    ],
  ];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const base = a[i][j];
      result[i * 2][j * 2] = complexMul(base, b[0][0]);
      result[i * 2][j * 2 + 1] = complexMul(base, b[0][1]);
      result[i * 2 + 1][j * 2] = complexMul(base, b[1][0]);
      result[i * 2 + 1][j * 2 + 1] = complexMul(base, b[1][1]);
    }
  }
  return result;
}

export function trace(m: PauliMatrix): Complex {
  return { re: m[0][0].re + m[1][1].re, im: m[0][0].im + m[1][1].im };
}

export function measurePauli(psi: Complex[], pauli: PauliMatrix): number {
  const proj0: Complex = { re: pauli[0][0].re, im: pauli[0][0].im };
  const amp0 = complexMul(psi[0], proj0);
  const amp1 = complexMul(psi[1], pauli[1][0]);
  const totalProb = amp0.re * amp0.re + amp0.im * amp0.im + amp1.re * amp1.re + amp1.im * amp1.im;
  return totalProb;
}

export interface QuantumCognitiveState {
  alpha: Complex;
  beta: Complex;
  basis: "x" | "y" | "z";
}

export function createSuperposition(alphaRe: number, betaRe: number, basis: "x" | "y" | "z" = "z"): QuantumCognitiveState {
  return {
    alpha: { re: alphaRe, im: 0 },
    beta: { re: betaRe, im: 0 },
    basis,
  };
}

export function collapseToBasis(state: QuantumCognitiveState, basis: "x" | "y" | "z"): 0 | 1 {
  const pauli = basis === "x" ? PAULI_X : basis === "y" ? PAULI_Y : PAULI_Z;
  const psi: Complex[] = [state.alpha, state.beta];
  const prob0 = measurePauli(psi, pauli);
  return Math.random() < prob0 ? 0 : 1;
}

export function blochSphere(theta: number, phi: number): QuantumCognitiveState {
  return {
    alpha: { re: Math.cos(theta / 2), im: 0 },
    beta: { re: Math.sin(theta / 2) * Math.cos(phi), im: Math.sin(theta / 2) * Math.sin(phi) },
    basis: "z",
  };
}

export function pauliToQ8(pauli: PauliMatrix): Q8Element {
  const isX = pauli[0][1].re === 1 && pauli[1][0].re === 1;
  const isY = pauli[0][1].im === -1 && pauli[1][0].im === 1;
  const isZ = pauli[0][0].re === 1 && pauli[1][1].re === -1;
  if (isX) return "i";
  if (isY) return "j";
  if (isZ) return "k";
  return "1";
}
