import { IsNotEmpty, IsString, IsUUID, IsUrl } from 'class-validator';

export class IngestWebsiteDto {
  @IsUUID()
  @IsNotEmpty()
  chatbotId: string;

  @IsUrl({ require_protocol: true })
  @IsString()
  @IsNotEmpty()
  url: string;
}
