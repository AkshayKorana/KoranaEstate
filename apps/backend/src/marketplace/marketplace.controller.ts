import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { CreateBidDto } from './dto/create-bid.dto'
import { CreateRawProductDto } from './dto/create-raw-product.dto'
import { UpdateRawListingDto } from './dto/update-raw-listing.dto'
import { MarketplaceService } from './marketplace.service'

@Controller({ path: 'marketplace', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('marketplace')
@ApiBearerAuth()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('listings')
  @ApiOperation({ summary: 'List raw marketplace listings' })
  @ApiOkResponse({ description: 'Listings retrieved' })
  listings() {
    return this.marketplaceService.listProducts()
  }

  @Post('listings')
  @Roles('SELLER', 'ADMIN')
  @ApiOperation({ summary: 'Create raw marketplace listing' })
  @ApiOkResponse({ description: 'Listing created' })
  createListing(@Req() req: { user: { userId: string } }, @Body() dto: CreateRawProductDto) {
    return this.marketplaceService.createProduct(req.user.userId, dto)
  }

  @Post('listings/:id/bids')
  @Roles('BUYER', 'ADMIN')
  @ApiOperation({ summary: 'Place bid on listing' })
  @ApiOkResponse({ description: 'Bid created' })
  @ApiForbiddenResponse({ description: 'Cannot bid own listing' })
  createBid(
    @Param('id') rawProductId: string,
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateBidDto,
  ) {
    return this.marketplaceService.createBid(rawProductId, req.user.userId, dto)
  }

  @Patch('listings/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update listing (admin only)' })
  @ApiOkResponse({ description: 'Listing updated' })
  updateListing(
    @Param('id') rawProductId: string,
    @Req() req: { user: { userId: string; email: string } },
    @Body() dto: UpdateRawListingDto,
  ) {
    return this.marketplaceService.updateListing(rawProductId, req.user.userId, req.user.email, dto)
  }

  @Delete('listings/:id')
  @Roles('SELLER', 'ADMIN')
  @ApiOperation({ summary: 'Soft delete listing' })
  @ApiOkResponse({ description: 'Listing deleted' })
  deleteListing(
    @Param('id') rawProductId: string,
    @Req() req: { user: { userId: string; email?: string } },
  ) {
    return this.marketplaceService.softDeleteProduct(rawProductId, req.user.userId, req.user.email)
  }
}
