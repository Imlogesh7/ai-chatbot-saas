import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Message } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    chatbotId: string,
    title?: string,
  ): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: { userId, chatbotId, title },
    });
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<Conversation & { messages: Message[] }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return conversation;
  }

  async findAllByUserAndChatbot(
    userId: string,
    chatbotId: string,
  ): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { userId, chatbotId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async addMessage(
    conversationId: string,
    role: 'USER' | 'ASSISTANT',
    content: string,
    contextChunks?: object,
  ): Promise<Message> {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          contextChunks: contextChunks ?? undefined,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return message;
  }

  async delete(id: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.conversation.delete({ where: { id } });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async autoTitle(conversationId: string, firstMessage: string): Promise<void> {
    const title = firstMessage.length > 60
      ? firstMessage.slice(0, 57) + '...'
      : firstMessage;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}
