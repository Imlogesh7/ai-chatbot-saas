import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import {
  VectorStoreService,
  SimilarityResult,
} from '../vector-store/vector-store.service';
import { ChatbotsService } from '../chatbots/chatbots.service';

export interface SearchResult {
  results: SimilarityResult[];
  query: string;
  chatbotId: string;
  totalResults: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly chatbotsService: ChatbotsService,
  ) {}

  async search(
    userId: string,
    query: string,
    chatbotId: string,
    limit = 5,
    minScore?: number,
  ): Promise<SearchResult> {
    await this.chatbotsService.findOneByUser(chatbotId, userId);

    this.logger.debug(
      `Searching chatbot ${chatbotId} for: "${query.slice(0, 80)}"`,
    );

    const queryEmbedding = await this.embeddingService.embedSingle(query);

    const results = await this.vectorStoreService.similaritySearch(
      queryEmbedding,
      chatbotId,
      limit,
      minScore,
    );

    this.logger.debug(
      `Found ${results.length} results for chatbot ${chatbotId}`,
    );

    return {
      results,
      query,
      chatbotId,
      totalResults: results.length,
    };
  }
}
