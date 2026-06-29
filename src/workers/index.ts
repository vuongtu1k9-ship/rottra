import { Worker } from "worker_threads";
import path from "path";

export class WorkerPool {
  private size: number;
  private workers: Worker[] = [];
  private activeWorkers: Set<Worker> = new Set();
  private queue: Array<{
    task: any;
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = [];

  constructor(size = 2) {
    this.size = size;
  }

  public init() {
    const workerPath = path.join(__dirname, "ai-inference.worker.js");
    for (let i = 0; i < this.size; i++) {
      try {
        const worker = new Worker(workerPath);
        worker.on("message", (msg) => {
          // Handle message back from worker
        });
        this.workers.push(worker);
      } catch (e) {
        console.warn("Worker threads not supported in this environment, falling back to synchronous execution.");
      }
    }
  }

  public async runTask(task: any): Promise<any> {
    if (this.workers.length === 0) {
      // Synchronous fallback
      return this.fallbackExecution(task);
    }
    // Implement queue execution
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch() {
    if (this.queue.length === 0) return;
    const availableWorker = this.workers.find((w) => !this.activeWorkers.has(w));
    if (!availableWorker) return;

    const { task, resolve, reject } = this.queue.shift()!;
    this.activeWorkers.add(availableWorker);

    const onMessage = (msg: any) => {
      availableWorker.off("message", onMessage);
      availableWorker.off("error", onError);
      this.activeWorkers.delete(availableWorker);
      resolve(msg);
      this.dispatch();
    };

    const onError = (err: any) => {
      availableWorker.off("message", onMessage);
      availableWorker.off("error", onError);
      this.activeWorkers.delete(availableWorker);
      reject(err);
      this.dispatch();
    };

    availableWorker.on("message", onMessage);
    availableWorker.on("error", onError);
    availableWorker.postMessage(task);
  }

  private fallbackExecution(task: any): any {
    const { type, data } = task;
    if (type === "COMPUTE_SIMILARITY") {
      const { query, cacheKeys } = data;
      const results = cacheKeys.map((key: string) => {
        const sim = this.calculateJaccard(query, key);
        return { key, similarity: sim };
      });
      results.sort((a: any, b: any) => b.similarity - a.similarity);
      return { type: "SIMILARITY_RESULT", data: results[0] };
    }
    return null;
  }

  private calculateJaccard(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

export const workerPool = new WorkerPool();
