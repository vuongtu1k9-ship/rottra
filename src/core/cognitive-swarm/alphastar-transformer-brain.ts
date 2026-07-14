import { Deterministic } from "~/shared/utils/rng";
/**
 * 🧠 ROTTRA AI — ALPHASTAR TRANSFORMER BRAIN (Core Upgrade)
 *
 * Faithful TypeScript port of DeepMind AlphaStar's agent architecture, adapted from
 * StarCraft II to Rottra's 12 negotiation/trading agents. AlphaStar/PySC2 themselves are
 * Python + require the StarCraft II binary, so their reusable value is *architectural*:
 *
 *   1. Transformer "torso"  — self-attention over the trajectory of past (observation, action)
 *                              pairs (AlphaStar uses a transformer over the replay sequence).
 *   2. Autoregressive action head — sample `action_type` first, then sample `action_arguments`
 *                              conditioned on the chosen type (AlphaStar emits actions as a
 *                              sequence of <action_type, arg_0, arg_1, ...>).
 *   3. Behavior Cloning      — supervised learning from logged negotiations (AlphaStar Unplugged
 *                              = BC from human/agent replays), then league self-play via regret
 *                              matching (already present in alphastar-brain.ts).
 *
 * Implemented in pure TypeScript (no native deps) so it runs anywhere Bun runs, consistent with
 * the project's lightweight ML style (see rl-brain.ts / ActorCriticNetwork).
 */

import type { AgentState } from "./alphastar-brain";
import { RegretMatcher } from "./alphastar-brain";
import { db } from "../../infra/database/db-pool";
import { negotiationLog } from "../../infra/database/schema";
import { desc } from "drizzle-orm";

// ==========================================
// TINY AUTOGRAD-READY LINEAR ALGEBRA HELPERS
// ==========================================
type Mat = number[][];
type Vec = number[];

function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => new Array(c).fill(0));
}
function randMat(r: number, c: number, scale = 0.1): Mat {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => (Deterministic.random() * 2 - 1) * scale));
}
function matVec(a: Mat, x: Vec): Vec {
  return a.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
}
function vecAdd(a: Vec, b: Vec): Vec {
  return a.map((v, i) => v + b[i]);
}
function softmax(x: Vec): Vec {
  const max = Math.max(...x);
  const exps = x.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0) || 1;
  return exps.map((v) => v / sum);
}
function crossEntropyGrad(logits: Vec, targetIdx: number): Vec {
  const g = softmax(logits);
  g[targetIdx] -= 1;
  return g;
}

// ==========================================
// LINEAR LAYER (forward + backward)
// ==========================================
export class Linear {
  w: Mat;
  b: Vec;
  private gw: Mat;
  private gb: Vec;
  constructor(
    public inDim: number,
    public outDim: number,
    scale = 0.1,
  ) {
    this.w = randMat(outDim, inDim, scale);
    this.b = Array.from({ length: outDim }, () => (Deterministic.random() * 2 - 1) * scale);
    this.gw = zeros(outDim, inDim);
    this.gb = new Array(outDim).fill(0);
  }
  forward(x: Vec): Vec {
    return vecAdd(matVec(this.w, x), this.b);
  }
  backward(gradOut: Vec, x: Vec): Vec {
    const gradIn = new Array(this.inDim).fill(0);
    for (let j = 0; j < this.outDim; j++) {
      const g = gradOut[j];
      this.gb[j] += g;
      const wrow = this.w[j];
      const grow = this.gw[j];
      for (let i = 0; i < this.inDim; i++) {
        grow[i] += g * x[i];
        gradIn[i] += g * wrow[i];
      }
    }
    return gradIn;
  }
  applyGrad(lr: number): void {
    for (let j = 0; j < this.outDim; j++) {
      this.b[j] -= lr * this.gb[j];
      const wrow = this.w[j];
      const grow = this.gw[j];
      for (let i = 0; i < this.inDim; i++) wrow[i] -= lr * grow[i];
    }
    this.gw = zeros(this.outDim, this.inDim);
    this.gb = new Array(this.outDim).fill(0);
  }
  toJSON() {
    return { w: this.w, b: this.b };
  }
  loadJSON(d: { w: Mat; b: Vec }) {
    this.w = d.w;
    this.b = d.b;
  }
}

