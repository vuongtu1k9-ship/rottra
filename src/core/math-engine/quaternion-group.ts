/**
 * QUATERNION GROUP Q8 — DISCRETE COGNITIVE STATE MACHINE
 * -------------------------------------------------------------------------
 * Q8 = {±1, ±i, ±j, ±k} với quy tắc:
 *   i² = j² = k² = ijk = -1
 *   ij = k,  ji = -k
 *   jk = i,  kj = -i
 *   ki = j,  ik = -j
 *
 * Ứng dụng: Discrete personality mode switching, cognitive gate transitions,
 * và symbolic reasoning trong Agent Core.
 * -------------------------------------------------------------------------
 */

export type Q8Element = "1" | "-1" | "i" | "-i" | "j" | "-j" | "k" | "-k";

export interface Q8State {
  element: Q8Element;
  label: string;
  description: string;
}

export const Q8_TABLE: Record<Q8Element, Record<Q8Element, Q8Element>> = {
  "1": { "1": "1", "-1": "-1", i: "i", "-i": "-i", j: "j", "-j": "-j", k: "k", "-k": "-k" },
  "-1": { "1": "-1", "-1": "1", i: "-i", "-i": "i", j: "-j", "-j": "j", k: "-k", "-k": "k" },
  i: { "1": "i", "-1": "-i", i: "-1", "-i": "1", j: "k", "-j": "-k", k: "-j", "-k": "j" },
  "-i": { "1": "-i", "-1": "i", i: "1", "-i": "-1", j: "-k", "-j": "k", k: "j", "-k": "-j" },
  j: { "1": "j", "-1": "-j", i: "-k", "-i": "k", j: "-1", "-j": "1", k: "i", "-k": "-i" },
  "-j": { "1": "-j", "-1": "j", i: "k", "-i": "-k", j: "1", "-j": "-1", k: "-i", "-k": "i" },
  k: { "1": "k", "-1": "-k", i: "j", "-i": "-j", j: "-i", "-j": "i", k: "-1", "-k": "1" },
  "-k": { "1": "-k", "-1": "k", i: "-j", "-i": "j", j: "i", "-j": "-i", k: "1", "-k": "-1" },
};

export const Q8_STATES: Record<Q8Element, Q8State> = {
  "1": { element: "1", label: "Identity", description: "Trung hòa / Cân bằng tuyệt đối" },
  "-1": { element: "-1", label: "Negation", description: "Phủ định / Đảo ngược toàn bộ" },
  i: { element: "i", label: "Greed Rotor", description: "Xoay về tham lam / tích cực" },
  "-i": { element: "-i", label: "Anti-Greed", description: "Xoay ngược / từ chối tham lam" },
  j: { element: "j", label: "Vengeance Rotor", description: "Xoay về thù hằn / phản kháng" },
  "-j": { element: "-j", label: "Anti-Vengeance", description: "Xoay ngược / hòa giải" },
  k: { element: "k", label: "Malice Rotor", description: "Xoay về thâm độc / chiến lược" },
  "-k": { element: "-k", label: "Anti-Malice", description: "Xoay ngược / minh bạch" },
};

export function q8Multiply(a: Q8Element, b: Q8Element): Q8Element {
  return Q8_TABLE[a][b];
}

export function q8Conjugate(a: Q8Element): Q8Element {
  const sign = a.startsWith("-") ? a.slice(1) : `-${a}`;
  return sign as Q8Element;
}

export function q8Inverse(a: Q8Element): Q8Element {
  return q8Conjugate(a);
}

export function q8Norm(a: Q8Element): number {
  return 1;
}

export function quaternionToQ8(q: { w: number; x: number; y: number; z: number }): Q8Element {
  const absW = Math.abs(q.w);
  const absX = Math.abs(q.x);
  const absY = Math.abs(q.y);
  const absZ = Math.abs(q.z);

  const maxVal = Math.max(absW, absX, absY, absZ);
  if (maxVal === absW) return q.w >= 0 ? "1" : "-1";
  if (maxVal === absX) return q.x >= 0 ? "i" : "-i";
  if (maxVal === absY) return q.y >= 0 ? "j" : "-j";
  return q.z >= 0 ? "k" : "-k";
}

export function q8ToQuaternion(a: Q8Element): { w: number; x: number; y: number; z: number } {
  switch (a) {
    case "1":
      return { w: 1, x: 0, y: 0, z: 0 };
    case "-1":
      return { w: -1, x: 0, y: 0, z: 0 };
    case "i":
      return { w: 0, x: 1, y: 0, z: 0 };
    case "-i":
      return { w: 0, x: -1, y: 0, z: 0 };
    case "j":
      return { w: 0, x: 0, y: 1, z: 0 };
    case "-j":
      return { w: 0, x: 0, y: -1, z: 0 };
    case "k":
      return { w: 0, x: 0, y: 0, z: 1 };
    case "-k":
      return { w: 0, x: 0, y: 0, z: -1 };
  }
}

export function q8Distance(a: Q8Element, b: Q8Element): number {
  if (a === b) return 0;
  const conj = q8Multiply(a, q8Conjugate(b));
  return conj.startsWith("-") ? 2 : 1;
}

export function q8ShortestPath(from: Q8Element, to: Q8Element): Q8Element[] {
  if (from === to) return [from];
  const path: Q8Element[] = [from];
  let current = from;
  const visited = new Set<Q8Element>([from]);
  const queue: { state: Q8Element; path: Q8Element[] }[] = [{ state: from, path: [from] }];

  while (queue.length > 0) {
    const { state, path: currentPath } = queue.shift()!;
    const neighbors = Object.values(Q8_TABLE[state]) as Q8Element[];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      const newPath = [...currentPath, neighbor];
      if (neighbor === to) return newPath;
      visited.add(neighbor);
      queue.push({ state: neighbor, path: newPath });
    }
  }
  return path;
}

export class Q8CognitiveStateMachine {
  private current: Q8Element = "1";

  setState(element: Q8Element) {
    this.current = element;
  }

  getState(): Q8Element {
    return this.current;
  }

  apply(element: Q8Element): Q8Element {
    this.current = q8Multiply(this.current, element);
    return this.current;
  }

  reset() {
    this.current = "1";
  }

  getDescription(): string {
    return Q8_STATES[this.current].description;
  }

  getLabel(): string {
    return Q8_STATES[this.current].label;
  }
}
