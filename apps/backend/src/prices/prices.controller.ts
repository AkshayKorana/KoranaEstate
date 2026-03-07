import { Body, Controller, Get, Header, Post, Query, Req } from '@nestjs/common'
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { HistoryQueryDto } from './dto/history-query.dto'
import { IngestObservationsDto } from './dto/ingest-observations.dto'
import { IngestPricesDto } from './dto/ingest-prices.dto'
import { PricesIngestService } from './prices-ingest.service'
import { PricesService } from './prices.service'

@Controller({ path: 'prices', version: '1' })
@ApiTags('prices')
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly pricesIngestService: PricesIngestService,
  ) {}

  @Get('products')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List enabled commodity products for ingestion.' })
  @ApiOkResponse({ description: 'Enabled products listed.' })
  products() {
    return this.pricesService.products()
  }

  @Get('latest')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get latest run and per-product latest values.' })
  @ApiOkResponse({ description: 'Latest run payload returned.' })
  latest() {
    return this.pricesService.latest()
  }

  @Get('history')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get product history for the requested day window.' })
  @ApiOkResponse({ description: 'History series returned.' })
  history(@Query() query: HistoryQueryDto) {
    return this.pricesService.history(query)
  }

  @Post('ingest')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Ingest one run payload for configured products.' })
  @ApiBody({ type: IngestPricesDto })
  @ApiOkResponse({ description: 'Run ingested successfully.' })
  ingest(@Req() request: Request, @Body() dto: IngestPricesDto) {
    this.pricesService.assertCronAuthorized(request)
    return this.pricesIngestService.ingestContract(dto, 'external-ingest')
  }

  @Post('ingest-observations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Ingest scraper observation payload directly.' })
  @ApiBody({ type: IngestObservationsDto })
  @ApiOkResponse({ description: 'Observation run ingested successfully.' })
  ingestObservations(@Req() request: Request, @Body() dto: IngestObservationsDto) {
    this.pricesService.assertCronAuthorized(request)
    return this.pricesIngestService.ingestScraperOutput(
      {
        source: 'external-observations-ingest',
        fetchedAt: dto.runAt,
        items: dto.observations.map((item) => ({
          productKey: item.productKey,
          value: item.price,
          unit: item.unit,
          meta: {
            query: item.rawText,
            confidence: item.confidence,
            sourceUrl: item.sourceUrl,
          },
        })),
        errors: dto.errors,
      },
      'external-observations-ingest',
      false
    )
  }
}
