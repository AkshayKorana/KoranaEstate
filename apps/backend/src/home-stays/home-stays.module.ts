import { Module } from '@nestjs/common'
import { HomeStaysController } from './home-stays.controller'
import { HomeStaysService } from './home-stays.service'

@Module({
  controllers: [HomeStaysController],
  providers: [HomeStaysService],
})
export class HomeStaysModule {}
