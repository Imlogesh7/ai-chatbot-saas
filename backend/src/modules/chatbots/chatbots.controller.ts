import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatbotsService } from './chatbots.service';
import { CreateChatbotDto } from './dto/create-chatbot.dto';

@Controller('chatbots')
@UseGuards(JwtAuthGuard)
export class ChatbotsController {
  constructor(private readonly chatbotsService: ChatbotsService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChatbotDto,
  ) {
    return this.chatbotsService.create(userId, dto);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.chatbotsService.findAllByUser(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatbotsService.findOneByUser(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.chatbotsService.remove(id, userId);
  }
}
