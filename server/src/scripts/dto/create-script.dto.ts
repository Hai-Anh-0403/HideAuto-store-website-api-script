import { IsString, IsOptional, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Multipart body — every field arrives as a string, so `tagIds` is comma-separated. */
export class CreateScriptDto {
  @ApiProperty({ example: 'My Automation Script' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'A short description of the script' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Long description shown on the listing' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '1.0.0',
    description: 'Version number of this first upload. Defaults to 1.0.0.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must look like 1.0.0' })
  version?: string;

  @ApiPropertyOptional({ example: 'Bản phát hành đầu tiên.' })
  @IsOptional()
  @IsString()
  changelog?: string;

  @ApiPropertyOptional({
    example: '1.4.0',
    description: 'Oldest hideflow build this mini app runs on.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minAppVersion must look like 1.4.0' })
  minAppVersion?: string;

  @ApiPropertyOptional({
    example: 'tag-id-1,tag-id-2',
    description: 'Comma-separated tag IDs',
  })
  @IsOptional()
  @IsString()
  tagIds?: string;
}
