/**
 * NLP Intent Parser — Rottra offline intent parsing.
 * Extracts structured intent data from raw user text.
 */

export interface SalesIntent {
  type: "inquiry" | "bargain" | "order" | "confirm" | "cancel";
  product?: string;
  quantity?: number;
  price?: string;
  confidence: number;
}

export interface RefundIntent {
  type: "request" | "complaint" | "exchange";
  orderId?: string;
  reason?: string;
  confidence: number;
}

const SALES_PATTERNS: Array<{ pattern: RegExp; type: SalesIntent["type"]; confidence: number }> = [
  { pattern: /mua\s+(\d+)\s+(.+?)(?:\s+giá|\s+đơn|\s+tôi|$)/i, type: "order", confidence: 0.9 },
  { pattern: /chốt\s+đơn\s+(.+)/i, type: "confirm", confidence: 0.85 },
  { pattern: /hủy\s+đơn/i, type: "cancel", confidence: 0.9 },
  { pattern: /(?:giảm|bớt|đńs|deal)\s+giá/i, type: "bargain", confidence: 0.8 },
  { pattern: /(?:còn|có)\s+(.+?)\s+không/i, type: "inquiry", confidence: 0.7 },
  { pattern: /(?:giá|bao nhiêu)\s+(.+?)(?:\s|$)/i, type: "inquiry", confidence: 0.65 },
];

const REFUND_PATTERNS: Array<{ pattern: RegExp; type: RefundIntent["type"]; confidence: number }> = [
  { pattern: /đổi\s+trả\s+(?:đơn\s+)?(\w+)/i, type: "request", confidence: 0.9 },
  { pattern: /hoàn\s+tiền/i, type: "request", confidence: 0.85 },
  { pattern: /khhiếu\s+nại/i, type: "complaint", confidence: 0.9 },
  { pattern: /sản\s+phẩm\s+(?:bị|hỏng|lỗi|không\s+đúng)/i, type: "complaint", confidence: 0.85 },
  { pattern: /đổi\s+(?:sản\s+phẩm|hàng)/i, type: "exchange", confidence: 0.8 },
];

export function parseSalesIntents(text: string): SalesIntent[] {
  const results: SalesIntent[] = [];
  for (const { pattern, type, confidence } of SALES_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const intent: SalesIntent = { type, confidence };
      if (type === "order" && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed)) intent.quantity = parsed;
        intent.product = match[2]?.trim();
      }
      results.push(intent);
    }
  }
  return results;
}

export function parseRefundIntents(text: string): RefundIntent[] {
  const results: RefundIntent[] = [];
  for (const { pattern, type, confidence } of REFUND_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const intent: RefundIntent = { type, confidence };
      if (match[1]) intent.orderId = match[1];
      results.push(intent);
    }
  }
  return results;
}
