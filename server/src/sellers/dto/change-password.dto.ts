import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  /** Only has to be non-empty: an account created under an older rule may be shorter. */
  @ApiProperty()
  @IsString()
  @MinLength(1)
  oldPassword: string;

  /** Matches what the portal's own form enforces — 6 here meant the UI lied about the rule. */
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
