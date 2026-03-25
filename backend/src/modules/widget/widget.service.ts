import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RagService, MAX_HISTORY_MESSAGES } from '../chat/rag.service';
import { WidgetMessageDto } from './dto/widget-message.dto';

export interface WidgetChatResponse {
  conversationId: string;
  reply: string;
}

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
  ) {}

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
          title:
            dto.message.length > 60
              ? dto.message.slice(0, 57) + '...'
              : dto.message,
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

    const rawHistory = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    const history = rawHistory.slice(-MAX_HISTORY_MESSAGES - 1, -1).map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));

    const { reply, chunks } = await this.ragService.generateAnswer(
      dto.message,
      chatbot.id,
      history,
    );

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
}
