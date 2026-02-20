import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeHybridForecast, type HistoryPoint } from '@/lib/forecast'
import { getIstDayRangeUtc, toIstDisplay } from '@/lib/india-market'

const MODEL_VERSION = 'hybrid-v3'
const HORIZONS = [3, 7, 14] as const
const DEFAULT_COMMODITIES = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper'] as const

type CommodityName = (typeof DEFAULT_COMMODITIES)[number]

function parseCommodities(raw: string | null): CommodityName[] {
  if (!raw) return [...DEFAULT_COMMODITIES]
  const set = new Set(
    raw
      .split(',')
      .map(s => s.trim())
      .filter((s): s is CommodityName => (DEFAULT_COMMODITIES as readonly string[]).includes(s))
  )
  return set.size ? [...set] : [...DEFAULT_COMMODITIES]
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

async function getCommodityHistoryValues(name: CommodityName): Promise<HistoryPoint[]> {
  const obs = await prisma.priceObservation.findMany({
    where: { commodityName: name },
    orderBy: { observedAt: 'asc' },
    take: 240,
  })

  if (obs.length > 0) {
    return collapseDaily(obs.map(r => ({ date: r.observedAt.toISOString(), price: r.inrPerKg })))
  }

  const commodityRows = await prisma.commodity.findMany({
    where: { name },
    orderBy: { createdAt: 'asc' },
    take: 240,
  })
  return collapseDaily(commodityRows.map(r => ({ date: r.createdAt.toISOString(), price: r.price })))
}

export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get('commodities')
    const commodities = parseCommodities(requested)
    const now = new Date()
    const { startUtc, endUtc } = getIstDayRangeUtc(now)

    const result: Array<{
      commodity: CommodityName
      modelVersion: string
      horizons: Array<{
        horizonDays: number
        labels: string[]
        actualSeries: Array<number | null>
        forecastSeries: Array<number | null>
        lowerSeries: Array<number | null>
        upperSeries: Array<number | null>
        trendText: string
        metrics: { mape: number | null; mae: number | null; rmse: number | null }
        range: { pctMove: number | null; lowerPct: number | null; upperPct: number | null }
        diagnostics: {
          linearMae: number | null
          holtMae: number | null
          ensembleWeightLinear: number
          ensembleWeightHolt: number
          regime: 'calm' | 'normal' | 'volatile'
          ridgeMae?: number | null
          ensembleWeightRidge?: number
        }
      }>
    }> = []

    for (const commodity of commodities) {
      const history = await getCommodityHistoryValues(commodity)
      const horizons = []
      for (const horizonDays of HORIZONS) {
        const forecast = computeHybridForecast(history, horizonDays)
        horizons.push({
          horizonDays,
          labels: forecast.labels,
          actualSeries: forecast.actualSeries,
          forecastSeries: forecast.forecastSeries,
          lowerSeries: forecast.lowerSeries,
          upperSeries: forecast.upperSeries,
          trendText: forecast.trendText,
          metrics: { mape: forecast.mape, mae: forecast.mae, rmse: forecast.rmse },
          range: { pctMove: forecast.pctMove, lowerPct: forecast.lowerPct, upperPct: forecast.upperPct },
          diagnostics: forecast.modelDiagnostics,
        })

        const existingRun = await prisma.forecastRun.findFirst({
          where: {
            commodityName: commodity,
            modelVersion: MODEL_VERSION,
            horizonDays,
            generatedAt: { gte: startUtc, lte: endUtc },
          },
        })

        const payload = {
          commodityName: commodity,
          modelVersion: MODEL_VERSION,
          horizonDays,
          mape: forecast.mape,
          mae: forecast.mae,
          rmse: forecast.rmse,
          trendText: forecast.trendText,
          pctMove: forecast.pctMove,
          lowerPct: forecast.lowerPct,
          upperPct: forecast.upperPct,
          labelsJson: JSON.stringify(forecast.labels),
          actualJson: JSON.stringify(forecast.actualSeries),
          forecastJson: JSON.stringify(forecast.forecastSeries),
          generatedAt: now,
        }

        if (existingRun) {
          await prisma.forecastRun.update({ where: { id: existingRun.id }, data: payload })
        } else {
          await prisma.forecastRun.create({ data: payload })
        }
      }

      result.push({
        commodity,
        modelVersion: MODEL_VERSION,
        horizons,
      })
    }

    return NextResponse.json({
      updatedAt: now.toISOString(),
      updatedAtIst: toIstDisplay(now),
      modelVersion: MODEL_VERSION,
      horizons: HORIZONS,
      commodities: result,
    })
  } catch (error) {
    console.error('GET /api/forecast failed:', error)
    return NextResponse.json({ error: 'Failed to generate forecast.' }, { status: 500 })
  }
}
