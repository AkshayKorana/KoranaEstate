import { Controller, Header, Post, Query, Req } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { PricesService } from '../prices/prices.service'
import { JobsService } from './jobs.service'

@Controller({ path: 'jobs/prices', version: '1' })
@ApiTags('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly pricesService: PricesService,
  ) {}

  @Post('run')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Run daily price pipeline using python playwright scraper.' })
  @ApiOkResponse({ description: 'Scraper run completed (ingest or dry-run).' })
  run(@Req() request: Request, @Query('dryRun') dryRun?: string) {
    this.pricesService.assertCronAuthorized(request)
    const shouldDryRun = dryRun === '1' || dryRun === 'true'
    return this.jobsService.runPriceScraper(shouldDryRun)
  }
}
