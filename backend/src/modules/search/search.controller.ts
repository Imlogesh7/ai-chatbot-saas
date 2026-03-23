import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchQueryDto,
  ) {
    return this.searchService.search(
      userId,
      dto.query,
      dto.chatbotId,
      dto.limit,
      dto.minScore,
    );
  }
}
