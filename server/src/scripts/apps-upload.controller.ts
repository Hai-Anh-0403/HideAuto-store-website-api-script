import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { ScriptsService } from './scripts.service';
import { UploadMiniAppDto } from './dto/upload-mini-app.dto';

/**
 * Manager-compatible entry: `POST /api/apps/upload`.
 *
 * Seller JWT (APPROVED). Paths: `POST /api/v1/apps/upload` (portal) and
 * `POST /api/apps/upload` (Manager-compatible alias). Unwrap / persist:
 * `docs/mini-app-upload-server.md`.
 */
const UPLOAD_LIMITS = { limits: { fileSize: 128 * 1024 * 1024, files: 1 } };

@ApiTags('Mini-app upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller(['api/v1/apps', 'api/apps'])
export class AppsUploadController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unwrap a .haup, store the exe+icon, upsert the seller listing',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async upload(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadMiniAppDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.scriptsService.uploadMiniApp(user.id, dto, file);
  }
}
