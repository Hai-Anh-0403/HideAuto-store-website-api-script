/**
 * Activation keys: the seller's only lever between "published" and "a buyer can run it".
 *
 * A key is deliberately dumb — it grants entitlement once redeemed and then keeps counting.
 * Everything a seller can do to one lives here: issue (single or batch), retune its terms,
 * revoke, restore, delete, and read back the state it is actually in.
 *
 * `status` in the database only knows ACTIVE/REVOKED. Expiry and exhaustion are *derived*
 * at read time from `expiresAt`/`maxUses` — the same conditions `ActivationService.redeem`
 * enforces — so the portal can tell the truth without a cron job rewriting rows.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, type SellerKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PageDto } from '../common/dto/page.dto';
import { BadRequestError, ConflictError, NotFoundError } from '../common/errors';
import { generateKeyCode } from './key-code';
import { CreateKeysDto } from './dto/create-keys.dto';
import { ListKeysDto, type KeyState } from './dto/list-keys.dto';
import { UpdateKeyDto } from './dto/update-key.dto';

const SCRIPT_FIELDS = { id: true, name: true, slug: true } as const;

/** Rows a seller may export in one call — plenty for a real shop, bounded for the server. */
const EXPORT_CAP = 5000;

type KeyRow = SellerKey & {
  script: { id: string; name: string; slug: string } | null;
};

export type KeyView = KeyRow & { state: KeyState };

export interface KeyStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  exhausted: number;
  redemptions: number;
}

@Injectable()
export class KeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sellerId: string, dto: ListKeysDto): Promise<PageDto<KeyView>> {
    const where = this.filter(sellerId, dto);

