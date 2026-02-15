import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type CommodityPoint = { date: Date; price: number }
type CommodityResponse = {
  name: string
  currentPrice: number
  historicalPrices: CommodityPoint[]
  source: string
}

const COMMODITIES = [
  { name: 'Arabica', type: 'Coffee', fallbackPrice: 520 },
  { name: 'Robusta', type: 'Coffee', fallbackPrice: 450 },
  { name: 'Pepper', type: 'Spice', fallbackPrice: 650 },
  { name: 'Cardamom', type: 'Spice', fallbackPrice: 1200 },
]

function fallbackSeries(basePrice: number): CommodityPoint[] {
  const now = Date.now()
  return Array.from({ length: 7 }, (_, i) => {
    const dayOffset = 6 - i
    const drift = Math.round(basePrice * (Math.sin(i * 1.3) * 0.015))
    return {
      date: new Date(now - dayOffset * 24 * 60 * 60 * 1000),
      price: Math.max(1, basePrice + drift),
    }
  })
}

export async function GET() {
  try {
    const data: CommodityResponse[] = []
    const insights: Record<string, string> = {}

    for (const commodity of COMMODITIES) {
      const history = await prisma.commodity.findMany({
        where: { name: commodity.name, type: commodity.type },
        orderBy: { createdAt: 'desc' },
        take: 7,
      })

      const historicalPrices =
        history.length > 0
          ? history
              .map((h) => ({ date: h.createdAt, price: h.price }))
              .reverse()
          : fallbackSeries(commodity.fallbackPrice)

      const currentPrice = historicalPrices[historicalPrices.length - 1]?.price ?? commodity.fallbackPrice
      const previousPrice = historicalPrices[historicalPrices.length - 2]?.price

      if (previousPrice == null) {
        insights[commodity.name] = 'Insufficient data for trend; monitoring.'
      } else if (currentPrice > previousPrice) {
        insights[commodity.name] = 'Short-term trend: up.'
      } else if (currentPrice < previousPrice) {
        insights[commodity.name] = 'Short-term trend: down.'
      } else {
        insights[commodity.name] = 'Short-term trend: stable.'
      }

      data.push({
        name: commodity.name,
        currentPrice,
        historicalPrices,
        source: history[0]?.source || 'Synthetic',
      })
    }

    return NextResponse.json({
      data,
      insights,
      lastUpdated: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Commodities API error:', err)
    return NextResponse.json(
      { data: [], insights: {}, lastUpdated: new Date().toISOString() },
      { status: 500 }
    )
  }
}
