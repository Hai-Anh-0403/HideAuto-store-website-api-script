/**
 * Authenticates end users (the desktop app / a packaged mini app) against flowdesk.
 *
 * Deliberately separate from `JwtAuthGuard`: a store JWT belongs to a *seller* and must
 * never unlock buyer endpoints, and a flowdesk token must never reach the seller portal.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FlowdeskService, type BuyerIdentity } from './flowdesk.service';

export interface BuyerRequest extends Request {
  buyer?: BuyerIdentity;
  buyerToken?: string;
}

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(private readonly flowdesk: FlowdeskService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<BuyerRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'missing_app_token',
        message: 'Account token required',
      });
    }

    req.buyer = await this.flowdesk.verifyToken(token);
    req.buyerToken = token;
    return true;
  }
}
