import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** JSON body — unlike the multipart create DTO, `tagIds` is a real array here. */
export class UpdateScriptDto {
  @ApiPropertyOptional({ example: 'Updated Script Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated short description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string | null;

  @ApiPropertyOptional({ example: 'Full description with **markdown**' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'YouTube/Vimeo embed URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Thumbnail image URL (from media upload)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Gallery image URLs (from media upload)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String], example: ['tag-id-1', 'tag-id-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(36, { each: true })
  tagIds?: string[];
}
