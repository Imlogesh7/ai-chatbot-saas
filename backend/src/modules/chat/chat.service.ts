import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { ChatbotsService } from '../chatbots/chatbots.service';
import { ConversationService } from './conversation.service';
import { RagService, MAX_HISTORY_MESSAGES } from './rag.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from '@prisma/client';

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

  constructor(
    private readonly ragService: RagService,
    private readonly chatbotsService: ChatbotsService,
    private readonly conversationService: ConversationService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto): Promise<ChatResponse> {
    await this.chatbotsService.findOneByUser(dto.chatbotId, userId);

    let conversationId = dto.conversationId;
    let isNewConversation = false;

    if (!conversationId) {
      const conversation = await this.conversationService.create(userId, dto.chatbotId);
      conversationId = conversation.id;
      isNewConversation = true;
    } else {
      await this.conversationService.findById(conversationId, userId);
    }

    await this.conversationService.addMessage(conversationId, 'USER', dto.message);

    if (isNewConversation) {
      await this.conversationService.autoTitle(conversationId, dto.message);
    }

    const history = await this.getConversationHistory(conversationId);

    const { reply, chunks } = await this.ragService.generateAnswer(
      dto.message,
      dto.chatbotId,
      history,
    );

    const contextMeta = chunks.map((c) => ({
      chunkId: c.id,
      documentId: c.documentId,
      score: c.score,
    }));

    const assistantMessage = await this.conversationService.addMessage(
      conversationId,
      'ASSISTANT',
      reply,
      contextMeta,
    );

    return {
      conversationId,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT',
        content: reply,
        createdAt: assistantMessage.createdAt,
      },
      contextUsed: chunks.length,
    };
  }

  private async getConversationHistory(
    conversationId: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const messages = await this.conversationService.getMessages(conversationId);
    const history = messages.slice(-MAX_HISTORY_MESSAGES - 1, -1);
    return history.map((m: Message) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
  }
}
