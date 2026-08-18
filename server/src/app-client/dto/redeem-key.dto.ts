import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemKeyDto {
  @ApiProperty({ example: 'SK-x7Qd...' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key: string;
}
