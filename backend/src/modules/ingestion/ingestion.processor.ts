import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { extractTextFromPdf } from './extractors/pdf.extractor';
import { extractTextFromUrl } from './extractors/website.extractor';
import { chunkText } from './chunker';
import { INGESTION_QUEUE, INGESTION_JOBS } from './ingestion.constants';

interface PdfJobData {
  documentId: string;
  filePath: string;
}

interface WebsiteJobData {
  documentId: string;
  url: string;
}

@Processor(INGESTION_QUEUE, { concurrency: 3 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
  ) {
    super();
  }

  async process(job: Job<PdfJobData | WebsiteJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id} [${job.name}]`);

    const { documentId } = job.data;

    try {
      const rawText = await this.extractText(job);

      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No text could be extracted from the source');
      }

      await job.updateProgress(20);

      const chunks = chunkText(rawText);
      this.logger.log(
        `Document ${documentId}: extracted ${chunks.length} chunks`,
      );

      if (chunks.length === 0) {
        throw new Error('Text produced zero chunks after splitting');
      }

      await job.updateProgress(40);

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingService.embedBatch(chunkTexts);
      this.logger.log(`Document ${documentId}: generated ${embeddings.length} embeddings`);

      await job.updateProgress(70);

      await this.vectorStoreService.storeChunks(documentId, chunks, embeddings);

      await job.updateProgress(90);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.COMPLETED },
      });

      await job.updateProgress(100);
      this.logger.log(`Document ${documentId}: processing completed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Document ${documentId} failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          error: message.slice(0, 1000),
        },
      });

      throw error;
    }
  }

  private async extractText(
    job: Job<PdfJobData | WebsiteJobData>,
  ): Promise<string> {
    switch (job.name) {
      case INGESTION_JOBS.PROCESS_PDF: {
        const { filePath } = job.data as PdfJobData;
        return extractTextFromPdf(filePath);
      }
      case INGESTION_JOBS.PROCESS_WEBSITE: {
        const { url } = job.data as WebsiteJobData;
        return extractTextFromUrl(url);
      }
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }
}
