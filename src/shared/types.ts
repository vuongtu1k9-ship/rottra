type IntentStrategyName = "SEMANTIC_ANCHOR_EXACT" | "SEMANTIC_ANCHOR_FUZZY" | "NLP_MACHINE_LEARNING" | "FALLBACK_SEARCH";

interface LLMStrategy {
  name: "GGUF" | "RAG" | "GRAPH_RAG";
  execute: (query: string, context: string) => Promise<string>;
  isAvailable: () => boolean | Promise<boolean>;
}

interface IntentClassificationStrategy {
  classify: (query: string, cleanedQuery: string) => Promise<any> | any | null;
}

interface MemoryStrategy {
  save: (sessionId: string, key: string, value: any) => Promise<void>;
  load: (sessionId: string, key: string) => Promise<any>;
  clear: (sessionId: string) => Promise<void>;
}

export type { LLMStrategy, IntentClassificationStrategy, MemoryStrategy, IntentStrategyName };
