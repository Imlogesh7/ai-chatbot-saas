import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService, SimilarityResult } from '../vector-store/vector-store.service';

export const CHAT_MODEL = 'llama-3.3-70b-versatile';
export const MAX_CONTEXT_CHUNKS = 5;
export const MAX_HISTORY_MESSAGES = 20;
export const MIN_SCORE_THRESHOLD = 0.3;
export const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question based ONLY on the following context. If the context does not contain enough information to answer, say so honestly. Do not make up information.`;

export interface RagMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  readonly openai: OpenAI;

  constructor(
    config: ConfigService,
    readonly embeddingService: EmbeddingService,
    readonly vectorStoreService: VectorStoreService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.get<string>('GROQ_API_KEY'),
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generateAnswer(
    query: string,
    chatbotId: string,
    history: RagMessage[],
  ): Promise<{ reply: string; chunks: SimilarityResult[] }> {
    const queryEmbedding = await this.embeddingService.embedSingle(query);

    const chunks = await this.vectorStoreService.similaritySearch(
      queryEmbedding,
      chatbotId,
      MAX_CONTEXT_CHUNKS,
      MIN_SCORE_THRESHOLD,
    );

    this.logger.debug(
      `Retrieved ${chunks.length} context chunks for chatbot ${chatbotId} (top score: ${chunks[0]?.score?.toFixed(3) ?? 'N/A'})`,
    );

    const messages = this.buildPrompt(chunks, history, query);

    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      'I was unable to generate a response.';

    return { reply, chunks };
  }

  buildPrompt(
    chunks: SimilarityResult[],
    history: RagMessage[],
    currentMessage: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const contextBlock =
      chunks.length === 0
        ? 'No relevant context was found in the knowledge base.'
        : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

    return [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n---\nContext:\n${contextBlock}\n---`,
      },
      ...history,
      { role: 'user', content: currentMessage },
    ];
  }
}
