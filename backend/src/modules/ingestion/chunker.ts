export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

/**
 * Approximate token count using the ~4 chars per token heuristic.
 * Good enough for chunking; the embedding API handles actual tokenization.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MIN_TOKENS = 500;
const MAX_TOKENS = 1000;
const OVERLAP_SENTENCES = 2;

export function chunkText(text: string): TextChunk[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g);

  if (!sentences || sentences.length === 0) {
    const tokenCount = estimateTokens(text);
    if (tokenCount === 0) return [];
    return [{ content: text.trim(), index: 0, tokenCount }];
  }

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const sentenceTokens = estimateTokens(trimmed);

    if (currentTokens + sentenceTokens > MAX_TOKENS && currentTokens >= MIN_TOKENS) {
      const content = currentSentences.join(' ').trim();
      chunks.push({
        content,
        index: chunks.length,
        tokenCount: estimateTokens(content),
      });

      const overlap = currentSentences.slice(-OVERLAP_SENTENCES);
      currentSentences = [...overlap];
      currentTokens = overlap.reduce((sum, s) => sum + estimateTokens(s), 0);
    }

    currentSentences.push(trimmed);
    currentTokens += sentenceTokens;
  }

  if (currentSentences.length > 0) {
    const content = currentSentences.join(' ').trim();
    const tokenCount = estimateTokens(content);

    if (tokenCount > 0) {
      if (chunks.length > 0 && tokenCount < MIN_TOKENS / 2) {
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content += ' ' + content;
        lastChunk.tokenCount = estimateTokens(lastChunk.content);
      } else {
        chunks.push({ content, index: chunks.length, tokenCount });
      }
    }
  }

  return chunks;
}
