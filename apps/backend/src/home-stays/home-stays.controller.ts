import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateHomeStayDto } from './dto/create-home-stay.dto'
import { HomeStaysService } from './home-stays.service'

@Controller({ path: 'home-stays', version: '1' })
@ApiTags('home-stays')
export class HomeStaysController {
  constructor(private readonly homeStaysService: HomeStaysService) {}

  @Get()
  @ApiOperation({ summary: 'List home stays' })
  @ApiOkResponse({ description: 'Home stays retrieved' })
  list() {
    return this.homeStaysService.list()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get home stay by id' })
  @ApiOkResponse({ description: 'Home stay retrieved' })
  getById(@Param('id') id: string) {
    return this.homeStaysService.getById(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create home stay listing' })
  @ApiOkResponse({ description: 'Home stay created' })
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateHomeStayDto) {
    return this.homeStaysService.create(req.user.userId, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete home stay listing (owner only)' })
  @ApiOkResponse({ description: 'Home stay deleted' })
  @ApiForbiddenResponse({ description: 'Not owner' })
  remove(@Param('id') id: string, @Req() req: { user: { userId: string } }) {
    return this.homeStaysService.deleteById(id, req.user.userId)
  }
}
