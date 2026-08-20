import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { KeysService } from './keys.service';
import { CreateKeysDto } from './dto/create-keys.dto';
import { ListKeysDto } from './dto/list-keys.dto';
import { UpdateKeyDto } from './dto/update-key.dto';

@ApiTags('Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get()
  @ApiOperation({
    summary: 'List keys (paginated, filterable by mini app, state and text)',
  })
  async list(@CurrentUser() user: RequestUser, @Query() dto: ListKeysDto) {
    return this.keysService.list(user.id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Key counts by state across the whole shop' })
  async stats(@CurrentUser() user: RequestUser) {
    return this.keysService.stats(user.id);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="keys.csv"')
  @ApiOperation({
    summary:
      'Download the current filter as a CSV sheet (capped; X-Export-Truncated says when it hit the cap)',
  })
  async exportCsv(
    @CurrentUser() user: RequestUser,
    @Query() dto: ListKeysDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { csv, truncated } = await this.keysService.exportCsv(user.id, dto);
    res.setHeader('X-Export-Truncated', truncated ? 'true' : 'false');
    return csv;
  }

  @Get(':id/redemptions')
  @ApiOperation({ summary: 'Buyers who redeemed this key' })
  async redemptions(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.keysService.redemptions(user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Issue one key, or a batch. Omit scriptId for a shop-wide key that unlocks every app.',
  })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateKeysDto) {
    return this.keysService.create(user.id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a key label, usage limit or expiry' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateKeyDto,
  ) {
    return this.keysService.update(user.id, id, dto);
  }

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop this key from being redeemed again' })
  async revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.keysService.revoke(user.id, id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo a revoke and let the key be redeemed again' })
  async restore(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.keysService.restore(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a key that was never redeemed' })
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.keysService.remove(user.id, id);
  }
}
