import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIstDayRangeUtc, toIstDisplay } from '@/lib/india-market'

type PriceType = 'benchmark' | 'mandi' | 'listing'
type CommodityName = 'Arabica' | 'Robusta'

type PriceBand = {
  priceType: PriceType
  latestInrPerKg: number | null
  median7dInrPerKg: number | null
  source: string
  marketCenter: string | null
}

type CommodityIntel = {
  commodity: CommodityName
  benchmark: PriceBand
  mandi: PriceBand
  listing: PriceBand
  sourceBreakdown: Array<{
    priceType: PriceType
    source: string
    marketCenter: string | null
    state: string | null
    district: string | null
    observedAtIst: string
    latestInrPerKg: number
  }>
  indicativeRange: {
    low: number | null
    high: number | null
    midpoint: number | null
  }
  confidence: 'low' | 'medium' | 'high'
}

const COMMODITIES: CommodityName[] = ['Arabica', 'Robusta']
const FALLBACK_BENCHMARK: Record<CommodityName, number> = {
  Arabica: 338,
  Robusta: 265,
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
  return Number(sorted[mid].toFixed(2))
}

function rounded(n: number): number {
  return Number(n.toFixed(2))
}

async function ensureDerivedObservations(commodity: CommodityName, benchmark: number, observedAt: Date) {
  const { startUtc: start, endUtc: end } = getIstDayRangeUtc(observedAt)

  const dayFactor = (observedAt.getUTCDate() % 5) * 0.0025
  const mandiBaseMultiplier = commodity === 'Arabica' ? 0.78 : 0.82
  const listingBaseMultiplier = commodity === 'Arabica' ? 1.04 : 1.02

  const mandiPrice = rounded(benchmark * (mandiBaseMultiplier + dayFactor))
  const listingPrice = rounded(benchmark * (listingBaseMultiplier + dayFactor))

  const mandiExists = await prisma.priceObservation.findFirst({
    where: {
      commodityName: commodity,
      priceType: 'mandi',
      observedAt: { gte: start, lte: end },
    },
  })
  if (!mandiExists) {
    await prisma.priceObservation.create({
      data: {
        commodityName: commodity,
        grade: commodity === 'Arabica' ? 'Cherry/Parchment mix' : 'Cherry',
        priceType: 'mandi',
        source: 'Modelled Mandi',
        marketCenter: 'Karnataka Composite',
        state: 'Karnataka',
        district: 'Kodagu',
        unit: 'inr_per_kg',
        inrPerKg: mandiPrice,
        originalValue: mandiPrice * 50,
        originalUnit: 'inr_per_50kg',
        reliability: 0.58,
        observedAt,
      },
    })
  }

  const listingExists = await prisma.priceObservation.findFirst({
    where: {
      commodityName: commodity,
      priceType: 'listing',
      observedAt: { gte: start, lte: end },
    },
  })
  if (!listingExists) {
    await prisma.priceObservation.create({
      data: {
        commodityName: commodity,
        grade: 'Commercial',
        priceType: 'listing',
        source: 'Modelled Listing',
        marketCenter: 'Coorg/Kodagu',
        state: 'Karnataka',
        district: 'Kodagu',
        unit: 'inr_per_kg',
        inrPerKg: listingPrice,
        originalValue: listingPrice,
        originalUnit: 'inr_per_kg',
        reliability: 0.46,
        observedAt,
      },
    })
  }
}

async function getLatestBand(commodity: CommodityName, priceType: PriceType): Promise<PriceBand> {
    const latest = await prisma.priceObservation.findFirst({
      where: { commodityName: commodity, priceType },
      orderBy: { observedAt: 'desc' },
  })

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const history = await prisma.priceObservation.findMany({
    where: {
      commodityName: commodity,
      priceType,
      observedAt: { gte: since },
    },
    orderBy: { observedAt: 'desc' },
  })

  return {
    priceType,
    latestInrPerKg: latest ? rounded(latest.inrPerKg) : null,
    median7dInrPerKg: median(history.map(h => h.inrPerKg)),
    source: latest?.source ?? 'Unavailable',
    marketCenter: latest?.marketCenter ?? null,
  }
}

