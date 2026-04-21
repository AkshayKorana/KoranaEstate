import { Module } from '@nestjs/common'
import { NotificationService } from '../notifications/notification.service'
import { PricesModule } from '../prices/prices.module'
import { JobsController } from './jobs.controller'
import { JobsService } from './jobs.service'

@Module({
  imports: [PricesModule],
  controllers: [JobsController],
  providers: [JobsService, NotificationService],
})
export class JobsModule {}
