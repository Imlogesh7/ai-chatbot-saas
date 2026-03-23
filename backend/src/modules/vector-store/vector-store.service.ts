import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TextChunk } from '../ingestion/chunker';

export interface SimilarityResult {
  id: string;
  content: string;
  score: number;
  chunkIndex: number;
  tokenCount: number;
  documentId: string;
}

const HNSW_INDEX_NAME = 'document_chunks_embedding_idx';
const MIN_SCORE_THRESHOLD = 0.3;

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureExtension();
    await this.ensureIndex();
  }

  private async ensureExtension(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        'CREATE EXTENSION IF NOT EXISTS vector',
      );
      this.logger.log('pgvector extension verified');
    } catch (error) {
      this.logger.warn(
        'Could not create pgvector extension — it may already exist or require superuser. ' +
          'Ensure it is installed on your database.',
      );
    }
  }

  private async ensureIndex(): Promise<void> {
    try {
      const existing = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = $1`,
        HNSW_INDEX_NAME,
      );

      if (Number(existing[0]?.count) > 0) {
        this.logger.debug('HNSW vector index already exists');
        return;
      }

      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${HNSW_INDEX_NAME}
         ON document_chunks
         USING hnsw (embedding vector_cosine_ops)
         WITH (m = 16, ef_construction = 64)`,
      );

      this.logger.log('Created HNSW vector index for cosine similarity');
    } catch (error) {
      this.logger.warn(
        'Could not create HNSW index — table may not exist yet. ' +
          'Run migrations first, then restart.',
      );
    }
  }

  async storeChunks(
    documentId: string,
    chunks: TextChunk[],
    embeddings: number[][],
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `Chunk/embedding count mismatch: ${chunks.length} chunks, ${embeddings.length} embeddings`,
      );
    }

    this.logger.debug(
      `Storing ${chunks.length} chunks for document ${documentId}`,
    );

    const batchSize = 50;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      await this.prisma.$transaction(
        batchChunks.map((chunk, j) => {
          const vectorStr = `[${batchEmbeddings[j].join(',')}]`;

          return this.prisma.$executeRawUnsafe(
            `INSERT INTO document_chunks (id, content, chunk_index, token_count, embedding, document_id, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, NOW())`,
            chunk.content,
            chunk.index,
            chunk.tokenCount,
            vectorStr,
            documentId,
          );
        }),
      );
    }

    this.logger.debug(
      `Stored ${chunks.length} chunks for document ${documentId}`,
    );
  }

  async similaritySearch(
    queryEmbedding: number[],
    chatbotId: string,
    limit = 5,
    minScore = MIN_SCORE_THRESHOLD,
  ): Promise<SimilarityResult[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        content: string;
        score: number;
        chunk_index: number;
        token_count: number;
        document_id: string;
      }[]
    >(
      `SELECT
         dc.id,
         dc.content,
         dc.chunk_index,
         dc.token_count,
         dc.document_id,
         1 - (dc.embedding <=> $1::vector) AS score
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE d.chatbot_id = $2
         AND d.status = 'COMPLETED'
         AND dc.embedding IS NOT NULL
         AND 1 - (dc.embedding <=> $1::vector) >= $3
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $4`,
      vectorStr,
      chatbotId,
      minScore,
      limit,
    );

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: Number(r.score),
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      documentId: r.document_id,
    }));
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM document_chunks WHERE document_id = $1`,
      documentId,
    );

    this.logger.debug(`Deleted chunks for document ${documentId}`);
  }
}
