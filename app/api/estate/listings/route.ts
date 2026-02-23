import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'

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

// GET /api/estate/listings
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
      location?: { contains: string }
    } = { isActive: true }

    if (category) where.category = category
    if (listingType) where.listingType = listingType
    if (location) where.location = { contains: location }

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
    console.error('Error fetching estate listings:', error)
    return NextResponse.json({ error: 'Failed to fetch estate listings' }, { status: 500 })
  }
}

// POST /api/estate/listings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionEmail = session?.user?.email?.trim().toLowerCase()
    const sessionName = session?.user?.name ?? null

    let user: { id: string } | null = null
    if (sessionEmail) {
      const names = deriveUserNames({ name: sessionName, email: sessionEmail })
      user = await prisma.user.upsert({
        where: { email: sessionEmail },
        update: { name: names.name ?? undefined, fullName: names.fullName },
        create: {
          email: sessionEmail,
          name: names.name,
          fullName: names.fullName,
          passwordHash: 'oauth_user_no_password',
        },
        select: { id: true },
      })
    } else {
      // Fallback: when session misses email but JWT exists.
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
      const tokenSub = typeof token?.sub === 'string' ? token.sub : null
      if (tokenSub) {
        user = await prisma.user.findUnique({ where: { id: tokenSub }, select: { id: true } })
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in again and retry.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const category = typeof body?.category === 'string' ? body.category.trim() : ''
    const listingType = typeof body?.listingType === 'string' ? body.listingType.trim() : ''
    const unit = typeof body?.unit === 'string' ? body.unit.trim() : ''
    const location = typeof body?.location === 'string' ? body.location.trim() : ''
    const price = Number(body?.price)
    const quantity = body?.quantity == null || body?.quantity === '' ? null : Number(body.quantity)

    if (!title || !category || !listingType || !unit || !location || !Number.isFinite(price)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, category, listingType, unit, location, price' },
        { status: 400 }
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
        subcategory: typeof body?.subcategory === 'string' ? body.subcategory.trim() : null,
        listingType,
        price: Number(price.toFixed(2)),
        unit,
        quantity: quantity == null ? null : Number(quantity.toFixed(2)),
        location,
        description: typeof body?.description === 'string' ? body.description.trim() : null,
        contactPhone: typeof body?.contactPhone === 'string' ? body.contactPhone.trim() : null,
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error) {
    console.error('Error creating estate listing:', error)
    if (error instanceof Error && error.message.toLowerCase().includes('readonly database')) {
      return NextResponse.json(
        { error: 'Database is read-only. Please ensure prisma/dev.db is writable and restart dev server.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: 'Failed to create estate listing' }, { status: 500 })
  }
}
