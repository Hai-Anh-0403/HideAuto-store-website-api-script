import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectVersionDto {
  @ApiPropertyOptional({ example: 'Contains embedded credentials' })
  @IsOptional()
  @IsString()
  reason?: string;
}
