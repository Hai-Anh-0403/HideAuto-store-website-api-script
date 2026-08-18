import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Seller login' })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginSeller(dto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Seller registration' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.registerSeller(dto);
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin login' })
  async adminLogin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }
}
