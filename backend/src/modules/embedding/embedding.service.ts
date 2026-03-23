import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const EMBEDDING_MODEL = 'nomic-embed-text';
export const EMBEDDING_DIMENSIONS = 768;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;

  constructor(config: ConfigService) {
    this.ollamaUrl = config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  async onModuleInit() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const models = data.models?.map((m: any) => m.name) ?? [];
      const hasModel = models.some((n: string) => n.startsWith(EMBEDDING_MODEL));
      if (!hasModel) {
        this.logger.warn(
          `Ollama model "${EMBEDDING_MODEL}" not found. Run: ollama pull ${EMBEDDING_MODEL}`,
        );
      } else {
        this.logger.log(`Ollama embedding model "${EMBEDDING_MODEL}" is available`);
      }
    } catch {
      this.logger.warn(
        `Cannot reach Ollama at ${this.ollamaUrl} — embedding calls will fail. Start Ollama with: brew services start ollama`,
      );
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    const sanitized = this.sanitize(text);
    return this.callWithRetry(sanitized);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const sanitized = this.sanitize(texts[i]);

      if (i > 0 && i % 10 === 0) {
        this.logger.debug(`Embedding progress: ${i}/${texts.length}`);
      }

      const embedding = await this.callWithRetry(sanitized);
      results.push(embedding);
    }

    this.logger.debug(`Embedded ${results.length} texts via Ollama`);
    return results;
  }

  private sanitize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async callWithRetry(input: string): Promise<number[]> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.ollamaUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input,
          }),
        });

        if (!res.ok) {
          throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        return data.embeddings[0];
      } catch (error: any) {
        if (attempt === MAX_RETRIES) {
          this.logger.error(
            `Ollama embedding failed after ${attempt} attempt(s): ${error.message}`,
          );
          throw error;
        }

        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Ollama embedding attempt ${attempt} failed, retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Unreachable');
  }
}
