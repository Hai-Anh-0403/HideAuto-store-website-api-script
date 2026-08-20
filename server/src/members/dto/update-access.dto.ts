import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Change what a buyer may run, after the fact.
 *
 * Redeeming a key is how access normally arrives, but a seller still has to be able to add
 * an app they sold outside the store, or take one back — without deleting the buyer.
 */
export class UpdateAccessDto {
  @ApiPropertyOptional({
    description: 'true unlocks every app from this seller, present and future.',
  })
  @IsOptional()
  @IsBoolean()
  allScripts?: boolean;

  @ApiPropertyOptional({
    description: 'The exact set of individually unlocked mini apps. Replaces the old set.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  scriptIds?: string[];
}
