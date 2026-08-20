import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenError, UnauthorizedError } from '../common/errors';
import { RequestUser } from './decorators/current-user.decorator';

/**
 * Everything a seller can only do once the store has approved them.
 *
 * `SellerAuthGuard` only proves the token belongs to a seller. Publishing a mini app or
 * minting keys also requires the account to be APPROVED — otherwise anyone who registers
 * can list scripts and sell keys before a human ever looks at them. Read-only account
 * routes (`/sellers/me`, profile, sessions) deliberately do *not* use this guard, so a
 * pending seller can still sign in and see why they are waiting.
 *
 * Stack it after the other two: `@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)`.
 */
@Injectable()
export class ApprovedSellerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user || user.role !== 'seller') {
      throw new UnauthorizedError('not_authenticated', 'Seller access required');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: user.id },
      select: { status: true },
    });

    if (!seller) {
      throw new UnauthorizedError('session_ended', 'Your session has ended');
    }

    switch (seller.status) {
      case 'APPROVED':
        return true;
      case 'REJECTED':
        throw new ForbiddenError(
          'seller_rejected',
          'This seller account was rejected',
        );
      case 'SUSPENDED':
        throw new ForbiddenError(
          'seller_suspended',
          'This seller account is suspended',
        );
      default:
        throw new ForbiddenError(
          'seller_not_approved',
          'This seller account is waiting for approval',
        );
    }
  }
}
