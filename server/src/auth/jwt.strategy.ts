import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedError } from '../common/errors';
import { JwtPayload, RequestUser } from './decorators/current-user.decorator';

/** Don't write `lastSeenAt` on every single request — once a minute is enough for the UI. */
const PRESENCE_INTERVAL_MS = 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * A valid signature is not enough — the session behind the token must still exist.
   *
   * Sessions are what "sign this device out" and "sign out everywhere" delete. Without this
   * lookup those buttons only cleared the browser's copy of the token while the token
   * itself stayed good for another seven days, which is exactly the case where someone
   * clicks them: a device they no longer trust.
   *
   * Admin tokens carry no session row; they are re-checked against the account itself.
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const [role, id] = payload.sub.split(':');

    if (role === 'seller') {
      const session = await this.prisma.sellerSession.findUnique({
        where: { jti: payload.jti },
        select: { id: true, sellerId: true, expiresAt: true, lastSeenAt: true },
      });

      if (!session || session.sellerId !== id || session.expiresAt <= new Date()) {
        throw new UnauthorizedError('session_ended', 'Your session has ended');
      }

      if (Date.now() - session.lastSeenAt.getTime() > PRESENCE_INTERVAL_MS) {
        // Presence is decoration: never fail a request because the touch failed.
        await this.prisma.sellerSession
          .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      }
    }

    if (role === 'admin') {
      // Admin tokens carry no session row, so this is the only thing standing between a
      // disabled (or deleted) admin and seven more days of full review powers.
      const admin = await this.prisma.admin.findUnique({
        where: { id },
        select: { isActive: true },
      });
      if (!admin?.isActive) {
        throw new UnauthorizedError('session_ended', 'Your session has ended');
      }
    }

    return { id, role: role as 'seller' | 'admin', jti: payload.jti };
  }
}
