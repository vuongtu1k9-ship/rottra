import {
  autoTeachOnLowConfidence,
  recordFeedback,
  getLearningStats,
  getFeedbackAnalytics,
  retrainModel,
  getRetrainStatus,
} from "~/server/api/self-learner";

export interface FeedbackPayload {
  query: string;
  originalAnswer: string;
  correctedAnswer?: string;
  rating?: "up" | "down";
  chosenAnswer?: string;
  rejectedAnswer?: string;
  userId?: string;
  sessionId?: string;
}

export interface FeedbackResult {
  success: boolean;
  message: string;
  retrained?: boolean;
}

export class FeedbackLoop {
  async submit(payload: FeedbackPayload): Promise<FeedbackResult> {
    try {
      if (payload.rating) {
        const intent = "UNKNOWN";
        const score = payload.rating === "up" ? 0.9 : 0.1;
        await recordFeedback(payload.query, intent, score, payload.rating);
      }

      if (payload.correctedAnswer && payload.originalAnswer !== payload.correctedAnswer) {
        const intent = "UNKNOWN";
        const score = 0.8;
        await recordFeedback(payload.query, intent, score, "up");
      }

      if (payload.chosenAnswer && payload.rejectedAnswer) {
        const intent = "UNKNOWN";
        const score = 0.8;
        await recordFeedback(payload.query, intent, score, "up");
      }

      const stats = await getLearningStats();
      const totalFeedback = stats.recentFeedback.ups + stats.recentFeedback.downs;
      const shouldRetrain = totalFeedback > 0 && totalFeedback % 50 === 0;

      if (shouldRetrain) {
        retrainModel().catch((err) => {
          console.error("[FeedbackLoop] Auto-retrain failed:", err);
        });
      }

      return {
        success: true,
        message: "Feedback recorded successfully",
        retrained: shouldRetrain,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to record feedback",
      };
    }
  }

  async getStats() {
    return getLearningStats();
  }

  async getAnalytics() {
    return getFeedbackAnalytics();
  }

  async retrain() {
    return retrainModel();
  }

  async getRetrainStatus() {
    return getRetrainStatus();
  }
}

export const feedbackLoop = new FeedbackLoop();
