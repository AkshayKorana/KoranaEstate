import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { UsersService } from './users.service'

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiOkResponse({ description: 'User profile' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  me(@Req() req: { user: { userId: string } }) {
    return this.usersService.me(req.user.userId)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiOkResponse({ description: 'Updated profile' })
  updateMe(@Req() req: { user: { userId: string } }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto)
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: update user role' })
  @ApiOkResponse({ description: 'Updated role' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  updateRole(@Param('id') userId: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(userId, dto)
  }

  @Patch(':id/verify-seller')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: verify seller' })
  @ApiOkResponse({ description: 'Seller verification updated' })
  verifySeller(@Param('id') userId: string) {
    return this.usersService.verifySeller(userId, true)
  }

  @Get(':id/reputation')
  @ApiOperation({ summary: 'Get seller reputation aggregate' })
  @ApiOkResponse({ description: 'Seller reputation retrieved' })
  reputation(@Param('id') userId: string) {
    return this.usersService.reputation(userId)
  }
}
