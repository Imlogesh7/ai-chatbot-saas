import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Chatbot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChatbotDto } from './dto/create-chatbot.dto';

@Injectable()
export class ChatbotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateChatbotDto): Promise<Chatbot> {
    return this.prisma.chatbot.create({
      data: {
        name: dto.name,
        description: dto.description,
        userId,
      },
    });
  }

  async findAllByUser(userId: string, page = 1, limit = 20): Promise<{ data: Chatbot[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.chatbot.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 100),
      }),
      this.prisma.chatbot.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  async findOneByUser(id: string, userId: string): Promise<Chatbot> {
    const chatbot = await this.prisma.chatbot.findUnique({ where: { id } });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    if (chatbot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return chatbot;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneByUser(id, userId);
    await this.prisma.chatbot.delete({ where: { id } });
  }
}
