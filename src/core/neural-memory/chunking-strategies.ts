// Rottra Chunking Strategies — Tối ưu chunking cho tài liệu nông nghiệp dài
// Semantic chunking, sliding window, paragraph-aware, agricultural domain-specific

export interface ChunkingConfig {
  maxChunkSize: number; // characters
  overlapSize: number; // characters overlap between chunks
  minChunkSize: number; // minimum chunk to keep
  strategy: "fixed" | "sliding" | "semantic" | "paragraph" | "agricultural";
}

const DEFAULT_CONFIG: ChunkingConfig = {
  maxChunkSize: 512,
  overlapSize: 64,
  minChunkSize: 50,
  strategy: "semantic",
};

// Agricultural domain keywords for semantic boundaries
const AGRICULTURAL_BOUNDARIES = [
  // Section headers
  /(?:^|\n)#{1,3}\s+.+/g,
  /(?:^|\n)\d+\.\s+[A-ZÀ-Ỹ]/g,
  /(?:^|\n)[IVXLC]+\.\s+/g,

  // Agricultural patterns
  /(?:^|\n)(?:Mùa vụ|Vụ trồng|Thời gian|Kỹ thuật|Phòng trừ|Bón phân|Tưới nước|Thu hoạch)/gi,
  /(?:^|\n)(?:Loại cây|Giống|Phương pháp|Quy trình|Tiêu chuẩn|Chất lượng)/gi,

  // Natural breaks
  /(?:^|\n){2,}/g, // double newlines
  /(?:^|\n)---+/g, // horizontal rules
  /(?:^|\n)===+/g, // section separators
];

// Sentence boundary patterns
const SENTENCE_BOUNDARIES = /[.!?。！？]\s+/g;

// Paragraph boundary patterns
const PARAGRAPH_BOUNDARIES = /\n\s*\n/g;

/**
 * Fixed-size chunking with overlap
 */
export function fixedChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config, strategy: "fixed" as const };
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + cfg.maxChunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastSentence = chunk.search(SENTENCE_BOUNDARIES);
      if (lastSentence > cfg.minChunkSize) {
        chunk = chunk.slice(0, lastSentence + 1);
      }
    }

    if (chunk.trim().length >= cfg.minChunkSize) {
      chunks.push(chunk.trim());
    }

    start += cfg.maxChunkSize - cfg.overlapSize;
  }

  return chunks;
}

/**
 * Sliding window chunking with semantic breaks
 */
export function slidingWindowChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config, strategy: "sliding" as const };
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + cfg.maxChunkSize, text.length);
    let chunk = text.slice(start, end);

    // Find best break point (sentence > paragraph > word)
    if (end < text.length) {
      // Try sentence break first
      const sentences = chunk.split(SENTENCE_BOUNDARIES);
      if (sentences.length > 1) {
        const lastComplete = sentences.slice(0, -1).join(". ");
        if (lastComplete.length >= cfg.minChunkSize) {
          chunk = lastComplete + ".";
        }
      }
    }

    if (chunk.trim().length >= cfg.minChunkSize) {
      chunks.push(chunk.trim());
    }

    start += cfg.maxChunkSize - cfg.overlapSize;
  }

  return chunks;
}

/**
 * Semantic chunking — respect natural document structure
 */
export function semanticChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config, strategy: "semantic" as const };

  // First, try to split by paragraphs
  const paragraphs = text.split(PARAGRAPH_BOUNDARIES).filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 1) {
    // No paragraph breaks, fall back to sliding window
    return slidingWindowChunking(text, config);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (currentChunk.length + trimmed.length + 2 <= cfg.maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    } else {
      if (currentChunk.length >= cfg.minChunkSize) {
        chunks.push(currentChunk);
      }
      currentChunk = trimmed;
    }
  }

  if (currentChunk.length >= cfg.minChunkSize) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Paragraph-aware chunking — preserve paragraph integrity
 */
export function paragraphChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config, strategy: "paragraph" as const };

  const paragraphs = text.split(PARAGRAPH_BOUNDARIES).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  let currentChunk = "";
  let currentSize = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    const paraSize = trimmed.length;

    // If single paragraph exceeds max, split it
    if (paraSize > cfg.maxChunkSize) {
      if (currentChunk.length >= cfg.minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = "";
        currentSize = 0;
      }

      // Split long paragraph by sentences
      const sentences = trimmed.split(SENTENCE_BOUNDARIES);
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 <= cfg.maxChunkSize) {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        } else {
          if (sentenceChunk.length >= cfg.minChunkSize) {
            chunks.push(sentenceChunk);
          }
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk.length >= cfg.minChunkSize) {
        currentChunk = sentenceChunk;
        currentSize = sentenceChunk.length;
      }
    } else if (currentSize + paraSize + 2 <= cfg.maxChunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
      currentSize += paraSize + 2;
    } else {
      if (currentChunk.length >= cfg.minChunkSize) {
        chunks.push(currentChunk);
      }
      currentChunk = trimmed;
      currentSize = paraSize;
    }
  }

  if (currentChunk.length >= cfg.minChunkSize) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Agricultural domain-aware chunking
 * Respects crop sections, farming techniques, seasonal patterns
 */
