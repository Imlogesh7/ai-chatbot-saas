import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Document, DocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatbotsService } from '../chatbots/chatbots.service';
import { IngestWebsiteDto } from './dto/ingest-website.dto';
import { INGESTION_QUEUE, INGESTION_JOBS } from './ingestion.constants';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotsService: ChatbotsService,
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  async ingestPdf(
    userId: string,
    chatbotId: string,
    file: Express.Multer.File,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    await this.chatbotsService.findOneByUser(chatbotId, userId);

    const document = await this.prisma.document.create({
      data: {
        type: DocumentType.PDF,
        fileName: file.originalname,
        fileKey: file.filename,
        chatbotId,
      },
    });

    await this.ingestionQueue.add(
      INGESTION_JOBS.PROCESS_PDF,
      { documentId: document.id, filePath: file.path },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return document;
  }

  async ingestWebsite(
    userId: string,
    dto: IngestWebsiteDto,
  ): Promise<Document> {
    await this.chatbotsService.findOneByUser(dto.chatbotId, userId);

    const document = await this.prisma.document.create({
      data: {
        type: DocumentType.WEBSITE,
        sourceUrl: dto.url,
        chatbotId: dto.chatbotId,
      },
    });

    await this.ingestionQueue.add(
      INGESTION_JOBS.PROCESS_WEBSITE,
      { documentId: document.id, url: dto.url },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return document;
  }

  async findAllByChatbot(
    chatbotId: string,
    userId: string,
  ): Promise<Document[]> {
    await this.chatbotsService.findOneByUser(chatbotId, userId);

    return this.prisma.document.findMany({
      where: { chatbotId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { chatbot: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.chatbot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return document;
  }
}
