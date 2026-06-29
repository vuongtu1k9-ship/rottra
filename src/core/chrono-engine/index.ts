import fs from "fs";
import path from "path";

const TICK_FILE = path.join(process.cwd(), "storage", "last_tick.json");

export class ChronoEngine {
  private lastTick: number = Date.now();
  private timer: Timer | null = null;

  constructor() {
    this.ensureStorageDir();
    this.loadLastTick();
  }

  private ensureStorageDir() {
    const dir = path.dirname(TICK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadLastTick() {
    try {
      if (fs.existsSync(TICK_FILE)) {
        const data = JSON.parse(fs.readFileSync(TICK_FILE, "utf-8"));
        this.lastTick = data.timestamp || Date.now();
      } else {
        this.lastTick = Date.now();
        this.saveTick();
      }
    } catch (e) {
      this.lastTick = Date.now();
    }
  }

  private saveTick() {
    try {
      fs.writeFileSync(TICK_FILE, JSON.stringify({ timestamp: this.lastTick }), "utf-8");
    } catch (e) {
      console.error("Failed to save chrono tick:", e);
    }
  }

  /**
   * Runs the fast-forward catch up logic for elapsed time since last server shutdown.
   */
  public async performCatchUp(tickHandler: (elapsedMs: number) => Promise<void> | void) {
    const now = Date.now();
    const elapsed = now - this.lastTick;

    if (elapsed > 1000) {
      console.log(`[ChronoEngine] Catching up for offline period of ${elapsed}ms...`);
      // Run the fast-forward simulation handler
      await tickHandler(elapsed);
      console.log(`[ChronoEngine] Catch-up completed.`);
    }

    this.lastTick = now;
    this.saveTick();
  }

  /**
   * Start periodic tracking of timestamps.
   */
  public startTracking(intervalMs = 10000) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.lastTick = Date.now();
      this.saveTick();
    }, intervalMs);
  }

  public stopTracking() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const chronoEngine = new ChronoEngine();
