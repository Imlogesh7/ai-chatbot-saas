import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';

const logger = new Logger('PdfExtractor');

export async function extractTextFromPdf(filePath: string): Promise<string> {
  logger.debug(`Extracting text from PDF: ${filePath}`);
  const buffer = fs.readFileSync(filePath);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  return result.text;
}
