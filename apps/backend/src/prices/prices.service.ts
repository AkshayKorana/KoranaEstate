import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Prisma, PriceObservationStatus, PriceRunStatus, type PriceIngestionRun, type PriceProduct } from '@prisma/client'
import type { Request } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { HistoryQueryDto } from './dto/history-query.dto'
import { IngestPricesDto } from './dto/ingest-prices.dto'
import { normalizeDetectedPrice, normalizePriceForIngest } from '../utils/normalizePrice'

export type PriceProductResponseItem = {
  productKey: string
  displayName: string
  unit: string
  defaultSource: string | null
  sourceUrl: string | null
  displayOrder: number
  enabled: boolean
}

export type PricesProductsResponse = {
  updatedAt: string
  products: PriceProductResponseItem[]
}

export type LatestRunResponse = {
  id: string
  runAt: string
  status: PriceRunStatus
  totalProducts: number
  successfulCount: number
  failedCount: number
  trigger: string
  createdAt: string
}

export type LatestPriceCard = {
  productKey: string
  displayName: string
  unit: string
  status: PriceObservationStatus
  value: number | null
  reason: 'NO_DATA' | 'MISSING_IN_RUN' | null
  source: string | null
  sourceUrl: string | null
  confidence: number | null
  rawText: string | null
  error: string | null
  capturedAt: string | null
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
  metadata?: Record<string, unknown> | null
  sources?: Array<{ title?: string; url: string; host?: string }>
}

export type PricesLatestResponse = {
  updatedAt: string
  run: LatestRunResponse | null
  lastSuccessfulRun: LatestRunResponse | null
  runHealth: {
    stale: boolean
    staleReason: string | null
    freshnessHours: number | null
    maxFreshnessHours: number
    scheduleTimeLocal: string
    scheduleTimezone: string
    latestRunStatus: PriceRunStatus | null
    latestRunAt: string | null
    lastSuccessfulRunAt: string | null
  }
  products: LatestPriceCard[]
}

export type PriceHistoryPoint = {
  capturedAt: string
  status: PriceObservationStatus
  value: number | null
  unit: string
  source: string | null
  sourceUrl: string | null
  confidence: number | null
  rawText: string | null
  error: string | null
  runId: string
  runAt: string
  runStatus: PriceRunStatus
}

export type PricesHistoryResponse = {
  updatedAt: string
  product: PriceProductResponseItem
  days: number
  summary: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    latestCapturedAt: string | null
    latestSuccessfulCapturedAt: string | null
  }
  history: PriceHistoryPoint[]
  daily: PriceHistoryPoint[]
}

export type PricesIngestResponse = {
  ok: true
  run: LatestRunResponse
  products: LatestPriceCard[]
  skipped?: boolean
  reason?: string
}

type IngestRow = {
  productId: string
  productKey: string
  capturedAt: Date
  status: PriceObservationStatus
  value: number | null
  unit: string
  source: string | null
  sourceUrl: string | null
  confidence: number | null
  rawText: string | null
  error: string | null
}

type RawPriceResult = Partial<LatestPriceCard> & {
  productKey?: string
}

