import { Deterministic } from "~/shared/utils/rng";

export type Matrix = number[][];
export type Vector = number[];

function matMul(A: Matrix, B: Matrix): Matrix {
  const r = A.length;
  const c = A[0].length;
  const d = B[0].length;
  const C: Matrix = Array.from({ length: r }, () => new Array(d).fill(0));
  for (let i = 0; i < r; i++) {
    for (let k = 0; k < c; k++) {
      const a = A[i][k];
      for (let j = 0; j < d; j++) {
        C[i][j] += a * B[k][j];
      }
    }
  }
  return C;
}

function transpose(A: Matrix): Matrix {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function softmaxRow(A: Matrix): Matrix {
  return A.map((row) => {
    const m = Math.max(...row);
    const e = row.map((x) => Math.exp(x - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / s);
  });
}

function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
}

function layerNorm(x: Vector, g: Vector, b: Vector, e = 1e-5): Vector {
  const n = x.length;
  const m = x.reduce((a, c) => a + c, 0) / n;
  const v = x.reduce((a, c) => a + (c - m) ** 2, 0) / n;
  const s = 1 / Math.sqrt(v + e);
  return x.map((xi, i) => g[i] * (xi - m) * s + b[i]);
}

function initMatrix(r: number, c: number): Matrix {
  const sc = Math.sqrt(1 / c);
  return Array.from({ length: r }, () => Array.from({ length: c }, () => (Deterministic.random() * 2 - 1) * sc));
}

export class CharTokenizer {
  chars: string[];
  stoi: Record<string, number>;
  itos: Record<number, string>;

  constructor(t: string) {
    const u = Array.from(new Set(t.split(""))).sort();
    this.chars = u;
    this.stoi = Object.fromEntries(u.map((x, i) => [x, i]));
    this.itos = Object.fromEntries(u.map((x, i) => [i, x]));
  }

  get vocabSize(): number {
    return this.chars.length;
  }

  encode(text: string): number[] {
    return text.split("").map((x) => this.stoi[x] ?? 0);
  }

  decode(ids: number[]): string {
    return ids.map((x) => this.itos[x] ?? "").join("");
  }
}

export class Embedding {
  wte: Matrix;
  wpe: Matrix;

  constructor(vocabSize: number, dim: number, maxSeqLen: number) {
    this.wte = initMatrix(vocabSize, dim);
    this.wpe = initMatrix(maxSeqLen, dim);
  }

  forward(tokenIds: number[], seqLen: number): Matrix {
    const emb: Matrix = [];
    for (let t = 0; t < seqLen; t++) {
      const tok = tokenIds[t] ?? 0;
      const row: Vector = [];
      for (let d = 0; d < this.wte[0].length; d++) {
        row.push(this.wte[tok][d] + this.wpe[t][d]);
      }
      emb.push(row);
    }
    return emb;
  }
}

export class SelfAttention {
  dim: number;
  qkvW: Matrix;
  projW: Matrix;

  constructor(dim: number) {
    this.dim = dim;
    this.qkvW = initMatrix(dim, dim * 3);
    this.projW = initMatrix(dim, dim);
  }

  forward(x: Matrix): Matrix {
    const D = x[0].length;
    const qkv = matMul(x, this.qkvW);
    const q = qkv.map((r) => r.slice(0, D));
    const k = qkv.map((r) => r.slice(D, 2 * D));
    const v = qkv.map((r) => r.slice(2 * D, 3 * D));
    const scores = matMul(q, transpose(k));
    const sc = Math.sqrt(D);
    const attn = softmaxRow(scores.map((r) => r.map((s) => s / sc)));
    return matMul(matMul(attn, v), this.projW);
  }
}

export class FeedForward {
  fc1W: Matrix;
  fc2W: Matrix;

  constructor(dim: number, hiddenMult = 4) {
    const hidden = dim * hiddenMult;
    this.fc1W = initMatrix(dim, hidden);
    this.fc2W = initMatrix(hidden, dim);
  }

  forward(x: Matrix): Matrix {
    const hidden = matMul(x, this.fc1W).map((r) => r.map(gelu));
    return matMul(hidden, this.fc2W);
  }
}

export class TransformerBlock {
  ln1Gamma: Vector;
  ln1Beta: Vector;
  attn: SelfAttention;
  ln2Gamma: Vector;
  ln2Beta: Vector;
  mlp: FeedForward;

  constructor(dim: number) {
    this.ln1Gamma = new Array(dim).fill(1);
    this.ln1Beta = new Array(dim).fill(0);
    this.attn = new SelfAttention(dim);
    this.ln2Gamma = new Array(dim).fill(1);
    this.ln2Beta = new Array(dim).fill(0);
    this.mlp = new FeedForward(dim);
  }

  forward(x: Matrix): Matrix {
    const ln1 = x.map((row) => layerNorm(row, this.ln1Gamma, this.ln1Beta));
    const attnOut = this.attn.forward(ln1);
    const xAttn = x.map((row, i) => row.map((val, d) => val + attnOut[i][d]));

    const ln2 = xAttn.map((row) => layerNorm(row, this.ln2Gamma, this.ln2Beta));
    const mlpOut = this.mlp.forward(ln2);
    return xAttn.map((row, i) => row.map((val, d) => val + mlpOut[i][d]));
  }
}

export class NanoGPT {
  tokenizer: CharTokenizer;
  embedding: Embedding;
  blocks: TransformerBlock[];
  lnfGamma: Vector;
  lnfBeta: Vector;
  lmHeadW: Matrix;

  constructor(vocabText: string, dim = 16, depth = 2, maxSeqLen = 64) {
    this.tokenizer = new CharTokenizer(vocabText);
    const vocabSize = this.tokenizer.vocabSize;
    this.embedding = new Embedding(vocabSize, dim, maxSeqLen);
    this.blocks = Array.from({ length: depth }, () => new TransformerBlock(dim));
    this.lnfGamma = new Array(dim).fill(1);
    this.lnfBeta = new Array(dim).fill(0);
    this.lmHeadW = initMatrix(dim, vocabSize);
  }

  forward(tokenIds: number[]): Matrix {
    const seqLen = tokenIds.length;
    let x = this.embedding.forward(tokenIds, seqLen);

    for (const block of this.blocks) {
      x = block.forward(x);
    }

    const lnf = x.map((row) => layerNorm(row, this.lnfGamma, this.lnfBeta));
    return matMul(lnf, this.lmHeadW);
  }

  generate(prompt: string, maxNewTokens: number): string {
    const tokens = this.tokenizer.encode(prompt);

    for (let step = 0; step < maxNewTokens; step++) {
      const context = tokens.slice(-32);
      const logits = this.forward(context);
      const lastTokenLogits = logits[logits.length - 1];

      const maxLogit = Math.max(...lastTokenLogits);
      const exps = lastTokenLogits.map((l) => Math.exp(l - maxLogit));
      const sum = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map((p) => p / sum);

      let nextToken = 0;
      const r = Deterministic.random();
      let cumSum = 0;
      for (let i = 0; i < probs.length; i++) {
        cumSum += probs[i];
        if (r <= cumSum) {
          nextToken = i;
          break;
        }
      }
      tokens.push(nextToken);
    }

    return this.tokenizer.decode(tokens);
  }
}
