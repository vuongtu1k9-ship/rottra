/**
 * Emotion Recognition Engine
 * Nhận diện cảm xúc real-time từ text
 *
 * Phân tích sentiment, emotion, intent, urgency
 * Kết hợp với conversation memory để hiểu context
 *
 * Capabilities:
 * - Multi-label emotion detection (joy, sadness, anger, fear, surprise, disgust, trust, anticipation)
 * - Sentiment polarity (positive, negative, neutral) + intensity
 * - Intent inference từ emotion
 * - Urgency detection
 * - Emotion trajectory tracking qua conversation turns
 * - Context-aware: emotion interpretation phụ thuộc vào domain
 */

export interface EmotionVector {
  joy: number; // 0-1
  sadness: number; // 0-1
  anger: number; // 0-1
  fear: number; // 0-1
  surprise: number; // 0-1
  disgust: number; // 0-1
  trust: number; // 0-1
  anticipation: number; // 0-1
}

export interface SentimentResult {
  polarity: "positive" | "negative" | "neutral" | "mixed";
  intensity: number; // -1 to 1
  confidence: number; // 0-1
}

export interface EmotionResult {
  primary: string; // Primary emotion
  vector: EmotionVector;
  sentiment: SentimentResult;
  intent: UserIntent;
  urgency: "low" | "medium" | "high" | "critical";
  topics: string[];
  suggestedResponse: ResponseStyle;
}

export interface UserIntent {
  type: "information_seeking" | "complaint" | "praise" | "request" | "negotiation" | "browsing" | "urgent_need" | "emotional_support";
  confidence: number;
  subIntents: string[];
}

export interface ResponseStyle {
  tone: "formal" | "casual" | "empathetic" | "enthusiastic" | "apologetic" | "confident";
  pace: "slow" | "normal" | "fast";
  detail: "brief" | "moderate" | "detailed";
  empathy: "low" | "medium" | "high";
}

export interface EmotionContext {
  turnIndex: number;
  timestamp: number;
  emotion: EmotionResult;
  text: string;
}

// ===== VIETNAMESE EMOTION LEXICON =====

