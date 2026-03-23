import { Module } from '@nestjs/common';
import { ChatbotsModule } from '../chatbots/chatbots.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ChatbotsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
