import { Body, Controller, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MongoAdminService } from './mongo-admin.service';
import { RejectVersionDto } from '../admin/dto/reject-version.dto';
@ApiTags('Mongo Admin (experimental)') @ApiBearerAuth() @UseGuards(JwtAuthGuard, AdminAuthGuard) @Controller('api/v1/admin/scripts/versions')
export class MongoAdminController { constructor(private readonly admin: MongoAdminService) {} @Patch(':id/approve') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Approve a MongoDB script version' }) approve(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.admin.approve(id, user.id); } @Patch(':id/reject') @HttpCode(HttpStatus.OK) reject(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RejectVersionDto) { return this.admin.reject(id, user.id, dto.reason ?? 'Rejected by admin'); } }
