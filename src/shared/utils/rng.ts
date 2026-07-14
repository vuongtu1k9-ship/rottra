import crypto from "node:crypto";

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * Provides absolute reproducibility and control over random events.
 */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let currentSeed = 1337; // Default seed
let generator = mulberry32(currentSeed);

export const Deterministic = {
  /**
   * Generates a predictable random float between 0 and 1.
   */
  random(): number {
    return generator();
  },

  /**
   * Resets the global seed for the deterministic engine to ensure reproducible runs.
   */
  setSeed(seed: number) {
    currentSeed = seed;
    generator = mulberry32(seed);
  },

  /**
   * Picks a random element from an array using deterministic RNG.
   */
  pick<T>(arr: T[]): T {
    if (!arr || arr.length === 0) throw new Error("Cannot pick from empty array.");
    const idx = Math.floor(generator() * arr.length);
    return arr[idx];
  },
};

export const Secure = {
  /**
   * Generates a cryptographically secure UUID v4.
   */
  uuid(): string {
    return crypto.randomUUID();
  },
};
