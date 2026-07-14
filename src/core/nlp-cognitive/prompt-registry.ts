import { LRUCache } from "~/core/neural-memory/zero-alloc-lru";

type PromptTemplate = {
  template: string;
  intent: string;
  variables: string[];
};

type PromptResult = {
  text: string;
  cached: boolean;
};

export class PromptRegistry {
  private static instance: PromptRegistry;
  private templates: Map<string, PromptTemplate> = new Map();
  private cache: LRUCache<string, PromptResult> = new LRUCache<string, PromptResult>(500, 1800);

  private constructor() {
    this.registerDefaultTemplates();
  }

  static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry();
    }
    return PromptRegistry.instance;
  }

  private registerDefaultTemplates(): void {
    this.templates.set("GREETING", {
      template: `👋 **Chào Sếp! Tôi là hệ thống AI AI Siêu nhỏ Rottra.**\n\nChúc Sếp một ngày làm việc tràn đầy năng lượng và gặt hái nhiều thành công! Lõi nhận thức offline của tôi đã sẵn sàng.`,
      intent: "GREETING",
      variables: [],
    });

    this.templates.set("TSP", {
      template: `🎓 **[GIẢI PHÁP ĐƯỜNG ĐI DI CHUYỂN TSP - ROTTRA OPTIMAL ROUTE]**\n\n- **Số nút nông trại tham chiếu:** {{NODES}}\n- **Đường đi tối ưu đề xuất:** {{ROUTE}}\n- **Tổng quãng đường di chuyển ngắn nhất:** {{DISTANCE}} km`,
      intent: "TSP",
      variables: ["NODES", "ROUTE", "DISTANCE"],
    });

    this.templates.set("NPV", {
      template: `🎓 **[THẨM ĐỊNH TÀI CHÍNH DỰ ÁN NPV & CBA - ROTTRA CAPITAL BUDGETING]**\n\n- **Vốn đầu tư ban đầu (CAPEX):** {{CAPEX}}\n- **NPV kết quả:** {{NPV_VAL}} triệu đồng\n- **Quyết định:** {{DECISION}}`,
      intent: "NPV",
      variables: ["CAPEX", "CASHFLOW", "YEARS", "RATE", "NPV_VAL", "DECISION"],
    });
  }

  register(intent: string, template: string, variables: string[]): void {
    this.templates.set(intent, { template, intent, variables });
  }

  render(intent: string, replacements: Record<string, string | number>): PromptResult {
    const tmpl = this.templates.get(intent);
    if (!tmpl) {
      return { text: "", cached: false };
    }

    const cacheKey = `${intent}:${JSON.stringify(replacements)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    let text = tmpl.template;
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }

    this.cache.set(cacheKey, { text, cached: false });
    return { text, cached: false };
  }

  getTemplate(intent: string): PromptTemplate | undefined {
    return this.templates.get(intent);
  }
}

export const promptRegistry = PromptRegistry.getInstance();
