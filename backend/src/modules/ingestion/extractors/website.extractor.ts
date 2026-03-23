import { Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

const logger = new Logger('WebsiteExtractor');

const EXCLUDED_TAGS = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'noscript',
  'iframe',
  'svg',
];

export async function extractTextFromUrl(url: string): Promise<string> {
  logger.debug(`Fetching content from URL: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; SaaSBot/1.0; +https://example.com)',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  EXCLUDED_TAGS.forEach((tag) => $(tag).remove());

  const text = $('body').text();

  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
