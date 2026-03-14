import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/app/api/_session-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commodity = searchParams.get('commodity')
    const location = searchParams.get('location')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: {
      isActive: boolean
      commodity?: string
      location?: { contains: string; mode: 'insensitive' }
    } = { isActive: true }

    if (commodity) where.commodity = commodity
    if (location) where.location = { contains: location, mode: 'insensitive' }

    const listings = await prisma.rawListing.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
        offers: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
    })

    return NextResponse.json({ listings })
  } catch (error) {
    console.error('apps/web raw listings GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const commodity = typeof body?.commodity === 'string' ? body.commodity.trim() : ''
    const grade = typeof body?.grade === 'string' ? body.grade.trim() : null
    const location = typeof body?.location === 'string' ? body.location.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const quantityKg = Number(body?.quantityKg)
    const pricePerKg = Number(body?.pricePerKg)

    if (!commodity || !location || !Number.isFinite(quantityKg) || !Number.isFinite(pricePerKg)) {
      return NextResponse.json(
        { error: 'Missing required fields: commodity, quantityKg, pricePerKg, location' },
        { status: 400 },
      )
    }

    if (quantityKg <= 0 || pricePerKg <= 0) {
      return NextResponse.json({ error: 'Quantity and price must be positive' }, { status: 400 })
    }

    const listing = await prisma.rawListing.create({
      data: {
        sellerId: user.id,
        commodity,
        grade,
        quantityKg: Number(quantityKg.toFixed(2)),
        pricePerKg: Number(pricePerKg.toFixed(2)),
        location,
        description,
      },
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error) {
    console.error('apps/web raw listings POST failed', error)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }
}
