import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Wire names are snake_case here, unlike the rest of the API.
 *
 * This is the contract a packaged mini app was built against — renaming the fields would
 * break every installed copy, so the desktop convention wins over ours.
 */
export class LicenseRequestDto {
  @ApiPropertyOptional({
    example: 'SK-x7Qd...',
    description: 'Only needed the first time; later activations reuse the membership',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key?: string;

  @ApiProperty({ example: 'a1b2c3d4', description: 'Stable id of the buyer machine' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  machine_id: string;
}
