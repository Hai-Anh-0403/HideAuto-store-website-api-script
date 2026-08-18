import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
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
import { SellersService } from './sellers.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Sellers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard)
@Controller('api/v1/sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current seller profile' })
  async getProfile(@CurrentUser() user: RequestUser) {
    return this.sellersService.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update seller profile' })
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.sellersService.updateProfile(user.id, dto);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'List active sessions' })
  async getSessions(@CurrentUser() user: RequestUser) {
    return this.sellersService.getSessions(user.id);
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a session' })
  async revokeSession(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
  ) {
    await this.sellersService.revokeSession(user.id, sessionId);
  }

  @Delete('me/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all other sessions' })
  async revokeAllSessions(@CurrentUser() user: RequestUser) {
    await this.sellersService.revokeAllOtherSessions(user.id, user.jti);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.sellersService.changePassword(user.id, user.jti, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get seller overview stats' })
  async getStats(@CurrentUser() user: RequestUser) {
    return this.sellersService.getStats(user.id);
  }
}