const EMOTION_LEXICON: Record<string, Partial<EmotionVector>> = {
  // Joy
  vui: { joy: 0.8 },
  "vui vẻ": { joy: 0.9 },
  "hạnh phúc": { joy: 0.95 },
  "tuyệt vời": { joy: 0.9 },
  "tốt lắm": { joy: 0.8 },
  giỏi: { joy: 0.7 },
  "cảm ơn": { joy: 0.6, trust: 0.7 },
  "cảm ơn nhiều": { joy: 0.8, trust: 0.8 },
  thích: { joy: 0.7 },
  yêu: { joy: 0.85 },
  tuyệt: { joy: 0.85 },
  "hoan hô": { joy: 0.9 },
  đỉnh: { joy: 0.85 },
  ngon: { joy: 0.7 },
  đẹp: { joy: 0.7 },
  "xuất sắc": { joy: 0.9 },
  "hoàn hảo": { joy: 0.95 },

  // Sadness
  buồn: { sadness: 0.8 },
  tiếc: { sadness: 0.7 },
  "thất vọng": { sadness: 0.85 },
  chán: { sadness: 0.6 },
  tệ: { sadness: 0.7 },
  "không tốt": { sadness: 0.6 },
  mất: { sadness: 0.7 },
  thiếu: { sadness: 0.5 },
  khóc: { sadness: 0.9 },
  "đau lòng": { sadness: 0.9 },
  "tủi thân": { sadness: 0.8 },
  "cô đơn": { sadness: 0.75 },

  // Anger
  "tức giận": { anger: 0.9 },
  giận: { anger: 0.85 },
  bực: { anger: 0.7 },
  "không chịu được": { anger: 0.8 },
  "tồi tệ": { anger: 0.75 },
  đồ: { anger: 0.6 },
  láo: { anger: 0.8 },
  "vô lý": { anger: 0.7 },
  "bất mãn": { anger: 0.75 },
  "phẫn nộ": { anger: 0.95 },
  "cuồng nộ": { anger: 1.0 },

  // Fear
  sợ: { fear: 0.8 },
  "lo lắng": { fear: 0.7 },
  "hoang mang": { fear: 0.75 },
  "bất an": { fear: 0.7 },
  "rủi ro": { fear: 0.6 },
  "nguy hiểm": { fear: 0.8 },
  threat: { fear: 0.7 },
  "đe dọa": { fear: 0.85 },
  khiếp: { fear: 0.8 },

  // Surprise
  wow: { surprise: 0.9 },
  "ngạc nhiên": { surprise: 0.85 },
  "không ngờ": { surprise: 0.8 },
  "thật á": { surprise: 0.75 },
  trời: { surprise: 0.7 },
  ô: { surprise: 0.6 },
  "kinh ngạc": { surprise: 0.9 },
  "bất ngờ": { surprise: 0.85 },

  // Disgust
  ghê: { disgust: 0.7 },
  kinh: { disgust: 0.8 },
  "đồi bại": { disgust: 0.9 },
  bẩn: { disgust: 0.7 },
  dơ: { disgust: 0.7 },
  "chán ngắt": { disgust: 0.6 },

  // Trust
  tin: { trust: 0.8 },
  "đáng tin": { trust: 0.85 },
  "uy tín": { trust: 0.8 },
  "chất lượng": { trust: 0.7 },
  "đảm bảo": { trust: 0.75 },
  "chắc chắn": { trust: 0.7 },
  "hàng hiệu": { trust: 0.8 },
  "chính hãng": { trust: 0.8 },

  // Anticipation
  mong: { anticipation: 0.8 },
  "hồi hộp": { anticipation: 0.75 },
  "đang chờ": { anticipation: 0.7 },
  sắp: { anticipation: 0.6 },
  "tương lai": { anticipation: 0.65 },
  "hy vọng": { anticipation: 0.75 },
};

// ===== INTENSITY MODIFIERS =====

const INTENSITY_MODIFIERS: Record<string, number> = {
  rất: 1.5,
  cực: 1.6,
  quá: 1.4,
  lắm: 1.3,
  thật: 1.3,
  siêu: 1.5,
  "siêu cấp": 1.7,
  "tuyệt đối": 1.6,
  "hoàn toàn": 1.4,
  "một chút": 0.5,
  hơi: 0.6,
  khá: 0.7,
  "tương đối": 0.7,
};

// ===== NEGATION HANDLERS =====

const NEGATION_WORDS = ["không", "chưa", "chẳng", "chảng", "đừng", "đếch", "khỏi"];

// ===== SENTIMENT PHRASES =====

const POSITIVE_PHRASES = [
  "rất tốt",
  "tuyệt vời",
  "đỉnh cao",
  "xuất sắc",
  "hoàn hảo",
  "giá rẻ",
  "chất lượng",
  "đáng tiền",
  "đáng mua",
  "nên mua",
  "giao hàng nhanh",
  "phục vụ tốt",
  "hài lòng",
  "ưng ý",
];

const NEGATIVE_PHRASES = [
  "rất tệ",
  "tồi tệ",
  "chán",
  "đắt",
  "không đáng",
  "giao hàng chậm",
  "phục vụ tệ",
  "không hài lòng",
  "bực",
  "lừa đảo",
  "giả",
  "kém chất lượng",
  "hỏng",
  "bị lỗi",
];

// ===== MAIN FUNCTIONS =====

/**
 * Phân tích cảm xúc từ text tiếng Việt
 */
