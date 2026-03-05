import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { convertToInrPerKg, getIstDayRangeUtc, toIstDisplay } from '@/lib/india-market'

const YAHOO_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const FOREX_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
const ARABICA_SYMBOL = 'KC=F'
const ROBUSTA_SYMBOL = 'RC=F'
const FALLBACK_USD_TO_INR = Number(process.env.USD_TO_INR ?? 83)
const FALLBACK_ARABICA_USD_PER_LB = 1.85
const FALLBACK_ROBUSTA_USD_PER_LB = 1.45
const STRICT_REAL_DATA = process.env.STRICT_REAL_DATA === 'true' || process.env.NODE_ENV === 'production'

type MarketPoint = {
  date: string
  inrPerKg: number
}

type MarketQuote = {
  usdPerLb: number | null
  inrPerKg: number | null
  history: MarketPoint[]
  source: string
}

type ForexRate = {
  usdToInr: number
  source: string
  timestamp: string
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number
      }
    }>
    error?: { description?: string }
  }
}

async function fetchLiveForexRate(): Promise<ForexRate> {
  try {
    const response = await fetch(FOREX_API_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Forex API failed: ${response.status}`)
    
    const data = await response.json()
    const usdToInr = data.rates?.INR
    
    if (typeof usdToInr !== 'number' || Number.isNaN(usdToInr)) {
      throw new Error('Invalid INR rate in forex response')
    }
    
    return {
      usdToInr: Number(usdToInr.toFixed(4)),
      source: 'ExchangeRate-API (Live)',
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    if (STRICT_REAL_DATA) {
      throw new Error(`Live forex fetch failed in strict mode: ${error instanceof Error ? error.message : String(error)}`)
    }
    console.warn('Live forex fetch failed, using fallback:', error)
    return {
      usdToInr: FALLBACK_USD_TO_INR,
      source: 'Static Fallback',
      timestamp: new Date().toISOString(),
    }
  }
}

async function fetchYahooQuote(symbol: string): Promise<number> {
  const url = `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Yahoo request failed for ${symbol}: ${response.status}`)
  }

  const data: YahooChartResponse = await response.json()
  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice
  if (typeof price !== 'number' || Number.isNaN(price)) {
    throw new Error(`Missing regularMarketPrice for ${symbol}`)
  }

  return price
}

function toInrPerKg(usdPerLb: number, usdToInr: number): number {
  return convertToInrPerKg(usdPerLb, 'usd_per_lb', usdToInr)
}

async function upsertDailyCommodityPrice(name: 'Arabica' | 'Robusta', priceInrPerKg: number) {
  try {
  const { startUtc: startOfTodayUtc, endUtc: endOfTodayUtc } = getIstDayRangeUtc()

  const existing = await prisma.commodity.findFirst({
    where: {
      type: 'Coffee',
      name,
      source: 'Yahoo Finance',
      createdAt: {
        gte: startOfTodayUtc,
        lte: endOfTodayUtc,
      },
    },
  })

  if (existing) {
    await prisma.commodity.update({
      where: { id: existing.id },
      data: { price: priceInrPerKg },
    })
    return
  }

  await prisma.commodity.create({
    data: {
      type: 'Coffee',
      name,
      price: priceInrPerKg,
      source: 'Yahoo Finance',
    },
  })
  } catch (error) {
    console.error(`Failed to upsert daily commodity price for ${name}:`, error)
  }
}

async function upsertBenchmarkObservation(name: 'Arabica' | 'Robusta', usdPerLb: number, inrPerKg: number) {
  try {
  const { startUtc, endUtc } = getIstDayRangeUtc()
  const existing = await prisma.priceObservation.findFirst({
    where: {
      commodityName: name,
      priceType: 'benchmark',
      observedAt: { gte: startUtc, lte: endUtc },
    },
  })

  const payload = {
    commodityName: name,
    grade: 'Futures derived',
    priceType: 'benchmark' as const,
    source: 'Yahoo Finance',
    marketCenter: 'ICE Futures',
    state: 'Pan-India Benchmark',
    district: null,
    unit: 'inr_per_kg',
    inrPerKg,
    originalValue: Number(usdPerLb.toFixed(4)),
    originalUnit: 'usd_per_lb',
    sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
    reliability: 0.82,
    observedAt: new Date(),
  }

  if (existing) {
    await prisma.priceObservation.update({
      where: { id: existing.id },
      data: payload,
    })
    return
  }

  await prisma.priceObservation.create({ data: payload })
  } catch (error) {
    console.error(`Failed to upsert benchmark observation for ${name}:`, error)
  }
}

async function getHistory(name: 'Arabica' | 'Robusta'): Promise<MarketPoint[]> {
  try {
    const rows = await prisma.commodity.findMany({
      where: { type: 'Coffee', name, source: 'Yahoo Finance' },
      orderBy: { createdAt: 'desc' },
      take: 14,
    })

    return rows
      .map(row => ({
        date: row.createdAt.toISOString(),
        inrPerKg: Number(row.price.toFixed(2)),
      }))
      .reverse()
  } catch (error) {
    console.error(`Failed to read history for ${name}:`, error)
    return []
  }
}

async function getLatestFromDb(name: 'Arabica' | 'Robusta'): Promise<MarketQuote | null> {
  try {
    const rows = await prisma.priceObservation.findMany({
      where: {
        commodityName: name,
        priceType: 'benchmark',
        source: 'Yahoo Finance',
      },
      orderBy: { observedAt: 'desc' },
      take: 14,
    })

    if (!rows.length) return null

    const latest = rows[0]
    const history = rows
      .map((row) => ({
        date: row.observedAt.toISOString(),
        inrPerKg: Number(row.inrPerKg.toFixed(2)),
      }))
      .reverse()

    return {
      usdPerLb: latest.originalValue ?? null,
      inrPerKg: Number(latest.inrPerKg.toFixed(2)),
      history,
      source: 'Yahoo Finance (cached DB)',
    }
  } catch (error) {
    console.error(`Failed to read cached benchmark for ${name}:`, error)
    return null
  }
}

export async function GET() {
  let forex: ForexRate
  try {
    forex = await fetchLiveForexRate()
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Live forex source unavailable in strict real-data mode.',
        detail: error instanceof Error ? error.message : String(error),
        strictMode: true,
        source: 'Unavailable',
        updatedAt: new Date().toISOString(),
        updatedAtIst: toIstDisplay(new Date()),
      },
      { status: 503 }
    )
  }

  let arabica: MarketQuote = { usdPerLb: null, inrPerKg: null, history: [], source: 'Yahoo Finance (ICE Futures)' }
  let robusta: MarketQuote = { usdPerLb: null, inrPerKg: null, history: [], source: 'Yahoo Finance (ICE Futures)' }
  let source = 'Yahoo Finance'

  try {
    const [arabicaUsdPerLb, robustaUsdPerLb] = await Promise.all([
      fetchYahooQuote(ARABICA_SYMBOL),
      fetchYahooQuote(ROBUSTA_SYMBOL),
    ])

    const arabicaInrPerKg = toInrPerKg(arabicaUsdPerLb, forex.usdToInr)
    const robustaInrPerKg = toInrPerKg(robustaUsdPerLb, forex.usdToInr)

    await Promise.all([
      upsertDailyCommodityPrice('Arabica', arabicaInrPerKg),
      upsertDailyCommodityPrice('Robusta', robustaInrPerKg),
      upsertBenchmarkObservation('Arabica', arabicaUsdPerLb, arabicaInrPerKg),
      upsertBenchmarkObservation('Robusta', robustaUsdPerLb, robustaInrPerKg),
    ])

    const [arabicaHistory, robustaHistory] = await Promise.all([
      getHistory('Arabica'),
      getHistory('Robusta'),
    ])

    arabica = { usdPerLb: Number(arabicaUsdPerLb.toFixed(4)), inrPerKg: arabicaInrPerKg, history: arabicaHistory, source: 'Yahoo Finance (ICE Futures)' }
    robusta = { usdPerLb: Number(robustaUsdPerLb.toFixed(4)), inrPerKg: robustaInrPerKg, history: robustaHistory, source: 'Yahoo Finance (ICE Futures)' }
  } catch (error) {
    console.error('GET /api/market failed:', error)
    const [arabicaCached, robustaCached] = await Promise.all([
      getLatestFromDb('Arabica'),
      getLatestFromDb('Robusta'),
    ])

    if (STRICT_REAL_DATA) {
      if (!arabicaCached || !robustaCached) {
        return NextResponse.json(
          {
            error: 'Live market source unavailable and no cached real observations found.',
            detail: error instanceof Error ? error.message : String(error),
            strictMode: true,
            source: 'Unavailable',
            updatedAt: new Date().toISOString(),
            updatedAtIst: toIstDisplay(new Date()),
          },
          { status: 503 }
        )
      }

      arabica = arabicaCached
      robusta = robustaCached
      source = 'Yahoo Finance (cached DB)'
    } else {
      const [arabicaHistory, robustaHistory] = await Promise.all([
        getHistory('Arabica'),
        getHistory('Robusta'),
      ])

      const arabicaFallbackInr = toInrPerKg(FALLBACK_ARABICA_USD_PER_LB, forex.usdToInr)
      const robustaFallbackInr = toInrPerKg(FALLBACK_ROBUSTA_USD_PER_LB, forex.usdToInr)

      arabica = {
        usdPerLb: FALLBACK_ARABICA_USD_PER_LB,
        inrPerKg: arabicaHistory.at(-1)?.inrPerKg ?? arabicaFallbackInr,
        history: arabicaHistory,
        source: 'Yahoo Finance (Fallback - API Error)',
      }
      robusta = {
        usdPerLb: FALLBACK_ROBUSTA_USD_PER_LB,
        inrPerKg: robustaHistory.at(-1)?.inrPerKg ?? robustaFallbackInr,
        history: robustaHistory,
        source: 'Yahoo Finance (Fallback - API Error)',
      }
      source = 'Yahoo Finance (fallback)'
    }
  }

  return NextResponse.json({
    arabica,
    robusta,
    unit: 'inr_per_kg',
    fx: {
      usdToInr: forex.usdToInr,
      source: forex.source,
      timestamp: forex.timestamp,
    },
    updatedAt: new Date().toISOString(),
    updatedAtIst: toIstDisplay(new Date()),
    source,
    strictMode: STRICT_REAL_DATA,
  })
}