export function agriculturalChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config, strategy: "agricultural" as const };

  // Step 1: Identify agricultural section boundaries
  const sections: { start: number; end: number; type: string }[] = [];

  for (const pattern of AGRICULTURAL_BOUNDARIES) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      sections.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "boundary",
      });
    }
  }

  // Sort by position
  sections.sort((a, b) => a.start - b.start);

  // Merge overlapping sections
  const mergedSections: { start: number; end: number }[] = [];
  for (const section of sections) {
    if (mergedSections.length > 0 && section.start <= mergedSections[mergedSections.length - 1].end) {
      mergedSections[mergedSections.length - 1].end = Math.max(mergedSections[mergedSections.length - 1].end, section.end);
    } else {
      mergedSections.push({ start: section.start, end: section.end });
    }
  }

  // Step 2: Extract chunks based on boundaries
  const chunks: string[] = [];

  if (mergedSections.length === 0) {
    // No agricultural boundaries found, use semantic chunking
    return semanticChunking(text, config);
  }

  // Add content before first boundary
  if (mergedSections[0].start > cfg.minChunkSize) {
    const preContent = text.slice(0, mergedSections[0].start).trim();
    if (preContent.length >= cfg.minChunkSize) {
      chunks.push(preContent);
    }
  }

  // Extract sections
  for (let i = 0; i < mergedSections.length; i++) {
    const sectionStart = mergedSections[i].end;
    const sectionEnd = i + 1 < mergedSections.length ? mergedSections[i + 1].start : text.length;

    const sectionContent = text.slice(sectionStart, sectionEnd).trim();

    if (sectionContent.length <= cfg.maxChunkSize) {
      if (sectionContent.length >= cfg.minChunkSize) {
        chunks.push(sectionContent);
      }
    } else {
      // Split large section using paragraph chunking
      const subChunks = paragraphChunking(sectionContent, config);
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

/**
 * Smart chunking — auto-select best strategy based on content
 */
export function smartChunking(text: string, config?: Partial<ChunkingConfig>): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Detect content type
  const isAgricultural = /(?:nông nghiệp|cây trồng|vụ trồng|phân bón|tưới nước|thu hoạch|bệnh cây|sâu bệnh|giống|đất|phù sa)/i.test(text);

  const hasStructure = /(?:^|\n)#{1,3}\s+|(?:^|\n)\d+\.\s+[A-ZÀ-Ỹ]/gm.test(text);

  const hasParagraphs = (text.match(PARAGRAPH_BOUNDARIES) || []).length > 3;

  // Select strategy
  if (isAgricultural && cfg.strategy === "agricultural") {
    return agriculturalChunking(text, config);
  }

  if (hasStructure || hasParagraphs) {
    return paragraphChunking(text, config);
  }

  if (cfg.strategy === "semantic") {
    return semanticChunking(text, config);
  }

  return slidingWindowChunking(text, config);
}

/**
 * Contextual chunking — add metadata headers to each chunk
 */
export function contextualChunking(
  text: string,
  metadata: { title?: string; category?: string; source?: string },
  config?: Partial<ChunkingConfig>,
): { content: string; metadata: Record<string, any> }[] {
  const chunks = smartChunking(text, config);

  return chunks.map((chunk, index) => ({
    content: chunk,
    metadata: {
      ...metadata,
      chunkIndex: index,
      totalChunks: chunks.length,
      chunkSize: chunk.length,
      hasOverlap: index > 0,
    },
  }));
}

/**
 * Hierarchical chunking — parent-child chunks for multi-granularity retrieval
 */
export function hierarchicalChunking(text: string, config?: Partial<ChunkingConfig>): { parents: string[]; children: string[][] } {
  const parentConfig = { ...DEFAULT_CONFIG, ...config, maxChunkSize: 1024, overlapSize: 128 };
  const childConfig = { ...DEFAULT_CONFIG, ...config, maxChunkSize: 256, overlapSize: 32 };

  const parents = paragraphChunking(text, parentConfig);
  const children = parents.map((parent) => slidingWindowChunking(parent, childConfig));

  return { parents, children };
}

/**
 * Get chunking statistics
 */
export function getChunkingStats(chunks: string[]): {
  totalChunks: number;
  avgSize: number;
  minSize: number;
  maxSize: number;
  totalChars: number;
} {
  if (chunks.length === 0) {
    return { totalChunks: 0, avgSize: 0, minSize: 0, maxSize: 0, totalChars: 0 };
  }

  const sizes = chunks.map((c) => c.length);
  const totalChars = sizes.reduce((a, b) => a + b, 0);

  return {
    totalChunks: chunks.length,
    avgSize: Math.round(totalChars / chunks.length),
    minSize: Math.min(...sizes),
    maxSize: Math.max(...sizes),
    totalChars,
  };
}
