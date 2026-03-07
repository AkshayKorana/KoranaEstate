import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DisputeStatus, OrderStatus, PayoutStatus, PlanType, SubscriptionStatus, VerificationLevel } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { HoldPayoutDto } from './dto/hold-payout.dto'
import { ResolveDisputeDto } from './dto/resolve-dispute.dto'
import { VerifyUserDto } from './dto/verify-user.dto'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics() {
    const [gmvAgg, commissionAgg, totalOrders, activeProUsers] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED] } },
        _sum: { platformFee: true },
      }),
      this.prisma.order.count(),
      this.prisma.subscription.count({
        where: {
          planType: PlanType.PRO,
          status: SubscriptionStatus.ACTIVE,
          endDate: { gt: new Date() },
        },
      }),
    ])

    return {
      totalGmv: Number(gmvAgg._sum.totalAmount ?? 0),
      totalCommissionEarned: Number(commissionAgg._sum.platformFee ?? 0),
      activeProUsers,
      totalOrders,
    }
  }

  async releasePayout(payoutId: string, adminId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { order: true },
    })
    if (!payout) throw new NotFoundException('Payout not found')
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Only pending payouts can be released')
    }
    if (payout.holdReason) {
      throw new BadRequestException('Payout is on hold and cannot be released')
    }
    if (payout.order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Payout release requires order status CONFIRMED')
    }
    if (!payout.releaseEligibleAt || payout.releaseEligibleAt > new Date()) {
      throw new BadRequestException('Payout not yet eligible for release')
    }

    const openDispute = await this.prisma.dispute.findFirst({
      where: {
        orderId: payout.orderId,
        status: DisputeStatus.OPEN,
      },
    })
    if (openDispute) {
      throw new BadRequestException('Payout blocked due to open dispute')
    }

    return this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.TRANSFERRED,
        transferredAt: new Date(),
        releasedBy: adminId,
      },
    })
  }

  async holdPayout(payoutId: string, dto: HoldPayoutDto) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } })
    if (!payout) throw new NotFoundException('Payout not found')
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('Only pending payouts can be held')
    }

    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { holdReason: dto.holdReason },
    })
  }

  listDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        order: true,
        raisedByUser: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } })
    if (!dispute) throw new NotFoundException('Dispute not found')
    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) {
      return dispute
    }

    const nextStatus = (dto.status ?? 'RESOLVED') as DisputeStatus
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
      },
    })
  }

  async verifyUser(userId: string, dto: VerifyUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: dto.verified,
        verificationLevel: dto.verificationLevel as VerificationLevel,
        sellerVerified: dto.verified ? true : user.sellerVerified,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        verified: true,
        verificationLevel: true,
        sellerVerified: true,
      },
    })
  }
}
