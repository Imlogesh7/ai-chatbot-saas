import { IsNotEmpty, IsUUID } from 'class-validator';

export class IngestPdfDto {
  @IsUUID()
  @IsNotEmpty()
  chatbotId: string;
}
