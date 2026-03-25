import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { join } from 'path';
import { WidgetService } from './widget.service';
import { WidgetMessageDto } from './dto/widget-message.dto';

@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post('message')
  async message(@Body() dto: WidgetMessageDto) {
    return this.widgetService.handleMessage(dto);
  }

  @SkipThrottle()
  @Get('config')
  async config(@Query('token') token: string) {
    return this.widgetService.getConfig(token);
  }

  @SkipThrottle()
  @Get('script')
  serveScript(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public', 'widget.js'));
  }
}
