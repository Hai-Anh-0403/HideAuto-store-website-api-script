import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestUser } from './decorators/current-user.decorator';

@Injectable()
export class SellerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user || user.role !== 'seller') {
      throw new ForbiddenException('Seller access required');
    }

    return true;
  }
}
