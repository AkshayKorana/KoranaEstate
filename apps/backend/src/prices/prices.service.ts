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
}

export type PricesLatestResponse = {
  updatedAt: string
  run: LatestRunResponse | null
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
}

export type PricesHistoryResponse = {
  updatedAt: string
  product: PriceProductResponseItem
  days: number
  history: PriceHistoryPoint[]
}

export type PricesIngestResponse = {
  ok: true
  run: LatestRunResponse
  products: LatestPriceCard[]
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

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name)

  constructor(private readonly prisma: PrismaService) {}

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

  assertCronAuthorized(request: Request) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET is not configured on server.')
    }

    const authHeader = request.headers.authorization
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null
    const rawHeader = request.headers['x-cron-secret'] ?? request.get('X-Cron-Secret')
    const cronHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

    if (bearerToken !== secret && cronHeader !== secret) {
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

    try {
      latestRun = await this.prisma.priceIngestionRun.findFirst({
        orderBy: [{ runAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          observations: {
            include: { product: true },
          },
        },
      })
    } catch (error) {
      this.logPrismaError('latest.findLatestRun', error)
      throw new InternalServerErrorException('Failed to load latest price run.')
    }

    if (!latestRun) {
      return {
        updatedAt: new Date().toISOString(),
        run: null,
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

    const observationByKey = new Map(latestRun.observations.map((row) => [row.productKey, row]))
    const cards = enabledProducts.map((product) => {
      const row = observationByKey.get(product.productKey)
      if (!row) {
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
      }
    })

    return {
      updatedAt: new Date().toISOString(),
      run: this.toRunResponse(latestRun),
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
      })),
    }
  }

  async ingest(dto: IngestPricesDto, trigger: string): Promise<PricesIngestResponse> {
    const runAt = new Date(dto.runAt)
    if (Number.isNaN(runAt.getTime())) {
      throw new BadRequestException('runAt must be a valid ISO date-time string.')
    }

    const products = await this.getEnabledProducts()
    const productMap = new Map(products.map((product) => [product.productKey, product]))

    const resultsByKey = new Map(dto.results.map((result) => [result.productKey, result]))
    const errorsByKey = new Map((dto.errors ?? []).map((error) => [error.productKey, error]))

    const rows: IngestRow[] = products.map((product) => {
      const result = resultsByKey.get(product.productKey)
      const ingestError = errorsByKey.get(product.productKey)

      if (ingestError) {
        return {
          productId: product.id,
          productKey: product.productKey,
          capturedAt: runAt,
          status: PriceObservationStatus.FAILED,
          value: null,
          unit: product.unit,
          source: product.defaultSource,
          sourceUrl: ingestError.sourceUrl || product.sourceUrl,
          confidence: null,
          rawText: null,
          error: ingestError.error,
        }
      }

      if (!result || !Number.isFinite(result.value)) {
        return {
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
        }
      }

      return {
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
      }
    })

    const successfulCount = rows.filter((row) => row.status === PriceObservationStatus.OK).length
    const failedCount = rows.length - successfulCount
    const status = failedCount === 0
      ? PriceRunStatus.SUCCESS
      : successfulCount === 0
        ? PriceRunStatus.FAILED
        : PriceRunStatus.PARTIAL

    const run = await this.prisma.$transaction(async (tx) => {
      const createdRun = await tx.priceIngestionRun.create({
        data: {
          runAt,
          status,
          totalProducts: rows.length,
          successfulCount,
          failedCount,
          trigger,
          rawPayload: {
            runAt: dto.runAt,
            results: dto.results.map((result) => ({
              productKey: result.productKey,
              value: result.value,
              unit: result.unit,
              source: result.source,
              sourceUrl: result.sourceUrl,
              confidence: result.confidence,
              rawText: result.rawText,
            })),
            errors: (dto.errors ?? []).map((error) => ({
              productKey: error.productKey,
              error: error.error,
              sourceUrl: error.sourceUrl,
            })),
            unknownProducts: {
              results: dto.results.filter((result) => !productMap.has(result.productKey)).map((result) => result.productKey),
              errors: (dto.errors ?? []).filter((error) => !productMap.has(error.productKey)).map((error) => error.productKey),
            },
          } as Prisma.InputJsonValue,
        },
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

    const sortedObservations = [...run.observations].sort(
      (a, b) => a.product.displayOrder - b.product.displayOrder || a.product.productKey.localeCompare(b.product.productKey)
    )

    return {
      ok: true,
      run: this.toRunResponse(run),
      products: sortedObservations.map((row) => ({
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
