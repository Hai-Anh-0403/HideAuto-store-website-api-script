import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListMembersDto } from './dto/list-members.dto';
import { PageDto } from '../common/dto/page.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sellerId: string, dto: ListMembersDto) {
    const where: Record<string, unknown> = { sellerId };

    if (dto.search) {
      where.userEmail = { contains: dto.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerMember.findMany({
        where,
        orderBy: { redeemedAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          userId: true,
          userEmail: true,
          userName: true,
          status: true,
          allScripts: true,
          scriptIds: true,
          lastSeenAt: true,
          blockedDevices: true,
          redeemedAt: true,
        },
      }),
      this.prisma.sellerMember.count({ where }),
    ]);

    return new PageDto(items, total, dto.skip, dto.limit);
  }

  async block(sellerId: string, memberId: string) {
    const member = await this.prisma.sellerMember.findFirst({
      where: { id: memberId, sellerId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.status === 'BLOCKED') {
      throw new BadRequestException('Member is already blocked');
    }

    return this.prisma.sellerMember.update({
      where: { id: memberId },
      data: { status: 'BLOCKED' },
    });
  }

  async unblock(sellerId: string, memberId: string) {
    const member = await this.prisma.sellerMember.findFirst({
      where: { id: memberId, sellerId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.status === 'ACTIVE') {
      throw new BadRequestException('Member is already active');
    }

    return this.prisma.sellerMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
    });
  }
}
