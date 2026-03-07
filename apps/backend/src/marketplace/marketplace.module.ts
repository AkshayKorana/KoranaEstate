import { Module } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { MarketplaceController } from './marketplace.controller'
import { MarketplaceService } from './marketplace.service'

@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceService, RolesGuard],
})
export class MarketplaceModule {}
