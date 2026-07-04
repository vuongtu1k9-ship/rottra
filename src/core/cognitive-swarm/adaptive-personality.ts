/**
 * Adaptive Personality Engine
 * Tự điều chỉnh tính cách theo user behavior
 *
 * Hệ thống học và thích ứng personality dựa trên:
 * - Conversation history
 * - User preferences
 * - Emotion patterns
 * - Response feedback
 *
 * Inspired by Big Five personality model (OCEAN):
 * - Openness (cởi mở)
 * - Conscientiousness (tận tâm)
 * - Extraversion (hướng ngoại)
 * - Agreeableness (dễ chịu)
 * - Neuroticism (dễ bị tổn thương)
 */

export interface PersonalityProfile {
  id: string;
  name: string;

  // Big Five scores (0-1)
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;

  // Communication style
  formality: number; // 0=casual, 1=formal
  verbosity: number; // 0=concise, 1=verbose
  humor: number; // 0=serious, 1=humorous
  empathy: number; // 0=logical, 1=empathetic
  assertiveness: number; // 0=passive, 1=assertive

  // Domain expertise weights
  expertise: Record<string, number>;

  // Learning metadata
  adaptationRate: number; // How fast to adapt
  confidence: number; // How confident in this profile
  interactionCount: number;
  lastUpdated: number;
}

export interface UserProfile {
  id: string;
  preferredStyle: Partial<PersonalityProfile>;
  emotionalPatterns: string[];
  topicInterests: string[];
  feedbackHistory: FeedbackEntry[];
  personalityScore: number; // How well we understand this user
}

export interface FeedbackEntry {
  timestamp: number;
  type: "positive" | "negative" | "neutral";
  context: string;
  responseStyle: string;
}

// ===== PRESET PERSONALITIES =====

export const PERSONALITY_PRESETS: Record<string, PersonalityProfile> = {
  professional: {
    id: "professional",
    name: "Chuyên gia",
    openness: 0.6,
    conscientiousness: 0.9,
    extraversion: 0.4,
    agreeableness: 0.7,
    neuroticism: 0.2,
    formality: 0.9,
    verbosity: 0.6,
    humor: 0.2,
    empathy: 0.5,
    assertiveness: 0.7,
    expertise: { agriculture: 0.9, business: 0.8, technology: 0.7 },
    adaptationRate: 0.1,
    confidence: 0.8,
    interactionCount: 0,
    lastUpdated: Date.now(),
  },

  friendly: {
    id: "friendly",
    name: "Thân thiện",
    openness: 0.7,
    conscientiousness: 0.6,
    extraversion: 0.8,
    agreeableness: 0.9,
    neuroticism: 0.3,
    formality: 0.3,
    verbosity: 0.7,
    humor: 0.7,
    empathy: 0.8,
    assertiveness: 0.4,
    expertise: { agriculture: 0.7, daily_life: 0.8, entertainment: 0.6 },
    adaptationRate: 0.15,
    confidence: 0.7,
    interactionCount: 0,
    lastUpdated: Date.now(),
  },

  expert: {
    id: "expert",
    name: "Học giả",
    openness: 0.8,
    conscientiousness: 0.8,
    extraversion: 0.3,
    agreeableness: 0.6,
    neuroticism: 0.1,
    formality: 0.8,
    verbosity: 0.9,
    humor: 0.1,
    empathy: 0.4,
    assertiveness: 0.8,
    expertise: { agriculture: 0.95, science: 0.9, mathematics: 0.85 },
    adaptationRate: 0.08,
    confidence: 0.85,
    interactionCount: 0,
    lastUpdated: Date.now(),
  },

  casual: {
    id: "casual",
    name: "Bình dân",
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.6,
    agreeableness: 0.8,
    neuroticism: 0.4,
    formality: 0.2,
    verbosity: 0.4,
    humor: 0.6,
    empathy: 0.7,
    assertiveness: 0.3,
    expertise: { agriculture: 0.6, market: 0.7, weather: 0.5 },
    adaptationRate: 0.2,
    confidence: 0.6,
    interactionCount: 0,
    lastUpdated: Date.now(),
  },

  analytical: {
    id: "analytical",
    name: "Phân tích",
    openness: 0.7,
    conscientiousness: 0.85,
    extraversion: 0.3,
    agreeableness: 0.5,
    neuroticism: 0.15,
    formality: 0.7,
    verbosity: 0.8,
    humor: 0.15,
    empathy: 0.3,
    assertiveness: 0.9,
    expertise: { data: 0.9, finance: 0.85, optimization: 0.9 },
    adaptationRate: 0.1,
    confidence: 0.8,
    interactionCount: 0,
    lastUpdated: Date.now(),
  },
};

