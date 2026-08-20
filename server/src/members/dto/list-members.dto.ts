import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const MEMBER_STATUSES = ['ACTIVE', 'BLOCKED'] as const;
export type MemberStatusFilter = (typeof MEMBER_STATUSES)[number];

export class ListMembersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Matches email, display name or user id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: MEMBER_STATUSES })
  @IsOptional()
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatusFilter;

  @ApiPropertyOptional({
    description: 'true = seen in the last 5 minutes, false = not seen',
  })
  @IsOptional()
  @IsBooleanString()
  online?: string;
}
