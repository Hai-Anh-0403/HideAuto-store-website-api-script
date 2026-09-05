import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { BrowsePublicScriptsDto } from './dto/browse-public-scripts.dto';
import { PublicScriptDetailDto, PublicScriptPageDto } from './dto/store-script.dto';
import { StoreService } from './store.service';
import { BrowsePublicSellersDto } from './dto/browse-public-sellers.dto';
import { PublicMarketplaceSellerDto, PublicMarketplaceSellerPageDto } from './dto/store-seller.dto';

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

  @Get('tags')
  @ApiOperation({ summary: 'List public store tags' })
  async tags() {
    return this.storeService.publicTags();
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Browse approved marketplace sellers' })
  @ApiOkResponse({ type: PublicMarketplaceSellerPageDto })
  async browseSellers(@Query() dto: BrowsePublicSellersDto) {
    return this.storeService.browsePublicSellers(dto);
  }

  @Get('sellers/:slugOrId')
  @ApiOperation({ summary: 'Get an approved marketplace seller by slug or ID' })
  @ApiOkResponse({ type: PublicMarketplaceSellerDto })
  async findSeller(@Param('slugOrId') slugOrId: string) {
    return this.storeService.findPublicSellerBySlugOrId(slugOrId);
  }
}

