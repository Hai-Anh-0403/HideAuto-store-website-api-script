import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Change a key's terms after it was issued.
 *
 * Every field is tri-state on purpose: absent leaves it alone, `null` clears it (unlimited
 * uses / never expires), a value sets it. The code itself is immutable — a buyer may
 * already have it written down.
 */
export class UpdateKeyDto {
  @ApiPropertyOptional({ example: 'Khách A · đã gia hạn' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string | null;

  @ApiPropertyOptional({ example: 5, description: 'null = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUses?: number | null;

  @ApiPropertyOptional({ example: '2027-01-31T23:59:59Z', description: 'null = never expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
