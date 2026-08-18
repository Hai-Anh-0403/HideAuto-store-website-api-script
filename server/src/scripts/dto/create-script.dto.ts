import { IsString, IsOptional, MinLength } from 'class-validator';
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

  @ApiPropertyOptional({
    example: 'tag-id-1,tag-id-2',
    description: 'Comma-separated tag IDs',
  })
  @IsOptional()
  @IsString()
  tagIds?: string;
}