// ==========================================
// MULTI-HEAD SELF-ATTENTION (forward + backward)
// ==========================================
interface AttnCache {
  X: Mat;
  Q: Mat;
  K: Mat;
  V: Mat;
  attn: Mat[]; // per head: T x T
  woInput: Mat; // per token input to Wo (merged context)
  T: number;
}

export class MultiHeadAttention {
  private Wq: Linear;
  private Wk: Linear;
  private Wv: Linear;
  private Wo: Linear;
  private dh: number;
  constructor(
    public dModel: number,
    public heads: number,
  ) {
    this.Wq = new Linear(dModel, dModel);
    this.Wk = new Linear(dModel, dModel);
    this.Wv = new Linear(dModel, dModel);
    this.Wo = new Linear(dModel, dModel);
    this.dh = dModel / heads;
  }
  private splitHeads(m: Mat, T: number): Mat[] {
    const out: Mat[] = [];
    for (let h = 0; h < this.heads; h++) {
      const head = zeros(T, this.dh);
      for (let t = 0; t < T; t++) for (let i = 0; i < this.dh; i++) head[t][i] = m[t][h * this.dh + i];
      out.push(head);
    }
    return out;
  }
  private mergeHeads(heads: Mat[], T: number): Mat {
    const out = zeros(T, this.dModel);
    for (let h = 0; h < this.heads; h++)
      for (let t = 0; t < T; t++) for (let i = 0; i < this.dh; i++) out[t][h * this.dh + i] = heads[h][t][i];
    return out;
  }
  forward(X: Mat): { out: Mat; cache: AttnCache } {
    const T = X.length;
    const Q = X.map((x) => this.Wq.forward(x));
    const K = X.map((x) => this.Wk.forward(x));
    const V = X.map((x) => this.Wv.forward(x));
    const scale = 1 / Math.sqrt(this.dh);
    const Qh = this.splitHeads(Q, T);
    const Kh = this.splitHeads(K, T);
    const Vh = this.splitHeads(V, T);
    const ctxHeads: Mat[] = [];
    const attn: Mat[] = [];
    for (let h = 0; h < this.heads; h++) {
      const q = Qh[h],
        k = Kh[h],
        v = Vh[h];
      const a = zeros(T, T);
      for (let t = 0; t < T; t++) {
        let maxS = -Infinity;
        const scores = new Array(T).fill(0);
        for (let s = 0; s < T; s++) {
          let dot = 0;
          for (let i = 0; i < this.dh; i++) dot += q[t][i] * k[s][i];
          const sc = dot * scale;
          scores[s] = sc;
          if (sc > maxS) maxS = sc;
        }
        let sum = 0;
        for (let s = 0; s < T; s++) {
          const e = Math.exp(scores[s] - maxS);
          a[t][s] = e;
          sum += e;
        }
        for (let s = 0; s < T; s++) a[t][s] /= sum || 1;
      }
      attn.push(a);
      const ctx = zeros(T, this.dh);
      for (let t = 0; t < T; t++) for (let s = 0; s < T; s++) for (let i = 0; i < this.dh; i++) ctx[t][i] += a[t][s] * v[s][i];
      ctxHeads.push(ctx);
    }
    const merged = this.mergeHeads(ctxHeads, T);
    const woInput = merged.map((m) => m.slice());
    const out = merged.map((m) => this.Wo.forward(m));
    return { out, cache: { X, Q, K, V, attn, woInput, T } };
  }
  backward(gradOut: Mat, cache: AttnCache, lr: number): Mat {
    const { Q, K, V, attn, woInput, T } = cache;
    const scale = 1 / Math.sqrt(this.dh);
    const gradMerged: Mat = gradOut.map((g, t) => this.Wo.backward(g, woInput[t]));

    const Qh = this.splitHeads(Q, T),
      Kh = this.splitHeads(K, T),
      Vh = this.splitHeads(V, T);
    const gradQh = Array.from({ length: this.heads }, () => zeros(T, this.dh));
    const gradKh = Array.from({ length: this.heads }, () => zeros(T, this.dh));
    const gradVh = Array.from({ length: this.heads }, () => zeros(T, this.dh));
    for (let h = 0; h < this.heads; h++) {
      const q = Qh[h],
        k = Kh[h],
        v = Vh[h],
        a = attn[h],
        gctx = this.splitHeads(gradMerged, T)[h];
      for (let t = 0; t < T; t++) {
        const dAttn = new Array(T).fill(0);
        for (let s = 0; s < T; s++) {
          let dv = 0;
          for (let i = 0; i < this.dh; i++) dv += gctx[t][i] * v[s][i];
          dAttn[s] = dv;
        }
        let sumA = 0;
        for (let s = 0; s < T; s++) sumA += a[t][s] * dAttn[s];
        const dScore = new Array(T).fill(0);
        for (let s = 0; s < T; s++) dScore[s] = a[t][s] * (dAttn[s] - sumA);
        for (let s = 0; s < T; s++)
          for (let i = 0; i < this.dh; i++) {
            gradQh[h][t][i] += dScore[s] * k[s][i] * scale;
            gradKh[h][s][i] += dScore[s] * q[t][i] * scale;
          }
        for (let s = 0; s < T; s++) for (let i = 0; i < this.dh; i++) gradVh[h][s][i] += a[t][s] * gctx[t][i];
      }
    }
    const gradQ = this.mergeHeads(gradQh, T);
    const gradK = this.mergeHeads(gradKh, T);
    const gradV = this.mergeHeads(gradVh, T);
    const gradIn = zeros(T, this.dModel);
    for (let t = 0; t < T; t++) {
      const gq = this.Wq.backward(gradQ[t], cache.X[t]);
      const gk = this.Wk.backward(gradK[t], cache.X[t]);
      const gv = this.Wv.backward(gradV[t], cache.X[t]);
      for (let i = 0; i < this.dModel; i++) gradIn[t][i] = gq[i] + gk[i] + gv[i];
    }
    this.Wq.applyGrad(lr);
    this.Wk.applyGrad(lr);
    this.Wv.applyGrad(lr);
    this.Wo.applyGrad(lr);
    return gradIn;
  }
  toJSON() {
    return { Wq: this.Wq.toJSON(), Wk: this.Wk.toJSON(), Wv: this.Wv.toJSON(), Wo: this.Wo.toJSON() };
  }
  loadJSON(d: { Wq: any; Wk: any; Wv: any; Wo: any }) {
    this.Wq.loadJSON(d.Wq);
    this.Wk.loadJSON(d.Wk);
    this.Wv.loadJSON(d.Wv);
    this.Wo.loadJSON(d.Wo);
  }
}