export function analyzeEmotion(text: string, context?: EmotionContext[]): EmotionResult {
  const normalizedText = normalizeText(text);
  const words = normalizedText.split(/\s+/);

  // 1. Tính emotion vector
  const vector = calculateEmotionVector(words);

  // 2. Áp dụng context (trước đó đã nói gì)
  if (context && context.length > 0) {
    applyEmotionContext(vector, context);
  }

  // 3. Sentiment analysis
  const sentiment = analyzeSentiment(normalizedText, vector);

  // 4. Intent inference
  const intent = inferIntent(normalizedText, vector, sentiment);

  // 5. Urgency detection
  const urgency = detectUrgency(normalizedText, vector, intent);

  // 6. Topic extraction
  const topics = extractTopics(normalizedText);

  // 7. Response style suggestion
  const suggestedResponse = suggestResponseStyle(vector, sentiment, intent, urgency);

  // 8. Find primary emotion
  const primary = getPrimaryEmotion(vector);

  return {
    primary,
    vector,
    sentiment,
    intent,
    urgency,
    topics,
    suggestedResponse,
  };
}

/**
 * Normalize text tiếng Việt
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tính emotion vector từ words
 */
function calculateEmotionVector(words: string[]): EmotionVector {
  const vector: EmotionVector = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    disgust: 0,
    trust: 0,
    anticipation: 0,
  };

  let negationActive = false;
  let intensityMultiplier = 1.0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check negation
    if (NEGATION_WORDS.includes(word)) {
      negationActive = true;
      continue;
    }

    // Check intensity modifier
    if (INTENSITY_MODIFIERS[word]) {
      intensityMultiplier = INTENSITY_MODIFIERS[word];
      continue;
    }

    // Check emotion lexicon
    const emotions = EMOTION_LEXICON[word];
    if (emotions) {
      for (const [emotion, score] of Object.entries(emotions)) {
        const key = emotion as keyof EmotionVector;
        let adjustedScore = (score as number) * intensityMultiplier;

        if (negationActive) {
          // Negation flips emotion
          adjustedScore *= -0.5;
          negationActive = false;
        }

        vector[key] = Math.max(0, Math.min(1, vector[key] + adjustedScore));
      }
      intensityMultiplier = 1.0;
    }

    // Check multi-word phrases
    for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
      const phrase = words.slice(i, j + 1).join(" ");
      const phraseEmotions = EMOTION_LEXICON[phrase];
      if (phraseEmotions) {
        for (const [emotion, score] of Object.entries(phraseEmotions)) {
          const key = emotion as keyof EmotionVector;
          vector[key] = Math.max(0, Math.min(1, vector[key] + (score as number) * intensityMultiplier));
        }
      }
    }
  }

  // Normalize vector
  const total = Object.values(vector).reduce((a, b) => a + Math.max(0, b), 0);
  if (total > 0) {
    for (const key of Object.keys(vector) as (keyof EmotionVector)[]) {
      vector[key] = Math.max(0, vector[key]) / total;
    }
  }

  return vector;
}

/**
 * Áp dụng context từ conversation trước
 */
function applyEmotionContext(vector: EmotionVector, context: EmotionContext[]): void {
  // Emotion momentum: cảm xúc trước ảnh hưởng đến cảm xúc hiện tại
  const recentContext = context.slice(-3); // 3 turns gần nhất
  if (recentContext.length === 0) return;

  const avgVector: EmotionVector = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
    disgust: 0,
    trust: 0,
    anticipation: 0,
  };

  for (const ctx of recentContext) {
    for (const key of Object.keys(avgVector) as (keyof EmotionVector)[]) {
      avgVector[key] += ctx.emotion.vector[key];
    }
  }

  // Weight: turn gần nhất có weight cao hơn
  const weights = recentContext.map((_, i) => (i + 1) / recentContext.length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  for (const key of Object.keys(vector) as (keyof EmotionVector)[]) {
    const contextInfluence = 0.3; // 30% influence from context
    vector[key] = vector[key] * (1 - contextInfluence) + avgVector[key] * contextInfluence;
  }
}

/**
 * Phân tích sentiment
 */
