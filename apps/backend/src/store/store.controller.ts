import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { CreateRetailProductDto } from './dto/create-retail-product.dto'
import { UpdateRetailProductDto } from './dto/update-retail-product.dto'
import { StoreService } from './store.service'

@Controller({ path: 'store', version: '1' })
@ApiTags('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('products')
  @ApiOperation({ summary: 'List store products' })
  @ApiOkResponse({ description: 'Products retrieved' })
  products() {
    return this.storeService.getProducts()
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create store product' })
  @ApiOkResponse({ description: 'Product created' })
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateRetailProductDto) {
    return this.storeService.createProduct(req.user.userId, dto)
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update store product (admin only)' })
  @ApiOkResponse({ description: 'Product updated' })
  updateProduct(
    @Param('id') productId: string,
    @Req() req: { user: { userId: string; email: string } },
    @Body() dto: UpdateRetailProductDto,
  ) {
    return this.storeService.updateProduct(productId, req.user.userId, req.user.email, dto)
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete store product (admin only)' })
  @ApiOkResponse({ description: 'Product deleted' })
  deleteProduct(
    @Param('id') productId: string,
    @Req() req: { user: { userId: string; email: string } },
  ) {
    return this.storeService.softDeleteProduct(productId, req.user.userId, req.user.email)
  }
}
