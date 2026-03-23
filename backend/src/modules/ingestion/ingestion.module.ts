import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatbotsModule } from '../chatbots/chatbots.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './ingestion.processor';
import { INGESTION_QUEUE } from './ingestion.constants';

@Module({
  imports: [
    ChatbotsModule,
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionProcessor],
  exports: [IngestionService],
})
export class IngestionModule {}
