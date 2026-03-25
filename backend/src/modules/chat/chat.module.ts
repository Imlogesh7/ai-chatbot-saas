import { Module } from '@nestjs/common';
import { ChatbotsModule } from '../chatbots/chatbots.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationService } from './conversation.service';
import { RagService } from './rag.service';

@Module({
  imports: [ChatbotsModule],
  controllers: [ChatController],
  providers: [ChatService, ConversationService, RagService],
  exports: [ChatService, ConversationService, RagService],
})
export class ChatModule {}
