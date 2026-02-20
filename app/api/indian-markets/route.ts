import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIstDayRangeUtc, toIstDisplay } from '@/lib/india-market'

// Indian market data sources
const AGMARKNET_BASE = 'https://agmarknet.gov.in'
const COMMODITIES_BOARD_API = 'https://indiancommodity.com/api'

type MandiPrice = {
  commodity: string
  market: string
  state: string
  district: string | null
  priceInrPerKg: number
  grade: string
  source: string
  observedAt: string
  reliability: number
}

type MarketSource = {
  name: string
  prices: MandiPrice[]
  status: 'success' | 'error'
  error?: string
}

type AggregatedPrice = {
  commodity: string
  currentPrice: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  sources: MarketSource[]
  sampleCount: number
  lastUpdated: string
}

const COMMODITY_CONFIG = [
  { name: 'Arabica Cherry', aliases: ['Arabica Coffee Cherry', 'Arabica Cherry Coffee', 'Coffee Arabica Cherry'], board: 'Coffee', grade: 'Cherry' },
  { name: 'Arabica Parchment', aliases: ['Arabica Coffee Parchment', 'Arabica Parchment Coffee', 'Coffee Arabica Parchment'], board: 'Coffee', grade: 'Parchment' },
  { name: 'Robusta Cherry', aliases: ['Robusta Coffee Cherry', 'Robusta Cherry Coffee', 'Coffee Robusta Cherry'], board: 'Coffee', grade: 'Cherry' },
  { name: 'Robusta Parchment', aliases: ['Robusta Coffee Parchment', 'Robusta Parchment Coffee', 'Coffee Robusta Parchment'], board: 'Coffee', grade: 'Parchment' },
  { name: 'Cardamom', aliases: ['Cardamom (Small)', 'Elaichi'], board: 'Spices', grade: 'Standard' },
  { name: 'Arecanut', aliases: ['Areca nut', 'Supari', 'Betel nut'], board: 'Arecanut', grade: 'Standard' },
  { name: 'Pepper', aliases: ['Black Pepper', 'Dry Pepper'], board: 'Spices', grade: 'Standard' },
]

// Fetch from Agmarknet (Government of India official mandi prices)
async function fetchAgmarknetPrices(commodity: string): Promise<MandiPrice[]> {
  try {
    // Agmarknet typically provides data via their portal
    // For real implementation, you'd scrape or use their data API
    // This is a placeholder showing the structure
    
    // Check database for recent Agmarknet observations
    const config = COMMODITY_CONFIG.find(c => c.name === commodity)
    if (!config) return []

    const names = [commodity, ...config.aliases]
    const since = new Date()
    since.setHours(since.getHours() - 24) // Last 24 hours

    const observations = await prisma.priceObservation.findMany({
      where: {
        commodityName: { in: names },
        source: { contains: 'Agmarknet' },
        observedAt: { gte: since },
      },
      orderBy: { observedAt: 'desc' },
      take: 20,
    })

    return observations.map(obs => ({
      commodity,
      market: obs.marketCenter || 'Karnataka Market',
      state: obs.state || 'Karnataka',
      district: obs.district,
      priceInrPerKg: Number(obs.inrPerKg.toFixed(2)),
      grade: obs.grade || config.grade || 'Commercial',
      source: 'Agmarknet (Govt of India)',
      observedAt: obs.observedAt.toISOString(),
      reliability: obs.reliability || 0.75,
    }))
  } catch (error) {
    console.error(`Agmarknet fetch failed for ${commodity}:`, error)
    return []
  }
}

// Fetch from Coffee Board / Spices Board official data
async function fetchCommodityBoardPrices(commodity: string): Promise<MandiPrice[]> {
  try {
    const config = COMMODITY_CONFIG.find(c => c.name === commodity)
    if (!config) return []

    const names = [commodity, ...config.aliases]
    const since = new Date()
    since.setHours(since.getHours() - 24)

    const observations = await prisma.priceObservation.findMany({
      where: {
        commodityName: { in: names },
        source: { in: ['Coffee Board India', 'Spices Board India', 'Arecanut Board'] },
        observedAt: { gte: since },
      },
      orderBy: { observedAt: 'desc' },
      take: 10,
    })

    return observations.map(obs => ({
      commodity,
      market: obs.marketCenter || 'Board Reference',
      state: obs.state || 'Pan-India',
      district: obs.district,
      priceInrPerKg: Number(obs.inrPerKg.toFixed(2)),
      grade: obs.grade || config.grade || 'Standard',
      source: obs.source,
      observedAt: obs.observedAt.toISOString(),
      reliability: obs.reliability || 0.85,
    }))
  } catch (error) {
    console.error(`Commodity Board fetch failed for ${commodity}:`, error)
    return []
  }
}

