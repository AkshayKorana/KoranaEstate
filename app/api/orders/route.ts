import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'

export const dynamic = 'force-dynamic'

// POST /api/orders - Create new order (authenticated buyers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const names = deriveUserNames({ name: session.user.name, email: session.user.email })
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: names.name ?? undefined, fullName: names.fullName },
      create: {
        email: session.user.email,
        name: names.name,
        fullName: names.fullName,
        passwordHash: 'oauth_user_no_password',
      },
    })

    const body = await request.json()
    const { productId, quantity, shippingAddress, phone } = body as {
      productId?: string
      quantity?: number | string
      shippingAddress?: string
      phone?: string
    }

    if (!productId || !quantity) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    const orderQuantity =
      typeof quantity === 'number' ? Math.floor(quantity) : parseInt(String(quantity), 10)
    if (!Number.isFinite(orderQuantity) || orderQuantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
    }

    // 1) Try web schema product lookup first.
    let webProduct: { id: string; price: number; stock: number; isActive: boolean } | null = null
    let useFallback = false

    try {
      webProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, price: true, stock: true, isActive: true },
      })
      if (!webProduct) useFallback = true
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error
      useFallback = true
    }

    // 2) Primary path (web schema).
    if (!useFallback && webProduct) {
      if (!webProduct.isActive) {
        return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
      }

      if (orderQuantity > webProduct.stock) {
        return NextResponse.json(
          { error: `Insufficient stock. Available: ${webProduct.stock}` },
          { status: 400 }
        )
      }

      const totalPrice = webProduct.price * orderQuantity

      try {
        const order = await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: productId },
            data: { stock: webProduct!.stock - orderQuantity },
          })

          return tx.order.create({
            data: {
              buyerId: user.id,
              productId,
              quantity: orderQuantity,
              totalPrice,
              shippingAddress,
              phone,
            },
            include: {
              product: {
                include: {
                  seller: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
              buyer: {
                select: { id: true, name: true, email: true },
              },
            },
          })
        })

        return NextResponse.json({ order }, { status: 201 })
      } catch (error) {
        if (!isPrismaSchemaCompatibilityError(error)) throw error
        // Fall through to backend-schema compatibility path.
      }
    }

    // 3) Compatibility fallback path (backend schema).
    const products = await prisma.$queryRawUnsafe<Array<{
      id: string
      sellerId: string
      title: string
      price: number
      stock: number
      isActive: boolean
      deletedAt: Date | null
    }>>(
      `SELECT
        rp."id",
        rp."sellerId",
        rp."title",
        rp."price"::double precision AS "price",
        rp."stock",
        rp."isActive",
        rp."deletedAt"
       FROM "RetailProduct" rp
       WHERE rp."id" = $1
       LIMIT 1`,
      productId,
    )

    let product = products[0]
    if (!product) {
      // Bridge: if product exists only in web schema, mirror it into RetailProduct for fallback ordering.
      const webRows = await prisma.$queryRawUnsafe<Array<{
        id: string
        sellerId: string
        name: string
        price: number
        stock: number
        isActive: boolean
      }>>(
        `SELECT
          p."id",
          p."sellerId",
          p."name",
          p."price"::double precision AS "price",
          p."stock",
          p."isActive"
         FROM "Product" p
         WHERE p."id" = $1
         LIMIT 1`,
        productId,
      )

      const wp = webRows[0]
      if (!wp) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "RetailProduct"
          ("id","sellerId","title","category","price","stock","description","isActive","createdAt","updatedAt")
         VALUES
          ($1,$2,$3,$4,$5::numeric,$6,NULL,$7,NOW(),NOW())
         ON CONFLICT ("id") DO NOTHING`,
        wp.id,
        wp.sellerId,
        wp.name,
        'Coffee Powder',
        wp.price,
        wp.stock,
        wp.isActive,
      )

      product = {
        id: wp.id,
        sellerId: wp.sellerId,
        title: wp.name,
        price: wp.price,
        stock: wp.stock,
        isActive: wp.isActive,
        deletedAt: null,
      }
    }
    if (!product.isActive || product.deletedAt) {
      return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
    }
    if (orderQuantity > product.stock) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${product.stock}` },
        { status: 400 }
      )
    }

    const unitPrice = Number(product.price)
    const lineTotal = Number((unitPrice * orderQuantity).toFixed(2))
    const commissionRate = 0.05
    const platformFee = Number((lineTotal * commissionRate).toFixed(2))
    const sellerPayout = Number((lineTotal - platformFee).toFixed(2))
    const orderId = randomUUID()

    const order = await prisma.$transaction(async (tx) => {
      const stockUpdate = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE "RetailProduct"
         SET "stock" = "stock" - $1,
             "updatedAt" = NOW()
         WHERE "id" = $2
           AND "stock" >= $1
         RETURNING "id"`,
        orderQuantity,
        productId,
      )

      if (stockUpdate.length === 0) {
        throw new Error('Insufficient stock. Please refresh and try again.')
      }

      const createdOrder = await tx.$queryRawUnsafe<Array<{
        id: string
        status: string
        createdAt: Date
        updatedAt: Date
        shippingAddress: string | null
      }>>(
        `INSERT INTO "Order"
          ("id","buyerId","status","totalAmount","commissionRate","platformFee","sellerPayout","shippingAddress","createdAt","updatedAt")
         VALUES
          ($1,$2,'PENDING',$3::numeric,$4::numeric,$5::numeric,$6::numeric,$7,NOW(),NOW())
         RETURNING "id","status","createdAt","updatedAt","shippingAddress"`,
        orderId,
        user.id,
        lineTotal,
        commissionRate,
        platformFee,
        sellerPayout,
        shippingAddress ?? null,
      )

      const orderRow = createdOrder[0]

      await tx.$executeRawUnsafe(
        `INSERT INTO "OrderItem"
          ("id","orderId","retailProductId","quantity","unitPrice","lineTotal","createdAt","updatedAt")
         VALUES
          ($1,$2,$3,$4,$5::numeric,$6::numeric,NOW(),NOW())`,
        randomUUID(),
        orderRow.id,
        productId,
        orderQuantity,
        unitPrice,
        lineTotal,
      )

      const sellerRows = await tx.$queryRawUnsafe<Array<{ id: string; name: string | null; email: string }>>(
        `SELECT "id", COALESCE("name","fullName") AS "name", "email"
         FROM "User" WHERE "id" = $1 LIMIT 1`,
        product.sellerId,
      )

      return {
        id: orderRow.id,
        buyerId: user.id,
        productId: product.id,
        quantity: orderQuantity,
        totalPrice: lineTotal,
        status: orderRow.status,
        shippingAddress: orderRow.shippingAddress,
        phone: phone ?? null,
        createdAt: orderRow.createdAt,
        updatedAt: orderRow.updatedAt,
        buyer: { id: user.id, name: user.name, email: user.email },
        product: {
          id: product.id,
          name: product.title,
          category: '',
          price: unitPrice,
          stock: Math.max(0, product.stock - orderQuantity),
          description: null,
          imageUrl: null,
          isActive: true,
          createdAt: orderRow.createdAt,
          updatedAt: orderRow.updatedAt,
          seller: sellerRows[0] ?? null,
        },
      }
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
