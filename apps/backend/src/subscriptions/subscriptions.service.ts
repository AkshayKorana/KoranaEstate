import { Injectable, NotFoundException } from '@nestjs/common'
import { PlanType, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto'

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMySubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async upsertForUser(userId: string, dto: UpsertSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.subscription.create({
      data: {
        userId,
        planType: dto.planType as PlanType,
        status: dto.status as SubscriptionStatus,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    })
  }

  async hasActivePro(userId: string) {
    const now = new Date()
    const active = await this.prisma.subscription.findFirst({
      where: {
        userId,
        planType: PlanType.PRO,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Boolean(active)
  }
}
