import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService, type SessionContext } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, RequestUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * Password guessing is the attack these endpoints exist for.
 *
 * Ten tries a minute against one account; sixty from one address, which is deliberately
 * loose because every portal user behind the same proxy shares that address.
 */
const SIGN_IN_LIMIT = {
  limit: 10,
  windowMs: 60_000,
  subjectField: 'email',
  clientLimit: 60,
};

@ApiTags('Auth')
@Controller('api/v1/auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @RateLimit(SIGN_IN_LIMIT)
  @ApiOperation({ summary: 'Seller login' })
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.loginSeller(dto, contextOf(request));
  }

  @Post('register')
  @RateLimit({
    limit: 5,
    windowMs: 60 * 60_000,
    subjectField: 'email',
    clientLimit: 20,
  })
  @ApiOperation({ summary: 'Seller registration' })
  async register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.registerSeller(dto, contextOf(request));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End this session — the token stops working immediately' })
  async logout(@CurrentUser() user: RequestUser) {
    await this.authService.logout(user.jti);
  }

  @Post('admin/login')
  @RateLimit(SIGN_IN_LIMIT)
  @ApiOperation({ summary: 'Admin login' })
  async adminLogin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }
}

/**
 * The session audit row a seller reads when deciding whether a device is theirs.
 *
 * `request.ip` — not the raw `x-forwarded-for` — so the address shown is one Express
 * accepted from a trusted proxy, not one the caller typed.
 */
function contextOf(request: Request): SessionContext {
  return { userAgent: request.headers['user-agent'], ip: request.ip };
}
