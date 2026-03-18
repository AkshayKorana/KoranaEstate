import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'
import { requireSessionUser } from '@/app/api/_session-user'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    const quantity = typeof body?.quantity === 'number' ? Math.floor(body.quantity) : parseInt(String(body?.quantity || ''), 10)
    const shippingAddress = typeof body?.shippingAddress === 'string' ? body.shippingAddress.trim() : null
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    let webProduct: { id: string; sellerId: string; price: number; stock: number; isActive: boolean } | null = null
    let useFallback = false

    try {
      webProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sellerId: true, price: true, stock: true, isActive: true },
      })
      if (!webProduct) useFallback = true
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error
      useFallback = true
    }

    if (!useFallback && webProduct) {
      if (!webProduct.isActive) {
        return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
      }
      if (quantity > webProduct.stock) {
        return NextResponse.json({ error: `Insufficient stock. Available: ${webProduct.stock}` }, { status: 400 })
      }

      try {
        const order = await prisma.$transaction(async (tx: any) => {
          const updated = await tx.product.update({
            where: { id: productId },
            data: { stock: webProduct!.stock - quantity },
          })

          return tx.order.create({
            data: {
              buyerId: user.id,
              productId,
              quantity,
              totalPrice: Number((webProduct!.price * quantity).toFixed(2)),
              shippingAddress,
              phone,
            },
            include: {
              buyer: {
                select: { id: true, name: true, email: true },
              },
              product: {
                include: {
                  seller: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          }).then((created: any) => ({
            ...created,
            product: {
              ...created.product,
              stock: updated.stock,
            },
          }))
        })

        return NextResponse.json({ order }, { status: 201 })
      } catch (error) {
        if (!isPrismaSchemaCompatibilityError(error)) throw error
      }
    }

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
    if (quantity > product.stock) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${product.stock}` }, { status: 400 })
    }

    const unitPrice = Number(product.price)
    const lineTotal = Number((unitPrice * quantity).toFixed(2))
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
        quantity,
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
        shippingAddress,
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
        quantity,
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
        quantity,
        totalPrice: lineTotal,
        status: orderRow.status,
        shippingAddress: orderRow.shippingAddress,
        phone,
        createdAt: orderRow.createdAt,
        updatedAt: orderRow.updatedAt,
        buyer: { id: user.id, name: user.name, email: user.email },
        product: {
          id: product.id,
          name: product.title,
          category: '',
          price: unitPrice,
          stock: Math.max(0, product.stock - quantity),
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
    console.error('apps/web orders POST failed', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
