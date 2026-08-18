import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../common/errors';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginSeller(dto: LoginDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });

    if (!seller) {
      throw new UnauthorizedError(
        'invalid_credentials',
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, seller.password);
    if (!passwordValid) {
      throw new UnauthorizedError(
        'invalid_credentials',
        'Invalid email or password',
      );
    }

    if (seller.status === 'REJECTED') {
      throw new ForbiddenError(
        'seller_rejected',
        'This seller account was rejected',
      );
    }
    if (seller.status === 'SUSPENDED') {
      throw new ForbiddenError(
        'seller_suspended',
        'This seller account is suspended',
      );
    }

    const jti = crypto.randomUUID();
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const expiresAt = new Date(
      Date.now() + this.parseDuration(expiresIn),
    );

    const token = this.jwt.sign({
      sub: `seller:${seller.id}`,
      role: 'seller',
      jti,
    });

    await this.prisma.sellerSession.create({
      data: {
        sellerId: seller.id,
        jti,
        expiresAt,
      },
    });

    return {
      access_token: token,
      token_type: 'bearer' as const,
      role: 'seller' as const,
    };
  }

  async registerSeller(dto: RegisterDto) {
    const existing = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictError('email_taken', 'Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const seller = await this.prisma.seller.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        contact: dto.contact,
        status: 'PENDING',
      },
    });

    const jti = crypto.randomUUID();
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const expiresAt = new Date(
      Date.now() + this.parseDuration(expiresIn),
    );

    const token = this.jwt.sign({
      sub: `seller:${seller.id}`,
      role: 'seller',
      jti,
    });

    await this.prisma.sellerSession.create({
      data: {
        sellerId: seller.id,
        jti,
        expiresAt,
      },
    });

    return {
      access_token: token,
      token_type: 'bearer' as const,
      role: 'seller' as const,
    };
  }

  async loginAdmin(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedError(
        'invalid_credentials',
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedError(
        'invalid_credentials',
        'Invalid email or password',
      );
    }

    if (!admin.isActive) {
      throw new ForbiddenError('admin_disabled', 'This admin account is disabled');
    }

    const jti = crypto.randomUUID();

    const token = this.jwt.sign({
      sub: `admin:${admin.id}`,
      role: 'admin',
      jti,
    });

    return {
      access_token: token,
      token_type: 'bearer' as const,
      role: 'admin' as const,
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
