import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateMarketPriceDto } from './dto/create-market-price.dto'

@Injectable()
export class MarketIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMarketPriceDto) {
    return this.prisma.marketPrice.create({
      data: {
        commodityName: dto.commodityName,
        market: dto.market,
        priceInrPerKg: dto.priceInrPerKg,
        observedAt: new Date(dto.observedAt),
      },
    })
  }

  chartData(commodityName: string) {
    return this.prisma.marketPrice.findMany({
      where: { commodityName },
      orderBy: { observedAt: 'asc' },
      take: 365,
    })
  }

  async advancedData(commodityName: string) {
    const series = await this.chartData(commodityName)
    const last = series[series.length - 1]
    const prev = series[series.length - 2]

    const latestPrice = last ? Number(last.priceInrPerKg) : null
    const previousPrice = prev ? Number(prev.priceInrPerKg) : null
    const changePct =
      latestPrice != null && previousPrice != null && previousPrice > 0
        ? ((latestPrice - previousPrice) / previousPrice) * 100
        : null

    return {
      series,
      stats: {
        latestPrice,
        previousPrice,
        changePct,
      },
    }
  }
}
