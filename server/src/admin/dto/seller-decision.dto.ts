import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Why an account was turned down or suspended — the seller sees this, so it must be sayable. */
export class SellerDecisionDto {
  @ApiPropertyOptional({ example: 'Contact details could not be verified' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
