import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const PUBLIC_SELLER_SORTS = ['popular'] as const;
export type PublicSellerSort = (typeof PUBLIC_SELLER_SORTS)[number];

/** Anonymous storefront query; deliberately separate from portal seller DTOs. */
export class BrowsePublicSellersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PUBLIC_SELLER_SORTS, default: 'popular' })
  @IsOptional()
  @IsEnum(PUBLIC_SELLER_SORTS)
  sort: PublicSellerSort = 'popular';
}
