import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // POST routes need dynamic; GET adds its own cache header

// GET /api/raw/listings - Get all active listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commodity = searchParams.get('commodity')
    const location = searchParams.get('location')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { isActive: true }
    if (commodity) where.commodity = commodity
    if (location) where.location = { contains: location, mode: 'insensitive' }

    const listings = await prisma.rawListing.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        offers: {
          where: { status: 'PENDING' },
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json(
      { listings },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    )
  } catch (error) {
    console.error('Error fetching listings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    )
  }
}

// POST /api/raw/listings - Create new listing (authenticated)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const names = deriveUserNames({ name: session.user.name, email: session.user.email })
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: {
        name: names.name ?? undefined,
        fullName: names.fullName,
      },
      create: {
        email: session.user.email,
        name: names.name,
        fullName: names.fullName,
        // Placeholder for non-credentials users; credentials signup sets real hash.
        passwordHash: 'oauth_user_no_password',
      },
    })

    const body = await request.json()
    const { commodity, grade, quantityKg, pricePerKg, location, description } = body
    const commodityStr = typeof commodity === 'string' ? commodity.trim() : ''
    const locationStr = typeof location === 'string' ? location.trim() : ''
    const quantityNum = Number(quantityKg)
    const priceNum = Number(pricePerKg)

    // Validation
    if (!commodityStr || !locationStr || !Number.isFinite(quantityNum) || !Number.isFinite(priceNum)) {
      return NextResponse.json(
        { error: 'Missing required fields: commodity, quantityKg, pricePerKg, location' },
        { status: 400 }
      )
    }

    if (quantityNum <= 0 || priceNum <= 0) {
      return NextResponse.json(
        { error: 'Quantity and price must be positive' },
        { status: 400 }
      )
    }

    const listing = await prisma.rawListing.create({
      data: {
        sellerId: user.id,
        commodity: commodityStr,
        grade,
        quantityKg: Number(quantityNum.toFixed(2)),
        pricePerKg: Number(priceNum.toFixed(2)),
        location: locationStr,
        description
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error) {
    console.error('Error creating listing:', error)
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    )
  }
}
