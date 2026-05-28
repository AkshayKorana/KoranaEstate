import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRetailProductDto } from './dto/create-retail-product.dto'
import { UpdateRetailProductDto } from './dto/update-retail-product.dto'

const ADMIN_EMAILS = new Set(['akshay.koranaest@gmail.com', 'koranaestate@gmail.com'])

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  getProducts() {
    return this.prisma.retailProduct.findMany({
      where: { deletedAt: null, isActive: true },
      include: { seller: { select: { id: true, fullName: true, sellerVerified: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  createProduct(sellerId: string, dto: CreateRetailProductDto) {
    return this.prisma.retailProduct.create({ data: { ...dto, sellerId } })
  }

  async updateProduct(productId: string, requesterId: string, requesterEmail: string, dto: UpdateRetailProductDto) {
    const product = await this.prisma.retailProduct.findUnique({ where: { id: productId } })
    if (!product || product.deletedAt) throw new NotFoundException('Product not found')
    const isAdmin = ADMIN_EMAILS.has(requesterEmail) || product.sellerId === requesterId
    if (!isAdmin) throw new ForbiddenException('Not authorized to edit this product')
    return this.prisma.retailProduct.update({ where: { id: productId }, data: dto })
  }

  async softDeleteProduct(productId: string, requesterId: string, requesterEmail: string) {
    const product = await this.prisma.retailProduct.findUnique({ where: { id: productId } })
    if (!product || product.deletedAt) throw new NotFoundException('Product not found')
    const isAdmin = ADMIN_EMAILS.has(requesterEmail) || product.sellerId === requesterId
    if (!isAdmin) throw new ForbiddenException('Not authorized to delete this product')
    return this.prisma.retailProduct.update({
      where: { id: productId },
      data: { deletedAt: new Date(), isActive: false },
    })
  }
}
