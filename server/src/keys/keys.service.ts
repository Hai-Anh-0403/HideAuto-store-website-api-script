import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeyDto } from './dto/create-key.dto';
import { ListKeysDto } from './dto/list-keys.dto';
import { PageDto } from '../common/dto/page.dto';

@Injectable()
export class KeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sellerId: string, dto: ListKeysDto) {
    const where: Record<string, unknown> = { sellerId };
    if (dto.scriptId) {
      where.scriptId = dto.scriptId;
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: {
          script: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.sellerKey.count({ where }),
    ]);

    return new PageDto(items, total, dto.skip, dto.limit);
  }

  async create(sellerId: string, scriptId: string, dto: CreateKeyDto) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const key = crypto.randomBytes(16).toString('hex');

    return this.prisma.sellerKey.create({
      data: {
        sellerId,
        scriptId,
        key,
        label: dto.label,
        status: 'ACTIVE',
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async revoke(sellerId: string, keyId: string) {
    const key = await this.prisma.sellerKey.findFirst({
      where: { id: keyId, sellerId },
    });

    if (!key) {
      throw new NotFoundException('Key not found');
    }

    if (key.status === 'REVOKED') {
      throw new BadRequestException('Key is already revoked');
    }

    return this.prisma.sellerKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' },
    });
  }
}
