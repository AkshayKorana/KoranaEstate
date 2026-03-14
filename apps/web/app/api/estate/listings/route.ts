import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/app/api/_session-user'

export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORIES = new Set([
  'Fertilizer',
  'Manure',
  'Pesticide',
  'Labor',
  'Worker',
  'Workers',
  'Machinery',
  'Vehicle Service',
  'Pick-Up and other Vehicle services',
  'Tools',
  'Irrigation',
  'Estate Equipment',
  'Estate Equipments',
  'Service',
])

const ALLOWED_LISTING_TYPES = new Set(['Product', 'Service'])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const listingType = searchParams.get('listingType')
    const location = searchParams.get('location')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: {
      isActive: boolean
      category?: string
      listingType?: string
      location?: { contains: string; mode: 'insensitive' }
    } = { isActive: true }

    if (category) where.category = category
    if (listingType) where.listingType = listingType
    if (location) where.location = { contains: location, mode: 'insensitive' }

    const listings = await prisma.estateListing.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 50,
    })

    return NextResponse.json({ listings })
  } catch (error) {
    console.error('apps/web estate listings GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch estate listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again and retry.' }, { status: 401 })
    }

    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const category = typeof body?.category === 'string' ? body.category.trim() : ''
    const listingType = typeof body?.listingType === 'string' ? body.listingType.trim() : ''
    const unit = typeof body?.unit === 'string' ? body.unit.trim() : ''
    const location = typeof body?.location === 'string' ? body.location.trim() : ''
    const subcategory = typeof body?.subcategory === 'string' ? body.subcategory.trim() : null
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const contactPhone = typeof body?.contactPhone === 'string' ? body.contactPhone.trim() : null
    const price = Number(body?.price)
    const quantity = body?.quantity == null || body?.quantity === '' ? null : Number(body.quantity)

    if (!title || !category || !listingType || !unit || !location || !Number.isFinite(price)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, category, listingType, unit, location, price' },
        { status: 400 },
      )
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ error: `Unsupported category: ${category}` }, { status: 400 })
    }
    if (!ALLOWED_LISTING_TYPES.has(listingType)) {
      return NextResponse.json({ error: 'listingType must be Product or Service' }, { status: 400 })
    }
    if (price <= 0 || (quantity != null && (!Number.isFinite(quantity) || quantity < 0))) {
      return NextResponse.json({ error: 'Price must be positive and quantity cannot be negative' }, { status: 400 })
    }

    const listing = await prisma.estateListing.create({
      data: {
        sellerId: user.id,
        title,
        category,
        subcategory,
        listingType,
        price: Number(price.toFixed(2)),
        unit,
        quantity: quantity == null ? null : Number(quantity.toFixed(2)),
        location,
        description,
        contactPhone,
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error) {
    console.error('apps/web estate listings POST failed', error)
    return NextResponse.json({ error: 'Failed to create estate listing' }, { status: 500 })
  }
}
