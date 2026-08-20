import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ListSellersDto } from './dto/list-sellers.dto';
import { SellerDecisionDto } from './dto/seller-decision.dto';
import { RejectVersionDto } from './dto/reject-version.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('sellers')
  @ApiOperation({ summary: 'List sellers (paginated, filterable by status and text)' })
  async listSellers(@Query() dto: ListSellersDto) {
    return this.adminService.listSellers(dto);
  }

  @Patch('sellers/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a seller' })
  async approveSeller(@Param('id') id: string) {
    return this.adminService.approveSeller(id);
  }

  @Patch('sellers/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a seller, with a reason they will see' })
  async rejectSeller(@Param('id') id: string, @Body() dto: SellerDecisionDto) {
    return this.adminService.rejectSeller(id, dto.reason);
  }

  @Patch('sellers/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a seller, with a reason they will see' })
  async suspendSeller(@Param('id') id: string, @Body() dto: SellerDecisionDto) {
    return this.adminService.suspendSeller(id, dto.reason);
  }

  @Get('scripts')
  @ApiOperation({ summary: 'List scripts pending review' })
  async listPendingScripts(@Query() pagination: PaginationDto) {
    return this.adminService.listPendingScripts(pagination);
  }

  @Patch('scripts/versions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a script version' })
  async approveVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.adminService.approveVersion(id, user.id);
  }

  @Patch('scripts/versions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a script version' })
  async rejectVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectVersionDto,
  ) {
    return this.adminService.rejectVersion(id, user.id, dto.reason ?? '');
  }
}
