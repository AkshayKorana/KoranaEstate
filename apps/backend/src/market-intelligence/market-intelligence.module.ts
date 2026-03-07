import { Module } from '@nestjs/common'
import { ProSubscriptionGuard } from '../common/guards/pro-subscription.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'
import { MarketIntelligenceController } from './market-intelligence.controller'
import { MarketIntelligenceService } from './market-intelligence.service'

@Module({
  imports: [SubscriptionsModule],
  controllers: [MarketIntelligenceController],
  providers: [MarketIntelligenceService, RolesGuard, ProSubscriptionGuard],
})
export class MarketIntelligenceModule {}
