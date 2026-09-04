import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
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
  @ValidateIf((o) => o.videoUrl !== null && o.videoUrl !== '')
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { message: 'videoUrl must be a valid HTTP(S) URL' })
  @MaxLength(500)
  videoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Thumbnail image URL (from media upload)' })
  @IsOptional()
  @ValidateIf((o) => o.thumbnailUrl !== null && o.thumbnailUrl !== '')
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { message: 'thumbnailUrl must be a valid HTTP(S) URL' })
  @MaxLength(500)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Gallery image URLs (from media upload)' })
  @IsOptional()
  @IsArray()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { each: true, message: 'each image URL must be a valid HTTP(S) URL' })
  @MaxLength(500, { each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String], example: ['tag-id-1', 'tag-id-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(36, { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ example: '$29', description: 'Display price string' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  price?: string;

  @ApiPropertyOptional({ example: 29, description: 'Numeric price amount' })
  @IsOptional()
  priceAmount?: number;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code (default USD)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}
