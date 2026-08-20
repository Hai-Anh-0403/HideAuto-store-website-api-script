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

/** What the portal shows in the "devices" table, derived from the browser's own claim. */
export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginSeller(dto: LoginDto, context: SessionContext = {}) {
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

    // A rejected or suspended seller is deliberately still allowed in. The portal is
    // read-only for them anyway — `ApprovedSellerGuard` blocks everything that sells — and
    // signing them out at the door meant the admin's reason, which is written precisely so
    // they know what to fix, could never reach them.

    return this.issueSellerSession(seller.id, context);
  }

  async registerSeller(dto: RegisterDto, context: SessionContext = {}) {
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

    return this.issueSellerSession(seller.id, context);
  }

  /**
   * Mint a seller token and the session row that keeps it alive.
   *
   * The row is not bookkeeping: `JwtStrategy` refuses any seller token whose session is
   * gone, which is what makes "sign this device out" actually cut the device off.
   */
  private async issueSellerSession(sellerId: string, context: SessionContext) {
    const jti = crypto.randomUUID();
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(expiresIn));

    const token = this.jwt.sign({
      sub: `seller:${sellerId}`,
      role: 'seller',
      jti,
    });

    await this.prisma.sellerSession.create({
      data: {
        sellerId,
        jti,
        expiresAt,
        device: describeDevice(context.userAgent),
        userAgent: context.userAgent?.slice(0, 500),
        ip: context.ip,
      },
    });

    return {
      access_token: token,
      token_type: 'bearer' as const,
      role: 'seller' as const,
    };
  }

  /** Drop the session behind the caller's own token. Signing out twice is not an error. */
  async logout(jti: string): Promise<void> {
    await this.prisma.sellerSession.deleteMany({ where: { jti } });
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

/**
 * A short, human name for the device behind a user agent — "Chrome · Windows".
 *
 * Deliberately crude: the seller only needs enough to recognise "that is my laptop" or
 * "that is not mine" in the sessions table. The raw user agent is stored alongside it for
 * anyone who needs the details.
 */
function describeDevice(userAgent?: string): string | null {
  if (!userAgent) return null;

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : null;

  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Macintosh|Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
