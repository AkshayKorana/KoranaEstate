import { Injectable } from '@nestjs/common'
import { PaymentProvider } from '@prisma/client'

@Injectable()
export class PaymentProviderService {
  /**
   * Integration layer placeholder. Replace internals with SDK calls.
   */
  async createPayment(provider: PaymentProvider, orderId: string, amount: number, currency: string) {
    const providerPaymentId = `${provider.toLowerCase()}_${orderId}_${Date.now()}`
    return { providerPaymentId, amount, currency }
  }
}
