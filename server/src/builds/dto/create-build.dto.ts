import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBuildDto {
  @ApiPropertyOptional({
    description:
      'Approved version to package. Defaults to the one the listing is currently selling.',
  })
  @IsOptional()
  @IsString()
  versionId?: string;

  @ApiPropertyOptional({ example: 'win', default: 'win' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'x64', default: 'x64' })
  @IsOptional()
  @IsString()
  arch?: string;
}
