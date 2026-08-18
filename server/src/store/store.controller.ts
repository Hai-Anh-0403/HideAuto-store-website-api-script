import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { BrowseScriptsDto } from './dto/browse-scripts.dto';

@ApiTags('Store')
@Controller('api/v1/store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('scripts')
  @ApiOperation({ summary: 'Browse published scripts catalog' })
  async browse(@Query() dto: BrowseScriptsDto) {
    return this.storeService.browse(dto);
  }

  @Get('scripts/:slugOrId')
  @ApiOperation({ summary: 'Get a published script by slug or ID' })
  async findOne(@Param('slugOrId') slugOrId: string) {
    return this.storeService.findBySlugOrId(slugOrId);
  }
}
