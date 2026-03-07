import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { CreateDisputeDto } from './dto/create-dispute.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { CreateReviewDto } from './dto/create-review.dto'
import { UpdateCommissionRateDto } from './dto/update-commission-rate.dto'
import { OrdersService } from './orders.service'

@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('BUYER', 'ADMIN')
  @ApiOperation({ summary: 'Create order' })
  @ApiOkResponse({ description: 'Order created' })
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.userId, dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'List authenticated user orders' })
  @ApiOkResponse({ description: 'Orders retrieved' })
  listMine(@Req() req: { user: { userId: string } }) {
    return this.ordersService.listBuyerOrders(req.user.userId)
  }

  @Patch('commission-rate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: update global commission rate' })
  @ApiOkResponse({ description: 'Commission rate updated' })
  updateCommissionRate(@Body() dto: UpdateCommissionRateDto) {
    return this.ordersService.updateCommissionRate(dto)
  }

  @Post(':orderId/dispute')
  @Roles('BUYER')
  @ApiOperation({ summary: 'Raise dispute for order' })
  @ApiOkResponse({ description: 'Dispute created' })
  createDispute(
    @Param('orderId') orderId: string,
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateDisputeDto,
  ) {
    return this.ordersService.raiseDispute(orderId, req.user.userId, dto)
  }

  @Patch(':orderId/confirm')
  @Roles('BUYER', 'ADMIN')
  @ApiOperation({ summary: 'Buyer confirms delivery and unlocks payout eligibility' })
  @ApiOkResponse({ description: 'Order confirmed' })
  confirmOrder(@Param('orderId') orderId: string, @Req() req: { user: { userId: string } }) {
    return this.ordersService.confirmOrder(orderId, req.user.userId)
  }

  @Post(':orderId/review')
  @Roles('BUYER')
  @ApiOperation({ summary: 'Create transaction-weighted review for seller' })
  @ApiOkResponse({ description: 'Review created and seller rating updated' })
  createReview(
    @Param('orderId') orderId: string,
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateReviewDto,
  ) {
    return this.ordersService.createReview(orderId, req.user.userId, dto)
  }
}
