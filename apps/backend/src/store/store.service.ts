import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRetailProductDto } from './dto/create-retail-product.dto'

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
}
