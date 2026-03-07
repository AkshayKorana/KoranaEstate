import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { CreateRetailProductDto } from './dto/create-retail-product.dto'
import { StoreService } from './store.service'

@Controller({ path: 'store', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('store')
@ApiBearerAuth()
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('products')
  @ApiOperation({ summary: 'List store products' })
  @ApiOkResponse({ description: 'Products retrieved' })
  products() {
    return this.storeService.getProducts()
  }

  @Post('products')
  @Roles('SELLER', 'ADMIN')
  @ApiOperation({ summary: 'Create store product' })
  @ApiOkResponse({ description: 'Product created' })
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateRetailProductDto) {
    return this.storeService.createProduct(req.user.userId, dto)
  }
}
