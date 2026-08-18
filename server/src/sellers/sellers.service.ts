import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getSessions(sellerId: string) {
    return this.prisma.sellerSession.findMany({
      where: { sellerId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        device: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
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
      throw new UnauthorizedException('Current password is incorrect');
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
    const [memberCount, activeKeyCount, scriptCount] = await Promise.all([
      this.prisma.sellerMember.count({ where: { sellerId } }),
      this.prisma.sellerKey.count({
        where: { sellerId, status: 'ACTIVE' },
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
