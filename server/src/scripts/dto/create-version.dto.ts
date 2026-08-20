import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({ example: '1.0.0' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ example: 'Initial release' })
  @IsOptional()
  @IsString()
  changelog?: string;

  @ApiPropertyOptional({
    example: '1.4.0',
    description: 'Oldest hideflow build this version runs on.',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'minAppVersion must look like 1.4.0' })
  minAppVersion?: string;
}
