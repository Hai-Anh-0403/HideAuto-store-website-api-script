import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrowsePublicScriptsDto } from './dto/browse-public-scripts.dto';
import { PublicScriptDetailDto, PublicScriptPageDto } from './dto/store-script.dto';
import { StoreService } from './store.service';

@ApiTags('Mongo Store (experimental)')
@Controller('api/v1/store')
export class MongoStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('scripts')
  @ApiOperation({ summary: 'Browse published MongoDB scripts' })
  @ApiOkResponse({ type: PublicScriptPageDto })
  browse(@Query() dto: BrowsePublicScriptsDto) {
    return this.storeService.browsePublic(dto);
  }

  @Get('scripts/:slugOrId')
  @ApiOperation({ summary: 'Get a published MongoDB script' })
  @ApiOkResponse({ type: PublicScriptDetailDto })
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.storeService.findPublicBySlugOrId(slugOrId);
  }
}
