import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const PUBLIC_SCRIPT_SORTS = [
  'popular',
  'newest',
  'updated',
  'views',
  'price_asc',
  'price_desc',
] as const;

export type PublicScriptSort = (typeof PUBLIC_SCRIPT_SORTS)[number];

/**
 * Contract for the MongoDB-backed public catalog. It is deliberately separate from the
 * legacy Prisma query DTO until the query is migrated in the next vertical slice.
 */
export class BrowsePublicScriptsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Text search on the script name and short description',
    example: 'browser automation',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated MongoDB tag IDs. A script must have every requested tag.',
    example: '66d0a1d4d3315a68c6a7e100,66d0a1d4d3315a68c6a7e101',
  })
  @IsOptional()
  @IsString()
  tagIds?: string;

  @ApiPropertyOptional({ enum: PUBLIC_SCRIPT_SORTS, default: 'popular' })
  @IsOptional()
  @IsEnum(PUBLIC_SCRIPT_SORTS)
  @Type(() => String)
  sort: PublicScriptSort = 'popular';
}
