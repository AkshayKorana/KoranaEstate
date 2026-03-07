import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DisputeStatus, OrderStatus, PayoutStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDisputeDto } from './dto/create-dispute.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { CreateReviewDto } from './dto/create-review.dto'
import { UpdateCommissionRateDto } from './dto/update-commission-rate.dto'

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const totalAmount = dto.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)
    const commissionRate = await this.getCommissionRate()
    const platformFee = totalAmount * commissionRate
    const sellerPayout = totalAmount - platformFee

    return this.prisma.order.create({
      data: {
        buyerId,
        status: OrderStatus.PENDING,
        totalAmount,
        commissionRate,
        platformFee,
        sellerPayout,
        shippingAddress: dto.shippingAddress,
        items: {
          create: dto.items.map((item) => ({
            retailProductId: item.retailProductId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity,
          })),
        },
      },
      include: { items: true },
    })
  }

  listBuyerOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getCommissionRate() {
    const config = await this.prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, commissionRate: 0.05 },
    })
    return Number(config.commissionRate)
  }

  async updateCommissionRate(dto: UpdateCommissionRateDto) {
    return this.prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: { commissionRate: dto.commissionRate },
      create: { id: 1, commissionRate: dto.commissionRate },
    })
  }

  async raiseDispute(orderId: string, userId: string, dto: CreateDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can raise dispute on this order')

    const existingOpen = await this.prisma.dispute.findFirst({
      where: { orderId, status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } },
    })
    if (existingOpen) return existingOpen

    return this.prisma.dispute.create({
      data: {
        orderId,
        raisedByUserId: userId,
        reason: dto.reason,
      },
    })
  }

  async confirmOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can confirm this order')

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED },
    })

    await this.prisma.payout.updateMany({
      where: { orderId, status: PayoutStatus.PENDING, releaseEligibleAt: null },
      data: { releaseEligibleAt: new Date() },
    })

    return updated
  }

  async createReview(orderId: string, userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            retailProduct: { select: { sellerId: true } },
          },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can review this order')

    const sellerTotals = new Map<string, number>()
    for (const item of order.items) {
      const sellerId = item.retailProduct.sellerId
      const line = Number(item.lineTotal)
      sellerTotals.set(sellerId, (sellerTotals.get(sellerId) ?? 0) + line)
    }
    const sellerIds = [...sellerTotals.keys()]
    if (!sellerIds.length) throw new BadRequestException('No seller found on this order')

    let targetSellerId = dto.targetSellerId ?? null
    if (targetSellerId) {
      if (!sellerTotals.has(targetSellerId)) {
        throw new BadRequestException('targetSellerId is not part of this order')
      }
    } else {
      targetSellerId = sellerIds.sort((a, b) => (sellerTotals.get(b) ?? 0) - (sellerTotals.get(a) ?? 0))[0]
    }

    const existing = await this.prisma.review.findFirst({
      where: { authorId: userId, targetId: targetSellerId, orderId },
    })
    const review =
      existing ??
      (await this.prisma.review.create({
        data: {
          authorId: userId,
          targetId: targetSellerId,
          orderId,
          rating: dto.rating,
          comment: dto.comment,
        },
      }))

    await this.recalculateSellerRating(targetSellerId)
    return review
  }

  private async recalculateSellerRating(sellerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { targetId: sellerId },
      include: {
        order: { select: { totalAmount: true } },
      },
    })

    const totalReviews = reviews.length
    const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = totalReviews ? totalRating / totalReviews : 0

    const weighted = reviews.reduce(
      (acc, r) => {
        const weight = r.order ? Number(r.order.totalAmount) : 1
        return {
          weightedSum: acc.weightedSum + r.rating * weight,
          weightTotal: acc.weightTotal + weight,
        }
      },
      { weightedSum: 0, weightTotal: 0 },
    )
    const weightedScore = weighted.weightTotal > 0 ? weighted.weightedSum / weighted.weightTotal : 0

    await this.prisma.sellerRating.upsert({
      where: { sellerId },
      update: {
        averageRating,
        totalReviews,
        weightedScore,
      },
      create: {
        sellerId,
        averageRating,
        totalReviews,
        weightedScore,
      },
    })
  }
}
