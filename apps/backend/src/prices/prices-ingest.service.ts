import { Injectable } from '@nestjs/common'
import { PriceObservationStatus } from '@prisma/client'
import { IngestPricesDto } from './dto/ingest-prices.dto'
import { type LatestPriceCard, type PricesIngestResponse, PricesService } from './prices.service'

export type ScrapedObservation = {
  productKey: string
  value: number | null
  unit: string
  displayName?: string
  currentPrice?: number | null
  lastWeekPrice?: number | null
  lastWeekPriceMin?: number | null
  lastWeekPriceMax?: number | null
  todayPrice?: number | null
  todayPriceMin?: number | null
  todayPriceMax?: number | null
  expectedNextPrice?: number | null
  expectedNextPriceMin?: number | null
  expectedNextPriceMax?: number | null
  shortDescription?: string | null
  trend?: string | null
  analysisSummary?: string | null
  analysisBullets?: string[]
  historicalPoints?: Array<{ label?: string; date?: string; day?: string; value?: number | null }>
  forecastPoints?: Array<{ label?: string; date?: string; day?: string; value?: number | null }>
  metadata?: Record<string, unknown>
  sources?: Array<{ title?: string; url: string; host?: string }>
  source?: string
  sourceUrl?: string
  rawText?: string | null
  confidence?: number | null
  capturedAt?: string
  error?: string | null
  status?: string
  reason?: string | null
  meta?: {
    query?: string
    debugFile?: string
    confidence?: number
    reason?: string | null
    sourceUrl?: string
  }
}

export type ScraperError = {
  productKey: string
  error: string
  sourceUrl: string
}

export type ScraperOutput = {
  source: string
  fetchedAt: string
  items: ScrapedObservation[]
  errors?: ScraperError[]
}

export type PricesDryRunResponse = {
  ok: true
  dryRun: true
  run: {
    runAt: string
    totalProducts: number
    successfulCount: number
    failedCount: number
    trigger: string
  }
  products: LatestPriceCard[]
}

@Injectable()
export class PricesIngestService {
  constructor(private readonly pricesService: PricesService) {}

  async ingestContract(dto: IngestPricesDto, trigger: string): Promise<PricesIngestResponse> {
    return this.pricesService.ingest(dto, trigger)
  }

