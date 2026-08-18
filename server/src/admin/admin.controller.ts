import {
  Controller,
  Get,
  Patch,
  Body,
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
import { RejectVersionDto } from './dto/reject-version.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('sellers')
  @ApiOperation({ summary: 'List all sellers (paginated)' })
  async listSellers(@Query() pagination: PaginationDto) {
    return this.adminService.listSellers(pagination);
  }

  @Patch('sellers/:id/approve')
  @ApiOperation({ summary: 'Approve a seller' })
  async approveSeller(@Param('id') id: string) {
    return this.adminService.approveSeller(id);
  }

  @Patch('sellers/:id/reject')
  @ApiOperation({ summary: 'Reject a seller' })
  async rejectSeller(@Param('id') id: string) {
    return this.adminService.rejectSeller(id);
  }

  @Patch('sellers/:id/suspend')
  @ApiOperation({ summary: 'Suspend a seller' })
  async suspendSeller(@Param('id') id: string) {
    return this.adminService.suspendSeller(id);
  }

  @Get('scripts')
  @ApiOperation({ summary: 'List scripts pending review' })
  async listPendingScripts(@Query() pagination: PaginationDto) {
    return this.adminService.listPendingScripts(pagination);
  }

  @Patch('scripts/versions/:id/approve')
  @ApiOperation({ summary: 'Approve a script version' })
  async approveVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.adminService.approveVersion(id, user.id);
  }

  @Patch('scripts/versions/:id/reject')
  @ApiOperation({ summary: 'Reject a script version' })
  async rejectVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectVersionDto,
  ) {
    return this.adminService.rejectVersion(id, user.id, dto.reason ?? '');
  }
}