// Fetch regional mandi prices (Karnataka, Kerala major markets)
async function fetchRegionalMandiPrices(commodity: string): Promise<MandiPrice[]> {
  try {
    const config = COMMODITY_CONFIG.find(c => c.name === commodity)
    if (!config) return []

    const names = [commodity, ...config.aliases]
    const since = new Date()
    since.setDate(since.getDate() - 3) // Last 3 days

    const observations = await prisma.priceObservation.findMany({
      where: {
        commodityName: { in: names },
        priceType: 'mandi',
        observedAt: { gte: since },
      },
      orderBy: { observedAt: 'desc' },
      take: 15,
    })

    return observations.map(obs => ({
      commodity,
      market: obs.marketCenter || 'Regional Mandi',
      state: obs.state || 'Karnataka',
      district: obs.district,
      priceInrPerKg: Number(obs.inrPerKg.toFixed(2)),
      grade: obs.grade || config.grade || 'Market Grade',
      source: 'Regional Mandi',
      observedAt: obs.observedAt.toISOString(),
      reliability: obs.reliability || 0.65,
    }))
  } catch (error) {
    console.error(`Regional mandi fetch failed for ${commodity}:`, error)
    return []
  }
}

function aggregatePrices(allPrices: MandiPrice[]): { currentPrice: number; minPrice: number; maxPrice: number; avgPrice: number } {
  if (allPrices.length === 0) {
    return { currentPrice: 0, minPrice: 0, maxPrice: 0, avgPrice: 0 }
  }

  // Weight by reliability and recency
  const now = Date.now()
  const weighted = allPrices.map(p => {
    const age = now - new Date(p.observedAt).getTime()
    const ageHours = age / (1000 * 60 * 60)
    const recencyFactor = Math.exp(-ageHours / 12) // Decay over 12 hours
    const weight = p.reliability * recencyFactor
    return { price: p.priceInrPerKg, weight }
  })

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
  const weightedAvg = weighted.reduce((sum, w) => sum + w.price * w.weight, 0) / (totalWeight || 1)

  const prices = allPrices.map(p => p.priceInrPerKg)
  
  return {
    currentPrice: Number(weightedAvg.toFixed(2)),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
  }
}

export async function GET() {
  try {
    const results: AggregatedPrice[] = []

    for (const config of COMMODITY_CONFIG) {
      const sources: MarketSource[] = []

      // Fetch from all sources
      const [agmarknetPrices, boardPrices, mandiPrices] = await Promise.allSettled([
        fetchAgmarknetPrices(config.name),
        fetchCommodityBoardPrices(config.name),
        fetchRegionalMandiPrices(config.name),
      ])

      if (agmarknetPrices.status === 'fulfilled') {
        sources.push({
          name: 'Agmarknet (Govt of India)',
          prices: agmarknetPrices.value,
          status: 'success',
        })
      } else {
        sources.push({
          name: 'Agmarknet (Govt of India)',
          prices: [],
          status: 'error',
          error: String(agmarknetPrices.reason),
        })
      }

      if (boardPrices.status === 'fulfilled') {
        sources.push({
          name: `${config.board} Board India`,
          prices: boardPrices.value,
          status: 'success',
        })
      } else {
        sources.push({
          name: `${config.board} Board India`,
          prices: [],
          status: 'error',
          error: String(boardPrices.reason),
        })
      }

      if (mandiPrices.status === 'fulfilled') {
        sources.push({
          name: 'Regional Mandis (KA/KL)',
          prices: mandiPrices.value,
          status: 'success',
        })
      } else {
        sources.push({
          name: 'Regional Mandis (KA/KL)',
          prices: [],
          status: 'error',
          error: String(mandiPrices.reason),
        })
      }

      const allPrices = sources.flatMap(s => s.prices)
      const aggregated = aggregatePrices(allPrices)

      results.push({
        commodity: config.name,
        ...aggregated,
        sources,
        sampleCount: allPrices.length,
        lastUpdated: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      markets: results,
      updatedAt: new Date().toISOString(),
      updatedAtIst: toIstDisplay(new Date()),
      note: 'Aggregated from multiple Indian mandi and commodity board sources',
    })
  } catch (error) {
    console.error('GET /api/indian-markets failed:', error)
    return NextResponse.json(
      {
        markets: [],
        updatedAt: new Date().toISOString(),
        updatedAtIst: toIstDisplay(new Date()),
        error: 'Failed to fetch Indian market data',
      },
      { status: 500 }
    )
  }
}
