import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Multipart body for `POST /api/apps/upload`.
 *
 * Identity (`name` / `version` / `appId`) always comes from the HAUP2 wrapper, never
 * from these fields. Listing copy (description, tags, media) is optional extra.
 */
export class UploadMiniAppDto {
  @ApiPropertyOptional({ description: 'Listing description (form); wrapper name wins for identity' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  description?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'LICENSE'], default: 'PUBLIC' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['PUBLIC', 'LICENSE'], { message: 'Mode không hợp lệ' })
  mode?: 'PUBLIC' | 'LICENSE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.version !== '')
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must look like 1.0.0' })
  @MaxLength(20)
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changelog?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.minAppVersion !== '')
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minAppVersion must look like 1.4.0' })
  @MaxLength(20)
  minAppVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.videoUrl !== '')
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { message: 'videoUrl must be a valid HTTP(S) URL' },
  )
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.thumbnailUrl !== '')
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { message: 'thumbnailUrl must be a valid HTTP(S) URL' },
  )
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Comma-separated gallery image URLs' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  images?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tag IDs' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tagIds?: string;
}
