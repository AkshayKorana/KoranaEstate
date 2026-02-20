import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/products - Get all active products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { isActive: true }
    if (category) where.category = category

    const total = await prisma.product.count({ where })

    const products = await prisma.product.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product (authenticated sellers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: {
        name: session.user.name ?? undefined,
      },
      create: {
        email: session.user.email,
        name: session.user.name ?? null,
        // Placeholder for non-credentials users; credentials signup sets real hash.
        passwordHash: 'oauth_user_no_password',
      },
    })

    const body = await request.json()
    const { name, category, price, stock, description, imageUrl } = body
    const nameStr = typeof name === 'string' ? name.trim() : ''
    const categoryStr = typeof category === 'string' ? category.trim() : ''
    const priceNum = Number(price)
    const stockNum = Number(stock)

    // Validation
    if (!nameStr || !categoryStr || !Number.isFinite(priceNum) || !Number.isFinite(stockNum)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, price, stock' },
        { status: 400 }
      )
    }

    if (priceNum <= 0 || stockNum < 0) {
      return NextResponse.json(
        { error: 'Price must be positive and stock cannot be negative' },
        { status: 400 }
      )
    }

    const product = await prisma.product.create({
      data: {
        sellerId: user.id,
        name: nameStr,
        category: categoryStr,
        price: Number(priceNum.toFixed(2)),
        stock: Math.floor(stockNum),
        description,
        imageUrl
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
