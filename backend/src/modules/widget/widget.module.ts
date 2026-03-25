import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({
  imports: [ChatModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
