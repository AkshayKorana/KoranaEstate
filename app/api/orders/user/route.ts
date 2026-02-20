import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/orders/user - Get user's orders
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') // 'buyer' or 'seller'

    let orders

    if (role === 'seller') {
      // Get orders for my products
      orders = await prisma.order.findMany({
        where: {
          product: { sellerId: user.id }
        },
        include: {
          buyer: {
            select: { id: true, name: true, email: true }
          },
          product: true
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      // Get my orders as buyer
      orders = await prisma.order.findMany({
        where: { buyerId: user.id },
        include: {
          product: {
            include: {
              seller: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
