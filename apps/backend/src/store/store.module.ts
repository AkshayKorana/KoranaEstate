import { Module } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { StoreController } from './store.controller'
import { StoreService } from './store.service'

@Module({
  controllers: [StoreController],
  providers: [StoreService, RolesGuard],
})
export class StoreModule {}
