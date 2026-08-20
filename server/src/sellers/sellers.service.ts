import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BadRequestError, UnauthorizedError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        email: true,
        name: true,
        contact: true,
        status: true,
        // Why the admin said no, so the portal can explain the block instead of just
        // showing a greyed-out shell.
        statusReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  async updateProfile(sellerId: string, dto: UpdateSellerDto) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contact !== undefined && { contact: dto.contact }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        contact: true,
        status: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Sessions the seller can act on.
   *
   * Expired rows are filtered out rather than listed as sign-out-able: their tokens are
   * already dead, and showing them made "sign out other devices" look like it had missed
   * some. `current` marks the row the caller is holding, so the portal can say "this
   * device" and refuse to let them cut their own branch.
   */
  async getSessions(sellerId: string, currentJti?: string) {
    const rows = await this.prisma.sellerSession.findMany({
      where: { sellerId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        jti: true,
        device: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });

    return rows.map(({ jti, ...session }) => ({
      ...session,
      current: jti === currentJti,
    }));
  }

  async revokeSession(sellerId: string, sessionId: string) {
    const session = await this.prisma.sellerSession.findFirst({
      where: { id: sessionId, sellerId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.sellerSession.delete({
      where: { id: sessionId },
    });
  }

  async revokeAllOtherSessions(sellerId: string, currentJti: string) {
    await this.prisma.sellerSession.deleteMany({
      where: {
        sellerId,
        jti: { not: currentJti },
      },
    });
  }

  async changePassword(
    sellerId: string,
    currentJti: string,
    dto: ChangePasswordDto,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const valid = await bcrypt.compare(dto.oldPassword, seller.password);
    if (!valid) {
      throw new UnauthorizedError(
        'wrong_password',
        'Current password is incorrect',
      );
    }

    // Rotating to the same password signs every other device out for nothing, and reads to
    // the seller like the change worked when nothing about their exposure changed.
    if (await bcrypt.compare(dto.newPassword, seller.password)) {
      throw new BadRequestError(
        'password_unchanged',
        'The new password must differ from the current one',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { password: hashedPassword },
    });

    // Revoke all other sessions
    await this.prisma.sellerSession.deleteMany({
      where: {
        sellerId,
        jti: { not: currentJti },
      },
    });

    return { message: 'Password changed successfully' };
  }

  async getStats(sellerId: string) {
    const now = new Date();
    const [memberCount, activeKeyCount, scriptCount] = await Promise.all([
      this.prisma.sellerMember.count({ where: { sellerId } }),
      // "Active" has to mean *usable*: a key that expired or ran out of uses is not
      // something the seller can still hand to a buyer, even though its status column
      // still says ACTIVE. Same conditions as the keys page filter.
      this.prisma.sellerKey.count({
        where: {
          sellerId,
          status: 'ACTIVE',
          // `{ not: { lt: now } }` would drop never-expiring keys: in SQL, NOT(NULL < now)
          // is NULL, not true.
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
          OR: [
            { maxUses: null },
            { usedCount: { lt: this.prisma.sellerKey.fields.maxUses } },
          ],
        },
      }),
      this.prisma.script.count({ where: { sellerId } }),
    ]);

    const onlineCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const onlineCount = await this.prisma.sellerMember.count({
      where: {
        sellerId,
        lastSeenAt: { gte: onlineCutoff },
      },
    });

    return {
      memberCount,
      onlineCount,
      activeKeyCount,
      scriptCount,
    };
  }
}
