import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluateRollingOos, type HistoryPoint } from '@/lib/forecast'
import { getIstDayRangeUtc, toIstDisplay } from '@/lib/india-market'

const MODELS = ['linear-v1', 'hybrid-v2', 'hybrid-v3'] as const
const HORIZONS = [7, 14] as const
const COMMODITIES = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper'] as const

type CommodityName = (typeof COMMODITIES)[number]
type ModelName = (typeof MODELS)[number]

function parseCommodities(raw: string | null): CommodityName[] {
  if (!raw) return [...COMMODITIES]
  const set = new Set(
    raw
      .split(',')
      .map(s => s.trim())
      .filter((s): s is CommodityName => (COMMODITIES as readonly string[]).includes(s))
  )
  return set.size ? [...set] : [...COMMODITIES]
}

function istDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value ?? '1970'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  const day = parts.find(p => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function collapseDaily(points: HistoryPoint[]): HistoryPoint[] {
  const grouped = new Map<string, number[]>()
  for (const p of points) {
    const key = istDateKey(new Date(p.date))
    const list = grouped.get(key) ?? []
    list.push(p.price)
    grouped.set(key, list)
  }
  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, vals]) => {
      const sorted = [...vals].sort((x, y) => x - y)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      return { date: `${key}T12:00:00.000Z`, price: median }
    })
}

async function getCommodityHistory(name: CommodityName): Promise<HistoryPoint[]> {
  const obs = await prisma.priceObservation.findMany({
    where: { commodityName: name },
    orderBy: { observedAt: 'asc' },
    take: 365,
  })
  if (obs.length) return collapseDaily(obs.map(r => ({ date: r.observedAt.toISOString(), price: r.inrPerKg })))

  const rows = await prisma.commodity.findMany({
    where: { name },
    orderBy: { createdAt: 'asc' },
    take: 365,
  })
  return collapseDaily(rows.map(r => ({ date: r.createdAt.toISOString(), price: r.price })))
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date()
    const { startUtc, endUtc } = getIstDayRangeUtc(now)
    const selectedCommodities = parseCommodities(req.nextUrl.searchParams.get('commodities'))

    const leaderboard: Array<{
      commodity: CommodityName
      horizonDays: number
      ranking: Array<{
        modelVersion: ModelName
        mape: number | null
        mae: number | null
        rmse: number | null
        sampleCount: number
      }>
    }> = []

    for (const commodity of selectedCommodities) {
      const history = await getCommodityHistory(commodity)
      const windowStart = history[0] ? new Date(history[0].date) : null
      const windowEnd = history.at(-1) ? new Date(history[history.length - 1].date) : null

      for (const horizonDays of HORIZONS) {
        const ranking = []
        for (const modelVersion of MODELS) {
          const metrics = evaluateRollingOos(history, modelVersion, horizonDays, 24)
          ranking.push({
            modelVersion,
            ...metrics,
          })

          const existing = await prisma.modelLeaderboardSnapshot.findFirst({
            where: {
              commodityName: commodity,
              modelVersion,
              horizonDays,
              generatedAt: { gte: startUtc, lte: endUtc },
            },
          })

          const payload = {
            commodityName: commodity,
            modelVersion,
            horizonDays,
            mape: metrics.mape,
            mae: metrics.mae,
            rmse: metrics.rmse,
            sampleCount: metrics.sampleCount,
            windowStart,
            windowEnd,
            generatedAt: now,
          }

          if (existing) {
            await prisma.modelLeaderboardSnapshot.update({
              where: { id: existing.id },
              data: payload,
            })
          } else {
            await prisma.modelLeaderboardSnapshot.create({ data: payload })
          }
        }

        ranking.sort((a, b) => {
          const av = a.mape == null ? Number.POSITIVE_INFINITY : a.mape
          const bv = b.mape == null ? Number.POSITIVE_INFINITY : b.mape
          return av - bv
        })

        leaderboard.push({ commodity, horizonDays, ranking })
      }
    }

    return NextResponse.json({
      updatedAt: now.toISOString(),
      updatedAtIst: toIstDisplay(now),
      leaderboard,
    })
  } catch (error) {
    console.error('GET /api/model-leaderboard failed:', error)
    return NextResponse.json({ error: 'Failed to build model leaderboard.' }, { status: 500 })
  }
}
