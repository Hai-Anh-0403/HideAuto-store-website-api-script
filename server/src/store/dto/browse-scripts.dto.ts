import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class BrowseScriptsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Comma-separated tag IDs (AND logic)',
    example: 'tag-id-1,tag-id-2',
  })
  @IsOptional()
  @IsString()
  tag_ids?: string;

  @ApiPropertyOptional({
    description: 'Text search on name and short description',
    example: 'scraper',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
