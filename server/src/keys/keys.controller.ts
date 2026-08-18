import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { KeysService } from './keys.service';
import { CreateKeyDto } from './dto/create-key.dto';
import { ListKeysDto } from './dto/list-keys.dto';

@ApiTags('Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard)
@Controller('api/v1/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get()
  @ApiOperation({ summary: 'List all seller keys (paginated)' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query() dto: ListKeysDto,
  ) {
    return this.keysService.list(user.id, dto);
  }

  @Post('scripts/:scriptId/keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a key for a script' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('scriptId') scriptId: string,
    @Body() dto: CreateKeyDto,
  ) {
    return this.keysService.create(user.id, scriptId, dto);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke a key' })
  async revoke(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.keysService.revoke(user.id, id);
  }
}
