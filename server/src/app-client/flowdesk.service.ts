/**
 * The buyer identity boundary.
 *
 * End users do **not** have store accounts — they authenticate against flowdesk, and the
 * store only ever *verifies* the token they present. It never creates, stores, or checks
 * a flowdesk password. See `docs/mini-app-licensing.md` §1.
 *
 * Everything flowdesk-specific lives here so the rest of the app client deals in a plain
 * `BuyerIdentity`.
 */

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BuyerIdentity {
  id: string;
  email: string | null;
  name: string | null;
}

const REQUEST_TIMEOUT_MS = 8_000;

@Injectable()
export class FlowdeskService {
  private readonly logger = new Logger(FlowdeskService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('FLOWDESK_BASE_URL', '')
      .trim()
      .replace(/\/+$/, '');
  }

  get configured(): boolean {
    return this.baseUrl !== '';
  }

  /**
   * Resolve an access token to a buyer. A token the upstream rejects is a 401 for us too;
   * anything else (upstream down, misconfigured) is a 503 — never a silent "not allowed".
   */
  async verifyToken(accessToken: string): Promise<BuyerIdentity> {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        code: 'flowdesk_unconfigured',
        message:
          'Buyer authentication is not configured (FLOWDESK_BASE_URL is unset)',
      });
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`flowdesk /users/me unreachable: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'flowdesk_unreachable',
        message: 'Could not reach the account service',
      });
    }

    if (res.status === 401 || res.status === 403) {
      throw new UnauthorizedException({
        code: 'invalid_app_token',
        message: 'Account token is not valid',
      });
    }
    if (!res.ok) {
      this.logger.error(`flowdesk /users/me returned ${res.status}`);
      throw new ServiceUnavailableException({
        code: 'flowdesk_error',
        message: 'Account service returned an error',
      });
    }

    return this.toIdentity(await res.json());
  }

  /**
   * flowdesk has wrapped the user object differently across versions, so accept either a
   * bare object or one nested under `data`/`user`, and require only a usable id.
   */
  private toIdentity(body: unknown): BuyerIdentity {
    let node = (body ?? {}) as Record<string, unknown>;
    for (const key of ['data', 'user']) {
      const nested = node[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        node = nested as Record<string, unknown>;
        break;
      }
    }

    const rawId = node.id ?? node._id ?? node.uuid;
    const id =
      typeof rawId === 'string'
        ? rawId
        : typeof rawId === 'number'
          ? String(rawId)
          : '';

    if (!id) {
      this.logger.error('flowdesk /users/me response had no usable id');
      throw new ServiceUnavailableException({
        code: 'flowdesk_error',
        message: 'Account service returned an unexpected response',
      });
    }

    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return {
      id,
      email: str(node.email),
      name: str(node.name) ?? str(node.username) ?? str(node.fullName),
    };
  }
}
