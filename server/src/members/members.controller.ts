import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { MembersService } from './members.service';
import { ListMembersDto } from './dto/list-members.dto';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard)
@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List seller members (paginated)' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query() dto: ListMembersDto,
  ) {
    return this.membersService.list(user.id, dto);
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Block a member' })
  async block(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.membersService.block(user.id, id);
  }

  @Patch(':id/unblock')
  @ApiOperation({ summary: 'Unblock a member' })
  async unblock(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.membersService.unblock(user.id, id);
  }
}
