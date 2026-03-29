import { Injectable, Logger } from '@nestjs/common'
import { PriceObservationStatus } from '@prisma/client'
import { IngestPricesDto } from './dto/ingest-prices.dto'
import { type LatestPriceCard, type PricesIngestResponse, PricesService } from './prices.service'
import { normalizePriceForIngest } from '../utils/normalizePrice'

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
  rawText?: string
  source?: string
  capturedAt?: string
}

export type ScraperOutput = {
  source: string
  fetchedAt: string
  items: ScrapedObservation[]
  errors?: ScraperError[]
  metadata?: Record<string, unknown>
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
  private readonly logger = new Logger(PricesIngestService.name)
  private readonly coffeeProductKeys = new Set([
    'arabica_parchment',
    'arabica_cherry',
    'robusta_parchment',
    'robusta_cherry',
  ])

  constructor(private readonly pricesService: PricesService) {}

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private normalizeNumericField(
    value: number | null | undefined,
    rawText: string | null | undefined,
    explicitUnit: string | null | undefined,
  ) {
    if (!Number.isFinite(value)) {
      return undefined
    }

    const normalized = normalizePriceForIngest(Number(value), {
      rawText,
      explicitUnit,
      valuesAlreadyNormalized: true,
    })
    return normalized.sane ? normalized : null
  }

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

    const normalizeMetadata = (item: ScrapedObservation) => {
      const metadata: Record<string, unknown> = { ...(item.metadata || {}) }

      if (item.meta?.query) metadata.query = item.meta.query
      if (item.meta?.debugFile) metadata.debugFile = item.meta.debugFile
      if (item.meta?.reason) metadata.reason = item.meta.reason
      if (item.status) metadata.scraperStatus = item.status
      if (item.reason) metadata.scraperReason = item.reason
      if (item.error) metadata.scraperError = item.error
      if (item.source) metadata.scraperSource = item.source
      if (item.capturedAt) metadata.sourceCapturedAt = item.capturedAt

      return Object.keys(metadata).length > 0 ? metadata : undefined
    }

    const normalizeSeriesPoints = (
      points: Array<{ label?: string; date?: string; day?: string; value?: number | null }> | undefined,
      rawText: string,
      explicitUnit: string | null | undefined,
    ) => (
      points
        ?.map((point) => {
          const normalized = this.normalizeNumericField(point.value, rawText, explicitUnit)
          if (!normalized) {
            return {
              ...point,
              value: null,
            }
          }

          return {
            ...point,
            value: normalized.normalizedValue,
          }
        })
        .filter((point) => point.value != null) || undefined
    )

    let observations = (payload.items || [])
      .filter((item) => item?.productKey && (Number.isFinite(item.value) || Number.isFinite(item.currentPrice)))
      .flatMap((item) => {
        const rawText = item.rawText || item.meta?.query || `${item.productKey} ${item.value} ${item.unit || 'INR/kg'}`
        const source = item.source || payload.source || 'Python Playwright Scraper'
        const sourceUrl = item.sourceUrl || item.meta?.sourceUrl || ''
        const normalizedValue = this.normalizeNumericField(
          Number.isFinite(item.value) ? Number(item.value) : Number(item.currentPrice),
          rawText,
          item.unit,
        )

        if (!normalizedValue) {
          this.logger.warn(
            `Skipping ${item.productKey} because normalized price is outside safety range. unit=${item.unit || 'kg'} raw=${JSON.stringify(rawText).slice(0, 200)}`,
          )
          return []
        }

        const currentPrice = this.normalizeNumericField(item.currentPrice, rawText, item.unit)
        const lastWeekPrice = this.normalizeNumericField(item.lastWeekPrice, rawText, item.unit)
        const lastWeekPriceMin = this.normalizeNumericField(item.lastWeekPriceMin, rawText, item.unit)
        const lastWeekPriceMax = this.normalizeNumericField(item.lastWeekPriceMax, rawText, item.unit)
        const todayPrice = this.normalizeNumericField(item.todayPrice, rawText, item.unit)
        const todayPriceMin = this.normalizeNumericField(item.todayPriceMin, rawText, item.unit)
        const todayPriceMax = this.normalizeNumericField(item.todayPriceMax, rawText, item.unit)
        const expectedNextPrice = this.normalizeNumericField(item.expectedNextPrice, rawText, item.unit)
        const expectedNextPriceMin = this.normalizeNumericField(item.expectedNextPriceMin, rawText, item.unit)
        const expectedNextPriceMax = this.normalizeNumericField(item.expectedNextPriceMax, rawText, item.unit)
        const metadata = {
          ...(normalizeMetadata(item) || {}),
          originalUnit: normalizedValue.originalUnit,
          normalizedUnit: normalizedValue.normalizedUnit,
          valuesAlreadyNormalized: true,
        }

        return [{
          productKey: item.productKey,
          value: normalizedValue.normalizedValue,
          unit: 'INR/kg',
          source,
          sourceUrl,
          confidence: Number.isFinite(item.confidence)
            ? Number(item.confidence)
            : Number.isFinite(item.meta?.confidence)
              ? Number(item.meta?.confidence)
              : 0.75,
          rawText,
          displayName: item.displayName,
          currentPrice: currentPrice?.normalizedValue,
          lastWeekPrice: lastWeekPrice?.normalizedValue,
          lastWeekPriceMin: lastWeekPriceMin?.normalizedValue,
          lastWeekPriceMax: lastWeekPriceMax?.normalizedValue,
          todayPrice: todayPrice?.normalizedValue,
          todayPriceMin: todayPriceMin?.normalizedValue,
          todayPriceMax: todayPriceMax?.normalizedValue,
          expectedNextPrice: expectedNextPrice?.normalizedValue,
          expectedNextPriceMin: expectedNextPriceMin?.normalizedValue,
          expectedNextPriceMax: expectedNextPriceMax?.normalizedValue,
          shortDescription: item.shortDescription || undefined,
          trend: item.trend || undefined,
          analysisSummary: item.analysisSummary || undefined,
          analysisBullets: item.analysisBullets || undefined,
          historicalPoints: normalizeSeriesPoints(item.historicalPoints, rawText, item.unit),
          forecastPoints: normalizeSeriesPoints(item.forecastPoints, rawText, item.unit),
          metadata,
          sources: item.sources || undefined,
        }]
      })

    let perItemErrors = [
      ...(payload.items || [])
        .filter((item) => item?.productKey && !Number.isFinite(item.value) && !Number.isFinite(item.currentPrice))
        .map((item) => ({
          productKey: item.productKey,
          error: item.error || item.reason || item.meta?.reason || 'NO_DATA',
          sourceUrl: item.sourceUrl || item.meta?.sourceUrl || '',
          rawText: item.rawText || item.meta?.query || '',
          source: item.source || payload.source || 'Python Playwright Scraper',
          capturedAt: item.capturedAt,
        })),
      ...(payload.items || [])
        .filter((item) => item?.productKey && (Number.isFinite(item.value) || Number.isFinite(item.currentPrice)))
        .flatMap((item) => {
          const rawText = item.rawText || item.meta?.query || ''
          const normalized = this.normalizeNumericField(
            Number.isFinite(item.value) ? Number(item.value) : Number(item.currentPrice),
            rawText,
            item.unit,
          )

          if (normalized) {
            return []
          }

          return [{
            productKey: item.productKey,
            error: `Normalized price is outside safety range for ${item.productKey}.`,
            sourceUrl: item.sourceUrl || item.meta?.sourceUrl || '',
            rawText,
            source: item.source || payload.source || 'Python Playwright Scraper',
            capturedAt: item.capturedAt,
          }]
        }),
    ]

    const payloadMetadata = this.asRecord(payload.metadata)
    const payloadCoffeeBoard = this.asRecord(payloadMetadata?.coffeeBoard)
    const latestCoffeeRows = await this.pricesService.getLatestSuccessfulObservations([...this.coffeeProductKeys])
    const latestCoffeeRow = [...latestCoffeeRows.values()].sort(
      (left, right) => right.capturedAt.getTime() - left.capturedAt.getTime(),
    )[0]
    const latestCoffeeRunPayload = this.asRecord(latestCoffeeRow?.run.rawPayload)
    const latestCoffeeRunMetadata = this.asRecord(latestCoffeeRunPayload?.metadata)
    const latestCoffeeBoard = this.asRecord(latestCoffeeRunMetadata?.coffeeBoard)
    const latestFingerprint = this.asString(latestCoffeeBoard?.reportFingerprint)
    const latestReportDate = this.asString(latestCoffeeBoard?.reportDate)
    const currentFingerprint = this.asString(payloadCoffeeBoard?.reportFingerprint)
    const fetchStatus = this.asString(payloadCoffeeBoard?.reportStatus) || this.asString(payloadCoffeeBoard?.fetchStatus)
    const checkedAt = normalizedRunAt
    const carryForwardProductKeys = new Set<string>()
    let effectiveCoffeeBoardMetadata = payloadCoffeeBoard ? { ...payloadCoffeeBoard } : undefined

    if (latestCoffeeRow && currentFingerprint && latestFingerprint && currentFingerprint === latestFingerprint) {
      for (const productKey of latestCoffeeRows.keys()) {
        carryForwardProductKeys.add(productKey)
      }
      effectiveCoffeeBoardMetadata = {
        ...(effectiveCoffeeBoardMetadata || {}),
        reportStatus: 'NO_NEW_REPORT',
        reportFound: true,
        newReportDetected: false,
        usedPreviousSnapshot: true,
        checkedAt,
        lastCheckedAt: checkedAt,
        latestSuccessfulReportDate: latestReportDate,
        carryingForwardPreviousReport: true,
      }
      this.logger.log(
        `Coffee Board decision=NO_NEW_REPORT pageReportDate=${this.asString(payloadCoffeeBoard?.reportDate) ?? 'unknown'} ` +
        `storedReportDate=${latestReportDate ?? 'unknown'} fingerprint=${currentFingerprint.slice(0, 12)} reusedPreviousSnapshot=true`,
      )
    } else if (latestCoffeeRow && fetchStatus === 'FETCH_FAILED') {
      for (const productKey of latestCoffeeRows.keys()) {
        carryForwardProductKeys.add(productKey)
      }
      effectiveCoffeeBoardMetadata = {
        ...(effectiveCoffeeBoardMetadata || {}),
        reportStatus: 'FETCH_FAILED',
        reportFound: false,
        newReportDetected: false,
        usedPreviousSnapshot: true,
        checkedAt,
        lastCheckedAt: checkedAt,
        latestSuccessfulReportDate: latestReportDate,
        carryingForwardPreviousReport: true,
      }
      this.logger.warn(
        `Coffee Board decision=FETCH_FAILED storedReportDate=${latestReportDate ?? 'unknown'} reusedPreviousSnapshot=true reason=${this.asString(payloadCoffeeBoard?.reason) ?? 'unknown'}`,
      )
    } else if (payloadCoffeeBoard) {
      effectiveCoffeeBoardMetadata = {
        ...effectiveCoffeeBoardMetadata,
        reportStatus: 'NEW_REPORT',
        reportFound: true,
        newReportDetected: true,
        usedPreviousSnapshot: false,
        checkedAt,
        lastCheckedAt: checkedAt,
        latestSuccessfulReportDate: this.asString(payloadCoffeeBoard.reportDate) ?? latestReportDate,
        carryingForwardPreviousReport: false,
      }
      this.logger.log(
        `Coffee Board decision=NEW_REPORT pageReportDate=${this.asString(payloadCoffeeBoard.reportDate) ?? 'unknown'} ` +
        `storedReportDate=${latestReportDate ?? 'none'} reusedPreviousSnapshot=false`,
      )
    }

    if (carryForwardProductKeys.size > 0) {
      observations = observations.filter((item) => !carryForwardProductKeys.has(item.productKey))
      perItemErrors = perItemErrors.filter((item) => !carryForwardProductKeys.has(item.productKey))
    }

    const errors = [...perItemErrors, ...(payload.errors || []).map((item) => ({
      productKey: item.productKey,
      error: item.error,
      sourceUrl: item.sourceUrl || '',
      rawText: item.rawText || '',
      source: item.source || payload.source || 'Python Playwright Scraper',
      capturedAt: item.capturedAt,
    }))].filter((item) => !carryForwardProductKeys.has(item.productKey))

    const dto: IngestPricesDto = {
      runAt: normalizedRunAt,
      results: observations,
      errors,
      metadata: {
        ...(payloadMetadata || {}),
        source: payload.source,
        payloadFetchedAt: payload.fetchedAt,
        ingestedAt: new Date().toISOString(),
        carryForwardProductKeys: [...carryForwardProductKeys],
        coffeeBoard: effectiveCoffeeBoardMetadata,
      },
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
