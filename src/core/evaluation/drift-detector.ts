export interface DriftReport {
  timestamp: string;
  accuracy: number;
  previousAccuracy: number | undefined;
  driftDetected: boolean;
  severity: "none" | "low" | "medium" | "high";
  recommendation: string;
}

export class DriftDetector {
  private history: Array<{ accuracy: number; timestamp: string }> = [];
  private readonly threshold = 5.0;
  private readonly maxHistory = 20;

  record(accuracy: number): DriftReport {
    const timestamp = new Date().toISOString();
    const previousAccuracy = this.history.length > 0 ? this.history[this.history.length - 1].accuracy : undefined;
    const driftDetected = previousAccuracy !== undefined && Math.abs(accuracy - previousAccuracy) >= this.threshold;

    this.history.push({ accuracy, timestamp });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    let severity: DriftReport["severity"] = "none";
    let recommendation = "Model performance is stable.";

    if (driftDetected) {
      const diff = accuracy - (previousAccuracy ?? accuracy);
      if (diff < -10) {
        severity = "high";
        recommendation = "Critical accuracy drop detected. Immediate retraining recommended.";
      } else if (diff < -5) {
        severity = "medium";
        recommendation = "Moderate drift detected. Schedule retraining within 24 hours.";
      } else {
        severity = "low";
        recommendation = "Minor drift detected. Monitor closely.";
      }
    }

    return {
      timestamp,
      accuracy,
      previousAccuracy,
      driftDetected,
      severity,
      recommendation,
    };
  }

  getHistory() {
    return [...this.history];
  }
}

export const driftDetector = new DriftDetector();
