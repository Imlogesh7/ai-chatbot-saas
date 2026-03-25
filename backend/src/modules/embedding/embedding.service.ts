import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const EMBEDDING_DIMENSIONS = 768;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

type EmbeddingProvider = 'ollama' | 'huggingface';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private provider: EmbeddingProvider = 'ollama';

  private readonly ollamaModel = 'nomic-embed-text';
  private readonly hfModel = 'sentence-transformers/all-MiniLM-L6-v2';
  private readonly hfUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction';

  constructor(config: ConfigService) {
    this.ollamaUrl = config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  async onModuleInit() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const models = data.models?.map((m: any) => m.name) ?? [];
      if (models.some((n: string) => n.startsWith(this.ollamaModel))) {
        this.provider = 'ollama';
        this.logger.log(`Using Ollama "${this.ollamaModel}" for embeddings (local)`);
        return;
      }
    } catch {}

    this.provider = 'huggingface';
    this.logger.log(`Ollama unavailable — using HuggingFace "${this.hfModel}" for embeddings (cloud, free)`);
  }

  async embedSingle(text: string): Promise<number[]> {
    return this.callWithRetry(this.sanitize(text));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const BATCH_CONCURRENCY = 8;
    const results: number[][] = new Array(texts.length);

    for (let i = 0; i < texts.length; i += BATCH_CONCURRENCY) {
      const batchIndices = Array.from(
        { length: Math.min(BATCH_CONCURRENCY, texts.length - i) },
        (_, j) => i + j,
      );
      this.logger.debug(`Embedding batch ${i}–${i + batchIndices.length - 1} of ${texts.length}`);
      await Promise.all(
        batchIndices.map(async (idx) => {
          results[idx] = await this.callWithRetry(this.sanitize(texts[idx]));
        }),
      );
    }

    this.logger.debug(`Embedded ${results.length} texts via ${this.provider}`);
    return results;
  }

  private sanitize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async callWithRetry(input: string): Promise<number[]> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (this.provider === 'ollama') {
          return await this.embedViaOllama(input);
        } else {
          return await this.embedViaHuggingFace(input);
        }
      } catch (error: any) {
        if (attempt === MAX_RETRIES) {
          this.logger.error(`Embedding failed after ${attempt} attempts: ${error.message}`);
          throw error;
        }
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(`Embedding attempt ${attempt} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  }

  private async embedViaOllama(input: string): Promise<number[]> {
    const res = await fetch(`${this.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.ollamaModel, input }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.embeddings[0];
  }

  private async embedViaHuggingFace(input: string): Promise<number[]> {
    const res = await fetch(`${this.hfUrl}/${this.hfModel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: input, options: { wait_for_model: true } }),
    });
    if (!res.ok) throw new Error(`HuggingFace returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return Array.isArray(data[0]) ? data[0] : data;
  }
}
