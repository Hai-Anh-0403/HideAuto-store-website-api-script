import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { MembersService } from './members.service';
import { ListMembersDto } from './dto/list-members.dto';
import { UpdateAccessDto } from './dto/update-access.dto';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({
    summary: 'List buyers (paginated, filterable by text, status and presence)',
  })
  async list(@CurrentUser() user: RequestUser, @Query() dto: ListMembersDto) {
    return this.membersService.list(user.id, dto);
  }

  @Get(':id/devices')
  @ApiOperation({ summary: 'Machines this buyer has activated on' })
  async devices(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.membersService.devices(user.id, id);
  }

  @Patch(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant or take back access to individual mini apps' })
  async updateAccess(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccessDto,
  ) {
    return this.membersService.updateAccess(user.id, id, dto);
  }

  @Patch(':id/devices/:machineId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop issuing licences to this machine' })
  async blockDevice(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('machineId') machineId: string,
  ) {
    return this.membersService.setDeviceBlocked(user.id, id, machineId, true);
  }

  @Patch(':id/devices/:machineId/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Let this machine get licences again' })
  async unblockDevice(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('machineId') machineId: string,
  ) {
    return this.membersService.setDeviceBlocked(user.id, id, machineId, false);
  }

  @Patch(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block this buyer from every app of this seller' })
  async block(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.membersService.block(user.id, id);
  }

  @Patch(':id/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock this buyer' })
  async unblock(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.membersService.unblock(user.id, id);
  }
}
