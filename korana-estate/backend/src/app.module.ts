import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { MarketplaceModule } from './marketplace/marketplace.module'
import { StoreModule } from './store/store.module'
import { OrdersModule } from './orders/orders.module'
import { ChatModule } from './chat/chat.module'
import { MarketIntelligenceModule } from './market-intelligence/market-intelligence.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { PaymentsModule } from './payments/payments.module'
import { AdminModule } from './admin/admin.module'
import { HealthController } from './health.controller'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    MarketplaceModule,
    StoreModule,
    OrdersModule,
    ChatModule,
    MarketIntelligenceModule,
    SubscriptionsModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
