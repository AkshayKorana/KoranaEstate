import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DisputeStatus, OrderPaymentMethod, OrderSourceType, OrderStatus, PayoutStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationService } from '../notifications/notification.service'
import { CreateRawMarketplaceOrderDto } from './dto/create-raw-marketplace-order.dto'
import { CreateDisputeDto } from './dto/create-dispute.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrderCustomerDetailsDto } from './dto/order-customer-details.dto'
import { CreateReviewDto } from './dto/create-review.dto'
import { UpdateCommissionRateDto } from './dto/update-commission-rate.dto'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private orderInclude = {
    buyer: { select: { id: true, fullName: true, email: true } },
    items: {
      include: {
        retailProduct: {
          include: {
            seller: { select: { id: true, fullName: true, sellerVerified: true } },
          },
        },
      },
    },
  } as const

  private trim(value: string | null | undefined) {
    const next = value?.trim()
    return next ? next : null
  }

  private buildShippingAddress(customer?: OrderCustomerDetailsDto, fallback?: string | null) {
    if (customer) {
      const parts = [
        customer.addressLine1,
        customer.addressLine2,
        customer.landmark,
        customer.area,
        customer.city,
        customer.state,
        customer.pincode,
      ]
        .map((part) => this.trim(part))
        .filter(Boolean)

      return parts.join(', ')
    }

    return this.trim(fallback)
  }

  private customerData(customer?: OrderCustomerDetailsDto) {
    if (!customer) {
      return {
        customerName: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        area: null,
        city: null,
        state: null,
        pincode: null,
        landmark: null,
        orderNote: null,
      }
    }

    return {
      customerName: this.trim(customer.fullName),
      phone: this.trim(customer.mobileNumber),
      addressLine1: this.trim(customer.addressLine1),
      addressLine2: this.trim(customer.addressLine2),
      area: this.trim(customer.area),
      city: this.trim(customer.city),
      state: this.trim(customer.state),
      pincode: this.trim(customer.pincode),
      landmark: this.trim(customer.landmark),
      orderNote: this.trim(customer.orderNote),
    }
  }

  async createOrder(buyerId: string, dto: CreateOrderDto) {
    if (!dto.items.length) {
      throw new BadRequestException('At least one order item is required.')
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))]
    const products = await this.prisma.retailProduct.findMany({
      where: { id: { in: productIds } },
      include: { seller: { select: { id: true, fullName: true, sellerVerified: true } } },
    })
    const productMap = new Map(products.map((product) => [product.id, product]))
    const normalizedItems = dto.items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product || product.deletedAt || !product.isActive) {
        throw new NotFoundException(`Product ${item.productId} is not available.`)
      }
      if (item.quantity < 1) {
        throw new BadRequestException('Quantity must be at least 1.')
      }
      if (item.quantity > product.stock) {
        throw new BadRequestException(`Only ${product.stock} units are available for ${product.title}.`)
      }

      const unitPrice = Number(product.price)
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      }
    })

    const totalAmount = normalizedItems.reduce((acc, item) => acc + item.lineTotal, 0)
    const commissionRate = await this.getCommissionRate()
    const platformFee = totalAmount * commissionRate
    const sellerPayout = totalAmount - platformFee
    const primaryItem = normalizedItems[0]

    const order = await this.prisma.order.create({
      data: {
        buyerId,
        sourceType: OrderSourceType.STORE,
        paymentMethod: OrderPaymentMethod.COD,
        status: OrderStatus.PENDING,
        totalAmount,
        commissionRate,
        platformFee,
        sellerPayout,
        shippingAddress: this.buildShippingAddress(dto.customer),
        ...this.customerData(dto.customer),
        itemNameSnapshot: primaryItem?.product.title ?? null,
        itemCategorySnapshot: primaryItem?.product.category ?? null,
        itemImageUrlSnapshot: primaryItem?.product.imageUrl ?? null,
        sellerNameSnapshot: primaryItem?.product.seller.fullName ?? null,
        sellerIdSnapshot: primaryItem?.product.seller.id ?? null,
        unitLabelSnapshot: 'unit',
        quantitySnapshot: primaryItem?.quantity ?? null,
        unitPriceSnapshot: primaryItem?.unitPrice ?? null,
        items: {
          create: normalizedItems.map((item) => ({
            retailProductId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: this.orderInclude,
    })

    this.notificationService.notifyOrderCreated(order)
      .catch((err) => {
        console.error('[Order] Notification failed (non-blocking):', err instanceof Error ? err.message : String(err))
      })
    
    return order
  }

  async createRawMarketplaceOrder(buyerId: string, dto: CreateRawMarketplaceOrderDto) {
    const rawProduct = await this.prisma.rawProduct.findUnique({
      where: { id: dto.rawProductId },
      include: { seller: { select: { id: true, fullName: true, sellerVerified: true } } },
    })

    if (!rawProduct || rawProduct.deletedAt || !rawProduct.isActive) {
      throw new NotFoundException('Listing not available')
    }
    if (rawProduct.sellerId === buyerId) {
      throw new ForbiddenException('Seller cannot order own listing')
    }

    const availableQuantity = Number(rawProduct.quantityKg)
    if (dto.quantityKg <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.')
    }
    if (dto.quantityKg > availableQuantity) {
      throw new BadRequestException(`Only ${availableQuantity} kg is available for this listing.`)
    }

    const unitPrice = Number(rawProduct.pricePerKg)
    const totalAmount = unitPrice * dto.quantityKg
    const commissionRate = await this.getCommissionRate()
    const platformFee = totalAmount * commissionRate
    const sellerPayout = totalAmount - platformFee

    const order = await this.prisma.order.create({
      data: {
        buyerId,
        sourceType: OrderSourceType.RAW_MARKETPLACE,
        paymentMethod: OrderPaymentMethod.COD,
        status: OrderStatus.PENDING,
        totalAmount,
        commissionRate,
        platformFee,
        sellerPayout,
        shippingAddress: this.buildShippingAddress(dto.customer),
        ...this.customerData(dto.customer),
        itemNameSnapshot: rawProduct.commodityName,
        itemCategorySnapshot: rawProduct.grade,
        sellerNameSnapshot: rawProduct.seller.fullName,
        sellerIdSnapshot: rawProduct.seller.id,
        locationSnapshot: this.trim(rawProduct.location),
        unitLabelSnapshot: 'kg',
        quantitySnapshot: dto.quantityKg,
        unitPriceSnapshot: unitPrice,
        rawProductId: rawProduct.id,
      },
      include: this.orderInclude,
    })

    this.notificationService.notifyOrderCreated(order)
      .catch((err) => {
        console.error('[Order] Notification failed (non-blocking):', err instanceof Error ? err.message : String(err))
      })
    
    return order
  }

  listBuyerOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOrderById(orderId: string, userId: string, role?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: this.orderInclude,
    })
    if (!order) {
      throw new NotFoundException('Order not found')
    }
    if (order.buyerId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('You cannot access this order')
    }
    return order
  }

  async getCommissionRate() {
    const config = await this.prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, commissionRate: 0.05 },
    })
    return Number(config.commissionRate)
  }

  async updateCommissionRate(dto: UpdateCommissionRateDto) {
    return this.prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: { commissionRate: dto.commissionRate },
      create: { id: 1, commissionRate: dto.commissionRate },
    })
  }

  async raiseDispute(orderId: string, userId: string, dto: CreateDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can raise dispute on this order')

    const existingOpen = await this.prisma.dispute.findFirst({
      where: { orderId, status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } },
    })
    if (existingOpen) return existingOpen

    return this.prisma.dispute.create({
      data: {
        orderId,
        raisedByUserId: userId,
        reason: dto.reason,
      },
    })
  }

  async confirmOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can confirm this order')

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED },
    })

    await this.prisma.payout.updateMany({
      where: { orderId, status: PayoutStatus.PENDING, releaseEligibleAt: null },
      data: { releaseEligibleAt: new Date() },
    })

    return updated
  }

  async createReview(orderId: string, userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            retailProduct: { select: { sellerId: true } },
          },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.buyerId !== userId) throw new ForbiddenException('Only buyer can review this order')

    const sellerTotals = new Map<string, number>()
    for (const item of order.items) {
      const sellerId = item.retailProduct.sellerId
      const line = Number(item.lineTotal)
      sellerTotals.set(sellerId, (sellerTotals.get(sellerId) ?? 0) + line)
    }
    const sellerIds = [...sellerTotals.keys()]
    if (!sellerIds.length) throw new BadRequestException('No seller found on this order')

    let targetSellerId = dto.targetSellerId ?? null
    if (targetSellerId) {
      if (!sellerTotals.has(targetSellerId)) {
        throw new BadRequestException('targetSellerId is not part of this order')
      }
    } else {
      targetSellerId = sellerIds.sort((a, b) => (sellerTotals.get(b) ?? 0) - (sellerTotals.get(a) ?? 0))[0]
    }

    const existing = await this.prisma.review.findFirst({
      where: { authorId: userId, targetId: targetSellerId, orderId },
    })
    const review =
      existing ??
      (await this.prisma.review.create({
        data: {
          authorId: userId,
          targetId: targetSellerId,
          orderId,
          rating: dto.rating,
          comment: dto.comment,
        },
      }))

    await this.recalculateSellerRating(targetSellerId)
    return review
  }

  private async recalculateSellerRating(sellerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { targetId: sellerId },
      include: {
        order: { select: { totalAmount: true } },
      },
    })

    const totalReviews = reviews.length
    const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = totalReviews ? totalRating / totalReviews : 0

    const weighted = reviews.reduce(
      (acc, r) => {
        const weight = r.order ? Number(r.order.totalAmount) : 1
        return {
          weightedSum: acc.weightedSum + r.rating * weight,
          weightTotal: acc.weightTotal + weight,
        }
      },
      { weightedSum: 0, weightTotal: 0 },
    )
    const weightedScore = weighted.weightTotal > 0 ? weighted.weightedSum / weighted.weightTotal : 0

    await this.prisma.sellerRating.upsert({
      where: { sellerId },
      update: {
        averageRating,
        totalReviews,
        weightedScore,
      },
      create: {
        sellerId,
        averageRating,
        totalReviews,
        weightedScore,
      },
    })
  }
}
