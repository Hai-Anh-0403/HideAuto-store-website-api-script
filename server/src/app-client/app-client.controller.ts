/**
 * End-user surface: the desktop app and packaged mini apps.
 *
 * Authenticated with a **flowdesk** token, never a store JWT — see `AppAuthGuard`.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AppAuthGuard } from './app-auth.guard';
import { CurrentBuyer } from './current-buyer.decorator';
import type { BuyerIdentity } from './flowdesk.service';
import { ActivationService } from './activation.service';
import { AppDownloadService } from './app-download.service';
import { LicenseRequestDto } from './dto/license-request.dto';
import { RedeemKeyDto } from './dto/redeem-key.dto';

@ApiTags('App (end user)')
@ApiBearerAuth()
@UseGuards(AppAuthGuard, RateLimitGuard)
@Controller('api/v1/app')
export class AppClientController {
  constructor(
    private readonly activation: ActivationService,
    private readonly downloads: AppDownloadService,
  ) {}

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report presence so sellers see who is active' })
  async heartbeat(@CurrentBuyer() buyer: BuyerIdentity) {
    const memberships = await this.activation.touch(buyer);
    return { userId: buyer.id, memberships, seenAt: new Date().toISOString() };
  }

  @Post('keys/redeem')
  @HttpCode(HttpStatus.CREATED)
  // A wrong key is indistinguishable from a wrong guess: throttle so the key space cannot
  // be walked. Keyed on the code being tried as well as the caller, because buyers behind
  // one corporate address must not throttle each other.
  @RateLimit({
    limit: 10,
    windowMs: 60_000,
    subjectField: 'key',
    clientLimit: 60,
  })
  @ApiOperation({ summary: 'Redeem a key to unlock a mini app' })
  async redeem(
    @CurrentBuyer() buyer: BuyerIdentity,
    @Body() dto: RedeemKeyDto,
  ) {
    return this.activation.redeem(buyer, dto.key);
  }

  @Get('scripts')
  @ApiOperation({ summary: 'Mini apps I have unlocked' })
  async myScripts(@CurrentBuyer() buyer: BuyerIdentity) {
    return this.activation.entitledScripts(buyer);
  }

  @Post('scripts/:scriptId/license')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 60, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Activate a packaged mini app on this machine and get a signed licence',
  })
  async license(
    @CurrentBuyer() buyer: BuyerIdentity,
    @Param('scriptId') scriptId: string,
    @Body() dto: LicenseRequestDto,
  ) {
    return this.activation.activate(buyer, scriptId, dto.machine_id, dto.key);
  }

  @Get('scripts/:scriptId/download')
  @ApiOperation({ summary: 'Download a mini app I have unlocked' })
  @ApiQuery({ name: 'format', enum: ['exe', 'graph'], required: false })
  async download(
    @CurrentBuyer() buyer: BuyerIdentity,
    @Param('scriptId') scriptId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const { filename, body, contentType } = await this.downloads.forBuyer(
      buyer,
      scriptId,
      format === 'graph' ? 'graph' : 'exe',
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(body);
  }
}