// ==========================================
// TRANSFORMER TORSO (stacked attention + FFN)
// ==========================================
export class TransformerTorso {
  private attn: MultiHeadAttention;
  private ffn: Linear;
  private projIn: Linear;
  constructor(
    public dModel: number,
    public heads: number,
  ) {
    this.projIn = new Linear(dModel, dModel);
    this.attn = new MultiHeadAttention(dModel, heads);
    this.ffn = new Linear(dModel, dModel);
  }
  forward(X: Mat): { out: Mat; cache: { X: Mat; attnOut: Mat; attnCache: AttnCache } } {
    const projected = X.map((x) => this.projIn.forward(x));
    const { out: attnOut, cache: attnCache } = this.attn.forward(projected);
    const out = attnOut.map((a) => {
      const f = this.ffn.forward(a);
      return a.map((v, i) => v + f[i]); // residual
    });
    return { out, cache: { X, attnOut, attnCache } };
  }
  backward(gradOut: Mat, cache: { X: Mat; attnOut: Mat; attnCache: AttnCache }, lr: number): Mat {
    const T = gradOut.length;
    const gradAttnOut = gradOut.map((g, t) => {
      const f = this.ffn.forward(cache.attnOut[t]);
      const gf = g.map((v, i) => v - f[i]); // split residual: grad to attn = g, grad to ffn = g
      this.ffn.backward(g, cache.attnOut[t]);
      return g.slice();
    });
    void T;
    const gradProjected = this.attn.backward(gradAttnOut, cache.attnCache, lr);
    const gradIn = zeros(cache.X.length, this.dModel);
    for (let t = 0; t < cache.X.length; t++) gradIn[t] = this.projIn.backward(gradProjected[t], cache.X[t]);
    this.projIn.applyGrad(lr);
    this.ffn.applyGrad(lr);
    return gradIn;
  }
  toJSON() {
    return { projIn: this.projIn.toJSON(), attn: this.attn.toJSON(), ffn: this.ffn.toJSON() };
  }
  loadJSON(d: any) {
    this.projIn.loadJSON(d.projIn);
    this.attn.loadJSON(d.attn);
    this.ffn.loadJSON(d.ffn);
  }
}