  async ingestScraperOutput(
    payload: ScraperOutput,
    trigger: string,
    dryRun = false,
  ): Promise<PricesIngestResponse | PricesDryRunResponse> {
    const runAtDate = new Date(payload.fetchedAt)

    const normalizedRunAt = Number.isNaN(runAtDate.getTime())
      ? new Date().toISOString()
      : runAtDate.toISOString()

    const observations = (payload.items || [])
      .filter((item) => item?.productKey && (Number.isFinite(item.value) || Number.isFinite(item.currentPrice)))
      .map((item) => ({
        productKey: item.productKey,
        value: Number.isFinite(item.value) ? Number(item.value) : Number(item.currentPrice),
        unit: item.unit || 'INR/kg',
        source: item.source || payload.source || 'Python Playwright Scraper',
        sourceUrl: item.sourceUrl || item.meta?.sourceUrl || '',
        confidence: Number.isFinite(item.confidence)
          ? Number(item.confidence)
          : Number.isFinite(item.meta?.confidence)
            ? Number(item.meta?.confidence)
            : 0.75,
        rawText: item.rawText || item.meta?.query || `${item.productKey} ${item.value} ${item.unit || 'INR/kg'}`,
        displayName: item.displayName,
        currentPrice: Number.isFinite(item.currentPrice) ? Number(item.currentPrice) : undefined,
        lastWeekPrice: Number.isFinite(item.lastWeekPrice) ? Number(item.lastWeekPrice) : undefined,
        lastWeekPriceMin: Number.isFinite(item.lastWeekPriceMin) ? Number(item.lastWeekPriceMin) : undefined,
        lastWeekPriceMax: Number.isFinite(item.lastWeekPriceMax) ? Number(item.lastWeekPriceMax) : undefined,
        todayPrice: Number.isFinite(item.todayPrice) ? Number(item.todayPrice) : undefined,
        todayPriceMin: Number.isFinite(item.todayPriceMin) ? Number(item.todayPriceMin) : undefined,
        todayPriceMax: Number.isFinite(item.todayPriceMax) ? Number(item.todayPriceMax) : undefined,
        expectedNextPrice: Number.isFinite(item.expectedNextPrice) ? Number(item.expectedNextPrice) : undefined,
        expectedNextPriceMin: Number.isFinite(item.expectedNextPriceMin) ? Number(item.expectedNextPriceMin) : undefined,
        expectedNextPriceMax: Number.isFinite(item.expectedNextPriceMax) ? Number(item.expectedNextPriceMax) : undefined,
        shortDescription: item.shortDescription || undefined,
        trend: item.trend || undefined,
        analysisSummary: item.analysisSummary || undefined,
        analysisBullets: item.analysisBullets || undefined,
        historicalPoints: item.historicalPoints || undefined,
        forecastPoints: item.forecastPoints || undefined,
        metadata: item.metadata || undefined,
        sources: item.sources || undefined,
      }))

    const perItemErrors = (payload.items || [])
      .filter((item) => item?.productKey && !Number.isFinite(item.value) && !Number.isFinite(item.currentPrice))
      .map((item) => ({
        productKey: item.productKey,
        error: item.error || item.reason || item.meta?.reason || 'NO_DATA',
        sourceUrl: item.sourceUrl || item.meta?.sourceUrl || '',
      }))

    const errors = [...perItemErrors, ...(payload.errors || []).map((item) => ({
      productKey: item.productKey,
      error: item.error,
      sourceUrl: item.sourceUrl || '',
    }))]

    const dto: IngestPricesDto = {
      runAt: normalizedRunAt,
      results: observations,
      errors,
    }

    if (!dryRun) {
      return this.pricesService.ingest(dto, trigger)
    }

    const products = await this.pricesService.getEnabledProducts()
    const resultMap = new Map(observations.map((row) => [row.productKey, row]))
    const errorMap = new Map(errors.map((row) => [row.productKey, row]))

    const cards = products
      .sort((a, b) => a.displayOrder - b.displayOrder || a.productKey.localeCompare(b.productKey))
      .map((product) => {
        const result = resultMap.get(product.productKey)
        const ingestError = errorMap.get(product.productKey)

        if (ingestError || !result) {
          return {
            productKey: product.productKey,
            displayName: product.displayName,
            unit: product.unit,
            status: PriceObservationStatus.FAILED,
            value: null,
            reason: 'NO_DATA' as const,
            source: result?.source || product.defaultSource,
            sourceUrl: ingestError?.sourceUrl || result?.sourceUrl || product.sourceUrl,
            confidence: null,
            rawText: result?.rawText || null,
            error: ingestError?.error || 'No value generated by scraper.',
            capturedAt: normalizedRunAt,
          }
        }

        return {
          productKey: product.productKey,
          displayName: product.displayName,
          unit: result.unit || product.unit,
          status: PriceObservationStatus.OK,
          value: result.value,
          reason: null,
          source: result.source || product.defaultSource,
          sourceUrl: result.sourceUrl || product.sourceUrl,
          confidence: Number.isFinite(result.confidence) ? result.confidence : null,
          rawText: result.rawText,
          error: null,
          capturedAt: normalizedRunAt,
        }
      })

    const successfulCount = cards.filter((item) => item.status === PriceObservationStatus.OK).length
    const failedCount = cards.length - successfulCount

    return {
      ok: true,
      dryRun: true,
      run: {
        runAt: normalizedRunAt,
        totalProducts: cards.length,
        successfulCount,
        failedCount,
        trigger,
      },
      products: cards,
    }
  }
}
