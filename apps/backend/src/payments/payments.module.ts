import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentProviderService } from './payment-provider.service'
import { PaymentsService } from './payments.service'

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderService],
})
export class PaymentsModule {}