function deriveConfidence(bands: PriceBand[]): 'low' | 'medium' | 'high' {
  const available = bands.filter(b => b.latestInrPerKg != null).length
  if (available >= 3) return 'high'
  if (available === 2) return 'medium'
  return 'low'
}

export async function GET() {
  try {
    // Ensure today's benchmark from /api/market is represented in normalized observation table.
    const latestBenchmarks = await prisma.commodity.findMany({
      where: { type: 'Coffee', name: { in: COMMODITIES }, source: { contains: 'Yahoo Finance' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    for (const commodity of COMMODITIES) {
      const latestBenchmark = latestBenchmarks.find(row => row.name === commodity)

      const { startUtc: start, endUtc: end } = getIstDayRangeUtc()

      const benchmarkExists = await prisma.priceObservation.findFirst({
        where: {
          commodityName: commodity,
          priceType: 'benchmark',
          observedAt: { gte: start, lte: end },
        },
      })

      const benchmarkPrice = latestBenchmark ? rounded(latestBenchmark.price) : FALLBACK_BENCHMARK[commodity]
      const benchmarkSource = latestBenchmark?.source ?? 'Modelled Benchmark'

      if (!benchmarkExists) {
        await prisma.priceObservation.create({
          data: {
            commodityName: commodity,
            grade: 'Futures derived',
            priceType: 'benchmark',
            source: benchmarkSource,
            marketCenter: 'ICE Futures',
            state: 'Pan-India Benchmark',
            district: null,
            unit: 'inr_per_kg',
            inrPerKg: benchmarkPrice,
            originalValue: benchmarkPrice,
            originalUnit: 'inr_per_kg',
            reliability: latestBenchmark ? 0.82 : 0.4,
            observedAt: new Date(),
          },
        })
      }

      await ensureDerivedObservations(commodity, benchmarkPrice, new Date())
    }

    const commodities: CommodityIntel[] = []
    for (const commodity of COMMODITIES) {
      const benchmark = await getLatestBand(commodity, 'benchmark')
      const mandi = await getLatestBand(commodity, 'mandi')
      const listing = await getLatestBand(commodity, 'listing')
      const latestRows = await prisma.priceObservation.findMany({
        where: { commodityName: commodity, priceType: { in: ['benchmark', 'mandi', 'listing'] } },
        orderBy: { observedAt: 'desc' },
        take: 20,
      })

      const sourceBreakdown = (['benchmark', 'mandi', 'listing'] as PriceType[])
        .map((priceType) => latestRows.find((row) => row.priceType === priceType))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => ({
          priceType: row.priceType as PriceType,
          source: row.source,
          marketCenter: row.marketCenter,
          state: row.state,
          district: row.district,
          observedAtIst: toIstDisplay(row.observedAt),
          latestInrPerKg: rounded(row.inrPerKg),
        }))

      const values = [benchmark.latestInrPerKg, mandi.latestInrPerKg, listing.latestInrPerKg].filter((v): v is number => v != null)
      const low = values.length ? Math.min(...values) : null
      const high = values.length ? Math.max(...values) : null
      const midpoint = values.length ? rounded(values.reduce((a, b) => a + b, 0) / values.length) : null

      commodities.push({
        commodity,
        benchmark,
        mandi,
        listing,
        sourceBreakdown,
        indicativeRange: { low, high, midpoint },
        confidence: deriveConfidence([benchmark, mandi, listing]),
      })
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      updatedAtIst: toIstDisplay(new Date()),
      unit: 'inr_per_kg',
      standard: 'Indian Market Normalized Standard (INR/kg, IST)',
      commodities,
    })
  } catch (error) {
    console.error('GET /api/price-intel failed:', error)
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        updatedAtIst: toIstDisplay(new Date()),
        unit: 'inr_per_kg',
        standard: 'Indian Market Normalized Standard (INR/kg, IST)',
        commodities: [],
      },
      { status: 500 }
    )
  }
}
