import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { SubscriptionsService } from '../../subscriptions/subscriptions.service'

@Injectable()
export class ProSubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { userId?: string } }>()
    const userId = request.user?.userId
    if (!userId) throw new UnauthorizedException('Unauthorized')

    const hasPro = await this.subscriptionsService.hasActivePro(userId)
    if (!hasPro) {
      throw new ForbiddenException('PRO subscription required for this endpoint')
    }

    return true
  }
}
