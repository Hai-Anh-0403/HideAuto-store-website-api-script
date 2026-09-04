import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { BrowsePublicScriptsDto } from './dto/browse-public-scripts.dto';
import { PublicScriptDetailDto, PublicScriptPageDto } from './dto/store-script.dto';
import { StoreService } from './store.service';

@ApiTags('Store')
@Controller('api/v1/store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('scripts')
  @ApiOperation({ summary: 'Browse published scripts catalog' })
  @ApiOkResponse({ type: PublicScriptPageDto })
  async browse(@Query() dto: BrowsePublicScriptsDto) {
    return this.storeService.browsePublic(dto);
  }

  @Get('scripts/:slugOrId')
  @ApiOperation({ summary: 'Get a published script by slug or ID' })
  @ApiOkResponse({ type: PublicScriptDetailDto })
  async findOne(@Param('slugOrId') slugOrId: string) {
    return this.storeService.findPublicBySlugOrId(slugOrId);
  }
}
