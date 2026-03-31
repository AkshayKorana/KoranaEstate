import { Controller, Header, Logger, Post, Query, Req } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { PricesService } from '../prices/prices.service'
import { JobsService } from './jobs.service'

@Controller({ path: 'jobs/prices', version: '1' })
@ApiTags('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name)

  constructor(
    private readonly jobsService: JobsService,
    private readonly pricesService: PricesService,
  ) {}

  @Post('run')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Run daily price pipeline using python playwright scraper.' })
  @ApiOkResponse({ description: 'Scraper run completed (ingest or dry-run).' })
  async run(@Req() request: Request, @Query('dryRun') dryRun?: string) {
    this.pricesService.assertCronAuthorized(request)
    const shouldDryRun = dryRun === '1' || dryRun === 'true'
    this.logger.log(
      `Price scheduler hit received dryRun=${shouldDryRun} ip=${request.ip || 'unknown'} userAgent=${request.get('user-agent') || 'unknown'}`,
    )
    this.logger.log(`Price scheduler auth validated dryRun=${shouldDryRun}`)
    const result = await this.jobsService.runPriceScraper({
      dryRun: shouldDryRun,
      trigger: shouldDryRun ? 'manual-http-dry-run' : 'manual-http',
    })
    this.logger.log(`Price scheduler run completed dryRun=${shouldDryRun} ok=${Boolean((result as { ok?: boolean })?.ok)}`)
    return result
  }
}
