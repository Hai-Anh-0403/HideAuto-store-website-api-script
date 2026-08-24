import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Mirrors the Prisma `ScriptStatus` enum — kept literal so the DTO owns its own contract. */
export const SCRIPT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;

export const SCRIPT_SORTS = ['newest', 'name', 'downloads'] as const;

/**
 * Query for the seller's own catalogue.
 *
 * A seller with a few dozen apps could only page through them newest-first, so finding the
 * one draft that needs a re-upload — or every listing an admin rejected — meant walking the
 * whole list. Search and the status filter are what turn this page into a working view.
 */
export class ListScriptsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Matches name, slug or short description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated tag IDs. A listing must carry every tag given (AND), matching the store catalogue filter.',
    example: 'tag-id-1,tag-id-2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tagIds?: string;

  @ApiPropertyOptional({
    enum: SCRIPT_STATUSES,
    description: 'Restrict to one listing status.',
  })
  @IsOptional()
  @IsIn(SCRIPT_STATUSES)
  status?: (typeof SCRIPT_STATUSES)[number];

  @ApiPropertyOptional({
    enum: SCRIPT_SORTS,
    default: 'newest',
    description: 'newest = created desc, name = A→Z, downloads = most downloaded first.',
  })
  @IsOptional()
  @IsIn(SCRIPT_SORTS)
  sort?: (typeof SCRIPT_SORTS)[number] = 'newest';
}
