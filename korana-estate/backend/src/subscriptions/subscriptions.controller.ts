import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto'
import { SubscriptionsService } from './subscriptions.service'

@Controller({ path: 'subscriptions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('subscriptions')
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my subscription' })
  @ApiOkResponse({ description: 'Subscription retrieved' })
  me(@Req() req: { user: { userId: string } }) {
    return this.subscriptionsService.getMySubscription(req.user.userId)
  }

  @Post(':userId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: assign subscription to user' })
  @ApiOkResponse({ description: 'Subscription saved' })
  upsert(@Param('userId') userId: string, @Body() dto: UpsertSubscriptionDto) {
    return this.subscriptionsService.upsertForUser(userId, dto)
  }
}
