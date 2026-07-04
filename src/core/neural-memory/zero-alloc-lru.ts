type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

export class LRUCache<K, V> {
  private keyToIndex: Map<K, number>;
  private keys: (K | null)[];
  private values: (V | null)[];
  private timestamps: Float64Array;
  private prev: Int32Array;
  private next: Int32Array;

  private head: number = -1;
  private tail: number = -1;
  private currentSize: number = 0;
  private freeIndices: number[];
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
    this.keyToIndex = new Map();
    this.keys = new Array(maxSize).fill(null);
    this.values = new Array(maxSize).fill(null);
    this.timestamps = new Float64Array(maxSize);
    this.prev = new Int32Array(maxSize).fill(-1);
    this.next = new Int32Array(maxSize).fill(-1);

    this.freeIndices = [];
    for (let i = maxSize - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
  }

  private detach(idx: number): void {
    const p = this.prev[idx];
    const n = this.next[idx];

    if (p !== -1) {
      this.next[p] = n;
    } else {
      this.head = n;
    }

    if (n !== -1) {
      this.prev[n] = p;
    } else {
      this.tail = p;
    }

    this.prev[idx] = -1;
    this.next[idx] = -1;
  }

  private attachToHead(idx: number): void {
    this.next[idx] = this.head;
    this.prev[idx] = -1;
    if (this.head !== -1) {
      this.prev[this.head] = idx;
    }
    this.head = idx;
    if (this.tail === -1) {
      this.tail = idx;
    }
  }

  get(key: K): V | undefined {
    const idx = this.keyToIndex.get(key);
    if (idx === undefined) return undefined;

    const now = Date.now();
    if (now - this.timestamps[idx] > this.ttlMs) {
      this.evictIndex(idx);
      return undefined;
    }

    this.detach(idx);
    this.attachToHead(idx);
    return this.values[idx] as V;
  }

  set(key: K, value: V): void {
    let idx = this.keyToIndex.get(key);
    const now = Date.now();

    if (idx !== undefined) {
      this.values[idx] = value;
      this.timestamps[idx] = now;
      this.detach(idx);
      this.attachToHead(idx);
      return;
    }

    if (this.currentSize >= this.maxSize) {
      const lruIdx = this.tail;
      if (lruIdx !== -1) {
        this.evictIndex(lruIdx);
      }
    }

    const newIdx = this.freeIndices.pop();
    if (newIdx === undefined) return;

    this.keys[newIdx] = key;
    this.values[newIdx] = value;
    this.timestamps[newIdx] = now;
    this.keyToIndex.set(key, newIdx);

    this.attachToHead(newIdx);
    this.currentSize++;
  }

  private evictIndex(idx: number): void {
    const key = this.keys[idx];
    if (key !== null) {
      this.keyToIndex.delete(key);
    }

    this.detach(idx);

    this.keys[idx] = null;
    this.values[idx] = null;
    this.timestamps[idx] = 0;

    this.freeIndices.push(idx);
    this.currentSize--;
  }

  clear(): void {
    this.keyToIndex.clear();
    this.keys.fill(null);
    this.values.fill(null);
    this.timestamps.fill(0);
    this.prev.fill(-1);
    this.next.fill(-1);
    this.head = -1;
    this.tail = -1;
    this.currentSize = 0;

    this.freeIndices = [];
    for (let i = this.maxSize - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
  }

  delete(key: K): boolean {
    const idx = this.keyToIndex.get(key);
    if (idx === undefined) return false;
    this.evictIndex(idx);
    return true;
  }

  getValues(): V[] {
    const values: V[] = [];
    const now = Date.now();
    let current = this.head;
    while (current !== -1) {
      if (now - this.timestamps[current] <= this.ttlMs) {
        const val = this.values[current];
        if (val !== null) {
          values.push(val as V);
        }
      }
      current = this.next[current];
    }
    return values;
  }

  size(): number {
    return this.currentSize;
  }

  setTtlMs(ms: number): void {
    this.ttlMs = ms;
  }
}

export const productSearchCache = new LRUCache<string, any>(200, 180);
export const imageGenerationCache = new LRUCache<string, string>(100, 3600);
