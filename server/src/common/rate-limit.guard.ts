/**
 * A small fixed-window rate limiter for the handful of endpoints worth guessing at:
 * sign-in, registration, and key redemption.
 *
 * In-process and per-instance on purpose — the legacy stack's limiter worked the same way.
 * It is a speed bump against credential stuffing and key-space scanning, not a distributed
 * quota; running several API replicas multiplies the allowance, and that is an accepted
 * trade for keeping a shared store out of the request path.
 *
 * Two buckets, because one is always wrong somewhere:
 *
 * * **per subject** — the email being tried, so one account cannot be hammered even when
 *   every portal user arrives from the same proxy address.
 * * **per client** — a looser cap on raw volume from one address.
 *
 * The client address is `request.ip`, never a raw `x-forwarded-for`: whoever connects can
 * write that header, so bucketing on it would let an attacker rotate it for unlimited
 * guesses, or pin a victim's address to lock them out. See `TRUST_PROXY` in main.ts for
 * when Express is allowed to resolve it.
 *
 *   @UseGuards(RateLimitGuard)
 *   @RateLimit({ limit: 10, windowMs: 60_000, subjectField: 'email', clientLimit: 60 })
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TooManyRequestsError } from './errors';

export interface RateLimitOptions {
  /** Attempts allowed per window against one subject (or one client, without a subject). */
  limit: number;
  windowMs: number;
  /** Body field naming what is being attacked — usually the email being signed into. */
  subjectField?: string;
  /** Looser cap on everything one address sends to this route. Defaults to `limit`. */
  clientLimit?: number;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

interface Window {
  count: number;
  resetAt: number;
}

/** Shared across guard instances so per-controller usage still counts one client once. */
const windows = new Map<string, Window>();
let lastSweep = 0;

/** Drop expired buckets now and then, so a scan cannot grow the map without bound. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Count one hit, and report how long the caller must wait if the bucket is full. */
function take(key: string, limit: number, windowMs: number, now: number): number {
  const window = windows.get(key);

  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  if (window.count >= limit) {
    return Math.ceil((window.resetAt - now) / 1000);
  }

  window.count += 1;
  return 0;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      body?: Record<string, unknown>;
      socket?: { remoteAddress?: string };
    }>();

    const now = Date.now();
    sweep(now);

    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const client = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const subject = options.subjectField
      ? request.body?.[options.subjectField]
      : undefined;

    const waits = [
      take(
        `${route}|client|${client}`,
        options.clientLimit ?? options.limit,
        options.windowMs,
        now,
      ),
      typeof subject === 'string' && subject
        ? take(
            `${route}|subject|${subject.trim().toLowerCase()}`,
            options.limit,
            options.windowMs,
            now,
          )
        : 0,
    ];

    const wait = Math.max(...waits);
    if (wait > 0) {
      throw new TooManyRequestsError(
        'rate_limited',
        `Too many attempts — try again in ${wait}s`,
      );
    }

    return true;
  }
}
