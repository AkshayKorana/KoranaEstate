import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { ProSubscriptionGuard } from '../common/guards/pro-subscription.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CreateMarketPriceDto } from './dto/create-market-price.dto'
import { MarketIntelligenceService } from './market-intelligence.service'

@Controller({ path: 'market-intelligence', version: '1' })
@ApiTags('market-intelligence')
export class MarketIntelligenceController {
  constructor(private readonly marketService: MarketIntelligenceService) {}

  @Get(':commodityName/chart')
  @ApiOperation({ summary: 'Get chart-ready market data' })
  @ApiOkResponse({ description: 'Price series retrieved' })
  chart(@Param('commodityName') commodityName: string) {
    return this.marketService.chartData(commodityName)
  }

  @Get(':commodityName/advanced')
  @UseGuards(JwtAuthGuard, ProSubscriptionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'PRO: advanced market intelligence data' })
  @ApiOkResponse({ description: 'Advanced series and stats retrieved' })
  advanced(@Param('commodityName') commodityName: string) {
    return this.marketService.advancedData(commodityName)
  }

  @Post('prices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: ingest market price record' })
  @ApiOkResponse({ description: 'Market price created' })
  create(@Body() dto: CreateMarketPriceDto) {
    return this.marketService.create(dto)
  }
}
