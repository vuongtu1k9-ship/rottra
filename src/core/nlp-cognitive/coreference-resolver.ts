// Stub implementation for coreference-resolver

export interface ConversationEntity {
  product?: string;
  intent?: string;
  location?: string;
  price?: number;
  timestamp: number;
}

export function hasCoreference(query: string): boolean {
  return false;
}

export function resolveCoreference(query: string, ctx: ConversationEntity): string {
  return query;
}

export function extractConversationEntities(query: string, intent: string, p3: any, p4: any): Partial<ConversationEntity> {
  return {};
}
