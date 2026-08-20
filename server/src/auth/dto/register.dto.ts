import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'seller@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'My Store' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'contact@example.com' })
  @IsOptional()
  @IsString()
  contact?: string;
}
