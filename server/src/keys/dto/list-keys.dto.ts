import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** The four states a seller filters by — `EXPIRED`/`EXHAUSTED` are derived, not stored. */
export const KEY_STATES = ['ACTIVE', 'REVOKED', 'EXPIRED', 'EXHAUSTED'] as const;
export type KeyState = (typeof KEY_STATES)[number];

export class ListKeysDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by mini app. Pass "none" for shop-wide keys only.',
  })
  @IsOptional()
  @IsString()
  scriptId?: string;

  @ApiPropertyOptional({
    enum: KEY_STATES,
    description:
      'ACTIVE means usable right now: not revoked, not past its expiry, uses left.',
  })
  @IsOptional()
  @IsIn(KEY_STATES)
  state?: KeyState;

  @ApiPropertyOptional({ description: 'Substring of the key code or its label.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