// ===== PERSONALITY ADAPTATION =====

/**
 * Tạo profile mới từ preset
 */
export function createPersonalityProfile(
  preset: string = "professional",
  customizations?: Partial<PersonalityProfile>,
): PersonalityProfile {
  const base = PERSONALITY_PRESETS[preset] || PERSONALITY_PRESETS.professional;
  return {
    ...base,
    ...customizations,
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    lastUpdated: Date.now(),
  };
}

/**
 * Thích ứng personality dựa trên user feedback
 */
export function adaptPersonality(profile: PersonalityProfile, feedback: FeedbackEntry, userEmotion?: string): PersonalityProfile {
  const adapted = { ...profile };
  const rate = profile.adaptationRate;

  // Positive feedback: reinforce current style
  if (feedback.type === "positive") {
    adapted.confidence = Math.min(1, adapted.confidence + 0.05);
    adapted.interactionCount++;
  }

  // Negative feedback: adjust style
  if (feedback.type === "negative") {
    // Detect what went wrong from context
    const context = feedback.context.toLowerCase();

    if (context.includes("quá dài") || context.includes("nhiều lời")) {
      adapted.verbosity = Math.max(0, adapted.verbosity - rate * 0.3);
    }
    if (context.includes("quá ngắn") || context.includes("thiếu thông tin")) {
      adapted.verbosity = Math.min(1, adapted.verbosity + rate * 0.3);
    }
    if (context.includes("nghiêm túc") || context.includes("không vui")) {
      adapted.humor = Math.min(1, adapted.humor + rate * 0.2);
    }
    if (context.includes("không hiểu") || context.includes("phức tạp")) {
      adapted.formality = Math.max(0, adapted.formality - rate * 0.2);
    }
    if (context.includes("thiếu tôn trọng") || context.includes("thô")) {
      adapted.agreeableness = Math.min(1, adapted.agreeableness + rate * 0.2);
    }

    adapted.confidence = Math.max(0, adapted.confidence - 0.03);
    adapted.interactionCount++;
  }

  // Emotion-based adaptation
  if (userEmotion) {
    switch (userEmotion) {
      case "anger":
      case "sadness":
        adapted.empathy = Math.min(1, adapted.empathy + rate * 0.3);
        adapted.formality = Math.min(1, adapted.formality + rate * 0.1);
        break;
      case "joy":
        adapted.humor = Math.min(1, adapted.humor + rate * 0.1);
        adapted.extraversion = Math.min(1, adapted.extraversion + rate * 0.1);
        break;
      case "fear":
        adapted.assertiveness = Math.min(1, adapted.assertiveness + rate * 0.2);
        adapted.conscientiousness = Math.min(1, adapted.conscientiousness + rate * 0.1);
        break;
    }
  }

  adapted.lastUpdated = Date.now();
  return adapted;
}

/**
 * Phân tích conversation để tìm user personality
 */
