import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BuyerIdentity } from './flowdesk.service';
import type { BuyerRequest } from './app-auth.guard';

/** The flowdesk user behind the request — populated by `AppAuthGuard`. */
export const CurrentBuyer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BuyerIdentity => {
    const req = ctx.switchToHttp().getRequest<BuyerRequest>();
    if (!req.buyer) {
      throw new Error('CurrentBuyer used on a route without AppAuthGuard');
    }
    return req.buyer;
  },
);
