/**
 * Key redemption, entitlements and licence issuance for end users.
 *
 * Two different gates live here, and they are not the same thing:
 *
 * * **Entitlement** — may this buyer *download* this mini app? Granted by redeeming a key,
 *   recorded on `SellerMember`.
 * * **Licence** — may the already-downloaded package *run* on this machine? A short-lived
 *   signed blob the app re-checks, which is what makes revocation and device blocking bite.
 *
 * See `docs/mini-app-licensing.md` §2 and §4.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Script, SellerMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService, type SignedLicense } from '../licensing/license.service';
import { ForbiddenError, NotFoundError } from '../common/errors';
import { normalizeKeyCode } from '../keys/key-code';
import type { BuyerIdentity } from './flowdesk.service';

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly license: LicenseService,
  ) {}

  /**
   * Redeem a key, creating or extending this buyer's membership with the seller.
   *
   * Redeeming twice is not an error: the same user keeps one membership per seller and
   * simply accumulates unlocked apps.
   */
  async redeem(buyer: BuyerIdentity, rawKey: string): Promise<SellerMember> {
    const key = await this.findKey(rawKey);

    // A revoked key is indistinguishable from a wrong one on purpose — don't confirm
    // that a given key string ever existed.
    if (!key || key.status !== 'ACTIVE') {
      throw new NotFoundError('key_invalid', 'Invalid or inactive key');
    }
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenError('key_expired', 'Key expired');
    }
    if (key.maxUses !== null && key.usedCount >= key.maxUses) {
      throw new ForbiddenError('key_exhausted', 'Key usage limit reached');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: key.sellerId },
      select: { status: true },
    });
    if (!seller || seller.status !== 'APPROVED') {
      throw new ForbiddenError('seller_unavailable', 'Seller not available');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sellerMember.findUnique({
        where: { sellerId_userId: { sellerId: key.sellerId, userId: buyer.id } },
      });

      // A blocked buyer gets nothing from a key, so it must not cost them one — burning a
      // use here would quietly consume a key the seller sold to someone else.
      if (existing?.status === 'BLOCKED') {
        throw new ForbiddenError(
          'member_blocked',
          'Your access to this seller has been blocked',
        );
      }

      // A shop-wide key (scriptId === null) unlocks everything; otherwise add just that app.
      const shopWide = key.scriptId === null;
      const scriptIds = new Set(existing?.scriptIds ?? []);
      if (key.scriptId) scriptIds.add(key.scriptId);

      const alreadyEntitled =
        existing !== null &&
        (shopWide
          ? existing.allScripts
          : key.scriptId !== null && existing.scriptIds.includes(key.scriptId));

      // Don't burn a use when the key grants nothing new — re-entering a key the buyer
      // already redeemed (a reinstall, say) shouldn't eat their remaining uses.
      if (!alreadyEntitled) {
        // Claim the use with the quota re-checked *inside* the update. The read above can
        // go stale between two concurrent redeems; this cannot — Postgres locks the row,
        // so the last remaining use is handed to exactly one of them.
        const claimed = await tx.sellerKey.updateMany({
          where: {
            id: key.id,
            status: 'ACTIVE',
            OR: [
              { maxUses: null },
              { usedCount: { lt: this.prisma.sellerKey.fields.maxUses } },
            ],
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new ForbiddenError('key_exhausted', 'Key usage limit reached');
        }
      }

      const member = await tx.sellerMember.upsert({
        where: { sellerId_userId: { sellerId: key.sellerId, userId: buyer.id } },
        create: {
          sellerId: key.sellerId,
          userId: buyer.id,
          userEmail: buyer.email,
          userName: buyer.name,
          allScripts: shopWide,
          scriptIds: [...scriptIds],
          lastSeenAt: new Date(),
        },
        update: {
          userEmail: buyer.email,
          userName: buyer.name,
          allScripts: existing?.allScripts || shopWide,
          scriptIds: [...scriptIds],
          lastSeenAt: new Date(),
          // `status` is deliberately NOT reset here. The old Python flipped BLOCKED back
          // to ACTIVE on any redeem, which let a blocked buyer undo the block with a key
          // they already had. Unblocking stays the seller's decision.
        },
      });

      // Provenance, so the seller can answer "who used the key I sold?". Keyed on
      // (key, member): a reinstall re-runs redeem and must not add a second row.
      await tx.keyRedemption.upsert({
        where: { keyId_memberId: { keyId: key.id, memberId: member.id } },
        create: { keyId: key.id, memberId: member.id, scriptId: key.scriptId },
        update: {},
      });

      return member;
    });
  }

  /**
   * Look a key up the way a buyer typed it.
   *
   * Codes are handed over in chat messages and invoices, so the input arrives lowercased,
   * without dashes, or with the `SK` prefix dropped. The exact string is tried first —
   * that is the only thing that can match a legacy 32-hex key — then the canonical form of
   * whatever was typed. `normalizeKeyCode` refuses ambiguous characters rather than
   * guessing, so this can never resolve a typo onto a different seller's key.
   */
  private async findKey(rawKey: string) {
    const trimmed = rawKey.trim();
    const exact = await this.prisma.sellerKey.findUnique({
      where: { key: trimmed },
    });
    if (exact) return exact;

    const canonical = normalizeKeyCode(trimmed);
    if (!canonical || canonical === trimmed) return null;
    return this.prisma.sellerKey.findUnique({ where: { key: canonical } });
  }

  /** Every published script this buyer has unlocked, across all sellers. */
  async entitledScripts(buyer: BuyerIdentity): Promise<Script[]> {
    const memberships = await this.prisma.sellerMember.findMany({
      where: { userId: buyer.id, status: 'ACTIVE' },
    });
    if (!memberships.length) return [];

    const sellerIdsWithAll = memberships
      .filter((m) => m.allScripts)
      .map((m) => m.sellerId);
    const scriptIds = memberships.flatMap((m) => m.scriptIds);

    if (!sellerIdsWithAll.length && !scriptIds.length) return [];

    return this.prisma.script.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          ...(sellerIdsWithAll.length
            ? [{ sellerId: { in: sellerIdsWithAll } }]
            : []),
          ...(scriptIds.length ? [{ id: { in: scriptIds } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: { tags: { select: { id: true, name: true, slug: true, color: true } } },
    });
  }

  /**
   * Resolve the buyer's access to one script, optionally redeeming a key first.
   *
   * `machineId` is checked against the seller's block list, so blocking a device takes
   * effect on the next licence renewal even for an already-installed app.
   */
  async authorize(
    buyer: BuyerIdentity,
    scriptId: string,
    opts: { key?: string; machineId?: string } = {},
  ): Promise<{ script: Script; member: SellerMember }> {
    const script = await this.prisma.script.findUnique({
      where: { id: scriptId },
    });
    if (!script) {
      throw new NotFoundError('script_not_found', 'Mini app not found');
    }
    if (script.status !== 'PUBLISHED') {
      throw new ForbiddenError(
        'script_not_published',
        'This mini app is not on the store',
      );
    }

    // Suspending a shop has to stop delivery too: without this the store keeps handing out
    // downloads and fresh licences for a seller an admin has just taken off the platform.
    const seller = await this.prisma.seller.findUnique({
      where: { id: script.sellerId },
      select: { status: true },
    });
    if (!seller || seller.status !== 'APPROVED') {
      throw new ForbiddenError('seller_unavailable', 'Seller not available');
    }

    // Redeem first: a key sent with the request is how a fresh install unlocks the app.
    if (opts.key) {
      await this.redeem(buyer, opts.key);
    }

    const member = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId: script.sellerId, userId: buyer.id } },
    });

    // Blocked is checked before entitlement so a blocked buyer gets a truthful reason
    // instead of being told to enter a key that will not help.
    if (member?.status === 'BLOCKED') {
      throw new ForbiddenError(
        'member_blocked',
        'Your access to this seller has been blocked',
      );
    }
    if (!member || !(member.allScripts || member.scriptIds.includes(scriptId))) {
      // A key was supplied but still didn't unlock this app ⇒ it was for something else.
      throw new ForbiddenError(
        opts.key ? 'key_wrong_app' : 'key_required',
        'This mini app is not unlocked for your account',
      );
    }
    if (opts.machineId && member.blockedDevices.includes(opts.machineId)) {
      throw new ForbiddenError(
        'device_blocked',
        'The seller blocked this device',
      );
    }

    return { script, member };
  }

  /** Activate a packaged mini app on one machine: check access, then sign a licence. */
  async activate(
    buyer: BuyerIdentity,
    scriptId: string,
    machineId: string,
    key?: string,
  ): Promise<SignedLicense> {
    const { script, member } = await this.authorize(buyer, scriptId, {
      key,
      machineId,
    });

    const version = script.latestVersionId
      ? await this.prisma.scriptVersion.findUnique({
          where: { id: script.latestVersionId },
        })
      : null;

    const { issuedAt, expiresAt } = this.license.window();
    const signed = this.license.sign({
      format: 1,
      script_id: script.id,
      // Empty string, not the slug: the packaged app matches this against the appId in
      // its own envelope, and inventing one here would never match.
      app_id: version?.appId ?? '',
      app_name: version?.appName ?? script.name,
      seller_name: script.sellerName,
      user_id: buyer.id,
      user_email: buyer.email ?? '',
      machine_id: machineId,
      issued_at: issuedAt,
      expires_at: expiresAt,
    });

    // Best effort: a failed bookkeeping write must never cost the buyer their activation.
    try {
      await this.touch(buyer, script.sellerId);
      await this.recordDevice(member.id, machineId, script.id);
    } catch (err) {
      this.logger.warn(
        `presence update after activation failed for ${buyer.id}: ${(err as Error).message}`,
      );
    }
    return signed;
  }

  /**
   * Remember the machine this activation came from.
   *
   * Without this row the seller has no way to learn a machine id, and
   * `SellerMember.blockedDevices` — which the licence path already enforces — could only
   * ever stay empty.
   */
  private async recordDevice(
    memberId: string,
    machineId: string,
    scriptId: string,
  ): Promise<void> {
    await this.prisma.memberDevice.upsert({
      where: { memberId_machineId: { memberId, machineId } },
      create: { memberId, machineId, scriptId, activationCount: 1 },
      update: {
        scriptId,
        lastSeenAt: new Date(),
        activationCount: { increment: 1 },
      },
    });
  }

  /** Record that the buyer is alive, so the seller's "online" column means something. */
  async touch(buyer: BuyerIdentity, sellerId?: string): Promise<number> {
    const { count } = await this.prisma.sellerMember.updateMany({
      where: { userId: buyer.id, ...(sellerId ? { sellerId } : {}) },
      data: {
        lastSeenAt: new Date(),
        userEmail: buyer.email,
        userName: buyer.name,
      },
    });
    return count;
  }
}