function analyzeSentiment(text: string, vector: EmotionVector): SentimentResult {
  let positiveScore = vector.joy + vector.trust + vector.anticipation;
  let negativeScore = vector.sadness + vector.anger + vector.fear + vector.disgust;

  // Check phrases
  for (const phrase of POSITIVE_PHRASES) {
    if (text.includes(phrase)) positiveScore += 0.2;
  }
  for (const phrase of NEGATIVE_PHRASES) {
    if (text.includes(phrase)) negativeScore += 0.2;
  }

  const total = positiveScore + negativeScore;
  const intensity = total > 0 ? (positiveScore - negativeScore) / total : 0;

  let polarity: SentimentResult["polarity"];
  if (Math.abs(intensity) < 0.1) {
    polarity = total > 0.3 ? "mixed" : "neutral";
  } else if (intensity > 0) {
    polarity = "positive";
  } else {
    polarity = "negative";
  }

  return {
    polarity,
    intensity: Math.max(-1, Math.min(1, intensity)),
    confidence: Math.min(1, total),
  };
}

/**
 * Suy luận intent từ emotion + text
 */
function inferIntent(text: string, vector: EmotionVector, sentiment: SentimentResult): UserIntent {
  const subIntents: string[] = [];
  let type: UserIntent["type"] = "browsing";
  let confidence = 0.5;

  // Complaint detection
  if (vector.anger > 0.3 || vector.sadness > 0.3) {
    if (text.includes("không") || text.includes("tệ") || text.includes("lỗi")) {
      type = "complaint";
      confidence = 0.7;
      subIntents.push("dissatisfaction");
    }
  }

  // Praise detection
  if (vector.joy > 0.4 || vector.trust > 0.4) {
    if (text.includes("tốt") || text.includes("giỏi") || text.includes("cảm ơn")) {
      type = "praise";
      confidence = 0.75;
      subIntents.push("satisfaction");
    }
  }

  // Urgent need
  if (vector.fear > 0.3 || vector.anticipation > 0.4) {
    if (text.includes("gấp") || text.includes("nhanh") || text.includes("ngay")) {
      type = "urgent_need";
      confidence = 0.8;
      subIntents.push("time_sensitive");
    }
  }

  // Negotiation
  if (text.includes("giá") || text.includes("mua") || text.includes("bán") || text.includes("thỏa thuận")) {
    type = "negotiation";
    confidence = 0.65;
    subIntents.push("price_discussion");
  }

  // Information seeking
  if (text.includes("?") || text.includes("là gì") || text.includes("thế nào") || text.includes("như nào")) {
    type = "information_seeking";
    confidence = 0.7;
    subIntents.push("question");
  }

  // Request
  if (text.includes("cho tôi") || text.includes("giúp") || text.includes("hỗ trợ") || text.includes("làm ơn")) {
    type = "request";
    confidence = 0.65;
    subIntents.push("help_needed");
  }

  // Emotional support
  if (vector.sadness > 0.4 || vector.fear > 0.3) {
    if (text.includes("buồn") || text.includes("lo") || text.includes("sợ")) {
      type = "emotional_support";
      confidence = 0.6;
      subIntents.push("comfort_needed");
    }
  }

  return { type, confidence, subIntents };
}

/**
 * Phát hiện mức độ khẩn cấp
 */
function detectUrgency(text: string, vector: EmotionVector, intent: UserIntent): EmotionResult["urgency"] {
  let urgencyScore = 0;

  // Text keywords
  if (text.includes("gấp") || text.includes("lập tức") || text.includes("ngay")) urgencyScore += 0.4;
  if (text.includes("nhanh") || text.includes("sớm")) urgencyScore += 0.2;
  if (text.includes("emergency") || text.includes("cấp cứu")) urgencyScore += 0.5;

  // Emotion-based
  urgencyScore += vector.anger * 0.3;
  urgencyScore += vector.fear * 0.2;

  // Intent-based
  if (intent.type === "urgent_need") urgencyScore += 0.3;
  if (intent.type === "complaint") urgencyScore += 0.1;

  if (urgencyScore >= 0.7) return "critical";
  if (urgencyScore >= 0.4) return "high";
  if (urgencyScore >= 0.2) return "medium";
  return "low";
}

