import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IngestionService } from './ingestion.service';
import { IngestPdfDto } from './dto/ingest-pdf.dto';
import { IngestWebsiteDto } from './dto/ingest-website.dto';

const pdfStorage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const uniqueName = `${uuid()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const pdfFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) => {
  if (file.mimetype !== 'application/pdf') {
    cb(new Error('Only PDF files are allowed'), false);
    return;
  }
  cb(null, true);
};

@Controller('ingestion')
@UseGuards(JwtAuthGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: pdfStorage,
      fileFilter: pdfFileFilter,
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadPdf(
    @CurrentUser('id') userId: string,
    @Body() dto: IngestPdfDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ingestionService.ingestPdf(userId, dto.chatbotId, file);
  }

  @Post('website')
  async submitWebsite(
    @CurrentUser('id') userId: string,
    @Body() dto: IngestWebsiteDto,
  ) {
    return this.ingestionService.ingestWebsite(userId, dto);
  }

  @Get('chatbot/:chatbotId')
  async listDocuments(
    @CurrentUser('id') userId: string,
    @Param('chatbotId', ParseUUIDPipe) chatbotId: string,
  ) {
    return this.ingestionService.findAllByChatbot(chatbotId, userId);
  }

  @Get(':id')
  async getDocument(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ingestionService.findOne(id, userId);
  }
}
