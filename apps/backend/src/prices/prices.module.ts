import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PricesController } from './prices.controller'
import { PricesIngestService } from './prices-ingest.service'
import { PricesService } from './prices.service'

@Module({
  imports: [PrismaModule],
  controllers: [PricesController],
  providers: [PricesService, PricesIngestService],
  exports: [PricesService, PricesIngestService],
})
export class PricesModule {}
