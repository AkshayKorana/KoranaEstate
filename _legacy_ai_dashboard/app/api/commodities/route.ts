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
  { name: 'Arabica Cherry', type: 'Coffee', aliases: ['Arabica Coffee Cherry', 'Arabica Cherry Coffee'], noSynthetic: true },
  { name: 'Arabica Parchment', type: 'Coffee', aliases: ['Arabica Coffee Parchment', 'Arabica Parchment Coffee'], noSynthetic: true },
  { name: 'Robusta Cherry', type: 'Coffee', aliases: ['Robusta Coffee Cherry', 'Robusta Cherry Coffee'], noSynthetic: true },
  { name: 'Robusta Parchment', type: 'Coffee', aliases: ['Robusta Coffee Parchment', 'Robusta Parchment Coffee'], noSynthetic: true },
  { name: 'Cardamom', type: 'Spice', aliases: [] as string[], noSynthetic: true },
  { name: 'Arecanut', type: 'Nut', aliases: ['Arcanut'], noSynthetic: true },
  { name: 'Pepper', type: 'Spice', aliases: [] as string[], noSynthetic: true },
]

function istDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function collapseDaily(points: Array<{ date: Date; price: number }>): CommodityPoint[] {
  const grouped = new Map<string, number[]>()
  for (const point of points) {
    const key = istDateKey(point.date)
    const list = grouped.get(key) ?? []
    list.push(point.price)
    grouped.set(key, list)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, values]) => {
      const sorted = [...values].sort((x, y) => x - y)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      return { date: new Date(`${key}T12:00:00.000Z`), price: Number(median.toFixed(2)) }
    })
}

async function getBestHistory(
  commodity: (typeof COMMODITIES)[number]
): Promise<{ historicalPrices: CommodityPoint[]; source: string; hasRealData: boolean }> {
  const names = [commodity.name, ...commodity.aliases]

  const observations = await prisma.priceObservation.findMany({
    where: { commodityName: { in: names } },
    orderBy: { observedAt: 'desc' },
    take: 120,
  })

  if (observations.length > 0) {
    const collapsed = collapseDaily(
      observations
        .map((row) => ({ date: row.observedAt, price: row.inrPerKg }))
        .reverse()
    )
    return {
      historicalPrices: collapsed.slice(-7),
      source: observations[0]?.source || 'Price Observation',
      hasRealData: true,
    }
  }

  const commodityRows = await prisma.commodity.findMany({
    where: { name: { in: names } },
    orderBy: { createdAt: 'desc' },
    take: 120,
  })

  if (commodityRows.length > 0) {
    const collapsed = collapseDaily(
      commodityRows
        .map((row) => ({ date: row.createdAt, price: row.price }))
        .reverse()
    )
    return {
      historicalPrices: collapsed.slice(-7),
      source: commodityRows[0]?.source || 'Commodity Feed',
      hasRealData: true,
    }
  }

  return {
    historicalPrices: [],
    source: 'No data available',
    hasRealData: false,
  }
}

function fallbackSeries(basePrice: number): CommodityPoint[] {
  // DEPRECATED: No longer used - kept for backward compatibility only
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
      const { historicalPrices, source, hasRealData } = await getBestHistory(commodity)

      if (!hasRealData || historicalPrices.length === 0) {
        // No real data available - return clear status
        data.push({
          name: commodity.name,
          currentPrice: 0,
          historicalPrices: [],
          source: 'No market data available',
        })
        insights[commodity.name] = 'Awaiting real market data. Data will appear once sources update.'
        continue
      }

      const currentPrice = historicalPrices[historicalPrices.length - 1]?.price ?? 0
      const previousPrice = historicalPrices[historicalPrices.length - 2]?.price

      if (previousPrice == null) {
        insights[commodity.name] = 'Insufficient data for trend analysis; monitoring market.'
      } else if (currentPrice > previousPrice) {
        const pctChange = ((currentPrice - previousPrice) / previousPrice * 100).toFixed(1)
        insights[commodity.name] = `Short-term trend: up ${pctChange}% (${source})`
      } else if (currentPrice < previousPrice) {
        const pctChange = ((previousPrice - currentPrice) / previousPrice * 100).toFixed(1)
        insights[commodity.name] = `Short-term trend: down ${pctChange}% (${source})`
      } else {
        insights[commodity.name] = `Short-term trend: stable (${source})`
      }

      data.push({
        name: commodity.name,
        currentPrice,
        historicalPrices,
        source,
      })
    }

    return NextResponse.json({
      data,
      insights,
      lastUpdated: new Date().toISOString(),
      dataQuality: 'Real market observations only',
    })
  } catch (err) {
    console.error('Commodities API error:', err)
    return NextResponse.json(
      {
        data: [],
        insights: {},
        lastUpdated: new Date().toISOString(),
        error: 'Failed to fetch commodity data. Please try again.',
      },
      { status: 500 }
    )
  }
}
