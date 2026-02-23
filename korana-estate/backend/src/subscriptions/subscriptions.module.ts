import { Module } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, RolesGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
