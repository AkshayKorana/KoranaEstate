import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { AdminService } from './admin.service'
import { HoldPayoutDto } from './dto/hold-payout.dto'
import { ResolveDisputeDto } from './dto/resolve-dispute.dto'
import { VerifyUserDto } from './dto/verify-user.dto'

@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('admin')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin platform metrics' })
  @ApiOkResponse({ description: 'Metrics retrieved' })
  metrics() {
    return this.adminService.metrics()
  }

  @Patch('payouts/:payoutId/release')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: release pending payout' })
  @ApiOkResponse({ description: 'Payout released' })
  releasePayout(
    @Param('payoutId') payoutId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.adminService.releasePayout(payoutId, req.user.userId)
  }

  @Patch('payouts/:payoutId/hold')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: place payout on hold' })
  @ApiOkResponse({ description: 'Payout held' })
  holdPayout(@Param('payoutId') payoutId: string, @Body() dto: HoldPayoutDto) {
    return this.adminService.holdPayout(payoutId, dto)
  }

  @Get('disputes')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: list disputes' })
  @ApiOkResponse({ description: 'Disputes retrieved' })
  disputes() {
    return this.adminService.listDisputes()
  }

  @Patch('disputes/:id/resolve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: resolve or reject dispute' })
  @ApiOkResponse({ description: 'Dispute updated' })
  resolveDispute(@Param('id') disputeId: string, @Body() dto: ResolveDisputeDto) {
    return this.adminService.resolveDispute(disputeId, dto)
  }

  @Patch('users/:id/verify')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: verify user and set verification level' })
  @ApiOkResponse({ description: 'User verification updated' })
  verifyUser(@Param('id') userId: string, @Body() dto: VerifyUserDto) {
    return this.adminService.verifyUser(userId, dto)
  }
}