type ObservationWithRunAndProduct = Prisma.PriceObservationGetPayload<{
  include: { run: true; product: true }
}>

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name)
  private readonly scheduleTimezone = process.env.PRICES_SCHEDULE_TIMEZONE || 'Asia/Kolkata'
  private readonly scheduleTimeLocal = process.env.PRICES_SCHEDULE_TIME_LOCAL || '09:00'
  private readonly staleAfterHours = Number(process.env.PRICES_STALE_AFTER_HOURS || 24)
  private readonly coffeeProductKeys = new Set([
    'arabica_parchment',
    'arabica_cherry',
    'robusta_parchment',
    'robusta_cherry',
  ])

  constructor(private readonly prisma: PrismaService) {}

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private asNumber(value: unknown): number | null | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private asStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
  }

  private isCoffeeProductKey(productKey: string) {
    return this.coffeeProductKeys.has(productKey)
  }

  private isCoffeeBoardObservation(
    source: string | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ) {
    const reportSourceLabel = this.asString(metadata?.reportSourceLabel)?.toLowerCase()
    const normalizedSource = (source || '').toLowerCase()
    return reportSourceLabel === 'coffee board india' || normalizedSource === 'coffee board india'
  }

  private asPointArray(value: unknown) {
    if (!Array.isArray(value)) {
      return undefined
    }

    return value
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        label: this.asString(item.label),
        date: this.asString(item.date),
        day: this.asString(item.day),
        value: this.asNumber(item.value) ?? null,
      }))
  }

  private asSourceArray(value: unknown) {
    if (!Array.isArray(value)) {
      return undefined
    }

    return value
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item.url === 'string'))
      .map((item) => ({
        title: this.asString(item.title),
        url: String(item.url),
        host: this.asString(item.host),
      }))
  }

  async getLatestSuccessfulObservations(productKeys: string[], beforeCapturedAt?: Date, coffeeBoardOnly = false) {
    if (productKeys.length === 0) {
      return new Map<string, ObservationWithRunAndProduct>()
    }

    let rows: ObservationWithRunAndProduct[] = []
    try {
      rows = await this.prisma.priceObservation.findMany({
        where: {
          productKey: { in: productKeys },
          status: PriceObservationStatus.OK,
          ...(beforeCapturedAt ? { capturedAt: { lt: beforeCapturedAt } } : {}),
        },
        orderBy: [{ capturedAt: 'desc' }, { createdAt: 'desc' }],
        include: { run: true, product: true },
      })
    } catch (error) {
      this.logPrismaError('getLatestSuccessfulObservations', error)
      throw new InternalServerErrorException('Failed to load previous successful observations.')
    }

    return rows.reduce((acc, row) => {
      if (acc.has(row.productKey)) {
        return acc
      }

      if (coffeeBoardOnly && this.isCoffeeProductKey(row.productKey)) {
        const rawResults = this.extractRawResults(row.run.rawPayload)
        const richFields = this.pickRichFields(rawResults.get(row.productKey))
        if (!this.isCoffeeBoardObservation(row.source, richFields.metadata || null)) {
          return acc
        }
      }

      acc.set(row.productKey, row)
      return acc
    }, new Map<string, ObservationWithRunAndProduct>())
  }

  private normalizeIngestField(
    value: number | undefined,
    rawText: string | undefined,
    explicitUnit: string | undefined,
    metadata: Record<string, unknown> | null,
  ) {
    if (!Number.isFinite(value)) {
      return undefined
    }

    if (metadata?.valuesAlreadyNormalized === true) {
      return Number(value)
    }

    const normalized = normalizeDetectedPrice(Number(value), rawText, explicitUnit)
    return normalized.sane ? normalized.normalizedValue : null
  }

  private normalizeSeriesPoints(
    points: Array<{ label?: string; date?: string; day?: string; value?: number | null }> | undefined,
    rawText: string | undefined,
    explicitUnit: string | undefined,
    metadata: Record<string, unknown> | null,
  ) {
    return points
      ?.map((point) => ({
        ...point,
        value: this.normalizeIngestField(
          typeof point.value === 'number' ? point.value : undefined,
          rawText,
          explicitUnit,
          metadata,
        ) ?? null,
      }))
      .filter((point) => point.value != null)
  }

  private extractRawResults(rawPayload: unknown): Map<string, RawPriceResult> {
    const payload = this.asRecord(rawPayload)
    const results = payload?.results
    if (!Array.isArray(results)) {
      return new Map()
    }

    const entries = results
      .map((item) => this.asRecord(item) as RawPriceResult | null)
      .filter((item): item is RawPriceResult => Boolean(item?.productKey))
      .map((item) => [String(item.productKey), item] as const)

    return new Map(entries)
  }

  private pickRichFields(rawResult: unknown): Partial<LatestPriceCard> {
    const result = this.asRecord(rawResult)
    if (!result) {
      return {}
    }

    return {
      currentPrice: this.asNumber(result.currentPrice),
      lastWeekPrice: this.asNumber(result.lastWeekPrice),
      lastWeekPriceMin: this.asNumber(result.lastWeekPriceMin),
      lastWeekPriceMax: this.asNumber(result.lastWeekPriceMax),
      todayPrice: this.asNumber(result.todayPrice),
      todayPriceMin: this.asNumber(result.todayPriceMin),
      todayPriceMax: this.asNumber(result.todayPriceMax),
      expectedNextPrice: this.asNumber(result.expectedNextPrice),
      expectedNextPriceMin: this.asNumber(result.expectedNextPriceMin),
      expectedNextPriceMax: this.asNumber(result.expectedNextPriceMax),
      shortDescription: this.asString(result.shortDescription),
      trend: this.asString(result.trend),
      analysisSummary: this.asString(result.analysisSummary),
      analysisBullets: this.asStringArray(result.analysisBullets),
      historicalPoints: this.asPointArray(result.historicalPoints),
      forecastPoints: this.asPointArray(result.forecastPoints),
      metadata: this.asRecord(result.metadata),
      sources: this.asSourceArray(result.sources),
    }
  }

  private logPrismaError(operation: string, error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `${operation} failed with Prisma code=${error.code} meta=${JSON.stringify(error.meta ?? {})}`,
        error.stack,
      )
      return
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(`${operation} failed with Prisma validation error: ${error.message}`, error.stack)
      return
    }
    if (error instanceof Error) {
      this.logger.error(`${operation} failed: ${error.message}`, error.stack)
      return
    }
    this.logger.error(`${operation} failed with unknown error: ${String(error)}`)
  }

  private localDayKey(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.scheduleTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
    const month = parts.find((part) => part.type === 'month')?.value ?? '00'
    const day = parts.find((part) => part.type === 'day')?.value ?? '00'
    return `${year}-${month}-${day}`
  }

  private computeRunHealth(latestRun: PriceIngestionRun | null, lastSuccessfulRun: PriceIngestionRun | null) {
    const latestRunAt = latestRun?.runAt ?? null
    const lastSuccessfulRunAt = lastSuccessfulRun?.runAt ?? null
    const freshnessHours = lastSuccessfulRunAt
      ? Number(((Date.now() - lastSuccessfulRunAt.getTime()) / (1000 * 60 * 60)).toFixed(1))
      : null

    let staleReason: string | null = null
    if (!lastSuccessfulRunAt) {
      staleReason = 'NO_RECENT_SUCCESSFUL_RUN'
    } else if (freshnessHours != null && freshnessHours > this.staleAfterHours) {
      staleReason = 'NO_RECENT_SUCCESSFUL_RUN'
    } else if (latestRun?.status === PriceRunStatus.FAILED) {
      staleReason = 'Latest scheduled run failed. Dashboard may be showing older observations.'
    }

    return {
      stale: Boolean(staleReason),
      staleReason,
      freshnessHours,
      maxFreshnessHours: this.staleAfterHours,
      scheduleTimeLocal: this.scheduleTimeLocal,
      scheduleTimezone: this.scheduleTimezone,
      latestRunStatus: latestRun?.status ?? null,
      latestRunAt: latestRunAt?.toISOString() ?? null,
      lastSuccessfulRunAt: lastSuccessfulRunAt?.toISOString() ?? null,
    }
  }

  assertCronAuthorized(request: Request) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      this.logger.error('Price pipeline authorization failed because CRON_SECRET is not configured on server.')
      throw new UnauthorizedException('CRON_SECRET is not configured on server.')
    }

    const authHeader = request.headers.authorization
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null
    const rawHeader = request.headers['x-cron-secret'] ?? request.get('X-Cron-Secret')
    const cronHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

    if (bearerToken !== secret && cronHeader !== secret) {
      this.logger.warn(
        `Price pipeline authorization failed for ip=${request.ip || 'unknown'} userAgent=${request.get('user-agent') || 'unknown'}`,
      )
      throw new UnauthorizedException('Invalid CRON secret.')
    }
  }

  async getEnabledProducts(): Promise<PriceProduct[]> {
    try {
      return await this.prisma.priceProduct.findMany({
        where: { enabled: true },
        orderBy: [{ displayOrder: 'asc' }, { productKey: 'asc' }],
      })
    } catch (error) {
      this.logPrismaError('getEnabledProducts', error)
      throw new InternalServerErrorException('Failed to load price products.')
    }
  }

  mapProduct(product: PriceProduct): PriceProductResponseItem {
    return {
      productKey: product.productKey,
      displayName: product.displayName,
      unit: product.unit,
      defaultSource: product.defaultSource,
      sourceUrl: product.sourceUrl,
      displayOrder: product.displayOrder,
      enabled: product.enabled,
    }
  }

  toRunResponse(run: PriceIngestionRun): LatestRunResponse {
    return {
      id: run.id,
      runAt: run.runAt.toISOString(),
      status: run.status,
      totalProducts: run.totalProducts,
      successfulCount: run.successfulCount,
      failedCount: run.failedCount,
      trigger: run.trigger,
      createdAt: run.createdAt.toISOString(),
    }
  }

  async products(): Promise<PricesProductsResponse> {
    const products = await this.getEnabledProducts()
    return {
      updatedAt: new Date().toISOString(),
      products: products.map((product) => this.mapProduct(product)),
    }
  }

  async latest(): Promise<PricesLatestResponse> {
    const enabledProducts = await this.getEnabledProducts()
    let latestRun: Prisma.PriceIngestionRunGetPayload<{
      include: { observations: { include: { product: true } } }
    }> | null = null
    let lastSuccessfulRun: PriceIngestionRun | null = null

    try {
      ;[latestRun, lastSuccessfulRun] = await Promise.all([
        this.prisma.priceIngestionRun.findFirst({
          orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            observations: {
              include: { product: true },
            },
          },
        }),
        this.prisma.priceIngestionRun.findFirst({
          where: {
            status: { in: [PriceRunStatus.SUCCESS, PriceRunStatus.PARTIAL] },
          },
          orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
        }),
      ])
    } catch (error) {
      this.logPrismaError('latest.findLatestRun', error)
      throw new InternalServerErrorException('Failed to load latest price run.')
    }

    if (!latestRun) {
      return {
        updatedAt: new Date().toISOString(),
        run: null,
        lastSuccessfulRun: null,
        runHealth: this.computeRunHealth(null, null),
        products: enabledProducts.map((product) => ({
          productKey: product.productKey,
          displayName: product.displayName,
          unit: product.unit,
          status: PriceObservationStatus.FAILED,
          value: null,
          reason: 'NO_DATA',
          source: product.defaultSource,
          sourceUrl: product.sourceUrl,
          confidence: null,
          rawText: null,
          error: 'No price run has been ingested yet.',
          capturedAt: null,
        })),
      }
    }

    const runPayload = this.asRecord(latestRun.rawPayload)
    const runMetadata = this.asRecord(runPayload?.metadata)
    const carryForwardProductKeys = new Set(this.asStringArray(runMetadata?.carryForwardProductKeys) || [])
    const coffeeBoardMetadata = this.asRecord(runMetadata?.coffeeBoard)
    const rawResults = this.extractRawResults(latestRun.rawPayload)
    const observationByKey = new Map(latestRun.observations.map((row) => [row.productKey, row]))
    const fallbackObservationByKey = carryForwardProductKeys.size > 0
      ? await this.getLatestSuccessfulObservations(
        enabledProducts
          .map((product) => product.productKey)
          .filter((productKey) => carryForwardProductKeys.has(productKey)),
        latestRun.runAt,
        true,
      )
      : new Map<string, ObservationWithRunAndProduct>()
    const cards = enabledProducts.map((product) => {
      const row = observationByKey.get(product.productKey)
      const richFields = this.pickRichFields(rawResults.get(product.productKey))
      const shouldCarryForward = carryForwardProductKeys.has(product.productKey)
      const fallbackRow = shouldCarryForward ? fallbackObservationByKey.get(product.productKey) : undefined
      if (!row) {
        if (fallbackRow) {
          const fallbackRichFields = this.pickRichFields(this.extractRawResults(fallbackRow.run.rawPayload).get(product.productKey))
          const fallbackMetadata = {
            ...(fallbackRichFields.metadata || {}),
            reportStatus: this.asString(coffeeBoardMetadata?.reportStatus) || 'PREVIOUS_REPORT_CARRIED_FORWARD',
            lastCheckedAt: latestRun.runAt.toISOString(),
            latestSuccessfulReportDate:
              this.asString(coffeeBoardMetadata?.latestSuccessfulReportDate)
              || this.asString((fallbackRichFields.metadata || {}).reportDate)
              || fallbackRow.capturedAt.toISOString(),
            carryingForwardPreviousReport: true,
            reportSourceLabel:
              this.asString(coffeeBoardMetadata?.reportSourceLabel)
              || this.asString((fallbackRichFields.metadata || {}).reportSourceLabel)
              || 'Coffee Board India',
          }

          return {
            productKey: fallbackRow.productKey,
            displayName: fallbackRow.product.displayName,
            unit: fallbackRow.unit,
            status: fallbackRow.status,
            value: fallbackRow.value,
            reason: null,
            source: fallbackRow.source,
            sourceUrl: fallbackRow.sourceUrl,
            confidence: fallbackRow.confidence,
            rawText: fallbackRow.rawText,
            error: fallbackRow.error,
            capturedAt: fallbackRow.capturedAt.toISOString(),
            ...fallbackRichFields,
            metadata: fallbackMetadata,
          }
        }

        return {
          productKey: product.productKey,
          displayName: product.displayName,
          unit: product.unit,
          status: PriceObservationStatus.FAILED,
          value: null,
          reason: 'MISSING_IN_RUN' as const,
          source: product.defaultSource,
          sourceUrl: product.sourceUrl,
          confidence: null,
          rawText: null,
          error: 'Product was not present in latest run payload.',
          capturedAt: latestRun.runAt.toISOString(),
          ...richFields,
        }
      }

      if (this.isCoffeeProductKey(product.productKey)) {
        const isCoffeeBoard = this.isCoffeeBoardObservation(row.source, richFields.metadata || null)

        if (!isCoffeeBoard) {
          if (fallbackRow) {
            const fallbackRichFields = this.pickRichFields(this.extractRawResults(fallbackRow.run.rawPayload).get(product.productKey))
            const fallbackMetadata = {
              ...(fallbackRichFields.metadata || {}),
              reportStatus: this.asString(coffeeBoardMetadata?.reportStatus) || 'TEMPORARILY_USING_LAST_VERIFIED_REPORT',
              lastCheckedAt: latestRun.runAt.toISOString(),
              latestSuccessfulReportDate:
                this.asString(coffeeBoardMetadata?.latestSuccessfulReportDate)
                || this.asString((fallbackRichFields.metadata || {}).reportDate)
                || fallbackRow.capturedAt.toISOString(),
              carryingForwardPreviousReport: true,
              reportSourceLabel:
                this.asString(coffeeBoardMetadata?.reportSourceLabel)
                || this.asString((fallbackRichFields.metadata || {}).reportSourceLabel)
                || 'Coffee Board India',
            }

            return {
              productKey: fallbackRow.productKey,
              displayName: fallbackRow.product.displayName,
              unit: fallbackRow.unit,
              status: fallbackRow.status,
              value: fallbackRow.value,
              reason: null,
              source: fallbackRow.source,
              sourceUrl: fallbackRow.sourceUrl,
              confidence: fallbackRow.confidence,
              rawText: fallbackRow.rawText,
              error: fallbackRow.error,
              capturedAt: fallbackRow.capturedAt.toISOString(),
              ...fallbackRichFields,
              metadata: fallbackMetadata,
            }
          }

          return {
            productKey: product.productKey,
            displayName: row.product.displayName,
            unit: product.unit,
            status: PriceObservationStatus.FAILED,
            value: null,
            reason: 'MISSING_IN_RUN' as const,
            source: 'Coffee Board India',
            sourceUrl: this.asString((richFields.metadata || {}).reportSourceUrl) || row.sourceUrl,
            confidence: null,
            rawText: null,
            error: 'Latest coffee data is not sourced from Coffee Board PDF.',
            capturedAt: latestRun.runAt.toISOString(),
            ...richFields,
          }
        }
      }

      return {
        productKey: row.productKey,
        displayName: row.product.displayName,
        unit: row.unit,
        status: row.status,
        value: row.value,
        reason: null,
        source: row.source,
        sourceUrl: row.sourceUrl,
        confidence: row.confidence,
        rawText: row.rawText,
        error: row.error,
        capturedAt: row.capturedAt.toISOString(),
        ...richFields,
      }
    })

    return {
      updatedAt: new Date().toISOString(),
      run: this.toRunResponse(latestRun),
      lastSuccessfulRun: lastSuccessfulRun ? this.toRunResponse(lastSuccessfulRun) : null,
      runHealth: this.computeRunHealth(latestRun, lastSuccessfulRun),
      products: cards,
    }
  }

  async history(query: HistoryQueryDto): Promise<PricesHistoryResponse> {
    let product: PriceProduct | null = null
    try {
      product = await this.prisma.priceProduct.findUnique({ where: { productKey: query.productKey } })
    } catch (error) {
      this.logPrismaError('history.findProduct', error)
      throw new InternalServerErrorException('Failed to load price history product.')
    }

    if (!product) {
      throw new NotFoundException(`Product ${query.productKey} not found.`)
    }

    const since = new Date()
    since.setDate(since.getDate() - query.days)

    let rows: Prisma.PriceObservationGetPayload<{ include: { run: true } }>[] = []
    try {
      rows = await this.prisma.priceObservation.findMany({
        where: {
          productKey: query.productKey,
          capturedAt: { gte: since },
        },
        orderBy: { capturedAt: 'asc' },
        include: { run: true },
      })
    } catch (error) {
      this.logPrismaError('history.findRows', error)
      throw new InternalServerErrorException('Failed to load price history.')
    }

    return {
      updatedAt: new Date().toISOString(),
      product: this.mapProduct(product),
      days: query.days,
      summary: {
        totalRuns: rows.length,
        successfulRuns: rows.filter((row) => row.status === PriceObservationStatus.OK).length,
        failedRuns: rows.filter((row) => row.status === PriceObservationStatus.FAILED).length,
        latestCapturedAt: rows.at(-1)?.capturedAt.toISOString() ?? null,
        latestSuccessfulCapturedAt:
          [...rows].reverse().find((row) => row.status === PriceObservationStatus.OK)?.capturedAt.toISOString() ?? null,
      },
      history: rows.map((row) => ({
        capturedAt: row.capturedAt.toISOString(),
        status: row.status,
        value: row.value,
        unit: row.unit,
        source: row.source,
        sourceUrl: row.sourceUrl,
        confidence: row.confidence,
        rawText: row.rawText,
        error: row.error,
        runId: row.runId,
        runAt: row.run.runAt.toISOString(),
        runStatus: row.run.status,
      })),
      daily: Array.from(
        rows.reduce((acc, row) => {
          acc.set(this.localDayKey(row.capturedAt), row)
          return acc
        }, new Map<string, Prisma.PriceObservationGetPayload<{ include: { run: true } }>>())
      ).map(([, row]) => ({
        capturedAt: row.capturedAt.toISOString(),
        status: row.status,
        value: row.value,
        unit: row.unit,
        source: row.source,
        sourceUrl: row.sourceUrl,
        confidence: row.confidence,
        rawText: row.rawText,
        error: row.error,
        runId: row.runId,
        runAt: row.run.runAt.toISOString(),
        runStatus: row.run.status,
      })),
    }
  }

  async findRunByTriggerAndRunAt(trigger: string, runAt: Date) {
    try {
      return await this.prisma.priceIngestionRun.findUnique({
        where: {
          trigger_runAt: {
            trigger,
            runAt,
          },
        },
      })
    } catch (error) {
      this.logPrismaError('findRunByTriggerAndRunAt', error)
      throw new InternalServerErrorException('Failed to inspect existing price run.')
    }
  }

  async recordExecutionFailure(params: {
    runAt: Date
    trigger: string
    totalProducts: number
    error: string
    logs?: { stdout?: string; stderr?: string }
    scraper?: Record<string, unknown>
  }) {
    try {
      const run = await this.prisma.priceIngestionRun.upsert({
        where: {
          trigger_runAt: {
            trigger: params.trigger,
            runAt: params.runAt,
          },
        },
        update: {
          status: PriceRunStatus.FAILED,
          totalProducts: params.totalProducts,
          successfulCount: 0,
          failedCount: params.totalProducts,
          rawPayload: {
            execution: {
              error: params.error,
              ...params.scraper,
            },
            logs: params.logs ?? {},
            metadata: {
              persistedAt: new Date().toISOString(),
              scheduleTimezone: this.scheduleTimezone,
              scheduleTimeLocal: this.scheduleTimeLocal,
            },
          } as Prisma.InputJsonValue,
        },
        create: {
          runAt: params.runAt,
          trigger: params.trigger,
          status: PriceRunStatus.FAILED,
          totalProducts: params.totalProducts,
          successfulCount: 0,
          failedCount: params.totalProducts,
          rawPayload: {
            execution: {
              error: params.error,
              ...params.scraper,
            },
            logs: params.logs ?? {},
            metadata: {
              persistedAt: new Date().toISOString(),
              scheduleTimezone: this.scheduleTimezone,
              scheduleTimeLocal: this.scheduleTimeLocal,
            },
          } as Prisma.InputJsonValue,
        },
      })

      return this.toRunResponse(run)
    } catch (error) {
      this.logPrismaError('recordExecutionFailure', error)
      throw new InternalServerErrorException('Failed to persist failed price run.')
    }
  }

  async ingest(dto: IngestPricesDto, trigger: string): Promise<PricesIngestResponse> {
    const runAt = new Date(dto.runAt)
    if (Number.isNaN(runAt.getTime())) {
      throw new BadRequestException('runAt must be a valid ISO date-time string.')
    }

    this.logger.log(
      `Starting prices ingest trigger=${trigger} runAt=${runAt.toISOString()} results=${dto.results.length} errors=${dto.errors?.length ?? 0}`,
    )

    const ingestMetadata = this.asRecord(dto.metadata)
    const coffeeBoardMetadata = this.asRecord(ingestMetadata?.coffeeBoard)
    const incomingReportDateIso = this.asString(coffeeBoardMetadata?.reportDateIso)
    const carryForwardProductKeys = new Set(this.asStringArray(ingestMetadata?.carryForwardProductKeys) || [])
    const products = await this.getEnabledProducts()
    const productMap = new Map(products.map((product) => [product.productKey, product]))

    if (incomingReportDateIso) {
      const lastRun = await this.prisma.priceIngestionRun.findFirst({
        where: {
          status: { in: [PriceRunStatus.SUCCESS, PriceRunStatus.PARTIAL] },
        },
        orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
      })
      const lastPayload = this.asRecord(lastRun?.rawPayload)
      const lastMetadata = this.asRecord(lastPayload?.metadata)
      const lastCoffeeBoard = this.asRecord(lastMetadata?.coffeeBoard)
      const lastReportDateIso = this.asString(lastCoffeeBoard?.reportDateIso)

      if (lastRun && lastReportDateIso === incomingReportDateIso) {
        this.logger.log(`Skipping ingest: same report date ${incomingReportDateIso} already processed`)
        return {
          ok: true,
          skipped: true,
          reason: 'Same Coffee Board report date already processed.',
          run: this.toRunResponse(lastRun),
          products: [],
        }
      }
    }

    const normalizedResults = dto.results.flatMap((result) => {
      const metadata = this.asRecord(result.metadata)
      const normalizedValue = this.normalizeIngestField(result.value, result.rawText, result.unit, metadata)

      if (normalizedValue == null) {
        this.logger.warn(
          `Skipping ${result.productKey} because normalized value fell outside sanity bounds. unit=${result.unit} raw=${JSON.stringify(result.rawText ?? '').slice(0, 200)}`,
        )
        return []
      }

      const alreadyNormalized = metadata?.valuesAlreadyNormalized === true
      const normalization = normalizePriceForIngest(result.value, {
        rawText: result.rawText,
        explicitUnit: result.unit,
        valuesAlreadyNormalized: alreadyNormalized,
      })
      const originalUnit = metadata?.originalUnit
        ? String(metadata.originalUnit)
        : normalization.originalUnit

      return [{
        ...result,
        value: normalizedValue,
        unit: 'INR/kg',
        currentPrice: this.normalizeIngestField(result.currentPrice, result.rawText, result.unit, metadata),
        lastWeekPrice: this.normalizeIngestField(result.lastWeekPrice, result.rawText, result.unit, metadata),
        lastWeekPriceMin: this.normalizeIngestField(result.lastWeekPriceMin, result.rawText, result.unit, metadata),
        lastWeekPriceMax: this.normalizeIngestField(result.lastWeekPriceMax, result.rawText, result.unit, metadata),
        todayPrice: this.normalizeIngestField(result.todayPrice, result.rawText, result.unit, metadata),
        todayPriceMin: this.normalizeIngestField(result.todayPriceMin, result.rawText, result.unit, metadata),
        todayPriceMax: this.normalizeIngestField(result.todayPriceMax, result.rawText, result.unit, metadata),
        expectedNextPrice: this.normalizeIngestField(result.expectedNextPrice, result.rawText, result.unit, metadata),
        expectedNextPriceMin: this.normalizeIngestField(result.expectedNextPriceMin, result.rawText, result.unit, metadata),
        expectedNextPriceMax: this.normalizeIngestField(result.expectedNextPriceMax, result.rawText, result.unit, metadata),
        historicalPoints: this.normalizeSeriesPoints(result.historicalPoints, result.rawText, result.unit, metadata),
        forecastPoints: this.normalizeSeriesPoints(result.forecastPoints, result.rawText, result.unit, metadata),
        metadata: {
          ...(metadata || {}),
          originalUnit,
          normalizedUnit: 'kg',
          valuesAlreadyNormalized: true,
        },
      }]
    })

    const resultsByKey = new Map(normalizedResults.map((result) => [result.productKey, result]))
    const errorsByKey = new Map((dto.errors ?? []).map((error) => [error.productKey, error]))

    const rows: IngestRow[] = products.reduce<IngestRow[]>((acc, product) => {
      if (carryForwardProductKeys.has(product.productKey)) {
        return acc
      }

      const result = resultsByKey.get(product.productKey)
      const ingestError = errorsByKey.get(product.productKey)

      if (ingestError) {
        acc.push({
          productId: product.id,
          productKey: product.productKey,
          capturedAt: runAt,
          status: PriceObservationStatus.FAILED,
          value: null,
          unit: product.unit,
          source: ingestError.source || product.defaultSource,
          sourceUrl: ingestError.sourceUrl || product.sourceUrl,
          confidence: null,
          rawText: ingestError.rawText || null,
          error: ingestError.error,
        })
        return acc
      }

      if (!result || !Number.isFinite(result.value)) {
        acc.push({
          productId: product.id,
          productKey: product.productKey,
          capturedAt: runAt,
          status: PriceObservationStatus.FAILED,
          value: null,
          unit: product.unit,
          source: product.defaultSource,
          sourceUrl: product.sourceUrl,
          confidence: null,
          rawText: null,
          error: 'No valid result in ingest payload.',
        })
        return acc
      }

      acc.push({
        productId: product.id,
        productKey: product.productKey,
        capturedAt: runAt,
        status: PriceObservationStatus.OK,
        value: Number(result.value),
          unit: result.unit || product.unit,
        source: result.source || product.defaultSource,
        sourceUrl: result.sourceUrl || product.sourceUrl,
        confidence: Number.isFinite(result.confidence) ? Number(result.confidence) : null,
        rawText: result.rawText || null,
        error: null,
      })
      return acc
    }, [])

    const successfulCount = rows.filter((row) => row.status === PriceObservationStatus.OK).length + carryForwardProductKeys.size
    const failedCount = products.length - successfulCount
    const status = failedCount === 0
      ? PriceRunStatus.SUCCESS
      : successfulCount === 0
        ? PriceRunStatus.FAILED
        : PriceRunStatus.PARTIAL

    const run = await this.prisma.$transaction(async (tx) => {
      const payloadJson = {
        runAt: dto.runAt,
        metadata: dto.metadata ?? {},
        results: normalizedResults.map((result) => ({
          productKey: result.productKey,
          value: result.value,
          unit: result.unit,
          source: result.source,
          sourceUrl: result.sourceUrl,
          confidence: result.confidence,
          rawText: result.rawText,
          displayName: result.displayName,
          currentPrice: result.currentPrice,
          lastWeekPrice: result.lastWeekPrice,
          lastWeekPriceMin: result.lastWeekPriceMin,
          lastWeekPriceMax: result.lastWeekPriceMax,
          todayPrice: result.todayPrice,
          todayPriceMin: result.todayPriceMin,
          todayPriceMax: result.todayPriceMax,
          expectedNextPrice: result.expectedNextPrice,
          expectedNextPriceMin: result.expectedNextPriceMin,
          expectedNextPriceMax: result.expectedNextPriceMax,
          shortDescription: result.shortDescription,
          trend: result.trend,
          analysisSummary: result.analysisSummary,
          analysisBullets: result.analysisBullets,
          historicalPoints: result.historicalPoints,
          forecastPoints: result.forecastPoints,
          metadata: result.metadata,
          sources: result.sources,
        })),
        errors: (dto.errors ?? []).map((error) => ({
          productKey: error.productKey,
          error: error.error,
          sourceUrl: error.sourceUrl,
          rawText: error.rawText,
          source: error.source,
          capturedAt: error.capturedAt,
        })),
        unknownProducts: {
          results: dto.results.filter((result) => !productMap.has(result.productKey)).map((result) => result.productKey),
          errors: (dto.errors ?? []).filter((error) => !productMap.has(error.productKey)).map((error) => error.productKey),
        },
      } as Prisma.InputJsonValue

      const createdRun = await tx.priceIngestionRun.upsert({
        where: {
          trigger_runAt: {
            trigger,
            runAt,
          },
        },
        update: {
          status,
          totalProducts: products.length,
          successfulCount,
          failedCount,
          rawPayload: payloadJson,
        },
        create: {
          runAt,
          status,
          totalProducts: products.length,
          successfulCount,
          failedCount,
          trigger,
          rawPayload: payloadJson,
        },
      })

      await tx.priceObservation.deleteMany({
        where: { runId: createdRun.id },
      })

      if (rows.length > 0) {
        await tx.priceObservation.createMany({
          data: rows.map((row) => ({
            runId: createdRun.id,
            productId: row.productId,
            productKey: row.productKey,
            capturedAt: row.capturedAt,
            status: row.status,
            value: row.value,
            unit: row.unit,
            source: row.source,
            sourceUrl: row.sourceUrl,
            confidence: row.confidence,
            rawText: row.rawText,
            error: row.error,
          })),
        })
      }

      return tx.priceIngestionRun.findUniqueOrThrow({
        where: { id: createdRun.id },
        include: {
          observations: {
            include: { product: true },
          },
        },
      })
    })

    this.logger.log(
      `Price DB write completed runId=${run.id} status=${run.status} success=${run.successfulCount} failed=${run.failedCount} carryForward=${carryForwardProductKeys.size}`,
    )

    const sortedObservations = [...run.observations].sort(
      (a, b) => a.product.displayOrder - b.product.displayOrder || a.product.productKey.localeCompare(b.product.productKey)
    )

    return {
      ok: true,
      run: this.toRunResponse(run),
      products: sortedObservations.map((row) => ({
        ...this.pickRichFields(resultsByKey.get(row.productKey)),
        productKey: row.productKey,
        displayName: row.product.displayName,
        unit: row.unit,
        status: row.status,
        value: row.value,
        reason: null,
        source: row.source,
        sourceUrl: row.sourceUrl,
        confidence: row.confidence,
        rawText: row.rawText,
        error: row.error,
        capturedAt: row.capturedAt.toISOString(),
      })),
    }
  }
}
