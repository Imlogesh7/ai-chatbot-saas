import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsUUID()
  @IsNotEmpty()
  chatbotId: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;
}
