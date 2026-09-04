import { Body, Controller, HttpCode, HttpStatus, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { CreateScriptDto } from '../scripts/dto/create-script.dto';
import { MongoScriptsService } from './mongo-scripts.service';

@ApiTags('Mongo Scripts (experimental)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/scripts')
export class MongoScriptsController {
  constructor(private readonly scripts: MongoScriptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft script in MongoDB' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateScriptDto) {
    return this.scripts.create(user.id, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a MongoDB script for review' })
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.scripts.submit(user.id, id);
  }

  @Post(':id/graph')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadGraph(@CurrentUser() user: RequestUser, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.scripts.uploadGraph(user.id, id, file)
  }
}
