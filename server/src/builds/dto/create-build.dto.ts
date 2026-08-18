import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBuildDto {
  @ApiPropertyOptional({ example: 'win', default: 'win' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'x64', default: 'x64' })
  @IsOptional()
  @IsString()
  arch?: string;
}