    const [items, total] = await Promise.all([
      this.prisma.sellerKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        include: { script: { select: SCRIPT_FIELDS } },
      }),
      this.prisma.sellerKey.count({ where }),
    ]);

    return new PageDto(items.map(view), total, dto.skip, dto.limit);
  }

  /** Counts for the page header, over the seller's whole key set (not the current page). */
  async stats(sellerId: string): Promise<KeyStats> {
    const now = new Date();
    const [total, revoked, expired, exhausted, sum] = await Promise.all([
      this.prisma.sellerKey.count({ where: { sellerId } }),
      this.prisma.sellerKey.count({ where: { sellerId, status: 'REVOKED' } }),
      this.prisma.sellerKey.count({
        where: { sellerId, status: 'ACTIVE', expiresAt: { lt: now } },
      }),
      this.prisma.sellerKey.count({
        where: {
          sellerId,
          status: 'ACTIVE',
          maxUses: { not: null },
          usedCount: { gte: this.prisma.sellerKey.fields.maxUses },
          AND: [notExpired(now)],
        },
      }),
      this.prisma.sellerKey.aggregate({
        where: { sellerId },
        _sum: { usedCount: true },
      }),
    ]);

    return {
      total,
      active: total - revoked - expired - exhausted,
      revoked,
      expired,
      exhausted,
      redemptions: sum._sum.usedCount ?? 0,
    };
  }

  /**
   * Issue `quantity` independent keys sharing one set of terms.
   *
   * Batch issuing is the normal case — a reseller order, a giveaway — so it is one call in
   * one transaction: either every key in the batch exists or none does, and the seller is
   * never left reconciling a half-written sheet.
   */
  async create(sellerId: string, dto: CreateKeysDto): Promise<KeyView[]> {
    const scriptId = dto.scriptId ?? null;
    if (scriptId) {
      const script = await this.prisma.script.findFirst({
        where: { id: scriptId, sellerId },
        select: { id: true },
      });
      if (!script) {
        throw new NotFoundError('script_not_found', 'Mini app not found');
      }
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError(
        'key_expiry_in_past',
        'Expiry must be in the future',
      );
    }

    const quantity = dto.quantity ?? 1;

    // 98 bits per code makes a clash theoretical, but the column is unique and a lost batch
    // would surface as a baffling 500 — so regenerate and retry instead.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.insertBatch(sellerId, scriptId, dto, {
          quantity,
          expiresAt,
        });
      } catch (err) {
        const clash =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002';
        if (!clash || attempt >= 2) throw err;
      }
    }
  }

  private async insertBatch(
    sellerId: string,
    scriptId: string | null,
    dto: CreateKeysDto,
    opts: { quantity: number; expiresAt: Date | null },
  ): Promise<KeyView[]> {
    const codes = new Set<string>();
    while (codes.size < opts.quantity) codes.add(generateKeyCode());

    const rows = await this.prisma.$transaction(
      [...codes].map((key, index) =>
        this.prisma.sellerKey.create({
          data: {
            sellerId,
            scriptId,
            key,
            label: labelFor(dto.label, index, opts.quantity),
            status: 'ACTIVE',
            maxUses: dto.maxUses ?? null,
            expiresAt: opts.expiresAt,
          },
          include: { script: { select: SCRIPT_FIELDS } },
        }),
      ),
    );

    return rows.map(view);
  }

  /** Retune an issued key. The code itself never changes — buyers already wrote it down. */
  async update(
    sellerId: string,
    keyId: string,
    dto: UpdateKeyDto,
  ): Promise<KeyView> {
    const key = await this.owned(sellerId, keyId);

    const data: Prisma.SellerKeyUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label ?? null;
    if (dto.maxUses !== undefined) {
      if (dto.maxUses !== null && dto.maxUses < key.usedCount) {
        throw new ConflictError(
          'key_max_uses_below_used',
          `This key has already been redeemed ${key.usedCount} time(s)`,
        );
      }
      data.maxUses = dto.maxUses ?? null;
    }
    if (dto.expiresAt !== undefined) {
      const next = dto.expiresAt ? new Date(dto.expiresAt) : null;
      // Only a *new* past date is a mistake. Resending the key's own expiry is how a form
      // that edits the label behaves, and refusing it made an expired key uneditable.
      const unchanged = next?.getTime() === key.expiresAt?.getTime();
      if (next && !unchanged && next.getTime() <= Date.now()) {
        throw new BadRequestError(
          'key_expiry_in_past',
          'Expiry must be in the future',
        );
      }
      data.expiresAt = next;
    }

    const row = await this.prisma.sellerKey.update({
      where: { id: keyId },
      data,
      include: { script: { select: SCRIPT_FIELDS } },
    });
    return view(row);
  }

  async revoke(sellerId: string, keyId: string): Promise<KeyView> {
    const key = await this.owned(sellerId, keyId);
    if (key.status === 'REVOKED') {
      throw new ConflictError('key_already_revoked', 'Key is already revoked');
    }
    return this.setStatus(keyId, 'REVOKED');
  }

  /**
   * Undo a revoke.
   *
   * Buyers who already redeemed keep their access either way — revoking never took an
   * entitlement back — so this only reopens the key to *future* redemptions.
   */
  async restore(sellerId: string, keyId: string): Promise<KeyView> {
    const key = await this.owned(sellerId, keyId);
    if (key.status === 'ACTIVE') {
      throw new ConflictError('key_not_revoked', 'Key is not revoked');
    }
    return this.setStatus(keyId, 'ACTIVE');
  }

  /**
   * Delete a key outright — only while it has never been redeemed.
   *
   * Once a buyer used it the row is the record of how they got in; deleting it would leave
   * an entitlement nobody can explain. Revoking is the answer for those.
   */
  async remove(sellerId: string, keyId: string): Promise<void> {
    const key = await this.owned(sellerId, keyId);
    // `usedCount` can sit at 0 for a key that *was* redeemed — a second shop-wide key
    // grants nothing new, so it never burns a use, yet it is still how that buyer got in.
    const redemptions = await this.prisma.keyRedemption.count({ where: { keyId } });
    if (key.usedCount > 0 || redemptions > 0) {
      throw new ConflictError(
        'key_already_used',
        'This key has been redeemed — revoke it instead of deleting it',
      );
    }
    await this.prisma.sellerKey.delete({ where: { id: keyId } });
  }

  /** Who turned this key into access — the answer `usedCount` alone could never give. */
  async redemptions(sellerId: string, keyId: string) {
    await this.owned(sellerId, keyId);

    const rows = await this.prisma.keyRedemption.findMany({
      where: { keyId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            userEmail: true,
            userName: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      redeemedAt: row.createdAt,
      member: row.member,
    }));
  }

  /**
   * The current filter as a CSV sheet, for handing a batch to a reseller.
   *
   * Capped, and the cap is reported rather than hidden: a silently short sheet is how a
   * seller ends up believing they sent a reseller every key they issued.
   */
  async exportCsv(
    sellerId: string,
    dto: ListKeysDto,
  ): Promise<{ csv: string; truncated: boolean }> {
    const rows = await this.prisma.sellerKey.findMany({
      where: this.filter(sellerId, dto),
      orderBy: { createdAt: 'desc' },
      take: EXPORT_CAP + 1,
      include: { script: { select: SCRIPT_FIELDS } },
    });

    const truncated = rows.length > EXPORT_CAP;
    if (truncated) rows.length = EXPORT_CAP;

    const header = [
      'key',
      'mini_app',
      'label',
      'state',
      'used_count',
      'max_uses',
      'expires_at',
      'created_at',
    ];
    const lines = rows.map((row) => {
      const v = view(row);
      return [
        v.key,
        v.script?.name ?? '',
        v.label ?? '',
        v.state,
        String(v.usedCount),
        v.maxUses === null ? '' : String(v.maxUses),
        v.expiresAt?.toISOString() ?? '',
        v.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(',');
    });

    // Leading BOM so Excel reads Vietnamese labels as UTF-8 instead of mojibake.
    return {
      csv: `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`,
      truncated,
    };
  }

  private async setStatus(
    keyId: string,
    status: 'ACTIVE' | 'REVOKED',
  ): Promise<KeyView> {
    const row = await this.prisma.sellerKey.update({
      where: { id: keyId },
      data: { status },
      include: { script: { select: SCRIPT_FIELDS } },
    });
    return view(row);
  }

  private async owned(sellerId: string, keyId: string): Promise<SellerKey> {
    const key = await this.prisma.sellerKey.findFirst({
      where: { id: keyId, sellerId },
    });
    if (!key) throw new NotFoundError('key_not_found', 'Key not found');
    return key;
  }

  /** Shared by list, export and stats, so one filter never means two different things. */
  private filter(
    sellerId: string,
    dto: ListKeysDto,
  ): Prisma.SellerKeyWhereInput {
    const where: Prisma.SellerKeyWhereInput = { sellerId };
    const now = new Date();
    // Everything stacks into AND, because `q` already owns the top-level OR.
    const and: Prisma.SellerKeyWhereInput[] = [];

    if (dto.scriptId) {
      where.scriptId = dto.scriptId === 'none' ? null : dto.scriptId;
    }
    if (dto.q) {
      and.push({
        OR: [
          { key: { contains: dto.q } },
          { label: { contains: dto.q } },
        ],
      });
    }

    switch (dto.state) {
      case 'REVOKED':
        and.push({ status: 'REVOKED' });
        break;
      case 'EXPIRED':
        and.push({ status: 'ACTIVE' }, { expiresAt: { lt: now } });
        break;
      case 'EXHAUSTED':
        and.push(
          { status: 'ACTIVE' },
          notExpired(now),
          { maxUses: { not: null } },
          { usedCount: { gte: this.prisma.sellerKey.fields.maxUses } },
        );
        break;
      case 'ACTIVE':
        and.push({ status: 'ACTIVE' }, notExpired(now), {
          OR: [
            { maxUses: null },
            { usedCount: { lt: this.prisma.sellerKey.fields.maxUses } },
          ],
        });
        break;
      default:
        break;
    }

    if (and.length) where.AND = and;
    return where;
  }
}

