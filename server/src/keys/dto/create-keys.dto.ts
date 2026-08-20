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

/** Issue one key, or a batch of them, in a single call. */
export class CreateKeysDto {
  @ApiPropertyOptional({
    description:
      'Mini app the key unlocks. Omit (or send null) for a shop-wide key that unlocks every app from this seller.',
  })
  @IsOptional()
  @IsString()
  scriptId?: string | null;

  @ApiPropertyOptional({
    example: 'Khách A · gói 1 năm',
    description:
      'Seller-facing note. With quantity > 1 each key gets the label suffixed with its number.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'How many buyers may redeem this key. Omit for unlimited.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUses?: number;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59Z',
    description: 'Redeeming after this instant fails. Omit for a key that never expires.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: 200,
    description: 'Generate a batch of independent keys sharing these settings.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  quantity?: number;
}