export function analyzeUserPersonality(messages: string[]): Partial<PersonalityProfile> {
  if (messages.length === 0) return {};

  const allText = messages.join(" ").toLowerCase();
  const avgLength = messages.reduce((sum, m) => sum + m.length, 0) / messages.length;

  return {
    // User verbosity preference
    verbosity: Math.min(1, avgLength / 200),

    // User formality
    formality: allText.includes("ạ") || allText.includes("dạ") || allText.includes("xin") ? 0.8 : 0.3,

    // User humor
    humor: allText.includes("đùa") || allText.includes("haha") || allText.includes("😂") ? 0.7 : 0.3,

    // User expertise indicators
    expertise: {
      agriculture: allText.includes("nông") || allText.includes("trồng") ? 0.7 : 0.3,
      technology: allText.includes("ai") || allText.includes("tech") ? 0.6 : 0.2,
      business: allText.includes("kinh doanh") || allText.includes("bán") ? 0.6 : 0.3,
    },
  };
}

/**
 * Merge 2 personality profiles
 */
export function mergeProfiles(base: PersonalityProfile, adaptation: Partial<PersonalityProfile>, weight: number = 0.3): PersonalityProfile {
  const merged = { ...base };

  const numericKeys: (keyof PersonalityProfile)[] = [
    "openness",
    "conscientiousness",
    "extraversion",
    "agreeableness",
    "neuroticism",
    "formality",
    "verbosity",
    "humor",
    "empathy",
    "assertiveness",
  ];

  for (const key of numericKeys) {
    if (typeof adaptation[key] === "number") {
      const baseVal = base[key] as number;
      const adaptVal = adaptation[key] as number;
      (merged as any)[key] = baseVal * (1 - weight) + adaptVal * weight;
    }
  }

  merged.lastUpdated = Date.now();
  return merged;
}

/**
 * Chọn personality phù hợp nhất cho context
 */
export function selectBestPersonality(context: { userEmotion?: string; intent?: string; topic?: string; userFormality?: number }): string {
  // Angry/sad user → empathetic
  if (context.userEmotion === "anger" || context.userEmotion === "sadness") {
    return "friendly";
  }

  // Technical/business query → expert
  if (context.topic === "agriculture" || context.topic === "data") {
    return "expert";
  }

  // Formal user → professional
  if ((context.userFormality || 0) > 0.6) {
    return "professional";
  }

  // Casual user → casual
  if ((context.userFormality || 0) < 0.3) {
    return "casual";
  }

  // Default
  return "professional";
}

/**
 * Tạo response modifier từ personality
 */
export function personalityToModifiers(profile: PersonalityProfile): {
  prefix: string;
  suffix: string;
  emoji: boolean;
  exclamation: boolean;
  technicalTerms: boolean;
} {
  const prefix = profile.formality > 0.7 ? "Thưa quý khách, " : profile.formality > 0.4 ? "Chào bạn, " : "Hey! ";

  const suffix = profile.formality > 0.7 ? ". Trân trọng." : profile.formality > 0.4 ? ". Chúc bạn ngày tốt lành!" : " 😊";

  return {
    prefix,
    suffix,
    emoji: profile.humor > 0.5,
    exclamation: profile.extraversion > 0.6,
    technicalTerms: profile.openness > 0.7 && profile.expertise.agriculture > 0.7,
  };
}

/**
 * User profile storage (in-memory for now)
 */
const userProfiles = new Map<string, UserProfile>();

export function getUserProfile(userId: string): UserProfile {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      id: userId,
      preferredStyle: {},
      emotionalPatterns: [],
      topicInterests: [],
      feedbackHistory: [],
      personalityScore: 0,
    });
  }
  return userProfiles.get(userId)!;
}

export function updateUserProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
  const profile = getUserProfile(userId);
  const updated = { ...profile, ...updates };
  userProfiles.set(userId, updated);
  return updated;
}

export function recordFeedback(userId: string, feedback: FeedbackEntry): void {
  const profile = getUserProfile(userId);
  profile.feedbackHistory.push(feedback);

  // Keep last 50 feedbacks
  if (profile.feedbackHistory.length > 50) {
    profile.feedbackHistory = profile.feedbackHistory.slice(-50);
  }

  // Update personality score
  const positiveCount = profile.feedbackHistory.filter((f) => f.type === "positive").length;
  profile.personalityScore = positiveCount / profile.feedbackHistory.length;
}