/**
 * "Has not expired", written so a key with no expiry actually matches.
 *
 * `{ expiresAt: { not: { lt: now } } }` reads like it should, but SQL's three-valued logic
 * makes `NOT (NULL < now)` NULL — never true — which silently hid every never-expiring key
 * from the ACTIVE filter.
 */
function notExpired(now: Date): Prisma.SellerKeyWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

function view(row: KeyRow): KeyView {
  return { ...row, state: stateOf(row) };
}

function stateOf(key: SellerKey): KeyState {
  if (key.status === 'REVOKED') return 'REVOKED';
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return 'EXPIRED';
  if (key.maxUses !== null && key.usedCount >= key.maxUses) return 'EXHAUSTED';
  return 'ACTIVE';
}

/** `Khách A` + 3 keys ⇒ `Khách A #1`, `Khách A #2`, `Khách A #3`. */
function labelFor(
  label: string | undefined,
  index: number,
  quantity: number,
): string | null {
  if (!label) return null;
  if (quantity === 1) return label;
  const suffix = ` #${index + 1}`;
  return `${label.slice(0, 100 - suffix.length)}${suffix}`;
}

/**
 * One CSV cell.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not decoration: a seller can name a key
 * label anything, and Excel executes a cell that starts with one of those as a formula. The
 * label is the seller's own text, but the sheet is often forwarded to a reseller.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
