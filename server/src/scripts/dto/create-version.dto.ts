import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MaxLength(20)
  version: string;

  @ApiPropertyOptional({ example: 'Initial release' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  changelog?: string;

  @ApiPropertyOptional({
    example: '1.4.0',
    description: 'Oldest hideflow build this version runs on.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minAppVersion must look like 1.4.0' })
  @MaxLength(20)
  minAppVersion?: string;
}
