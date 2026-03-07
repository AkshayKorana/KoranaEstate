import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBidDto } from './dto/create-bid.dto'
import { CreateRawProductDto } from './dto/create-raw-product.dto'

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  listProducts() {
    return this.prisma.rawProduct.findMany({
      where: { deletedAt: null, isActive: true },
      include: { seller: { select: { id: true, fullName: true, sellerVerified: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  createProduct(sellerId: string, dto: CreateRawProductDto) {
    return this.prisma.rawProduct.create({
      data: { ...dto, sellerId },
    })
  }

  async createBid(rawProductId: string, buyerId: string, dto: CreateBidDto) {
    const rawProduct = await this.prisma.rawProduct.findUnique({ where: { id: rawProductId } })
    if (!rawProduct || rawProduct.deletedAt || !rawProduct.isActive) {
      throw new NotFoundException('Listing not available')
    }
    if (rawProduct.sellerId === buyerId) {
      throw new ForbiddenException('Seller cannot bid own listing')
    }

    return this.prisma.bid.create({
      data: {
        rawProductId,
        buyerId,
        amountPerKg: dto.amountPerKg,
        quantityKg: dto.quantityKg,
        note: dto.note,
      },
    })
  }

  async softDeleteProduct(rawProductId: string, sellerId: string) {
    const product = await this.prisma.rawProduct.findUnique({ where: { id: rawProductId } })
    if (!product || product.deletedAt) throw new NotFoundException('Listing not found')
    if (product.sellerId !== sellerId) throw new ForbiddenException('Not your listing')

    return this.prisma.rawProduct.update({
      where: { id: rawProductId },
      data: { deletedAt: new Date(), isActive: false },
    })
  }
}
