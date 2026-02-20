import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json({ listings })
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { commodity, grade, quantityKg, pricePerKg, location, description } = body

    // Validation
    if (!commodity || !quantityKg || !pricePerKg || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: commodity, quantityKg, pricePerKg, location' },
        { status: 400 }
      )
    }

    if (quantityKg <= 0 || pricePerKg <= 0) {
      return NextResponse.json(
        { error: 'Quantity and price must be positive' },
        { status: 400 }
      )
    }

    const listing = await prisma.rawListing.create({
      data: {
        sellerId: user.id,
        commodity,
        grade,
        quantityKg: parseFloat(quantityKg),
        pricePerKg: parseFloat(pricePerKg),
        location,
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
