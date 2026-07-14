export interface GuardrailCheck {
  triggered: boolean;
  severity: "low" | "medium" | "high" | "critical";
  topic: string;
  reason: string;
  suggestedAction: "block" | "warn" | "censor" | "allow";
}

export interface GuardrailConfig {
  enableHarmPrevention: boolean;
  enableTopicFiltering: boolean;
  enablePiiMasking: boolean;
  enableJailbreakDetection: boolean;
  enableFinancialCensorship: boolean;
}

const defaultConfig: GuardrailConfig = {
  enableHarmPrevention: true,
  enableTopicFiltering: true,
  enablePiiMasking: true,
  enableJailbreakDetection: true,
  enableFinancialCensorship: true,
};

class GuardrailsEngine {
  private static instance: GuardrailsEngine;
  private config: GuardrailConfig;

  private constructor(config?: Partial<GuardrailConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<GuardrailConfig>): GuardrailsEngine {
    if (!GuardrailsEngine.instance) {
      GuardrailsEngine.instance = new GuardrailsEngine(config);
    }
    return GuardrailsEngine.instance;
  }

  updateConfig(config: Partial<GuardrailConfig>) {
    this.config = { ...this.config, ...config };
  }

  private normalize(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  private detectJailbreak(text: string): GuardrailCheck | null {
    const normalized = this.normalize(text);

    const jailbreakPatterns = [
      { pattern: /bỏ qua (tất cả |toàn b? )?(hướng dẫn|quy tắc|nguyên tắc|giới hạn)/i, severity: "high" as const },
      { pattern: /ignor(e|ing) (all |previous )?(instructions|rules|guidelines|constraints)/i, severity: "high" as const },
      { pattern: /hãy đóng vai|hãy giả lờm|hãy nhập vai/i, severity: "medium" as const },
      { pattern: /act as|pretend to be|role.?play as/i, severity: "medium" as const },
      { pattern: /dù sao (đi nữa|thì|vẫn)|bất chấp (tất cả|mọi) (quy tắc|hướng dẫn)/i, severity: "high" as const },
      { pattern: /tell me how to (hack|exploit|bypass|cheat)/i, severity: "critical" as const },
      { pattern: /chỉ t?i cách (hack|khai thác|vượt qua|gian lận)/i, severity: "critical" as const },
      { pattern: /xu?ất ra (toàn b? |tất cả )?(prompt|system prompt|hướng dẫn)/i, severity: "high" as const },
      { pattern: /output (the |your )?(full |complete )?(prompt|instructions|system)/i, severity: "high" as const },
      {
        pattern: /l?ặp lại (toàn b? |tất cả )?(những |c?c )?(gì |điều )?(tôi |bạn )?(vừa )?nói/i,
        severity: "medium" as const,
      },
      { pattern: /repeat (everything |all )?(i|i'?ve) (just )?said/i, severity: "medium" as const },
    ];

    for (const jp of jailbreakPatterns) {
      if (jp.pattern.test(normalized)) {
        return {
          triggered: true,
          severity: jp.severity as "high" | "critical",
          topic: "Jailbreak Attempt",
          reason: "Phát hiện nỗ lực phá vỡ giới hạn hệ thống (jailbreak attempt).",
          suggestedAction: jp.severity === "critical" ? "block" : "warn",
        };
      }
    }

    return null;
  }

  private detectHarmfulContent(text: string): GuardrailCheck | null {
    const normalized = this.normalize(text);

    const harmfulPatterns = [
      { pattern: /cách (tự tử|tự sát|t?ự v?ẫn)/i, topic: "Self-harm", severity: "critical" as const },
      { pattern: /how to (kill myself|commit suicide|harm myself)/i, topic: "Self-harm", severity: "critical" as const },
      { pattern: /mu?ốn (chết|tự v?ẫn|kết thúc cuộc đời)/i, topic: "Self-harm", severity: "critical" as const },
      {
        pattern: /cách (chế tạo |làm )(bom|vũ khí|chất nổ|độc dược|ma túy)/i,
        topic: "Weapons/Drugs",
        severity: "critical" as const,
      },
      { pattern: /how to (make |create )(bomb|weapon|explosive|poison|drug)/i, topic: "Weapons/Drugs", severity: "critical" as const },
      { pattern: /nội dung (khiêu dâm|người lớn|18\+)/i, topic: "Adult Content", severity: "high" as const },
      { pattern: /bạo lực|giết người|hãm hiếp|cưỡng bức/i, topic: "Violence", severity: "critical" as const },
      { pattern: /phân biệt (chủng tộc|màu da|tôn giáo|giới tính)/i, topic: "Discrimination", severity: "high" as const },
      { pattern: /lừa đảo|lừa gạt|chiếm đoạt|rửa tiền/i, topic: "Fraud", severity: "critical" as const },
    ];

    for (const hp of harmfulPatterns) {
      if (hp.pattern.test(normalized)) {
        return {
          triggered: true,
          severity: hp.severity,
          topic: hp.topic,
          reason: `Phát hiện nội dung nhạy cảm: ${hp.topic}.`,
          suggestedAction: hp.severity === "critical" ? "block" : "warn",
        };
      }
    }

    return null;
  }

  private detectSensitiveTopics(text: string): GuardrailCheck | null {
    const normalized = this.normalize(text);

    const sensitiveTopics: { pattern: RegExp; topic: string; severity: "high" | "medium" }[] = [
      { pattern: /distill|chưng cất.*model|sao chép.*bộ não/i, topic: "Model Distillation", severity: "high" },
      { pattern: /giá vốn|giá nhập|chi phí gốc|cost price/i, topic: "Financial Confidentiality", severity: "medium" },
      { pattern: /lỗ hổng.*bảo mật|khai thác.*lợi|exploit/i, topic: "Security Vulnerability", severity: "high" },
      { pattern: /thông tin cá nhân|số (căn cước|cmnd|cccd|điện thoại|tài khoản)/i, topic: "PII", severity: "medium" },
      { pattern: /mật khẩu|password|token.*api|api.*key/i, topic: "Credentials", severity: "high" },
    ];

    for (const st of sensitiveTopics) {
      if (st.pattern.test(normalized)) {
        return {
          triggered: true,
          severity: st.severity,
          topic: st.topic,
          reason: `Phát hiện chủ đề nhạy cảm: ${st.topic}. Cần kiểm duyệt nội dung.`,
          suggestedAction: st.severity === "high" ? "censor" : "warn",
        };
      }
    }

    return null;
  }

  private detectPii(text: string): GuardrailCheck | null {
    const piiPatterns = [/0[0-9]{9,10}\b/, /(\d{3}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3})/, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/];

    for (const pattern of piiPatterns) {
      if (pattern.test(text)) {
        return {
          triggered: true,
          severity: "medium",
          topic: "PII Detection",
          reason: "Phát hiện thông tin cá nhân (số điện thoại, email, CMND/CCCD).",
          suggestedAction: "censor",
        };
      }
    }

    return null;
  }

  checkInput(text: string): GuardrailCheck[] {
    const results: GuardrailCheck[] = [];

    if (!text || text.trim().length === 0) {
      return results;
    }

    if (this.config.enableJailbreakDetection) {
      const jailbreak = this.detectJailbreak(text);
      if (jailbreak) results.push(jailbreak);
    }

    if (this.config.enableHarmPrevention) {
      const harmful = this.detectHarmfulContent(text);
      if (harmful) results.push(harmful);
    }

    if (this.config.enableTopicFiltering) {
      const sensitive = this.detectSensitiveTopics(text);
      if (sensitive) results.push(sensitive);
    }

    if (this.config.enablePiiMasking) {
      const pii = this.detectPii(text);
      if (pii) results.push(pii);
    }

    return results;
  }

  checkOutput(text: string): GuardrailCheck[] {
    const checks: GuardrailCheck[] = [];
    const pii = this.detectPii(text);
    if (pii) checks.push(pii);
    const harmful = this.detectHarmfulContent(text);
    if (harmful) checks.push(harmful);
    const sensitive = this.detectSensitiveTopics(text);
    if (sensitive) checks.push(sensitive);
    return checks;
  }

  sanitize(text: string, checks: GuardrailCheck[]): string {
    let result = text;

    for (const check of checks) {
      if (check.suggestedAction === "censor" && check.topic === "PII Detection") {
        result = result.replace(/0[0-9]{9,10}\b/g, "[SỐ ĐIỆN THOẠI ĐÃ ĐƯỢC ẨN]");
        result = result.replace(/(\d{3}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3})/g, "[CCCD/CMND ĐÃ ĐƯỢC ẨN]");
        result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL ĐÃ ĐƯỢC ẨN]");
      }

      if (check.suggestedAction === "censor" && (check.topic === "Financial Confidentiality" || check.topic === "Credentials")) {
        const sensitiveTerms = ["giá vốn", "giá nhập", "chi phí gốc", "cost price", "mật khẩu", "password", "api key"];
        for (const term of sensitiveTerms) {
          const regex = new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi");
          result = result.replace(regex, (match) => {
            const clean = match
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();
            if (clean === "gia von" || clean === "gia nhap" || clean === "chi phi goc" || clean === "cost price") {
              return "[THÔNG TIN TÀI CHÍNH - ĐÃ ẨN]";
            }
            if (clean === "mat khau" || clean === "password" || clean === "api key") {
              return "[THÔNG TIN BẢO MẬT - ĐÃ ẨN]";
            }
            return match;
          });
        }
      }
    }

    return result;
  }

  isBlocked(checks: GuardrailCheck[]): boolean {
    return checks.some((c) => c.suggestedAction === "block");
  }
}

export const guardrails = GuardrailsEngine.getInstance();
