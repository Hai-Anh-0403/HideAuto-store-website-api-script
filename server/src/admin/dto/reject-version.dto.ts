import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectVersionDto {
  @ApiPropertyOptional({ example: 'Contains embedded credentials' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