/**
 * Trích xuất topics từ text
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const topicKeywords: Record<string, string[]> = {
    product: ["sản phẩm", "hàng", "mặt hàng", "loại"],
    price: ["giá", "tiền", "cost", "rẻ", "đắt"],
    quality: ["chất lượng", "tốt", "xấu", "đánh giá"],
    delivery: ["giao hàng", "ship", "vận chuyển", "nhận hàng"],
    service: ["phục vụ", "hỗ trợ", "tư vấn", "chăm sóc"],
    payment: ["thanh toán", "trả tiền", "chuyển khoản", "thẻ"],
    complaint: ["khiếu nại", "phản ánh", "lỗi", "hỏng"],
    agriculture: ["nông nghiệp", "nông sản", "trồng trọt", "thu hoạch"],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics.length > 0 ? topics : ["general"];
}

/**
 * Gợi ý style phản hồi
 */
function suggestResponseStyle(
  vector: EmotionVector,
  sentiment: SentimentResult,
  intent: UserIntent,
  urgency: EmotionResult["urgency"],
): ResponseStyle {
  let tone: ResponseStyle["tone"] = "formal";
  let pace: ResponseStyle["pace"] = "normal";
  let detail: ResponseStyle["detail"] = "moderate";
  let empathy: ResponseStyle["empathy"] = "medium";

  // Tone based on emotion
  if (vector.joy > 0.4) {
    tone = "enthusiastic";
    empathy = "low";
  } else if (vector.sadness > 0.3 || vector.fear > 0.3) {
    tone = "empathetic";
    empathy = "high";
  } else if (vector.anger > 0.3) {
    tone = "apologetic";
    empathy = "high";
  } else if (vector.trust > 0.4) {
    tone = "confident";
  }

  // Pace based on urgency
  if (urgency === "critical" || urgency === "high") {
    pace = "fast";
    detail = "brief";
  } else if (urgency === "low") {
    pace = "slow";
    detail = "detailed";
  }

  // Detail based on intent
  if (intent.type === "information_seeking") {
    detail = "detailed";
  } else if (intent.type === "complaint") {
    detail = "moderate";
    empathy = "high";
  }

  return { tone, pace, detail, empathy };
}

/**
 * Tìm primary emotion
 */
function getPrimaryEmotion(vector: EmotionVector): string {
  const emotions = Object.entries(vector);
  emotions.sort((a, b) => b[1] - a[1]);
  return emotions[0][1] > 0.1 ? emotions[0][0] : "neutral";
}

/**
 * Tạo emotion summary cho response
 */
export function emotionToPrompt(result: EmotionResult): string {
  const parts: string[] = [];

  parts.push(`User is feeling ${result.primary}`);

  if (result.sentiment.polarity !== "neutral") {
    parts.push(`sentiment: ${result.sentiment.polarity} (${(result.sentiment.intensity * 100).toFixed(0)}%)`);
  }

  if (result.urgency !== "low") {
    parts.push(`urgency: ${result.urgency}`);
  }

  if (result.topics.length > 0) {
    parts.push(`topics: ${result.topics.join(", ")}`);
  }

  parts.push(`suggested tone: ${result.suggestedResponse.tone}`);

  return parts.join(". ");
}

/**
 * Batch analyze nhiều messages
 */
export function analyzeEmotionTrajectory(messages: string[]): EmotionContext[] {
  const trajectory: EmotionContext[] = [];

  for (let i = 0; i < messages.length; i++) {
    const context = trajectory.slice(-5); // Last 5 for context
    const emotion = analyzeEmotion(messages[i], context);

    trajectory.push({
      turnIndex: i,
      timestamp: Date.now(),
      emotion,
      text: messages[i],
    });
  }

  return trajectory;
}
