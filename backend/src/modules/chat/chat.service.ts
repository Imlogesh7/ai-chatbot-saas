import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService, SimilarityResult } from '../vector-store/vector-store.service';
import { ChatbotsService } from '../chatbots/chatbots.service';
import { ConversationService } from './conversation.service';
import { SendMessageDto } from './dto/send-message.dto';

const CHAT_MODEL = 'llama-3.3-70b-versatile';
const MAX_CONTEXT_CHUNKS = 5;
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's question based ONLY on the following context. If the context does not contain enough information to answer, say so honestly. Do not make up information.`;

export interface ChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'ASSISTANT';
    content: string;
    createdAt: Date;
  };
  contextUsed: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai: OpenAI;

  constructor(
    config: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly chatbotsService: ChatbotsService,
    private readonly conversationService: ConversationService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.get<string>('GROQ_API_KEY'),
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<ChatResponse> {
    await this.chatbotsService.findOneByUser(dto.chatbotId, userId);

    let conversationId = dto.conversationId;
    let isNewConversation = false;

    if (!conversationId) {
      const conversation = await this.conversationService.create(
        userId,
        dto.chatbotId,
      );
      conversationId = conversation.id;
      isNewConversation = true;
    } else {
      await this.conversationService.findById(conversationId, userId);
    }

    await this.conversationService.addMessage(
      conversationId,
      'USER',
      dto.message,
    );

    if (isNewConversation) {
      await this.conversationService.autoTitle(conversationId, dto.message);
    }

    this.logger.debug(
      `Generating embedding for query in chatbot ${dto.chatbotId}`,
    );
    const queryEmbedding = await this.embeddingService.embedSingle(dto.message);

    const relevantChunks = await this.vectorStoreService.similaritySearch(
      queryEmbedding,
      dto.chatbotId,
      MAX_CONTEXT_CHUNKS,
    );

    this.logger.debug(
      `Retrieved ${relevantChunks.length} context chunks (top score: ${relevantChunks[0]?.score?.toFixed(3) ?? 'N/A'})`,
    );

    const history = await this.getConversationHistory(conversationId);
    const messages = this.buildPrompt(relevantChunks, history, dto.message);

    this.logger.debug(`Calling OpenAI chat completion (${CHAT_MODEL})`);
    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const assistantContent =
      completion.choices[0]?.message?.content?.trim() ??
      'I was unable to generate a response.';

    const contextMeta = relevantChunks.map((c) => ({
      chunkId: c.id,
      documentId: c.documentId,
      score: c.score,
    }));

    const assistantMessage = await this.conversationService.addMessage(
      conversationId,
      'ASSISTANT',
      assistantContent,
      contextMeta,
    );

    return {
      conversationId,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: assistantContent,
        createdAt: assistantMessage.createdAt,
      },
      contextUsed: relevantChunks.length,
    };
  }

  private buildPrompt(
    chunks: SimilarityResult[],
    history: { role: 'user' | 'assistant'; content: string }[],
    currentMessage: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    let contextBlock: string;

    if (chunks.length === 0) {
      contextBlock = 'No relevant context was found in the knowledge base.';
    } else {
      contextBlock = chunks
        .map((c, i) => `[${i + 1}] ${c.content}`)
        .join('\n\n');
    }

    const systemContent = `${SYSTEM_PROMPT}\n\n---\nContext:\n${contextBlock}\n---`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: currentMessage },
    ];

    return messages;
  }

  private async getConversationHistory(
    conversationId: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const messages = await this.conversationService.getMessages(conversationId);

    // Exclude the last message (the one we just inserted) and take recent history
    const history = messages.slice(-MAX_HISTORY_MESSAGES - 1, -1);

    return history.map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
  }
}
