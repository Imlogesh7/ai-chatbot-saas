import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService, SimilarityResult } from '../vector-store/vector-store.service';
import { WidgetMessageDto } from './dto/widget-message.dto';

const CHAT_MODEL = 'llama-3.3-70b-versatile';
const MAX_CONTEXT_CHUNKS = 5;
const MAX_HISTORY_MESSAGES = 10;

const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question based ONLY on the following context. If the context does not contain enough information to answer, say so honestly. Do not make up information.`;

export interface WidgetChatResponse {
  conversationId: string;
  reply: string;
}

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);
  private readonly openai: OpenAI;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.get<string>('GROQ_API_KEY'),
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async handleMessage(dto: WidgetMessageDto): Promise<WidgetChatResponse> {
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { publicToken: dto.token },
    });

    if (!chatbot) {
      throw new NotFoundException('Invalid widget token');
    }

    let conversationId = dto.conversationId;

    if (!conversationId) {
      const conversation = await this.prisma.conversation.create({
        data: {
          chatbotId: chatbot.id,
          visitorId: dto.visitorId,
          title: dto.message.length > 60 ? dto.message.slice(0, 57) + '...' : dto.message,
        },
      });
      conversationId = conversation.id;
    } else {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!existing || existing.visitorId !== dto.visitorId) {
        throw new NotFoundException('Conversation not found');
      }
    }

    await this.prisma.message.create({
      data: { conversationId, role: 'USER', content: dto.message },
    });

    const queryEmbedding = await this.embeddingService.embedSingle(dto.message);

    const chunks = await this.vectorStoreService.similaritySearch(
      queryEmbedding,
      chatbot.id,
      MAX_CONTEXT_CHUNKS,
    );

    const history = await this.getHistory(conversationId);
    const messages = this.buildPrompt(chunks, history, dto.message);

    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      'I was unable to generate a response.';

    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: reply,
        contextChunks: chunks.map((c) => ({ chunkId: c.id, score: c.score })),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return { conversationId, reply };
  }

  async getConfig(token: string) {
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { publicToken: token },
      select: { name: true, description: true },
    });

    if (!chatbot) {
      throw new NotFoundException('Invalid widget token');
    }

    return { name: chatbot.name, description: chatbot.description };
  }

  private async getHistory(
    conversationId: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.slice(-MAX_HISTORY_MESSAGES - 1, -1).map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
  }

  private buildPrompt(
    chunks: SimilarityResult[],
    history: { role: 'user' | 'assistant'; content: string }[],
    currentMessage: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const contextBlock =
      chunks.length === 0
        ? 'No relevant context was found in the knowledge base.'
        : chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

    return [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n---\nContext:\n${contextBlock}\n---` },
      ...history,
      { role: 'user', content: currentMessage },
    ];
  }
}
