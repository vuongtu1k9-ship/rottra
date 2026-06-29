const MAX_RESPONSE_LENGTH = 8000;
const MIN_RESPONSE_LENGTH = 5;

const FORBIDDEN_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /AKIA[A-Z0-9]{16}/,
];

const HALLUCINATION_MARKERS = [
  /according to my (latest|recent) (update|knowledge)/i,
  /as of (20\d{2}|today|now)/i,
  /i (just|recently) (checked|verified|looked up)/i,
  /the current (price|rate|value) is/i,
  /live (data|feed|stream)/i,
];

const BROKEN_FORMATTING = [/\[object Object\]/, /undefined/, /NaN/, /\$\{[^}]+\}/, /<function>/, /traceback/i, /error:/i];

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  issues: string[];
}

export function validateAgentResponse(raw: string, context?: string): ValidationResult {
  const issues: string[] = [];
  let sanitized = raw;

  if (!sanitized || sanitized.trim().length < MIN_RESPONSE_LENGTH) {
    return { valid: false, sanitized: "Dạ em chưa có thông tin đầy đủ để trả lời câu hỏi này ạ.", issues: ["empty_response"] };
  }

  if (sanitized.length > MAX_RESPONSE_LENGTH) {
    sanitized = sanitized.slice(0, MAX_RESPONSE_LENGTH) + "\n\n*(Phản hồi bị cắt ngắn do quá dài)*";
    issues.push("truncated");
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
      issues.push("redacted_secret:" + pattern.source.slice(0, 30));
    }
  }

  for (const pattern of HALLUCINATION_MARKERS) {
    if (pattern.test(sanitized)) {
      issues.push("hallucination_marker:" + pattern.source.slice(0, 30));
    }
  }

  for (const pattern of BROKEN_FORMATTING) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "");
      issues.push("broken_formatting:" + pattern.source.slice(0, 30));
    }
  }

  sanitized = sanitized
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/ {3,}/g, "  ")
    .trim();

  return {
    valid: issues.length === 0,
    sanitized,
    issues,
  };
}

export function validateTranslation(text: string, targetLang: string): ValidationResult {
  const issues: string[] = [];
  let sanitized = text;

  if (!sanitized || sanitized.trim().length === 0) {
    return { valid: false, sanitized: text, issues: ["empty_translation"] };
  }

  if (targetLang === "zh" && !/[\u4e00-\u9fff]/.test(sanitized)) {
    issues.push("missing_cjk_chars");
  }
  if (targetLang === "ja" && !/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(sanitized)) {
    issues.push("missing_japanese_chars");
  }
  if (targetLang === "he" && !/[\u0590-\u05FF]/.test(sanitized)) {
    issues.push("missing_hebrew_chars");
  }

  if (sanitized.length > text.length * 3) {
    issues.push("excessive_length_ratio");
  }

  return {
    valid: issues.length === 0,
    sanitized,
    issues,
  };
}
