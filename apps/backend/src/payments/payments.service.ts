import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OrderStatus, PaymentProvider, PaymentStatus, PayoutStatus } from '@prisma/client'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentWebhookDto } from './dto/webhook.dto'
import { PaymentProviderService } from './payment-provider.service'

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProviderService,
  ) {}

  async createPaymentIntent(dto: CreatePaymentDto, buyerId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== buyerId) throw new BadRequestException('Invalid order owner')

    const amount = Number(order.totalAmount)
    const created = await this.paymentProvider.createPayment(dto.provider as PaymentProvider, order.id, amount, 'INR')

    return this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: dto.provider as PaymentProvider,
        providerPaymentId: created.providerPaymentId,
        amount,
        currency: created.currency,
        status: PaymentStatus.CREATED,
      },
    })
  }

  verifyWebhookSignature(rawBody: string, signatureHeader?: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET
    if (!secret) throw new BadRequestException('Webhook secret not configured')
    if (!signatureHeader) throw new BadRequestException('Missing webhook signature')

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedBuf = Buffer.from(expected)
    const actualBuf = Buffer.from(signatureHeader)
    if (expectedBuf.length !== actualBuf.length) {
      throw new BadRequestException('Invalid webhook signature')
    }
    const valid = crypto.timingSafeEqual(expectedBuf, actualBuf)
    if (!valid) throw new BadRequestException('Invalid webhook signature')
  }

  async processWebhook(dto: PaymentWebhookDto) {
    const existing = await this.prisma.payment.findUnique({ where: { providerPaymentId: dto.providerPaymentId } })

    // Idempotency/finality: once SUCCESS, do not downgrade.
    if (existing?.status === PaymentStatus.SUCCESS) {
      return { ok: true, idempotent: true }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: {
          include: {
            retailProduct: {
              select: { sellerId: true },
            },
          },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')

    const payment = existing
      ? await this.prisma.payment.update({
          where: { id: existing.id },
          data: { status: dto.status === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED },
        })
      : await this.prisma.payment.create({
          data: {
            orderId: dto.orderId,
            provider: dto.provider as PaymentProvider,
            providerPaymentId: dto.providerPaymentId,
            amount: dto.amount,
            currency: dto.currency ?? 'INR',
            status: dto.status === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
          },
        })

    if (payment.status !== PaymentStatus.SUCCESS) {
      return { ok: true, paymentId: payment.id }
    }

    if (order.status !== OrderStatus.PAID) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paymentRef: payment.providerPaymentId,
        },
      })
    }

    // Escrow/payout recording: create pending seller payouts once per order.
    const payoutExists = await this.prisma.payout.findFirst({ where: { orderId: order.id } })
    if (!payoutExists) {
      const totalAmount = Number(order.totalAmount)
      const platformFee = Number(order.platformFee)

      const grossBySeller = new Map<string, number>()
      for (const item of order.items) {
        const sellerId = item.retailProduct.sellerId
        const gross = Number(item.lineTotal)
        grossBySeller.set(sellerId, (grossBySeller.get(sellerId) ?? 0) + gross)
      }

      const payouts = [...grossBySeller.entries()].map(([sellerId, gross]) => {
        const feeShare = totalAmount > 0 ? (gross / totalAmount) * platformFee : 0
        const amount = Math.max(0, gross - feeShare)
        return {
          sellerId,
          orderId: order.id,
          amount,
          status: PayoutStatus.PENDING,
          releaseEligibleAt: order.status === OrderStatus.CONFIRMED ? new Date() : null,
        }
      })

      if (payouts.length) {
        await this.prisma.payout.createMany({ data: payouts })
      }
    }

    return { ok: true, paymentId: payment.id }
  }
}
