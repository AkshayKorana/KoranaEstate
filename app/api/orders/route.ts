import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/orders - Create new order (authenticated buyers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { productId, quantity, shippingAddress, phone } = body

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, quantity' },
        { status: 400 }
      )
    }

    // Verify product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!product.isActive) {
      return NextResponse.json(
        { error: 'This product is no longer available' },
        { status: 400 }
      )
    }

    const orderQuantity = parseInt(quantity)
    if (orderQuantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be positive' },
        { status: 400 }
      )
    }

    if (orderQuantity > product.stock) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${product.stock}` },
        { status: 400 }
      )
    }

    const totalPrice = product.price * orderQuantity

    // Create order and update stock in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Reduce product stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: product.stock - orderQuantity }
      })

      // Create order
      return tx.order.create({
        data: {
          buyerId: user.id,
          productId,
          quantity: orderQuantity,
          totalPrice,
          shippingAddress,
          phone
        },
        include: {
          product: {
            include: {
              seller: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          buyer: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
