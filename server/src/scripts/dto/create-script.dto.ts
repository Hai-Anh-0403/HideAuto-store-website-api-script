import {
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Multipart body — every field arrives as a string, so `tagIds` is comma-separated. */
export class CreateScriptDto {
  @ApiProperty({ example: 'My Automation Script' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'A short description of the script' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Long description shown on the listing' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  description?: string;

  @ApiPropertyOptional({
    example: '1.0.0',
    description: 'Version number of this first upload. Defaults to 1.0.0.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must look like 1.0.0' })
  @MaxLength(20)
  version?: string;

  @ApiPropertyOptional({ example: 'Bản phát hành đầu tiên.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changelog?: string;

  @ApiPropertyOptional({
    example: '1.4.0',
    description: 'Oldest hideflow build this mini app runs on.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minAppVersion must look like 1.4.0' })
  @MaxLength(20)
  minAppVersion?: string;

  @ApiPropertyOptional({ description: 'YouTube/Vimeo embed URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Thumbnail image URL (from media upload)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Comma-separated gallery image URLs' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  images?: string;

  @ApiPropertyOptional({
    example: 'tag-id-1,tag-id-2',
    description: 'Comma-separated tag IDs',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tagIds?: string;
}
