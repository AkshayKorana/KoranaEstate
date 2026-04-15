import { Module } from '@nestjs/common'
import { RolesGuard } from '../common/guards/roles.guard'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { NotificationService } from '../notifications/notification.service'

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, NotificationService, RolesGuard],
})
export class OrdersModule {}
