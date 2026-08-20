import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const SELLER_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export class ListSellersDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SELLER_STATUSES,
    description: 'PENDING is the review queue.',
  })
  @IsOptional()
  @IsIn(SELLER_STATUSES)
  status?: (typeof SELLER_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Matches shop name, email or contact' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
