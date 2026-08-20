/**
 * The seller's view of their buyers.
 *
 * A "member" is one buyer's relationship with one seller: what they unlocked, whether they
 * are blocked, which machines they run on, and which keys got them in. Everything here is
 * scoped by `sellerId` — a seller must never be able to name another seller's buyer.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, type SellerMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../common/errors';
import { PageDto } from '../common/dto/page.dto';
import { ListMembersDto } from './dto/list-members.dto';
import { UpdateAccessDto } from './dto/update-access.dto';
import { toStringArray } from '../common/json-array';

/** Matches the portal's own definition of "online" (web/src/lib/pills.ts). */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const MEMBER_FIELDS = {
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
} as const;

/** Keys a buyer redeemed, newest first — enough to answer "how did they get in?". */
const REDEMPTION_INCLUDE = {
  redemptions: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      createdAt: true,
      key: { select: { id: true, key: true, label: true } },
    },
  },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sellerId: string, dto: ListMembersDto) {
    const where: Prisma.SellerMemberWhereInput = { sellerId };

    if (dto.search) {
      // Email is what a seller usually has, but a support thread often only quotes a name
      // or the raw user id — so all three match.
      where.OR = [
        { userEmail: { contains: dto.search } },
        { userName: { contains: dto.search } },
        { userId: { contains: dto.search } },
      ];
    }
    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.online !== undefined) {
      const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
      where.lastSeenAt = dto.online === 'true' ? { gte: cutoff } : { lt: cutoff };
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerMember.findMany({
        where,
        orderBy: { redeemedAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: { ...MEMBER_FIELDS, ...REDEMPTION_INCLUDE },
      }),
      this.prisma.sellerMember.count({ where }),
    ]);

    return new PageDto(items.map(flatten), total, dto.skip, dto.limit);
  }

  /** Machines this buyer has activated on, with the seller's block flag resolved. */
  async devices(sellerId: string, memberId: string) {
    const member = await this.owned(sellerId, memberId);

    const rows = await this.prisma.memberDevice.findMany({
      where: { memberId },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });

    return rows.map((device) => ({
      id: device.id,
      machineId: device.machineId,
      scriptId: device.scriptId,
      activationCount: device.activationCount,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      blocked: toStringArray(member.blockedDevices).includes(device.machineId),
    }));
  }

  /**
   * Block or unblock one machine.
   *
   * The licence path already refuses blocked machine ids; this is the only thing that can
   * put one on the list. Blocking bites on the next licence renewal, not instantly — see
   * `docs/mini-app-licensing.md` §4.
   */
  async setDeviceBlocked(
    sellerId: string,
    memberId: string,
    machineId: string,
    blocked: boolean,
  ): Promise<SellerMember> {
    await this.owned(sellerId, memberId);

    /*
     * The list is a JSON column now, so there is no `array_append` to lean on: MySQL's
     * JSON functions that could stand in (`JSON_SEARCH`) match with LIKE semantics, which
     * would treat `_` and `%` in a machine id as wildcards and compare case-insensitively.
     *
     * A row lock gets the same guarantee the Postgres version was after — a block made a
     * second earlier from another tab is still there when this one writes — without
     * trusting string matching inside the database.
     */
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM seller_members WHERE id = ${memberId} FOR UPDATE`;

      const row = await tx.sellerMember.findUniqueOrThrow({
        where: { id: memberId },
        select: { blockedDevices: true },
      });
      const current = toStringArray(row.blockedDevices);
      const has = current.includes(machineId);

      if (blocked && has) {
        throw new ConflictError('device_already_blocked', 'Device is already blocked');
      }
      if (!blocked && !has) {
        throw new ConflictError('device_not_blocked', 'Device is not blocked');
      }

      return tx.sellerMember.update({
        where: { id: memberId },
        data: {
          blockedDevices: blocked
            ? [...current, machineId]
            : current.filter((device) => device !== machineId),
        },
      });
    });
  }

  /** Grant or take back access to individual mini apps. */
  async updateAccess(
    sellerId: string,
    memberId: string,
    dto: UpdateAccessDto,
  ): Promise<SellerMember> {
    const member = await this.owned(sellerId, memberId);

    const data: Prisma.SellerMemberUpdateInput = {};
    if (dto.allScripts !== undefined) data.allScripts = dto.allScripts;

    if (dto.scriptIds !== undefined) {
      const unique = [...new Set(dto.scriptIds)];
      const owned = unique.length
        ? await this.prisma.script.findMany({
            where: { id: { in: unique }, sellerId },
            select: { id: true },
          })
        : [];
      const ownedIds = new Set(owned.map((script) => script.id));

      // A seller may only hand out their own apps. The check is on what the request *adds*:
      // an id already on the member can be a deleted app, and rejecting the whole payload
      // for it would freeze the editor — the seller could never change anything again.
      const added = unique.filter(
        (id) => !toStringArray(member.scriptIds).includes(id) && !ownedIds.has(id),
      );
      if (added.length) {
        throw new NotFoundError('script_not_found', 'Mini app not found');
      }

      // Ids whose script no longer exists are dropped rather than carried forever.
      data.scriptIds = unique.filter((id) => ownedIds.has(id));
    }

    return this.prisma.sellerMember.update({ where: { id: memberId }, data });
  }

  async block(sellerId: string, memberId: string): Promise<SellerMember> {
    const member = await this.owned(sellerId, memberId);
    if (member.status === 'BLOCKED') {
      throw new ConflictError('member_already_blocked', 'Member is already blocked');
    }
    return this.prisma.sellerMember.update({
      where: { id: memberId },
      data: { status: 'BLOCKED' },
    });
  }

  async unblock(sellerId: string, memberId: string): Promise<SellerMember> {
    const member = await this.owned(sellerId, memberId);
    if (member.status === 'ACTIVE') {
      throw new ConflictError('member_not_blocked', 'Member is not blocked');
    }
    return this.prisma.sellerMember.update({
      where: { id: memberId },
      data: { status: 'ACTIVE' },
    });
  }

  private async owned(sellerId: string, memberId: string): Promise<SellerMember> {
    const member = await this.prisma.sellerMember.findFirst({
      where: { id: memberId, sellerId },
    });
    if (!member) throw new NotFoundError('member_not_found', 'Member not found');
    return member;
  }
}

type MemberRow = Prisma.SellerMemberGetPayload<{
  select: typeof MEMBER_FIELDS & typeof REDEMPTION_INCLUDE;
}>;

/** Flatten the join rows into the shape the portal renders. */
function flatten(row: MemberRow) {
  const { redemptions, ...member } = row;
  return {
    ...member,
    keys: redemptions.map((r) => ({
      id: r.key.id,
      key: r.key.key,
      label: r.key.label,
      redeemedAt: r.createdAt,
    })),
  };
}
