export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | undefined;
  name: string;
  startTime: number;
  endTime: number | undefined;
  durationMs: number | undefined;
  status: "ok" | "error";
  metadata: Record<string, any> | undefined;
}

class Tracer {
  private spans: Map<string, TraceSpan> = new Map();
  private activeTraceId: string | null = null;

  startSpan(name: string, parentSpanId?: string): TraceSpan {
    const traceId = this.activeTraceId || crypto.randomUUID();
    if (!this.activeTraceId) this.activeTraceId = traceId;

    const spanId = crypto.randomUUID();
    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: performance.now(),
      endTime: undefined,
      durationMs: undefined,
      status: "ok",
      metadata: undefined,
    };

    this.spans.set(spanId, span);
    return span;
  }

  endSpan(spanId: string, status: TraceSpan["status"] = "ok", metadata?: Record<string, any>) {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = performance.now();
    span.durationMs = Math.round(span.endTime - span.startTime);
    span.status = status;
    if (metadata) span.metadata = metadata;

    this.activeTraceId = null;
  }

  getSpans(): TraceSpan[] {
    return Array.from(this.spans.values()).map((s) => ({
      ...s,
      endTime: s.endTime ?? performance.now(),
      durationMs: s.durationMs ?? Math.round((s.endTime ?? performance.now()) - s.startTime),
    }));
  }

  clear() {
    this.spans.clear();
    this.activeTraceId = null;
  }
}

export const tracer = new Tracer();
