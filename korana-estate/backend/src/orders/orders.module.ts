import { Module } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, RolesGuard],
})
export class OrdersModule {}
