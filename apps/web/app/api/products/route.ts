import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/app/api/_session-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where: { isActive: boolean; category?: string } = { isActive: true }
    if (category) where.category = category

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          seller: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
        skip: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
      }),
    ])

    return NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      },
    })
  } catch (error) {
    console.error('apps/web products GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const category = typeof body?.category === 'string' ? body.category.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : null
    const price = Number(body?.price)
    const stock = Number(body?.stock)

    if (!name || !category || !Number.isFinite(price) || !Number.isFinite(stock)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, price, stock' },
        { status: 400 },
      )
    }

    if (price <= 0 || stock < 0) {
      return NextResponse.json({ error: 'Price must be positive and stock cannot be negative' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        sellerId: user.id,
        name,
        category,
        price: Number(price.toFixed(2)),
        stock: Math.floor(stock),
        description,
        imageUrl,
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('apps/web products POST failed', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
