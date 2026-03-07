import { Module } from '@nestjs/common'
import { PricesModule } from '../prices/prices.module'
import { JobsController } from './jobs.controller'
import { JobsService } from './jobs.service'

@Module({
  imports: [PricesModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