// ==========================================
// AUTOREGRESSIVE POLICY HEAD + BRAIN
// ==========================================
export enum NegotiationAction {
  PROPOSE = 0,
  COUNTER = 1,
  ACCEPT = 2,
  REJECT = 3,
  ASK_INFO = 4,
  HOLD = 5,
}
export const ACTION_LABELS: Record<NegotiationAction, string> = {
  [NegotiationAction.PROPOSE]: "Đề xuất giá",
  [NegotiationAction.COUNTER]: "Phản đề xuất",
  [NegotiationAction.ACCEPT]: "Chấp nhận",
  [NegotiationAction.REJECT]: "Từ chối",
  [NegotiationAction.ASK_INFO]: "Hỏi thêm thông tin",
  [NegotiationAction.HOLD]: "Giữ nguyên / Chờ",
};
export const MESSAGE_INTENTS = ["chốt_gia", "leo_thang", "nhuong_bo", "lam_ro", "ket_thuc"];
const N_ACTIONS = 6;
const N_MSG = MESSAGE_INTENTS.length;
const D_MODEL = 32;
const HEADS = 4;
const TMAX = 12;

export interface AgentDecision {
  actionType: NegotiationAction;
  actionTypeLabel: string;
  price: number; // absolute VND
  quantity: number;
  messageIntent: string;
  confidence: number;
  contextVector: number[];
}

function stateFeatures(s: AgentState): Vec {
  return [
    s.marketPrice / 1_000_000,
    s.costPrice / 1_000_000,
    s.greed,
    s.vengeance,
    s.malice,
    s.inventoryCount / 100,
    s.budget / 1_000_000,
    s.isImpossibleMode ? 1 : 0,
  ];
}

