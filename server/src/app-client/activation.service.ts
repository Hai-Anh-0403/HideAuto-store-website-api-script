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
    const key = await this.prisma.sellerKey.findUnique({
      where: { key: rawKey.trim() },
    });

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

    const existing = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId: key.sellerId, userId: buyer.id } },
    });

    // A shop-wide key (scriptId === null) unlocks everything; otherwise add just that app.
    const shopWide = key.scriptId === null;
    const scriptIds = new Set(existing?.scriptIds ?? []);
    if (key.scriptId) scriptIds.add(key.scriptId);

    const alreadyEntitled =
      existing !== null &&
      (shopWide
        ? existing.allScripts
        : key.scriptId !== null && existing.scriptIds.includes(key.scriptId));

    const [member] = await this.prisma.$transaction([
      this.prisma.sellerMember.upsert({
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
      }),
      // Don't burn a use when the key grants nothing new — re-entering a key the buyer
      // already redeemed (a reinstall, say) shouldn't eat their remaining uses.
      ...(alreadyEntitled
        ? []
        : [
            this.prisma.sellerKey.update({
              where: { id: key.id },
              data: { usedCount: { increment: 1 } },
            }),
          ]),
    ]);

    return member;
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
    const { script } = await this.authorize(buyer, scriptId, {
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

    // Best effort: a failed presence update must never cost the buyer their activation.
    try {
      await this.touch(buyer, script.sellerId);
    } catch (err) {
      this.logger.warn(
        `presence update after activation failed for ${buyer.id}: ${(err as Error).message}`,
      );
    }
    return signed;
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