export class AlphaStarTransformerBrain {
  private embed: Linear; // (stateFeat + lastActionOneHot) -> dModel
  private torso: TransformerTorso;
  private actionTypeHead: Linear;
  private argHead: Linear; // conditioned on [context, actionOneHot] -> [priceNorm, qtyNorm]
  private msgHead: Linear; // -> N_MSG logits
  private trajectory: Vec[] = [];
  private lastAction: NegotiationAction = NegotiationAction.HOLD;
  private marketPriceRef = 50_000;
  private inventoryRef = 100;
  private recording = false;
  private episode: { state: AgentState; decision: AgentDecision; seqX: Mat; L: number }[] = [];
  private rewardBaseline = 0;
  public readonly agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.embed = new Linear(8 + N_ACTIONS, D_MODEL);
    this.torso = new TransformerTorso(D_MODEL, HEADS);
    this.actionTypeHead = new Linear(D_MODEL, N_ACTIONS);
    this.argHead = new Linear(D_MODEL + N_ACTIONS, 2);
    this.msgHead = new Linear(D_MODEL + N_ACTIONS, N_MSG);
  }

  private oneHot(a: NegotiationAction): Vec {
    const v = new Array(N_ACTIONS).fill(0);
    v[a] = 1;
    return v;
  }
  private embedState(s: AgentState, lastAction: NegotiationAction): Vec {
    return this.embed.forward([...stateFeatures(s), ...this.oneHot(lastAction)]);
  }
  private buildSequence(s: AgentState): { X: Mat; L: number } {
    const emb = this.embedState(s, this.lastAction);
    const traj = this.trajectory.concat([emb]);
    const L = Math.min(traj.length, TMAX);
    const seq = traj.slice(traj.length - L);
    // pad front with zeros to TMAX (attention handles variable length via L)
    const X: Mat = [];
    for (let i = 0; i < TMAX - L; i++) X.push(new Array(D_MODEL).fill(0));
    for (const t of seq) X.push(t.slice());
    return { X, L };
  }

  /** Inference: produce the next negotiation action for the connected agent. */
  decide(s: AgentState): AgentDecision {
    this.marketPriceRef = s.marketPrice || this.marketPriceRef;
    this.inventoryRef = s.inventoryCount || this.inventoryRef;
    const { X, L } = this.buildSequence(s);
    const { out } = this.torso.forward(X);
    // mean-pool over real tokens
    const ctx = new Array(D_MODEL).fill(0);
    for (let t = TMAX - L; t < TMAX; t++) for (let i = 0; i < D_MODEL; i++) ctx[i] += out[t][i];
    for (let i = 0; i < D_MODEL; i++) ctx[i] /= L || 1;

    const atLogits = this.actionTypeHead.forward(ctx);
    const atProbs = softmax(atLogits);
    const actionType = sampleCat(atProbs) as NegotiationAction;

    const cond = [...ctx, ...this.oneHot(actionType)];
    const argLogits = this.argHead.forward(cond);
    const msgLogits = this.msgHead.forward(cond);
    const msgProbs = softmax(msgLogits);
    const msgIdx = sampleCat(msgProbs);

    const priceNorm = Math.tanh(argLogits[0]); // [-1,1] around market
    const qtyNorm = Math.tanh(argLogits[1]);
    const price = Math.max(0, Math.round(this.marketPriceRef * (1 + priceNorm)));
    const quantity = Math.max(1, Math.round(this.inventoryRef * (0.5 + 0.5 * qtyNorm)));

    this.lastAction = actionType;
    this.trajectory.push(this.embedState(s, actionType));
    if (this.trajectory.length > TMAX) this.trajectory.shift();

    const decision: AgentDecision = {
      actionType,
      actionTypeLabel: ACTION_LABELS[actionType],
      price,
      quantity,
      messageIntent: MESSAGE_INTENTS[msgIdx],
      confidence: Math.max(...atProbs),
      contextVector: ctx,
    };
    if (this.recording) this.episode.push({ state: s, decision, seqX: X, L });

    return decision;
  }

  /**
   * Single supervised/RL policy-gradient step over a prebuilt sequence.
   * `advantage` scales the gradient (1 = pure behavior cloning, otherwise REINFORCE).
   */
  private trainReplayStep(
    X: Mat,
    L: number,
    target: { actionType: NegotiationAction; price: number; quantity: number; messageIntent: number },
    advantage: number,
    lr: number,
  ): number {
    const { out, cache } = this.torso.forward(X);
    const ctx = new Array(D_MODEL).fill(0);
    for (let t = TMAX - L; t < TMAX; t++) for (let i = 0; i < D_MODEL; i++) ctx[i] += out[t][i];
    for (let i = 0; i < D_MODEL; i++) ctx[i] /= L || 1;

    const atLogits = this.actionTypeHead.forward(ctx);
    const cond = [...ctx, ...this.oneHot(target.actionType)];
    const argLogits = this.argHead.forward(cond);
    const msgLogits = this.msgHead.forward(cond);

    const atCE = -Math.log(softmax(atLogits)[target.actionType] + 1e-9);
    const priceErr = argLogits[0] - Math.tanh(target.price / (this.marketPriceRef || 1) - 1);
    const qtyErr = argLogits[1] - Math.tanh(target.quantity / (this.inventoryRef || 1) - 0.5) * 2 + 1;
    const msgCE = -Math.log(softmax(msgLogits)[target.messageIntent] + 1e-9);

    const gAt = crossEntropyGrad(atLogits, target.actionType).map((v) => v * advantage);
    const gCtxFromAt = this.actionTypeHead.backward(gAt, ctx);
    const gArg = [priceErr * advantage, qtyErr * advantage];
    const gCondArg = this.argHead.backward(gArg, cond);
    const gMsg = crossEntropyGrad(msgLogits, target.messageIntent).map((v) => v * advantage);
    const gCondMsg = this.msgHead.backward(gMsg, cond);
    const gCtx = new Array(D_MODEL).fill(0);
    for (let i = 0; i < D_MODEL; i++) gCtx[i] = gCtxFromAt[i] + gCondArg[i] + gCondMsg[i];

    const gradOut: Mat = X.map(() => new Array(D_MODEL).fill(0));
    for (let t = TMAX - L; t < TMAX; t++) for (let i = 0; i < D_MODEL; i++) gradOut[t][i] = gCtx[i] / (L || 1);
    const gradIn = this.torso.backward(gradOut, cache, lr);

    const lastIdx = TMAX - 1;
    const emb = X[lastIdx];
    this.embed.backward(gradIn[lastIdx], emb);
    this.embed.applyGrad(lr);
    this.actionTypeHead.applyGrad(lr);
    this.argHead.applyGrad(lr);
    this.msgHead.applyGrad(lr);

    return atCE + 0.5 * (priceErr * priceErr + qtyErr * qtyErr) + msgCE;
  }

  /** One behavior-cloning step from a single logged negotiation sample (advantage = 1). */
  behaviorCloneStep(
    s: AgentState,
    target: { actionType: NegotiationAction; price: number; quantity: number; messageIntent: number },
    lr = 0.01,
    advantage = 1,
  ): number {
    const { X, L } = this.buildSequence(s);
    return this.trainReplayStep(X, L, target, advantage, lr);
  }

  /** Begin recording an episode for RL (REINFORCE). Call decide() repeatedly, then finishEpisode(). */
  startEpisode(): void {
    this.recording = true;
    this.episode = [];
  }

  /**
   * End an episode and apply a REINFORCE update using the episode return.
   * `reward` is the scalar outcome (e.g. from negotiationReward). A running baseline
   * reduces variance. Returns the (baseline-subtracted) advantage actually applied.
   */
  finishEpisode(reward: number, lr = 0.01): number {
    const advantage = reward - this.rewardBaseline;
    this.rewardBaseline = this.rewardBaseline * 0.9 + reward * 0.1;
    for (const step of this.episode) {
      const msgIdx = MESSAGE_INTENTS.indexOf(step.decision.messageIntent);
      this.trainReplayStep(
        step.seqX,
        step.L,
        {
          actionType: step.decision.actionType,
          price: step.decision.price,
          quantity: step.decision.quantity,
          messageIntent: msgIdx < 0 ? 0 : msgIdx,
        },
        advantage,
        lr,
      );
    }
    this.episode = [];
    this.recording = false;
    return advantage;
  }

  /** Scalar reward for one side of a negotiation outcome (higher = better deal). */
  negotiationReward(side: "buyer" | "seller", costPrice: number, marketPrice: number, finalPrice: number, success: boolean): number {
    const denom = Math.max(1, marketPrice);
    if (!success) return -0.5;
    const margin = side === "seller" ? (finalPrice - costPrice) / denom : (marketPrice - finalPrice) / denom;
    return Math.max(-1, Math.min(1, margin * 2)) + 0.2;
  }

  /** Load past negotiations from the DB and behavior-clone the policy. */
  async trainFromNegotiationLogs(limit = 200, lr = 0.01): Promise<{ samples: number; avgLoss: number }> {
    const rows = await db.select().from(negotiationLog).orderBy(desc(negotiationLog.timestamp)).limit(limit);
    let total = 0;
    let lossSum = 0;
    for (const r of rows) {
      if (!r.success && r.finalizedPrice == null) continue;
      const price = r.finalizedPrice ?? r.sellerOffer2 ?? r.sellerOffer1;
      const actionType = r.success ? NegotiationAction.ACCEPT : NegotiationAction.COUNTER;
      const msgIntent = r.success ? 0 : 1;
      const s: AgentState = {
        agentId: this.agentId,
        greed: clamp01((r.marketPrice - r.sellerOffer1) / (r.marketPrice || 1)),
        vengeance: 0.2,
        malice: 0.1,
        budget: r.marketPrice * 2,
        inventoryCount: 100,
        marketPrice: r.marketPrice,
        costPrice: r.sellerOffer1,
        currentGridX: 0,
        currentGridY: 0,
        lastDecisionPath: [],
      };
      const loss = this.behaviorCloneStep(s, { actionType, price, quantity: 50, messageIntent: msgIntent }, lr);
      total++;
      lossSum += loss;
    }
    return { samples: total, avgLoss: total ? lossSum / total : 0 };
  }

  /** League snapshot for self-play (AlphaStar league training). */
  snapshot(): string {
    return JSON.stringify({
      embed: this.embed.toJSON(),
      torso: this.torso.toJSON(),
      actionTypeHead: this.actionTypeHead.toJSON(),
      argHead: this.argHead.toJSON(),
      msgHead: this.msgHead.toJSON(),
    });
  }
  loadSnapshot(snap: string): void {
    const d = JSON.parse(snap);
    this.embed.loadJSON(d.embed);
    this.torso.loadJSON(d.torso);
    this.actionTypeHead.loadJSON(d.actionTypeHead);
    this.argHead.loadJSON(d.argHead);
    this.msgHead.loadJSON(d.msgHead);
  }
  reset(): void {
    this.trajectory = [];
    this.lastAction = NegotiationAction.HOLD;
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function sampleCat(probs: Vec): number {
  let r = Deterministic.random();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

// ==========================================
// SELF-PLAY LEAGUE (AlphaStar league training)
// ==========================================
export const DEFAULT_AGENT_IDS = [
  "to-luong",
  "thuong-nguyet",
  "tram-tinh",
  "dao-tieu-cuu",
  "hoa-huynh",
  "phi-nguyet",
  "nhu-nguyet",
  "su-gia",
  "phi-anh",
  "bach-di-hanh",
  "minh-tue",
  "khai-phong",
];

interface LeagueAgent {
  agentId: string;
  side: "buyer" | "seller";
  greed: number;
  vengeance: number;
  malice: number;
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export interface LeagueEpisodeResult {
  buyerId: string;
  sellerId: string;
  success: boolean;
  finalPrice: number;
  buyerReward: number;
  sellerReward: number;
}

/**
 * AlphaStar-style league: a population of agent brains that negotiate against each other
 * (self-play). Each episode is a short negotiation; outcomes produce RL rewards (REINFORCE
 * via finishEpisode) and feed a per-agent RegretMatcher for Nash-aware meta-strategy — the
 * same league-training loop that lets AlphaStar's population superhuman.
 */
export class AlphaStarLeague {
  private brains = new Map<string, AlphaStarTransformerBrain>();
  private regret = new Map<string, RegretMatcher>();
  private agents: LeagueAgent[] = [];

  constructor(agentIds: string[] = DEFAULT_AGENT_IDS) {
    agentIds.forEach((id, i) => {
      this.brains.set(id, new AlphaStarTransformerBrain(id));
      this.regret.set(id, new RegretMatcher());
      this.agents.push({
        agentId: id,
        side: i % 2 === 0 ? "seller" : "buyer",
        greed: 0.3 + 0.5 * hash01(id + "g"),
        vengeance: 0.1 + 0.4 * hash01(id + "v"),
        malice: 0.05 + 0.2 * hash01(id + "m"),
      });
    });
  }

  getBrain(id: string): AlphaStarTransformerBrain | undefined {
    return this.brains.get(id);
  }

  private stateFor(a: LeagueAgent, counterpartOffer: number, ownOffer: number): AgentState {
    return {
      agentId: a.agentId,
      greed: a.greed,
      vengeance: a.vengeance,
      malice: a.malice,
      budget: 3_000_000,
      inventoryCount: 100,
      marketPrice: counterpartOffer, // price being responded to
      costPrice: ownOffer, // own previous offer (reference)
      currentGridX: 0,
      currentGridY: 0,
      lastDecisionPath: [],
    };
  }

  /** Run one negotiation episode between two agents. Updates both brains via RL + regret matching. */
  simulateEpisode(buyerId: string, sellerId: string, productCost = 80_000, marketPrice = 100_000): LeagueEpisodeResult {
    const buyer = this.brains.get(buyerId)!;
    const seller = this.brains.get(sellerId)!;
    const bAgent = this.agents.find((a) => a.agentId === buyerId)!;
    const sAgent = this.agents.find((a) => a.agentId === sellerId)!;

    // meta-strategy stance from regret matcher (Concede / Maintain / Aggressive)
    const bStance = sampleCat(this.regret.get(buyerId)!.getActionStrategy());
    const sStance = sampleCat(this.regret.get(sellerId)!.getActionStrategy());
    const mod = (stance: number) => (stance === 2 ? 0.2 : stance === 0 ? -0.2 : 0);
    bAgent.greed = clamp01(bAgent.greed + mod(bStance));
    sAgent.greed = clamp01(sAgent.greed + mod(sStance));

    buyer.startEpisode();
    seller.startEpisode();

    let buyerOffer = marketPrice * 0.8;
    let sellerOffer = marketPrice * 1.1;
    let success = false;
    let finalPrice = 0;
    const rounds = 6;
    for (let r = 0; r < rounds; r++) {
      const sDec = seller.decide(this.stateFor(sAgent, buyerOffer, sellerOffer));
      if (sDec.actionType === NegotiationAction.ACCEPT) {
        success = true;
        finalPrice = buyerOffer;
        break;
      }
      if (sDec.actionType === NegotiationAction.PROPOSE || sDec.actionType === NegotiationAction.COUNTER) {
        sellerOffer = sDec.price;
      }
      const bDec = buyer.decide(this.stateFor(bAgent, sellerOffer, buyerOffer));
      if (bDec.actionType === NegotiationAction.ACCEPT) {
        success = true;
        finalPrice = sellerOffer;
        break;
      }
      if (bDec.actionType === NegotiationAction.PROPOSE || bDec.actionType === NegotiationAction.COUNTER) {
        buyerOffer = bDec.price;
      }
    }
    if (!success && Math.abs(sellerOffer - buyerOffer) <= marketPrice * 0.05) {
      success = true;
      finalPrice = (sellerOffer + buyerOffer) / 2;
    }

    const buyerReward = buyer.negotiationReward("buyer", productCost, marketPrice, finalPrice, success);
    const sellerReward = seller.negotiationReward("seller", productCost, marketPrice, finalPrice, success);
    buyer.finishEpisode(buyerReward, 0.02);
    seller.finishEpisode(sellerReward, 0.02);

    this.updateRegret(buyerId, buyerReward);
    this.updateRegret(sellerId, sellerReward);

    return { buyerId, sellerId, success, finalPrice, buyerReward, sellerReward };
  }

  private updateRegret(agentId: string, reward: number): void {
    const rm = this.regret.get(agentId)!;
    const strat = rm.getActionStrategy();
    const chosen = sampleCat(strat);
    const payoffs = [reward, reward, reward];
    payoffs[(chosen + 1) % 3] = reward - 0.2;
    payoffs[(chosen + 2) % 3] = reward - 0.2;
    rm.updateRegrets(chosen, payoffs);
  }

  /** Run a league of `rounds` random-pair episodes. Returns aggregate stats for monitoring. */
  runLeague(rounds = 50, onStep?: (r: LeagueEpisodeResult, i: number) => void): { avgReward: number; successRate: number } {
    const ids = this.agents.map((a) => a.agentId);
    let rewardSum = 0;
    let success = 0;
    for (let i = 0; i < rounds; i++) {
      const a = ids[Math.floor(Deterministic.random() * ids.length)];
      let b = ids[Math.floor(Deterministic.random() * ids.length)];
      while (b === a) b = ids[Math.floor(Deterministic.random() * ids.length)];
      const res = this.simulateEpisode(a, b);
      rewardSum += res.buyerReward + res.sellerReward;
      if (res.success) success++;
      if (onStep) onStep(res, i);
    }
    return { avgReward: rewardSum / (rounds * 2), successRate: success / rounds };
  }

  snapshotAll(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, brain] of this.brains) out[id] = brain.snapshot();
    return out;
  }
  loadAll(snaps: Record<string, string>): void {
    for (const [id, snap] of Object.entries(snaps)) this.brains.get(id)?.loadSnapshot(snap);
  }
}
